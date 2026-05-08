<script setup>
import {
  CheckCircle2,
  Download,
  FileArchive,
  Link,
  ListChecks,
  PlayCircle
} from 'lucide-vue-next'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['action'])
</script>

<template>
  <article class="workspace-step">
    <header class="step-head">
      <div class="head-left">
        <span class="dot" />
        <h3>Phase 05 - Review & Publish</h3>
      </div>
      <button type="button" class="solid-btn" @click="emit('action', 'export-video')">
        <Download :size="14" /> Export final
      </button>
    </header>

    <section class="workspace-grid">
      <aside class="column card">
        <div class="title-row">
          <ListChecks :size="16" />
          <strong>QA Checklist</strong>
        </div>

        <div class="checklist">
          <div class="check-item">
            <span>Du shot chua</span>
            <strong :class="state.checklist.shotReady ? 'ok' : 'bad'">{{ state.checklist.shotReady ? 'Pass' : 'Fail' }}</strong>
          </div>
          <div class="check-item">
            <span>Shot loi render</span>
            <strong :class="!state.checklist.hasRenderError ? 'ok' : 'bad'">{{ state.checklist.hasRenderError ? 'Fail' : 'Pass' }}</strong>
          </div>
          <div class="check-item">
            <span>Continuity</span>
            <strong :class="state.checklist.continuity ? 'ok' : 'bad'">{{ state.checklist.continuity ? 'Pass' : 'Fail' }}</strong>
          </div>
          <div class="check-item">
            <span>Audio/subtitle</span>
            <strong :class="state.checklist.audioSubtitle ? 'ok' : 'bad'">{{ state.checklist.audioSubtitle ? 'Pass' : 'Fail' }}</strong>
          </div>
        </div>
      </aside>

      <main class="column card">
        <div class="title-row">
          <PlayCircle :size="16" />
          <strong>Timeline Review</strong>
        </div>

        <div class="preview" />

        <div class="timeline-box">
          <label>Timeline scrubber</label>
          <input type="range" min="0" max="100" v-model="state.timeline" />
          <small>Vi tri hien tai: {{ state.timeline }}%</small>
        </div>

        <div class="quality-note">
          <CheckCircle2 :size="14" />
          Kiem tra ky 3 diem: frame noi tiep, subtitle timing, chuyen canh audio.
        </div>
      </main>

      <aside class="column card">
        <div class="title-row">
          <FileArchive :size="16" />
          <strong>Publish Options</strong>
        </div>

        <div class="field-grid">
          <div>
            <label>Do phan giai</label>
            <select v-model="state.resolution">
              <option>1080p</option>
              <option>2K</option>
              <option>4K</option>
            </select>
          </div>
          <div>
            <label>Bitrate</label>
            <select v-model="state.bitrate">
              <option>8 Mbps</option>
              <option>12 Mbps</option>
              <option>20 Mbps</option>
            </select>
          </div>
        </div>

        <div class="stack-actions">
          <button type="button" class="solid-btn" @click="emit('action', 'export-video')">
            <Download :size="14" /> Xuat video
          </button>
          <button type="button" class="ghost-btn" @click="emit('action', 'export-project')">
            <FileArchive :size="14" /> Xuat project
          </button>
          <button type="button" class="ghost-btn" @click="emit('action', 'share-review')">
            <Link :size="14" /> Tao link review
          </button>
        </div>
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
.title-row,
.ghost-btn,
.solid-btn,
.quality-note {
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
label,
small,
span {
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

.checklist {
  display: grid;
  gap: 8px;
}

.check-item {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg);
  padding: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ok {
  color: var(--color-accent);
}

.bad {
  color: var(--color-danger);
}

.preview {
  height: 220px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: linear-gradient(140deg, var(--color-accent-soft), var(--color-bg));
}

.timeline-box,
.quality-note {
  border: 1px dashed var(--color-border);
  border-radius: 10px;
  padding: 8px;
  display: grid;
  gap: 6px;
  color: var(--color-text-muted);
  background: var(--color-bg);
}

.field-grid,
.stack-actions {
  display: grid;
  gap: 8px;
}

input[type='range'],
select {
  width: 100%;
}

select {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 8px;
  color: var(--color-text);
  background: var(--color-bg);
}

label,
small,
span {
  color: var(--color-text-muted);
}

@media (max-width: 1180px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }
}
</style>
