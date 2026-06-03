<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
    GitCompareArrows,
    Image,
    Video,
    Settings,
    ChevronLeft,
    ChevronRight,
    Info,
    X,
    LogOut,
} from 'lucide-vue-next'
import logoApp from '../assets/logo.ico'

defineProps({
    activeItem: {
        type: String,
        required: true,
    },
    currentBalance: {
        type: Number,
        required: false,
        default: 0,
    },
})

const emit = defineEmits(['select-item', 'logout'])
const { t } = useI18n()

const menuItems = [
    { id: 'Gen Image', icon: Image, labelKey: 'nav.genImage' },
    { id: 'Gen Video', icon: Video, labelKey: 'nav.genVideo' },
    { id: 'Workflow Video', icon: GitCompareArrows, labelKey: 'nav.workflowVideo' },
    { id: 'Setup', icon: Settings, labelKey: 'nav.setup' },
]

const selectItem = (name) => {
    emit('select-item', name)
}

const requestLogout = () => {
    emit('logout')
}

const isCollapsed = ref(true)
const isWideScreen = ref(true)

const updateWide = () => {
    isWideScreen.value = window.matchMedia('(min-width: 961px)').matches
}

onMounted(() => {
    updateWide()
    window.addEventListener('resize', updateWide)
})

onUnmounted(() => {
    window.removeEventListener('resize', updateWide)
})

const narrowRail = computed(() => isCollapsed.value && isWideScreen.value)

const toggleCollapse = () => {
    isCollapsed.value = !isCollapsed.value
}

const aboutOpen = ref(false)
const openAbout = () => {
    aboutOpen.value = true
}
const closeAbout = () => {
    aboutOpen.value = false
}

const formatBalance = (n) => {
    if (n == null || Number.isNaN(n)) return '0'
    return new Intl.NumberFormat('vi-VN').format(n)
}

</script>

<template>
    <aside class="sidebar" :class="{ 'is-collapsed': narrowRail }">
        <div class="sidebar-inner">
            <header class="sidebar-header">
                <div class="brand-row">
                    <div class="brand-logo-wrap" aria-hidden="true">
                        <img :src="logoApp" alt="" class="brand-logo" width="40" height="40" />
                    </div>
                    <div v-if="!narrowRail" class="brand-copy">
                        <h1 class="brand-title">IdeaStudio</h1>
                        <p class="brand-caption">{{ t('nav.creativeWorkspace') }}</p>
                        <p class="brand-balance">
                            <span class="balance-label">{{ t('common.balance') }}</span>
                            <span class="balance-value">{{ formatBalance(currentBalance) }}{{ t('common.currencySuffix') }}</span>
                        </p>
                    </div>
                    <button
                        v-if="isWideScreen"
                        type="button"
                        class="collapse-toggle"
                        :title="isCollapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')"
                        :aria-expanded="!isCollapsed"
                        @click="toggleCollapse"
                    >
                        <ChevronLeft v-if="!isCollapsed" :size="18" stroke-width="2" />
                        <ChevronRight v-else :size="18" stroke-width="2" />
                    </button>
                </div>
                <p v-if="narrowRail" class="rail-balance" :title="`${t('common.balance')}: ${formatBalance(currentBalance)}${t('common.currencySuffix')}`">
                    {{ formatBalance(currentBalance) }}
                </p>
            </header>

            <nav class="menu-list" aria-label="Main menu">
                <button
                    v-for="item in menuItems"
                    :key="item.id"
                    type="button"
                    :class="['menu-item', { active: item.id === activeItem }]"
                    :title="narrowRail ? t(item.labelKey) : undefined"
                    :aria-current="item.id === activeItem ? 'page' : undefined"
                    @click="selectItem(item.id)"
                >
                    <component :is="item.icon" :size="18" class="menu-icon" aria-hidden="true" />
                    <span v-if="!narrowRail" class="menu-label">{{ t(item.labelKey) }}</span>
                </button>
            </nav>

            <footer class="sidebar-footer">
                <div class="footer-actions">
                    <button
                        type="button"
                        class="menu-item about-btn"
                        :title="narrowRail ? t('nav.aboutUs') : undefined"
                        @click="openAbout"
                    >
                        <Info :size="18" class="menu-icon" aria-hidden="true" />
                        <span v-if="!narrowRail" class="menu-label">{{ t('nav.aboutUs') }}</span>
                    </button>
                    <button
                        type="button"
                        class="menu-item logout-btn"
                        :title="narrowRail ? t('nav.logout') : undefined"
                        @click="requestLogout"
                    >
                        <LogOut :size="18" class="menu-icon" aria-hidden="true" />
                        <span v-if="!narrowRail" class="menu-label">{{ t('nav.logout') }}</span>
                    </button>
                </div>
            </footer>
        </div>

        <Teleport to="body">
            <div
                v-if="aboutOpen"
                class="about-overlay"
                role="dialog"
                aria-modal="true"
                aria-labelledby="about-title"
                @click.self="closeAbout"
            >
                <div class="about-panel" @click.stop>
                    <button type="button" class="about-close" :aria-label="t('common.close')" @click="closeAbout">
                        <X :size="18" />
                    </button>
                    <div class="about-brand">
                        <img :src="logoApp" alt="" class="about-logo" width="36" height="36" />
                        <h2 id="about-title" class="about-title">IdeaStudio</h2>
                    </div>
                    <p class="about-lead">{{ t('nav.aboutLead') }}</p>
                    <p class="about-body">{{ t('nav.aboutBody') }}</p>
                    <button type="button" class="about-ok" @click="closeAbout">{{ t('common.close') }}</button>
                </div>
            </div>
        </Teleport>
    </aside>
