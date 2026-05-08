<script setup>
import { computed, ref, watch } from 'vue'
import { Clapperboard, Film, FolderKanban, Ratio } from 'lucide-vue-next'

const model = ref('veo-3')
const videoType = ref('text-to-video')
const imageMode = ref('frame')
const ratio = ref('landscape')
const prompt = ref('')
const imageFiles = ref([{ id: 1, fileName: '' }])
const nextImageId = ref(2)

const modelOptions = [
  { label: 'Veo 3', value: 'veo-3' },
  { label: 'Veo 3 Slower', value: 'veo-3-slower' }
]

const typeOptions = [
  { label: 'Text to Video', value: 'text-to-video' },
  { label: 'Image to Video', value: 'image-to-video' }
]

const imageModeOptions = [
  { label: 'Frame', value: 'frame' },
  { label: 'Ingredient', value: 'ingredient' }
]

const ratioOptions = [
  { label: 'Video ngang', value: 'landscape' },
  { label: 'Video doc', value: 'portrait' }
]

const shouldShowImageConfig = computed(() => videoType.value === 'image-to-video')

const maxImages = computed(() => {
  if (!shouldShowImageConfig.value) {
    return 0
  }

  if (imageMode.value === 'frame') {
    return 2
  }

  return null
})

const imageRuleText = computed(() => {
  if (!shouldShowImageConfig.value) {
    return 'Text to Video khong can anh dau vao.'
  }

  if (imageMode.value === 'frame') {
    return 'Kieu Frame cho phep toi da 2 anh (Bat dau va Ket thuc).'
  }

  return 'Kieu Ingredient cho phep them linh hoat, nhap bao nhieu ghi nhan bay nhieu.'
})

const imageSlots = computed(() => {
  if (!shouldShowImageConfig.value) {
    return []
  }

  return imageFiles.value.map((_, index) => index)
})

const imageSlotLabels = computed(() => {
  if (!shouldShowImageConfig.value) {
    return []
  }

  if (imageMode.value === 'frame') {
    if (imageFiles.value.length === 1) {
      return ['Bat dau']
    }

    return ['Bat dau', 'Ket thuc']
  }

  return imageSlots.value.map((index) => `Ingredient ${index + 1}`)
})

const canAddMoreImages = computed(() => {
  if (!shouldShowImageConfig.value) {
    return false
  }

  if (maxImages.value === null) {
    return true
  }

  return imageFiles.value.length < maxImages.value
})

const syncImageInputs = () => {
  if (!shouldShowImageConfig.value) {
    imageFiles.value = []
    return
  }

  if (!imageFiles.value.length) {
    imageFiles.value = [{ id: nextImageId.value++, fileName: '' }]
  }

  if (maxImages.value !== null && imageFiles.value.length > maxImages.value) {
    imageFiles.value = imageFiles.value.slice(0, maxImages.value)
  }
}

const onSelectImage = (index, event) => {
  const file = event.target.files?.[0]

  if (!file) {
    imageFiles.value[index].fileName = ''
    return
  }

  imageFiles.value[index].fileName = file.name
}

const addImageInput = () => {
  if (!canAddMoreImages.value) {
    return
  }

  imageFiles.value.push({ id: nextImageId.value++, fileName: '' })
}

const removeImageInput = (index) => {
  imageFiles.value.splice(index, 1)

  if (!imageFiles.value.length && shouldShowImageConfig.value) {
    imageFiles.value.push({ id: nextImageId.value++, fileName: '' })
  }
}

const onChangeVideoType = () => {
  syncImageInputs()
}

const onChangeImageMode = () => {
  syncImageInputs()
}

watch([videoType, imageMode], () => {
  syncImageInputs()
})

syncImageInputs()
</script>

