<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
    Clapperboard,
    Plus,
    Trash2,
    Edit2,
    Check,
    X,
    Search,
    Loader2,
    Clock,
    FolderOpen,
    Users,
} from 'lucide-vue-next'
import { storyboardService } from '@/services/storyboard.service.js'
import { notify } from '@/composables/useNotify.js'
import StoryboardCharacterLibraryPopup from './StoryboardCharacterLibraryPopup.vue'

const props = defineProps({
    currentProjectId: { type: String, default: '' },
})

const emit = defineEmits(['load', 'create'])

const { t } = useI18n()

const projects = ref([])
const loading = ref(false)
const search = ref('')
const sortBy = ref('updated')
const createModalOpen = ref(false)
const newProjectName = ref('')
const newProjectDescription = ref('')
const editingId = ref('')
const editingName = ref('')
const libraryOpen = ref(false)

const loadProjects = async () => {
    loading.value = true
    try {
        const response = await storyboardService.list()
        projects.value = response?.data || []
    } finally {
        loading.value = false
    }
}

const filteredProjects = computed(() => {
    const keyword = search.value.trim().toLowerCase()
    const list = projects.value.filter((p) => {
        if (!keyword) return true
        const name = (p.name || '').toLowerCase()
        const desc = (p.description || '').toLowerCase()
        return name.includes(keyword) || desc.includes(keyword)
    })
    if (sortBy.value === 'name') {
        return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }
    return [...list].sort(
        (a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0),
    )
})

const projectCountLabel = computed(() => {
    const n = filteredProjects.value.length
    return n === 0 ? t('storyboard.projectNone') : t('storyboard.projectCount', { n })
})

const openCreateModal = () => {
    newProjectName.value = ''
    newProjectDescription.value = ''
    createModalOpen.value = true
}

const createProject = async () => {
    const name = newProjectName.value.trim()
    if (!name) return
    const response = await storyboardService.create({
        name,
        description: newProjectDescription.value.trim(),
    })
    if (!response?.success) return
    createModalOpen.value = false
    await loadProjects()
    emit('create', response.data.id)
}

const startRename = (project) => {
    editingId.value = project.id
    editingName.value = project.name || ''
}

const cancelRename = () => {
    editingId.value = ''
    editingName.value = ''
}

const saveRename = async (id) => {
    const name = editingName.value.trim()
    if (!name) return
    const response = await storyboardService.update(id, { name })
    if (response?.success) await loadProjects()
    cancelRename()
}

const removeProject = async (id) => {
    const ok = await notify.confirm({
        title: t('storyboard.deleteTitle'),
        message: t('storyboard.deleteMessage'),
        confirmText: t('common.delete'),
        cancelText: t('common.cancel'),
        variant: 'warning',
    })
    if (!ok) return
    await storyboardService.delete(id)
    await loadProjects()
}

const sceneCount = (project) => (project.scenes || []).length

const projectSummary = (project) => {
    const text = project.description?.trim() || project.outline?.summary?.trim() || ''
    return text
}

