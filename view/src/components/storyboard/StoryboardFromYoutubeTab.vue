<script setup>
import { useI18n } from 'vue-i18n'
import { Youtube, Construction } from 'lucide-vue-next'

const { t } = useI18n()
</script>

<template>
    <section class="yt-tab card">
        <div class="yt-empty">
            <div class="icon-wrap">
                <Youtube :size="36" />
            </div>
            <Construction :size="20" class="badge-icon" />
            <h3>{{ t('storyboard.ytTitle') }}</h3>
            <p>{{ t('storyboard.ytHint') }}</p>
            <span class="coming-soon">{{ t('storyboard.comingSoon') }}</span>
        </div>
    </section>
</template>

<style scoped>
.card {
    border: 1px solid var(--color-border);
    border-radius: 14px;
    padding: 14px;
    background: var(--color-bg-elevated);
}

.yt-tab {
    min-height: 360px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.yt-empty {
    text-align: center;
    max-width: 420px;
    display: grid;
    gap: 10px;
    position: relative;
}

.icon-wrap {
    margin: 0 auto;
    width: 72px;
    height: 72px;
    border-radius: 16px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ef4444;
}

.badge-icon {
    position: absolute;
    top: 0;
    right: calc(50% - 52px);
    color: var(--color-accent);
}

.yt-empty h3 {
    margin: 0;
    font-size: 1.05rem;
}

.yt-empty p {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.85rem;
    line-height: 1.5;
}

.coming-soon {
    justify-self: center;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-accent);
    border: 1px solid rgba(234, 179, 8, 0.45);
    border-radius: 999px;
    padding: 4px 12px;
    background: var(--color-accent-soft);
}
</style>
