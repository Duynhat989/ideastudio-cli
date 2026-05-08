<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { Sparkles, Image as ImageIcon, Video, Upload, Settings2, Download, Play, Wand2, XCircle, Scaling } from 'lucide-vue-next'
import { set } from 'idb-keyval'

// Thay đổi đường dẫn này trỏ đúng tới file service bạn vừa tạo
import { generateNanoImage, generateMotionVideo } from '@/services/nanoai'
import { notify } from '@/composables/useNotify.js'

// Trạng thái chế độ: 'image' hoặc 'video'
const activeMode = ref('image')

// Form states
const prompt = ref('')
const model = ref('GEM_PIX_2') // Mặc định cho Image
const aspectRatio = ref('IMAGE_ASPECT_RATIO_PORTRAIT')
const promptAdherence = ref(0.5) // Mức độ tuân lệnh (0 - 1)

// Ref cho thẻ input file ẩn
const fileInputRef = ref(null)
const uploadTarget = ref('')

// Upload states
const inputImages = ref([])
const motionImage = ref(null)
const motionVideo = ref(null)

// Result states - CHUYỂN SANG DẠNG MẢNG ĐỂ LƯU NHIỀU TASK
const taskQueue = ref([])

// Danh sách Model mới
const modelOptions = [
    { label: 'Nano Banana Pro', value: 'GEM_PIX_2' },
    { label: 'Nano Banana 2', value: 'NARWHAL' },
    { label: 'Image 4', value: 'IMAGEN_3_5' }
]

const videoModelOptions = [
    { label: 'Kling Pro', value: 'kling-pro' },
    { label: 'Kling Std', value: 'kling-std' }
]


const ratioOptions = [
    { label: '1:1', value: 'IMAGE_ASPECT_RATIO_SQUARE' },
    { label: '4:3', value: 'IMAGE_ASPECT_RATIO_LANDSCAPE_FOUR_THREE' },
    { label: '3:4', value: 'IMAGE_ASPECT_RATIO_PORTRAIT_THREE_FOUR' },
    { label: '16:9', value: 'IMAGE_ASPECT_RATIO_LANDSCAPE' },
    { label: '9:16', value: 'IMAGE_ASPECT_RATIO_PORTRAIT' }
]

// Tính toán thống kê Task
const totalTasks = computed(() => taskQueue.value.length)
const renderingTasks = computed(() => taskQueue.value.filter(t => t.status === 'generating' || t.status === 'upscaling').length)

// Clear intervals khi unmount component để tránh memory leak
onBeforeUnmount(() => {
    taskQueue.value.forEach(task => {
        if (task.timerInterval) clearInterval(task.timerInterval)
    })
})

// Hàm chuyển đổi Mode và reset dữ liệu cho phù hợp
const switchMode = (mode) => {
    activeMode.value = mode
    clearInput()
    // Tự động chọn model đầu tiên của danh sách tương ứng
    model.value = mode === 'image' ? modelOptions[0].value : videoModelOptions[0].value
}

// Xác định loại file được phép chọn
const acceptTypes = computed(() => {
    if (uploadTarget.value === 'motion-video') return 'video/mp4, video/quicktime, video/*'
    return 'image/jpeg, image/png, image/webp, image/*'
})

// Mở File Picker
const triggerUpload = (target) => {
    uploadTarget.value = target
    setTimeout(() => {
        if (fileInputRef.value) {
            fileInputRef.value.value = ''
            fileInputRef.value.click()
        }
    }, 200)
}
let timeVideoUpload = 0
// Xử lý khi người dùng chọn file
const onFileSelected = (event) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    if (uploadTarget.value === 'image-gen') {
        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            if (file.type.startsWith('image/')) {
                inputImages.value.push({
                    file: file,
                    url: URL.createObjectURL(file)
                })
            }
        }
    } else if (uploadTarget.value === 'motion-image') {
        const file = files[0]
        if (file.type.startsWith('image/')) {
            if (motionImage.value) URL.revokeObjectURL(motionImage.value.url)
            motionImage.value = {
                file: file,
                name: file.name,
                url: URL.createObjectURL(file)
            }
        }
    } else if (uploadTarget.value === 'motion-video') {
        const file = files[0]
        if (file.type.startsWith('video/')) {
            const tempUrl = URL.createObjectURL(file)

            const videoEl = document.createElement('video')
            videoEl.preload = 'metadata'
            videoEl.onloadedmetadata = () => {
                URL.revokeObjectURL(tempUrl)
                timeVideoUpload = videoEl.duration
                if (videoEl.duration > 30) {
                    void notify.alert({
                        title: 'Video quá dài',
                        message: `Video khoảng ${Math.round(videoEl.duration)}s. Vui lòng chọn video dưới 30 giây.`,
                        variant: 'warning',
                    })
                    if (fileInputRef.value) fileInputRef.value.value = ''
                } else {
                    if (motionVideo.value) URL.revokeObjectURL(motionVideo.value.url)
                    motionVideo.value = {
                        file: file,
                        name: file.name,
                        url: URL.createObjectURL(file)
                    }
                }
            }
            videoEl.src = tempUrl
        }
    }
}

