const fs = require('fs');
const path = require('path');
const express = require('express');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const { projectPath } = require('./config');
const API_HOST = require('./src/routes');
const BrowserProfileManager = require('./src/modules/browser.module');

require('dotenv').config();

const APP_VERSION = require('./package.json').version || '0.0.0';
const metadataDir = path.join(projectPath, 'metadata');
const bundledMetadataDir = path.join(__dirname, 'metadata');

const browserProfileManager = new BrowserProfileManager({ metadataDir });
let httpServer = null;

const defaultVersionData = {
    app: {
        name: 'IdeaStudio',
        internalName: 'ideastudio-cli',
        description: 'Local web application for IdeaStudio',
        home: 'https://idea2vid.com',
        version: APP_VERSION,
    },
};

function ensureMetadata() {
    fs.mkdirSync(metadataDir, { recursive: true });
    if (fs.existsSync(bundledMetadataDir)) {
        try {
            fs.cpSync(bundledMetadataDir, metadataDir, { recursive: true, force: false, errorOnExist: false });
        } catch (_) {
            // Ignore copy errors for existing files.
        }
    }

    const versionFilePath = path.join(metadataDir, 'version.json');
    if (!fs.existsSync(versionFilePath)) {
        fs.writeFileSync(versionFilePath, JSON.stringify(defaultVersionData, null, 2), 'utf-8');
    }

    const metadataConfigPath = path.join(metadataDir, 'config.json');
    if (!fs.existsSync(metadataConfigPath)) {
        fs.writeFileSync(metadataConfigPath, JSON.stringify({ updatedAt: new Date().toISOString() }, null, 2), 'utf-8');
    }

    const metadataIndexPath = path.join(metadataDir, 'index.html');
    if (!fs.existsSync(metadataIndexPath)) {
        const bundledMetadataIndexPath = path.join(__dirname, 'metadata', 'index.html');
        if (fs.existsSync(bundledMetadataIndexPath)) {
            fs.copyFileSync(bundledMetadataIndexPath, metadataIndexPath);
        } else {
            fs.writeFileSync(metadataIndexPath, '<!doctype html><html><head><meta charset="utf-8"><title>IdeaStudio Metadata</title></head><body>Metadata ready.</body></html>', 'utf-8');
        }
    }
}

function openExternal(target) {
    return new Promise((resolve) => {
        const url = String(target || '').trim();
        if (!url) return resolve({ success: false, message: 'Invalid URL' });

        let cmd = '';
        let args = [];
        if (process.platform === 'win32') {
            cmd = 'cmd';
            args = ['/c', 'start', '', url];
        } else if (process.platform === 'darwin') {
            cmd = 'open';
            args = [url];
        } else {
            cmd = 'xdg-open';
            args = [url];
        }
        const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
        child.on('error', (err) => resolve({ success: false, message: err.message }));
        child.unref();
        resolve({ success: true });
    });
}

function openDirectory(fileOrDirPath) {
    return new Promise((resolve) => {
        try {
            if (!fileOrDirPath || typeof fileOrDirPath !== 'string') {
                return resolve({ success: false, message: 'Thiếu đường dẫn' });
            }
            let dir = fileOrDirPath;
            if (fs.existsSync(fileOrDirPath)) {
                const st = fs.statSync(fileOrDirPath);
                if (st.isFile()) dir = path.dirname(fileOrDirPath);
            } else {
                dir = path.dirname(fileOrDirPath);
            }

            let cmd = '';
            let args = [];
            if (process.platform === 'win32') {
                cmd = 'explorer';
                args = [dir];
            } else if (process.platform === 'darwin') {
                cmd = 'open';
                args = [dir];
            } else {
                cmd = 'xdg-open';
                args = [dir];
            }
            const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
            child.on('error', (err) => resolve({ success: false, message: err.message }));
            child.unref();
            return resolve({ success: true });
        } catch (e) {
            return resolve({ success: false, message: e.message });
        }
    });
}

function runCommandCapture(command, args) {
    return new Promise((resolve) => {
        const child = spawn(command, args, { windowsHide: true });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => { stdout += String(chunk || ''); });
        child.stderr.on('data', (chunk) => { stderr += String(chunk || ''); });
        child.on('error', (err) => resolve({ success: false, message: err.message }));
        child.on('close', (code) => {
            resolve({
                success: code === 0,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                code,
            });
        });
    });
}

