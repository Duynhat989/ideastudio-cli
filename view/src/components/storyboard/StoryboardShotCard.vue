<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
    Clock,
    Copy,
    Image as ImageIcon,
    Video,
    Loader2,
} from 'lucide-vue-next'
import StoryboardMediaPreview from './StoryboardMediaPreview.vue'
import { storyAspectToCss, isLandscapeStoryAspect, storyboardShotPreviewPanelWidth } from '@/utils/storyboardAspect.js'
import { storyboardShotVideoPrompt, buildShotFrameImagePrompt, buildEnvironmentStyleContext } from '@/services/storyboardPromptBuilder.js'
import {
    runStoryboardImageGen,
    runStoryboardVideoGen,
    downloadMediaResult,
    storyboardShotFrameRefs,
    storyboardSceneVideoFrame,
} from '@/composables/useStoryboardSceneGen.js'
import { notify } from '@/composables/useNotify.js'
import { persistStoryboardAsset } from '@/utils/storyboardProject.js'
import { storyboardService } from '@/services/storyboard.service.js'

const props = defineProps({
    shot: { type: Object, required: true },
    scene: { type: Object, required: true },
    projectId: { type: String, default: '' },
    settings: { type: Object, required: true },
    templateDefaults: { type: Object, default: () => ({}) },
    characterRefUrls: { type: Array, default: () => [] },
})

const { t } = useI18n()

const imageAspect = computed(() => storyAspectToCss(props.settings.aspectRatio, 'image'))
const videoAspect = computed(() => storyAspectToCss(props.settings.aspectRatio, 'video'))
const isLandscapePreview = computed(() => isLandscapeStoryAspect(props.settings.aspectRatio))
const previewPanelWidth = computed(() => storyboardShotPreviewPanelWidth(props.settings.aspectRatio))

const environmentImageUrl = computed(() => {
    const url = props.scene.environmentImageTask?.result || props.scene.environmentImageUrl
    return url ? storyboardService.assetUrl(url) : null
})

const canGenFirstFrame = computed(() => Boolean(environmentImageUrl.value || props.shot.imagePrompt))
const canGenVideo = computed(() => Boolean(props.shot.firstFrameTask?.result))

const firstFrameStatus = computed(() => {
    const s = props.shot.firstFrameTask?.status
    if (s === 'generating') return { label: t('storyboard.generating'), tone: 'loading' }
    if (s === 'success') return { label: t('storyboard.frameReady'), tone: 'ok' }
    if (s === 'error') return { label: t('storyboard.imageFailed'), tone: 'err' }
    return { label: t('storyboard.noFrame'), tone: 'muted' }
})

const videoStatus = computed(() => {
    const s = props.shot.videoTask?.status
    if (s === 'generating') return { label: t('storyboard.generating'), tone: 'loading' }
    if (s === 'success') return { label: t('storyboard.videoReady'), tone: 'ok' }
    if (s === 'error') return { label: t('storyboard.videoFailed'), tone: 'err' }
    return { label: t('storyboard.noVideo'), tone: 'muted' }
})

const copyVideoPrompt = async () => {
    try {
        await navigator.clipboard.writeText(storyboardShotVideoPrompt(props.shot))
        notify.alert({ title: t('storyboard.copied'), message: t('storyboard.copiedHint'), variant: 'success' })
    } catch {
        notify.alert({ title: t('common.notification'), message: t('storyboard.copyFailed'), variant: 'error' })
    }
}

const shotFrameCtx = computed(() => ({
    styleContext: buildEnvironmentStyleContext({
        settings: props.settings,
        templateDefaults: props.templateDefaults,
    }),
    blocks: props.shot.blocks,
}))

const genFirstFrame = async () => {
    if (!canGenFirstFrame.value || props.shot.firstFrameTask?.status === 'generating') return
    try {
        await runStoryboardImageGen({
            task: props.shot.firstFrameTask,
            prompt: buildShotFrameImagePrompt(props.shot.imagePrompt, shotFrameCtx.value),
            refUrls: storyboardShotFrameRefs(environmentImageUrl.value, props.characterRefUrls),
            aspectRatio: props.settings.aspectRatio,
            imageModel: props.settings.imageModel,
        })
        if (props.projectId && props.shot.firstFrameTask?.result) {
            const saved = await persistStoryboardAsset(props.projectId, props.shot.firstFrameTask.result, {
                kind: 'shot-frame',
                sceneIndex: props.scene.index,
            })
            if (saved) {
                props.shot.firstFrameImageUrl = saved
                props.shot.firstFrameTask.result = storyboardService.assetUrl(saved)
            }
        }
    } catch {
        // task patched
    }
}

