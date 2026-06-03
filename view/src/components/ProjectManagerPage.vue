<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  FolderOpen,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Search,
  Loader2,
  Sparkles,
  Clock,
  Film,
  Smartphone,
  Monitor,
} from 'lucide-vue-next';
import { projectService } from '@/services/project.service';
import { notify } from '@/composables/useNotify.js';
import demoThumb from '@/assets/demo.png';

const { t } = useI18n();

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

const aspectOptions = computed(() => [
  {
    value: 'portrait',
    label: '9:16',
    hint: t('project.aspectPortrait'),
    desc: t('project.aspectPortraitHint'),
    Icon: Smartphone,
  },
  {
    value: 'landscape',
    label: '16:9',
    hint: t('project.aspectLandscape'),
    desc: t('project.aspectLandscapeHint'),
    Icon: Monitor,
  },
]);

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
  if (n === 0) return t('project.none');
  return t('project.count', { n });
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
    title: t('project.deleteTitle'),
    message: t('project.deleteMessage'),
    confirmText: t('common.delete'),
    cancelText: t('common.cancel'),
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
    <div class="pm-bg" aria-hidden="true">
      <div class="pm-bg-orb pm-bg-orb--1" />
      <div class="pm-bg-orb pm-bg-orb--2" />
      <div class="pm-bg-grid" />
    </div>

    <div class="pm-inner">
      <header class="pm-hero">
        <div class="pm-hero-left">
          <div class="pm-hero-icon">
            <Film :size="22" aria-hidden="true" />
          </div>
          <div class="pm-hero-text">
            <p class="pm-eyebrow">
              <Sparkles :size="13" class="pm-eyebrow-ic" aria-hidden="true" />
              Flow AI
            </p>
            <h2 class="pm-title">{{ t('project.managerTitle') }}</h2>
            <p class="pm-sub">{{ t('project.subtitle') }}</p>
          </div>
        </div>
        <div class="pm-hero-stats">
          <div class="pm-stat" :class="{ dim: loading }">
            <FolderOpen :size="18" aria-hidden="true" />
            <span>{{ projectCountLabel }}</span>
          </div>
        </div>
      </header>

      <div class="pm-toolbar">
        <div class="pm-search" role="search">
          <Search :size="17" class="pm-search-ic" aria-hidden="true" />
          <input
            v-model="search"
            type="search"
            class="pm-search-input"
            :placeholder="t('project.searchPlaceholder')"
            autocomplete="off"
          />
        </div>
        <select v-model="sortBy" class="pm-select" :aria-label="t('project.sortLabel')">
          <option value="updated">{{ t('project.sortUpdated') }}</option>
          <option value="name">{{ t('project.sortName') }}</option>
        </select>
        <button type="button" class="pm-create-btn" @click="openCreateModal">
          <Plus :size="17" stroke-width="2.5" />
          <span>{{ t('project.createProject') }}</span>
        </button>
      </div>

      <main class="pm-main">
        <div v-if="loading" class="pm-state pm-state--load">
          <Loader2 :size="32" class="pm-spin" aria-hidden="true" />
          <p>{{ t('project.loading') }}</p>
        </div>

        <div v-else-if="filteredProjects.length === 0" class="pm-state pm-state--empty">
          <div class="pm-empty-visual">
            <div class="pm-empty-ring">
              <FolderOpen :size="40" stroke-width="1.25" />
            </div>
          </div>
          <h3 class="pm-empty-title">{{ t('project.emptyTitle') }}</h3>
          <p class="pm-empty-text">{{ t('project.emptyText') }}</p>
          <button type="button" class="pm-empty-cta" @click="openCreateModal">
            <Plus :size="16" />
            {{ t('project.createNew') }}
          </button>
        </div>

        <div v-else class="pm-grid">
          <article
            v-for="project in filteredProjects"
            :key="project.id"
            class="pm-card"
            :class="{ 'pm-card--active': currentProjectId === project.id }"
          >
            <button
              type="button"
              class="pm-card-open"
              :aria-label="t('project.openProject', { name: project.name })"
              @click="emit('load', project.id)"
            >
              <div class="pm-card-media">
                <img :src="demoThumb" alt="" class="pm-card-img" loading="lazy" decoding="async" />
                <span class="pm-card-tag">Workflow</span>
              </div>

              <div class="pm-card-content">
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
                        <Check :size="14" />
                      </button>
                      <button type="button" class="pm-icon" @click="cancelRename">
                        <X :size="14" />
                      </button>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <div class="pm-card-head">
                    <h3 class="pm-card-title">{{ project.name }}</h3>
                    <span v-if="currentProjectId === project.id" class="pm-active-badge">{{ t('project.activeBadge') }}</span>
                  </div>
                  <p v-if="project.description" class="pm-card-desc">{{ project.description }}</p>
                  <p v-else class="pm-card-desc pm-card-desc--muted">{{ t('project.noDescription') }}</p>
                  <div class="pm-card-foot">
                    <span class="pm-ratio-pill">{{ aspectLabel(project.aspectPreset) }}</span>
                    <span class="pm-card-date">
                      <Clock :size="12" aria-hidden="true" />
                      <time :datetime="project.updatedAt || project.createdAt">{{
                        new Date(project.updatedAt || project.createdAt).toLocaleString('vi-VN')
                      }}</time>
                    </span>
                  </div>
                </template>
              </div>
            </button>

            <div v-if="editingId !== project.id" class="pm-card-actions">
              <button type="button" class="pm-icon" :title="t('project.rename')" @click.stop="startRename(project)">
                <Edit2 :size="14" />
              </button>
              <button type="button" class="pm-icon pm-icon--danger" :title="t('common.delete')" @click.stop="removeProject(project.id)">
                <Trash2 :size="14" />
              </button>
            </div>
          </article>
        </div>
      </main>
    </div>

    <Teleport to="body">
      <Transition name="pm-modal">
        <div v-if="createModalOpen" class="pm-modal-overlay" @click.self="closeCreateModal">
          <div class="pm-modal-card" role="dialog" aria-labelledby="create-heading">
            <header class="pm-modal-header">
              <div>
                <p id="create-heading" class="pm-modal-eyebrow">{{ t('project.newEyebrow') }}</p>
                <h3 class="pm-modal-title">{{ t('project.createModalTitle') }}</h3>
              </div>
              <button type="button" class="pm-modal-close" :aria-label="t('common.close')" @click="closeCreateModal">
                <X :size="18" />
              </button>
            </header>

            <div class="pm-modal-body">
              <label class="pm-field">
                <span class="pm-label">{{ t('project.projectName') }}</span>
                <input
                  v-model="newProjectName"
                  type="text"
                  class="pm-input"
                  :placeholder="t('project.projectNamePlaceholder')"
                  autofocus
                  @keyup.enter="createProject"
                />
              </label>

              <label class="pm-field">
                <span class="pm-label">{{ t('project.description') }} <span class="pm-optional">({{ t('common.optional') }})</span></span>
                <textarea
                  v-model="newProjectDescription"
                  class="pm-textarea"
                  rows="2"
                  :placeholder="t('project.descriptionPlaceholder')"
                />
              </label>

              <div class="pm-field">
                <span class="pm-label">{{ t('project.canvasAspect') }}</span>
                <div class="pm-aspect-grid" role="radiogroup" :aria-label="t('project.canvasAspect')">
                  <button
                    v-for="opt in aspectOptions"
                    :key="opt.value"
                    type="button"
                    class="pm-aspect-opt"
                    :class="{ 'pm-aspect-opt--on': newProjectAspect === opt.value }"
                    @click="newProjectAspect = opt.value"
                  >
                    <div class="pm-aspect-visual" :class="`pm-aspect-visual--${opt.value}`">
                      <component :is="opt.Icon" :size="16" aria-hidden="true" />
                    </div>
                    <div class="pm-aspect-meta">
                      <span class="pm-aspect-label">{{ opt.label }}</span>
                      <span class="pm-aspect-hint">{{ opt.desc }}</span>
                    </div>
                    <span class="pm-aspect-check" aria-hidden="true">
                      <Check v-if="newProjectAspect === opt.value" :size="14" />
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <footer class="pm-modal-footer">
              <button type="button" class="pm-cancel" @click="closeCreateModal">{{ t('project.cancel') }}</button>
              <button type="button" class="pm-submit" :disabled="!newProjectName.trim()" @click="createProject">
                <Plus :size="17" stroke-width="2.5" />
                {{ t('project.create') }}
              </button>
            </footer>
          </div>
        </div>
      </Transition>
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
  overflow: hidden;
  background: linear-gradient(165deg, #0a0a0c 0%, var(--color-bg) 45%, #0d0f14 100%);
}

