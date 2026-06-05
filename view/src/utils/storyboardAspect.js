import { imageAspectToCss, videoAspectToCss } from './genAspectRatio.js'

export function storyAspectToImageRatio(aspect) {
    if (aspect === '9:16') return 'IMAGE_ASPECT_RATIO_PORTRAIT'
    if (aspect === '1:1') return 'IMAGE_ASPECT_RATIO_SQUARE'
    if (aspect === '4:3') return 'IMAGE_ASPECT_RATIO_LANDSCAPE_FOUR_THREE'
    return 'IMAGE_ASPECT_RATIO_LANDSCAPE'
}

export function storyAspectToVideoRatio(aspect) {
    if (aspect === '9:16') return 'VIDEO_ASPECT_RATIO_PORTRAIT'
    return 'VIDEO_ASPECT_RATIO_LANDSCAPE'
}

export function storyAspectToCss(aspect, mediaType = 'image') {
    const ratio = mediaType === 'video'
        ? storyAspectToVideoRatio(aspect)
        : storyAspectToImageRatio(aspect)
    return mediaType === 'video' ? videoAspectToCss(ratio) : imageAspectToCss(ratio)
}

export function isLandscapeStoryAspect(aspect) {
    return aspect === '16:9' || aspect === '4:3'
}

/** Portrait/square project ratios pass through; used for orientation hints in prompts. */
export function storyboardEnvironmentOrientationLabel(aspect) {
    if (aspect === '1:1') return 'square centered frame'
    if (aspect === '9:16') return 'portrait vertical frame'
    if (isLandscapeStoryAspect(aspect)) return 'landscape widescreen frame'
    return 'portrait vertical frame'
}

export function parseDurationSec(raw) {
    const n = Number(String(raw ?? '').replace(/[^\d.]/g, ''))
    if (!Number.isFinite(n) || n <= 0) return 60
    return Math.min(600, Math.max(8, Math.round(n)))
}

export function estimateSceneCount(durationSec) {
    return Math.max(1, Math.min(24, Math.ceil(durationSec / 8)))
}
