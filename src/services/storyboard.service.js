const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { projectPath } = require('../../config');

const STORAGE_PATH = path.join(projectPath, 'metadata', 'storyboards');

if (!fs.existsSync(STORAGE_PATH)) {
    fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

const DEFAULT_TEMPLATE_DEFAULTS = {
    style: 'cinematic illustration, cohesive visual style matching the selected style preset',
    character: 'Consistent main character — Character Bible across all scenes',
    scene: 'medium shot, clear location, props and pose',
    emotion: 'clear expression matching scene emotion',
    camera: 'cinematic movement — slow zoom in, slight purposeful pan',
    lighting: 'natural light, soft, late afternoon',
    environment: 'lively environment details',
    mood: 'emotional atmosphere matching theme',
    asmr: ['paper rustling', 'distant ambient sounds'],
    bgm: 'calm, slightly melancholic piano music',
    rules: ['ZERO visible text', 'NARRATOR is voice-over only', 'Only Audio-tagged character may speak'],
};

const DEFAULT_SETTINGS = {
    duration: 60,
    language: 'VI',
    aspectRatio: '9:16',
    stylePreset: 'Anime',
    imageModel: 'GEM_PIX_2',
    videoModel: 'veo3Fast',
    videoTier: 'ultra',
};

class StoryboardController {
    defaultConfig(id, name, description = '') {
        return {
            id,
            name: name || 'New Storyboard',
            description: typeof description === 'string' ? description : '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            settings: { ...DEFAULT_SETTINGS },
            templateDefaults: JSON.parse(JSON.stringify(DEFAULT_TEMPLATE_DEFAULTS)),
            activeTab: 'script',
            ideaText: '',
            outline: null,
            scenes: [],
            generatedCharacters: [],
            characterRef: { name: '', prompt: '', source: 'none', imageUrl: null },
            userCharacterImageUrl: null,
            expandedScenes: {},
            assets: [],
        };
    }

    list(req, res) {
        try {
            if (!fs.existsSync(STORAGE_PATH)) {
                return res.status(200).json({ success: true, data: [] });
            }
            const folders = fs.readdirSync(STORAGE_PATH);
            const projects = folders.map((folder) => {
                const configPath = path.join(STORAGE_PATH, folder, 'config.json');
                if (!fs.existsSync(configPath)) return null;
                try {
                    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                } catch {
                    return null;
                }
            }).filter(Boolean);
            res.status(200).json({ success: true, data: projects });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    getOne(req, res) {
        try {
            const { id } = req.params;
            const configPath = path.join(STORAGE_PATH, id, 'config.json');
            if (!fs.existsSync(configPath)) {
                return res.status(404).json({ success: false, message: 'Storyboard not found' });
            }
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            res.status(200).json({ success: true, data: config });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    create(req, res) {
        try {
            const { name, description } = req.body || {};
            const id = uuidv4();
            const projectDir = path.join(STORAGE_PATH, id);
            const assetsDir = path.join(projectDir, 'assets');
            fs.mkdirSync(assetsDir, { recursive: true });
            const config = this.defaultConfig(id, name, description);
            fs.writeFileSync(path.join(projectDir, 'config.json'), JSON.stringify(config, null, 2));
            res.status(201).json({ success: true, data: config });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    update(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body || {};
            const configPath = path.join(STORAGE_PATH, id, 'config.json');
            if (!fs.existsSync(configPath)) {
                return res.status(404).json({ success: false, message: 'Storyboard not found' });
            }
            const current = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            const next = {
                ...current,
                ...updateData,
                id: current.id,
                updatedAt: new Date().toISOString(),
            };
            fs.writeFileSync(configPath, JSON.stringify(next, null, 2));
            res.status(200).json({ success: true, data: next });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    delete(req, res) {
        try {
            const { id } = req.params;
            const projectDir = path.join(STORAGE_PATH, id);
            if (fs.existsSync(projectDir)) {
                fs.rmSync(projectDir, { recursive: true, force: true });
            }
            res.status(200).json({ success: true, message: 'Storyboard deleted' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async resolveBufferFromSource(source) {
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
            const mimeType = response.headers.get('content-type') || 'application/octet-stream';
            return { buffer: Buffer.from(arrayBuffer), mimeType };
        }
        throw new Error('Unsupported source format');
    }

    extensionFromMime(mimeType) {
        if (mimeType.includes('png')) return '.png';
        if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return '.jpg';
        if (mimeType.includes('webp')) return '.webp';
        if (mimeType.includes('mp4')) return '.mp4';
        if (mimeType.includes('webm')) return '.webm';
        return '.bin';
    }

    async saveAsset(req, res) {
        try {
            const { id } = req.params;
            const { source, kind = 'asset', sceneIndex = null } = req.body || {};
            const projectDir = path.join(STORAGE_PATH, id);
            const assetsDir = path.join(projectDir, 'assets');
            const configPath = path.join(projectDir, 'config.json');
            if (!fs.existsSync(configPath)) {
                return res.status(404).json({ success: false, message: 'Storyboard not found' });
            }
            fs.mkdirSync(assetsDir, { recursive: true });
            const { buffer, mimeType } = await this.resolveBufferFromSource(source);
            const ext = this.extensionFromMime(mimeType);
            const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 10);
            const safeKind = String(kind).replace(/[^a-zA-Z0-9-_]/g, '_');
            const scenePart = sceneIndex != null ? `scene${sceneIndex}-` : '';
            const fileName = `${scenePart}${safeKind}-${Date.now()}-${hash}${ext}`;
            fs.writeFileSync(path.join(assetsDir, fileName), buffer);
            const relativePath = `/storyboards/${id}/assets/${fileName}`;
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            const assets = Array.isArray(config.assets) ? config.assets : [];
            assets.push({
                fileName,
                kind: safeKind,
                sceneIndex,
                mimeType,
                url: relativePath,
                createdAt: new Date().toISOString(),
            });
            config.assets = assets;
            config.updatedAt = new Date().toISOString();
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            res.status(201).json({
                success: true,
                data: {
                    fileName,
                    mimeType,
                    url: `http://localhost:27123${relativePath}`,
                    relativeUrl: relativePath,
                },
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    getTimeline(req, res) {
        try {
            const { id } = req.params;
            const timelinePath = path.join(STORAGE_PATH, id, 'timeline.json');
            if (!fs.existsSync(timelinePath)) {
                return res.status(200).json({ success: true, data: null });
            }
            const raw = fs.readFileSync(timelinePath, 'utf-8');
            res.status(200).json({ success: true, data: JSON.parse(raw) });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    saveTimeline(req, res) {
        try {
            const { id } = req.params;
            const projectDir = path.join(STORAGE_PATH, id);
            const configPath = path.join(projectDir, 'config.json');
            if (!fs.existsSync(configPath)) {
                return res.status(404).json({ success: false, message: 'Storyboard not found' });
            }
            const timelinePath = path.join(projectDir, 'timeline.json');
            fs.writeFileSync(timelinePath, JSON.stringify(req.body ?? {}, null, 2), 'utf-8');
            res.status(200).json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    saveAssetUpload(req, res) {
        try {
            const { id } = req.params;
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'No file uploaded' });
            }
            const projectDir = path.join(STORAGE_PATH, id);
            const configPath = path.join(projectDir, 'config.json');
            if (!fs.existsSync(configPath)) {
                return res.status(404).json({ success: false, message: 'Storyboard not found' });
            }
            const fileName = req.file.filename;
            const relativePath = `/storyboards/${id}/assets/${fileName}`;
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            const assets = Array.isArray(config.assets) ? config.assets : [];
            assets.push({
                fileName,
                kind: String(req.body?.kind || 'upload').replace(/[^a-zA-Z0-9-_]/g, '_'),
                mimeType: req.file.mimetype,
                url: relativePath,
                createdAt: new Date().toISOString(),
            });
            config.assets = assets;
            config.updatedAt = new Date().toISOString();
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            res.status(201).json({
                success: true,
                data: {
                    fileName,
                    mimeType: req.file.mimetype,
                    url: `http://localhost:27123${relativePath}`,
                    relativeUrl: relativePath,
                },
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new StoryboardController();
