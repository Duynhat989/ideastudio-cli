<script setup>
import { useI18n } from 'vue-i18n'
import {
    GitCompareArrows,
    Clapperboard,
    Settings,
    ArrowRight,
    ShieldCheck,
    Lightbulb,
    Plus,
} from 'lucide-vue-next'

const emit = defineEmits(['navigate'])
const { t } = useI18n()

const goTo = (page) => {
    emit('navigate', page)
}

const guides = [
    {
        id: 'workflow',
        page: 'Workflow Video',
        icon: GitCompareArrows,
        titleKey: 'welcome.workflowTitle',
        descKey: 'welcome.workflowDesc',
        tipKey: 'welcome.workflowTip',
        ctaKey: 'welcome.openWorkflow',
        stepPrefix: 'welcome.workflow',
        steps: ['step1', 'step2', 'step3', 'step4', 'step5'],
        diagram: 'workflow',
    },
    {
        id: 'storyboard',
        page: 'StoryBoard',
        icon: Clapperboard,
        titleKey: 'welcome.storyboardTitle',
        descKey: 'welcome.storyboardDesc',
        tipKey: 'welcome.storyboardTip',
        ctaKey: 'welcome.openStoryboard',
        stepPrefix: 'welcome.storyboard',
        steps: ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'],
        diagram: 'storyboard',
    },
]

const scenePlaceholders = [1, 2, 3, 4]
</script>

<template>
    <section class="welcome-page">
        <div class="welcome-inner">
            <!-- Header -->
            <header class="welcome-header">
                <button type="button" class="skip-btn" @click="goTo('Workflow Video')">
                    {{ t('welcome.skipGuide') }}
                </button>
                <h1 class="welcome-title">
                    {{ t('welcome.titleBefore') }}
                    <span class="brand-gradient">IdeaStudio</span>
                </h1>
                <p class="welcome-subtitle">{{ t('welcome.subtitle') }}</p>
            </header>

            <!-- System Check Banner -->
            <div class="system-banner">
                <div class="system-banner-left">
                    <div class="system-icon">
                        <ShieldCheck :size="20" />
                    </div>
                    <div class="system-labels">
                        <strong>{{ t('welcome.systemCheck') }}</strong>
                        <span>{{ t('welcome.prereqTitle') }}</span>
                    </div>
                </div>
                <p class="system-note">{{ t('welcome.prereqNote') }}</p>
                <button type="button" class="system-btn" @click="goTo('Setup')">
                    <Settings :size="15" />
                    <span>{{ t('welcome.openSetup') }}</span>
                </button>
            </div>

            <!-- Feature Cards -->
            <main class="guides-grid">
                <article v-for="guide in guides" :key="guide.id" class="guide-card">
                    <div class="guide-card-head">
                        <div class="guide-icon">
                            <component :is="guide.icon" :size="20" />
                        </div>
                        <div class="guide-head-text">
                            <h2>{{ t(guide.titleKey) }}</h2>
                            <p>{{ t(guide.descKey) }}</p>
                        </div>
                    </div>

                    <!-- Workflow Diagram -->
                    <div v-if="guide.diagram === 'workflow'" class="diagram workflow-diagram" aria-hidden="true">
                        <div class="wf-row wf-row-top">
                            <div class="wf-node wf-node-start">Start</div>
                            <div class="wf-arrow">→</div>
                            <div class="wf-node">Image Gen</div>
                            <div class="wf-arrow">→</div>
                            <div class="wf-node wf-node-accent">Video Gen</div>
                        </div>
                        <div class="wf-row wf-row-bottom">
                            <div class="wf-node wf-node-loop">Loop</div>
                            <div class="wf-arrow wf-arrow-up">↗</div>
                            <div class="wf-spacer" />
                            <div class="wf-arrow">→</div>
                            <div class="wf-node">AI Call</div>
                            <div class="wf-arrow">→</div>
                            <div class="wf-node wf-node-render">Render</div>
                        </div>
                    </div>

                    <!-- StoryBoard Diagram -->
                    <div v-else class="diagram scene-diagram" aria-hidden="true">
                        <div
                            v-for="n in scenePlaceholders"
                            :key="n"
                            class="scene-thumb"
                        >
                            <div class="scene-thumb-inner" />
                            <span class="scene-label">{{ t('welcome.sceneLabel', { n }) }}</span>
                        </div>
                        <button type="button" class="scene-add" tabindex="-1">
                            <Plus :size="18" />
                        </button>
                    </div>

                    <!-- Steps -->
                    <ol class="step-list">
                        <li v-for="(step, index) in guide.steps" :key="step">
                            <span class="step-num">{{ index + 1 }}</span>
                            <span class="step-text">{{ t(`${guide.stepPrefix}.${step}`) }}</span>
                        </li>
                    </ol>

                    <!-- Tip -->
                    <div class="guide-tip">
                        <Lightbulb :size="14" class="tip-icon" />
                        <div class="tip-body">
                            <span class="tip-label">{{ t('welcome.proTip') }}</span>
                            <p>{{ t(guide.tipKey) }}</p>
                        </div>
                    </div>

                    <!-- CTA -->
                    <button type="button" class="guide-cta" @click="goTo(guide.page)">
                        <span>{{ t(guide.ctaKey) }}</span>
                        <ArrowRight :size="16" />
                    </button>
                </article>
            </main>
        </div>
    </section>
