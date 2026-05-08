<script setup>
import { inject, computed } from 'vue';
import { useFlowNodeGenTimer } from '../composables/useFlowNodeGenTimer.js';
import { shouldUseVideoPreview } from '@/utils/flowMedia.js';
import { Handle, Position } from '@vue-flow/core';
import { Cpu, Loader2, AlertCircle, CheckCircle2, PlayCircle, XCircle, Copy } from 'lucide-vue-next';
import FlowNodeShell from '@/components/FlowNodeShell.vue';

const props = defineProps({
  id: String,
  data: Object,
});

const emit = defineEmits(['delete']);
const openImage = inject('openImage');

const onRun = () => props.data.onRun?.();
const onDuplicate = () => props.data.onDuplicate?.();
const onClear = () => props.data.onChange?.({ result: null, status: 'idle', error: null });
const onDelete = () => emit('delete', props.id);

const nodeStatus = computed(() => props.data?.status ?? 'idle');
const { elapsedLabel } = useFlowNodeGenTimer(nodeStatus);
</script>

<template>
  <div class="ai-call-root">
    <FlowNodeShell
      label="Chat AI"
      width="18rem"
      aspect-ratio="16 / 9"
      :is-running="data.status === 'running'"
      show-delete-button
      @delete="onDelete"
    >
      <template #icon>
        <Cpu :size="14" stroke-width="2" />
      </template>
      <template #viewport>
        <div class="media-fill result-pane">
          <template v-if="data.result">
            <div class="text-scroll custom-scrollbar" @click.stop>{{ data.result }}</div>
            <button type="button" class="clear-fab" title="Xóa kết quả" @click.stop="onClear">×</button>
          </template>
          <div v-else class="idle-preview">
            <Cpu :size="38" class="idle-ic" />
            <span v-if="data.status === 'running'" class="idle-msg">
              <Loader2 :size="18" class="node-gen-spin" />
              Đang gọi… {{ elapsedLabel }}
            </span>
            <span v-else class="idle-msg">Bấm nút gọi AI phía dưới · ⚙ chỉnh prompt</span>
          </div>
        </div>
      </template>
      <template #config>
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
            placeholder="Prompt cho AI…"
            @input="data.onChange?.({ prompt: $event.target.value })"
          />
        </div>
        <div>
          <label class="fn-label">Biến output</label>
          <input
            class="fn-input"
            :value="data.keyword || '{{resultai}}'"
            placeholder="{{resultai}}"
            @input="data.onChange?.({ keyword: $event.target.value })"
          />
        </div>
        <div v-if="data.inputs?.length">
          <label class="fn-label">Ngữ cảnh ({{ data.inputs.length }})</label>
          <div class="fn-preview-scroll">
            <div
              v-for="(img, idx) in data.inputs"
              :key="idx"
              class="fn-thumb"
              @click="img && openImage?.(img)"
            >
              <video v-if="img && shouldUseVideoPreview(img)" :src="img" muted playsinline />
              <img v-else-if="img" :src="img" alt="" />
              <div v-else class="fn-thumb-pending">
                <Loader2 :size="14" class="node-gen-spin" />
              </div>
            </div>
          </div>
        </div>
        <button type="button" class="fn-btn fn-btn-ghost" @click="onDuplicate">
          <Copy :size="14" />
          Nhân đôi
        </button>
        <p v-if="data.error" class="fn-error" style="cursor: default">{{ data.error }}</p>
      </template>
      <template #run>
        <button
          type="button"
          class="flow-node-run-fab"
          :class="data.status === 'running' ? 'flow-node-run-fab--cancel' : 'flow-node-run-fab--primary'"
          :title="data.status === 'running' ? `Hủy (${elapsedLabel})` : 'Gọi AI'"
          @click.stop="data.status === 'running' ? data.onCancel?.() : onRun()"
        >
          <XCircle v-if="data.status === 'running'" :size="22" stroke-width="2" />
          <PlayCircle v-else :size="22" stroke-width="2" />
        </button>
      </template>
    </FlowNodeShell>
    <Handle type="target" :position="Position.Left" id="in" />
    <Handle type="source" :position="Position.Right" id="out" />
  </div>
</template>

<style scoped>
.ai-call-root {
  position: relative;
}

.media-fill {
  flex: 1;
  min-height: 0;
  background: #08080a;
  position: relative;
}

.result-pane {
  display: flex;
  flex-direction: column;
}

.text-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 2.5rem 0.75rem 0.75rem;
  font-size: 0.78rem;
  line-height: 1.55;
  color: #d4d4d8;
  white-space: pre-wrap;
  text-align: left;
}

.clear-fab {
  position: absolute;
  top: 2.75rem;
  right: 0.5rem;
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(12, 12, 14, 0.92);
  color: #e4e4e7;
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  z-index: 3;
}

.idle-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.idle-ic {
  color: #3f3f46;
  flex-shrink: 0;
}

.idle-msg {
  font-size: 0.72rem;
  color: #71717a;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0 0.85rem;
  text-align: center;
  max-width: 15rem;
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
