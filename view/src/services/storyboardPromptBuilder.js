/**
 * Build cinematic AI video prompt from structured storyboard blocks.
 */

import { isLandscapeStoryAspect, storyboardEnvironmentOrientationLabel } from '@/utils/storyboardAspect.js'

const joinLines = (lines) => lines.filter(Boolean).join(',\n');

const formatCamera = (camera = []) => {
    if (!Array.isArray(camera) || !camera.length) return '';
    return camera
        .map((c) => {
            const speed = c.speed ? ` ${c.speed}` : '';
            const action = String(c.action || 'move').replace(/_/g, ' ');
            return `The camera ${action}${speed} on ${c.target || 'subject'}.`;
        })
        .join('\n');
};

const formatCharacter = (character = {}) => {
    if (character.description) return character.description.trim();
    if (!character.name) return '';
    return character.name;
};

const formatScene = (scene = {}) => {
    if (scene.description) return scene.description.trim();
    const parts = [
        scene.shot ? `A ${scene.shot}` : '',
        scene.pose || '',
        scene.location ? `in ${scene.location}` : '',
        scene.time || '',
    ].filter(Boolean);
    if (scene.props?.length) parts.push(`surrounded by ${scene.props.join(', ')}`);
    return parts.join(' ');
};

const formatEmotion = (emotion = {}) => {
    if (emotion.description) return emotion.description.trim();
    if (emotion.tags?.length) return `Expression: ${emotion.tags.join(', ')}.`;
    return '';
};

const formatLighting = (lighting = {}) => {
    if (lighting.description) return lighting.description.trim();
    const parts = [lighting.quality, lighting.type, lighting.time].filter(Boolean);
    if (!parts.length) return '';
    return `${parts.join(', ')} light.`;
};

const formatEnvironment = (environment = {}) => {
    const lines = [];
    if (environment.description) lines.push(environment.description.trim());
    if (environment.details?.length) lines.push(...environment.details);
    return lines.join('\n');
};

const formatMood = (mood = {}) => {
    if (mood.description) return mood.description.trim();
    if (mood.tags?.length) return `Atmosphere: ${mood.tags.join(', ')}.`;
    return '';
};

const formatAudio = (audio = {}) => {
    if (!audio.text?.trim()) return '';
    const speaker = audio.speaker || 'Character';
    return `Audio:\n${speaker} says\n"${audio.text.trim()}"`;
};

const formatAsmr = (asmr = []) => {
    if (!Array.isArray(asmr) || !asmr.length) return '';
    return `ASMR:\n${asmr.join(',\n')}`;
};

const formatBgm = (bgm = {}) => {
    if (bgm.description) return `BGM:\n${bgm.description.trim()}`;
    const parts = [bgm.genre, bgm.mood].filter(Boolean);
    if (!parts.length) return '';
    return `BGM:\n${parts.join(', ')} music`;
};

const formatRules = (rules = []) => {
    if (!Array.isArray(rules) || !rules.length) return '';
    return rules.join('\n');
};

const formatStyle = (style = {}) => {
    if (style.visualStyle) return style.visualStyle.trim();
    return joinLines([style.renderQuality]);
};

/**
 * @param {{ blocks?: object }} scene
 * @returns {string}
 */
export function buildScenePrompt(scene) {
    const blocks = scene?.blocks || scene || {};
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
    ];

    return sections
        .filter(([, body]) => body?.trim())
        .map(([title, body]) => `${title}:\n${body.trim()}`)
        .join('\n\n');
}

/**
 * @param {object} storyboard
 * @returns {Array<{ index: number, label: string, durationSec: number, prompt: string, blocks: object }>}
 */
/**
 * Prompt cho gen video — ưu tiên Scene prompt (textarea), không dùng prompt ảnh.
 * @param {{ prompt?: string, blocks?: object, beat?: string }} scene
 */
export function storyboardSceneVideoPrompt(scene) {
    const fromTextarea = String(scene?.prompt || '').trim();
    if (fromTextarea) return fromTextarea;
    if (scene?.blocks) return buildScenePrompt(scene);
    return String(scene?.beat || '').trim();
}

/**
 * Video prompt for a shot — 12-block structure.
 * @param {{ videoPrompt?: string, blocks?: object, imagePrompt?: string, label?: string }} shot
 */
