<script setup>
import { ref, watch, computed } from 'vue';
import { Settings, X, Plus, Copy, Trash2, ChevronDown } from 'lucide-vue-next';
import {
    loadAiFlowStructures,
    saveAiFlowStructures,
    getActiveStructureId,
    setActiveStructureId,
    createEmptyStructure,
    duplicateStructure,
    BUILDER_TYPES,
    BUILTIN_STRUCTURES,
} from '@/services/aiFlowNodeStructures.js';

const open = defineModel('open', { type: Boolean, default: false });
const emit = defineEmits(['saved']);

const structures = ref([]);
const activeId = ref('');
const selectedId = ref('');
const expandedSection = ref('meta');

const selected = computed(() => structures.value.find((s) => s.id === selectedId.value) || null);
const isBuiltinSelected = computed(() => Boolean(selected.value?.isBuiltin));

const PROMPT_PLACEHOLDERS = [
    '{{clipSeconds}}',
    '{{imageInputCount}}',
    '{{script}}',
    '{{scriptSummary}}',
    '{{batchJson}}',
    '{{transcript}}',
    '{{userMessage}}',
    '{{imageNote}}',
];

const builderLabel = (b) => {
    if (b === BUILDER_TYPES.FULL_GRAPH) return 'Full graph (JSON một lần)';
    return 'Phased clips (2 phase + layout cố định)';
};

const reload = () => {
    structures.value = loadAiFlowStructures();
    activeId.value = getActiveStructureId();
    if (!structures.value.some((s) => s.id === selectedId.value)) {
        selectedId.value = activeId.value;
    }
};

watch(open, (v) => {
    if (v) reload();
});

const close = () => {
    open.value = false;
};

const persist = () => {
    saveAiFlowStructures(structures.value);
    setActiveStructureId(activeId.value);
};

const selectStructure = (id) => {
    selectedId.value = id;
    expandedSection.value = 'meta';
};

const setActive = (id) => {
    activeId.value = id;
    selectedId.value = id;
    persist();
};

const addStructure = () => {
    const row = createEmptyStructure();
    structures.value = [...structures.value, row];
    selectedId.value = row.id;
    persist();
};

const duplicateSelected = () => {
    if (!selected.value) return;
    const copy = duplicateStructure(selected.value);
    structures.value = [...structures.value, copy];
    selectedId.value = copy.id;
    persist();
};

const deleteSelected = () => {
    if (!selected.value || selected.value.isBuiltin) return;
    structures.value = structures.value.filter((s) => s.id !== selectedId.value);
    if (activeId.value === selectedId.value) {
        activeId.value = BUILTIN_STRUCTURES[0].id;
        setActiveStructureId(activeId.value);
    }
    selectedId.value = activeId.value;
    persist();
};

const resetBuiltinPrompts = () => {
    if (!selected.value?.isBuiltin) return;
    const original = BUILTIN_STRUCTURES.find((b) => b.id === selected.value.id);
    if (!original) return;
    const idx = structures.value.findIndex((s) => s.id === selected.value.id);
    if (idx < 0) return;
    structures.value[idx] = { ...JSON.parse(JSON.stringify(original)), isBuiltin: true };
    persist();
};

const onSave = () => {
    persist();
    emit('saved');
    close();
};

const linesToText = (lines) => (Array.isArray(lines) ? lines.join('\n') : '');
const textToLines = (text) =>
    String(text || '')
        .split('\n')
        .map((l) => l);

const updatePromptField = (field, text) => {
    if (!selected.value) return;
    const idx = structures.value.findIndex((s) => s.id === selectedId.value);
    if (idx < 0) return;
    structures.value[idx] = {
        ...structures.value[idx],
        [field]: textToLines(text),
    };
};
</script>

