<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
    Sparkles,
    ArrowRight,
    ShieldCheck,
    ExternalLink,
    Loader2,
    ChevronLeft,
} from 'lucide-vue-next'
import { runtime } from '@/services/runtime'

const { t } = useI18n()
const emit = defineEmits(['login-success'])

const API_BASE = runtime.origin
const NANO_SIGNIN_BASE = 'https://nanoai.pics/desktop/signin'

const balance = ref(0)
const errorMessage = ref('')
const isLoading = ref(false)
const view = ref('choose') // 'choose' | 'waiting'

const sessionToken = ref('')
let pollTimer = null

const isLogin = async (tokenValue) => {
    if (!tokenValue) return false
    try {
        const res = await fetch(
            'https://flow-api.nanoai.pics/api/auth/verifyToken?isuserapp=setup',
            {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${tokenValue}`,
                    Accept: 'application/json',
                },
            }
        )
        if (!res.ok) return false
        const data = await res.json()
        try {
            balance.value = data?.data?.balance || 0
        } catch {
            /* ignore */
        }
        return data?.success === true || data?.valid === true
    } catch (err) {
        console.error('verifyToken error:', err)
        return false
    }
}

function generateSessionToken() {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
    return `nano_${Date.now().toString(36)}_${hex}`
}

async function registerSession(token) {
    const res = await fetch(`${API_BASE}/api/auth/signin-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
    })
    if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.message || `Register failed (${res.status})`)
    }
}

async function abandonSession(token) {
    if (!token) return
    try {
        await fetch(`${API_BASE}/api/auth/signin-abandon`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
        })
    } catch {
        /* ignore */
    }
}

