<script setup>
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Eye, EyeOff, Settings } from 'lucide-vue-next'
import { notify } from '@/composables/useNotify.js'
import { setAppLocale, getAppLocale } from '@/i18n/index.js'

const { t } = useI18n()

const geminiApiKey = ref('')
const geminiModel = ref('gemini-3-flash-preview')
const nanoApiKey = ref('')
const locale = ref(getAppLocale())
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
    cookie: '',
    videoTier: 'ultra',
  }
])

watch(locale, (code) => {
  setAppLocale(code)
})

const addVeoAccount = () => {
  const nextId = veoAccounts.value.length
    ? Math.max(...veoAccounts.value.map((item) => item.id)) + 1
    : 1

  veoAccounts.value.push({
    id: nextId,
    name: '',
    token: '',
    cookie: '',
    videoTier: 'ultra',
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
    locale: locale.value,
    gemini: {
      apiKey: geminiApiKey.value,
      model: geminiModel.value
    },
    veoAccounts: veoAccounts.value,
    nano: {
      apiKey: nanoApiKey.value,
    },
    updatedAt: new Date().toISOString()
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  setAppLocale(locale.value)
  const nanoSettings = localStorage.getItem(NANO_SETTINGS_KEY)
  const parsedNanoSettings = nanoSettings ? JSON.parse(nanoSettings) : {}
  localStorage.setItem(NANO_SETTINGS_KEY, JSON.stringify({
    ...parsedNanoSettings,
    nanoToken: nanoApiKey.value,
    imageAccessToken: veoAccounts.value?.[0]?.token || '',
    videoAccessToken: veoAccounts.value?.[0]?.token || '',
    videoCookie: veoAccounts.value?.[0]?.cookie || '',
    geminiApiKey: geminiApiKey.value,
    geminiModel: geminiModel.value,
    videoTier: veoAccounts.value?.[0]?.videoTier === 'pro' ? 'pro' : 'ultra',
  }))
  await notify.alert({
    title: t('setup.savedTitle'),
    message: t('setup.savedMessage'),
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

    if (saved?.locale === 'vi' || saved?.locale === 'en') {
      locale.value = saved.locale
      setAppLocale(saved.locale)
    }
    geminiApiKey.value = saved?.gemini?.apiKey || ''
    geminiModel.value = saved?.gemini?.model || 'gemini-3-flash-preview'
    nanoApiKey.value = saved?.nano?.apiKey || ''
    const legacyTier = saved?.nano?.videoTier === 'pro' ? 'pro' : 'ultra'

    if (Array.isArray(saved?.veoAccounts) && saved.veoAccounts.length) {
      veoAccounts.value = saved.veoAccounts.map((item, index) => ({
        id: Number(item?.id) || index + 1,
        name: item?.name || '',
        token: item?.token || '',
        cookie: item?.cookie || '',
        videoTier: item?.videoTier === 'pro' ? 'pro' : legacyTier,
      }))
    }
  } catch (error) {
    console.error(t('setup.readConfigError'), error)
  }
})
</script>

<template>
  <section class="page-wrap">
    <header class="page-header">
      <div class="title-row">
        <Settings :size="18" class="title-icon" />
        <h2>{{ t('setup.title') }}</h2>
      </div>
      <p>{{ t('setup.subtitle') }}</p>
    </header>

    <form class="setup-form" @submit.prevent>
      <section class="setup-section">
        <h3>{{ t('setup.language') }}</h3>
        <p class="section-note">{{ t('setup.languageNote') }}</p>
        <label for="app-locale">{{ t('setup.language') }}</label>
        <select id="app-locale" v-model="locale">
          <option value="en">{{ t('setup.languageEn') }}</option>
          <option value="vi">{{ t('setup.languageVi') }}</option>
        </select>
      </section>

      <section class="setup-section">
        <h3>{{ t('setup.geminiSection') }}</h3>
        <p class="section-note">{{ t('setup.geminiNote') }}</p>

        <label for="gemini-api-key">{{ t('setup.geminiApiKey') }}</label>
        <div class="secret-input-wrap">
          <input
            id="gemini-api-key"
            v-model="geminiApiKey"
            :type="showGeminiApiKey ? 'text' : 'password'"
            :placeholder="t('setup.geminiApiKeyPlaceholder')"
          />
          <button
            type="button"
            class="secret-toggle-btn"
            :aria-label="showGeminiApiKey ? t('setup.hideGeminiKey') : t('setup.showGeminiKey')"
            @click="showGeminiApiKey = !showGeminiApiKey"
          >
            <EyeOff v-if="showGeminiApiKey" :size="16" />
            <Eye v-else :size="16" />
          </button>
        </div>

        <label for="gemini-model">{{ t('setup.geminiModel') }}</label>
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
            <h3>{{ t('setup.veoSection') }}</h3>
            <p class="section-note">{{ t('setup.veoNote') }}</p>
          </div>
          <button type="button" class="ghost-btn" @click="addVeoAccount">{{ t('setup.addAccount') }}</button>
        </div>

        <div class="account-list">
          <article v-for="(account, index) in veoAccounts" :key="account.id" class="account-card">
            <div class="account-head">
              <strong>{{ t('setup.accountN', { n: index + 1 }) }}</strong>
              <button
                v-if="veoAccounts.length > 1"
                type="button"
                class="remove-btn"
                @click="removeVeoAccount(account.id)"
              >
                {{ t('common.delete') }}
              </button>
            </div>

            <label :for="`veo-name-${account.id}`">Name</label>
            <input
              :id="`veo-name-${account.id}`"
              v-model="account.name"
              type="text"
              :placeholder="t('setup.accountNamePlaceholder')"
            />

            <label :for="`veo-token-${account.id}`">Token</label>
            <input
              :id="`veo-token-${account.id}`"
              v-model="account.token"
              type="text"
              :placeholder="t('setup.tokenPlaceholder')"
            />

            <label :for="`veo-cookie-${account.id}`">Cookie</label>
            <textarea
              :id="`veo-cookie-${account.id}`"
              v-model="account.cookie"
              rows="3"
              :placeholder="t('setup.cookiePlaceholder')"
            />

            <label :for="`veo-tier-${account.id}`">{{ t('setup.videoTier') }}</label>
            <select :id="`veo-tier-${account.id}`" v-model="account.videoTier">
              <option value="ultra">{{ t('setup.tierUltra') }}</option>
              <option value="pro">{{ t('setup.tierPro') }}</option>
            </select>
            <p class="section-note">{{ t('setup.veoTierNote') }}</p>
          </article>
        </div>
      </section>

      <section class="setup-section">
        <h3>{{ t('setup.nanoSection') }}</h3>
        <p class="section-note">{{ t('setup.nanoNote') }}</p>

        <label for="nano-api-key">{{ t('setup.nanoApiKey') }}</label>
        <div class="secret-input-wrap">
          <input
            id="nano-api-key"
            v-model="nanoApiKey"
            :type="showNanoApiKey ? 'text' : 'password'"
            :placeholder="t('setup.nanoApiKeyPlaceholder')"
          />
          <button
            type="button"
            class="secret-toggle-btn"
            :aria-label="showNanoApiKey ? t('setup.hideNanoKey') : t('setup.showNanoKey')"
            @click="showNanoApiKey = !showNanoApiKey"
          >
            <EyeOff v-if="showNanoApiKey" :size="16" />
            <Eye v-else :size="16" />
          </button>
        </div>
      </section>

      <div class="form-actions">
        <button type="button" class="primary-btn" @click="saveConfiguration">{{ t('setup.saveConfiguration') }}</button>
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