<template>
    <Teleport to="body">
        <div v-if="open" class="afs-overlay" @click="close">
            <div class="afs-panel" role="dialog" aria-labelledby="afs-title" @click.stop>
                <header class="afs-header">
                    <div class="afs-title-wrap">
                        <Settings :size="18" class="afs-title-icon" />
                        <h2 id="afs-title">Cấu trúc sinh node (AI chat)</h2>
                    </div>
                    <button type="button" class="afs-close" aria-label="Đóng" @click="close">
                        <X :size="18" />
                    </button>
                </header>

                <div class="afs-body">
                    <aside class="afs-list">
                        <div class="afs-list-head">
                            <span>Danh sách</span>
                            <button type="button" class="afs-icon-btn" title="Thêm cấu trúc" @click="addStructure">
                                <Plus :size="16" />
                            </button>
                        </div>
                        <ul class="afs-items">
                            <li v-for="s in structures" :key="s.id">
                                <button
                                    type="button"
                                    class="afs-item"
                                    :class="{
                                        'afs-item--selected': s.id === selectedId,
                                        'afs-item--active': s.id === activeId,
                                    }"
                                    @click="selectStructure(s.id)"
                                >
                                    <span class="afs-item-name">{{ s.name }}</span>
                                    <span class="afs-item-meta">{{ builderLabel(s.builder) }}</span>
                                    <span v-if="s.id === activeId" class="afs-badge">Đang dùng</span>
                                </button>
                            </li>
                        </ul>
                    </aside>

                    <div v-if="selected" class="afs-editor">
                        <div class="afs-toolbar">
                            <button
                                type="button"
                                class="afs-btn"
                                :class="{ 'afs-btn--primary': selected.id === activeId }"
                                @click="setActive(selected.id)"
                            >
                                Dùng cấu trúc này
                            </button>
                            <button type="button" class="afs-btn" @click="duplicateSelected">
                                <Copy :size="14" />
                                Nhân bản
                            </button>
                            <button
                                v-if="!isBuiltinSelected"
                                type="button"
                                class="afs-btn afs-btn--danger"
                                @click="deleteSelected"
                            >
                                <Trash2 :size="14" />
                                Xóa
                            </button>
                            <button
                                v-if="isBuiltinSelected"
                                type="button"
                                class="afs-btn"
                                @click="resetBuiltinPrompts"
                            >
                                Khôi phục mặc định
                            </button>
                        </div>

                        <section class="afs-section">
                            <button type="button" class="afs-section-toggle" @click="expandedSection = expandedSection === 'meta' ? '' : 'meta'">
                                <ChevronDown :size="14" :class="{ 'afs-chevron--open': expandedSection === 'meta' }" />
                                Thông tin chung
                            </button>
                            <div v-show="expandedSection === 'meta'" class="afs-section-body">
                                <label class="afs-field">
                                    <span>Tên</span>
                                    <input v-model="selected.name" type="text" class="afs-input" />
                                </label>
                                <label class="afs-field">
                                    <span>Mô tả</span>
                                    <textarea v-model="selected.description" class="afs-textarea" rows="2" />
                                </label>
                                <label class="afs-field">
                                    <span>Kiểu sinh node</span>
                                    <select v-model="selected.builder" class="afs-select">
                                        <option :value="BUILDER_TYPES.PHASED_CLIPS">Phased clips (mặc định)</option>
                                        <option :value="BUILDER_TYPES.FULL_GRAPH">Full graph JSON</option>
                                    </select>
                                </label>
                                <div class="afs-row">
                                    <label class="afs-field afs-field--inline">
                                        <span>Giây/clip</span>
                                        <input v-model.number="selected.clipSeconds" type="number" min="1" max="60" class="afs-input" />
                                    </label>
                                    <label class="afs-field afs-field--inline">
                                        <span>Max clip</span>
                                        <input v-model.number="selected.maxClips" type="number" min="1" max="24" class="afs-input" />
                                    </label>
                                    <label class="afs-field afs-field--inline">
                                        <span>Max ảnh input</span>
                                        <input v-model.number="selected.maxImageInputs" type="number" min="1" max="12" class="afs-input" />
                                    </label>
                                    <label v-if="selected.builder === BUILDER_TYPES.PHASED_CLIPS" class="afs-field afs-field--inline">
                                        <span>Batch phase 2</span>
                                        <input v-model.number="selected.batchSize" type="number" min="1" max="6" class="afs-input" />
                                    </label>
                                </div>
                            </div>
                        </section>

                        <p class="afs-hint">
                            Placeholder trong prompt:
                            <code v-for="p in PROMPT_PLACEHOLDERS" :key="p" class="afs-code">{{ p }}</code>
                        </p>

                        <section class="afs-section">
                            <button type="button" class="afs-section-toggle" @click="expandedSection = expandedSection === 'chat' ? '' : 'chat'">
                                <ChevronDown :size="14" :class="{ 'afs-chevron--open': expandedSection === 'chat' }" />
                                Prompt chat (giai đoạn ý tưởng)
                            </button>
                            <div v-show="expandedSection === 'chat'" class="afs-section-body">
                                <textarea
                                    class="afs-textarea afs-textarea--prompt"
                                    :value="linesToText(selected.chatPromptLines)"
                                    rows="10"
                                    @input="updatePromptField('chatPromptLines', $event.target.value)"
                                />
                            </div>
                        </section>

                        <template v-if="selected.builder === BUILDER_TYPES.PHASED_CLIPS">
                            <section class="afs-section">
                                <button type="button" class="afs-section-toggle" @click="expandedSection = expandedSection === 'p1' ? '' : 'p1'">
                                    <ChevronDown :size="14" :class="{ 'afs-chevron--open': expandedSection === 'p1' }" />
                                    Prompt Phase 1 (khung clip)
                                </button>
                                <div v-show="expandedSection === 'p1'" class="afs-section-body">
                                    <textarea
                                        class="afs-textarea afs-textarea--prompt"
                                        :value="linesToText(selected.phase1PromptLines)"
                                        rows="12"
                                        @input="updatePromptField('phase1PromptLines', $event.target.value)"
                                    />
                                </div>
                            </section>
                            <section class="afs-section">
                                <button type="button" class="afs-section-toggle" @click="expandedSection = expandedSection === 'p2' ? '' : 'p2'">
                                    <ChevronDown :size="14" :class="{ 'afs-chevron--open': expandedSection === 'p2' }" />
                                    Prompt Phase 2 (prompt từng clip)
                                </button>
                                <div v-show="expandedSection === 'p2'" class="afs-section-body">
                                    <textarea
                                        class="afs-textarea afs-textarea--prompt"
                                        :value="linesToText(selected.phase2PromptLines)"
                                        rows="12"
                                        @input="updatePromptField('phase2PromptLines', $event.target.value)"
                                    />
                                </div>
                            </section>
                        </template>

                        <template v-else>
                            <section class="afs-section">
                                <button type="button" class="afs-section-toggle" @click="expandedSection = expandedSection === 'build' ? '' : 'build'">
                                    <ChevronDown :size="14" :class="{ 'afs-chevron--open': expandedSection === 'build' }" />
                                    Prompt Tạo node (full graph)
                                </button>
                                <div v-show="expandedSection === 'build'" class="afs-section-body">
                                    <textarea
                                        class="afs-textarea afs-textarea--prompt"
                                        :value="linesToText(selected.buildPromptLines)"
                                        rows="12"
                                        @input="updatePromptField('buildPromptLines', $event.target.value)"
                                    />
                                </div>
                            </section>
                        </template>
                    </div>
                </div>

                <footer class="afs-footer">
                    <button type="button" class="afs-btn afs-btn--primary" @click="onSave">Lưu &amp; đóng</button>
                </footer>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.afs-overlay {
    position: fixed;
    inset: 0;
    z-index: 1200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(10px);
}

