<script setup>
import { computed, inject } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { Database } from 'lucide-vue-next';
import FlowNodeShell from '@/components/FlowNodeShell.vue';

const props = defineProps({ id: String, data: Object });
const emit = defineEmits(['delete']);
const openImage = inject('openImage');

const inputItems = computed(() => (props.data.inputs || []).filter(Boolean));

const isVideoUrl = (item) =>
  item &&
  (item.includes('.mp4') ||
    item.includes('.webm') ||
    item.includes('video') ||
    String(item).startsWith('blob:'));
</script>

<template>
  <div class="source-root">
    <FlowNodeShell
      label="Nguồn render"
      width="17.5rem"
      aspect-ratio="16 / 9"
      show-delete-button
      @delete="emit('delete', id)"
    >
      <template #icon>
        <Database :size="14" stroke-width="2" />
      </template>
      <template #viewport>
        <div v-if="inputItems.length" class="media-fill source-strip">
          <div
            v-for="(item, idx) in inputItems"
            :key="idx"
            class="source-strip-item"
            @click="openImage?.(item)"
          >
            <div class="source-strip-media-wrap">
              <video v-if="isVideoUrl(item)" :src="item" class="cover" muted playsinline />
              <img v-else :src="item" alt="" class="cover" />
            </div>
            <span class="source-strip-label">{{ isVideoUrl(item) ? 'Video' : 'Ảnh' }}</span>
          </div>
        </div>
        <div v-else class="media-fill idle-preview">
          <Database :size="38" class="idle-ic" />
          <span class="idle-msg">Nối asset vào để đưa vào Render</span>
        </div>
      </template>
      <template #config>
        <p class="fn-muted">Tài nguyên nối vào đây sẽ xuất hiện trong màn hình Render.</p>
        <div v-if="inputItems.length" class="fn-preview-scroll">
          <div
            v-for="(item, idx) in inputItems"
            :key="idx"
            class="fn-thumb"
            @click="openImage?.(item)"
          >
            <video v-if="isVideoUrl(item)" :src="item" muted playsinline class="cover" />
            <img v-else :src="item" alt="" class="cover" />
          </div>
        </div>
      </template>
    </FlowNodeShell>
    <Handle type="target" :position="Position.Left" id="in" />
  </div>
</template>

<style scoped>
.source-root {
  position: relative;
}

.media-fill {
  position: relative;
  flex: 1;
  min-height: 0;
  background: #050506;
}

.media-fill.idle-preview {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 0 0.85rem;
}

.source-strip {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0.35rem;
  height: 100%;
  width: 100%;
  min-height: 0;
  box-sizing: border-box;
  padding: 0 0.2rem;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x proximity;
  scrollbar-width: thin;
  cursor: default;
}

.source-strip::-webkit-scrollbar {
  height: 5px;
}

.source-strip::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.18);
  border-radius: 999px;
}

.source-strip-item {
  position: relative;
  display: flex;
  flex-direction: column;
  /* Mỗi ô ~1/3 chiều ngang node (kể cả chỉ có 1 asset); trừ gap giữa các ô */
  flex: 0 0 calc(33.333% - 0.24rem);
  max-width: calc(33.333% - 0.24rem);
  min-width: 0;
  min-height: 0;
  height: 100%;
  border-radius: 6px;
  overflow: hidden;
  scroll-snap-align: start;
  flex-shrink: 0;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-sizing: border-box;
}

.source-strip-media-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
  background: #0c0c0f;
}

.source-strip-label {
  flex-shrink: 0;
  display: block;
  text-align: center;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 0.22rem 0.2rem;
  background: rgba(12, 12, 15, 0.96);
  color: rgba(228, 228, 231, 0.92);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.idle-preview {
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
  text-align: center;
  padding: 0 0.25rem;
  max-width: 15rem;
  line-height: 1.35;
}
</style>