// Xóa file
const clearInput = () => {
    if (activeMode.value === 'image') {
        inputImages.value.forEach(img => URL.revokeObjectURL(img.url))
        inputImages.value = []
    } else {
        if (motionImage.value) URL.revokeObjectURL(motionImage.value.url)
        if (motionVideo.value) URL.revokeObjectURL(motionVideo.value.url)
        motionImage.value = null
        motionVideo.value = null
    }
}

const hasInputs = computed(() => {
    if (activeMode.value === 'image') return inputImages.value.length > 0
    return motionImage.value !== null || motionVideo.value !== null
})

// Helper chuyển File thành Base64
const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => resolve(reader.result)
        reader.onerror = (error) => reject(error)
    })
}

// XÓA TASK KHỎI DANH SÁCH
const removeTask = (taskId) => {
    const task = taskQueue.value.find(t => t.id === taskId)
    if (task && task.timerInterval) {
        clearInterval(task.timerInterval)
    }
    taskQueue.value = taskQueue.value.filter(t => t.id !== taskId)
}
const timeMou = ref(0)
setInterval(() => {
    timeMou.value += 5
    if (timeMou.value > 90) {
        timeMou.value = 0
    }
}, 20)
// Gọi API Upscale Hình Ảnh
const handleUpscale = async (task) => {
    if (!task.mediaId || !task.projectId) {
        await notify.alert({
            title: 'Không upscale được',
            message: 'Không tìm thấy mediaId hoặc projectId của ảnh này để upscale.',
            variant: 'error',
        })
        return
    }

    task.status = 'upscaling'
    task.elapsedTime = 0
    task.timerInterval = setInterval(() => {
        task.elapsedTime++
    }, 1000)

    try {
        const response = await fetch("https://flow-api.nanoai.pics/api/v2/images/upscale", {
            method: "POST",
            headers: {
                "Authorization": "Bearer YOUR_NANO_TOKEN", // TODO: Thay YOUR_NANO_TOKEN thật
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                accessToken: "YOUR_ACCESS_TOKEN", // TODO: Thay YOUR_ACCESS_TOKEN thật
                mediaId: task.mediaId,
                projectId: task.projectId,
                targetResolution: "RESOLUTION_2K"
            })
        })

        const data = await response.json()

        if (task.timerInterval) clearInterval(task.timerInterval)

        if (data.success && data.result?.encodedImage) {
            task.result = `data:image/jpeg;base64,${data.result.encodedImage}`
            task.status = 'success'
            task.isUpscaled = true // Đánh dấu đã upscale
        } else {
            throw new Error(data.message || "Lỗi xử lý từ server khi upscale")
        }
    } catch (error) {
        if (task.timerInterval) clearInterval(task.timerInterval)
        task.status = 'error'
        task.error = error.message || "Lỗi mạng khi upscale ảnh"
    }
}

