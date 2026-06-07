import { runtime } from './runtime';

const API_URL = runtime.api('/api/storyboard-characters');

export const storyboardCharacterService = {
    async list() {
        const res = await fetch(API_URL);
        return res.json();
    },

    async getOne(id) {
        const res = await fetch(`${API_URL}/${id}`);
        return res.json();
    },

    async create(payload) {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return res.json();
    },

    async createWithUpload(file, meta = {}) {
        const fd = new FormData();
        fd.append('file', file);
        if (meta.name) fd.append('name', meta.name);
        if (meta.description) fd.append('description', meta.description);
        if (meta.role) fd.append('role', meta.role);
        if (meta.prompt) fd.append('prompt', meta.prompt);
        if (meta.stylePreset) fd.append('stylePreset', meta.stylePreset);
        const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: fd });
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

    async deleteMany(ids = []) {
        const uniqueIds = [...new Set((ids || []).filter(Boolean))];
        const deletedIds = [];
        let lastError = '';

        for (const id of uniqueIds) {
            try {
                const res = await this.delete(id);
                if (res?.success) deletedIds.push(id);
                else lastError = res?.message || lastError;
            } catch (err) {
                lastError = err?.message || String(err);
            }
        }

        if (!deletedIds.length) {
            return {
                success: false,
                message: lastError || 'Delete failed',
                deletedIds: [],
                deletedCount: 0,
            };
        }

        return {
            success: deletedIds.length === uniqueIds.length,
            message: lastError,
            deletedIds,
            deletedCount: deletedIds.length,
        };
    },

    async saveFromGenerated({ name, description, role, prompt, stylePreset, imageSource }) {
        return this.create({
            name,
            description,
            role,
            prompt,
            stylePreset,
            imageSource,
        });
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
