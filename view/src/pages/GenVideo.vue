<script setup>
import { ref, computed, watch } from 'vue'
import { Upload } from 'lucide-vue-next'
import GenStudioShell from '@/components/gen/GenStudioShell.vue'
import { getSettings } from '@/services/nanoai'
import {
  VIDEO_RATIO_OPTIONS,
  FLOW_API_V3_BASE,
  FLOW_TASK_POLL_MS,
  videoModelsForTier,
  normalizeVideoTier,
  normalizeVideoModel,
} from '@/services/flowApiV3.js'
import { videoAspectToCss } from '@/utils/genAspectRatio.js'
import { sanitizeVideoPromptForSafety, isPolicyBlockedError } from '@/utils/flowPromptSafety.js'
import { useGenBatchTasks } from '@/composables/useGenBatchTasks.js'
import { notify } from '@/composables/useNotify.js'

const prompt = ref('')
const videoType = ref('frame')
const aspectRatio = ref('VIDEO_ASPECT_RATIO_LANDSCAPE')
const fileInputRef = ref(null)
const inputImages = ref([])
const isSubmitting = ref(false)

const videoTier = computed(() => normalizeVideoTier(getSettings().videoTier))
const videoModelOptions = computed(() => videoModelsForTier(videoTier.value))
const videoModel = ref(normalizeVideoModel('veo3Fast', videoTier.value))

watch(videoTier, (tier) => {
  videoModel.value = normalizeVideoModel(videoModel.value, tier)
})

const { batchCount, tasks, prependTaskSlots, clearTaskTimer, removeTask } = useGenBatchTasks({
  onRevokeResult: (task) => {
    if (task.result?.startsWith?.('blob:')) URL.revokeObjectURL(task.result)
  },
})

const isFrameMode = computed(() => videoType.value === 'frame')
const maxRefs = computed(() => (isFrameMode.value ? 2 : 4))
const gridAspect = computed(() => videoAspectToCss(aspectRatio.value))
const modelLabel = computed(
  () => videoModelOptions.value.find((m) => m.value === videoModel.value)?.label || '',
)
const canGenerate = computed(() => Boolean(prompt.value.trim()))

const slotLabels = computed(() => {
  if (isFrameMode.value) {
    if (inputImages.value.length <= 1) return ['Đầu']
    return ['Đầu', 'Cuối']
  }
  return inputImages.value.map((_, i) => `TP ${i + 1}`)
})

watch(videoType, () => {
  while (inputImages.value.length > maxRefs.value) {
    const removed = inputImages.value.pop()
    if (removed?.url) URL.revokeObjectURL(removed.url)
  }
})

const triggerUpload = () => {
  if (inputImages.value.length >= maxRefs.value) return
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
    fileInputRef.value.click()
  }
}

const onFileSelected = (event) => {
  const files = event.target.files
  if (!files?.length) return
  for (let i = 0; i < files.length; i++) {
    if (inputImages.value.length >= maxRefs.value) break
    const file = files[i]
    if (file.type.startsWith('image/')) {
      inputImages.value.push({ file, url: URL.createObjectURL(file) })
    }
  }
}

const removeImageAt = (index) => {
  const removed = inputImages.value.splice(index, 1)[0]
  if (removed?.url) URL.revokeObjectURL(removed.url)
}

const clearRefs = () => {
  inputImages.value.forEach((img) => URL.revokeObjectURL(img.url))
  inputImages.value = []
}

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
  })

const extractFlowTaskErrorMessage = (payload) => {
  if (!payload || typeof payload !== 'object') return 'Task failed'

  const mediaErrors = (payload?.data?.media || [])
    .map((m) => {
      const mediaStatus = m?.mediaMetadata?.mediaStatus
      const primary = mediaStatus?.error?.message || ''
      const reason =
        Array.isArray(mediaStatus?.failureReasons) && mediaStatus.failureReasons.length
          ? mediaStatus.failureReasons.join(', ')
          : ''
      return [primary, reason].filter(Boolean).join(' | ')
    })
    .filter(Boolean)
  if (mediaErrors.length) return mediaErrors[0]

  const nested = payload?.data?.error
  const detailReasons = Array.isArray(nested?.details)
    ? nested.details.map((d) => d?.reason).filter(Boolean)
    : []

  const parts = [
    payload?.message,
    nested?.message,
    nested?.status,
    ...detailReasons,
    typeof payload?.data === 'string' ? payload.data : '',
    typeof payload?.data?.result === 'string' ? payload.data.result : '',
    payload?.error,
  ].filter((s) => typeof s === 'string' && String(s).trim())

  return [...new Set(parts)].join(' — ') || 'Task failed'
}

