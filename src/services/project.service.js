const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { projectPath } = require('../../config');

const STORAGE_PATH = path.join(projectPath, 'metadata', 'resources');

// Đảm bảo thư mục gốc tồn tại
if (!fs.existsSync(STORAGE_PATH)) {
    fs.mkdirSync(STORAGE_PATH, { recursive: true });
}

class ProjectController {
    extractResourceAssetPath(value) {
        if (typeof value !== 'string' || !value) return null;
        const raw = String(value).trim();
        if (!raw) return null;
        const normalized = raw.replace(/\\/g, '/');
        const patterns = [
            /\/resources\/[^/]+\/assets\/[^"'?\s)]+/i,
            /resources\/[^/]+\/assets\/[^"'?\s)]+/i,
            /metadata\/resources\/[^/]+\/assets\/[^"'?\s)]+/i,
        ];
        for (const pattern of patterns) {
            const match = normalized.match(pattern);
            if (!match) continue;
            let p = match[0];
            if (p.startsWith('metadata/')) p = `/${p.slice('metadata'.length)}`;
            if (!p.startsWith('/')) p = `/${p}`;
            return p;
        }
        return null;
    }

    collectUsedAssetPaths(value, bucket) {
        if (!value) return;
        if (typeof value === 'string') {
            const assetPath = this.extractResourceAssetPath(value);
            if (assetPath) bucket.add(assetPath);
            return;
        }
        if (Array.isArray(value)) {
            value.forEach((item) => this.collectUsedAssetPaths(item, bucket));
            return;
        }
        if (typeof value === 'object') {
            Object.values(value).forEach((item) => this.collectUsedAssetPaths(item, bucket));
        }
    }

    pruneUnusedAssets(projectId, config) {
        const projectDir = path.join(STORAGE_PATH, projectId);
        const assetsDir = path.join(projectDir, 'assets');
        if (!fs.existsSync(assetsDir)) return [];

        const usedPaths = new Set();
        this.collectUsedAssetPaths(config.nodes || [], usedPaths);
        this.collectUsedAssetPaths(config.edges || [], usedPaths);

        // Keep assets referenced by timeline editor too (tracks[].clips[].source + resources[]).
        const timelinePath = path.join(projectDir, 'timeline.json');
        if (fs.existsSync(timelinePath)) {
            try {
                const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));
                this.collectUsedAssetPaths(timeline?.resources || [], usedPaths);
                this.collectUsedAssetPaths(timeline?.tracks || [], usedPaths);
            } catch (_) {
                // Ignore timeline parse errors during prune; never fail project save for this.
            }
        }

        const assets = Array.isArray(config.assets) ? config.assets : [];
        const keptAssets = [];
        const deletedFiles = [];

        assets.forEach((asset) => {
            const rel = this.extractResourceAssetPath(asset?.url);
            const inUse = rel && usedPaths.has(rel);
            const filePath = path.join(assetsDir, asset.fileName || '');
            if (inUse) {
                keptAssets.push(asset);
                return;
            }
            if (asset?.fileName && fs.existsSync(filePath)) {
                fs.rmSync(filePath, { force: true });
                deletedFiles.push(asset.fileName);
            }
        });

        config.assets = keptAssets;
        return deletedFiles;
    }

    async resolveBufferFromSource(source) {
        if (!source || typeof source !== 'string') {
            throw new Error('Invalid source');
        }

        if (source.startsWith('data:')) {
            const matches = source.match(/^data:([^;]+);base64,(.+)$/);
            if (!matches) throw new Error('Invalid data URL');
            const mimeType = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            return { buffer, mimeType };
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
        if (mimeType.includes('gif')) return '.gif';
        if (mimeType.includes('mp4')) return '.mp4';
        if (mimeType.includes('webm')) return '.webm';
        return '.bin';
    }

    // Lấy danh sách project (đọc tất cả file config.json)
    list(req, res) {
        try {
            const projectFolders = fs.readdirSync(STORAGE_PATH);
            const projects = projectFolders.map(folder => {
                const configPath = path.join(STORAGE_PATH, folder, 'config.json');
                if (fs.existsSync(configPath)) {
                    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                }
                return null;
            }).filter(p => p !== null);

            res.status(200).json({ success: true, data: projects });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Tạo project mới
    create(req, res) {
        try {
            const { name, description, aspectPreset } = req.body || {};
            const id = uuidv4();
            const projectDir = path.join(STORAGE_PATH, id);
            const assetsDir = path.join(projectDir, 'assets');

            // Tạo thư mục project và assets
            fs.mkdirSync(projectDir, { recursive: true });
            fs.mkdirSync(assetsDir, { recursive: true });

            const preset = String(aspectPreset || 'portrait').toLowerCase();
            const aspectMap = {
                landscape: {
                    imageAspectRatio: 'IMAGE_ASPECT_RATIO_LANDSCAPE',
                    videoAspectRatio: 'VIDEO_ASPECT_RATIO_LANDSCAPE',
                },
                portrait: {
                    imageAspectRatio: 'IMAGE_ASPECT_RATIO_PORTRAIT',
                    videoAspectRatio: 'VIDEO_ASPECT_RATIO_PORTRAIT',
                },
                square: {
                    imageAspectRatio: 'IMAGE_ASPECT_RATIO_SQUARE',
                    videoAspectRatio: 'VIDEO_ASPECT_RATIO_SQUARE',
                },
            };
            const ar = aspectMap[preset] || aspectMap.portrait;

            const config = {
                id,
                name: name || 'New Project',
                description: typeof description === 'string' ? description : '',
                aspectPreset: aspectMap[preset] ? preset : 'portrait',
                imageAspectRatio: ar.imageAspectRatio,
                videoAspectRatio: ar.videoAspectRatio,
                nodes: [],
                edges: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            fs.writeFileSync(path.join(projectDir, 'config.json'), JSON.stringify(config, null, 2));
            res.status(201).json({ success: true, data: config });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Lấy chi tiết 1 project
    getOne(req, res) {
        try {
            const { id } = req.params;
            const configPath = path.join(STORAGE_PATH, id, 'config.json');
            if (!fs.existsSync(configPath)) {
                return res.status(404).json({ success: false, message: 'Project not found' });
            }
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            res.status(200).json({ success: true, data: config });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Cập nhật project (Lưu Flow)
    update(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body; // chứa { nodes, edges, name, ... }
            const projectDir = path.join(STORAGE_PATH, id);
            const configPath = path.join(projectDir, 'config.json');

            if (!fs.existsSync(configPath)) {
                return res.status(404).json({ success: false, message: 'Project not found' });
            }

            const currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            const newConfig = {
                ...currentConfig,
                ...updateData,
                updatedAt: new Date().toISOString()
            };

            fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
            res.status(200).json({ success: true, data: newConfig });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Xóa project
    delete(req, res) {
        try {
            const { id } = req.params;
            const projectDir = path.join(STORAGE_PATH, id);
            if (fs.existsSync(projectDir)) {
                fs.rmSync(projectDir, { recursive: true, force: true });
            }
            res.status(200).json({ success: true, message: 'Project deleted' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async saveAsset(req, res) {
        try {
            const { id } = req.params;
            const { source, nodeId = 'node', kind = 'asset' } = req.body || {};
            const projectDir = path.join(STORAGE_PATH, id);
            const assetsDir = path.join(projectDir, 'assets');
            const configPath = path.join(projectDir, 'config.json');

            if (!fs.existsSync(configPath)) {
                return res.status(404).json({ success: false, message: 'Project not found' });
            }

            fs.mkdirSync(assetsDir, { recursive: true });

            const { buffer, mimeType } = await this.resolveBufferFromSource(source);
            const ext = this.extensionFromMime(mimeType);
            const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 10);
            const safeNodeId = String(nodeId).replace(/[^a-zA-Z0-9-_]/g, '_');
            const safeKind = String(kind).replace(/[^a-zA-Z0-9-_]/g, '_');
            const fileName = `${safeNodeId}-${safeKind}-${Date.now()}-${hash}${ext}`;
            const filePath = path.join(assetsDir, fileName);
            fs.writeFileSync(filePath, buffer);

            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            const nextAssets = Array.isArray(config.assets) ? config.assets : [];
            const relativePath = `/resources/${id}/assets/${fileName}`;
            nextAssets.push({
                fileName,
                kind: safeKind,
                nodeId: safeNodeId,
                mimeType,
                url: relativePath,
                createdAt: new Date().toISOString()
            });

            config.assets = nextAssets;
            config.updatedAt = new Date().toISOString();
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

            res.status(201).json({
                success: true,
                data: {
                    fileName,
                    mimeType,
                    url: `http://localhost:27123${relativePath}`,
                    relativeUrl: relativePath
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /** Upload file nhị phân (multipart) — tránh 413 do JSON base64 quá lớn */
    saveAssetUpload(req, res) {
        try {
            const { id } = req.params;
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Thiếu file (field name: file)' });
            }
            const projectDir = path.join(STORAGE_PATH, id);
            const configPath = path.join(projectDir, 'config.json');
            if (!fs.existsSync(configPath)) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (_) { /* ignore */ }
                return res.status(404).json({ success: false, message: 'Project not found' });
            }

            const fileName = req.file.filename;
            const mimeType = req.file.mimetype || 'application/octet-stream';
            const safeNodeId = String(req.body?.nodeId || 'node').replace(/[^a-zA-Z0-9-_]/g, '_');
            const safeKind = String(req.body?.kind || 'asset').replace(/[^a-zA-Z0-9-_]/g, '_');
            const relativePath = `/resources/${id}/assets/${fileName}`;

            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            const nextAssets = Array.isArray(config.assets) ? config.assets : [];
            nextAssets.push({
                fileName,
                kind: safeKind,
                nodeId: safeNodeId,
                mimeType,
                url: relativePath,
                createdAt: new Date().toISOString()
            });
            config.assets = nextAssets;
            config.updatedAt = new Date().toISOString();
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

            res.status(201).json({
                success: true,
                data: {
                    fileName,
                    mimeType,
                    url: `http://localhost:27123${relativePath}`,
                    relativeUrl: relativePath
                }
            });
        } catch (error) {
            if (req.file?.path && fs.existsSync(req.file.path)) {
                try {
                    fs.unlinkSync(req.file.path);
                } catch (_) { /* ignore */ }
            }
            res.status(500).json({ success: false, message: error.message });
        }
    }

    /** Đọc timeline editor (RenderView) — file timeline.json trong thư mục project */
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

    /** Lưu timeline editor vào timeline.json */
    saveTimeline(req, res) {
        try {
            const { id } = req.params;
            const projectDir = path.join(STORAGE_PATH, id);
            const configPath = path.join(projectDir, 'config.json');
            if (!fs.existsSync(configPath)) {
                return res.status(404).json({ success: false, message: 'Project not found' });
            }
            const timelinePath = path.join(projectDir, 'timeline.json');
            fs.writeFileSync(timelinePath, JSON.stringify(req.body ?? {}, null, 2), 'utf-8');
            res.status(200).json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new ProjectController();