/**
 * JSON schemas for Gemini storyboard — outline + per-scene calls.
 */

const stringArray = {
    type: 'array',
    items: { type: 'string' },
};

const cameraItem = {
    type: 'object',
    properties: {
        action: { type: 'string' },
        target: { type: 'string' },
        speed: { type: 'string' },
    },
    required: ['action', 'target'],
};

export const sceneBlockSchema = {
    type: 'object',
    properties: {
        style: {
            type: 'object',
            properties: {
                visualStyle: { type: 'string' },
                renderQuality: { type: 'string' },
            },
        },
        character: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                description: { type: 'string' },
            },
            required: ['name', 'description'],
        },
        scene: {
            type: 'object',
            properties: {
                shot: { type: 'string' },
                location: { type: 'string' },
                time: { type: 'string' },
                props: stringArray,
                pose: { type: 'string' },
                description: { type: 'string' },
            },
            required: ['description'],
        },
        emotion: {
            type: 'object',
            properties: {
                description: { type: 'string' },
                tags: stringArray,
            },
        },
        camera: { type: 'array', items: cameraItem },
        lighting: {
            type: 'object',
            properties: {
                type: { type: 'string' },
                time: { type: 'string' },
                quality: { type: 'string' },
                description: { type: 'string' },
            },
        },
        environment: {
            type: 'object',
            properties: {
                description: { type: 'string' },
                details: stringArray,
            },
        },
        mood: {
            type: 'object',
            properties: {
                description: { type: 'string' },
                tags: stringArray,
            },
        },
        audio: {
            type: 'object',
            properties: {
                speaker: { type: 'string' },
                text: { type: 'string' },
                voiceEmotion: { type: 'string' },
            },
        },
        asmr: stringArray,
        bgm: {
            type: 'object',
            properties: {
                genre: { type: 'string' },
                mood: { type: 'string' },
                description: { type: 'string' },
            },
        },
        rules: stringArray,
    },
    required: ['scene', 'character'],
};

const characterOutlineItem = {
    type: 'object',
    properties: {
        name: { type: 'string' },
        description: {
            type: 'string',
            description: 'Age, gender, hair, eyes, outfit — consistent visual design',
        },
        role: { type: 'string', description: 'protagonist, supporting, antagonist, etc.' },
    },
    required: ['name', 'description'],
};

const sceneOutlineItem = {
    type: 'object',
    properties: {
        index: { type: 'integer' },
        label: { type: 'string' },
        durationSec: { type: 'integer' },
        beat: { type: 'string', description: 'Short beat / narrative purpose for this scene' },
        location: { type: 'string', description: 'Where this scene takes place' },
    },
    required: ['index', 'label', 'durationSec', 'beat', 'location'],
};

/** Phase 1: analyze script flow + scene outline. */
export const GEMINI_STORYBOARD_OUTLINE_SCHEMA = {
    type: 'object',
    properties: {
        title: { type: 'string' },
        summary: { type: 'string' },
        narrativeFlow: { type: 'string', description: 'How the story flows scene to scene' },
        characterBible: { type: 'string' },
        characters: {
            type: 'array',
            description: 'Main visible characters — max 4; empty array if narrator-only / no on-screen characters',
            items: characterOutlineItem,
        },
        scenes: {
            type: 'array',
            items: sceneOutlineItem,
        },
    },
    required: ['title', 'summary', 'narrativeFlow', 'characterBible', 'characters', 'scenes'],
};

/** Phase 2: enrich up to 3 scenes — environment prompt for consistent shot generation. */
export const GEMINI_STORYBOARD_SCENE_BATCH_SCHEMA = {
    type: 'object',
    properties: {
        scenes: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    index: { type: 'integer' },
                    environmentPrompt: {
                        type: 'string',
                        description: 'Structured English environment prompt: STYLE, SCENE TYPE, ENVIRONMENT, TIME, WEATHER, LIGHTING, OBJECTS, ATMOSPHERE, CAMERA, QUALITY — no people or animals',
                    },
                    shotCount: {
                        type: 'integer',
                        description: 'Number of shots for this scene — AI decides between 1 and 6',
                    },
                },
                required: ['index', 'environmentPrompt', 'shotCount'],
            },
        },
    },
    required: ['scenes'],
};

const shotItemSchema = {
    type: 'object',
    properties: {
        index: { type: 'integer' },
        label: { type: 'string' },
        durationSec: { type: 'integer' },
        imagePrompt: {
            type: 'string',
            description: 'Structured English first-frame prompt — use provided character ref + environment/scene background ref; STYLE, CHARACTER (pose/expression from refs), ENVIRONMENT/LIGHTING/COMPOSITION/QUALITY fixed — no text or speech bubbles',
        },
        blocks: sceneBlockSchema,
    },
    required: ['index', 'label', 'durationSec', 'imagePrompt', 'blocks'],
};

/** Phase 3: all shots for one scene. */
export const GEMINI_STORYBOARD_SCENE_SHOTS_SCHEMA = {
    type: 'object',
    properties: {
        shots: {
            type: 'array',
            items: shotItemSchema,
        },
    },
    required: ['shots'],
};

/** @deprecated Legacy single-scene schema — kept for migration reference. */
export const GEMINI_STORYBOARD_SINGLE_SCENE_SCHEMA = {
    type: 'object',
    properties: {
        blocks: sceneBlockSchema,
    },
    required: ['blocks'],
};

const characterRefItemSchema = {
    type: 'object',
    properties: {
        characterName: { type: 'string' },
        imagePrompt: {
            type: 'string',
            description: 'Structured English prompt: STYLE (fixed), CHARACTER (appearance details), POSE/BACKGROUND/CAMERA/LIGHTING/QUALITY (fixed) — ONE character only, full body, white background',
        },
    },
    required: ['characterName', 'imagePrompt'],
};

/** Character reference prompts when user has no upload — one entry per character. */
export const GEMINI_CHARACTER_REF_PROMPT_SCHEMA = {
    type: 'object',
    properties: {
        characters: {
            type: 'array',
            items: characterRefItemSchema,
        },
    },
    required: ['characters'],
};
