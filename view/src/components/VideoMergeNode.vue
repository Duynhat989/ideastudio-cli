<script setup>
import { ref, inject, computed } from 'vue';
import { useFlowNodeGenTimer } from '../composables/useFlowNodeGenTimer.js';
import { Handle, Position } from '@vue-flow/core';
import { Video, Trash2, Loader2, AlertCircle, CheckCircle2, PlayCircle, Layers, XCircle, Copy, Download } from 'lucide-vue-next';

const props = defineProps({
  id: String,
  data: Object,
});

const emit = defineEmits(['delete']);

const openImage = inject('openImage');
const showDetails = ref(false);

const nodeStatus = computed(() => props.data?.status ?? 'idle');
const { elapsedLabel } = useFlowNodeGenTimer(nodeStatus);

const onRun = () => {
  props.data.onRun?.();
};

const onDuplicate = () => {
  props.data.onDuplicate?.();
};

const onClear = () => {
  props.data.onChange?.({ result: null, status: 'idle', error: null });
};

const onDelete = () => {
  emit('delete', props.id);
};

const onDownload = async () => {
  if (!props.data.result) return;
  try {
    const response = await fetch(props.data.result);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `merged-video-${props.id}-${Date.now()}.mp4`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (err) {
    console.error('Download failed:', err);
  }
};
</script>

<template>
  <div class="video-merge-node" :class="{ 'is-running': data.status === 'running' }">
    <Handle type="target" :position="Position.Left" class="handle" />
    
    <div class="header">
      <div class="title">
        <Layers :size="14" class="icon" />
        <span>Video Merge</span>
      </div>
      <div class="header-actions">
        <button @click="onDuplicate" class="action-btn copy-btn" title="Duplicate Node">
          <Copy :size="14" />
        </button>
        <button @click="onDelete" class="action-btn delete-btn" title="Delete Node">
          <Trash2 :size="14" />
        </button>
      </div>
    </div>
    
    <div class="content">
      <div v-if="data.inputs?.length" class="inputs-preview">
        <div class="flex items-center justify-between">
          <label class="label">Input Videos ({{ data.inputs.length }})</label>
          <button @click="showDetails = !showDetails" class="toggle-details-btn" :class="{ active: showDetails }">
            {{ showDetails ? 'Hide Details' : 'Show Details' }}
          </button>
        </div>
        <div class="preview-list custom-scrollbar">
          <div v-for="(vid, idx) in data.inputs" :key="idx" class="preview-item" @click="vid && openImage(vid)">
            <video v-if="vid" :src="vid" class="preview-video"></video>
            <div v-else class="preview-placeholder">
              <Loader2 :size="12" class="node-gen-spin" />
            </div>
            <div class="index-badge">{{ idx + 1 }}</div>
          </div>
        </div>
        <p class="hint">Videos will be merged in the order they were connected.</p>
      </div>
      <div v-else class="no-inputs">
        <div class="flex items-center justify-between w-full mb-2">
          <div class="flex items-center gap-2">
            <AlertCircle :size="14" class="text-zinc-600" />
            <span class="label">No Inputs</span>
          </div>
          <button @click="showDetails = !showDetails" class="toggle-details-btn" :class="{ active: showDetails }">
            {{ showDetails ? 'Hide Details' : 'Show Details' }}
          </button>
        </div>
        <p>Connect video outputs to this node</p>
      </div>

      <div v-if="showDetails" class="status-bar">
        <div v-if="data.status === 'running'" class="status running">
          <Loader2 :size="12" class="node-gen-spin" />
          <span>Merging… {{ elapsedLabel }}</span>
        </div>
        <div v-else-if="data.status === 'completed'" class="status completed">
          <CheckCircle2 :size="12" />
          <span>Ready</span>
        </div>
        <div v-else-if="data.status === 'error'" class="status error">
          <AlertCircle :size="12" />
          <span>Error</span>
        </div>
        <div v-else class="status idle">
          <span>Idle</span>
        </div>
        
        <div class="inputs-count">
          {{ data.inputs?.length || 0 }} Videos
        </div>
      </div>

      <div v-if="data.result" class="result-container" @click="openImage(data.result)">
        <video :src="data.result" controls class="result-video"></video>
        <div class="result-actions-overlay">
          <button 
            @click.stop="onDownload"
            class="action-btn-overlay download-btn-overlay"
            title="Download Video"
          >
            <Download :size="14" />
          </button>
          <button 
            @click.stop="onClear"
            class="action-btn-overlay clear-btn-overlay"
            title="Clear Result"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </div>

      <div v-if="data.status === 'running' && !showDetails" class="gen-timer-banner">
        <Loader2 :size="12" class="node-gen-spin" />
        <span>Merging</span>
        <span class="gen-timer-label">{{ elapsedLabel }}</span>
      </div>

      <button 
        @click="data.status === 'running' ? data.onCancel?.() : onRun()" 
        class="action-main-btn"
        :class="{ 'is-running-btn': data.status === 'running' }"
        :disabled="data.status !== 'running' && !data.inputs?.length"
      >
        <template v-if="data.status === 'running'">
          <XCircle :size="16" />
          <span>CANCEL MERGE ({{ elapsedLabel }})</span>
        </template>
        <template v-else>
          <PlayCircle :size="16" />
          <span>MERGE VIDEOS</span>
        </template>
      </button>
      
      <p v-if="data.error" class="error-text">{{ data.error }}</p>
    </div>
    
    <Handle type="source" :position="Position.Right" class="handle" />
  </div>
</template>

<style scoped>
.video-merge-node {
  background: linear-gradient(180deg, #15171d 0%, #121319 100%);
  border: 1px solid #2a2d36;
  border-radius: 14px;
  padding: 0.85rem;
  width: 17rem;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.video-merge-node.is-running {
  border-color: transparent;
  background-color: transparent;
}

.video-merge-node.is-running::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: conic-gradient(
    transparent,
    var(--color-accent-strong), 
    #ffbb10, 
    #f59e0b, 
    #ef4444, 
    #8b5cf6, 
    transparent 30%
  );
  animation: rotate-border 3s linear infinite;
  z-index: -2;
  filter: blur(5px);
}

.video-merge-node.is-running::after {
  content: '';
  position: absolute;
  inset: 2px;
  background: var(--card-bg);
  border-radius: 1.15rem;
  z-index: -1;
}

@keyframes rotate-border {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.video-merge-node:hover {
  border-color: #facc15;
  transform: translateY(-2px);
  box-shadow: 0 20px 25px -5px rgba(255, 202, 42, 0.2), 0 10px 10px -5px rgba(14, 165, 233, 0.1);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #c9ced8;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.icon {
  color: #facc15;
  filter: drop-shadow(0 0 4px rgba(14, 165, 233, 0.5));
}

.header-actions {
  display: flex;
  gap: 0.25rem;
}

.action-btn {
  color: #71717a;
  background-color: #27272a;
  border: 1px solid #3f3f46;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0.375rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.copy-btn:hover {
  color: var(--accent-color);
  background-color: rgba(14, 165, 233, 0.1);
  border-color: rgba(255, 202, 42, 0.2);
}

.delete-btn:hover {
  color: #ef4444;
  background-color: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.2);
}

.content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.label {
  font-size: 0.65rem;
  font-weight: 700;
  color: #71717a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.toggle-details-btn {
  font-size: 0.625rem;
  font-weight: 700;
  color: var(--accent-color);
  background: transparent;
  border: none;
  cursor: pointer;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0;
  opacity: 0.6;
  transition: all 0.2s;
}

.toggle-details-btn:hover {
  opacity: 1;
  text-decoration: underline;
}

.toggle-details-btn.active {
  color: #71717a;
}

.inputs-preview {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preview-list {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  padding: 0.5rem 0.25rem;
}

.preview-item {
  width: 5rem;
  height: 3rem;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 2px solid #27272a;
  flex-shrink: 0;
  transition: all 0.2s;
  position: relative;
  background-color: #000;
  cursor: pointer;
}

.preview-item:hover {
  border-color: var(--accent-color);
  transform: scale(1.05);
}

.preview-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #18181b;
  color: #52525b;
}

.index-badge {
  position: absolute;
  top: 0.25rem;
  left: 0.25rem;
  background-color: var(--accent-color);
  color: white;
  font-size: 0.625rem;
  font-weight: 900;
  width: 1rem;
  height: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.no-inputs {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
  background-color: #18181b;
  border: 1px dashed #27272a;
  border-radius: 1rem;
  text-align: center;
  color: #52525b;
  font-size: 0.875rem;
}

.hint {
  font-size: 0.625rem;
  color: #52525b;
  font-style: italic;
}

.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem;
  background-color: #18181b;
  border-radius: 0.75rem;
  border: 1px solid #27272a;
}

.status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
}

.running { color: var(--accent-color); }
.completed { color: var(--success-color); }
.error { color: var(--error-color); }
.idle { color: #52525b; }

.inputs-count {
  font-size: 0.625rem;
  color: #a1a1aa;
  font-weight: 700;
  background-color: #27272a;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  border: 1px solid #3f3f46;
}

.result-container {
  width: 100%;
  background-color: #000;
  border-radius: 1rem;
  overflow: hidden;
  border: 1px solid #27272a;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 10rem;
  position: relative;
}

.result-video {
  max-width: 100%;
  object-fit: contain;
}

.result-actions-overlay {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  gap: 0.375rem;
  opacity: 0;
  transform: translateY(-5px);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 10;
}

.result-container:hover .result-actions-overlay {
  opacity: 1;
  transform: translateY(0);
}

.action-btn-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background-color: rgba(24, 24, 27, 0.8);
  backdrop-filter: blur(4px);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-btn-overlay {
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.clear-btn-overlay:hover {
  background-color: #ef4444;
  color: white;
  border-color: #ef4444;
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.download-btn-overlay {
  color: var(--accent-color);
  border: 1px solid rgba(255, 202, 42, 0.2);
}

.download-btn-overlay:hover {
  background-color: var(--accent-color);
  color: white;
  border-color: var(--accent-color);
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.3);
}

.action-main-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #facc15 0%, #eab308 100%);
  color: #111318;
  font-weight: 700;
  padding: 0.625rem;
  border-radius: 0.625rem;
  border: none;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  box-shadow: 0 4px 12px rgba(255, 202, 42, 0.2);
  width: 100%;
}

.action-main-btn:hover:not(:disabled) {
  transform: scale(1.02);
  box-shadow: 0 8px 20px rgba(14, 165, 233, 0.5);
}

.action-main-btn:disabled {
  background: #27272a;
  color: #52525b;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.is-running-btn {
  background: rgba(239, 68, 68, 0.1) !important;
  color: #ef4444 !important;
  border: 1px solid rgba(239, 68, 68, 0.2) !important;
  box-shadow: none !important;
}

.is-running-btn:hover {
  background: #ef4444 !important;
  color: white !important;
  border-color: #ef4444 !important;
  box-shadow: 0 0 15px rgba(239, 68, 68, 0.4) !important;
}

.error-text {
  font-size: 0.75rem;
  color: #ef4444;
  margin-top: 0.5rem;
  background-color: rgba(239, 68, 68, 0.1);
  padding: 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(239, 68, 68, 0.2);
  font-weight: 500;
}

.handle {
  width: 1rem;
  height: 1rem;
  background-color: var(--accent-color);
  border: 3px solid #18181b;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

</style>
