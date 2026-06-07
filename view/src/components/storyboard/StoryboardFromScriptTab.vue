<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import {
    Sparkles,
    Upload,
    X,
    User,
    Users,
    Loader2,
    Image as ImageIcon,
    Video,
    Trees,
    RefreshCw,
    Paintbrush,
    Save,
} from 'lucide-vue-next'
import { callGeminiStructured, getSettings } from '@/services/nanoai.js'
import {
    GEMINI_STORYBOARD_OUTLINE_SCHEMA,
    GEMINI_STORYBOARD_SCENE_BATCH_SCHEMA,
    GEMINI_STORYBOARD_SCENE_SHOTS_SCHEMA,
    GEMINI_CHARACTER_REF_PROMPT_SCHEMA,
} from '@/services/storyboardSchemas.js'
import { buildScenePrompt, buildEnvironmentImagePrompt, normalizeEnvironmentPrompt, buildEnvironmentStyleContext, getEnvironmentPromptTemplate, buildShotFrameImagePrompt, normalizeShotFrameImagePrompt, getShotFramePromptTemplate, buildCharacterRefImagePrompt, normalizeCharacterRefPrompt, getCharacterRefPromptTemplate, buildCharacterStyleContext, resolveProjectStyle, getVideoBlocksJsonTemplate, applyProjectStyleToVideoBlocks } from '@/services/storyboardPromptBuilder.js'
import { estimateSceneCount, parseDurationSec, STORYBOARD_CHARACTER_REF_ASPECT_CSS, storyboardCharacterRefPreviewWidth } from '@/utils/storyboardAspect.js'
import { storyboardLanguagePromptLabel } from '@/utils/storyboardOptions.js'
import {
    createMediaTask,
    runStoryboardImageGen,
    runStoryboardVideoGen,
    downloadMediaResult,
    storyboardShotFrameRefs,
    storyboardSceneVideoFrame,
} from '@/composables/useStoryboardSceneGen.js'
import StoryboardSceneSection from './StoryboardSceneSection.vue'
import StoryboardMediaPreview from './StoryboardMediaPreview.vue'
import StoryboardCharacterPickerPopup from './StoryboardCharacterPickerPopup.vue'
import StoryboardCharacterFormPopup from './StoryboardCharacterFormPopup.vue'
import { notify } from '@/composables/useNotify.js'
import { storyboardService } from '@/services/storyboard.service.js'
import { storyboardCharacterService } from '@/services/storyboardCharacter.service.js'
import {
    persistStoryboardAsset,
    MAX_STORYBOARD_CHARACTERS,
    MAX_CHARACTER_STYLE_REFS,
    makeSceneRow,
    makeShotRow,
    makeGeneratedCharacterRow,
    normalizeCharacterRefStyleRefUrl,
} from '@/utils/storyboardProject.js'
import { storyboardShotVideoPrompt } from '@/services/storyboardPromptBuilder.js'

const props = defineProps({
    projectId: { type: String, required: true },
    editor: { type: Object, required: true },
    settings: { type: Object, required: true },
    templateDefaults: { type: Object, required: true },
    view: {
        type: String,
        default: 'scenes',
        validator: (v) => ['setup', 'scenes', 'all'].includes(v),
    },
})

const emit = defineEmits(['open-setup', 'generating-change', 'progress-change', 'minimize-setup', 'bulk-env-change'])

const SCENE_BATCH_SIZE = 3

const showSetup = computed(() => props.view === 'setup' || props.view === 'all')
const showScenes = computed(() => props.view === 'scenes' || props.view === 'all')

const { t } = useI18n()

const BULK_PARALLEL = 5

const fileInputRef = ref(null)
const styleFileInputRef = ref(null)
const characterPickerOpen = ref(false)
const saveCharacterOpen = ref(false)
const saveCharacterDraft = ref(null)
const activeSceneIndex = ref(null)
let sceneNavObserver = null

const isGenerating = ref(false)
const genProgress = ref({ phase: '', current: 0, total: 0, label: '' })
const isBulkImageGen = ref(false)
const isBulkVideoGen = ref(false)
const isBulkEnvGen = ref(false)
const bulkProgress = ref({ kind: '', current: 0, total: 0 })

const MIN_SHOTS_PER_SCENE = 1
const MAX_SHOTS_PER_SCENE = 6

const clampShotCount = (n) => Math.min(MAX_SHOTS_PER_SCENE, Math.max(MIN_SHOTS_PER_SCENE, Number(n) || MIN_SHOTS_PER_SCENE))

const ensureGeneratedCharacters = () => {
    if (!Array.isArray(props.editor.generatedCharacters)) {
        props.editor.generatedCharacters = []
    }
    for (const char of props.editor.generatedCharacters) {
        if (!char.imageTask) char.imageTask = createMediaTask()
        if (char.imageUrl && char.imageTask.status !== 'success') {
            char.imageTask.status = 'success'
            char.imageTask.result = storyboardService.assetUrl(char.imageUrl)
        }
    }
}

ensureGeneratedCharacters()

const outlineCharacters = computed(() => {
    const list = props.editor.outline?.characters
    if (!Array.isArray(list)) return []
    return list.slice(0, MAX_STORYBOARD_CHARACTERS)
})

const generatedCharacterRows = computed(() => {
    ensureGeneratedCharacters()
    return props.editor.generatedCharacters.filter((char) => char.prompt?.trim())
})

const isCharacterRefGenBusy = computed(() =>
    props.editor.generatedCharacters?.some((char) => char.imageTask?.status === 'generating'),
)

const pendingCharacterRefRows = computed(() =>
    generatedCharacterRows.value.filter(
        (char) => char.imageTask?.status !== 'generating' && char.imageTask?.status !== 'success',
    ),
)

const charIndexInEditor = (char) => props.editor.generatedCharacters.indexOf(char)

const ensureCharacterRefStyle = () => {
    if (typeof props.editor.characterRefStyle !== 'string') {
        props.editor.characterRefStyle = ''
    }
}

const ensureCharacterRefStyleRefs = () => {
    if (!Array.isArray(props.editor.characterRefStyleRefs)) {
        props.editor.characterRefStyleRefs = []
    }
}

ensureCharacterRefStyle()
ensureCharacterRefStyleRefs()

const showCharacterStyleInput = ref(false)

const defaultCharacterRefStyle = computed(() => {
    const td = props.templateDefaults
    return resolveProjectStyle({
        stylePreset: props.settings.stylePreset,
        visualStyle: [td.style, props.settings.stylePreset].filter(Boolean).join(', '),
    }) || 'cinematic illustration'
})

const charStyleContext = () => {
    ensureCharacterRefStyle()
    ensureCharacterRefStyleRefs()
    return buildCharacterStyleContext({
        settings: props.settings,
        templateDefaults: props.templateDefaults,
        characterRefStyle: props.editor.characterRefStyle,
        characterRefStyleRefs: props.editor.characterRefStyleRefs,
    })
}

const characterStyleRefUrls = () => {
    ensureCharacterRefStyleRefs()
    return (props.editor.characterRefStyleRefs || [])
        .map((url) => storyboardService.assetUrl(normalizeCharacterRefStyleRefUrl(url)))
        .filter(Boolean)
        .slice(0, MAX_CHARACTER_STYLE_REFS)
}

const canAddMoreStyleRefs = computed(() => {
    ensureCharacterRefStyleRefs()
    return props.editor.characterRefStyleRefs.length < MAX_CHARACTER_STYLE_REFS
})

const applyCharacterRefStyleToPrompts = () => {
    const ctx = charStyleContext()
    for (const char of props.editor.generatedCharacters || []) {
        if (char.prompt?.trim()) {
            char.prompt = normalizeCharacterRefPrompt(char.prompt, ctx)
        }
    }
}

const durationSec = computed(() => parseDurationSec(props.settings.duration))
const estimatedScenes = computed(() => estimateSceneCount(durationSec.value))
const canGenerate = computed(() => props.editor.ideaText.trim().length >= 10)

const ensureUserCharacterImages = () => {
    if (!Array.isArray(props.editor.userCharacterImages)) {
        props.editor.userCharacterImages = props.editor.userCharacterImageUrl
            ? [props.editor.userCharacterImageUrl]
            : []
    }
}

ensureUserCharacterImages()

const ensureLibraryCharacterRefs = () => {
    if (!Array.isArray(props.editor.libraryCharacterRefs)) {
        props.editor.libraryCharacterRefs = []
    }
}

ensureLibraryCharacterRefs()

const userCharacterPreviewUrls = computed(() => {
    ensureUserCharacterImages()
    return (props.editor.userCharacterImages || [])
        .map((url) => storyboardService.assetUrl(url))
        .filter(Boolean)
        .slice(0, MAX_STORYBOARD_CHARACTERS)
})

const libraryCharacterPreviewUrls = computed(() => {
    ensureLibraryCharacterRefs()
    return (props.editor.libraryCharacterRefs || [])
        .map((ref) => storyboardCharacterService.assetUrl(ref.imageUrl))
        .filter(Boolean)
        .slice(0, MAX_STORYBOARD_CHARACTERS)
})

