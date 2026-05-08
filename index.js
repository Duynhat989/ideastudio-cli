// main.js
const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { projectPath, isDev } = require('./config');
const BrowserProfileManager = require('./src/modules/browser.module');
const API_HOST = require('./src/routes');
const express = require('express')

require('dotenv').config();

const defaultVersionData = {
    app: {
        name: 'IdeaStudio',
        internalName: 'ideastudio-desktop',
        description: 'Desktop application for IdeaStudio',
        home: 'https://idea2vid.com',
        version: app.getVersion ? app.getVersion() : '0.0.0'
    }
};

const metadataDir = path.join(projectPath, 'metadata');
const bundledMetadataCandidates = [
    path.join(process.resourcesPath || '', 'metadata'),
    path.join(__dirname, 'metadata'),
].filter(Boolean);
const bundledMetadataDir = bundledMetadataCandidates.find((p) => fs.existsSync(p));

fs.mkdirSync(metadataDir, { recursive: true });

// Migrate legacy install-dir metadata into user data dir on first packaged runs.
const legacyMetadataDir = path.join(path.dirname(process.execPath), 'metadata');
if (!isDev && fs.existsSync(legacyMetadataDir)) {
    try {
        fs.cpSync(legacyMetadataDir, metadataDir, { recursive: true, force: false, errorOnExist: false });
    } catch (_) {
        // Ignore migrate failures; app can still run with current files.
    }
}

