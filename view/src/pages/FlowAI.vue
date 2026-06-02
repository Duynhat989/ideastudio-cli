<script setup>
import { ref, onMounted, onUnmounted, watch, markRaw, toRaw, provide, computed } from 'vue';
import { watchDebounced, useDebounceFn } from '@vueuse/core';
import { VueFlow, useVueFlow } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { projectService } from '@/services/project.service';
import {
    Plus,
    Wand2,
    Trash2,
    Zap,
    Play,
    Type,
    X,
    Maximize2,
    FolderOpen,
    Cpu,
    Loader2,
    Download,
    Upload,
    History,
    Clock,
    Repeat,
    Flag,
    Settings,
} from 'lucide-vue-next';

import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';

import StartNode from '@/components/StartNode.vue';
import ImageInputNode from '@/components/ImageInputNode.vue';
import VideoInputNode from '@/components/VideoInputNode.vue';
import ImageGenNode from '@/components/ImageGenNode.vue';
import VideoGenNode from '@/components/VideoGenNode.vue';
import VideoPreviewNode from '@/components/VideoPreviewNode.vue';
import KlingMotionNode from '@/components/KlingMotionNode.vue';
import SourceNode from '@/components/SourceNode.vue';
import TextInputNode from '@/components/TextInputNode.vue';
import AiCallNode from '@/components/AiCallNode.vue';
import LoopFlowNode from '@/components/LoopFlowNode.vue';
import LoopEndNode from '@/components/LoopEndNode.vue';
import AiFlowPromptPanel from '@/components/AiFlowPromptPanel.vue';
import AiFlowStructureSettingsPopup from '@/components/AiFlowStructureSettingsPopup.vue';
import FlowWorkflowSettingsPopup from '@/components/FlowWorkflowSettingsPopup.vue';
import ProjectModal from '@/components/ProjectModal.vue';
import ProjectManagerPage from '@/components/ProjectManagerPage.vue';
import RenderView from './RenderView.vue';
import { isLikelyFlowVideoUrl } from '@/utils/flowMedia.js';
import { cssAspectRatioFromProject } from '@/utils/flowProjectAspect.js';

import {
    generateNanoImage,
    generateNanoVideo,
    callGemini,
    callGeminiStreamText,
    callGeminiStructured,
    generateMotionVideo,
    getSettings,
    saveSettings,
    nanoImageResultUrl,
} from '@/services/nanoai';
import {
    videoModelsForTier,
    normalizeVideoModel,
    normalizeVideoTier,
    normalizeImageModel,
    normalizeWorkflowDefaults,
    DEFAULT_WORKFLOW_MODELS,
} from '@/services/flowApiV3.js';
import { notify } from '@/composables/useNotify.js';
import {
    getActiveStructure,
    interpolatePromptLines,
} from '@/services/aiFlowNodeStructures.js';
import { buildGraphFromStructure } from '@/services/aiFlowGraphBuilder.js';

const props = defineProps({
    openProjectManagerKey: {
        type: Number,
        default: 0
    }
});

// --- VUE FLOW COMPOSABLES ---
const {
    nodes,
    edges,
    addNodes,
    onConnect,
    addEdges,
    onNodesChange,
    onEdgesChange,
    removeNodes,
    findNode,
    findEdge,
    setNodes,
    setEdges,
    applyNodeChanges,
    applyEdgeChanges,
} = useVueFlow();

/** Outputs video — cannot connect as context into Image Gen / Video Gen (image refs only). */
const VIDEO_CONTEXT_SOURCE_TYPES = new Set(['videoInput', 'videoGen', 'klingMotion']);
const SOURCE_ALLOWED_INPUT_TYPES = new Set(['imageInput', 'imageGen', 'videoInput', 'videoGen', 'videoPreview', 'klingMotion']);

/** Drop edges from video sources into imageGen/videoGen (e.g. after import or legacy flows). */
function pruneIllegalImageVideoGenEdges() {
    const next = edges.value.filter((e) => {
        const target = findNode(e.target);
        const source = findNode(e.source);
        if (!target || !source) return true;
        if (target.type !== 'imageGen' && target.type !== 'videoGen') return true;
        return !VIDEO_CONTEXT_SOURCE_TYPES.has(source.type);
    });
    if (next.length !== edges.value.length) {
        setEdges(next);
        return true;
    }
    return false;
}

/** Nguồn có thể đổi thành URL trong Video Gen (frame | ingredient) */
const VIDEO_GEN_VISUAL_SOURCE_TYPES = new Set([
    'imageInput',
    'imageGen',
    'videoGen',
    'videoInput',
    'klingMotion',
    'videoPreview',
]);

function urlsFromVisualEdge(edge) {
    const src = findNode(edge.source);
    if (!src || !src.data) return [];
    if (['imageInput', 'imageGen', 'videoGen', 'videoInput', 'klingMotion'].includes(src.type)) {
        if (src.type === 'imageInput') return src.data.image ? [src.data.image] : [];
        if (src.type === 'videoInput') return src.data.video ? [src.data.video] : [];
        return src.data.result ? [src.data.result] : [];
    }
    if (src.type === 'videoPreview') {
        const list = Array.isArray(src.data.inputs) ? src.data.inputs.filter((v) => typeof v === 'string' && v) : [];
        return list;
    }
    return [];
}

/**
 * Frame mode: API cần [ảnh đầu, ảnh cuối]. Cổng in-start / in-end cố định thứ tự;
 * flow cũ (một cổng): thứ tự cạnh trong store thường ngược thứ tự nối — đảo khi đúng 2 ảnh.
 */
function orderedVideoGenFrameInputs(incomingEdges) {
    const visual = incomingEdges.filter((e) => urlsFromVisualEdge(e).length > 0);
    const hasExplicit = visual.some((e) => e.targetHandle === 'in-start' || e.targetHandle === 'in-end');
    const edgeList = edges.value;
    const sorted = [...visual].sort((a, b) => {
        const ra = a.targetHandle === 'in-start' ? 0 : a.targetHandle === 'in-end' ? 2 : 1;
        const rb = b.targetHandle === 'in-start' ? 0 : b.targetHandle === 'in-end' ? 2 : 1;
        if (ra !== rb) return ra - rb;
        return edgeList.findIndex((x) => x.id === a.id) - edgeList.findIndex((x) => x.id === b.id);
    });
    let urls = sorted.flatMap(urlsFromVisualEdge);
    if (!hasExplicit && urls.length === 2) {
        urls = [urls[1], urls[0]];
    }
    return urls;
}

// --- STATE ---
const currentProjectId = ref(localStorage.getItem('nano_last_project_id') || '');
const isProjectModalOpen = ref(false);
const isProjectManagerPageOpen = ref(false);
const isRenderViewOpen = ref(false);
const isAiCallModalOpen = ref(false);
const aiCallPrompt = ref('');
const aiCallResult = ref('');
const aiCallStatus = ref('idle');
const isAddMenuOpen = ref(false);
const isWorkflowSettingsOpen = ref(false);
const isAiFlowStructureSettingsOpen = ref(false);
const aiFlowPromptPanelRef = ref(null);
const aiFlowBusy = ref(false);
const aiFlowError = ref('');
const isLoaded = ref(false);
const fileInputRef = ref(null);

/** Skip recording history + auto-save while replacing graph (load / import / restore). */
const isHydratingFlow = ref(false);
const skipNextHistoryCapture = ref(false);

const MAX_FLOW_HISTORY = 36;
/** @type {import('vue').Ref<Array<{ id: string, at: number, snapshot: { nodes: unknown[], edges: unknown[] } }>>} */
const flowHistoryEntries = ref([]);
const historyPanelOpen = ref(false);
const lastAutoSaveAt = ref(null);
const autoSaveError = ref(null);

const autoSaveHint = computed(() => {
    if (autoSaveError.value) return `Auto-save error: ${autoSaveError.value}`;
    if (!lastAutoSaveAt.value) return 'Auto-save: idle';
    return `Auto-saved ${new Date(lastAutoSaveAt.value).toLocaleString()}`;
});

const formatHistoryTime = (ts) =>
    new Date(ts).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

// Image Modal State
const isImageModalOpen = ref(false);
const modalImageUrl = ref('');

const openImage = (url) => {
    if (!url) return;
    modalImageUrl.value = url;
    isImageModalOpen.value = true;
};
provide('openImage', openImage);

const loopFlowImageInputOptions = computed(() =>
    nodes.value
        .filter((n) => n.type === 'imageInput')
        .map((n) => ({
            id: n.id,
            label: (n.data?.name && String(n.data.name).trim()) || n.id,
        })),
);
const loopFlowVideoInputOptions = computed(() =>
    nodes.value
        .filter((n) => n.type === 'videoInput')
        .map((n) => ({
            id: n.id,
            label: (n.data?.name && String(n.data.name).trim()) || n.id,
        })),
);
provide('loopFlowImageInputOptions', loopFlowImageInputOptions);
provide('loopFlowVideoInputOptions', loopFlowVideoInputOptions);

const nodeTypes = {
    start: markRaw(StartNode),
    imageInput: markRaw(ImageInputNode),
    videoInput: markRaw(VideoInputNode),
    imageGen: markRaw(ImageGenNode),
    videoGen: markRaw(VideoGenNode),
    klingMotion: markRaw(KlingMotionNode),
    source: markRaw(SourceNode),
    videoPreview: markRaw(VideoPreviewNode),
    textInput: markRaw(TextInputNode),
    aiCall: markRaw(AiCallNode),
    loopFlow: markRaw(LoopFlowNode),
    loopEnd: markRaw(LoopEndNode),
};

const initialNodes = [
    {
        id: 'start-1',
        type: 'start',
        position: { x: 50, y: 100 },
        data: { status: 'idle' },
    },
    {
        id: 'input-1',
        type: 'imageInput',
        position: { x: 100, y: 300 },
        data: { image: null },
    },
    {
        id: 'video-input-1',
        type: 'videoInput',
        position: { x: 100, y: 460 },
        data: { video: null },
    },
];

const sourceAssets = computed(() => {
    const resources = [];
    nodes.value.filter((n) => n.type === 'source').forEach((n) => {
        (n.data?.inputs || []).forEach((item) => {
            if (typeof item === 'string' && item) resources.push(item);
        });
    });
    return Array.from(new Set(resources));
});

// --- CORE FUNCTIONS (API & STORAGE) ---
const projectOpenData = ref({});

/** Model mặc định cho node mới (Workflow Tools); đổi trên node không ảnh hưởng giá trị này. */
const workflowDefaults = ref({ ...DEFAULT_WORKFLOW_MODELS });

const flowVideoTier = computed(() => normalizeVideoTier(getSettings().videoTier));
const workflowVideoModelOptions = computed(() => videoModelsForTier(flowVideoTier.value));

provide('flowVideoTier', flowVideoTier);

const applyWorkflowDefaultsFromProject = (project) => {
    workflowDefaults.value = normalizeWorkflowDefaults(project?.workflowDefaults, flowVideoTier.value);
};

watch(flowVideoTier, (tier) => {
    const models = videoModelsForTier(tier);
    if (!models.some((m) => m.value === workflowDefaults.value.videoModel)) {
        workflowDefaults.value.videoModel = models[0]?.value || DEFAULT_WORKFLOW_MODELS.videoModel;
    }
});

/** Tỷ lệ khung viewport node gen ảnh/video (theo project) — tránh nhảy kích thước khi có kết quả */
const flowGenViewportAspect = computed(() => cssAspectRatioFromProject(projectOpenData.value));
const loadProject = async (projectId) => {
    isHydratingFlow.value = true;
    try {
        if (!projectId) {
            setNodes(initialNodes.map((n) => setupNodeCallbacks(n)));
            setEdges([]);
            seedFlowHistoryFromCurrent();
            return;
        }

        try {
            const response = await projectService.list();
            const project = response.data.find((p) => p.id === projectId);

            if (project) {
                projectOpenData.value = project;
                applyWorkflowDefaultsFromProject(project);
                console.log('projectOpenData.value', projectOpenData.value);
                const nodesToSet = (project.nodes || []).map((n) => setupNodeCallbacks(n));
                setNodes(nodesToSet);
                setEdges(project.edges || []);
                pruneIllegalImageVideoGenEdges();
            } else {
                setNodes(initialNodes.map((n) => setupNodeCallbacks(n)));
                setEdges([]);
            }
            syncInputs();
            seedFlowHistoryFromCurrent();
        } catch (error) {
            console.error('Failed to load project:', error);
        }
    } finally {
        isHydratingFlow.value = false;
    }
};