.pm-bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
}

.pm-bg-orb--1 {
  width: 420px;
  height: 420px;
  top: -120px;
  left: -80px;
  background: rgba(250, 204, 21, 0.09);
}

.pm-bg-orb--2 {
  width: 320px;
  height: 320px;
  top: 10%;
  right: -60px;
  background: rgba(99, 102, 241, 0.08);
}

.pm-bg-grid {
  position: absolute;
  inset: 0;
  opacity: 0.35;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 0%, black, transparent);
}

.pm-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 1.35rem;
  flex: 1;
  min-height: 0;
  padding: clamp(1.1rem, 2.5vw, 1.85rem) clamp(1.1rem, 3vw, 2.25rem) 1.75rem;
  box-sizing: border-box;
}

/* Hero */
.pm-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.pm-hero-left {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
}

.pm-hero-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 0.85rem;
  border: 1px solid rgba(250, 204, 21, 0.25);
  background: linear-gradient(145deg, rgba(250, 204, 21, 0.14), rgba(250, 204, 21, 0.04));
  color: var(--color-accent-strong);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  flex-shrink: 0;
}

.pm-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0 0 0.35rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-accent-strong);
}

.pm-title {
  margin: 0;
  font-size: clamp(1.45rem, 2.8vw, 1.9rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.12;
  color: #fafafa;
}

.pm-sub {
  margin: 0.45rem 0 0;
  max-width: 34rem;
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--color-text-muted);
}

