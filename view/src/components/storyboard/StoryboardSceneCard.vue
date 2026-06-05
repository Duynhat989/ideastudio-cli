<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
    Clock,
    Copy,
    Image as ImageIcon,
    Video,
    Loader2,
    Sparkles,
} from 'lucide-vue-next'
import StoryboardMediaPreview from './StoryboardMediaPreview.vue'
import { storyAspectToCss } from '@/utils/storyboardAspect.js'
import { storyboardSceneVideoPrompt } from '@/services/storyboardPromptBuilder.js'
import {
    runStoryboardImageGen,
    runStoryboardVideoGen,
    downloadMediaResult,
    storyboardSceneImageRefs,
    storyboardSceneVideoFrame,
} from '@/composables/useStoryboardSceneGen.js'
import { notify } from '@/composables/useNotify.js'
import { persistStoryboardAsset } from '@/utils/storyboardProject.js'
import { storyboardService } from '@/services/storyboard.service.js'

const props = defineProps({
    scene: { type: Object, required: true },
    projectId: { type: String, default: '' },
    settings: { type: Object, required: true },
    characterRefUrls: { type: Array, default: () => [] },
})

const { t } = useI18n()

const imageAspect = computed(() => storyAspectToCss(props.settings.aspectRatio, 'image'))
const videoAspect = computed(() => storyAspectToCss(props.settings.aspectRatio, 'video'))

const canGenVideo = computed(() => Boolean(props.scene.imageTask?.result))

const moodTag = computed(() => {
    const tags = props.scene.blocks?.mood?.tags
    if (Array.isArray(tags) && tags.length) return tags[0]
    const desc = props.scene.blocks?.mood?.description
    if (desc) return desc.length > 24 ? `${desc.slice(0, 21)}…` : desc
    return props.settings.stylePreset || '—'
})

const imageStatus = computed(() => {
    const s = props.scene.imageTask?.status
    if (s === 'generating') return { key: 'loading', label: t('storyboard.generating'), tone: 'loading' }
    if (s === 'success') return { key: 'ready', label: t('storyboard.imageReady'), tone: 'ok' }
    if (s === 'error') return { key: 'error', label: t('storyboard.imageFailed'), tone: 'err' }
    return { key: 'empty', label: t('storyboard.noImage'), tone: 'muted' }
})

const videoStatus = computed(() => {
    const s = props.scene.videoTask?.status
    if (s === 'generating') return { key: 'loading', label: t('storyboard.generating'), tone: 'loading' }
    if (s === 'success') return { key: 'ready', label: t('storyboard.videoReady'), tone: 'ok' }
    if (s === 'error') return { key: 'error', label: t('storyboard.videoFailed'), tone: 'err' }
    return { key: 'empty', label: t('storyboard.noVideo'), tone: 'muted' }
})

const copyPrompt = async () => {
    try {
        await navigator.clipboard.writeText(props.scene.prompt)
        notify.alert({ title: t('storyboard.copied'), message: t('storyboard.copiedHint'), variant: 'success' })
    } catch {
        notify.alert({ title: t('common.notification'), message: t('storyboard.copyFailed'), variant: 'error' })
    }
}

const genImage = async () => {
    if (props.scene.imageTask?.status === 'generating') return
    try {
        await runStoryboardImageGen({
            task: props.scene.imageTask,
            prompt: props.scene.prompt,
            refUrls: storyboardSceneImageRefs(props.characterRefUrls),
            aspectRatio: props.settings.aspectRatio,
            imageModel: props.settings.imageModel,
        })
        if (props.projectId && props.scene.imageTask?.result) {
            const saved = await persistStoryboardAsset(props.projectId, props.scene.imageTask.result, {
                kind: 'scene-image',
                sceneIndex: props.scene.index,
            })
            if (saved) {
                props.scene.imageUrl = saved
                props.scene.imageTask.result = storyboardService.assetUrl(saved)
            }
        }
    } catch {
        // task already patched
    }
}

const genVideo = async () => {
    if (!canGenVideo.value || props.scene.videoTask?.status === 'generating') return
    try {
        await runStoryboardVideoGen({
            task: props.scene.videoTask,
            prompt: storyboardSceneVideoPrompt(props.scene),
            refUrls: storyboardSceneVideoFrame(props.scene.imageTask?.result),
            aspectRatio: props.settings.aspectRatio,
            videoModel: props.settings.videoModel,
        })
        if (props.projectId && props.scene.videoTask?.result) {
            const saved = await persistStoryboardAsset(props.projectId, props.scene.videoTask.result, {
                kind: 'scene-video',
                sceneIndex: props.scene.index,
            })
            if (saved) {
                props.scene.videoUrl = saved
                props.scene.videoTask.result = storyboardService.assetUrl(saved)
            }
        }
    } catch {
        // task already patched
    }
}

const downloadImage = () => {
    downloadMediaResult(props.scene.imageTask, `scene-${props.scene.index}-image.png`)
}

const downloadVideo = () => {
    downloadMediaResult(props.scene.videoTask, `scene-${props.scene.index}-video.mp4`)
}
</script>

