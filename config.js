const os = require('os');
const path = require('path');

const isDev = process.argv.includes('--dev');
const APP_NAME = 'IdeaStudio';

function resolvePackagedDataRoot() {
    try {
        const { app } = require('electron');
        if (app && typeof app.getPath === 'function') {
            return app.getPath('userData');
        }
    } catch (_) {
        // Ignore when running in plain node context.
    }

    if (process.platform === 'win32') {
        const roaming = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
        return path.join(roaming, APP_NAME);
    }
    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
    }
    return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), APP_NAME);
}

// Keep current behavior in dev (workspace metadata), switch to user-scoped data dir in packaged app.
const projectPath = isDev ? process.cwd() : resolvePackagedDataRoot();

module.exports = {
    isDev,
    projectPath
};