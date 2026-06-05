<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
    Settings,
    X,
    Minimize2,
    Maximize2,
    Loader2,
    Timer,
    Languages,
    Film,
    Image as ImageIcon,
    Palette,
    User,
    MapPin,
    Heart,
    Camera,
    Sun,
    Trees,
    Cloud,
    Headphones,
    Music,
    Shield,
    ChevronDown,
    ChevronUp,
    FileText,
    Youtube,
} from 'lucide-vue-next'
import StoryboardFromScriptTab from './StoryboardFromScriptTab.vue'
import StoryboardFromYoutubeTab from './StoryboardFromYoutubeTab.vue'
import { getSettings } from '@/services/nanoai.js'
import {
    IMAGE_MODELS,
    VIDEO_TIERS,
    videoModelsForTier,
    normalizeVideoTier,
} from '@/services/flowApiV3.js'
import { STORYBOARD_LANGUAGE_OPTIONS, STORYBOARD_STYLE_PRESETS } from '@/utils/storyboardOptions.js'

const open = defineModel('open', { type: Boolean, default: false })
const minimized = defineModel('minimized', { type: Boolean, default: false })

const props = defineProps({
    projectId: { type: String, required: true },
    editor: { type: Object, required: true },
    openSections: { type: Object, required: true },
    isGenerating: { type: Boolean, default: false },
    genProgress: {
        type: Object,
        default: () => ({ phase: '', current: 0, total: 0, label: '' }),
    },
})

const emit = defineEmits(['toggle-section', 'generating-change', 'progress-change'])

const isActive = computed(() => open.value || minimized.value)

const { t } = useI18n()

const tabs = [
    { id: 'script', labelKey: 'storyboard.tabScript', icon: FileText },
    { id: 'youtube', labelKey: 'storyboard.tabYoutube', icon: Youtube },
]

const templateFields = [
    { key: 'style', labelKey: 'storyboard.fieldStyle', icon: Palette, rows: 3 },
    { key: 'character', labelKey: 'storyboard.fieldCharacter', icon: User, rows: 4 },
    { key: 'scene', labelKey: 'storyboard.fieldScene', icon: MapPin, rows: 3 },
    { key: 'emotion', labelKey: 'storyboard.fieldEmotion', icon: Heart, rows: 2 },
    { key: 'camera', labelKey: 'storyboard.fieldCamera', icon: Camera, rows: 2 },
    { key: 'lighting', labelKey: 'storyboard.fieldLighting', icon: Sun, rows: 2 },
    { key: 'environment', labelKey: 'storyboard.fieldEnvironment', icon: Trees, rows: 2 },
    { key: 'mood', labelKey: 'storyboard.fieldMood', icon: Cloud, rows: 2 },
    { key: 'asmr', labelKey: 'storyboard.fieldAsmr', icon: Headphones, rows: 2, isArray: true },
    { key: 'bgm', labelKey: 'storyboard.fieldBgm', icon: Music, rows: 2 },
    { key: 'rules', labelKey: 'storyboard.fieldRules', icon: Shield, rows: 3, isArray: true },
]

const appVideoTier = computed(() => normalizeVideoTier(getSettings().videoTier))
const imageModelOptions = IMAGE_MODELS
const videoModelOptions = computed(() => videoModelsForTier(appVideoTier.value))
const videoTierLabel = computed(() => {
    const tier = VIDEO_TIERS.find((item) => item.value === appVideoTier.value)
    return tier?.label || appVideoTier.value
})
const languageOptions = STORYBOARD_LANGUAGE_OPTIONS
const aspectOptions = ['9:16', '16:9', '1:1']
const stylePresets = STORYBOARD_STYLE_PRESETS

const activeTab = computed({
    get: () => props.editor.activeTab,
    set: (v) => { props.editor.activeTab = v },
})

const currentTabComponent = computed(() =>
    activeTab.value === 'script' ? StoryboardFromScriptTab : StoryboardFromYoutubeTab,
)

const minimize = () => {
    open.value = false
    minimized.value = true
}

const expand = () => {
    minimized.value = false
    open.value = true
}

const close = () => {
    if (props.isGenerating) {
        minimize()
        return
    }
    open.value = false
    minimized.value = false
}

const onMinimizeSetup = () => {
    minimize()
}