<template>
    <article :id="`storyboard-scene-${scene.index}`" class="scene-card" :class="[`script-${scene.scriptStatus}`]">
        <div class="scene-layout">
            <!-- LEFT: preview panel -->
            <div class="preview-panel">
                <div class="preview-row">
                    <StoryboardMediaPreview
                        :task="scene.imageTask"
                        media-type="image"
                        :aspect-ratio="imageAspect"
                        :label="t('storyboard.sceneImage')"
                        @download="downloadImage"
                    />
                    <StoryboardMediaPreview
                        :task="scene.videoTask"
                        media-type="video"
                        :aspect-ratio="videoAspect"
                        :label="t('storyboard.sceneVideo')"
                        @download="downloadVideo"
                    />
                </div>
            </div>

            <!-- RIGHT: info panel -->
            <div class="info-panel">
                <div class="info-head">
                    <span class="scene-badge">{{ scene.index }}</span>
                    <h4 class="scene-title">{{ scene.label }}</h4>
                </div>

                <div class="prompt-block">
                    <label class="prompt-label">{{ t('storyboard.scenePrompt') }}</label>
                    <textarea
                        v-model="scene.prompt"
                        class="prompt-input sb-textarea sb-scroll"
                        :placeholder="scene.beat || t('storyboard.ideaPlaceholder')"
                    />
                </div>

                <div class="info-footer">
                    <div class="meta-row">
                        <span class="meta-item">
                            <Clock :size="13" />
                            {{ scene.durationSec }}s
                        </span>
                        <span class="meta-item meta-item--mood">
                            <Sparkles :size="13" />
                            {{ moodTag }}
                        </span>
                    </div>

                    <div class="status-row">
                        <span class="status-pill" :class="`status-pill--${imageStatus.tone}`">
                            <ImageIcon :size="13" />
                            {{ imageStatus.label }}
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
                            :disabled="scene.imageTask?.status === 'generating' || scene.scriptStatus !== 'done'"
                            @click="genImage"
                        >
                            <Loader2 v-if="scene.imageTask?.status === 'generating'" :size="14" class="spin" />
                            <ImageIcon v-else :size="14" />
                            {{ t('storyboard.genImage') }}
                        </button>
                        <button
                            type="button"
                            class="action-btn action-btn--video"
                            :disabled="!canGenVideo || scene.videoTask?.status === 'generating' || scene.scriptStatus !== 'done'"
                            @click="genVideo"
                        >
                            <Loader2 v-if="scene.videoTask?.status === 'generating'" :size="14" class="spin" />
                            <Video v-else :size="14" />
                            {{ t('storyboard.genVideo') }}
                        </button>
                        <button type="button" class="action-btn action-btn--ghost" @click="copyPrompt">
                            <Copy :size="14" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </article>
</template>

<style scoped>
.scene-card {
    border: 1px solid var(--color-border);
    border-radius: 14px;
    background: var(--color-bg-elevated);
    overflow: hidden;
    scroll-margin-top: 1rem;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.scene-card:hover {
    border-color: rgba(234, 179, 8, 0.35);
}

.scene-layout {
    display: grid;
    grid-template-columns: 600px minmax(0, 1fr);
    align-items: start;
    min-height: 220px;
}

/* ── Left preview ── */
.preview-panel {
    border-right: 1px solid var(--color-border);
    background: var(--color-bg-soft);
    width: 600px;
    flex-shrink: 0;
    align-self: start;
}

.preview-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px;
}

.preview-row :deep(.media-preview) {
    flex: 1 1 0;
    min-width: 0;
    height: auto;
    align-self: flex-start;
    border-radius: 8px;
    border-color: var(--color-border);
}

/* ── Right info ── */
.info-panel {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px 14px;
    min-width: 0;
    height: 100%;
    min-height: 0;
}

.prompt-block {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 0;
}

.info-footer {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.info-head {
    display: flex;
    align-items: center;
    gap: 10px;
}

.scene-badge {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.82rem;
    font-weight: 800;
    color: var(--color-text-on-accent);
    background: linear-gradient(135deg, var(--color-accent), var(--color-accent-strong));
    box-shadow: 0 0 10px var(--color-accent-glow-strong);
}

.scene-title {
    flex: 1;
    margin: 0;
    font-size: 0.92rem;
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: -0.01em;
    min-width: 0;
}

.prompt-label {
    flex-shrink: 0;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--color-text-muted);
}

.prompt-input {
    flex: 0 1 auto;
    min-height: 72px;
    max-height: 160px;
    overflow-y: auto;
    resize: vertical;
}

.meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
}

.meta-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.78rem;
    color: var(--color-text-muted);
}

.meta-item--mood {
    color: var(--color-accent);
}

.status-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.74rem;
    font-weight: 600;
}

.status-pill--ok {
    color: #4ade80;
}

.status-pill--muted {
    color: #71717a;
}

.status-pill--loading {
    color: var(--color-accent);
}

.status-pill--err {
    color: #f87171;
}

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
    border-radius: 9px;
    padding: 7px 12px;
    background: var(--color-bg-soft);
    color: var(--color-text);
    font-size: 0.76rem;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.12s, background 0.12s;
}

.action-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

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
    padding: 7px 10px;
    color: var(--color-text-muted);
}

.action-btn--ghost:hover {
    color: var(--color-text);
    border-color: rgba(234, 179, 8, 0.4);
    background: var(--color-accent-soft);
}

.spin {
    animation: spin 0.9s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

@media (max-width: 720px) {
    .scene-layout {
        grid-template-columns: 1fr;
    }

    .preview-panel {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid var(--color-border);
    }

    .preview-row {
        flex-direction: column;
    }

    .info-panel {
        height: auto;
    }

    .prompt-block {
        flex: none;
    }

    .prompt-input {
        flex: none;
        min-height: 120px;
        resize: vertical;
    }
}
</style>