.pm-stat {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.55rem 1rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: rgba(19, 21, 26, 0.75);
  backdrop-filter: blur(10px);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.pm-stat.dim {
  opacity: 0.6;
}

.pm-stat svg {
  color: var(--color-accent-strong);
}

/* Toolbar */
.pm-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  align-items: stretch;
  flex-shrink: 0;
}

.pm-search {
  flex: 1;
  min-width: min(100%, 240px);
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0 1rem;
  border-radius: 0.8rem;
  border: 1px solid var(--color-border);
  background: rgba(19, 21, 26, 0.8);
  backdrop-filter: blur(8px);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.pm-search:focus-within {
  border-color: rgba(250, 204, 21, 0.35);
  box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.08);
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
  padding: 0.72rem 0;
  font-size: 0.875rem;
  color: var(--color-text);
  outline: none;
}

.pm-search-input::placeholder {
  color: #71717a;
}

.pm-select {
  min-width: 10.5rem;
  padding: 0.65rem 0.85rem;
  border-radius: 0.8rem;
  border: 1px solid var(--color-border);
  background: rgba(19, 21, 26, 0.8);
  color: var(--color-text);
  font-size: 0.85rem;
  cursor: pointer;
}

.pm-select:focus {
  outline: 2px solid var(--color-accent-soft);
  outline-offset: 1px;
}

.pm-create-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: none;
  background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-strong) 100%);
  color: var(--color-text-on-accent);
  border-radius: 0.8rem;
  padding: 0 1.1rem;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 18px rgba(250, 204, 21, 0.28);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.pm-create-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px rgba(250, 204, 21, 0.35);
}

/* Main */
.pm-main {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  padding-right: 0.15rem;
}

.pm-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  min-height: 16rem;
  text-align: center;
  color: var(--color-text-muted);
}

