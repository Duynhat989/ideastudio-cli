<script setup>
import { computed, onMounted, ref } from 'vue';
import {
  FolderOpen,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  LayoutGrid,
  Loader2,
  Sparkles,
  Clock,
} from 'lucide-vue-next';
import { projectService } from '@/services/project.service';
import { notify } from '@/composables/useNotify.js';

const props = defineProps({
  currentProjectId: String,
});

const emit = defineEmits(['load', 'create', 'delete', 'rename']);

const projects = ref([]);
const loading = ref(false);
const newProjectName = ref('');
const newProjectDescription = ref('');
const newProjectAspect = ref('portrait');
const search = ref('');
const sortBy = ref('updated');
const editingId = ref('');
const editingName = ref('');
const createModalOpen = ref(false);

const aspectOptions = [
  { value: 'portrait', label: '9:16', hint: 'Dọc' },
  { value: 'landscape', label: '16:9', hint: 'Ngang' },
  { value: 'square', label: '1:1', hint: 'Vuông' },
];

const aspectLabel = (preset) => {
  const p = String(preset || 'portrait').toLowerCase();
  if (p === 'portrait') return '9:16';
  if (p === 'square') return '1:1';
  return '16:9';
};

const loadProjects = async () => {
  loading.value = true;
  try {
    const response = await projectService.list();
    projects.value = response?.data || [];
  } finally {
    loading.value = false;
  }
};

const filteredProjects = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  const list = projects.value.filter((p) => {
    if (!keyword) return true;
    const name = (p.name || '').toLowerCase();
    const desc = (p.description || '').toLowerCase();
    return name.includes(keyword) || desc.includes(keyword);
  });

  if (sortBy.value === 'name') {
    return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }
  return [...list].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
});

const projectCountLabel = computed(() => {
  const n = filteredProjects.value.length;
  if (n === 0) return 'Chưa có project';
  return `${n} project`;
});

const createProject = async () => {
  const name = newProjectName.value.trim();
  if (!name) return;
  const response = await projectService.create({
    name,
    description: newProjectDescription.value.trim(),
    aspectPreset: newProjectAspect.value,
  });
  if (!response?.success) return;
  newProjectName.value = '';
  newProjectDescription.value = '';
  newProjectAspect.value = 'portrait';
  createModalOpen.value = false;
  await loadProjects();
  emit('create', response.data.id);
};

const openCreateModal = () => {
  createModalOpen.value = true;
};

const closeCreateModal = () => {
  createModalOpen.value = false;
};

const startRename = (project) => {
  editingId.value = project.id;
  editingName.value = project.name || '';
};

const cancelRename = () => {
  editingId.value = '';
  editingName.value = '';
};

const saveRename = async (id) => {
  const name = editingName.value.trim();
  if (!name) return;
  const response = await projectService.update(id, { name });
  if (response?.success) {
    await loadProjects();
    emit('rename', { id, name });
  }
  cancelRename();
};

const removeProject = async (id) => {
  const ok = await notify.confirm({
    title: 'Xóa project',
    message: 'Xóa project này và toàn bộ assets?',
    confirmText: 'Xóa',
    cancelText: 'Hủy',
    variant: 'warning',
  });
  if (!ok) return;
  await projectService.delete(id);
  await loadProjects();
  emit('delete', id);
};

onMounted(loadProjects);
</script>

