<script setup>
import { Handle, Position } from '@vue-flow/core';
import { Zap } from 'lucide-vue-next';
import FlowNodeShell from '@/components/FlowNodeShell.vue';

const props = defineProps({
  id: String,
  data: Object,
});

const emit = defineEmits(['delete']);

const onRun = () => props.data.onRun?.();
const onDelete = () => emit('delete', props.id);
</script>

<template>
  <div class="start-root">
    <FlowNodeShell
      label="Bắt đầu"
      width="16.5rem"
      :fixed-aspect="false"
      show-delete-button
      @delete="onDelete"
    >
      <template #icon>
        <Zap :size="14" stroke-width="2" fill="currentColor" />
      </template>
      <template #viewport>
        <div class="start-view">
          <button type="button" class="run-cta" @click="onRun">
            <Zap :size="22" fill="currentColor" />
            Chạy flow
          </button>
          <p class="hint">Nhấn để chạy automation từ node này.</p>
        </div>
      </template>
      <template #config>
        <p class="fn-muted">Node khởi động luồng. Giữ một node Bắt đầu trên canvas để chạy toàn bộ flow.</p>
      </template>
    </FlowNodeShell>
    <Handle type="source" :position="Position.Right" id="out" />
  </div>
</template>

<style scoped>
.start-root {
  position: relative;
}

.start-view {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 0.65rem;
  min-height: 7.5rem;
  padding: 20px;
  padding-top: 20%;
}

.run-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  width: 100%;
  padding: 0.75rem 1rem;
  border: none;
  border-radius: 14px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #111;
  background: linear-gradient(135deg, #facc15 0%, #eab308 100%);
  box-shadow: 0 6px 20px rgba(250, 204, 21, 0.28);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.run-cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 26px rgba(250, 204, 21, 0.35);
}

.hint {
  margin: 0;
  font-size: 0.65rem;
  color: #71717a;
  text-align: center;
  line-height: 1.45;
}
</style>
