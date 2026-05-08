<script setup>
import { computed } from 'vue'
import {
    BookText,
    Clapperboard,
    FileUp,
    Film,
    Languages,
    LayoutTemplate,
    MessageSquare,
    ScanText,
    Sparkles,
    Timer,
    WandSparkles
} from 'lucide-vue-next'

const props = defineProps({
    state: {
        type: Object,
        required: true
    }
})

const emit = defineEmits(['action'])

const tabs = [
    { label: 'Y tuong nhanh', value: 'idea' },
    { label: 'Dan kich ban', value: 'paste' },
    { label: 'Tai file', value: 'upload' }
]

const presets = ['Drama', 'Fantasy', 'Sci-fi', 'Anime short']

const presetIcons = {
    Drama: Clapperboard,
    Fantasy: Sparkles,
    'Sci-fi': WandSparkles,
    'Anime short': LayoutTemplate
}

const quickOutline = [
    'Hook 0-3s',
    'Context 3-12s',
    'Conflict 12-28s',
    'Payoff 28-45s',
    'CTA 45-60s'
]

const charCount = computed(() => props.state.scriptText.length)
const estimatedScenes = computed(() => {
    if (!props.state.scriptText.trim()) return 0
    return Math.max(1, Math.min(12, Math.ceil(props.state.scriptText.length / 120)))
})
const estimatedShots = computed(() => estimatedScenes.value * 3)
const estimatedDuration = computed(() => {
    if (!props.state.scriptText.trim()) return '0 phut'
    return `${Math.max(1, Math.round(charCount.value / 380))} phut`
})
</script>

<template>
    <article class="workspace-step">
        <header class="step-head">
            <div class="head-left">
                <span class="dot" />
                <h3>Phase 01 - Script Editor</h3>
            </div>
            <div class="head-right">
                <button type="button" class="ghost-btn" @click="emit('action', 'draft')">
                    <WandSparkles :size="14" /> Tao ban nhap
                </button>
                <button type="button" class="solid-btn" @click="emit('action', 'analyze')">
                    <Sparkles :size="14" /> AI phan tich
                </button>
            </div>
        </header>

        <section class="workspace-grid">
            <aside class="column card input-column">
                <div class="title-row">
                    <BookText :size="16" />
                    <strong>Nguon du lieu</strong>
                </div>

                <div class="tab-row">
                    <button v-for="tab in tabs" :key="tab.value" type="button"
                        :class="['chip-btn', { active: state.inputTab === tab.value }]"
                        @click="state.inputTab = tab.value">
                        <MessageSquare v-if="tab.value === 'idea'" :size="13" />
                        <ScanText v-if="tab.value === 'paste'" :size="13" />
                        <FileUp v-if="tab.value === 'upload'" :size="13" />
                        {{ tab.label }}
                    </button>
                </div>

                <label>Noi dung script</label>
                <textarea v-model="state.scriptText" rows="12"
                    placeholder="Paste y tuong, kich ban hoac outline vao day..." />

                <div class="setting-grid">
                    <div class="field">
                        <label>
                            <Film :size="13" /> Ty le
                        </label>
                        <select v-model="state.aspectRatio">
                            <option>9:16</option>
                            <option>16:9</option>
                        </select>
                    </div>
                    <div class="field">
                        <label>
                            <Timer :size="13" /> Thoi luong
                        </label>
                        <select v-model="state.duration">
                            <option>30s</option>
                            <option>60s</option>
                            <option>120s</option>
                        </select>
                    </div>
                    <div class="field">
                        <label>
                            <Languages :size="13" /> Ngon ngu
                        </label>
                        <select v-model="state.language">
                            <option>VI</option>
                            <option>EN</option>
                            <option>CN</option>
                        </select>
                    </div>
                </div>
            </aside>

            <main class="column card board-column">
                <div class="title-row">
                    <LayoutTemplate :size="16" />
                    <strong>Story Board Preview</strong>
                </div>

                <div class="preset-row">
                    <button v-for="item in presets" :key="item" type="button"
                        :class="['chip-btn', { active: state.preset === item }]" @click="state.preset = item">
                        <component :is="presetIcons[item]" :size="13" />
                        {{ item }}
                    </button>
                </div>

                <div class="board-canvas">
                    <div class="canvas-top">
                        <span>Episode 01</span>
                        <small>Auto map tu script</small>
                    </div>
                    <div class="lane-list">
                        <article v-for="(item, idx) in quickOutline" :key="item" class="lane-item">
                            <span class="lane-index">0{{ idx + 1 }}</span>
                            <div>
                                <strong>{{ item }}</strong>
                                <p>AI de xuat 2-4 shot cho block nay.</p>
                            </div>
                        </article>
                    </div>
                </div>
            </main>

            <aside class="column card insight-column">
                <div class="title-row">
                    <Sparkles :size="16" />
                    <strong>Parser Insight</strong>
                </div>

                <div class="metric-list">
                    <div class="metric-item">
                        <span>So ky tu</span>
                        <strong>{{ charCount }}</strong>
                    </div>
                    <div class="metric-item">
                        <span>Uoc tinh scene</span>
                        <strong>{{ estimatedScenes }}</strong>
                    </div>
                    <div class="metric-item">
                        <span>Uoc tinh shot</span>
                        <strong>{{ estimatedShots }}</strong>
                    </div>
                    <div class="metric-item">
                        <span>Thoi gian review</span>
                        <strong>{{ estimatedDuration }}</strong>
                    </div>
                </div>

                <div class="progress-track">
                    <div class="progress-fill" :style="{ width: `${Math.min(100, estimatedShots * 8)}%` }" />
                </div>

                <p class="hint">Tip: script tren 300 ky tu cho ket qua tach scene on dinh hon.</p>
            </aside>
        </section>
    </article>
