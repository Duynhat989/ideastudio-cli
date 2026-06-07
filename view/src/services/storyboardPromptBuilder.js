/**
 * Build cinematic AI video prompt from structured storyboard blocks.
 * Image prompts use JSON format — see storyboardJsonPrompts.js
 */

import {
    resolveProjectStyle,
    environmentPromptToApiText,
    environmentPromptToDisplay,
    normalizeEnvironmentPromptJson,
    getEnvironmentPromptJsonTemplate,
    shotFramePromptToApiText,
    shotFramePromptToDisplay,
    normalizeShotFramePromptJson,
    getShotFramePromptJsonTemplate,
    characterRefPromptToApiText,
    characterRefPromptToDisplay,
    normalizeCharacterRefPromptJson,
    getCharacterRefPromptJsonTemplate,
    getVideoBlocksJsonTemplate,
    applyProjectStyleToVideoBlocks,
    isPromptEmpty,
    SHOT_FRAME_REFERENCE_RULES,
    SHOT_FRAME_IMAGE_NEGATIVE_RULES,
    ENVIRONMENT_IMAGE_NEGATIVE_RULES,
    ENVIRONMENT_SCENE_TYPE,
    CHARACTER_REF_IMAGE_NEGATIVE_RULES,
    CHARACTER_REF_STYLE_IMAGE_RULES,
    CHARACTER_REF_POSE,
    CHARACTER_REF_BACKGROUND,
    CHARACTER_REF_CAMERA,
    CHARACTER_REF_LIGHTING,
    CHARACTER_REF_QUALITY,
} from './storyboardJsonPrompts.js'

export {
    resolveProjectStyle,
    SHOT_FRAME_REFERENCE_RULES,
    SHOT_FRAME_IMAGE_NEGATIVE_RULES,
    ENVIRONMENT_IMAGE_NEGATIVE_RULES,
    ENVIRONMENT_SCENE_TYPE as ENVIRONMENT_SCENE_TYPE_DEFAULT,
    CHARACTER_REF_IMAGE_NEGATIVE_RULES,
    CHARACTER_REF_STYLE_IMAGE_RULES,
    CHARACTER_REF_POSE as CHARACTER_REF_POSE_DEFAULT,
    CHARACTER_REF_BACKGROUND as CHARACTER_REF_BACKGROUND_DEFAULT,
    CHARACTER_REF_CAMERA as CHARACTER_REF_CAMERA_DEFAULT,
    CHARACTER_REF_LIGHTING as CHARACTER_REF_LIGHTING_DEFAULT,
    CHARACTER_REF_QUALITY as CHARACTER_REF_QUALITY_DEFAULT,
    getVideoBlocksJsonTemplate,
    applyProjectStyleToVideoBlocks,
}

// Legacy section labels — kept for any external imports
export const SHOT_FRAME_ENVIRONMENT_DEFAULT = 'Use the provided environment/scene background reference image — keep the same location, layout, lighting and orientation; do NOT redraw the background from scratch or use multi-panel layout.'
export const SHOT_FRAME_LIGHTING_DEFAULT = 'Match the lighting of the provided environment reference image.'
export const SHOT_FRAME_COMPOSITION_DEFAULT = 'Composite character(s) onto environment — harmonious scale, depth and perspective; adjust camera angle and position (not appearance) for best frame at project aspect ratio.'
export const SHOT_FRAME_QUALITY_DEFAULT = 'Cinematic frame, movie scene, highly detailed, professional composition, 4k quality.'
export const SHOT_FRAME_CHARACTER_REF_PREFIX = 'Use provided character reference image(s) — match face, hair, skin tone and outfit exactly. '

const joinLines = (lines) => lines.filter(Boolean).join(',\n')

const formatCamera = (camera = []) => {
    if (!Array.isArray(camera) || !camera.length) return ''
    return camera
        .map((c) => {
            const speed = c.speed ? ` ${c.speed}` : ''
            const action = String(c.action || 'move').replace(/_/g, ' ')
            return `The camera ${action}${speed} on ${c.target || 'subject'}.`
        })
        .join('\n')
}

const formatCharacter = (character = {}) => {
    if (character.description) return character.description.trim()
    if (!character.name) return ''
    return character.name
}

