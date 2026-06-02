/** Google Flow API v3 — constants & legacy field migration */

export const FLOW_API_V3_BASE = 'https://flow-api.nanoai.pics/api/v3';

export const FLOW_API_V2_BASE = 'https://flow-api.nanoai.pics/api/v2';

export const FLOW_TASK_POLL_MS = 8000;

export const IMAGE_MODELS = [
  { value: 'GEM_PIX_2', label: 'Nano Banana Pro' },
  { value: 'NARWHAL', label: 'Nano Banana' },
  { value: 'IMAGEN_3_5', label: 'Imagen 4' },
];

export const IMAGE_RATIO_OPTIONS = [
  { value: 'IMAGE_ASPECT_RATIO_LANDSCAPE', label: '16:9' },
  { value: 'IMAGE_ASPECT_RATIO_LANDSCAPE_FOUR_THREE', label: '4:3' },
  { value: 'IMAGE_ASPECT_RATIO_SQUARE', label: '1:1' },
  { value: 'IMAGE_ASPECT_RATIO_PORTRAIT_THREE_FOUR', label: '3:4' },
  { value: 'IMAGE_ASPECT_RATIO_PORTRAIT', label: '9:16' },
];

export const VIDEO_TIERS = [
  { value: 'ultra', label: 'Ultra (mặc định)' },
  { value: 'pro', label: 'Pro' },
];

/** Models available per tier (veo3LiteLowPriority chỉ ultra). */
export const VIDEO_MODELS = [
  { value: 'omniFlash', label: 'Omni Flash', tiers: ['ultra', 'pro'] },
  { value: 'veo3Lite', label: 'Veo 3.1 Lite', tiers: ['ultra', 'pro'] },
  { value: 'veo3Fast', label: 'Veo 3.1 Fast', tiers: ['ultra', 'pro'] },
  { value: 'veo3Quality', label: 'Veo 3.1 Quality', tiers: ['ultra', 'pro'] },
  { value: 'veo3LiteLowPriority', label: 'Veo 3.1 Lite (low priority)', tiers: ['ultra'] },
];

export const VIDEO_RATIO_OPTIONS = [
  { value: 'VIDEO_ASPECT_RATIO_LANDSCAPE', label: '16:9' },
  { value: 'VIDEO_ASPECT_RATIO_PORTRAIT', label: '9:16' },
];

/** Model mặc định khi tạo node mới trong workflow (có thể ghi đè trên từng node). */
export const DEFAULT_WORKFLOW_MODELS = {
  imageModel: 'GEM_PIX_2',
  videoModel: 'veo3Fast',
};

export function normalizeWorkflowDefaults(raw, tier = 'ultra') {
  const t = normalizeVideoTier(tier);
  return {
    imageModel: normalizeImageModel(raw?.imageModel || DEFAULT_WORKFLOW_MODELS.imageModel),
    videoModel: normalizeVideoModel(raw?.videoModel || DEFAULT_WORKFLOW_MODELS.videoModel, t),
  };
}

const LEGACY_IMAGE_MODEL = {
  IMAGEN_3: 'IMAGEN_3_5',
  IMAGEN_4: 'IMAGEN_3_5',
};

const LEGACY_VIDEO_MODEL = {
  VEO_3_FAST: 'veo3Fast',
  VEO_3_PRO: 'veo3Quality',
  veo_3_fast: 'veo3Fast',
  veo_3_pro: 'veo3Quality',
};

export function normalizeImageModel(value) {
  const v = String(value || '').trim();
  if (!v) return 'GEM_PIX_2';
  return LEGACY_IMAGE_MODEL[v] || v;
}

export function normalizeVideoModel(value, tier = 'ultra') {
  const v = String(value || '').trim();
  const mapped = LEGACY_VIDEO_MODEL[v] || v || 'veo3Fast';
  const entry = VIDEO_MODELS.find((m) => m.value === mapped);
  if (!entry) return 'veo3Fast';
  if (!entry.tiers.includes(tier)) {
    return tier === 'pro' ? 'veo3Fast' : mapped;
  }
  return mapped;
}

export function normalizeVideoTier(value) {
  const t = String(value || 'ultra').toLowerCase();
  return t === 'pro' ? 'pro' : 'ultra';
}

export function videoModelsForTier(tier) {
  const t = normalizeVideoTier(tier);
  return VIDEO_MODELS.filter((m) => m.tiers.includes(t));
}

/** Extract display URL from generateNanoImage return value. */
export function nanoImageResultUrl(result) {
  if (typeof result === 'string') return result;
  if (result && typeof result === 'object') {
    return result.dataUrl || result.url || result.imageUrl || result.result || null;
  }
  return null;
}
