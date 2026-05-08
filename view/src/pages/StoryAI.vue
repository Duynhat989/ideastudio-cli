<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import Step1IdeaScript from '@/components/story/Step1IdeaScript.vue'
import Step2StructureAnalysis from '@/components/story/Step2StructureAnalysis.vue'
import Step3AssetGeneration from '@/components/story/Step3AssetGeneration.vue'
import Step4VideoContinuity from '@/components/story/Step4VideoContinuity.vue'
import Step5ReviewPublish from '@/components/story/Step5ReviewPublish.vue'

const STORAGE_KEY = 'storyai.workflow.v1'

const stepItems = [
    { id: 1, title: 'Step 1', subtitle: 'Nhap y tuong / kich ban', microcopy: 'Nhap y tuong hoac dan kich ban de AI bat dau tach cau truc.' },
    { id: 2, title: 'Step 2', subtitle: 'AI phan tich cau truc', microcopy: 'Xac nhan scene/shot truoc khi sinh anh.' },
    { id: 3, title: 'Step 3', subtitle: 'Tao anh nhan vat / boi canh', microcopy: 'Khoa nhan vat va boi canh de tranh lech hinh.' },
    { id: 4, title: 'Step 4', subtitle: 'Tao video va continuity', microcopy: 'Render theo shot va dong bo frame noi tiep.' },
    { id: 5, title: 'Step 5', subtitle: 'Review va xuat ban', microcopy: 'Kiem tra lan cuoi va xuat thanh pham.' }
]

const currentStep = ref(1)
const stepStatuses = ref({
    1: 'in-progress',
    2: 'not-started',
    3: 'not-started',
    4: 'not-started',
    5: 'not-started'
})

const step1 = ref({
    inputTab: 'idea',
    scriptText: '',
    preset: 'Drama',
    aspectRatio: '9:16',
    duration: '60s',
    language: 'VI'
})

const step2 = ref({
    filter: 'all',
    selectedNode: 'sh1',
    selectedType: 'Shot'
})

const step3 = ref({
    assetTab: 'characters',
    faceLock: 'medium'
})

const step4 = ref({
    selectedShotId: 2,
    model: 'Veo 3',
    durationPerShot: '5s',
    motionStrength: 'Medium',
    promptIntensity: 'Balanced',
    queueSize: 3,
    eta: '04:21',
    errorMessage: 'Shot 04 continuity mismatch',
    shots: [
        { id: 1, label: 'Shot 01', status: 'Done', progress: 100 },
        { id: 2, label: 'Shot 02', status: 'Running', progress: 61 },
        { id: 3, label: 'Shot 03', status: 'Queued', progress: 0 },
        { id: 4, label: 'Shot 04', status: 'Failed', progress: 14 }
    ]
})

const step5 = ref({
    timeline: 42,
    resolution: '1080p',
    bitrate: '12 Mbps',
    checklist: {
        shotReady: true,
        hasRenderError: true,
        continuity: false,
        audioSubtitle: true
    }
})

const toasts = ref([])
const autoSaveMessage = ref('')

const savePayload = computed(() => ({
    currentStep: currentStep.value,
    stepStatuses: stepStatuses.value,
    step1: step1.value,
    step2: step2.value,
    step3: step3.value,
    step4: step4.value,
    step5: step5.value
}))

const currentComponent = computed(() => {
    const map = {
        1: Step1IdeaScript,
        2: Step2StructureAnalysis,
        3: Step3AssetGeneration,
        4: Step4VideoContinuity,
        5: Step5ReviewPublish
    }
    return map[currentStep.value]
})

const currentStepState = computed(() => {
    const map = {
        1: step1.value,
        2: step2.value,
        3: step3.value,
        4: step4.value,
        5: step5.value
    }
    return map[currentStep.value]
})

const pushToast = (type, text) => {
    const id = Date.now() + Math.random()
    toasts.value.push({ id, type, text })
    setTimeout(() => {
        toasts.value = toasts.value.filter((item) => item.id !== id)
    }, 2600)
}

const setStepStatus = (step, status) => {
    stepStatuses.value[step] = status
}

const goStep = (step) => {
    currentStep.value = step
    if (stepStatuses.value[step] === 'not-started') {
        setStepStatus(step, 'in-progress')
    }
}

const nextStep = () => {
    if (currentStep.value >= 5) return
    setStepStatus(currentStep.value, 'completed')
    currentStep.value += 1
    if (stepStatuses.value[currentStep.value] === 'not-started') {
        setStepStatus(currentStep.value, 'in-progress')
    }
}

const previousStep = () => {
    if (currentStep.value <= 1) return
    currentStep.value -= 1
    setStepStatus(currentStep.value, 'in-progress')
}

const handleStepAction = (action) => {
    if (action === 'analyze') {
        pushToast('started', 'Bat dau job phan tich kich ban')
        setStepStatus(1, 'in-progress')
    }
    if (action === 'draft') {
        pushToast('completed', 'Tao ban nhap AI thanh cong')
    }
    if (action === 'confirm-structure') {
        setStepStatus(2, 'completed')
        pushToast('completed', 'Xac nhan cau truc thanh cong')
        goStep(3)
    }
    if (action === 'fix-scene' || action === 'split-shot') {
        setStepStatus(2, 'needs-review')
        pushToast('queued', 'Da gui job cap nhat cau truc')
    }
    if (action === 'merge-shot') {
        pushToast('completed', 'Da cap nhat bo canh shot')
    }
    if (action === 'generate-missing') {
        pushToast('started', 'Bat dau tao anh con thieu')
        setStepStatus(3, 'in-progress')
    }
    if (action === 'go-step-4') {
        setStepStatus(3, 'completed')
        goStep(4)
    }
    if (action === 'generate-all') {
        pushToast('started', 'Bat dau render toan bo shot')
        setStepStatus(4, 'in-progress')
    }
    if (action === 'pause-queue') {
        pushToast('queued', 'Da tam dung queue render')
    }
    if (action === 'retry-failed') {
        pushToast('completed', 'Retry shot loi thanh cong')
        setStepStatus(4, 'needs-review')
    }
    if (action === 'finish-render') {
        setStepStatus(4, 'completed')
        goStep(5)
        pushToast('completed', 'Hoan tat render, chuyen sang review')
    }
    if (action === 'export-video' || action === 'export-project' || action === 'share-review') {
        setStepStatus(5, 'completed')
        pushToast('completed', 'Thuc thi tac vu xuat ban thanh cong')
    }
    if (action === 'use-last-frame') {
        pushToast('completed', 'Da ap continuity frame cho shot ke')
    }
}