.afs-panel {
    width: 100%;
    max-width: 52rem;
    max-height: min(92vh, 52rem);
    border: 1px solid #27272a;
    border-radius: 1rem;
    background: #09090b;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.85);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.afs-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 1rem 1.15rem;
    border-bottom: 1px solid #18181b;
    background: #0c0c0e;
    flex-shrink: 0;
}

.afs-title-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
}

.afs-title-wrap h2 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: #f4f4f5;
}

.afs-title-icon {
    color: #eab308;
    flex-shrink: 0;
}

.afs-close {
    width: 2rem;
    height: 2rem;
    border: 1px solid #3f3f46;
    border-radius: 0.5rem;
    background: #18181b;
    color: #a1a1aa;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

.afs-close:hover {
    color: #e4e4e7;
    border-color: #52525b;
}

.afs-body {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
}

.afs-list {
    width: 13.5rem;
    flex-shrink: 0;
    border-right: 1px solid #18181b;
    display: flex;
    flex-direction: column;
    background: #0c0c0e;
}

.afs-list-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.65rem 0.75rem;
    font-size: 0.68rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #71717a;
}

.afs-icon-btn {
    width: 1.65rem;
    height: 1.65rem;
    border: 1px solid #3f3f46;
    border-radius: 0.4rem;
    background: #18181b;
    color: #eab308;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

.afs-items {
    list-style: none;
    margin: 0;
    padding: 0 0.45rem 0.75rem;
    overflow-y: auto;
    flex: 1;
}

.afs-item {
    width: 100%;
    text-align: left;
    border: 1px solid transparent;
    border-radius: 0.55rem;
    padding: 0.5rem 0.55rem;
    background: transparent;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    margin-bottom: 0.25rem;
}

.afs-item:hover {
    background: #18181b;
}

.afs-item--selected {
    border-color: rgba(234, 179, 8, 0.45);
    background: rgba(234, 179, 8, 0.08);
}

.afs-item-name {
    font-size: 0.75rem;
    font-weight: 700;
    color: #e4e4e7;
    line-height: 1.3;
}

.afs-item-meta {
    font-size: 0.6rem;
    color: #71717a;
    line-height: 1.3;
}

.afs-badge {
    align-self: flex-start;
    font-size: 0.55rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #fde047;
    background: rgba(234, 179, 8, 0.15);
    border-radius: 999px;
    padding: 0.1rem 0.35rem;
    margin-top: 0.15rem;
}

.afs-editor {
    flex: 1;
    overflow-y: auto;
    padding: 0.85rem 1rem 1rem;
}

.afs-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-bottom: 0.75rem;
}