</template>

<style scoped>
.sidebar {
    --sidebar-w-expanded: 256px;
    --sidebar-w-collapsed: 76px;
    display: flex;
    flex-direction: column;
    width: var(--sidebar-w-expanded);
    min-height: 100vh;
    flex-shrink: 0;
    box-sizing: border-box;
    padding: 22px 16px;
    border-right: 1px solid var(--color-border);
    background:
        linear-gradient(165deg, rgba(250, 204, 21, 0.1) 0%, transparent 38%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 24%),
        var(--color-bg-elevated);
    box-shadow: inset -1px 0 0 rgba(0, 0, 0, 0.12);
    transition:
        width 0.24s ease,
        padding 0.24s ease;
}

.sidebar.is-collapsed {
    width: var(--sidebar-w-collapsed);
    padding: 20px 10px;
}

.sidebar-inner {
    display: flex;
    flex-direction: column;
    gap: 22px;
    min-height: 0;
    flex: 1;
}

.sidebar-header {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.brand-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-width: 0;
}

.brand-logo-wrap {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.06), rgba(0, 0, 0, 0.35));
    box-shadow:
        0 0 0 1px rgba(234, 179, 8, 0.12),
        0 8px 24px rgba(0, 0, 0, 0.35);
}

.brand-logo {
    display: block;
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 10px;
}

.sidebar.is-collapsed .brand-logo {
    width: 34px;
    height: 34px;
    border-radius: 9px;
}

.brand-copy {
    flex: 1;
    min-width: 0;
}

.brand-title {
    margin: 0;
    font-size: clamp(1.2rem, 2.5vw, 1.42rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.12;
    text-rendering: geometricPrecision;
    background: linear-gradient(
        118deg,
        #ffffff 0%,
        #f4f4f5 28%,
        #e4e4e7 52%,
        #eab308 78%,
        #fef08a 100%
    );
    background-size: 140% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 2px 14px rgba(234, 179, 8, 0.18));
}

.brand-caption {
    margin: 4px 0 0;
    color: var(--color-text-muted);
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}

.brand-balance {
    margin: 10px 0 0;
    display: flex;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
    font-size: 12px;
}

.balance-label {
    color: var(--color-text-muted);
    font-weight: 500;
}

.balance-value {
    color: var(--color-text);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
}

.rail-balance {
    margin: 0;
    text-align: center;
    font-size: 10px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--color-accent);
    letter-spacing: 0.02em;
    line-height: 1.2;
    word-break: break-all;
}

.collapse-toggle {
    flex-shrink: 0;
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.2);
    color: var(--color-text-muted);
    cursor: pointer;
    transition:
        color 0.15s ease,
        border-color 0.15s ease,
        background 0.15s ease;
}