</template>

<style scoped>
.workspace-step {
    border: 1px solid var(--color-border);
    border-radius: 16px;
    background: linear-gradient(180deg, var(--color-bg-soft), var(--color-bg-elevated));
    overflow: hidden;
}

.step-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg);
}

.head-left,
.head-right,
.title-row,
.chip-btn,
.ghost-btn,
.solid-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: var(--color-accent);
    box-shadow: 0 0 0 3px var(--color-accent-soft);
}

h3,
strong,
p,
small,
label {
    margin: 0;
}

h3 {
    font-size: 14px;
}

.workspace-grid {
    display: grid;
    grid-template-columns: 1.05fr 1.2fr 0.75fr;
    gap: 10px;
    padding: 10px;
}

.column {
    min-width: 0;
}

.card {
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: var(--color-bg-elevated);
    padding: 10px;
    display: grid;
    gap: 10px;
}

.tab-row,
.preset-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.chip-btn,
.ghost-btn,
.solid-btn {
    border: 1px solid var(--color-border);
    border-radius: 9px;
    padding: 7px 10px;
    background: var(--color-bg);
    color: var(--color-text);
    cursor: pointer;
}

.chip-btn.active {
    border-color: var(--color-accent-strong);
    color: var(--color-accent);
    background: var(--color-accent-soft);
}

.solid-btn {
    border-color: var(--color-accent-strong);
    background: var(--color-accent);
    color: var(--color-text-on-accent);
}

label {
    font-size: 12px;
    color: var(--color-text-muted);
}

textarea,
select {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 10px;
    color: var(--color-text);
    background: var(--color-bg);
}

textarea {
    resize: vertical;
}

.setting-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
}

.field {
    display: grid;
    gap: 6px;
}

.board-canvas {
    border: 1px dashed var(--color-border);
    border-radius: 10px;
    background: var(--color-bg);
    padding: 10px;
    display: grid;
    gap: 10px;
}

.canvas-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.canvas-top small {
    color: var(--color-text-muted);
}

.lane-list {
    display: grid;
    gap: 8px;
}

.lane-item {
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-bg-elevated);
    padding: 8px;
    display: flex;
    gap: 8px;
}

.lane-index {
    width: 26px;
    height: 26px;
    border: 1px solid var(--color-accent-strong);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-accent);
    background: var(--color-accent-soft);
    font-size: 12px;
}

.lane-item p,
.hint {
    color: var(--color-text-muted);
    font-size: 12px;
}

.metric-list {
    display: grid;
    gap: 8px;
}

.metric-item {
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-bg);
    padding: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.metric-item span {
    color: var(--color-text-muted);
    font-size: 12px;
}

.metric-item strong {
    color: var(--color-accent);
}

.progress-track {
    height: 8px;
    border-radius: 999px;
    overflow: hidden;
    border: 1px solid var(--color-border);
    background: var(--color-bg);
}

.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-accent-strong), var(--color-accent));
}

@media (max-width: 1150px) {
    .workspace-grid {
        grid-template-columns: 1fr;
    }

    .setting-grid {
        grid-template-columns: 1fr;
    }
}
</style>
