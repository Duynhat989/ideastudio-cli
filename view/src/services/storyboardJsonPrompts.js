/**
 * JSON-native storyboard prompts — structured for Gemini output and image/video APIs.
 */

import { isLandscapeStoryAspect, storyboardEnvironmentOrientationLabel, storyboardShotFrameHarmonyGuide } from '@/utils/storyboardAspect.js'
import { formatStoryboardStyleForPrompt, normalizeStoryboardStylePreset } from '@/utils/storyboardOptions.js'

const DEFAULT_RENDER_QUALITY = '4k cinematic, highly detailed, professional composition'

/** stylePreset → "Name - Description" for prompts; template visualStyle adds extra detail. */
export function resolveProjectStyle(styleContext = {}) {
    const presetKey = normalizeStoryboardStylePreset(styleContext.stylePreset)
    const presetLine = formatStoryboardStyleForPrompt(presetKey)
    const visual = String(styleContext.visualStyle || '').trim()

    if (presetLine && visual) {
        const presetLower = presetKey.toLowerCase()
        if (visual.toLowerCase().includes(presetLower)) return visual
        return `${presetLine}. ${visual}`
    }
    if (presetLine) return presetLine
    if (visual) return visual
    return 'cinematic illustration'
}

export function buildProjectMeta(styleContext = {}) {
    return {
        stylePreset: normalizeStoryboardStylePreset(styleContext.stylePreset),
        aspectRatio: styleContext.aspectRatio || '9:16',
        language: styleContext.language || '',
    }
}

export function buildStyleBlock(styleContext = {}) {
    const preset = normalizeStoryboardStylePreset(styleContext.stylePreset)
    return {
        preset,
        visualStyle: resolveProjectStyle(styleContext),
        renderQuality: DEFAULT_RENDER_QUALITY,
    }
}

// ── Parse / stringify ───────────────────────────────────────────────────────

export function parsePromptInput(raw) {
    if (raw == null) return null
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw
    const text = String(raw).trim()
    if (!text) return null
    if (text.startsWith('{') || text.startsWith('[')) {
        try {
            return JSON.parse(text)
        } catch {
            return null
        }
    }
    return null
}

export function stringifyPromptJson(obj, indent = 2) {
    if (!obj || typeof obj !== 'object') return ''
    try {
        return JSON.stringify(obj, null, indent)
    } catch {
        return ''
    }
}

