<script setup>
import { ref, computed } from 'vue'
import {
  Plus,
  Settings2,
  ArrowRight,
  LayoutGrid,
  ChevronDown,
  Image as ImageIcon,
  Video,
} from 'lucide-vue-next'
import GenResultTile from './GenResultTile.vue'
import { BATCH_COUNT_OPTIONS } from '@/composables/useGenBatchTasks.js'

const props = defineProps({
  title: { type: String, required: true },
  tasks: { type: Array, default: () => [] },
  prompt: { type: String, default: '' },
  batchCount: { type: Number, default: 1 },
  aspectRatio: { type: String, default: '16 / 9' },
  mediaType: { type: String, default: 'image' },
  modelLabel: { type: String, default: '' },
  canGenerate: { type: Boolean, default: false },
  isSubmitting: { type: Boolean, default: false },
  showUpscale: { type: Boolean, default: false },
  promptPlaceholder: { type: String, default: 'Bạn muốn tạo gì?' },
  accent: { type: String, default: 'image' },
})

const emit = defineEmits([
  'update:prompt',
  'update:batchCount',
  'generate',
  'remove-task',
  'upscale-task',
  'download-task',
])

const settingsOpen = ref(false)
const countMenuOpen = ref(false)

const hasTasks = computed(() => props.tasks.length > 0)
const emptyIcon = computed(() => (props.mediaType === 'video' ? Video : ImageIcon))

const onPromptInput = (e) => emit('update:prompt', e.target.value)

const pickBatchCount = (n) => {
  emit('update:batchCount', n)
  countMenuOpen.value = false
}

const submit = () => {
  if (!props.canGenerate || props.isSubmitting) return
  emit('generate')
}

const onPromptKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}
</script>

<template>
  <div class="studio" :class="`studio--${accent}`">
    <main class="studio-canvas">
      <div v-if="!hasTasks" class="studio-empty">
        <component :is="emptyIcon" :size="48" class="studio-empty-icon" />
        <p>Nhập prompt và bấm gửi để tạo {{ mediaType === 'video' ? 'video' : 'ảnh' }}</p>
        <small>Mỗi lần có thể chạy {{ batchCount }} tác vụ song song</small>
      </div>

      <div v-else class="studio-grid" role="list">
        <GenResultTile
          v-for="task in tasks"
          :key="task.id"
          :task="task"
          :aspect-ratio="aspectRatio"
          :media-type="mediaType"
          :show-upscale="showUpscale"
          @remove="emit('remove-task', $event)"
          @upscale="emit('upscale-task', $event)"
          @download="emit('download-task', $event)"
        />
      </div>
    </main>

    <div class="studio-dock-wrap">
      <div class="studio-dock">
        <div class="studio-dock-top">
          <button
            type="button"
            class="studio-dock-icon-btn"
            :class="{ active: settingsOpen }"
            title="Cấu hình & ảnh tham chiếu"
            @click="settingsOpen = !settingsOpen"
          >
            <Plus :size="18" />
          </button>
          <textarea
            class="studio-prompt"
            :value="prompt"
            :placeholder="promptPlaceholder"
            rows="1"
            @input="onPromptInput"
            @keydown="onPromptKeydown"
          />
        </div>

        <div v-if="settingsOpen" class="studio-settings-panel">
          <div class="studio-settings-head">
            <Settings2 :size="16" />
            <span>Cấu hình</span>
            <button type="button" class="studio-settings-close" @click="settingsOpen = false">Đóng</button>
          </div>
          <slot name="settings" />
        </div>

        <div class="studio-dock-bar">
          <button type="button" class="studio-pill studio-pill--ghost" @click="settingsOpen = !settingsOpen">
            <Settings2 :size="14" />
            <span>{{ modelLabel || 'Model' }}</span>
          </button>

          <div class="studio-count-wrap">
            <button
              type="button"
              class="studio-pill"
              :title="`Số lượng tạo đồng thời: ${batchCount}`"
              @click="countMenuOpen = !countMenuOpen"
            >
              <LayoutGrid :size="14" />
              <span>{{ batchCount }}x</span>
              <ChevronDown :size="14" />
            </button>
            <div v-if="countMenuOpen" class="studio-count-menu">
              <button
                v-for="n in BATCH_COUNT_OPTIONS"
                :key="n"
                type="button"
                :class="['studio-count-opt', { active: batchCount === n }]"
                @click="pickBatchCount(n)"
              >
                {{ n }}x
              </button>
            </div>
          </div>

          <button
            type="button"
            class="studio-send"
            :disabled="!canGenerate"
            title="Tạo"
            @click="submit"
          >
            <ArrowRight :size="20" />
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="countMenuOpen"
      class="studio-backdrop"
      @click="countMenuOpen = false"
    />
  </div>