/** Nodes/edges sạch (bỏ callback runtime, giữ result/status để khôi phục workflow đầy đủ) — dùng cho Save và Export JSON */
const buildCleanFlowJson = () => {
    const serializableNodes = toRaw(nodes.value).map((n) => {
        const rawNode = toRaw(n);
        const nodeData = toRaw(rawNode.data || {});
        const {
            onChange, onRun, onCancel, onDuplicate, onReorder,
            elapsedTime, ...cleanData
        } = nodeData;
        if (rawNode.type === 'videoGen' && cleanData.tier != null) {
            delete cleanData.tier;
        }
        return {
            id: rawNode.id,
            type: rawNode.type,
            position: rawNode.position,
            data: JSON.parse(JSON.stringify(cleanData)),
        };
    });
    const serializableEdges = toRaw(edges.value).map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
    }));
    return { nodes: serializableNodes, edges: serializableEdges };
};

const captureFlowSnapshot = () => JSON.parse(JSON.stringify(buildCleanFlowJson()));

const seedFlowHistoryFromCurrent = () => {
    flowHistoryEntries.value = [
        {
            id: `base-${Date.now()}`,
            at: Date.now(),
            snapshot: captureFlowSnapshot(),
        },
    ];
};

const pushFlowHistory = () => {
    if (!currentProjectId.value) return;
    const snap = captureFlowSnapshot();
    const top = flowHistoryEntries.value[0];
    if (top && JSON.stringify(top.snapshot) === JSON.stringify(snap)) return;
    flowHistoryEntries.value.unshift({
        id: `h-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: Date.now(),
        snapshot: snap,
    });
    if (flowHistoryEntries.value.length > MAX_FLOW_HISTORY) {
        flowHistoryEntries.value.length = MAX_FLOW_HISTORY;
    }
};

const restoreFlowHistoryEntry = async (entry) => {
    if (!entry?.snapshot?.nodes) return;
    if (flowHistoryEntries.value[0]?.id === entry.id) return;
    const okRestore = await notify.confirm({
        title: 'Khôi phục snapshot',
        message: 'Khôi phục phiên bản này? Toàn bộ canvas hiện tại sẽ bị thay thế.',
        confirmText: 'Khôi phục',
        cancelText: 'Hủy',
        variant: 'warning',
    });
    if (!okRestore) return;
    isHydratingFlow.value = true;
    skipNextHistoryCapture.value = true;
    try {
        setNodes(entry.snapshot.nodes.map((n) => setupNodeCallbacks(n)));
        setEdges(
            (entry.snapshot.edges || []).map((e) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                sourceHandle: e.sourceHandle,
                targetHandle: e.targetHandle,
            })),
        );
        pruneIllegalImageVideoGenEdges();
        syncInputs();
        seedFlowHistoryFromCurrent();
        await persistFlowToServer({ announce: false });
    } finally {
        isHydratingFlow.value = false;
    }
};

const persistFlowToServer = async ({ announce = false } = {}) => {
    if (!currentProjectId.value) {
        if (announce) {
            await notify.alert({
                title: 'Chưa có project',
                message: 'Vui lòng chọn hoặc tạo project trước khi lưu.',
                variant: 'warning',
            });
        }
        return false;
    }
    const { nodes: serializableNodes, edges: serializableEdges } = buildCleanFlowJson();
    try {
        await projectService.update(currentProjectId.value, {
            nodes: serializableNodes,
            edges: serializableEdges,
            workflowDefaults: { ...workflowDefaults.value },
        });
        lastAutoSaveAt.value = Date.now();
        autoSaveError.value = null;
        if (announce) {
            await notify.alert({
                title: 'Đã lưu',
                message: 'Đã lưu flow lên server thành công.',
                variant: 'success',
            });
        }
        return true;
    } catch (error) {
        const msg = error?.message || String(error);
        autoSaveError.value = msg;
        if (announce) {
            await notify.alert({
                title: 'Lưu thất bại',
                message: msg,
                variant: 'error',
            });
        }
        return false;
    }
};

const saveFlow = async () => {
    await persistFlowToServer({ announce: true });
};

const triggerImport = () => {
    fileInputRef.value?.click();
};

const exportFlow = () => {
    const { nodes: serializableNodes, edges: serializableEdges } = buildCleanFlowJson();
    const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        workflowDefaults: { ...workflowDefaults.value },
        nodes: serializableNodes,
        edges: serializableEdges,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = String(currentProjectId.value || 'export').replace(/[^a-zA-Z0-9-_]/g, '_');
    a.download = `flow-structure-${slug}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const sanitizeImportedNode = (n) => {
    const rawData = n.data && typeof n.data === 'object' ? { ...n.data } : {};
    const {
        onChange, onRun, onCancel, onDuplicate, onReorder,
        elapsedTime, status, result, error, ...cleanData
    } = rawData;
    const pos =
        n.position && typeof n.position === 'object'
            ? { x: Number(n.position.x) || 0, y: Number(n.position.y) || 0 }
            : { x: 0, y: 0 };
    return {
        id: String(n.id),
        type: String(n.type),
        position: pos,
        data: JSON.parse(JSON.stringify(cleanData)),
    };
};

const importFlow = async (e) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const rawNodes = parsed.nodes;
        let rawEdges = parsed.edges;
        if (!Array.isArray(rawNodes)) {
            await notify.alert({
                title: 'JSON không hợp lệ',
                message: 'File phải có mảng "nodes" (cùng định dạng Export).',
                variant: 'error',
            });
            return;
        }
        if (!Array.isArray(rawEdges)) rawEdges = [];

        const okImport = await notify.confirm({
            title: 'Import flow',
            message: 'Thay thế flow hiện tại bằng cấu trúc trong file?',
            confirmText: 'Thay thế',
            cancelText: 'Hủy',
            variant: 'warning',
        });
        if (!okImport) return;

        if (parsed.workflowDefaults && typeof parsed.workflowDefaults === 'object') {
            workflowDefaults.value = normalizeWorkflowDefaults(parsed.workflowDefaults, flowVideoTier.value);
        }

        const allowedTypes = new Set(Object.keys(nodeTypes));
        const sanitizedNodes = [];
        for (const n of rawNodes) {
            if (!n || typeof n !== 'object' || n.id == null || !n.type) continue;
            const type = String(n.type);
            if (!allowedTypes.has(type)) {
                await notify.alert({
                    title: 'Loại node không hỗ trợ',
                    message: `Loại "${type}" không được hỗ trợ.`,
                    variant: 'error',
                });
                return;
            }
            sanitizedNodes.push(sanitizeImportedNode(n));
        }
        if (!sanitizedNodes.length) {
            await notify.alert({
                title: 'Import thất bại',
                message: 'Không có node hợp lệ để import.',
                variant: 'warning',
            });
            return;
        }
        const nodeIds = new Set(sanitizedNodes.map((n) => n.id));
        const sanitizedEdges = rawEdges
            .filter(
                (edge) =>
                    edge &&
                    edge.source &&
                    edge.target &&
                    nodeIds.has(String(edge.source)) &&
                    nodeIds.has(String(edge.target)),
            )
            .map((edge, i) => ({
                id: edge.id || `edge-${i}-${edge.source}-${edge.target}`,
                source: String(edge.source),
                target: String(edge.target),
                sourceHandle: edge.sourceHandle,
                targetHandle: edge.targetHandle,
            }));

        isHydratingFlow.value = true;
        try {
            setNodes(sanitizedNodes.map((n) => setupNodeCallbacks(n)));
            setEdges(sanitizedEdges);
            pruneIllegalImageVideoGenEdges();
            syncInputs();
            seedFlowHistoryFromCurrent();
        } finally {
            isHydratingFlow.value = false;
        }
    } catch (err) {
        await notify.alert({
            title: 'Import lỗi',
            message: err?.message || String(err),
            variant: 'error',
        });
    }
};

// Hàm bổ trợ để gán lại các function callback cho Node khi load từ JSON
const setupNodeCallbacks = (node) => {
    const id = node.id;
    const baseData = { ...node.data };
    if (node.type === 'videoGen') {
        let vt = String(baseData.type || 'frame').toLowerCase();
        if (vt === 'text') vt = 'ingredient';
        baseData.type = vt === 'ingredient' ? 'ingredient' : 'frame';
        delete baseData.tier;
        baseData.videoModel = normalizeVideoModel(baseData.videoModel, flowVideoTier.value);
    }
    if (node.type === 'imageGen') {
        baseData.imageModel = normalizeImageModel(baseData.imageModel);
    }
    return {
        ...node,
        data: {
            ...baseData,
            status: 'idle',
            onChange: (val) => updateNodeData(id, val),
            onPersistAsset: (kind, source) => persistAssetForNode(id, kind, source),
            onRun: () => {
                if (node.type === 'start') return startAutomation();
                if (node.type === 'loopFlow') return void runLoopFlowAutomation(id);
                return executeNode(id);
            },
            onCancel: () => cancelNode(id),
            onDuplicate: () => duplicateNode(id),
            onReorder: (newInputs) => updateNodeData(id, { inputs: newInputs }),
        }
    };
};

const persistAssetForNode = async (nodeId, kind, source) => {
    if (!currentProjectId.value || !source) return null;
    const pickExt = (mime, fallbackKind) => {
        const m = String(mime || '').toLowerCase();
        if (m.includes('png')) return 'png';
        if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
        if (m.includes('webp')) return 'webp';
        if (m.includes('gif')) return 'gif';
        if (m.includes('mp4')) return 'mp4';
        if (m.includes('webm')) return 'webm';
        return fallbackKind === 'video' ? 'mp4' : 'png';
    };
    const toUploadFile = async () => {
        if (source instanceof File) return source;
        if (source instanceof Blob) {
            const ext = pickExt(source.type, kind);
            return new File([source], `${nodeId}-${kind}-${Date.now()}.${ext}`, { type: source.type || undefined });
        }
        if (typeof source === 'string') {
            if (source.startsWith('data:') || source.startsWith('blob:') || source.startsWith('http://') || source.startsWith('https://')) {
                const res = await fetch(source);
                if (!res.ok) throw new Error(`Không đọc được source để upload (${res.status})`);
                const blob = await res.blob();
                const ext = pickExt(blob.type, kind);
                return new File([blob], `${nodeId}-${kind}-${Date.now()}.${ext}`, { type: blob.type || undefined });
            }
        }
        return null;
    };
    try {
        const file = await toUploadFile();
        if (file) {
            const uploaded = await projectService.saveAssetFile(currentProjectId.value, file, { nodeId, kind });
            if (uploaded?.success && uploaded?.data?.url) return uploaded.data.url;
        }
        // Fallback JSON endpoint (for compatible data-url use cases)
        const response = await projectService.saveAsset(currentProjectId.value, { nodeId, kind, source });
        if (response?.success && response?.data?.url) return response.data.url;
        return typeof source === 'string' ? source : null;
    } catch (error) {
        console.error('Save asset failed:', error);
        return typeof source === 'string' ? source : null;
    }
};

// --- PROJECT EVENT HANDLERS ---

const handleProjectLoad = async (projectId) => {
    currentProjectId.value = projectId;
    localStorage.setItem('nano_last_project_id', projectId);
    await loadProject(projectId);
    isProjectModalOpen.value = false;
    isProjectManagerPageOpen.value = false;
};

const handleProjectCreate = async (projectName) => {
    try {
        const response = await projectService.create(projectName);
        if (response.success) {
            const newId = response.data.id;
            currentProjectId.value = newId;
            localStorage.setItem('nano_last_project_id', newId);
            await loadProject(newId);
            isProjectModalOpen.value = false;
            isProjectManagerPageOpen.value = false;
        }
    } catch (error) {
        await notify.alert({
            title: 'Tạo project thất bại',
            message: error?.message || 'Không thể tạo project.',
            variant: 'error',
        });
    }
};

const handleProjectRename = async ({ id, name }) => {
    try {
        await projectService.update(id, { name });
    } catch (error) {
        await notify.alert({
            title: 'Đổi tên thất bại',
            message: error?.message || 'Không thể đổi tên project.',
            variant: 'error',
        });
    }
};

const handleProjectDelete = async (projectId) => {
    try {
        await projectService.delete(projectId);
        if (currentProjectId.value === projectId) {
            currentProjectId.value = '';
            localStorage.removeItem('nano_last_project_id');
            setNodes([]);
            setEdges([]);
            isProjectManagerPageOpen.value = true;
        }
    } catch (error) {
        await notify.alert({
            title: 'Xóa thất bại',
            message: error?.message || 'Không thể xóa project.',
            variant: 'error',
        });
    }
};

// --- NODE EXECUTION & LOGIC ---

const timers = {};
const abortControllers = {};
/** @type {Map<string, AbortController>} */
const loopFlowControllers = new Map();

const sleepMs = (ms, signal) =>
    new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
        }
        const t = setTimeout(resolve, ms);
        const onAbort = () => {
            clearTimeout(t);
            reject(new DOMException('Aborted', 'AbortError'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
    });

const LOOPFLOW_BUSY_TYPES = new Set(['imageGen', 'videoGen', 'klingMotion', 'aiCall']);

async function waitUntilFlowPipelineIdle(signal, maxMs = 600000) {
    const t0 = Date.now();
    while (Date.now() - t0 < maxMs) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const busy = nodes.value.some(
            (n) => LOOPFLOW_BUSY_TYPES.has(n.type) && n.data?.status === 'running',
        );
        if (!busy) return;
        await new Promise((r) => setTimeout(r, 350));
    }
    throw new Error('Timeout: flow chưa hoàn tất trong thời gian cho phép');
}

