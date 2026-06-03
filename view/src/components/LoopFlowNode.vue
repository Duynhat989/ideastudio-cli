<script setup>
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { Handle, Position } from '@vue-flow/core';
import { Repeat, FolderOpen, PlayCircle, XCircle, Loader2 } from 'lucide-vue-next';
import FlowNodeShell from '@/components/FlowNodeShell.vue';

const props = defineProps({
  id: String,
  data: Object,
});

const emit = defineEmits(['delete']);
const { t } = useI18n();

const imageInputOptions = inject('loopFlowImageInputOptions', computed(() => []));
const videoInputOptions = inject('loopFlowVideoInputOptions', computed(() => []));

const hasBridge = typeof window !== 'undefined' && typeof window.electronAPI?.invoke === 'function';

const onRun = () => props.data.onRun?.();
const onCancel = () => props.data.onCancel?.();

const pickFolder = async () => {
  if (!hasBridge) return;
  const res = await window.electronAPI.invoke('dialog:open-directory');
  if (res?.success && res.path) {
    props.data.onChange?.({ folderPath: res.path });
  }
};

const busy = computed(() => props.data?.status === 'running');
</script>

<template>
  <div class="loop-flow-root">
    <FlowNodeShell
      label="Loop Flow"
      width="19rem"
      aspect-ratio="16 / 9"
      :is-running="busy"
      :show-config="true"
      show-delete-button
      @delete="emit('delete', props.id)"
    >
      <template #icon>
        <Repeat :size="14" stroke-width="2" />
      </template>
      <template #viewport>
        <div class="media-fill idle-preview">
          <Repeat :size="36" class="idle-ic" />
          <span v-if="busy" class="idle-msg">
            <Loader2 :size="18" class="node-gen-spin" />
            {{ data.loopProgress || 'Đang lặp…' }}
          </span>
          <span v-else class="idle-msg">
            {{ data.folderPath ? t('flow.loopReady') : t('flow.loopConfigure') }}
          </span>
          <p v-if="data.folderPath" class="path-ellipsis" :title="data.folderPath">{{ data.folderPath }}</p>
        </div>
      </template>
      <template #config>
        <p class="fn-muted" v-html="t('flow.loopFlowIntro')"></p>
        <div>
          <label class="fn-label">{{ t('flow.folderPath') }}</label>
          <input
            class="fn-input"
            :value="data.folderPath || ''"
            :placeholder="t('flow.loopFolderPlaceholder')"
            @input="data.onChange?.({ folderPath: $event.target.value })"
          />
        </div>
        <div class="fn-row" style="gap: 0.35rem; flex-wrap: wrap">
          <button type="button" class="fn-btn fn-btn-ghost" :disabled="!hasBridge" @click="pickFolder">
            <FolderOpen :size="16" />
            {{ t('flow.loopPickFolder') }}
          </button>
        </div>
        <div>
          <label class="fn-label">{{ t('flow.classification') }}</label>
          <select
            class="fn-select"
            :value="data.classifyMode || 'byExtension'"
            @change="data.onChange?.({ classifyMode: $event.target.value })"
          >
            <option value="byExtension">{{ t('flow.byExtension') }}</option>
            <option value="bySubfolder">{{ t('flow.bySubfolder') }}</option>
          </select>
        </div>
        <div v-if="(data.classifyMode || 'byExtension') === 'bySubfolder'" class="fn-row" style="gap: 0.5rem">
          <div style="flex: 1; min-width: 0">
            <label class="fn-label">{{ t('flow.imageFolderName') }}</label>
            <input
              class="fn-input"
              :value="data.imageSubfolder || 'images'"
              @input="data.onChange?.({ imageSubfolder: $event.target.value })"
            />
          </div>
          <div style="flex: 1; min-width: 0">
            <label class="fn-label">{{ t('flow.videoFolderName') }}</label>
            <input
              class="fn-input"
              :value="data.videoSubfolder || 'videos'"
              @input="data.onChange?.({ videoSubfolder: $event.target.value })"
            />
          </div>
        </div>
        <div>
          <label class="fn-label">{{ t('flow.targetImageNode') }}</label>
          <select
            class="fn-select"
            :value="data.targetImageInputId || ''"
            @change="data.onChange?.({ targetImageInputId: $event.target.value })"
          >
            <option value="">{{ t('flow.selectImageInput') }}</option>
            <option v-for="opt in imageInputOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
          </select>
        </div>
        <div>
          <label class="fn-label">{{ t('flow.targetVideoNode') }}</label>
          <select
            class="fn-select"
            :value="data.targetVideoInputId || ''"
            @change="data.onChange?.({ targetVideoInputId: $event.target.value })"
          >
            <option value="">{{ t('flow.selectVideoInput') }}</option>
            <option v-for="opt in videoInputOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
          </select>
        </div>
        <div>
          <label class="fn-label">{{ t('flow.nextRun') }}</label>
          <select
            class="fn-select"
            :value="data.advanceMode || 'untilIdle'"
            @change="data.onChange?.({ advanceMode: $event.target.value })"
          >
            <option value="untilIdle">{{ t('flow.afterFlowIdle') }}</option>
            <option value="timer">{{ t('flow.afterTimer') }}</option>
          </select>
        </div>
        <div v-if="(data.advanceMode || 'untilIdle') === 'timer'">
          <label class="fn-label">{{ t('flow.intervalSeconds') }}</label>
          <input
            class="fn-input"
            type="number"
            min="1"
            step="1"
            :value="data.intervalSec ?? 30"
            @input="data.onChange?.({ intervalSec: Math.max(1, Number($event.target.value) || 1) })"
          />
        </div>
        <p v-if="data.error" class="fn-error">{{ data.error }}</p>
      </template>
      <template #run>
        <button
          type="button"
          class="flow-node-run-fab"
          :class="busy ? 'flow-node-run-fab--cancel' : 'flow-node-run-fab--primary'"
          :title="busy ? t('flow.stopLoop') : t('flow.runFolderLoop')"
          @click.stop="busy ? onCancel() : onRun()"
        >
          <XCircle v-if="busy" :size="22" stroke-width="2" />
          <PlayCircle v-else :size="22" stroke-width="2" />
        </button>
      </template>
    </FlowNodeShell>
    <Handle type="target" :position="Position.Left" id="in" />
    <Handle type="source" :position="Position.Right" id="out" />
  </div>
</template>

<style scoped>
.loop-flow-root {
  position: relative;
}

.media-fill {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #050506;
}

.media-fill.idle-preview {
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 0.5rem 0.85rem;
  box-sizing: border-box;
}

.idle-ic {
  color: #52525b;
  flex-shrink: 0;
}

.idle-msg {
  font-size: 0.72rem;
  color: #a1a1aa;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  max-width: 16rem;
  line-height: 1.35;
}

.path-ellipsis {
  margin: 0.35rem 0 0;
  font-size: 0.58rem;
  color: #71717a;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
