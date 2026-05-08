<script setup>
import { inject, computed } from 'vue';
import { useFlowNodeGenTimer } from '../composables/useFlowNodeGenTimer.js';
import { shouldUseVideoPreview } from '@/utils/flowMedia.js';
import { Handle, Position } from '@vue-flow/core';
import { Wand2, Loader2, AlertCircle, CheckCircle2, XCircle, Download, Trash2 } from 'lucide-vue-next';
import FlowNodeShell from '@/components/FlowNodeShell.vue';

const props = defineProps({
  id: String,
  data: Object,
  /** `aspect-ratio` CSS theo project (9:16 / 16:9 / 1:1) */
  viewportAspect: { type: String, default: '16 / 9' },
});

const emit = defineEmits(['delete']);
const openImage = inject('openImage');

const nodeStatus = computed(() => props.data?.status ?? 'idle');
const { elapsedLabel } = useFlowNodeGenTimer(nodeStatus);
const hasPendingInputs = computed(() => (props.data?.inputs || []).some((v) => !v));
const canRun = computed(() => !hasPendingInputs.value && nodeStatus.value !== 'running');

const onRun = () => props.data.onRun?.();
const onDuplicate = () => props.data.onDuplicate?.();
const onClear = () => props.data.onChange?.({ result: null, status: 'idle', error: null });
const onDelete = () => emit('delete', props.id);

const onDownload = async () => {
  if (!props.data.result) return;
  try {
    const response = await fetch(props.data.result);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `image-${props.id}-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (err) {
    console.error('Download failed:', err);
  }
};

const copyError = async () => {
  const message = String(props.data?.error || '').trim();
  if (!message) return;
  try {
    await navigator.clipboard.writeText(message);
  } catch (err) {
    console.error('Copy error failed:', err);
  }
};
</script>

<template>
  <div class="image-gen-root">
    <FlowNodeShell
      label="Sinh ảnh"
      width="18rem"
      :aspect-ratio="viewportAspect"
      :is-running="data.status === 'running'"
      show-delete-button
      @delete="onDelete"
    >
      <template #icon>
        <Wand2 :size="14" stroke-width="2" />
      </template>
      <template #viewport>
        <div v-if="data.result" class="media-fill tap-open" @click="openImage(data.result)">
          <img :src="data.result" alt="" />
          <div class="hover-actions">
            <button type="button" class="mini-act" title="Tải xuống" @click.stop="onDownload">
              <Download :size="15" />
            </button>
            <button type="button" class="mini-act danger" title="Xóa kết quả" @click.stop="onClear">
              <Trash2 :size="15" />
            </button>
          </div>
        </div>
        <div v-else class="media-fill idle-preview">
          <Wand2 :size="40" class="idle-ic" />
          <span v-if="data.status === 'running'" class="idle-msg">
            <Loader2 :size="18" class="node-gen-spin" />
            Đang tạo… {{ elapsedLabel }}
          </span>
          <span v-else class="idle-msg">Bấm nút chạy phía dưới · ⚙ chỉnh prompt và model</span>
        </div>
      </template>
      <template #config>
        <div class="fn-row" style="justify-content: space-between">
          <span
            v-if="data.status === 'running'"
            class="fn-chip"
            style="background: rgba(14, 165, 233, 0.12); border-color: rgba(14, 165, 233, 0.35); color: #7dd3fc"
          >
            Đang chạy {{ elapsedLabel }}
          </span>
          <span v-else-if="data.status === 'completed'" class="fn-chip" style="color: #86efac; border-color: rgba(74, 222, 128, 0.35)">
            <CheckCircle2 :size="12" style="display: inline; vertical-align: middle" />
            Xong
          </span>
          <span v-else-if="data.status === 'error'" class="fn-chip" style="color: #fca5a5; border-color: rgba(248, 113, 113, 0.4)">
            <AlertCircle :size="12" style="display: inline; vertical-align: middle" />
            Lỗi
          </span>
        </div>
        <div>
          <label class="fn-label">Prompt</label>
          <textarea
            class="fn-textarea"
            :value="data.prompt"
            placeholder="Mô tả ảnh…"
            @input="data.onChange?.({ prompt: $event.target.value })"
          />
        </div>
        <div>
          <label class="fn-label">Model</label>
          <select
            class="fn-select"
            :value="data.imageModel"
            @change="data.onChange?.({ imageModel: $event.target.value })"
          >
            <option value="GEM_PIX_2">Gemini Pix 2</option>
            <option value="IMAGEN_3">Imagen 3</option>
          </select>
        </div>
        <div v-if="data.inputs?.length">
          <label class="fn-label">Ngữ cảnh ({{ data.inputs.length }})</label>
          <div class="fn-preview-scroll">
            <div
              v-for="(img, idx) in data.inputs"
              :key="idx"
              class="fn-thumb"
              @click="img && openImage(img)"
            >
              <video v-if="img && shouldUseVideoPreview(img)" :src="img" muted playsinline />
              <img v-else-if="img" :src="img" alt="" />
              <div v-else class="fn-thumb-pending">
                <Loader2 :size="14" class="node-gen-spin" />
              </div>
            </div>
          </div>
        </div>
        <button type="button" class="fn-btn fn-btn-ghost" @click="onDuplicate">Nhân đôi</button>
        <button v-if="data.error" type="button" class="fn-error" @click="copyError">{{ data.error }}</button>
      </template>
      <template #run>
        <button
          type="button"
          class="flow-node-run-fab"
          :class="data.status === 'running' ? 'flow-node-run-fab--cancel' : 'flow-node-run-fab--primary'"
          :disabled="data.status !== 'running' && !canRun"
          :title="
            data.status === 'running'
              ? `Hủy (${elapsedLabel})`
              : hasPendingInputs
                ? 'Chờ input upstream'
                : 'Tạo ảnh'
          "
          @click.stop="data.status === 'running' ? data.onCancel?.() : onRun()"
        >
          <XCircle v-if="data.status === 'running'" :size="22" stroke-width="2" />
          <Wand2 v-else :size="22" stroke-width="2" />
        </button>
      </template>
    </FlowNodeShell>
    <Handle type="target" :position="Position.Left" id="in" />
    <Handle type="source" :position="Position.Right" id="out" />
  </div>
</template>

<style scoped>
.image-gen-root {
  position: relative;
}

.media-fill {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  background: #050506;
}

.media-fill.idle-preview {
  align-items: center;
  box-sizing: border-box;
  padding: 0 0.85rem;
}

.media-fill img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tap-open {
  cursor: zoom-in;
  flex: 1;
  min-height: 0;
  position: relative;
}

.hover-actions {
  position: absolute;
  top: 2.75rem;
  right: 0.5rem;
  display: flex;
  gap: 0.35rem;
  opacity: 0;
  transition: opacity 0.15s ease;
  z-index: 3;
}

.tap-open:hover .hover-actions {
  opacity: 1;
}

.mini-act {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(12, 12, 14, 0.88);
  color: #e4e4e7;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.mini-act.danger {
  color: #f87171;
}

.idle-preview {
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex: 1;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.idle-ic {
  color: #3f3f46;
  flex-shrink: 0;
}

.idle-msg {
  font-size: 0.72rem;
  color: #71717a;
  text-align: center;
  padding: 0 0.25rem;
  max-width: 15rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  line-height: 1.35;
}

.fn-thumb-pending {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #141418;
  color: #52525b;
}

</style>