// Xử lý Generate API
const handleGenerate = async () => {
    if (!prompt.value) return

    // Tạo ID duy nhất cho Task này
    const taskId = Date.now()

    if (activeMode.value === 'image') {
        // ----- CHẾ ĐỘ TẠO ẢNH -----

        // Đóng gói trạng thái hiện tại (để người dùng có thể đổi input ngay sau khi bấm)
        const currentPrompt = prompt.value
        const currentModel = model.value
        const currentRatio = aspectRatio.value
        const currentImages = [...inputImages.value]

        // Thêm task vào đầu mảng
        const newTask = {
            id: taskId,
            mode: 'image',
            status: 'generating',
            result: null,
            error: null,
            model: currentModel,
            ratio: currentRatio,
            elapsedTime: 0,
            timerInterval: null,
            mediaId: null, // Lưu mediaId trả về
            projectId: null, // Lưu projectId trả về
            isUpscaled: false // Cờ đánh dấu ảnh đã được upscale hay chưa
        }

        // Bắt đầu đếm giây
        newTask.timerInterval = setInterval(() => {
            const t = taskQueue.value.find(x => x.id === taskId)
            if (t) t.elapsedTime++
        }, 1000)

        taskQueue.value.unshift(newTask)

        try {
            const base64Inputs = currentImages.length > 0
                ? await Promise.all(currentImages.map(img => fileToBase64(img.file)))
                : []

            // Giả định generateNanoImage trả về object: { url: "...", mediaId: "...", projectId: "..." } 
            // HOẶC trả về string URL trực tiếp
            const resultData = await generateNanoImage({
                prompt: currentPrompt,
                imageUrls: base64Inputs,
                imageModel: currentModel,
                aspectRatio: currentRatio
            })

            // Cập nhật task khi thành công
            const task = taskQueue.value.find(t => t.id === taskId)
            if (task) {
                clearInterval(task.timerInterval)
                task.status = 'success'

                // Trích xuất dữ liệu trả về để chuẩn bị cho hàm Upscale
                if (typeof resultData === 'object' && resultData !== null) {
                    task.result = resultData.url || resultData.imageUrl || resultData.result
                    task.mediaId = resultData.mediaId
                    task.projectId = resultData.projectId
                } else {
                    task.result = resultData // Fallback nếu chỉ trả về chuỗi ảnh
                }
            }

        } catch (error) {
            const task = taskQueue.value.find(t => t.id === taskId)
            if (task) {
                clearInterval(task.timerInterval)
                task.status = 'error'
                task.error = error.message || "Lỗi tạo ảnh"
            }
        }

    } else if (activeMode.value === 'video') {
        // ----- CHẾ ĐỘ TẠO VIDEO MOTION -----

        if (!motionImage.value || !motionVideo.value) {
            await notify.alert({
                title: 'Thiếu file',
                message: 'Vui lòng tải lên cả ảnh gốc và video tham chiếu.',
                variant: 'warning',
            })
            return
        }

        // Đóng gói trạng thái hiện tại
        const currentPrompt = prompt.value
        const currentModel = model.value
        const currentAdherence = promptAdherence.value
        const currentImageFile = motionImage.value.file
        const currentVideoFile = motionVideo.value.file

        // Thêm task vào đầu mảng
        const newTask = {
            id: taskId,
            mode: 'video',
            status: 'generating',
            result: null,
            error: null,
            model: currentModel,
            adherence: currentAdherence,
            elapsedTime: 0,
            timerInterval: null
        }

        // Bắt đầu đếm giây
        newTask.timerInterval = setInterval(() => {
            const t = taskQueue.value.find(x => x.id === taskId)
            if (t) t.elapsedTime++
        }, 1000)

        taskQueue.value.unshift(newTask)

        try {
            const imageBase64 = await fileToBase64(currentImageFile)

            const resultUrl = await generateMotionVideo({
                imageBase64: imageBase64,
                videoFile: currentVideoFile,
                prompt: currentPrompt,
                cfgScale: currentAdherence,
                timeVideo: timeVideoUpload,
                characterOrientation: "video"
            })
            async function cacheVideo(url) {
                const res = await fetch(url)
                const blob = await res.blob()

                const localUrl = URL.createObjectURL(blob)
                return localUrl
            }
            // Cập nhật task khi thành công
            const task = taskQueue.value.find(t => t.id === taskId)
            if (task) {
                clearInterval(task.timerInterval)
                task.status = 'success'
                const tempUrl = await cacheVideo(resultUrl)
                // gán vào task
                task.result = tempUrl
            }
        } catch (error) {
            const task = taskQueue.value.find(t => t.id === taskId)
            if (task) {
                clearInterval(task.timerInterval)
                task.status = 'error'
                task.error = error.message || "Lỗi tạo video"
            }
        }
    }
}
</script>