const progressLabel = computed(() => {
    const p = props.genProgress
    if (!p?.phase) return t('storyboard.generating')
    if (p.phase === 'outline') return p.label || t('storyboard.phaseOutline')
    if (p.phase === 'character') return p.label || t('storyboard.phaseCharacter')
    if (p.phase === 'sceneBatch') {
        return t('storyboard.sceneBatchProgress', { current: p.current, total: p.total, label: p.label })
    }
    if (p.phase === 'shots') {
        return t('storyboard.shotsProgress', { current: p.current, total: p.total, label: p.label })
    }
    return p.label || t('storyboard.generating')
})

const toggleSection = (key) => {
    emit('toggle-section', key)
}

const formatArrayField = (key) => {
    const val = props.editor.templateDefaults[key]
    return Array.isArray(val) ? val.join('\n') : ''
}

const updateArrayField = (key, raw) => {
    props.editor.templateDefaults[key] = raw.split('\n').map((s) => s.trim()).filter(Boolean)
}
</script>

<template>
    <Teleport to="body">
        <div v-if="isActive" class="sb-setup-root">
            <Transition name="sb-setup-fade">
                <div v-show="open && !minimized" class="sb-setup-overlay" @click="close">
                    <div
                        class="sb-setup-panel"
                        role="dialog"
                        aria-labelledby="sb-setup-title"
                        @click.stop
                    >
                    <header class="sb-setup-header">
                        <div class="sb-setup-title-wrap">
                            <Settings :size="18" class="sb-setup-title-icon" />
                            <div>
                                <h2 id="sb-setup-title">{{ t('storyboard.setupTitle') }}</h2>
                                <p>{{ t('storyboard.setupSubtitle') }}</p>
                            </div>
                        </div>
                        <div class="sb-setup-header-actions">
                            <button
                                v-if="isGenerating"
                                type="button"
                                class="sb-setup-icon-btn"
                                :aria-label="t('storyboard.minimizeSetup')"
                                @click="minimize"
                            >
                                <Minimize2 :size="18" />
                            </button>
                            <button type="button" class="sb-setup-close" :aria-label="t('common.close')" @click="close">
                                <X :size="18" />
                            </button>
                        </div>
                    </header>

                    <div class="sb-setup-body">
                        <aside class="props-sidebar">
                            <section class="sidebar-block card">
                                <button type="button" class="section-toggle" @click="toggleSection('common')">
                                    <strong>{{ t('storyboard.commonProps') }}</strong>
                                    <component :is="openSections.common ? ChevronUp : ChevronDown" :size="16" />
                                </button>
                                <div v-show="openSections.common" class="section-body">
                                    <label class="field">
                                        <span><Timer :size="13" /> {{ t('storyboard.duration') }}</span>
                                        <div class="duration-input-wrap">
                                            <input v-model.number="editor.settings.duration" type="number" min="8" max="600" step="1" class="duration-input" />
                                            <span class="duration-unit">{{ t('storyboard.seconds') }}</span>
                                        </div>
                                    </label>
                                    <label class="field">
                                        <span><Languages :size="13" /> {{ t('storyboard.language') }}</span>
                                        <select v-model="editor.settings.language">
                                            <option v-for="opt in languageOptions" :key="opt.value" :value="opt.value">{{ t(opt.labelKey) }}</option>
                                        </select>
                                    </label>
                                    <label class="field">
                                        <span><Film :size="13" /> {{ t('storyboard.aspectRatio') }}</span>
                                        <select v-model="editor.settings.aspectRatio">
                                            <option v-for="opt in aspectOptions" :key="opt" :value="opt">{{ opt }}</option>
                                        </select>
                                    </label>
                                    <label class="field">
                                        <span><Palette :size="13" /> {{ t('storyboard.stylePreset') }}</span>
                                        <select v-model="editor.settings.stylePreset">
                                            <option v-for="opt in stylePresets" :key="opt" :value="opt">{{ opt }}</option>
                                        </select>
                                    </label>
                                    <label class="field">
                                        <span><ImageIcon :size="13" /> {{ t('storyboard.imageModel') }}</span>
                                        <select v-model="editor.settings.imageModel">
                                            <option v-for="opt in imageModelOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                                        </select>
                                    </label>
                                    <label class="field">
                                        <span><Film :size="13" /> {{ t('storyboard.videoModel') }}</span>
                                        <select v-model="editor.settings.videoModel">
                                            <option v-for="opt in videoModelOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                                        </select>
                                        <small class="field-note">{{ t('storyboard.veoTierFromSettings', { tier: videoTierLabel }) }}</small>
                                    </label>
                                </div>
                            </section>

                            <section class="sidebar-block card">
                                <button type="button" class="section-toggle" @click="toggleSection('template')">
                                    <strong>{{ t('storyboard.templateDefaults') }}</strong>
                                    <component :is="openSections.template ? ChevronUp : ChevronDown" :size="16" />
                                </button>
                                <div v-show="openSections.template" class="section-body template-fields">
                                    <label v-for="field in templateFields" :key="field.key" class="field template-field">
                                        <span><component :is="field.icon" :size="13" /> {{ t(field.labelKey) }}</span>
                                        <textarea v-if="field.isArray" class="sb-textarea sb-scroll" :rows="field.rows" :value="formatArrayField(field.key)" @input="updateArrayField(field.key, $event.target.value)" />
                                        <textarea v-else class="sb-textarea sb-scroll" v-model="editor.templateDefaults[field.key]" :rows="field.rows" />
                                    </label>
                                </div>
                            </section>
                        </aside>

                        <div class="setup-main">
                            <nav class="tab-control" role="tablist">
                                <button
                                    v-for="tab in tabs"
                                    :key="tab.id"
                                    type="button"
                                    role="tab"
                                    :aria-selected="activeTab === tab.id"
                                    :class="['tab-item', { active: activeTab === tab.id }]"
                                    @click="activeTab = tab.id"
                                >
                                    <component :is="tab.icon" :size="15" class="tab-icon" />
                                    <span class="tab-label">{{ t(tab.labelKey) }}</span>
                                </button>
                            </nav>
                            <div class="setup-tab-panel">
                                <component
                                    :is="currentTabComponent"
                                    :project-id="projectId"
                                    :editor="editor"
                                    :settings="editor.settings"
                                    :template-defaults="editor.templateDefaults"
                                    view="setup"
                                    @minimize-setup="onMinimizeSetup"
                                    @generating-change="(v) => $emit('generating-change', v)"
                                    @progress-change="(v) => $emit('progress-change', v)"
                                />
                            </div>
                        </div>
                    </div>

                    <footer class="sb-setup-footer">
                        <button v-if="isGenerating" type="button" class="sb-setup-minimize" @click="minimize">
                            <Minimize2 :size="15" />
                            {{ t('storyboard.minimizeSetup') }}
                        </button>
                        <button type="button" class="sb-setup-done" @click="close">{{ t('common.close') }}</button>
                    </footer>
                    </div>
                </div>
            </Transition>

            <div v-show="minimized" class="sb-setup-minimized">
                <div class="sb-minimized-inner">
                    <Loader2 v-if="isGenerating" :size="16" class="spin" />
                    <Settings v-else :size="16" class="sb-minimized-icon" />
                    <div class="sb-minimized-text">
                        <strong>{{ t('storyboard.setupTitle') }}</strong>
                        <span v-if="isGenerating">{{ progressLabel }}</span>
                        <span v-else>{{ t('storyboard.setupMinimizedHint') }}</span>
                    </div>
                    <button type="button" class="sb-minimized-expand" @click="expand">
                        <Maximize2 :size="15" />
                        {{ t('storyboard.expandSetup') }}
                    </button>
                    <button
                        type="button"
                        class="sb-minimized-close"
                        :aria-label="t('common.close')"
                        :disabled="isGenerating"
                        @click="close"
                    >
                        <X :size="15" />
                    </button>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.sb-setup-root {
    position: fixed;
    inset: 0;
    z-index: 1100;
    pointer-events: none;
}