<template>
  <section class="page-wrap">
    <div class="pm-bg" aria-hidden="true" />
    <div class="pm-inner">
      <header class="pm-hero">
        <div class="pm-hero-text">
          <p class="pm-eyebrow">
            <Sparkles :size="14" class="pm-eyebrow-ic" aria-hidden="true" />
            Workflow
          </p>
          <h2 class="pm-title">Project Manager</h2>
          <p class="pm-sub">Chọn một project để mở canvas kéo thả, hoặc tạo mới bên dưới.</p>
        </div>
        <div class="pm-hero-badge" :class="{ dim: loading }">
          <FolderOpen :size="22" class="pm-badge-ic" aria-hidden="true" />
          <span>{{ projectCountLabel }}</span>
        </div>
      </header>

      <div class="pm-toolbar">
        <div class="pm-search" role="search">
          <Search :size="17" class="pm-search-ic" aria-hidden="true" />
          <input
            v-model="search"
            type="search"
            class="pm-search-input"
            placeholder="Tìm theo tên hoặc mô tả…"
            autocomplete="off"
          />
        </div>
        <select v-model="sortBy" class="pm-select" aria-label="Sắp xếp">
          <option value="updated">Mới cập nhật</option>
          <option value="name">Tên A–Z</option>
        </select>
        <button type="button" class="pm-create-btn" @click="openCreateModal">
          <Plus :size="16" />
          <span>Tạo project</span>
        </button>
      </div>

      <main class="pm-main">
        <div class="pm-main-head">
          <h3 class="pm-main-title">Danh sách</h3>
          <p v-if="!loading && filteredProjects.length" class="pm-main-hint">Nhấn thẻ để mở project</p>
        </div>

        <div class="pm-list-wrap">
          <div v-if="loading" class="pm-state pm-state--load">
            <Loader2 :size="28" class="pm-spin" aria-hidden="true" />
            <p>Đang tải project…</p>
          </div>
          <div v-else-if="filteredProjects.length === 0" class="pm-state pm-state--empty">
            <div class="pm-empty-icon">
              <FolderOpen :size="36" stroke-width="1.5" />
            </div>
            <p class="pm-empty-title">Chưa có project</p>
            <p class="pm-empty-text">Bấm <strong>Tạo project</strong> để bắt đầu.</p>
          </div>
          <div v-else class="pm-grid">
            <article
              v-for="project in filteredProjects"
              :key="project.id"
              class="pm-card"
              :class="{ 'pm-card--active': currentProjectId === project.id }"
            >
              <div class="pm-card-accent" aria-hidden="true" />
              <div class="pm-card-inner" @click="emit('load', project.id)">
                <div class="pm-card-top">
                  <span class="pm-ratio">{{ aspectLabel(project.aspectPreset) }}</span>
                  <div v-if="editingId !== project.id" class="pm-card-actions">
                    <button type="button" class="pm-icon" title="Đổi tên" @click.stop="startRename(project)">
                      <Edit2 :size="15" />
                    </button>
                    <button type="button" class="pm-icon pm-icon--danger" title="Xóa" @click.stop="removeProject(project.id)">
                      <Trash2 :size="15" />
                    </button>
                  </div>
                </div>

                <template v-if="editingId === project.id">
                  <div class="pm-rename" @click.stop>
                    <input
                      v-model="editingName"
                      class="pm-rename-input"
                      @keyup.enter="saveRename(project.id)"
                      @keyup.esc="cancelRename"
                    />
                    <div class="pm-rename-row">
                      <button type="button" class="pm-icon pm-icon--ok" @click="saveRename(project.id)">
                        <Check :size="15" />
                      </button>
                      <button type="button" class="pm-icon" @click="cancelRename">
                        <X :size="15" />
                      </button>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <h3 class="pm-card-title">{{ project.name }}</h3>
                  <p v-if="project.description" class="pm-card-desc">{{ project.description }}</p>
                  <p v-else class="pm-card-desc pm-card-desc--muted">Chưa có mô tả</p>
                  <div class="pm-card-foot">
                    <Clock :size="13" aria-hidden="true" />
                    <time :datetime="project.updatedAt || project.createdAt">{{
                      new Date(project.updatedAt || project.createdAt).toLocaleString('vi-VN')
                    }}</time>
                  </div>
                </template>
              </div>
            </article>
          </div>
        </div>
      </main>
    </div>

    <Teleport to="body">
      <div v-if="createModalOpen" class="pm-modal-overlay" @click.self="closeCreateModal">
        <div class="pm-modal-card">
          <div id="create-heading" class="pm-create-head">
            <LayoutGrid :size="17" aria-hidden="true" />
            <span>Tạo project</span>
          </div>
          <label class="pm-field">
            <span class="pm-label">Tên project</span>
            <input
              v-model="newProjectName"
              type="text"
              class="pm-input"
              placeholder="VD: Campaign Tết 2026"
              @keyup.enter="createProject"
            />
          </label>
          <label class="pm-field">
            <span class="pm-label">Mô tả <span class="pm-optional">(tuỳ chọn)</span></span>
            <textarea
              v-model="newProjectDescription"
              class="pm-textarea"
              rows="3"
              placeholder="Ghi chú ngắn cho team…"
            />
          </label>
          <div class="pm-field">
            <span class="pm-label">Tỷ lệ mặc định</span>
            <div class="pm-chips" role="radiogroup" aria-label="Tỷ lệ">
              <button
                v-for="opt in aspectOptions"
                :key="opt.value"
                type="button"
                class="pm-chip"
                :class="{ 'pm-chip--on': newProjectAspect === opt.value }"
                @click="newProjectAspect = opt.value"
              >
                <span class="pm-chip-label">{{ opt.label }}</span>
                <span class="pm-chip-hint">{{ opt.hint }}</span>
              </button>
            </div>
          </div>
          <div class="pm-modal-actions">
            <button type="button" class="pm-cancel" @click="closeCreateModal">Hủy</button>
            <button type="button" class="pm-submit" :disabled="!newProjectName.trim()" @click="createProject">
              <Plus :size="18" stroke-width="2.25" />
              Tạo project
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.page-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: none;
  margin: 0;
  min-height: 0;
  flex: 1;
  box-sizing: border-box;
  overflow: hidden;
  color: var(--color-text);
}

