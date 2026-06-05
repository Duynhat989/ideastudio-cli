<script setup>
import { inject, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFlowNodeGenTimer } from '../composables/useFlowNodeGenTimer.js';
import { shouldUseVideoPreview } from '@/utils/flowMedia.js';
import { Handle, Position } from '@vue-flow/core';
import { Video, Loader2, AlertCircle, CheckCircle2, PlayCircle, XCircle, Download, Trash2 } from 'lucide-vue-next';
import FlowNodeShell from '@/components/FlowNodeShell.vue';
import { videoModelsForTier, normalizeVideoModel } from '@/services/flowApiV3.js';

const props = defineProps({
  id: String,
  data: Object,
  viewportAspect: { type: String, default: '16 / 9' },
});

const emit = defineEmits(['delete']);
const { t } = useI18n();
const openImage = inject('openImage');
const flowVideoTier = inject('flowVideoTier', () => 'ultra');

const nodeStatus = computed(() => props.data?.status ?? 'idle');
const { elapsedLabel } = useFlowNodeGenTimer(nodeStatus);
const hasPendingInputs = computed(() => (props.data?.inputs || []).some((v) => !v));
const canRun = computed(() => !hasPendingInputs.value && nodeStatus.value !== 'running');

const clipDurationSec = computed(() => {
  const n = Number(props.data?.clipDurationSec);
  return Number.isFinite(n) && n > 0 ? n : 8;
});

const segmentLabel = computed(() => {
  const s = props.data?.segmentLabel;
  return typeof s === 'string' ? s.trim() : '';
});

/** `frame` = đầu+cuối (tối đa 2 ảnh). `ingredient` = tham chiếu 1–4 ảnh (API reference). */
const isFrameMode = computed(() => String(props.data?.type || 'frame').toLowerCase() === 'frame');

const accountVideoTier = computed(() => {
  const t = flowVideoTier;
  return typeof t === 'object' && t != null && 'value' in t ? t.value : t;
});

const videoModelOptions = computed(() => videoModelsForTier(accountVideoTier.value));

