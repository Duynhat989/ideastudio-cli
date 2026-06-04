<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  ListVideo,
  ListX,
  Loader2,
  Music2,
  Pause,
  Play,
  Plus,
  Scissors,
  Trash2,
  Volume2,
  VolumeOff,
  WandSparkles,
  XCircle,
  Eye,
  EyeOff
} from 'lucide-vue-next';
import { projectService } from '@/services/project.service';
import { notify } from '@/composables/useNotify.js';
import { runtime } from '@/services/runtime';
import {
  FADE_EFFECT_TYPES,
  TRANSITION_EFFECT_TYPES,
  computePreviewOpacity,
  ensureClipEffects
} from '@/constants/renderEffects.js';

const props = defineProps({
  sourceAssets: { type: Array, default: () => [] },
  /** Project hiện tại — dùng upload asset lên server */
  projectId: { type: String, default: '' },
});
const emit = defineEmits(['back']);

const TRACK_LABEL_WIDTH = 110;
const TRACK_GAP_PX = 0;

const TEXT_FONT_SIZES = [4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 42, 48, 56, 64, 72, 84, 96];
const TEXT_COLOR_SWATCHES = [
  '#ffffff', '#eae6dc', '#d4af37', '#facc15', '#fca5a5', '#fdba74', '#86efac', '#7dd3fc', '#c4b5fd', '#f0abfc',
  '#1a1a1a', '#3d3d3d', '#64748b', '#0ea5e9', '#22c55e', '#e11d48'
];
const TEXT_STYLE_OPTIONS = [
  { value: 'plain', label: 'Không nền / viền' },
  { value: 'fill', label: 'Nền (box)' },
  { value: 'outline', label: 'Viền chữ' }
];
/** CSS font-weight; render map sang hệ số cỡ chữ + cùng textFontScale */
const TEXT_FONT_WEIGHT_OPTIONS = [
  { value: 300, label: '300 — Mảnh' },
  { value: 400, label: '400 — Chuẩn' },
  { value: 500, label: '500 — Vừa' },
  { value: 600, label: '600 — Đậm vừa' },
  { value: 700, label: '700 — Đậm' },
  { value: 800, label: '800 — Rất đậm' },
  { value: 900, label: '900 — Tối đa' }
];

const ensureClipEffectFields = (clip) => {
  if (!clip || (clip.type !== 'video' && clip.type !== 'image')) return;
  ensureClipEffects(clip);
};

const clipHasEffects = (clip) => {
  ensureClipEffectFields(clip);
  return clip.fadeInType !== 'none' || clip.fadeOutType !== 'none' || clip.transitionType !== 'none';
};

const canApplyVisualEffect = computed(() => {
  const c = selectedClip.value;
  return !!c && (c.type === 'video' || c.type === 'image') && selectedClipCount.value <= 1;
});

const applyTransitionEffect = (effectId) => {
  const clip = selectedClip.value;
  if (!canApplyVisualEffect.value) return;
  ensureClipEffectFields(clip);
  clip.transitionType = effectId;
  const preset = TRANSITION_EFFECT_TYPES.find((e) => e.id === effectId);
  if (preset?.defaultDuration > 0) clip.transitionDuration = preset.defaultDuration;
  scheduleTimelineSave();
};

const applyFadeInEffect = (effectId) => {
  const clip = selectedClip.value;
  if (!canApplyVisualEffect.value) return;
  ensureClipEffectFields(clip);
  clip.fadeInType = effectId;
  const preset = FADE_EFFECT_TYPES.find((e) => e.id === effectId);
  if (preset?.defaultDuration > 0) clip.fadeInDuration = preset.defaultDuration;
  scheduleTimelineSave();
};

const applyFadeOutEffect = (effectId) => {
  const clip = selectedClip.value;
  if (!canApplyVisualEffect.value) return;
  ensureClipEffectFields(clip);
  clip.fadeOutType = effectId;
  const preset = FADE_EFFECT_TYPES.find((e) => e.id === effectId);
  if (preset?.defaultDuration > 0) clip.fadeOutDuration = preset.defaultDuration;
  scheduleTimelineSave();
};

const clearAllClipEffects = () => {
  const clip = selectedClip.value;
  if (!canApplyVisualEffect.value) return;
  ensureClipEffectFields(clip);
  clip.fadeInType = 'none';
  clip.fadeOutType = 'none';
  clip.transitionType = 'none';
  scheduleTimelineSave();
};

const hexForColorInput = (c) => {
  const s = String(c || '#ffffff').trim();
  if (/^#[0-9a-fA-F]{6}$/i.test(s)) return s;
  const m = s.match(/^#([0-9a-fA-F]{3})$/i);
  if (m) {
    const h = m[1];
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  return '#ffffff';
};

const ensureTextClipFields = (clip) => {
  if (!clip || clip.type !== 'text') return;
  if (!clip.textStyle) clip.textStyle = clip.box !== false ? 'fill' : 'plain';
  if (clip.textBoxWidthPercent == null || Number.isNaN(Number(clip.textBoxWidthPercent))) clip.textBoxWidthPercent = 40;
  if (clip.strokeWidth == null || Number.isNaN(Number(clip.strokeWidth))) clip.strokeWidth = 2;
  if (clip.fontWeight == null || Number.isNaN(Number(clip.fontWeight))) clip.fontWeight = 400;
};

const getTextOverlayItemStyle = (clip) => {
  const mode = clip.textStyle || (clip.box !== false ? 'fill' : 'plain');
  const base = {
    left: `${clip.xPercent || 0}%`,
    top: `${clip.yPercent || 0}%`,
    color: clip.color || '#fff',
    fontSize: `${clip.fontSize || 48}px`,
    fontWeight: Math.max(100, Math.min(900, Number(clip.fontWeight) || 400)),
    width: `${clip.textBoxWidthPercent || 40}%`
  };
  if (mode === 'fill') {
    return {
      ...base,
      background: clip.boxColor || '#00000088',
      border: '1px solid rgba(250,204,21,0.28)',
      boxShadow: 'none'
    };
  }
  if (mode === 'outline') {
    const w = Math.max(0, Math.min(12, Number(clip.strokeWidth ?? 2)));
    return {
      ...base,
      background: 'transparent',
      border: `${w}px solid ${clip.color || '#ffffff'}`,
      boxShadow: 'none'
    };
  }
  return { ...base, background: 'transparent', border: 'none', boxShadow: 'none' };
};

const applyTextColorSwatch = (hex) => {
  const clip = selectedClip.value;
  if (!clip || clip.type !== 'text') return;
  clip.color = hex;
  onInspectorChange();
};

const applyBoxColorSwatch = (hex) => {
  const clip = selectedClip.value;
  if (!clip || clip.type !== 'text') return;
  clip.boxColor = hex;
  onInspectorChange();
};

const onBoxNativeColorInput = (e) => {
  const clip = selectedClip.value;
  if (!clip || clip.type !== 'text') return;
  const v = e.target.value;
  const prev = String(clip.boxColor || '#00000088');
  const m = prev.match(/^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})$/i);
  clip.boxColor = v.length === 7 ? `${v}${m ? m[2] : '88'}` : v;
  onInspectorChange();
};

const resources = ref([...(props.sourceAssets || [])]);
const uniqNonEmptyStrings = (arr = []) => {
  const out = [];
  const seen = new Set();
  for (const item of arr) {
    if (typeof item !== 'string') continue;
    const v = item.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
};

const collectClipSources = (trackList = []) => {
  const sources = [];
  for (const track of Array.isArray(trackList) ? trackList : []) {
    for (const clip of Array.isArray(track?.clips) ? track.clips : []) {
      if (typeof clip?.source === 'string' && clip.source.trim()) {
        sources.push(clip.source.trim());
      }
    }
  }
  return uniqNonEmptyStrings(sources);
};
const tracks = ref([
  { id: 'track-1', name: 'Track 1', type: 'visual', hidden: false, clips: [] },
  { id: 'track-2', name: 'Track 2', type: 'visual', hidden: false, clips: [] },
  { id: 'track-3', name: 'Track 3', type: 'visual', hidden: false, clips: [] },
  { id: 'track-4', name: 'Track 4', type: 'visual', hidden: false, clips: [] },
  { id: 'track-5', name: 'Track 5', type: 'audio', hidden: false, clips: [] }
]);
const selectedTrackId = ref('track-1');
const selectedClip = ref(null);
const selectedClipIds = ref(new Set());
const lastClipAnchorId = ref('');
const marqueeSelect = ref(null);
const TIMELINE_RULER_HEIGHT = 28;
const TIMELINE_TRACK_ROW_HEIGHT = 52;
const TIMELINE_CLIP_TOP = 4;
const TIMELINE_CLIP_HEIGHT = 44;

const selectedClipCount = computed(() => selectedClipIds.value.size);
const hasTimelineSelection = computed(() => selectedClipCount.value > 0 || !!selectedClip.value);

const findClipEntry = (clipId) => {
  for (const track of tracks.value) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return { clip, trackId: track.id };
  }
  return null;
};

const isClipSelected = (clipId) => selectedClipIds.value.has(clipId);

const syncPrimarySelectedClip = () => {
  const ids = selectedClipIds.value;
  if (!ids.size) {
    selectedClip.value = null;
    return;
  }
  if (selectedClip.value && ids.has(selectedClip.value.id)) return;
  const firstId = [...ids][0];
  const found = findClipEntry(firstId);
  selectedClip.value = found?.clip || null;
  if (found?.trackId) selectedTrackId.value = found.trackId;
};

const clearClipSelection = () => {
  selectedClipIds.value = new Set();
  selectedClip.value = null;
  lastClipAnchorId.value = '';
};

const setSingleClipSelection = (clip, trackId) => {
  selectedClipIds.value = new Set([clip.id]);
  selectedClip.value = clip;
  selectedTrackId.value = trackId;
  lastClipAnchorId.value = clip.id;
};

const selectTimelineClip = (clip, trackId, e) => {
  if (!clip) return;
  selectedTrackId.value = trackId;
  if (clip.type === 'video' || clip.type === 'image') ensureVisualMediaLayoutFields(clip);
  if (clip.type === 'video' || clip.type === 'image') ensureClipEffectFields(clip);

  const additive = e?.metaKey || e?.ctrlKey;
  const range = e?.shiftKey;

  if (range && lastClipAnchorId.value) {
    const track = tracks.value.find((t) => t.id === trackId);
    const anchorIdx = track?.clips.findIndex((c) => c.id === lastClipAnchorId.value) ?? -1;
    const currentIdx = track?.clips.findIndex((c) => c.id === clip.id) ?? -1;
    if (track && anchorIdx >= 0 && currentIdx >= 0) {
      const lo = Math.min(anchorIdx, currentIdx);
      const hi = Math.max(anchorIdx, currentIdx);
      const rangeIds = track.clips.slice(lo, hi + 1).map((c) => c.id);
      if (additive) {
        const next = new Set(selectedClipIds.value);
        rangeIds.forEach((id) => next.add(id));
        selectedClipIds.value = next;
      } else {
        selectedClipIds.value = new Set(rangeIds);
      }
      selectedClip.value = clip;
      return;
    }
  }

  if (additive) {
    const next = new Set(selectedClipIds.value);
    if (next.has(clip.id)) {
      next.delete(clip.id);
      selectedClipIds.value = next;
      syncPrimarySelectedClip();
    } else {
      next.add(clip.id);
      selectedClipIds.value = next;
      selectedClip.value = clip;
    }
    lastClipAnchorId.value = clip.id;
    return;
  }

  setSingleClipSelection(clip, trackId);
};

const clientToTimelineContent = (clientX, clientY) => {
  const content = timelineContentRef.value;
  const viewport = timelineViewportRef.value;
  if (!content || !viewport) return { x: 0, y: 0 };
  const rect = content.getBoundingClientRect();
  const vScroll = viewport.parentElement?.scrollTop || 0;
  return {
    x: clientX - rect.left + viewport.scrollLeft,
    y: clientY - rect.top + vScroll,
  };
};

const normalizeMarqueeRect = (m) => ({
  left: Math.min(m.x1, m.x2),
  top: Math.min(m.y1, m.y2),
  right: Math.max(m.x1, m.x2),
  bottom: Math.max(m.y1, m.y2),
});

const getClipBoundsInContent = (clip, trackIndex) => {
  const pps = pixelsPerSecond.value;
  const left = TRACK_LABEL_WIDTH + TRACK_GAP_PX + Number(clip.startTime || 0) * pps;
  const width = Math.max(56, Number(clip.duration || 0) * pps);
  const top = TIMELINE_RULER_HEIGHT + trackIndex * TIMELINE_TRACK_ROW_HEIGHT + TIMELINE_CLIP_TOP;
  return {
    left,
    right: left + width,
    top,
    bottom: top + TIMELINE_CLIP_HEIGHT,
  };
};

const rectsIntersect = (a, b) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);

const applyMarqueeSelection = (marquee, additive = false) => {
  const rect = normalizeMarqueeRect(marquee);
  if (rect.right - rect.left < 2 && rect.bottom - rect.top < 2) return false;
  const hits = [];
  tracks.value.forEach((track, trackIndex) => {
    for (const clip of track.clips) {
      if (rectsIntersect(getClipBoundsInContent(clip, trackIndex), rect)) {
        hits.push({ clip, trackId: track.id });
      }
    }
  });
  const ids = hits.map((h) => h.clip.id);
  if (additive) {
    const next = new Set(selectedClipIds.value);
    ids.forEach((id) => next.add(id));
    selectedClipIds.value = next;
  } else {
    selectedClipIds.value = new Set(ids);
  }
  if (hits.length) {
    const last = hits[hits.length - 1];
    selectedClip.value = last.clip;
    selectedTrackId.value = last.trackId;
    lastClipAnchorId.value = last.clip.id;
  } else if (!additive) {
    clearClipSelection();
  }
  return true;
};

const marqueeStyle = computed(() => {
  const m = marqueeSelect.value;
  if (!m) return {};
  const rect = normalizeMarqueeRect(m);
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${Math.max(0, rect.right - rect.left)}px`,
    height: `${Math.max(0, rect.bottom - rect.top)}px`,
  };
});

const startMarqueeSelection = (e) => {
  const start = clientToTimelineContent(e.clientX, e.clientY);
  let moved = false;
  marqueeSelect.value = { x1: start.x, y1: start.y, x2: start.x, y2: start.y };
  const move = (evt) => {
    const pt = clientToTimelineContent(evt.clientX, evt.clientY);
    if (Math.abs(pt.x - start.x) > 3 || Math.abs(pt.y - start.y) > 3) moved = true;
    marqueeSelect.value = { x1: start.x, y1: start.y, x2: pt.x, y2: pt.y };
  };
  const up = (evt) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    const current = marqueeSelect.value;
    marqueeSelect.value = null;
    const additive = evt.metaKey || evt.ctrlKey;
    if (moved && current) {
      applyMarqueeSelection(current, additive);
      return;
    }
    if (!additive) clearClipSelection();
    setPlayheadFromClientX(evt.clientX);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
};

const onTimelineContentPointerDown = (e) => {
  if (e.button !== 0) return;
  if (e.target.closest('.timeline-clip')) return;
  if (e.target.closest('.track-label')) return;
  if (e.target.closest('.time-ruler')) return;
  if (!e.target.closest('.track-lane')) return;
  startMarqueeSelection(e);
};

const onRulerPointerDown = (e) => {
  if (e.button !== 0) return;
  e.stopPropagation();
  setPlayheadFromClientX(e.clientX);
  const move = (evt) => setPlayheadFromClientX(evt.clientX);
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
};
const textSizeSelectOptions = computed(() => {
  const sizes = new Set(TEXT_FONT_SIZES);
  const c = selectedClip.value;
  if (c?.type === 'text') {
    const fs = Math.round(Number(c.fontSize));
    if (Number.isFinite(fs)) sizes.add(fs);
  }
  return Array.from(sizes).sort((a, b) => a - b);
});
const inspectorOpen = ref(false);
const aspectRatio = ref('portrait');
const renderResult = ref('');
const renderModalOpen = ref(false);
/** setup | progress | done | error */
const renderModalStep = ref('setup');
const renderQuality = ref('hd');
const renderOutputPath = ref('');
const renderProgress = ref(0);
const renderJobId = ref('');
/** Đường dẫn file đã xuất (để mở thư mục chứa file). */
const renderSavedFilePath = ref('');
let renderPollTimer = null;

const clearRenderPoll = () => {
  if (renderPollTimer != null) {
    clearTimeout(renderPollTimer);
    renderPollTimer = null;
  }
};

const renderModalTitle = computed(() => {
  switch (renderModalStep.value) {
    case 'progress':
      return 'Đang xuất…';
    case 'done':
      return 'Hoàn thành';
    case 'error':
      return 'Không thể xuất';
    default:
      return 'Xuất video';
  }
});

const renderModalSub = computed(() => {
  switch (renderModalStep.value) {
    case 'progress':
      return 'Có thể dừng bất cứ lúc nào. Tiến trình hiển thị bên dưới đường dẫn lưu.';
    case 'done':
      return 'Video đã lưu. Mở thư mục chứa file (không mở file bằng ứng dụng khác) hoặc đóng.';
    case 'error':
      return 'Kiểm tra lỗi bên dưới và thử lại.';
    default:
      return 'Chọn chất lượng và vị trí lưu file trước khi xuất.';
  }
});

const playhead = ref(0);
const isPlaying = ref(false);
/** px trên 1 giây — càng nhỏ timeline càng “thu nhỏ” */
const TIMELINE_ZOOM_MIN = 4;
const TIMELINE_ZOOM_MAX = 220;
const zoom = ref(86);

const pad2 = (n) => String(Math.floor(Math.max(0, n))).padStart(2, '0');
/** Giờ:phút:giây; thêm .cs nếu có phần thập phân (playhead) */
const formatTimeHms = (totalSeconds) => {
  const raw = Math.max(0, Number(totalSeconds) || 0);
  const ms = Math.round(raw * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const centi = Math.floor((ms % 1000) / 10);
  const base = `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
  return centi === 0 ? base : `${base}.${String(centi).padStart(2, '0')}`;
};

/** Nhiều clip video preview — key = clip.id */
const previewVideoEls = ref({});
const setPreviewVideoEl = (clipId, el) => {
  if (!clipId) return;
  if (el) {
    previewVideoEls.value[clipId] = el;
  } else {
    const rest = { ...previewVideoEls.value };
    delete rest[clipId];
    previewVideoEls.value = rest;
  }
};
const previewAudioRef = ref(null);
const previewFrameRef = ref(null);
const timelineViewportRef = ref(null);
const timelineContentRef = ref(null);
const scrollbarTrackRef = ref(null);
const scrollbarThumbRef = ref(null);

let raf = null;
let syncPreviewRaf = null;
let lastPlayheadScrollAt = 0;
let draggingScrollbar = false;
let dragStartX = 0;
let dragStartScroll = 0;
let timelineSaveTimer = null;
let timelineHydrating = false;
/** Chặn auto-save trước khi load timeline.json xong — tránh ghi đè dữ liệu cũ. */
let timelineReady = true;
const canUseBackendDuration = ref(true);
const draggingTextId = ref('');
const resizingTextId = ref('');
const draggingVisualId = ref('');
const resizingVisualId = ref('');

const MEDIA_PANEL_MIN = 220;
const MEDIA_PANEL_MAX = 720;
const INSPECTOR_PANEL_MIN = 220;
const INSPECTOR_PANEL_MAX = 720;
const PLAYER_PANEL_MIN = 280;
const SPLITTER_TOTAL_PX = 12;
const LAYOUT_STORAGE_KEY = 'ideastudio-render-layout-v1';
const mediaPanelWidth = ref(320);
const inspectorPanelWidth = ref(320);
const layoutSplitDragging = ref('');
const layoutWidthsReady = ref(false);
const editorTopRowRef = ref(null);
const resourceDurationMap = ref({});

const clampPanelWidth = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));

