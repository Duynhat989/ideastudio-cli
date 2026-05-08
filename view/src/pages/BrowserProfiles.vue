<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { UA_OPTIONS, VIEWPORT_OPTIONS, MEMORY_OPTIONS, THREAD_OPTIONS, GPU_OPTIONS } from '@/utils/dataOption'


const loading = ref(false)
const saving = ref(false)
const profiles = ref([])
const opened = reactive({})
const selectedIds = ref([])
const popupOpen = ref(false)
const editingId = ref('')

const form = reactive({
  name: '',
  browser: 'Chrome',
  proxy: '',
  ua: UA_OPTIONS[0],
  viewportWidth: 1366,
  viewportHeight: 768,
  memory: 8,
  threads: 8,
  gpuVendor: GPU_OPTIONS[0].vendor,
  gpuRenderer: GPU_OPTIONS[0].renderer,
})

const isEditing = computed(() => !!editingId.value)
const allChecked = computed({
  get: () => profiles.value.length > 0 && selectedIds.value.length === profiles.value.length,
  set: (checked) => {
    selectedIds.value = checked ? profiles.value.map((x) => x.id) : []
  },
})
const hasSelected = computed(() => selectedIds.value.length > 0)

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

const setRandomFingerprint = () => {
  const view = pick(VIEWPORT_OPTIONS).split('x')
  const gpu = pick(GPU_OPTIONS)
  form.ua = pick(UA_OPTIONS)
  form.viewportWidth = Number(view[0])
  form.viewportHeight = Number(view[1])
  form.memory = pick(MEMORY_OPTIONS)
  form.threads = pick(THREAD_OPTIONS)
  form.gpuVendor = gpu.vendor
  form.gpuRenderer = gpu.renderer
}

const resetForm = () => {
  editingId.value = ''
  form.name = ''
  form.browser = 'Chrome'
  form.proxy = ''
  setRandomFingerprint()
}

const openCreatePopup = () => {
  resetForm()
  popupOpen.value = true
}

const openEditPopup = (row) => {
  editingId.value = row.id
  form.name = row.name || ''
  form.browser = row.browser || 'Chrome'
  form.proxy = row.proxy || ''
  form.ua = row?.fingerprint?.ua || UA_OPTIONS[0]
  form.viewportWidth = Number(row?.fingerprint?.viewport?.width || 1366)
  form.viewportHeight = Number(row?.fingerprint?.viewport?.height || 768)
  form.memory = Number(row?.fingerprint?.memory || 8)
  form.threads = Number(row?.fingerprint?.threads || 8)
  form.gpuVendor = row?.fingerprint?.gpu?.vendor || GPU_OPTIONS[0].vendor
  form.gpuRenderer = row?.fingerprint?.gpu?.renderer || GPU_OPTIONS[0].renderer
  popupOpen.value = true
}

const closePopup = () => {
  popupOpen.value = false
  resetForm()
}

const loadProfiles = async () => {
  loading.value = true
  try {
    const res = await window.electronAPI.invoke('profiles:list')
    profiles.value = res?.success ? (res.data || []) : []
    selectedIds.value = selectedIds.value.filter((id) => profiles.value.some((x) => x.id === id))
  } finally {
    loading.value = false
  }
}

const onSubmit = async () => {
  saving.value = true
  try {
    const payload = {
      name: form.name,
      browser: form.browser,
      proxy: form.proxy,
      randomize: false,
      fingerprint: {
        ua: form.ua,
        viewport: {
          width: Number(form.viewportWidth || 1366),
          height: Number(form.viewportHeight || 768),
        },
        memory: Number(form.memory || 8),
        threads: Number(form.threads || 8),
        gpu: {
          vendor: form.gpuVendor,
          renderer: form.gpuRenderer,
        },
      },
    }

    if (isEditing.value) {
      await window.electronAPI.invoke('profiles:update', { id: editingId.value, ...payload })
    } else {
      await window.electronAPI.invoke('profiles:create', payload)
    }
    closePopup()
    await loadProfiles()
  } finally {
    saving.value = false
  }
}

const onDelete = async (row) => {
  await window.electronAPI.invoke('profiles:delete', { id: row.id })
  delete opened[row.id]
  selectedIds.value = selectedIds.value.filter((id) => id !== row.id)
  await loadProfiles()
}

const onOpen = async (row) => {
  const res = await window.electronAPI.invoke('profiles:open', { id: row.id })
  opened[row.id] = !!res?.success
}

const onClose = async (row) => {
  await window.electronAPI.invoke('profiles:close', { id: row.id })
  opened[row.id] = false
}

const openSelected = async () => {
  if (!hasSelected.value) return
  for (const id of selectedIds.value) {
    const row = profiles.value.find((x) => x.id === id)
    if (!row) continue
    const res = await window.electronAPI.invoke('profiles:open', { id: row.id })
    opened[row.id] = !!res?.success
  }
}

