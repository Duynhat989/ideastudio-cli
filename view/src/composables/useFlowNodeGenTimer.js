import { ref, watch, onUnmounted, computed } from 'vue';

/** @param {number} totalSeconds */
export function formatGenElapsed(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/**
 * Counts elapsed wall time while status is "running".
 * @param {import('vue').Ref<string> | import('vue').ComputedRef<string>} statusRef
 */
export function useFlowNodeGenTimer(statusRef) {
  const elapsedSec = ref(0);
  let intervalId = null;
  let startedAt = 0;

  const clear = () => {
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  watch(
    statusRef,
    (st) => {
      clear();
      if (st === 'running') {
        startedAt = Date.now();
        elapsedSec.value = 0;
        intervalId = window.setInterval(() => {
          elapsedSec.value = Math.floor((Date.now() - startedAt) / 1000);
        }, 250);
      }
    },
    { immediate: true }
  );

  onUnmounted(clear);

  const elapsedLabel = computed(() => formatGenElapsed(elapsedSec.value));

  return { elapsedSec, elapsedLabel };
}
