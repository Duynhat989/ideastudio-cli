<script setup>
import { ref, useSlots, computed, watch, onUnmounted } from 'vue';
import { useEventListener } from '@vueuse/core';
import { Settings2, X, Trash2 } from 'lucide-vue-next';

/** Nhiều node có thể tồn tại; chỉ bỏ overflow:hidden khi không còn popup nào mở */
let flowConfigPopupOpenCount = 0;

const slots = useSlots();
const hasRunSlot = computed(() => typeof slots.run === 'function');

const props = defineProps({
  label: { type: String, required: true },
  /** CSS length, e.g. 17.5rem */
  width: { type: String, default: '17.5rem' },
  /** CSS aspect-ratio value e.g. "16 / 9" */
  aspectRatio: { type: String, default: '16 / 9' },
  showConfig: { type: Boolean, default: true },
  /** When false, viewport grows with content (no fixed aspect) */
  fixedAspect: { type: Boolean, default: true },
  /** Đang gen / chạy — viền sắc nét (không blur) để không lỗi layout khi loading */
  isRunning: { type: Boolean, default: false },
  /** Nút xóa node trên chrome (trái nút cài đặt) */
  showDeleteButton: { type: Boolean, default: false },
  /**
   * Ảnh/video theo tỷ lệ tự nhiên: width 100%, height auto (dùng với fixedAspect=false).
   */
  intrinsicMedia: { type: Boolean, default: false },
});

/** Elapsed ms while running — rAF for smooth milliseconds */
const runningElapsedMs = ref(0);
let runningRafId = null;
let runningStartedAt = 0;

const stopRunningTimer = () => {
  if (runningRafId != null) {
    cancelAnimationFrame(runningRafId);
    runningRafId = null;
  }
};

/** Hiển thị dạng giây.xx — 2 chữ số phần thập phân (centisecond, 00–99) */
const runningTimeParts = computed(() => {
  const ms = Math.floor(runningElapsedMs.value);
  const totalSec = Math.floor(ms / 1000);
  const centi = Math.floor((ms % 1000) / 10);
  const frac = String(centi).padStart(2, '0');
  if (totalSec >= 60) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return { whole: `${m}:${String(s).padStart(2, '0')}`, frac };
  }
  return { whole: String(totalSec), frac };
});

function runningTick() {
  runningElapsedMs.value = performance.now() - runningStartedAt;
  runningRafId = requestAnimationFrame(runningTick);
}

watch(
  () => props.isRunning,
  (running) => {
    stopRunningTimer();
    runningElapsedMs.value = 0;
    if (running) {
      runningStartedAt = performance.now();
      runningRafId = requestAnimationFrame(runningTick);
    }
  },
  { immediate: true },
);

const emit = defineEmits(['delete']);

const configOpen = ref(false);

const toggleConfig = () => {
  configOpen.value = !configOpen.value;
};

const closeConfig = () => {
  configOpen.value = false;
};

useEventListener(window, 'keydown', (e) => {
  if (e.key === 'Escape' && configOpen.value) {
    e.preventDefault();
    closeConfig();
  }
});

const syncBodyScrollLock = () => {
  document.body.style.overflow = flowConfigPopupOpenCount > 0 ? 'hidden' : '';
};

watch(configOpen, (open) => {
  if (open) {
    flowConfigPopupOpenCount += 1;
  } else if (flowConfigPopupOpenCount > 0) {
    flowConfigPopupOpenCount -= 1;
  }
  syncBodyScrollLock();
});

onUnmounted(() => {
  stopRunningTimer();
  if (configOpen.value && flowConfigPopupOpenCount > 0) {
    flowConfigPopupOpenCount -= 1;
    syncBodyScrollLock();
  }
});

defineExpose({ openConfig: () => { configOpen.value = true; }, closeConfig });
</script>