export function storyboardShotVideoPrompt(shot) {
    const fromTextarea = String(shot?.videoPrompt || '').trim();
    if (fromTextarea) return fromTextarea;
    if (shot?.blocks) return buildScenePrompt(shot);
    return String(shot?.imagePrompt || shot?.label || '').trim();
}

const normalizePromptSpacing = (text) =>
    String(text || '')
        .replace(/\s{2,}/g, ' ')
        .replace(/\s+\./g, '.')
        .replace(/\.{2,}/g, '.')
        .replace(/,\s*,/g, ',')
        .trim();

function buildLabelToKey(sectionDefs) {
    const map = {};
    for (const def of sectionDefs) {
        map[def.label.toLowerCase()] = def.key;
        for (const alias of def.aliases || []) {
            map[alias.toLowerCase()] = def.key;
        }
    }
    return map;
}

function parseSectionedPrompt(text, sectionDefs) {
    const result = Object.fromEntries(sectionDefs.map(({ key }) => [key, '']));
    const raw = String(text || '').trim();
    if (!raw) return result;

    let body = raw;
    const constraintsIdx = body.search(/\nCONSTRAINTS:\s*\n/i);
    if (constraintsIdx >= 0) body = body.slice(0, constraintsIdx).trim();

    const labelToKey = buildLabelToKey(sectionDefs);
    let currentKey = null;
    const buffers = [];

    const flush = () => {
        if (currentKey) {
            result[currentKey] = buffers.join('\n').trim();
            buffers.length = 0;
        }
    };

    for (const line of body.split('\n')) {
        const headerMatch = line.match(/^([^:\n]+):\s*$/);
        if (headerMatch) {
            const key = labelToKey[headerMatch[1].trim().toLowerCase()];
            if (key) {
                flush();
                currentKey = key;
                continue;
            }
        }
        if (currentKey) buffers.push(line);
    }
    flush();
    return result;
}

function hasSectionedContent(sections, sectionDefs) {
    return sectionDefs.some(({ key }) => sections[key]?.trim());
}

function formatSectionedPrompt(sectionDefs, sections = {}, fixed = {}) {
    const lines = [];
    for (const { key, label } of sectionDefs) {
        const value = fixed[key] ?? sections[key] ?? '';
        lines.push(`${label}:`);
        if (String(value).trim()) lines.push(String(value).trim());
        lines.push('');
    }
    return lines.join('\n').trim();
}

function flattenSectionedPrompt(text, sectionDefs) {
    const sections = parseSectionedPrompt(text, sectionDefs);
    return sectionDefs
        .map(({ key, label }) => {
            const value = sections[key]?.trim();
            return value ? `${label}: ${value}` : '';
        })
        .filter(Boolean)
        .join('\n');
}

function enrichShotFrameSections(sections = {}, ctx = {}) {
    const { styleContext = {}, blocks = null } = ctx;
    const out = { ...sections };

    if (blocks) {
        if (!out.character?.trim() && blocks.character) {
            out.character = formatCharacter(blocks.character);
        }
        if (!out.pose?.trim() && blocks.scene?.pose) out.pose = blocks.scene.pose;
        if (!out.facialExpression?.trim() && blocks.emotion) {
            out.facialExpression = formatEmotion(blocks.emotion);
        }
        if (!out.camera?.trim() && blocks.camera?.length) {
            out.camera = formatCamera(blocks.camera);
        }
        if (!out.action?.trim() && blocks.scene?.description) {
            out.action = blocks.scene.description;
        }
        if (!out.position?.trim() && blocks.scene?.shot) {
            out.position = blocks.scene.shot;
        }
        if (!out.interaction?.trim() && blocks.scene?.props?.length) {
            out.interaction = `With ${blocks.scene.props.join(', ')}`;
        }
        if (!out.style?.trim() && blocks.style?.visualStyle) {
            out.style = blocks.style.visualStyle;
        }
    }

    if (!out.style?.trim()) {
        out.style = [styleContext.visualStyle, styleContext.stylePreset].filter(Boolean).join(', ');
    }

    const ensureCharacterRefHint = (text) => {
        const trimmed = String(text || '').trim();
        if (!trimmed) return trimmed;
        if (/provided character reference|character reference image/i.test(trimmed)) return trimmed;
        return `${SHOT_FRAME_CHARACTER_REF_PREFIX}${trimmed}`;
    };

    if (out.character?.trim()) {
        out.character = ensureCharacterRefHint(out.character);
    }

    return out;
}