const closeSelected = async () => {
  if (!hasSelected.value) return
  for (const id of selectedIds.value) {
    const row = profiles.value.find((x) => x.id === id)
    if (!row) continue
    await window.electronAPI.invoke('profiles:close', { id: row.id })
    opened[row.id] = false
  }
}

const deleteSelected = async () => {
  if (!hasSelected.value) return
  const ids = [...selectedIds.value]
  for (const id of ids) {
    await window.electronAPI.invoke('profiles:delete', { id })
    delete opened[id]
  }
  selectedIds.value = []
  await loadProfiles()
}

onMounted(() => {
  setRandomFingerprint()
  loadProfiles()
})
</script>

<template>
  <section class="page">
    <header class="page-head">
      <div>
        <h1>Quản lý Profile Browser</h1>
        <p>Popup tạo/sửa profile hỗ trợ nhập tay hoặc random từng thông số fingerprint.</p>
      </div>
      <button class="btn primary" @click="openCreatePopup">+ Tạo Profile</button>
    </header>

    <div class="panel table-panel">
      <div class="panel-title">
        <h2>Danh sách profile</h2>
        <div class="toolbar">
          <button class="btn tiny" :disabled="!hasSelected" @click="openSelected">Mở nhiều</button>
          <button class="btn tiny ghost" :disabled="!hasSelected" @click="closeSelected">Đóng nhiều</button>
          <button class="btn tiny danger" :disabled="!hasSelected" @click="deleteSelected">Xóa nhiều</button>
          <button class="btn ghost tiny" @click="loadProfiles">Làm mới</button>
        </div>
      </div>
      <p v-if="loading">Đang tải...</p>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th class="col-check">
                <input v-model="allChecked" type="checkbox" />
              </th>
              <th>Tên profile</th>
              <th>Browser</th>
              <th>Proxy</th>
              <th>Fingerprint</th>
              <th>GPU</th>
              <th>Trạng thái</th>
              <th class="col-actions">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in profiles" :key="row.id">
              <td class="col-check">
                <input v-model="selectedIds" type="checkbox" :value="row.id" />
              </td>
              <td>
                <strong>{{ row.name || 'Profile chưa đặt tên' }}</strong>
              </td>
              <td>{{ row.browser }}</td>
              <td class="mono">{{ row.proxy || '-' }}</td>
              <td>
                <div class="chips">
                  <span class="chip">{{ row?.fingerprint?.viewport?.width }}x{{ row?.fingerprint?.viewport?.height }}</span>
                  <span class="chip">{{ row?.fingerprint?.memory }}GB</span>
                  <span class="chip">{{ row?.fingerprint?.threads }}T</span>
                </div>
              </td>
              <td class="mono">{{ row?.fingerprint?.gpu?.renderer || '-' }}</td>
              <td>
                <span class="status" :class="{ online: opened[row.id] }">
                  {{ opened[row.id] ? 'Opened' : 'Closed' }}
                </span>
              </td>
              <td class="btns">
                <button class="btn tiny" @click="openEditPopup(row)">Sửa</button>
                <button class="btn tiny danger" @click="onDelete(row)">Xóa</button>
                <button v-if="!opened[row.id]" class="btn tiny primary" @click="onOpen(row)">Mở</button>
                <button v-else class="btn tiny ghost" @click="onClose(row)">Đóng</button>
              </td>
            </tr>
            <tr v-if="profiles.length === 0">
              <td colspan="8" class="empty">Chưa có profile. Bấm "Tạo Profile" để bắt đầu.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="popupOpen" class="overlay" @click.self="closePopup">
        <div class="popup">
          <div class="popup-head">
            <h2>{{ isEditing ? 'Sửa profile' : 'Tạo profile mới' }}</h2>
            <button class="btn tiny ghost" @click="closePopup">Đóng</button>
          </div>

          <div class="popup-grid">
            <label>
              <span>Tên profile</span>
              <input v-model="form.name" type="text" placeholder="Profile 01" />
            </label>
            <label>
              <span>Trình duyệt</span>
              <select v-model="form.browser">
                <option value="Chrome">Chrome</option>
                <option value="Edge">Edge</option>
              </select>
            </label>
            <label class="full">
              <span>Proxy</span>
              <input v-model="form.proxy" type="text" placeholder="http://host:port" />
            </label>

            <div class="full section-title">
              <strong>Fingerprint</strong>
              <button class="btn tiny primary" @click="setRandomFingerprint">Random tất cả</button>
            </div>

            <label class="full">
              <span>User Agent</span>
              <div class="row-field">
                <input v-model="form.ua" type="text" />
                <button class="btn tiny" @click="form.ua = pick(UA_OPTIONS)">Random</button>
              </div>
            </label>

            <label>
              <span>Viewport Width</span>
              <div class="row-field">
                <input v-model.number="form.viewportWidth" type="number" min="800" />
                <button class="btn tiny" @click="form.viewportWidth = Number(pick(VIEWPORT_OPTIONS).split('x')[0])">Random</button>
              </div>
            </label>
            <label>
              <span>Viewport Height</span>
              <div class="row-field">
                <input v-model.number="form.viewportHeight" type="number" min="600" />
                <button class="btn tiny" @click="form.viewportHeight = Number(pick(VIEWPORT_OPTIONS).split('x')[1])">Random</button>
              </div>
            </label>

            <label>
              <span>Memory (GB)</span>
              <div class="row-field">
                <input v-model.number="form.memory" type="number" min="2" />
                <button class="btn tiny" @click="form.memory = pick(MEMORY_OPTIONS)">Random</button>
              </div>
            </label>
            <label>
              <span>Threads</span>
              <div class="row-field">
                <input v-model.number="form.threads" type="number" min="2" />
                <button class="btn tiny" @click="form.threads = pick(THREAD_OPTIONS)">Random</button>
              </div>
            </label>

            <label>
              <span>GPU Vendor</span>
              <div class="row-field">
                <input v-model="form.gpuVendor" type="text" />
                <button class="btn tiny" @click="form.gpuVendor = pick(GPU_OPTIONS).vendor">Random</button>
              </div>
            </label>
            <label>
              <span>GPU Renderer</span>
              <div class="row-field">
                <input v-model="form.gpuRenderer" type="text" />
                <button class="btn tiny" @click="form.gpuRenderer = pick(GPU_OPTIONS).renderer">Random</button>
              </div>
            </label>
          </div>

          <div class="actions">
            <button class="btn primary" :disabled="saving" @click="onSubmit">
              {{ isEditing ? 'Lưu thay đổi' : 'Tạo profile' }}
            </button>
            <button class="btn ghost" :disabled="saving" @click="resetForm">Reset form</button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
