/**
 * Cấu hình các « cấu trúc sinh node » cho chat AI (Tạo node).
 * Lưu trong localStorage; preset đầu tiên = pipeline quảng cáo hiện tại.
 */

export const AI_FLOW_STRUCTURES_STORAGE = 'ai_flow_node_structures';
export const AI_FLOW_ACTIVE_STRUCTURE_KEY = 'ai_flow_active_structure_id';

export const BUILDER_TYPES = {
    PHASED_CLIPS: 'phased-clips',
    FULL_GRAPH: 'full-graph',
};

const DEFAULT_CHAT_LINES = [
    'Bạn là biên kịch / producer, đang chat với người dùng để cùng phát triển và chỉnh sửa ý tưởng cho pipeline sáng tạo (workflow: ảnh → video, không Kling Motion).',
    'Trả lời súc tích, thực tế bằng tiếng Việt; có thể hỏi lại, gợi ý chỉnh kịch, thứ tự bước, thời lượng (mỗi Video Gen ~{{clipSeconds}}s), tên từng ảnh input…',
    'BẮT BUỘC phản ánh thứ tự: ảnh sản phẩm/đầu vào → Image Gen nếu cần → Video Gen; layout node trên canvas không đè nhau.',
    'Mỗi clip video trong pipeline ≈ {{clipSeconds}} giây khi tính số node.',
    '{{imageNote}}',
    'Trả về văn bản thuần tiếng Việt, không markdown code block, không JSON.',
    '\n--- Hội thoại trước ---\n',
    '{{transcript}}',
    '\n--- User vừa nhắn ---\n',
    '{{userMessage}}',
];

const DEFAULT_PHASE1_LINES = [
    'Bạn là kỹ sư workflow video ads.',
    'PHASE 1 (khung): trả object gồm scriptSummary, totalVideoClips, originalImageNames (MẢNG), clipLabels, và tùy chọn generateEndingKeyframe + endingImageGenPrompt.',
    'Số ô upload ảnh trên canvas (imageInput nodes) được user chọn: K = {{imageInputCount}}.',
    'Trả originalImageNames là mảng tiếng Việt có ĐÚNG {{imageInputCount}} phần tử — mỗi phần tử là một dòng NHÃN NGẮN mô tả vai trò từng ảnh (ví dụ: hero sản phẩm chính, góc hộp, logo thương hiệu, moodboard/lighting…) phù hợp kịch bản, không ghép một nhãn chung.',
    'Mỗi clip video dài khoảng {{clipSeconds}} giây. Nếu script có thời lượng tổng T giây thì totalVideoClips = ceil(T/{{clipSeconds}}).',
    'Ràng buộc nghiệp vụ bắt buộc: các ảnh đầu vào (imageInput) là tham chiếu cho các bước imageGen và videoGen. Không dùng klingMotion.',
    'Chuỗi keyframe liền mạch: clip i dùng ảnh cảnh i làm khung ĐẦU và ảnh cảnh i+1 làm khung CUỐI (nối tiếp). Clip cuối chỉ cần một ảnh đầu trừ khi kịch bản yêu cầu rõ frame/packshot kết thúc.',
    'generateEndingKeyframe = true CHỈ khi user/kịch bản cần ảnh kết thúc riêng (đóng clip cuối từ keyframe cảnh cuối → ảnh đóng); kèm endingImageGenPrompt tiếng Việt. Ngược lại để false (mặc định) — clip cuối chỉ một ảnh start.',
    'clipLabels cần đúng thứ tự câu chuyện, ngắn, tiếng Việt.',
    '\n--- Kịch bản đã chốt ---\n',
    '{{script}}',
];