/** Positive rules — shot frame is composited from uploaded reference images. */
export const SHOT_FRAME_REFERENCE_RULES = [
    'USE the provided environment/scene background reference image as the backdrop — preserve location, layout, lighting and orientation',
    'USE the provided character reference image(s) — match face, hair, skin tone, outfit and body proportions exactly',
    'Composite character(s) into the environment plate naturally — correct scale, depth and perspective',
];

/** Anti-text rules appended when generating shot first-frame images. */
export const SHOT_FRAME_IMAGE_NEGATIVE_RULES = [
    'NO text, NO letters, NO words, NO writing, NO captions, NO subtitles',
    'NO speech bubbles, NO dialogue balloons, NO chat bubbles, NO comic bubbles, NO manga SFX text',
    'NO watermarks, NO logos, NO UI overlays, NO typography anywhere in the frame',
    'SINGLE FRAME ONLY — one unified frame image, NOT multiple panels or split layout',
    'Do NOT ignore reference images — do NOT redraw background or character appearance from scratch',
    'Cinematic illustration still — pure visuals only, all dialogue is voice-over / audio only',
];

export const SHOT_FRAME_PROMPT_SECTIONS = [
    { key: 'style', label: 'STYLE' },
    { key: 'character', label: 'CHARACTER' },
    { key: 'environment', label: 'ENVIRONMENT' },
    { key: 'position', label: 'POSITION' },
    { key: 'pose', label: 'POSE' },
    { key: 'facialExpression', label: 'FACIAL EXPRESSION' },
    { key: 'action', label: 'ACTION' },
    { key: 'interaction', label: 'INTERACTION' },
    { key: 'camera', label: 'CAMERA' },
    { key: 'lighting', label: 'LIGHTING' },
    { key: 'composition', label: 'COMPOSITION' },
    { key: 'quality', label: 'QUALITY' },
];

export const SHOT_FRAME_ENVIRONMENT_DEFAULT = 'Use the provided environment/scene background reference image — keep the same location, layout, lighting and orientation; do NOT redraw the background from scratch or use multi-panel layout.';
export const SHOT_FRAME_LIGHTING_DEFAULT = 'Match the lighting of the provided environment reference image.';
export const SHOT_FRAME_COMPOSITION_DEFAULT = 'Composite character(s) from provided character reference images onto the environment background — natural placement, correct scale, realistic depth and perspective alignment.';
export const SHOT_FRAME_QUALITY_DEFAULT = 'Cinematic frame, movie scene, highly detailed, professional composition, 4k quality.';
export const SHOT_FRAME_CHARACTER_REF_PREFIX = 'Use provided character reference image(s) — match face, hair, skin tone and outfit exactly. ';

const SHOT_FRAME_FIXED_SECTIONS = {
    environment: SHOT_FRAME_ENVIRONMENT_DEFAULT,
    lighting: SHOT_FRAME_LIGHTING_DEFAULT,
    composition: SHOT_FRAME_COMPOSITION_DEFAULT,
    quality: SHOT_FRAME_QUALITY_DEFAULT,
};

/**
 * Example shot frame prompt template for Gemini / docs.
 * @param {object} [styleContext]
 */
export function getShotFramePromptTemplate(styleContext = {}) {
    const style = [styleContext.visualStyle, styleContext.stylePreset].filter(Boolean).join(', ')
        || 'cinematic anime style';
    return formatSectionedPrompt(SHOT_FRAME_PROMPT_SECTIONS, {
        style,
        character: `${SHOT_FRAME_CHARACTER_REF_PREFIX}[name, pose in frame, expression — appearance from character ref]`,
        position: '[character placement in frame]',
        pose: '[body pose]',
        facialExpression: '[expression]',
        action: '[initial action or state]',
        interaction: '[optional prop interaction]',
        camera: '[shot angle and framing]',
    }, SHOT_FRAME_FIXED_SECTIONS);
}

