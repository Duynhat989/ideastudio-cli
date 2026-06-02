/**
 * Sinh graph nodes/edges từ cấu trúc AI flow đã cấu hình.
 */

import {
    BUILDER_TYPES,
    interpolatePromptLines,
} from './aiFlowNodeStructures.js';
import {
    GEMINI_FLOW_FRAME_SCHEMA,
    GEMINI_FLOW_CLIP_BATCH_SCHEMA,
    GEMINI_FLOW_GRAPH_SCHEMA,
} from './geminiFlowSchemas.js';

const clampInt = (v, min, max, fallback) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
};

const clampText = (v, max) => String(v || '').trim().slice(0, max);

const resolveOriginalImageLabels = (frame, k) => {
    const fallback = (i) => `Ảnh đầu vào ${i + 1}`;
    const arr = Array.isArray(frame?.originalImageNames) ? frame.originalImageNames : [];
    const legacyOne =
        typeof frame?.originalImageName === 'string' && String(frame.originalImageName).trim()
            ? clampText(frame.originalImageName, 90)
            : '';
    const rows = [];
    for (let i = 0; i < k; i += 1) {
        let s = clampText(arr[i], 90);
        if (!s && legacyOne) s = legacyOne;
        rows.push(s || fallback(i));
    }
    return rows;
};

/**
 * @param {object} params
 * @param {import('./aiFlowNodeStructures.js').AiFlowNodeStructure} params.structure
 * @param {string} params.script
 * @param {number} params.imageInputCount
 * @param {(prompt: string, opts: object) => Promise<object>} params.callGeminiStructured
 * @param {(prompt: string) => string} params.sanitizeVideoPromptForSafety
 */
