<script setup>
import { inject } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import { Image as ImageIcon, Upload } from 'lucide-vue-next';
import FlowNodeShell from '@/components/FlowNodeShell.vue';

const props = defineProps({
  id: String,
  data: Object,
});

const emit = defineEmits(['delete']);
const openImage = inject('openImage');

const onFileChange = (e) => {
  const file = e.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onloadend = async () => {
      const rawValue = reader.result;
      props.data.onChange?.({ image: rawValue });
      if (props.data.onPersistAsset) {
        const savedUrl = await props.data.onPersistAsset('image', rawValue);
        if (savedUrl) props.data.onChange?.({ image: savedUrl });
      }
    };
    reader.readAsDataURL(file);
  }
};

const onDelete = () => emit('delete', props.id);
</script>

<template>
  <div class="image-input-root">
    <FlowNodeShell
      label="Ảnh vào"
      width="17.5rem"
      :fixed-aspect="false"
      intrinsic-media
      show-delete-button
      @delete="onDelete"
    >
      <template #icon>
        <ImageIcon :size="14" stroke-width="2" />
      </template>
      <template #viewport>
        <div v-if="data.image" class="media-show" @click="openImage(data.image)">
          <img :src="data.image" alt="" />
        </div>
        <label v-else class="upload-drop">
          <Upload :size="32" class="upload-ic" />
          <span class="upload-hint">Chọn ảnh</span>
          <span class="upload-sub">PNG, JPG, WEBP</span>
          <input type="file" class="file-cover" accept="image/*" @change="onFileChange" />
        </label>
      </template>
      <template #config>
        <p class="fn-muted">Đặt tên gợi nhớ và quản lý file ảnh.</p>
        <div>
          <label class="fn-label">Tên / mô tả</label>
          <input
            class="fn-input"
            type="text"
            :value="data.name"
            placeholder="Ví dụ: Ảnh SP nền trắng…"
            @input="data.onChange?.({ name: $event.target.value })"
          />
        </div>
        <label v-if="!data.image" class="fn-btn fn-btn-ghost fn-file-btn">
          <Upload :size="16" />
          Tải ảnh lên
          <input type="file" class="file-cover" accept="image/*" @change="onFileChange" />
        </label>
        <button
          v-if="data.image"
          type="button"
          class="fn-btn fn-btn-ghost"
          @click="data.onChange?.({ image: null })"
        >
          Gỡ ảnh
        </button>
      </template>
    </FlowNodeShell>
    <Handle type="source" :position="Position.Right" id="out" />
  </div>
</template>

<style scoped>
.image-input-root {
  position: relative;
}

.media-show {
  width: 100%;
  cursor: pointer;
  background: #050506;
  line-height: 0;
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