<template>
  <div class="flow-node-shell" :class="{ 'flow-node-shell--has-run': hasRunSlot }" :style="{ width }">
    <div
      class="flow-node-frame"
      :class="{
        'is-config-open': configOpen,
        'flow-node-frame--auto': !fixedAspect,
        'flow-node-frame--running': props.isRunning,
      }"
    >
      <div
        class="flow-node-viewport"
        :class="{ 'flow-node-viewport--intrinsic': intrinsicMedia }"
        :style="fixedAspect ? { aspectRatio } : undefined"
      >
        <div class="flow-node-chrome">
          <div class="flow-node-label">
            <span class="flow-node-label-inner">
              <slot name="icon" />
              <span class="flow-node-label-text">{{ label }}</span>
            </span>
          </div>
          <div class="flow-node-chrome-actions">
            <button
              v-if="showDeleteButton"
              type="button"
              class="flow-node-icon-btn flow-node-delete-btn"
              title="Xóa node"
              @click.stop="emit('delete')"
            >
              <Trash2 :size="15" stroke-width="2" />
            </button>
            <button
              v-if="showConfig"
              type="button"
              class="flow-node-icon-btn flow-node-config-toggle"
              title="Cấu hình node"
              @click.stop="toggleConfig"
            >
              <Settings2 :size="15" stroke-width="2" />
            </button>
            <slot name="chrome-actions" />
          </div>
        </div>

        <div
          class="flow-node-media"
          :class="{ 'flow-node-media--intrinsic': intrinsicMedia }"
        >
          <slot name="viewport" />
        </div>
        <div v-if="props.isRunning" class="flow-node-running-overlay" aria-live="polite">
          <div class="flow-node-running-panel">
            <div class="flow-node-running-bar" aria-hidden="true">
              <div class="flow-node-running-bar-fill" />
            </div>
            <p class="flow-node-running-line">
              Đang gen
              <span class="flow-node-running-line-sep" aria-hidden="true">·</span>
              <span class="flow-node-running-line-time">
                <span>{{ runningTimeParts.whole }}</span>
                <span class="flow-node-running-line-dot">.</span>
                <span>{{ runningTimeParts.frac }}</span>
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
    <div v-if="hasRunSlot" class="flow-node-run-anchor">
      <slot name="run" />
    </div>

    <Teleport to="body">
      <Transition name="flow-popup">
        <div
          v-if="configOpen && showConfig"
          class="flow-node-config-popup-backdrop"
          role="dialog"
          aria-modal="true"
          :aria-label="label"
          @click.self="closeConfig"
        >
          <div class="flow-node-config-popup" @click.stop>
            <div class="flow-node-config-head">
              <span class="flow-node-config-title">{{ label }}</span>
              <button
                type="button"
                class="flow-node-icon-btn flow-node-config-close"
                title="Đóng (Esc)"
                @click="closeConfig"
              >
                <X :size="16" stroke-width="2" />
              </button>
            </div>
            <div class="flow-node-config-body custom-scrollbar">
              <slot name="config" />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.flow-node-shell {
  position: relative;
  box-sizing: border-box;
}

.flow-node-shell--has-run {
  padding-bottom: 1.35rem;
}

.flow-node-run-anchor {
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translate(-50%, 50%);
  z-index: 8;
  pointer-events: auto;
}

.flow-node-frame {
  --fn-radius: 26px;
  --fn-pad: 3px;
  position: relative;
  border-radius: var(--fn-radius);
  padding: var(--fn-pad);
  background: #08080a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-sizing: border-box;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.flow-node-frame:not(.flow-node-frame--running):hover {
  border-color: rgba(255, 255, 255, 0.16);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
}

.flow-node-frame.is-config-open:not(.flow-node-frame--running) {
  border-color: rgba(255, 255, 255, 0.18);
}

/*
 * Đang chạy: viền gradient xoay (conic + background-clip), không blur — sắc nét + sinh động.
 * Góc --fn-border-angle đăng ký @property ở khối style global bên dưới.
 */
.flow-node-frame--running {
  --fn-border-angle: 0deg;
  transition: none;
  border: 2px solid transparent;
  background:
    linear-gradient(168deg, #0d0d12 0%, #08080a 45%, #0a0a10 100%) padding-box,
    conic-gradient(
      from var(--fn-border-angle),
      #fde68a,
      #fcd34d,
      #7dd3fc,
      #93c5fd,
      #c4b5fd,
      #e9d5ff,
      #fdba74,
      #fb7185,
      #fde68a
    )
      border-box;
  -webkit-background-clip: padding-box, border-box;
  background-clip: padding-box, border-box;
  animation:
    fn-border-angle-rotate 3.4s linear infinite,
    fn-running-pulse 2.2s ease-in-out infinite;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.06),
    0 10px 28px rgba(0, 0, 0, 0.42),
    0 0 20px rgba(250, 204, 21, 0.11),
    0 0 36px rgba(56, 189, 248, 0.09),
    0 0 52px rgba(167, 139, 250, 0.06);
}

@keyframes fn-running-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.05),
      0 10px 28px rgba(0, 0, 0, 0.4),
      0 0 18px rgba(250, 204, 21, 0.09),
      0 0 32px rgba(56, 189, 248, 0.07),
      0 0 48px rgba(167, 139, 250, 0.05);
  }
  50% {
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.08),
      0 12px 34px rgba(0, 0, 0, 0.46),
      0 0 28px rgba(250, 204, 21, 0.16),
      0 0 44px rgba(56, 189, 248, 0.12),
      0 0 64px rgba(167, 139, 250, 0.09);
  }
}