const genVideo = async () => {
    if (!canGenVideo.value || props.shot.videoTask?.status === 'generating') return
    try {
        await runStoryboardVideoGen({
            task: props.shot.videoTask,
            prompt: storyboardShotVideoPrompt(props.shot),
            refUrls: storyboardSceneVideoFrame(props.shot.firstFrameTask?.result),
            aspectRatio: props.settings.aspectRatio,
            videoModel: props.settings.videoModel,
        })
        if (props.projectId && props.shot.videoTask?.result) {
            const saved = await persistStoryboardAsset(props.projectId, props.shot.videoTask.result, {
                kind: 'shot-video',
                sceneIndex: props.scene.index,
            })
            if (saved) {
                props.shot.videoUrl = saved
                props.shot.videoTask.result = storyboardService.assetUrl(saved)
            }
        }
    } catch {
        // task patched
    }
}
</script>

<template>
    <article :id="`storyboard-shot-${scene.index}-${shot.index}`" class="shot-card">
        <div
            class="shot-layout"
            :style="{ '--preview-panel-width': previewPanelWidth }"
        >
            <div
                class="preview-panel"
                :class="{ 'preview-panel--landscape': isLandscapePreview }"
            >
                <div class="preview-row" :class="{ 'preview-row--stacked': isLandscapePreview }">
                    <StoryboardMediaPreview
                        :task="shot.firstFrameTask"
                        media-type="image"
                        :aspect-ratio="imageAspect"
                        :label="t('storyboard.shotFrame')"
                        zoomable
                        @download="downloadMediaResult(shot.firstFrameTask, `scene-${scene.index}-shot-${shot.index}-frame.png`)"
                    />
                    <StoryboardMediaPreview
                        :task="shot.videoTask"
                        media-type="video"
                        :aspect-ratio="videoAspect"
                        :label="t('storyboard.shotVideo')"
                        @download="downloadMediaResult(shot.videoTask, `scene-${scene.index}-shot-${shot.index}-video.mp4`)"
                    />
                </div>
            </div>

            <div class="info-panel">
                <div class="info-head">
                    <span class="shot-badge">{{ scene.index }}.{{ shot.index }}</span>
                    <h5 class="shot-title">{{ shot.label }}</h5>
                </div>

                <div class="prompt-block">
                    <label class="prompt-label">{{ t('storyboard.shotImagePrompt') }}</label>
                    <small class="prompt-hint">{{ t('storyboard.shotImagePromptHint') }}</small>
                    <textarea v-model="shot.imagePrompt" class="prompt-input prompt-input--sm sb-textarea sb-textarea--mono sb-scroll" rows="5" />
                    <label class="prompt-label">{{ t('storyboard.shotVideoPrompt') }}</label>
                    <textarea v-model="shot.videoPrompt" class="prompt-input sb-textarea sb-scroll" rows="5" :placeholder="t('storyboard.shotVideoPromptHint')" />
                </div>

                <div class="info-footer">
                    <span class="meta-item">
                        <Clock :size="13" />
                        {{ shot.durationSec }}s
                    </span>
                    <div class="status-row">
                        <span class="status-pill" :class="`status-pill--${firstFrameStatus.tone}`">
                            <ImageIcon :size="13" />
                            {{ firstFrameStatus.label }}
                        </span>
                        <span class="status-pill" :class="`status-pill--${videoStatus.tone}`">
                            <Video :size="13" />
                            {{ videoStatus.label }}
                        </span>
                    </div>
                    <div class="action-row">
                        <button
                            type="button"
                            class="action-btn action-btn--image"
                            :disabled="!canGenFirstFrame || shot.firstFrameTask?.status === 'generating' || shot.scriptStatus !== 'done'"
                            @click="genFirstFrame"
                        >
                            <Loader2 v-if="shot.firstFrameTask?.status === 'generating'" :size="14" class="spin" />
                            <ImageIcon v-else :size="14" />
                            {{ t('storyboard.genFrame') }}
                        </button>
                        <button
                            type="button"
                            class="action-btn action-btn--video"
                            :disabled="!canGenVideo || shot.videoTask?.status === 'generating' || shot.scriptStatus !== 'done'"
                            @click="genVideo"
                        >
                            <Loader2 v-if="shot.videoTask?.status === 'generating'" :size="14" class="spin" />
                            <Video v-else :size="14" />
                            {{ t('storyboard.genVideo') }}
                        </button>
                        <button type="button" class="action-btn action-btn--ghost" @click="copyVideoPrompt">
                            <Copy :size="14" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </article>