const characterCount = computed(() =>
    userCharacterPreviewUrls.value.length + libraryCharacterPreviewUrls.value.length,
)

const canAddMoreCharacters = computed(() => characterCount.value < MAX_STORYBOARD_CHARACTERS)

const characterRefUrls = computed(() => {
    const combined = [
        ...userCharacterPreviewUrls.value,
        ...libraryCharacterPreviewUrls.value,
    ].slice(0, MAX_STORYBOARD_CHARACTERS)
    if (combined.length) return combined
    ensureGeneratedCharacters()
    return props.editor.generatedCharacters
        .filter((char) => char.imageTask?.status === 'success' && char.imageTask?.result)
        .map((char) => char.imageTask.result)
        .slice(0, MAX_STORYBOARD_CHARACTERS)
})

const outlineImageUrls = computed(() =>
    [...userCharacterPreviewUrls.value, ...libraryCharacterPreviewUrls.value].slice(0, MAX_STORYBOARD_CHARACTERS),
)

const libraryCharacterBlock = () => {
    ensureLibraryCharacterRefs()
    const refs = props.editor.libraryCharacterRefs || []
    if (!refs.length) return ''
    const lines = refs.map((c, i) =>
        `${i + 1}. ${c.name || 'Character'}${c.role ? ` (${c.role})` : ''}: ${c.description || '(no description)'}`,
    ).join('\n')
    return `
NHÂN VẬT TỪ THƯ VIỆN (BẮT BUỘC — PHẢI dùng đúng name, description, role trong characters[] và characterBible):
${lines}
- KHÔNG đổi tên, ngoại hình hay vai trò các nhân vật trên trừ khi kịch bản không đề cập.
- characterBible phải mô tả đồng bộ các nhân vật thư viện này.`
}

const needsCharacterGen = computed(() =>
    characterCount.value === 0 && generatedCharacterRows.value.length > 0,
)
const characterRefAspect = STORYBOARD_CHARACTER_REF_ASPECT_CSS
const characterRefPreviewWidth = storyboardCharacterRefPreviewWidth()

const totalShotCount = computed(() =>
    props.editor.scenes.reduce((sum, scene) => sum + (scene.shots?.length || 0), 0),
)

const allShots = computed(() => {
    const items = []
    for (const scene of props.editor.scenes) {
        if (scene.scriptStatus !== 'done') continue
        for (const shot of scene.shots || []) {
            if (shot.scriptStatus === 'done') items.push({ scene, shot })
        }
    }
    return items
})

const pendingEnvironmentScenes = computed(() =>
    props.editor.scenes.filter(
        (scene) =>
            scene.scriptStatus === 'done'
            && scene.environmentPrompt?.trim()
            && scene.environmentImageTask?.status !== 'generating'
            && scene.environmentImageTask?.status !== 'success',
    ),
)

const pendingFrameShots = computed(() =>
    allShots.value.filter(
        ({ shot }) => shot.firstFrameTask?.status !== 'generating' && shot.firstFrameTask?.status !== 'success',
    ),
)

const pendingVideoShots = computed(() =>
    allShots.value.filter(
        ({ shot }) =>
            shot.firstFrameTask?.status === 'success'
            && shot.videoTask?.status !== 'generating'
            && shot.videoTask?.status !== 'success',
    ),
)

const isSceneExpanded = (sceneIndex) => props.editor.expandedScenes?.[sceneIndex] !== false

const toggleSceneExpanded = (sceneIndex) => {
    if (!props.editor.expandedScenes) props.editor.expandedScenes = {}
    props.editor.expandedScenes[sceneIndex] = !isSceneExpanded(sceneIndex)
}

const isBulkBusy = computed(() => isBulkImageGen.value || isBulkVideoGen.value || isBulkEnvGen.value)

const buildRules = () => [
    ...(props.templateDefaults.rules || []),
    'ZERO visible text in any image frame',
    'NO speech bubbles, NO dialogue balloons, NO captions in images',
    'NARRATOR is voice-over only',
    'Only the character defined in the Audio tag may speak.',
]

const projectStyleContext = () => envStyleContext()

const projectStyleDirective = () => {
    const ctx = projectStyleContext()
    return [
        `stylePreset (BẮT BUỘC): "${props.settings.stylePreset}"`,
        `visualStyle (BẮT BUỘC — dạng "Tên style - Mô tả"): "${resolveProjectStyle(ctx)}"`,
        `aspectRatio: "${props.settings.aspectRatio}"`,
        'visualStyle PHẢI khớp đúng phong cách đã chọn — dùng format "Style Name - Description" từ stylePreset',
    ].join('\n')
}

const buildOutlinePrompt = () => {
    const td = props.templateDefaults
    return `Bạn là chuyên gia viết kịch bản video AI điện ảnh.

BƯỚC 1 — PHÂN TÍCH & DÀN Ý:
- Hiểu kịch bản, phân tích luồng kịch bản (narrativeFlow).
- Video gồm nhiều CẢNH (scene). Mỗi cảnh là một đơn vị địa điểm/hành động (vd: trò chuyện ở khu vườn).
- KHÔNG viết shot hay prompt chi tiết ở bước này.

PHONG CÁCH DỰ ÁN (dùng xuyên suốt mọi prompt sau này):
${projectStyleDirective()}

YÊU CẦU:
- Ngôn ngữ thoại: ${storyboardLanguagePromptLabel(props.settings.language)}
- Tổng thời lượng: ${durationSec.value} giây
- Tỷ lệ khung hình: ${props.settings.aspectRatio}
- Số cảnh: khoảng ${estimatedScenes.value} cảnh, mỗi cảnh 8-20 giây, tổng gần ${durationSec.value}s

Ý TƯỞNG:
${props.editor.ideaText.trim()}

Gợi ý template (tham khảo, KHÔNG ghi đè stylePreset):
- Character: ${td.character}
- Mood: ${td.mood}
- Lighting: ${td.lighting}

${libraryCharacterBlock()}

${characterCount.value
    ? `Người dùng đã cung cấp ${characterCount.value} nhân vật tham chiếu (ảnh tải lên hoặc thư viện) — characterBible và characters[] mô tả khớp từng nhân vật.`
    : `Chưa có ảnh nhân vật — PHÂN TÍCH kịch bản và liệt kê nhân vật chính trong characters[] (tối đa ${MAX_STORYBOARD_CHARACTERS} người có mặt trên màn hình). Mỗi nhân vật: name, description (tuổi, giới, tóc, mắt, trang phục), role. characterBible tóm tắt đồng bộ toàn bộ. Nếu chỉ có lời dẫn/VO không có nhân vật hình ảnh → characters = [].`}

Trả JSON: title, summary, narrativeFlow, characterBible, characters[{name, description, role}], scenes[{index, label, durationSec, beat, location}].`
}

const buildCharacterRefPrompt = (characters = []) => {
    const styleCtx = charStyleContext()
    const templateExample = getCharacterRefPromptTemplate(styleCtx)
    const styleRefCount = characterStyleRefUrls().length
    const styleRefLine = styleRefCount
        ? `- Đã có ${styleRefCount} ảnh tham chiếu STYLE — đặt style.useStyleRefs = true, KHÔNG mô tả lại style bằng lời khác`
        : ''
    const charLines = characters.length
        ? characters.map((c, i) =>
            `${i + 1}. ${c.name}: ${c.description}${c.role ? ` (${c.role})` : ''}`,
        ).join('\n')
        : `Tự suy luận từ Character Bible — tách từng nhân vật chính (tối đa ${MAX_STORYBOARD_CHARACTERS}).`

    return `Viết prompt JSON (tiếng Anh) để TẠO ẢNH THAM CHIẾU NHÂN VẬT — mỗi nhân vật một object imagePrompt riêng.

PHONG CÁCH DỰ ÁN:
${projectStyleDirective()}

Danh sách nhân vật (mỗi người = 1 ảnh riêng):
${charLines}

Character Bible:
${props.editor.outline?.characterBible || ''}

Mẫu JSON imagePrompt (copy cấu trúc, điền nội dung):

${templateExample}

Yêu cầu BẮT BUỘC:
- MỖI nhân vật = MỘT phần tử trong mảng characters
${styleRefLine}
- imagePrompt là OBJECT JSON (không phải chuỗi text) — type = "character_reference"
- style.preset và style.visualStyle PHẢI khớp phong cách dự án ở trên
- style.visualStyle KHÔNG được mặc định anime nếu stylePreset khác anime
- character: điền đủ name, age, gender, hair, eyes, skinTone, outfit, accessories, distinguishingFeatures
- KHÔNG thêm pose/background/camera/lighting/quality — hệ thống tự gán cố định
- MỖI imagePrompt CHỈ mô tả ĐÚNG MỘT nhân vật
- Tối đa ${MAX_STORYBOARD_CHARACTERS} nhân vật
- KHÔNG text, logo, watermark trên ảnh

Trả JSON: characters[{characterName, imagePrompt}]`
}