let saveTimer
watch(
    savePayload,
    () => {
        clearTimeout(saveTimer)
        saveTimer = setTimeout(() => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(savePayload.value))
            autoSaveMessage.value = 'Da luu nhap tu dong'
            setTimeout(() => {
                autoSaveMessage.value = ''
            }, 1200)
        }, 400)
    },
    { deep: true }
)

onMounted(() => {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return

    try {
        const parsed = JSON.parse(raw)
        if (parsed?.currentStep) currentStep.value = parsed.currentStep
        if (parsed?.stepStatuses) stepStatuses.value = parsed.stepStatuses
        if (parsed?.step1) step1.value = parsed.step1
        if (parsed?.step2) step2.value = parsed.step2
        if (parsed?.step3) step3.value = parsed.step3
        if (parsed?.step4) step4.value = parsed.step4
        if (parsed?.step5) step5.value = parsed.step5
        pushToast('queued', 'Da resume workflow truoc do')
    } catch {
        pushToast('error', 'Khong the khoi phuc du lieu workflow')
    }
})
</script>

<template>
    <section class="story-page">
        <header class="head card">
            <div>
                <h2>Story AI Workflow</h2>
            </div>
            <span class="autosave">{{ autoSaveMessage }}</span>
        </header>

        <section class="stepper card">
            <button v-for="item in stepItems" :key="item.id" type="button"
                :class="['step-btn', { active: currentStep === item.id }]" @click="goStep(item.id)">
                <div class="step-title">
                    <strong>{{ item.title }}</strong>
                    <span :class="['status', stepStatuses[item.id]]">{{ stepStatuses[item.id] }}</span>
                </div>
                <small>{{ item.subtitle }}</small>
                <p>{{ item.microcopy }}</p>
            </button>
        </section>

        <component :is="currentComponent" :state="currentStepState" @action="handleStepAction" />

        <footer class="footer-nav card">
            <button type="button" class="btn-soft" :disabled="currentStep === 1" @click="previousStep">Quay lai</button>
            <button type="button" class="btn-primary" :disabled="currentStep === 5" @click="nextStep">Sang buoc
                tiep</button>
        </footer>

        <div class="toast-wrap">
            <article v-for="item in toasts" :key="item.id" :class="['toast-item', item.type]">
                {{ item.text }}
            </article>
        </div>
    </section>
</template>

<style scoped>
.story-page {
    display: grid;
    gap: 12px;
    color: var(--color-text);
}

.card {
    border: 1px solid var(--color-border);
    border-radius: 14px;
    padding: 12px;
    background: var(--color-bg-elevated);
}

.head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
}

.head h2 {
    margin: 0;
}

.head p {
    margin: 4px 0 0;
    color: var(--color-text-muted);
}

.autosave {
    color: var(--color-accent);
    font-size: 12px;
}

.stepper {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
}

.step-btn {
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 10px;
    background: var(--color-bg-soft);
    cursor: pointer;
    text-align: left;
    display: grid;
    gap: 6px;
}

.step-btn.active {
    border-color: var(--color-accent-strong);
    background: var(--color-accent-soft);
}

.step-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
}

.step-btn small,
.step-btn p {
    margin: 0;
    color: var(--color-text-muted);
}

.step-btn p {
    font-size: 12px;
}

.status {
    font-size: 11px;
    text-transform: capitalize;
    padding: 2px 8px;
    border: 1px solid var(--color-border);
    border-radius: 999px;
}

.status.in-progress,
.status.completed {
    border-color: var(--color-accent-strong);
    color: var(--color-accent);
    background: var(--color-accent-soft);
}

.status.needs-review {
    border-color: var(--color-accent-strong);
    color: var(--color-accent);
}

.status.error {
    border-color: var(--color-danger);
    color: var(--color-danger);
}

.footer-nav {
    display: flex;
    justify-content: space-between;
    gap: 8px;
}

button {
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 8px 12px;
    background: var(--color-bg-soft);
    color: var(--color-text);
    cursor: pointer;
}

button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn-primary {
    border-color: var(--color-accent-strong);
    background: var(--color-accent);
    color: var(--color-text-on-accent);
}

.btn-soft {
    background: var(--color-bg-soft);
}

.toast-wrap {
    position: fixed;
    right: 14px;
    bottom: 14px;
    display: grid;
    gap: 8px;
    z-index: 30;
}

.toast-item {
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 8px 12px;
    background: var(--color-bg-elevated);
}

.toast-item.started,
.toast-item.completed,
.toast-item.queued {
    border-color: var(--color-accent-strong);
    color: var(--color-accent);
}

.toast-item.error {
    border-color: var(--color-danger);
    color: var(--color-danger);
}

@media (max-width: 1200px) {
    .stepper {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (max-width: 760px) {
    .stepper {
        grid-template-columns: 1fr;
    }

    .head {
        flex-direction: column;
    }
}
</style>