/**
 * Normalize shot first-frame prompt into structured sections.
 * @param {string} rawPrompt
 * @param {{ styleContext?: object, blocks?: object }} [ctx]
 */
export function normalizeShotFrameImagePrompt(rawPrompt, ctx = {}) {
    const { styleContext = {}, blocks = null } = ctx;
    const raw = String(rawPrompt || '').trim();
    let sections = raw
        ? parseSectionedPrompt(raw, SHOT_FRAME_PROMPT_SECTIONS)
        : {};

    if (!hasSectionedContent(sections, SHOT_FRAME_PROMPT_SECTIONS)) {
        sections = { character: raw };
    }

    sections = enrichShotFrameSections(sections, { styleContext, blocks });
    return formatSectionedPrompt(SHOT_FRAME_PROMPT_SECTIONS, sections, SHOT_FRAME_FIXED_SECTIONS);
}

/**
 * Final prompt sent to image API for shot first-frame (keyframe).
 * @param {string} rawPrompt
 * @param {{ styleContext?: object, blocks?: object }} [ctx]
 */
export function buildShotFrameImagePrompt(rawPrompt, ctx = {}) {
    const normalized = normalizeShotFrameImagePrompt(rawPrompt, ctx);
    if (/no text|no speech bubble|no dialogue balloon|zero visible text|no typography/i.test(normalized)) {
        return normalized;
    }
    const refRules = SHOT_FRAME_REFERENCE_RULES.map((rule) => `- ${rule}`).join('\n');
    const rules = SHOT_FRAME_IMAGE_NEGATIVE_RULES.map((rule) => `- ${rule}`).join('\n');
    return `${normalized}\n\nREFERENCE IMAGES:\n${refRules}\n\nCONSTRAINTS:\n${rules}`;
}

export function buildStoryboardPrompts(storyboard) {
    const scenes = storyboard?.scenes || [];
    return scenes.map((scene) => ({
        index: scene.index,
        label: scene.label,
        durationSec: scene.durationSec,
        blocks: scene.blocks,
        prompt: buildScenePrompt(scene),
    }));
}

/** Banned in environment-only image prompts — living subjects / characters. */
const ENVIRONMENT_SUBJECT_PATTERNS = [
    /\b(human|humans|person|people|someone|anybody|figure|figures|silhouette|silhouettes)\b/gi,
    /\b(man|men|woman|women|boy|boys|girl|girls|child|children|kid|kids|teen|teens|adult|adults)\b/gi,
    /\b(character|characters|protagonist|hero|heroine|villain|npc|crowd|pedestrian|pedestrians|passerby|passersby|stranger|strangers)\b/gi,
    /\b(face|faces|body|bodies|portrait|portraits|selfie|selfies)\b/gi,
    /\b(animal|animals|pet|pets|dog|dogs|cat|cats|puppy|kitten|bird|birds|butterfly|butterflies|insect|insects|bug|bugs)\b/gi,
    /\b(wildlife|squirrel|squirrels|rabbit|rabbits|mouse|mice|rat|rats|horse|horses|cow|cows|deer|fox|foxes|fish|fishes)\b/gi,
    /\b(monkey|monkeys|elephant|elephants|tiger|lion|bear|bears|snake|snakes|spider|spiders|dragon|dragons)\b/gi,
    /\b(nhân vật|người|con người|đàn ông|đàn bà|phụ nữ|nam|nữ|trẻ em|em bé|cậu bé|cô gái|anh|chị|mặt|thân hình)\b/gi,
    /\b(động vật|thú|chim|côn trùng|bướm|mèo|chó|thỏ|chuột|cá|voi|hổ|sư tử|gấu|rắn|nhện|rồng)\b/gi,
];

export const ENVIRONMENT_IMAGE_NEGATIVE_RULES = [
    'NO people, NO human figures, NO faces, NO bodies, NO silhouettes of people',
    'NO characters, NO crowds, NO pedestrians',
    'NO animals, NO pets, NO wildlife, NO birds, NO insects, NO living creatures',
    'Environment, architecture, landscape, furniture and props ONLY',
    'Empty establishing shot / background plate — no living subjects',
];

