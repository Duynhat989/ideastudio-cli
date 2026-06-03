<script setup>
import { ref, watch, nextTick, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Panel } from '@vue-flow/core';
import { ChevronDown, Loader2, SendHorizontal, ImagePlus, X, Settings } from 'lucide-vue-next';
import aiPromptBrand from '@/assets/aiprompt.png';
import {
    loadAiFlowStructures,
    getActiveStructureId,
    setActiveStructureId,
    getActiveStructure,
} from '@/services/aiFlowNodeStructures.js';

const { t } = useI18n();
const MAX_CHAT_IMAGES = 3;
const AI_FLOW_INPUT_K_STORAGE = 'ai_flow_image_input_k';

const props = defineProps({
    busy: { type: Boolean, default: false },
    error: { type: String, default: '' },
    /** ({ transcript, userMessage, imageUrls, onChunk? }) => Promise<string> */
    chatTurn: {
        type: Function,
        required: true,
    },
});

const emit = defineEmits(['build', 'open-structure-settings']);

const structures = ref([]);
const activeStructureId = ref(getActiveStructureId());

const activeStructure = computed(
    () => structures.value.find((s) => s.id === activeStructureId.value) || getActiveStructure(),
);
const maxImageInputSlots = computed(() =>
    Math.min(12, Math.max(1, Number(activeStructure.value?.maxImageInputs) || 8)),
);
const clipSecondsHint = computed(() => Number(activeStructure.value?.clipSeconds) || 8);

const reloadStructures = () => {
    structures.value = loadAiFlowStructures();
    activeStructureId.value = getActiveStructureId();
};

onMounted(reloadStructures);

watch(activeStructureId, (id) => {
    setActiveStructureId(id);
    const max = maxImageInputSlots.value;
    if (imageInputCount.value > max) imageInputCount.value = max;
});

const onStructureSettingsOpen = () => {
    emit('open-structure-settings');
};

const clampInputK = (v, max = 8) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return 1;
    return Math.min(max, Math.max(1, Math.round(n)));
};

const imageInputCount = ref(
    clampInputK(Number(localStorage.getItem(AI_FLOW_INPUT_K_STORAGE) || '1'), maxImageInputSlots.value),
);
watch(imageInputCount, (k) => {
    localStorage.setItem(AI_FLOW_INPUT_K_STORAGE, String(clampInputK(k, maxImageInputSlots.value)));
});
watch(maxImageInputSlots, (max) => {
    if (imageInputCount.value > max) imageInputCount.value = max;
});

const expanded = ref(false);
/** @type {import('vue').Ref<Array<{ id: string, role: 'user' | 'assistant', text: string, images?: string[] }>>} */
const messages = ref([]);
const draft = ref('');
/** @type {import('vue').Ref<Array<{ id: string, dataUrl: string, name: string }>>} */
const pendingImages = ref([]);
const threadEl = ref(null);
const fileInputRef = ref(null);

const hasChat = computed(() => messages.value.length > 0);
const canSend = computed(() => {
    if (props.busy) return false;
    return Boolean(draft.value.trim()) || pendingImages.value.length > 0;
});

const scrollThreadToBottom = async () => {
    await nextTick();
    const el = threadEl.value;
    if (el) el.scrollTop = el.scrollHeight;
};

watch(messages, () => scrollThreadToBottom(), { deep: true });

const messageToTranscriptLine = (m) => {
    const who = m.role === 'user' ? 'User' : 'Trợ lý';
    let t = (m.text || '').trim();
    if (m.role === 'user' && m.images?.length) {
        const note = `(Đính kèm ${m.images.length} ảnh trong lượt này.)`;
        t = t ? `${t}\n${note}` : note;
    }
    return `${who}: ${t || '(trống)'}`;
};

const buildScriptFromChat = () => {
    if (!messages.value.length) return '';
    const blocks = messages.value.map((m, i) => {
        const who = m.role === 'user' ? 'User' : 'Trợ lý';
        let body = (m.text || '').trim();
        if (m.role === 'user' && m.images?.length) {
            body = body ? `${body}\n` : '';
            body += `(Đính kèm ${m.images.length} ảnh.)`;
        }
        return `[${i + 1}] ${who}:\n${body || '(trống)'}`;
    });
    return [
        ...blocks,
        '',
        '---',
        'Hãy thiết kế workflow (Vue Flow) dựa trên thỏa thuận / ý tưởng cuối trong hội thoại trên.',
    ].join('\n');
};

