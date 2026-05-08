<script setup>
import { ref, watch, computed, inject, nextTick } from 'vue';
import { Handle, Position } from '@vue-flow/core';
import {
  PlayCircle,
  Trash2,
  Video,
  Play,
  ArrowLeft,
  ArrowRight,
  PauseCircle,
  Download,
  Loader2,
} from 'lucide-vue-next';
import FlowNodeShell from '@/components/FlowNodeShell.vue';

const props = defineProps({
  id: String,
  data: Object,
  viewportAspect: { type: String, default: '16 / 9' },
});

const emit = defineEmits(['delete']);
const openImage = inject('openImage');

const currentIndex = ref(0);
const isPlayingAll = ref(false);
const videoRef = ref(null);

const videos = computed(() => props.data.inputs || []);

const playCurrentVideo = async () => {
  await nextTick();
  const el = videoRef.value;
  if (!el || !isPlayingAll.value) return;
  try {
    await el.play();
  } catch (err) {
    console.log('Play prevented:', err);
  }
};

watch(videos, (newVideos) => {
  if (newVideos.length === 0) return;
  if (currentIndex.value >= newVideos.length) currentIndex.value = 0;
}, { immediate: true });

watch(() => props.data.currentIndex, (newVal) => {
  if (newVal !== undefined) currentIndex.value = newVal;
});

watch(() => props.data.resetTrigger, () => {
  currentIndex.value = 0;
  isPlayingAll.value = false;
});

const onDelete = () => emit('delete', props.id);

const onDownload = async () => {
  if (videos.value.length === 0) return;
  const currentVideo = videos.value[currentIndex.value];
  try {
    const response = await fetch(currentVideo);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preview-video-${props.id}-${currentIndex.value}-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (err) {
    console.error('Download failed:', err);
  }
};

const handleEnded = () => {
  if (videos.value.length > 0) {
    currentIndex.value = (currentIndex.value + 1) % videos.value.length;
    isPlayingAll.value = true;
  }
};

const moveItem = (index, direction) => {
  const newVideos = [...videos.value];
  const targetIndex = direction === 'left' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= videos.value.length) return;
  const temp = newVideos[index];
  newVideos[index] = newVideos[targetIndex];
  newVideos[targetIndex] = temp;
  props.data.onReorder?.(newVideos);
};

watch([currentIndex, isPlayingAll], () => {
  const el = videoRef.value;
  if (!el) return;
  if (isPlayingAll.value) void playCurrentVideo();
  else el.pause();
});
</script>