.pm-state--load p {
  margin: 0;
  font-size: 0.9rem;
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
  padding: 3rem 1.5rem;
  border-radius: 1.1rem;
  border: 1px dashed rgba(255, 255, 255, 0.08);
  background: rgba(8, 8, 10, 0.45);
}

.pm-empty-ring {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 5.5rem;
  height: 5.5rem;
  border-radius: 50%;
  border: 1px solid var(--color-border);
  background: radial-gradient(circle at 30% 30%, rgba(250, 204, 21, 0.12), transparent 65%);
  color: var(--color-text-muted);
}

.pm-empty-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-text);
}

.pm-empty-text {
  margin: 0;
  max-width: 24rem;
  line-height: 1.55;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.pm-empty-cta {
  margin-top: 0.35rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.65rem 1.1rem;
  border: 1px solid rgba(250, 204, 21, 0.4);
  border-radius: 0.75rem;
  background: var(--color-accent-soft);
  color: var(--color-text);
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;
}

.pm-empty-cta:hover {
  background: rgba(250, 204, 21, 0.22);
}

/* Grid */
.pm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.25rem;
}

.pm-card {
  position: relative;
  border-radius: 1.15rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: #f7f7f8;
  overflow: hidden;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.22);
  transition: border-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease;
}

.pm-card:hover {
  border-color: rgba(255, 255, 255, 0.16);
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.32);
  transform: translateY(-4px);
}

.pm-card--active {
  border-color: rgba(250, 204, 21, 0.55);
  box-shadow:
    0 0 0 2px rgba(250, 204, 21, 0.18),
    0 18px 42px rgba(0, 0, 0, 0.35);
}

.pm-card-open {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  font-family: inherit;
}

.pm-card-media {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #ececef;
}

.pm-card-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.pm-card:hover .pm-card-img {
  transform: scale(1.04);
}

.pm-card-tag {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  padding: 0.55rem 0.95rem 0.6rem;
  border-radius: 0 0 0.85rem 0;
  background: #fff;
  color: #6b7280;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
}

.pm-card-content {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.95rem 1rem 1.05rem;
  flex: 1;
}

.pm-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.pm-card-title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;
  color: #18181b;
}

.pm-active-badge {
  flex-shrink: 0;
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.22rem 0.48rem;
  border-radius: 999px;
  background: rgba(250, 204, 21, 0.18);
  color: #a16207;
  border: 1px solid rgba(250, 204, 21, 0.35);
}

.pm-card-desc {
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.65;
  color: #71717a;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.pm-card-desc--muted {
  color: #a1a1aa;
  font-style: italic;
}

.pm-card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.65rem;
  margin-top: 0.15rem;
  flex-wrap: wrap;
}

.pm-ratio-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 3.25rem;
  padding: 0.38rem 0.9rem;
  border-radius: 999px;
  background: #c96452;
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  box-shadow: 0 4px 12px rgba(201, 100, 82, 0.28);
}

.pm-card-date {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.68rem;
  color: #a1a1aa;
}

.pm-card-date time {
  font-variant-numeric: tabular-nums;
}

.pm-card-actions {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  display: flex;
  gap: 0.3rem;
  opacity: 0;
  transition: opacity 0.18s ease;
  z-index: 2;
}

.pm-card:hover .pm-card-actions,
.pm-card--active .pm-card-actions {
  opacity: 1;
}

.pm-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 0.45rem;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  color: #f4f4f5;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.pm-icon:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.7);
}

.pm-icon--danger:hover {
  color: #fecaca;
  border-color: rgba(248, 113, 113, 0.45);
  background: rgba(248, 113, 113, 0.15);
}

.pm-icon--ok {
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.35);
}

.pm-icon--ok:hover {
  background: rgba(34, 197, 94, 0.15);
}

