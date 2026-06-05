<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
    MapPin,
    Clock,
    Trees,
    Image as ImageIcon,
    Loader2,
    ChevronDown,
    ChevronUp,
    Clapperboard,
    RefreshCw,
} from 'lucide-vue-next'
import StoryboardShotCard from './StoryboardShotCard.vue'
import StoryboardMediaPreview from './StoryboardMediaPreview.vue'
import { storyAspectToCss } from '@/utils/storyboardAspect.js'
import { buildEnvironmentImagePrompt, buildEnvironmentStyleContext, normalizeEnvironmentPrompt } from '@/services/storyboardPromptBuilder.js'
import { runStoryboardImageGen } from '@/composables/useStoryboardSceneGen.js'
import { persistStoryboardAsset } from '@/utils/storyboardProject.js'
import { storyboardService } from '@/services/storyboard.service.js'

const props = defineProps({
    scene: { type: Object, required: true },
    projectId: { type: String, default: '' },
    settings: { type: Object, required: true },
    templateDefaults: { type: Object, default: () => ({}) },
    characterRefUrls: { type: Array, default: () => [] },
    expanded: { type: Boolean, default: true },
    busy: { type: Boolean, default: false },
})

const emit = defineEmits(['toggle', 'regenerate-shots'])

const { t } = useI18n()

const imageAspect = computed(() => storyAspectToCss(props.settings.aspectRatio, 'image'))
const shotCount = computed(() => props.scene.shots?.length || 0)

const sceneStatus = computed(() => {
    if (props.scene.scriptStatus === 'generating') return 'loading'
    if (props.scene.scriptStatus === 'error') return 'error'
    if (props.scene.scriptStatus === 'done') return 'done'
    return 'pending'
})

const envStatus = computed(() => {
    const s = props.scene.environmentImageTask?.status
    if (s === 'generating') return { label: t('storyboard.generating'), tone: 'loading' }
    if (s === 'success') return { label: t('storyboard.imageReady'), tone: 'ok' }
    if (s === 'error') return { label: t('storyboard.imageFailed'), tone: 'err' }
    return { label: t('storyboard.noImage'), tone: 'muted' }
})

const isRegeneratingShots = computed(() => props.scene.scriptStatus === 'generating')
const canRegenerateShots = computed(() => !props.busy && !isRegeneratingShots.value)

const envStyleContext = computed(() => buildEnvironmentStyleContext({
    settings: props.settings,
    templateDefaults: props.templateDefaults,
}))

const genEnvironment = async () => {
    if (!props.scene.environmentPrompt?.trim() || props.scene.environmentImageTask?.status === 'generating') return
    props.scene.environmentPrompt = normalizeEnvironmentPrompt(
        props.scene.environmentPrompt,
        envStyleContext.value,
    )
    try {
        await runStoryboardImageGen({
            task: props.scene.environmentImageTask,
            prompt: buildEnvironmentImagePrompt(props.scene.environmentPrompt, envStyleContext.value),
            refUrls: [],
            aspectRatio: props.settings.aspectRatio,
            imageModel: props.settings.imageModel,
        })
        if (props.projectId && props.scene.environmentImageTask?.result) {
            const saved = await persistStoryboardAsset(props.projectId, props.scene.environmentImageTask.result, {
                kind: 'scene-environment',
                sceneIndex: props.scene.index,
            })
            if (saved) {
                props.scene.environmentImageUrl = saved
                props.scene.environmentImageTask.result = storyboardService.assetUrl(saved)
            }
        }
    } catch {
        // task patched
    }
}
</script>

