import { generateNanoImage, generateNanoVideo, getSettings } from '@/services/nanoai.js'
import { normalizeImageModel, normalizeVideoModel, normalizeVideoTier } from '@/services/flowApiV3.js'
import { sanitizeImagePromptForSafety, sanitizeVideoPromptForSafety } from '@/utils/flowPromptSafety.js'
import { storyAspectToImageRatio, storyAspectToVideoRatio } from '@/utils/storyboardAspect.js'
import { errorMessageFromUnknown } from '@/utils/flowApiError.js'

const STORYBOARD_VIDEO_PROMPT_MAX = 2000

export function createMediaTask() {
    return {
        status: 'idle',
        result: null,
        error: null,
        elapsedTime: 0,
        timerInterval: null,
    }
}

const clearTimer = (task) => {
    if (task?.timerInterval) {
        clearInterval(task.timerInterval)
        task.timerInterval = null
    }
}

const startTimer = (task) => {
    clearTimer(task)
    task.elapsedTime = 0
    task.timerInterval = setInterval(() => {
        task.elapsedTime += 1
    }, 1000)
}

const patchTask = (task, patch) => {
    clearTimer(task)
    Object.assign(task, { ...patch, timerInterval: null })
}

export function revokeMediaTask(task) {
    if (task?.result?.startsWith?.('blob:')) {
        URL.revokeObjectURL(task.result)
    }
}

const MAX_SCENE_IMAGE_REFS = 5

/** Character ref(s) — used when generating scene images. */
export function storyboardSceneImageRefs(characterRefUrls) {
    const list = Array.isArray(characterRefUrls)
        ? characterRefUrls
        : (characterRefUrls ? [characterRefUrls] : [])
    return list.filter(Boolean).slice(0, MAX_SCENE_IMAGE_REFS)
}

/** Generated scene image only — first frame for video (frame mode, 1 image). */
export function storyboardSceneVideoFrame(sceneImageUrl) {
    return sceneImageUrl ? [sceneImageUrl] : []
}

/** Environment + character refs for shot first-frame image (max 5). */
export function storyboardShotFrameRefs(environmentImageUrl, characterRefUrls = []) {
    const refs = []
    if (environmentImageUrl) refs.push(environmentImageUrl)
    const chars = Array.isArray(characterRefUrls)
        ? characterRefUrls
        : (characterRefUrls ? [characterRefUrls] : [])
    for (const url of chars) {
        if (url && refs.length < MAX_SCENE_IMAGE_REFS) refs.push(url)
    }
    return refs
}

/**
 * @param {object} opts
 * @param {object} opts.task — reactive media task
 * @param {string} opts.prompt
 * @param {string[]} [opts.refUrls]
 * @param {string} opts.aspectRatio — e.g. 9:16
 * @param {string} [opts.imageModel]
 */
export async function runStoryboardImageGen({ task, prompt, refUrls = [], aspectRatio, imageModel }) {
    const settings = getSettings()
    if (!settings.nanoToken || !settings.imageAccessToken) {
        throw new Error('Chưa cấu hình Nano AI / Veo token cho tạo ảnh')
    }

    patchTask(task, { status: 'generating', error: null, result: null })
    startTimer(task)

    try {
        let safePrompt = sanitizeImagePromptForSafety(prompt, 0)
        if (!safePrompt) safePrompt = String(prompt || '').trim()

        const result = await generateNanoImage({
            prompt: safePrompt,
            imageUrls: refUrls.filter(Boolean).slice(0, MAX_SCENE_IMAGE_REFS),
            ratio: storyAspectToImageRatio(aspectRatio),
            imageModel: normalizeImageModel(imageModel || 'GEM_PIX_2'),
        })

        patchTask(task, { status: 'success', result: result.url || result.dataUrl })
    } catch (err) {
        patchTask(task, { status: 'error', error: errorMessageFromUnknown(err, 'Tạo ảnh thất bại'), result: null })
        throw err
    }
}

/**
 * @param {object} opts
 */
export async function runStoryboardVideoGen({
    task,
    prompt,
    refUrls = [],
    aspectRatio,
    videoModel,
}) {
    const settings = getSettings()
    if (!settings.nanoToken || !settings.videoAccessToken || !settings.videoCookie) {
        throw new Error('Chưa cấu hình Veo token/cookie cho tạo video')
    }

    patchTask(task, { status: 'generating', error: null, result: null })
    startTimer(task)

    try {
        let safePrompt = sanitizeVideoPromptForSafety(prompt, STORYBOARD_VIDEO_PROMPT_MAX)
        if (!safePrompt) safePrompt = String(prompt || '').slice(0, STORYBOARD_VIDEO_PROMPT_MAX)

        const tier = normalizeVideoTier(settings.videoTier)
        const resultUrl = await generateNanoVideo({
            prompt: safePrompt,
            imageUrls: refUrls.filter(Boolean).slice(0, 1),
            ratio: storyAspectToVideoRatio(aspectRatio),
            videoModel: normalizeVideoModel(videoModel || 'veo3Fast', tier),
            type: 'frame',
            tier,
        })

        patchTask(task, { status: 'success', result: resultUrl })
    } catch (err) {
        patchTask(task, { status: 'error', error: errorMessageFromUnknown(err, 'Tạo video thất bại'), result: null })
        throw err
    }
}

export function downloadMediaResult(task, filename) {
    if (!task?.result) return
    const a = document.createElement('a')
    a.href = task.result
    a.download = filename
    a.click()
}