export const ENVIRONMENT_PROMPT_SECTIONS = [
    { key: 'style', label: 'STYLE' },
    { key: 'sceneType', label: 'SCENE TYPE' },
    { key: 'environment', label: 'ENVIRONMENT', aliases: ['Location'] },
    { key: 'time', label: 'TIME' },
    { key: 'weather', label: 'WEATHER' },
    { key: 'lighting', label: 'LIGHTING' },
    { key: 'objects', label: 'OBJECTS' },
    { key: 'atmosphere', label: 'ATMOSPHERE' },
    { key: 'camera', label: 'CAMERA', aliases: ['Camera Notes'] },
    { key: 'quality', label: 'QUALITY' },
];

export const ENVIRONMENT_SCENE_TYPE_DEFAULT = 'Single-frame empty establishing shot / background plate — ONE continuous scene only, NOT a multi-panel layout';

function getEnvironmentFrameNegativeRules(aspectRatio = '9:16') {
    const rules = [
        'SINGLE FRAME ONLY — one unified image, NOT multiple panels or stacked frames',
        'NO split screen, NO comic strip, NO storyboard sheet, NO triptych, NO grid, NO collage',
    ];
    if (aspectRatio === '1:1') {
        rules.push('NO horizontal landscape layout — square centered composition mandatory');
    } else if (isLandscapeStoryAspect(aspectRatio)) {
        rules.push('NO portrait vertical flip — maintain landscape widescreen orientation');
    } else {
        rules.push('NO horizontal landscape layout — portrait vertical orientation mandatory');
    }
    return rules;
}

function environmentCameraDefault(aspectRatio = '9:16') {
    const orient = storyboardEnvironmentOrientationLabel(aspectRatio);
    return `Single ${orient}, one unified wide establishing shot — NOT split screen or comic panels`;
}

function environmentQualityDefault(aspectRatio = '9:16') {
    const orient = aspectRatio === '1:1'
        ? 'square orientation'
        : isLandscapeStoryAspect(aspectRatio)
            ? 'landscape widescreen orientation'
            : 'portrait vertical orientation';
    return `Ultra detailed environment, cinematic composition, professional lighting, high detail background, clean scene, single unified frame, ${orient}, 4k quality.`;
}

function getEnvironmentFixedSections(styleContext = {}) {
    const aspectRatio = styleContext.aspectRatio || '9:16';
    return {
        sceneType: ENVIRONMENT_SCENE_TYPE_DEFAULT,
        camera: environmentCameraDefault(aspectRatio),
        quality: environmentQualityDefault(aspectRatio),
    };
}

export const ENVIRONMENT_PROMPT_CONSTRAINT_LINES = [...ENVIRONMENT_IMAGE_NEGATIVE_RULES];

const LEGACY_ENV_PARSE_DEFS = [
    ...ENVIRONMENT_PROMPT_SECTIONS,
    { key: 'style', label: 'Visual Style' },
    { key: 'environment', label: 'Location' },
    { key: 'environment', label: 'Architecture / Terrain' },
    { key: 'atmosphere', label: 'Background Activity' },
    { key: 'camera', label: 'Camera Notes' },
];

/**
 * Strip character/animal-related wording from environment prompt text.
 * @param {string} text
 */
export function sanitizeEnvironmentPromptText(text) {
    let cleaned = String(text || '').trim();
    if (!cleaned) return '';
    ENVIRONMENT_SUBJECT_PATTERNS.forEach((pattern) => {
        cleaned = cleaned.replace(pattern, '');
    });
    return normalizePromptSpacing(cleaned);
}

/** @deprecated Use parseSectionedPrompt with ENVIRONMENT_PROMPT_SECTIONS */
export function parseEnvironmentPromptSections(text) {
    return parseSectionedPrompt(text, ENVIRONMENT_PROMPT_SECTIONS);
}

function migrateLegacyEnvironmentSections(legacy = {}) {
    return {
        style: legacy.style || legacy.visualStyle || '',
        sceneType: legacy.sceneType || ENVIRONMENT_SCENE_TYPE_DEFAULT,
        environment: legacy.environment || legacy.location || legacy.architecture || '',
        time: legacy.time || '',
        weather: legacy.weather || '',
        lighting: legacy.lighting || '',
        objects: legacy.objects || '',
        atmosphere: legacy.atmosphere || legacy.backgroundActivity || '',
        camera: legacy.camera || legacy.cameraNotes || '',
        quality: legacy.quality || '',
    };
}

