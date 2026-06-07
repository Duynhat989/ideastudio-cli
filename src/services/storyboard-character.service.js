const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { projectPath } = require('../../config');

const CHARACTERS_ROOT = path.join(projectPath, 'metadata', 'storyboards', 'characters');

if (!fs.existsSync(CHARACTERS_ROOT)) {
    fs.mkdirSync(CHARACTERS_ROOT, { recursive: true });
}

function characterDir(id) {
    return path.join(CHARACTERS_ROOT, id);
}

function infoPath(id) {
    return path.join(characterDir(id), 'character.json');
}

function defaultCharacter(id, overrides = {}) {
    const now = new Date().toISOString();
    return {
        id,
        name: '',
        description: '',
        role: '',
        prompt: '',
        stylePreset: '',
        imageUrl: null,
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}

function readInfo(id) {
    const file = infoPath(id);
    if (!fs.existsSync(file)) return null;
    try {
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
        return null;
    }
}

function writeInfo(id, data) {
    const dir = characterDir(id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(infoPath(id), JSON.stringify(data, null, 2));
}

function extensionFromMime(mimeType) {
    const m = String(mimeType || '').toLowerCase();
    if (m.includes('png')) return '.png';
    if (m.includes('jpeg') || m.includes('jpg')) return '.jpg';
    if (m.includes('webp')) return '.webp';
    return '.png';
}

async function resolveBufferFromSource(source) {
    if (!source || typeof source !== 'string') throw new Error('Invalid source');
    if (source.startsWith('data:')) {
        const matches = source.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) throw new Error('Invalid data URL');
        return { buffer: Buffer.from(matches[2], 'base64'), mimeType: matches[1] };
    }
    if (source.startsWith('http://') || source.startsWith('https://') || source.startsWith('blob:')) {
        const response = await fetch(source);
        if (!response.ok) throw new Error(`Failed to fetch source: ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        return {
            buffer: Buffer.from(arrayBuffer),
            mimeType: response.headers.get('content-type') || 'image/png',
        };
    }
    const localPath = source.startsWith('/storyboards/')
        ? path.join(projectPath, 'metadata', source.replace(/^\//, ''))
        : source;
    if (fs.existsSync(localPath)) {
        const buffer = fs.readFileSync(localPath);
        const ext = path.extname(localPath).toLowerCase();
        const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
            : ext === '.webp' ? 'image/webp' : 'image/png';
        return { buffer, mimeType };
    }
    throw new Error('Unsupported source format');
}

function saveImageBuffer(id, buffer, mimeType) {
    const ext = extensionFromMime(mimeType);
    const fileName = `image${ext}`;
    const dir = characterDir(id);
    fs.mkdirSync(dir, { recursive: true });
    for (const f of fs.readdirSync(dir)) {
        if (/^image\.(png|jpe?g|webp)$/i.test(f)) {
            fs.unlinkSync(path.join(dir, f));
        }
    }
    fs.writeFileSync(path.join(dir, fileName), buffer);
    return `/storyboards/characters/${id}/${fileName}`;
}

class StoryboardCharacterController {
    list(_req, res) {
        try {
            if (!fs.existsSync(CHARACTERS_ROOT)) {
                return res.status(200).json({ success: true, data: [] });
            }
            const folders = fs.readdirSync(CHARACTERS_ROOT, { withFileTypes: true })
                .filter((d) => d.isDirectory())
                .map((d) => d.name);
            const items = folders.map((id) => readInfo(id)).filter(Boolean)
                .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
            res.status(200).json({ success: true, data: items });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    getOne(req, res) {
        try {
            const info = readInfo(req.params.id);
            if (!info) {
                return res.status(404).json({ success: false, message: 'Character not found' });
            }
            res.status(200).json({ success: true, data: info });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async create(req, res) {
        try {
            const body = req.body || {};
            const id = uuidv4();
            const info = defaultCharacter(id, {
                name: String(body.name || '').trim(),
                description: String(body.description || '').trim(),
                role: String(body.role || '').trim(),
                prompt: typeof body.prompt === 'string' ? body.prompt : JSON.stringify(body.prompt || ''),
                stylePreset: String(body.stylePreset || '').trim(),
            });
            if (body.imageSource) {
                const { buffer, mimeType } = await resolveBufferFromSource(body.imageSource);
                info.imageUrl = saveImageBuffer(id, buffer, mimeType);
            }
            writeInfo(id, info);
            res.status(201).json({ success: true, data: info });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    update(req, res) {
        try {
            const { id } = req.params;
            const current = readInfo(id);
            if (!current) {
                return res.status(404).json({ success: false, message: 'Character not found' });
            }
            const body = req.body || {};
            const next = {
                ...current,
                name: body.name != null ? String(body.name).trim() : current.name,
                description: body.description != null ? String(body.description).trim() : current.description,
                role: body.role != null ? String(body.role).trim() : current.role,
                prompt: body.prompt != null
                    ? (typeof body.prompt === 'string' ? body.prompt : JSON.stringify(body.prompt))
                    : current.prompt,
                stylePreset: body.stylePreset != null ? String(body.stylePreset).trim() : current.stylePreset,
                updatedAt: new Date().toISOString(),
            };
            writeInfo(id, next);
            res.status(200).json({ success: true, data: next });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    delete(req, res) {
        try {
            const { id } = req.params;
            const dir = characterDir(id);
            if (fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true, force: true });
            }
            res.status(200).json({ success: true, message: 'Character deleted' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    saveImageUpload(req, res) {
        try {
            const { id } = req.params;
            const current = readInfo(id);
            if (!current) {
                return res.status(404).json({ success: false, message: 'Character not found' });
            }
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'No file uploaded' });
            }
            const buffer = fs.readFileSync(req.file.path);
            const imageUrl = saveImageBuffer(id, buffer, req.file.mimetype);
            try { fs.unlinkSync(req.file.path); } catch { /* temp cleanup */ }
            const next = { ...current, imageUrl, updatedAt: new Date().toISOString() };
            writeInfo(id, next);
            res.status(200).json({ success: true, data: next });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    createWithUpload(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'No file uploaded' });
            }
            const id = uuidv4();
            const body = req.body || {};
            const buffer = fs.readFileSync(req.file.path);
            const imageUrl = saveImageBuffer(id, buffer, req.file.mimetype);
            try { fs.unlinkSync(req.file.path); } catch { /* temp cleanup */ }
            const info = defaultCharacter(id, {
                name: String(body.name || req.file.originalname || 'Character').trim(),
                description: String(body.description || '').trim(),
                role: String(body.role || '').trim(),
                prompt: String(body.prompt || '').trim(),
                stylePreset: String(body.stylePreset || '').trim(),
                imageUrl,
            });
            writeInfo(id, info);
            res.status(201).json({ success: true, data: info });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new StoryboardCharacterController();