async function pollOnce() {
    const token = sessionToken.value
    if (!token) return
    const res = await fetch(`${API_BASE}/api/auth/signin-poll?token=${encodeURIComponent(token)}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return
    if (data.success && data.data?.access_token) {
        stopPolling()
        await finishWithAccessToken(data.data.access_token)
    }
}

function stopPolling() {
    if (pollTimer) {
        clearInterval(pollTimer)
        pollTimer = null
    }
}

async function finishWithAccessToken(accessToken) {
    errorMessage.value = ''
    isLoading.value = true
    const valid = await isLogin(accessToken)
    isLoading.value = false
    if (valid) {
        localStorage.setItem('access_token', accessToken)
        emit('login-success', { token: accessToken, balance: balance.value })
        view.value = 'choose'
        sessionToken.value = ''
    } else {
        errorMessage.value = t('auth.tokenInvalid')
        view.value = 'choose'
        sessionToken.value = ''
    }
}

async function openSignInUrl(url) {
    if (window.electronAPI?.invoke) {
        const r = await window.electronAPI.invoke('shell:open-external', url)
        if (!r?.success) {
            window.open(url, '_blank', 'noopener,noreferrer')
        }
    } else {
        window.open(url, '_blank', 'noopener,noreferrer')
    }
}

async function startNanoSignIn() {
    errorMessage.value = ''
    const token = generateSessionToken()
    sessionToken.value = token

    try {
        await registerSession(token)
    } catch (e) {
        errorMessage.value = e.message || t('auth.serverUnreachable')
        sessionToken.value = ''
        return
    }

    const url = `${NANO_SIGNIN_BASE}?token=${encodeURIComponent(token)}`
    await openSignInUrl(url)

    view.value = 'waiting'
    stopPolling()
    pollTimer = setInterval(() => {
        pollOnce().catch((err) => console.error('poll error', err))
    }, 1500)
}

async function goBackFromWaiting() {
    stopPolling()
    await abandonSession(sessionToken.value)
    sessionToken.value = ''
    view.value = 'choose'
    errorMessage.value = ''
}

onMounted(() => {
    const savedToken = localStorage.getItem('access_token')
    if (!savedToken) return

    isLoading.value = true
    isLogin(savedToken)
        .then((valid) => {
            if (valid) {
                emit('login-success', { token: savedToken, balance: balance.value })
                return
            }
            localStorage.removeItem('access_token')
        })
        .finally(() => {
            isLoading.value = false
        })
})

onUnmounted(() => {
    stopPolling()
})
</script>

<template>
    <div class="login-wrapper">
        <div class="bg-shape shape-1"></div>
        <div class="bg-shape shape-2"></div>

        <main class="login-card">
            <div class="card-header">
                <div class="icon-box">
                    <Sparkles :size="28" class="brand-icon" />
                </div>
                <h1>IdeaStudio</h1>
                <p>{{ t('auth.subtitle') }}</p>
            </div>

            <div v-if="view === 'choose'" class="panel">
                <span v-if="errorMessage" class="error-text">{{ errorMessage }}</span>
                <button type="button" class="submit-btn" :disabled="isLoading" @click="startNanoSignIn">
                    <span v-if="!isLoading" class="btn-content">
                        {{ t('auth.continueNano') }}
                        <ArrowRight :size="18" />
                    </span>
                    <span v-else class="btn-content">
                        <Loader2 :size="18" class="spin" />
                        {{ t('auth.checkingSession') }}
                    </span>
                </button>
            </div>

            <div v-else class="panel waiting">
                <div class="wait-banner">
                    <Loader2 :size="22" class="spin accent" />
                    <div>
                        <strong>{{ t('auth.waitingTitle') }}</strong>
                        <p class="sub">{{ t('auth.waitingHint') }}</p>
                    </div>
                </div>

                <span v-if="errorMessage" class="error-text">{{ errorMessage }}</span>

                <div class="row-actions">
                    <button type="button" class="ghost-btn" @click="goBackFromWaiting">
                        <ChevronLeft :size="18" />
                        {{ t('auth.back') }}
                    </button>
                    <button type="button" class="linkish" @click="openSignInUrl(`${NANO_SIGNIN_BASE}?token=${encodeURIComponent(sessionToken)}`)">
                        <ExternalLink :size="16" />
                        {{ t('auth.openSignInAgain') }}
                    </button>
                </div>
            </div>

            <div class="card-footer">
                <ShieldCheck :size="14" />
                <span>{{ t('auth.footer') }}</span>
            </div>
        </main>
    </div>
</template>

<style scoped>
:root {
    --color-bg: #09090b;
    --color-bg-elevated: #13151a;
    --color-bg-soft: #1b1e24;
    --color-border: #2b313b;
    --color-text-on-accent: #0a0a0a;
    --color-text: #f3f4f6;
    --color-text-muted: #9ca3af;
    --color-accent: #facc15;
    --color-accent-strong: #eab308;
    --color-accent-soft: rgba(250, 204, 21, 0.15);
    --color-accent-glow-strong: rgba(250, 204, 21, 0.6);
    --color-accent-bg-fade-1: rgba(250, 204, 21, 0.17);
    --color-accent-bg-fade-2: rgba(250, 204, 21, 0.1);
    --color-danger: #ef4444;
}

.login-wrapper {
    position: relative;
    width: 100%;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg);
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    overflow: hidden;
    padding: 20px;
}

.bg-shape {
    position: absolute;
    border-radius: 50%;
    filter: blur(100px);
    z-index: 0;
}

.shape-1 {
    width: 400px;
    height: 400px;
    background: var(--color-accent-bg-fade-1);
    top: -10%;
    left: -5%;
}

.shape-2 {
    width: 500px;
    height: 500px;
    background: var(--color-accent-bg-fade-2);
    bottom: -15%;
    right: -10%;
}

.login-card {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 460px;
    background: rgba(19, 21, 26, 0.78);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--color-border);
    border-radius: 24px;
    padding: 40px 32px;
    box-shadow:
        0 24px 40px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
    animation: slideUpFade 0.55s ease-out forwards;
}

@keyframes slideUpFade {
    from {
        opacity: 0;
        transform: translateY(16px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.card-header {
    text-align: center;
    margin-bottom: 28px;
}

.icon-box {
    width: 64px;
    height: 64px;
    margin: 0 auto 20px;
    background: linear-gradient(135deg, var(--color-bg-soft), var(--color-bg-elevated));
    border: 1px solid var(--color-border);
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow:
        0 8px 16px rgba(0, 0, 0, 0.2),
        inset 0 2px 10px var(--color-accent-bg-fade-2);
}

.brand-icon {
    color: var(--color-accent);
    filter: drop-shadow(0 0 8px var(--color-accent-glow-strong));
}

.card-header h1 {
    margin: 0 0 8px;
    font-size: 28px;
    color: var(--color-text);
    font-weight: 700;
}

.card-header p {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-muted);
}

.panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.waiting .wait-banner {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    padding: 14px;
    border-radius: 14px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-soft);
    margin-bottom: 8px;
}

.wait-banner .sub {
    margin: 6px 0 0;
    font-size: 12px;
    color: var(--color-text-muted);
    line-height: 1.45;
}

.error-text {
    font-size: 13px;
    color: var(--color-danger);
}

.submit-btn {
    width: 100%;
    background: var(--color-accent);
    color: var(--color-text-on-accent);
    border: none;
    border-radius: 14px;
    padding: 16px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.25s ease;
    box-shadow: 0 4px 14px var(--color-accent-bg-fade-1);
}

.btn-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
}

.submit-btn:hover:not(:disabled) {
    background: var(--color-accent-strong);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px var(--color-accent-glow-strong);
}

.submit-btn:disabled {
    opacity: 0.65;
    cursor: not-allowed;
}

.spin {
    animation: spin 0.9s linear infinite;
}

.spin.accent {
    color: var(--color-accent);
    flex-shrink: 0;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.row-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 8px;
}

.ghost-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    border-radius: 12px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-elevated);
    color: var(--color-text);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
}

.ghost-btn:hover {
    border-color: var(--color-accent-soft);
}

.linkish {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 0;
    border: none;
    background: transparent;
    color: var(--color-accent);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
}

.card-footer {
    margin-top: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--color-text-muted);
    font-size: 12px;
}
</style>
