<script setup>
import { computed, onMounted, ref } from 'vue'
import { projectService } from '@/services/project.service'

const loading = ref(false)
const error = ref('')
const items = ref([])
const keyword = ref('')
const priceFilter = ref('all') // all | free | paid

const normalizePrice = (item) => {
  if (typeof item?.isFree === 'boolean') return item.isFree ? 0 : Number(item?.price || 0)
  if (typeof item?.free === 'boolean') return item.free ? 0 : Number(item?.price || 0)
  const p = Number(item?.price ?? item?.priceVnd ?? item?.amount ?? 0)
  return Number.isFinite(p) && p > 0 ? p : 0
}

const normalizedItems = computed(() =>
  (Array.isArray(items.value) ? items.value : []).map((raw, index) => {
    const price = normalizePrice(raw)
    return {
      id: raw?.id || raw?._id || `store-flow-${index}`,
      name: String(raw?.name || raw?.title || 'Workflow chưa đặt tên'),
      image: String(raw?.image || raw?.thumbnail || raw?.cover || ''),
      owner: String(raw?.owner || raw?.author || raw?.createdBy || 'Không rõ'),
      price,
      isFree: price <= 0,
    }
  })
)

const filteredItems = computed(() => {
  const q = keyword.value.trim().toLowerCase()
  return normalizedItems.value.filter((item) => {
    if (priceFilter.value === 'free' && !item.isFree) return false
    if (priceFilter.value === 'paid' && item.isFree) return false
    if (!q) return true
    return item.name.toLowerCase().includes(q) || item.owner.toLowerCase().includes(q)
  })
})

const formatPrice = (price) => {
  if (!price || price <= 0) return 'Miễn phí'
  return `${new Intl.NumberFormat('vi-VN').format(price)}đ`
}

const loadStores = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await projectService.listStoreFlows()
    items.value = Array.isArray(res?.data) ? res.data : []
  } catch (e) {
    error.value = e?.message || 'Không tải được Store Flows'
    items.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadStores)
</script>

<template>
  <section class="store-page">
    <header class="store-head">
      <h2>WorkFlow Store</h2>
      <p>Kho workflow.</p>
    </header>

    <section class="store-filters">
      <input
        v-model="keyword"
        type="text"
        class="search-input"
        placeholder="Tìm theo tên flow hoặc người đăng..."
      />
      <select v-model="priceFilter" class="price-select">
        <option value="all">Tất cả</option>
        <option value="free">Miễn phí</option>
        <option value="paid">Có phí</option>
      </select>
      <button type="button" class="reload-btn" :disabled="loading" @click="loadStores">
        {{ loading ? 'Đang tải...' : 'Tải lại' }}
      </button>
    </section>

    <p v-if="error" class="error-text">{{ error }}</p>
    <p v-else-if="loading" class="hint-text">Đang tải dữ liệu store...</p>
    <p v-else-if="!filteredItems.length" class="hint-text">Không có workflow phù hợp bộ lọc.</p>

    <section v-else class="grid">
      <article v-for="flow in filteredItems" :key="flow.id" class="card">
        <div class="thumb-wrap">
          <img v-if="flow.image" :src="flow.image" :alt="flow.name" class="thumb" />
          <div v-else class="thumb-empty">No Image</div>
        </div>
        <div class="card-body">
          <h3 class="name">{{ flow.name }}</h3>
          <p class="owner">Bởi: {{ flow.owner }}</p>
          <p class="price" :class="{ free: flow.isFree }">
            {{ formatPrice(flow.price) }}
          </p>
        </div>
      </article>
    </section>
  </section>
</template>

<style scoped>
.store-page { padding: 20px; display: grid; gap: 14px; }
.store-head h2 { margin: 0; font-size: 30px; }
.store-head p { margin: 6px 0 0; color: var(--color-text-muted); }
.store-filters { display: grid; grid-template-columns: 1fr 160px 110px; gap: 10px; }
.search-input,.price-select,.reload-btn {
  border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg-soft);
  color: var(--color-text); padding: 10px 12px;
}
.reload-btn { cursor: pointer; }
.reload-btn:disabled { opacity: .6; cursor: not-allowed; }
.hint-text { margin: 0; color: var(--color-text-muted); }
.error-text { margin: 0; color: #f87171; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.card {
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: var(--color-bg-elevated);
  overflow: hidden;
  display: grid;
}
.thumb-wrap { aspect-ratio: 16 / 9; background: #0f172a; }
.thumb { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb-empty { width: 100%; height: 100%; display: grid; place-items: center; color: #a1a1aa; font-size: 12px; }
.card-body { padding: 10px; display: grid; gap: 4px; }
.name { margin: 0; font-size: 15px; color: var(--color-text); }
.owner { margin: 0; font-size: 12px; color: var(--color-text-muted); }
.price { margin: 2px 0 0; font-size: 13px; color: #facc15; font-weight: 700; }
.price.free { color: #34d399; }
@media (max-width: 900px) {
  .store-filters { grid-template-columns: 1fr; }
}
</style>