<template>
    <div class="page-wrap">
        <!-- Input file ẩn -->
        <input type="file" ref="fileInputRef" style="display: none;" :accept="acceptTypes"
            :multiple="uploadTarget === 'image-gen'" @change="onFileSelected" />

        <!-- Header -->
        <header class="page-header">
            <div class="title-row">
                <div class="icon-wrapper">
                    <Sparkles :size="24" class="title-icon" />
                </div>
                <div>
                    <h2>IdeaStudio</h2>
                    <p>Sáng tạo hình ảnh và video motion chuyên nghiệp</p>
                </div>
            </div>

            <div class="mode-switcher">
                <button :class="['mode-btn', { active: activeMode === 'image' }]" @click="switchMode('image')">
                    <ImageIcon :size="18" />
                    Image Generation
                </button>
                <button :class="['mode-btn', { active: activeMode === 'video' }]" @click="switchMode('video')">
                    <Video :size="18" />
                    Video Motion
                </button>
            </div>
        </header>

        <!-- Main Workspace Grid -->
        <div class="workspace-layout">
            <!-- Cột Trái: Controls & Inputs -->
            <aside class="control-panel">
                <div class="panel-section">
                    <div class="section-header">
                        <h3>{{ activeMode === 'image' ? '1. Ảnh Đầu Vào' : '1. Ảnh & Video Đầu Vào' }}</h3>
                        <span v-if="hasInputs" class="clear-btn" @click="clearInput">Xóa tất cả</span>
                    </div>

                    <!-- KHU VỰC TẢI FILE IMAGE -->
                    <template v-if="activeMode === 'image'">
                        <div class="upload-zone">
                            <div v-if="!inputImages.length" class="upload-placeholder"
                                @click="triggerUpload('image-gen')">
                                <Upload :size="32" class="upload-icon" />
                                <span>Click để tải ảnh lên từ máy tính</span>
                                <small>Hỗ trợ JPG, PNG, WEBP</small>
                            </div>
                            <div v-else class="preview-thumbnails">
                                <img v-for="(img, idx) in inputImages" :key="idx" :src="img.url" alt="Input"
                                    class="thumb-img" />
                                <div class="add-more-thumb" @click="triggerUpload('image-gen')" title="Thêm ảnh">
                                    <Upload :size="20" />
                                </div>
                            </div>
                        </div>
                    </template>

                    <!-- KHU VỰC TẢI FILE VIDEO MOTION -->
                    <template v-else>
                        <div class="motion-inputs-grid">
                            <!-- Ảnh gốc -->
                            <div class="upload-zone split" @click="triggerUpload('motion-image')">
                                <template v-if="!motionImage">
                                    <ImageIcon :size="24" class="upload-icon" />
                                    <span>Tải Ảnh gốc</span>
                                    <small>JPG/PNG</small>
                                </template>
                                <template v-else>
                                    <img :src="motionImage.url" class="thumb-img-large" />
                                </template>
                            </div>

                            <!-- Video Reference (Giới hạn 30s) -->
                            <div class="upload-zone split" @click="triggerUpload('motion-video')">
                                <template v-if="!motionVideo">
                                    <Video :size="24" class="upload-icon" />
                                    <span>Tải Video</span>
                                    <small>MP4/MOV (Dưới 30s)</small>
                                </template>
                                <template v-else>
                                    <div class="video-thumb-large">
                                        <Video :size="32" class="title-icon" />
                                        <span class="file-name">{{ motionVideo.name }}</span>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </template>
                </div>

                <div class="panel-section">
                    <div class="section-header">
                        <h3>2. Prompt (Mô tả)</h3>
                    </div>
                    <textarea v-model="prompt" rows="5" class="prompt-input"
                        :placeholder="activeMode === 'image' ? 'Mô tả chi tiết phong cách, ánh sáng, vật thể để AI chỉnh sửa hoặc tạo mới...' : 'Mô tả chuyển động, camera pan, hướng gió...'"></textarea>
                </div>

                <div class="panel-section parameters">
                    <div class="section-header">
                        <Settings2 :size="16" />
                        <h3>Cấu hình nâng cao</h3>
                    </div>

                    <div class="settings-grid">
                        <label>Model AI</label>
                        <select v-model="model">
                            <option v-for="opt in (activeMode === 'image' ? modelOptions : videoModelOptions)"
                                :key="opt.value" :value="opt.value">
                                {{ opt.label }}
                            </option>
                        </select>
                    </div>

                    <div class="settings-grid" v-if="activeMode === 'image'">
                        <label>Tỷ lệ</label>
                        <select v-model="aspectRatio">
                            <option v-for="opt in ratioOptions" :key="opt.value" :value="opt.value">
                                {{ opt.label }}
                            </option>
                        </select>
                    </div>

                    <!-- Slider tuân lệnh prompt (0 -> 1) -->
                    <div v-if="activeMode === 'video'" class="field-wrap slider-wrap">
                        <div class="slider-header">
                            <label>Mức độ tuân lệnh prompt</label>
                            <span>{{ promptAdherence }}</span>
                        </div>
                        <input type="range" v-model.number="promptAdherence" min="0" max="1" step="0.1"
                            class="styled-slider" />
                    </div>
                </div>

                <!-- Nút Generate không còn bị lock bởi isGenerating global -->
                <button class="generate-btn" :disabled="!prompt" @click="handleGenerate">
                    <Wand2 :size="20" />
                    Tạo kết quả ngay
                </button>
            </aside>

            <!-- Cột Phải: Preview Panel -->
            <main class="preview-panel">

                <!-- Trạng thái trống (Chưa có task nào) -->
                <div v-if="taskQueue.length === 0" class="preview-container is-empty">
                    <div class="empty-state">
                        <ImageIcon v-if="activeMode === 'image'" :size="64" class="empty-icon" />
                        <Video v-else :size="64" class="empty-icon" />
                        <p>Kết quả sẽ hiển thị tại đây</p>
                        <small>Bạn có thể tạo nhiều kết quả cùng lúc</small>
                    </div>
                </div>

                <!-- Danh sách các Task (Đang chạy hoặc đã xong) -->
                <div v-else class="tasks-list-container">

                    <!-- Thống kê Task -->
                    <div class="task-stats">
                        <span>Tổng kết quả: <strong>{{ totalTasks }}</strong></span>
                        <span class="dot">•</span>
                        <span>Đang xử lý: <strong class="text-accent">{{ renderingTasks }}</strong></span>
                    </div>

                    <div class="tasks-list">
                        <div v-for="task in taskQueue" :key="task.id" class="task-card">

                            <!-- Nút xóa task -->
                            <button class="remove-task-btn" @click="removeTask(task.id)" title="Xóa kết quả này">
                                <XCircle :size="20" />
                            </button>

                            <!-- Trạng thái Loading của Task -->
                            <div v-if="task.status === 'generating'" class="loading-state">
                                <div class="scan-line"></div>
                                <div class="glow-orb"></div>
                                <p>Đang xử lý {{ task.mode === 'image' ? 'hình ảnh' : 'video motion' }}...</p>
                                <div class="timer-badge">{{ task.elapsedTime }}.{{ timeMou }}s</div>
                            </div>

                            <!-- Trạng thái Upscaling -->
                            <div v-if="task.status === 'upscaling'" class="loading-state">
                                <div class="scan-line"></div>
                                <div class="glow-orb" style="background: #3b82f6;"></div>
                                <p>Đang nâng cấp chất lượng (Upscale 2K)...</p>
                                <div class="timer-badge">{{ task.elapsedTime }}.{{ timeMou }}s</div>
                            </div>

                            <!-- Trạng thái Lỗi -->
                            <div v-if="task.status === 'error'" class="error-state">
                                <XCircle :size="48" class="error-icon" />
                                <p>Đã xảy ra lỗi</p>
                                <small>{{ task.error }}</small>
                            </div>

                            <!-- Trạng thái Thành công (Ảnh) -->
                            <div v-if="task.status === 'success' && task.mode === 'image'" class="result-wrapper">
                                <img :src="task.result" alt="Generated AI" class="result-media" />
                            </div>

                            <!-- Trạng thái Thành công (Video) -->
                            <div v-if="task.status === 'success' && task.mode === 'video'" class="result-wrapper">
                                <video :src="task.result" controls autoplay loop class="result-media"></video>
                            </div>

                            <!-- Action Bar (Chỉ hiện khi hoàn thành) -->
                            <div class="action-bar" v-if="task.status === 'success'">
                                <div class="meta-info">
                                    <span class="badge">
                                        {{task.mode === 'image'
                                            ? modelOptions.find(m => m.value === task.model)?.label
                                            : videoModelOptions.find(m => m.value === task.model)?.label}}
                                    </span>
                                    <span v-if="task.mode === 'image'" class="badge">{{ task.ratio }}</span>
                                    <span v-if="task.mode === 'video'" class="badge">Adherence: {{ task.adherence
                                        }}</span>
                                    <span v-if="task.isUpscaled" class="badge upscaled">2K Resolution</span>
                                </div>
                                <div class="actions">
                                    <!-- Nút Upscale cho Ảnh (Chỉ hiện khi là mode image và chưa upscale) -->
                                    <button v-if="task.mode === 'image' && !task.isUpscaled"
                                        class="action-btn secondary" @click="handleUpscale(task)">
                                        <Scaling :size="16" /> Upscale 2K
                                    </button>

                                    <!-- Nút Tải xuống -->
                                    <a :href="task.result" target="_blank" download class="action-btn primary"
                                        style="text-decoration: none;">
                                        <Download :size="16" /> Tải xuống
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </main>
        </div>
    </div>
