class KlingVideoService {
    constructor(freepikKey, idea2vidToken, userId = '') {
        this.freepikKey = freepikKey;
        this.idea2vidToken = idea2vidToken;
        this.userId = userId;
    }

    async uploadBase64(base64) {
        const res = await fetch(`https://api.idea2vid.com/api/assets/upload?userId=${this.userId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.idea2vidToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ base64 })
        });

        if (!res.ok) throw new Error('Upload failed');
        return await res.json();
    }

    async createVideo({
        image_url,
        video_url,
        prompt = 'dancing',
        webhook_url = '',
        mode = 'pro'
    }) {
        const endpoint = mode === 'pro'
            ? 'kling-v3-motion-control-pro'
            : 'kling-v3-motion-control-std';

        const res = await fetch(`https://api.freepik.com/v1/ai/video/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-freepik-api-key': this.freepikKey
            },
            body: JSON.stringify({
                image_url,
                video_url,
                webhook_url,
                prompt,
                character_orientation: 'video',
                cfg_scale: 0.5
            })
        });

        if (!res.ok) throw new Error('Create video failed');
        return await res.json();
    }

    async uploadAndCreate({
        base64,
        video_url,
        prompt,
        webhook_url,
        mode
    }) {
        const upload = await this.uploadBase64(base64);
        const image_url = upload?.url || upload?.data?.url;

        if (!image_url) throw new Error('Invalid upload response');

        return await this.createVideo({
            image_url,
            video_url,
            prompt,
            webhook_url,
            mode
        });
    }
}

export default KlingVideoService;