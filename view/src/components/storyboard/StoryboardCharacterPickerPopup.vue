<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, Loader2, Users, Check, Image as ImageIcon } from 'lucide-vue-next'
import { storyboardCharacterService } from '@/services/storyboardCharacter.service.js'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
    maxSelect: { type: Number, default: 4 },
    selectedIds: { type: Array, default: () => [] },
    disabledIds: { type: Array, default: () => [] },
})

const emit = defineEmits(['confirm'])

const { t } = useI18n()

const characters = ref([])
const loading = ref(false)
const pickedIds = ref([])

const loadCharacters = async () => {
    loading.value = true
    try {
        const res = await storyboardCharacterService.list()
        characters.value = (res?.data || []).filter((c) => c.imageUrl)
    } finally {
        loading.value = false
    }
}

watch(open, (v) => {
    if (v) {
        pickedIds.value = [...props.selectedIds]
        loadCharacters()
    }
})

const imageUrl = (char) => storyboardCharacterService.assetUrl(char?.imageUrl)

const isPicked = (id) => pickedIds.value.includes(id)

const isDisabled = (id) => props.disabledIds.includes(id)

const slotsLeft = computed(() => Math.max(0, props.maxSelect - pickedIds.value.length))

const togglePick = (char) => {
    if (isDisabled(char.id)) return
    const idx = pickedIds.value.indexOf(char.id)
    if (idx >= 0) {
        pickedIds.value.splice(idx, 1)
        return
    }
    if (pickedIds.value.length >= props.maxSelect) return
    pickedIds.value.push(char.id)
}

const confirm = () => {
    const selected = characters.value.filter((c) => pickedIds.value.includes(c.id))
    emit('confirm', selected)
    open.value = false
}

onMounted(() => {
    if (open.value) loadCharacters()
})
</script>

<template>
    <Teleport to="body">
        <Transition name="picker-fade">
            <div v-if="open" class="picker-overlay" @click.self="open = false">
                <div class="picker-panel" role="dialog" :aria-label="t('storyboard.characterPickerTitle')">
                    <header class="picker-head">
                        <div>
                            <h3>{{ t('storyboard.characterPickerTitle') }}</h3>
                            <p>{{ t('storyboard.characterPickerHint', { max: maxSelect }) }}</p>
                        </div>
                        <button type="button" class="picker-close" @click="open = false">
                            <X :size="18" />
                        </button>
                    </header>

                    <div v-if="loading" class="picker-state">
                        <Loader2 :size="24" class="spin" />
                    </div>

                    <div v-else-if="!characters.length" class="picker-state">
                        <Users :size="32" />
                        <p>{{ t('storyboard.characterPickerEmpty') }}</p>
                    </div>

                    <div v-else class="picker-grid">
                        <button
                            v-for="char in characters"
                            :key="char.id"
                            type="button"
                            class="picker-item"
                            :class="{
                                'picker-item--picked': isPicked(char.id),
                                'picker-item--disabled': isDisabled(char.id),
                            }"
                            :disabled="isDisabled(char.id) || (!isPicked(char.id) && slotsLeft === 0)"
                            @click="togglePick(char)"
                        >
                            <div class="picker-thumb">
                                <img v-if="char.imageUrl" :src="imageUrl(char)" :alt="char.name" />
                                <ImageIcon v-else :size="24" />
                                <span v-if="isPicked(char.id)" class="picker-check"><Check :size="14" /></span>
                            </div>
                            <strong>{{ char.name || t('storyboard.characterLibraryUntitled') }}</strong>
                            <small v-if="char.description">{{ char.description }}</small>
                        </button>
                    </div>

                    <footer class="picker-foot">
                        <span class="picker-slots">{{ t('storyboard.characterPickerSelected', { n: pickedIds.length, max: maxSelect }) }}</span>
                        <button type="button" class="btn-primary" :disabled="!pickedIds.length" @click="confirm">
                            {{ t('storyboard.characterPickerConfirm') }}
                        </button>
                    </footer>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.picker-overlay {
    position: fixed;
    inset: 0;
    z-index: 1100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(6px);
}

.picker-panel {
    width: min(920px, 100%);
    max-height: min(88vh, 760px);
    display: flex;
    flex-direction: column;
    border-radius: 16px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-elevated);
    overflow: hidden;
}

.picker-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 1rem 1.1rem;
    border-bottom: 1px solid var(--color-border);
}

.picker-head h3 { margin: 0; font-size: 1rem; }
.picker-head p { margin: 4px 0 0; font-size: 0.78rem; color: var(--color-text-muted); }

.picker-close {
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
}

.picker-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 3rem 1rem;
    color: var(--color-text-muted);
}

.picker-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    gap: 12px;
    padding: 1rem;
    overflow-y: auto;
}

.picker-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border: 2px solid var(--color-border);
    border-radius: 12px;
    background: var(--color-bg);
    cursor: pointer;
    text-align: left;
    color: var(--color-text);
}

.picker-item--picked {
    border-color: rgba(99, 102, 241, 0.65);
    background: rgba(99, 102, 241, 0.08);
}

.picker-item--disabled {
    opacity: 0.45;
    cursor: not-allowed;
}

.picker-item:disabled { cursor: not-allowed; opacity: 0.5; }

.picker-thumb {
    position: relative;
    width: 100%;
    aspect-ratio: 9 / 16;
    border-radius: 8px;
    overflow: hidden;
    background: var(--color-bg-soft);
    display: flex;
    align-items: center;
    justify-content: center;
}

.picker-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.picker-check {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 22px;
    height: 22px;
    border-radius: 999px;
    background: #6366f1;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
}

.picker-item strong {
    font-size: 0.78rem;
    line-height: 1.25;
}

.picker-item small {
    font-size: 0.66rem;
    color: var(--color-text-muted);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.picker-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0.85rem 1.1rem;
    border-top: 1px solid var(--color-border);
}

.picker-slots {
    font-size: 0.78rem;
    color: var(--color-text-muted);
}

.btn-primary {
    padding: 8px 14px;
    border-radius: 8px;
    border: none;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    font-weight: 600;
    font-size: 0.82rem;
    cursor: pointer;
}

.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

.picker-fade-enter-active,
.picker-fade-leave-active { transition: opacity 0.2s ease; }
.picker-fade-enter-from,
.picker-fade-leave-to { opacity: 0; }

.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
