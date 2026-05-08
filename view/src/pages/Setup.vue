<script setup>
import { onMounted, ref } from 'vue'
import { Eye, EyeOff, Settings } from 'lucide-vue-next'
import { notify } from '@/composables/useNotify.js'

const geminiApiKey = ref('')
const geminiModel = ref('gemini-3-flash-preview')
const nanoApiKey = ref('')
const showGeminiApiKey = ref(false)
const showNanoApiKey = ref(false)
const geminiModelOptions = [
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
]

const STORAGE_KEY = 'ideastudio.setup'
const NANO_SETTINGS_KEY = 'nano_settings'

const veoAccounts = ref([
  {
    id: 1,
    name: '',
    token: '',
    cookie: ''
  }
])

const addVeoAccount = () => {
  const nextId = veoAccounts.value.length
    ? Math.max(...veoAccounts.value.map((item) => item.id)) + 1
    : 1

  veoAccounts.value.push({
    id: nextId,
    name: '',
    token: '',
    cookie: ''
  })
}

const removeVeoAccount = (id) => {
  veoAccounts.value = veoAccounts.value.filter((item) => item.id !== id)

  if (!veoAccounts.value.length) {
    addVeoAccount()
  }
}

const saveConfiguration = async () => {
  const payload = {
    gemini: {
      apiKey: geminiApiKey.value,
      model: geminiModel.value
    },
    veoAccounts: veoAccounts.value,
    nano: {
      apiKey: nanoApiKey.value
    },
    updatedAt: new Date().toISOString()
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  const nanoSettings = localStorage.getItem(NANO_SETTINGS_KEY)
  const parsedNanoSettings = nanoSettings ? JSON.parse(nanoSettings) : {}
  localStorage.setItem(NANO_SETTINGS_KEY, JSON.stringify({
    ...parsedNanoSettings,
    nanoToken: nanoApiKey.value,
    imageAccessToken: veoAccounts.value?.[0]?.token || '',
    videoAccessToken: veoAccounts.value?.[0]?.token || '',
    videoCookie: veoAccounts.value?.[0]?.cookie || '',
    geminiApiKey: geminiApiKey.value,
    geminiModel: geminiModel.value
  }))
  await notify.alert({
    title: 'Đã lưu cấu hình',
    message: 'Cấu hình đã được ghi vào trình duyệt (localStorage).',
    variant: 'success',
  })
}

onMounted(() => {
  const savedRaw = localStorage.getItem(STORAGE_KEY)

  if (!savedRaw) {
    return
  }

  try {
    const saved = JSON.parse(savedRaw)

    geminiApiKey.value = saved?.gemini?.apiKey || ''
    geminiModel.value = saved?.gemini?.model || 'gemini-3-flash-preview'
    nanoApiKey.value = saved?.nano?.apiKey || ''

    if (Array.isArray(saved?.veoAccounts) && saved.veoAccounts.length) {
      veoAccounts.value = saved.veoAccounts.map((item, index) => ({
        id: Number(item?.id) || index + 1,
        name: item?.name || '',
        token: item?.token || '',
        cookie: item?.cookie || ''
      }))
    }
  } catch (error) {
    console.error('Khong the doc cau hinh localStorage', error)
  }
})
</script>

<template>
  <section class="page-wrap">
    <header class="page-header">
      <div class="title-row">
        <Settings :size="18" class="title-icon" />
        <h2>Setup</h2>
      </div>
      <p>Quan ly cau hinh he thong va thong tin ket noi cho cac module AI.</p>
    </header>

    <form class="setup-form" @submit.prevent>
      <section class="setup-section">
        <h3>Thiet lap Gemini SDK</h3>
        <p class="section-note">Cau hinh thong tin ket noi Gemini cho cac tinh nang tao noi dung.</p>

        <label for="gemini-api-key">Gemini API Key</label>
        <div class="secret-input-wrap">
          <input
            id="gemini-api-key"
            v-model="geminiApiKey"
            :type="showGeminiApiKey ? 'text' : 'password'"
            placeholder="Nhap Gemini API Key"
          />
          <button
            type="button"
            class="secret-toggle-btn"
            :aria-label="showGeminiApiKey ? 'An Gemini API Key' : 'Hien Gemini API Key'"
            @click="showGeminiApiKey = !showGeminiApiKey"
          >
            <EyeOff v-if="showGeminiApiKey" :size="16" />
            <Eye v-else :size="16" />
          </button>
        </div>

        <label for="gemini-model">Gemini Model</label>
        <select
          id="gemini-model"
          v-model="geminiModel"
        >
          <option
            v-for="model in geminiModelOptions"
            :key="model"
            :value="model"
          >
            {{ model }}
          </option>
        </select>
      </section>

      <section class="setup-section">
        <div class="section-head">
          <div>
            <h3>Thiet lap tai khoan Veo</h3>
            <p class="section-note">Co the them nhieu tai khoan, moi tai khoan gom name, token va cookie.</p>
          </div>
          <button type="button" class="ghost-btn" @click="addVeoAccount">Them tai khoan</button>
        </div>

        <div class="account-list">
          <article v-for="(account, index) in veoAccounts" :key="account.id" class="account-card">
            <div class="account-head">
              <strong>Tai khoan {{ index + 1 }}</strong>
              <button
                v-if="veoAccounts.length > 1"
                type="button"
                class="remove-btn"
                @click="removeVeoAccount(account.id)"
              >
                Xoa
              </button>
            </div>

            <label :for="`veo-name-${account.id}`">Name</label>
            <input
              :id="`veo-name-${account.id}`"
              v-model="account.name"
              type="text"
              placeholder="Ten tai khoan"
            />

            <label :for="`veo-token-${account.id}`">Token</label>
            <input
              :id="`veo-token-${account.id}`"
              v-model="account.token"
              type="text"
              placeholder="Nhap token"
            />

            <label :for="`veo-cookie-${account.id}`">Cookie</label>
            <textarea
              :id="`veo-cookie-${account.id}`"
              v-model="account.cookie"
              rows="3"
              placeholder="Nhap cookie"
            />
          </article>
        </div>
      </section>

      <section class="setup-section">
        <h3>API KEY NANO</h3>
        <p class="section-note">Su dung cho cac service Nano trong he thong.</p>

        <label for="nano-api-key">Nano API Key</label>
        <div class="secret-input-wrap">
          <input
            id="nano-api-key"
            v-model="nanoApiKey"
            :type="showNanoApiKey ? 'text' : 'password'"
            placeholder="Nhap NANO API Key"
          />
          <button
            type="button"
            class="secret-toggle-btn"
            :aria-label="showNanoApiKey ? 'An Nano API Key' : 'Hien Nano API Key'"
            @click="showNanoApiKey = !showNanoApiKey"
          >
            <EyeOff v-if="showNanoApiKey" :size="16" />
            <Eye v-else :size="16" />
          </button>
        </div>
      </section>

      <div class="form-actions">
        <button type="button" class="primary-btn" @click="saveConfiguration">Save Configuration</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.page-wrap {
  display: grid;
  gap: 18px;
  padding: 20px;
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

.setup-form {
  display: grid;
  gap: 14px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  padding: 20px;
  background: var(--color-bg-elevated);
}

.setup-section {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-soft);
}

.setup-section h3 {
  margin: 0;
  font-size: 16px;
}

.section-note {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.account-list {
  display: grid;
  gap: 10px;
}

.account-card {
  display: grid;
  gap: 8px;
  border: 1px dashed var(--color-border);
  border-radius: 10px;
  padding: 12px;
  background: var(--color-bg-elevated);
}

.account-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

label {
  font-size: 14px;
  color: var(--color-text-muted);
}

input {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 10px 12px;
  color: var(--color-text);
  background: var(--color-bg-soft);
}

.secret-input-wrap {
  position: relative;
}

.secret-input-wrap input {
  padding-right: 42px;
}

.secret-toggle-btn {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
}

select {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 10px 12px;
  color: var(--color-text);
  background: var(--color-bg-soft);
}

textarea {
  width: 100%;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 10px 12px;
  color: var(--color-text);
  background: var(--color-bg-soft);
  resize: vertical;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}

button {
  width: fit-content;
  border-radius: 10px;
  padding: 10px 14px;
  cursor: pointer;
}

.primary-btn {
  border: 1px solid var(--color-accent-strong);
  color: var(--color-text-on-accent);
  background: var(--color-accent);
}

.ghost-btn,
.remove-btn {
  border: 1px solid var(--color-border);
  color: var(--color-text);
  background: var(--color-bg-elevated);
}

@media (max-width: 900px) {
  .section-head {
    flex-direction: column;
  }

  .form-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