const formatProjectDate = (project) => {
    const d = new Date(project.updatedAt || project.createdAt || 0)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

onMounted(loadProjects)
</script>

<template>
    <section class="sb-manager">
        <header class="sb-hero">
            <div class="sb-hero-left">
                <div class="sb-hero-icon"><Clapperboard :size="22" /></div>
                <div>
                    <p class="sb-eyebrow">StoryBoard</p>
                    <h2>{{ t('storyboard.managerTitle') }}</h2>
                    <p class="sb-sub">{{ t('storyboard.managerSubtitle') }}</p>
                </div>
            </div>
            <div class="sb-stat">
                <FolderOpen :size="16" />
                <span>{{ projectCountLabel }}</span>
            </div>
        </header>

        <div class="sb-toolbar">
            <div class="sb-search">
                <Search :size="16" />
                <input v-model="search" type="search" :placeholder="t('storyboard.searchPlaceholder')" />
            </div>
            <select v-model="sortBy" class="sb-select">
                <option value="updated">{{ t('storyboard.sortUpdated') }}</option>
                <option value="name">{{ t('storyboard.sortName') }}</option>
            </select>
            <button type="button" class="sb-library-btn" @click="libraryOpen = true">
                <Users :size="16" />
                {{ t('storyboard.characterLibraryTitle') }}
            </button>
            <button type="button" class="sb-create-btn" @click="openCreateModal">
                <Plus :size="16" />
                {{ t('storyboard.createProject') }}
            </button>
        </div>

        <div v-if="loading" class="sb-state">
            <Loader2 :size="28" class="spin" />
            <p>{{ t('storyboard.loading') }}</p>
        </div>

        <div v-else-if="filteredProjects.length === 0" class="sb-state">
            <Clapperboard :size="40" class="sb-empty-icon" />
            <h3>{{ t('storyboard.emptyTitle') }}</h3>
            <p>{{ t('storyboard.emptyText') }}</p>
            <button type="button" class="sb-create-btn" @click="openCreateModal">
                <Plus :size="16" />
                {{ t('storyboard.createNew') }}
            </button>
        </div>

        <div v-else class="sb-grid">
            <article
                v-for="project in filteredProjects"
                :key="project.id"
                class="sb-card"
                :class="{ 'sb-card--active': currentProjectId === project.id }"
            >
                <div class="sb-card-accent" aria-hidden="true" />

                <header class="sb-card-head">
                    <div class="sb-card-brand">
                        <span class="sb-card-icon"><Clapperboard :size="16" /></span>
                        <span class="sb-tag">StoryBoard</span>
                        <span v-if="currentProjectId === project.id" class="sb-badge-open">{{ t('storyboard.projectOpen') }}</span>
                    </div>
                    <div class="sb-card-actions">
                        <button
                            type="button"
                            class="sb-action-btn"
                            :title="t('storyboard.rename')"
                            @click.stop="startRename(project)"
                        >
                            <Edit2 :size="14" />
                        </button>
                        <button
                            type="button"
                            class="sb-action-btn sb-action-btn--danger"
                            :title="t('common.delete')"
                            @click.stop="removeProject(project.id)"
                        >
                            <Trash2 :size="14" />
                        </button>
                    </div>
                </header>

                <button type="button" class="sb-card-body" @click="emit('load', project.id)">
                    <template v-if="editingId === project.id">
                        <div class="sb-rename" @click.stop>
                            <input
                                v-model="editingName"
                                @keyup.enter="saveRename(project.id)"
                                @keyup.esc="cancelRename"
                            />
                            <button type="button" class="sb-rename-btn" @click="saveRename(project.id)">
                                <Check :size="14" />
                            </button>
                            <button type="button" class="sb-rename-btn" @click="cancelRename">
                                <X :size="14" />
                            </button>
                        </div>
                    </template>
                    <template v-else>
                        <h3 class="sb-card-title">{{ project.name }}</h3>
                        <p v-if="projectSummary(project)" class="sb-card-desc">{{ projectSummary(project) }}</p>
                        <p v-else class="sb-card-desc sb-card-desc--empty">{{ t('storyboard.projectNoDescription') }}</p>
                    </template>
                </button>

                <footer class="sb-card-foot">
                    <span class="sb-chip">
                        <Clock :size="12" />
                        {{ formatProjectDate(project) }}
                    </span>
                    <span class="sb-chip sb-chip--scenes">
                        {{ sceneCount(project) }} {{ t('storyboard.scenes') }}
                    </span>
                </footer>
            </article>
        </div>

        <StoryboardCharacterLibraryPopup v-model:open="libraryOpen" />

        <Teleport to="body">
            <div v-if="createModalOpen" class="sb-modal-overlay" @click.self="createModalOpen = false">
                <div class="sb-modal" @click.stop>
                    <h3>{{ t('storyboard.createProject') }}</h3>
                    <label>
                        {{ t('storyboard.projectName') }}
                        <input v-model="newProjectName" type="text" :placeholder="t('storyboard.projectNamePlaceholder')" />
                    </label>
                    <label>
                        {{ t('storyboard.projectDescription') }}
                        <textarea v-model="newProjectDescription" class="sb-textarea sb-scroll" rows="3" :placeholder="t('storyboard.projectDescPlaceholder')" />
                    </label>
                    <div class="sb-modal-actions">
                        <button type="button" class="btn-muted" @click="createModalOpen = false">{{ t('common.cancel') }}</button>
                        <button type="button" class="btn-primary" :disabled="!newProjectName.trim()" @click="createProject">
                            {{ t('storyboard.createNew') }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </section>
</template>

<style scoped>
.sb-manager {
    padding: 14px 16px 24px;
    color: var(--color-text);
    min-height: 100%;
}

.sb-hero {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 14px;
}

.sb-hero-left {
    display: flex;
    gap: 10px;
}

.sb-hero-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    border: 1px solid var(--color-border);
    background: var(--color-accent-soft);
    color: var(--color-accent);
    display: flex;
    align-items: center;
    justify-content: center;
}

.sb-eyebrow {
    margin: 0;
    font-size: 0.72rem;
    color: var(--color-accent);
    text-transform: uppercase;
    letter-spacing: 0.06em;
}

.sb-hero h2 {
    margin: 2px 0 0;
    font-size: 1.2rem;
}

.sb-sub {
    margin: 4px 0 0;
    color: var(--color-text-muted);
    font-size: 0.84rem;
}

.sb-stat {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-elevated);
    font-size: 0.82rem;
}

.sb-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
}

.sb-search {
    flex: 1;
    min-width: 200px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-elevated);
}

.sb-search input {
    flex: 1;
    border: none;
    background: transparent;
    color: var(--color-text);
    font-size: 0.84rem;
    outline: none;
}

.sb-select {
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-bg-elevated);
    color: var(--color-text);
    padding: 8px 10px;
    font-size: 0.82rem;
}