const triggerFilePick = () => {
    fileInputRef.value?.click();
};

const removePendingImage = (id) => {
    pendingImages.value = pendingImages.value.filter((p) => p.id !== id);
};

const onFileInputChange = (e) => {
    const input = e.target;
    const files = input.files;
    if (!files?.length) return;
    const room = MAX_CHAT_IMAGES - pendingImages.value.length;
    const list = Array.from(files)
        .filter((f) => f.type.startsWith('image/'))
        .slice(0, Math.max(0, room));
    for (const file of list) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = typeof reader.result === 'string' ? reader.result : '';
            if (!dataUrl) return;
            pendingImages.value.push({
                id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                dataUrl,
                name: file.name || 'image',
            });
        };
        reader.readAsDataURL(file);
    }
    input.value = '';
};

const sendChat = async () => {
    if (!canSend.value) return;
    const text = draft.value.trim();
    const snapshot = pendingImages.value.map((p) => ({ ...p }));
    const imageUrls = snapshot.map((p) => p.dataUrl);
    const transcript = messages.value.map(messageToTranscriptLine).join('\n\n');
    draft.value = '';
    pendingImages.value = [];
    const userMsg = {
        id: `u-${Date.now()}`,
        role: 'user',
        text,
        images: imageUrls.length ? [...imageUrls] : undefined,
    };
    messages.value.push(userMsg);
    await scrollThreadToBottom();
    try {
        const assistantId = `a-${Date.now()}`;
        messages.value.push({
            id: assistantId,
            role: 'assistant',
            text: '',
        });
        const reply = await props.chatTurn({
            transcript,
            userMessage: text || '(User chỉ gửi ảnh, không có chữ — hãy phân tích ảnh và đề xuất kịch bản.)',
            imageUrls,
            onChunk: async (fullText) => {
                const msg = messages.value.find((m) => m.id === assistantId);
                if (!msg) return;
                msg.text = fullText || '';
                await scrollThreadToBottom();
            },
        });
        const msg = messages.value.find((m) => m.id === assistantId);
        if (msg) msg.text = (reply || '').trim() || '(Trống)';
    } catch {
        messages.value.pop();
        if (messages.value[messages.value.length - 1]?.role === 'assistant' && !messages.value[messages.value.length - 1]?.text) {
            messages.value.pop();
        }
        draft.value = text;
        pendingImages.value = snapshot;
    }
};

const onComposeKeydown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    if (canSend.value) sendChat();
};

const emitBuild = () => {
    const script = buildScriptFromChat();
    if (!script.trim()) return;
    emit('build', { script, imageInputCount: clampInputK(imageInputCount.value, maxImageInputSlots.value) });
};

defineExpose({ reloadStructures });
</script>