const formatOutlineCharacterNames = () => {
    const names = outlineCharacters.value.map((c) => c.name).filter(Boolean)
    if (names.length) return names.join(', ')
    return props.editor.outline?.characterBible || ''
}

const buildSceneBatchPrompt = (batch) => {
    const td = props.templateDefaults
    const styleCtx = {
        visualStyle: td.style,
        stylePreset: props.settings.stylePreset,
        lighting: td.lighting,
        mood: td.mood,
        environment: td.environment,
        aspectRatio: props.settings.aspectRatio,
    }
    const templateExample = getEnvironmentPromptTemplate(styleCtx)
    const sceneLines = batch.map((s) =>
        `- Scene ${s.index}: ${s.label} | ${s.durationSec}s | ${s.location} | ${s.beat}`,
    ).join('\n')
    return `Chuẩn bị prompt JSON môi trường (background plate) cho từng cảnh storyboard.

PHONG CÁCH DỰ ÁN:
${projectStyleDirective()}

DỰ ÁN: ${props.editor.outline?.title}
Luồng kịch bản: ${props.editor.outline?.narrativeFlow || props.editor.outline?.summary}

Các cảnh cần làm giàu (tối đa ${SCENE_BATCH_SIZE} cảnh):
${sceneLines}

Với MỖI cảnh, trả environmentPrompt là OBJECT JSON (không phải chuỗi text):

${templateExample}

QUY TẮC JSON:
- type = "environment_image"
- style.preset và style.visualStyle PHẢI khớp phong cách dự án — KHÔNG mặc định anime
- scene.location + scene.description: mô tả địa điểm cụ thể — CẢNH TRỐNG, không người, không động vật
- scene.time, scene.weather, scene.objects[], scene.atmosphere: điền đầy đủ
- lighting: ánh sáng phù hợp mood "${td.mood}"
- KHÔNG thêm camera/quality/sceneType — hệ thống tự gán theo aspectRatio
- Bố cục portrait: mô tả cảnh theo chiều dọc (trời trên, đất dưới) nếu aspectRatio = 9:16
- CẤM sinh vật sống, CẤM split screen / comic strip

shotCount: số shot đề xuất — tự quyết từ ${MIN_SHOTS_PER_SCENE} đến ${MAX_SHOTS_PER_SCENE}

Trả JSON scenes[{index, environmentPrompt, shotCount}]`
}

const buildSceneShotsPrompt = (scene, prevBeat) => {
    const td = props.templateDefaults
    const styleCtx = projectStyleContext()
    const frameTemplate = getShotFramePromptTemplate(styleCtx)
    const videoBlocksTemplate = JSON.stringify(
        getVideoBlocksJsonTemplate(styleCtx, td),
        null,
        2,
    )
    const targetShots = scene.shotCount
        ? clampShotCount(scene.shotCount)
        : null
    const shotCountGuide = targetShots
        ? `Sinh đúng ${targetShots} shot cho cảnh này (có thể lệch ±1 nếu beat thực sự cần).`
        : `Sinh từ ${MIN_SHOTS_PER_SCENE} đến ${MAX_SHOTS_PER_SCENE} shot — tự quyết định theo beat và thời lượng.`
    return `Viết TẤT CẢ SHOT trong 1 CẢNH storyboard — output JSON có cấu trúc rõ ràng.

PHONG CÁCH DỰ ÁN:
${projectStyleDirective()}

CẤU TRÚC: Video → Cảnh (scene) → Nhiều Shot. Mỗi shot = 1 góc máy/khoảnh khắc ngắn.

DỰ ÁN:
- Tiêu đề: ${props.editor.outline?.title}
- Character Bible: ${props.editor.outline?.characterBible}
- Nhân vật chính: ${formatOutlineCharacterNames()}
- Ngôn ngữ thoại: ${storyboardLanguagePromptLabel(props.settings.language)}

CẢNH:
- ${scene.label} (index ${scene.index})
- Địa điểm: ${scene.location}
- Thời lượng: ${scene.durationSec}s
- Beat: ${scene.beat}
- Environment JSON: ${scene.environmentPrompt}
${prevBeat ? `- Cảnh trước: ${prevBeat}` : ''}

YÊU CẦU MỖI SHOT:

1) imagePrompt — OBJECT JSON (type = "shot_first_frame"), mẫu:
${frameTemplate}

   - style.preset + style.visualStyle PHẢI khớp phong cách dự án
   - character: CHỈ pose/expression/position/action — ngoại hình lấy từ character ref
   - KHÔNG mô tả lại background — dùng environment reference image
   - framing.aspectRatio = "${props.settings.aspectRatio}" — frame cuối PHẢI khớp tỷ lệ dự án
   - TỶ LỆ & HÀI HÒA CẢNH-NHÂN VẬT (BẮT BUỘC):
     + Nhân vật phải có scale, depth, perspective hài hòa với environment ref — không quá to/nhỏ, không trông như dán lên
     + composition: mô tả cách nhân vật ngồi trong khung — cân bố cục với cảnh (rule of thirds khi phù hợp)
     + camera: chọn góc quay, khoảng cách, loại shot (medium/wide/close-up) tối ưu cho tỷ lệ ${props.settings.aspectRatio}
     + Có thể thay đổi góc quay/hướng khung hình để frame đẹp nhất — KHÔNG đổi ngoại hình nhân vật
     + framing.harmonyNotes: ghi chú cụ thể cho shot này về cách cân bố cục nhân vật-cảnh

2) blocks — OBJECT JSON cho gen VIDEO, mẫu 12 khối:
${videoBlocksTemplate}

   - blocks.style.preset = "${props.settings.stylePreset}"
   - blocks.style.visualStyle = "${resolveProjectStyle(styleCtx)}"
   - blocks.character.name phải khớp tên nhân vật trong dự án
   - blocks.scene.shot + blocks.camera: chọn góc quay/khoảng cách để nhân vật hài hòa với khung cảnh ở tỷ lệ ${props.settings.aspectRatio}
   - blocks.audio.text: thoại bằng ${storyboardLanguagePromptLabel(props.settings.language)}
   - blocks.rules: ${buildRules().join(' | ')}
   - KHÔNG text/speech bubble trong mô tả hình ảnh

- durationSec: 3-8 giây mỗi shot, tổng gần ${scene.durationSec}s
- ${shotCountGuide}
- Tối thiểu ${MIN_SHOTS_PER_SCENE}, tối đa ${MAX_SHOTS_PER_SCENE} shot

Trả JSON shots[{index, label, durationSec, imagePrompt, blocks}]`
}

const triggerUpload = () => {
    fileInputRef.value.value = ''
    fileInputRef.value.click()
}

const onFileSelected = async (event) => {
    ensureUserCharacterImages()
    const files = Array.from(event.target.files || []).filter((f) => f.type?.startsWith('image/'))
    if (!files.length) return

    const slotsLeft = MAX_STORYBOARD_CHARACTERS - characterCount.value
    if (slotsLeft <= 0) {
        notify.alert({
            title: t('storyboard.characterLimitTitle'),
            message: t('storyboard.characterLimitMessage', { max: MAX_STORYBOARD_CHARACTERS }),
            variant: 'warning',
        })
        return
    }

    for (const file of files.slice(0, slotsLeft)) {
        const res = await storyboardService.saveAssetFile(props.projectId, file, { kind: 'character-upload' })
        if (res?.success) {
            const saved = res.data?.relativeUrl || res.data?.url
            if (saved) props.editor.userCharacterImages.push(saved)
        }
    }
    props.editor.characterRef.source = props.editor.userCharacterImages.length ? 'upload' : 'none'
    props.editor.generatedCharacters = []
}

const removeImage = (index) => {
    ensureUserCharacterImages()
    props.editor.userCharacterImages.splice(index, 1)
    if (!props.editor.userCharacterImages.length && !props.editor.libraryCharacterRefs?.length) {
        props.editor.characterRef.source = 'none'
    }
}

const openCharacterPicker = () => {
    if (!canAddMoreCharacters.value) {
        notify.alert({
            title: t('storyboard.characterLimitTitle'),
            message: t('storyboard.characterLimitMessage', { max: MAX_STORYBOARD_CHARACTERS }),
            variant: 'warning',
        })
        return
    }
    characterPickerOpen.value = true
}

const onLibraryCharactersPicked = (selected) => {
    ensureLibraryCharacterRefs()
    const maxLib = MAX_STORYBOARD_CHARACTERS - userCharacterPreviewUrls.value.length
    props.editor.libraryCharacterRefs = selected.slice(0, maxLib).map((char) => ({
        libraryId: char.id,
        name: char.name || '',
        description: char.description || '',
        role: char.role || '',
        imageUrl: char.imageUrl || null,
        prompt: char.prompt || '',
    }))
    if (props.editor.libraryCharacterRefs.length) {
        props.editor.characterRef.source = 'library'
        props.editor.generatedCharacters = []
    } else if (!props.editor.userCharacterImages?.length) {
        props.editor.characterRef.source = 'none'
    }
}