const getSidePanelMax = () => {
  const row = editorTopRowRef.value;
  if (!row?.clientWidth) return MEDIA_PANEL_MAX;
  const total = row.clientWidth - SPLITTER_TOTAL_PX;
  const dynamicMax = Math.max(MEDIA_PANEL_MIN, Math.floor((total - PLAYER_PANEL_MIN) / 2));
  return Math.min(MEDIA_PANEL_MAX, dynamicMax);
};

const applyLayoutWidths = (data = {}) => {
  const max = getSidePanelMax();
  if (typeof data.mediaPanelWidth === 'number' && Number.isFinite(data.mediaPanelWidth)) {
    mediaPanelWidth.value = clampPanelWidth(data.mediaPanelWidth, MEDIA_PANEL_MIN, max);
  }
  if (typeof data.inspectorPanelWidth === 'number' && Number.isFinite(data.inspectorPanelWidth)) {
    inspectorPanelWidth.value = clampPanelWidth(data.inspectorPanelWidth, INSPECTOR_PANEL_MIN, max);
  }
};

const measureEqualLayout = () => {
  const row = editorTopRowRef.value;
  if (!row?.clientWidth) return;
  const third = Math.floor((row.clientWidth - SPLITTER_TOTAL_PX) / 3);
  const max = getSidePanelMax();
  const side = clampPanelWidth(third, MEDIA_PANEL_MIN, max);
  mediaPanelWidth.value = side;
  inspectorPanelWidth.value = side;
};

const saveLayoutToLocal = () => {
  if (!layoutWidthsReady.value) return;
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify({
      mediaPanelWidth: mediaPanelWidth.value,
      inspectorPanelWidth: inspectorPanelWidth.value
    }));
  } catch {
    /* ignore */
  }
};

const loadLayoutFromLocal = () => {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return false;
    applyLayoutWidths(JSON.parse(raw));
    return true;
  } catch {
    return false;
  }
};

const initLayoutWidths = () => {
  if (!loadLayoutFromLocal()) measureEqualLayout();
  layoutWidthsReady.value = true;
};

const persistLayoutPanels = () => {
  if (!layoutWidthsReady.value || timelineHydrating) return;
  saveLayoutToLocal();
  scheduleTimelineSave();
};

const startLayoutSplitDrag = (e, kind) => {
  e.preventDefault();
  layoutSplitDragging.value = kind;
  const startX = e.clientX;
  const startMedia = mediaPanelWidth.value;
  const startInspector = inspectorPanelWidth.value;
  const move = (evt) => {
    const dx = evt.clientX - startX;
    const max = getSidePanelMax();
    if (kind === 'media-player') {
      mediaPanelWidth.value = clampPanelWidth(startMedia + dx, MEDIA_PANEL_MIN, max);
    } else {
      inspectorPanelWidth.value = clampPanelWidth(startInspector - dx, INSPECTOR_PANEL_MIN, max);
    }
  };
  const up = () => {
    layoutSplitDragging.value = '';
    document.body.classList.remove('render-split-dragging');
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    persistLayoutPanels();
  };
  document.body.classList.add('render-split-dragging');
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
};

const onSplitMediaPlayerDown = (e) => startLayoutSplitDrag(e, 'media-player');
const onSplitPlayerInspectorDown = (e) => startLayoutSplitDrag(e, 'player-inspector');

const isVideo = (url = '') => ['.mp4', '.webm', '.mov', '.mkv'].some((ext) => url.toLowerCase().includes(ext)) || url.includes('video');
const isAudio = (url = '') =>
  ['.mp3', '.wav', '.aac', '.m4a', '.ogg', '.flac', '.opus'].some((ext) => url.toLowerCase().includes(ext)) ||
  url.includes('audio');
const mediaType = (url = '') => (isAudio(url) ? 'audio' : (isVideo(url) ? 'video' : 'image'));
const getResourceThumbName = (url = '') => {
  if (!url) return 'Untitled';
  try {
    const noQuery = String(url).split('?')[0];
    const raw = noQuery.substring(noQuery.lastIndexOf('/') + 1) || noQuery;
    return decodeURIComponent(raw) || 'Untitled';
  } catch (_) {
    return String(url);
  }
};

const truncateMiddleName = (name = '', maxLen = 24) => {
  const s = String(name || '');
  if (s.length <= maxLen) return s;
  const keep = Math.max(4, Math.floor((maxLen - 1) / 2));
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
};

const formatResourceDuration = (seconds) => {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n <= 0) return '';
  const total = Math.floor(n);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const resourceDurationLabel = (url) => {
  const cached = resourceDurationMap.value[url] ?? durationCache.get(url);
  return cached ? formatResourceDuration(cached) : '';
};

const resourceOnTimeline = computed(() => {
  const set = new Set();
  for (const track of tracks.value) {
    for (const clip of track.clips) {
      if (typeof clip?.source === 'string' && clip.source.trim()) set.add(clip.source.trim());
    }
  }
  return set;
});

const syncResourceDurations = async (list = []) => {
  for (const url of list) {
    if (resourceDurationMap.value[url] || durationCache.has(url)) {
      if (durationCache.has(url) && !resourceDurationMap.value[url]) {
        resourceDurationMap.value = { ...resourceDurationMap.value, [url]: durationCache.get(url) };
      }
      continue;
    }
    const kind = mediaType(url);
    if (kind !== 'video' && kind !== 'audio') continue;
    const duration = await resolveVideoOrAudioDuration(url);
    if (duration) {
      resourceDurationMap.value = { ...resourceDurationMap.value, [url]: duration };
    }
  }
};

const onResourceMediaMeta = (url, e) => {
  const d = Number(e?.target?.duration);
  if (!Number.isFinite(d) || d <= 0) return;
  resourceDurationMap.value = { ...resourceDurationMap.value, [url]: d };
  durationCache.set(url, d);
};
const selectedTrack = computed(() => tracks.value.find((t) => t.id === selectedTrackId.value) || tracks.value[0]);
/** Lane không bị ẩn (Eye) — preview / render chỉ dùng các lane này. */
const effectiveTracks = computed(() => tracks.value.filter((t) => !t.hidden));

const pixelsPerSecond = computed(() => zoom.value);
const contentDuration = computed(() => {
  let end = 0;
  for (const track of tracks.value) {
    for (const clip of track.clips) end = Math.max(end, Number(clip.startTime || 0) + Number(clip.duration || 0));
  }
  return end;
});
const timelineDuration = computed(() => Math.max(15, contentDuration.value, contentDuration.value * 1.5));
const timelineWidth = computed(() => Math.max(1200, timelineDuration.value * pixelsPerSecond.value));
const timelineInnerWidth = computed(() => TRACK_LABEL_WIDTH + TRACK_GAP_PX + timelineWidth.value);
const timeMarkers = computed(() => Array.from({ length: Math.ceil(timelineDuration.value / 5) + 1 }, (_, i) => i * 5));
const playheadPx = computed(() => TRACK_LABEL_WIDTH + TRACK_GAP_PX + (playhead.value * pixelsPerSecond.value));

const resourceUploadBusy = ref(false);
const addAllVideosBusy = ref(false);
const resourceVideoCount = computed(() => resources.value.filter((url) => mediaType(url) === 'video').length);
const RESOURCE_PANEL_TABS = [
  { id: 'media', label: 'Media' },
  { id: 'text', label: 'Text' },
  { id: 'effect', label: 'Effect' },
];
const resourcePanelTab = ref('media');
const TEXT_CLIP_PRESETS = [
  { label: 'Tiêu đề', text: 'Tiêu đề video' },
  { label: 'Phụ đề', text: 'Phụ đề' },
  { label: 'Chú thích', text: 'Chú thích' },
  { label: 'Mẫu', text: 'Sample text' },
];

const assetKindFromFile = (file) => {
  if (file?.type?.startsWith('video/')) return 'video';
  if (file?.type?.startsWith('audio/')) return 'audio';
  return 'image';
};

const onAddExternalFiles = async (e) => {
  const input = e.target;
  const files = Array.from(input.files || []);
  input.value = '';
  if (!files.length) return;
  if (!props.projectId) {
    await notify.alert({
      title: 'Chưa có project',
      message: 'Không thể upload lên assets khi chưa có project.',
      variant: 'warning',
    });
    return;
  }
  resourceUploadBusy.value = true;
  try {
    for (const file of files) {
      const kind = assetKindFromFile(file);
      const res = await projectService.saveAssetFile(props.projectId, file, {
        nodeId: 'render-resource',
        kind,
      });
      const url = res?.data?.url || (res?.data?.relativeUrl ? runtime.api(res.data.relativeUrl) : '');
      if (res?.success && url) {
        resources.value.push(url);
      } else {
        await notify.alert({
          title: 'Upload thất bại',
          message: res?.message || `Không thể upload: ${file.name}`,
          variant: 'error',
        });
      }
    }
  } catch (err) {
    await notify.alert({
      title: 'Upload lỗi',
      message: err?.message || 'Upload asset lỗi.',
      variant: 'error',
    });
  } finally {
    resourceUploadBusy.value = false;
  }
};

const generateId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const defaultDurationByType = (type) => {
  if (type === 'image') return 3;
  if (type === 'audio') return 5;
  return 5;
};

/** Đọc duration từ trình duyệt — video dùng <video>, audio dùng <audio> */
const getDurationFromElement = (source) => new Promise((resolve) => {
  const t = mediaType(source);
  const tag = t === 'audio' ? 'audio' : 'video';
  const media = document.createElement(tag);
  media.preload = 'metadata';
  media.src = source;
  const done = (d) => {
    const n = Number(d);
    resolve(Number.isFinite(n) && n > 0 && n !== Number.POSITIVE_INFINITY ? n : null);
  };
  media.onloadedmetadata = () => done(media.duration);
  media.onerror = () => resolve(null);
});

/** ffprobe trên server — hỗ trợ video và audio (file local /resources/...) */
const getDurationFromBackend = async (source) => {
  const t = mediaType(source);
  if (!source || (t !== 'video' && t !== 'audio') || !canUseBackendDuration.value) return null;
  try {
    const res = await fetch(runtime.api('/api/meta/media-duration'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source })
    });
    if (res.status === 404) {
      canUseBackendDuration.value = false;
      return null;
    }
    const data = await res.json();
    if (!res.ok || !data?.success) return null;
    const duration = Number(data?.data?.duration);
    return Number.isFinite(duration) && duration > 0 ? duration : null;
  } catch {
    canUseBackendDuration.value = false;
    return null;
  }
};

const durationCache = new Map();
const resolveVideoOrAudioDuration = async (source) => {
  if (durationCache.has(source)) return durationCache.get(source);
  const duration = (await getDurationFromBackend(source)) || (await getDurationFromElement(source));
  if (duration) durationCache.set(source, duration);
  return duration;
};

const resolveVisualTrackForVideos = () => {
  const sel = selectedTrack.value;
  if (sel?.type !== 'audio') return sel;
  return tracks.value.find((t) => t.type !== 'audio') || sel;
};

const scrollPlayheadIntoView = () => {
  const viewport = timelineViewportRef.value;
  if (!viewport) return;
  const ph = playheadPx.value;
  const margin = 96;
  const left = viewport.scrollLeft;
  const right = left + viewport.clientWidth;
  if (ph >= left + margin && ph <= right - margin) return;
  viewport.scrollLeft = Math.max(0, ph - viewport.clientWidth * 0.42);
};

const scheduleSyncPreviewToPlayhead = () => {
  if (syncPreviewRaf != null) return;
  syncPreviewRaf = requestAnimationFrame(() => {
    syncPreviewRaf = null;
    void syncPreviewToPlayhead();
  });
};

const addAllVideosToSelectedTrack = async () => {
  const videos = resources.value.filter((url) => mediaType(url) === 'video');
  if (!videos.length) {
    await notify.alert({
      title: 'Không có video',
      message: 'Không tìm thấy video nào trong Resources.',
      variant: 'warning',
    });
    return;
  }
  const track = resolveVisualTrackForVideos();
  if (!track) return;
  addAllVideosBusy.value = true;
  selectedTrackId.value = track.id;
  try {
    let cursor = track.clips.length
      ? Math.max(...track.clips.map((c) => Number(c.startTime || 0) + Number(c.duration || 0)))
      : 0;
    const metaList = await Promise.all(videos.map(async (url) => ({
      url,
      duration: await resolveVideoOrAudioDuration(url),
      dims: await probeMediaDimensions(url)
    })));
    const newClips = metaList.map(({ url, duration, dims }) => {
      const clip = {
        id: generateId(),
        source: url,
        type: 'video',
        startTime: cursor,
        duration: duration || defaultDurationByType('video'),
        trimStart: 0,
        muted: false
      };
      if (dims.w > 0 && dims.h > 0) clip.mediaAspect = dims.w / dims.h;
      fitLayoutContainInFrame(clip);
      cursor += Number(clip.duration || 0);
      return clip;
    });
    track.clips.push(...newClips);
    requestAnimationFrame(updateScrollbarThumb);
    scheduleTimelineSave();
  } catch (err) {
    await notify.alert({
      title: 'Không thể thêm video',
      message: err?.message || 'Thêm video vào track thất bại.',
      variant: 'error',
    });
  } finally {
    addAllVideosBusy.value = false;
  }
};

const normalizeClipStart = (track, clip, desiredStart) => {
  const sorted = track.clips.filter((c) => c.id !== clip.id).slice().sort((a, b) => a.startTime - b.startTime);
  let start = Math.max(0, Number(desiredStart || 0));
  for (const other of sorted) {
    const otherStart = Number(other.startTime || 0);
    const otherEnd = otherStart + Number(other.duration || 0);
    const end = start + Number(clip.duration || 0);
    if (!(end <= otherStart || start >= otherEnd)) start = otherEnd;
  }
  return start;
};

