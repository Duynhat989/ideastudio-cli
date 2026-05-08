<script setup>
import { computed } from 'vue'
import {
  Clock3,
  Film,
  Pause,
  Play,
  RefreshCcw,
  Workflow
} from 'lucide-vue-next'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['action'])

const overall = computed(() => {
  const total = props.state.shots.reduce((sum, item) => sum + item.progress, 0)
  return Math.round(total / props.state.shots.length)
})
</script>

<template>
  <article class="workspace-step">
    <header class="step-head">
      <div class="head-left">
        <span class="dot" />
        <h3>Phase 04 - Director Workspace</h3>
      </div>
      <div class="head-actions">
        <button type="button" class="solid-btn" @click="emit('action', 'generate-all')">
          <Play :size="14" /> Render all
        </button>
        <button type="button" class="ghost-btn" @click="emit('action', 'pause-queue')">
          <Pause :size="14" /> Pause
        </button>
      </div>
    </header>

    <section class="workspace-grid">
      <aside class="column card">
        <div class="title-row">
          <Film :size="16" />
          <strong>Shot Queue</strong>
        </div>

        <div class="shot-list">
          <article
            v-for="shot in state.shots"
            :key="shot.id"
            :class="['shot-card', { active: state.selectedShotId === shot.id }]"
            @click="state.selectedShotId = shot.id"
          >
            <div class="shot-top">
              <strong>{{ shot.label }}</strong>
              <span>{{ shot.progress }}%</span>
            </div>
            <small>{{ shot.status }}</small>
            <div class="track">
              <div class="fill" :style="{ width: `${shot.progress}%` }" />
            </div>
          </article>
        </div>

        <button type="button" class="ghost-btn" @click="emit('action', 'retry-failed')">
          <RefreshCcw :size="14" /> Retry failed shots
        </button>
      </aside>

      <main class="column card">
        <div class="title-row">
          <Workflow :size="16" />
          <strong>Render Studio</strong>
        </div>

        <div class="preview" />

        <div class="timeline-strip">
          <div class="timeline-track">
            <div class="timeline-fill" :style="{ width: `${overall}%` }" />
          </div>
          <small>Total progress: {{ overall }}%</small>
        </div>

        <div class="continuity-box">
          <p>Frame cuoi shot truoc: da nap</p>
          <p>Frame dau shot hien tai: cho generate</p>
          <button type="button" class="ghost-btn" @click="emit('action', 'use-last-frame')">Dong bo frame lien tiep</button>
        </div>
      </main>

      <aside class="column card">
        <div class="title-row">
          <Clock3 :size="16" />
          <strong>Runtime Control</strong>
        </div>

        <div class="field-grid">
          <div>
            <label>Model</label>
            <select v-model="state.model">
              <option>Veo 3</option>
            </select>
          </div>
          <div>
            <label>Duration / shot</label>
            <select v-model="state.durationPerShot">
              <option>3s</option>
              <option>5s</option>
              <option>8s</option>
            </select>
          </div>
          <div>
            <label>Motion strength</label>
            <select v-model="state.motionStrength">
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>
          <div>
            <label>Prompt intensity</label>
            <select v-model="state.promptIntensity">
              <option>Soft</option>
              <option>Balanced</option>
              <option>Strong</option>
            </select>
          </div>
        </div>

        <div class="runtime-card">
          <p>Queue size: {{ state.queueSize }}</p>
          <p>ETA: {{ state.eta }}</p>
          <p class="danger">Error: {{ state.errorMessage }}</p>
        </div>

        <button type="button" class="solid-btn" @click="emit('action', 'finish-render')">Hoan tat va sang Step 5</button>
      </aside>
    </section>
  </article>
</template>

<style scoped>
.workspace-step {
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: linear-gradient(180deg, var(--color-bg-soft), var(--color-bg-elevated));
  overflow: hidden;
}

.step-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
}

.head-left,
.head-actions,
.title-row,
.ghost-btn,
.solid-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}

h3,
strong,
p,
small,
label {
  margin: 0;
}

h3 {
  font-size: 14px;
}

.workspace-grid {
  display: grid;
  grid-template-columns: 0.9fr 1.2fr 0.9fr;
  gap: 10px;
  padding: 10px;
}

.column {
  min-width: 0;
}

.card {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-elevated);
  padding: 10px;
  display: grid;
  gap: 10px;
}

.ghost-btn,
.solid-btn {
  border: 1px solid var(--color-border);
  border-radius: 9px;
  padding: 7px 10px;
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
}

.solid-btn {
  border-color: var(--color-accent-strong);
  background: var(--color-accent);
  color: var(--color-text-on-accent);
}

.shot-list {
  display: grid;
  gap: 8px;
}

.shot-card {
  border: 1px dashed var(--color-border);
  border-radius: 10px;
  padding: 8px;
  display: grid;
  gap: 6px;
  background: var(--color-bg);
  cursor: pointer;
}

.shot-card.active {
  border-color: var(--color-accent-strong);
  background: var(--color-accent-soft);
}

.shot-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

small,
label {
  color: var(--color-text-muted);
}

.track,
.timeline-track {
  width: 100%;
  height: 7px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  overflow: hidden;
  background: var(--color-bg-elevated);
}

.fill,
.timeline-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-accent-strong), var(--color-accent));
}

.preview {
  height: 220px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: linear-gradient(140deg, var(--color-accent-soft), var(--color-bg));
}

.timeline-strip {
  display: grid;
  gap: 6px;
}

.continuity-box,
.runtime-card {
  border: 1px dashed var(--color-border);
  border-radius: 10px;
  padding: 8px;
  display: grid;
  gap: 6px;
  color: var(--color-text-muted);
  background: var(--color-bg);
}

.field-grid {
  display: grid;
  gap: 8px;
}

select {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 8px;
  color: var(--color-text);
  background: var(--color-bg);
}

.danger {
  color: var(--color-danger);
}

@media (max-width: 1180px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }
}
</style>