const removeLibraryCharacter = (index) => {
    ensureLibraryCharacterRefs()
    props.editor.libraryCharacterRefs.splice(index, 1)
    if (!props.editor.libraryCharacterRefs.length && !props.editor.userCharacterImages?.length) {
        props.editor.characterRef.source = 'none'
    }
}

const outlineCharFor = (char) => outlineCharacters.value.find(
    (c) => c.name && char.name && c.name.toLowerCase() === char.name.toLowerCase(),
)

const openSaveCharacter = (char) => {
    const outlineChar = outlineCharFor(char)
    saveCharacterDraft.value = {
        char,
        name: char.name || outlineChar?.name || '',
        description: outlineChar?.description || '',
        role: outlineChar?.role || '',
        prompt: char.prompt || '',
        imageSource: char.imageTask?.result || storyboardService.assetUrl(char.imageUrl),
    }
    saveCharacterOpen.value = true
}

const onCharacterSavedToLibrary = (saved) => {
    if (saveCharacterDraft.value?.char) {
        saveCharacterDraft.value.char.savedLibraryId = saved?.id || true
    }
}

const triggerStyleRefUpload = () => {
    if (!canAddMoreStyleRefs.value) {
        notify.alert({
            title: t('storyboard.characterStyleRefLimitTitle'),
            message: t('storyboard.characterStyleRefLimitMessage', { max: MAX_CHARACTER_STYLE_REFS }),
            variant: 'warning',
        })
        return
    }
    styleFileInputRef.value.value = ''
    styleFileInputRef.value.click()
}

const onStyleRefFileSelected = async (event) => {
    ensureCharacterRefStyleRefs()
    const files = Array.from(event.target.files || []).filter((f) => f.type?.startsWith('image/'))
    if (!files.length) return

    const slotsLeft = MAX_CHARACTER_STYLE_REFS - props.editor.characterRefStyleRefs.length
    if (slotsLeft <= 0) {
        notify.alert({
            title: t('storyboard.characterStyleRefLimitTitle'),
            message: t('storyboard.characterStyleRefLimitMessage', { max: MAX_CHARACTER_STYLE_REFS }),
            variant: 'warning',
        })
        return
    }

    for (const file of files.slice(0, slotsLeft)) {
        const res = await storyboardService.saveAssetFile(props.projectId, file, { kind: 'character-style-ref' })
        if (res?.success) {
            const saved = res.data?.relativeUrl || res.data?.url
            if (saved) {
                props.editor.characterRefStyleRefs.push(saved)
            }
        }
    }
    applyCharacterRefStyleToPrompts()
}

const removeStyleRef = (index) => {
    ensureCharacterRefStyleRefs()
    props.editor.characterRefStyleRefs.splice(index, 1)
    applyCharacterRefStyleToPrompts()
}

const styleRefPreviewUrl = (url) => storyboardService.assetUrl(normalizeCharacterRefStyleRefUrl(url))

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const envStyleContext = () => buildEnvironmentStyleContext({
    settings: props.settings,
    templateDefaults: props.templateDefaults,
})

const shotFrameCtx = () => ({ styleContext: envStyleContext() })

const applySceneShotsResult = (scene, shotsResult) => {
    const styleCtx = envStyleContext()
    const rawShots = (shotsResult.shots || []).slice(0, MAX_SHOTS_PER_SCENE)
    scene.shots = rawShots.map((shot) => {
        const blocks = applyProjectStyleToVideoBlocks(shot.blocks, styleCtx)
        const videoPrompt = buildScenePrompt({ blocks })
        const imagePrompt = normalizeShotFrameImagePrompt(shot.imagePrompt, {
            styleContext: styleCtx,
            blocks,
        })
        return makeShotRow({ ...shot, blocks, imagePrompt }, videoPrompt)
    })
    if (!scene.shots.length) {
        scene.scriptStatus = 'error'
        scene.scriptError = t('storyboard.noShotsGenerated')
        return false
    }
    scene.scriptStatus = 'done'
    scene.scriptError = ''
    return true
}

const regenerateSceneShots = async (scene) => {
    if (!scene || scene.scriptStatus === 'generating' || isGenerating.value) return

    if (!getSettings().geminiApiKey) {
        notify.alert({ title: t('storyboard.generateFailed'), message: t('storyboard.needGemini'), variant: 'error' })
        return
    }

    const prevScene = props.editor.scenes.find((s) => s.index === scene.index - 1)
    const prevBeat = prevScene?.beat || ''

    scene.scriptStatus = 'generating'
    scene.scriptError = ''
    scene.shots = []
    props.editor.expandedScenes[scene.index] = true

    try {
        const shotsResult = await callGeminiStructured(buildSceneShotsPrompt(scene, prevBeat), {
            responseSchema: GEMINI_STORYBOARD_SCENE_SHOTS_SCHEMA,
            imageUrls: characterRefUrls.value,
            maxOutputTokens: 8192,
        })
        applySceneShotsResult(scene, shotsResult)
    } catch (err) {
        scene.scriptStatus = 'error'
        scene.scriptError = err?.message || String(err)
        scene.shots = []
    }
}

const genSceneEnvironment = async (scene) => {
    if (!scene.environmentPrompt?.trim() || scene.environmentImageTask?.status === 'generating') return
    scene.environmentPrompt = normalizeEnvironmentPrompt(scene.environmentPrompt, envStyleContext())
    await runStoryboardImageGen({
        task: scene.environmentImageTask,
        prompt: buildEnvironmentImagePrompt(scene.environmentPrompt, envStyleContext()),
        refUrls: [],
        aspectRatio: props.settings.aspectRatio,
        imageModel: props.settings.imageModel,
    })
    if (props.projectId && scene.environmentImageTask?.result) {
        const saved = await persistStoryboardAsset(props.projectId, scene.environmentImageTask.result, {
            kind: 'scene-environment',
            sceneIndex: scene.index,
        })
        if (saved) {
            scene.environmentImageUrl = saved
            scene.environmentImageTask.result = storyboardService.assetUrl(saved)
        }
    }
}

const environmentImageUrl = (scene) => {
    const url = scene.environmentImageTask?.result || scene.environmentImageUrl
    return url ? storyboardService.assetUrl(url) : null
}

const genShotFrame = async ({ scene, shot }) => {
    if (shot.firstFrameTask?.status === 'generating') return
    await runStoryboardImageGen({
        task: shot.firstFrameTask,
        prompt: buildShotFrameImagePrompt(shot.imagePrompt, {
            ...shotFrameCtx(),
            blocks: shot.blocks,
        }),
        refUrls: storyboardShotFrameRefs(environmentImageUrl(scene), characterRefUrls.value),
        aspectRatio: props.settings.aspectRatio,
        imageModel: props.settings.imageModel,
    })
    if (props.projectId && shot.firstFrameTask?.result) {
        const saved = await persistStoryboardAsset(props.projectId, shot.firstFrameTask.result, {
            kind: 'shot-frame',
            sceneIndex: scene.index,
        })
        if (saved) {
            shot.firstFrameImageUrl = saved
            shot.firstFrameTask.result = storyboardService.assetUrl(saved)
        }
    }
}

const genShotVideo = async ({ scene, shot }) => {
    if (!shot.firstFrameTask?.result || shot.videoTask?.status === 'generating') return
    await runStoryboardVideoGen({
        task: shot.videoTask,
        prompt: storyboardShotVideoPrompt(shot),
        refUrls: storyboardSceneVideoFrame(shot.firstFrameTask?.result),
        aspectRatio: props.settings.aspectRatio,
        videoModel: props.settings.videoModel,
    })
    if (props.projectId && shot.videoTask?.result) {
        const saved = await persistStoryboardAsset(props.projectId, shot.videoTask.result, {
            kind: 'shot-video',
            sceneIndex: scene.index,
        })
        if (saved) {
            shot.videoUrl = saved
            shot.videoTask.result = storyboardService.assetUrl(saved)
        }
    }
}

const runWithConcurrency = async (items, limit, worker, onProgress) => {
    let nextIndex = 0
    let done = 0

    const workerLoop = async () => {
        while (nextIndex < items.length) {
            const item = items[nextIndex]
            nextIndex += 1
            try {
                await worker(item)
            } catch {
                // task already patched
            }
            done += 1
            onProgress?.(done, items.length)
        }
    }

    const poolSize = Math.min(limit, items.length)
    await Promise.all(Array.from({ length: poolSize }, () => workerLoop()))
}

const genAllEnvironments = async () => {
    if (isBulkBusy.value) return
    const scenes = pendingEnvironmentScenes.value
    if (!scenes.length) return

    isBulkEnvGen.value = true
    bulkProgress.value = { kind: 'environment', current: 0, total: scenes.length }
    try {
        await runWithConcurrency(
            scenes,
            BULK_PARALLEL,
            genSceneEnvironment,
            (current, total) => {
                bulkProgress.value = { kind: 'environment', current, total }
            },
        )
    } finally {
        isBulkEnvGen.value = false
        bulkProgress.value = { kind: '', current: 0, total: 0 }
    }
}