const addClipToTrack = async (url, trackId, startTime = null) => {
  const track = tracks.value.find((t) => t.id === trackId) || tracks.value[0];
  const type = mediaType(url);
  const tail = track.clips.length ? Math.max(...track.clips.map((c) => c.startTime + c.duration)) : 0;
  const clip = {
    id: generateId(),
    source: url,
    type,
    startTime: Math.max(0, Number(startTime != null ? startTime : tail)),
    duration: defaultDurationByType(type),
    trimStart: 0,
    muted: type === 'video' || type === 'audio' ? false : true
  };
  if (type === 'video' || type === 'audio') {
    const realDuration = await resolveVideoOrAudioDuration(url);
    if (realDuration) clip.duration = realDuration;
  }
  if (type === 'video' || type === 'image') {
    const { w, h } = await probeMediaDimensions(url);
    if (w > 0 && h > 0) clip.mediaAspect = w / h;
    fitLayoutContainInFrame(clip);
  }
  clip.startTime = normalizeClipStart(track, clip, clip.startTime);
  track.clips.push(clip);
};
const addTrackAtIndex = (insertIndex) => {
  const idx = Math.max(0, Math.min(Number(insertIndex) || 0, tracks.value.length));
  const id = `track-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newTrack = {
    id,
    name: `Track ${tracks.value.length + 1}`,
    type: 'visual',
    hidden: false,
    clips: []
  };
  tracks.value.splice(idx, 0, newTrack);
  selectedTrackId.value = id;
};

const addTrackAboveSelection = () => {
  const idx = tracks.value.findIndex((t) => t.id === selectedTrackId.value);
  addTrackAtIndex(idx === -1 ? 0 : idx);
};

const addTrackBelowSelection = () => {
  const idx = tracks.value.findIndex((t) => t.id === selectedTrackId.value);
  addTrackAtIndex(idx === -1 ? tracks.value.length : idx + 1);
};

/** Xóa lane đang chọn (toàn bộ clip trong lane). Giữ tối thiểu 1 lane. */
const deleteSelectedTrack = () => {
  if (tracks.value.length <= 1) return;
  const idx = tracks.value.findIndex((t) => t.id === selectedTrackId.value);
  if (idx === -1) return;
  const removed = tracks.value[idx];
  if (selectedClip.value && removed.clips.some((c) => c.id === selectedClip.value?.id)) clearClipSelection();
  else {
    const next = new Set(selectedClipIds.value);
    removed.clips.forEach((c) => next.delete(c.id));
    selectedClipIds.value = next;
    syncPrimarySelectedClip();
  }
  tracks.value.splice(idx, 1);
  const next = tracks.value[Math.min(idx, tracks.value.length - 1)] || tracks.value[0];
  selectedTrackId.value = next?.id || 'track-1';
  requestAnimationFrame(updateScrollbarThumb);
};

const addTextClip = (options = {}) => {
  const track = selectedTrack.value;
  const tail = track.clips.length ? Math.max(...track.clips.map((c) => c.startTime + c.duration)) : 0;
  const clip = {
    id: generateId(),
    type: 'text',
    text: options.text || 'Sample text',
    color: '#ffffff',
    boxColor: '#00000088',
    fontSize: Number(options.fontSize) || 48,
    textBoxWidthPercent: 40,
    textStyle: 'fill',
    strokeWidth: 2,
    fontWeight: 400,
    xPercent: 10,
    yPercent: 10,
    box: true,
    startTime: tail,
    duration: 3,
    trimStart: 0,
    muted: true
  };
  track.clips.push(clip);
  setSingleClipSelection(clip, track.id);
  inspectorOpen.value = true;
};
const removeResource = (index) => resources.value.splice(index, 1);
const removeClip = (trackId, clipId) => {
  const track = tracks.value.find((t) => t.id === trackId);
  if (!track) return;
  track.clips = track.clips.filter((c) => c.id !== clipId);
  const next = new Set(selectedClipIds.value);
  next.delete(clipId);
  selectedClipIds.value = next;
  syncPrimarySelectedClip();
};

const deleteSelectedClip = () => {
  const ids = selectedClipIds.value.size
    ? [...selectedClipIds.value]
    : (selectedClip.value ? [selectedClip.value.id] : []);
  if (!ids.length) return;
  const idSet = new Set(ids);
  for (const track of tracks.value) {
    track.clips = track.clips.filter((c) => !idSet.has(c.id));
  }
  clearClipSelection();
};

const onDragStartResource = (e, index) => e.dataTransfer.setData('text/resource-index', String(index));
const onDragStartClip = (e, clip, trackId) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const offsetPx = Math.max(0, e.clientX - rect.left);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('application/x-clip', JSON.stringify({
    clipId: clip.id,
    fromTrackId: trackId,
    pointerOffsetSec: offsetPx / pixelsPerSecond.value
  }));
};
const moveClipToTrack = (payload, event, targetTrackId) => {
  const fromTrack = tracks.value.find((t) => t.id === payload.fromTrackId);
  const targetTrack = tracks.value.find((t) => t.id === targetTrackId);
  if (!fromTrack || !targetTrack) return;
  const clip = fromTrack.clips.find((c) => c.id === payload.clipId);
  if (!clip) return;
  const lane = event.currentTarget;
  const rect = lane.getBoundingClientRect();
  const x = Math.max(0, event.clientX - rect.left + lane.scrollLeft);
  const desired = Math.max(0, x / pixelsPerSecond.value - Number(payload.pointerOffsetSec || 0));
  if (fromTrack.id !== targetTrack.id) {
    fromTrack.clips = fromTrack.clips.filter((c) => c.id !== clip.id);
    clip.startTime = normalizeClipStart(targetTrack, clip, desired);
    targetTrack.clips.push(clip);
  } else {
    clip.startTime = normalizeClipStart(targetTrack, clip, desired);
  }
  selectedTrackId.value = targetTrack.id;
  setSingleClipSelection(clip, targetTrack.id);
};
const onDropTrack = (e, trackId) => {
  e.preventDefault();
  const clipPayload = e.dataTransfer.getData('application/x-clip');
  if (clipPayload) {
    try { moveClipToTrack(JSON.parse(clipPayload), e, trackId); } catch {}
    return;
  }
  const idx = Number(e.dataTransfer.getData('text/resource-index'));
  if (Number.isNaN(idx) || !resources.value[idx]) return;
  const lane = e.currentTarget;
  const rect = lane.getBoundingClientRect();
  const x = Math.max(0, e.clientX - rect.left + lane.scrollLeft);
  addClipToTrack(resources.value[idx], trackId, x / pixelsPerSecond.value);
};
const allowDrop = (e) => e.preventDefault();

const getClipStyle = (clip) => ({
  left: `${clip.startTime * pixelsPerSecond.value}px`,
  width: `${Math.max(56, clip.duration * pixelsPerSecond.value)}px`
});

/** Mọi clip video/ảnh đang giao với playhead, theo thứ tự lane (track 0 = trên cùng UI → z-index cao nhất). */
const activeVisualLayers = computed(() => {
  const visualTracks = effectiveTracks.value.filter((t) => t.type !== 'audio');
  const n = visualTracks.length || 1;
  const layers = [];
  visualTracks.forEach((track, trackIndex) => {
    const c = track.clips.find(
      (clip) =>
        clip.type !== 'text' &&
        clip.type !== 'audio' &&
        playhead.value >= clip.startTime &&
        playhead.value < clip.startTime + clip.duration
    );
    if (c) {
      layers.push({
        clip: c,
        trackIndex,
        zIndex: 20 + (n - 1 - trackIndex)
      });
    }
  });
  return layers;
});
/** Lane trên cùng có media tại playhead (tiện cho logic cần một clip “ưu tiên”). */
const activeVisualClip = computed(() => {
  const L = activeVisualLayers.value;
  if (!L.length) return null;
  return L.reduce((a, b) => (a.trackIndex <= b.trackIndex ? a : b)).clip;
});
/** Video dùng làm đồng hồ playhead khi preview (lane trên cùng có video trước). */
const masterPreviewVideoClip = computed(() => {
  for (const layer of activeVisualLayers.value) {
    if (layer.clip.type === 'video') return layer.clip;
  }
  return null;
});
/** Preview: chỉ một video phát tiếng (lane dưới nhất trong các clip video không mute) — tránh chồng âm. */
const previewVideoAudioClip = computed(() => {
  const vids = activeVisualLayers.value.filter((l) => l.clip.type === 'video' && !l.clip.muted);
  if (!vids.length) return null;
  return vids.reduce((a, b) => (a.trackIndex >= b.trackIndex ? a : b)).clip;
});
/** Clip âm thanh đang nằm dưới playhead — trên mọi lane (Track 1/2 vẫn có thể chứa audio). */
const activeAudioClip = computed(() => {
  let last = null;
  for (const track of effectiveTracks.value) {
    const c = track.clips.find(
      (clip) =>
        clip.type === 'audio' &&
        playhead.value >= clip.startTime &&
        playhead.value < clip.startTime + clip.duration
    );
    if (c) last = c;
  }
  return last;
});
const activeTextClips = computed(() => {
  const items = [];
  for (const track of effectiveTracks.value.filter((t) => t.type !== 'audio')) {
    for (const clip of track.clips) {
      if (clip.type !== 'text') continue;
      if (playhead.value >= clip.startTime && playhead.value < clip.startTime + clip.duration) items.push(clip);
    }
  }
  return items;
});
const anyPreviewVideoPlaying = () => {
  for (const { clip } of activeVisualLayers.value) {
    if (clip.type !== 'video') continue;
    const el = previewVideoEls.value[clip.id];
    if (el && !el.paused) return true;
  }
  return false;
};

/** Aspect ratio parts for preview frame (used in CSS calc + aspect-ratio). */
const previewArParts = computed(() => {
  if (aspectRatio.value === 'portrait') return { w: 9, h: 16 };
  if (aspectRatio.value === 'square') return { w: 1, h: 1 };
  return { w: 16, h: 9 };
});

const probeMediaDimensions = (source) => new Promise((resolve) => {
  const t = mediaType(source);
  if (t === 'image') {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 0, h: img.naturalHeight || 0 });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = source;
    return;
  }
  if (t === 'video') {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.src = source;
    v.onloadedmetadata = () => resolve({ w: v.videoWidth || 0, h: v.videoHeight || 0 });
    v.onerror = () => resolve({ w: 0, h: 0 });
    return;
  }
  resolve({ w: 0, h: 0 });
});

/** Chiều cao % layout từ chiều rộng % và tỷ lệ media (giữ đúng tỷ lệ ngang/dọc nội dung trong khung preview). */
const applyMediaAspectLayoutHeight = (clip) => {
  if (!clip || (clip.type !== 'video' && clip.type !== 'image')) return;
  const ar = Number(clip.mediaAspect);
  if (!Number.isFinite(ar) || ar <= 0) return;
  const mw = Number(clip.layoutWidthPercent);
  if (!Number.isFinite(mw) || mw <= 0) return;
  const fp = previewArParts.value;
  const layoutH = mw * ((fp.w / fp.h) / ar);
  clip.layoutHeightPercent = Math.max(8, Math.min(100, layoutH));
};

const fitLayoutContainInFrame = (clip) => {
  if (!clip || (clip.type !== 'video' && clip.type !== 'image')) return;
  const ar = Number(clip.mediaAspect);
  if (!Number.isFinite(ar) || ar <= 0) {
    clip.layoutXPercent = 0;
    clip.layoutYPercent = 0;
    clip.layoutWidthPercent = 100;
    clip.layoutHeightPercent = 100;
    return;
  }
  const fp = previewArParts.value;
  const frameAr = fp.w / fp.h;
  let wPct;
  let hPct;
  if (ar > frameAr) {
    wPct = 100;
    hPct = 100 * (frameAr / ar);
  } else {
    hPct = 100;
    wPct = 100 * (ar / frameAr);
  }
  clip.layoutWidthPercent = Math.max(8, Math.min(100, wPct));
  applyMediaAspectLayoutHeight(clip);
  clip.layoutXPercent = (100 - Number(clip.layoutWidthPercent)) / 2;
  clip.layoutYPercent = (100 - Number(clip.layoutHeightPercent)) / 2;
};

const ensureVisualMediaLayoutFields = (clip) => {
  if (!clip || (clip.type !== 'video' && clip.type !== 'image')) return;
  if (clip.layoutXPercent == null || Number.isNaN(Number(clip.layoutXPercent))) clip.layoutXPercent = 0;
  if (clip.layoutYPercent == null || Number.isNaN(Number(clip.layoutYPercent))) clip.layoutYPercent = 0;
  if (clip.layoutWidthPercent == null || Number.isNaN(Number(clip.layoutWidthPercent))) clip.layoutWidthPercent = 100;
  if (clip.layoutHeightPercent == null || Number.isNaN(Number(clip.layoutHeightPercent))) clip.layoutHeightPercent = 100;
  applyMediaAspectLayoutHeight(clip);
};

const getVisualMediaLayoutStyle = (clip) => {
  if (!clip) return {};
  ensureVisualMediaLayoutFields(clip);
  return {
    left: `${Number(clip.layoutXPercent)}%`,
    top: `${Number(clip.layoutYPercent)}%`,
    width: `${Number(clip.layoutWidthPercent)}%`,
    height: `${Number(clip.layoutHeightPercent)}%`
  };
};

const getVisualPreviewStyle = (clip) => {
  const layout = getVisualMediaLayoutStyle(clip);
  ensureClipEffectFields(clip);
  const rel = playhead.value - Number(clip.startTime || 0);
  const opacity = computePreviewOpacity(clip, rel, clip.duration);
  return { ...layout, opacity: String(opacity) };
};

const resolveMediaUrl = (u) => {
  try {
    return new URL(u, window.location.href).href;
  } catch {
    return String(u || '');
  }
};
const audioPreviewNeedsReload = (el, url) => {
  if (!el || !url) return true;
  const target = resolveMediaUrl(url);
  return !el.currentSrc || resolveMediaUrl(el.currentSrc) !== target;
};
const waitAudioMetadata = (el) => new Promise((resolve) => {
  if (!el) {
    resolve();
    return;
  }
  if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
    resolve();
    return;
  }
  const onMeta = () => {
    el.removeEventListener('error', onErr);
    resolve();
  };
  const onErr = () => {
    el.removeEventListener('loadedmetadata', onMeta);
    resolve();
  };
  el.addEventListener('loadedmetadata', onMeta, { once: true });
  el.addEventListener('error', onErr, { once: true });
});

const syncPreviewToPlayhead = async () => {
  const layers = activeVisualLayers.value;
  const activeIds = new Set(layers.map((l) => l.clip.id));
  Object.entries(previewVideoEls.value).forEach(([id, el]) => {
    if (!activeIds.has(id)) el?.pause();
  });
  await Promise.resolve();
  for (const { clip } of layers) {
    if (clip.type !== 'video') continue;
    const el = previewVideoEls.value[clip.id];
    if (!el) continue;
    const rel = Math.max(0, playhead.value - clip.startTime + Number(clip.trimStart || 0));
    const duration = el.duration || 0;
    const target = duration > 0 ? Math.min(duration, rel) : rel;
    if (Math.abs(el.currentTime - target) > 0.045) {
      el.currentTime = target;
    }
    if (isPlaying.value && el.paused) el.play().catch(() => {});
  }

  const audioClip = activeAudioClip.value;
  if (previewAudioRef.value && audioClip) {
    const el = previewAudioRef.value;
    el.muted = Boolean(audioClip.muted);
    el.volume = 1;
    if (audioPreviewNeedsReload(el, audioClip.source)) {
      el.src = audioClip.source;
      await waitAudioMetadata(el);
    }
    const rel = Math.max(0, playhead.value - audioClip.startTime + Number(audioClip.trimStart || 0));
    const dur = el.duration || 0;
    const target = dur > 0 ? Math.min(dur, rel) : rel;
    if (Math.abs(el.currentTime - target) > 0.045) {
      el.currentTime = target;
    }
    if (isPlaying.value && el.paused) el.play().catch(() => {});
  } else {
    previewAudioRef.value?.pause();
  }
};
watch(playhead, () => {
  if (isPlaying.value) return;
  scheduleSyncPreviewToPlayhead();
}, { flush: 'post' });
watch(activeVisualLayers, () => { scheduleSyncPreviewToPlayhead(); }, { deep: true, flush: 'post' });
watch(activeAudioClip, () => { scheduleSyncPreviewToPlayhead(); }, { flush: 'post' });

const onPreviewTimeUpdate = () => {
  const visual = masterPreviewVideoClip.value;
  if (!isPlaying.value || !visual) return;
  const el = previewVideoEls.value[visual.id];
  if (!el) return;
  const trim = Number(visual.trimStart || 0);
  const next = visual.startTime + Math.max(0, el.currentTime - trim);
  if (Math.abs(next - playhead.value) > 0.03) playhead.value = Math.min(timelineDuration.value, next);
};

const onLayerVideoTimeUpdate = (clip) => {
  if (!clip || clip.id !== masterPreviewVideoClip.value?.id) return;
  onPreviewTimeUpdate();
};
const onPreviewAudioTimeUpdate = () => {
  if (!isPlaying.value || !previewAudioRef.value) return;
  const clip = activeAudioClip.value;
  if (!clip || clip.type !== 'audio') return;
  if (anyPreviewVideoPlaying()) return;
  const trim = Number(clip.trimStart || 0);
  const next = clip.startTime + Math.max(0, previewAudioRef.value.currentTime - trim);
  if (Math.abs(next - playhead.value) > 0.03) playhead.value = Math.min(timelineDuration.value, next);
};
const playbackTick = () => {
  if (!isPlaying.value) return;
  let next = playhead.value + (1 / 30);
  const master = masterPreviewVideoClip.value;
  const masterEl = master ? previewVideoEls.value[master.id] : null;
  if (masterEl && !masterEl.paused && master) {
    const trim = Number(master.trimStart || 0);
    next = master.startTime + Math.max(0, masterEl.currentTime - trim);
  } else if (previewAudioRef.value && !previewAudioRef.value.paused && activeAudioClip.value) {
    const clip = activeAudioClip.value;
    const trim = Number(clip.trimStart || 0);
    next = clip.startTime + Math.max(0, previewAudioRef.value.currentTime - trim);
  }
  if (next >= contentDuration.value && contentDuration.value > 0) {
    isPlaying.value = false;
    playhead.value = contentDuration.value;
    Object.values(previewVideoEls.value).forEach((el) => el?.pause());
    previewAudioRef.value?.pause();
    return;
  }
  playhead.value = next;
  const now = performance.now();
  if (now - lastPlayheadScrollAt > 180) {
    lastPlayheadScrollAt = now;
    scrollPlayheadIntoView();
    requestAnimationFrame(updateScrollbarThumb);
  }
  raf = requestAnimationFrame(playbackTick);
};
const togglePreviewPlay = async () => {
  if (isPlaying.value) {
    isPlaying.value = false;
    if (raf) cancelAnimationFrame(raf);
    Object.values(previewVideoEls.value).forEach((el) => el?.pause());
    previewAudioRef.value?.pause();
    return;
  }
  isPlaying.value = true;
  await syncPreviewToPlayhead();
  raf = requestAnimationFrame(playbackTick);
};

const setPlayheadFromClientX = (clientX) => {
  const viewport = timelineViewportRef.value;
  if (!viewport) return;
  const rect = viewport.getBoundingClientRect();
  const rawX = Math.max(0, clientX - rect.left + viewport.scrollLeft);
  const laneX = rawX - TRACK_LABEL_WIDTH - TRACK_GAP_PX;
  if (laneX < 0) return;
  playhead.value = Math.max(0, Math.min(timelineDuration.value, laneX / pixelsPerSecond.value));
  scheduleSyncPreviewToPlayhead();
};
const onTimelineWheel = (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  const step = 6;
  zoom.value = Math.max(TIMELINE_ZOOM_MIN, Math.min(TIMELINE_ZOOM_MAX, zoom.value + (e.deltaY < 0 ? step : -step)));
};
const onClipPointerDown = (e, clip, trackId) => {
  selectTimelineClip(clip, trackId, e);
};

const onTextOverlayPointerDown = (e, clip) => {
  if (resizingTextId.value || draggingVisualId.value || resizingVisualId.value) return;
  if (!previewFrameRef.value) return;
  setSingleClipSelection(clip, tracks.value.find((t) => t.clips.some((c) => c.id === clip.id))?.id || selectedTrackId.value);
  inspectorOpen.value = true;
  draggingTextId.value = clip.id;
  const move = (evt) => {
    if (!previewFrameRef.value || draggingTextId.value !== clip.id) return;
    const rect = previewFrameRef.value.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, evt.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, evt.clientY - rect.top));
    clip.xPercent = (x / rect.width) * 100;
    clip.yPercent = (y / rect.height) * 100;
  };
  const up = () => {
    draggingTextId.value = '';
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  e.stopPropagation();
};
const onTextResizePointerDown = (e, clip) => {
  if (draggingVisualId.value || resizingVisualId.value) return;
  if (!previewFrameRef.value) return;
  setSingleClipSelection(clip, tracks.value.find((t) => t.clips.some((c) => c.id === clip.id))?.id || selectedTrackId.value);
  inspectorOpen.value = true;
  resizingTextId.value = clip.id;
  const startX = e.clientX;
  const startWidth = Number(clip.textBoxWidthPercent || 40);
  const move = (evt) => {
    if (!previewFrameRef.value || resizingTextId.value !== clip.id) return;
    const rect = previewFrameRef.value.getBoundingClientRect();
    const deltaPercent = ((evt.clientX - startX) / Math.max(1, rect.width)) * 100;
    clip.textBoxWidthPercent = Math.max(12, Math.min(100, startWidth + deltaPercent));
  };
  const up = () => {
    resizingTextId.value = '';
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  e.stopPropagation();
};

const onVisualOverlayPointerDown = (e, clip) => {
  if (resizingVisualId.value || draggingTextId.value || resizingTextId.value) return;
  if (!previewFrameRef.value || !clip) return;
  if (clip.type !== 'video' && clip.type !== 'image') return;
  ensureVisualMediaLayoutFields(clip);
  setSingleClipSelection(clip, tracks.value.find((t) => t.clips.some((c) => c.id === clip.id))?.id || selectedTrackId.value);
  inspectorOpen.value = true;
  draggingVisualId.value = clip.id;
  const startX = e.clientX;
  const startY = e.clientY;
  const startLx = Number(clip.layoutXPercent);
  const startLy = Number(clip.layoutYPercent);
  const startLw = Number(clip.layoutWidthPercent);
  const startLh = Number(clip.layoutHeightPercent);
  const move = (evt) => {
    if (!previewFrameRef.value || draggingVisualId.value !== clip.id) return;
    const rect = previewFrameRef.value.getBoundingClientRect();
    const dx = ((evt.clientX - startX) / Math.max(1, rect.width)) * 100;
    const dy = ((evt.clientY - startY) / Math.max(1, rect.height)) * 100;
    clip.layoutXPercent = Math.max(0, Math.min(100 - startLw, startLx + dx));
    clip.layoutYPercent = Math.max(0, Math.min(100 - startLh, startLy + dy));
  };
  const up = () => {
    draggingVisualId.value = '';
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  e.stopPropagation();
};

const onVisualResizePointerDown = (e, clip) => {
  if (!previewFrameRef.value || !clip) return;
  if (clip.type !== 'video' && clip.type !== 'image') return;
  ensureVisualMediaLayoutFields(clip);
  setSingleClipSelection(clip, tracks.value.find((t) => t.clips.some((c) => c.id === clip.id))?.id || selectedTrackId.value);
  inspectorOpen.value = true;
  resizingVisualId.value = clip.id;
  const startX = e.clientX;
  const startY = e.clientY;
  const startW = Number(clip.layoutWidthPercent);
  const startH = Number(clip.layoutHeightPercent);
  const startLx = Number(clip.layoutXPercent);
  const startLy = Number(clip.layoutYPercent);
  const move = (evt) => {
    if (!previewFrameRef.value || resizingVisualId.value !== clip.id) return;
    const rect = previewFrameRef.value.getBoundingClientRect();
    const dx = ((evt.clientX - startX) / Math.max(1, rect.width)) * 100;
    const dy = ((evt.clientY - startY) / Math.max(1, rect.height)) * 100;
    clip.layoutWidthPercent = Math.max(8, Math.min(100 - startLx, startW + dx));
    if (Number(clip.mediaAspect) > 0) {
      applyMediaAspectLayoutHeight(clip);
    } else {
      clip.layoutHeightPercent = Math.max(8, Math.min(100 - startLy, startH + dy));
    }
  };
  const up = () => {
    resizingVisualId.value = '';
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  e.stopPropagation();
};

const trackIdContainingClip = (clip) => {
  if (!clip) return selectedTrackId.value;
  return tracks.value.find((t) => t.clips.some((c) => c.id === clip.id))?.id || selectedTrackId.value;
};

// Always-visible custom scrollbar
const getScrollMetrics = () => {
  const viewport = timelineViewportRef.value;
  if (!viewport) return { maxScroll: 0, ratio: 1, scrollLeft: 0 };
  const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  const ratio = viewport.scrollWidth > 0 ? viewport.clientWidth / viewport.scrollWidth : 1;
  return { maxScroll, ratio, scrollLeft: viewport.scrollLeft };
};
const updateScrollbarThumb = () => {
  const trackEl = scrollbarTrackRef.value;
  const thumbEl = scrollbarThumbRef.value;
  if (!trackEl || !thumbEl) return;
  const { maxScroll, ratio, scrollLeft } = getScrollMetrics();
  const trackWidth = trackEl.clientWidth;
  const minThumb = 48;
  const thumbWidth = Math.max(minThumb, trackWidth * Math.min(1, ratio));
  const usable = Math.max(0, trackWidth - thumbWidth);
  const x = maxScroll > 0 ? (scrollLeft / maxScroll) * usable : 0;
  thumbEl.style.width = `${thumbWidth}px`;
  thumbEl.style.transform = `translateX(${x}px)`;
};
const syncScrollFromThumb = (clientX) => {
  const trackEl = scrollbarTrackRef.value;
  const thumbEl = scrollbarThumbRef.value;
  const viewport = timelineViewportRef.value;
  if (!trackEl || !thumbEl || !viewport) return;
  const { maxScroll } = getScrollMetrics();
  const trackRect = trackEl.getBoundingClientRect();
  const thumbWidth = thumbEl.clientWidth;
  const usable = Math.max(0, trackRect.width - thumbWidth);
  const delta = clientX - dragStartX;
  const nextThumbX = Math.max(0, Math.min(usable, (dragStartScroll / Math.max(1, maxScroll)) * usable + delta));
  const ratio = usable > 0 ? nextThumbX / usable : 0;
  viewport.scrollLeft = ratio * maxScroll;
};
const onScrollbarThumbPointerDown = (e) => {
  e.preventDefault();
  draggingScrollbar = true;
  dragStartX = e.clientX;
  dragStartScroll = timelineViewportRef.value?.scrollLeft || 0;
  const move = (evt) => syncScrollFromThumb(evt.clientX);
  const up = () => {
    draggingScrollbar = false;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
};
const onScrollbarTrackPointerDown = (e) => {
  if (e.target === scrollbarThumbRef.value) return;
  syncScrollFromThumb(e.clientX);
};

const splitAtPlayhead = () => {
  const clip = selectedClip.value;
  if (!clip) return;
  const split = playhead.value;
  if (split <= clip.startTime || split >= clip.startTime + clip.duration) return;
  const track = tracks.value.find((t) => t.clips.some((c) => c.id === clip.id));
  if (!track) return;
  const cut = split - clip.startTime;
  const first = { ...clip, id: generateId(), duration: cut };
  const second = { ...clip, id: generateId(), startTime: split, duration: clip.duration - cut, trimStart: Number(clip.trimStart || 0) + cut };
  track.clips = track.clips.filter((c) => c.id !== clip.id);
  track.clips.push(first, second);
  setSingleClipSelection(second, track.id);
};
const openInspectorForClip = (clip, trackId) => {
  setSingleClipSelection(clip, trackId);
  ensureTextClipFields(clip);
  ensureVisualMediaLayoutFields(clip);
  ensureClipEffectFields(clip);
  inspectorOpen.value = true;
};

const onInspectorChange = () => {
  const clip = selectedClip.value;
  if (!clip) return;
  const track = tracks.value.find((t) => t.id === selectedTrackId.value) || tracks.value.find((t) => t.clips.some((c) => c.id === clip.id));
  if (!track) return;
  clip.startTime = Math.max(0, Number(clip.startTime || 0));
  clip.duration = Math.max(0.2, Number(clip.duration || 0.2));
  clip.trimStart = Math.max(0, Number(clip.trimStart || 0));
  if (clip.type === 'text') {
    ensureTextClipFields(clip);
    clip.fontSize = Math.max(4, Math.min(200, Number(clip.fontSize || 48)));
    clip.textBoxWidthPercent = Math.max(12, Math.min(100, Number(clip.textBoxWidthPercent || 40)));
    clip.xPercent = Math.max(0, Math.min(100, Number(clip.xPercent || 0)));
    clip.yPercent = Math.max(0, Math.min(100, Number(clip.yPercent || 0)));
    clip.strokeWidth = Math.max(0, Math.min(12, Number(clip.strokeWidth ?? 2)));
    const fw = Math.round(Number(clip.fontWeight ?? 400) / 100) * 100;
    clip.fontWeight = Math.max(100, Math.min(900, fw));
    clip.box = clip.textStyle === 'fill';
  }
  if (clip.type === 'video' || clip.type === 'image') {
    ensureVisualMediaLayoutFields(clip);
    const w = Math.max(8, Math.min(100, Number(clip.layoutWidthPercent)));
    clip.layoutWidthPercent = w;
    applyMediaAspectLayoutHeight(clip);
    const h = Number(clip.layoutHeightPercent);
    clip.layoutXPercent = Math.max(0, Math.min(100 - w, Number(clip.layoutXPercent)));
    clip.layoutYPercent = Math.max(0, Math.min(100 - h, Number(clip.layoutYPercent)));
    ensureClipEffectFields(clip);
    clip.fadeInDuration = Math.max(0.1, Math.min(5, Number(clip.fadeInDuration || 0.5)));
    clip.fadeOutDuration = Math.max(0.1, Math.min(5, Number(clip.fadeOutDuration || 0.5)));
    clip.transitionDuration = Math.max(0.1, Math.min(5, Number(clip.transitionDuration || 0.5)));
  }
  clip.startTime = normalizeClipStart(track, clip, clip.startTime);
  void syncPreviewToPlayhead();
};

const toggleClipMuted = (clip) => {
  if (clip.type !== 'video' && clip.type !== 'audio') return;
  clip.muted = !clip.muted;
  void syncPreviewToPlayhead();
};

const visualTracksForRender = computed(() => tracks.value.filter((t) => !t.hidden && t.type !== 'audio'));

const renderTimelinePayload = computed(() => {
  const trackVisualIndex = (trackId) => {
    const i = visualTracksForRender.value.findIndex((t) => t.id === trackId);
    return i >= 0 ? i : 0;
  };
  return tracks.value
    .filter((track) => !track.hidden)
    .flatMap((track) => track.clips.map((clip) => {
  const base = {
    source: clip.source,
    start: Number(clip.trimStart || 0),
    duration: Number(clip.duration || 0),
    timelineStart: Number(clip.startTime || 0),
    trackId: track.id,
    trackVisualIndex: track.type === 'audio' ? -1 : trackVisualIndex(track.id),
    type: clip.type,
    muted: Boolean(clip.muted),
    text: clip.text || '',
    color: clip.color || '#ffffff',
    boxColor: clip.boxColor || '#00000088',
    fontSize: Number(clip.fontSize || 48),
    textBoxWidthPercent: Number(clip.textBoxWidthPercent || 40),
    textStyle: clip.type === 'text' ? (clip.textStyle || (clip.box !== false ? 'fill' : 'plain')) : undefined,
    strokeWidth: clip.type === 'text' ? Number(clip.strokeWidth ?? 2) : undefined,
    fontWeight: clip.type === 'text' ? Math.max(100, Math.min(900, Number(clip.fontWeight) || 400)) : undefined,
    xPercent: Number(clip.xPercent || 10),
    yPercent: Number(clip.yPercent || 10),
    box: clip.type === 'text' ? (clip.textStyle === 'fill') : (clip.box !== false)
  };
  if (clip.type === 'video' || clip.type === 'image') {
    ensureVisualMediaLayoutFields(clip);
    base.layoutXPercent = Number(clip.layoutXPercent);
    base.layoutYPercent = Number(clip.layoutYPercent);
    base.layoutWidthPercent = Number(clip.layoutWidthPercent);
    base.layoutHeightPercent = Number(clip.layoutHeightPercent);
    ensureClipEffectFields(clip);
    base.fadeInType = clip.fadeInType;
    base.fadeInDuration = Number(clip.fadeInDuration || 0.5);
    base.fadeOutType = clip.fadeOutType;
    base.fadeOutDuration = Number(clip.fadeOutDuration || 0.5);
    base.transitionType = clip.transitionType;
    base.transitionDuration = Number(clip.transitionDuration || 0.5);
  }
  return base;
    }))
    .sort((a, b) => a.timelineStart - b.timelineStart);
});

const timelineSerialize = () => ({
  version: 1,
  aspectRatio: aspectRatio.value,
  zoom: zoom.value,
  playhead: playhead.value,
  selectedTrackId: selectedTrackId.value,
  mediaPanelWidth: mediaPanelWidth.value,
  inspectorPanelWidth: inspectorPanelWidth.value,
  resources: resources.value.slice(),
  tracks: tracks.value.map((t) => ({
    id: t.id,
    name: t.name,
    type: t.type,
    hidden: Boolean(t.hidden),
    clips: JSON.parse(JSON.stringify(t.clips))
  }))
});

const applyLoadedTimeline = async (data) => {
  if (!data || typeof data !== 'object') return;
  timelineHydrating = true;
  try {
    const loadedResources = Array.isArray(data.resources) ? data.resources.slice() : [];
    if (Array.isArray(data.tracks) && data.tracks.length) {
      tracks.value = data.tracks.map((t) => ({
        id: String(t.id || generateId()),
        name: String(t.name || 'Track'),
        type: t.type === 'audio' ? 'audio' : 'visual',
        hidden: Boolean(t.hidden),
        clips: Array.isArray(t.clips) ? t.clips : []
      }));
    }
    // IMPORTANT: resources must include timeline clip sources even when not listed in JSON resources.
    const clipSources = collectClipSources(tracks.value);
    resources.value = uniqNonEmptyStrings([
      ...(props.sourceAssets || []),
      ...loadedResources,
      ...clipSources
    ]);
    if (data.aspectRatio === 'portrait' || data.aspectRatio === 'landscape' || data.aspectRatio === 'square') {
      aspectRatio.value = data.aspectRatio;
    }
    if (typeof data.zoom === 'number' && data.zoom >= TIMELINE_ZOOM_MIN && data.zoom <= TIMELINE_ZOOM_MAX) {
      zoom.value = data.zoom;
    }
    if (typeof data.playhead === 'number' && Number.isFinite(data.playhead)) playhead.value = Math.max(0, data.playhead);
    if (typeof data.selectedTrackId === 'string' && tracks.value.some((t) => t.id === data.selectedTrackId)) {
      selectedTrackId.value = data.selectedTrackId;
    }
    if (typeof data.mediaPanelWidth === 'number' || typeof data.inspectorPanelWidth === 'number') {
      applyLayoutWidths(data);
      layoutWidthsReady.value = true;
    }
    for (const t of tracks.value) {
      for (const c of t.clips) {
        if (c.type === 'text') ensureTextClipFields(c);
        if (c.type === 'video' || c.type === 'image') {
          ensureVisualMediaLayoutFields(c);
          ensureClipEffectFields(c);
        }
      }
    }
  } finally {
    timelineHydrating = false;
  }
};

const persistTimelineToBackend = async () => {
  if (!props.projectId) return;
  try {
    await projectService.saveTimeline(props.projectId, timelineSerialize());
  } catch {
    /* ignore */
  }
};

const scheduleTimelineSave = () => {
  if (!props.projectId || timelineHydrating || !timelineReady) return;
  clearTimeout(timelineSaveTimer);
  timelineSaveTimer = setTimeout(() => {
    timelineSaveTimer = null;
    void persistTimelineToBackend();
  }, 850);
};

const loadTimelineFromBackend = async () => {
  if (!props.projectId) return;
  timelineReady = false;
  layoutWidthsReady.value = false;
  try {
    const res = await projectService.getTimeline(props.projectId);
    if (res?.success && res.data) await applyLoadedTimeline(res.data);
  } catch {
    /* ignore */
  } finally {
    void nextTick(() => {
      if (!layoutWidthsReady.value) initLayoutWidths();
      timelineReady = true;
    });
  }
};

const toggleTrackHidden = (track) => {
  if (!track) return;
  track.hidden = !track.hidden;
  scheduleTimelineSave();
};

const getPreviewFrameMetrics = () => {
  const frame = previewFrameRef.value;
  if (!frame) return null;
  const width = Math.round(frame.clientWidth || 0);
  const height = Math.round(frame.clientHeight || 0);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
};

const closeRenderModal = async () => {
  clearRenderPoll();
  const id = renderJobId.value;
  if (id && renderModalStep.value === 'progress') {
    try {
      await fetch(runtime.api(`/api/render/jobs/${id}/cancel`), { method: 'POST' });
    } catch {
      /* ignore */
    }
  }
  renderJobId.value = '';
  renderModalOpen.value = false;
  renderModalStep.value = 'setup';
  renderProgress.value = 0;
  renderResult.value = '';
  renderSavedFilePath.value = '';
};

const cancelRenderFromModal = async () => {
  clearRenderPoll();
  const id = renderJobId.value;
  if (id) {
    try {
      await fetch(runtime.api(`/api/render/jobs/${id}/cancel`), { method: 'POST' });
    } catch {
      /* ignore */
    }
  }
  renderJobId.value = '';
  renderModalStep.value = 'setup';
  renderProgress.value = 0;
};

const openOutputFolder = async () => {
  const full = renderSavedFilePath.value || renderOutputPath.value;
  if (!full || typeof window.electronAPI?.invoke !== 'function') return;
  const r = await window.electronAPI.invoke('shell:open-directory', full);
  if (!r?.success && r?.message) console.warn(r.message);
};

const renderVideo = () => {
  clearRenderPoll();
  renderModalStep.value = 'setup';
  renderProgress.value = 0;
  renderResult.value = '';
  renderJobId.value = '';
  renderSavedFilePath.value = '';
  renderModalOpen.value = true;
};

const onRenderModalOverlayClick = () => {
  if (renderModalStep.value === 'setup') closeRenderModal();
};

const chooseRenderOutputPath = async () => {
  try {
    const result = await window.electronAPI.invoke('dialog:save-video-path', {
      defaultName: `render-${Date.now()}.mp4`
    });
    if (result?.canceled) return;
    if (result?.success && result.filePath) {
      renderOutputPath.value = result.filePath;
      return;
    }
    await notify.alert({
      title: 'Không thể chọn file',
      message: result?.message || 'Hộp thoại lưu file không khả dụng trên hệ thống này.',
      variant: 'error',
    });
  } catch (err) {
    await notify.alert({
      title: 'Không thể chọn file',
      message: err?.message || 'Lỗi khi mở hộp thoại lưu file.',
      variant: 'error',
    });
  }
};

const startRenderFromModal = async () => {
  if (!renderTimelinePayload.value.length) return;
  clearRenderPoll();
  renderSavedFilePath.value = '';
  renderModalStep.value = 'progress';
  renderProgress.value = 0;
  renderResult.value = '';
  renderJobId.value = '';
  try {
    const res = await fetch(runtime.api('/api/render/start'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeline: renderTimelinePayload.value,
        aspectRatio: aspectRatio.value,
        quality: renderQuality.value,
        previewFrame: getPreviewFrameMetrics(),
        outputPath: renderOutputPath.value || undefined
      })
    });
    const data = await res.json();
    if (!res.ok || !data?.success) throw new Error(data?.message || 'Render start failed');
    renderJobId.value = data.data.jobId;

    const poll = async () => {
      const pollJobId = renderJobId.value;
      if (!pollJobId) return;
      try {
        const r = await fetch(runtime.api(`/api/render/jobs/${pollJobId}`));
        const j = await r.json();
        if (!r.ok || !j?.success) throw new Error(j?.message || 'Render job error');
        if (renderJobId.value !== pollJobId) return;
        const job = j.data;
        renderProgress.value = Math.round((Number(job.progress || 0)) * 100);
        if (job.status === 'cancelled') {
          clearRenderPoll();
          renderJobId.value = '';
          renderModalStep.value = 'setup';
          renderProgress.value = 0;
          return;
        }
        if (job.status === 'completed') {
          clearRenderPoll();
          renderProgress.value = 100;
          renderSavedFilePath.value = job.outputPath || renderOutputPath.value || '';
          renderResult.value = job.url || '';
          renderJobId.value = '';
          renderModalStep.value = 'done';
          return;
        }
        if (job.status === 'error') {
          clearRenderPoll();
          renderResult.value = job.error || 'Render failed';
          renderJobId.value = '';
          renderModalStep.value = 'error';
          return;
        }
        renderPollTimer = setTimeout(poll, 600);
      } catch (e) {
        clearRenderPoll();
        renderResult.value = e?.message || 'Render job error';
        renderJobId.value = '';
        renderModalStep.value = 'error';
      }
    };
    poll();
  } catch (err) {
    clearRenderPoll();
    renderResult.value = err.message || 'Render failed';
    renderModalStep.value = 'error';
  }
};

watch([timelineWidth, zoom], () => requestAnimationFrame(updateScrollbarThumb));

watch(
  [resources, tracks, aspectRatio, zoom, playhead, selectedTrackId],
  () => scheduleTimelineSave(),
  { deep: true }
);

watch(
  () => props.projectId,
  async (id) => {
    clearTimeout(timelineSaveTimer);
    timelineSaveTimer = null;
    if (!id) {
      timelineReady = true;
      return;
    }
    await loadTimelineFromBackend();
  },
  { immediate: true }
);

watch(
  () => props.sourceAssets,
  (list) => {
    const clipSources = collectClipSources(tracks.value);
    resources.value = uniqNonEmptyStrings([
      ...(resources.value || []),
      ...(Array.isArray(list) ? list : []),
      ...clipSources
    ]);
  },
  { deep: true }
);

watch(
  resources,
  (list) => { void syncResourceDurations(list); },
  { immediate: true, deep: true }
);

watch(aspectRatio, () => {
  for (const t of tracks.value) {
    for (const c of t.clips) {
      if (c.type !== 'video' && c.type !== 'image') continue;
      ensureVisualMediaLayoutFields(c);
      const w = Number(c.layoutWidthPercent);
      const h = Number(c.layoutHeightPercent);
      c.layoutXPercent = Math.max(0, Math.min(100 - w, Number(c.layoutXPercent)));
      c.layoutYPercent = Math.max(0, Math.min(100 - h, Number(c.layoutYPercent)));
    }
  }
  scheduleTimelineSave();
});

onMounted(() => {
  const viewport = timelineViewportRef.value;
  if (viewport) viewport.addEventListener('scroll', updateScrollbarThumb, { passive: true });
  requestAnimationFrame(updateScrollbarThumb);
  void nextTick(() => {
    if (!layoutWidthsReady.value) initLayoutWidths();
  });
});
onBeforeUnmount(() => {
  clearRenderPoll();
  clearTimeout(timelineSaveTimer);
  timelineSaveTimer = null;
  if (raf) cancelAnimationFrame(raf);
  if (syncPreviewRaf) cancelAnimationFrame(syncPreviewRaf);
  Object.values(previewVideoEls.value).forEach((el) => el?.pause());
  previewAudioRef.value?.pause();
  const viewport = timelineViewportRef.value;
  if (viewport) viewport.removeEventListener('scroll', updateScrollbarThumb);
  draggingScrollbar = false;
});
</script>

<template>
  <section class="render-page">
    <header class="toolbar">
      <div class="toolbar-left">
        <button class="tool-btn" @click="emit('back')"><ArrowLeft :size="16" /> Back</button>
      </div>
      <div class="toolbar-right">
        <select v-model="aspectRatio" class="select">
          <option value="landscape">16:9</option>
          <option value="portrait">9:16</option>
          <option value="square">1:1</option>
        </select>
        <button class="tool-btn primary" @click="renderVideo"><WandSparkles :size="16" /> Render</button>
      </div>
    </header>

    <div class="editor-layout-wrap">
    <div class="editor-layout">
      <div class="editor-top-row" ref="editorTopRowRef">
      <aside class="resources-panel cap-panel" :style="{ width: `${mediaPanelWidth}px` }">
        <div class="resources-panel-head">
          <button
            v-for="tab in RESOURCE_PANEL_TABS"
            :key="tab.id"
            type="button"
            class="resources-tab"
            :class="{ 'resources-tab--active': resourcePanelTab === tab.id }"
            @click="resourcePanelTab = tab.id"
          >
            {{ tab.label }}
            <span v-if="tab.id === 'media' && resources.length" class="resources-tab-badge">{{ resources.length }}</span>
          </button>
        </div>
        <div class="resources-body">
          <template v-if="resourcePanelTab === 'media'">
          <div class="resources-toolbar">
            <label class="upload-btn cap-import-btn" :class="{ 'upload-btn--busy': resourceUploadBusy }">
              <Loader2 v-if="resourceUploadBusy" :size="12" class="upload-spin" />
              <Plus v-else :size="12" />
              <span>{{ resourceUploadBusy ? 'Upload…' : 'Import' }}</span>
              <input
                type="file"
                multiple
                accept="image/*,video/*,audio/*"
                :disabled="resourceUploadBusy"
                @change="onAddExternalFiles"
              />
            </label>
            <button
              type="button"
              class="add-all-videos-btn"
              :class="{ 'add-all-videos-btn--busy': addAllVideosBusy }"
              :disabled="addAllVideosBusy || resourceVideoCount === 0"
              :title="resourceVideoCount ? `Thêm ${resourceVideoCount} video vào ${selectedTrack?.name || 'track'} (nối liền theo thứ tự)` : 'Không có video trong Resources'"
              @click="addAllVideosToSelectedTrack"
            >
              <Loader2 v-if="addAllVideosBusy" :size="12" class="upload-spin" />
              <ListVideo v-else :size="12" />
              <span>{{ addAllVideosBusy ? 'Đang thêm…' : 'Tất cả video' }}</span>
            </button>
          </div>
          <div class="resource-grid">
            <div
              v-for="(url, idx) in resources"
              :key="`${idx}-${url}`"
              class="media-item"
              draggable="true"
              @dragstart="onDragStartResource($event, idx)"
              @dblclick="addClipToTrack(url, selectedTrack.id)"
            >
              <div class="media-item-thumb">
                <video
                  v-if="mediaType(url)==='video'"
                  :src="url"
                  muted
                  preload="metadata"
                  @loadedmetadata="onResourceMediaMeta(url, $event)"
                />
                <div v-else-if="mediaType(url)==='audio'" class="media-item-audio">
                  <Music2 :size="22" />
                </div>
                <img v-else :src="url" alt="" />
                <span v-if="resourceOnTimeline.has(url)" class="media-item-added">
                  <Check :size="10" stroke-width="3" />
                  Added
                </span>
                <span v-if="resourceDurationLabel(url)" class="media-item-duration">{{ resourceDurationLabel(url) }}</span>
                <div class="media-item-actions">
                  <button type="button" class="media-item-action" title="Thêm vào track" @click.stop="addClipToTrack(url, selectedTrack.id)">
                    <Plus :size="11" />
                  </button>
                  <button type="button" class="media-item-action media-item-action--danger" title="Xóa" @click.stop="removeResource(idx)">
                    <Trash2 :size="11" />
                  </button>
                </div>
              </div>
              <div class="media-item-name" :title="getResourceThumbName(url)">
                {{ truncateMiddleName(getResourceThumbName(url)) }}
              </div>
            </div>
            <div v-if="!resources.length" class="resource-empty">Kéo thả hoặc Import media</div>
          </div>
          </template>

          <template v-else-if="resourcePanelTab === 'text'">
            <div class="resource-tab-pane">
              <button type="button" class="resource-pane-action" @click="addTextClip()">
                <Plus :size="12" />
                <span>Thêm text vào track</span>
              </button>
              <div class="text-preset-grid">
                <button
                  v-for="preset in TEXT_CLIP_PRESETS"
                  :key="preset.label"
                  type="button"
                  class="text-preset-card"
                  @click="addTextClip({ text: preset.text })"
                >
                  <span class="text-preset-preview">{{ preset.text }}</span>
                  <span class="text-preset-label">{{ preset.label }}</span>
                </button>
              </div>
            </div>
          </template>

          <template v-else-if="resourcePanelTab === 'effect'">
            <div class="resource-tab-pane effect-tab">
              <p v-if="!canApplyVisualEffect" class="effect-tab-hint">
                Chọn <strong>một</strong> clip video hoặc ảnh trên timeline để gán hiệu ứng.
              </p>
              <p v-else class="effect-tab-hint effect-tab-hint--ok">
                Đang chỉnh: {{ getResourceThumbName(selectedClip.source || selectedClip.type) }}
              </p>

              <section class="effect-group">
                <h4 class="effect-group-title">Hiệu ứng chuyển cảnh</h4>
                <p class="effect-group-sub">Cuối clip này → đầu clip kế tiếp (cùng lane, sát nhau)</p>
                <div class="effect-grid">
                  <button
                    v-for="fx in TRANSITION_EFFECT_TYPES"
                    :key="'tr-' + fx.id"
                    type="button"
                    class="effect-card"
                    :class="{ active: canApplyVisualEffect && selectedClip.transitionType === fx.id }"
                    :disabled="!canApplyVisualEffect"
                    @click="applyTransitionEffect(fx.id)"
                  >
                    <span class="effect-card-label">{{ fx.label }}</span>
                  </button>
                </div>
                <label v-if="canApplyVisualEffect && selectedClip.transitionType !== 'none'" class="effect-duration-row">
                  <span>Thời lượng (s)</span>
                  <input
                    type="number"
                    min="0.1"
                    max="5"
                    step="0.1"
                    v-model.number="selectedClip.transitionDuration"
                    @change="onInspectorChange"
                  />
                </label>
              </section>

              <section class="effect-group">
                <h4 class="effect-group-title">Hiệu ứng hiện dần</h4>
                <p class="effect-group-sub">Fade in — đầu clip</p>
                <div class="effect-grid">
                  <button
                    v-for="fx in FADE_EFFECT_TYPES"
                    :key="'fi-' + fx.id"
                    type="button"
                    class="effect-card"
                    :class="{ active: canApplyVisualEffect && selectedClip.fadeInType === fx.id }"
                    :disabled="!canApplyVisualEffect"
                    @click="applyFadeInEffect(fx.id)"
                  >
                    <span class="effect-card-label">{{ fx.label }}</span>
                  </button>
                </div>
                <label v-if="canApplyVisualEffect && selectedClip.fadeInType !== 'none'" class="effect-duration-row">
                  <span>Thời lượng (s)</span>
                  <input
                    type="number"
                    min="0.1"
                    max="5"
                    step="0.1"
                    v-model.number="selectedClip.fadeInDuration"
                    @change="onInspectorChange"
                  />
                </label>
              </section>

              <section class="effect-group">
                <h4 class="effect-group-title">Hiệu ứng mờ dần</h4>
                <p class="effect-group-sub">Fade out — cuối clip</p>
                <div class="effect-grid">
                  <button
                    v-for="fx in FADE_EFFECT_TYPES"
                    :key="'fo-' + fx.id"
                    type="button"
                    class="effect-card"
                    :class="{ active: canApplyVisualEffect && selectedClip.fadeOutType === fx.id }"
                    :disabled="!canApplyVisualEffect"
                    @click="applyFadeOutEffect(fx.id)"
                  >
                    <span class="effect-card-label">{{ fx.label }}</span>
                  </button>
                </div>
                <label v-if="canApplyVisualEffect && selectedClip.fadeOutType !== 'none'" class="effect-duration-row">
                  <span>Thời lượng (s)</span>
                  <input
                    type="number"
                    min="0.1"
                    max="5"
                    step="0.1"
                    v-model.number="selectedClip.fadeOutDuration"
                    @change="onInspectorChange"
                  />
                </label>
              </section>

              <button
                type="button"
                class="effect-clear-btn"
                :disabled="!canApplyVisualEffect || !clipHasEffects(selectedClip)"
                @click="clearAllClipEffects"
              >
                Xóa tất cả hiệu ứng clip
              </button>
            </div>
          </template>
        </div>
      </aside>

      <div
        class="layout-splitter layout-splitter--vertical"
        :class="{ 'is-active': layoutSplitDragging === 'media-player' }"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize Media and Player"
        title="Kéo để đổi kích thước Media / Player"
        @pointerdown="onSplitMediaPlayerDown"
      ></div>

      <main class="player-panel cap-panel">
        <div class="cap-panel-head player-head">
          <span class="cap-panel-title">Player</span>
          <span class="player-time">{{ formatTimeHms(playhead) }} / {{ formatTimeHms(contentDuration || timelineDuration) }}</span>
        </div>
        <div class="player-body">
          <div class="preview-stage">
            <div class="preview-aspect-host">
              <div
                ref="previewFrameRef"
                class="preview-frame"
                :style="{
                  '--ar-w': previewArParts.w,
                  '--ar-h': previewArParts.h
                }"
              >
                <div class="preview-frame-content">
                  <div class="preview-media-layer">
                    <div
                      v-for="layer in activeVisualLayers"
                      :key="layer.clip.id"
                      class="visual-layout-box"
                      :class="{
                        selected: isClipSelected(layer.clip.id),
                        'is-dragging': draggingVisualId === layer.clip.id,
                        'is-resizing': resizingVisualId === layer.clip.id
                      }"
                      :style="{ ...getVisualPreviewStyle(layer.clip), zIndex: layer.zIndex }"
                      @pointerdown.stop="onVisualOverlayPointerDown($event, layer.clip)"
                      @dblclick.stop="openInspectorForClip(layer.clip, trackIdContainingClip(layer.clip))"
                    >
                      <video
                        v-if="layer.clip.type === 'video'"
                        :ref="(el) => setPreviewVideoEl(layer.clip.id, el)"
                        :src="layer.clip.source"
                        playsinline
                        :muted="!previewVideoAudioClip || previewVideoAudioClip.id !== layer.clip.id"
                        @timeupdate="onLayerVideoTimeUpdate(layer.clip)"
                      />
                      <img
                        v-if="layer.clip.type === 'image'"
                        :src="layer.clip.source"
                        alt=""
                      />
                      <span
                        class="visual-resize-handle"
                        @pointerdown.stop="onVisualResizePointerDown($event, layer.clip)"
                      ></span>
                    </div>
                  </div>
                  <div v-show="!activeVisualLayers.length" class="preview-empty">Chưa có clip tại playhead</div>
                  <div class="text-overlay-layer">
                    <div
                      v-for="clip in activeTextClips"
                      :key="clip.id"
                      class="text-overlay-item"
                      :style="getTextOverlayItemStyle(clip)"
                      @pointerdown.stop="onTextOverlayPointerDown($event, clip)"
                    >
                      {{ clip.text || 'Text' }}
                      <span class="text-resize-handle" @pointerdown.stop="onTextResizePointerDown($event, clip)"></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="player-controls">
            <button class="player-play-btn" type="button" @click="togglePreviewPlay" :title="isPlaying ? 'Pause' : 'Play'">
              <Pause v-if="isPlaying" :size="18" />
              <Play v-else :size="18" />
            </button>
          </div>
        </div>
      </main>

      <div
        class="layout-splitter layout-splitter--vertical"
        :class="{ 'is-active': layoutSplitDragging === 'player-inspector' }"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize Player and Properties"
        title="Kéo để đổi kích thước Player / Properties"
        @pointerdown="onSplitPlayerInspectorDown"
      ></div>

      <aside class="inspector-panel cap-panel" :style="{ width: `${inspectorPanelWidth}px` }" :class="{ empty: !(inspectorOpen && selectedClip) }">
        <div class="cap-panel-head">
          <span class="cap-panel-title">Properties</span>
        </div>
        <div class="inspector-body">
          <div v-if="selectedClipCount > 1" class="inspector-multi-hint">
            {{ selectedClipCount }} clip đang chọn — Properties hiển thị clip cuối cùng được chọn.
          </div>
          <div v-if="inspectorOpen && selectedClip" class="inspector-grid">
              <label>Start</label>
              <input type="number" min="0" step="0.1" v-model.number="selectedClip.startTime" @input="onInspectorChange" />
              <label>Duration</label>
              <input type="number" min="0.2" step="0.1" v-model.number="selectedClip.duration" @input="onInspectorChange" />
              <label>Trim Start</label>
              <input type="number" min="0" step="0.1" v-model.number="selectedClip.trimStart" @input="onInspectorChange" />
              <template v-if="selectedClip.type === 'video' || selectedClip.type === 'image'">
                <div class="inspector-box">
                  <div class="inspector-box-title">Hiệu ứng</div>
                  <label class="inspector-field-label">Chuyển cảnh (→ clip sau)</label>
                  <select v-model="selectedClip.transitionType" class="inspector-select" @change="onInspectorChange">
                    <option v-for="fx in TRANSITION_EFFECT_TYPES" :key="'itr-' + fx.id" :value="fx.id">{{ fx.label }}</option>
                  </select>
                  <label v-if="selectedClip.transitionType !== 'none'" class="inspector-field-label">Thời lượng chuyển cảnh (s)</label>
                  <input
                    v-if="selectedClip.transitionType !== 'none'"
                    type="number"
                    min="0.1"
                    max="5"
                    step="0.1"
                    v-model.number="selectedClip.transitionDuration"
                    @input="onInspectorChange"
                  />
                  <label class="inspector-field-label">Hiện dần (fade in)</label>
                  <select v-model="selectedClip.fadeInType" class="inspector-select" @change="onInspectorChange">
                    <option v-for="fx in FADE_EFFECT_TYPES" :key="'ifi-' + fx.id" :value="fx.id">{{ fx.label }}</option>
                  </select>
                  <label v-if="selectedClip.fadeInType !== 'none'" class="inspector-field-label">Thời lượng hiện dần (s)</label>
                  <input
                    v-if="selectedClip.fadeInType !== 'none'"
                    type="number"
                    min="0.1"
                    max="5"
                    step="0.1"
                    v-model.number="selectedClip.fadeInDuration"
                    @input="onInspectorChange"
                  />
                  <label class="inspector-field-label">Mờ dần (fade out)</label>
                  <select v-model="selectedClip.fadeOutType" class="inspector-select" @change="onInspectorChange">
                    <option v-for="fx in FADE_EFFECT_TYPES" :key="'ifo-' + fx.id" :value="fx.id">{{ fx.label }}</option>
                  </select>
                  <label v-if="selectedClip.fadeOutType !== 'none'" class="inspector-field-label">Thời lượng mờ dần (s)</label>
                  <input
                    v-if="selectedClip.fadeOutType !== 'none'"
                    type="number"
                    min="0.1"
                    max="5"
                    step="0.1"
                    v-model.number="selectedClip.fadeOutDuration"
                    @input="onInspectorChange"
                  />
                </div>
                <div class="inspector-box">
                  <div class="inspector-box-title">Vị trí & khung (kéo / góc phải-dưới trên preview)</div>
                  <label class="inspector-field-label">X %</label>
                  <input type="number" min="0" max="100" step="0.5" v-model.number="selectedClip.layoutXPercent" @input="onInspectorChange" />
                  <label class="inspector-field-label">Y %</label>
                  <input type="number" min="0" max="100" step="0.5" v-model.number="selectedClip.layoutYPercent" @input="onInspectorChange" />
                  <label class="inspector-field-label">Rộng %</label>
                  <input type="number" min="8" max="100" step="0.5" v-model.number="selectedClip.layoutWidthPercent" @input="onInspectorChange" />
                  <label class="inspector-field-label">Cao %</label>
                  <input
                    type="text"
                    readonly
                    class="inspector-input inspector-input--readonly"
                    :value="Number(selectedClip.layoutHeightPercent || 0).toFixed(1)"
                    title="Tự đồng bộ theo rộng và tỷ lệ gốc của video/ảnh"
                  />
                </div>
              </template>
              <template v-if="selectedClip.type === 'video' || selectedClip.type === 'audio'">
                <label>Audio</label>
                <button
                  type="button"
                  class="tool-btn ghost small inspector-audio-btn"
                  @click="selectedClip.muted = !selectedClip.muted; onInspectorChange()"
                  :title="selectedClip.muted ? 'Unmute clip in render / preview' : 'Mute clip in render / preview'"
                >
                  <VolumeOff v-if="selectedClip.muted" :size="16" />
                  <Volume2 v-else :size="16" />
                </button>
              </template>
              <template v-if="selectedClip.type === 'text'">
                <div class="inspector-box">
                  <div class="inspector-box-title">Nội dung</div>
                  <label class="inspector-field-label">Chữ</label>
                  <textarea
                    class="inspector-textarea"
                    rows="3"
                    v-model="selectedClip.text"
                    @input="onInspectorChange"
                    placeholder="Nhập chữ hiển thị…"
                  />
                  <label class="inspector-field-label">Cỡ chữ</label>
                  <select v-model.number="selectedClip.fontSize" class="inspector-select" @change="onInspectorChange">
                    <option v-for="s in textSizeSelectOptions" :key="s" :value="s">{{ s }} px</option>
                  </select>
                  <label class="inspector-field-label">Độ đậm chữ (font-weight)</label>
                  <select v-model.number="selectedClip.fontWeight" class="inspector-select" @change="onInspectorChange">
                    <option v-for="o in TEXT_FONT_WEIGHT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                  </select>
                </div>
                <div class="inspector-box">
                  <div class="inspector-box-title">Màu & kiểu hiển thị</div>
                  <label class="inspector-field-label">Kiểu</label>
                  <select v-model="selectedClip.textStyle" class="inspector-select" @change="onInspectorChange">
                    <option v-for="o in TEXT_STYLE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                  </select>
                  <label class="inspector-field-label">Màu chữ</label>
                  <div class="inspector-color-row">
                    <button
                      v-for="c in TEXT_COLOR_SWATCHES"
                      :key="c"
                      type="button"
                      class="inspector-swatch"
                      :class="{ active: (selectedClip.color || '').toLowerCase() === c.toLowerCase() }"
                      :style="{ background: c }"
                      :title="c"
                      @click="applyTextColorSwatch(c)"
                    />
                    <input
                      type="color"
                      class="inspector-color-native"
                      :value="hexForColorInput(selectedClip.color)"
                      @input="(e) => { selectedClip.color = e.target.value; onInspectorChange(); }"
                    />
                    <input
                      type="text"
                      class="inspector-input inspector-input--hex"
                      v-model="selectedClip.color"
                      @change="onInspectorChange"
                      placeholder="#ffffff"
                    />
                  </div>
                  <template v-if="selectedClip.textStyle === 'fill'">
                    <label class="inspector-field-label">Màu nền</label>
                    <div class="inspector-color-row">
                      <button
                        v-for="c in TEXT_COLOR_SWATCHES"
                        :key="'bg-' + c"
                        type="button"
                        class="inspector-swatch"
                        :class="{ active: (selectedClip.boxColor || '').toLowerCase() === c.toLowerCase() }"
                        :style="{ background: c }"
                        :title="c"
                        @click="applyBoxColorSwatch(c)"
                      />
                      <input
                        type="color"
                        class="inspector-color-native"
                        :value="hexForColorInput((selectedClip.boxColor || '#00000088').slice(0, 7))"
                        @input="onBoxNativeColorInput"
                      />
                      <input
                        type="text"
                        class="inspector-input inspector-input--hex"
                        v-model="selectedClip.boxColor"
                        @change="onInspectorChange"
                        placeholder="#00000088"
                      />
                    </div>
                  </template>
                  <template v-if="selectedClip.textStyle === 'outline'">
                    <label class="inspector-field-label">Độ dày viền ngoài (px)</label>
                    <input
                      type="number"
                      class="inspector-input"
                      min="0"
                      max="12"
                      step="0.5"
                      v-model.number="selectedClip.strokeWidth"
                      @input="onInspectorChange"
                    />
                  </template>
                </div>
              </template>
            </div>
            <div v-else class="inspector-empty">Double-click clip để chỉnh thuộc tính</div>
          </div>
      </aside>
      </div>

      <section class="workspace-bottom cap-panel">
        <div class="timeline-toolbar">
          <div class="timeline-toolbar-side timeline-toolbar-left">
            <button class="cap-tool-btn" type="button" @click="togglePreviewPlay" :title="isPlaying ? 'Pause' : 'Play'">
              <Pause v-if="isPlaying" :size="15" />
              <Play v-else :size="15" />
            </button>
            <span class="cap-toolbar-divider" aria-hidden="true"></span>
            <button
              class="cap-tool-btn"
              type="button"
              @click="splitAtPlayhead"
              :disabled="!hasTimelineSelection"
              title="Tách clip tại playhead"
            >
              <Scissors :size="15" />
            </button>
            <button
              class="cap-tool-btn"
              type="button"
              @click="deleteSelectedClip"
              :disabled="!hasTimelineSelection"
              title="Xóa clip đang chọn"
            >
              <Trash2 :size="15" />
            </button>
            <button class="cap-tool-btn" type="button" @click="addTextClip" title="Thêm text">T</button>
            <button
              class="cap-tool-btn"
              type="button"
              @click="addTrackAboveSelection"
              title="Thêm track phía trên"
            >
              <ChevronUp :size="15" />
            </button>
            <button
              class="cap-tool-btn"
              type="button"
              @click="addTrackBelowSelection"
              title="Thêm track phía dưới"
            >
              <ChevronDown :size="15" />
            </button>
            <button
              class="cap-tool-btn"
              type="button"
              @click="deleteSelectedTrack"
              :disabled="tracks.length <= 1"
              title="Xóa track"
            >
              <ListX :size="15" />
            </button>
          </div>
          <div class="timeline-toolbar-side timeline-toolbar-right">
            <span class="time-view">{{ formatTimeHms(playhead) }}</span>
            <label class="zoom-label">Zoom</label>
            <input
              class="zoom-range cap-range"
              type="range"
              :min="TIMELINE_ZOOM_MIN"
              :max="TIMELINE_ZOOM_MAX"
              step="1"
              v-model.number="zoom"
            />
          </div>
        </div>

        <div class="timeline-shell">
          <div class="timeline-view-outer">
            <div class="timeline-view-v">
              <div
                ref="timelineViewportRef"
                class="timeline-view-h"
                @wheel="onTimelineWheel"
              >
                <div
                  ref="timelineContentRef"
                  class="timeline-content"
                  :style="{ width: `${timelineInnerWidth}px` }"
                  @pointerdown="onTimelineContentPointerDown"
                >
                  <div class="time-ruler" @pointerdown="onRulerPointerDown">
                    <div class="ruler-label-spacer"></div>
                    <div class="ruler-scale" :style="{ width: `${timelineWidth}px`, '--tick-step-px': `${5 * pixelsPerSecond}px` }">
                      <div
                        v-for="sec in timeMarkers"
                        :key="sec"
                        class="tick"
                        :class="{ 'tick--origin': sec === 0 }"
                        :style="{ left: `${sec * pixelsPerSecond}px` }"
                      >{{ sec.toFixed(0) }}s</div>
                    </div>
                  </div>

                  <div
                    v-for="track in tracks"
                    :key="track.id"
                    class="track-row"
                    :class="{ 'track-row--hidden': track.hidden }"
                  >
                    <div
                      class="track-label"
                      :class="{ 'track-label--active': selectedTrackId === track.id }"
                      role="button"
                      tabindex="0"
                      :title="'Lane đích khi thả resource — click để chọn (' + track.name + ')'"
                      @click="selectedTrackId = track.id"
                      @keydown.enter.prevent="selectedTrackId = track.id"
                      @keydown.space.prevent="selectedTrackId = track.id"
                    >
                      <button
                        type="button"
                        class="track-visibility-btn"
                        :title="track.hidden ? 'Hiện lane — tham gia preview & render' : 'Ẩn lane — không preview/render'"
                        @click.stop="toggleTrackHidden(track)"
                      >
                        <EyeOff v-if="track.hidden" :size="14" />
                        <Eye v-else :size="14" />
                      </button>
                      <span class="track-label-text">{{ track.name }}</span>
                    </div>
                    <div class="track-lane" @dragover="allowDrop" @drop="onDropTrack($event, track.id)">
                      <div
                        v-for="clip in track.clips"
                        :key="clip.id"
                        class="timeline-clip"
                        draggable="true"
                        :class="{
                          selected: isClipSelected(clip.id),
                          [`timeline-clip--${clip.type}`]: true
                        }"
                        :style="getClipStyle(clip)"
                        @pointerdown.stop="onClipPointerDown($event, clip, track.id)"
                        @dblclick.stop="openInspectorForClip(clip, track.id)"
                        @dragstart="onDragStartClip($event, clip, track.id)"
                      >
                        <div v-if="clip.type === 'video' || clip.type === 'image'" class="clip-thumb-bg" aria-hidden="true">
                          <video v-if="clip.type === 'video'" :src="clip.source" muted preload="metadata" />
                          <img v-else :src="clip.source" alt="" />
                        </div>
                        <div class="clip-content">
                          <span class="clip-name">{{ getResourceThumbName(clip.source || clip.text || clip.type) }}</span>
                          <span class="clip-meta">{{ clip.duration.toFixed(1) }}s</span>
                          <span v-if="clipHasEffects(clip)" class="clip-effect-badge" title="Có hiệu ứng">
                            <WandSparkles :size="10" />
                          </span>
                          <button
                            v-if="clip.type === 'video' || clip.type === 'audio'"
                            type="button"
                            class="clip-audio-toggle"
                            @click.stop="toggleClipMuted(clip)"
                            :title="clip.muted ? 'Unmute' : 'Mute'"
                          >
                            <VolumeOff v-if="clip.muted" :size="12" />
                            <Volume2 v-else :size="12" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div v-if="marqueeSelect" class="timeline-marquee" :style="marqueeStyle" />
                  <div class="global-playhead" :style="{ transform: `translate3d(${playheadPx}px, 0, 0)` }" />
                </div>
              </div>
            </div>
          </div>
          <div ref="scrollbarTrackRef" class="timeline-scrollbar" @pointerdown="onScrollbarTrackPointerDown">
            <div ref="scrollbarThumbRef" class="timeline-scrollbar-thumb" @pointerdown.stop="onScrollbarThumbPointerDown"></div>
          </div>
        </div>
      </section>
    </div>
    </div>

    <audio
      ref="previewAudioRef"
      class="preview-audio-offscreen"
      preload="auto"
      @timeupdate="onPreviewAudioTimeUpdate"
    />

    <div
      v-if="renderModalOpen"
      class="render-modal-overlay"
      @click.self="onRenderModalOverlayClick"
    >
      <div class="render-modal-card" role="dialog" aria-modal="true" @click.stop>
        <div class="render-modal-head" :class="{ 'render-modal-head--center': renderModalStep !== 'setup' }">
          <div class="render-modal-icon-ring">
            <WandSparkles v-if="renderModalStep === 'setup'" :size="22" />
            <Loader2 v-else-if="renderModalStep === 'progress'" :size="22" class="render-modal-spin-inline" />
            <CheckCircle2 v-else-if="renderModalStep === 'done'" :size="22" class="render-modal-icon-inline-success" />
            <XCircle v-else :size="22" class="render-modal-icon-inline-error" />
          </div>
          <h2 class="render-modal-title">{{ renderModalTitle }}</h2>
          <p class="render-modal-sub">{{ renderModalSub }}</p>
        </div>

        <div v-if="renderModalStep === 'setup'" class="render-modal-fields">
          <label class="render-modal-label">Chất lượng</label>
          <select v-model="renderQuality" class="render-modal-select">
            <option value="hd">HD (1920×1080)</option>
            <option value="2k">2K (2560×1440)</option>
          </select>
        </div>

        <div class="render-modal-fields">
          <label class="render-modal-label">Đường dẫn lưu</label>
          <div class="render-modal-path-row">
            <input
              type="text"
              class="render-modal-input"
              v-model="renderOutputPath"
              :readonly="renderModalStep !== 'setup'"
              placeholder="Mặc định: thư mục metadata/renders"
            />
            <button
              v-if="renderModalStep === 'setup'"
              type="button"
              class="render-modal-btn ghost"
              @click="chooseRenderOutputPath"
            >
              Duyệt
            </button>
          </div>
        </div>

        <div class="render-progress-section" aria-live="polite">
          <div class="render-progress-track" aria-hidden="true">
            <div
              class="render-progress-fill"
              :style="{ width: `${Math.min(100, Math.max(0, renderProgress))}%` }"
            />
          </div>
          <div class="render-progress-pct">{{ Math.min(100, Math.max(0, renderProgress)) }}%</div>
        </div>

        <p v-if="renderModalStep === 'error'" class="render-modal-error-inline">{{ renderResult }}</p>

        <div
          class="render-modal-actions"
          :class="{
            'render-modal-actions--split': renderModalStep === 'done',
            'render-modal-actions--center': renderModalStep === 'progress'
          }"
        >
          <template v-if="renderModalStep === 'setup'">
            <button type="button" class="render-modal-btn ghost" @click="closeRenderModal">Hủy</button>
            <button type="button" class="render-modal-btn primary" @click="startRenderFromModal">Xuất</button>
          </template>
          <template v-else-if="renderModalStep === 'progress'">
            <button type="button" class="render-modal-btn danger" @click="cancelRenderFromModal">Dừng render</button>
          </template>
          <template v-else-if="renderModalStep === 'done'">
            <button type="button" class="render-modal-btn secondary" @click="openOutputFolder">
              <FolderOpen :size="16" /> Mở thư mục
            </button>
            <button type="button" class="render-modal-btn primary" @click="closeRenderModal">Đóng</button>
          </template>
          <template v-else>
            <button type="button" class="render-modal-btn primary" @click="closeRenderModal">Đóng</button>
          </template>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.preview-audio-offscreen{
  position:fixed;
  left:-9999px;
  width:4px;
  height:4px;
  overflow:hidden;
  pointer-events:none;
}
.render-page{
  --cap-bg:var(--color-bg);
  --cap-panel:var(--color-bg-elevated);
  --cap-panel-2:var(--color-bg-soft);
  --cap-panel-3:var(--card-bg);
  --cap-border:var(--color-border);
  --cap-border-strong:var(--color-border);
  --cap-accent:var(--color-accent);
  --cap-accent-soft:var(--color-accent-soft);
  --cap-accent-strong:var(--color-accent-strong);
  --cap-text:var(--color-text);
  --cap-muted:var(--color-text-muted);
  --cap-text-on-accent:var(--color-text-on-accent);
  --cap-track:var(--color-bg);
  --cap-playhead:#ffffff;
  --cap-danger:var(--color-danger);
  --is-bg:var(--cap-bg);
  --is-panel:var(--cap-panel);
  --is-panel-2:var(--cap-panel-2);
  --is-border:var(--cap-border-strong);
  --is-border-strong:var(--cap-border-strong);
  --is-border-soft:var(--cap-border);
  --is-gold:var(--color-accent);
  --is-gold-deep:var(--color-accent-strong);
  --is-text:var(--cap-text);
  --is-muted:var(--cap-muted);
  height:100%;
  min-height:0;
  display:flex;
  flex-direction:column;
  background:var(--cap-bg);
  color:var(--cap-text);
  font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  overflow:hidden;
}
.editor-layout-wrap{
  flex:1;
  min-height:0;
  overflow:auto;
}
.editor-layout{
  display:flex;
  flex-direction:column;
  gap:0;
  height:100%;
  min-height:520px;
  min-width:900px;
  overflow:hidden;
}
.editor-top-row{
  display:flex;
  flex:1;
  min-height:0;
  min-width:0;
  overflow:hidden;
}
.layout-splitter--vertical{
  width:6px;
  flex-shrink:0;
  cursor:col-resize;
  position:relative;
  z-index:3;
  touch-action:none;
  background:transparent;
}
.layout-splitter--vertical::before{
  content:'';
  position:absolute;
  inset:0;
  left:50%;
  width:1px;
  transform:translateX(-50%);
  background:var(--cap-border);
  transition:background .12s ease,width .12s ease;
}
.layout-splitter--vertical:hover::before,
.layout-splitter--vertical.is-active::before{
  width:2px;
  background:var(--cap-accent);
}
:global(body.render-split-dragging){
  cursor:col-resize !important;
  user-select:none !important;
}
:global(body.render-split-dragging *){cursor:col-resize !important}
.toolbar{
  height:46px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:0 .75rem;
  border-bottom:1px solid var(--cap-border);
  background:var(--cap-bg);
  flex-shrink:0;
}
.toolbar-left,.toolbar-right{display:flex;gap:.45rem;align-items:center}
.tool-btn{
  height:32px;
  border:1px solid var(--cap-border);
  background:var(--cap-panel-2);
  color:var(--cap-text);
  border-radius:6px;
  padding:0 .65rem;
  display:flex;
  gap:.35rem;
  align-items:center;
  cursor:pointer;
  font-size:.76rem;
  font-weight:600;
  justify-content:center;
  transition:background .15s ease,border-color .15s ease;
}
.tool-btn:hover:not(:disabled){background:var(--cap-panel-3);border-color:var(--cap-border-strong)}
.tool-btn:disabled{opacity:.45;cursor:not-allowed}
.tool-btn.ghost{background:transparent}
.tool-btn.small{height:28px;font-size:.72rem;padding:0 .5rem}
.tool-btn.primary{
  background:var(--cap-accent);
  color:var(--cap-text-on-accent);
  border-color:var(--cap-accent);
  font-weight:700;
  box-shadow:none;
}
.tool-btn.primary:hover:not(:disabled){background:var(--color-accent-strong);border-color:var(--color-accent-strong)}
.select{
  height:32px;
  background:var(--cap-panel-2);
  border:1px solid var(--cap-border);
  border-radius:6px;
  color:var(--cap-text);
  padding:0 .55rem;
  font-size:.76rem;
}
.cap-panel{
  min-height:0;
  overflow:hidden;
  background:var(--cap-panel);
  border-bottom:1px solid var(--cap-border);
  display:flex;
  flex-direction:column;
}
.resources-panel{
  flex-shrink:0;
  min-width:0;
  border-right:none;
}
.resources-panel-head{
  display:flex;
  align-items:stretch;
  height:36px;
  min-height:36px;
  border-bottom:1px solid var(--cap-border);
  background:var(--cap-panel);
  flex-shrink:0;
}
.resources-tab{
  flex:1;
  min-width:0;
  border:none;
  border-right:1px solid var(--cap-border);
  background:transparent;
  color:var(--cap-muted);
  font-size:.7rem;
  font-weight:700;
  letter-spacing:.01em;
  cursor:pointer;
  position:relative;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:.3rem;
  padding:0 .35rem;
  transition:color .15s ease,background .15s ease;
}
.resources-tab:last-child{border-right:none}
.resources-tab:hover{color:var(--cap-text);background:rgba(255,255,255,.03)}
.resources-tab--active{
  color:var(--cap-accent);
  background:var(--color-accent-bg-fade-2);
}
.resources-tab--active::after{
  content:'';
  position:absolute;
  left:12%;
  right:12%;
  bottom:0;
  height:2px;
  background:var(--cap-accent);
  border-radius:2px 2px 0 0;
}
.resources-tab-badge{
  min-width:16px;
  height:16px;
  padding:0 4px;
  border-radius:999px;
  background:var(--cap-accent-soft);
  color:var(--cap-accent);
  font-size:.58rem;
  font-weight:800;
  line-height:16px;
}
.resource-tab-pane{
  flex:1;
  min-height:0;
  display:flex;
  flex-direction:column;
  gap:.45rem;
  overflow:auto;
}
.resource-tab-pane--empty{
  align-items:center;
  justify-content:center;
  text-align:center;
  padding:1rem .5rem;
  color:var(--cap-muted);
}
.resource-tab-empty-icon{color:var(--cap-accent);opacity:.75;margin-bottom:.35rem}
.resource-tab-empty-title{
  margin:0 0 .25rem;
  font-size:.78rem;
  font-weight:700;
  color:var(--cap-text);
}
.resource-tab-empty-sub{
  margin:0;
  font-size:.7rem;
  line-height:1.45;
  max-width:14rem;
}
.effect-tab{
  padding:.15rem 0 .35rem;
  gap:.65rem;
}
.effect-tab-hint{
  margin:0;
  font-size:.66rem;
  line-height:1.45;
  color:var(--cap-muted);
  padding:0 .1rem;
}
.effect-tab-hint--ok{color:var(--cap-accent)}
.effect-group{
  display:flex;
  flex-direction:column;
  gap:.35rem;
}
.effect-group-title{
  margin:0;
  font-size:.72rem;
  font-weight:800;
  color:var(--cap-text);
}
.effect-group-sub{
  margin:0;
  font-size:.62rem;
  color:var(--cap-muted);
  line-height:1.35;
}
.effect-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:.35rem;
}
.effect-card{
  min-height:34px;
  border:1px solid var(--cap-border);
  border-radius:5px;
  background:var(--cap-panel-2);
  color:var(--cap-text);
  font-size:.62rem;
  font-weight:600;
  line-height:1.25;
  padding:.35rem .4rem;
  cursor:pointer;
  text-align:left;
  transition:border-color .15s ease,background .15s ease,box-shadow .15s ease;
}
.effect-card:hover:not(:disabled){
  border-color:var(--cap-accent-strong);
  background:var(--cap-accent-soft);
}
.effect-card.active{
  border-color:var(--cap-accent);
  background:var(--cap-accent-soft);
  box-shadow:0 0 0 1px color-mix(in srgb,var(--cap-accent) 35%,transparent);
}
.effect-card:disabled{
  opacity:.45;
  cursor:not-allowed;
}
.effect-card-label{display:block}
.effect-duration-row{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:.5rem;
  font-size:.64rem;
  color:var(--cap-muted);
}
.effect-duration-row input{
  width:4.5rem;
  height:26px;
  border:1px solid var(--cap-border);
  border-radius:4px;
  background:var(--cap-panel);
  color:var(--cap-text);
  font-size:.68rem;
  padding:0 .35rem;
}
.effect-clear-btn{
  margin-top:.15rem;
  height:28px;
  border:1px solid var(--cap-border);
  border-radius:5px;
  background:transparent;
  color:var(--cap-muted);
  font-size:.64rem;
  font-weight:600;
  cursor:pointer;
}
.effect-clear-btn:hover:not(:disabled){
  border-color:rgba(248,113,113,.45);
  color:#fca5a5;
}
.effect-clear-btn:disabled{opacity:.4;cursor:not-allowed}
.resource-pane-action{
  width:100%;
  height:28px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:.35rem;
  border:1px solid var(--cap-accent-strong);
  border-radius:5px;
  background:var(--cap-accent-soft);
  color:var(--cap-accent);
  font-size:.66rem;
  font-weight:700;
  cursor:pointer;
  flex-shrink:0;
}
.resource-pane-action:hover{background:var(--color-accent-bg-fade-1)}
.text-preset-grid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:.4rem;
}
.text-preset-card{
  min-height:64px;
  border:1px solid var(--cap-border);
  border-radius:6px;
  background:var(--cap-panel-2);
  color:var(--cap-text);
  cursor:pointer;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:.25rem;
  padding:.45rem .35rem;
  transition:border-color .15s ease,background .15s ease;
}
.text-preset-card:hover{border-color:var(--cap-accent-strong);background:var(--cap-panel-2)}
.text-preset-preview{
  font-size:.82rem;
  font-weight:700;
  line-height:1.2;
  text-align:center;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  max-width:100%;
}
.text-preset-label{
  font-size:.62rem;
  color:var(--cap-muted);
  text-transform:uppercase;
  letter-spacing:.04em;
}
.player-panel{
  flex:1;
  min-width:280px;
  border-right:none;
}
.inspector-panel{
  flex-shrink:0;
  min-width:0;
  border-right:none;
}
.workspace-bottom{
  flex-shrink:0;
  height:clamp(220px,32vh,340px);
  border-right:none;
  padding:0;
  display:flex;
  flex-direction:column;
  min-height:0;
}
.cap-panel-head{
  height:36px;
  min-height:36px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:.5rem;
  padding:0 .75rem;
  border-bottom:1px solid var(--cap-border);
  background:var(--cap-panel);
  flex-shrink:0;
}
.cap-panel-title{
  font-size:.78rem;
  font-weight:700;
  color:var(--cap-text);
  letter-spacing:.01em;
}
.cap-panel-badge{
  min-width:20px;
  height:18px;
  padding:0 6px;
  border-radius:999px;
  background:var(--cap-accent-soft);
  color:var(--cap-accent);
  font-size:.64rem;
  font-weight:800;
  display:inline-flex;
  align-items:center;
  justify-content:center;
}
.resources-body{
  flex:1;
  min-height:0;
  display:flex;
  flex-direction:column;
  gap:.4rem;
  padding:.55rem;
  overflow:hidden;
}
.resources-toolbar{
  display:flex;
  flex-direction:row;
  align-items:center;
  gap:.35rem;
  flex-shrink:0;
}
.cap-import-btn,
.add-all-videos-btn{
  flex:1;
  min-width:0;
  height:28px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:.3rem;
  border-radius:5px;
  padding:0 .4rem;
  font-size:.66rem;
  font-weight:600;
  white-space:nowrap;
  overflow:hidden;
}
.cap-import-btn span,
.add-all-videos-btn span{
  overflow:hidden;
  text-overflow:ellipsis;
}
.cap-import-btn{
  border:1px solid var(--cap-accent-strong);
  color:var(--cap-accent);
  background:var(--cap-accent-soft);
  cursor:pointer;
  transition:opacity .2s,background .2s ease;
}
.cap-import-btn:hover{background:var(--color-accent-bg-fade-1)}
.upload-btn--busy{opacity:.75;cursor:wait}
.upload-btn input{display:none}
.add-all-videos-btn{
  border:1px solid var(--cap-border);
  color:var(--cap-muted);
  background:var(--cap-panel-2);
  cursor:pointer;
  transition:opacity .2s ease,border-color .2s ease,color .2s ease;
}
.add-all-videos-btn:hover:not(:disabled){border-color:var(--cap-accent-strong);color:var(--cap-text)}
.add-all-videos-btn:disabled{opacity:.42;cursor:not-allowed}
.add-all-videos-btn--busy{cursor:wait}
.upload-spin{animation:upload-spin .75s linear infinite;color:var(--cap-accent)}
@keyframes upload-spin{to{transform:rotate(360deg)}}
.resource-grid{
  flex:1;
  min-height:0;
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(112px,1fr));
  gap:10px 8px;
  align-content:start;
  overflow:auto;
  padding:2px 4px 4px 0;
  scrollbar-width:thin;
  scrollbar-color:var(--color-border) transparent;
}
.resource-grid::-webkit-scrollbar{width:6px}
.resource-grid::-webkit-scrollbar-thumb{background:var(--color-border);border-radius:999px}
.media-item{
  min-width:0;
  cursor:grab;
  user-select:none;
}
.media-item-thumb{
  position:relative;
  width:100%;
  aspect-ratio:16/10;
  border-radius:6px;
  overflow:hidden;
  background:var(--cap-bg);
  border:1px solid transparent;
  transition:border-color .15s ease;
}
.media-item:hover .media-item-thumb{border-color:rgba(255,255,255,.12)}
.media-item-thumb img,.media-item-thumb video{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
  pointer-events:none;
}
.media-item-audio{
  width:100%;
  height:100%;
  display:flex;
  align-items:center;
  justify-content:center;
  color:var(--cap-accent);
  background:linear-gradient(180deg,var(--cap-panel-2) 0%,var(--cap-bg) 100%);
}
.media-item-added{
  position:absolute;
  top:5px;
  left:5px;
  z-index:2;
  display:inline-flex;
  align-items:center;
  gap:3px;
  padding:2px 6px;
  border-radius:4px;
  background:rgba(0,0,0,.62);
  color:#fff;
  font-size:10px;
  font-weight:700;
  line-height:1.2;
  pointer-events:none;
}
.media-item-duration{
  position:absolute;
  top:5px;
  right:5px;
  z-index:2;
  font-size:11px;
  font-weight:700;
  color:#fff;
  text-shadow:0 1px 3px rgba(0,0,0,.85);
  pointer-events:none;
  font-variant-numeric:tabular-nums;
}
.media-item-actions{
  position:absolute;
  inset:0;
  z-index:3;
  display:flex;
  align-items:flex-end;
  justify-content:flex-end;
  gap:4px;
  padding:5px;
  opacity:0;
  background:linear-gradient(180deg,transparent 35%,rgba(0,0,0,.55) 100%);
  transition:opacity .15s ease;
}
.media-item:hover .media-item-actions{opacity:1}
.media-item-action{
  width:22px;
  height:22px;
  border:none;
  border-radius:4px;
  background:rgba(24,24,24,.92);
  color:#fff;
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
}
.media-item-action:hover{background:var(--cap-accent);color:var(--cap-text-on-accent)}
.media-item-action--danger:hover{background:var(--color-danger);color:#fff}
.media-item-name{
  margin-top:5px;
  font-size:11px;
  line-height:1.25;
  font-weight:500;
  color:var(--cap-muted);
  text-align:center;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  padding:0 2px;
}
.resource-empty{
  grid-column:1 / -1;
  padding:1.5rem .5rem;
  text-align:center;
  font-size:.74rem;
  color:var(--cap-muted);
}
.player-head .player-time{
  font-size:.62rem;
  font-weight:600;
  color:var(--cap-muted);
  font-variant-numeric:tabular-nums;
}
.player-body{
  flex:1;
  min-height:0;
  display:flex;
  flex-direction:column;
  background:var(--cap-bg);
}
.player-body .preview-stage{
  flex:1;
  min-height:0;
  overflow:hidden;
}
.player-controls{
  height:44px;
  min-height:44px;
  display:flex;
  align-items:center;
  justify-content:center;
  border-top:1px solid var(--cap-border);
  background:var(--cap-panel);
  flex-shrink:0;
}
.player-play-btn{
  width:34px;
  height:34px;
  border:none;
  border-radius:50%;
  background: transparent;
  color:var(--cap-text);
  display:flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  transition:transform .12s ease,background .12s ease;
}
.player-play-btn:hover{transform:scale(1.05);background: transparent}
.clip-audio-toggle{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:22px;
  height:22px;
  border:1px solid rgba(255,255,255,.18);
  /* background:rgba(0,0,0,.35); */
  /* color:var(--cap-text); */
  border-radius:4px;
  cursor:pointer;
  padding:0;
  flex-shrink:0;
}
.preview-aspect-host{
  width:100%;
  height:100%;
  min-width:0;
  min-height:0;
  box-sizing:border-box;
  padding:10px;
  display:grid;
  place-items:center;
  container-type:size;
  container-name:preview;
}
.preview-frame{
  position:relative;
  box-sizing:border-box;
  max-width:100%;
  max-height:100%;
  width:min(100cqw,calc(100cqh * var(--ar-w) / var(--ar-h)));
  height:min(100cqh,calc(100cqw * var(--ar-h) / var(--ar-w)));
  aspect-ratio:var(--ar-w) / var(--ar-h);
  border:none;
  border-radius:4px;
  background:#000;
  overflow:hidden;
  box-shadow:0 0 0 1px rgba(255,255,255,.06);
}
@supports not (width:1cqw){
  .preview-frame{
    width:auto;
    height:auto;
    max-width:100%;
    max-height:100%;
    aspect-ratio:var(--ar-w) / var(--ar-h);
  }
}
.preview-frame-content{
  position:absolute;
  inset:0;
  overflow:hidden;
  background:#000;
}
.preview-media-layer{
  position:absolute;
  inset:0;
  z-index:0;
  overflow:hidden;
}
.visual-layout-box{
  position:absolute;
  z-index:1;
  box-sizing:border-box;
  cursor:move;
  border:none;
  border-radius:.28rem;
  overflow:hidden;
  background:transparent;
}
.visual-layout-box.selected{
  outline:none;
  border:none;
  box-shadow:0 0 0 2px var(--cap-accent);
}
.visual-layout-box.is-dragging,.visual-layout-box.is-resizing{cursor:grabbing}
.visual-layout-box video,.visual-layout-box img{
  position:absolute;
  inset:0;
  width:100%;
  height:100%;
  object-fit:contain;
  object-position:center center;
  pointer-events:none;
}
.visual-resize-handle{
  position:absolute;
  right:2px;
  bottom:2px;
  width:10px;
  height:10px;
  border-radius:2px;
  background:var(--cap-accent);
  border:1px solid var(--cap-panel);
  cursor:nwse-resize;
  pointer-events:auto;
  z-index:2;
}
.inspector-body{
  flex:1;
  min-height:0;
  overflow:auto;
  padding:.65rem .75rem .85rem;
  scrollbar-width:thin;
  scrollbar-color:var(--color-border) transparent;
}
.inspector-body::-webkit-scrollbar{width:6px}
.inspector-body::-webkit-scrollbar-thumb{background:var(--color-border);border-radius:999px}
.inspector-panel{
  box-sizing:border-box;
  min-height:0;
  overflow:hidden;
}
.inspector-panel.empty .inspector-body{opacity:.75}
.inspector-empty{
  font-size:.78rem;
  color:var(--is-muted);
  line-height:1.5;
  text-align:center;
  padding:.6rem .25rem 0;
}
.inspector-grid{
  display:grid;
  grid-template-columns:1fr;
  gap:.5rem;
}
.inspector-grid > label{
  margin-top:.1rem;
  margin-bottom:-.15rem;
  font-size:.7rem;
  font-weight:700;
  letter-spacing:.02em;
  color:var(--is-muted);
}
.inspector-grid input,.inspector-grid select{
  height:32px;
  box-sizing:border-box;
  width:100%;
  background:var(--cap-track);
  border:1px solid var(--cap-border);
  border-radius:6px;
  color:var(--cap-text);
  padding:0 .55rem;
  font-size:.78rem;
  transition:border-color .15s ease,box-shadow .15s ease;
}
.inspector-grid input:hover,.inspector-grid select:hover{border-color:var(--cap-border-strong)}
.inspector-grid input:focus-visible,.inspector-grid select:focus-visible{
  outline:none;
  border-color:var(--cap-accent-strong);
  box-shadow:0 0 0 2px var(--cap-accent-soft);
}
.inspector-box{
  border:1px solid var(--cap-border);
  border-radius:6px;
  padding:.55rem .65rem .65rem;
  margin-bottom:.35rem;
  background:var(--cap-track);
}
.inspector-box-title{
  font-size:.64rem;
  font-weight:700;
  color:var(--cap-muted);
  text-transform:uppercase;
  letter-spacing:.06em;
  margin:0 0 .45rem;
  padding-bottom:.35rem;
  border-bottom:1px solid var(--cap-border);
}
.inspector-field-label{
  display:block;
  margin-top:.4rem;
  margin-bottom:.22rem;
  font-size:.7rem;
  font-weight:700;
  letter-spacing:.02em;
  color:var(--is-muted);
}
.inspector-field-label:first-child{margin-top:0}
.inspector-textarea{
  width:100%;
  box-sizing:border-box;
  min-height:72px;
  resize:vertical;
  padding:.45rem .55rem;
  border-radius:6px;
  border:1px solid var(--cap-border);
  background:var(--cap-track);
  color:var(--cap-text);
  font-size:.78rem;
  line-height:1.4;
  font-family:inherit;
}
.inspector-textarea:focus-visible{
  outline:none;
  border-color:var(--cap-accent-strong);
  box-shadow:0 0 0 2px var(--cap-accent-soft);
}
.inspector-select,.inspector-input{
  width:100%;
  box-sizing:border-box;
  height:32px;
  border-radius:6px;
  border:1px solid var(--cap-border);
  background:var(--cap-track);
  color:var(--cap-text);
  padding:0 .55rem;
  font-size:.78rem;
}
.inspector-select:focus-visible,.inspector-input:focus-visible{
  outline:none;
  border-color:var(--cap-accent-strong);
  box-shadow:0 0 0 2px var(--cap-accent-soft);
}
.inspector-swatch.active{outline:2px solid var(--cap-accent);outline-offset:1px}
.inspector-color-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:.15rem}
.inspector-swatch{
  width:22px;
  height:22px;
  border-radius:5px;
  border:1px solid var(--cap-border);
  cursor:pointer;
  padding:0;
  flex-shrink:0;
}
.inspector-color-native{width:34px;height:34px;padding:0;border:none;border-radius:6px;cursor:pointer;background:transparent}
.inspector-input--hex{flex:1;min-width:0;max-width:160px;height:32px}
.inspector-select{cursor:pointer;appearance:auto}
.inspector-input--readonly{
  cursor:default;
  opacity:.92;
  color:rgba(226,228,236,.88);
  background:var(--cap-track);
  border-style:dashed;
}
.preview-empty{
  position:absolute;
  inset:0;
  z-index:1;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:.75rem;
  text-align:center;
  color:var(--cap-muted);
  font-size:.78rem;
  pointer-events:none;
}
.text-overlay-layer{
  position:absolute;
  inset:0;
  z-index:500;
  overflow:hidden;
  pointer-events:none;
}
.text-overlay-item{
  position:absolute;
  box-sizing:border-box;
  padding:4px 8px;
  border-radius:6px;
  transform:translate(-50%,-50%);
  font-family:system-ui,Segoe UI,Roboto,sans-serif;
  font-synthesis:weight style;
  line-height:1.25;
  white-space:pre-wrap;
  overflow-wrap:anywhere;
  overflow:hidden;
  max-width:96%;
  pointer-events:auto;
  cursor:move;
  min-width:0;
}
.text-resize-handle{
  position:absolute;
  right:2px;
  bottom:2px;
  width:10px;
  height:10px;
  border-radius:50%;
  background:var(--cap-accent);
  border:1px solid var(--cap-panel);
  cursor:ew-resize;
}
.timeline-toolbar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:.5rem;
  height:40px;
  min-height:40px;
  padding:0 .55rem;
  border-bottom:1px solid var(--cap-border);
  background:var(--cap-panel);
  flex-shrink:0;
}
.timeline-toolbar-side{display:flex;align-items:center;gap:.35rem;min-width:0}
.timeline-toolbar-left{flex-wrap:wrap}
.timeline-toolbar-right{margin-left:auto}
.cap-tool-btn{
  width:30px;
  height:30px;
  border:none;
  border-radius:6px;
  background:transparent;
  color:var(--cap-text);
  display:inline-flex;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  font-size:.72rem;
  font-weight:700;
  transition:background .12s ease,color .12s ease;
}
.cap-tool-btn:hover:not(:disabled){background:var(--cap-panel-3)}
.cap-tool-btn:disabled{opacity:.35;cursor:not-allowed}
.cap-toolbar-divider{
  width:1px;
  height:18px;
  background:var(--cap-border);
  margin:0 .15rem;
}
.inspector-audio-btn{justify-content:center;width:100%;margin-top:.15rem}
.zoom-range,.cap-range{width:120px;height:4px;accent-color:var(--cap-accent)}
.zoom-label,.time-view{font-size:.72rem;color:var(--cap-muted);font-variant-numeric:tabular-nums}
.timeline-shell{
  display:grid;
  grid-template-rows:minmax(0,1fr) 12px;
  gap:4px;
  flex:1;
  min-height:0;
  padding:0 .45rem .45rem;
  background:var(--cap-panel);
}
/* Tách cuộn dọc / ngang: chỉ một thanh ngang (custom bên dưới), tránh 2 scrollbar chồng nhau */
.timeline-view-outer{
  position:relative;
  overflow:hidden;
  min-height:0;
  height:100%;
  border:1px solid var(--cap-border);
  border-radius:4px;
  background:var(--cap-track);
  display:flex;
  flex-direction:column;
}
.timeline-view-v{
  flex:1;
  min-height:0;
  overflow-x:hidden;
  overflow-y:auto;
  scrollbar-width:thin;
  scrollbar-color:var(--color-border) transparent;
}
.timeline-view-v::-webkit-scrollbar{width:6px}
.timeline-view-v::-webkit-scrollbar-thumb{background:var(--color-border);border-radius:4px}
.timeline-view-h{
  position:relative;
  width:100%;
  overflow-x:auto;
  overflow-y:visible;
  -ms-overflow-style:none;
  scrollbar-width:none;
  scroll-behavior:auto;
}
.timeline-view-h::-webkit-scrollbar{display:none}
.timeline-content{position:relative;min-height:100%;contain:layout style;padding-bottom:.35rem}
.timeline-scrollbar{
  position:relative;
  height:12px;
  background:var(--cap-panel-2);
  border:1px solid var(--cap-border);
  border-radius:999px;
}
.timeline-scrollbar-thumb{
  position:absolute;
  left:0;
  top:1px;
  height:8px;
  background:var(--color-border);
  border-radius:999px;
  cursor:ew-resize;
  transition:background .15s ease;
}
.timeline-scrollbar-thumb:hover{background:var(--cap-muted)}
.time-ruler{
  height:28px;
  position:sticky;
  top:0;
  z-index:12;
  border-bottom:1px solid var(--cap-border);
  display:flex;
  align-items:stretch;
  gap:0;
  background:var(--cap-panel-2);
}
.ruler-label-spacer{
  width:110px;
  min-width:110px;
  flex-shrink:0;
  background:var(--cap-panel);
  border-right:1px solid var(--cap-border);
}
.ruler-scale{
  position:relative;
  flex-shrink:0;
}
.ruler-scale::before{
  content:'';
  position:absolute;
  inset:0;
  background:repeating-linear-gradient(
    90deg,
    rgba(255,255,255,.08) 0,
    rgba(255,255,255,.08) 1px,
    transparent 1px,
    transparent calc(var(--tick-step-px, 86px))
  );
  opacity:.65;
  pointer-events:none;
}
.tick{
  position:absolute;
  top:7px;
  transform:translateX(-50%);
  font-size:.52rem;
  color:var(--cap-muted);
  font-weight:400;
  font-variant-numeric:tabular-nums;
}
.tick--origin{transform:translateX(0)}
.track-row{
  display:grid;
  grid-template-columns:110px 1fr;
  gap:0;
  align-items:stretch;
  min-height:52px;
  border-bottom:1px solid var(--cap-border);
  transition:opacity .15s ease;
}
.track-row--hidden{opacity:.38}
.track-label{
  height:52px;
  border:none;
  border-right:1px solid var(--cap-border);
  border-radius:0;
  background:var(--cap-panel);
  color:var(--cap-muted);
  display:flex;
  align-items:center;
  justify-content:center;
  gap:.15rem;
  padding:0 .25rem;
  font-weight:700;
  font-size:.64rem;
  cursor:pointer;
  user-select:none;
  transition:background .12s ease,color .12s ease;
}
.track-visibility-btn{
  flex-shrink:0;
  display:flex;
  align-items:center;
  justify-content:center;
  width:24px;
  height:24px;
  padding:0;
  border:none;
  border-radius:4px;
  background:transparent;
  color:inherit;
  cursor:pointer;
}
.track-visibility-btn:hover{background:var(--cap-panel-3);color:var(--cap-text)}
.track-label-text{flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-left:.15rem}
.track-label--active{
  background:var(--cap-panel-2);
  color:var(--cap-accent);
  box-shadow:inset 3px 0 0 var(--cap-accent);
}
.track-lane{
  position:relative;
  min-height:52px;
  height:52px;
  border:none;
  border-radius:0;
  background:var(--cap-track);
  contain:layout paint;
  overflow:hidden;
}
.timeline-clip{
  position:absolute;
  top:4px;
  height:44px;
  border:1px solid rgba(255,255,255,.12);
  border-radius:4px;
  background:var(--cap-panel-2);
  color:var(--cap-text);
  overflow:hidden;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.04);
  transition:box-shadow .12s ease,border-color .12s ease;
  will-change:transform;
}
.timeline-clip:hover{border-color:rgba(255,255,255,.22)}
.timeline-clip--video{border-color:color-mix(in srgb,var(--color-accent) 35%,transparent)}
.timeline-clip--audio{border-color:rgba(96,165,250,.28);background:#172033}
.timeline-clip--image{border-color:rgba(74,222,128,.24)}
.timeline-clip--text{border-color:rgba(192,132,252,.24);background:#221a2e}
.timeline-clip.selected{
  border:2px solid var(--cap-playhead);
  box-shadow:0 0 0 1px rgba(0,0,0,.5);
  z-index:5;
}
.clip-thumb-bg{
  position:absolute;
  inset:0;
  opacity:.72;
  pointer-events:none;
}
.clip-thumb-bg video,.clip-thumb-bg img{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
}
.clip-content{
  position:relative;
  z-index:1;
  height:100%;
  display:flex;
  align-items:center;
  gap:.35rem;
  padding:.15rem .4rem;
  background:linear-gradient(180deg,rgba(0,0,0,.35) 0%,rgba(0,0,0,.15) 100%);
}
.clip-name{
  flex:1;
  min-width:0;
  font-size:.62rem;
  font-weight:700;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.clip-meta{
  font-size:.6rem;
  font-weight:600;
  color:rgba(255,255,255,.75);
  white-space:nowrap;
  flex-shrink:0;
}
.clip-effect-badge{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:16px;
  height:16px;
  border-radius:4px;
  background:rgba(192,132,252,.25);
  color:#e9d5ff;
  flex-shrink:0;
}
.global-playhead{
  position:absolute;
  top:0;
  bottom:0;
  left:0;
  width:2px;
  background:var(--cap-playhead);
  z-index:30;
  pointer-events:none;
  will-change:transform;
  box-shadow:0 0 6px rgba(255,255,255,.35);
}
.global-playhead::before{
  content:'';
  position:absolute;
  top:0;
  left:50%;
  transform:translateX(-50%);
  width:10px;
  height:14px;
  background:var(--cap-playhead);
  border-radius:2px 2px 0 0;
  box-shadow:0 1px 3px rgba(0,0,0,.45);
}
.timeline-marquee{
  position:absolute;
  z-index:24;
  border:1px solid var(--cap-accent);
  background:var(--color-accent-soft);
  border-radius:2px;
  pointer-events:none;
  box-shadow:inset 0 0 0 1px var(--color-accent-bg-fade-2);
}
.inspector-multi-hint{
  margin:0 0 .55rem;
  padding:.45rem .5rem;
  border-radius:6px;
  border:1px solid var(--cap-border);
  background:var(--color-accent-bg-fade-2);
  color:var(--cap-muted);
  font-size:.68rem;
  line-height:1.4;
}
.render-modal-overlay{
  position:fixed;
  inset:0;
  z-index:2000;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:1.25rem;
  background:rgba(6,7,10,.72);
  backdrop-filter:blur(6px);
}
.render-modal-card{
  width:100%;
  max-width:420px;
  border-radius:.85rem;
  padding:1.35rem 1.35rem 1.15rem;
  background:linear-gradient(165deg,var(--is-panel) 0%,var(--color-bg-soft) 100%);
  border:1px solid var(--is-border-strong);
  box-shadow:0 18px 48px rgba(0,0,0,.45),0 0 0 1px rgba(0,0,0,.25) inset;
}
.render-modal-head{margin-bottom:1rem}
.render-modal-head--center{text-align:center;margin-bottom:1.1rem}
.render-modal-icon-ring{
  width:44px;
  height:44px;
  border-radius:12px;
  display:flex;
  align-items:center;
  justify-content:center;
  margin-bottom:.65rem;
  color:var(--color-text-on-accent);
  background:linear-gradient(180deg,var(--is-gold) 0%,var(--is-gold-deep) 100%);
  border:1px solid rgba(255,255,255,.12);
  box-shadow:0 2px 8px rgba(0,0,0,.25);
}
.render-modal-head--center .render-modal-spin{margin:0 auto .6rem;color:var(--is-gold)}
.render-modal-title{margin:0;font-size:1.15rem;font-weight:800;color:var(--is-text);letter-spacing:.02em}
.render-modal-sub{margin:.45rem 0 0;font-size:.8rem;line-height:1.45;color:var(--is-muted)}
.render-modal-fields{display:grid;grid-template-columns:1fr;gap:.35rem;margin-bottom:1rem}
.render-modal-label{font-size:.72rem;font-weight:700;color:var(--is-muted);margin-top:.25rem}
.render-modal-input,.render-modal-select{
  width:100%;
  box-sizing:border-box;
  height:38px;
  border-radius:.5rem;
  border:1px solid var(--is-border-strong);
  background:var(--is-bg);
  color:var(--is-text);
  padding:0 .65rem;
  font-size:.82rem;
}
.render-modal-select{cursor:pointer}
.render-modal-path-row{display:flex;gap:.45rem;align-items:center}
.render-modal-path-row .render-modal-input{flex:1;min-width:0}
.render-modal-input:read-only{opacity:.88;cursor:default}
.render-modal-actions{display:flex;justify-content:flex-end;gap:.5rem;margin-top:.35rem;flex-wrap:wrap}
.render-modal-actions--split{justify-content:space-between}
.render-modal-actions--center{justify-content:center}
.render-modal-actions--stack{flex-direction:column;align-items:stretch}
.render-modal-actions--stack .render-modal-btn{width:100%;justify-content:center}
.render-modal-btn{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:.4rem;
  height:38px;
  padding:0 1rem;
  border-radius:.5rem;
  font-size:.82rem;
  font-weight:700;
  cursor:pointer;
  border:1px solid transparent;
  text-decoration:none;
}
.render-modal-btn.ghost{
  background:transparent;
  border-color:var(--is-border-strong);
  color:var(--is-text);
}
.render-modal-btn.primary{
  background:linear-gradient(180deg,var(--is-gold) 0%,var(--is-gold-deep) 100%);
  color:var(--color-text-on-accent);
  border-color:var(--is-gold);
  box-shadow:0 1px 0 rgba(255,255,255,.15) inset;
}
.render-modal-btn.secondary{
  background:var(--is-panel-2);
  border-color:var(--is-border-strong);
  color:var(--is-text);
}
.render-modal-btn.secondary:hover{background:var(--color-bg-soft)}
.render-modal-btn.danger{
  border:1px solid #5c2a2a;
  background:#2a1214;
  color:#f0b4b4;
}
.render-modal-btn.danger:hover{background:#3a181c;color:#fff}
.render-progress-section{margin:.35rem 0 .85rem}
.render-modal-spin-inline{display:block;animation:render-spin 1s linear infinite;color:var(--is-gold)}
.render-modal-icon-inline-success{color:#6bc98a;display:block}
.render-modal-icon-inline-error{color:#e07878;display:block}
.render-modal-error-inline{margin:.35rem 0 0;font-size:.78rem;color:#c9a89a;word-break:break-word;line-height:1.4}
.render-progress-block{margin:.25rem 0 .15rem}
.render-progress-track{
  height:10px;
  border-radius:999px;
  background:var(--is-bg);
  border:1px solid var(--is-border);
  overflow:hidden;
}
.render-progress-fill{
  height:100%;
  border-radius:999px;
  background:linear-gradient(90deg,var(--is-gold-deep),var(--is-gold));
  box-shadow:0 0 12px var(--color-accent-glow-strong);
  transition:width .25s ease;
}
.render-progress-pct{margin-top:.55rem;text-align:center;font-weight:800;font-size:1.35rem;color:var(--is-gold);letter-spacing:.04em}
.render-modal-spin{display:block;animation:render-spin 1s linear infinite}
@keyframes render-spin{to{transform:rotate(360deg)}}
.render-modal-icon-success{color:#6bc98a;margin:0 auto .35rem;display:block}
.render-modal-icon-error{color:#e07878;margin:0 auto .35rem;display:block}
.render-modal-error-msg{color:#c9a89a;word-break:break-word}
</style>