.sb-setup-overlay {
    pointer-events: auto;
    position: fixed;
    inset: 0;
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(10px);
}

.sb-setup-panel {
    width: 100%;
    max-width: 58rem;
    max-height: min(92vh, 900px);
    border: 1px solid var(--color-border);
    border-radius: 1rem;
    background: var(--color-bg-elevated);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.85);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}

.sb-setup-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
}

.sb-setup-title-wrap {
    display: flex;
    align-items: flex-start;
    gap: 10px;
}

.sb-setup-title-icon {
    color: var(--color-accent);
    flex-shrink: 0;
    margin-top: 2px;
}

.sb-setup-header h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
}

.sb-setup-header p {
    margin: 4px 0 0;
    font-size: 0.78rem;
    color: var(--color-text-muted);
}

.sb-setup-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
}

.sb-setup-close,
.sb-setup-icon-btn {
    border: 1px solid var(--color-border);
    border-radius: 9px;
    padding: 6px;
    background: var(--color-bg-soft);
    color: var(--color-text-muted);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.sb-setup-close:hover,
.sb-setup-icon-btn:hover {
    color: var(--color-text);
    border-color: rgba(234, 179, 8, 0.4);
}

.sb-setup-minimize {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 8px 14px;
    background: var(--color-bg-soft);
    color: var(--color-text);
    font-size: 0.82rem;
    cursor: pointer;
    margin-right: auto;
}

.sb-setup-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

.sb-setup-minimized {
    position: fixed;
    left: 50%;
    bottom: 1rem;
    transform: translateX(-50%);
    z-index: 1101;
    pointer-events: auto;
    width: min(36rem, calc(100vw - 2rem));
}

.sb-minimized-inner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border: 1px solid rgba(234, 179, 8, 0.45);
    border-radius: 12px;
    background: var(--color-bg-elevated);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}

