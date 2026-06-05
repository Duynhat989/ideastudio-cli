<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, AlertCircle, Download, Image as ImageIcon, Video, X, Maximize2 } from 'lucide-vue-next'

const props = defineProps({
    task: { type: Object, required: true },
    mediaType: { type: String, default: 'image' },
    aspectRatio: { type: String, default: '9 / 16' },
    label: { type: String, default: '' },
    compact: { type: Boolean, default: false },
    zoomable: { type: Boolean, default: false },
})

const emit = defineEmits(['download'])

const { t } = useI18n()

const isLightboxOpen = ref(false)

const isBusy = computed(() => props.task.status === 'generating')
const isError = computed(() => props.task.status === 'error')
const isSuccess = computed(() => props.task.status === 'success')
const isIdle = computed(() => props.task.status === 'idle')

const canZoom = computed(() =>
    props.zoomable && props.mediaType === 'image' && isSuccess.value && Boolean(props.task.result),
)

const errorText = computed(() => {
    const raw = String(props.task.error || '').trim()
    if (!raw) return t('gen.tileFailed')
    return raw.length > 60 ? `${raw.slice(0, 57)}…` : raw
})

const openLightbox = () => {
    if (!canZoom.value) return
    isLightboxOpen.value = true
}

const closeLightbox = () => {
    isLightboxOpen.value = false
}

const onKeydown = (e) => {
    if (e.key === 'Escape' && isLightboxOpen.value) closeLightbox()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
    <div
        class="media-preview"
        :class="{
            'media-preview--compact': compact,
            'media-preview--zoomable': canZoom,
        }"
        :style="{ '--preview-ar': aspectRatio }"
        :title="canZoom ? t('storyboard.clickToZoom') : label"
    >
        <header v-if="label" class="preview-label">
            <ImageIcon v-if="mediaType === 'image'" :size="10" />
            <Video v-else :size="10" />
            <span>{{ label }}</span>
        </header>

        <div v-if="isIdle" class="preview-empty">
            <component :is="mediaType === 'image' ? ImageIcon : Video" :size="compact ? 16 : 28" />
            <span v-if="!compact">{{ t('storyboard.previewEmpty') }}</span>
        </div>

        <div v-else-if="isBusy" class="preview-state">
            <Loader2 :size="compact ? 16 : 24" class="spin" />
            <span v-if="!compact">{{ t('gen.tileGenerating') }}</span>
            <small>{{ task.elapsedTime }}s</small>
        </div>

        <div v-else-if="isError" class="preview-state preview-state--err">
            <AlertCircle :size="compact ? 16 : 22" />
            <p v-if="!compact">{{ errorText }}</p>
        </div>

        <template v-else-if="isSuccess">
            <img
                v-if="mediaType === 'image'"
                :src="task.result"
                alt=""
                class="preview-media"
                :class="{ 'preview-media--zoomable': canZoom }"
                @click="openLightbox"
            />
            <video
                v-else
                :src="task.result"
                class="preview-media"
                :controls="!compact"
                playsinline
                preload="metadata"
            />
            <button type="button" class="dl-btn" :title="t('common.download')" @click.stop="emit('download')">
                <Download :size="compact ? 11 : 14" />
            </button>
            <button
                v-if="canZoom"
                type="button"
                class="zoom-btn"
                :title="t('storyboard.clickToZoom')"
                @click.stop="openLightbox"
            >
                <Maximize2 :size="compact ? 11 : 13" />
            </button>
        </template>
    </div>

    <Teleport to="body">
        <Transition name="sb-lightbox-fade">
            <div v-if="isLightboxOpen && canZoom" class="sb-lightbox-overlay" @click="closeLightbox">
                <div class="sb-lightbox-panel" role="dialog" :aria-label="label || t('storyboard.imagePreview')" @click.stop>
                    <header class="sb-lightbox-head">
                        <span v-if="label" class="sb-lightbox-title">{{ label }}</span>
                        <button type="button" class="sb-lightbox-close" :aria-label="t('common.close')" @click="closeLightbox">
                            <X :size="20" />
                        </button>
                    </header>
                    <img :src="task.result" alt="" class="sb-lightbox-image" />
                    <footer class="sb-lightbox-foot">
                        <a :href="task.result" target="_blank" rel="noopener noreferrer" class="sb-lightbox-link">
                            <Maximize2 :size="14" />
                            {{ t('storyboard.openOriginal') }}
                        </a>
                    </footer>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.media-preview {
    position: relative;
    width: 100%;
    aspect-ratio: var(--preview-ar, 9 / 16);
    border-radius: 10px;
    overflow: hidden;
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    flex-shrink: 0;
    align-self: flex-start;
    height: auto;
}