.pm-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(ellipse 80% 50% at 10% -10%, var(--color-accent-bg-fade-1), transparent 55%),
    radial-gradient(ellipse 60% 40% at 100% 0%, rgba(99, 102, 241, 0.12), transparent 45%),
    linear-gradient(180deg, #0c0c0f 0%, var(--color-bg) 38%);
}

.pm-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  flex: 1;
  min-height: 0;
  padding: clamp(1rem, 2.5vw, 1.75rem) clamp(1rem, 2.8vw, 2rem) 1.5rem;
  box-sizing: border-box;
}

/* --- Hero --- */
.pm-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.pm-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0 0 0.4rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-accent-strong);
}

.pm-eyebrow-ic {
  opacity: 0.9;
}

.pm-title {
  margin: 0;
  font-size: clamp(1.5rem, 3vw, 1.85rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.1;
  background: linear-gradient(115deg, #fff 0%, #e4e4e7 45%, var(--color-accent) 92%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.pm-sub {
  margin: 0.5rem 0 0;
  max-width: 36rem;
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--color-text-muted);
}

.pm-hero-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: rgba(19, 21, 26, 0.85);
  backdrop-filter: blur(8px);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
}

.pm-hero-badge.dim {
  opacity: 0.65;
}

.pm-badge-ic {
  color: var(--color-accent-strong);
}

/* --- Toolbar --- */
.pm-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: stretch;
  flex-shrink: 0;
}

.pm-search {
  flex: 1;
  min-width: min(100%, 220px);
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0 1rem;
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.pm-search-ic {
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.pm-search-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  padding: 0.75rem 0;
  font-size: 0.9rem;
  color: var(--color-text);
  outline: none;
}

.pm-search-input::placeholder {
  color: #71717a;
}

.pm-select {
  min-width: 11rem;
  padding: 0.65rem 0.9rem;
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  color: var(--color-text);
  font-size: 0.875rem;
  cursor: pointer;
}

.pm-select:focus {
  outline: 2px solid var(--color-accent-soft);
  outline-offset: 1px;
}

/* --- Main list --- */
.pm-main {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  min-height: 0;
  min-width: 0;
  flex: 1;
}

.pm-create-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
}

.pm-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.pm-label {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.pm-optional {
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  opacity: 0.75;
}

.pm-input,
.pm-textarea {
  width: 100%;
  box-sizing: border-box;
  border-radius: 0.65rem;
  border: 1px solid var(--color-border);
  background: var(--color-bg-soft);
  color: var(--color-text);
  font-size: 0.9rem;
  font-family: inherit;
  padding: 0.65rem 0.75rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.pm-input:focus,
.pm-textarea:focus {
  outline: none;
  border-color: rgba(234, 179, 8, 0.45);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}

.pm-textarea {
  resize: vertical;
  min-height: 4.5rem;
  line-height: 1.45;
}

.pm-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.pm-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  padding: 0.45rem 0.65rem;
  min-width: 4.25rem;
  border-radius: 0.55rem;
  border: 1px solid var(--color-border);
  background: var(--color-bg-soft);
  color: var(--color-text-muted);
  cursor: pointer;
  font-family: inherit;
  transition: all 0.18s ease;
}

.pm-chip:hover {
  border-color: #52525b;
  color: var(--color-text);
}

.pm-chip--on {
  border-color: rgba(234, 179, 8, 0.55);
  background: var(--color-accent-soft);
  color: var(--color-text);
  box-shadow: 0 0 0 1px rgba(234, 179, 8, 0.12);
}

.pm-chip-label {
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.pm-chip-hint {
  font-size: 0.65rem;
  font-weight: 600;
  opacity: 0.85;
}

.pm-create-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid rgba(234, 179, 8, 0.5);
  background: var(--color-accent-soft);
  color: var(--color-text);
  border-radius: 0.75rem;
  padding: 0 0.95rem;
  font-size: 0.86rem;
  font-weight: 700;
  cursor: pointer;
}

.pm-submit {
  margin-top: 0.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  width: 100%;
  padding: 0.7rem 1rem;
  border: none;
  border-radius: 0.65rem;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  color: var(--color-text-on-accent);
  background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-strong) 100%);
  box-shadow: 0 6px 20px rgba(234, 179, 8, 0.25);
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

.pm-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(234, 179, 8, 0.32);
}

.pm-submit:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.pm-main-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  flex-shrink: 0;
}