<template>
  <div class="video-preview-root">
    <FlowNodeShell
      label="Xem video"
      width="19rem"
      :aspect-ratio="viewportAspect"
      show-delete-button
      @delete="onDelete"
    >
      <template #icon>
        <PlayCircle :size="14" stroke-width="2" />
      </template>
      <template #viewport>
        <div v-if="videos.length > 0" class="media-fill">
          <video
            v-if="videos[currentIndex]"
            :key="videos[currentIndex]"
            ref="videoRef"
            :src="videos[currentIndex]"
            playsinline
            class="vid"
            @ended="handleEnded"
            @click="isPlayingAll = !isPlayingAll"
          />
          <div v-else class="gen-wait">
            <Loader2 :size="36" class="node-gen-spin" />
            <span>Đang tạo clip {{ currentIndex + 1 }}…</span>
          </div>
          <div class="clip-badge">{{ currentIndex + 1 }} / {{ videos.length }}</div>
          <div v-if="isPlayingAll" class="play-all-badge">Phát liên tục</div>
        </div>
        <div v-else class="media-fill idle-preview">
          <Video :size="40" class="idle-ic" />
          <span class="idle-msg">Chưa nối video vào</span>
        </div>
      </template>
      <template #config>
        <p class="fn-muted">Playlist, tải xuống và sắp xếp clip.</p>
        <div class="fn-row" style="justify-content: space-between; width: 100%">
          <span class="fn-chip">{{ videos.length }} clip</span>
          <button
            v-if="videos.length > 0"
            type="button"
            class="fn-btn fn-btn-ghost"
            style="width: auto; padding: 0.4rem 0.65rem"
            @click="onDownload"
          >
            <Download :size="15" />
            Tải clip hiện tại
          </button>
        </div>
        <button
          type="button"
          class="fn-btn fn-btn-primary"
          :disabled="videos.length === 0"
          @click="isPlayingAll = !isPlayingAll"
        >
          <PauseCircle v-if="isPlayingAll" :size="16" />
          <PlayCircle v-else :size="16" />
          {{ isPlayingAll ? 'Tạm dừng' : 'Phát / tiếp tục' }}
        </button>
        <div v-if="videos.length > 0" class="playlist">
          <label class="fn-label">Danh sách (kéo thứ tự)</label>
          <div class="playlist-scroll custom-scrollbar">
            <div
              v-for="(v, i) in videos"
              :key="i"
              :class="['pl-item', { active: currentIndex === i }]"
              @click="openImage(v)"
            >
              <div class="pl-thumb">
                <video v-if="v" :src="v" class="pl-vid" muted playsinline />
                <Loader2 v-else :size="14" class="node-gen-spin" />
              </div>
              <span class="pl-name">Clip {{ i + 1 }}</span>
              <div class="pl-actions">
                <button type="button" class="pl-icon" :disabled="i === 0" @click.stop="moveItem(i, 'left')">
                  <ArrowLeft :size="12" />
                </button>
                <button
                  type="button"
                  class="pl-icon"
                  :disabled="i === videos.length - 1"
                  @click.stop="moveItem(i, 'right')"
                >
                  <ArrowRight :size="12" />
                </button>
                <button
                  type="button"
                  :class="['pl-icon', { on: currentIndex === i }]"
                  @click.stop="currentIndex = i"
                >
                  <Play :size="12" :fill="currentIndex === i ? 'currentColor' : 'none'" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </FlowNodeShell>
    <Handle type="target" :position="Position.Left" id="in" :connectable-start="false" />
    <Handle type="source" :position="Position.Right" id="out" :connectable-end="false" />
  </div>
</template>

<style scoped>
.video-preview-root {
  position: relative;
}

.media-fill {
  position: relative;
  flex: 1;
  min-height: 0;
  background: #000;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
}

.vid {
  width: 100%;
  flex: 1;
  min-height: 0;
  object-fit: cover;
  cursor: pointer;
}

.gen-wait {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: #71717a;
  font-size: 0.72rem;
  width: 100%;
  flex: 1;
  min-height: 0;
}

.clip-badge {
  position: absolute;
  top: 2.6rem;
  left: 0.55rem;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 0.2rem 0.45rem;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #f4f4f5;
  z-index: 3;
  pointer-events: none;
}

.play-all-badge {
  position: absolute;
  top: 2.6rem;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.58rem;
  font-weight: 800;
  text-transform: uppercase;
  padding: 0.2rem 0.5rem;
  border-radius: 6px;
  background: rgba(250, 204, 21, 0.92);
  color: #111;
  z-index: 3;
  pointer-events: none;
}

.media-fill.idle-preview {
  align-items: center;
  box-sizing: border-box;
  padding: 0 0.85rem;
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
  max-width: 15rem;
  line-height: 1.35;
  padding: 0 0.25rem;
}

.playlist-scroll {
  display: flex;
  gap: 0.45rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.pl-item {
  flex-shrink: 0;
  width: 132px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: #121214;
  overflow: hidden;
  cursor: pointer;
  position: relative;
}

.pl-item.active {
  border-color: rgba(14, 165, 233, 0.45);
  box-shadow: 0 0 0 1px rgba(14, 165, 233, 0.2);
}

.pl-thumb {
  height: 74px;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pl-vid {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.88;
}

.pl-name {
  display: block;
  font-size: 0.58rem;
  color: #a1a1aa;
  text-align: center;
  padding: 0.2rem;
  background: rgba(0, 0, 0, 0.35);
}

.pl-actions {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 2px;
  background: rgba(0, 0, 0, 0.55);
  border-radius: 6px;
  padding: 2px;
}

.pl-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #a1a1aa;
  cursor: pointer;
}

.pl-icon:hover:not(:disabled) {
  color: #f4f4f5;
  background: rgba(255, 255, 255, 0.08);
}

.pl-icon:disabled {
  opacity: 0.25;
  cursor: default;
}

.pl-icon.on {
  color: #facc15;
}
</style>