.sb-create-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--color-accent-strong);
    border-radius: 10px;
    padding: 8px 14px;
    background: var(--color-accent);
    color: var(--color-text-on-accent);
    font-weight: 600;
    font-size: 0.84rem;
    cursor: pointer;
}

.sb-library-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 8px 14px;
    background: var(--color-bg-elevated);
    color: var(--color-text);
    font-weight: 600;
    font-size: 0.84rem;
    cursor: pointer;
}

.sb-library-btn:hover {
    border-color: rgba(99, 102, 241, 0.45);
    color: #a5b4fc;
}

.sb-state {
    min-height: 280px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--color-text-muted);
    text-align: center;
}

.sb-empty-icon { color: #3f3f46; }

.sb-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 14px;
}

.sb-card {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 196px;
    border: 1px solid var(--color-border);
    border-radius: 16px;
    background: var(--color-bg-elevated);
    overflow: hidden;
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
}

.sb-card:hover {
    border-color: rgba(234, 179, 8, 0.35);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
    transform: translateY(-1px);
}

.sb-card--active {
    border-color: rgba(234, 179, 8, 0.55);
    box-shadow: 0 0 0 1px rgba(234, 179, 8, 0.18), 0 12px 32px rgba(234, 179, 8, 0.08);
}

.sb-card-accent {
    height: 3px;
    background: linear-gradient(90deg, rgba(234, 179, 8, 0.15), var(--color-accent), rgba(234, 179, 8, 0.15));
}

.sb-card--active .sb-card-accent {
    background: linear-gradient(90deg, #ca8a04, #facc15, #ca8a04);
}

.sb-card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 12px 14px 0;
}

.sb-card-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.sb-card-icon {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: 1px solid rgba(234, 179, 8, 0.25);
    background: var(--color-accent-soft);
    color: var(--color-accent);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.sb-tag {
    font-size: 0.66rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid rgba(234, 179, 8, 0.28);
    background: rgba(234, 179, 8, 0.08);
    color: var(--color-accent);
}

.sb-badge-open {
    font-size: 0.62rem;
    font-weight: 700;
    padding: 3px 7px;
    border-radius: 999px;
    background: rgba(234, 179, 8, 0.16);
    color: #facc15;
    border: 1px solid rgba(250, 204, 21, 0.35);
}

.sb-card-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}

.sb-action-btn {
    width: 30px;
    height: 30px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-soft);
    color: var(--color-text-muted);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.sb-action-btn:hover {
    color: var(--color-text);
    border-color: rgba(255, 255, 255, 0.12);
    background: var(--color-bg);
}

.sb-action-btn--danger:hover {
    border-color: rgba(239, 68, 68, 0.45);
    color: #fca5a5;
    background: rgba(239, 68, 68, 0.08);
}

.sb-card-body {
    flex: 1;
    width: 100%;
    border: none;
    background: transparent;
    text-align: left;
    padding: 10px 14px 12px;
    color: inherit;
    cursor: pointer;
    display: block;
}

.sb-card-title {
    margin: 0 0 8px;
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: -0.01em;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.sb-card-desc {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    line-height: 1.55;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.sb-card-desc--empty {
    font-style: italic;
    opacity: 0.65;
}

.sb-card-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 0 14px 14px;
    margin-top: auto;
}

.sb-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 9px;
    border-radius: 999px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-soft);
    font-size: 0.7rem;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
}

.sb-chip--scenes {
    margin-left: auto;
    font-weight: 600;
    color: var(--color-text);
    border-color: rgba(234, 179, 8, 0.22);
    background: rgba(234, 179, 8, 0.06);
}

.sb-rename {
    display: flex;
    gap: 6px;
    align-items: center;
}

.sb-rename input {
    flex: 1;
    min-width: 0;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-soft);
    color: var(--color-text);
    padding: 8px 10px;
    font-size: 0.84rem;
}

.sb-rename-btn {
    width: 32px;
    height: 32px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-soft);
    color: var(--color-text-muted);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.sb-rename-btn:hover {
    color: var(--color-text);
}

.sb-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 10050;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(6px);
}

.sb-modal {
    width: 100%;
    max-width: 420px;
    padding: 20px;
    border-radius: 14px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-elevated);
    display: grid;
    gap: 12px;
}

.sb-modal h3 { margin: 0; }

.sb-modal label {
    display: grid;
    gap: 6px;
    font-size: 0.8rem;
    color: var(--color-text-muted);
}

.sb-modal input {
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-bg-soft);
    color: var(--color-text);
    padding: 8px 10px;
    font-family: inherit;
    font-size: 0.84rem;
}

.sb-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
}

.btn-muted,
.btn-primary {
    border-radius: 10px;
    padding: 8px 14px;
    font-size: 0.82rem;
    cursor: pointer;
    border: 1px solid var(--color-border);
}

.btn-muted {
    background: var(--color-bg-soft);
    color: var(--color-text);
}

.btn-primary {
    background: var(--color-accent);
    color: var(--color-text-on-accent);
    border-color: var(--color-accent-strong);
    font-weight: 600;
}

.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