const displayVideoModel = computed(() =>
  normalizeVideoModel(props.data?.videoModel, accountVideoTier.value),
);

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
    a.download = `video-${props.id}-${Date.now()}.mp4`;
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
  <div class="video-gen-root">
    <FlowNodeShell
      label="Sinh video"
      width="18rem"
      :aspect-ratio="viewportAspect"
      :is-running="data.status === 'running'"
      show-delete-button
      @delete="onDelete"
    >
      <template #icon>
        <Video :size="14" stroke-width="2" />
      </template>
      <template #viewport>
        <div v-if="data.result" class="media-fill tap-open" @click="openImage(data.result)">
          <video :src="data.result" controls playsinline class="vid" />
          <div class="hover-actions">
            <button type="button" class="mini-act" :title="t('common.download')" @click.stop="onDownload">
              <Download :size="15" />
            </button>
            <button type="button" class="mini-act danger" :title="t('flow.clearResult')" @click.stop="onClear">
              <Trash2 :size="15" />
            </button>
          </div>
        </div>
        <div v-else class="media-fill idle-preview">
          <Video :size="40" class="idle-ic" />
          <span v-if="data.status === 'running'" class="idle-msg">
            <Loader2 :size="18" class="node-gen-spin" />
            Đang tạo… {{ elapsedLabel }}
          </span>
          <span v-else class="idle-msg">{{ t('flow.runBelow') }}</span>
        </div>
      </template>
      <template #config>
        <div class="fn-row" style="flex-wrap: wrap; gap: 0.35rem">
          <span class="fn-chip">~{{ clipDurationSec }}s / clip</span>
          <span v-if="segmentLabel" class="fn-chip" style="color: #e4e4e7; border-color: #3f3f46; background: rgba(39, 39, 42, 0.6)">
            {{ segmentLabel }}
          </span>
        </div>
        <div class="fn-row" style="justify-content: flex-start">
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
            placeholder="Mô tả video…"
            @input="data.onChange?.({ prompt: $event.target.value })"
          />
        </div>
        <div>
          <label class="fn-label">Model video</label>
          <select
            class="fn-select"
            :value="displayVideoModel"
            @change="data.onChange?.({ videoModel: $event.target.value })"
          >
            <option v-for="m in videoModelOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </div>
        <div>
          <label class="fn-label">Kiểu đầu vào</label>
          <select class="fn-select" :value="data.type" @change="data.onChange?.({ type: $event.target.value })">
            <option value="frame">Frame — ảnh đầu &amp; cuối (tối đa 2)</option>
            <option value="ingredient">Thành phần — tham chiếu 1–4 ảnh</option>
          </select>
          <p v-if="isFrameMode" class="fn-mode-hint">
            Hai cổng bên trái: <strong>Đầu</strong> và <strong>Cuối</strong> (nối tiếp keyframe giữa các clip).
          </p>
          <p v-else class="fn-mode-hint">
            Một cổng <strong>TP</strong>: gom 1–4 ảnh làm thành phần; thứ tự theo thứ tự nối.
          </p>
        </div>
        <div v-if="data.inputs?.length">
          <label class="fn-label">{{ t('common.context', { count: data.inputs.length }) }}</label>
          <div class="fn-preview-scroll">
            <div
              v-for="(img, idx) in data.inputs"
              :key="idx"
              class="fn-thumb"
              :class="{ 'fn-thumb--frame-slot': data.type === 'frame' && idx < 2 }"
              @click="img && openImage(img)"
            >
              <span v-if="data.type === 'frame' && idx === 0" class="fn-thumb-slot">Đầu</span>
              <span v-if="data.type === 'frame' && idx === 1" class="fn-thumb-slot fn-thumb-slot--end">Cuối</span>
              <video v-if="img && shouldUseVideoPreview(img)" :src="img" class="preview-thumb" muted playsinline />
              <img v-else-if="img" :src="img" alt="" />
              <div v-else class="fn-thumb-pending">
                <Loader2 :size="14" class="node-gen-spin" />
              </div>
            </div>
          </div>
        </div>
        <button type="button" class="fn-btn fn-btn-ghost" @click="onDuplicate">{{ t('common.duplicate') }}</button>
      </template>
      <template v-if="data.error" #error>
        <button type="button" class="fn-error" @click="copyError">{{ data.error }}</button>
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
                : 'Tạo video'
          "
          @click.stop="data.status === 'running' ? data.onCancel?.() : onRun()"
        >
          <XCircle v-if="data.status === 'running'" :size="22" stroke-width="2" />
          <PlayCircle v-else :size="22" stroke-width="2" />
        </button>
      </template>
    </FlowNodeShell>
    <div v-if="isFrameMode" class="vg-target-handles">
      <Handle
        id="in-start"
        class="vg-handle vg-handle--start"
        type="target"
        :position="Position.Left"
        title="Ảnh đầu (keyframe)"
      />
      <Handle
        id="in-end"
        class="vg-handle vg-handle--end"
        type="target"
        :position="Position.Left"
        title="Ảnh cuối"
      />
    </div>
    <div v-else class="vg-target-handles vg-target-handles--ingredient">
      <Handle
        id="in-ref"
        class="vg-handle vg-handle--ref"
        type="target"
        :position="Position.Left"
        title="Ảnh tham chiếu (tối đa 4)"
      />
    </div>
    <Handle type="source" :position="Position.Right" id="out" />
  </div>
</template>

<style scoped>
.video-gen-root {
  position: relative;
}

.vg-target-handles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}

.vg-handle {
  pointer-events: auto;
}

.vg-handle--start {
  top: 32% !important;
}

.vg-handle--end {
  top: 68% !important;
}

.vg-target-handles--ingredient .vg-handle--ref {
  top: 50% !important;
}

.fn-mode-hint {
  margin: 0.35rem 0 0;
  font-size: 0.65rem;
  line-height: 1.35;
  color: rgba(161, 161, 170, 0.95);
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

.vid {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tap-open {
  cursor: pointer;
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

.preview-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