const DEFAULT_PHASE2_LINES = [
    'Bạn đang PHASE 2: sinh prompt cho MỘT NHÓM clip nhỏ.',
    'Trả về danh sách clips theo schema: index, segmentLabel, imageGenPrompt, videoGenPrompt.',
    'Luôn giữ luồng: {{imageInputCount}} ảnh tham chiếu (upload) có thể dùng khi sinh prompt cảnh; imageGen cảnh -> videoGen cảnh.',
    'videoGenPrompt phải mô tả cảnh động cụ thể và kế thừa nhận diện sản phẩm từ imageGenPrompt cùng index, dùng ngôn ngữ trung tính, lịch sự, phù hợp quảng cáo sản phẩm.',
    'Nếu videoGenPrompt có người, BẮT BUỘC ghi rõ là người trưởng thành và nêu tuổi cụ thể (ví dụ: "An adult woman (age 25)..."). Không mô tả trẻ vị thành niên.',
    'Mỗi clip ~{{clipSeconds}}s, segmentLabel dạng "Clip i/N · mốc thời gian".',
    'Không markdown, không text ngoài schema.',
    '\n--- Script ---\n',
    '{{script}}',
    '\n--- Tóm tắt ---\n',
    '{{scriptSummary}}',
    '\n--- Batch cần sinh ---\n',
    '{{batchJson}}',
];

const FULL_GRAPH_CHAT_LINES = [
    'Bạn là biên kịch workflow video, chat để chốt ý tưởng flow trên canvas Vue Flow.',
    'Gợi ý các loại node: start, imageInput, imageGen, videoGen, textInput, aiCall, source, videoPreview. Không dùng klingMotion.',
    'Trả lời tiếng Việt, súc tích; có thể hỏi lại về số cảnh, thời lượng (~{{clipSeconds}}s/clip), prompt từng bước.',
    '{{imageNote}}',
    'Trả về văn bản thuần, không JSON.',
    '\n--- Hội thoại trước ---\n',
    '{{transcript}}',
    '\n--- User vừa nhắn ---\n',
    '{{userMessage}}',
];

const FULL_GRAPH_BUILD_LINES = [
    'Thiết kế workflow Vue Flow đầy đủ (nodes + edges) từ kịch bản đã chốt.',
    'Bắt buộc có node type "start". Có thể dùng imageInput, imageGen, videoGen, textInput, aiCall, source, videoPreview.',
    'Không dùng klingMotion. Mỗi videoGen ~{{clipSeconds}} giây.',
    'imageInput.data.name = nhãn tiếng Việt ngắn mô tả ảnh cần upload.',
    'edges dùng chỉ số from/to (0-based) trong mảng nodes; videoGen frame mode: targetHandle in-start / in-end khi cần.',
    'Bố trí position không đè node (tăng x/y hợp lý).',
    '\n--- Kịch bản ---\n',
    '{{script}}',
];

/** Preset mặc định (builtin, không xóa được). */
export const BUILTIN_STRUCTURES = [
    {
        id: 'default-ad-pipeline',
        name: 'Quảng cáo sản phẩm (ảnh → video)',
        description:
            'Pipeline mặc định: nhiều clip 8s, imageInput → imageGen → videoGen, keyframe nối tiếp. Sinh node qua 2 phase Gemini.',
        isBuiltin: true,
        builder: BUILDER_TYPES.PHASED_CLIPS,
        clipSeconds: 8,
        maxClips: 12,
        maxImageInputs: 8,
        batchSize: 3,
        chatPromptLines: [...DEFAULT_CHAT_LINES],
        phase1PromptLines: [...DEFAULT_PHASE1_LINES],
        phase2PromptLines: [...DEFAULT_PHASE2_LINES],
        buildPromptLines: [],
    },
    {
        id: 'full-graph-once',
        name: 'Flow graph một lần (JSON)',
        description: 'Gemini trả về toàn bộ nodes + edges trong một lần gọi structured JSON.',
        isBuiltin: true,
        builder: BUILDER_TYPES.FULL_GRAPH,
        clipSeconds: 8,
        maxClips: 12,
        maxImageInputs: 8,
        batchSize: 3,
        chatPromptLines: [...FULL_GRAPH_CHAT_LINES],
        phase1PromptLines: [],
        phase2PromptLines: [],
        buildPromptLines: [...FULL_GRAPH_BUILD_LINES],
    },
];

