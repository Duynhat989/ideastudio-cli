import { runtime } from './runtime';

const API_URL = runtime.api('/api/projects');
const API_ROOT = runtime.api('/api');

export const projectService = {
    async list() {
        const res = await fetch(API_URL);
        return res.json();
    },
    /** @param {string | { name: string, description?: string, aspectPreset?: string }} payload */
    async create(payload) {
        const body = typeof payload === 'string' ? { name: payload } : payload;
        const res = await fetch(`${API_URL}/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        return res.json();
    },
    async update(id, data) {
        const res = await fetch(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return res.json();
    },
    async delete(id) {
        const res = await fetch(`${API_URL}/${id}`, {
            method: 'DELETE'
        });
        return res.json();
    },
    async saveAsset(id, payload) {
        const res = await fetch(`${API_URL}/${id}/assets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return res.json();
    },

    /** Upload file gốc (multipart) — khuyến nghị cho audio/video lớn */
    async saveAssetFile(projectId, file, { nodeId = 'node', kind = 'asset' } = {}) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('nodeId', nodeId);
        fd.append('kind', kind);
        const res = await fetch(`${API_URL}/${projectId}/assets/upload`, {
            method: 'POST',
            body: fd
        });
        return res.json();
    },

    async getTimeline(projectId) {
        const res = await fetch(`${API_URL}/${projectId}/timeline`);
        return res.json();
    },

    async saveTimeline(projectId, data) {
        const res = await fetch(`${API_URL}/${projectId}/timeline`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data ?? {})
        });
        return res.json();
    },

    async listStoreFlows() {
        const res = await fetch(`${API_ROOT}/workflow/stores`);
        return res.json();
    }
};