.sb-minimized-icon {
    color: var(--color-accent);
    flex-shrink: 0;
}

.sb-minimized-text {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 2px;
    font-size: 0.76rem;
}

.sb-minimized-text strong {
    font-size: 0.8rem;
}

.sb-minimized-text span {
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.sb-minimized-expand {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 1px solid var(--color-border);
    border-radius: 9px;
    padding: 6px 10px;
    background: var(--color-accent-soft);
    color: var(--color-text);
    font-size: 0.76rem;
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
}

.sb-minimized-close {
    border: 1px solid var(--color-border);
    border-radius: 9px;
    padding: 6px;
    background: var(--color-bg-soft);
    color: var(--color-text-muted);
    cursor: pointer;
    flex-shrink: 0;
}

.sb-minimized-close:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.sb-setup-body {
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    gap: 12px;
    padding: 12px 16px;
    overflow: hidden;
    flex: 1;
    min-height: 0;
}

.props-sidebar {
    display: grid;
    gap: 10px;
    align-content: start;
    overflow-y: auto;
    min-height: 0;
    padding-right: 2px;
}

.setup-main {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
}

.setup-tab-panel {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding-right: 2px;
}

.tab-control {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 4px;
    border-radius: 12px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-soft);
    width: 100%;
    flex-shrink: 0;
}

.tab-item {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border: 1px solid transparent;
    border-radius: 9px;
    padding: 8px 14px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 0.84rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    appearance: none;
    outline: none;
}

.tab-item.active {
    border-color: rgba(234, 179, 8, 0.45);
    background: var(--color-accent-soft);
    color: var(--color-text);
}

.card {
    border: 1px solid var(--color-border);
    border-radius: 14px;
    background: var(--color-bg-elevated);
}

.sidebar-block { padding: 0; overflow: hidden; }

.section-toggle {
    width: 100%;
    border: none;
    background: transparent;
    padding: 12px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--color-text);
    cursor: pointer;
    font-size: 0.86rem;
}

.section-body {
    border-top: 1px solid var(--color-border);
    padding: 12px 14px 14px;
    display: grid;
    gap: 10px;
}

.template-fields {
    display: grid;
    gap: 10px;
}

.field {
    display: grid;
    gap: 6px;
    font-size: 0.8rem;
}

.field > span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-text-muted);
    font-weight: 600;
}

.duration-input-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
}

.duration-input,
.field select {
    width: 100%;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-bg-soft);
    color: var(--color-text);
    padding: 8px 10px;
    font-family: inherit;
    font-size: 0.82rem;
}

.duration-unit {
    font-size: 0.78rem;
    color: var(--color-text-muted);
}

.field-note {
    font-size: 0.72rem;
    color: var(--color-text-muted);
    line-height: 1.35;
}

.sb-setup-footer {
    padding: 10px 16px 14px;
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
}

.sb-setup-done {
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 8px 14px;
    background: var(--color-bg-soft);
    color: var(--color-text);
    font-size: 0.82rem;
    cursor: pointer;
}

.sb-setup-done:hover {
    border-color: rgba(234, 179, 8, 0.45);
}

.sb-setup-fade-enter-active,
.sb-setup-fade-leave-active {
    transition: opacity 0.18s ease;
}

.sb-setup-fade-enter-active .sb-setup-panel,
.sb-setup-fade-leave-active .sb-setup-panel {
    transition: transform 0.18s ease, opacity 0.18s ease;
}

.sb-setup-fade-enter-from,
.sb-setup-fade-leave-to {
    opacity: 0;
}

.sb-setup-fade-enter-from .sb-setup-panel,
.sb-setup-fade-leave-to .sb-setup-panel {
    transform: translateY(8px) scale(0.98);
    opacity: 0;
}

@media (max-width: 900px) {
    .sb-setup-body {
        grid-template-columns: 1fr;
        overflow-y: auto;
    }

    .props-sidebar {
        max-height: none;
    }

    .setup-main {
        overflow: visible;
    }

    .setup-tab-panel {
        overflow: visible;
    }
}
</style>