.collapse-toggle:hover {
    color: var(--color-text);
    border-color: rgba(234, 179, 8, 0.45);
    background: var(--color-accent-soft);
}

.sidebar.is-collapsed .brand-row {
    flex-direction: column;
    align-items: center;
    gap: 12px;
}

.sidebar.is-collapsed .collapse-toggle {
    margin-left: 0;
}

.menu-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
}

.sidebar-footer {
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--color-border);
}

.footer-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.menu-item {
    display: flex;
    align-items: center;
    justify-content: start;
    gap: 12px;
    width: 100%;
    border: 1px solid transparent;
    border-radius: 12px;
    padding: 11px 12px;
    color: var(--color-text-muted);
    background: transparent;
    text-align: left;
    cursor: pointer;
    font-size: 14px;
    transition:
        color 0.18s ease,
        border-color 0.18s ease,
        background 0.18s ease,
        box-shadow 0.18s ease;
}
.sidebar.is-collapsed .menu-item {
    justify-content: center;
}
.menu-item:hover {
    color: var(--color-text);
    border-color: var(--color-border);
    background: var(--color-bg-soft);
}

.menu-item.active {
    color: var(--color-text);
    border-color: rgba(234, 179, 8, 0.55);
    background: var(--color-accent-soft);
    box-shadow: 0 0 0 1px rgba(234, 179, 8, 0.08);
}

.menu-icon {
    flex-shrink: 0;
    opacity: 0.92;
}

.menu-label {
    min-width: 0;
    font-weight: 500;
}

.about-btn {
    color: var(--color-text-muted);
}

.logout-btn:hover {
    border-color: rgba(248, 113, 113, 0.45);
    background: rgba(248, 113, 113, 0.08);
    color: #fecaca;
}

.about-overlay {
    position: fixed;
    inset: 0;
    z-index: 10050;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(8px);
}

.about-panel {
    position: relative;
    max-width: 400px;
    width: 100%;
    padding: 28px 24px 24px;
    border-radius: 16px;
    border: 1px solid var(--color-border);
    background: linear-gradient(165deg, rgba(250, 204, 21, 0.06), var(--color-bg-elevated));
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.45);
}

.about-close {
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--color-text-muted);
    cursor: pointer;
}

.about-close:hover {
    color: var(--color-text);
    background: var(--color-bg-soft);
}

.about-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
}

.about-logo {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    object-fit: cover;
    border-radius: 10px;
    border: 1px solid var(--color-border);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
}

.about-title {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    background: linear-gradient(118deg, #fafafa 0%, #eab308 55%, #fef9c3 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
}

.about-lead {
    margin: 0 0 10px;
    color: var(--color-text);
    font-size: 15px;
    font-weight: 500;
    line-height: 1.45;
}

.about-body {
    margin: 0 0 22px;
    color: var(--color-text-muted);
    font-size: 13px;
    line-height: 1.55;
}

.about-ok {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid rgba(234, 179, 8, 0.45);
    border-radius: 12px;
    background: var(--color-accent-soft);
    color: var(--color-text);
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
    transition: background 0.15s ease;
}

.about-ok:hover {
    background: rgba(234, 179, 8, 0.22);
}

@media (max-width: 960px) {
    .sidebar,
    .sidebar.is-collapsed {
        width: 100%;
        min-height: auto;
        border-right: 0;
        border-bottom: 1px solid var(--color-border);
        padding: 16px 14px 14px;
    }

    .sidebar-inner {
        gap: 16px;
    }

    .brand-row {
        align-items: center;
    }

    .menu-list {
        flex-direction: row;
        flex-wrap: wrap;
        gap: 8px;
    }

    .menu-item {
        width: auto;
        flex: 1 1 auto;
        min-width: 0;
        justify-content: center;
    }

    .sidebar-footer {
        padding-top: 10px;
        border-top: 0;
    }

    .footer-actions {
        flex-direction: row;
        flex-wrap: wrap;
        gap: 8px;
    }

    .footer-actions .menu-item {
        flex: 1 1 auto;
        min-width: 0;
        justify-content: center;
    }
}
</style>