</template>

<style scoped>
.welcome-page {
    min-height: 100%;
    padding: 40px 32px 56px;
    background: var(--color-bg);
    color: var(--color-text);
}

.welcome-inner {
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 28px;
}

/* ── Header ── */
.welcome-header {
    position: relative;
    text-align: center;
    padding-top: 8px;
}

.skip-btn {
    position: absolute;
    top: 0;
    right: 0;
    padding: 6px 14px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s, background 0.2s;
}

.skip-btn:hover {
    color: var(--color-text);
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
}

.welcome-title {
    margin: 0;
    font-size: clamp(1.6rem, 3.5vw, 2.1rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.2;
    color: var(--color-text);
}

.brand-gradient {
    background: linear-gradient(135deg, var(--color-accent) 0%, #f5d76e 50%, var(--color-accent-strong) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.welcome-subtitle {
    margin: 10px auto 0;
    max-width: 58ch;
    font-size: 0.88rem;
    line-height: 1.6;
    color: var(--color-text-muted);
}

/* ── System Check Banner ── */
.system-banner {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 16px 20px;
    border-radius: 14px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-elevated);
}

.system-banner-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-shrink: 0;
}

.system-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--color-accent-soft);
    border: 1px solid rgba(250, 204, 21, 0.25);
    color: var(--color-accent);
}

.system-labels {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.system-labels strong {
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--color-text);
}

.system-labels span {
    font-size: 0.75rem;
    color: var(--color-text-muted);
}

.system-note {
    flex: 1;
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.5;
    color: var(--color-text-muted);
}

.system-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    flex-shrink: 0;
    padding: 9px 16px;
    border: 1px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-bg-soft);
    color: var(--color-text);
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s, color 0.2s;
}

.system-btn:hover {
    border-color: var(--color-accent);
    background: var(--color-accent-soft);
    color: var(--color-accent);
}

/* ── Guide Cards Grid ── */
.guides-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
}

.guide-card {
    display: flex;
    flex-direction: column;
    padding: 24px;
    border-radius: 16px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-elevated);
    transition: border-color 0.25s, box-shadow 0.25s;
}

.guide-card:hover {
    border-color: rgba(250, 204, 21, 0.35);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(250, 204, 21, 0.08);
}

.guide-card-head {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    margin-bottom: 18px;
}

.guide-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: var(--color-accent-soft);
    border: 1px solid rgba(250, 204, 21, 0.2);
    color: var(--color-accent);
    flex-shrink: 0;
}

.guide-head-text h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text);
}