.flow-node-frame--auto .flow-node-viewport {
  min-height: 8.5rem;
  display: flex;
  flex-direction: column;
}

.flow-node-frame--auto .flow-node-viewport.flow-node-viewport--intrinsic {
  min-height: 0;
}

.flow-node-viewport {
  position: relative;
  border-radius: calc(var(--fn-radius) - var(--fn-pad));
  overflow: hidden;
  background: #050506;
  width: 100%;
  box-sizing: border-box;
}

.flow-node-running-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  overflow: hidden;
  padding: 0.75rem;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.62);
}

.flow-node-running-panel {
  width: 100%;
  max-width: 13.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.flow-node-running-bar {
  position: relative;
  height: 3px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}

.flow-node-running-bar-fill {
  position: absolute;
  top: 0;
  left: -38%;
  height: 100%;
  width: 38%;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  animation: flow-node-running-bar-slide 1.15s ease-in-out infinite;
}

.flow-node-running-line {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 500;
  line-height: 1.35;
  color: rgba(250, 250, 250, 0.88);
  letter-spacing: 0.01em;
  -webkit-font-smoothing: antialiased;
  text-align: center;
}

.flow-node-running-line-sep {
  margin: 0 0.35em;
  color: rgba(255, 255, 255, 0.35);
  font-weight: 400;
}

.flow-node-running-line-time {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
  color: rgba(255, 255, 255, 0.55);
  font-weight: 500;
}

.flow-node-running-line-dot {
  opacity: 0.55;
}

@keyframes flow-node-running-bar-slide {
  0% {
    left: -38%;
  }
  100% {
    left: 100%;
  }
}

.flow-node-chrome {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 4;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0.6rem;
  pointer-events: none;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.72) 0%,
    rgba(0, 0, 0, 0.35) 55%,
    transparent 100%
  );
}

.flow-node-label {
  pointer-events: none;
  min-width: 0;
}

.flow-node-label-inner {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  /* Không dùng backdrop-filter: khi canvas Vue Flow scale sẽ bị mờ nặng */
  background: rgba(18, 18, 22, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.flow-node-label-inner :deep(svg) {
  flex-shrink: 0;
  color: rgba(250, 250, 250, 0.92);
  opacity: 0.95;
}

.flow-node-label-text {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: rgba(250, 250, 250, 0.95);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 11rem;
}

.flow-node-chrome-actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  pointer-events: auto;
}

.flow-node-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(28, 28, 34, 0.96);
  color: rgba(250, 250, 250, 0.92);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.flow-node-icon-btn:hover {
  background: rgba(42, 42, 50, 0.98);
  border-color: rgba(255, 255, 255, 0.24);
}

.flow-node-delete-btn:hover {
  color: #fca5a5;
  border-color: rgba(248, 113, 113, 0.45);
  background: rgba(127, 29, 29, 0.35);
}

.flow-node-media {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
}

.flow-node-frame--auto .flow-node-media {
  position: relative;
  flex: 1;
  min-height: 7rem;
  box-sizing: border-box;
}

.flow-node-frame--auto .flow-node-media--intrinsic {
  flex: 0 0 auto;
  min-height: 0;
  align-self: stretch;
}

.flow-node-media--intrinsic {
  justify-content: flex-start;
}

.flow-node-media :deep(video),
.flow-node-media :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.flow-node-media--intrinsic :deep(video),
.flow-node-media--intrinsic :deep(img) {
  width: 100%;
  height: auto;
  max-height: none;
  object-fit: contain;
  flex: 0 0 auto;
}

.flow-node-config-popup-backdrop {
  position: fixed;
  inset: 0;
  z-index: 100020;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: max(0.75rem, env(safe-area-inset-top, 0px))
    max(0.75rem, env(safe-area-inset-right, 0px))
    max(0.75rem, env(safe-area-inset-bottom, 0px))
    max(0.75rem, env(safe-area-inset-left, 0px));
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.52);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.flow-node-config-popup {
  width: min(40rem, 100%);
  max-height: min(88vh, 52rem);
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: linear-gradient(180deg, #121218 0%, #0c0c10 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 18px;
  box-shadow:
    0 28px 72px rgba(0, 0, 0, 0.65),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset;
}

.flow-node-config-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem 0.65rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.flow-node-config-title {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: rgba(244, 244, 245, 0.95);
}

.flow-node-config-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1rem 1rem 1.1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.flow-popup-enter-active,
.flow-popup-leave-active {
  transition: opacity 0.2s ease;
}

.flow-popup-enter-active .flow-node-config-popup,
.flow-popup-leave-active .flow-node-config-popup {
  transition:
    transform 0.22s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.2s ease;
}

.flow-popup-enter-from,
.flow-popup-leave-to {
  opacity: 0;
}

.flow-popup-enter-from .flow-node-config-popup,
.flow-popup-leave-to .flow-node-config-popup {
  transform: scale(0.96) translateY(10px);
  opacity: 0.9;
}
</style>

<style>
/* Góc xoay viền conic — animate được trong @keyframes (Chrome / Safari / FF mới) */
@property --fn-border-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

@keyframes fn-border-angle-rotate {
  to {
    --fn-border-angle: 1turn;
  }
}

/* Shared form controls inside node config sheets (unscoped for slot content) */
.flow-node-config-body .fn-label {
  display: block;
  font-size: 0.62rem;
  font-weight: 700;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 0.3rem;
}

.flow-node-config-body .fn-input,
.flow-node-config-body .fn-textarea,
.flow-node-config-body .fn-select {
  width: 100%;
  box-sizing: border-box;
  background: #0e0e12;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 0.5rem 0.6rem;
  font-size: 0.8rem;
  color: #f4f4f5;
  outline: none;
  font-family: inherit;
}

.flow-node-config-body .fn-textarea {
  resize: vertical;
  min-height: 5.5rem;
}

.flow-node-config-body .fn-input:focus,
.flow-node-config-body .fn-textarea:focus,
.flow-node-config-body .fn-select:focus {
  border-color: rgba(250, 204, 21, 0.45);
}

.flow-node-config-body .fn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}

.flow-node-config-body .fn-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.55rem 0.75rem;
  border-radius: 10px;
  border: none;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.flow-node-config-body .fn-btn-primary {
  background: linear-gradient(135deg, #facc15 0%, #eab308 100%);
  color: #111;
  width: 100%;
  box-shadow: 0 4px 14px rgba(250, 204, 21, 0.25);
}

.flow-node-config-body .fn-btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
}

.flow-node-config-body .fn-btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.flow-node-config-body .fn-btn-primary.fn-cancel-running {
  background: rgba(239, 68, 68, 0.12) !important;
  color: #f87171 !important;
  border: 1px solid rgba(239, 68, 68, 0.32) !important;
  box-shadow: none !important;
}

.flow-node-config-body .fn-btn-primary.fn-cancel-running:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2) !important;
}

