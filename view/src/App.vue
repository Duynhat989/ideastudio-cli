<script setup>
import { computed, ref, onMounted, watch } from 'vue'
import Sidebar from './components/Sidebar.vue'
import FlowAI from './pages/FlowAI.vue'
import FlowStores from './pages/FlowStores.vue'
import Setup from './pages/Setup.vue'
import IdolAI from './pages/IdolAI.vue'
import AuthView from './pages/AuthView.vue'
import BrowserProfiles from './pages/BrowserProfiles.vue'
import Notify from './components/Notify.vue'
import { hasVeo3VideoConfigured } from './utils/veoSetup.js'

import logo_app from './assets/logo.ico'

// --- State ---
const isLoading = ref(true)
const fullText = "IdeaStudio"

// Trạng thái lưu trữ số dư
const currentBalance = ref(0)
const currentPage = ref('Auth')
const workflowOpenTrigger = ref(0)
const pageMap = {
	'Auth': AuthView,
	'Motion Video': IdolAI,
	'Workflow Video': FlowAI,
	// 'WorkFlow Store': FlowStores,
	'Browser Profiles': BrowserProfiles,
	Setup
}

const currentView = computed(() => pageMap[currentPage.value] ?? IdolAI)
const currentViewKey = computed(() => {
	if (currentPage.value === 'Workflow Video') {
		return `workflow-${workflowOpenTrigger.value}`
	}
	return currentPage.value
})
const currentViewProps = computed(() => {
	if (currentPage.value === 'Workflow Video') {
		return { openProjectManagerKey: workflowOpenTrigger.value }
	}
	return {}
})

// --- Logic ---
const onLoginSuccess = (payload) => {
	if (payload.balance !== undefined) {
		currentBalance.value = payload.balance
		currentBalanceNow.value = payload.balance
	}
	currentPage.value = 'Motion Video'
}

const onSelectPage = (page) => {
	if (page === 'Workflow Video' && !hasVeo3VideoConfigured()) {
		showVeoSetupModal.value = true
		return
	}
	currentPage.value = page
	if (page === 'Workflow Video') {
		workflowOpenTrigger.value += 1
	}
}

const goToSetupFromVeoModal = () => {
	showVeoSetupModal.value = false
	currentPage.value = 'Setup'
}

const dismissVeoModal = () => {
	showVeoSetupModal.value = false
}

const onLogout = () => {
	localStorage.removeItem('access_token')
	currentBalance.value = 0
	currentBalanceNow.value = 0
	currentPage.value = 'Auth'
}

const currentBalanceNow = ref(0)
const showVeoSetupModal = ref(false)