const genAllFrames = async () => {
    if (isBulkBusy.value) return
    const items = pendingFrameShots.value
    if (!items.length) return

    isBulkImageGen.value = true
    bulkProgress.value = { kind: 'frame', current: 0, total: items.length }
    try {
        await runWithConcurrency(
            items,
            BULK_PARALLEL,
            genShotFrame,
            (current, total) => {
                bulkProgress.value = { kind: 'frame', current, total }
            },
        )
    } finally {
        isBulkImageGen.value = false
        bulkProgress.value = { kind: '', current: 0, total: 0 }
    }
}

const genAllVideos = async () => {
    if (isBulkBusy.value) return
    const items = pendingVideoShots.value
    if (!items.length) return

    isBulkVideoGen.value = true
    bulkProgress.value = { kind: 'video', current: 0, total: items.length }
    try {
        await runWithConcurrency(
            items,
            BULK_PARALLEL,
            genShotVideo,
            (current, total) => {
                bulkProgress.value = { kind: 'video', current, total }
            },
        )
    } finally {
        isBulkVideoGen.value = false
        bulkProgress.value = { kind: '', current: 0, total: 0 }
    }
}

const generateCharacterRefImage = async (char, charIndex = 0) => {
    ensureGeneratedCharacters()
    if (!char?.prompt?.trim() || char.imageTask?.status === 'generating') return
    const styleCtx = charStyleContext()
    char.prompt = normalizeCharacterRefPrompt(char.prompt, styleCtx)
    try {
        await runStoryboardImageGen({
            task: char.imageTask,
            prompt: buildCharacterRefImagePrompt(char.prompt, styleCtx),
            refUrls: characterStyleRefUrls(),
            aspectRatio: '9:16',
            imageModel: props.settings.imageModel,
        })
        char.source = 'generated'
        const saved = await persistStoryboardAsset(props.projectId, char.imageTask.result, {
            kind: 'character-ref',
            sceneIndex: charIndex + 1,
        })
        if (saved) {
            char.imageUrl = saved
            char.imageTask.result = storyboardService.assetUrl(saved)
        }
    } catch {
        // error on task
    }
}

const generateAllCharacterRefImages = async () => {
    if (isCharacterRefGenBusy.value || !pendingCharacterRefRows.value.length) return
    for (let i = 0; i < props.editor.generatedCharacters.length; i += 1) {
        const char = props.editor.generatedCharacters[i]
        if (char.imageTask?.status === 'success' || char.imageTask?.status === 'generating') continue
        if (!char.prompt?.trim()) continue
        await generateCharacterRefImage(char, i)
    }
}

const generateStoryboard = async () => {
    if (!canGenerate.value || isGenerating.value) return

    if (!getSettings().geminiApiKey) {
        notify.alert({ title: t('storyboard.generateFailed'), message: t('storyboard.needGemini'), variant: 'error' })
        return
    }

    isGenerating.value = true
    emit('minimize-setup')
    props.editor.outline = null
    props.editor.scenes = []
    props.editor.expandedScenes = {}
    props.editor.generatedCharacters = []
    props.editor.characterRef = {
        name: '',
        prompt: '',
        source: characterCount.value ? (props.editor.libraryCharacterRefs?.length ? 'library' : 'upload') : 'none',
        imageUrl: null,
        imageTask: createMediaTask(),
    }

    try {
        genProgress.value = { phase: 'outline', current: 0, total: 1, label: t('storyboard.phaseOutline') }
        const outlineResult = await callGeminiStructured(buildOutlinePrompt(), {
            responseSchema: GEMINI_STORYBOARD_OUTLINE_SCHEMA,
            imageUrls: outlineImageUrls.value,
            maxOutputTokens: 4096,
        })
        if (!Array.isArray(outlineResult.characters)) outlineResult.characters = []
        outlineResult.characters = outlineResult.characters.slice(0, MAX_STORYBOARD_CHARACTERS)
        props.editor.outline = outlineResult
        props.editor.scenes = (outlineResult.scenes || []).map(makeSceneRow)

        if (props.editor.libraryCharacterRefs?.length) {
            props.editor.generatedCharacters = props.editor.libraryCharacterRefs.map((ref) => {
                const row = makeGeneratedCharacterRow({
                    name: ref.name,
                    prompt: ref.prompt || '',
                })
                row.source = 'library'
                if (ref.imageUrl) {
                    row.imageUrl = ref.imageUrl
                    row.imageTask.status = 'success'
                    row.imageTask.result = storyboardCharacterService.assetUrl(ref.imageUrl)
                }
                return row
            })
        }

        if (characterCount.value === 0 && outlineResult.characters.length) {
            const charsForPrompt = outlineResult.characters.slice(0, MAX_STORYBOARD_CHARACTERS)
            genProgress.value = {
                phase: 'character',
                current: 0,
                total: charsForPrompt.length || 1,
                label: t('storyboard.phaseCharacter'),
            }
            const charResult = await callGeminiStructured(buildCharacterRefPrompt(charsForPrompt), {
                responseSchema: GEMINI_CHARACTER_REF_PROMPT_SCHEMA,
                maxOutputTokens: 4096,
            })
            props.editor.generatedCharacters = (charResult.characters || [])
                .slice(0, MAX_STORYBOARD_CHARACTERS)
                .map((char) => {
                    const row = makeGeneratedCharacterRow(char)
                    row.prompt = normalizeCharacterRefPrompt(char.imagePrompt || row.prompt, charStyleContext())
                    return row
                })
        }

        const sceneList = outlineResult.scenes || []
        const batchCount = Math.ceil(sceneList.length / SCENE_BATCH_SIZE) || 1
        genProgress.value = { phase: 'sceneBatch', current: 0, total: batchCount, label: t('storyboard.phaseSceneBatch') }

        for (let b = 0; b < sceneList.length; b += SCENE_BATCH_SIZE) {
            const batch = sceneList.slice(b, b + SCENE_BATCH_SIZE)
            const batchIndex = Math.floor(b / SCENE_BATCH_SIZE) + 1
            genProgress.value = {
                phase: 'sceneBatch',
                current: batchIndex,
                total: batchCount,
                label: batch.map((s) => s.label).join(', '),
            }

            try {
                const batchResult = await callGeminiStructured(buildSceneBatchPrompt(batch), {
                    responseSchema: GEMINI_STORYBOARD_SCENE_BATCH_SCHEMA,
                    maxOutputTokens: 3072,
                })
                for (const enriched of batchResult.scenes || []) {
                    const row = props.editor.scenes.find((s) => s.index === enriched.index)
                    if (row) {
                        row.environmentPrompt = normalizeEnvironmentPrompt(
                            enriched.environmentPrompt || '',
                            envStyleContext(),
                        )
                        row.shotCount = clampShotCount(enriched.shotCount)
                    }
                }
            } catch (err) {
                console.warn('Scene batch enrich failed:', err)
            }

            if (b + SCENE_BATCH_SIZE < sceneList.length) await wait(400)
        }

        genProgress.value = { phase: 'shots', current: 0, total: sceneList.length, label: t('storyboard.phaseShots') }
        let prevBeat = ''
        for (let i = 0; i < sceneList.length; i += 1) {
            const sceneOutline = sceneList[i]
            const row = props.editor.scenes[i]
            row.scriptStatus = 'generating'
            props.editor.expandedScenes[row.index] = true
            genProgress.value = {
                phase: 'shots',
                current: i + 1,
                total: sceneList.length,
                label: sceneOutline.label,
            }

            try {
                const shotsResult = await callGeminiStructured(buildSceneShotsPrompt(row, prevBeat), {
                    responseSchema: GEMINI_STORYBOARD_SCENE_SHOTS_SCHEMA,
                    imageUrls: characterRefUrls.value,
                    maxOutputTokens: 8192,
                })
                applySceneShotsResult(row, shotsResult)
                if (row.scriptStatus === 'done') prevBeat = sceneOutline.beat
            } catch (err) {
                row.scriptStatus = 'error'
                row.scriptError = err?.message || String(err)
                row.shots = []
            }

            if (i < sceneList.length - 1) await wait(400)
        }

    } catch (err) {
        notify.alert({
            title: t('storyboard.generateFailed'),
            message: err?.message || String(err),
            variant: 'error',
        })
    } finally {
        isGenerating.value = false
        genProgress.value = { phase: '', current: 0, total: 0, label: '' }
    }
}

