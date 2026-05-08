<script setup>
import { ref, watch, computed } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { Type, Hash } from 'lucide-vue-next';
import FlowNodeShell from '@/components/FlowNodeShell.vue';

const props = defineProps({
  id: String,
  data: Object,
});

const emit = defineEmits(['delete']);

const keyword = ref(props.data.keyword || '{{keyword}}');
const value = ref(props.data.value || '');

watch([keyword, value], () => {
  props.data.keyword = keyword.value;
  props.data.value = value.value;
});

const displayPreview = computed(() => {
  const v = String(value.value || '').trim();
  if (!v) return '— Chưa có nội dung —';
  return v.length > 320 ? `${v.slice(0, 320)}…` : v;
});

const onDelete = () => emit('delete', props.id);
</script>

<template>
  <div class="text-input-root">
    <FlowNodeShell
      label="Biến text"
      width="17rem"
      aspect-ratio="16 / 9"
      show-delete-button
      @delete="onDelete"
    >
      <template #icon>
        <Type :size="14" stroke-width="2" />
      </template>
      <template #viewport>
        <div class="media-fill preview-block">
          <div class="kw-pill">
            <Hash :size="12" />
            {{ keyword }}
          </div>
          <p class="preview-text">{{ displayPreview }}</p>
        </div>
      </template>
      <template #config>
        <div>
          <label class="fn-label">Keyword</label>
          <div class="hash-wrap">
            <Hash :size="12" class="hash-ic" />
            <input v-model="keyword" class="fn-input hash-in" placeholder="{{keyword}}" />
          </div>
        </div>
        <div>
          <label class="fn-label">Giá trị thay thế</label>
          <textarea v-model="value" class="fn-textarea" placeholder="Nội dung text…" />
        </div>
      </template>
    </FlowNodeShell>
    <Handle type="source" :position="Position.Right" id="out" />
  </div>
</template>

<style scoped>
.text-input-root {
  position: relative;
}

.media-fill {
  flex: 1;
  min-height: 0;
  background: linear-gradient(180deg, #0a0a0d 0%, #050506 100%);
}

.preview-block {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 2.35rem 0.75rem 0.75rem;
  gap: 0.65rem;
  box-sizing: border-box;
}

.kw-pill {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #d4d4d8;
  padding: 0.25rem 0.5rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.preview-text {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.5;
  color: #a1a1aa;
  white-space: pre-wrap;
  flex: 1;
  overflow-y: auto;
}

.hash-wrap {
  position: relative;
}

.hash-ic {
  position: absolute;
  left: 0.65rem;
  top: 50%;
  transform: translateY(-50%);
  color: #52525b;
  pointer-events: none;
}

.hash-in {
  padding-left: 2rem;
}
</style>