const cloneStructure = (s) => JSON.parse(JSON.stringify(s));

const mergeWithBuiltin = (saved) => {
    const byId = new Map(BUILTIN_STRUCTURES.map((b) => [b.id, cloneStructure(b)]));
    for (const row of saved || []) {
        if (!row?.id) continue;
        const builtin = byId.get(row.id);
        if (builtin) {
            byId.set(row.id, { ...builtin, ...row, isBuiltin: true });
        } else {
            byId.set(row.id, { ...row, isBuiltin: false });
        }
    }
    const custom = (saved || []).filter((r) => r?.id && !BUILTIN_STRUCTURES.some((b) => b.id === r.id));
    return [...BUILTIN_STRUCTURES.map((b) => byId.get(b.id) || cloneStructure(b)), ...custom.map(cloneStructure)];
};

export const interpolatePromptLines = (lines, vars = {}) => {
    const text = Array.isArray(lines) ? lines.join('\n') : String(lines || '');
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        const v = vars[key];
        return v == null ? '' : String(v);
    });
};

export const loadAiFlowStructures = () => {
    try {
        const raw = localStorage.getItem(AI_FLOW_STRUCTURES_STORAGE);
        const parsed = raw ? JSON.parse(raw) : [];
        return mergeWithBuiltin(Array.isArray(parsed) ? parsed : []);
    } catch {
        return BUILTIN_STRUCTURES.map(cloneStructure);
    }
};

export const saveAiFlowStructures = (structures) => {
    const customOnly = (structures || [])
        .filter((s) => s?.id && !BUILTIN_STRUCTURES.some((b) => b.id === s.id))
        .map(cloneStructure);
    const builtinOverrides = (structures || [])
        .filter((s) => s?.id && BUILTIN_STRUCTURES.some((b) => b.id === s.id))
        .map((s) => {
            const { isBuiltin: _ib, ...rest } = cloneStructure(s);
            return rest;
        });
    localStorage.setItem(AI_FLOW_STRUCTURES_STORAGE, JSON.stringify([...builtinOverrides, ...customOnly]));
};

export const getActiveStructureId = () => {
    const id = localStorage.getItem(AI_FLOW_ACTIVE_STRUCTURE_KEY);
    if (id && loadAiFlowStructures().some((s) => s.id === id)) return id;
    return BUILTIN_STRUCTURES[0].id;
};

export const setActiveStructureId = (id) => {
    localStorage.setItem(AI_FLOW_ACTIVE_STRUCTURE_KEY, String(id || BUILTIN_STRUCTURES[0].id));
};

export const getActiveStructure = () => {
    const id = getActiveStructureId();
    return loadAiFlowStructures().find((s) => s.id === id) || cloneStructure(BUILTIN_STRUCTURES[0]);
};

export const getStructureById = (id) => loadAiFlowStructures().find((s) => s.id === id) || null;

export const createEmptyStructure = () => ({
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: 'Cấu trúc mới',
    description: '',
    isBuiltin: false,
    builder: BUILDER_TYPES.PHASED_CLIPS,
    clipSeconds: 8,
    maxClips: 12,
    maxImageInputs: 8,
    batchSize: 3,
    chatPromptLines: [...DEFAULT_CHAT_LINES],
    phase1PromptLines: [...DEFAULT_PHASE1_LINES],
    phase2PromptLines: [...DEFAULT_PHASE2_LINES],
    buildPromptLines: [],
});

export const duplicateStructure = (source) => {
    const base = source || getActiveStructure();
    const copy = cloneStructure(base);
    copy.id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    copy.name = `${base.name || 'Cấu trúc'} (bản sao)`;
    copy.isBuiltin = false;
    return copy;
};