export function hasPromptJsonContent(obj) {
    if (!obj || typeof obj !== 'object') return false
    const json = JSON.stringify(obj)
    return json.length > 80 && !/"\[.*?\]"/.test(json.replace(/"\[(location|name|description) description\]/g, ''))
}

export function isPromptEmpty(raw) {
    const text = String(raw || '').trim()
    if (!text) return true
    const parsed = parsePromptInput(text)
    if (parsed) return !hasPromptJsonContent(parsed)
    return false
}

// ── Environment image prompt ────────────────────────────────────────────────

export const ENVIRONMENT_SCENE_TYPE = 'empty establishing shot / background plate — single unified frame, no multi-panel layout'

function environmentCameraBlock(aspectRatio = '9:16') {
    const orient = storyboardEnvironmentOrientationLabel(aspectRatio)
    return {
        orientation: orient,
        framing: aspectRatio === '1:1'
            ? 'square centered establishing shot'
            : isLandscapeStoryAspect(aspectRatio)
                ? 'landscape widescreen establishing shot'
                : 'tall upright vertical establishing shot — sky at top, ground at bottom',
        angle: 'eye level, camera upright — no rotation',
    }
}

function environmentQualityBlock(aspectRatio = '9:16') {
    const orient = aspectRatio === '1:1'
        ? 'square orientation'
        : isLandscapeStoryAspect(aspectRatio)
            ? 'landscape widescreen orientation'
            : 'portrait vertical orientation'
    return `ultra detailed environment, cinematic composition, professional lighting, ${orient}, ${DEFAULT_RENDER_QUALITY}`
}

export function createEnvironmentPromptJson(styleContext = {}) {
    const aspectRatio = styleContext.aspectRatio || '9:16'
    return {
        type: 'environment_image',
        project: buildProjectMeta(styleContext),
        style: buildStyleBlock(styleContext),
        scene: {
            sceneType: ENVIRONMENT_SCENE_TYPE,
            location: '',
            description: '',
            time: '',
            weather: '',
            objects: [],
            atmosphere: styleContext.mood ? String(styleContext.mood).trim() : '',
        },
        lighting: styleContext.lighting ? String(styleContext.lighting).trim() : '',
        camera: environmentCameraBlock(aspectRatio),
        quality: environmentQualityBlock(aspectRatio),
    }
}

export function getEnvironmentPromptJsonTemplate(styleContext = {}) {
    const tpl = createEnvironmentPromptJson(styleContext)
    tpl.scene.location = '[specific place name]'
    tpl.scene.description = '[architecture, terrain, layout — no people or animals]'
    tpl.scene.time = '[time of day]'
    tpl.scene.weather = '[weather conditions]'
    tpl.scene.objects = ['[static prop 1]', '[static prop 2]']
    tpl.scene.atmosphere = tpl.scene.atmosphere || '[mood, ambience, sensory details]'
    tpl.lighting = tpl.lighting || '[lighting description]'
    return tpl
}

const ENVIRONMENT_SUBJECT_PATTERNS = [
    /\b(human|humans|person|people|someone|anybody|figure|figures|silhouette|silhouettes)\b/gi,
    /\b(man|men|woman|women|boy|boys|girl|girls|child|children|kid|kids)\b/gi,
    /\b(character|characters|protagonist|hero|heroine|villain|npc|crowd|pedestrian)\b/gi,
    /\b(animal|animals|pet|pets|dog|cat|bird|insect|wildlife)\b/gi,
    /\b(nhân vật|người|con người|động vật)\b/gi,
]

function sanitizeEnvText(text) {
    let cleaned = String(text || '').trim()
    if (!cleaned) return ''
    ENVIRONMENT_SUBJECT_PATTERNS.forEach((pattern) => {
        cleaned = cleaned.replace(pattern, '')
    })
    return cleaned.replace(/\s{2,}/g, ' ').trim()
}

/** Migrate legacy "STYLE:\n..." sectioned text into JSON object. */
function legacyEnvironmentToJson(raw, styleContext) {
    const sections = {}
    let body = String(raw || '').trim()
    const constraintsIdx = body.search(/\nCONSTRAINTS:\s*\n/i)
    if (constraintsIdx >= 0) body = body.slice(0, constraintsIdx).trim()

    let currentKey = null
    const buffers = []
    const keyMap = {
        style: 'style', 'scene type': 'sceneType', environment: 'environment', location: 'environment',
        time: 'time', weather: 'weather', lighting: 'lighting', objects: 'objects',
        atmosphere: 'atmosphere', camera: 'camera', quality: 'quality',
    }

    const flush = () => {
        if (currentKey) sections[currentKey] = buffers.join('\n').trim()
        buffers.length = 0
    }

    for (const line of body.split('\n')) {
        const headerMatch = line.match(/^([^:\n]+):\s*$/)
        if (headerMatch) {
            const key = keyMap[headerMatch[1].trim().toLowerCase()]
            if (key) {
                flush()
                currentKey = key
                continue
            }
        }
        if (currentKey) buffers.push(line)
    }
    flush()

    const base = createEnvironmentPromptJson(styleContext)
    if (sections.style) {
        base.style.visualStyle = sections.style
    }
    if (sections.environment) {
        base.scene.description = sanitizeEnvText(sections.environment)
    }
    if (sections.time) base.scene.time = sanitizeEnvText(sections.time)
    if (sections.weather) base.scene.weather = sanitizeEnvText(sections.weather)
    if (sections.lighting) base.lighting = sanitizeEnvText(sections.lighting)
    if (sections.objects) {
        base.scene.objects = sections.objects.split(/[,\n]/).map((s) => sanitizeEnvText(s)).filter(Boolean)
    }
    if (sections.atmosphere) base.scene.atmosphere = sanitizeEnvText(sections.atmosphere)
    if (sections.sceneType) base.scene.sceneType = sections.sceneType
    if (!base.scene.description && body && !Object.keys(sections).length) {
        base.scene.description = sanitizeEnvText(body)
    }
    return base
}

function mergeEnvironmentPromptJson(input, styleContext = {}) {
    const base = createEnvironmentPromptJson(styleContext)
    const src = input && typeof input === 'object' ? input : {}

    if (src.project) base.project = { ...base.project, ...src.project }
    if (src.style) base.style = { ...base.style, ...src.style }
    if (src.scene) {
        base.scene = {
            ...base.scene,
            ...src.scene,
            objects: Array.isArray(src.scene.objects)
                ? src.scene.objects.map((o) => sanitizeEnvText(o)).filter(Boolean)
                : base.scene.objects,
        }
        base.scene.description = sanitizeEnvText(base.scene.description)
        base.scene.location = sanitizeEnvText(base.scene.location)
        base.scene.time = sanitizeEnvText(base.scene.time)
        base.scene.weather = sanitizeEnvText(base.scene.weather)
        base.scene.atmosphere = sanitizeEnvText(base.scene.atmosphere)
    }
    if (src.lighting) base.lighting = sanitizeEnvText(src.lighting)
    if (src.camera && typeof src.camera === 'object') {
        base.camera = { ...base.camera, ...src.camera }
    } else if (typeof src.camera === 'string' && src.camera.trim()) {
        base.camera.framing = src.camera.trim()
    }
    if (src.quality) base.quality = String(src.quality).trim()

    // Always enforce project style + camera from settings
    base.style = buildStyleBlock(styleContext)
    base.project = buildProjectMeta(styleContext)
    base.camera = { ...environmentCameraBlock(styleContext.aspectRatio || '9:16'), ...base.camera }
    base.quality = environmentQualityBlock(styleContext.aspectRatio || '9:16')
    base.scene.sceneType = ENVIRONMENT_SCENE_TYPE

    return base
}

export function normalizeEnvironmentPromptJson(raw, styleContext = {}) {
    let parsed = parsePromptInput(raw)
    if (!parsed) {
        const text = String(raw || '').trim()
        parsed = text
            ? legacyEnvironmentToJson(text, styleContext)
            : createEnvironmentPromptJson(styleContext)
    }
    return mergeEnvironmentPromptJson(parsed, styleContext)
}

export function environmentPromptToDisplay(raw, styleContext = {}) {
    return stringifyPromptJson(normalizeEnvironmentPromptJson(raw, styleContext))
}

function getEnvironmentFrameNegativeRules(aspectRatio = '9:16') {
    const rules = [
        'SINGLE FRAME ONLY — one unified image, NOT multiple panels or stacked frames',
        'NO split screen, NO comic strip, NO storyboard sheet, NO triptych, NO grid, NO collage',
        'NO rotated scene, NO sideways composition, NO 90-degree turned frame',
    ]
    if (aspectRatio === '1:1') {
        rules.push('NO horizontal landscape layout — square centered composition mandatory')
    } else if (isLandscapeStoryAspect(aspectRatio)) {
        rules.push('NO portrait vertical flip — maintain landscape widescreen orientation')
    } else {
        rules.push('NO horizontal landscape layout — upright portrait only, sky at top, ground at bottom')
    }
    return rules
}

export const ENVIRONMENT_IMAGE_NEGATIVE_RULES = [
    'NO people, NO human figures, NO faces, NO bodies, NO silhouettes of people',
    'NO characters, NO crowds, NO pedestrians',
    'NO animals, NO pets, NO wildlife, NO birds, NO insects, NO living creatures',
    'Environment, architecture, scenery, furniture and props ONLY',
    'Empty establishing shot / background plate — no living subjects',
]

export function environmentPromptToApiText(raw, styleContext = {}) {
    const p = normalizeEnvironmentPromptJson(raw, styleContext)
    const aspectRatio = styleContext.aspectRatio || '9:16'
    const sceneLines = [
        p.scene.location && `Location: ${p.scene.location}`,
        p.scene.description && `Environment: ${p.scene.description}`,
        p.scene.time && `Time: ${p.scene.time}`,
        p.scene.weather && `Weather: ${p.scene.weather}`,
        p.scene.objects?.length && `Objects: ${p.scene.objects.join(', ')}`,
        p.scene.atmosphere && `Atmosphere: ${p.scene.atmosphere}`,
    ].filter(Boolean).join('\n')

    const body = [
        `STYLE: ${p.style.visualStyle}`,
        `SCENE TYPE: ${p.scene.sceneType}`,
        sceneLines,
        p.lighting && `LIGHTING: ${p.lighting}`,
        `CAMERA: ${p.camera.orientation}, ${p.camera.framing}, ${p.camera.angle}`,
        `QUALITY: ${p.quality}`,
    ].filter(Boolean).join('\n')

    const rules = [
        ...getEnvironmentFrameNegativeRules(aspectRatio),
        ...ENVIRONMENT_IMAGE_NEGATIVE_RULES,
    ].map((rule) => `- ${rule}`).join('\n')

    return `${body}\n\nCONSTRAINTS:\n${rules}`
}

// ── Shot first-frame image prompt ───────────────────────────────────────────

export const SHOT_FRAME_REFERENCE_RULES = [
    'USE the provided environment/scene background reference image as the backdrop — preserve location, layout, lighting and orientation',
    'USE the provided character reference image(s) — match face, hair, skin tone, outfit and body proportions exactly',
    'Composite character(s) into the environment plate naturally — correct scale, depth and perspective relative to the scene',
    'Harmonize character size and placement with the environment frame — adjust camera angle, shot distance and character position (NOT appearance) for best composition',
    'Final image MUST match the project aspect ratio — character and background composed together for that ratio',
]

export const SHOT_FRAME_IMAGE_NEGATIVE_RULES = [
    'NO text, NO letters, NO words, NO writing, NO captions, NO subtitles',
    'NO speech bubbles, NO dialogue balloons, NO chat bubbles, NO comic bubbles',
    'NO watermarks, NO logos, NO UI overlays, NO typography anywhere in the frame',
    'SINGLE FRAME ONLY — one unified frame image, NOT multiple panels or split layout',
    'Do NOT ignore reference images — do NOT redraw background or character appearance from scratch',
    'NO character disproportionately large or tiny vs environment — scale must look natural and cohesive',
    'NO awkward pasted-on look — character must feel integrated into the scene depth and lighting',
    'Cinematic illustration still — pure visuals only, all dialogue is voice-over / audio only',
]

const SHOT_FRAME_CHARACTER_REF_HINT = 'Use provided character reference image(s) — match face, hair, skin tone and outfit exactly.'

function buildShotFrameFramingBlock(styleContext = {}) {
    const aspectRatio = styleContext.aspectRatio || '9:16'
    return {
        aspectRatio,
        orientation: storyboardEnvironmentOrientationLabel(aspectRatio),
        characterScale: 'Proportional to environment depth — character naturally sized in scene, harmonious with background scale',
        cameraAdaptation: 'Choose shot angle, distance and orientation that best fit aspect ratio while keeping character-environment cohesion',
        harmonyNotes: storyboardShotFrameHarmonyGuide(aspectRatio),
    }
}

export function createShotFramePromptJson(styleContext = {}) {
    return {
        type: 'shot_first_frame',
        project: buildProjectMeta(styleContext),
        style: buildStyleBlock(styleContext),
        references: {
            useEnvironmentImage: true,
            useCharacterRefs: true,
        },
        character: {
            name: '',
            pose: '',
            expression: '',
            position: '',
            action: '',
            interaction: '',
        },
        environment: {
            useReference: true,
            note: 'Keep the same location, layout, lighting and orientation from environment reference — do NOT redraw background',
        },
        framing: buildShotFrameFramingBlock(styleContext),
        camera: '',
        lighting: 'Match the lighting of the provided environment reference image',
        composition: 'Composite character(s) onto environment — harmonious scale, depth and perspective; adjust camera/position for best frame at project aspect ratio',
        quality: DEFAULT_RENDER_QUALITY,
    }
}

export function getShotFramePromptJsonTemplate(styleContext = {}) {
    const aspectRatio = styleContext.aspectRatio || '9:16'
    const tpl = createShotFramePromptJson(styleContext)
    tpl.character = {
        name: '[character name from refs]',
        pose: '[body pose in frame]',
        expression: '[facial expression]',
        position: '[where in frame — rule of thirds; sized harmoniously vs environment]',
        action: '[initial action or still moment]',
        interaction: '[optional prop interaction]',
    }
    tpl.camera = '[shot type + angle + distance — medium/wide/close-up; adapt orientation for best aspect-ratio composition]'
    tpl.composition = `[how character sits in scene — scale vs environment, depth, visual balance for ${aspectRatio}]`
    return tpl
}

function legacyShotFrameToJson(raw, styleContext, blocks = null) {
    const base = createShotFramePromptJson(styleContext)
    const text = String(raw || '').trim()
    if (!text) return base

    if (/^STYLE:|^CHARACTER:/im.test(text)) {
        const sections = {}
        let currentKey = null
        const buffers = []
        const keyMap = {
            style: 'style', character: 'character', environment: 'environment',
            position: 'position', pose: 'pose', 'facial expression': 'expression',
            action: 'action', interaction: 'interaction', camera: 'camera',
            lighting: 'lighting', composition: 'composition', quality: 'quality',
        }
        const flush = () => {
            if (currentKey) sections[currentKey] = buffers.join('\n').trim()
            buffers.length = 0
        }
        for (const line of text.split('\n')) {
            const headerMatch = line.match(/^([^:\n]+):\s*$/)
            if (headerMatch) {
                const key = keyMap[headerMatch[1].trim().toLowerCase()]
                if (key) { flush(); currentKey = key; continue }
            }
            if (currentKey) buffers.push(line)
        }
        flush()
        if (sections.character) base.character.name = sections.character
        if (sections.pose) base.character.pose = sections.pose
        if (sections.expression) base.character.expression = sections.expression
        if (sections.position) base.character.position = sections.position
        if (sections.action) base.character.action = sections.action
        if (sections.interaction) base.character.interaction = sections.interaction
        if (sections.camera) base.camera = sections.camera
    } else {
        base.character.name = text
    }

    if (blocks) enrichShotFrameFromBlocks(base, blocks)
    return base
}

function enrichShotFrameFromBlocks(json, blocks) {
    if (!blocks) return json
    if (!json.character.name && blocks.character?.name) {
        json.character.name = blocks.character.name
    }
    if (!json.character.pose && blocks.scene?.pose) json.character.pose = blocks.scene.pose
    if (!json.character.expression && blocks.emotion?.description) {
        json.character.expression = blocks.emotion.description
    }
    if (!json.character.action && blocks.scene?.description) {
        json.character.action = blocks.scene.description
    }
    if (!json.character.position && blocks.scene?.shot) {
        json.character.position = blocks.scene.shot
    }
    if (!json.character.interaction && blocks.scene?.props?.length) {
        json.character.interaction = `With ${blocks.scene.props.join(', ')}`
    }
}

function mergeShotFramePromptJson(input, styleContext = {}, blocks = null) {
    const base = createShotFramePromptJson(styleContext)
    const src = input && typeof input === 'object' ? input : {}

    if (src.project) base.project = { ...base.project, ...src.project }
    if (src.references) base.references = { ...base.references, ...src.references }
    if (src.character) base.character = { ...base.character, ...src.character }
    if (src.environment) base.environment = { ...base.environment, ...src.environment }
    if (src.framing) base.framing = { ...base.framing, ...src.framing }
    if (src.camera) base.camera = String(src.camera).trim()
    if (src.lighting) base.lighting = String(src.lighting).trim()
    if (src.composition) base.composition = String(src.composition).trim()
    if (src.quality) base.quality = String(src.quality).trim()

    enrichShotFrameFromBlocks(base, blocks)

    base.style = buildStyleBlock(styleContext)
    base.project = buildProjectMeta(styleContext)
    base.framing = {
        ...buildShotFrameFramingBlock(styleContext),
        ...(base.framing || {}),
        aspectRatio: styleContext.aspectRatio || base.framing?.aspectRatio || '9:16',
    }
    base.references.useEnvironmentImage = true
    base.references.useCharacterRefs = true
    base.environment.useReference = true

    if (base.character.name && !/character reference/i.test(base.character.name)) {
        base.character.name = `${SHOT_FRAME_CHARACTER_REF_HINT} ${base.character.name}`.trim()
    } else if (!base.character.name) {
        base.character.name = SHOT_FRAME_CHARACTER_REF_HINT
    }

    return base
}

export function normalizeShotFramePromptJson(raw, styleContext = {}, blocks = null) {
    let parsed = parsePromptInput(raw)
    if (!parsed) {
        const text = String(raw || '').trim()
        parsed = text
            ? legacyShotFrameToJson(text, styleContext, blocks)
            : createShotFramePromptJson(styleContext)
    }
    return mergeShotFramePromptJson(parsed, styleContext, blocks)
}

export function shotFramePromptToDisplay(raw, styleContext = {}, blocks = null) {
    return stringifyPromptJson(normalizeShotFramePromptJson(raw, styleContext, blocks))
}

export function shotFramePromptToApiText(raw, styleContext = {}, blocks = null) {
    const p = normalizeShotFramePromptJson(raw, styleContext, blocks)
    const aspectRatio = p.framing?.aspectRatio || p.project?.aspectRatio || styleContext.aspectRatio || '9:16'
    const harmonyLines = (p.framing?.harmonyNotes || storyboardShotFrameHarmonyGuide(aspectRatio))
        .map((line) => `- ${line}`)
        .join('\n')

    const charParts = [
        p.character.name && `Character: ${p.character.name}`,
        p.character.position && `Position: ${p.character.position}`,
        p.character.pose && `Pose: ${p.character.pose}`,
        p.character.expression && `Expression: ${p.character.expression}`,
        p.character.action && `Action: ${p.character.action}`,
        p.character.interaction && `Interaction: ${p.character.interaction}`,
    ].filter(Boolean).join('\n')

    const framingParts = [
        p.framing?.orientation && `Orientation: ${p.framing.orientation} (${aspectRatio})`,
        p.framing?.characterScale && `Character scale: ${p.framing.characterScale}`,
        p.framing?.cameraAdaptation && `Camera adaptation: ${p.framing.cameraAdaptation}`,
    ].filter(Boolean).join('\n')

    const body = [
        `STYLE: ${p.style.visualStyle}`,
        charParts,
        `ENVIRONMENT: ${p.environment.note}`,
        framingParts,
        p.camera && `CAMERA: ${p.camera}`,
        `LIGHTING: ${p.lighting}`,
        `COMPOSITION: ${p.composition}`,
        `QUALITY: ${p.quality}`,
    ].filter(Boolean).join('\n')

    const refRules = SHOT_FRAME_REFERENCE_RULES.map((rule) => `- ${rule}`).join('\n')
    const rules = SHOT_FRAME_IMAGE_NEGATIVE_RULES.map((rule) => `- ${rule}`).join('\n')
    return `${body}\n\nFRAMING & HARMONY (${aspectRatio}):\n${harmonyLines}\n\nREFERENCE IMAGES:\n${refRules}\n\nCONSTRAINTS:\n${rules}`
}

// ── Character reference image prompt ────────────────────────────────────────

export const CHARACTER_REF_POSE = 'Full body shot, standing neutral pose, arms relaxed at sides, facing camera, single person only'
export const CHARACTER_REF_BACKGROUND = 'Plain white background (#FFFFFF), no environment, no scenery, no props'
export const CHARACTER_REF_CAMERA = 'Front view, eye-level, full body in frame from head to toe, centered, no crop'
export const CHARACTER_REF_LIGHTING = 'Soft studio lighting, even illumination, minimal shadows'
export const CHARACTER_REF_QUALITY = 'Character design reference sheet, ultra detailed, consistent proportions, professional illustration'

export const CHARACTER_REF_IMAGE_NEGATIVE_RULES = [
    'SINGLE CHARACTER ONLY — exactly one person, NOT two or more people',
    'NO group shot, NO couple, NO crowd, NO background characters',
    'NO text, NO letters, NO logos, NO watermarks, NO UI overlays',
    'NO split screen, NO multi-panel, NO character sheet grid with multiple poses',
    'NO environment scene — white background only',
    'Full outfit visible, no crop, no cut-off limbs',
]

export const CHARACTER_REF_STYLE_IMAGE_RULES = [
    'USE the provided style reference image(s) — match art style, line work, shading, color palette and rendering technique',
    'Character appearance comes from character section — style refs guide visual style only',
]

function characterRefStyleRefUrls(styleContext = {}) {
    return (styleContext.characterRefStyleRefs || [])
        .map((ref) => (typeof ref === 'string' ? ref : String(ref?.url || ref?.imageUrl || '')).trim())
        .filter(Boolean)
}

function buildCharacterRefStyleBlock(styleContext = {}) {
    const style = buildStyleBlock(styleContext)
    const override = String(styleContext.characterRefStyle || '').trim()
    if (override) style.visualStyle = override
    const hasStyleRefs = characterRefStyleRefUrls(styleContext).length > 0
    if (hasStyleRefs) style.useStyleRefs = true
    return style
}

export function createCharacterRefPromptJson(styleContext = {}) {
    return {
        type: 'character_reference',
        project: buildProjectMeta(styleContext),
        style: buildCharacterRefStyleBlock(styleContext),
        character: {
            name: '',
            age: '',
            gender: '',
            hair: '',
            eyes: '',
            skinTone: '',
            outfit: '',
            accessories: '',
            distinguishingFeatures: '',
        },
        pose: CHARACTER_REF_POSE,
        background: CHARACTER_REF_BACKGROUND,
        camera: CHARACTER_REF_CAMERA,
        lighting: CHARACTER_REF_LIGHTING,
        quality: CHARACTER_REF_QUALITY,
    }
}

export function getCharacterRefPromptJsonTemplate(styleContext = {}) {
    const tpl = createCharacterRefPromptJson(styleContext)
    tpl.character = {
        name: '[name]',
        age: '[age]',
        gender: '[gender]',
        hair: '[hair color and style]',
        eyes: '[eye color]',
        skinTone: '[skin tone]',
        outfit: '[clothing details]',
        accessories: '[accessories]',
        distinguishingFeatures: '[unique visual traits]',
    }
    return tpl
}

function legacyCharacterRefToJson(raw, styleContext) {
    const base = createCharacterRefPromptJson(styleContext)
    const text = String(raw || '').trim()
    if (!text) return base
    if (/^STYLE:|^CHARACTER:/im.test(text)) {
        let charText = text
        const charMatch = text.match(/CHARACTER:\s*\n([\s\S]*?)(?:\n[A-Z][A-Z ]+:|$)/i)
        if (charMatch) charText = charMatch[1].trim()
        base.character.name = charText
    } else {
        base.character.name = text
    }
    return base
}

function mergeCharacterRefPromptJson(input, styleContext = {}) {
    const base = createCharacterRefPromptJson(styleContext)
    const src = input && typeof input === 'object' ? input : {}

    if (src.project) base.project = { ...base.project, ...src.project }
    if (src.character) base.character = { ...base.character, ...src.character }
    if (src.pose) base.pose = String(src.pose).trim()
    if (src.background) base.background = String(src.background).trim()
    if (src.camera) base.camera = String(src.camera).trim()
    if (src.lighting) base.lighting = String(src.lighting).trim()
    if (src.quality) base.quality = String(src.quality).trim()

    base.style = buildCharacterRefStyleBlock(styleContext)
    base.project = buildProjectMeta(styleContext)
    base.pose = CHARACTER_REF_POSE
    base.background = CHARACTER_REF_BACKGROUND
    base.camera = CHARACTER_REF_CAMERA
    base.lighting = CHARACTER_REF_LIGHTING
    base.quality = CHARACTER_REF_QUALITY

    return base
}

export function normalizeCharacterRefPromptJson(raw, styleContext = {}) {
    let parsed = parsePromptInput(raw)
    if (!parsed) {
        const text = String(raw || '').trim()
        parsed = text
            ? legacyCharacterRefToJson(text, styleContext)
            : createCharacterRefPromptJson(styleContext)
    }
    return mergeCharacterRefPromptJson(parsed, styleContext)
}

export function characterRefPromptToDisplay(raw, styleContext = {}) {
    return stringifyPromptJson(normalizeCharacterRefPromptJson(raw, styleContext))
}

function formatCharacterAppearance(c) {
    return [
        c.name && `Name: ${c.name}`,
        c.age && `Age: ${c.age}`,
        c.gender && `Gender: ${c.gender}`,
        c.hair && `Hair: ${c.hair}`,
        c.eyes && `Eyes: ${c.eyes}`,
        c.skinTone && `Skin: ${c.skinTone}`,
        c.outfit && `Outfit: ${c.outfit}`,
        c.accessories && `Accessories: ${c.accessories}`,
        c.distinguishingFeatures && `Features: ${c.distinguishingFeatures}`,
    ].filter(Boolean).join(', ')
}

export function characterRefPromptToApiText(raw, styleContext = {}) {
    const p = normalizeCharacterRefPromptJson(raw, styleContext)
    const appearance = formatCharacterAppearance(p.character) || String(p.character.name || '').trim()
    const body = [
        `STYLE: ${p.style.visualStyle}`,
        `CHARACTER: ${appearance}`,
        `POSE: ${p.pose}`,
        `BACKGROUND: ${p.background}`,
        `CAMERA: ${p.camera}`,
        `LIGHTING: ${p.lighting}`,
        `QUALITY: ${p.quality}`,
    ].join('\n')

    const hasStyleRefs = characterRefStyleRefUrls(styleContext).length > 0
    const styleRules = hasStyleRefs
        ? `\n\nSTYLE REFERENCE IMAGES:\n${CHARACTER_REF_STYLE_IMAGE_RULES.map((r) => `- ${r}`).join('\n')}`
        : ''
    const rules = CHARACTER_REF_IMAGE_NEGATIVE_RULES.map((rule) => `- ${rule}`).join('\n')
    return `${body}${styleRules}\n\nCONSTRAINTS:\n${rules}`
}

// ── Video blocks (12-block JSON) ──────────────────────────────────────────────

export function applyProjectStyleToVideoBlocks(blocks, styleContext = {}) {
    if (!blocks || typeof blocks !== 'object') return blocks
    const style = resolveProjectStyle(styleContext)
    return {
        ...blocks,
        style: {
            ...(blocks.style || {}),
            preset: styleContext.stylePreset || blocks.style?.preset || '',
            visualStyle: style,
            renderQuality: blocks.style?.renderQuality || DEFAULT_RENDER_QUALITY,
        },
    }
}

export function buildVideoBlocksContext(styleContext = {}, templateDefaults = {}) {
    return {
        stylePreset: styleContext.stylePreset || '',
        visualStyle: resolveProjectStyle(styleContext),
        character: templateDefaults.character || '',
        scene: templateDefaults.scene || '',
        emotion: templateDefaults.emotion || '',
        camera: templateDefaults.camera || '',
        lighting: templateDefaults.lighting || '',
        environment: templateDefaults.environment || '',
        mood: templateDefaults.mood || '',
        asmr: templateDefaults.asmr || [],
        bgm: templateDefaults.bgm || '',
        rules: templateDefaults.rules || [],
    }
}

export function getVideoBlocksJsonTemplate(styleContext = {}, templateDefaults = {}) {
    const ctx = buildVideoBlocksContext(styleContext, templateDefaults)
    return {
        type: 'video_shot',
        style: {
            preset: ctx.stylePreset,
            visualStyle: ctx.visualStyle,
            renderQuality: DEFAULT_RENDER_QUALITY,
        },
        character: {
            name: '[character name — must match project character list]',
            description: '[pose, action, expression in this shot]',
        },
        scene: {
            shot: '[shot type + framing — choose angle/distance so character harmonizes with environment at project aspect ratio]',
            location: '[same scene location]',
            time: '[time of day]',
            pose: '[body pose]',
            props: ['[prop if any]'],
            description: '[what happens visually in this shot]',
        },
        emotion: {
            description: '[facial expression and emotional tone]',
            tags: ['[emotion tag]'],
        },
        camera: [{
            action: '[pan / zoom / static / track]',
            target: '[subject or environment]',
            speed: '[slow / medium / fast]',
        }],
        lighting: {
            type: '[natural / studio / dramatic]',
            time: '[time of day]',
            quality: '[soft / harsh / diffused]',
            description: ctx.lighting,
        },
        environment: {
            description: '[environment details matching scene plate]',
            details: [ctx.environment].filter(Boolean),
        },
        mood: {
            description: ctx.mood,
            tags: ['[mood tag]'],
        },
        audio: {
            speaker: '[character name or NARRATOR]',
            text: '[dialogue in project language — voice-over only in images]',
            voiceEmotion: '[how it is spoken]',
        },
        asmr: ctx.asmr,
        bgm: {
            genre: '[genre]',
            mood: '[mood]',
            description: ctx.bgm,
        },
        rules: ctx.rules,
    }
}