.pm-rename {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.pm-rename-input {
  width: 100%;
  box-sizing: border-box;
  border-radius: 0.5rem;
  border: 1px solid rgba(250, 204, 21, 0.5);
  background: #fff;
  color: #18181b;
  padding: 0.5rem 0.65rem;
  font-size: 0.875rem;
}

.pm-rename-row {
  display: flex;
  gap: 0.3rem;
}

/* Modal */
.pm-modal-enter-active,
.pm-modal-leave-active {
  transition: opacity 0.22s ease;
}

.pm-modal-enter-active .pm-modal-card,
.pm-modal-leave-active .pm-modal-card {
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease;
}

.pm-modal-enter-from,
.pm-modal-leave-to {
  opacity: 0;
}

.pm-modal-enter-from .pm-modal-card,
.pm-modal-leave-to .pm-modal-card {
  transform: scale(0.96) translateY(8px);
  opacity: 0;
}

.pm-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  padding: 1rem;
}

.pm-modal-card {
  width: min(480px, 100%);
  display: flex;
  flex-direction: column;
  border-radius: 1.1rem;
  border: 1px solid var(--color-border);
  background: linear-gradient(165deg, rgba(250, 204, 21, 0.06) 0%, transparent 40%), var(--color-bg-elevated);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

.pm-modal-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.15rem 1.25rem 0;
}

.pm-modal-eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-accent-strong);
}

.pm-modal-title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.pm-modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 0.55rem;
  border: 1px solid var(--color-border);
  background: var(--color-bg-soft);
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
}

.pm-modal-close:hover {
  color: var(--color-text);
  border-color: #52525b;
}

.pm-modal-body {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1rem 1.25rem;
}

.pm-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.85rem 1.25rem 1.15rem;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.15);
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
  font-size: 0.875rem;
  font-family: inherit;
  padding: 0.65rem 0.75rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.pm-input:focus,
.pm-textarea:focus {
  outline: none;
  border-color: rgba(250, 204, 21, 0.45);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}

.pm-textarea {
  resize: vertical;
  min-height: 3.5rem;
  line-height: 1.45;
}

.pm-aspect-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.55rem;
}

.pm-aspect-opt {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.7rem;
  border-radius: 0.75rem;
  border: 1px solid var(--color-border);
  background: var(--color-bg-soft);
  color: var(--color-text-muted);
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: all 0.18s ease;
}

.pm-aspect-opt:hover {
  border-color: #52525b;
  color: var(--color-text);
}

.pm-aspect-opt--on {
  border-color: rgba(250, 204, 21, 0.5);
  background: rgba(250, 204, 21, 0.08);
  color: var(--color-text);
  box-shadow: 0 0 0 1px rgba(250, 204, 21, 0.12);
}

.pm-aspect-visual {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 0.4rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(0, 0, 0, 0.3);
  color: var(--color-text-muted);
}

.pm-aspect-opt--on .pm-aspect-visual {
  color: var(--color-accent-strong);
  border-color: rgba(250, 204, 21, 0.3);
}

.pm-aspect-visual--portrait {
  width: 1.65rem;
  height: 2.85rem;
}

.pm-aspect-visual--landscape {
  width: 2.85rem;
  height: 1.65rem;
}

.pm-aspect-meta {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  flex: 1;
  min-width: 0;
}

.pm-aspect-label {
  font-size: 0.85rem;
  font-weight: 800;
}

.pm-aspect-hint {
  font-size: 0.65rem;
  opacity: 0.8;
}

.pm-aspect-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 50%;
  background: var(--color-accent-soft);
  color: var(--color-accent-strong);
  flex-shrink: 0;
}

.pm-cancel {
  border: 1px solid var(--color-border);
  background: var(--color-bg-soft);
  color: var(--color-text);
  border-radius: 0.65rem;
  padding: 0.6rem 1rem;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
}

.pm-submit {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.6rem 1.1rem;
  border: none;
  border-radius: 0.65rem;
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
  color: var(--color-text-on-accent);
  background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-strong) 100%);
  box-shadow: 0 4px 16px rgba(250, 204, 21, 0.25);
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
}

.pm-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 22px rgba(250, 204, 21, 0.32);
}

.pm-submit:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

@media (max-width: 520px) {
  .pm-aspect-grid {
    grid-template-columns: 1fr;
  }

  .pm-hero-left {
    flex-direction: column;
    gap: 0.75rem;
  }
}
</style>