function enrichEnvironmentSections(sections = {}, styleContext = {}) {
    const out = migrateLegacyEnvironmentSections(sections);

    for (const key of ['environment', 'time', 'weather', 'lighting', 'objects', 'atmosphere', 'camera', 'sceneType']) {
        out[key] = sanitizeEnvironmentPromptText(out[key]);
    }

    if (!out.style?.trim()) {
        out.style = [styleContext.visualStyle, styleContext.stylePreset].filter(Boolean).join(', ');
    }
    if (!out.lighting?.trim() && styleContext.lighting) {
        out.lighting = String(styleContext.lighting).trim();
    }
    if (!out.atmosphere?.trim() && styleContext.mood) {
        out.atmosphere = String(styleContext.mood).trim();
    }

    return out;
}

/** @deprecated */
export function composeEnvironmentParagraph(sections = {}) {
    return formatSectionedPrompt(ENVIRONMENT_PROMPT_SECTIONS, enrichEnvironmentSections(sections));
}

/** Format section map into structured environment prompt. */
export function formatEnvironmentPromptSections(sections = {}, styleContext = {}) {
    return formatSectionedPrompt(
        ENVIRONMENT_PROMPT_SECTIONS,
        enrichEnvironmentSections(sections, styleContext),
        getEnvironmentFixedSections(styleContext),
    );
}

/**
 * Example structured environment prompt for Gemini / placeholder.
 * @param {object} [styleContext]
 */
export function getEnvironmentPromptTemplate(styleContext = {}) {
    const style = [styleContext.visualStyle, styleContext.stylePreset].filter(Boolean).join(', ')
        || 'cinematic anime style, vibrant colors';
    return formatSectionedPrompt(ENVIRONMENT_PROMPT_SECTIONS, {
        style,
        environment: '[location description]',
        time: '[time of day]',
        weather: '[weather conditions]',
        lighting: styleContext.lighting || '[lighting description]',
        objects: '[static props and furniture]',
        atmosphere: styleContext.mood || '[mood and feeling]',
    }, getEnvironmentFixedSections(styleContext));
}

/**
 * Normalize legacy or AI output into structured environment prompt.
 * @param {string} rawPrompt
 * @param {object} [styleContext]
 */
export function normalizeEnvironmentPrompt(rawPrompt, styleContext = {}) {
    const raw = String(rawPrompt || '').trim();
    if (!raw) {
        return formatSectionedPrompt(
            ENVIRONMENT_PROMPT_SECTIONS,
            enrichEnvironmentSections({}, styleContext),
            getEnvironmentFixedSections(styleContext),
        );
    }

    let sections = parseSectionedPrompt(raw, ENVIRONMENT_PROMPT_SECTIONS);
    if (!hasSectionedContent(sections, ENVIRONMENT_PROMPT_SECTIONS)) {
        if (/^STYLE:|^Visual Style:|^Location:|^ENVIRONMENT:/im.test(raw)) {
            sections = migrateLegacyEnvironmentSections(
                parseSectionedPrompt(raw, LEGACY_ENV_PARSE_DEFS),
            );
        } else {
            sections = { environment: sanitizeEnvironmentPromptText(raw) };
        }
    }

    return formatSectionedPrompt(
        ENVIRONMENT_PROMPT_SECTIONS,
        enrichEnvironmentSections(sections, styleContext),
        getEnvironmentFixedSections(styleContext),
    );
}

/** @param {string} rawPrompt */
export function flattenEnvironmentPromptForImage(rawPrompt) {
    return flattenSectionedPrompt(rawPrompt, ENVIRONMENT_PROMPT_SECTIONS);
}

/**
 * Style hints injected into environment prompts so generated plates match the story look.
 * @param {{ settings?: object, templateDefaults?: object }} ctx
 */
export function buildEnvironmentStyleContext({ settings, templateDefaults } = {}) {
    return {
        stylePreset: settings?.stylePreset || '',
        visualStyle: templateDefaults?.style || '',
        lighting: templateDefaults?.lighting || '',
        mood: templateDefaults?.mood || '',
        environment: templateDefaults?.environment || '',
        aspectRatio: settings?.aspectRatio || '9:16',
    };
}