async function runLoopFlowAutomation(nodeId, options = {}) {
    const { fromExecuteNode = false, signal: externalSignal } = options;
    const node = findNode(nodeId);
    if (!node || node.type !== 'loopFlow') return;

    const ac = new AbortController();
    if (externalSignal) {
        if (externalSignal.aborted) ac.abort();
        else externalSignal.addEventListener('abort', () => ac.abort(), { once: true });
    }
    loopFlowControllers.set(nodeId, ac);
    const signal = ac.signal;

    const isElectron = typeof window !== 'undefined' && typeof window.electronAPI?.invoke === 'function';

    if (!fromExecuteNode) {
        updateNodeData(nodeId, { status: 'running', error: null, loopProgress: '…' });
    }

    try {
        if (!isElectron) {
            throw new Error('Loop Flow API chưa sẵn sàng.');
        }
        const d = node.data || {};
        const rootPath = String(d.folderPath || '').trim();
        if (!rootPath) throw new Error('Chưa chọn thư mục nguồn');

        const listRes = await window.electronAPI.invoke('loopflow:list-media', {
            rootPath,
            classifyMode: d.classifyMode || 'byExtension',
            imageSubfolder: d.imageSubfolder || 'images',
            videoSubfolder: d.videoSubfolder || 'videos',
        });
        if (!listRes?.success) throw new Error(listRes?.message || 'Không đọc được thư mục');
        const files = Array.isArray(listRes.files) ? listRes.files : [];
        if (!files.length) throw new Error('Không tìm thấy file ảnh/video hợp lệ trong thư mục');

        const imgTarget = String(d.targetImageInputId || '').trim();
        const vidTarget = String(d.targetVideoInputId || '').trim();
        const advanceMode = d.advanceMode || 'untilIdle';
        const intervalSec = Math.max(1, Number(d.intervalSec) || 30);

        for (let i = 0; i < files.length; i += 1) {
            if (signal.aborted) break;
            const entry = files[i];
            const baseName = String(entry.path || '').split(/[/\\\\]/).pop() || `file-${i + 1}`;
            const targetId = entry.kind === 'image' ? imgTarget : vidTarget;
            if (!targetId) {
                updateNodeData(nodeId, {
                    loopProgress: `${i + 1}/${files.length} · bỏ qua (${entry.kind}, chưa chọn node đích)`,
                });
                continue;
            }
            const targetNode = findNode(targetId);
            if (!targetNode) continue;

            updateNodeData(nodeId, { loopProgress: `${i + 1}/${files.length}: ${baseName}` });

            const fileUrl = entry.fileUrl;
            if (entry.kind === 'image') {
                updateNodeData(targetId, { image: fileUrl });
                const saved = await persistAssetForNode(targetId, 'image', fileUrl);
                if (saved) updateNodeData(targetId, { image: saved });
            } else {
                updateNodeData(targetId, { video: fileUrl });
                const saved = await persistAssetForNode(targetId, 'video', fileUrl);
                if (saved) updateNodeData(targetId, { video: saved });
            }

            syncInputs();
            startAutomation();

            if (advanceMode === 'timer') {
                await sleepMs(intervalSec * 1000, signal);
            } else {
                await waitUntilFlowPipelineIdle(signal);
            }
        }

        if (signal.aborted) {
            updateNodeData(nodeId, { status: 'idle', loopProgress: 'Đã dừng', error: null });
        } else {
            updateNodeData(nodeId, { status: 'idle', loopProgress: `Xong · ${files.length} file`, error: null });
        }
    } catch (err) {
        if (err?.name === 'AbortError') {
            updateNodeData(nodeId, { status: 'idle', loopProgress: 'Đã dừng', error: null });
        } else {
            const msg = err?.message || String(err);
            updateNodeData(nodeId, { status: 'error', error: msg, loopProgress: '' });
            await notify.alert({ title: 'Loop Flow', message: msg, variant: 'error' });
        }
    } finally {
        loopFlowControllers.delete(nodeId);
    }
}

const pruneVideoGenEdgesForMode = (nodeId, mode) => {
    const m = String(mode || 'frame').toLowerCase();
    const next = edges.value.filter((e) => {
        if (e.target !== nodeId) return true;
        const th = e.targetHandle;
        if (m === 'frame') {
            return th !== 'in-ref';
        }
        return th !== 'in-start' && th !== 'in-end';
    });
    if (next.length !== edges.value.length) {
        setEdges(next);
    }
};

const updateNodeData = (nodeId, newData) => {
    const node = findNode(nodeId);
    if (node && node.data) {
        const prevVgType = node.type === 'videoGen' ? String(node.data.type || 'frame').toLowerCase() : null;
        let changed = false;
        for (const key in newData) {
            if (JSON.stringify(node.data[key]) !== JSON.stringify(newData[key])) {
                node.data[key] = newData[key];
                changed = true;
            }
        }
        if (changed && node.type === 'videoGen' && Object.prototype.hasOwnProperty.call(newData, 'type')) {
            const nextVgType = String(node.data.type || 'frame').toLowerCase();
            if (prevVgType !== nextVgType) {
                pruneVideoGenEdgesForMode(nodeId, nextVgType);
            }
        }
        if (changed) syncInputs();
    }
};

const urlToDataUrl = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to read image input');
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const urlToBlob = async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to read video input');
    return await response.blob();
};

const normalizeVariableName = (raw) => {
    if (!raw) return '';
    const text = String(raw).trim();
    if (!text) return '';
    if (text.startsWith('{{') && text.endsWith('}}')) {
        return text.slice(2, -2).trim();
    }
    return text;
};

const getUpstreamNodes = (targetNodeId) => {
    const visited = new Set();
    const stack = [targetNodeId];
    const upstream = [];

    while (stack.length) {
        const currentId = stack.pop();
        const incoming = edges.value.filter((e) => e.target === currentId);
        incoming.forEach((edge) => {
            if (visited.has(edge.source)) return;
            visited.add(edge.source);
            const node = findNode(edge.source);
            if (node) upstream.push(node);
            stack.push(edge.source);
        });
    }
    return upstream;
};

const waitForNodeCompletion = async (nodeId, timeoutMs = 120000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const node = findNode(nodeId);
        if (!node) return;
        if (node.data?.status === 'completed') return;
        if (node.data?.status === 'error') {
            throw new Error(node.data?.error || 'Upstream AI Call failed');
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
    }
    throw new Error('Timeout waiting for upstream AI Call');
};

const ensureUpstreamAICallResults = async (targetNodeId) => {
    const upstream = getUpstreamNodes(targetNodeId);
    for (const src of upstream) {
        if (src.type !== 'aiCall') continue;
        if (src.data?.status === 'completed' && src.data?.result) continue;
        if (src.data?.status !== 'running') {
            executeNode(src.id);
        }
        await waitForNodeCompletion(src.id);
    }
};

const resolvePromptVariables = (nodeId, promptText) => {
    if (!promptText || typeof promptText !== 'string') return '';
    const upstream = getUpstreamNodes(nodeId);
    const providers = {};

    upstream.forEach((src) => {
        if (!src?.data) return;
        if (src.type === 'textInput') {
            const key = normalizeVariableName(src.data.keyword);
            if (key) providers[key] = src.data.value || '';
        }
        if (src.type === 'aiCall') {
            const key = normalizeVariableName(src.data.keyword || 'resultai');
            if (key) providers[key] = src.data.result || '';
        }
    });

    return promptText.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (full, inner) => {
        const key = normalizeVariableName(inner);
        if (Object.prototype.hasOwnProperty.call(providers, key)) {
            return providers[key];
        }
        return full;
    });
};

const syncInputs = () => {
    if (!isLoaded.value) return;
    if (pruneIllegalImageVideoGenEdges()) return;
    nodes.value.forEach(node => {
        const incomingEdges = edges.value.filter(e => e.target === node.id);
        const videoMode = String(node.data?.type || 'frame').toLowerCase();
        const inputData =
            node.type === 'videoGen' && videoMode === 'frame'
                ? orderedVideoGenFrameInputs(incomingEdges)
                : incomingEdges.flatMap((edge) => {
                      const src = findNode(edge.source);
                      if (!src || !src.data) return [];
                      if (['imageInput', 'imageGen', 'videoGen', 'videoInput', 'klingMotion'].includes(src.type)) {
                          if (src.type === 'imageInput') return src.data.image ? [src.data.image] : [];
                          if (src.type === 'videoInput') return src.data.video ? [src.data.video] : [];
                          return src.data.result ? [src.data.result] : [];
                      }
                      if (src.type === 'videoPreview') {
                          const list = Array.isArray(src.data.inputs)
                              ? src.data.inputs.filter((v) => typeof v === 'string' && v)
                              : [];
                          return list;
                      }
                      return [];
                  });

        if (JSON.stringify(node.data.inputs) !== JSON.stringify(inputData)) {
            node.data.inputs = inputData;
        }
        if (node.type === 'videoPreview') {
            const outputs = Array.isArray(node.data.inputs) ? node.data.inputs.filter((v) => typeof v === 'string' && v) : [];
            const previewResult = outputs[0] || null;
            if (JSON.stringify(node.data.outputs) !== JSON.stringify(outputs)) {
                node.data.outputs = outputs;
            }
            if (node.data.result !== previewResult) {
                node.data.result = previewResult;
            }
        }
    });
};

const hasIncompleteVisualInputs = (nodeId) => {
    const incomingEdges = edges.value.filter((e) => e.target === nodeId);
    if (!incomingEdges.length) return false;
    for (const edge of incomingEdges) {
        const src = findNode(edge.source);
        if (!src || !src.data) continue;
        if (src.type === 'imageInput') {
            if (!src.data.image) return true;
            continue;
        }
        if (src.type === 'imageGen') {
            const hasResult = typeof src.data.result === 'string' && src.data.result.trim().length > 0;
            // Result URL is the true readiness signal; status may be "idle" after reload/import.
            if (!hasResult) return true;
            if (src.data.status === 'running') return true;
            continue;
        }
    }
    return false;
};

