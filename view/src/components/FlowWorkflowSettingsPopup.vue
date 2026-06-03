<script setup>
import { Settings, X, Eraser, Trash2 } from 'lucide-vue-next';
import { useI18n } from 'vue-i18n';
import { IMAGE_MODELS } from '@/services/flowApiV3.js';

const { t } = useI18n();

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
            <h2 id="fw-settings-title">{{ t('flow.workflowSettings') }}</h2>
          </div>
          <button type="button" class="fw-settings-close" :aria-label="t('common.close')" @click="close">
            <X :size="18" />
          </button>
        </header>

        <div class="fw-settings-body">
          <section class="fw-settings-section">
            <h3>{{ t('flow.defaultModels') }}</h3>
            <p class="fw-settings-note">
              {{ t('flow.defaultModelsNote') }}
            </p>

            <label class="fw-settings-field" for="fw-default-image-model">
              <span>{{ t('flow.imageModel') }}</span>
              <select id="fw-default-image-model" v-model="defaults.imageModel" class="fw-settings-select">
                <option v-for="m in IMAGE_MODELS" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
            </label>

            <label class="fw-settings-field" for="fw-default-video-model">
              <span>{{ t('flow.videoModel') }}</span>
              <select id="fw-default-video-model" v-model="defaults.videoModel" class="fw-settings-select">
                <option v-for="m in videoModelOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
            </label>
          </section>

          <section class="fw-settings-section fw-settings-section--danger">
            <h3>{{ t('flow.flowActions') }}</h3>
            <div class="fw-settings-actions">
              <button type="button" class="fw-settings-btn" @click="onClearResults">
                <Eraser :size="16" />
                {{ t('flow.clearResults') }}
              </button>
              <button type="button" class="fw-settings-btn fw-settings-btn--danger" @click="onClearFlow">
                <Trash2 :size="16" />
                {{ t('flow.clearFlow') }}
              </button>
            </div>
          </section>
        </div>

        <footer class="fw-settings-footer">
          <button type="button" class="fw-settings-btn fw-settings-btn--primary" @click="close">{{ t('common.close') }}</button>
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
  padding: 1rem 1.1rem;
  border-bottom: 1px solid #27272a;
}

.fw-settings-title-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.fw-settings-title-wrap h2 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: #fafafa;
}

.fw-settings-title-icon {
  color: #eab308;
}

.fw-settings-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  color: #a1a1aa;
  cursor: pointer;
}

.fw-settings-close:hover {
  background: #27272a;
  color: #fafafa;
}

.fw-settings-body {
  padding: 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 70vh;
  overflow-y: auto;
}

.fw-settings-section h3 {
  margin: 0 0 0.35rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: #e4e4e7;
}

.fw-settings-note {
  margin: 0 0 0.65rem;
  font-size: 0.72rem;
  line-height: 1.45;
  color: #71717a;
}

.fw-settings-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.65rem;
}

.fw-settings-field span {
  font-size: 0.75rem;
  color: #a1a1aa;
}

.fw-settings-select {
  width: 100%;
  border: 1px solid #3f3f46;
  border-radius: 0.5rem;
  padding: 0.45rem 0.55rem;
  background: #18181b;
  color: #f4f4f5;
  font-size: 0.8rem;
}

.fw-settings-section--danger {
  border-top: 1px solid #27272a;
  padding-top: 0.85rem;
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
  border: 1px solid #3f3f46;
  border-radius: 0.55rem;
  padding: 0.5rem 0.65rem;
  background: #18181b;
  color: #e4e4e7;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}

.fw-settings-btn--danger {
  border-color: rgba(248, 113, 113, 0.45);
  color: #fecaca;
}

.fw-settings-btn--primary {
  border-color: rgba(234, 179, 8, 0.45);
  background: rgba(234, 179, 8, 0.12);
  color: #fafafa;
}

.fw-settings-footer {
  padding: 0.85rem 1.1rem 1rem;
  border-top: 1px solid #27272a;
}
</style>