.guide-head-text p {
    margin: 5px 0 0;
    font-size: 0.78rem;
    line-height: 1.5;
    color: var(--color-text-muted);
}

/* ── Workflow Diagram ── */
.diagram {
    margin-bottom: 18px;
    padding: 16px;
    border-radius: 12px;
    border: 1px solid var(--color-border);
    background: var(--color-bg);
}

.workflow-diagram {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.wf-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
}

.wf-row-bottom {
    padding-left: 0;
}

.wf-spacer {
    width: 72px;
    flex-shrink: 0;
}

.wf-node {
    padding: 5px 10px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-soft);
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--color-text-muted);
    white-space: nowrap;
}

.wf-node-start {
    border-color: rgba(250, 204, 21, 0.3);
    color: var(--color-accent);
}

.wf-node-accent {
    border-color: rgba(250, 204, 21, 0.45);
    background: var(--color-accent-soft);
    color: var(--color-accent);
}

.wf-node-loop {
    border-style: dashed;
    color: var(--color-text-muted);
}

.wf-node-render {
    border-color: rgba(16, 185, 129, 0.4);
    background: rgba(16, 185, 129, 0.1);
    color: #34d399;
}

.wf-arrow {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    opacity: 0.5;
    flex-shrink: 0;
}

.wf-arrow-up {
    color: var(--color-accent);
    opacity: 0.7;
}

/* ── StoryBoard Scene Diagram ── */
.scene-diagram {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    overflow-x: auto;
}

.scene-thumb {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
}

.scene-thumb-inner {
    width: 56px;
    height: 40px;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background: linear-gradient(
        135deg,
        var(--color-bg-soft) 0%,
        rgba(250, 204, 21, 0.08) 100%
    );
}

.scene-label {
    font-size: 0.62rem;
    color: var(--color-text-muted);
    font-weight: 500;
}

.scene-add {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 40px;
    border-radius: 6px;
    border: 1px dashed var(--color-border);
    background: transparent;
    color: var(--color-text-muted);
    cursor: default;
    flex-shrink: 0;
    margin-bottom: 18px;
}

/* ── Steps List ── */
.step-list {
    margin: 0 0 16px;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
}

.step-list li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
}

.step-num {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--color-bg-soft);
    border: 1px solid var(--color-border);
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--color-accent);
    flex-shrink: 0;
    margin-top: 1px;
}

.step-text {
    font-size: 0.78rem;
    line-height: 1.45;
    color: var(--color-text-muted);
}

/* ── Tip Box ── */
.guide-tip {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin-bottom: 16px;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid rgba(250, 204, 21, 0.15);
    background: rgba(250, 204, 21, 0.05);
}

.tip-icon {
    color: var(--color-accent);
    flex-shrink: 0;
    margin-top: 2px;
}

.tip-body {
    min-width: 0;
}

.tip-label {
    display: block;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-accent);
    margin-bottom: 3px;
}

.tip-body p {
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.45;
    color: var(--color-text-muted);
}

/* ── CTA Button ── */
.guide-cta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px 20px;
    border: none;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-strong) 100%);
    color: var(--color-text-on-accent);
    font-size: 0.85rem;
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.2s, transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 4px 16px rgba(250, 204, 21, 0.2);
}

.guide-cta:hover {
    filter: brightness(1.08);
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(250, 204, 21, 0.3);
}

/* ── Responsive ── */
@media (max-width: 900px) {
    .system-banner {
        flex-direction: column;
        align-items: flex-start;
        gap: 14px;
    }

    .system-btn {
        align-self: flex-end;
    }

    .guides-grid {
        grid-template-columns: 1fr;
    }
}

@media (max-width: 600px) {
    .welcome-page {
        padding: 28px 16px 40px;
    }

    .skip-btn {
        position: static;
        display: block;
        margin: 0 0 16px auto;
    }

    .welcome-header {
        padding-top: 0;
    }

    .guide-card {
        padding: 18px;
    }

    .wf-spacer {
        display: none;
    }
}
</style>
