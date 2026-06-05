<script setup>
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
    Clapperboard,
    ArrowLeft,
    Loader2,
    Play,
    Settings,
    Trees,
} from 'lucide-vue-next'
import StoryboardManagerPage from '@/components/storyboard/StoryboardManagerPage.vue'
import StoryboardFromScriptTab from '@/components/storyboard/StoryboardFromScriptTab.vue'
import StoryboardSetupPopup from '@/components/storyboard/StoryboardSetupPopup.vue'
import RenderView from '@/pages/RenderView.vue'
import { storyboardService } from '@/services/storyboard.service.js'
import { getSettings } from '@/services/nanoai.js'
import {
    normalizeVideoTier,
    normalizeVideoModel,
} from '@/services/flowApiV3.js'
import {
    applyVeoSettingsFromApp,
    configToEditorState,
    editorStateToConfig,
    defaultEditorState,
} from '@/utils/storyboardProject.js'
import { collectStoryboardSourceAssets, storyboardAspectToRenderPreset } from '@/utils/renderSourceAssets.js'
import { RENDER_PROJECT_KIND } from '@/services/renderProject.service.js'

const { t } = useI18n()

const viewMode = ref('manager')
const isRenderViewOpen = ref(false)
const isSetupOpen = ref(false)
const isSetupMinimized = ref(false)
const isSetupGenerating = ref(false)
const setupGenProgress = ref({ phase: '', current: 0, total: 0, label: '' })
const scriptTabRef = ref(null)
const isBulkEnvGen = ref(false)

const pendingEnvironmentCount = computed(() => {
    void editor.scenes.map((s) => s.environmentImageTask?.status).join(',')
    return scriptTabRef.value?.getPendingEnvironmentCount?.() ?? 0
})
const canGenAllEnvironments = computed(() =>
    Boolean(editor.outline) && pendingEnvironmentCount.value > 0 && !isBulkEnvGen.value,
)

const onBulkEnvChange = (v) => {
    isBulkEnvGen.value = v
}

const genAllEnvironments = () => {
    scriptTabRef.value?.genAllEnvironments?.()
}
const currentProjectId = ref('')
const projectName = ref('')
const projectDescription = ref('')
const isLoadingProject = ref(false)

const editor = reactive(defaultEditorState())

const appVideoTier = computed(() => normalizeVideoTier(getSettings().videoTier))

const openSections = ref({ common: true, template: false })

watch(appVideoTier, (tier) => {
    Object.assign(editor.settings, applyVeoSettingsFromApp(editor.settings))
    editor.settings.videoModel = normalizeVideoModel(editor.settings.videoModel, tier)
}, { immediate: true })

const renderSourceAssets = computed(() => collectStoryboardSourceAssets(editor.scenes))

const renderDefaultAspect = computed(() =>
    storyboardAspectToRenderPreset(editor.settings?.aspectRatio),
)

const renderVideoCount = computed(() => renderSourceAssets.value.length)

const openRenderView = () => {
    if (!currentProjectId.value) return
    isRenderViewOpen.value = true
}

const toggleSection = (key) => {
    openSections.value[key] = !openSections.value[key]
}

const openSetup = () => {
    isSetupMinimized.value = false
    isSetupOpen.value = true
}

const onSetupGeneratingChange = (v) => {
    isSetupGenerating.value = v
}

const onSetupProgressChange = (v) => {
    setupGenProgress.value = v
}

const resetEditor = (config) => {
    const hydrated = configToEditorState(config)
    Object.assign(editor, defaultEditorState(), hydrated)
    Object.assign(editor.settings, applyVeoSettingsFromApp(editor.settings))
}

const openProject = async (id) => {
    isLoadingProject.value = true
    try {
        const res = await storyboardService.getOne(id)
        if (!res?.success) return
        currentProjectId.value = id
        projectName.value = res.data.name || ''
        projectDescription.value = res.data.description || ''
        resetEditor(res.data)
        viewMode.value = 'editor'
    } finally {
        isLoadingProject.value = false
    }
}

const backToManager = () => {
    isRenderViewOpen.value = false
    isSetupOpen.value = false
    isSetupMinimized.value = false
    isSetupGenerating.value = false
    viewMode.value = 'manager'
    currentProjectId.value = ''
}

let saveTimer
let saveInFlight = false

const flushSave = async () => {
    if (!currentProjectId.value || viewMode.value !== 'editor') return
    if (saveInFlight) return
    saveInFlight = true
    try {
        const payload = editorStateToConfig(editor, {
            name: projectName.value,
            description: projectDescription.value,
        })
        await storyboardService.update(currentProjectId.value, payload)
    } catch {
        // silent auto-save
    } finally {
        saveInFlight = false
    }
}

watch(
    editor,
    () => {
        if (viewMode.value !== 'editor' || !currentProjectId.value) return
        clearTimeout(saveTimer)
        saveTimer = setTimeout(flushSave, 800)
    },
    { deep: true },
)

onBeforeUnmount(() => {
    clearTimeout(saveTimer)
    flushSave()
})
</script>