</template>

<style scoped>
/* KẾ THỪA CSS VARIABLES */
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

.page-wrap {
    width: 100%;
    max-width: 1440px;
    margin: 0 auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-height: 100vh;
}

/* HEADER & TABS */
.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
}

.title-row {
    display: flex;
    align-items: center;
    gap: 16px;
}

.icon-wrapper {
    background: var(--color-accent-bg-fade-2);
    padding: 12px;
    border-radius: 12px;
    border: 1px solid var(--color-accent-bg-fade-1);
}

.title-icon {
    color: var(--color-accent);
}

.title-row h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
}

.title-row p {
    margin: 4px 0 0;
    color: var(--color-text-muted);
    font-size: 14px;
}

.mode-switcher {
    display: flex;
    background: var(--color-bg-elevated);
    padding: 6px;
    border-radius: 14px;
    border: 1px solid var(--color-border);
}

.mode-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 14px;
    font-weight: 500;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.mode-btn:hover {
    color: var(--color-text);
}

.mode-btn.active {
    background: var(--color-bg-soft);
    color: var(--color-accent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* WORKSPACE LAYOUT */
.workspace-layout {
    display: grid;
    grid-template-columns: 360px 1fr;
    gap: 24px;
    flex: 1;
}

/* BẢNG ĐIỀU KHIỂN (CỘT TRÁI) */
.control-panel {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    height: fit-content;
    position: sticky;
    top: 24px;
}

.panel-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
}

.section-header h3 {
    margin: 0;
    font-size: 14px;
    color: var(--color-text);
    font-weight: 600;
}

.clear-btn {
    font-size: 12px;
    color: var(--color-danger);
    cursor: pointer;
    transition: opacity 0.2s;
}

.clear-btn:hover {
    opacity: 0.8;
}

/* UPLOAD ZONE CHUNG */
.upload-zone {
    border: 2px dashed var(--color-border);
    border-radius: 12px;
    background: var(--color-bg-soft);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    overflow: hidden;
}

.upload-zone:hover {
    border-color: var(--color-accent-strong);
    background: var(--color-accent-bg-fade-2);
}

.upload-placeholder {
    width: 100%;
    min-height: 120px;
    text-align: center;
    padding: 24px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

.upload-icon {
    color: var(--color-text-muted);
    margin-bottom: 4px;
}

.upload-placeholder span {
    font-size: 14px;
    font-weight: 500;
}

.upload-placeholder small {
    color: var(--color-text-muted);
    font-size: 12px;
}

/* UPLOAD ZONE (CHIA 2 Ô CHO VIDEO MOTION) */
.motion-inputs-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.upload-zone.split {
    min-height: 130px;
    text-align: center;
}

.upload-zone.split span {
    font-size: 13px;
    font-weight: 500;
    margin-top: 8px;
}

.upload-zone.split small {
    font-size: 11px;
    color: var(--color-text-muted);
    margin-top: 2px;
}

/* THUMBNAILS PREVIEW */
.preview-thumbnails {
    display: flex;
    gap: 8px;
    padding: 12px;
    width: 100%;
    flex-wrap: wrap;
    min-height: 120px;
}

.thumb-img {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid var(--color-border);
}

.add-more-thumb {
    width: 60px;
    height: 60px;
    border-radius: 8px;
    border: 1px dashed var(--color-text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.2s;
}

.add-more-thumb:hover {
    color: var(--color-text);
    border-color: var(--color-text);
    background: var(--color-bg-elevated);
}

.thumb-img-large {
    width: 100%;
    height: 130px;
    object-fit: cover;
    border-radius: 8px;
    background: var(--color-bg);
}

.video-thumb-large {
    width: 100%;
    height: 130px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: rgba(0, 0, 0, 0.2);
}

.file-name {
    font-size: 12px;
    color: var(--color-text-muted);
    max-width: 90%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0 8px;
}

/* INPUTS & SELECTS */
.prompt-input {
    width: 100%;
    background: var(--color-bg-soft);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: 16px;
    color: var(--color-text);
    font-family: inherit;
    font-size: 14px;
    resize: vertical;
    transition: border-color 0.2s;
}

.prompt-input:focus {
    outline: none;
    border-color: var(--color-accent);
}

.parameters {
    padding-top: 16px;
    border-top: 1px solid var(--color-border);
}

.settings-grid {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 12px;
}

.field-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.field-wrap label {
    font-size: 12px;
    color: var(--color-text-muted);
}

select {
    width: 100%;
    background: var(--color-bg-soft);
    border: 1px solid var(--color-border);
    color: var(--color-text);
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    cursor: pointer;
}

/* SLIDER CHUYỂN ĐỘNG (VIDEO) */
.slider-wrap {
    margin-top: 8px;
}

.slider-header {
    display: flex;
    justify-content: space-between;
}

.styled-slider {
    -webkit-appearance: none;
    width: 100%;
    height: 6px;
    background: var(--color-bg-soft);
    border-radius: 4px;
    outline: none;
    border: 1px solid var(--color-border);
}

.styled-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-accent);
    cursor: pointer;
    box-shadow: 0 0 10px var(--color-accent-glow-strong);
}

/* NÚT GENERATE */
.generate-btn {
    margin-top: auto;
    width: 100%;
    padding: 16px;
    border: none;
    border-radius: 12px;
    background: var(--color-accent);
    color: var(--color-text-on-accent);
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    cursor: pointer;
    box-shadow: 0 4px 20px var(--color-accent-bg-fade-1);
    transition: all 0.3s ease;
}

.generate-btn:hover:not(:disabled) {
    background: var(--color-accent-strong);
    box-shadow: 0 0 20px var(--color-accent-glow-strong);
    transform: translateY(-2px);
}

.generate-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
}

