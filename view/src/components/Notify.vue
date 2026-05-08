<script setup>
import { Info, AlertTriangle, CircleCheck, OctagonAlert } from 'lucide-vue-next';
import { computed } from 'vue';
import { notify } from '@/composables/useNotify.js';

const { state } = notify;

const icon = computed(() => {
  switch (state.variant) {
    case 'success':
      return CircleCheck;
    case 'error':
      return OctagonAlert;
    case 'warning':
      return AlertTriangle;
    default:
      return Info;
  }
});

const onConfirm = () => notify.submit(true);
const onCancel = () => notify.submit(false);
const onBackdrop = () => notify.dismiss();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="state.open"
      class="notify-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notify-title"
      @click.self="onBackdrop"
    >
      <div class="notify-card" :class="`notify-variant--${state.variant}`" @click.stop>
        <div class="notify-icon-wrap">
          <component :is="icon" :size="26" class="notify-icon" />
        </div>
        <h2 id="notify-title" class="notify-title">{{ state.title }}</h2>
        <p class="notify-message">{{ state.message }}</p>
        <div class="notify-actions">
          <button
            v-if="state.showCancel"
            type="button"
            class="notify-btn notify-btn-muted"
            @click="onCancel"
          >
            {{ state.cancelText }}
          </button>
          <button type="button" class="notify-btn notify-btn-primary" @click="onConfirm">
            {{ state.confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.notify-overlay {
  position: fixed;
  inset: 0;
  z-index: 7000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(6px);
}

.notify-card {
  width: 100%;
  max-width: 420px;
  background: linear-gradient(180deg, #18181b 0%, #121214 100%);
  border: 1px solid #2a2d36;
  border-radius: 16px;
  padding: 1.25rem 1.35rem 1.15rem;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.55);
}

.notify-icon-wrap {
  width: 3rem;
  height: 3rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.75rem;
  background: rgba(234, 179, 8, 0.12);
  border: 1px solid rgba(234, 179, 8, 0.25);
}

.notify-variant--success .notify-icon-wrap {
  background: rgba(16, 185, 129, 0.12);
  border-color: rgba(16, 185, 129, 0.3);
}

.notify-variant--error .notify-icon-wrap {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.28);
}

.notify-variant--warning .notify-icon-wrap {
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.28);
}

.notify-icon {
  color: #eab308;
}

.notify-variant--success .notify-icon {
  color: #34d399;
}

.notify-variant--error .notify-icon {
  color: #f87171;
}

.notify-variant--warning .notify-icon {
  color: #fbbf24;
}

.notify-title {
  margin: 0 0 0.55rem;
  font-size: 1.05rem;
  font-weight: 800;
  color: #fafafa;
  letter-spacing: -0.02em;
  line-height: 1.25;
}

.notify-message {
  margin: 0 0 1.1rem;
  font-size: 0.875rem;
  line-height: 1.55;
  color: #a1a1aa;
  white-space: pre-wrap;
}

.notify-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  flex-wrap: wrap;
}

.notify-btn {
  border-radius: 10px;
  padding: 0.55rem 1rem;
  font-size: 0.8125rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.notify-btn-muted {
  background: #27272a;
  color: #e4e4e7;
  border-color: #3f3f46;
}

.notify-btn-muted:hover {
  background: #3f3f46;
}

.notify-btn-primary {
  background: #eab308;
  color: #111113;
  border-color: #ca8a04;
}

.notify-btn-primary:hover {
  background: #facc15;
}
</style>
