<script setup>
import { ref, computed } from 'vue'
import { Upload } from 'lucide-vue-next'
import GenStudioShell from '@/components/gen/GenStudioShell.vue'
import { upscaleNanoImage, nanoImageResultUrl, getSettings } from '@/services/nanoai'
import {
  IMAGE_MODELS,
  IMAGE_RATIO_OPTIONS,
  FLOW_API_V3_BASE,
  FLOW_TASK_POLL_MS,
  normalizeImageModel,
} from '@/services/flowApiV3.js'
import { imageAspectToCss } from '@/utils/genAspectRatio.js'
import { sanitizeImagePromptForSafety, isPolicyBlockedError } from '@/utils/flowPromptSafety.js'
import { useGenBatchTasks } from '@/composables/useGenBatchTasks.js'
import { notify } from '@/composables/useNotify.js'

const prompt = ref('')
const imageModel = ref('GEM_PIX_2')
const aspectRatio = ref('IMAGE_ASPECT_RATIO_LANDSCAPE')
const fileInputRef = ref(null)
const inputImages = ref([])
const isSubmitting = ref(false)

const { batchCount, tasks, prependTaskSlots, startTaskTimer, clearTaskTimer, removeTask } =
  useGenBatchTasks()

const gridAspect = computed(() => imageAspectToCss(aspectRatio.value))
const modelLabel = computed(() => IMAGE_MODELS.find((m) => m.value === imageModel.value)?.label || '')
const canGenerate = computed(() => Boolean(prompt.value.trim()))

const triggerUpload = () => {
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
    fileInputRef.value.click()
  }
}

const onFileSelected = (event) => {
  const files = event.target.files
  if (!files?.length) return
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (file.type.startsWith('image/')) {
      inputImages.value.push({ file, url: URL.createObjectURL(file) })
    }
  }
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

/** Trích lỗi từ payload task API — cùng logic workflow (nanoai pollTask). */
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