const formatFlowErrorText = (text) => {
  const t = String(text || '')
  if (t.includes('PUBLIC_ERROR_PROMINENT_PEOPLE')) {
    return 'Ảnh tham chiếu có thể chứa người nổi tiếng. Vui lòng đổi ảnh khác.'
  }
  if (t.includes('PUBLIC_ERROR_SEXUAL') || t.includes('NCII')) {
    return 'Nội dung bị từ chối bởi chính sách an toàn. Hãy đổi prompt hoặc ảnh tham chiếu.'
  }
  return t.trim()
}

const throwFlowTaskError = (payload) => {
  const raw = extractFlowTaskErrorMessage(payload)
  const err = new Error(formatFlowErrorText(raw) || raw || 'Task failed')
  err.flowPayload = payload
  throw err
}

const extractErrMessage = (err, fallback = 'Lỗi tạo video') => {
  if (!err) return fallback
  if (err?.flowPayload) {
    const fromPayload = formatFlowErrorText(extractFlowTaskErrorMessage(err.flowPayload))
    if (fromPayload) return fromPayload
  }
  const msg = formatFlowErrorText(String(err?.message || '').trim())
  return msg || fallback
}

const isInternalRetryable = (err) =>
  String(err?.message || err || '').toLowerCase().includes('internal error encountered')

const shouldRetryGen = (err) => isPolicyBlockedError(err) || isInternalRetryable(err)

const getLiveTask = (task) => tasks.value.find((t) => t.id === task.id) || task

const patchGenTask = (task, patch) => {
  const live = getLiveTask(task)
  clearTaskTimer(live)
  const idx = tasks.value.findIndex((t) => t.id === live.id)
  const next = {
    ...(idx >= 0 ? tasks.value[idx] : live),
    ...patch,
    timerInterval: null,
  }
  if (idx >= 0) {
    const copy = [...tasks.value]
    copy[idx] = next
    tasks.value = copy
  } else {
    Object.assign(live, next)
    tasks.value = [...tasks.value]
  }
  return next
}

const failTask = (task, err, fallback) => {
  patchGenTask(task, {
    status: 'error',
    error: extractErrMessage(err, fallback),
    result: null,
  })
}

const succeedTask = (task, patch) => {
  patchGenTask(task, { status: 'success', error: null, ...patch })
}

const ensureTaskSettled = (task, fallback = 'Không nhận được kết quả từ API') => {
  const live = getLiveTask(task)
  if (live.status === 'generating' || live.status === 'upscaling') {
    failTask(live, new Error(fallback), fallback)
  }
}