.media-preview--compact {
    width: 100%;
    aspect-ratio: var(--preview-ar, 9 / 16);
    height: auto;
    flex-shrink: 0;
    align-self: flex-start;
    border-radius: 8px;
}

.media-preview--zoomable:hover {
    border-color: rgba(234, 179, 8, 0.4);
}

.preview-label {
    position: absolute;
    top: 4px;
    left: 4px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.58rem;
    font-weight: 600;
    color: #e4e4e7;
    background: rgba(0, 0, 0, 0.62);
    padding: 2px 6px;
    border-radius: 999px;
    max-width: calc(100% - 8px);
    pointer-events: none;
}

.preview-label span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.preview-empty,
.preview-state {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px;
    text-align: center;
    color: var(--color-text-muted);
    font-size: 0.68rem;
}

.media-preview--compact .preview-empty,
.media-preview--compact .preview-state {
    padding: 4px;
    font-size: 0.58rem;
}

.preview-state {
    background: linear-gradient(110deg, var(--color-bg) 8%, var(--color-bg-soft) 18%, var(--color-bg) 33%);
    background-size: 200% 100%;
    animation: shimmer 1.4s ease-in-out infinite;
}

.preview-state--err {
    color: #fca5a5;
    background: rgba(127, 29, 29, 0.2);
    animation: none;
}

.preview-state p {
    margin: 0;
    font-size: 0.65rem;
    line-height: 1.3;
    word-break: break-word;
}

.preview-state small {
    font-variant-numeric: tabular-nums;
    color: #71717a;
    font-size: 0.58rem;
}

.preview-media {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    background: var(--color-bg);
}

.preview-media--zoomable {
    cursor: zoom-in;
}

.dl-btn,
.zoom-btn {
    position: absolute;
    bottom: 4px;
    z-index: 2;
    width: 22px;
    height: 22px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.72);
    color: #f4f4f5;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease;
}

.dl-btn {
    right: 4px;
}

.zoom-btn {
    right: 30px;
}

.media-preview:hover .dl-btn,
.media-preview:hover .zoom-btn,
.media-preview--zoomable .zoom-btn {
    opacity: 1;
}

.media-preview--compact .dl-btn,
.media-preview--compact .zoom-btn {
    width: 18px;
    height: 18px;
    border-radius: 5px;
}

.media-preview--compact .zoom-btn {
    right: 26px;
}

.sb-lightbox-overlay {
    position: fixed;
    inset: 0;
    z-index: 1200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.25rem;
    background: rgba(0, 0, 0, 0.88);
    backdrop-filter: blur(10px);
}

.sb-lightbox-panel {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: min(92vw, 960px);
    max-height: 92vh;
    width: 100%;
}

.sb-lightbox-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
}

.sb-lightbox-title {
    font-size: 0.88rem;
    font-weight: 600;
    color: #f4f4f5;
}

.sb-lightbox-close {
    margin-left: auto;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    padding: 6px;
    background: rgba(255, 255, 255, 0.06);
    color: #e4e4e7;
    cursor: pointer;
    display: inline-flex;
}

.sb-lightbox-close:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #fff;
}

.sb-lightbox-image {
    max-width: 100%;
    max-height: calc(92vh - 5rem);
    width: auto;
    height: auto;
    object-fit: contain;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.65);
    align-self: center;
}

.sb-lightbox-foot {
    display: flex;
    justify-content: center;
}

.sb-lightbox-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    background: rgba(255, 255, 255, 0.06);
    color: #f4f4f5;
    font-size: 0.8rem;
    font-weight: 600;
    text-decoration: none;
}

.sb-lightbox-link:hover {
    background: rgba(255, 255, 255, 0.12);
}

.sb-lightbox-fade-enter-active,
.sb-lightbox-fade-leave-active {
    transition: opacity 0.2s ease;
}

.sb-lightbox-fade-enter-from,
.sb-lightbox-fade-leave-to {
    opacity: 0;
}

.spin {
    animation: spin 0.9s linear infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

@keyframes shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
}
</style>
