<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loader2, AlertCircle, X, Download, Scaling } from 'lucide-vue-next'

const { t } = useI18n()

const props = defineProps({
  task: { type: Object, required: true },
  aspectRatio: { type: String, default: '16 / 9' },
  mediaType: { type: String, default: 'image' },
  showUpscale: { type: Boolean, default: false },
})

const emit = defineEmits(['remove', 'upscale', 'download'])

const isBusy = computed(() =>
  ['generating', 'upscaling'].includes(props.task.status),
)

const errorText = computed(() => {
  const raw = String(props.task.error || '').trim()
  if (!raw) return t('gen.tileFailed')
  return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw
})
</script>

<template>
  <article class="gen-tile" :style="{ '--tile-ar': aspectRatio }">
    <button type="button" class="gen-tile-remove" :title="t('common.delete')" @click="emit('remove', task.id)">
      <X :size="14" />
    </button>

    <div v-if="isBusy" class="gen-tile-state gen-tile-state--load">
      <Loader2 :size="28" class="gen-tile-spin" />
      <span class="gen-tile-state-label">
        {{ task.status === 'upscaling' ? t('gen.tileUpscaling') : t('gen.tileGenerating') }}
      </span>
      <span class="gen-tile-timer">{{ task.elapsedTime }}s</span>
    </div>

    <div v-else-if="task.status === 'error'" class="gen-tile-state gen-tile-state--err">
      <AlertCircle :size="26" />
      <p class="gen-tile-err-msg">{{ errorText }}</p>
    </div>

    <template v-else-if="task.status === 'success'">
      <img v-if="mediaType === 'image'" :src="task.result" alt="" class="gen-tile-media" />
      <video
        v-else
        :src="task.result"
        class="gen-tile-media"
        controls
        playsinline
        preload="metadata"
      />
      <div class="gen-tile-hover">
        <button
          v-if="showUpscale && !task.isUpscaled"
          type="button"
          class="gen-tile-act"
          :title="t('gen.upscale2k')"
          @click="emit('upscale', task)"
        >
          <Scaling :size="15" />
        </button>
        <button type="button" class="gen-tile-act" :title="t('common.download')" @click="emit('download', task)">
          <Download :size="15" />
        </button>
      </div>
    </template>
  </article>
</template>

<style scoped>
.gen-tile {
  position: relative;
  min-width: 0;
  width: 100%;
  aspect-ratio: var(--tile-ar, 16 / 9);
  border-radius: 0.85rem;
  overflow: hidden;
  background: #141418;
  border: 1px solid #2b313b;
}

.gen-tile-remove {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  z-index: 4;
  width: 1.65rem;
  height: 1.65rem;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.65);
  color: #e4e4e7;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.gen-tile:hover .gen-tile-remove {
  opacity: 1;
}

.gen-tile-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.75rem;
  text-align: center;
  box-sizing: border-box;
}

.gen-tile-state--load {
  color: #a1a1aa;
  background: linear-gradient(110deg, #141418 8%, #1c1c22 18%, #141418 33%);
  background-size: 200% 100%;
  animation: gen-shimmer 1.4s ease-in-out infinite;
}

.gen-tile-state--err {
  color: #fca5a5;
  background: rgba(127, 29, 29, 0.15);
}

.gen-tile-spin {
  animation: gen-spin 0.9s linear infinite;
  color: #71717a;
}

.gen-tile-state-label {
  font-size: 0.78rem;
}

.gen-tile-timer {
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  color: #71717a;
}

.gen-tile-err-msg {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.35;
  max-width: 100%;
  word-break: break-word;
}

.gen-tile-media {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  background: #050506;
}

.gen-tile-hover {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  gap: 0.35rem;
  padding: 0.5rem;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.55), transparent 45%);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.gen-tile:hover .gen-tile-hover {
  opacity: 1;
}

.gen-tile-act {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(12, 12, 14, 0.88);
  color: #f4f4f5;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

@keyframes gen-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes gen-shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
</style>