const executeNode = async (nodeId) => {
    const node = findNode(nodeId);
    if (!node) return;
    if (node.data?.status === 'running') return;

    const controller = new AbortController();
    abortControllers[nodeId] = controller;
    updateNodeData(nodeId, { status: 'running', error: undefined, elapsedTime: 0 });

    const startTime = Date.now();
    timers[nodeId] = setInterval(() => {
        updateNodeData(nodeId, { elapsedTime: Math.floor((Date.now() - startTime) / 1000) });
    }, 1000);

    try {
        if (['imageGen', 'videoGen', 'klingMotion'].includes(node.type)) {
            await ensureUpstreamAICallResults(nodeId);
        }
        if ((node.type === 'imageGen' || node.type === 'videoGen') && hasIncompleteVisualInputs(nodeId)) {
            throw new Error('Input context chưa sẵn sàng: còn ảnh đầu vào chưa upload hoặc node upstream chưa hoàn tất.');
        }
        let finalPrompt = resolvePromptVariables(nodeId, node.data.prompt || "");

        let result;
        if (node.type === 'imageGen') {
            const imageUrls = (node.data.inputs || []).filter((u) => typeof u === 'string' && !isLikelyFlowVideoUrl(u));
            let safePrompt = sanitizeImagePromptForSafety(finalPrompt) || defaultPromptForType('imageGen', node.data, '');
            let refs = imageUrls;
            let lastErr = null;
            for (let attempt = 1; attempt <= 3; attempt += 1) {
                try {
                    result = await generateNanoImage({
                        prompt: safePrompt,
                        imageUrls: refs,
                        imageModel: node.data.imageModel,
                        ratio: projectOpenData.value?.imageAspectRatio,
                    });
                    result = nanoImageResultUrl(result);
                    lastErr = null;
                    break;
                } catch (err) {
                    lastErr = err;
                    if (attempt >= 3) break;
                    if (isPolicyBlockedError(err)) {
                        safePrompt = sanitizeImagePromptForSafety(`${safePrompt}. product catalog style, fully clothed, non-sensitive`);
                        refs = refs.slice(0, 1);
                    }
                    await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
                }
            }
            if (lastErr) {
                throw lastErr;
            }
        } else if (node.type === 'videoGen') {
            const vgMode = String(node.data?.type || 'frame').toLowerCase();
            const maxRefs = vgMode === 'frame' ? 2 : 4;
            const imageUrls = (node.data.inputs || [])
                .filter((u) => typeof u === 'string' && !isLikelyFlowVideoUrl(u))
                .slice(0, maxRefs);
            let safePrompt = sanitizeVideoPromptForSafety(finalPrompt);
            if (!safePrompt) {
                safePrompt = defaultPromptForType('videoGen', node.data, '');
            }
            let refs = imageUrls;
            let lastErr = null;
            for (let attempt = 1; attempt <= 3; attempt += 1) {
                try {
                    result = await generateNanoVideo({
                        prompt: safePrompt,
                        imageUrls: refs,
                        videoModel: node.data.videoModel,
                        type: node.data.type,
                        ratio: projectOpenData.value?.videoAspectRatio,
                    });
                    lastErr = null;
                    break;
                } catch (err) {
                    lastErr = err;
                    if (attempt >= 3) break;
                    if (isPolicyBlockedError(err)) {
                        safePrompt = sanitizeVideoPromptForSafety(`${safePrompt}. fashion-commercial style, fully clothed, respectful, no sensual tone`);
                        refs = refs.slice(0, 1);
                    }
                    await new Promise((resolve) => setTimeout(resolve, 900 * attempt));
                }
            }
            if (lastErr) {
                throw lastErr;
            }
        } else if (node.type === 'aiCall') {
            result = await callGemini(finalPrompt, (node.data.inputs || []).slice(0, 3));
        } else if (node.type === 'klingMotion') {
            const inputs = node.data.inputs || [];
            const autoVideo = inputs.find((v) => typeof v === 'string' && isLikelyFlowVideoUrl(v));
            const autoImage = inputs.find((v) => typeof v === 'string' && !isLikelyFlowVideoUrl(v));
            const imageBase64 = autoImage ? await urlToDataUrl(autoImage) : undefined;
            const videoFile = autoVideo && (autoVideo.includes('/resources/') || autoVideo.includes('metadata/resources/'))
                ? autoVideo
                : (autoVideo ? await urlToBlob(autoVideo) : undefined);
            result = await generateMotionVideo({
                imageBase64,
                videoFile,
                prompt: finalPrompt || node.data.prompt || '',
                characterOrientation: node.data.characterOrientation || 'video',
                cfgScale: node.data.cfgScale ?? 0.5,
                timeVideo: node.data.timeVideo || 9
            });
        } else if (node.type === 'loopFlow') {
            await runLoopFlowAutomation(nodeId, { signal: controller.signal, fromExecuteNode: true });
            result = null;
        } else if (node.type === 'loopEnd') {
            result = null;
        }

        if (abortControllers[nodeId]?.signal.aborted) return;
        if ((node.type === 'imageGen' || node.type === 'videoGen' || node.type === 'klingMotion') && result) {
            const kind = node.type === 'imageGen' ? 'image' : 'video';
            const savedUrl = await persistAssetForNode(nodeId, kind, result);
            if (savedUrl) result = savedUrl;
        }
        updateNodeData(nodeId, { result, status: 'completed' });

        // Trigger các node tiếp theo
        const nextTargetIds = Array.from(new Set(edges.value.filter((e) => e.source === nodeId).map((e) => e.target)));
        nextTargetIds.forEach((targetId) => {
            const targetNode = findNode(targetId);
            if (targetNode && targetNode.data?.status !== 'running') executeNode(targetId);
        });

    } catch (error) {
        if (error.name !== 'AbortError') {
            updateNodeData(nodeId, { status: 'error', error: error.message });
        }
    } finally {
        clearInterval(timers[nodeId]);
        delete abortControllers[nodeId];
    }
};

const startAutomation = () => {
    // Reset results
    nodes.value.forEach(node => {
        if (!['imageInput', 'textInput', 'start', 'loopFlow', 'loopEnd'].includes(node.type)) {
            updateNodeData(node.id, { result: null, status: 'idle', error: null });
        }
    });
    // Start from Start nodes
    nodes.value.filter((n) => n.type === 'start').forEach((startNode) => {
        const targetIds = Array.from(new Set(edges.value.filter((e) => e.source === startNode.id).map((e) => e.target)));
        targetIds.forEach((targetId) => executeNode(targetId));
    });
};

const cancelNode = (nodeId) => {
    const n = findNode(nodeId);
    if (n?.type === 'loopFlow') {
        loopFlowControllers.get(nodeId)?.abort();
        loopFlowControllers.delete(nodeId);
        updateNodeData(nodeId, { status: 'idle' });
        return;
    }
    if (abortControllers[nodeId]) abortControllers[nodeId].abort();
    clearInterval(timers[nodeId]);
    updateNodeData(nodeId, { status: 'idle' });
};

// --- UI HELPERS ---