function escapeAppleScriptString(str) {
    return String(str || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function normalizeSaveVideoPath(filePath) {
    const trimmed = String(filePath || '').trim();
    if (!trimmed) return '';
    return /\.mp4$/i.test(trimmed) ? trimmed : `${trimmed}.mp4`;
}

async function pickSaveVideoPathWindows(defaultName) {
    const safeDefaultName = String(defaultName || `render-${Date.now()}.mp4`).replace(/"/g, '');
    const psScript = [
        'Add-Type -AssemblyName System.Windows.Forms',
        '$dialog = New-Object System.Windows.Forms.SaveFileDialog',
        '$dialog.Title = "Select output video path"',
        '$dialog.Filter = "MP4 Video (*.mp4)|*.mp4|All Files (*.*)|*.*"',
        '$dialog.FileName = "' + safeDefaultName + '"',
        '$result = $dialog.ShowDialog()',
        'if ($result -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.FileName }',
    ].join('; ');
    const r = await runCommandCapture('powershell', ['-NoProfile', '-STA', '-Command', psScript]);
    if (!r.success) return { success: false, message: r.stderr || r.message || 'Cannot open save dialog' };
    if (!r.stdout) return { success: false, canceled: true };
    return { success: true, filePath: normalizeSaveVideoPath(r.stdout) };
}

async function pickSaveVideoPathDarwin(defaultName) {
    const safeDefaultName = escapeAppleScriptString(defaultName || `render-${Date.now()}.mp4`);
    const script = [
        'try',
        `  set savePath to choose file name with prompt "Select output video path" default name "${safeDefaultName}"`,
        '  return POSIX path of savePath',
        'on error errMsg number errNum',
        '  if errNum is -128 then return ""',
        '  error errMsg number errNum',
        'end try',
    ].join('\n');
    const r = await runCommandCapture('osascript', ['-e', script]);
    if (!r.success) {
        return { success: false, message: r.stderr || r.message || 'Cannot open save dialog on macOS' };
    }
    if (!r.stdout) return { success: false, canceled: true };
    return { success: true, filePath: normalizeSaveVideoPath(r.stdout) };
}

async function pickSaveVideoPathLinux(defaultName) {
    const safeDefaultName = String(defaultName || `render-${Date.now()}.mp4`);
    const zenity = await runCommandCapture('zenity', [
        '--file-selection',
        '--save',
        '--confirm-overwrite',
        '--title=Select output video path',
        `--filename=${safeDefaultName}`,
        '--file-filter=MP4 video | *.mp4',
        '--file-filter=All files | *',
    ]);
    if (zenity.success && zenity.stdout) {
        return { success: true, filePath: normalizeSaveVideoPath(zenity.stdout) };
    }
    if (zenity.code === 1) return { success: false, canceled: true };

    const kdialog = await runCommandCapture('kdialog', [
        '--getsavefilename',
        safeDefaultName,
        'MP4 (*.mp4)|*.mp4',
    ]);
    if (kdialog.success && kdialog.stdout) {
        return { success: true, filePath: normalizeSaveVideoPath(kdialog.stdout) };
    }
    if (kdialog.code === 1) return { success: false, canceled: true };

    const hint = zenity.message || kdialog.message || zenity.stderr || kdialog.stderr;
    return {
        success: false,
        message: hint || 'Install zenity or kdialog to choose a save path on Linux.',
    };
}

async function pickSaveVideoPath(defaultName = '') {
    const name = String(defaultName || `render-${Date.now()}.mp4`);

    if (process.platform === 'win32') {
        return pickSaveVideoPathWindows(name);
    }
    if (process.platform === 'darwin') {
        return pickSaveVideoPathDarwin(name);
    }
    if (process.platform === 'linux') {
        return pickSaveVideoPathLinux(name);
    }

    return { success: false, message: `Save file dialog is not supported on ${process.platform}.` };
}

function registerRuntimeRoutes() {
    API_HOST.use('/metadata', express.static(metadataDir));

    API_HOST.get('/api/system/version', (_req, res) => {
        res.status(200).json({ success: true, data: defaultVersionData });
    });

    API_HOST.post('/api/system/open-external', async (req, res) => {
        const result = await openExternal(req.body?.url);
        if (!result.success) return res.status(400).json(result);
        return res.status(200).json(result);
    });

    API_HOST.post('/api/system/open-directory', async (req, res) => {
        const result = await openDirectory(req.body?.path);
        if (!result.success) return res.status(400).json(result);
        return res.status(200).json(result);
    });

    API_HOST.post('/api/system/save-video-path', async (req, res) => {
        const result = await pickSaveVideoPath(req.body?.defaultName);
        if (result.canceled) return res.status(200).json(result);
        if (!result.success) return res.status(400).json(result);
        return res.status(200).json(result);
    });

    API_HOST.get('/api/profiles', async (_req, res) => {
        try {
            const profiles = await browserProfileManager.listProfiles();
            res.status(200).json({ success: true, data: profiles });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    API_HOST.post('/api/profiles', async (req, res) => {
        try {
            const profile = await browserProfileManager.createProfile(req.body || {});
            res.status(200).json({ success: true, data: profile });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    API_HOST.put('/api/profiles/:id', async (req, res) => {
        try {
            const profile = await browserProfileManager.updateProfile(req.params.id, req.body || {});
            res.status(200).json({ success: true, data: profile });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    API_HOST.delete('/api/profiles/:id', async (req, res) => {
        try {
            const result = await browserProfileManager.deleteProfile(req.params.id);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    API_HOST.post('/api/profiles/:id/open', async (req, res) => {
        try {
            const result = await browserProfileManager.openProfile(req.params.id);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });

    API_HOST.post('/api/profiles/:id/close', async (req, res) => {
        try {
            const result = await browserProfileManager.closeProfile(req.params.id);
            res.status(200).json(result);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
}

const LOOPFLOW_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);
const LOOPFLOW_VIDEO_EXT = new Set(['.mp4', '.webm', '.mov', '.mkv', '.avi']);

async function loopflowCollectRecursive(dir) {
    const out = [];
    let entries;
    try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            out.push(...(await loopflowCollectRecursive(full)));
        } else {
            out.push(full);
        }
    }
    return out;
}

async function loopflowListMedia(rootPath, options = {}) {
    const mode = options.classifyMode === 'bySubfolder' ? 'bySubfolder' : 'byExtension';
    const imageSub = String(options.imageSubfolder || 'images').trim() || 'images';
    const videoSub = String(options.videoSubfolder || 'videos').trim() || 'videos';
    const items = [];

    if (mode === 'bySubfolder') {
        const imgDir = path.join(rootPath, imageSub);
        const vidDir = path.join(rootPath, videoSub);
        const addFiles = async (dir, kind, allowed) => {
            if (!fs.existsSync(dir)) return;
            const files = await loopflowCollectRecursive(dir);
            for (const f of files) {
                const ext = path.extname(f).toLowerCase();
                if (!allowed.has(ext)) continue;
                items.push({ path: f, kind, fileUrl: pathToFileURL(f).href });
            }
        };
        await addFiles(imgDir, 'image', LOOPFLOW_IMAGE_EXT);
        await addFiles(vidDir, 'video', LOOPFLOW_VIDEO_EXT);
        items.sort((a, b) =>
            path.basename(a.path).localeCompare(path.basename(b.path), undefined, { sensitivity: 'base' }),
        );
        return items;
    }

    const all = fs.existsSync(rootPath) ? await loopflowCollectRecursive(rootPath) : [];
    for (const f of all) {
        const ext = path.extname(f).toLowerCase();
        if (LOOPFLOW_IMAGE_EXT.has(ext)) {
            items.push({ path: f, kind: 'image', fileUrl: pathToFileURL(f).href });
        } else if (LOOPFLOW_VIDEO_EXT.has(ext)) {
            items.push({ path: f, kind: 'video', fileUrl: pathToFileURL(f).href });
        }
    }
    items.sort((a, b) =>
        path.basename(a.path).localeCompare(path.basename(b.path), undefined, { sensitivity: 'base' }),
    );
    return items;
}

function registerLoopflowRoute() {
    API_HOST.post('/api/loopflow/list-media', async (req, res) => {
        const payload = req.body || {};
    try {
        const rootPath = payload.rootPath;
        if (!rootPath || typeof rootPath !== 'string') {
                return res.status(400).json({ success: false, message: 'Thiếu đường dẫn thư mục' });
        }
            if (!fs.existsSync(rootPath)) return res.status(404).json({ success: false, message: 'Thư mục không tồn tại' });
        const files = await loopflowListMedia(rootPath, payload);
            return res.status(200).json({ success: true, files });
    } catch (e) {
            return res.status(500).json({ success: false, message: e.message || String(e) });
    }
    });
}

function registerFrontendRoutes() {
    const frontendDistPath = path.join(__dirname, 'dist');
    if (fs.existsSync(path.join(frontendDistPath, 'index.html'))) {
        API_HOST.use(express.static(frontendDistPath));
        API_HOST.get('*', (req, res, next) => {
            if (req.path.startsWith('/api/') || req.path.startsWith('/renders/') || req.path.startsWith('/metadata/')) {
                return next();
            }
            return res.sendFile(path.join(frontendDistPath, 'index.html'));
        });
    } else {
        API_HOST.get('/', (_req, res) => {
            res.status(200).send('IdeaStudio server is running. Build frontend in view/dist to serve UI.');
        });
    }
}

async function startServer({ port = 27123, host = '127.0.0.1' } = {}) {
    ensureMetadata();
    registerRuntimeRoutes();
    registerLoopflowRoute();
    registerFrontendRoutes();

    return new Promise((resolve, reject) => {
        httpServer = API_HOST.listen(port, host, () => {
            resolve({ server: httpServer, port, host });
        });
        httpServer.on('error', reject);
    });
}

async function stopServer() {
    await browserProfileManager.closeAll();
    if (!httpServer) return;
    await new Promise((resolve) => httpServer.close(resolve));
    httpServer = null;
}

module.exports = {
    startServer,
    stopServer,
    metadataDir,
};