/* PREVIEW PANEL (CỘT PHẢI) */
.preview-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100%;
    max-height: 85vh;
    overflow-y: auto;
    padding-right: 8px;
    /* Offset for scrollbar */
}

/* Custom scrollbar cho Preview Panel */
.preview-panel::-webkit-scrollbar {
    width: 6px;
}

.preview-panel::-webkit-scrollbar-track {
    background: transparent;
}

.preview-panel::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 4px;
}

.preview-container {
    flex: 1;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 600px;
}

.preview-container.is-empty {
    background: repeating-conic-gradient(var(--color-bg-soft) 0% 25%,
            var(--color-bg-elevated) 0% 50%) 50% / 20px 20px;
}

.empty-state {
    text-align: center;
    color: var(--color-text-muted);
}

.empty-icon {
    margin-bottom: 16px;
    opacity: 0.3;
}

.empty-state p {
    font-size: 18px;
    margin: 0 0 8px;
    color: var(--color-text);
}

/* TASK STATS BAR */
.tasks-list-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.task-stats {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    padding: 12px 20px;
    border-radius: 12px;
    font-size: 14px;
    color: var(--color-text-muted);
}

.task-stats strong {
    color: var(--color-text);
}

.task-stats .text-accent {
    color: var(--color-accent);
}