.page { padding: 24px; color: #e4e4e7; }
.page-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 16px; }
.page-head h1 { margin: 0 0 6px; font-size: 24px; }
.page-head p { margin: 0; color: #a1a1aa; }
.panel { border: 1px solid #27272a; border-radius: 14px; padding: 16px; background: linear-gradient(180deg, #131316 0%, #101012 100%); margin-bottom: 16px; }
.panel-title { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.panel h2 { margin: 0; font-size: 16px; }
.toolbar { display: flex; gap: 8px; flex-wrap: wrap; }
.table-wrap { overflow: auto; border: 1px solid #2d2d33; border-radius: 12px; }
.table { width: 100%; min-width: 980px; border-collapse: collapse; }
.table thead th { background: #1a1a1f; color: #a1a1aa; font-size: 12px; font-weight: 600; text-align: left; padding: 10px; border-bottom: 1px solid #2d2d33; }
.table tbody td { padding: 10px; border-bottom: 1px solid #222228; vertical-align: middle; }
.table tbody tr:hover { background: rgba(234, 179, 8, 0.05); }
.col-check { width: 42px; text-align: center; }
.col-actions { min-width: 180px; }
.status { border: 1px solid #3f3f46; color: #a1a1aa; border-radius: 999px; padding: 2px 8px; font-size: 11px; height: fit-content; }
.status.online { color: #86efac; border-color: #166534; background: rgba(22, 101, 52, 0.2); }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { border: 1px solid #3f3f46; border-radius: 999px; padding: 3px 8px; font-size: 11px; color: #d4d4d8; }
.empty { text-align: center; color: #a1a1aa; padding: 16px; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.btns { display: flex; gap: 6px; flex-wrap: wrap; }
.btn { border: 1px solid #3f3f46; background: #27272a; color: #f4f4f5; padding: 8px 12px; border-radius: 8px; cursor: pointer; }
.btn.primary { background: #eab308; border-color: #ca8a04; color: #111827; font-weight: 700; }
.btn.ghost { background: transparent; }
.btn.danger { background: #7f1d1d; border-color: #991b1b; }
.btn.tiny { font-size: 12px; padding: 5px 8px; }
.overlay { position: fixed; inset: 0; z-index: 10060; background: rgba(0, 0, 0, 0.62); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 20px; }
.popup { width: min(920px, 96vw); max-height: 90vh; overflow: auto; background: #101012; border: 1px solid #3f3f46; border-radius: 14px; padding: 16px; }
.popup-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.popup-head h2 { margin: 0; font-size: 18px; }
.popup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.popup-grid label span { display: block; font-size: 12px; color: #a1a1aa; margin-bottom: 6px; }
.popup-grid input, .popup-grid select { width: 100%; border: 1px solid #3f3f46; background: #18181b; color: #fafafa; border-radius: 8px; padding: 8px 10px; }
.full { grid-column: 1 / span 2; }
.section-title { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; border-top: 1px solid #27272a; padding-top: 12px; }
.row-field { display: flex; gap: 8px; }
.actions { display: flex; gap: 8px; margin-top: 14px; justify-content: flex-end; }
@media (max-width: 900px) {
  .popup-grid { grid-template-columns: 1fr; }
  .full { grid-column: auto; }
}
</style>