.afs-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.65rem;
    border-radius: 0.5rem;
    border: 1px solid #3f3f46;
    background: #18181b;
    color: #e4e4e7;
    font-size: 0.72rem;
    font-weight: 600;
    cursor: pointer;
}

.afs-btn:hover {
    border-color: #52525b;
    background: #1f1f23;
}

.afs-btn--primary {
    border-color: rgba(234, 179, 8, 0.45);
    background: rgba(234, 179, 8, 0.12);
    color: #fde047;
}

.afs-btn--danger {
    color: #fca5a5;
    border-color: rgba(248, 113, 113, 0.35);
}

.afs-section {
    border: 1px solid #27272a;
    border-radius: 0.65rem;
    margin-bottom: 0.55rem;
    overflow: hidden;
}

.afs-section-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.5rem 0.65rem;
    border: none;
    background: #18181b;
    color: #d4d4d8;
    font-size: 0.72rem;
    font-weight: 700;
    cursor: pointer;
    text-align: left;
}

.afs-chevron--open {
    transform: rotate(180deg);
}

.afs-section-body {
    padding: 0.65rem;
    border-top: 1px solid #27272a;
}

.afs-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.55rem;
}

.afs-field > span {
    font-size: 0.68rem;
    color: #a1a1aa;
}

.afs-field--inline {
    flex: 1;
    min-width: 5rem;
}

.afs-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
}

.afs-input,
.afs-select,
.afs-textarea {
    width: 100%;
    border: 1px solid #3f3f46;
    border-radius: 0.45rem;
    padding: 0.4rem 0.5rem;
    font-size: 0.78rem;
    color: #e4e4e7;
    background: #0c0c0e;
    font-family: inherit;
    box-sizing: border-box;
}

.afs-textarea--prompt {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.68rem;
    line-height: 1.45;
    min-height: 8rem;
}

.afs-hint {
    font-size: 0.62rem;
    color: #71717a;
    line-height: 1.5;
    margin: 0 0 0.65rem;
}

.afs-code {
    display: inline-block;
    margin: 0.1rem 0.2rem 0.1rem 0;
    padding: 0.05rem 0.25rem;
    border-radius: 0.25rem;
    background: #18181b;
    color: #fde047;
    font-size: 0.58rem;
}

.afs-footer {
    padding: 0.75rem 1.15rem 1rem;
    border-top: 1px solid #18181b;
    flex-shrink: 0;
}
</style>
