<script setup>
import { computed } from 'vue'
import {
  Bot,
  Camera,
  ChevronRight,
  ClipboardCheck,
  Combine,
  FileJson,
  Filter,
  ListTree,
  MapPin,
  MessageSquare,
  PanelRight,
  RefreshCcw,
  Scissors,
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

const treeItems = [
  { id: 'ep1', level: 'Episode', name: 'Episode 01', status: 'done', hasPrompt: true, hasCharacter: true },
  { id: 'sc1', level: 'Scene', name: 'Scene 01 - Opening', status: 'done', hasPrompt: true, hasCharacter: true },
  { id: 'sh1', level: 'Shot', name: 'Shot 01 - Hook', status: 'review', hasPrompt: true, hasCharacter: true },
  { id: 'sh2', level: 'Shot', name: 'Shot 02 - Setup', status: 'missing', hasPrompt: false, hasCharacter: true },
  { id: 'sc2', level: 'Scene', name: 'Scene 02 - Conflict', status: 'review', hasPrompt: true, hasCharacter: false },
  { id: 'sh3', level: 'Shot', name: 'Shot 03 - Reveal', status: 'done', hasPrompt: true, hasCharacter: true }
]

const pipelineEvents = [
  'Script parser da tach 2 scene / 6 shot',
  'Nhan vat trong Scene 02 can bo sung profile',
  'Shot 02 chua co prompt anh dau vao'
]

const inspectorType = computed(() => props.state.selectedType)

const filteredTreeItems = computed(() => {
  const mode = props.state.filter
  if (mode === 'all') return treeItems
  if (mode === 'error') return treeItems.filter((item) => item.status === 'missing')
  if (mode === 'missing-prompt') return treeItems.filter((item) => !item.hasPrompt)
  if (mode === 'missing-character') return treeItems.filter((item) => !item.hasCharacter)
  return treeItems
})

const statusCount = computed(() => ({
  done: treeItems.filter((item) => item.status === 'done').length,
  review: treeItems.filter((item) => item.status === 'review').length,
  missing: treeItems.filter((item) => item.status === 'missing').length
}))

const selectedNodeLabel = computed(() => {
  const found = treeItems.find((item) => item.id === props.state.selectedNode)
  return found ? `${found.level} - ${found.name}` : 'Chua chon thanh phan'
})
</script>

<template>
  <article class="workspace-step">
    <header class="step-head">
      <div class="head-left">
        <span class="dot" />
        <h3>Phase 02 - Structure & Analysis</h3>
      </div>
      <button type="button" class="solid-btn" @click="emit('action', 'confirm-structure')">
        <ClipboardCheck :size="14" /> Xac nhan cau truc
      </button>
    </header>

    <section class="workspace-grid">
      <aside class="column card">
        <div class="title-row">
          <Filter :size="16" />
          <strong>Panel dieu kien</strong>
        </div>

        <div class="status-summary">
          <div class="summary-item done">
            <span>Done</span>
            <strong>{{ statusCount.done }}</strong>
          </div>
          <div class="summary-item review">
            <span>Review</span>
            <strong>{{ statusCount.review }}</strong>
          </div>
          <div class="summary-item missing">
            <span>Missing</span>
            <strong>{{ statusCount.missing }}</strong>
          </div>
        </div>

        <div class="filter-row">
          <label><Filter :size="13" /> Filter list</label>
          <select v-model="state.filter">
            <option value="all">Tat ca</option>
            <option value="error">Chi loi</option>
            <option value="missing-prompt">Chua co prompt</option>
            <option value="missing-character">Chua co nhan vat</option>
          </select>
        </div>

        <div class="log-box">
          <div class="log-head">
            <Bot :size="14" />
            <span>AI pipeline log</span>
          </div>
          <p v-for="line in pipelineEvents" :key="line">{{ line }}</p>
        </div>

        <div class="tool-row">
          <button type="button" class="ghost-btn" @click="emit('action', 'fix-scene')">
            <RefreshCcw :size="14" /> AI sua canh
          </button>
          <button type="button" class="ghost-btn" @click="emit('action', 'split-shot')">
            <Scissors :size="14" /> Tach shot
          </button>
          <button type="button" class="ghost-btn" @click="emit('action', 'merge-shot')">
            <Combine :size="14" /> Gop shot
          </button>
        </div>
      </aside>

      <main class="column card">
        <div class="title-row">
          <ListTree :size="16" />
          <strong>Cay Episode / Scene / Shot</strong>
        </div>

        <div class="tree-list">
          <button
            v-for="item in filteredTreeItems"
            :key="item.id"
            type="button"
            :class="['tree-item', item.level.toLowerCase(), { active: state.selectedNode === item.id }]"
            @click="state.selectedNode = item.id; state.selectedType = item.level"
          >
            <span class="tree-label">
              <ChevronRight :size="13" />
              {{ item.level }} - {{ item.name }}
            </span>
            <span :class="['status-chip', item.status]">{{ item.status }}</span>
          </button>

          <p v-if="!filteredTreeItems.length" class="empty-hint">Khong co item phu hop voi filter hien tai.</p>
        </div>

        <div class="sub-actions">
          <button type="button" class="ghost-btn">
            <FileJson :size="14" /> Export structure JSON
          </button>
          <button type="button" class="ghost-btn">
            <PanelRight :size="14" /> Mo preview panel
          </button>
        </div>
      </main>

      <aside class="column card inspector-panel">
        <div class="inspector-head">
          <strong>Inspector</strong>
          <span class="selected-chip">{{ selectedNodeLabel }}</span>
        </div>

        <template v-if="inspectorType === 'Character'">
          <p class="label"><UserRound :size="13" /> Mo ta</p>
          <p class="value">Nhan vat host nu, nang dong, giu nhip truyen thong nhat quan.</p>
          <p class="label">Vai tro</p>
          <p class="value">Dan dat cau chuyen va lien ket scene.</p>
          <p class="label">Tinh cach</p>
          <p class="value">Tu tin, than thien, noi nhanh ro rang.</p>
        </template>

        <template v-else-if="inspectorType === 'Scene'">
          <p class="label"><MapPin :size="13" /> Location</p>
          <p class="value">Studio hien dai, background led xanh dam.</p>
          <p class="label">Mood</p>
          <p class="value">Focused, cinematic, energetic.</p>
          <p class="label">Anh sang</p>
          <p class="value">Key light ben trai, rim light vang nhe.</p>
        </template>

        <template v-else>
          <p class="label"><Sparkles :size="13" /> Action</p>
          <p class="value">Nhan vat buoc vao khung hinh va gioi thieu van de.</p>
          <p class="label"><Camera :size="13" /> Camera</p>
          <p class="value">Dolly in nhe, focal length 35mm.</p>
          <p class="label"><MessageSquare :size="13" /> Dialogue</p>
          <p class="value">"Neu ban mat 3 gio de lam storyboard, day la giai phap"</p>
        </template>

        <button type="button" class="solid-btn" @click="emit('action', 'confirm-structure')">
          <ClipboardCheck :size="14" /> Xac nhan va sang Step 3
        </button>
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
.tree-label,
.log-head {
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
  grid-template-columns: 0.95fr 1.1fr 0.9fr;
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

.status-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.summary-item {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg);
  padding: 8px;
  display: grid;
  gap: 4px;
}

.summary-item span {
  color: var(--color-text-muted);
  font-size: 11px;
}

.summary-item strong {
  color: var(--color-accent);
}

.summary-item.missing strong {
  color: var(--color-danger);
}

.filter-row {
  display: grid;
  gap: 6px;
}

label {
  font-size: 12px;
  color: var(--color-text-muted);
}

select {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 9px;
  color: var(--color-text);
  background: var(--color-bg);
}

.log-box {
  border: 1px dashed var(--color-border);
  border-radius: 10px;
  padding: 8px;
  display: grid;
  gap: 6px;
  color: var(--color-text-muted);
  background: var(--color-bg);
}

.log-box p {
  font-size: 12px;
}

.tool-row,
.sub-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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

.tree-list {
  display: grid;
  gap: 8px;
}

.tree-item {
  border: 1px dashed var(--color-border);
  border-radius: 10px;
  padding: 9px;
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.tree-item.scene {
  margin-left: 14px;
}

.tree-item.shot {
  margin-left: 28px;
}

.tree-item.active {
  border-color: var(--color-accent-strong);
  background: var(--color-accent-soft);
}

.status-chip {
  font-size: 11px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 2px 8px;
  text-transform: capitalize;
}

.status-chip.done,
.status-chip.review {
  border-color: var(--color-accent-strong);
  color: var(--color-accent);
}

.status-chip.missing {
  border-color: var(--color-danger);
  color: var(--color-danger);
}

.empty-hint {
  color: var(--color-text-muted);
  font-size: 12px;
}

.inspector-head {
  display: grid;
  gap: 8px;
}

.selected-chip {
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: 5px 9px;
  color: var(--color-text-muted);
  font-size: 12px;
  background: var(--color-bg);
}

.label {
  font-size: 12px;
  color: var(--color-text-muted);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.value {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 8px;
  color: var(--color-text);
  background: var(--color-bg);
}

@media (max-width: 1180px) {
  .workspace-grid {
    grid-template-columns: 1fr;
  }

  .tree-item.scene,
  .tree-item.shot {
    margin-left: 0;
  }
}
</style>
