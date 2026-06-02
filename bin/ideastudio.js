#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const net = require('net');
const https = require('https');
const { spawn } = require('child_process');
const { startServer, stopServer, metadataDir } = require('../index');
const packageJson = require('../package.json');

const PID_FILE = path.join(metadataDir, 'ideastudio-server.json');
const FRONTEND_DIST_INDEX = path.join(__dirname, '..', 'dist', 'index.html');
const UPDATE_CHECK_FILE = path.join(metadataDir, 'update-check.json');
const PACKAGE_NAME = packageJson.name || 'ideastudio-cli';
const PACKAGE_VERSION = packageJson.version || '0.0.0';

function printBanner() {
    console.log('');
    console.log('  IIIII  DDDDD   EEEEE   AAAAA');
    console.log('    I    D   DD  E      AA   AA');
    console.log('    I    D    D  EEEE   AAAAAAA');
    console.log('    I    D   DD  E      AA   AA');
    console.log('  IIIII  DDDDD   EEEEE  AA   AA');
    console.log(`  ${PACKAGE_NAME} v${PACKAGE_VERSION}`);
    console.log('');
}

function setTerminalTitle() {
    const title = `IdeaStudio CLI v${PACKAGE_VERSION}`;
    if (process.platform === 'win32') {
        process.title = title;
    }
    if (process.stdout && process.stdout.isTTY) {
        process.stdout.write(`\u001b]0;${title}\u0007`);
    }
}

function printStopTips() {
    console.log('- Press Ctrl+C to stop');
    console.log('- Or run: ideastudio stop');
}

function parseSemverLike(version) {
    const clean = String(version || '').trim().replace(/^v/i, '');
    const match = clean.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isVersionGreater(a, b) {
    const va = parseSemverLike(a);
    const vb = parseSemverLike(b);
    if (!va || !vb) return false;
    for (let i = 0; i < 3; i += 1) {
        if (va[i] > vb[i]) return true;
        if (va[i] < vb[i]) return false;
    }
    return false;
}

function readUpdateCheckCache() {
    if (!fs.existsSync(UPDATE_CHECK_FILE)) return null;
    try {
        return JSON.parse(fs.readFileSync(UPDATE_CHECK_FILE, 'utf-8'));
    } catch (_) {
        return null;
    }
}

function writeUpdateCheckCache(data) {
    try {
        fs.mkdirSync(metadataDir, { recursive: true });
        fs.writeFileSync(UPDATE_CHECK_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (_) {
        // Ignore cache write failures.
    }
}

function fetchLatestVersion(timeoutMs = 1800) {
    return new Promise((resolve) => {
        const req = https.get(`https://registry.npmjs.org/${encodeURIComponent(PACKAGE_NAME)}/latest`, (res) => {
            if (!res || res.statusCode !== 200) {
                req.destroy();
                return resolve(null);
            }
            let raw = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { raw += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(raw);
                    return resolve(parsed?.version ? String(parsed.version) : null);
                } catch (_) {
                    return resolve(null);
                }
            });
        });
        req.on('error', () => resolve(null));
        req.setTimeout(timeoutMs, () => {
            req.destroy();
            resolve(null);
        });
    });
}

function checkForUpdatesInBackground() {
    const cache = readUpdateCheckCache();
    const now = Date.now();
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;

    if (cache?.lastCheckedAt && (now - Number(cache.lastCheckedAt || 0)) < TWELVE_HOURS) {
        if (cache.latestVersion && isVersionGreater(cache.latestVersion, PACKAGE_VERSION)) {
            console.log(`\nUpdate available: ${PACKAGE_VERSION} -> ${cache.latestVersion}`);
            console.log(`Run: npm update -g ${PACKAGE_NAME}\n`);
        }
        return;
    }

    fetchLatestVersion().then((latestVersion) => {
        if (!latestVersion) return;
        writeUpdateCheckCache({
            lastCheckedAt: Date.now(),
            latestVersion,
        });
        if (isVersionGreater(latestVersion, PACKAGE_VERSION)) {
            console.log(`\nUpdate available: ${PACKAGE_VERSION} -> ${latestVersion}`);
            console.log(`Run: npm update -g ${PACKAGE_NAME}\n`);
        }
    }).catch(() => {});
}

function appendUpdateParams(url, latestVersion) {
    try {
        const u = new URL(url);
        u.searchParams.set('update_available', '1');
        u.searchParams.set('current_version', PACKAGE_VERSION);
        u.searchParams.set('latest_version', String(latestVersion || ''));
        return u.toString();
    } catch (_) {
        return url;
    }
}

async function resolveLatestVersionForOpen() {
    const cache = readUpdateCheckCache();
    if (cache?.latestVersion) return cache.latestVersion;
    const latest = await fetchLatestVersion(1200);
    if (latest) {
        writeUpdateCheckCache({
            lastCheckedAt: Date.now(),
            latestVersion: latest,
        });
    }
    return latest;
}

function registerShutdownHooks(onShutdown) {
    let shuttingDown = false;
    const runOnce = async () => {
        if (shuttingDown) return;
        shuttingDown = true;
        try {
            await onShutdown();
        } catch (_) {
            // Ignore shutdown errors.
        }
    };

    const bind = (eventName) => {
        try {
            process.on(eventName, runOnce);
        } catch (_) {
            // Some signals may not exist on all platforms.
        }
    };

    bind('SIGINT');
    bind('SIGTERM');
    bind('SIGBREAK');
    bind('SIGHUP');
    process.on('beforeExit', runOnce);
    process.on('exit', () => {
        removePidState();
    });
}

function parseArgs(argv) {
    const args = argv.slice(2);
    let port = undefined;
    for (let i = 0; i < args.length; i += 1) {
        const raw = String(args[i] || '');
        if (raw.startsWith('--port=')) {
            const p = Number(raw.slice('--port='.length));
            if (Number.isFinite(p) && p > 0) port = p;
        } else if (raw === '--port') {
            const next = Number(args[i + 1]);
            if (Number.isFinite(next) && next > 0) {
                port = next;
                i += 1;
            }
        }
    }
    return {
        command: args[0] || 'start',
        noOpen: args.includes('--no-open'),
        port,
    };
}

function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (_) {
        return false;
    }
}