const newFlowNodeId = (type) =>
    `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const addNode = (type) => {
    isAddMenuOpen.value = false;
    const id = newFlowNodeId(type);
    const newNode = setupNodeCallbacks({
        id,
        type,
        position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
        data: defaultDataForFlowType(type),
    });
    addNodes([newNode]);
};

const duplicateNode = (nodeId) => {
    const node = findNode(nodeId);
    if (!node) return;
    const raw = toRaw(node);
    const dataRaw = toRaw(raw.data) || {};
    const {
        onChange: _oc,
        onRun: _or,
        onCancel: _oca,
        onDuplicate: _od,
        onReorder: _ore,
        onPersistAsset: _opa,
        ...restData
    } = dataRaw;
    const dataClean = JSON.parse(JSON.stringify(restData));

    const newId = newFlowNodeId(raw.type);
    const newNode = setupNodeCallbacks({
        id: newId,
        type: raw.type,
        position: {
            x: (raw.position?.x ?? 0) + 48,
            y: (raw.position?.y ?? 0) + 48,
        },
        ...(raw.dimensions ? { dimensions: { ...toRaw(raw.dimensions) } } : {}),
        data: dataClean,
    });
    addNodes([newNode]);
};

const deleteNode = (id) => removeNodes([id]);
const deleteEdge = (id) => setEdges(edges.value.filter(e => e.id !== id));

/** Mỗi Video Gen ≈ một clip ngắn; dùng khi prompt Gemini tính số node theo thời lượng. */
const FLOW_VIDEO_CLIP_SECONDS = 8;

/** Gemini phase-1 « Tạo node »: giới hạn số ô imageInput người dùng chọn trên panel. */
const AI_FLOW_MAX_IMAGE_INPUTS = 8;

const FLOW_NODE_TYPES = new Set([
    'start',
    'imageInput',
    'videoInput',
    'imageGen',
    'videoGen',
    'klingMotion',
    'textInput',
    'aiCall',
    'source',
    'videoPreview',
    'loopFlow',
    'loopEnd',
]);

const defaultDataForFlowType = (type) => {
    if (type === 'start') return { status: 'idle' };
    const base = { inputs: [], result: null, status: 'idle' };
    if (type === 'imageInput') return { ...base, image: null, name: '' };
    if (type === 'videoInput') return { ...base, video: null };
    if (type === 'imageGen') {
        return { ...base, prompt: '', imageModel: workflowDefaults.value.imageModel };
    }
    if (type === 'videoGen') {
        return {
            ...base,
            prompt: '',
            videoModel: workflowDefaults.value.videoModel,
            type: 'frame',
            clipDurationSec: 8,
            segmentLabel: '',
        };
    }
    if (type === 'klingMotion') return { ...base, prompt: '', characterOrientation: 'video', cfgScale: 0.5, timeVideo: 9 };
    if (type === 'aiCall') return { ...base, prompt: '', keyword: '{{resultai}}' };
    if (type === 'textInput') return { ...base, keyword: '{{keyword}}', value: '' };
    if (type === 'source') return { ...base };
    if (type === 'videoPreview') return { ...base };
    if (type === 'loopFlow') {
        return {
            ...base,
            folderPath: '',
            classifyMode: 'byExtension',
            imageSubfolder: 'images',
            videoSubfolder: 'videos',
            targetImageInputId: '',
            targetVideoInputId: '',
            advanceMode: 'untilIdle',
            intervalSec: 30,
            loopProgress: '',
        };
    }
    if (type === 'loopEnd') return { ...base };
    return { ...base, keyword: '{{keyword}}', value: '' };
};

const mergeNodeData = (type, partial) => {
    const base = defaultDataForFlowType(type);
    if (!partial || typeof partial !== 'object') return base;
    if (type === 'start') return { status: partial.status || 'idle' };
    const merged = { ...base, ...partial };
    if (type === 'imageInput') {
        merged.name = typeof partial.name === 'string' ? partial.name : merged.name || '';
    }
    if (type === 'videoGen') {
        const sec = Number(merged.clipDurationSec);
        merged.clipDurationSec = Number.isFinite(sec) && sec > 0 ? sec : 8;
        merged.segmentLabel = typeof partial.segmentLabel === 'string' ? partial.segmentLabel : merged.segmentLabel || '';
        let vt = String(merged.type || 'frame').toLowerCase();
        if (vt === 'text') vt = 'ingredient';
        merged.type = vt === 'ingredient' ? 'ingredient' : 'frame';
        delete merged.tier;
        merged.videoModel = normalizeVideoModel(merged.videoModel, flowVideoTier.value);
    }
    if (type === 'imageGen') {
        merged.imageModel = normalizeImageModel(merged.imageModel);
    }
    if (type === 'loopFlow') {
        merged.classifyMode = merged.classifyMode === 'bySubfolder' ? 'bySubfolder' : 'byExtension';
        merged.advanceMode = merged.advanceMode === 'timer' ? 'timer' : 'untilIdle';
        const iv = Number(merged.intervalSec);
        merged.intervalSec = Number.isFinite(iv) && iv >= 1 ? Math.round(iv) : 30;
    }
    return merged;
};

/** AI-generated flows must not use Kling; coerce any stray klingMotion to videoGen. */
const normalizeAiFlowNodeType = (raw) => {
    const t = typeof raw === 'string' ? raw : '';
    if (t === 'klingMotion') return 'videoGen';
    if (FLOW_NODE_TYPES.has(t)) return t;
    return 'textInput';
};

const defaultPromptForType = (type, data, graphSummary) => {
    const summary = String(graphSummary || '').trim() || 'kịch bản sản phẩm';
    if (type === 'imageGen') {
        return `Tạo ảnh key visual cho ${summary}; nêu rõ sản phẩm chính, bối cảnh, ánh sáng, chất liệu bề mặt và bố cục nhất quán để làm ảnh tham chiếu video.`;
    }
    if (type === 'videoGen') {
        const seg = String(data?.segmentLabel || '').trim();
        return seg
            ? `Cảnh ${seg}: quay video sản phẩm theo mô tả riêng của cảnh này; chỉ rõ bối cảnh, góc máy, chuyển động máy quay, hành động sản phẩm, mood ánh sáng; nếu có người, mô tả rõ là người trưởng thành và nêu tuổi (ví dụ adult woman, age 25); đảm bảo đồng nhất nhận diện sản phẩm.`
            : `Tạo video 8s cho ${summary}; mô tả cụ thể sản phẩm, bối cảnh, góc máy, chuyển động và ánh sáng; nếu có người thì nêu rõ người trưởng thành và độ tuổi; tránh prompt chung chung để không nhảy cảnh.`;
    }
    if (type === 'aiCall') {
        return `Viết prompt chi tiết để tạo ảnh/video nhất quán cho ${summary}.`;
    }
    return '';
};

const makeAiEdgeId = (i) => `edge-ai-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
const clampText = (v, max) => String(v || '').trim().slice(0, max);
const SENSITIVE_VIDEO_WORDS = [
    /\bsexy\b/gi,
    /\berotic\b/gi,
    /\bnude\b/gi,
    /\bnudity\b/gi,
    /\blingerie\b/gi,
    /\bunderwear\b/gi,
    /\bsexual\b/gi,
    /\bnsfw\b/gi,
    /\bkhoe[\s-]*than\b/gi,
    /\bgoi[\s-]*cam\b/gi,
    /\bkhieu[\s-]*dam\b/gi,
];
const RISKY_VIDEO_PHRASE_REWRITES = [
    { pattern: /\bcharming\s+wink\b/gi, replacement: 'friendly smile' },
    { pattern: /\bwink\b/gi, replacement: 'smile' },
    { pattern: /\bsilk\s+pajamas?\b/gi, replacement: 'modest casual outfit' },
    { pattern: /\bpajamas?\b/gi, replacement: 'casual outfit' },
    { pattern: /\bseductive\b/gi, replacement: 'confident' },
    { pattern: /\bsensual\b/gi, replacement: 'natural' },
    { pattern: /\bbedroom\b/gi, replacement: 'bright indoor studio' },
];
const SENSITIVE_IMAGE_WORDS = [
    /\bsexy\b/gi,
    /\berotic\b/gi,
    /\bnude\b/gi,
    /\bnudity\b/gi,
    /\blingerie\b/gi,
    /\bunderwear\b/gi,
    /\bsexual\b/gi,
    /\bnsfw\b/gi,
    /\bkhoe[\s-]*than\b/gi,
    /\bgoi[\s-]*cam\b/gi,
    /\bkhieu[\s-]*dam\b/gi,
];
const sanitizeImagePromptForSafety = (prompt) => {
    let text = String(prompt || '').trim();
    if (!text) return '';
    SENSITIVE_IMAGE_WORDS.forEach((pattern) => {
        text = text.replace(pattern, '');
    });
    text = text.replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.').replace(/\.{2,}/g, '.').trim();
    return clampText(text, 320);
};
const isPolicyBlockedError = (error) => {
    const m = String(error?.message || error || '').toUpperCase();
    return m.includes('PUBLIC_ERROR_SEXUAL') || m.includes('NCII') || m.includes('MEDIA_GENERATION_STATUS_FAILED');
};
const sanitizeVideoPromptForSafety = (prompt) => {
    let text = String(prompt || '').trim();
    if (!text) return '';
    SENSITIVE_VIDEO_WORDS.forEach((pattern) => {
        text = text.replace(pattern, '');
    });
    RISKY_VIDEO_PHRASE_REWRITES.forEach(({ pattern, replacement }) => {
        text = text.replace(pattern, replacement);
    });
    // If prompt focuses on a person, enforce neutral wardrobe/behavior wording.
    const isHumanFocused = /\b(woman|girl|lady|female|model|person|man|boy|male)\b/i.test(text);
    if (isHumanFocused) {
        text = text
            .replace(/\b(flowing\s+softly)\b/gi, 'moving naturally')
            .replace(/\b(very\s+close[-\s]?up\s+body)\b/gi, 'medium shot');
    }
    text = text.replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.').replace(/\.{2,}/g, '.').trim();
    return clampText(text, 320);
};

const applyAiFlowGraph = (graph) => {
    const rawNodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    const rawEdges = Array.isArray(graph?.edges) ? graph.edges : [];
    if (!rawNodes.length) throw new Error('JSON không có mảng nodes.');
    const types = rawNodes.map((n) => normalizeAiFlowNodeType(n?.type));
    if (!types.includes('start')) {
        throw new Error('Thiếu node type "start" — bắt buộc để chạy automation.');
    }
    const layoutShift = { x: 380, y: 200 };
    const assignedIds = [];
    const vueNodes = rawNodes.map((n, idx) => {
        const type = normalizeAiFlowNodeType(n?.type);
        const id = newFlowNodeId(type);
        assignedIds.push(id);
        const px = typeof n?.position?.x === 'number' ? n.position.x : 60 + (idx % 4) * 220;
        const py = typeof n?.position?.y === 'number' ? n.position.y : 40 + Math.floor(idx / 4) * 160;
        const position = { x: px + layoutShift.x, y: py + layoutShift.y };
        const data = mergeNodeData(type, n.data);
        // Sanitize runaway model output (e.g. repeated giant strings causing MAX_TOKENS side effects).
        if (typeof data?.value === 'string') delete data.value;
        if (typeof data?.keyword === 'string') data.keyword = clampText(data.keyword, 40);
        if (typeof data?.name === 'string') data.name = clampText(data.name, 90);
        if (typeof data?.segmentLabel === 'string') data.segmentLabel = clampText(data.segmentLabel, 70);
        if (typeof data?.prompt === 'string') data.prompt = clampText(data.prompt, 320);
        if (type === 'imageInput' && !String(data.name || '').trim()) {
            data.name = `Ảnh đầu vào — mô tả bước ${idx + 1}`;
        }
        if ((type === 'imageGen' || type === 'videoGen' || type === 'aiCall') && !String(data.prompt || '').trim()) {
            data.prompt = defaultPromptForType(type, data, graph?.scriptSummary);
        }
        if (type === 'videoGen') {
            data.prompt = sanitizeVideoPromptForSafety(data.prompt);
            if (!String(data.prompt || '').trim()) {
                data.prompt = defaultPromptForType(type, data, graph?.scriptSummary);
            }
        }
        return setupNodeCallbacks({
            id,
            type,
            position,
            data: JSON.parse(JSON.stringify(data)),
        });
    });
    const vueEdges = rawEdges
        .map((e, i) => {
            const from = Number(e.from);
            const to = Number(e.to);
            if (!Number.isInteger(from) || !Number.isInteger(to)) return null;
            if (from < 0 || from >= assignedIds.length || to < 0 || to >= assignedIds.length) return null;
            const out = {
                id: makeAiEdgeId(i),
                source: assignedIds[from],
                target: assignedIds[to],
            };
            if (e.targetHandle != null && e.targetHandle !== '') {
                out.targetHandle = e.targetHandle;
            }
            if (e.sourceHandle != null && e.sourceHandle !== '') {
                out.sourceHandle = e.sourceHandle;
            }
            return out;
        })
        .filter(Boolean);

    const nodeById = new Map(vueNodes.map((n) => [n.id, n]));
    const hasEdge = (source, target) => vueEdges.some((e) => e.source === source && e.target === target);
    const pushEdgeIfMissing = (source, target) => {
        if (!source || !target || source === target) return;
        if (!hasEdge(source, target)) {
            vueEdges.push({ id: makeAiEdgeId(vueEdges.length + 1), source, target });
        }
    };

    const starts = vueNodes.filter((n) => n.type === 'start');
    const imageInputs = vueNodes.filter((n) => n.type === 'imageInput');
    const imageGens = vueNodes.filter((n) => n.type === 'imageGen');
    const videoGens = vueNodes.filter((n) => n.type === 'videoGen');
    let previews = vueNodes.filter((n) => n.type === 'videoPreview');

    // Ensure every imageGen is triggerable from Start and can reference original image.
    const inEdgesByTarget = new Map();
    vueEdges.forEach((e) => {
        const list = inEdgesByTarget.get(e.target) || [];
        list.push(e);
        inEdgesByTarget.set(e.target, list);
    });

    const start = starts[0];
    imageGens.forEach((ig) => {
        const incoming = inEdgesByTarget.get(ig.id) || [];
        const hasStartEdge = incoming.some((e) => e.source === start?.id);
        const hasImageInputRef = incoming.some((e) => nodeById.get(e.source)?.type === 'imageInput');
        if (start && !hasStartEdge) pushEdgeIfMissing(start.id, ig.id);
        if (imageInputs.length && !hasImageInputRef) pushEdgeIfMissing(imageInputs[0].id, ig.id);
    });

    // Rebuild incoming map after added edges.
    inEdgesByTarget.clear();
    vueEdges.forEach((e) => {
        const list = inEdgesByTarget.get(e.target) || [];
        list.push(e);
        inEdgesByTarget.set(e.target, list);
    });

    videoGens.forEach((vg, idx) => {
        const incoming = inEdgesByTarget.get(vg.id) || [];
        const videoMode = String(vg.data?.type || 'frame').toLowerCase();
        const maxVisual = videoMode === 'frame' ? 2 : 4;
        const visualRefEdges = incoming.filter((e) => {
            const src = nodeById.get(e.source);
            return src && VIDEO_GEN_VISUAL_SOURCE_TYPES.has(src.type);
        });

        if (videoMode === 'frame' && visualRefEdges.length === 0) {
            const fallbackSource = imageGens[idx] || imageGens[imageGens.length - 1] || imageInputs[idx] || imageInputs[0];
            if (fallbackSource) {
                pushEdgeIfMissing(fallbackSource.id, vg.id);
            }
        }

        if (visualRefEdges.length > maxVisual) {
            const removeIds = new Set(visualRefEdges.slice(maxVisual).map((e) => e.id));
            for (let i = vueEdges.length - 1; i >= 0; i -= 1) {
                if (removeIds.has(vueEdges[i].id)) vueEdges.splice(i, 1);
            }
        }
    });

    // Ensure start can trigger generation pipeline.
    if (starts.length) {
        const startTargets = vueEdges.filter((e) => e.source === start.id).map((e) => e.target);
        const firstWorkNode = imageInputs[0] || imageGens[0] || videoGens[0];
        if (firstWorkNode && !startTargets.includes(firstWorkNode.id)) {
            pushEdgeIfMissing(start.id, firstWorkNode.id);
        }
    }

    // Ensure there is at least one videoPreview and all videoGens connect to it.
    if (!previews.length && videoGens.length) {
        const maxX = Math.max(...vueNodes.map((n) => n.position?.x || 0));
        const minY = Math.min(...vueNodes.map((n) => n.position?.y || 0));
        const previewNode = setupNodeCallbacks({
            id: newFlowNodeId('videoPreview'),
            type: 'videoPreview',
            position: { x: maxX + 360, y: minY + 120 },
            data: JSON.parse(JSON.stringify(defaultDataForFlowType('videoPreview'))),
        });
        vueNodes.push(previewNode);
        nodeById.set(previewNode.id, previewNode);
        previews = [previewNode];
    }
    if (previews.length && videoGens.length) {
        const preview = previews[0];
        videoGens.forEach((vg) => pushEdgeIfMissing(vg.id, preview.id));
    }

    isHydratingFlow.value = true;
    skipNextHistoryCapture.value = true;
    try {
        addNodes(vueNodes);
        setEdges([...edges.value, ...vueEdges]);
        pruneIllegalImageVideoGenEdges();
        syncInputs();
    } finally {
        isHydratingFlow.value = false;
    }
};

