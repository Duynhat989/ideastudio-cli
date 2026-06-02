<script setup>
import { Settings, X, Eraser, Trash2 } from 'lucide-vue-next';
import { IMAGE_MODELS } from '@/services/flowApiV3.js';

const open = defineModel('open', { type: Boolean, default: false });
const defaults = defineModel('defaults', { type: Object, required: true });

defineProps({
  videoModelOptions: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(['clear-results', 'clear-flow']);

const close = () => {
  open.value = false;
};

const onClearResults = () => {
  emit('clear-results');
  close();
};

const onClearFlow = () => {
  emit('clear-flow');
  close();
};
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fw-settings-overlay" @click="close">
      <div class="fw-settings-panel" role="dialog" aria-labelledby="fw-settings-title" @click.stop>
        <header class="fw-settings-header">
          <div class="fw-settings-title-wrap">
            <Settings :size="18" class="fw-settings-title-icon" />
            <h2 id="fw-settings-title">Cài đặt workflow</h2>
          </div>
          <button type="button" class="fw-settings-close" aria-label="Đóng" @click="close">
            <X :size="18" />
          </button>
        </header>

        <div class="fw-settings-body">
          <section class="fw-settings-section">
            <h3>Model mặc định (node mới)</h3>
            <p class="fw-settings-note">
              Tier video theo tài khoản Veo trong Setup. Đổi model trên từng node không ảnh hưởng mặc định chung.
            </p>

            <label class="fw-settings-field" for="fw-default-image-model">
              <span>Model ảnh</span>
              <select id="fw-default-image-model" v-model="defaults.imageModel" class="fw-settings-select">
                <option v-for="m in IMAGE_MODELS" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
            </label>

            <label class="fw-settings-field" for="fw-default-video-model">
              <span>Model video</span>
              <select id="fw-default-video-model" v-model="defaults.videoModel" class="fw-settings-select">
                <option v-for="m in videoModelOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
            </label>
          </section>

          <section class="fw-settings-section fw-settings-section--danger">
            <h3>Thao tác flow</h3>
            <div class="fw-settings-actions">
              <button type="button" class="fw-settings-btn" @click="onClearResults">
                <Eraser :size="16" />
                Clear Results
              </button>
              <button type="button" class="fw-settings-btn fw-settings-btn--danger" @click="onClearFlow">
                <Trash2 :size="16" />
                Clear Flow
              </button>
            </div>
          </section>
        </div>

        <footer class="fw-settings-footer">
          <button type="button" class="fw-settings-btn fw-settings-btn--primary" @click="close">Đóng</button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.fw-settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 1100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(10px);
}

.fw-settings-panel {
  width: 100%;
  max-width: 22rem;
  border: 1px solid #27272a;
  border-radius: 1rem;
  background: #09090b;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.85);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.fw-settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1.15rem;
  border-bottom: 1px solid #18181b;
  background: #0c0c0e;
}

.fw-settings-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.fw-settings-title-wrap h2 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: #f4f4f5;
}

.fw-settings-title-icon {
  color: #eab308;
  flex-shrink: 0;
}

.fw-settings-close {
  width: 2rem;
  height: 2rem;
  border: 1px solid #3f3f46;
  border-radius: 0.5rem;
  background: #18181b;
  color: #a1a1aa;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.fw-settings-close:hover {
  color: #e4e4e7;
  border-color: #52525b;
}

.fw-settings-body {
  padding: 1rem 1.15rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.fw-settings-section h3 {
  margin: 0 0 0.35rem;
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #a1a1aa;
}

.fw-settings-note {
  margin: 0 0 0.75rem;
  font-size: 0.68rem;
  line-height: 1.4;
  color: #71717a;
}

.fw-settings-field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 0.65rem;
}

.fw-settings-field > span {
  font-size: 0.72rem;
  color: #d4d4d8;
}

.fw-settings-select {
  width: 100%;
  border: 1px solid #3f3f46;
  border-radius: 0.5rem;
  padding: 0.45rem 0.55rem;
  font-size: 0.78rem;
  color: #e4e4e7;
  background: #18181b;
}

.fw-settings-section--danger {
  padding-top: 0.25rem;
  border-top: 1px solid #1f1f23;
}

.fw-settings-actions {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.fw-settings-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border-radius: 0.55rem;
  border: 1px solid #3f3f46;
  background: #18181b;
  color: #e4e4e7;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}

.fw-settings-btn:hover {
  border-color: #52525b;
  background: #1f1f23;
}

.fw-settings-btn--danger {
  color: #fca5a5;
  border-color: rgba(248, 113, 113, 0.35);
}

.fw-settings-btn--danger:hover {
  background: rgba(127, 29, 29, 0.25);
  border-color: rgba(248, 113, 113, 0.55);
}

.fw-settings-footer {
  padding: 0.75rem 1.15rem 1rem;
  border-top: 1px solid #18181b;
}

.fw-settings-btn--primary {
  border-color: rgba(234, 179, 8, 0.45);
  background: rgba(234, 179, 8, 0.12);
  color: #fde047;
}

.fw-settings-btn--primary:hover {
  background: rgba(234, 179, 8, 0.2);
}
</style>