<template>
    <Panel position="bottom-right" class="ai-flow-vue-panel" :class="{ 'is-expanded': expanded }">
        <button
            v-if="!expanded"
            type="button"
            class="ai-flow-fab"
            aria-label="Mở chat ý tưởng"
            @click.stop="expanded = true"
        >
            <img :src="aiPromptBrand" alt="" class="ai-flow-fab-img" />
        </button>

        <div v-else class="ai-flow-card">
            <div class="ai-flow-card-head">
                <span class="ai-flow-head-title">{{ t('flow.ideaPanelTitle') }}</span>
                <div class="ai-flow-head-actions">
                    <button
                        type="button"
                        class="ai-flow-head-icon"
                        :aria-label="t('flow.structureSettingsTitle')"
                        :title="t('flow.structureSettingsTitle')"
                        @click="onStructureSettingsOpen"
                    >
                        <Settings :size="16" />
                    </button>
                    <button type="button" class="ai-flow-collapse" aria-label="Thu gọn" @click="expanded = false">
                        <ChevronDown :size="18" class="ai-flow-collapse-icon" />
                    </button>
                </div>
            </div>

            <div class="ai-flow-structure-row">
                <label class="ai-flow-opt-label" for="ai-flow-structure">
                    Cấu trúc
                    <select
                        id="ai-flow-structure"
                        v-model="activeStructureId"
                        class="ai-flow-input-k-select ai-flow-structure-select"
                        :disabled="busy"
                        @focus="reloadStructures"
                    >
                        <option v-for="s in structures" :key="s.id" :value="s.id">{{ s.name }}</option>
                    </select>
                </label>
            </div>

            <div ref="threadEl" class="ai-flow-thread custom-scrollbar">
                <p v-if="!messages.length" class="ai-flow-empty">
                    <span v-html="t('flow.ideaPanelHint', { max: MAX_CHAT_IMAGES })"></span>
                </p>
                <div
                    v-for="m in messages"
                    :key="m.id"
                    class="ai-flow-msg"
                    :class="m.role === 'user' ? 'ai-flow-msg--user' : 'ai-flow-msg--assistant'"
                >
                    <span class="ai-flow-msg-label">{{ m.role === 'user' ? 'Bạn' : 'AI' }}</span>
                    <div v-if="m.images?.length" class="ai-flow-msg-images">
                        <img v-for="(src, idx) in m.images" :key="idx" :src="src" alt="" class="ai-flow-thumb" />
                    </div>
                    <div v-if="m.text?.trim()" class="ai-flow-msg-bubble">{{ m.text }}</div>
                    <div
                        v-else-if="m.role === 'user' && m.images?.length"
                        class="ai-flow-msg-bubble ai-flow-msg-bubble--muted"
                    >
                        (Chỉ ảnh)
                    </div>
                </div>
            </div>

            <div class="ai-flow-compose-wrap">
                <div v-if="pendingImages.length" class="ai-flow-pending-row">
                    <div v-for="p in pendingImages" :key="p.id" class="ai-flow-pending-item">
                        <img :src="p.dataUrl" alt="" class="ai-flow-pending-thumb" />
                        <button type="button" class="ai-flow-pending-remove" :disabled="busy" @click="removePendingImage(p.id)">
                            <X :size="12" />
                        </button>
                    </div>
                </div>
                <div class="ai-flow-compose">
                    <input
                        ref="fileInputRef"
                        type="file"
                        class="ai-flow-file-input"
                        accept="image/*"
                        multiple
                        :disabled="busy"
                        @change="onFileInputChange"
                    />
                    <button
                        type="button"
                        class="ai-flow-attach"
                        :disabled="busy || pendingImages.length >= MAX_CHAT_IMAGES"
                        :title="t('flow.attachImages')"
                        @click="triggerFilePick"
                    >
                        <ImagePlus :size="18" />
                    </button>
                    <textarea
                        v-model="draft"
                        class="ai-flow-compose-input"
                        rows="2"
                        placeholder="Nhập ý tưởng… (Enter gửi, Shift+Enter xuống dòng). Có thể chỉ gửi ảnh."
                        :disabled="busy"
                        @keydown="onComposeKeydown"
                    />
                    <button type="button" class="ai-flow-send" :disabled="!canSend" @click="sendChat">
                        <Loader2 v-if="busy" :size="16" class="node-gen-spin" />
                        <SendHorizontal v-else :size="16" />
                    </button>
                </div>
            </div>

            <div class="ai-flow-options-row">
                <label class="ai-flow-opt-label" for="ai-flow-input-k">
                    Ảnh đầu vào (canvas)
                    <select
                        id="ai-flow-input-k"
                        v-model.number="imageInputCount"
                        class="ai-flow-input-k-select"
                        :disabled="busy"
                    >
                        <option v-for="n in maxImageInputSlots" :key="n" :value="n">{{ n }} ô</option>
                    </select>
                </label>
                <span class="ai-flow-opt-hint">{{ t('flow.createNodesHint') }}</span>
            </div>

            <button
                type="button"
                class="ai-flow-btn ai-flow-btn-primary ai-flow-btn-build"
                :disabled="busy || !hasChat"
                @click="emitBuild"
            >
                <Loader2 v-if="busy" :size="14" class="node-gen-spin" />
                <span v-else>{{ t('flow.createNodesOnCanvas') }}</span>
            </button>

            <p v-if="error" class="ai-flow-err">{{ error }}</p>
            <p class="ai-flow-hint">
                Cấu trúc <b>{{ activeStructure.name }}</b> — {{ activeStructure.description || 'Tùy chỉnh prompt sinh node.' }}
                Ảnh đầu vào = số ô <b>imageInput</b>. Video Gen ≈ <b>{{ clipSecondsHint }}s</b>. Cần <b>Gemini</b> trong Setup.
            </p>
        </div>
    </Panel>
</template>

<style scoped>
.ai-flow-vue-panel:not(.is-expanded) {
    margin: 1.15rem !important;
    padding: 0 !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    backdrop-filter: none !important;
}