/** Một lượt chat trong AiFlowPromptPanel — transcript là các tin nhắn trước tin user vừa gửi. */
const runAiFlowPromptChatTurn = async ({ transcript, userMessage, imageUrls = [], onChunk }) => {
    aiFlowError.value = '';
    aiFlowBusy.value = true;
    try {
        const structure = getActiveStructure();
        const clipSeconds = structure?.clipSeconds || FLOW_VIDEO_CLIP_SECONDS;
        const imgs = Array.isArray(imageUrls) ? imageUrls.filter((u) => typeof u === 'string' && u) : [];
        const imgNote =
            imgs.length > 0
                ? ` User đính kèm ${imgs.length} hình ảnh trong request này (cùng lượt với tin nhắn dưới) — hãy đọc ảnh, mô tả ngắn những gì thấy và gắn với phân tích kịch bản / ý tưởng.`
                : '';
        const prompt = interpolatePromptLines(structure.chatPromptLines, {
            clipSeconds,
            imageNote: imgNote,
            transcript: transcript || '(chưa có).',
            userMessage: userMessage || '(không có chữ — chỉ xem ảnh đính kèm nếu có)',
        });
        const text = await callGeminiStreamText(prompt, {
            imageUrls: imgs,
            onChunk,
        });
        if (!text?.trim()) throw new Error('Model không trả về nội dung hợp lệ.');
        return text.trim();
    } catch (e) {
        aiFlowError.value = e?.message || String(e);
        await notify.alert({ title: 'Gemini lỗi', message: aiFlowError.value, variant: 'error' });
        throw e;
    } finally {
        aiFlowBusy.value = false;
    }
};

const clampInt = (v, min, max, fallback) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, Math.round(n)));
};

const runGeminiBuildNodes = async (evt) => {
    const script =
        typeof evt === 'object' && evt !== null && typeof evt.script === 'string'
            ? evt.script.trim()
            : typeof evt === 'string'
                ? evt.trim()
                : '';
    if (!script) {
        await notify.alert({
            title: 'Thiếu nội dung',
            message: 'Chat với AI để có ý tưởng, rồi bấm Tạo node.',
            variant: 'warning',
        });
        return;
    }
    aiFlowError.value = '';
    aiFlowBusy.value = true;
    try {
        const structure = getActiveStructure();
        const maxImageInputs = clampInt(structure?.maxImageInputs, 1, 12, AI_FLOW_MAX_IMAGE_INPUTS);
        const imageInputCount = clampInt(
            typeof evt === 'object' && evt !== null ? evt.imageInputCount : undefined,
            1,
            maxImageInputs,
            1,
        );
        const graph = await buildGraphFromStructure({
            structure,
            script,
            imageInputCount,
            callGeminiStructured,
            sanitizeVideoPromptForSafety,
        });
        applyAiFlowGraph(graph);
        const summary = graph?.scriptSummary || 'Đã thêm các node và cạnh từ kịch bản.';
        await notify.alert({ title: 'Đã tạo flow', message: summary, variant: 'success' });
    } catch (e) {
        aiFlowError.value = e?.message || String(e);
        await notify.alert({ title: 'Không tạo được flow', message: aiFlowError.value, variant: 'error' });
    } finally {
        aiFlowBusy.value = false;
    }
};

const clearFlow = async () => {
    const okClear = await notify.confirm({
        title: 'Xóa toàn bộ flow',
        message: 'Xóa hết node và kết nối trong project này?',
        confirmText: 'Xóa',
        cancelText: 'Hủy',
        variant: 'warning',
    });
    if (!okClear) return;
    isHydratingFlow.value = true;
    try {
        setNodes([]);
        setEdges([]);
        pruneIllegalImageVideoGenEdges();
        syncInputs();
        seedFlowHistoryFromCurrent();
        await persistFlowToServer({ announce: false });
    } finally {
        isHydratingFlow.value = false;
    }
};

const clearAllResults = () => {
    nodes.value.forEach(node => updateNodeData(node.id, { result: null, status: 'idle', error: null }));
};

const closeAddMenu = (e) => {
    if (!e.target.closest('.add-menu-container')) isAddMenuOpen.value = false;
};

// AI Quick Call
const handleAiCall = async () => {
    if (!aiCallPrompt.value.trim()) return;
    aiCallStatus.value = 'running';
    try {
        aiCallResult.value = await callGemini(aiCallPrompt.value);
        aiCallStatus.value = 'completed';
    } catch (e) {
        aiCallResult.value = e.message;
        aiCallStatus.value = 'error';
    }
};

// --- LIFECYCLE ---
onMounted(async () => {
    window.addEventListener('click', closeAddMenu);
    isProjectManagerPageOpen.value = true;
    await loadProject(currentProjectId.value);
    isLoaded.value = true;
    syncInputs();
});

onUnmounted(() => window.removeEventListener('click', closeAddMenu));

// --- VUE FLOW WATCHERS ---
onConnect(async (params) => {
    const targetNode = findNode(params.target);
    const sourceNode = findNode(params.source);

    if (targetNode?.type === 'aiCall') {
        const allowedImageSources = ['imageInput', 'imageGen'];
        if (!sourceNode || !allowedImageSources.includes(sourceNode.type)) {
            await notify.alert({
                title: 'Chat AI',
                message: 'Chat AI chỉ nhận đầu vào ảnh (Image Input hoặc Image Gen).',
                variant: 'warning',
            });
            return;
        }

        const incomingImageCount = edges.value.filter((e) => {
            if (e.target !== params.target) return false;
            const src = findNode(e.source);
            return src && allowedImageSources.includes(src.type);
        }).length;

        if (incomingImageCount >= 3) {
            await notify.alert({
                title: 'Chat AI',
                message: 'Chat AI tối đa 3 ảnh đầu vào.',
                variant: 'warning',
            });
            return;
        }
    }

    if (targetNode?.type === 'imageGen' || targetNode?.type === 'videoGen') {
        if (sourceNode && VIDEO_CONTEXT_SOURCE_TYPES.has(sourceNode.type)) {
            await notify.alert({
                title: 'Kết nối không hợp lệ',
                message: 'Image Gen / Video Gen chỉ nhận ảnh tham chiếu (Image Input hoặc Image Gen), không nhận output video.',
                variant: 'warning',
            });
            return;
        }
    }

    if (sourceNode?.type === 'videoPreview' && targetNode?.type !== 'source') {
        await notify.alert({
            title: 'Kết nối không hợp lệ',
            message: 'Output của Video Preview chỉ được nối tới node Source.',
            variant: 'warning',
        });
        return;
    }

    if (targetNode?.type === 'source' && !SOURCE_ALLOWED_INPUT_TYPES.has(sourceNode?.type)) {
        await notify.alert({
            title: 'Kết nối không hợp lệ',
            message: 'Node Source chỉ nhận đầu vào từ Image Input, Image Gen, Video Input, Video Gen hoặc Video Preview.',
            variant: 'warning',
        });
        return;
    }

    if (targetNode?.type === 'videoGen') {
        const vgMode = String(targetNode.data?.type || 'frame').toLowerCase();
        const isVgVisualRef = (e) => {
            if (e.target !== params.target) return false;
            const s = findNode(e.source);
            return s && VIDEO_GEN_VISUAL_SOURCE_TYPES.has(s.type);
        };
        if (vgMode === 'frame') {
            const th = params.targetHandle;
            if (th === 'in-start' || th === 'in-end') {
                const slotTaken = edges.value.some(
                    (e) => e.target === params.target && e.targetHandle === th && isVgVisualRef(e),
                );
                if (slotTaken) {
                    await notify.alert({
                        title: 'Sinh video (Frame)',
                        message:
                            th === 'in-start'
                                ? 'Cổng ảnh Đầu đã có kết nối. Gỡ cạnh cũ trước khi nối ảnh khác.'
                                : 'Cổng ảnh Cuối đã có kết nối. Gỡ cạnh cũ trước khi nối ảnh khác.',
                        variant: 'warning',
                    });
                    return;
                }
            }
            const incomingVisual = edges.value.filter(isVgVisualRef);
            if (incomingVisual.length >= 2) {
                await notify.alert({
                    title: 'Sinh video (Frame)',
                    message: 'Đã đủ 2 ảnh (Đầu và Cuối). Gỡ một cạnh trước khi nối thêm.',
                    variant: 'warning',
                });
                return;
            }
        } else if (vgMode === 'ingredient') {
            const incomingVisual = edges.value.filter(isVgVisualRef);
            if (incomingVisual.length >= 4) {
                await notify.alert({
                    title: 'Sinh video (Thành phần)',
                    message: 'Tối đa 4 ảnh tham chiếu. Gỡ một cạnh trước khi nối thêm.',
                    variant: 'warning',
                });
                return;
            }
        }
    }

    const duplicated = edges.value.some((e) => e.source === params.source && e.target === params.target);
    if (duplicated) return;

    addEdges([params]);
});
onNodesChange((changes) => applyNodeChanges(changes));
onEdgesChange((changes) => applyEdgeChanges(changes));
watch(edges, () => syncInputs(), { deep: true });

const scheduleAutoSave = useDebounceFn(() => {
    if (!currentProjectId.value || isHydratingFlow.value) return;
    persistFlowToServer({ announce: false });
}, 2400);

watchDebounced(
    [nodes, edges],
    () => {
        if (!isLoaded.value || !currentProjectId.value || isHydratingFlow.value) return;
        if (skipNextHistoryCapture.value) {
            skipNextHistoryCapture.value = false;
        } else {
            pushFlowHistory();
        }
        scheduleAutoSave();
    },
    { deep: true, debounce: 1000, maxWait: 12000 }
);

watchDebounced(
    workflowDefaults,
    () => {
        if (!isLoaded.value || !currentProjectId.value || isHydratingFlow.value) return;
        scheduleAutoSave();
    },
    { deep: true, debounce: 800, maxWait: 4000 }
);

watch(() => props.openProjectManagerKey, () => {
    isProjectManagerPageOpen.value = true;
});