<template>
    <StoryboardManagerPage
        v-if="viewMode === 'manager'"
        :current-project-id="currentProjectId"
        @load="openProject"
        @create="openProject"
    />

    <RenderView
        v-else-if="isRenderViewOpen && currentProjectId"
        :source-assets="renderSourceAssets"
        :project-id="currentProjectId"
        :project-kind="RENDER_PROJECT_KIND.storyboard"
        :default-aspect-ratio="renderDefaultAspect"
        @back="isRenderViewOpen = false"
    />

    <section v-else class="storyboard-page">
        <header class="page-head">
            <div class="head-left">
                <button type="button" class="back-btn" @click="backToManager">
                    <ArrowLeft :size="16" />
                    {{ t('storyboard.backToProjects') }}
                </button>
                <div class="head-brand">
                    <Clapperboard :size="20" class="head-icon" />
                    <div>
                        <h1>{{ projectName || t('storyboard.title') }}</h1>
                        <p>{{ t('storyboard.subtitle') }}</p>
                    </div>
                </div>
            </div>
            <div class="head-actions">
                <button
                    type="button"
                    class="env-bulk-btn"
                    :disabled="!canGenAllEnvironments"
                    :aria-busy="isBulkEnvGen"
                    @click="genAllEnvironments"
                >
                    <Loader2 v-if="isBulkEnvGen" :size="15" class="spin" />
                    <Trees v-else :size="15" />
                    {{ isBulkEnvGen ? t('storyboard.generating') : t('storyboard.genAllEnvironments') }}
                    <span v-if="pendingEnvironmentCount" class="env-bulk-count">{{ pendingEnvironmentCount }}</span>
                </button>
                <button type="button" class="setup-btn" @click="openSetup">
                    <Settings :size="15" />
                    {{ t('storyboard.openSetup') }}
                </button>
                <button type="button" class="render-btn" @click="openRenderView">
                    <Play :size="15" />
                    {{ t('storyboard.openRender') }}
                    <span v-if="renderVideoCount" class="render-count">{{ renderVideoCount }}</span>
                </button>
            </div>
        </header>

        <div v-if="isLoadingProject" class="loading-wrap">
            <Loader2 :size="28" class="spin" />
        </div>

        <div v-else class="workspace">
            <main class="main-panel">
                <StoryboardFromScriptTab
                    ref="scriptTabRef"
                    :project-id="currentProjectId"
                    :editor="editor"
                    :settings="editor.settings"
                    :template-defaults="editor.templateDefaults"
                    view="scenes"
                    @open-setup="openSetup"
                    @bulk-env-change="onBulkEnvChange"
                />
            </main>
        </div>

        <StoryboardSetupPopup
            v-model:open="isSetupOpen"
            v-model:minimized="isSetupMinimized"
            :project-id="currentProjectId"
            :editor="editor"
            :open-sections="openSections"
            :is-generating="isSetupGenerating"
            :gen-progress="setupGenProgress"
            @toggle-section="toggleSection"
            @generating-change="onSetupGeneratingChange"
            @progress-change="onSetupProgressChange"
        />
    </section>
</template>

<style scoped>
.storyboard-page {
    display: flex;
    flex-direction: column;
    padding: 14px 16px 20px;
    min-height: 100%;
    color: var(--color-text);
}

.page-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 10px;
}

.head-left {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.back-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--color-border);
    border-radius: 9px;
    padding: 6px 10px;
    background: var(--color-bg-soft);
    color: var(--color-text-muted);
    font-size: 0.78rem;
    cursor: pointer;
}

.back-btn:hover {
    color: var(--color-text);
    border-color: rgba(234, 179, 8, 0.4);
}

.head-brand {
    display: flex;
    align-items: flex-start;
    gap: 10px;
}

.head-icon {
    color: var(--color-accent);
    flex-shrink: 0;
    margin-top: 2px;
}

.page-head h1 {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 800;
}

.page-head p {
    margin: 4px 0 0;
    color: var(--color-text-muted);
    font-size: 0.82rem;
}

.head-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
}

.setup-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 8px 12px;
    background: var(--color-bg-soft);
    color: var(--color-text);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
}

.env-bulk-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border: 1px solid rgba(34, 197, 94, 0.45);
    border-radius: 10px;
    padding: 8px 12px;
    background: rgba(34, 197, 94, 0.1);
    color: var(--color-text);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
}

.env-bulk-btn:hover:not(:disabled) {
    border-color: rgba(34, 197, 94, 0.65);
    background: rgba(34, 197, 94, 0.16);
}

.env-bulk-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.env-bulk-count {
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: #22c55e;
    color: #fff;
    font-size: 0.68rem;
    font-weight: 800;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.setup-btn:hover {
    border-color: rgba(234, 179, 8, 0.45);
    background: var(--color-accent-soft);
}

.render-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    border: 1px solid rgba(234, 179, 8, 0.45);
    border-radius: 10px;
    padding: 8px 12px;
    background: var(--color-accent-soft);
    color: var(--color-text);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
}

.render-btn:hover {
    border-color: var(--color-accent-strong);
    background: rgba(250, 204, 21, 0.22);
}

.render-count {
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--color-accent);
    color: var(--color-text-on-accent);
    font-size: 0.68rem;
    font-weight: 800;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.loading-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
}

.workspace {
    flex: 1;
    min-height: 0;
    min-width: 0;
}

.main-panel {
    min-width: 0;
    height: 100%;
}

.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

</style>
