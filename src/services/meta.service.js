const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { projectPath } = require('../../config');
const ffprobeStatic = require('ffprobe-static');

const normalizeBinaryPath = (binPath = '') => String(binPath || '').replace('app.asar', 'app.asar.unpacked');
const FFPROBE_PATH = normalizeBinaryPath(ffprobeStatic?.path || '');

class meta {
    constructor() { }
    create(req, res) {
        const {
            type = 'image',
            data = ''
        } = req.body

        return res.status(200).json({
            success: true,
            data: {
                url: ``
            }
        })
    }
    async uploadVideoFromAsset(req, res) {
        try {
            const { assetPath = '', nanoToken = '' } = req.body || {};
            if (!assetPath) {
                return res.status(400).json({ success: false, message: 'assetPath is required' });
            }
            if (!nanoToken) {
                return res.status(400).json({ success: false, message: 'nanoToken is required' });
            }

            let relativePath = assetPath.replace(/\\/g, '/');
            if (relativePath.startsWith('http://localhost:27123')) {
                relativePath = relativePath.replace('http://localhost:27123', '');
            }
            if (relativePath.startsWith('/')) relativePath = relativePath.slice(1);
            if (relativePath.startsWith('resources/')) relativePath = `metadata/${relativePath}`;
            if (!relativePath.startsWith('metadata/resources/')) {
                return res.status(400).json({ success: false, message: 'Invalid asset path' });
            }

            const fullPath = path.resolve(projectPath, relativePath);
            const metadataRoot = path.resolve(projectPath, 'metadata');
            if (!fullPath.startsWith(metadataRoot)) {
                return res.status(400).json({ success: false, message: 'Asset path is out of metadata scope' });
            }
            if (!fs.existsSync(fullPath)) {
                return res.status(404).json({ success: false, message: 'Asset file not found' });
            }

            const buffer = fs.readFileSync(fullPath);
            const fileName = path.basename(fullPath);
            const formData = new FormData();
            formData.append('video', new Blob([buffer], { type: 'video/mp4' }), fileName);

            const upstream = await fetch('https://flow-api.nanoai.pics/api/studio/upload-video', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${nanoToken}`
                },
                body: formData
            });

            const payload = await upstream.json();
            if (!upstream.ok || !payload?.success) {
                return res.status(400).json({
                    success: false,
                    message: (typeof payload?.data === 'string' ? payload.data : '') || payload?.error || payload?.message || 'Upload video failed',
                    data: payload
                });
            }

            return res.status(200).json({
                success: true,
                data: payload.data
            });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }
    async mediaDuration(req, res) {
        try {
            const { source = '' } = req.body || {};
            if (!source) {
                return res.status(400).json({ success: false, message: 'source is required' });
            }

            const resolvedPath = this.resolveLocalSourcePath(source);
            if (!resolvedPath || !fs.existsSync(resolvedPath)) {
                return res.status(404).json({ success: false, message: 'Media file not found' });
            }

            const duration = await this.ffprobeDuration(resolvedPath);
            return res.status(200).json({ success: true, data: { duration } });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message || 'Failed to read media duration' });
        }
    }
    resolveLocalSourcePath(source = '') {
        let sourcePath = String(source || '').replace(/\\/g, '/');
        if (sourcePath.startsWith('http://localhost:27123')) {
            sourcePath = sourcePath.replace('http://localhost:27123', '');
        }
        if (sourcePath.startsWith('/')) sourcePath = sourcePath.slice(1);
        if (sourcePath.startsWith('resources/')) sourcePath = `metadata/${sourcePath}`;
        if (!sourcePath.startsWith('metadata/resources/')) return null;

        const fullPath = path.resolve(projectPath, sourcePath);
        const metadataRoot = path.resolve(projectPath, 'metadata');
        if (!fullPath.startsWith(metadataRoot)) return null;
        return fullPath;
    }
    ffprobeDuration(filePath) {
        return new Promise((resolve, reject) => {
            if (!FFPROBE_PATH) {
                reject(new Error('ffprobe binary not found. Please reinstall app dependencies.'));
                return;
            }
            const args = [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                filePath
            ];
            const proc = spawn(FFPROBE_PATH, args, { windowsHide: true });
            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
            proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
            proc.on('error', (err) => reject(err));
            proc.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(stderr || `ffprobe exited with code ${code}`));
                    return;
                }
                const duration = Number.parseFloat((stdout || '').trim());
                if (!Number.isFinite(duration) || duration <= 0) {
                    reject(new Error('Invalid media duration'));
                    return;
                }
                resolve(duration);
            });
        });
    }
    list() { }
}

module.exports = new meta