<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, Users, Loader2, Trash2, Plus, Image as ImageIcon, CheckSquare, Square } from 'lucide-vue-next'
import { storyboardCharacterService } from '@/services/storyboardCharacter.service.js'
import { notify } from '@/composables/useNotify.js'
import StoryboardCharacterFormPopup from './StoryboardCharacterFormPopup.vue'

const open = defineModel('open', { type: Boolean, default: false })

const { t } = useI18n()

const characters = ref([])
const loading = ref(false)
const addFormOpen = ref(false)
const deletingId = ref('')
const bulkDeleting = ref(false)
const selectedIds = ref([])

const loadCharacters = async () => {
    loading.value = true
    try {
        const res = await storyboardCharacterService.list()
        characters.value = res?.data || []
        selectedIds.value = selectedIds.value.filter((id) => characters.value.some((c) => c.id === id))
    } finally {
        loading.value = false
    }
}

watch(open, (v) => {
    if (v) {
        selectedIds.value = []
        loadCharacters()
    }
})

const imageUrl = (char) => storyboardCharacterService.assetUrl(char?.imageUrl)
const countLabel = computed(() => t('storyboard.characterLibraryCount', { n: characters.value.length }))
const hasSelection = computed(() => selectedIds.value.length > 0)
const allSelected = computed(() =>
    characters.value.length > 0 && selectedIds.value.length === characters.value.length,
)

const isSelected = (id) => selectedIds.value.includes(id)

const toggleSelect = (id) => {
    const idx = selectedIds.value.indexOf(id)
    if (idx >= 0) selectedIds.value.splice(idx, 1)
    else selectedIds.value.push(id)
}

const toggleSelectAll = () => {
    if (allSelected.value) {
        selectedIds.value = []
        return
    }
    selectedIds.value = characters.value.map((c) => c.id)
}

const deleteCharacters = async (ids) => {
    const uniqueIds = [...new Set(ids.filter(Boolean))]
    if (!uniqueIds.length) return false

    const res = await storyboardCharacterService.deleteMany(uniqueIds)
    const removed = new Set(res.deletedIds || [])
    if (removed.size) {
        characters.value = characters.value.filter((c) => !removed.has(c.id))
        selectedIds.value = selectedIds.value.filter((id) => !removed.has(id))
    }

    if (!removed.size) {
        notify.alert({
            title: t('storyboard.characterLibraryDeleteTitle'),
            message: res?.message || t('storyboard.characterLibraryDeleteFailed'),
            variant: 'error',
        })
        return false
    }

    if (!res.success) {
        notify.alert({
            title: t('storyboard.characterLibraryDeleteTitle'),
            message: res?.message || t('storyboard.characterLibraryDeleteFailed'),
            variant: 'warning',
        })
    }

    return true
}

const removeCharacter = async (char) => {
    if (deletingId.value || bulkDeleting.value) return
    const ok = await notify.confirm({
        title: t('storyboard.characterLibraryDeleteTitle'),
        message: t('storyboard.characterLibraryDeleteMessage', { name: char.name || '?' }),
        confirmText: t('common.delete'),
        cancelText: t('common.cancel'),
        variant: 'warning',
    })
    if (!ok) return

    deletingId.value = char.id
    try {
        const deleted = await deleteCharacters([char.id])
        if (deleted) {
            notify.alert({
                title: t('storyboard.characterLibraryDeleteTitle'),
                message: t('storyboard.characterLibraryDeleteSuccess', { name: char.name || '?' }),
                variant: 'success',
            })
        }
    } finally {
        deletingId.value = ''
    }
}

