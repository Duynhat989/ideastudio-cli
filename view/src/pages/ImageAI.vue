<script setup>
import { ref } from 'vue'
import { Sparkles } from 'lucide-vue-next'

const model = ref('flux-pro')
const aspectRatio = ref('1:1')
const imageCount = ref(4)
const prompt = ref('')
const activeTemplateId = ref('')

const modelOptions = [
  { label: 'Flux Pro', value: 'flux-pro' },
  { label: 'Flux Schnell', value: 'flux-schnell' },
  { label: 'SDXL', value: 'sdxl' },
  { label: 'Ideogram v2', value: 'ideogram-v2' }
]

const ratioOptions = [
  { label: '1:1', value: '1:1' },
  { label: '4:5', value: '4:5' },
  { label: '3:4', value: '3:4' },
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' }
]

const countOptions = [1, 2, 4, 6, 8]

const renderExamples = [
  { id: 'r1', name: 'Fashion Portrait', meta: 'Flux Pro • 4:5' },
  { id: 'r2', name: 'Product Hero Shot', meta: 'Ideogram v2 • 1:1' },
  { id: 'r3', name: 'Neon Street Scene', meta: 'SDXL • 16:9' }
]

const promptTemplates = [
  {
    id: 'portrait-cinematic',
    name: 'Portrait Cinematic',
    prompt: 'portrait photo, cinematic light, shallow depth of field, ultra detailed skin texture'
  },
  {
    id: 'product-studio',
    name: 'Product Studio',
    prompt: 'premium product shot on clean studio background, softbox light, sharp details, 8k'
  },
  {
    id: 'anime-key-visual',
    name: 'Anime Key Visual',
    prompt: 'anime key visual, dynamic pose, dramatic sky, high contrast, detailed line art'
  },
  {
    id: 'architectural-minimal',
    name: 'Architectural Minimal',
    prompt: 'minimal architecture, concrete and glass, natural morning light, editorial photography'
  },
  {
    id: 'food-commercial',
    name: 'Food Commercial',
    prompt: 'commercial food photography, warm light, realistic texture, high detail, ad campaign look'
  }
]

const applyTemplate = (template) => {
  activeTemplateId.value = template.id
  prompt.value = template.prompt
}
</script>

<template>
  <section class="page-wrap">
    <header class="page-header">
      <div class="title-row">
        <Sparkles :size="18" class="title-icon" />
        <h2>Image AI</h2>
      </div>
      <p>Tao anh bang mo ta nhanh, giu phong cach dong nhat va de mo rong workflow.</p>
    </header>

    <section class="template-section" aria-label="Prompt templates">
      <div class="template-head">
        <h3>Mau prompt</h3>
        <span>Bam vao mau de chen prompt san</span>
      </div>
      <div class="template-slider">
        <button
          v-for="item in promptTemplates"
          :key="item.id"
          type="button"
          :class="['template-item', { active: activeTemplateId === item.id }]"
          @click="applyTemplate(item)"
        >
          <strong>{{ item.name }}</strong>
          <small>{{ item.prompt }}</small>
        </button>
      </div>
    </section>

    <div class="content-card">
      <div class="form-layout">
        <div class="controls-grid">
          <div class="panel-title">
            <h3>Thong so tao anh</h3>
            <span>Chon cau hinh cho lan render nay</span>
          </div>

          <div class="field-wrap">
            <label for="model-select">Model</label>
            <select id="model-select" v-model="model">
              <option v-for="item in modelOptions" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select>
          </div>

          <div class="field-wrap">
            <label for="ratio-select">Ty le anh</label>
            <select id="ratio-select" v-model="aspectRatio">
              <option v-for="item in ratioOptions" :key="item.value" :value="item.value">
                {{ item.label }}
              </option>
            </select>
          </div>

          <div class="field-wrap">
            <label for="count-select">So luong anh</label>
            <select id="count-select" v-model.number="imageCount">
              <option v-for="item in countOptions" :key="item" :value="item">
                {{ item }}
              </option>
            </select>
          </div>
        </div>

        <div class="prompt-group">
          <div class="panel-title">
            <h3>Prompt Workspace</h3>
            <span>Nhap mo ta chi tiet de tao ket qua chinh xac hon</span>
          </div>

          <label for="image-prompt">Prompt</label>
          <textarea
            id="image-prompt"
            v-model="prompt"
            rows="8"
            placeholder="Vi du: portrait studio light, cinematic, ultra detailed"
          />

          <div class="prompt-actions">
            <button type="button">Generate Image</button>
          </div>

          <div class="preview-line">
            <span>Model: {{ model }}</span>
            <span>Ty le: {{ aspectRatio }}</span>
            <span>So luong: {{ imageCount }}</span>
          </div>
        </div>
      </div>

      <section class="render-section" aria-label="Render examples">
        <div class="panel-title">
          <h3>Vi du render</h3>
          <span>Mau bo cuc ket qua de tham khao</span>
        </div>

        <div class="render-grid">
          <article v-for="item in renderExamples" :key="item.id" class="render-card">
            <div class="render-thumb" />
            <div class="render-body">
              <strong>{{ item.name }}</strong>
              <small>{{ item.meta }}</small>
            </div>
          </article>
        </div>
      </section>

      <div class="tip-line">
        <span>Tip: Chon mau prompt truoc, sau do tinh chinh prompt theo brand voice.</span>
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
  gap: 18px;
  padding: 22px;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background: var(--color-bg-elevated);
}

.template-section {
  display: grid;
  gap: 10px;
}

.template-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.template-head h3 {
  margin: 0;
  font-size: 16px;
}

.template-head span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.template-slider {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(220px, 300px);
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.template-item {
  display: grid;
  gap: 6px;
  text-align: left;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-elevated);
  color: var(--color-text);
  cursor: pointer;
}

.template-item:hover {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.template-item.active {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.template-item small {
  color: var(--color-text-muted);
  line-height: 1.35;
}

.controls-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-bg-soft);
}

.form-layout {
  display: grid;
  grid-template-columns: minmax(240px, 320px) minmax(0, 1fr);
  gap: 18px;
  align-items: start;
}

.prompt-group {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
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

label {
  font-size: 14px;
  color: var(--color-text-muted);
}

textarea {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 14px;
  color: var(--color-text);
  background: var(--color-bg-elevated);
  resize: vertical;
}

select {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 10px 12px;
  color: var(--color-text);
  background: var(--color-bg-elevated);
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

.prompt-actions {
  display: flex;
  justify-content: flex-end;
}

.render-section {
  display: grid;
  gap: 10px;
}

.render-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.render-card {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--color-bg-soft);
}

.render-thumb {
  height: 110px;
  background: linear-gradient(135deg, var(--color-accent-soft), var(--color-bg-elevated));
  border-bottom: 1px solid var(--color-border);
}

.render-body {
  display: grid;
  gap: 3px;
  padding: 10px;
}

.render-body strong {
  font-size: 13px;
}

.render-body small {
  color: var(--color-text-muted);
  font-size: 12px;
}

.preview-line {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  color: var(--color-text-muted);
  font-size: 13px;
}

.tip-line {
  color: var(--color-text-muted);
  font-size: 12px;
}

@media (max-width: 980px) {
  .form-layout {
    grid-template-columns: 1fr;
  }

  .render-grid {
    grid-template-columns: 1fr;
  }

  .prompt-actions {
    justify-content: flex-start;
  }
}

</style>