</script>
<template>
    <div class="app-container">
        <aside v-if="!isProjectManagerPageOpen && currentProjectId" class="app-sidebar">
            <div class="sidebar-toolbar">
                <div class="sidebar-header">
                    <div class="sidebar-title-wrap">
                        <p class="sidebar-title">Workflow Tools</p>
                    </div>
                    <div class="add-menu-container">
                        <button @click.stop="isAddMenuOpen = !isAddMenuOpen" class="btn btn-primary">
                            <Plus :size="16" />
                            <span>Add Node</span>
                        </button>

                        <div v-if="isAddMenuOpen" class="dropdown-menu custom-scrollbar">
                            <div class="dropdown-header">Add New Node</div>
                            <button @click="addNode('start')" class="menu-item">
                                <Zap :size="14" class="text-amber-500" />
                                <span>Start Automation</span>
                            </button>
                            <div class="menu-divider"></div>
                            <button @click="addNode('imageInput')" class="menu-item">
                                <Plus :size="14" />
                                <span>Image Input</span>
                            </button>
                            <button @click="addNode('videoInput')" class="menu-item">
                                <Plus :size="14" />
                                <span>Video Input</span>
                            </button>
                            <button @click="addNode('imageGen')" class="menu-item">
                                <Plus :size="14" />
                                <span>Image Generation</span>
                            </button>
                            <button @click="addNode('videoGen')" class="menu-item">
                                <Plus :size="14" />
                                <span>Video Gen</span>
                            </button>
                            <button @click="addNode('klingMotion')" class="menu-item">
                                <Plus :size="14" />
                                <span>Kling Motion</span>
                            </button>
                            <button @click="addNode('aiCall')" class="menu-item">
                                <Cpu :size="14" class="text-blue-500" />
                                <span>Chat AI</span>
                            </button>
                            <button @click="addNode('source')" class="menu-item">
                                <Plus :size="14" />
                                <span>Source</span>
                            </button>
                            <div class="menu-divider"></div>
                            <button @click="addNode('videoPreview')" class="menu-item">
                                <Play :size="14" class="text-emerald-500" />
                                <span>Video Preview</span>
                            </button>
                            <div class="menu-divider"></div>
                            <button @click="addNode('textInput')" class="menu-item">
                                <Type :size="14" class="text-purple-500" />
                                <span>Text Variable</span>
                            </button>
                            <div class="menu-divider"></div>
                            <button @click="addNode('loopFlow')" class="menu-item">
                                <Repeat :size="14" class="text-cyan-500" />
                                <span>Loop Flow</span>
                            </button>
                            <button @click="addNode('loopEnd')" class="menu-item">
                                <Flag :size="14" class="text-zinc-400" />
                                <span>Loop End</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="sidebar-content custom-scrollbar">
                    <div class="action-buttons">
                        <div class="section-label">Project</div>
                        <button @click="isProjectManagerPageOpen = true" class="btn-icon btn-zinc"
                            title="Manage Projects">
                            <FolderOpen :size="18" />
                            <span class="btn-text">Projects</span>
                        </button>
                        <button @click="isRenderViewOpen = true" class="btn-icon btn-zinc" title="Render">
                            <Play :size="18" />
                            <span class="btn-text">Render</span>
                        </button>
                        <input type="file" ref="fileInputRef" style="display: none" accept=".json"
                            @change="importFlow" />

                        <div class="sidebar-divider"></div>

                        <button @click="triggerImport" class="btn-icon btn-zinc" title="Import JSON Structure">
                            <Upload :size="18" />
                            <span class="btn-text">Import</span>
                        </button>
                        <button @click="exportFlow" class="btn-icon btn-zinc" title="Export JSON Structure">
                            <Download :size="18" />
                            <span class="btn-text">Export</span>
                        </button>
                        <button
                            type="button"
                            class="btn-icon btn-zinc"
                            title="Cài đặt workflow"
                            @click="isWorkflowSettingsOpen = true"
                        >
                            <Settings :size="18" />
                            <span class="btn-text">Cài đặt</span>
                        </button>
                        <button type="button" class="btn-icon btn-zinc"
                            :class="{ 'btn-history-active': historyPanelOpen }" title="Show or hide edit history"
                            @click="historyPanelOpen = !historyPanelOpen">
                            <History :size="18" />
                            <span class="btn-text">History</span>
                        </button>

                    </div>
                </div>
            </div>
        </aside>

        <Teleport to="body">
            <aside
                v-show="historyPanelOpen && currentProjectId && isLoaded && !isProjectManagerPageOpen && !isRenderViewOpen"
                class="sidebar-history-panel custom-scrollbar" aria-label="Edit history">
                <div class="history-panel-header">
                    <span class="history-panel-title">Edit history</span>
                    <button type="button" class="history-panel-close" title="Close" aria-label="Close history"
                        @click="historyPanelOpen = false">
                        <X :size="16" />
                    </button>
                </div>
                <div class="history-panel-body">
                    <template v-if="flowHistoryEntries.length">
                        <button v-for="(entry, idx) in flowHistoryEntries" :key="entry.id" type="button"
                            class="history-row" @click="restoreFlowHistoryEntry(entry)">
                            <Clock :size="12" class="history-icon" />
                            <div class="history-row-text">
                                <span class="history-time">{{ formatHistoryTime(entry.at) }}</span>
                                <span class="history-meta">{{ entry.snapshot.nodes.length }} nodes · {{
                                    entry.snapshot.edges.length }} edges</span>
                                <span v-if="idx === 0" class="history-badge">Latest</span>
                            </div>
                        </button>
                    </template>
                    <p v-else class="history-empty">No snapshots yet.</p>
                    <p class="history-hint">Click a snapshot to restore it. The flow is saved to the server after
                        restore.</p>
                </div>
            </aside>
        </Teleport>

        <ProjectManagerPage v-if="isProjectManagerPageOpen || !currentProjectId" class="project-manager-shell"
            :current-project-id="currentProjectId" @load="handleProjectLoad" @create="handleProjectLoad"
            @delete="handleProjectDelete" @rename="handleProjectRename" />

        <RenderView v-else-if="isRenderViewOpen && currentProjectId" :source-assets="sourceAssets"
            :project-id="currentProjectId" @back="isRenderViewOpen = false" />

        <div class="canvas-container" v-else-if="isLoaded && currentProjectId">
            <VueFlow :nodes="nodes" :edges="edges" :node-types="nodeTypes" fit-view-on-init :min-zoom="0.05"
                :max-zoom="4">
                <Background variant="dots" :gap="22" color="#0a0a0c" pattern-color="rgba(255,255,255,0.06)" />
                <Controls class="vue-flow-controls" />

                <template #node-start="props">
                    <StartNode v-bind="props" @delete="deleteNode" />
                </template>
                <template #node-imageInput="props">
                    <ImageInputNode v-bind="props" @delete="deleteNode" />
                </template>
                <template #node-videoInput="props">
                    <VideoInputNode v-bind="props" @delete="deleteNode" />
                </template>
                <template #node-imageGen="props">
                    <ImageGenNode v-bind="props" :viewport-aspect="flowGenViewportAspect" @delete="deleteNode" />
                </template>
                <template #node-videoGen="props">
                    <VideoGenNode v-bind="props" :viewport-aspect="flowGenViewportAspect" @delete="deleteNode" />
                </template>
                <template #node-klingMotion="props">
                    <KlingMotionNode v-bind="props" :viewport-aspect="flowGenViewportAspect" @delete="deleteNode" />
                </template>
                <template #node-source="props">
                    <SourceNode v-bind="props" @delete="deleteNode" />
                </template>
                <template #node-videoPreview="props">
                    <VideoPreviewNode v-bind="props" :viewport-aspect="flowGenViewportAspect" @delete="deleteNode" />
                </template>
                <template #node-textInput="props">
                    <TextInputNode v-bind="props" @delete="deleteNode" />
                </template>
                <template #node-aiCall="props">
                    <AiCallNode v-bind="props" @delete="deleteNode" />
                </template>
                <template #node-loopFlow="props">
                    <LoopFlowNode v-bind="props" @delete="deleteNode" />
                </template>
                <template #node-loopEnd="props">
                    <LoopEndNode v-bind="props" @delete="deleteNode" />
                </template>

                <template #edge-default="{ id, sourceX, sourceY, targetX, targetY, markerEnd }">
                    <path 
                        :id="id" class="vue-flow__edge-path"
                        :d="`M ${sourceX},${sourceY} C ${sourceX + 50},${sourceY} ${targetX - 50},${targetY} ${targetX},${targetY}`"
                        :marker-end="markerEnd" />
                    <foreignObject :width="20" :height="20" :x="(sourceX + targetX) / 2 - 10"
                        :y="(sourceY + targetY) / 2 - 10" requiredExtensions="http://www.w3.org/1999/xhtml">
                        <div class="edge-delete-container">
                            <button class="edge-delete-btn" @click="deleteEdge(id)">
                                <Trash2 :size="25" />
                            </button>
                        </div>
                    </foreignObject>
                </template>

                <AiFlowPromptPanel
                    ref="aiFlowPromptPanelRef"
                    :busy="aiFlowBusy"
                    :error="aiFlowError"
                    :chat-turn="runAiFlowPromptChatTurn"
                    @build="runGeminiBuildNodes"
                    @open-structure-settings="isAiFlowStructureSettingsOpen = true"
                />
            </VueFlow>
        </div>

        <FlowWorkflowSettingsPopup
            v-model:open="isWorkflowSettingsOpen"
            v-model:defaults="workflowDefaults"
            :video-model-options="workflowVideoModelOptions"
            @clear-results="clearAllResults"
            @clear-flow="clearFlow"
        />

        <AiFlowStructureSettingsPopup
            v-model:open="isAiFlowStructureSettingsOpen"
            @saved="aiFlowPromptPanelRef?.reloadStructures?.()"
        />

        <ProjectModal :is-open="isProjectModalOpen" :current-project-id="currentProjectId"
            @close="isProjectModalOpen = false" @load="handleProjectLoad" @create="handleProjectCreate"
            @delete="handleProjectDelete" @rename="handleProjectRename" />

        <!-- Global Image Modal -->
        <Transition name="fade">
            <div v-if="isImageModalOpen" class="image-modal-overlay" @click="isImageModalOpen = false">
                <div class="image-modal-content" @click.stop>
                    <button class="close-modal-btn" @click="isImageModalOpen = false">
                        <X :size="24" />
                    </button>
                    <video
                        v-if="modalImageUrl.includes('.mp4') || modalImageUrl.includes('video') || modalImageUrl.startsWith('blob:')"
                        :src="modalImageUrl" controls autoplay class="enlarged-video"></video>
                    <img v-else :src="modalImageUrl" alt="Enlarged view" class="enlarged-image" />
                    <div class="modal-actions">
                        <a :href="modalImageUrl" target="_blank" class="download-link">
                            <Maximize2 :size="16" /> Open Original
                        </a>
                    </div>
                </div>
            </div>
        </Transition>

        <!-- AI Call Modal -->
        <Transition name="fade">
            <div v-if="isAiCallModalOpen" class="modal-overlay" @click="isAiCallModalOpen = false">
                <div class="modal-container ai-call-modal" @click.stop>
                    <div class="modal-header">
                        <div class="header-title">
                            <Cpu :size="20" class="icon" />
                            <h2>Quick AI Call</h2>
                        </div>
                        <button @click="isAiCallModalOpen = false" class="close-btn">
                            <X :size="20" />
                        </button>
                    </div>
                    <div class="modal-body">
                        <div class="input-group mb-4">
                            <label class="label">Prompt</label>
                            <textarea v-model="aiCallPrompt" class="textarea"
                                placeholder="Ask AI something..."></textarea>
                        </div>
                        <div v-if="aiCallResult" class="result-box custom-scrollbar">
                            <div class="result-label">AI Response:</div>
                            <div class="result-content">{{ aiCallResult }}</div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button @click="handleAiCall" class="btn btn-primary w-full"
                            :disabled="aiCallStatus === 'running'">
                            <Loader2 v-if="aiCallStatus === 'running'" :size="16" class="node-gen-spin" />
                            <span v-else>Send Request</span>
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<style scoped>
.app-container {
    width: 100%;
    height: 100vh;
    background-color: #09090b;
    color: #f4f4f5;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

/* Project Manager fills remaining space under app-container */
.project-manager-shell {
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    max-width: none;
    align-self: stretch;
    overflow: hidden;
}

.app-sidebar {
    width: 100%;
    height: auto;
    background:
        radial-gradient(80% 120% at 0% 0%, rgba(250, 204, 21, 0.12), transparent 55%),
        linear-gradient(180deg, #111217 0%, #0c0c0f 100%);
    border-bottom: 1px solid #2a2d36;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.4rem;
    z-index: 1000;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
    padding: 0.7rem 0.9rem 0.9rem;
}

.sidebar-toolbar {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 0.7rem;
    flex-wrap: wrap;
}

.sidebar-auto-save {
    font-size: 0.67rem;
    color: rgba(228, 228, 231, 0.92);
    padding: 0;
    line-height: 1.25;
    background: transparent;
    border: none;
    border-radius: 0;
    position: fixed;
    left: 20px;
    bottom: 20px;
    z-index: 2600;
    pointer-events: none;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.55);
}

/* Floating edit history (teleported to body, right rail 300px) */
.sidebar-history-panel {
    position: fixed;
    top: 4.85rem;
    right: 0;
    width: 300px;
    max-width: 100vw;
    max-height: calc(100vh - 4.85rem);
    z-index: 2500;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 0;
    margin: 0;
    background: linear-gradient(180deg, #141418 0%, #0c0c0f 100%);
    border: 1px solid #2a2d36;
    border-right: none;
    border-radius: 14px 0 0 14px;
    box-shadow: -18px 0 48px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0, 0, 0, 0.35);
    box-sizing: border-box;
}

.history-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.55rem 0.65rem 0.5rem;
    border-bottom: 1px solid #27272a;
    flex-shrink: 0;
    background: rgba(9, 9, 11, 0.65);
}