const scrollToScene = (index) => {
    const el = document.getElementById(`storyboard-scene-${index}`)
    if (!el) return
    activeSceneIndex.value = index
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const sceneRailStatus = (scene) => {
    const shots = scene.shots || []
    if (shots.some((s) => s.videoTask?.status === 'success')) return 'video'
    if (shots.some((s) => s.firstFrameTask?.status === 'success')) return 'image'
    if (scene.scriptStatus === 'error') return 'error'
    if (scene.scriptStatus === 'generating') return 'loading'
    return 'idle'
}

watch(isBulkEnvGen, (v) => emit('bulk-env-change', v), { immediate: true })
watch(isGenerating, (v) => emit('generating-change', v), { immediate: true })
watch(genProgress, (v) => emit('progress-change', { ...v }), { deep: true })

const setupSceneNavObserver = () => {
    sceneNavObserver?.disconnect()
    if (!props.editor.scenes?.length) return

    sceneNavObserver = new IntersectionObserver(
        (entries) => {
            const visible = entries
                .filter((e) => e.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
            if (!visible.length) return
            const id = visible[0].target.id || ''
            const match = id.match(/^storyboard-scene-(\d+)$/)
            if (match) activeSceneIndex.value = Number(match[1])
        },
        { root: null, rootMargin: '-12% 0px -55% 0px', threshold: [0.15, 0.35, 0.55] },
    )

    props.editor.scenes.forEach((scene) => {
        const el = document.getElementById(`storyboard-scene-${scene.index}`)
        if (el) sceneNavObserver.observe(el)
    })
}

watch(
    () => props.editor.scenes?.map((s) => s.index).join(','),
    () => {
        if (!props.editor.outline) return
        if (activeSceneIndex.value == null && props.editor.scenes?.[0]) {
            activeSceneIndex.value = props.editor.scenes[0].index
        }
        requestAnimationFrame(setupSceneNavObserver)
    },
    { immediate: true },
)

onMounted(() => {
    requestAnimationFrame(setupSceneNavObserver)
})

onBeforeUnmount(() => {
    sceneNavObserver?.disconnect()
})

defineExpose({
    genAllEnvironments,
    getPendingEnvironmentCount: () => pendingEnvironmentScenes.value.length,
    getIsBulkEnvGen: () => isBulkEnvGen.value,
})
</script>

<template>
    <div class="script-tab">
        <section v-if="showSetup" class="input-panel card">
            <header class="panel-head">
                <div>
                    <h3>{{ t('storyboard.ideaTitle') }}</h3>
                    <p>{{ t('storyboard.ideaHint') }}</p>
                </div>
                <button
                    type="button"
                    class="btn-primary"
                    :disabled="!canGenerate || isGenerating"
                    @click="generateStoryboard"
                >
                    <Sparkles :size="15" />
                    {{ isGenerating ? t('storyboard.generating') : t('storyboard.generateScript') }}
                </button>
            </header>

            <div v-if="isGenerating" class="progress-bar">
                <Loader2 :size="14" class="spin" />
                <span v-if="genProgress.phase === 'outline'">{{ genProgress.label }}</span>
                <span v-else-if="genProgress.phase === 'character'">{{ genProgress.label }}</span>
                <span v-else-if="genProgress.phase === 'sceneBatch'">
                    {{ t('storyboard.sceneBatchProgress', { current: genProgress.current, total: genProgress.total, label: genProgress.label }) }}
                </span>
                <span v-else-if="genProgress.phase === 'shots'">
                    {{ t('storyboard.shotsProgress', { current: genProgress.current, total: genProgress.total, label: genProgress.label }) }}
                </span>
            </div>

            <textarea
                v-model="editor.ideaText"
                class="idea-input sb-textarea sb-scroll"
                rows="6"
                :placeholder="t('storyboard.ideaPlaceholder')"
            />

            <div class="char-upload">
                <label class="upload-label">
                    <User :size="14" />
                    {{ t('storyboard.characterImage') }}
                    <span class="optional-tag">{{ t('common.optional') }}</span>
                </label>
                <div class="upload-row">
                    <button
                        type="button"
                        class="btn-soft"
                        :disabled="!canAddMoreCharacters"
                        @click="triggerUpload"
                    >
                        <Upload :size="14" />
                        {{ t('storyboard.uploadCharacter') }}
                    </button>
                    <button
                        type="button"
                        class="btn-soft"
                        :disabled="!canAddMoreCharacters"
                        @click="openCharacterPicker"
                    >
                        <Users :size="14" />
                        {{ t('storyboard.pickFromLibrary') }}
                    </button>
                    <span class="char-count">{{ characterCount }}/{{ MAX_STORYBOARD_CHARACTERS }}</span>
                    <input
                        ref="fileInputRef"
                        type="file"
                        accept="image/*"
                        multiple
                        class="hidden-input"
                        @change="onFileSelected"
                    />
                </div>
                <div v-if="userCharacterPreviewUrls.length || editor.libraryCharacterRefs?.length" class="char-thumb-grid">
                    <div
                        v-for="(url, idx) in userCharacterPreviewUrls"
                        :key="`upload-${url}-${idx}`"
                        class="char-thumb"
                    >
                        <img :src="url" alt="" />
                        <button type="button" class="remove-btn" @click="removeImage(idx)"><X :size="12" /></button>
                    </div>
                    <div
                        v-for="(ref, idx) in editor.libraryCharacterRefs"
                        :key="`lib-${ref.libraryId}`"
                        class="char-thumb char-thumb--library"
                    >
                        <img v-if="ref.imageUrl" :src="storyboardCharacterService.assetUrl(ref.imageUrl)" :alt="ref.name" />
                        <span v-if="ref.name" class="char-thumb-label">{{ ref.name }}</span>
                        <button type="button" class="remove-btn" @click="removeLibraryCharacter(idx)"><X :size="12" /></button>
                    </div>
                </div>
                <small class="upload-hint">{{ t('storyboard.characterUploadHint', { max: MAX_STORYBOARD_CHARACTERS }) }}</small>
            </div>

            <StoryboardCharacterPickerPopup
                v-model:open="characterPickerOpen"
                :max-select="MAX_STORYBOARD_CHARACTERS - userCharacterPreviewUrls.length"
                :selected-ids="(editor.libraryCharacterRefs || []).map((r) => r.libraryId)"
                @confirm="onLibraryCharactersPicked"
            />
        </section>

        <section v-if="showScenes && editor.outline" class="result-panel">
            <header class="result-head card">
                <div>
                    <h3>{{ editor.outline.title }}</h3>
                    <p>{{ editor.outline.summary }}</p>
                    <p v-if="editor.outline.narrativeFlow" class="narrative-flow">{{ editor.outline.narrativeFlow }}</p>
                </div>
                <div class="result-actions">
                    <div v-if="bulkProgress.total" class="bulk-progress">
                        <Loader2 :size="14" class="spin" />
                        <span v-if="bulkProgress.kind === 'environment'">
                            {{ t('storyboard.bulkEnvProgress', { current: bulkProgress.current, total: bulkProgress.total }) }}
                        </span>
                        <span v-else-if="bulkProgress.kind === 'frame'">
                            {{ t('storyboard.bulkFrameProgress', { current: bulkProgress.current, total: bulkProgress.total }) }}
                        </span>
                        <span v-else>
                            {{ t('storyboard.bulkVideoProgress', { current: bulkProgress.current, total: bulkProgress.total }) }}
                        </span>
                    </div>
                    <div class="bulk-actions">
                        <button
                            type="button"
                            class="btn-soft btn-bulk"
                            :class="{ 'is-loading': isBulkEnvGen }"
                            :disabled="!pendingEnvironmentScenes.length || isBulkBusy || isGenerating"
                            :aria-busy="isBulkEnvGen"
                            @click="genAllEnvironments"
                        >
                            <span class="btn-bulk-inner">
                                <Loader2 v-if="isBulkEnvGen" :size="14" class="spin" />
                                <Trees v-else :size="14" />
                                <span class="btn-bulk-text">
                                    {{ isBulkEnvGen ? t('storyboard.generating') : t('storyboard.genAllEnvironments') }}
                                </span>
                                <span v-if="isBulkEnvGen && bulkProgress.total" class="btn-bulk-progress">
                                    {{ bulkProgress.current }}/{{ bulkProgress.total }}
                                </span>
                            </span>
                            <span v-if="isBulkEnvGen" class="btn-bulk-bar" aria-hidden="true">
                                <span
                                    class="btn-bulk-bar-fill"
                                    :style="{ width: bulkProgress.total ? `${Math.round((bulkProgress.current / bulkProgress.total) * 100)}%` : '0%' }"
                                />
                            </span>
                        </button>
                        <button
                            type="button"
                            class="btn-soft btn-bulk"
                            :class="{ 'is-loading': isBulkImageGen }"
                            :disabled="!pendingFrameShots.length || isBulkBusy || isGenerating"
                            :aria-busy="isBulkImageGen"
                            @click="genAllFrames"
                        >
                            <span class="btn-bulk-inner">
                                <Loader2 v-if="isBulkImageGen" :size="14" class="spin" />
                                <ImageIcon v-else :size="14" />
                                <span class="btn-bulk-text">
                                    {{ isBulkImageGen ? t('storyboard.generating') : t('storyboard.genAllFrames') }}
                                </span>
                                <span v-if="isBulkImageGen && bulkProgress.total" class="btn-bulk-progress">
                                    {{ bulkProgress.current }}/{{ bulkProgress.total }}
                                </span>
                            </span>
                            <span v-if="isBulkImageGen" class="btn-bulk-bar" aria-hidden="true">
                                <span
                                    class="btn-bulk-bar-fill"
                                    :style="{ width: bulkProgress.total ? `${Math.round((bulkProgress.current / bulkProgress.total) * 100)}%` : '0%' }"
                                />
                            </span>
                        </button>
                        <button
                            type="button"
                            class="btn-soft btn-bulk"
                            :class="{ 'is-loading': isBulkVideoGen }"
                            :disabled="!pendingVideoShots.length || isBulkBusy || isGenerating"
                            :aria-busy="isBulkVideoGen"
                            @click="genAllVideos"
                        >
                            <span class="btn-bulk-inner">
                                <Loader2 v-if="isBulkVideoGen" :size="14" class="spin" />
                                <Video v-else :size="14" />
                                <span class="btn-bulk-text">
                                    {{ isBulkVideoGen ? t('storyboard.generating') : t('storyboard.genAllVideos') }}
                                </span>
                                <span v-if="isBulkVideoGen && bulkProgress.total" class="btn-bulk-progress">
                                    {{ bulkProgress.current }}/{{ bulkProgress.total }}
                                </span>
                            </span>
                            <span v-if="isBulkVideoGen" class="btn-bulk-bar" aria-hidden="true">
                                <span
                                    class="btn-bulk-bar-fill"
                                    :style="{ width: bulkProgress.total ? `${Math.round((bulkProgress.current / bulkProgress.total) * 100)}%` : '0%' }"
                                />
                            </span>
                        </button>
                    </div>
                    <span class="scene-count">
                        {{ editor.scenes.length }} {{ t('storyboard.scenes') }} · {{ totalShotCount }} {{ t('storyboard.shots') }}
                    </span>
                </div>
            </header>

            <section v-if="editor.outline.characterBible" class="bible-card card">
                <strong>{{ t('storyboard.characterBible') }}</strong>
                <p>{{ editor.outline.characterBible }}</p>
            </section>

            <section v-if="needsCharacterGen && generatedCharacterRows.length" class="char-ref card">
                <header class="char-ref-head">
                    <div>
                        <h4>{{ t('storyboard.characterRefTitle') }} ({{ generatedCharacterRows.length }})</h4>
                        <p>{{ t('storyboard.characterRefHint') }}</p>
                    </div>
                    <div class="char-ref-head-actions">
                        <button
                            type="button"
                            class="btn-soft btn-sm"
                            :class="{ 'btn-soft--active': showCharacterStyleInput }"
                            @click="showCharacterStyleInput = !showCharacterStyleInput"
                        >
                            <Paintbrush :size="14" />
                            {{ t('storyboard.characterRefStyleBtn') }}
                        </button>
                        <button
                            type="button"
                            class="btn-primary btn-sm"
                            :disabled="isCharacterRefGenBusy || !pendingCharacterRefRows.length"
                            @click="generateAllCharacterRefImages"
                        >
                            <Loader2 v-if="isCharacterRefGenBusy" :size="14" class="spin" />
                            <ImageIcon v-else :size="14" />
                            {{ isCharacterRefGenBusy ? t('storyboard.generating') : t('storyboard.genAllCharacterRefs') }}
                        </button>
                    </div>
                </header>
                <div v-if="showCharacterStyleInput" class="char-ref-style-panel">
                    <label class="char-ref-style-label">{{ t('storyboard.characterRefStyleLabel') }}</label>
                    <textarea
                        v-model="editor.characterRefStyle"
                        class="sb-textarea sb-scroll char-ref-style-input"
                        rows="2"
                        :placeholder="defaultCharacterRefStyle"
                        spellcheck="false"
                        @blur="applyCharacterRefStyleToPrompts"
                    />
                    <small class="char-ref-style-hint">
                        {{ t('storyboard.characterRefStyleHint') }}
                        <span v-if="!editor.characterRefStyle?.trim()" class="char-ref-style-default">
                            {{ t('storyboard.characterRefStyleUsingDefault') }}: {{ defaultCharacterRefStyle }}
                        </span>
                    </small>

                    <div class="char-ref-style-images">
                        <div class="char-ref-style-images-head">
                            <label class="char-ref-style-label">{{ t('storyboard.characterRefStyleImagesLabel') }}</label>
                            <button
                                type="button"
                                class="btn-soft btn-xs"
                                :disabled="!canAddMoreStyleRefs"
                                @click="triggerStyleRefUpload"
                            >
                                <Upload :size="12" />
                                {{ t('storyboard.characterRefStyleImagesAdd') }}
                            </button>
                            <input
                                ref="styleFileInputRef"
                                type="file"
                                accept="image/*"
                                multiple
                                class="hidden-input"
                                @change="onStyleRefFileSelected"
                            />
                        </div>
                        <small class="char-ref-style-hint">{{ t('storyboard.characterRefStyleImagesHint', { max: MAX_CHARACTER_STYLE_REFS }) }}</small>
                        <div v-if="editor.characterRefStyleRefs.length" class="char-thumb-grid">
                            <div
                                v-for="(url, idx) in editor.characterRefStyleRefs"
                                :key="`${url}-${idx}`"
                                class="char-thumb"
                            >
                                <img :src="styleRefPreviewUrl(url)" alt="" />
                                <button type="button" class="remove-btn" @click="removeStyleRef(idx)">
                                    <X :size="12" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="char-ref-grid">
                    <article
                        v-for="(char, idx) in generatedCharacterRows"
                        :key="`${char.name}-${idx}`"
                        class="char-ref-item"
                    >
                        <header class="char-ref-item-head">
                            <strong>{{ char.name || t('storyboard.characterRefTitle') }}</strong>
                            <div class="char-ref-item-actions">
                                <button
                                    v-if="char.imageTask?.status === 'success'"
                                    type="button"
                                    class="btn-soft btn-xs"
                                    :class="{ 'btn-soft--saved': char.savedLibraryId }"
                                    :disabled="Boolean(char.savedLibraryId)"
                                    @click="openSaveCharacter(char)"
                                >
                                    <Save :size="12" />
                                    {{ char.savedLibraryId ? t('storyboard.characterSaved') : t('storyboard.characterSaveToLibrary') }}
                                </button>
                                <button
                                    type="button"
                                    class="btn-soft btn-xs"
                                    :disabled="char.imageTask?.status === 'generating' || isCharacterRefGenBusy"
                                    @click="generateCharacterRefImage(char, charIndexInEditor(char))"
                                >
                                    <Loader2 v-if="char.imageTask?.status === 'generating'" :size="12" class="spin" />
                                    <RefreshCw v-else :size="12" />
                                    {{ char.imageTask?.status === 'generating' ? t('storyboard.generating') : t('storyboard.genCharacterRef') }}
                                </button>
                            </div>
                        </header>
                        <div class="char-ref-body" :style="{ '--char-ref-preview-width': characterRefPreviewWidth }">
                            <div class="char-ref-preview-col">
                                <StoryboardMediaPreview
                                    :task="char.imageTask"
                                    media-type="image"
                                    :aspect-ratio="characterRefAspect"
                                    :label="char.name || t('storyboard.characterRefTitle')"
                                    @download="downloadMediaResult(char.imageTask, `character-${idx + 1}.png`)"
                                />
                            </div>
                            <textarea
                                :value="char.prompt"
                                class="sb-textarea sb-textarea--readonly sb-textarea--mono sb-scroll ref-prompt"
                                rows="9"
                                readonly
                                spellcheck="false"
                            />
                        </div>
                    </article>
                </div>
            </section>

            <div class="result-body">
                <div class="scene-list">
                    <StoryboardSceneSection
                        v-for="scene in editor.scenes"
                        :key="scene.index"
                        :scene="scene"
                        :project-id="projectId"
                        :settings="settings"
                        :template-defaults="templateDefaults"
                        :character-ref-urls="characterRefUrls"
                        :expanded="isSceneExpanded(scene.index)"
                        :busy="isGenerating"
                        @toggle="toggleSceneExpanded(scene.index)"
                        @regenerate-shots="regenerateSceneShots(scene)"
                    />
                </div>

                <nav
                    v-if="editor.scenes.length > 1"
                    class="scene-rail"
                    :aria-label="t('storyboard.sceneNavLabel')"
                >
                    <button
                        v-for="scene in editor.scenes"
                        :key="`rail-${scene.index}`"
                        type="button"
                        class="scene-rail-btn"
                        :class="[
                            { active: activeSceneIndex === scene.index },
                            `scene-rail-btn--${sceneRailStatus(scene)}`,
                        ]"
                        :title="scene.label"
                        @click="scrollToScene(scene.index)"
                    >
                        {{ scene.index }}
                    </button>
                </nav>
            </div>
        </section>

        <section v-else-if="showScenes && !isGenerating" class="empty-state card">
            <Sparkles :size="40" class="empty-icon" />
            <p>{{ t('storyboard.emptyHint') }}</p>
            <small>{{ t('storyboard.emptySub', { count: estimatedScenes }) }}</small>
            <button type="button" class="btn-primary open-setup-btn" @click="emit('open-setup')">
                <Sparkles :size="15" />
                {{ t('storyboard.openSetup') }}
            </button>
        </section>

        <StoryboardCharacterFormPopup
            v-if="saveCharacterDraft"
            v-model:open="saveCharacterOpen"
            mode="save"
            :initial-name="saveCharacterDraft.name"
            :initial-description="saveCharacterDraft.description"
            :initial-role="saveCharacterDraft.role"
            :initial-prompt="saveCharacterDraft.prompt"
            :initial-style-preset="settings.stylePreset"
            :image-source="saveCharacterDraft.imageSource"
            @saved="onCharacterSavedToLibrary"
        />
    </div>
</template>

<style scoped>
.script-tab {
    display: grid;
    gap: 12px;
}

.card {
    border: 1px solid var(--color-border);
    border-radius: 14px;
    padding: 14px;
    background: var(--color-bg-elevated);
}

.panel-head,
.result-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
}