const formatScene = (scene = {}) => {
    if (scene.description) return scene.description.trim()
    const parts = [
        scene.shot ? `A ${scene.shot}` : '',
        scene.pose || '',
        scene.location ? `in ${scene.location}` : '',
        scene.time || '',
    ].filter(Boolean)
    if (scene.props?.length) parts.push(`surrounded by ${scene.props.join(', ')}`)
    return parts.join(' ')
}

const formatEmotion = (emotion = {}) => {
    if (emotion.description) return emotion.description.trim()
    if (emotion.tags?.length) return `Expression: ${emotion.tags.join(', ')}.`
    return ''
}

const formatLighting = (lighting = {}) => {
    if (lighting.description) return lighting.description.trim()
    const parts = [lighting.quality, lighting.type, lighting.time].filter(Boolean)
    if (!parts.length) return ''
    return `${parts.join(', ')} light.`
}

const formatEnvironment = (environment = {}) => {
    const lines = []
    if (environment.description) lines.push(environment.description.trim())
    if (environment.details?.length) lines.push(...environment.details)
    return lines.join('\n')
}

const formatMood = (mood = {}) => {
    if (mood.description) return mood.description.trim()
    if (mood.tags?.length) return `Atmosphere: ${mood.tags.join(', ')}.`
    return ''
}

const formatAudio = (audio = {}) => {
    if (!audio.text?.trim()) return ''
    const speaker = audio.speaker || 'Character'
    return `Audio:\n${speaker} says\n"${audio.text.trim()}"`
}

const formatAsmr = (asmr = []) => {
    if (!Array.isArray(asmr) || !asmr.length) return ''
    return `ASMR:\n${asmr.join(',\n')}`
}

const formatBgm = (bgm = {}) => {
    if (bgm.description) return `BGM:\n${bgm.description.trim()}`
    const parts = [bgm.genre, bgm.mood].filter(Boolean)
    if (!parts.length) return ''
    return `BGM:\n${parts.join(', ')} music`
}

const formatRules = (rules = []) => {
    if (!Array.isArray(rules) || !rules.length) return ''
    return rules.join('\n')
}

const formatStyle = (style = {}) => {
    if (style.visualStyle) return style.visualStyle.trim()
    return joinLines([style.renderQuality])
}

/**
 * @param {{ blocks?: object }} scene
 * @returns {string}
 */
export function buildScenePrompt(scene) {
    const blocks = scene?.blocks || scene || {}
    const sections = [
        ['STYLE', formatStyle(blocks.style)],
        ['CHARACTER', formatCharacter(blocks.character)],
        ['SCENE', formatScene(blocks.scene)],
        ['EMOTION', formatEmotion(blocks.emotion)],
        ['CAMERA', formatCamera(blocks.camera)],
        ['LIGHTING', formatLighting(blocks.lighting)],
        ['ENVIRONMENT', formatEnvironment(blocks.environment)],
        ['MOOD', formatMood(blocks.mood)],
        ['DIALOGUE', formatAudio(blocks.audio)],
        ['ASMR', formatAsmr(blocks.asmr)],
        ['BGM', formatBgm(blocks.bgm)],
        ['RULES', formatRules(blocks.rules)],
    ]

    return sections
        .filter(([, body]) => body?.trim())
        .map(([title, body]) => `${title}:\n${body.trim()}`)
        .join('\n\n')
}

export function storyboardSceneVideoPrompt(scene) {
    const fromTextarea = String(scene?.prompt || '').trim()
    if (fromTextarea) return fromTextarea
    if (scene?.blocks) return buildScenePrompt(scene)
    return String(scene?.beat || '').trim()
}

export function storyboardShotVideoPrompt(shot) {
    const fromTextarea = String(shot?.videoPrompt || '').trim()
    if (fromTextarea) return fromTextarea
    if (shot?.blocks) return buildScenePrompt(shot)
    return String(shot?.imagePrompt || shot?.label || '').trim()
}

export function buildStoryboardPrompts(storyboard) {
    const scenes = storyboard?.scenes || []
    return scenes.map((scene) => ({
        index: scene.index,
        label: scene.label,
        durationSec: scene.durationSec,
        blocks: scene.blocks,
        prompt: buildScenePrompt(scene),
    }))
}

// ── Environment prompts (JSON) ──────────────────────────────────────────────

