import { createI18n } from 'vue-i18n'
import en from './locales/en.json'
import vi from './locales/vi.json'

export const LOCALE_STORAGE_KEY = 'ideastudio.locale'

function readStoredLocale() {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (raw === 'vi') return 'vi'
    const setupRaw = localStorage.getItem('ideastudio.setup')
    if (setupRaw) {
      const setup = JSON.parse(setupRaw)
      if (setup?.locale === 'vi') return 'vi'
    }
  } catch {
    /* ignore */
  }
  return 'en'
}

const initialLocale = readStoredLocale()

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale,
  fallbackLocale: 'en',
  messages: { en, vi },
})

export function setAppLocale(code) {
  const locale = code === 'vi' ? 'vi' : 'en'
  i18n.global.locale.value = locale
  localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  document.documentElement.lang = locale
}

export function getAppLocale() {
  return i18n.global.locale.value
}

document.documentElement.lang = initialLocale