.panel-head h3,
.result-head h3 {
    margin: 0;
    font-size: 1rem;
}

.panel-head p,
.result-head p {
    margin: 4px 0 0;
    color: var(--color-text-muted);
    font-size: 0.82rem;
}

.narrative-flow {
    margin-top: 6px !important;
    font-size: 0.78rem !important;
    font-style: italic;
    line-height: 1.45;
}

.progress-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--color-accent-soft);
    border: 1px solid rgba(234, 179, 8, 0.35);
    font-size: 0.8rem;
    color: var(--color-accent);
}

.idea-input {
    min-height: 120px;
    font-size: 0.9rem;
    padding: 12px;
}

.char-upload {
    margin-top: 12px;
    display: grid;
    gap: 8px;
}

.upload-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--color-text-muted);
}

.optional-tag {
    font-weight: 400;
    font-size: 0.75rem;
}

.upload-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.char-count {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
}

.char-thumb-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.upload-hint {
    color: var(--color-text-muted);
    font-size: 0.75rem;
    line-height: 1.4;
}

.hidden-input { display: none; }

.char-thumb {
    position: relative;
    width: 56px;
    height: 56px;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--color-border);
}

.char-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.char-thumb--library {
    border-color: rgba(99, 102, 241, 0.45);
}

.char-thumb-label {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 2px 4px;
    font-size: 0.58rem;
    font-weight: 600;
    text-align: center;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.75));
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.remove-btn {
    position: absolute;
    top: 3px;
    right: 3px;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 5px;
    background: rgba(0, 0, 0, 0.65);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
}