const extractErrMessage = (err, fallback = 'Lỗi tạo ảnh') => {
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

/** Cập nhật task trong mảng reactive (giống workflow updateNodeData). */
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

const pollGenFlowTask = async (taskId, nanoToken, { returnData = false } = {}) => {
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
      if (returnData) return result.data || {}
      return result.data?.fifeUrl
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

const urlToDataUrl = async (url) => {
  const response = await fetch(url)
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/** Luồng tạo ảnh giống workflow (create → poll đến success hoặc error). */
const executeGenImageFlow = async ({ prompt, imageUrls, imageModel, aspectRatio }) => {
  const settings = getSettings()
  if (!settings.nanoToken || !settings.imageAccessToken) {
    throw new Error('Please configure NanoAI settings first')
  }

  const taskId = await createGenFlowTask(
    '/images/create',
    {
      accessToken: settings.imageAccessToken,
      promptText: prompt,
      imageUrls: imageUrls || [],
      ratio: aspectRatio,
      imageModel: normalizeImageModel(imageModel),
    },
    settings.nanoToken,
  )

  const taskData = await pollGenFlowTask(taskId, settings.nanoToken, { returnData: true })
  const fifeUrl = taskData.fifeUrl
  if (!fifeUrl) throw new Error('Gen image success but missing fifeUrl')

  const dataUrl = await urlToDataUrl(fifeUrl)
  return {
    dataUrl,
    url: dataUrl,
    mediaId: taskData.mediaId,
    projectId: taskData.projectId,
    fifeUrl,
    aspectRatio: taskData.aspectRatio,
    imageModel: taskData.imageModel,
  }
}

const settleStuckSlots = (slots, err) => {
  slots.forEach((task) => {
    const live = getLiveTask(task)
    if (live.status === 'generating' || live.status === 'upscaling') {
      failTask(live, err)
    }
  })
}

const runImageTask = async (task, base64Inputs, currentPrompt, currentModel, currentRatio) => {
  let safePrompt = sanitizeImagePromptForSafety(currentPrompt)
  let refs = base64Inputs
  let lastErr = null

  try {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const resultData = await executeGenImageFlow({
          prompt: safePrompt,
          imageUrls: refs,
          imageModel: currentModel,
          aspectRatio: currentRatio,
        })
        const resultUrl = nanoImageResultUrl(resultData)
        if (!resultUrl) {
          throw new Error('API trả về thành công nhưng thiếu URL ảnh')
        }
        succeedTask(task, {
          result: resultUrl,
          mediaId: resultData?.mediaId ?? null,
          projectId: resultData?.projectId ?? null,
          isUpscaled: false,
          model: currentModel,
          ratio: currentRatio,
        })
        return
      } catch (err) {
        lastErr = err
        if (!shouldRetryGen(err) || attempt >= 3) break
        if (isPolicyBlockedError(err)) {
          safePrompt = sanitizeImagePromptForSafety(
            `${safePrompt}. product catalog style, fully clothed, non-sensitive`,
          )
          refs = refs.slice(0, 1)
        }
        await new Promise((resolve) => setTimeout(resolve, 700 * attempt))
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
  if (!settings.nanoToken || !settings.imageAccessToken) {
    await notify.alert({
      title: 'Chưa cấu hình',
      message: 'Vui lòng cấu hình Nano API và tài khoản Veo (token) trong mục Setup.',
      variant: 'warning',
    })
    return
  }

  const count = batchCount.value
  const currentPrompt = trimmed
  const currentModel = imageModel.value
  const currentRatio = aspectRatio.value
  const currentImages = [...inputImages.value]

  const slots = prependTaskSlots(count, () => ({
    model: currentModel,
    ratio: currentRatio,
    mediaId: null,
    projectId: null,
    isUpscaled: false,
  }))

  isSubmitting.value = true
  try {
    const base64Inputs =
      currentImages.length > 0
        ? await Promise.all(currentImages.map((img) => fileToBase64(img.file)))
        : []

    await Promise.allSettled(
      slots.map((task) => runImageTask(task, base64Inputs, currentPrompt, currentModel, currentRatio)),
    )
    settleStuckSlots(slots, new Error('Tạo ảnh không hoàn tất'))
  } catch (err) {
    settleStuckSlots(slots, err)
  } finally {
    isSubmitting.value = false
    tasks.value = [...tasks.value]
  }
}

const handleUpscale = async (task) => {
  if (!task.mediaId || !task.projectId) {
    await notify.alert({
      title: 'Không upscale được',
      message: 'Không tìm thấy mediaId hoặc projectId của ảnh này.',
      variant: 'error',
    })
    return
  }

  const live = patchGenTask(task, { status: 'upscaling', error: null, result: task.result })
  startTaskTimer(live)

  try {
    const upscaleData = await upscaleNanoImage({
      mediaId: task.mediaId,
      projectId: task.projectId,
      targetResolution: 'RESOLUTION_2K',
    })
    const url = upscaleData?.fifeUrl || upscaleData?.encodedImage || upscaleData?.url
    if (url) {
      const result = String(url).startsWith('data:')
        ? url
        : await fetch(url)
            .then((r) => r.blob())
            .then(
              (b) =>
                new Promise((resolve, reject) => {
                  const reader = new FileReader()
                  reader.onloadend = () => resolve(reader.result)
                  reader.onerror = reject
                  reader.readAsDataURL(b)
                }),
            )
      succeedTask(live, { result, isUpscaled: true })
    } else if (upscaleData?.encodedImage) {
      succeedTask(live, {
        result: `data:image/jpeg;base64,${upscaleData.encodedImage}`,
        isUpscaled: true,
      })
    } else {
      throw new Error('Upscale xong nhưng không có URL ảnh')
    }
  } catch (error) {
    failTask(live, error, 'Lỗi upscale')
  } finally {
    ensureTaskSettled(live, 'Upscale không hoàn tất')
    tasks.value = [...tasks.value]
  }
}

const handleDownload = (task) => {
  if (!task.result) return
  const a = document.createElement('a')
  a.href = task.result
  a.download = `gen-image-${Date.now()}.png`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
</script>

<template>
  <div class="gen-image-page">
    <input
      ref="fileInputRef"
      type="file"
      class="sr-only"
      accept="image/jpeg,image/png,image/webp,image/*"
      multiple
      @change="onFileSelected"
    />

    <GenStudioShell
      title="Gen Image"
      media-type="image"
      accent="image"
      :tasks="tasks"
      :prompt="prompt"
      :batch-count="batchCount"
      :aspect-ratio="gridAspect"
      :model-label="modelLabel"
      :can-generate="canGenerate"
      :is-submitting="isSubmitting"
      show-upscale
      prompt-placeholder="Bạn muốn tạo gì?"
      @update:prompt="prompt = $event"
      @update:batch-count="batchCount = $event"
      @generate="handleGenerate"
      @remove-task="removeTask"
      @upscale-task="handleUpscale"
      @download-task="handleDownload"
    >
      <template #settings>
        <div class="cfg-block">
          <div class="cfg-head">
            <span>Ảnh tham chiếu</span>
            <button v-if="inputImages.length" type="button" class="cfg-clear" @click="clearRefs">Xóa</button>
          </div>
          <div v-if="!inputImages.length" class="cfg-upload" @click="triggerUpload">
            <Upload :size="18" />
            <span>Thêm ảnh (tùy chọn)</span>
          </div>
          <div v-else class="cfg-thumbs">
            <img v-for="(img, idx) in inputImages" :key="idx" :src="img.url" alt="" />
            <button type="button" class="cfg-thumb-add" @click="triggerUpload">
              <Upload :size="14" />
            </button>
          </div>
        </div>

        <label class="cfg-label">Model</label>
        <select v-model="imageModel" class="cfg-select">
          <option v-for="m in IMAGE_MODELS" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>

        <label class="cfg-label">Tỷ lệ khung</label>
        <select v-model="aspectRatio" class="cfg-select">
          <option v-for="r in IMAGE_RATIO_OPTIONS" :key="r.value" :value="r.value">{{ r.label }}</option>
        </select>
      </template>
    </GenStudioShell>
  </div>
</template>

<style scoped>
.gen-image-page {
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

.cfg-thumbs img {
  width: 2.75rem;
  height: 2.75rem;
  object-fit: cover;
  border-radius: 0.4rem;
  border: 1px solid #3f3f46;
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
