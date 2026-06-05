import { storyboardService } from '@/services/storyboard.service.js';
import { isLikelyFlowImageUrl, isLikelyFlowVideoUrl } from '@/utils/flowMedia.js';

/** Workflow: assets from source nodes on the canvas. */
export function collectWorkflowSourceAssets(nodes = []) {
    const resources = [];
    nodes.filter((n) => n.type === 'source').forEach((n) => {
        (n.data?.inputs || []).forEach((item) => {
            if (typeof item === 'string' && item) resources.push(item);
        });
    });
    return Array.from(new Set(resources));
}

function resolveStoryboardVideoUrl(item) {
    const candidates = [];

    if (item?.videoUrl) {
        candidates.push(storyboardService.assetUrl(item.videoUrl));
    }
    if (item?.videoTask?.status === 'success' && item.videoTask?.result) {
        candidates.push(item.videoTask.result);
    }

    for (const url of candidates) {
        if (!url || typeof url !== 'string') continue;
        if (isLikelyFlowImageUrl(url)) continue;
        if (isLikelyFlowVideoUrl(url)) return url;
    }
    return '';
}

/** Storyboard: video từng shot theo thứ tự scene → shot. */
export function collectStoryboardSourceAssets(scenes = []) {
    const ordered = [...scenes].sort((a, b) => Number(a.index || 0) - Number(b.index || 0));
    const urls = [];
    for (const scene of ordered) {
        const shots = [...(scene.shots || [])].sort((a, b) => Number(a.index || 0) - Number(b.index || 0));
        if (shots.length) {
            for (const shot of shots) {
                const url = resolveStoryboardVideoUrl(shot);
                if (url) urls.push(url);
            }
        } else {
            const legacy = resolveStoryboardVideoUrl(scene);
            if (legacy) urls.push(legacy);
        }
    }
    return urls;
}

/** Map storyboard aspect setting to RenderView aspect preset. */
export function storyboardAspectToRenderPreset(aspectRatio) {
    if (aspectRatio === '16:9') return 'landscape';
    if (aspectRatio === '1:1') return 'square';
    return 'portrait';
}