export async function buildPhasedClipGraph({
    structure,
    script,
    imageInputCount,
    callGeminiStructured,
    sanitizeVideoPromptForSafety,
}) {
    const clipSeconds = clampInt(structure?.clipSeconds, 1, 60, 8);
    const maxClips = clampInt(structure?.maxClips, 1, 24, 12);
    const batchSize = clampInt(structure?.batchSize, 1, 6, 3);
    const k = clampInt(imageInputCount, 1, structure?.maxImageInputs || 8, 1);

    const phase1Prompt = interpolatePromptLines(structure.phase1PromptLines, {
        script,
        imageInputCount: k,
        clipSeconds,
    });
    const frame = await callGeminiStructured(phase1Prompt, {
        responseSchema: GEMINI_FLOW_FRAME_SCHEMA,
        maxOutputTokens: 700,
    });

    const clipCount = clampInt(frame?.totalVideoClips, 1, maxClips, 3);
    const rawLabels = Array.isArray(frame?.clipLabels) ? frame.clipLabels : [];
    const clipLabels = Array.from({ length: clipCount }, (_, i) => {
        const fallback = `Clip ${i + 1}/${clipCount}`;
        const text = clampText(rawLabels[i], 70);
        return text || fallback;
    });
    const originalImageLabels = resolveOriginalImageLabels(frame, k);
    const scriptSummary = clampText(frame?.scriptSummary, 220) || 'Flow quảng cáo sản phẩm theo kịch bản đã chốt.';
    const generateEndingKeyframe = frame?.generateEndingKeyframe === true;
    const endingImageGenPrompt = clampText(frame?.endingImageGenPrompt, 320) || '';

    const clipPromptItems = [];
    for (let start = 0; start < clipCount; start += batchSize) {
        const end = Math.min(clipCount, start + batchSize);
        const batch = clipLabels.slice(start, end).map((label, i) => ({
            index: start + i + 1,
            label,
        }));
        const phase2Prompt = interpolatePromptLines(structure.phase2PromptLines, {
            script,
            scriptSummary,
            imageInputCount: k,
            clipSeconds,
            batchJson: JSON.stringify({ totalClips: clipCount, items: batch }),
        });
        const batchResult = await callGeminiStructured(phase2Prompt, {
            responseSchema: GEMINI_FLOW_CLIP_BATCH_SCHEMA,
            maxOutputTokens: 900,
        });
        const rows = Array.isArray(batchResult?.clips) ? batchResult.clips : [];
        rows.forEach((row, rowIdx) => {
            const index = clampInt(row?.index, 1, clipCount, start + rowIdx + 1);
            clipPromptItems.push({
                index,
                segmentLabel: clampText(row?.segmentLabel, 70) || `Clip ${index}/${clipCount}`,
                imageGenPrompt:
                    clampText(row?.imageGenPrompt, 320) ||
                    `Tạo keyframe cảnh ${index}/${clipCount}, nêu rõ sản phẩm và bối cảnh để giữ đồng nhất nhận diện.`,
                videoGenPrompt: sanitizeVideoPromptForSafety(
                    clampText(row?.videoGenPrompt, 320) ||
                        `Tạo video cảnh ${index}/${clipCount} từ ảnh keyframe tương ứng, nêu rõ góc máy/chuyển động/ánh sáng và hành động chính.`,
                ),
            });
        });
    }

    const clipByIndex = new Map();
    clipPromptItems.forEach((item) => {
        if (!clipByIndex.has(item.index)) clipByIndex.set(item.index, item);
    });
    const normalizedClips = Array.from({ length: clipCount }, (_, i) => {
        const idx = i + 1;
        const existing = clipByIndex.get(idx);
        return (
            existing || {
                index: idx,
                segmentLabel: `Clip ${idx}/${clipCount}`,
                imageGenPrompt: `Tạo keyframe cảnh ${idx}/${clipCount}, giữ sản phẩm nhất quán với ảnh gốc.`,
                videoGenPrompt: sanitizeVideoPromptForSafety(
                    `Tạo video cảnh ${idx}/${clipCount}, bám theo keyframe cùng index, chuyển động tự nhiên.`,
                ),
            }
        );
    });

    const rowGap = 230;
    const inputSlotGap = 116;
    const xStart = 40;
    const xImageInput = 360;
    const xImageGen = 700;
    const xVideoGen = 1040;
    const xPreview = 1380;

    const endingIgNode = generateEndingKeyframe
        ? {
              type: 'imageGen',
              position: { x: xImageGen, y: 60 + clipCount * rowGap },
              data: {
                  prompt:
                      endingImageGenPrompt ||
                      'Keyframe / packshot kết thúc, giữ nhất quán sản phẩm với ảnh tham chiếu, ánh sáng gọn gàng.',
              },
          }
        : null;

    const nodesOut = [
        { type: 'start', position: { x: xStart, y: 60 } },
        ...originalImageLabels.map((name, j) => ({
            type: 'imageInput',
            position: { x: xImageInput, y: 60 + j * inputSlotGap },
            data: { name },
        })),
        ...normalizedClips.map((clip, i) => ({
            type: 'imageGen',
            position: { x: xImageGen, y: 60 + i * rowGap },
            data: { prompt: clip.imageGenPrompt },
        })),
        ...(endingIgNode ? [endingIgNode] : []),
        ...normalizedClips.map((clip, i) => ({
            type: 'videoGen',
            position: { x: xVideoGen, y: 60 + i * rowGap },
            data: {
                prompt: clip.videoGenPrompt,
                segmentLabel: clip.segmentLabel,
                clipDurationSec: clipSeconds,
            },
        })),
        {
            type: 'videoPreview',
            position: { x: xPreview, y: 90 + Math.floor((Math.max(1, clipCount) - 1) * rowGap * 0.5) },
        },
    ];

    const imageGenStart = 1 + k;
    const extraEndingIg = endingIgNode ? 1 : 0;
    const videoGenStart = imageGenStart + clipCount + extraEndingIg;
    const previewIndex = videoGenStart + clipCount;
    const edgesOut = [];

    for (let j = 1; j <= k; j += 1) {
        edgesOut.push({ from: 0, to: j });
    }
    for (let i = 0; i < clipCount; i += 1) {
        const sceneImageGenIdx = imageGenStart + i;
        const videoGenIdx = videoGenStart + i;
        edgesOut.push({ from: 0, to: sceneImageGenIdx });
        for (let j = 1; j <= k; j += 1) {
            edgesOut.push({ from: j, to: sceneImageGenIdx });
        }
        edgesOut.push({ from: sceneImageGenIdx, to: videoGenIdx, targetHandle: 'in-start' });
        if (i < clipCount - 1) {
            const nextSceneIg = imageGenStart + i + 1;
            edgesOut.push({ from: nextSceneIg, to: videoGenIdx, targetHandle: 'in-end' });
        } else if (endingIgNode) {
            const endIgIdx = imageGenStart + clipCount;
            edgesOut.push({ from: endIgIdx, to: videoGenIdx, targetHandle: 'in-end' });
        }
        edgesOut.push({ from: videoGenIdx, to: previewIndex });
    }
    if (endingIgNode) {
        const endIgIdx = imageGenStart + clipCount;
        edgesOut.push({ from: 0, to: endIgIdx });
        for (let j = 1; j <= k; j += 1) {
            edgesOut.push({ from: j, to: endIgIdx });
        }
    }

    return {
        scriptSummary,
        nodes: nodesOut,
        edges: edgesOut,
    };
}

/**
 * @param {object} params
 */
export async function buildFullGraphFromStructure({
    structure,
    script,
    callGeminiStructured,
}) {
    const clipSeconds = clampInt(structure?.clipSeconds, 1, 60, 8);
    const buildPrompt = interpolatePromptLines(structure.buildPromptLines, {
        script,
        clipSeconds,
    });
    const graph = await callGeminiStructured(buildPrompt, {
        responseSchema: GEMINI_FLOW_GRAPH_SCHEMA,
        maxOutputTokens: 4096,
    });
    if (!graph?.nodes?.length) {
        throw new Error('Model không trả về nodes hợp lệ.');
    }
    return graph;
}

/**
 * @param {object} params
 */
export async function buildGraphFromStructure(params) {
    const { structure } = params;
    if (structure?.builder === BUILDER_TYPES.FULL_GRAPH) {
        return buildFullGraphFromStructure(params);
    }
    return buildPhasedClipGraph(params);
}
