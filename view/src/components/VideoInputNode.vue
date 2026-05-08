<script setup>
import { inject } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { Film, Upload } from 'lucide-vue-next';
import FlowNodeShell from '@/components/FlowNodeShell.vue';

const props = defineProps({
  id: String,
  data: Object,
});

const emit = defineEmits(['delete']);
const openImage = inject('openImage');

const onDelete = () => emit('delete', props.id);

const onFileChange = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onloadend = async () => {
    const rawValue = reader.result;
    props.data.onChange?.({ video: rawValue });
    if (props.data.onPersistAsset) {
      const savedUrl = await props.data.onPersistAsset('video', rawValue);
      if (savedUrl) props.data.onChange?.({ video: savedUrl });
    }
  };
  reader.readAsDataURL(file);
};
</script>

<template>
  <div class="video-input-root">
    <FlowNodeShell
      label="Video vào"
      width="17.5rem"
      :fixed-aspect="false"
      intrinsic-media
      show-delete-button
      @delete="onDelete"
    >
      <template #icon>
        <Film :size="14" stroke-width="2" />
      </template>
      <template #viewport>
        <div v-if="data.video" class="media-show" @click="openImage?.(data.video)">
          <video :src="data.video" controls playsinline class="vid" />
        </div>
        <label v-else class="upload-drop">
          <Upload :size="32" class="upload-ic" />
          <span class="upload-hint">Chọn video</span>
          <span class="upload-sub">MP4, WEBM</span>
          <input type="file" class="file-cover" accept="video/*" @change="onFileChange" />
        </label>
      </template>
      <template #config>
        <p class="fn-muted">Tên node và file nguồn.</p>
        <div>
          <label class="fn-label">Tên</label>
          <input
            class="fn-input"
            type="text"
            :value="data.name"
            placeholder="Tên video…"
            @input="data.onChange?.({ name: $event.target.value })"
          />
        </div>
        <label v-if="!data.video" class="fn-btn fn-btn-ghost fn-file-btn">
          <Upload :size="16" />
          Tải video
          <input type="file" class="file-cover" accept="video/*" @change="onFileChange" />
        </label>
        <button
          v-if="data.video"
          type="button"
          class="fn-btn fn-btn-ghost"
          @click="data.onChange?.({ video: null })"
        >
          Gỡ video
        </button>
      </template>
    </FlowNodeShell>
    <Handle type="source" :position="Position.Right" id="out" />
  </div>
</template>

<style scoped>
.video-input-root {
  position: relative;
}

.media-show {
  width: 100%;
  cursor: pointer;
  background: #050506;
  line-height: 0;
}

.vid {
  width: 100%;
  height: auto;
  display: block;
  vertical-align: bottom;
}

.upload-drop {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  width: 100%;
  min-height: 9.85rem;
  cursor: pointer;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  margin: 0;
  box-sizing: border-box;
}

.upload-ic {
  color: #52525b;
}

.upload-hint {
  font-size: 0.8rem;
  font-weight: 600;
  color: #a1a1aa;
}

.upload-sub {
  font-size: 0.62rem;
  color: #52525b;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.file-cover {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  font-size: 0;
  width: 100%;
  height: 100%;
}

.fn-file-btn {
  position: relative;
  overflow: hidden;
}
</style>