.task-stats .dot {
    color: var(--color-border);
}

/* TASKS LIST & TASK CARD */
.tasks-list {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.task-card {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    border-radius: 16px;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 75vh;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
}

.remove-task-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    background: rgba(0, 0, 0, 0.5);
    color: var(--color-text-muted);
    border: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 20;
    transition: all 0.2s;
}

.remove-task-btn:hover {
    background: var(--color-danger);
    color: #fff;
    transform: scale(1.1);
}

/* Loading State (Glow & Scanline) */
.loading-state {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(19, 21, 26, 0.8);
    backdrop-filter: blur(8px);
    z-index: 10;
}

.glow-orb {
    width: 80px;
    height: 80px;
    background: var(--color-accent);
    border-radius: 50%;
    filter: blur(40px);
    animation: pulse 2s ease-in-out infinite alternate;
}

@keyframes pulse {
    0% {
        transform: scale(0.8);
        opacity: 0.5;
    }

    100% {
        transform: scale(1.2);
        opacity: 0.8;
    }
}

.scan-line {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 4px;
    background: var(--color-accent);
    box-shadow: 0 0 10px var(--color-accent), 0 0 20px var(--color-accent);
    animation: scan 2s linear infinite;
}

@keyframes scan {
    0% {
        top: 0;
        opacity: 0;
    }

    10% {
        opacity: 1;
    }

    90% {
        opacity: 1;
    }

    100% {
        top: 100%;
        opacity: 0;
    }
}