const removeSelected = async () => {
    if (!hasSelection.value || deletingId.value || bulkDeleting.value) return
    const count = selectedIds.value.length
    const ok = await notify.confirm({
        title: t('storyboard.characterLibraryBulkDeleteTitle'),
        message: t('storyboard.characterLibraryBulkDeleteMessage', { n: count }),
        confirmText: t('common.delete'),
        cancelText: t('common.cancel'),
        variant: 'warning',
    })
    if (!ok) return

    bulkDeleting.value = true
    try {
        const ids = [...selectedIds.value]
        const deleted = await deleteCharacters(ids)
        if (deleted) {
            notify.alert({
                title: t('storyboard.characterLibraryDeleteTitle'),
                message: t('storyboard.characterLibraryBulkDeleteSuccess', { n: count }),
                variant: 'success',
            })
        }
    } finally {
        bulkDeleting.value = false
    }
}

const onCharacterAdded = () => {
    loadCharacters()
}
</script>

<template>
    <Teleport to="body">
        <Transition name="picker-fade">
            <div v-if="open" class="lib-overlay" @click.self="open = false">
                <div class="lib-panel" role="dialog" :aria-label="t('storyboard.characterLibraryTitle')">
                    <header class="lib-head">
                        <div class="lib-title">
                            <Users :size="20" />
                            <div>
                                <h3>{{ t('storyboard.characterLibraryTitle') }}</h3>
                                <p>{{ t('storyboard.characterLibrarySubtitle') }}</p>
                            </div>
                        </div>
                        <div class="lib-head-actions">
                            <span class="lib-count">{{ countLabel }}</span>
                            <button
                                v-if="characters.length"
                                type="button"
                                class="btn-soft"
                                @click="toggleSelectAll"
                            >
                                <CheckSquare v-if="allSelected" :size="14" />
                                <Square v-else :size="14" />
                                {{ allSelected ? t('storyboard.characterLibraryDeselectAll') : t('storyboard.characterLibrarySelectAll') }}
                            </button>
                            <button
                                v-if="hasSelection"
                                type="button"
                                class="btn-danger"
                                :disabled="bulkDeleting"
                                @click="removeSelected"
                            >
                                <Loader2 v-if="bulkDeleting" :size="14" class="spin" />
                                <Trash2 v-else :size="14" />
                                {{ t('storyboard.characterLibraryDeleteSelected', { n: selectedIds.length }) }}
                            </button>
                            <button type="button" class="btn-soft" @click="addFormOpen = true">
                                <Plus :size="14" />
                                {{ t('storyboard.characterLibraryAdd') }}
                            </button>
                            <button type="button" class="lib-close" @click="open = false"><X :size="18" /></button>
                        </div>
                    </header>

                    <div v-if="loading" class="lib-state">
                        <Loader2 :size="24" class="spin" />
                    </div>

                    <div v-else-if="!characters.length" class="lib-state">
                        <ImageIcon :size="36" />
                        <p>{{ t('storyboard.characterLibraryEmpty') }}</p>
                        <button type="button" class="btn-primary" @click="addFormOpen = true">
                            <Plus :size="14" />
                            {{ t('storyboard.characterLibraryAdd') }}
                        </button>
                    </div>

                    <div v-else class="lib-grid">
                        <article
                            v-for="char in characters"
                            :key="char.id"
                            class="lib-card"
                            :class="{ 'lib-card--selected': isSelected(char.id) }"
                        >
                            <label class="lib-select">
                                <input
                                    type="checkbox"
                                    :checked="isSelected(char.id)"
                                    @change="toggleSelect(char.id)"
                                />
                            </label>
                            <div class="lib-thumb">
                                <img v-if="char.imageUrl" :src="imageUrl(char)" :alt="char.name" />
                                <ImageIcon v-else :size="24" />
                            </div>
                            <div class="lib-info">
                                <strong>{{ char.name || t('storyboard.characterLibraryUntitled') }}</strong>
                                <p v-if="char.description">{{ char.description }}</p>
                                <span v-if="char.role" class="lib-role">{{ char.role }}</span>
                            </div>
                            <button
                                type="button"
                                class="lib-delete"
                                :title="t('common.delete')"
                                :disabled="deletingId === char.id || bulkDeleting"
                                @click.stop="removeCharacter(char)"
                            >
                                <Loader2 v-if="deletingId === char.id" :size="14" class="spin" />
                                <Trash2 v-else :size="14" />
                                <span>{{ t('common.delete') }}</span>
                            </button>
                        </article>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>

    <StoryboardCharacterFormPopup
        v-model:open="addFormOpen"
        mode="add"
        @saved="onCharacterAdded"
    />