.pm-main-title {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}

.pm-main-hint {
  margin: 0;
  font-size: 0.75rem;
  color: #71717a;
}

.pm-list-wrap {
  flex: 1;
  min-height: 0;
  border-radius: 1rem;
  border: 1px solid var(--color-border);
  background: rgba(8, 8, 10, 0.65);
  overflow: auto;
  padding: 1rem;
}

.pm-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 12rem;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.pm-state--load p {
  margin: 0;
}

.pm-spin {
  animation: pm-spin 0.85s linear infinite;
  color: var(--color-accent-strong);
}

@keyframes pm-spin {
  to {
    transform: rotate(360deg);
  }
}

.pm-state--empty {
  padding: 2rem 1rem;
}

.pm-empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 1rem;
  border: 1px dashed var(--color-border);
  color: var(--color-text-muted);
  background: var(--color-bg-soft);
}

.pm-empty-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text);
}

.pm-empty-text {
  margin: 0;
  max-width: 22rem;
  line-height: 1.55;
  font-size: 0.875rem;
}

.pm-empty-text strong {
  color: var(--color-accent-strong);
  font-weight: 700;
}

/* Masonry 3 cột */
.pm-grid {
  column-count: 3;
  column-gap: 1rem;
}

@media (max-width: 1100px) {
  .pm-grid {
    column-count: 2;
  }
}

@media (max-width: 640px) {
  .pm-grid {
    column-count: 1;
  }
}

.pm-card {
  position: relative;
  break-inside: avoid;
  page-break-inside: avoid;
  margin-bottom: 1rem;
  display: inline-block;
  width: 100%;
  vertical-align: top;
  box-sizing: border-box;
  border-radius: 0.85rem;
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.pm-card:hover {
  border-color: #3f4654;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
  transform: translateY(-2px);
}

.pm-card--active {
  border-color: rgba(234, 179, 8, 0.55);
  box-shadow: 0 0 0 1px rgba(234, 179, 8, 0.12), 0 12px 36px rgba(0, 0, 0, 0.35);
}

.pm-card-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(180deg, var(--color-accent) 0%, var(--color-accent-strong) 100%);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.pm-card--active .pm-card-accent,
.pm-card:hover .pm-card-accent {
  opacity: 1;
}

.pm-card-inner {
  padding: 1rem 1rem 1rem 0.85rem;
  cursor: pointer;
  min-height: 7.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pm-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.pm-ratio {
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 0.25rem 0.5rem;
  border-radius: 0.35rem;
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
  border: 1px solid rgba(234, 179, 8, 0.25);
}

.pm-card-actions {
  display: flex;
  gap: 0.25rem;
}

.pm-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.45rem;
  border: 1px solid var(--color-border);
  background: var(--color-bg-soft);
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.pm-icon:hover {
  color: var(--color-text);
  border-color: #52525b;
  background: #27272a;
}

.pm-icon--danger:hover {
  color: #fecaca;
  border-color: rgba(248, 113, 113, 0.45);
  background: rgba(248, 113, 113, 0.08);
}

.pm-icon--ok {
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.35);
}

.pm-icon--ok:hover {
  background: rgba(34, 197, 94, 0.12);
  color: #bbf7d0;
}

.pm-card-title {
  margin: 0;
  font-size: 1.02rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: var(--color-text);
}

.pm-card-desc {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: #d4d4d8;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pm-card-desc--muted {
  color: #71717a;
  font-style: italic;
}

.pm-card-foot {
  margin-top: auto;
  padding-top: 0.35rem;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  color: #71717a;
}

.pm-card-foot time {
  font-variant-numeric: tabular-nums;
}

.pm-rename {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pm-rename-input {
  width: 100%;
  box-sizing: border-box;
  border-radius: 0.5rem;
  border: 1px solid rgba(234, 179, 8, 0.55);
  background: var(--color-bg);
  color: var(--color-text);
  padding: 0.5rem 0.65rem;
  font-size: 0.9rem;
}

.pm-rename-row {
  display: flex;
  gap: 0.35rem;
}

.pm-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  padding: 1rem;
}

.pm-modal-card {
  width: min(520px, 100%);
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.15rem 1.2rem 1.25rem;
  border-radius: 1rem;
  border: 1px solid var(--color-border);
  background:
    linear-gradient(160deg, var(--color-accent-bg-fade-2) 0%, transparent 42%),
    var(--color-bg-elevated);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
}

.pm-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.pm-cancel {
  border: 1px solid var(--color-border);
  background: var(--color-bg-soft);
  color: var(--color-text);
  border-radius: 0.65rem;
  padding: 0.7rem 1rem;
  font-weight: 600;
  cursor: pointer;
}
</style>