export const ENVIRONMENT_PROMPT_SECTIONS = []
export const ENVIRONMENT_PROMPT_CONSTRAINT_LINES = [...ENVIRONMENT_IMAGE_NEGATIVE_RULES]

export function getEnvironmentPromptTemplate(styleContext = {}) {
    return JSON.stringify(getEnvironmentPromptJsonTemplate(styleContext), null, 2)
}

export function normalizeEnvironmentPrompt(rawPrompt, styleContext = {}) {
    return environmentPromptToDisplay(rawPrompt, styleContext)
}

export function flattenEnvironmentPromptForImage(rawPrompt) {
    return environmentPromptToApiText(rawPrompt, {})
}

export function buildEnvironmentStyleContext(ctx = {}) {
    const { settings, templateDefaults } = ctx
    return {
        stylePreset: settings?.stylePreset || '',
        visualStyle: templateDefaults?.style || '',
        lighting: templateDefaults?.lighting || '',
        mood: templateDefaults?.mood || '',
        environment: templateDefaults?.environment || '',
        aspectRatio: settings?.aspectRatio || '9:16',
        language: settings?.language || '',
    }
}

export function buildEnvironmentImagePrompt(rawPrompt, styleContext = {}) {
    return environmentPromptToApiText(rawPrompt, styleContext)
}

export function ensureEnvironmentPromptStyle(rawPrompt, styleContext = {}) {
    return normalizeEnvironmentPrompt(rawPrompt, styleContext)
}

export function formatEnvironmentPromptSections(sections = {}, styleContext = {}) {
    return normalizeEnvironmentPrompt(sections, styleContext)
}

export function sanitizeEnvironmentPromptText(text) {
    return String(text || '').trim()
}

export function parseEnvironmentPromptSections(text) {
    return normalizeEnvironmentPromptJson(text, {})
}

// ── Shot frame prompts (JSON) ───────────────────────────────────────────────

export const SHOT_FRAME_PROMPT_SECTIONS = []

export function getShotFramePromptTemplate(styleContext = {}) {
    return JSON.stringify(getShotFramePromptJsonTemplate(styleContext), null, 2)
}

export function normalizeShotFrameImagePrompt(rawPrompt, ctx = {}) {
    const { styleContext = {}, blocks = null } = ctx
    return shotFramePromptToDisplay(rawPrompt, styleContext, blocks)
}

export function buildShotFrameImagePrompt(rawPrompt, ctx = {}) {
    const { styleContext = {}, blocks = null } = ctx
    return shotFramePromptToApiText(rawPrompt, styleContext, blocks)
}

// ── Character reference prompts (JSON) ────────────────────────────────────────

export const CHARACTER_REF_PROMPT_SECTIONS = []

export function getDefaultCharacterRefStyle(styleContext = {}) {
    return resolveProjectStyle(styleContext)
}

export function getCharacterRefPromptTemplate(styleContext = {}) {
    return JSON.stringify(getCharacterRefPromptJsonTemplate(styleContext), null, 2)
}

export function normalizeCharacterRefPrompt(rawPrompt, styleContext = {}) {
    return characterRefPromptToDisplay(rawPrompt, styleContext)
}

export function buildCharacterRefImagePrompt(rawPrompt, styleContext = {}) {
    return characterRefPromptToApiText(rawPrompt, styleContext)
}

export function buildCharacterStyleContext(ctx = {}) {
    const base = buildEnvironmentStyleContext(ctx)
    const characterRefStyle = String(
        ctx.characterRefStyle ?? ctx.settings?.characterRefStyle ?? '',
    ).trim()
    const characterRefStyleRefs = Array.isArray(ctx.characterRefStyleRefs)
        ? ctx.characterRefStyleRefs
        : (Array.isArray(ctx.settings?.characterRefStyleRefs) ? ctx.settings.characterRefStyleRefs : [])
    return {
        ...base,
        characterRefStyle,
        characterRefStyleRefs,
    }
}

// Re-export json helpers used by UI
export {
    getEnvironmentPromptJsonTemplate,
    getShotFramePromptJsonTemplate,
    getCharacterRefPromptJsonTemplate,
    normalizeEnvironmentPromptJson,
    normalizeShotFramePromptJson,
    normalizeCharacterRefPromptJson,
    isPromptEmpty,
} from './storyboardJsonPrompts.js'