/** @deprecated Prefer normalizeEnvironmentPrompt */
export function ensureEnvironmentPromptStyle(rawPrompt, styleContext = {}) {
    return normalizeEnvironmentPrompt(rawPrompt, styleContext);
}

/**
 * Final prompt sent to image API for scene environment plates.
 * @param {string} rawPrompt
 * @param {object} [styleContext]
 */
export function buildEnvironmentImagePrompt(rawPrompt, styleContext = {}) {
    const normalized = normalizeEnvironmentPrompt(rawPrompt, styleContext);
    const body = flattenSectionedPrompt(normalized, ENVIRONMENT_PROMPT_SECTIONS);
    const aspectRatio = styleContext.aspectRatio || '9:16';
    const rules = [
        ...getEnvironmentFrameNegativeRules(aspectRatio),
        ...ENVIRONMENT_IMAGE_NEGATIVE_RULES,
    ].map((rule) => `- ${rule}`).join('\n');
    return `${body}\n\nCONSTRAINTS:\n${rules}`;
}

// ── Character reference image prompts ───────────────────────────────────────

export const CHARACTER_REF_PROMPT_SECTIONS = [
    { key: 'style', label: 'STYLE' },
    { key: 'character', label: 'CHARACTER' },
    { key: 'pose', label: 'POSE' },
    { key: 'background', label: 'BACKGROUND' },
    { key: 'camera', label: 'CAMERA' },
    { key: 'lighting', label: 'LIGHTING' },
    { key: 'quality', label: 'QUALITY' },
];

export const CHARACTER_REF_POSE_DEFAULT = 'Full body shot, standing neutral pose, arms relaxed at sides, facing camera, single person only, no action pose';
export const CHARACTER_REF_BACKGROUND_DEFAULT = 'Plain white background (#FFFFFF), no environment, no scenery, no props, clean studio backdrop';
export const CHARACTER_REF_CAMERA_DEFAULT = 'Front view, eye-level, full body in frame from head to toe, centered composition, no crop, character design turnaround sheet framing';
export const CHARACTER_REF_LIGHTING_DEFAULT = 'Soft studio lighting, even illumination, minimal shadows, clean reference sheet lighting';
export const CHARACTER_REF_QUALITY_DEFAULT = 'Character design reference sheet, ultra detailed, consistent proportions, professional illustration, high detail, 4k quality';

export const CHARACTER_REF_IMAGE_NEGATIVE_RULES = [
    'SINGLE CHARACTER ONLY — exactly one person, NOT two or more people',
    'NO group shot, NO couple, NO crowd, NO background characters',
    'NO text, NO letters, NO logos, NO watermarks, NO UI overlays',
    'NO split screen, NO multi-panel, NO character sheet grid with multiple poses',
    'NO environment scene — white background only',
    'Full outfit visible, no crop, no cut-off limbs',
];

export const CHARACTER_REF_STYLE_IMAGE_RULES = [
    'USE the provided style reference image(s) — match art style, line work, shading, color palette and rendering technique',
    'Character appearance comes from CHARACTER section — style reference images guide visual style only, NOT identity swap',
];

const CHARACTER_REF_STYLE_FROM_REFS = 'Use the provided style reference image(s) to render this character — match art style, line work, shading and color palette';

function characterRefStyleRefUrls(styleContext = {}) {
    return (styleContext.characterRefStyleRefs || [])
        .map((ref) => (typeof ref === 'string' ? ref : String(ref?.url || ref?.imageUrl || '')).trim())
        .filter(Boolean);
}

function characterRefStyleDefault(styleContext = {}) {
    const parts = [];
    const override = String(styleContext.characterRefStyle || '').trim();
    if (override) {
        parts.push(override);
    } else {
        const baseStyle = [styleContext.visualStyle, styleContext.stylePreset].filter(Boolean).join(', ');
        if (baseStyle) parts.push(baseStyle);
    }
    if (characterRefStyleRefUrls(styleContext).length) {
        parts.push(CHARACTER_REF_STYLE_FROM_REFS);
    }
    if (!parts.length) {
        return 'anime style, vibrant colors, clean outlines, soft cel shading, studio-quality anime frame';
    }
    return parts.join(', ');
}

