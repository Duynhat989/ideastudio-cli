/**
 * JSON schemas for Gemini storyboard — outline + per-scene calls.
 * Image prompts are structured JSON objects (not plain text sections).
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

const styleBlockSchema = {
    type: 'object',
    properties: {
        preset: { type: 'string', description: 'Must match project stylePreset exactly' },
        visualStyle: { type: 'string', description: 'Full visual style description — must match project style, NOT generic anime unless preset is anime' },
        renderQuality: { type: 'string' },
        useStyleRefs: { type: 'boolean' },
    },
    required: ['visualStyle'],
};

export const environmentPromptJsonSchema = {
    type: 'object',
    description: 'JSON environment/background plate prompt — no people or animals',
    properties: {
        type: { type: 'string', enum: ['environment_image'] },
        style: styleBlockSchema,
        scene: {
            type: 'object',
            properties: {
                sceneType: { type: 'string' },
                location: { type: 'string', description: 'Specific place name' },
                description: { type: 'string', description: 'Architecture, terrain, layout — empty scene, no living subjects' },
                time: { type: 'string' },
                weather: { type: 'string' },
                objects: { type: 'array', items: { type: 'string' }, description: 'Static props only' },
                atmosphere: { type: 'string' },
            },
            required: ['location', 'description', 'time', 'weather', 'objects', 'atmosphere'],
        },
        lighting: { type: 'string' },
    },
    required: ['type', 'style', 'scene', 'lighting'],
};

export const shotFramePromptJsonSchema = {
    type: 'object',
    description: 'JSON first-frame image prompt — uses environment + character reference images',
    properties: {
        type: { type: 'string', enum: ['shot_first_frame'] },
        style: styleBlockSchema,
        references: {
            type: 'object',
            properties: {
                useEnvironmentImage: { type: 'boolean' },
                useCharacterRefs: { type: 'boolean' },
            },
        },
        character: {
            type: 'object',
            properties: {
                name: { type: 'string', description: 'Character name — appearance from refs, only describe pose/expression/position' },
                pose: { type: 'string' },
                expression: { type: 'string' },
                position: { type: 'string', description: 'Where in frame' },
                action: { type: 'string' },
                interaction: { type: 'string' },
            },
            required: ['name', 'pose', 'expression', 'position', 'action'],
        },
        framing: {
            type: 'object',
            description: 'Aspect ratio and character-environment harmony',
            properties: {
                aspectRatio: { type: 'string', description: 'Project aspect ratio e.g. 9:16, 16:9' },
                orientation: { type: 'string' },
                characterScale: { type: 'string', description: 'Character size relative to environment' },
                cameraAdaptation: { type: 'string', description: 'How to adjust camera for best frame' },
                harmonyNotes: { type: 'array', items: { type: 'string' } },
            },
        },
        composition: { type: 'string', description: 'Character-environment composition and visual balance' },
        camera: { type: 'string', description: 'Shot angle, distance and framing optimized for aspect ratio' },
    },
    required: ['type', 'style', 'character', 'camera', 'composition', 'framing'],
};

export const characterRefPromptJsonSchema = {
    type: 'object',
    description: 'JSON character reference sheet prompt — ONE character, white background',
    properties: {
        type: { type: 'string', enum: ['character_reference'] },
        style: styleBlockSchema,
        character: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'string' },
                gender: { type: 'string' },
                hair: { type: 'string' },
                eyes: { type: 'string' },
                skinTone: { type: 'string' },
                outfit: { type: 'string' },
                accessories: { type: 'string' },
                distinguishingFeatures: { type: 'string' },
            },
            required: ['name', 'age', 'gender', 'hair', 'eyes', 'skinTone', 'outfit'],
        },
    },
    required: ['type', 'style', 'character'],
};

export const sceneBlockSchema = {
    type: 'object',
    properties: {
        style: {
            type: 'object',
            properties: {
                preset: { type: 'string', description: 'Must match project stylePreset' },
                visualStyle: { type: 'string', description: 'Must match project visual style — do NOT default to anime' },
                renderQuality: { type: 'string' },
            },
            required: ['visualStyle'],
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
    required: ['style', 'scene', 'character'],
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

/** Phase 2: enrich up to 3 scenes — environment JSON prompt. */
export const GEMINI_STORYBOARD_SCENE_BATCH_SCHEMA = {
    type: 'object',
    properties: {
        scenes: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    index: { type: 'integer' },
                    environmentPrompt: environmentPromptJsonSchema,
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
        imagePrompt: shotFramePromptJsonSchema,
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
        imagePrompt: characterRefPromptJsonSchema,
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
