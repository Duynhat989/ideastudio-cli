/**
 * Schemas for Gemini `generationConfig.responseSchema` (JSON Schema subset).
 * @see https://ai.google.dev/gemini-api/docs/json-mode
 */

const flowNodePosition = {
    type: 'object',
    properties: {
        x: { type: 'number' },
        y: { type: 'number' },
    },
    required: ['x', 'y'],
};

/** Optional node payload; app merges with defaults per node type. */
const flowNodeData = {
    type: 'object',
    properties: {
        name: {
            type: 'string',
            description:
                'For imageInput: REQUIRED short Vietnamese label describing what image to upload (e.g. Ảnh sản phẩm mặt trước). Empty for other types.',
        },
        prompt: { type: 'string' },
        keyword: { type: 'string' },
        segmentLabel: {
            type: 'string',
            description: 'For videoGen: segment hint, e.g. "Clip 2/4 · khoảng 8–16s"',
        },
        clipDurationSec: {
            type: 'integer',
            description: 'For videoGen: seconds per generated clip; always use 8',
        },
    },
};

const flowNodeItem = {
    type: 'object',
    properties: {
        type: {
            type: 'string',
            description:
                'One of: start, imageInput, videoInput, imageGen, videoGen, textInput, aiCall, source, videoPreview. Do NOT use klingMotion.',
        },
        position: flowNodePosition,
        data: flowNodeData,
    },
    required: ['type', 'position'],
};

const flowEdgeItem = {
    type: 'object',
    properties: {
        from: { type: 'integer', description: 'Source node index in nodes array (0-based)' },
        to: { type: 'integer', description: 'Target node index in nodes array (0-based)' },
        targetHandle: {
            type: 'string',
            description: 'Optional Vue Flow target handle id, e.g. in-start / in-end for videoGen frame.',
        },
        sourceHandle: { type: 'string', description: 'Optional source handle id.' },
    },
    required: ['from', 'to'],
};

/** Refined script — one string field so newlines stay valid inside JSON. */
export const GEMINI_REFINE_SCRIPT_SCHEMA = {
    type: 'object',
    properties: {
        response: {
            type: 'string',
            description: 'Full refined production script in Vietnamese.',
        },
    },
    required: ['response'],
};

/** Full flow graph. */
export const GEMINI_FLOW_GRAPH_SCHEMA = {
    type: 'object',
    properties: {
        scriptSummary: {
            type: 'string',
            description: 'One-line Vietnamese summary of the flow',
        },
        nodes: {
            type: 'array',
            items: flowNodeItem,
            description: 'Ordered list of nodes; must include at least one type "start"',
        },
        edges: {
            type: 'array',
            items: flowEdgeItem,
            description: 'Directed edges by node index',
        },
    },
    required: ['scriptSummary', 'nodes', 'edges'],
};

/** Phase 1: lightweight plan/frame to avoid long JSON outputs. */
export const GEMINI_FLOW_FRAME_SCHEMA = {
    type: 'object',
    properties: {
        scriptSummary: { type: 'string' },
        totalVideoClips: {
            type: 'integer',
            description: 'Number of 8-second clips to generate (1..12).',
        },
        originalImageNames: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 8,
            description:
                'Vietnamese labels for each separate image upload slot, in order (e.g. hero product, logo, reference). Count MUST match K from the user/system request in the same phase-1 prompt.',
        },
        clipLabels: {
            type: 'array',
            items: { type: 'string' },
            description: 'Vietnamese labels for each clip in order, length should match totalVideoClips.',
        },
        generateEndingKeyframe: {
            type: 'boolean',
            description:
                'True if the script needs a separate final still (closing/packshot) so the LAST video clip interpolates start→that still. False if the last clip should use only one start image (no end frame).',
        },
        endingImageGenPrompt: {
            type: 'string',
            description:
                'When generateEndingKeyframe is true: Vietnamese prompt for that ending keyframe image; keep product identity consistent.',
        },
    },
    required: ['scriptSummary', 'totalVideoClips', 'originalImageNames', 'clipLabels'],
};

/** Phase 2: batch generation for clip prompts (short output per request). */
export const GEMINI_FLOW_CLIP_BATCH_SCHEMA = {
    type: 'object',
    properties: {
        clips: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    index: { type: 'integer' },
                    segmentLabel: { type: 'string' },
                    imageGenPrompt: { type: 'string' },
                    videoGenPrompt: { type: 'string' },
                },
                required: ['index', 'segmentLabel', 'imageGenPrompt', 'videoGenPrompt'],
            },
        },
    },
    required: ['clips'],
};