.ai-flow-vue-panel.is-expanded {
    margin: 1.15rem;
}

.ai-flow-fab {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3.5rem;
    height: 3.5rem;
    padding: 0;
    border: 2px solid rgba(255, 255, 255, 0.85);
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.14);
    cursor: pointer;
    box-sizing: border-box;
    box-shadow: 0 10px 26px rgba(0, 0, 0, 0.4), 0 0 0 3px rgba(234, 179, 8, 0.18);
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.ai-flow-fab:hover {
    transform: scale(1.06);
    background: rgba(255, 255, 255, 0.22);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.48), 0 0 0 4px rgba(234, 179, 8, 0.26);
}

.ai-flow-fab:focus-visible {
    outline: 2px solid #eab308;
    outline-offset: 3px;
}

.ai-flow-fab-img {
    width: 3.25rem;
    height: 3.25rem;
    object-fit: contain;
    border-radius: 50%;
    filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.45));
    pointer-events: none;
}

.ai-flow-card {
    width: min(27rem, calc(100vw - 2rem));
    min-height: min(72vh, 38rem);
    max-height: min(90vh, 52rem);
    display: flex;
    flex-direction: column;
    background: #ffffff;
    border: 1px solid #e4e4e7;
    border-radius: 1rem;
    box-shadow: 0 22px 48px -14px rgba(15, 23, 42, 0.28), 0 8px 18px rgba(15, 23, 42, 0.12);
    overflow: hidden;
}

.ai-flow-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.55rem 0.65rem 0.5rem;
    border-bottom: 1px solid #e4e4e7;
    flex-shrink: 0;
}

.ai-flow-head-title {
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #52525b;
}

.ai-flow-head-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.ai-flow-head-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: #71717a;
    cursor: pointer;
}

.ai-flow-head-icon:hover {
    color: #ca8a04;
    background: #fffbeb;
}

.ai-flow-structure-row {
    padding: 0.45rem 0.75rem 0.35rem;
    border-bottom: 1px solid #f4f4f5;
    flex-shrink: 0;
}

.ai-flow-structure-select {
    max-width: 11rem;
}

.ai-flow-collapse {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border: none;
    border-radius: 0.5rem;
    background: transparent;
    color: #52525b;
    cursor: pointer;
}

.ai-flow-collapse:hover {
    color: #111827;
    background: #f4f4f5;
}

.ai-flow-collapse-icon {
    transform: rotate(180deg);
}

.ai-flow-thread {
    flex: 1;
    min-height: 18rem;
    max-height: min(62vh, 38rem);
    overflow-y: auto;
    padding: 0.75rem 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    scrollbar-width: thin;
    scrollbar-color: #a1a1aa transparent;
}

.ai-flow-empty {
    font-size: 0.72rem;
    color: #52525b;
    line-height: 1.45;
    margin: 0.25rem 0 0;
}

.ai-flow-msg {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    max-width: 92%;
}

.ai-flow-msg--user {
    align-self: flex-end;
    align-items: flex-end;
}

.ai-flow-msg--assistant {
    align-self: flex-start;
    align-items: flex-start;
}

.ai-flow-msg-label {
    font-size: 0.58rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #71717a;
}

.ai-flow-msg-images {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    justify-content: flex-end;
}

.ai-flow-msg--assistant .ai-flow-msg-images {
    justify-content: flex-start;
}

.ai-flow-thumb {
    width: 3.25rem;
    height: 3.25rem;
    object-fit: cover;
    border-radius: 0.45rem;
    border: 1px solid #d4d4d8;
}

.ai-flow-msg-bubble {
    font-size: 0.78rem;
    line-height: 1.45;
    padding: 0.45rem 0.55rem;
    border-radius: 0.65rem;
    white-space: pre-wrap;
    word-break: break-word;
}

.ai-flow-msg-bubble--muted {
    font-style: italic;
    opacity: 0.85;
}

.ai-flow-msg--user .ai-flow-msg-bubble {
    background: #fef3c7;
    color: #111827;
    border: 1px solid #fcd34d;
}

.ai-flow-msg--assistant .ai-flow-msg-bubble {
    background: #f8fafc;
    color: #0f172a;
    border: 1px solid #e4e4e7;
}

