<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, Loader2, Image as ImageIcon } from 'lucide-vue-next'
import { storyboardCharacterService } from '@/services/storyboardCharacter.service.js'
import { notify } from '@/composables/useNotify.js'

const open = defineModel('open', { type: Boolean, default: false })

const props = defineProps({
    mode: { type: String, default: 'save' }, // 'save' | 'add'
    initialName: { type: String, default: '' },
    initialDescription: { type: String, default: '' },
    initialRole: { type: String, default: '' },
    initialPrompt: { type: String, default: '' },
    initialStylePreset: { type: String, default: '' },
    imageSource: { type: String, default: '' },
})

const emit = defineEmits(['saved'])

const { t } = useI18n()

const name = ref('')
const description = ref('')
const role = ref('')
const saving = ref(false)
const fileInputRef = ref(null)
const selectedFile = ref(null)
const previewUrl = ref('')

watch(open, (v) => {
    if (!v) return
    name.value = props.initialName || ''
    description.value = props.initialDescription || ''
    role.value = props.initialRole || ''
    selectedFile.value = null
    previewUrl.value = props.mode === 'save' ? props.imageSource : ''
})

watch(() => props.imageSource, (url) => {
    if (open.value && props.mode === 'save') previewUrl.value = url
})

const canSubmit = computed(() => {
    const hasMeta = name.value.trim() && description.value.trim()
    const hasImage = props.mode === 'save'
        ? Boolean(props.imageSource || previewUrl.value)
        : Boolean(selectedFile.value)
    return hasMeta && hasImage && !saving.value
})

const triggerFilePick = () => {
    fileInputRef.value.value = ''
    fileInputRef.value.click()
}

const onFileSelected = (event) => {
    const file = event.target.files?.[0]
    if (!file?.type?.startsWith('image/')) return
    selectedFile.value = file
    previewUrl.value = URL.createObjectURL(file)
}

const submit = async () => {
    if (!canSubmit.value) return
    saving.value = true
    try {
        let res
        if (props.mode === 'add') {
            res = await storyboardCharacterService.createWithUpload(selectedFile.value, {
                name: name.value.trim(),
                description: description.value.trim(),
                role: role.value.trim(),
                prompt: props.initialPrompt,
                stylePreset: props.initialStylePreset,
            })
        } else {
            res = await storyboardCharacterService.saveFromGenerated({
                name: name.value.trim(),
                description: description.value.trim(),
                role: role.value.trim(),
                prompt: props.initialPrompt,
                stylePreset: props.initialStylePreset,
                imageSource: props.imageSource || previewUrl.value,
            })
        }
        if (res?.success) {
            emit('saved', res.data)
            open.value = false
            notify.alert({
                title: t('storyboard.characterSaveSuccessTitle'),
                message: t('storyboard.characterSaveSuccessMessage', { name: name.value.trim() }),
                variant: 'success',
            })
        } else {
            notify.alert({
                title: t('common.notification'),
                message: res?.message || t('storyboard.characterSaveFailed'),
                variant: 'error',
            })
        }
    } finally {
        saving.value = false
    }
}
</script>

<template>
    <Teleport to="body">
        <Transition name="picker-fade">
            <div v-if="open" class="form-overlay" @click.self="open = false">
                <div class="form-panel" role="dialog">
                    <header class="form-head">
                        <h3>{{ mode === 'add' ? t('storyboard.characterAddTitle') : t('storyboard.characterSaveTitle') }}</h3>
                        <button type="button" class="form-close" @click="open = false"><X :size="18" /></button>
                    </header>

                    <div class="form-body">
                        <div class="form-preview">
                            <img v-if="previewUrl" :src="previewUrl" alt="" />
                            <div v-else class="form-preview-empty">
                                <ImageIcon :size="28" />
                            </div>
                            <button
                                v-if="mode === 'add'"
                                type="button"
                                class="btn-soft btn-xs form-pick-btn"
                                @click="triggerFilePick"
                            >
                                {{ t('storyboard.characterAddPickImage') }}
                            </button>
                            <input ref="fileInputRef" type="file" accept="image/*" class="hidden-input" @change="onFileSelected" />
                        </div>

                        <div class="form-fields">
                            <label>
                                {{ t('storyboard.characterSaveName') }} *
                                <input v-model="name" type="text" :placeholder="t('storyboard.characterSaveNamePlaceholder')" />
                            </label>
                            <label>
                                {{ t('storyboard.characterSaveDescription') }} *
                                <textarea
                                    v-model="description"
                                    class="sb-textarea sb-scroll"
                                    rows="4"
                                    :placeholder="t('storyboard.characterSaveDescriptionPlaceholder')"
                                />
                            </label>
                            <label>
                                {{ t('storyboard.characterSaveRole') }}
                                <input v-model="role" type="text" :placeholder="t('storyboard.characterSaveRolePlaceholder')" />
                            </label>
                        </div>
                    </div>

                    <footer class="form-foot">
                        <button type="button" class="btn-muted" @click="open = false">{{ t('common.cancel') }}</button>
                        <button type="button" class="btn-primary" :disabled="!canSubmit" @click="submit">
                            <Loader2 v-if="saving" :size="14" class="spin" />
                            {{ saving ? t('storyboard.characterSaving') : t('storyboard.characterSaveConfirm') }}
                        </button>
                    </footer>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.form-overlay {
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

.form-panel {
    width: min(560px, 100%);
    border-radius: 16px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-elevated);
    overflow: hidden;
}

.form-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.1rem;
    border-bottom: 1px solid var(--color-border);
}

.form-head h3 { margin: 0; font-size: 1rem; }

.form-close {
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
}

.form-body {
    display: grid;
    grid-template-columns: 120px minmax(0, 1fr);
    gap: 14px;
    padding: 1rem 1.1rem;
}

.form-preview {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
}

.form-preview img,
.form-preview-empty {
    width: 100%;
    aspect-ratio: 9 / 16;
    border-radius: 10px;
    object-fit: cover;
    border: 1px solid var(--color-border);
    background: var(--color-bg-soft);
}

.form-preview-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
}

.form-pick-btn { width: 100%; justify-content: center; }

.form-fields {
    display: grid;
    gap: 10px;
}

.form-fields label {
    display: grid;
    gap: 5px;
    font-size: 0.78rem;
    color: var(--color-text-muted);
}

.form-fields input,
.form-fields textarea {
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-soft);
    color: var(--color-text);
    padding: 8px 10px;
    font-family: inherit;
    font-size: 0.84rem;
}

.form-foot {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 0.85rem 1.1rem;
    border-top: 1px solid var(--color-border);
}

.btn-muted,
.btn-primary {
    border-radius: 8px;
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
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: #fff;
    border: none;
    font-weight: 600;
}

.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

.btn-soft {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 8px;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-soft);
    font-size: 0.72rem;
    cursor: pointer;
}

.hidden-input { display: none; }

.picker-fade-enter-active,
.picker-fade-leave-active { transition: opacity 0.2s ease; }
.picker-fade-enter-from,
.picker-fade-leave-to { opacity: 0; }

.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 520px) {
    .form-body { grid-template-columns: 1fr; }
    .form-preview { max-width: 140px; margin: 0 auto; }
}
</style>