</template>

<style scoped>
.studio {
  --studio-accent: #facc15;
  --studio-send-bg: linear-gradient(135deg, #facc15, #eab308);
  position: relative;
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 1rem);
  height: calc(100vh - 1rem);
  display: flex;
  flex-direction: column;
  color: #f3f4f6;
  background: #09090b;
}

.studio--video {
  --studio-accent: #38bdf8;
  --studio-send-bg: linear-gradient(135deg, #38bdf8, #0ea5e9);
}

.studio-canvas {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem 1.25rem 11rem;
}

.studio-empty {
  min-height: 50vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: #71717a;
  text-align: center;
}

.studio-empty-icon {
  color: #3f3f46;
}

.studio-empty p {
  margin: 0;
  font-size: 0.95rem;
  color: #a1a1aa;
}

.studio-empty small {
  font-size: 0.8rem;
}

.studio-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.studio-dock-wrap {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 1.25rem;
  z-index: 30;
  display: flex;
  justify-content: center;
  padding: 0 1rem;
  pointer-events: none;
}

.studio-dock {
  pointer-events: auto;
  width: min(720px, 100%);
  background: rgba(24, 24, 27, 0.96);
  border: 1px solid #3f3f46;
  border-radius: 1.25rem;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(12px);
  padding: 0.65rem 0.75rem 0.55rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.studio-dock-top {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
}

.studio-dock-icon-btn {
  flex-shrink: 0;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.65rem;
  border: 1px solid #3f3f46;
  background: #27272a;
  color: #d4d4d8;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.studio-dock-icon-btn.active {
  border-color: var(--studio-accent);
  color: var(--studio-accent);
}

.studio-prompt {
  flex: 1;
  min-height: 2.25rem;
  max-height: 8rem;
  resize: none;
  border: none;
  background: transparent;
  color: #f4f4f5;
  font-size: 0.9rem;
  line-height: 1.45;
  padding: 0.35rem 0.15rem;
  font-family: inherit;
}

.studio-prompt:focus {
  outline: none;
}

.studio-prompt::placeholder {
  color: #71717a;
}

.studio-settings-panel {
  border-top: 1px solid #3f3f46;
  padding-top: 0.65rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  max-height: 40vh;
  overflow-y: auto;
}

.studio-settings-head {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: #d4d4d8;
}

.studio-settings-close {
  margin-left: auto;
  border: none;
  background: none;
  color: #71717a;
  font-size: 0.75rem;
  cursor: pointer;
}

.studio-dock-bar {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.studio-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  border-radius: 999px;
  border: 1px solid #3f3f46;
  background: #27272a;
  color: #e4e4e7;
  font-size: 0.78rem;
  cursor: pointer;
  white-space: nowrap;
}

.studio-pill--ghost:hover {
  border-color: #52525b;
}

.studio-count-wrap {
  position: relative;
}

.studio-count-menu {
  position: absolute;
  bottom: calc(100% + 0.35rem);
  left: 0;
  min-width: 4.5rem;
  background: #18181b;
  border: 1px solid #3f3f46;
  border-radius: 0.65rem;
  padding: 0.25rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  z-index: 40;
}

.studio-count-opt {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  color: #d4d4d8;
  text-align: left;
  padding: 0.4rem 0.65rem;
  border-radius: 0.4rem;
  font-size: 0.8rem;
  cursor: pointer;
}

.studio-count-opt:hover,
.studio-count-opt.active {
  background: #27272a;
  color: var(--studio-accent);
}

.studio-send {
  margin-left: auto;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  border-radius: 50%;
  background: var(--studio-send-bg);
  color: #0a0a0a;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.studio-send:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.studio-backdrop {
  position: absolute;
  inset: 0;
  z-index: 25;
}

@media (max-width: 960px) {
  .studio-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .studio-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .studio-canvas {
    padding-bottom: 12rem;
  }
}
</style>
