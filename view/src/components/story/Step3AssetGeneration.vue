<script setup>
import { computed } from 'vue'
import {
  ImagePlus,
  Layers,
  Package,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UserRound
} from 'lucide-vue-next'

const props = defineProps({
  state: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['action'])

const tabs = [
  { label: 'Nhan vat', value: 'characters' },
  { label: 'Boi canh', value: 'scenes' },
  { label: 'Shot frames', value: 'frames' }
]

const continuityBadge = {
  strong: 'Strong',
  medium: 'Medium',
  weak: 'Weak'
}

const selectedTabTitle = computed(() => {
  if (props.state.assetTab === 'characters') return 'Character Library'
  if (props.state.assetTab === 'scenes') return 'Scene Library'
  return 'Frame Bank'
})

const previewItems = computed(() => {
  if (props.state.assetTab === 'scenes') {
    return ['Bus interior', 'School yard', 'Locker corridor', 'Basketball court']
  }
  if (props.state.assetTab === 'frames') {
    return ['Shot 01 first frame', 'Shot 01 last frame', 'Shot 02 first frame', 'Shot 02 last frame']
  }
  return ['Main host portrait', 'Side character card', 'Emotion sheet', 'Wardrobe variants']
})
</script>

<template>
  <article class="workspace-step">
    <header class="step-head">
      <div class="head-left">
        <span class="dot" />
        <h3>Phase 03 - Asset Studio</h3>
      </div>
      <button type="button" class="solid-btn" @click="emit('action', 'generate-missing')">
        <Sparkles :size="14" /> Tao anh con thieu
      </button>
    </header>

    <section class="workspace-grid">
      <aside class="column card">
        <div class="title-row">
          <Layers :size="16" />
          <strong>Generation Console</strong>
        </div>

        <div class="tab-row">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            :class="['chip-btn', { active: state.assetTab === tab.value }]"
            @click="state.assetTab = tab.value"
          >
            {{ tab.label }}
          </button>
        </div>

        <div class="field-box">
          <label>Face lock mode</label>
          <div class="lock-row">
            <button type="button" :class="['chip-btn', { active: state.faceLock === 'strong' }]" @click="state.faceLock = 'strong'">Strong</button>
            <button type="button" :class="['chip-btn', { active: state.faceLock === 'medium' }]" @click="state.faceLock = 'medium'">Medium</button>
            <button type="button" :class="['chip-btn', { active: state.faceLock === 'weak' }]" @click="state.faceLock = 'weak'">Weak</button>
          </div>
        </div>

        <div class="field-box">
          <label>Prompt template</label>
          <textarea rows="5" placeholder="Mo ta chi tiet asset, style, lens, light..." />
        </div>

        <div class="stack-actions">
          <button type="button" class="ghost-btn">
            <ImagePlus :size="14" /> Them anh tham chieu
          </button>
          <button type="button" class="ghost-btn">
            <RefreshCcw :size="14" /> Regenerate selected
          </button>
          <button type="button" class="solid-btn" @click="emit('action', 'go-step-4')">
            <Package :size="14" /> Khoa asset va sang Step 4
          </button>
        </div>
      </aside>

      <main class="column card">
        <div class="title-row">
          <Sparkles :size="16" />
          <strong>{{ selectedTabTitle }}</strong>
        </div>

        <div class="gallery-grid">
          <article v-for="item in previewItems" :key="item" class="asset-card">
            <div class="thumb" />
            <strong>{{ item }}</strong>
            <div class="item-actions">
              <button type="button" class="ghost-btn">Preview</button>
              <button type="button" class="ghost-btn">Pin</button>
            </div>
          </article>
        </div>
      </main>

      <aside class="column card">
        <div class="title-row">
          <ShieldCheck :size="16" />
          <strong>Inspector & Continuity</strong>
        </div>

        <div class="info-block">
          <p class="label"><UserRound :size="13" /> Active subject</p>
          <p class="value">Chen Moli - 17 tuoi - campus vibe</p>
        </div>

        <div class="info-block">
          <p class="label">Continuity status</p>
          <p class="value accent">{{ continuityBadge[state.faceLock] }} lock</p>
        </div>

        <div class="alert-box">
          Shot 07 can bo sung goc nghieng 3/4 de frame noi tiep mem hon.
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
.chip-btn,
.ghost-btn,
.solid-btn,
.label {
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
label {
  margin: 0;
}

h3 {
  font-size: 14px;
}

.workspace-grid {
  display: grid;
  grid-template-columns: 0.95fr 1.2fr 0.85fr;
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

.tab-row,
.lock-row,
.item-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip-btn,
.ghost-btn,
.solid-btn {
  border: 1px solid var(--color-border);
  border-radius: 9px;
  padding: 7px 10px;
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
}

.chip-btn.active {
  border-color: var(--color-accent-strong);
  color: var(--color-accent);
  background: var(--color-accent-soft);
}

.solid-btn {
  border-color: var(--color-accent-strong);
  background: var(--color-accent);
  color: var(--color-text-on-accent);
}

.field-box {
  display: grid;
  gap: 6px;
}

label,
.label {
  font-size: 12px;
  color: var(--color-text-muted);
}

textarea {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 10px;
  color: var(--color-text);
  background: var(--color-bg);
  resize: vertical;
}

.stack-actions {
  display: grid;
  gap: 8px;
}

.gallery-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.asset-card {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 8px;
  background: var(--color-bg);
  display: grid;
  gap: 8px;
}

.thumb {
  height: 120px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: linear-gradient(140deg, var(--color-accent-soft), var(--color-bg-elevated));
}

.info-block {
  display: grid;
  gap: 6px;
}

.value {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 8px;
  background: var(--color-bg);
}

.value.accent {
  color: var(--color-accent);
}

.alert-box {
  border: 1px dashed var(--color-accent-strong);
  border-radius: 10px;
  padding: 8px;
  font-size: 12px;
  color: var(--color-text-muted);
  background: var(--color-accent-soft);
}

@media (max-width: 1180px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }

  .gallery-grid {
    grid-template-columns: 1fr;
  }
}
</style>