const pollGenFlowTask = async (taskId, nanoToken, type = 'video') => {
  const url = `${FLOW_API_V3_BASE}/task?taskId=${encodeURIComponent(taskId)}`
  while (true) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${nanoToken}` },
    })
    const result = await response.json()

    if (response.status === 404) {
      throwFlowTaskError(result)
    }

    if (result.success && result.code === 'success') {
      if (type === 'image') return result.data?.fifeUrl
      return result.data?.mediaUrl
    }

    if (result.code === 'processing') {
      await new Promise((resolve) => setTimeout(resolve, FLOW_TASK_POLL_MS))
      continue
    }

    throwFlowTaskError(result)
  }
}

const createGenFlowTask = async (path, body, nanoToken) => {
  const response = await fetch(`${FLOW_API_V3_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${nanoToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await response.json()
  if (!response.ok || !data?.taskId) {
    throwFlowTaskError(data)
  }
  return data.taskId
}

const executeGenVideoFlow = async ({
  prompt,
  imageUrls,
  videoModel,
  type,
  aspectRatio,
  tier,
}) => {
  const settings = getSettings()
  if (!settings.nanoToken || !settings.videoAccessToken || !settings.videoCookie) {
    throw new Error('Please configure NanoAI settings first')
  }

  const taskId = await createGenFlowTask(
    '/videos/create',
    {
      accessToken: settings.videoAccessToken,
      cookie: settings.videoCookie,
      promptText: prompt,
      imageUrls: imageUrls || [],
      ratio: aspectRatio,
      videoModel: normalizeVideoModel(videoModel, tier),
      type: type || 'frame',
      tier: normalizeVideoTier(tier),
    },
    settings.nanoToken,
  )

  const mediaUrl = await pollGenFlowTask(taskId, settings.nanoToken, 'video')
  if (!mediaUrl) throw new Error('Gen video success but missing mediaUrl')

  const videoResponse = await fetch(mediaUrl)
  const blob = await videoResponse.blob()
  return URL.createObjectURL(blob)
}

const settleStuckSlots = (slots, err) => {
  slots.forEach((task) => {
    const live = getLiveTask(task)
    if (live.status === 'generating' || live.status === 'upscaling') {
      failTask(live, err)
    }
  })
}

const runVideoTask = async (
  task,
  base64Inputs,
  currentPrompt,
  currentModel,
  currentRatio,
  currentType,
) => {
  let safePrompt = sanitizeVideoPromptForSafety(currentPrompt)
  if (!safePrompt) safePrompt = currentPrompt.slice(0, 320)
  let refs = base64Inputs
  let lastErr = null

  try {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const resultUrl = await executeGenVideoFlow({
          prompt: safePrompt,
          imageUrls: refs,
          videoModel: currentModel,
          type: currentType,
          aspectRatio: currentRatio,
          tier: videoTier.value,
        })
        if (!resultUrl || typeof resultUrl !== 'string') {
          throw new Error('API trả về thành công nhưng thiếu URL video')
        }
        succeedTask(task, {
          result: resultUrl,
          model: currentModel,
          ratio: currentRatio,
          type: currentType,
        })
        return
      } catch (err) {
        lastErr = err
        if (!shouldRetryGen(err) || attempt >= 3) break
        if (isPolicyBlockedError(err)) {
          safePrompt = sanitizeVideoPromptForSafety(
            `${safePrompt}. fashion-commercial style, fully clothed, respectful, no sensual tone`,
          )
          refs = refs.slice(0, 1)
        }
        await new Promise((resolve) => setTimeout(resolve, 900 * attempt))
      }
    }
    if (getLiveTask(task).status === 'generating') {
      failTask(task, lastErr)
    }
  } catch (err) {
    failTask(task, err)
  } finally {
    ensureTaskSettled(task)
  }
}

const handleGenerate = async () => {
  const trimmed = prompt.value.trim()
  if (!trimmed || isSubmitting.value) return

  const settings = getSettings()
  if (!settings.nanoToken || !settings.videoAccessToken || !settings.videoCookie) {
    await notify.alert({
      title: 'Chưa cấu hình Veo',
      message: 'Vui lòng cấu hình Nano API và tài khoản Veo (token + cookie) trong mục Setup.',
      variant: 'warning',
    })
    return
  }

  const count = batchCount.value
  const currentPrompt = trimmed
  const currentModel = videoModel.value
  const currentRatio = aspectRatio.value
  const currentType = videoType.value
  const currentImages = [...inputImages.value]

  const slots = prependTaskSlots(count, () => ({
    model: currentModel,
    ratio: currentRatio,
    type: currentType,
  }))

  isSubmitting.value = true
  try {
    const base64Inputs =
      currentImages.length > 0
        ? await Promise.all(currentImages.map((img) => fileToBase64(img.file)))
        : []

    await Promise.allSettled(
      slots.map((task) =>
        runVideoTask(task, base64Inputs, currentPrompt, currentModel, currentRatio, currentType),
      ),
    )
    settleStuckSlots(slots, new Error('Tạo video không hoàn tất'))
  } catch (err) {
    settleStuckSlots(slots, err)
  } finally {
    isSubmitting.value = false
    tasks.value = [...tasks.value]
  }
}

const handleDownload = async (task) => {
  if (!task.result) return
  try {
    const response = await fetch(task.result)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = `gen-video-${Date.now()}.mp4`
    document.body.appendChild(a)
    a.click()
    URL.revokeObjectURL(objectUrl)
    document.body.removeChild(a)
  } catch {
    window.open(task.result, '_blank')
  }
}
</script>

