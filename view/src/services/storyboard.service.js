import { runtime } from './runtime';

const API_URL = runtime.api('/api/storyboards');

export const storyboardService = {
    async list() {
        const res = await fetch(API_URL);
        return res.json();
    },
    async getOne(id) {
        const res = await fetch(`${API_URL}/${id}`);
        return res.json();
    },
    async create(payload) {
        const res = await fetch(`${API_URL}/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return res.json();
    },
    async update(id, data) {
        const res = await fetch(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        return res.json();
    },
    async delete(id) {
        const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
        return res.json();
    },
    async saveAsset(id, payload) {
        const res = await fetch(`${API_URL}/${id}/assets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return res.json();
    },
    async getTimeline(id) {
        const res = await fetch(`${API_URL}/${id}/timeline`);
        return res.json();
    },

    async saveTimeline(id, data) {
        const res = await fetch(`${API_URL}/${id}/timeline`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data ?? {}),
        });
        return res.json();
    },

    async saveAssetFile(id, file, { kind = 'upload', sceneIndex = null } = {}) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('kind', kind);
        if (sceneIndex != null) fd.append('sceneIndex', String(sceneIndex));
        const res = await fetch(`${API_URL}/${id}/assets/upload`, {
            method: 'POST',
            body: fd,
        });
        return res.json();
    },
    assetUrl(relativeOrAbsolute) {
        if (!relativeOrAbsolute) return '';
        if (relativeOrAbsolute.startsWith('http') || relativeOrAbsolute.startsWith('blob:') || relativeOrAbsolute.startsWith('data:')) {
            return relativeOrAbsolute;
        }
        const path = relativeOrAbsolute.startsWith('/') ? relativeOrAbsolute : `/${relativeOrAbsolute}`;
        return runtime.api(path);
    },
};