<template>
  <section class="page-wrap">
    <header class="page-header">
      <div class="title-row">
        <Clapperboard :size="18" class="title-icon" />
        <h2>Video AI</h2>
      </div>
      <p>Tao video tu text hoac image theo cac rule input ro rang cho workflow production.</p>
    </header>

    <div class="content-card">
      <div class="form-layout">
        <div class="controls-panel">
          <div class="panel-title">
            <h3>Cau hinh tao video</h3>
            <span>Chon model, kieu tao video va ty le khung hinh</span>
          </div>

          <div class="field-wrap">
            <label for="video-model">Model</label>
            <select id="video-model" v-model="model">
              <option v-for="item in modelOptions" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select>
          </div>

          <div class="field-wrap">
            <label for="video-type">Kieu tao video</label>
            <select id="video-type" v-model="videoType" @change="onChangeVideoType">
              <option v-for="item in typeOptions" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select>
          </div>

          <div class="field-wrap">
            <label for="video-ratio">Ty le video</label>
            <select id="video-ratio" v-model="ratio">
              <option v-for="item in ratioOptions" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select>
          </div>

          <template v-if="shouldShowImageConfig">
            <div class="field-wrap">
              <label for="image-mode">Kieu image input</label>
              <select id="image-mode" v-model="imageMode" @change="onChangeImageMode">
                <option v-for="item in imageModeOptions" :key="item.value" :value="item.value">
                  {{ item.label }}
                </option>
              </select>
            </div>
          </template>

          <div class="rule-note">
            {{ imageRuleText }}
          </div>
        </div>

        <div class="prompt-panel">
          <div class="panel-title">
            <h3>Text to Video Prompt</h3>
            <span>Mo ta canh quay, camera motion, style va nhip do khung hinh</span>
          </div>

          <template v-if="shouldShowImageConfig">
            <div v-if="imageMode === 'frame'" class="frame-flow">
              <div v-for="(index, order) in imageSlots" :key="imageFiles[index].id" class="frame-step-wrap">
                <div class="image-input-card frame-card">
                  <label :for="`video-image-${imageFiles[index].id}`" class="slot-title">{{ imageSlotLabels[order] }}</label>
                  <input
                    :id="`video-image-${imageFiles[index].id}`"
                    class="file-input is-hidden"
                    type="file"
                    accept="image/*"
                    @change="onSelectImage(index, $event)"
                  />
                  <label class="pick-file-btn" :for="`video-image-${imageFiles[index].id}`">Chon anh</label>
                  <small class="file-name" :class="{ empty: !imageFiles[index].fileName }">
                    {{ imageFiles[index].fileName || 'Chua chon tep' }}
                  </small>
                </div>
                <span v-if="order < imageSlots.length - 1" class="flow-arrow" aria-hidden="true">→</span>
              </div>
            </div>

            <div v-else class="image-input-grid">
              <div v-for="(index, order) in imageSlots" :key="imageFiles[index].id" class="image-input-card ingredient-card">
                <div class="ingredient-head">
                  <label :for="`video-image-${imageFiles[index].id}`" class="slot-title">{{ imageSlotLabels[order] }}</label>
                  <button
                    v-if="imageFiles.length > 1"
                    type="button"
                    class="remove-btn"
                    @click="removeImageInput(index)"
                  >
                    Xoa
                  </button>
                </div>
                <input
                  :id="`video-image-${imageFiles[index].id}`"
                  class="file-input is-hidden"
                  type="file"
                  accept="image/*"
                  @change="onSelectImage(index, $event)"
                />
                <label class="pick-file-btn" :for="`video-image-${imageFiles[index].id}`">Chon anh</label>
                <small class="file-name" :class="{ empty: !imageFiles[index].fileName }">
                  {{ imageFiles[index].fileName || 'Chua chon tep' }}
                </small>
              </div>
            </div>

            <button v-if="canAddMoreImages" type="button" class="add-image-btn" @click="addImageInput">
              Them anh
            </button>
          </template>

          <label for="video-prompt">Prompt</label>
          <textarea
            id="video-prompt"
            v-model="prompt"
            rows="9"
            placeholder="Vi du: slow dolly in, cyberpunk city at night, rain, cinematic lighting, high detail"
          />

          <div class="prompt-actions">
            <button type="button">Generate Video</button>
          </div>

          <div class="summary-row">
            <span><Film :size="14" /> {{ model }}</span>
            <span><FolderKanban :size="14" /> {{ videoType }}</span>
            <span><Ratio :size="14" /> {{ ratio }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.page-wrap {
  display: grid;
  gap: 18px;
}

.page-header h2 {
  margin: 0;
  font-size: 30px;
}

.page-header p {
  margin: 8px 0 0;
  color: var(--color-text-muted);
}

.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-icon {
  color: var(--color-accent);
}

.content-card {
  display: grid;
  gap: 16px;
  padding: 22px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--color-bg-elevated);
}

.form-layout {
  display: grid;
  grid-template-columns: minmax(260px, 360px) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.controls-panel,
.prompt-panel {
  display: grid;
  gap: 12px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 14px;
  background: var(--color-bg-soft);
}

.panel-title {
  display: grid;
  gap: 4px;
}

.panel-title h3 {
  margin: 0;
  font-size: 15px;
}

.panel-title span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.field-wrap {
  display: grid;
  gap: 8px;
}

.image-input-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.image-input-card {
  display: grid;
  gap: 8px;
  border: 1px dashed var(--color-border);
  border-radius: 10px;
  padding: 10px;
  background: var(--color-bg-elevated);
}

.slot-title {
  font-weight: 600;
}

.frame-flow {
  display: flex;
  align-items: center;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.frame-step-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.frame-card {
  min-width: 170px;
  border-radius: 14px;
}

.ingredient-card {
  min-width: 0;
}

.ingredient-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.flow-arrow {
  color: var(--color-text-muted);
  font-size: 18px;
}

.file-input {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 8px;
  color: var(--color-text-muted);
  background: var(--color-bg-soft);
}

.file-input.is-hidden {
  display: none;
}

.pick-file-btn {
  width: fit-content;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 7px 12px;
  color: var(--color-text);
  background: var(--color-bg-soft);
  cursor: pointer;
}

.file-name {
  color: var(--color-text);
  font-size: 12px;
}

.file-name.empty {
  color: var(--color-text-muted);
}

label {
  font-size: 14px;
  color: var(--color-text-muted);
}

select,
textarea {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 10px 12px;
  color: var(--color-text);
  background: var(--color-bg-elevated);
}

textarea {
  resize: vertical;
}

.rule-note {
  border: 1px dashed var(--color-border);
  border-radius: 10px;
  padding: 10px;
  color: var(--color-text-muted);
  font-size: 13px;
  background: var(--color-bg-elevated);
}

.prompt-actions {
  display: flex;
  justify-content: flex-end;
}

button {
  width: fit-content;
  border: 1px solid var(--color-accent-strong);
  border-radius: 10px;
  padding: 11px 16px;
  color: var(--color-text-on-accent);
  background: var(--color-accent);
  cursor: pointer;
}

.remove-btn {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 5px 10px;
  color: var(--color-text-muted);
  background: var(--color-bg-soft);
}

.add-image-btn {
  border: 1px dashed var(--color-accent-strong);
  border-radius: 10px;
  padding: 9px 12px;
  color: var(--color-accent);
  background: var(--color-accent-soft);
}

.summary-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.summary-row span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 980px) {
  .form-layout {
    grid-template-columns: 1fr;
  }

  .prompt-actions {
    justify-content: flex-start;
  }

  .image-input-grid {
    grid-template-columns: 1fr;
  }
}
</style>