// Seed user data metadata from bundled defaults when available.
if (bundledMetadataDir) {
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

let versionData = defaultVersionData;
try {
    versionData = JSON.parse(fs.readFileSync(versionFilePath, 'utf-8'));
} catch (err) {
    console.error('Cannot read metadata/version.json, using default.', err);
}

API_HOST.use('/', express.static(metadataDir))
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('window-run-application', async (event, data) => {
    try {
        const vector = JSON.parse(data);
        console.log('Dữ liệu nhận:', vector);
    } catch (err) {
        console.error('Lỗi parse JSON:', err);
    }
});
let mainWindow
let browserProfileManager
const openDeveloperTools = () => {
    mainWindow.webContents.openDevTools()
}

const isVueJs = true
let withFrame = false
function createWindow() {
    // Update metadata
    API_HOST.listen(27123, '127.0.0.1', () => {
        console.log('Command server running at 127.0.0.1:27123')
    })

    mainWindow = new BrowserWindow({
        width: 700,
        height: 500,
        icon: path.join(__dirname, 'src/assets/logo_ico.ico'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            enableRemoteModule: false,
            webSecurity: false
        },
    });
    if (!isVueJs) {
        mainWindow.loadFile(path.join(__dirname, 'view', 'dist', 'index.html'));
    } else {
        // Khi chạy dev
        mainWindow.loadURL(`http://localhost:5173/`);
        // setTimeout(() => {
        //     mainWindow.webContents.openDevTools()
        // }, 1000)
    }

    function registerService(prefix, fn) {
        if (typeof fn !== 'function') {
            throw new Error(`Service phải là một hàm`);
        }

        const channel = prefix; // dùng chính prefix làm channel
        console.log(`Register IPC: ${channel}`);

        ipcMain.handle(channel, async (event, ...args) => {
            try {
                const result = await fn(...args);
                return result;
            } catch (error) {
                console.error(`Lỗi IPC ${channel}:`, error);
                return { success: false, message: error.message };
            }
        });
    }

}

function registerBrowserProfileIpc() {
    ipcMain.handle('profiles:list', async () => {
        try {
            const profiles = await browserProfileManager.listProfiles();
            return { success: true, data: profiles };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('profiles:create', async (_event, payload = {}) => {
        try {
            const profile = await browserProfileManager.createProfile(payload);
            return { success: true, data: profile };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('profiles:update', async (_event, payload = {}) => {
        try {
            const { id, ...rest } = payload || {};
            if (!id) return { success: false, message: 'Missing profile id' };
            const profile = await browserProfileManager.updateProfile(id, rest);
            return { success: true, data: profile };
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('profiles:delete', async (_event, payload = {}) => {
        try {
            const id = payload?.id;
            if (!id) return { success: false, message: 'Missing profile id' };
            return await browserProfileManager.deleteProfile(id);
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('profiles:open', async (_event, payload = {}) => {
        try {
            const id = payload?.id;
            if (!id) return { success: false, message: 'Missing profile id' };
            return await browserProfileManager.openProfile(id);
        } catch (error) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('profiles:close', async (_event, payload = {}) => {
        try {
            const id = payload?.id;
            if (!id) return { success: false, message: 'Missing profile id' };
            return await browserProfileManager.closeProfile(id);
        } catch (error) {
            return { success: false, message: error.message };
        }
    });
}
const sendToVueJs = async (objectData) => {
    mainWindow.webContents.send('server-status-change', objectData);
}
ipcMain.on('window-fullscreen', (event, payload) => {

    if (mainWindow) {
        mainWindow.frame = true; // 👈 hiện header
        mainWindow.maximize(); // 👈 full màn nhưng vẫn có taskbar
        mainWindow.show();
    }
});
app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    browserProfileManager = new BrowserProfileManager({ metadataDir });
    registerBrowserProfileIpc();
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
    setTimeout(() => {
        sendToVueJs({ success: true, type: 'version', data: versionData });
    }, 3000);
});

app.on('before-quit', async () => {
    if (browserProfileManager) {
        await browserProfileManager.closeAll();
    }
});

ipcMain.handle('dialog:save-video-path', async (_event, payload = {}) => {
    const defaultName = payload.defaultName || `render-${Date.now()}.mp4`;
    const result = await dialog.showSaveDialog({
        title: 'Select output video path',
        defaultPath: path.join(projectPath, 'metadata', 'renders', defaultName),
        filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
    });
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    return { success: true, filePath: result.filePath };
});

/** Mở thư mục chứa file (hoặc đường dẫn thư mục) trong Explorer / Finder — không mở file bằng app mặc định. */
ipcMain.handle('shell:open-directory', async (_event, fileOrDirPath) => {
    try {
        if (!fileOrDirPath || typeof fileOrDirPath !== 'string') {
            return { success: false, message: 'Thiếu đường dẫn' };
        }
        let dir = fileOrDirPath;
        if (fs.existsSync(fileOrDirPath)) {
            const st = fs.statSync(fileOrDirPath);
            if (st.isFile()) dir = path.dirname(fileOrDirPath);
        } else {
            dir = path.dirname(fileOrDirPath);
        }
        const errMsg = await shell.openPath(dir);
        if (errMsg) return { success: false, message: errMsg };
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

/** Mở URL trong trình duyệt mặc định (Nano AI sign-in, v.v.). */
ipcMain.handle('shell:open-external', async (_event, url) => {
    try {
        if (!url || typeof url !== 'string') {
            return { success: false, message: 'Invalid URL' };
        }
        await shell.openExternal(url);
        return { success: true };
    } catch (e) {
        return { success: false, message: e.message };
    }
});

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

ipcMain.handle('dialog:open-directory', async () => {
    const win = BrowserWindow.getFocusedWindow() || mainWindow;
    if (!win) return { success: false, message: 'Chưa có cửa sổ' };
    const r = await dialog.showOpenDialog(win, {
        title: 'Chọn thư mục ảnh / video',
        properties: ['openDirectory'],
    });
    if (r.canceled || !r.filePaths?.length) return { success: false, canceled: true };
    return { success: true, path: r.filePaths[0] };
});

ipcMain.handle('loopflow:list-media', async (_event, payload = {}) => {
    try {
        const rootPath = payload.rootPath;
        if (!rootPath || typeof rootPath !== 'string') {
            return { success: false, message: 'Thiếu đường dẫn thư mục' };
        }
        if (!fs.existsSync(rootPath)) return { success: false, message: 'Thư mục không tồn tại' };
        const files = await loopflowListMedia(rootPath, payload);
        return { success: true, files };
    } catch (e) {
        return { success: false, message: e.message || String(e) };
    }
});