function readPidState() {
    if (!fs.existsSync(PID_FILE)) return null;
    try {
        return JSON.parse(fs.readFileSync(PID_FILE, 'utf-8'));
    } catch (_) {
        return null;
    }
}

function writePidState(state) {
    fs.mkdirSync(metadataDir, { recursive: true });
    fs.writeFileSync(PID_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

function removePidState() {
    if (fs.existsSync(PID_FILE)) fs.rmSync(PID_FILE, { force: true });
}

function openBrowser(url) {
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
    child.unref();
}

function runCommand(cmd, args, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, {
            cwd,
            stdio: 'inherit',
            shell: process.platform === 'win32',
        });
        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) return resolve();
            return reject(new Error(`${cmd} ${args.join(' ')} failed with code ${code}`));
        });
    });
}

async function ensureFrontendBuilt() {
    if (fs.existsSync(FRONTEND_DIST_INDEX)) return true;
    return false;
}

function findFreePort(startPort = 27123) {
    return new Promise((resolve) => {
        const tryPort = (port) => {
            const server = net.createServer();
            server.unref();
            server.on('error', () => tryPort(port + 1));
            server.listen(port, '127.0.0.1', () => {
                const found = server.address().port;
                server.close(() => resolve(found));
            });
        };
        tryPort(startPort);
    });
}

async function cmdStop() {
    const state = readPidState();
    if (!state || !state.pid) {
        console.log('IdeaStudio is not running.');
        return;
    }
    if (!isProcessAlive(state.pid)) {
        removePidState();
        console.log('IdeaStudio was not running. Cleaned stale state.');
        return;
    }
    try {
        process.kill(state.pid, 'SIGTERM');
    } catch (_) {
        process.kill(state.pid);
    }
    removePidState();
    console.log(`Stopped IdeaStudio (pid ${state.pid}).`);
}

function cmdDoctor() {
    const state = readPidState();
    const alive = state?.pid ? isProcessAlive(state.pid) : false;
    console.log('IdeaStudio doctor');
    console.log(`- node: ${process.version}`);
    console.log(`- platform: ${process.platform}/${process.arch}`);
    console.log(`- metadataDir: ${metadataDir}`);
    console.log(`- running: ${alive ? 'yes' : 'no'}`);
    if (alive && state?.url) console.log(`- url: ${state.url}`);
}

