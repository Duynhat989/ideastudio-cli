const STORAGE_KEY = 'ideastudio.setup';

/**
 * Video workflow (Nano flow-api video) cần Veo token + cookie trong Setup.
 * @returns {boolean}
 */
export function hasVeo3VideoConfigured() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const saved = JSON.parse(raw);
        const accounts = Array.isArray(saved?.veoAccounts) ? saved.veoAccounts : [];
        const first = accounts[0];
        if (!first) return false;
        const token = String(first.token || '').trim();
        const cookie = String(first.cookie || '').trim();
        return token.length > 0 && cookie.length > 0;
    } catch {
        return false;
    }
}