/** Resolved STYLE line for character reference prompts (override or project default). */
export function getDefaultCharacterRefStyle(styleContext = {}) {
    return characterRefStyleDefault(styleContext);
}

function getCharacterRefFixedSections(styleContext = {}) {
    return {
        style: characterRefStyleDefault(styleContext),
        pose: CHARACTER_REF_POSE_DEFAULT,
        background: CHARACTER_REF_BACKGROUND_DEFAULT,
        camera: CHARACTER_REF_CAMERA_DEFAULT,
        lighting: CHARACTER_REF_LIGHTING_DEFAULT,
        quality: CHARACTER_REF_QUALITY_DEFAULT,
    };
}

function enrichCharacterRefSections(sections = {}, styleContext = {}) {
    const out = { ...sections };
    if (!out.character?.trim()) out.character = '[character name, age, gender, hair, eyes, skin tone, outfit, accessories, distinguishing features]';
    return out;
}

/**
 * Example structured character ref prompt for Gemini.
 * @param {object} [styleContext]
 */
export function getCharacterRefPromptTemplate(styleContext = {}) {
    return formatSectionedPrompt(
        CHARACTER_REF_PROMPT_SECTIONS,
        enrichCharacterRefSections({
            character: '[name], [age], [gender], [hair], [eyes], [skin tone], [outfit], [accessories], [distinguishing features]',
        }, styleContext),
        getCharacterRefFixedSections(styleContext),
    );
}

/**
 * Normalize legacy or AI character ref prompt — always inject STYLE and fixed sections.
 * @param {string} rawPrompt
 * @param {object} [styleContext]
 */
export function normalizeCharacterRefPrompt(rawPrompt, styleContext = {}) {
    const raw = String(rawPrompt || '').trim();
    if (!raw) {
        return formatSectionedPrompt(
            CHARACTER_REF_PROMPT_SECTIONS,
            enrichCharacterRefSections({}, styleContext),
            getCharacterRefFixedSections(styleContext),
        );
    }

    let sections = parseSectionedPrompt(raw, CHARACTER_REF_PROMPT_SECTIONS);
    if (!hasSectionedContent(sections, CHARACTER_REF_PROMPT_SECTIONS)) {
        sections = { character: raw };
    }

    return formatSectionedPrompt(
        CHARACTER_REF_PROMPT_SECTIONS,
        enrichCharacterRefSections(sections, styleContext),
        getCharacterRefFixedSections(styleContext),
    );
}

/**
 * Final prompt sent to image API for character reference sheets.
 * @param {string} rawPrompt
 * @param {object} [styleContext]
 */
export function buildCharacterRefImagePrompt(rawPrompt, styleContext = {}) {
    const normalized = normalizeCharacterRefPrompt(rawPrompt, styleContext);
    const body = flattenSectionedPrompt(normalized, CHARACTER_REF_PROMPT_SECTIONS);
    const hasStyleRefs = characterRefStyleRefUrls(styleContext).length > 0;
    const styleRules = hasStyleRefs
        ? `\n\nSTYLE REFERENCE IMAGES:\n${CHARACTER_REF_STYLE_IMAGE_RULES.map((rule) => `- ${rule}`).join('\n')}`
        : '';
    const rules = CHARACTER_REF_IMAGE_NEGATIVE_RULES.map((rule) => `- ${rule}`).join('\n');
    return `${body}${styleRules}\n\nCONSTRAINTS:\n${rules}`;
}

/** @param {{ settings?: object, templateDefaults?: object, characterRefStyle?: string, characterRefStyleRefs?: string[] }} ctx */
export function buildCharacterStyleContext(ctx = {}) {
    const base = buildEnvironmentStyleContext(ctx);
    const characterRefStyle = String(
        ctx.characterRefStyle ?? ctx.settings?.characterRefStyle ?? '',
    ).trim();
    const characterRefStyleRefs = Array.isArray(ctx.characterRefStyleRefs)
        ? ctx.characterRefStyleRefs
        : (Array.isArray(ctx.settings?.characterRefStyleRefs) ? ctx.settings.characterRefStyleRefs : []);
    return {
        ...base,
        characterRefStyle,
        characterRefStyleRefs,
    };
}