.history-panel-title {
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #d4d4d8;
}

.history-panel-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.85rem;
    height: 1.85rem;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: #a1a1aa;
    cursor: pointer;
    transition: color 0.15s ease, background 0.15s ease;
}

.history-panel-close:hover {
    color: #fafafa;
    background: #27272a;
}

.history-panel-body {
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0.4rem 0.45rem 0.55rem;
    flex: 1;
    min-height: 0;
}

.history-row {
    display: flex;
    align-items: flex-start;
    gap: 0.4rem;
    width: 100%;
    padding: 0.4rem 0.45rem;
    margin-bottom: 0.2rem;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: inherit;
    cursor: pointer;
    text-align: left;
    font: inherit;
    transition: background 0.15s ease, border-color 0.15s ease;
}

.history-row:hover {
    background: #141418;
    border-color: #27272a;
}

.history-icon {
    flex-shrink: 0;
    color: #52525b;
    margin-top: 0.1rem;
}

.history-row-text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
}

.history-time {
    font-size: 0.72rem;
    font-weight: 700;
    color: #e4e4e7;
}

.history-meta {
    font-size: 0.65rem;
    color: #71717a;
}

.history-badge {
    font-size: 0.58rem;
    font-weight: 800;
    color: #eab308;
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.history-empty {
    font-size: 0.7rem;
    color: #52525b;
    margin: 0.35rem 0.25rem;
}

.history-hint {
    font-size: 0.6rem;
    color: #52525b;
    margin: 0.35rem 0.25rem 0.15rem;
    line-height: 1.35;
}

.btn-history-active {
    border-color: #ca8a04 !important;
    color: #facc15 !important;
    box-shadow: 0 0 0 1px rgba(250, 204, 21, 0.2);
}

.sidebar-header {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    min-width: 0;
}

.sidebar-title-wrap {
    display: flex;
    align-items: baseline;
    gap: 0.45rem;
    min-width: 0;
    white-space: nowrap;
}

.sidebar-title {
    margin: 0;
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #f4f4f5;
}

.sidebar-subtitle {
    margin: 0;
    font-size: 0.63rem;
    color: #71717a;
    line-height: 1;
    opacity: 0.95;
}

.sidebar-content {
    padding: 0;
    display: flex;
    align-items: center;
    width: auto;
}

.sidebar-divider {
    width: 1px;
    height: 1.55rem;
    background: linear-gradient(180deg, transparent, #2f2f35, transparent);
    margin: 0 0.3rem;
}

.section-label {
    display: block;
    font-size: 0.6rem;
    font-weight: 800;
    color: #a1a1aa;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    white-space: nowrap;
    padding: 0.18rem 0.4rem;
    border: 1px solid #2a2d36;
    border-radius: 999px;
    background: rgba(24, 24, 27, 0.62);
}

.action-buttons {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 0.45rem;
    flex-wrap: wrap;
    width: 100%;
    padding: 0.5rem 0.55rem;
    border: 1px solid #27272f;
    border-radius: 0.85rem;
    background: rgba(9, 9, 11, 0.55);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
    overflow-x: auto;
    max-width: 100%;
}

.btn-text {
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    white-space: nowrap;
}

.add-menu-container {
    position: relative;
    flex: 1;
}

.dropdown-menu {
    position: absolute;
    top: 0;
    left: calc(100% + 1rem);
    width: 16rem;
    background-color: #18181b;
    border: 1px solid #27272a;
    border-radius: 1rem;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    padding: 0.6rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    z-index: 2000;
    animation: slideInRight 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    max-height: 80vh;
    overflow-y: auto;
}

.dropdown-header {
    font-size: 0.7rem;
    font-weight: 800;
    color: #52525b;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.25rem;
}

@keyframes slideInRight {
    from {
        opacity: 0;
        transform: translateX(-10px);
    }

    to {
        opacity: 1;
        transform: translateX(0);
    }
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.menu-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #a1a1aa;
    background: none;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
}

.menu-item:hover {
    background-color: #27272a;
    color: #f4f4f5;
}

.menu-divider {
    height: 1px;
    background-color: #27272a;
    margin: 0.25rem 0.5rem;
}

.btn {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.62rem 0.92rem;
    border-radius: 0.68rem;
    font-size: 0.8125rem;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
}

.btn-primary {
    background: linear-gradient(135deg, #facc15 0%, #ca8a04 100%);
    color: #111318;
    box-shadow: 0 8px 20px rgba(250, 204, 21, 0.28);
}

.btn-primary:hover {
    background: linear-gradient(135deg, #fde047 0%, #eab308 100%);
    transform: translateY(-1px);
    box-shadow: 0 12px 24px rgba(250, 204, 21, 0.34);
}

.btn-zinc {
    background-color: #18181b;
    color: #a1a1aa;
    border: 1px solid #27272a;
}

.btn-zinc:hover {
    background-color: #27272a;
    color: #f4f4f5;
}

.mr-2 {
    margin-right: 0.5rem;
}

.w-full {
    width: 100%;
}

.mb-4 {
    margin-bottom: 1rem;
}

.ai-call-modal {
    max-width: 36rem !important;
}

.result-box {
    background-color: #0c0c0e;
    border: 1px solid #27272a;
    border-radius: 1rem;
    padding: 1.25rem;
    max-height: 15rem;
    overflow-y: auto;
}

.result-label {
    font-size: 0.7rem;
    font-weight: 800;
    color: var(--color-accent-strong);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 0.75rem;
}

.result-content {
    font-size: 0.875rem;
    color: #d4d4d8;
    line-height: 1.6;
    white-space: pre-wrap;
}

.modal-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1.5rem;
}

.modal-container {
    background-color: #09090b;
    border: 1px solid #27272a;
    width: 100%;
    max-width: 32rem;
    border-radius: 1.5rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    max-height: 85vh;
    overflow: hidden;
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #18181b;
    background-color: #0c0c0e;
}

.header-title {
    display: flex;
    align-items: center;
    gap: 1.25rem;
}

.header-title h2 {
    font-size: 1.125rem;
    font-weight: 800;
    color: #f4f4f5;
    letter-spacing: -0.02em;
}

.icon {
    color: var(--color-accent-strong);
}

.close-btn {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.75rem;
    color: #71717a;
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}

.close-btn:hover {
    color: #f4f4f5;
    background-color: #18181b;
    border-color: #27272a;
}

.modal-body {
    padding: 2rem;
    overflow-y: auto;
}

.modal-footer {
    padding: 1.5rem 2rem;
    border-top: 1px solid #18181b;
    background-color: #0c0c0e;
}

.label {
    font-size: 0.7rem;
    font-weight: 800;
    color: #3f3f46;
    text-transform: uppercase;
    letter-spacing: 0.15em;
    margin-bottom: 0.75rem;
    display: block;
}

.select {
    width: 100%;
    background-color: #0c0c0e;
    border: 1px solid #27272a;
    border-radius: 1rem;
    padding: 0.875rem 1.25rem;
    font-size: 0.9375rem;
    color: #f4f4f5;
    outline: none;
}

.textarea {
    width: 100%;
    background-color: #0c0c0e;
    border: 1px solid #27272a;
    border-radius: 1rem;
    padding: 1rem 1.25rem;
    font-size: 0.9375rem;
    color: #f4f4f5;
    outline: none;
    min-height: 8rem;
    resize: vertical;
}

.textarea:focus,
.select:focus {
    border-color: var(--color-accent-strong);
    box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.1);
}

.btn-icon {
    padding: 0.6rem 0.8rem;
    border-radius: 0.625rem;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid #2f2f36;
    background: linear-gradient(180deg, #202026 0%, #17171c 100%);
    color: #d4d4d8;
    display: flex;
    align-items: center;
    gap: 0.875rem;
    width: auto;
    flex: 0 0 auto;
}

.btn-icon:hover {
    background: linear-gradient(180deg, #2a2a31 0%, #1f1f24 100%);
    color: #fff;
    border-color: #3a3a44;
}

.btn-icon.btn-primary {
    background-color: rgba(14, 165, 233, 0.1);
    color: var(--color-accent-strong);
    border-color: rgba(255, 202, 42, 0.2);
}

.btn-icon.btn-primary:hover {
    background-color: rgba(255, 202, 42, 0.2);
    color: #38bdf8;
}

.btn-icon.btn-red {
    background-color: rgba(239, 68, 68, 0.05);
    color: #f87171;
}

.btn-icon.btn-red:hover {
    background-color: rgba(239, 68, 68, 0.15);
    color: #ef4444;
}

.btn-red {
    background-color: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.2);
}

.btn-red:hover {
    background-color: #ef4444;
    color: white;
    border-color: #ef4444;
}

.divider {
    width: 1px;
    height: 1rem;
    background-color: #27272a;
    margin: 0 0.25rem;
}

.canvas-container {
    flex: 1;
    position: relative;
    background-color: #ffffff;
}

.vue-flow-controls {
    background-color: #18181b;
    border: 1px solid #27272a;
    border-radius: 0.75rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    padding: 0.25rem;
    fill: #f4f4f5;
}

/* Image Modal Styles */
.image-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(8px);
}

.image-modal-content {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
}

.enlarged-image,
.enlarged-video {
    max-width: 100%;
    max-height: 80vh;
    object-fit: contain;
    border-radius: 0.5rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    border: 1px solid #27272a;
}

.close-modal-btn {
    position: absolute;
    top: -3rem;
    right: 0;
    background: none;
    border: none;
    color: #a1a1aa;
    cursor: pointer;
    transition: all 0.2s;
}

.close-modal-btn:hover {
    color: white;
    transform: scale(1.1);
}

.modal-actions {
    display: flex;
    gap: 1rem;
}

.download-link {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: #27272a;
    color: #f4f4f5;
    text-decoration: none;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    transition: all 0.2s;
    border: 1px solid #3f3f46;
}

.download-link:hover {
    background-color: #3f3f46;
    border-color: #52525b;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

/* Node: tránh mờ chữ/UI khi zoom out (scale trên viewport + backdrop-filter = hay bị nhòe) */
:deep(.vue-flow__node) {
    padding: 0;
    border: none;
    background: transparent;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: geometricPrecision;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
}

:deep(.vue-flow__viewport) {
    /* Gợn sóng scale mượt hơn, giảm nhòe một phần trên Chromium */
    -webkit-font-smoothing: antialiased;
}

:deep(.vue-flow__handle) {
    width: 22px;
    height: 22px;
    min-width: 22px;
    min-height: 22px;
    border-radius: 50%;
    background: #141418 !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.45);
}

:deep(.vue-flow__handle:hover) {
    border-color: rgba(250, 204, 21, 0.55) !important;
    background: #1c1c22 !important;
}

.edge-delete-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
}

.edge-delete-btn {
    width: 38px;
    height: 38px;
    border: 1px solid #27272a;
    color: #ff0c0c;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    pointer-events: all;
    background: transparent;
}

.edge-delete-btn:hover {
    background-color: #ef4444;
    color: white;
    border-color: #ef4444;
    transform: scale(1.1);
}
</style>