.flow-node-config-body .fn-btn-danger {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.25);
  width: 100%;
}

.flow-node-config-body .fn-btn-danger:hover {
  background: rgba(239, 68, 68, 0.2);
}

.flow-node-config-body .fn-btn-ghost {
  background: rgba(255, 255, 255, 0.06);
  color: #a1a1aa;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.flow-node-config-body .fn-error {
  font-size: 0.72rem;
  color: #f87171;
  background: rgba(239, 68, 68, 0.1);
  padding: 0.5rem 0.6rem;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.2);
  cursor: copy;
  text-align: left;
  width: 100%;
}

.flow-node-config-body .fn-muted {
  font-size: 0.65rem;
  color: #71717a;
  line-height: 1.45;
}

.flow-node-config-body .fn-chip {
  font-size: 0.58rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.2rem 0.45rem;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.15);
  border: 1px solid rgba(99, 102, 241, 0.35);
  color: #a5b4fc;
}

.flow-node-config-body .fn-preview-scroll {
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.flow-node-config-body .fn-thumb {
  width: 3rem;
  height: 3rem;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.12);
  cursor: pointer;
  background: #111;
}

.flow-node-config-body .fn-thumb img,
.flow-node-config-body .fn-thumb video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Nút chạy / hủy nổi ngoài khung node (slot #run) */
.flow-node-run-fab {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  color: #111;
}

.flow-node-run-fab--primary {
  background: linear-gradient(145deg, #facc15 0%, #eab308 100%);
}

.flow-node-run-fab--primary:hover:not(:disabled) {
  box-shadow: 0 10px 32px rgba(250, 204, 21, 0.35);
}

.flow-node-run-fab--kling {
  background: linear-gradient(145deg, var(--color-accent-strong, #0ea5e9) 0%, #eab308 100%);
  color: #111;
}

.flow-node-run-fab--kling:hover:not(:disabled) {
  box-shadow: 0 10px 32px rgba(14, 165, 233, 0.28);
}

.flow-node-run-fab--cancel {
  background: rgba(24, 24, 27, 0.95);
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.45);
}

.flow-node-run-fab--cancel:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
}

.flow-node-run-fab:disabled {
  opacity: 0.42;
  cursor: not-allowed;
  transform: none;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}
</style>
