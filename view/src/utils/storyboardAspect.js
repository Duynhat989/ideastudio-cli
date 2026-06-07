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

/** Environment preview column width. */
export function storyboardPreviewColWidth(aspect) {
    if (aspect === '16:9') return '520px'
    if (aspect === '4:3') return '440px'
    return '300px'
}

/** Shot card preview panel — dual portrait (9:16) side-by-side. */
export function storyboardShotPreviewPanelWidth(aspect) {
    if (aspect === '16:9') return '520px'
    if (aspect === '4:3') return '440px'
    if (aspect === '1:1') return '300px'
    return '600px'
}

/** Character reference sheets are always portrait 9:16. */
export const STORYBOARD_CHARACTER_REF_ASPECT_CSS = '9 / 16'

export function storyboardCharacterRefPreviewWidth() {
    return '132px'
}

/** Portrait/square project ratios pass through; used for orientation hints in prompts. */
export function storyboardEnvironmentOrientationLabel(aspect) {
    if (aspect === '1:1') return 'square centered frame'
    if (aspect === '9:16') return 'portrait vertical frame'
    if (isLandscapeStoryAspect(aspect)) return 'landscape widescreen frame'
    return 'portrait vertical frame'
}

/** Composition guidance when compositing character refs onto environment for shot frames. */
export function storyboardShotFrameHarmonyGuide(aspectRatio = '9:16') {
    const orientation = storyboardEnvironmentOrientationLabel(aspectRatio)
    const base = [
        `Final frame MUST match ${orientation} (${aspectRatio}) — compose character and environment together for this exact ratio`,
        'Character scale must match environment depth and perspective — natural integration, NOT pasted-on or wrong size',
        'Adjust camera angle, shot distance, and character position to optimize the frame — do NOT alter character appearance from refs',
    ]

    if (aspectRatio === '9:16') {
        base.push(
            'Portrait vertical: use height wisely — medium/full body shots work well; center or rule-of-thirds vertical placement',
            'Reframe via camera if needed so character and scenery both read clearly in tall frame',
        )
    } else if (isLandscapeStoryAspect(aspectRatio)) {
        base.push(
            'Landscape widescreen: balance character with scenic context — medium/wide shots; rule of thirds',
            'Character should not fill entire width unless close-up is intentional — preserve environment storytelling',
        )
    } else if (aspectRatio === '1:1') {
        base.push(
            'Square frame: balanced character-environment ratio; center-weighted or rule-of-thirds placement',
        )
    }

    return base
}

export function parseDurationSec(raw) {
    const n = Number(String(raw ?? '').replace(/[^\d.]/g, ''))
    if (!Number.isFinite(n) || n <= 0) return 60
    return Math.min(600, Math.max(8, Math.round(n)))
}

export function estimateSceneCount(durationSec) {
    return Math.max(1, Math.min(24, Math.ceil(durationSec / 8)))
}