<template>
    <section
        :id="`storyboard-scene-${scene.index}`"
        class="scene-section"
        :class="[`scene-section--${sceneStatus}`, { 'scene-section--collapsed': !expanded }]"
    >
        <header class="scene-head">
            <button type="button" class="scene-head-toggle" @click="emit('toggle')">
                <span class="scene-index">{{ scene.index }}</span>
                <div class="scene-head-main">
                    <h3>{{ scene.label }}</h3>
                    <p v-if="scene.beat">{{ scene.beat }}</p>
                </div>
                <div class="scene-head-meta">
                    <span v-if="scene.location" class="meta-chip">
                        <MapPin :size="12" />
                        {{ scene.location }}
                    </span>
                    <span class="meta-chip">
                        <Clock :size="12" />
                        {{ scene.durationSec }}s
                    </span>
                    <span class="meta-chip meta-chip--accent">
                        {{ shotCount }} {{ t('storyboard.shots') }}
                    </span>
                </div>
                <span class="chevron-wrap" :class="{ open: expanded }">
                    <component :is="expanded ? ChevronUp : ChevronDown" :size="17" />
                </span>
            </button>
        </header>

        <div v-show="expanded" class="scene-body">
            <article v-if="scene.environmentPrompt" class="env-block">
                <div class="env-preview-col">
                    <StoryboardMediaPreview
                        :task="scene.environmentImageTask"
                        media-type="image"
                        :aspect-ratio="imageAspect"
                        :label="t('storyboard.environmentPreview')"
                        compact
                        zoomable
                    />
                </div>

                <div class="env-editor-col">
                    <div class="env-editor-head">
                        <span class="env-badge">
                            <Trees :size="13" />
                            {{ t('storyboard.environmentImage') }}
                        </span>
                        <span class="status-pill" :class="`status-pill--${envStatus.tone}`">
                            <ImageIcon :size="12" />
                            {{ envStatus.label }}
                        </span>
                    </div>

                    <label class="field-label">{{ t('storyboard.environmentPrompt') }}</label>
                    <textarea
                        v-model="scene.environmentPrompt"
                        class="env-textarea sb-textarea sb-textarea--env sb-textarea--mono sb-scroll"
                        :placeholder="t('storyboard.environmentPromptPlaceholder')"
                    />

                    <div class="env-editor-foot">
                        <small class="field-hint">{{ t('storyboard.environmentPromptHint') }}</small>
                        <div class="env-actions">
                            <button
                                type="button"
                                class="gen-btn gen-btn--env"
                                :disabled="!scene.environmentPrompt?.trim() || scene.environmentImageTask?.status === 'generating'"
                                @click="genEnvironment"
                            >
                                <Loader2 v-if="scene.environmentImageTask?.status === 'generating'" :size="14" class="spin" />
                                <ImageIcon v-else :size="14" />
                                {{ t('storyboard.genEnvironment') }}
                            </button>
                            <button
                                type="button"
                                class="gen-btn gen-btn--shots"
                                :disabled="!canRegenerateShots"
                                @click="emit('regenerate-shots')"
                            >
                                <Loader2 v-if="isRegeneratingShots" :size="14" class="spin" />
                                <RefreshCw v-else :size="14" />
                                {{ isRegeneratingShots ? t('storyboard.generating') : t('storyboard.regenerateShots') }}
                            </button>
                        </div>
                    </div>
                </div>
            </article>

            <div v-if="scene.scriptStatus === 'generating'" class="state-banner state-banner--loading">
                <Loader2 :size="16" class="spin" />
                {{ t('storyboard.generatingShots') }}
            </div>

            <div v-else-if="scene.scriptStatus === 'error'" class="state-banner state-banner--error">
                <span>{{ scene.scriptError || t('storyboard.generateFailed') }}</span>
                <button
                    type="button"
                    class="gen-btn gen-btn--shots gen-btn--inline"
                    :disabled="!canRegenerateShots"
                    @click="emit('regenerate-shots')"
                >
                    <RefreshCw :size="14" />
                    {{ t('storyboard.regenerateShots') }}
                </button>
            </div>

            <div v-else-if="scene.shots?.length" class="shots-block">
                <div class="shots-block-head">
                    <Clapperboard :size="14" />
                    <span>{{ t('storyboard.shotsInScene') }}</span>
                    <span class="shots-block-count">{{ shotCount }}</span>
                </div>
                <div class="shots-list">
                    <StoryboardShotCard
                        v-for="shot in scene.shots"
                        :key="`${scene.index}-${shot.index}`"
                        :shot="shot"
                        :scene="scene"
                        :project-id="projectId"
                        :settings="settings"
                        :template-defaults="templateDefaults"
                        :character-ref-urls="characterRefUrls"
                    />
                </div>
            </div>
        </div>
    </section>
</template>

<style scoped>
.scene-section {
    --scene-accent: rgba(234, 179, 8, 0.35);
    --env-accent: rgba(34, 197, 94, 0.35);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    background: var(--color-bg-elevated);
    overflow: hidden;
    scroll-margin-top: 1rem;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.03);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.scene-section:hover {
    border-color: rgba(234, 179, 8, 0.28);
}

.scene-section--loading {
    border-color: var(--scene-accent);
    box-shadow: 0 0 0 1px rgba(234, 179, 8, 0.08);
}

.scene-section--error {
    border-color: rgba(248, 113, 113, 0.45);
}

.scene-head {
    padding: 0;
    border-bottom: 1px solid var(--color-border);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent);
}

.scene-head-toggle {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 12px;
    width: 100%;
    border: none;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
    padding: 14px 16px;
}

.scene-index {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.88rem;
    font-weight: 800;
    color: var(--color-text-on-accent);
    background: linear-gradient(145deg, var(--color-accent), var(--color-accent-strong));
    box-shadow: 0 4px 14px var(--color-accent-glow-strong, rgba(234, 179, 8, 0.2));
}

.scene-head-main {
    min-width: 0;
}

.scene-head-main h3 {
    margin: 0;
    font-size: 0.98rem;
    font-weight: 700;
    letter-spacing: -0.01em;
}

