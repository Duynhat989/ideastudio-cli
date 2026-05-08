const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { projectPath } = require('../../config');

function getRandomFileFingerprint() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/136.0.0.0 Safari/537.36',
    ];
    const viewports = [
        { width: 1366, height: 768 },
        { width: 1440, height: 900 },
        { width: 1536, height: 864 },
        { width: 1920, height: 1080 },
    ];
    const memories = [4, 8, 16];
    const threads = [4, 8, 12];
    const gpus = [
        { vendor: 'Intel Inc.', renderer: 'Intel Iris OpenGL Engine' },
        { vendor: 'NVIDIA Corporation', renderer: 'NVIDIA GeForce RTX 3060' },
        { vendor: 'AMD', renderer: 'AMD Radeon Graphics' },
    ];

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    return {
        ua: pick(userAgents),
        viewport: pick(viewports),
        memory: pick(memories),
        threads: pick(threads),
        gpu: pick(gpus),
    };
}

class BrowserProfileManager {
    constructor(options = {}) {
        this.metadataDir = options.metadataDir || path.join(projectPath, 'metadata');
        this.profilesDir = path.join(this.metadataDir, 'profiles');
        this.profilesFile = path.join(this.metadataDir, 'profiles.json');
        this.browserSessions = new Map();
    }

    async init() {
        await fsp.mkdir(this.metadataDir, { recursive: true });
        await fsp.mkdir(this.profilesDir, { recursive: true });
        if (!fs.existsSync(this.profilesFile)) {
            await fsp.writeFile(this.profilesFile, '[]', 'utf-8');
        }
    }

    async listProfiles() {
        await this.init();
        return this.#readProfiles();
    }

    async createProfile(payload = {}) {
        const list = await this.#readProfiles();
        const now = new Date().toISOString();
        const fingerprint = payload.randomize === false
            ? this.#normalizeFingerprint(payload.fingerprint || {})
            : this.#buildRandomFingerprint();
        const profile = {
            id: crypto.randomUUID(),
            name: String(payload.name || `Profile ${list.length + 1}`).trim(),
            browser: payload.browser || 'Chrome',
            proxy: payload.proxy || '',
            fingerprint,
            createdAt: now,
            updatedAt: now,
        };
        list.push(profile);
        await this.#writeProfiles(list);
        return profile;
    }

    async updateProfile(profileId, payload = {}) {
        const list = await this.#readProfiles();
        const index = list.findIndex((x) => x.id === profileId);
        if (index < 0) {
            throw new Error('Profile not found');
        }
        const current = list[index];
        const next = {
            ...current,
            name: payload.name !== undefined ? String(payload.name).trim() : current.name,
            browser: payload.browser !== undefined ? payload.browser : current.browser,
            proxy: payload.proxy !== undefined ? payload.proxy : current.proxy,
            fingerprint: payload.fingerprint
                ? this.#normalizeFingerprint(payload.fingerprint)
                : current.fingerprint,
            updatedAt: new Date().toISOString(),
        };
        list[index] = next;
        await this.#writeProfiles(list);
        return next;
    }

    async deleteProfile(profileId) {
        const list = await this.#readProfiles();
        const index = list.findIndex((x) => x.id === profileId);
        if (index < 0) {
            return { success: false, message: 'Profile not found' };
        }

        await this.closeProfile(profileId);

        const next = list.filter((x) => x.id !== profileId);
        await this.#writeProfiles(next);

        const profileDataDir = path.join(this.profilesDir, `profile_${profileId}`);
        await fsp.rm(profileDataDir, { recursive: true, force: true });
        return { success: true };
    }

    async openProfile(profileId) {
        const list = await this.#readProfiles();
        const profile = list.find((x) => x.id === profileId);
        if (!profile) {
            throw new Error('Profile not found');
        }

        const existing = this.browserSessions.get(profileId);
        if (existing?.process && !existing.process.killed) {
            return { success: true, message: 'Profile already opened' };
        }

        const executablePath = this.#findChromePath(profile.browser);
        if (!executablePath) {
            throw new Error('Chrome/Edge not found on this machine');
        }

        const userDataDir = path.join(this.profilesDir, `profile_${profile.id}`);
        await fsp.mkdir(userDataDir, { recursive: true });

        const args = [
            `--user-data-dir=${userDataDir}`,
            '--no-first-run',
            '--no-default-browser-check',
            `--user-agent=${profile.fingerprint.ua}`,
            `--window-size=${profile.fingerprint.viewport.width},${profile.fingerprint.viewport.height}`,
        ];
        if (profile.proxy) {
            args.push(`--proxy-server=${profile.proxy}`);
        }

        const chromeProcess = spawn(executablePath, args, {
            detached: true,
            stdio: 'ignore',
        });
        chromeProcess.unref();

        this.browserSessions.set(profileId, { process: chromeProcess });
        chromeProcess.on('exit', () => {
            this.browserSessions.delete(profileId);
        });

        return { success: true };
    }

    async closeProfile(profileId) {
        const session = this.browserSessions.get(profileId);
        if (!session) {
            return { success: true };
        }
        try {
            const proc = session.process;
            if (proc && !proc.killed) {
                if (process.platform === 'win32') {
                    await new Promise((resolve) => {
                        const killer = spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {
                            windowsHide: true,
                        });
                        killer.on('exit', () => resolve());
                        killer.on('error', () => resolve());
                    });
                } else {
                    process.kill(proc.pid, 'SIGTERM');
                }
            }
        } catch (_) {
            // ignore close errors
        }
        this.browserSessions.delete(profileId);
        return { success: true };
    }

    async closeAll() {
        const ids = Array.from(this.browserSessions.keys());
        for (const id of ids) {
            await this.closeProfile(id);
        }
    }

    #buildRandomFingerprint() {
        const raw = getRandomFileFingerprint();
        return this.#normalizeFingerprint(raw);
    }

    #normalizeFingerprint(fp = {}) {
        return {
            ua: fp.ua || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            viewport: fp.viewport || { width: 1366, height: 768 },
            memory: Number(fp.memory || 8),
            threads: Number(fp.threads || 8),
            gpu: fp.gpu || { vendor: 'Intel Inc.', renderer: 'Intel Iris OpenGL Engine' },
        };
    }

    #findChromePath(selectedBrowser = 'Chrome') {
        const browsers = {
            Chrome: [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
            ],
            Edge: [
                'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
                'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            ],
        };

        const preferred = browsers[selectedBrowser] || [];
        for (const candidate of preferred) {
            if (candidate && fs.existsSync(candidate)) return candidate;
        }

        for (const key of Object.keys(browsers)) {
            for (const candidate of browsers[key]) {
                if (candidate && fs.existsSync(candidate)) return candidate;
            }
        }
        return null;
    }

    async #readProfiles() {
        await this.init();
        try {
            const raw = await fsp.readFile(this.profilesFile, 'utf-8');
            const data = JSON.parse(raw);
            if (!Array.isArray(data)) return [];
            return data;
        } catch (_) {
            return [];
        }
    }

    async #writeProfiles(data) {
        await this.init();
        await fsp.writeFile(this.profilesFile, JSON.stringify(data, null, 2), 'utf-8');
    }
}

module.exports = BrowserProfileManager;
