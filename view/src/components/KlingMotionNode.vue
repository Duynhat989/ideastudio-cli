<script setup>
import { inject, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFlowNodeGenTimer } from '../composables/useFlowNodeGenTimer.js';
import { shouldUseVideoPreview } from '@/utils/flowMedia.js';
import { Handle, Position } from '@vue-flow/core';
import { Sparkles, PlayCircle, XCircle, Loader2, Copy, Trash2 } from 'lucide-vue-next';
import FlowNodeShell from '@/components/FlowNodeShell.vue';

const props = defineProps({
  id: String,
  data: Object,
  viewportAspect: { type: String, default: '16 / 9' },
});

const emit = defineEmits(['delete']);
const { t } = useI18n();
const openImage = inject('openImage');

const onRun = () => props.data.onRun?.();
const onDuplicate = () => props.data.onDuplicate?.();
const onDelete = () => emit('delete', props.id);
const onClear = () => props.data.onChange?.({ result: null, status: 'idle', error: null });

const nodeStatus = computed(() => props.data?.status ?? 'idle');
const { elapsedLabel } = useFlowNodeGenTimer(nodeStatus);
</script>

<template>
  <div class="kling-root">
    <FlowNodeShell
      label="Kling Motion"
      width="18rem"
      :aspect-ratio="viewportAspect"
      :is-running="data.status === 'running'"
      show-delete-button
      @delete="onDelete"
    >
      <template #icon>
        <Sparkles :size="14" stroke-width="2" />
      </template>
      <template #viewport>
        <div v-if="data.result" class="media-fill tap-open" @click="openImage?.(data.result)">
          <video :src="data.result" controls playsinline class="vid" />
          <button type="button" class="clear-fab" :title="t('flow.clearResult')" @click.stop="onClear">
            <Trash2 :size="15" />
          </button>
        </div>
        <div v-else class="media-fill idle-preview">
          <Sparkles :size="40" class="idle-ic" />
          <span v-if="data.status === 'running'" class="idle-msg">
            <Loader2 :size="18" class="node-gen-spin" />
            Đang xử lý… {{ elapsedLabel }}
          </span>
          <span v-else class="idle-msg">{{ t('flow.runKlingBelow') }}</span>
        </div>
      </template>
      <template #config>
        <div>
          <label class="fn-label">Prompt</label>
          <textarea
            class="fn-textarea"
            :value="data.prompt"
            placeholder="Mô tả chuyển động…"
            @input="data.onChange?.({ prompt: $event.target.value })"
          />
        </div>
        <div v-if="data.inputs?.length">
          <label class="fn-label">{{ t('common.context', { count: data.inputs.length }) }}</label>
          <div class="fn-preview-scroll">
            <div
              v-for="(item, index) in data.inputs"
              :key="index"
              class="fn-thumb"
              @click="item && openImage?.(item)"
            >
              <video v-if="item && shouldUseVideoPreview(item)" :src="item" muted playsinline />
              <img v-else-if="item" :src="item" alt="" />
              <div v-else class="fn-thumb-pending" />
            </div>
          </div>
        </div>
        <div class="fn-row" style="gap: 0.5rem">
          <div style="flex: 1; min-width: 0">
            <label class="fn-label">{{ t('flow.direction') }}</label>
            <select
              class="fn-select"
              :value="data.characterOrientation || 'video'"
              @change="data.onChange?.({ characterOrientation: $event.target.value })"
            >
              <option value="video">video</option>
              <option value="image">image</option>
            </select>
          </div>
          <div style="flex: 1; min-width: 0">
            <label class="fn-label">CFG</label>
            <input
              class="fn-input"
              type="number"
              step="0.1"
              :value="data.cfgScale ?? 0.5"
              @input="data.onChange?.({ cfgScale: Number($event.target.value) || 0.5 })"
            />
          </div>
        </div>
        <button type="button" class="fn-btn fn-btn-ghost" @click="onDuplicate">
          <Copy :size="14" />
          Nhân đôi
        </button>
      </template>
      <template v-if="data.error" #error>
        <p class="fn-error" style="cursor: default">{{ data.error }}</p>
      </template>
      <template #run>
        <button
          type="button"
          class="flow-node-run-fab"
          :class="
            data.status === 'running'
              ? 'flow-node-run-fab--cancel'
              : 'flow-node-run-fab--kling'
          "
          :title="data.status === 'running' ? t('flow.cancelRun', { time: elapsedLabel }) : t('flow.runKling')"
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
.kling-root {
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

.clear-fab {
  position: absolute;
  top: 2.75rem;
  right: 0.5rem;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 1px solid rgba(248, 113, 113, 0.35);
  background: rgba(12, 12, 14, 0.9);
  color: #f87171;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 3;
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  text-align: center;
  max-width: 15rem;
  line-height: 1.35;
  padding: 0 0.25rem;
}

.fn-thumb-pending {
  width: 100%;
  height: 100%;
  background: #141418;
}

</style>