.scene-head-main p {
    margin: 4px 0 0;
    font-size: 0.78rem;
    color: var(--color-text-muted);
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.scene-head-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
}

.meta-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.72rem;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 999px;
    padding: 4px 9px;
    background: var(--color-bg-soft);
}

.meta-chip--accent {
    color: var(--color-accent);
    border-color: var(--scene-accent);
    background: var(--color-accent-soft);
}

.chevron-wrap {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    color: var(--color-text-muted);
    background: var(--color-bg-soft);
    border: 1px solid var(--color-border);
    transition: transform 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.chevron-wrap.open {
    color: var(--color-accent);
    border-color: var(--scene-accent);
}

.scene-body {
    padding: 14px 16px 16px;
    display: grid;
    gap: 14px;
}

/* ── Environment: 300px preview + fill textarea ── */
.env-block {
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr);
    gap: 14px;
    align-items: start;
    padding: 10px;
    border-radius: 12px;
    border: 1px solid rgba(34, 197, 94, 0.22);
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.05), rgba(34, 197, 94, 0.02));
}

.env-preview-col {
    width: 300px;
    max-width: 300px;
    align-self: start;
}

.env-preview-col :deep(.media-preview) {
    width: 100%;
    height: auto;
    border-radius: 10px;
    border-color: rgba(34, 197, 94, 0.25);
    background: var(--color-bg);
}

.env-editor-col {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 6px;
}

.env-editor-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-shrink: 0;
}

.env-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 999px;
    font-size: 0.74rem;
    font-weight: 700;
    color: #ecfdf5;
    background: linear-gradient(135deg, #15803d, #22c55e);
}

.field-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--color-text-muted);
    flex-shrink: 0;
}

.env-textarea {
    flex: 0 1 auto;
    width: 100%;
    min-height: 120px;
    max-height: 240px;
    overflow-y: auto;
    resize: vertical;
}

.env-editor-foot {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-shrink: 0;
    padding-top: 2px;
}

.env-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
}

.field-hint {
    font-size: 0.68rem;
    color: var(--color-text-muted);
    line-height: 1.35;
}

.gen-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 9px;
    padding: 7px 12px;
    font-size: 0.76rem;
    font-weight: 600;
    cursor: pointer;
    flex-shrink: 0;
    border: 1px solid transparent;
}

.gen-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.gen-btn--env {
    border-color: rgba(34, 197, 94, 0.4);
    background: rgba(34, 197, 94, 0.12);
    color: var(--color-text);
}

.gen-btn--env:not(:disabled):hover {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.55);
}

.gen-btn--shots {
    border-color: rgba(234, 179, 8, 0.45);
    background: var(--color-accent-soft);
    color: var(--color-text);
}

.gen-btn--shots:not(:disabled):hover {
    border-color: rgba(234, 179, 8, 0.65);
    background: rgba(234, 179, 8, 0.18);
}

.gen-btn--inline {
    margin-left: auto;
    flex-shrink: 0;
}

.status-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.7rem;
    font-weight: 600;
}

.status-pill--ok { color: #4ade80; }
.status-pill--muted { color: #71717a; }
.status-pill--loading { color: var(--color-accent); }
.status-pill--err { color: #f87171; }

/* ── Shots nested block ── */
.shots-block {
    margin-left: 30px;
    padding-left: 18px;
    border-left: 2px solid var(--scene-accent);
    display: grid;
    gap: 10px;
}

.shots-block-head {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 0.76rem;
    font-weight: 700;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.shots-block-count {
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 5px;
    border-radius: 999px;
    background: var(--color-accent-soft);
    color: var(--color-accent);
    font-size: 0.68rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.shots-list {
    display: grid;
    gap: 10px;
}

.state-banner {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 10px;
    font-size: 0.82rem;
    margin-left: 30px;
}

.state-banner--loading {
    color: var(--color-accent);
    background: var(--color-accent-soft);
    border: 1px solid var(--scene-accent);
}

.state-banner--error {
    color: #f87171;
    background: rgba(248, 113, 113, 0.08);
    border: 1px solid rgba(248, 113, 113, 0.25);
}

.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 960px) {
    .scene-head-toggle {
        grid-template-columns: auto minmax(0, 1fr) auto;
        grid-template-rows: auto auto;
    }

    .scene-head-meta {
        grid-column: 2 / 3;
        grid-row: 2;
        justify-content: flex-start;
    }

    .chevron-wrap {
        grid-row: 1 / 3;
        align-self: center;
    }

    .env-block {
        grid-template-columns: 1fr;
    }

    .env-preview-col {
        width: 100%;
        max-width: none;
    }

    .env-editor-col {
        min-height: 0;
    }

    .env-textarea {
        min-height: 100px;
        max-height: 200px;
    }

    .shots-block,
    .state-banner {
        margin-left: 16px;
        padding-left: 14px;
    }
}
</style>