.ai-flow-compose-wrap {
    border-top: 1px solid #e4e4e7;
    flex-shrink: 0;
    background: linear-gradient(180deg, #ffffff 0%, #fafafa 100%);
}

.ai-flow-pending-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding: 0.45rem 0.65rem 0;
}

.ai-flow-pending-item {
    position: relative;
    width: 2.75rem;
    height: 2.75rem;
}

.ai-flow-pending-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 0.4rem;
    border: 1px solid #d4d4d8;
}

.ai-flow-pending-remove {
    position: absolute;
    top: -0.2rem;
    right: -0.2rem;
    width: 1.15rem;
    height: 1.15rem;
    border: none;
    border-radius: 50%;
    background: #ffffff;
    color: #ef4444;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}

.ai-flow-pending-remove:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.ai-flow-compose {
    display: flex;
    gap: 0.35rem;
    padding: 0.6rem 0.75rem 0.72rem;
    align-items: flex-end;
}

.ai-flow-file-input {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    pointer-events: none;
}

.ai-flow-attach {
    flex-shrink: 0;
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.55rem;
    border: 1px solid #d4d4d8;
    background: #ffffff;
    color: #4f46e5;
    cursor: pointer;
}

.ai-flow-attach:hover:not(:disabled) {
    background: #f5f3ff;
    color: #4338ca;
}

.ai-flow-attach:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.ai-flow-compose-input {
    flex: 1;
    min-height: 2.5rem;
    max-height: 6rem;
    resize: vertical;
    border-radius: 0.6rem;
    border: 1px solid #d4d4d8;
    background: #ffffff;
    color: #111827;
    font-size: 0.78rem;
    line-height: 1.4;
    padding: 0.45rem 0.55rem;
    font-family: inherit;
    box-sizing: border-box;
}

.ai-flow-compose-input:focus {
    outline: none;
    border-color: #ca8a04;
    box-shadow: 0 0 0 2px rgba(234, 179, 8, 0.12);
}

.ai-flow-compose-input:disabled {
    opacity: 0.55;
}

.ai-flow-send {
    flex-shrink: 0;
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.55rem;
    border: 1px solid #d4d4d8;
    background: #ffffff;
    color: #ca8a04;
    cursor: pointer;
}

.ai-flow-send:hover:not(:disabled) {
    background: #fffbeb;
}

.ai-flow-send:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.ai-flow-options-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.35rem;
    padding: 0 0.75rem 0.65rem;
    border-top: 1px solid #e4e4e7;
    margin-top: 0.15rem;
}

.ai-flow-opt-label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.72rem;
    font-weight: 600;
    color: #3f3f46;
}

.ai-flow-input-k-select {
    min-width: 3.75rem;
    padding: 0.25rem 0.35rem;
    border: 1px solid #d4d4d8;
    border-radius: 0.4rem;
    font-size: 0.72rem;
    font-weight: 600;
    color: #18181b;
    background: #fafafa;
    cursor: pointer;
}

.ai-flow-input-k-select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.ai-flow-opt-hint {
    font-size: 0.6rem;
    color: #a1a1aa;
}

.ai-flow-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border-radius: 0.65rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.72rem;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid transparent;
    transition: opacity 0.15s ease, filter 0.15s ease;
}

.ai-flow-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.ai-flow-btn-primary {
    background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%);
    color: #111113;
    border-color: #a16207;
}

.ai-flow-btn-primary:hover:not(:disabled) {
    filter: brightness(1.05);
}

.ai-flow-btn-build {
    margin: 0 0.75rem 0.65rem;
}

.ai-flow-err {
    font-size: 0.68rem;
    color: #f87171;
    margin: 0 0.65rem;
    line-height: 1.35;
}

.ai-flow-hint {
    font-size: 0.6rem;
    color: #71717a;
    margin: 0 0.75rem 0.75rem;
    line-height: 1.4;
}

.ai-flow-thread::-webkit-scrollbar {
    width: 8px;
}

.ai-flow-thread::-webkit-scrollbar-track {
    background: transparent;
}

.ai-flow-thread::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, #a1a1aa 0%, #71717a 100%);
    border-radius: 999px;
    border: 1px solid rgba(228, 228, 231, 0.9);
}

.ai-flow-thread::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, #71717a 0%, #52525b 100%);
}
</style>

<style>
.vue-flow__panel.ai-flow-vue-panel:not(.is-expanded) {
    background: transparent !important;
    box-shadow: none !important;
    border: none !important;
    padding: 0 !important;
}
</style>