</template>

<style scoped>
.lib-overlay {
    position: fixed;
    inset: 0;
    z-index: 1050;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(6px);
}

.lib-panel {
    width: min(920px, 100%);
    max-height: min(88vh, 760px);
    display: flex;
    flex-direction: column;
    border-radius: 16px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-elevated);
    overflow: hidden;
}

.lib-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 1rem 1.1rem;
    border-bottom: 1px solid var(--color-border);
    flex-wrap: wrap;
}

.lib-title {
    display: flex;
    gap: 10px;
    align-items: flex-start;
}

.lib-title h3 { margin: 0; font-size: 1rem; }
.lib-title p { margin: 4px 0 0; font-size: 0.78rem; color: var(--color-text-muted); }

.lib-head-actions {
    display: flex;
    align-items: center;
    gap: 8px;
}

.lib-count {
    font-size: 0.74rem;
    color: var(--color-text-muted);
}

.lib-close {
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
}

.lib-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 3rem 1rem;
    color: var(--color-text-muted);
    font-size: 0.84rem;
}

.lib-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
    padding: 1rem;
    overflow-y: auto;
}

.lib-card {
    display: grid;
    grid-template-columns: auto 72px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: start;
    padding: 10px;
    border: 1px solid var(--color-border);
    border-radius: 12px;
    background: var(--color-bg);
}

.lib-card--selected {
    border-color: rgba(99, 102, 241, 0.45);
    background: rgba(99, 102, 241, 0.06);
}

.lib-select {
    display: flex;
    align-items: flex-start;
    padding-top: 4px;
    cursor: pointer;
}

.lib-select input {
    width: 16px;
    height: 16px;
    accent-color: #6366f1;
    cursor: pointer;
}

.lib-thumb {
    width: 72px;
    aspect-ratio: 9 / 16;
    border-radius: 8px;
    overflow: hidden;
    background: var(--color-bg-soft);
    border: 1px solid var(--color-border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
}

.lib-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.lib-info strong {
    display: block;
    font-size: 0.84rem;
}

.lib-info p {
    margin: 4px 0 0;
    font-size: 0.72rem;
    color: var(--color-text-muted);
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.lib-role {
    display: inline-block;
    margin-top: 6px;
    font-size: 0.65rem;
    font-weight: 600;
    color: #a5b4fc;
    background: rgba(99, 102, 241, 0.12);
    padding: 2px 7px;
    border-radius: 999px;
}

.lib-delete {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 1px solid rgba(248, 113, 113, 0.35);
    background: rgba(248, 113, 113, 0.08);
    color: #fca5a5;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 0.72rem;
    font-weight: 600;
    white-space: nowrap;
}

.lib-delete:hover:not(:disabled) {
    color: #fecaca;
    background: rgba(248, 113, 113, 0.16);
    border-color: rgba(248, 113, 113, 0.55);
}

.lib-delete:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.btn-danger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 8px;
    border: 1px solid rgba(248, 113, 113, 0.45);
    background: rgba(248, 113, 113, 0.12);
    color: #fca5a5;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
}

.btn-danger:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.btn-soft {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-soft);
    color: var(--color-text);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
}

.btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    border: none;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    font-weight: 600;
    font-size: 0.82rem;
    cursor: pointer;
}

.picker-fade-enter-active,
.picker-fade-leave-active { transition: opacity 0.2s ease; }
.picker-fade-enter-from,
.picker-fade-leave-to { opacity: 0; }

.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