const verifyAccessToken = async (tokenValue) => {
	if (!tokenValue) return { ok: false, balance: 0 }
	try {
		const res = await fetch('https://flow-api.nanoai.pics/api/auth/verifyToken?isuserapp=setup', {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${tokenValue}`,
				Accept: 'application/json',
			},
		})
		if (!res.ok) return { ok: false, balance: 0 }
		const data = await res.json()
		const balance = data?.data?.balance ?? 0
		const ok = data?.success === true || data?.valid === true
		return { ok, balance }
	} catch {
		return { ok: false, balance: 0 }
	}
}

/** Một lần sau splash: làm mới số dư hiển thị hoặc đăng xuất nếu token hết hạn (không poll định kỳ). */
watch(isLoading, async (loading) => {
	if (loading) return
	const token = localStorage.getItem('access_token')
	if (!token) return
	const { ok, balance } = await verifyAccessToken(token)
	if (ok) {
		currentBalance.value = balance
		currentBalanceNow.value = balance
	} else {
		localStorage.removeItem('access_token')
		currentBalance.value = 0
		currentBalanceNow.value = 0
		currentPage.value = 'Auth'
	}
})

onMounted(() => {
	window.electronEvent?.onServerStatus((payload) => {
		console.log("Server payload:", payload);
	});
	setTimeout(() => {
		isLoading.value = false;
		window.electronAPI.send('window-fullscreen', {
			from: 'vue',
			time: Date.now()
		});
	}, 4000);
})
</script>

<template>
	<!-- 1. MÀN HÌNH LOADING (SPLASH SCREEN VỚI AMBIENT GLOW & GRID) -->
	<transition name="fade" v-if="isLoading">
		<div class="splash-screen">
			<!-- Background Effects -->
			<div class="ambient-glow"></div>
			<div class="grid-pattern"></div>

			<!-- Content -->
			<div class="splash-content">
				<div class="logo-wrapper">
					<img :src="logo_app" class="splash-logo" alt="Logo" />
				</div>
				<h1 class="splash-text">
					<span v-for="(char, index) in fullText.split('')" :key="index" class="char"
						:style="{ animationDelay: `${index * 0.1}s` }">
						{{ char === ' ' ? '\u00A0' : char }}
					</span>
				</h1>
			</div>
		</div>
	</transition>

	<!-- 2. GIAO DIỆN CHÍNH -->
	<template v-else>
		<div class="app-shell" v-if="currentPage !== 'Auth'">
			<Sidebar
				:active-item="currentPage"
				:current-balance="currentBalanceNow"
				@select-item="onSelectPage"
				@logout="onLogout"
			/>
			<main class="app-main">
				<component :is="currentView" :key="currentViewKey" v-bind="currentViewProps" />
			</main>
		</div>

		<main class="app" v-else>
			<component :is="currentView" @login-success="onLoginSuccess" />
		</main>

		<Teleport to="body">
			<div
				v-if="showVeoSetupModal"
				class="veo-setup-overlay"
				role="dialog"
				aria-modal="true"
				aria-labelledby="veo-setup-title"
				@click.self="dismissVeoModal"
			>
				<div class="veo-setup-card" @click.stop>
					<h2 id="veo-setup-title" class="veo-setup-title">Chưa cấu hình Veo 3</h2>
					<p class="veo-setup-text">
						Workflow Video cần tài khoản Veo trong Cài đặt (ít nhất token và cookie cho tài khoản đầu tiên).
						Vui lòng thêm cấu hình rồi quay lại mục Workflow Video.
					</p>
					<div class="veo-setup-actions">
						<button type="button" class="veo-setup-btn veo-setup-btn-muted" @click="dismissVeoModal">
							Để sau
						</button>
						<button type="button" class="veo-setup-btn veo-setup-btn-primary" @click="goToSetupFromVeoModal">
							Mở Cài đặt
						</button>
					</div>
				</div>
			</div>
		</Teleport>
	</template>

	<Notify />
</template>
<style>
/* --- Global Variables --- */
:root {
	--bg-page: #09090b;
	--text-heading: #09090b;
	--text-body: #52525b;
	--accent-primary: #eab308;
	--success: #10b981;
	--gradient-brand: linear-gradient(135deg, #facc15 0%, #ECBFBF 30%, #eab308 70%, #eab308 100%);
}
</style>
<style scoped>
body {
	margin: 0;
	background-color: var(--bg-page);
	color: var(--text-body);
	font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

/* --- Splash Screen Premium Styles --- */
.splash-screen {
	position: fixed;
	top: 0;
	left: 0;
	width: 100vw;
	height: 100vh;
	background-color: #09090b;
	/* Nền tối chủ đạo */
	display: flex;
	justify-content: center;
	align-items: center;
	z-index: 9999;
	overflow: hidden;
}

/* Ambient Glow (Ánh sáng mờ ảo) */
.ambient-glow {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-image: radial-gradient(circle at 15% 0%, rgba(99, 102, 241, 0.25) 0%, transparent 40%), radial-gradient(circle at 85% 30%, rgb(226 236 72 / 20%) 0%, transparent 40%), radial-gradient(circle at 50% 80%, rgba(56, 189, 248, 0.15) 0%, transparent 50%);
	z-index: 1;
	pointer-events: none;
}

/* Grid Pattern (Lưới tọa độ - Đã chỉnh cho nền tối) */
.grid-pattern {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-image:
		linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
		linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
	background-size: 40px 40px;
	z-index: 1;
	pointer-events: none;
	mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
	-webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
}

.splash-content {
	position: relative;
	z-index: 2;
	/* Nằm trên glow và grid */
	text-align: center;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.logo-wrapper {
	position: relative;
	/* margin-bottom: 30px; */
}

.splash-logo {
	width: 80px;
	height: 80px;
	animation: logo-float 3s infinite ease-in-out;
	filter: drop-shadow(0 0 25px rgba(99, 102, 241, 0.4));
}

/* Text Styling */
.splash-text {
	display: flex;
	margin: 0;
}

.char {
	display: inline-block;
	font-size: 2.5rem;
	font-weight: 700;
	letter-spacing: -1px;
	background: var(--gradient-brand);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	opacity: 0;
	transform: translateY(30px);
	animation: char-appear 2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}


/* Animations */
@keyframes char-appear {
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes logo-float {

	0%,
	100% {
		transform: translateY(0) scale(1);
	}

	50% {
		transform: translateY(-20px) scale(1.05);
	}
}

@keyframes progress-move {
	0% {
		transform: translateX(-100%);
	}

	100% {
		transform: translateX(0);
	}
}

.fade-leave-active {
	transition: opacity 2s ease;
}

.fade-leave-to {
	opacity: 0;
}

/* --- Main App Layout --- */
.app-shell {
	display: grid;
	grid-template-columns: auto 1fr;
	min-height: 100vh;
}

.app-main {
	width: 100%;
	min-height: 100vh;
	background: var(--bg-page);
}

.app {
	width: 100%;
	min-height: 100vh;
	background: var(--bg-page);
}

@media (max-width: 960px) {
	.app-shell {
		grid-template-columns: 1fr;
	}
}

.veo-setup-overlay {
	position: fixed;
	inset: 0;
	z-index: 6000;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 1.25rem;
	background: rgba(0, 0, 0, 0.65);
	backdrop-filter: blur(6px);
}

.veo-setup-card {
	width: 100%;
	max-width: 420px;
	background: linear-gradient(180deg, #18181b 0%, #121214 100%);
	border: 1px solid #2a2d36;
	border-radius: 16px;
	padding: 1.35rem 1.4rem 1.25rem;
	box-shadow: 0 24px 48px rgba(0, 0, 0, 0.55);
}

.veo-setup-title {
	margin: 0 0 0.65rem;
	font-size: 1.1rem;
	font-weight: 800;
	color: #fafafa;
	letter-spacing: -0.02em;
}

.veo-setup-text {
	margin: 0 0 1.15rem;
	font-size: 0.875rem;
	line-height: 1.55;
	color: #a1a1aa;
}

.veo-setup-actions {
	display: flex;
	gap: 0.5rem;
	justify-content: flex-end;
	flex-wrap: wrap;
}

.veo-setup-btn {
	border-radius: 10px;
	padding: 0.55rem 1rem;
	font-size: 0.8125rem;
	font-weight: 700;
	cursor: pointer;
	border: 1px solid transparent;
	transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.veo-setup-btn-muted {
	background: #27272a;
	color: #e4e4e7;
	border-color: #3f3f46;
}

.veo-setup-btn-muted:hover {
	background: #3f3f46;
}

.veo-setup-btn-primary {
	background: #eab308;
	color: #111113;
	border-color: #ca8a04;
}

.veo-setup-btn-primary:hover {
	background: #facc15;
}
</style>