</template>

<style scoped>
.shot-card {
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: var(--color-bg);
    overflow: hidden;
    transition: border-color 0.15s ease;
}

.shot-card:hover {
    border-color: rgba(234, 179, 8, 0.3);
}

.shot-layout {
    display: grid;
    grid-template-columns: var(--preview-panel-width, 600px) minmax(0, 1fr);
    align-items: start;
    min-height: 170px;
}

.preview-panel {
    width: 100%;
    min-width: 0;
    border-right: 1px solid var(--color-border);
    background: var(--color-bg-soft);
    align-self: start;
}

.preview-row {
    display: grid;
    gap: 8px;
    padding: 8px;
    width: 100%;
    box-sizing: border-box;
}

.preview-row:not(.preview-row--stacked) {
    grid-template-columns: 1fr 1fr;
}

.preview-row--stacked {
    grid-template-columns: 1fr;
}

.preview-row :deep(.media-preview) {
    width: 100%;
    min-width: 0;
    height: auto;
    align-self: flex-start;
    border-radius: 8px;
}

.info-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px 14px;
    min-width: 0;
}

.info-head {
    display: flex;
    align-items: center;
    gap: 8px;
}

.shot-badge {
    flex-shrink: 0;
    padding: 4px 8px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 800;
    color: var(--color-text-on-accent);
    background: linear-gradient(135deg, var(--color-accent), var(--color-accent-strong));
}

.shot-title {
    margin: 0;
    font-size: 0.86rem;
    font-weight: 700;
}

.prompt-block {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-height: 0;
}

.prompt-input--sm {
    min-height: 52px;
    max-height: 140px;
    overflow-y: auto;
    flex: 0 0 auto;
    resize: vertical;
}

.prompt-block .prompt-input:not(.prompt-input--sm) {
    flex: 0 1 auto;
    min-height: 72px;
    max-height: 100px;
    overflow-y: auto;
    resize: vertical;
}

.prompt-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--color-text-muted);
}

.prompt-hint {
    font-size: 0.65rem;
    color: var(--color-text-muted);
    line-height: 1.35;
    opacity: 0.85;
}

.info-footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.meta-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.76rem;
    color: var(--color-text-muted);
}

.status-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.status-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.72rem;
    font-weight: 600;
}

.status-pill--ok { color: #4ade80; }
.status-pill--muted { color: #71717a; }
.status-pill--loading { color: var(--color-accent); }
.status-pill--err { color: #f87171; }

.action-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}

.action-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    padding: 6px 10px;
    background: var(--color-bg-elevated);
    color: var(--color-text);
    font-size: 0.74rem;
    font-weight: 600;
    cursor: pointer;
}

.action-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.action-btn--image:not(:disabled):hover {
    border-color: rgba(250, 204, 21, 0.45);
    background: var(--color-accent-soft);
}

.action-btn--video:not(:disabled):hover {
    border-color: rgba(56, 189, 248, 0.45);
    background: rgba(56, 189, 248, 0.1);
    color: #7dd3fc;
}

.action-btn--ghost {
    padding: 6px 9px;
    color: var(--color-text-muted);
}

.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) {
    .shot-layout {
        grid-template-columns: 1fr;
    }

    .preview-panel {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid var(--color-border);
    }

    .preview-row:not(.preview-row--stacked) {
        grid-template-columns: 1fr;
    }

    .prompt-block .prompt-input:not(.prompt-input--sm) { min-height: 100px; resize: vertical; }
}
</style>