<template>
  <div class="gen-video-page">
    <input
      ref="fileInputRef"
      type="file"
      class="sr-only"
      accept="image/jpeg,image/png,image/webp,image/*"
      :multiple="!isFrameMode || inputImages.length < maxRefs - 1"
      @change="onFileSelected"
    />

    <GenStudioShell
      title="Gen Video"
      media-type="video"
      accent="video"
      :tasks="tasks"
      :prompt="prompt"
      :batch-count="batchCount"
      :aspect-ratio="gridAspect"
      :model-label="modelLabel"
      :can-generate="canGenerate"
      :is-submitting="isSubmitting"
      prompt-placeholder="Mô tả video bạn muốn tạo…"
      @update:prompt="prompt = $event"
      @update:batch-count="batchCount = $event"
      @generate="handleGenerate"
      @remove-task="removeTask"
      @download-task="handleDownload"
    >
      <template #settings>
        <div class="cfg-block">
          <div class="cfg-head">
            <span>Ảnh tham chiếu</span>
            <button v-if="inputImages.length" type="button" class="cfg-clear" @click="clearRefs">Xóa</button>
          </div>
          <p class="cfg-hint">
            {{ isFrameMode ? 'Frame: tối đa 2 ảnh (đầu & cuối).' : 'Ingredient: tối đa 4 ảnh.' }}
          </p>
          <div v-if="!inputImages.length" class="cfg-upload" @click="triggerUpload">
            <Upload :size="18" />
            <span>Thêm ảnh (tùy chọn)</span>
          </div>
          <div v-else class="cfg-thumbs">
            <div v-for="(img, idx) in inputImages" :key="idx" class="cfg-thumb-wrap">
              <span v-if="slotLabels[idx]" class="cfg-slot">{{ slotLabels[idx] }}</span>
              <img :src="img.url" alt="" />
              <button type="button" class="cfg-thumb-x" @click.stop="removeImageAt(idx)">×</button>
            </div>
            <button
              v-if="inputImages.length < maxRefs"
              type="button"
              class="cfg-thumb-add"
              @click="triggerUpload"
            >
              <Upload :size="14" />
            </button>
          </div>
        </div>

        <label class="cfg-label">Kiểu đầu vào</label>
        <select v-model="videoType" class="cfg-select">
          <option value="frame">Frame — đầu &amp; cuối</option>
          <option value="ingredient">Ingredient — tham chiếu</option>
        </select>

        <label class="cfg-label">Model video</label>
        <select v-model="videoModel" class="cfg-select">
          <option v-for="m in videoModelOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>

        <label class="cfg-label">Tỷ lệ khung</label>
        <select v-model="aspectRatio" class="cfg-select">
          <option v-for="r in VIDEO_RATIO_OPTIONS" :key="r.value" :value="r.value">{{ r.label }}</option>
        </select>
      </template>
    </GenStudioShell>
  </div>
</template>

<style scoped>
.gen-video-page {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.cfg-block {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.cfg-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  color: #a1a1aa;
}

.cfg-hint {
  margin: 0;
  font-size: 0.7rem;
  color: #71717a;
}

.cfg-clear {
  border: none;
  background: none;
  color: #f87171;
  font-size: 0.72rem;
  cursor: pointer;
}

.cfg-upload {
  border: 1px dashed #3f3f46;
  border-radius: 0.5rem;
  padding: 0.65rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.78rem;
  color: #a1a1aa;
  cursor: pointer;
}

.cfg-thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.cfg-thumb-wrap {
  position: relative;
  width: 2.75rem;
  height: 2.75rem;
}

.cfg-thumb-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 0.4rem;
  border: 1px solid #3f3f46;
}

.cfg-slot {
  position: absolute;
  top: 1px;
  left: 3px;
  z-index: 1;
  font-size: 0.5rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 2px #000;
}

.cfg-thumb-x {
  position: absolute;
  top: -3px;
  right: -3px;
  width: 0.95rem;
  height: 0.95rem;
  border: none;
  border-radius: 50%;
  background: #ef4444;
  color: #fff;
  font-size: 0.65rem;
  line-height: 1;
  cursor: pointer;
}

.cfg-thumb-add {
  width: 2.75rem;
  height: 2.75rem;
  border: 1px dashed #3f3f46;
  border-radius: 0.4rem;
  background: transparent;
  color: #71717a;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cfg-label {
  font-size: 0.72rem;
  color: #71717a;
  margin-top: 0.15rem;
}

.cfg-select {
  width: 100%;
  border-radius: 0.5rem;
  border: 1px solid #3f3f46;
  background: #1b1e24;
  color: #f4f4f5;
  font-size: 0.8rem;
  padding: 0.4rem 0.55rem;
}
</style>
