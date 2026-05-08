<script setup>
import { Handle, Position } from '@vue-flow/core';
import { Flag } from 'lucide-vue-next';
import FlowNodeShell from '@/components/FlowNodeShell.vue';

const props = defineProps({
  id: String,
  data: Object,
});

const emit = defineEmits(['delete']);
</script>

<template>
  <div class="loop-end-root">
    <FlowNodeShell
      label="Kết thúc lặp"
      width="14rem"
      aspect-ratio="16 / 9"
      :show-config="true"
      show-delete-button
      @delete="emit('delete', props.id)"
    >
      <template #icon>
        <Flag :size="14" stroke-width="2" />
      </template>
      <template #viewport>
        <div class="media-fill idle-preview">
          <Flag :size="32" class="idle-ic" />
          <p class="hint">Đánh dấu kết thúc ý tưởng pipeline. <strong>Loop Flow</strong> không cần nối tới đây.</p>
        </div>
      </template>
      <template #config>
        <p class="fn-muted">
          Node này chỉ để bạn đặt trên canvas cho dễ đọc flow. Logic lặp dừng theo tùy chọn “flow chạy xong” hoặc “timer” trên node Loop Flow.
        </p>
      </template>
    </FlowNodeShell>
    <Handle type="target" :position="Position.Left" id="in" />
    <Handle type="source" :position="Position.Right" id="out" />
  </div>
</template>

<style scoped>
.loop-end-root {
  position: relative;
}

.media-fill {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #0c0a0f;
}

.idle-preview {
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0.65rem;
  box-sizing: border-box;
}

.idle-ic {
  color: #6366f1;
  opacity: 0.85;
  flex-shrink: 0;
}

.hint {
  margin: 0.5rem 0 0;
  font-size: 0.68rem;
  line-height: 1.4;
  color: #a1a1aa;
  max-width: 12.5rem;
}
</style>