.loading-state p {
    margin-top: 20px;
    font-weight: 500;
    color: var(--color-accent);
    text-shadow: 0 0 10px var(--color-accent-glow-strong);
}

.timer-badge {
    margin-top: 12px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid var(--color-border);
    padding: 6px 16px;
    border-radius: 20px;
    font-size: 14px;
    color: var(--color-text);
    font-variant-numeric: tabular-nums;
}

/* Error State */
.error-state {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: rgba(19, 21, 26, 0.9);
    z-index: 10;
}

.error-icon {
    color: var(--color-danger);
    margin-bottom: 16px;
}

.error-state p {
    font-weight: 600;
    color: var(--color-danger);
    font-size: 18px;
    margin: 0 0 8px;
}

.error-state small {
    color: var(--color-text-muted);
}

/* Result Media */
.result-wrapper {
    width: 100%;
    padding: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    background: var(--color-bg);
}

.result-media {
    max-width: 100%;
    max-height: 75vh;
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    object-fit: contain;
}

/* ACTION BAR TRONG TỪNG TASK CARD */
.action-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--color-bg-elevated);
    padding: 16px 20px;
    border-top: 1px solid var(--color-border);
}

.meta-info {
    display: flex;
    gap: 8px;
}

.badge {
    background: var(--color-bg-soft);
    border: 1px solid var(--color-border);
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    color: var(--color-text-muted);
}

.badge.upscaled {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.3);
    color: #60a5fa;
}

.actions {
    display: flex;
    gap: 12px;
}

.action-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
    border: 1px solid transparent;
}

.action-btn.primary {
    background: var(--color-text);
    border-color: var(--color-text);
    color: #000;
}

.action-btn.primary:hover {
    opacity: 0.9;
    transform: translateY(-1px);
}

.action-btn.secondary {
    background: transparent;
    border-color: var(--color-border);
    color: var(--color-text);
}

.action-btn.secondary:hover {
    background: var(--color-bg-soft);
    border-color: var(--color-text-muted);
}

/* RESPONSIVE */
@media (max-width: 1024px) {
    .workspace-layout {
        grid-template-columns: 300px 1fr;
    }
}

@media (max-width: 820px) {
    .workspace-layout {
        grid-template-columns: 1fr;
    }

    .control-panel {
        position: static;
    }

    .preview-panel {
        min-height: 400px;
        max-height: none;
        overflow-y: visible;
    }

    .page-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .mode-switcher {
        width: 100%;
    }

    .mode-btn {
        flex: 1;
        justify-content: center;
    }
}
</style>