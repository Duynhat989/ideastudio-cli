import { ref, onBeforeUnmount } from 'vue';

export const BATCH_COUNT_OPTIONS = [1, 2, 3, 4];

let taskIdSeq = 0;

export function nextGenTaskId() {
  taskIdSeq += 1;
  return `${Date.now()}-${taskIdSeq}`;
}

export function useGenBatchTasks({ onRevokeResult } = {}) {
  const batchCount = ref(1);
  const tasks = ref([]);

  const clearTaskTimer = (task) => {
    if (task?.timerInterval) {
      clearInterval(task.timerInterval);
      task.timerInterval = null;
    }
  };

  const startTaskTimer = (task) => {
    clearTaskTimer(task);
    task.elapsedTime = 0;
    task.timerInterval = setInterval(() => {
      task.elapsedTime += 1;
    }, 1000);
  };

  const removeTask = (taskId) => {
    const task = tasks.value.find((t) => t.id === taskId);
    if (!task) return;
    clearTaskTimer(task);
    onRevokeResult?.(task);
    tasks.value = tasks.value.filter((t) => t.id !== taskId);
  };

  const prependTaskSlots = (count, buildSlot) => {
    const slots = [];
    for (let i = 0; i < count; i += 1) {
      const task = {
        id: nextGenTaskId(),
        status: 'generating',
        result: null,
        error: null,
        elapsedTime: 0,
        timerInterval: null,
        ...buildSlot(i),
      };
      startTaskTimer(task);
      slots.push(task);
    }
    tasks.value = [...slots, ...tasks.value];
    return slots;
  };

  const finishTask = (task, patch) => {
    clearTaskTimer(task);
    Object.assign(task, patch);
  };

  onBeforeUnmount(() => {
    tasks.value.forEach((task) => {
      clearTaskTimer(task);
      onRevokeResult?.(task);
    });
  });

  return {
    batchCount,
    tasks,
    prependTaskSlots,
    finishTask,
    clearTaskTimer,
    startTaskTimer,
    removeTask,
  };
}