function cmdUpdate() {
    console.log('Run this command to update globally: npm update -g ideastudio');
}

async function cmdStart(options) {
    setTerminalTitle();
    printBanner();
    checkForUpdatesInBackground();
    const oldState = readPidState();
    const requestedPort = Number(options.port || process.env.IDEASTUDIO_PORT) || null;
    if (oldState?.pid && isProcessAlive(oldState.pid) && oldState?.url) {
        const runningPort = Number(oldState.port || 0) || null;
        const shouldRestartOnNewPort = requestedPort && runningPort && requestedPort !== runningPort;

        if (!shouldRestartOnNewPort) {
            console.log(`IdeaStudio already running at ${oldState.url}`);
            if (!options.noOpen) {
                const latest = await resolveLatestVersionForOpen();
                const urlForOpen = latest && isVersionGreater(latest, PACKAGE_VERSION)
                    ? appendUpdateParams(oldState.url, latest)
                    : oldState.url;
                openBrowser(urlForOpen);
            }
            console.log('Attached to running instance.');
            printStopTips();
            const keepAlive = setInterval(() => {}, 60 * 1000);
            const shutdownAttached = async () => {
                clearInterval(keepAlive);
                try {
                    process.kill(oldState.pid, 'SIGTERM');
                } catch (_) {
                    try {
                        process.kill(oldState.pid);
                    } catch (_) {}
                }
                removePidState();
                process.exit(0);
            };
            registerShutdownHooks(shutdownAttached);
            return;
        }

        console.log(`Restarting IdeaStudio on requested port ${requestedPort} (current ${runningPort}).`);
        try {
            process.kill(oldState.pid, 'SIGTERM');
        } catch (_) {
            try {
                process.kill(oldState.pid);
            } catch (_) {}
        }
        removePidState();
    }
    removePidState();
    const hasBuiltFrontend = await ensureFrontendBuilt();
    if (!hasBuiltFrontend) {
        throw new Error('Missing built frontend at dist/. Run "npm run build:web" for release mode, or run "ideastudio dev" for hot-reload development.');
    }

    const port = requestedPort || await findFreePort(27123);
    const host = '127.0.0.1';
    const { server } = await startServer({ port, host });
    const url = `http://${host}:${port}`;
    writePidState({ pid: process.pid, port, host, url, startedAt: new Date().toISOString() });
    console.log(`IdeaStudio running at ${url}`);
    if (!options.noOpen) {
        const latest = await resolveLatestVersionForOpen();
        const urlForOpen = latest && isVersionGreater(latest, PACKAGE_VERSION)
            ? appendUpdateParams(url, latest)
            : url;
        openBrowser(urlForOpen);
    }
    printStopTips();

    const shutdown = async () => {
        removePidState();
        await stopServer();
        process.exit(0);
    };
    registerShutdownHooks(shutdown);
    server.on('close', () => removePidState());
}

async function cmdDev() {
    setTerminalTitle();
    printBanner();
    checkForUpdatesInBackground();
    removePidState();
    const backendPort = Number(process.env.IDEASTUDIO_PORT) || 27123;
    const host = '127.0.0.1';
    const { server } = await startServer({ port: backendPort, host });
    const rootDir = path.join(__dirname, '..');
    const devUrl = 'http://127.0.0.1:5173';
    console.log(`IdeaStudio dev backend: http://${host}:${backendPort}`);
    console.log(`IdeaStudio dev frontend: ${devUrl}`);
    printStopTips();

    const vite = spawn('npm', ['--prefix', './view', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173'], {
        cwd: rootDir,
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });

    openBrowser(devUrl);

    const shutdown = async () => {
        try {
            if (!vite.killed) vite.kill('SIGTERM');
        } catch (_) {}
        await stopServer();
        process.exit(0);
    };

    registerShutdownHooks(shutdown);
    server.on('close', shutdown);
}

async function main() {
    const options = parseArgs(process.argv);
    if (options.command === 'dev') return cmdDev();
    if (options.command === 'stop') return cmdStop();
    if (options.command === 'doctor') return cmdDoctor();
    if (options.command === 'update') return cmdUpdate();
    return cmdStart(options);
}

main().catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
});