button {
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 8px 12px;
    background: var(--color-bg-soft);
    color: var(--color-text);
    cursor: pointer;
    font-size: 0.82rem;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

button:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-primary {
    border-color: var(--color-accent-strong);
    background: var(--color-accent);
    color: var(--color-text-on-accent);
    font-weight: 600;
}

.btn-sm { padding: 6px 10px; font-size: 0.78rem; }

.btn-soft:hover { border-color: rgba(234, 179, 8, 0.45); }

.result-actions {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    flex-shrink: 0;
}

.bulk-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 6px;
}

.btn-bulk {
    position: relative;
    flex-direction: column;
    align-items: stretch;
    gap: 0;
    min-width: 9.5rem;
    overflow: hidden;
}

.btn-bulk-inner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
}

.btn-bulk-text {
    white-space: nowrap;
}

.btn-bulk-progress {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--color-accent);
    font-variant-numeric: tabular-nums;
}

.btn-bulk.is-loading {
    border-color: rgba(234, 179, 8, 0.55);
    background: rgba(234, 179, 8, 0.08);
    color: var(--color-text);
}

.btn-bulk-bar {
    display: block;
    width: 100%;
    height: 3px;
    margin-top: 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
}

.btn-bulk-bar-fill {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, #eab308, #facc15);
    transition: width 0.25s ease;
}

.bulk-progress {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.76rem;
    color: var(--color-accent);
}

.scene-count {
    font-size: 0.78rem;
    color: var(--color-accent);
    border: 1px solid rgba(234, 179, 8, 0.4);
    border-radius: 999px;
    padding: 4px 10px;
    white-space: nowrap;
}

.bible-card { display: grid; gap: 6px; }
.bible-card p { margin: 0; color: var(--color-text-muted); font-size: 0.85rem; line-height: 1.5; }

.char-ref.card {
    background:
        linear-gradient(180deg, rgba(250, 204, 21, 0.04), transparent 42%),
        var(--color-bg-elevated);
}

.char-ref-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 14px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.char-ref-head h4 { margin: 0; font-size: 0.92rem; }
.char-ref-head p { margin: 4px 0 0; font-size: 0.78rem; color: var(--color-text-muted); line-height: 1.45; }

.char-ref-head-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    flex-shrink: 0;
}

.btn-soft--active {
    border-color: rgba(250, 204, 21, 0.45);
    background: var(--color-accent-soft);
    color: var(--color-accent);
}

.char-ref-style-panel {
    display: grid;
    gap: 6px;
    margin: -4px 0 14px;
    padding: 10px 12px;
    border: 1px solid rgba(250, 204, 21, 0.22);
    border-radius: 10px;
    background: rgba(250, 204, 21, 0.04);
}

.char-ref-style-label {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--color-text-muted);
}

.char-ref-style-input {
    min-height: 52px;
    max-height: 120px;
    resize: vertical;
    font-size: 0.76rem;
}

.char-ref-style-hint {
    font-size: 0.68rem;
    color: var(--color-text-muted);
    line-height: 1.4;
}

.char-ref-style-default {
    display: block;
    margin-top: 4px;
    color: var(--color-accent);
}

.char-ref-style-images {
    display: grid;
    gap: 8px;
    margin-top: 4px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.char-ref-style-images-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
}

.char-ref-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 14px;
}

.char-ref-item {
    display: grid;
    gap: 10px;
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    background:
        linear-gradient(165deg, rgba(27, 30, 36, 0.98), rgba(15, 17, 21, 0.96));
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.05),
        0 10px 28px rgba(0, 0, 0, 0.18);
}

.char-ref-item-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.char-ref-item-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
}

.btn-soft--saved {
    opacity: 0.65;
    border-color: rgba(34, 197, 94, 0.35);
    color: #86efac;
}

.char-ref-item-head strong {
    font-size: 0.88rem;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.btn-xs {
    padding: 5px 10px;
    font-size: 0.72rem;
    gap: 5px;
    border-radius: 8px;
}

.char-ref-body {
    display: grid;
    grid-template-columns: var(--char-ref-preview-width, 132px) minmax(0, 1fr);
    gap: 12px;
    align-items: start;
}

.char-ref-preview-col {
    width: var(--char-ref-preview-width, 132px);
    max-width: var(--char-ref-preview-width, 132px);
    flex-shrink: 0;
}

.char-ref-preview-col :deep(.media-preview) {
    width: 100%;
}

.ref-prompt {
    margin: 0;
    min-height: 0;
    height: 100%;
    max-height: none;
    overflow: auto;
    word-break: break-word;
    overflow-wrap: anywhere;
}

.result-body {
    display: flex;
    align-items: flex-start;
    gap: 10px;
}

.scene-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex: 1;
    min-width: 0;
}

.scene-rail {
    position: sticky;
    top: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px;
    border-radius: 12px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-elevated);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
    flex-shrink: 0;
    z-index: 2;
}

.scene-rail-btn {
    width: 2rem;
    height: 2rem;
    padding: 0;
    border-radius: 8px;
    border: 1px solid transparent;
    background: var(--color-bg-soft);
    color: var(--color-text-muted);
    font-size: 0.72rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.scene-rail-btn:hover {
    color: var(--color-text);
    border-color: var(--color-border);
}

.scene-rail-btn.active {
    color: var(--color-text);
    border-color: rgba(234, 179, 8, 0.55);
    background: var(--color-accent-soft);
}

.scene-rail-btn--image {
    box-shadow: inset 3px 0 0 rgba(56, 189, 248, 0.75);
}

.scene-rail-btn--video {
    box-shadow: inset 3px 0 0 rgba(74, 222, 128, 0.8);
}

.scene-rail-btn--error {
    box-shadow: inset 3px 0 0 rgba(248, 113, 113, 0.85);
}

.scene-rail-btn--loading {
    box-shadow: inset 3px 0 0 rgba(234, 179, 8, 0.75);
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 200px;
    text-align: center;
    color: var(--color-text-muted);
}

.empty-icon { color: #3f3f46; }
.empty-state p { margin: 0; color: var(--color-text); }
.empty-state small { font-size: 0.8rem; }

.open-setup-btn {
    margin-top: 8px;
}

.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 720px) {
    .char-ref-body { grid-template-columns: 1fr; }
    .result-body { flex-direction: column; }
    .scene-rail {
        position: static;
        flex-direction: row;
        flex-wrap: wrap;
        width: 100%;
        justify-content: flex-start;
    }
}
</style>
