<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Film,
  FolderOpen,
  Image as ImageIcon,
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

const props = defineProps({
  sourceAssets: { type: Array, default: () => [] },
  /** Project hiện tại — dùng upload asset lên server */
  projectId: { type: String, default: '' },
});
const emit = defineEmits(['back']);

const TRACK_LABEL_WIDTH = 110;
const TRACK_GAP_PX = 8;

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
      border: '1px solid rgba(212,175,55,0.28)',
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

const resolveVideoOrAudioDuration = async (source) =>
  (await getDurationFromBackend(source)) || (await getDurationFromElement(source));

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
  if (selectedClip.value && removed.clips.some((c) => c.id === selectedClip.value?.id)) selectedClip.value = null;
  tracks.value.splice(idx, 1);
  const next = tracks.value[Math.min(idx, tracks.value.length - 1)] || tracks.value[0];
  selectedTrackId.value = next?.id || 'track-1';
  requestAnimationFrame(updateScrollbarThumb);
};

const addTextClip = () => {
  const track = selectedTrack.value;
  const tail = track.clips.length ? Math.max(...track.clips.map((c) => c.startTime + c.duration)) : 0;
  track.clips.push({
    id: generateId(),
    type: 'text',
    text: 'Sample text',
    color: '#ffffff',
    boxColor: '#00000088',
    fontSize: 48,
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
  });
};
const removeResource = (index) => resources.value.splice(index, 1);
const removeClip = (trackId, clipId) => {
  const track = tracks.value.find((t) => t.id === trackId);
  if (!track) return;
  track.clips = track.clips.filter((c) => c.id !== clipId);
  if (selectedClip.value?.id === clipId) selectedClip.value = null;
};

const deleteSelectedClip = () => {
  const clip = selectedClip.value;
  if (!clip) return;
  const track = tracks.value.find((t) => t.clips.some((c) => c.id === clip.id));
  if (!track) return;
  removeClip(track.id, clip.id);
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
  selectedClip.value = clip;
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
  width: `${Math.max(44, clip.duration * pixelsPerSecond.value)}px`
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
    if (!isPlaying.value || el.paused) el.currentTime = target;
    if (isPlaying.value) el.play().catch(() => {});
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
    if (!isPlaying.value || el.paused) el.currentTime = target;
    if (isPlaying.value) el.play().catch(() => {});
  } else {
    previewAudioRef.value?.pause();
  }
};
watch(playhead, () => { syncPreviewToPlayhead(); }, { flush: 'post' });
watch(activeVisualLayers, () => { syncPreviewToPlayhead(); }, { deep: true, flush: 'post' });
watch(activeAudioClip, () => { syncPreviewToPlayhead(); }, { flush: 'post' });

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
};
const onTimelinePointerDown = (e) => {
  setPlayheadFromClientX(e.clientX);
  const move = (evt) => setPlayheadFromClientX(evt.clientX);
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
};
const onTimelineWheel = (e) => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  const step = 6;
  zoom.value = Math.max(TIMELINE_ZOOM_MIN, Math.min(TIMELINE_ZOOM_MAX, zoom.value + (e.deltaY < 0 ? step : -step)));
};
const onClipPointerDown = (_e, clip, trackId) => {
  selectedClip.value = clip;
  selectedTrackId.value = trackId;
  if (clip.type === 'video' || clip.type === 'image') ensureVisualMediaLayoutFields(clip);
};

const onTextOverlayPointerDown = (e, clip) => {
  if (resizingTextId.value || draggingVisualId.value || resizingVisualId.value) return;
  if (!previewFrameRef.value) return;
  selectedClip.value = clip;
  selectedTrackId.value = tracks.value.find((t) => t.clips.some((c) => c.id === clip.id))?.id || selectedTrackId.value;
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
  selectedClip.value = clip;
  selectedTrackId.value = tracks.value.find((t) => t.clips.some((c) => c.id === clip.id))?.id || selectedTrackId.value;
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
  selectedClip.value = clip;
  selectedTrackId.value = tracks.value.find((t) => t.clips.some((c) => c.id === clip.id))?.id || selectedTrackId.value;
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
  selectedClip.value = clip;
  selectedTrackId.value = tracks.value.find((t) => t.clips.some((c) => c.id === clip.id))?.id || selectedTrackId.value;
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
  selectedClip.value = second;
};
const openInspectorForClip = (clip, trackId) => {
  selectedTrackId.value = trackId;
  selectedClip.value = clip;
  ensureTextClipFields(clip);
  ensureVisualMediaLayoutFields(clip);
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
    for (const t of tracks.value) {
      for (const c of t.clips) {
        if (c.type === 'text') ensureTextClipFields(c);
        if (c.type === 'video' || c.type === 'image') ensureVisualMediaLayoutFields(c);
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
  try {
    const res = await projectService.getTimeline(props.projectId);
    if (res?.success && res.data) await applyLoadedTimeline(res.data);
  } catch {
    /* ignore */
  } finally {
    void nextTick(() => {
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
  const result = await window.electronAPI.invoke('dialog:save-video-path', {
    defaultName: `render-${Date.now()}.mp4`
  });
  if (result?.success && result.filePath) {
    renderOutputPath.value = result.filePath;
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
});
onBeforeUnmount(() => {
  clearRenderPoll();
  clearTimeout(timelineSaveTimer);
  timelineSaveTimer = null;
  if (raf) cancelAnimationFrame(raf);
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

    <div class="editor-layout">
      <aside class="resources-panel">
        <div class="panel-title">Resources</div>
        <label class="upload-btn" :class="{ 'upload-btn--busy': resourceUploadBusy }">
          <Loader2 v-if="resourceUploadBusy" :size="14" class="upload-spin" />
          <Plus v-else :size="14" />
          <span>{{ resourceUploadBusy ? 'Đang upload…' : 'Add image/video/audio' }}</span>
          <input
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            :disabled="resourceUploadBusy"
            @change="onAddExternalFiles"
          />
        </label>
        <div class="resource-list">
          <div v-for="(url, idx) in resources" :key="idx" class="resource-item" draggable="true" @dragstart="onDragStartResource($event, idx)">
            <div class="resource-thumb">
              <video v-if="mediaType(url)==='video'" :src="url" muted />
              <div v-else-if="mediaType(url)==='audio'" class="audio-box"><Music2 :size="16" /> Audio</div>
              <img v-else :src="url" />
            </div>
            <div class="resource-main">
              <div class="resource-name" :title="getResourceThumbName(url)">
                {{ getResourceThumbName(url) }}
              </div>
              <div class="resource-type">{{ mediaType(url) }}</div>
            </div>
            <div class="resource-actions">
              <button @click="addClipToTrack(url, selectedTrack.id)"><Play :size="12" /></button>
              <button @click="removeResource(idx)"><Trash2 :size="12" /></button>
            </div>
          </div>
        </div>
      </aside>

      <main class="workspace-top">
        <div class="preview-panel">
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
                        selected: selectedClip?.id === layer.clip.id,
                        'is-dragging': draggingVisualId === layer.clip.id,
                        'is-resizing': resizingVisualId === layer.clip.id
                      }"
                      :style="{ ...getVisualMediaLayoutStyle(layer.clip), zIndex: layer.zIndex }"
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
                  <div v-show="!activeVisualLayers.length" class="preview-empty">No preview clip at this playhead</div>
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
          <aside class="inspector-panel" :class="{ empty: !(inspectorOpen && selectedClip) }">
            <h4>Item Properties</h4>
            <div v-if="inspectorOpen && selectedClip" class="inspector-grid">
              <label>Start</label>
              <input type="number" min="0" step="0.1" v-model.number="selectedClip.startTime" @input="onInspectorChange" />
              <label>Duration</label>
              <input type="number" min="0.2" step="0.1" v-model.number="selectedClip.duration" @input="onInspectorChange" />
              <label>Trim Start</label>
              <input type="number" min="0" step="0.1" v-model.number="selectedClip.trimStart" @input="onInspectorChange" />
              <template v-if="selectedClip.type === 'video' || selectedClip.type === 'image'">
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
            <div v-else class="inspector-empty">Double-click an item to edit</div>
          </aside>
        </div>

      </main>
      <section class="workspace-bottom">
        <div class="timeline-toolbar">
          <div class="timeline-toolbar-side timeline-toolbar-left">
            <label class="zoom-label">Zoom</label>
            <input
              class="zoom-range"
              type="range"
              :min="TIMELINE_ZOOM_MIN"
              :max="TIMELINE_ZOOM_MAX"
              step="1"
              v-model.number="zoom"
            />
            <button
              class="tool-btn ghost small timeline-add-track-btn"
              type="button"
              @click="addTrackAboveSelection"
              title="Thêm track phía trên lane đang chọn"
            >
              <ChevronUp :size="14" />
            </button>
            <button
              class="tool-btn ghost small timeline-add-track-btn"
              type="button"
              @click="addTrackBelowSelection"
              title="Thêm track phía dưới lane đang chọn"
            >
              <ChevronDown :size="14" />
            </button>
            <button class="tool-btn ghost small" type="button" @click="addTextClip">+ Text</button>
            <button
              class="tool-btn ghost small timeline-icon-btn"
              type="button"
              @click="splitAtPlayhead"
              :disabled="!selectedClip"
              title="Tách clip tại playhead"
            >
              <Scissors :size="14" />
            </button>
            <button
              class="tool-btn ghost small timeline-icon-btn"
              type="button"
              @click="deleteSelectedClip"
              :disabled="!selectedClip"
              title="Xóa clip đang chọn"
            >
              <Trash2 :size="14" />
            </button>
            <button
              class="tool-btn ghost small timeline-icon-btn"
              type="button"
              @click="deleteSelectedTrack"
              :disabled="tracks.length <= 1"
              title="Xóa lane đang chọn (mọi clip trong lane)"
            >
              <ListX :size="14" />
            </button>
          </div>
          <div class="timeline-toolbar-center">
            <button class="tool-btn ghost small timeline-play-btn" type="button" @click="togglePreviewPlay" :title="isPlaying ? 'Pause preview' : 'Play preview'">
              <Play v-if="!isPlaying" :size="16" />
              <Pause v-else :size="16" />
            </button>
          </div>
          <div class="timeline-toolbar-side timeline-toolbar-right">
            <span class="time-view">{{ formatTimeHms(playhead) }} / {{ formatTimeHms(timelineDuration) }}</span>
          </div>
        </div>

        <div class="timeline-shell">
          <div class="timeline-view-outer">
            <div class="timeline-view-v">
              <div
                ref="timelineViewportRef"
                class="timeline-view-h"
                @pointerdown="onTimelinePointerDown"
                @wheel="onTimelineWheel"
              >
                <div ref="timelineContentRef" class="timeline-content" :style="{ width: `${timelineInnerWidth}px` }">
                  <div class="time-ruler">
                    <div class="ruler-label-spacer"></div>
                    <div class="ruler-scale" :style="{ width: `${timelineWidth}px` }">
                      <div v-for="sec in timeMarkers" :key="sec" class="tick" :style="{ left: `${(sec / timelineDuration) * 100}%` }">{{ sec.toFixed(0) }}s</div>
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
                        :class="{ selected: selectedClip?.id === clip.id }"
                        :style="getClipStyle(clip)"
                        @pointerdown.stop="onClipPointerDown($event, clip, track.id)"
                        @mousedown.stop="onClipPointerDown($event, clip, track.id)"
                        @click.stop="selectedClip = clip; selectedTrackId = track.id"
                        @dblclick.stop="openInspectorForClip(clip, track.id)"
                        @dragstart="onDragStartClip($event, clip, track.id)"
                      >
                        <Film v-if="clip.type === 'video'" :size="12" />
                        <Music2 v-else-if="clip.type === 'audio'" :size="12" />
                        <ImageIcon v-else :size="12" />
                        <span class="clip-name">{{ clip.type }}</span>
                        <span class="clip-meta">{{ clip.startTime.toFixed(1) }}s | {{ clip.duration.toFixed(1) }}s</span>
                        <button
                          v-if="clip.type === 'video' || clip.type === 'audio'"
                          type="button"
                          class="clip-audio-toggle"
                          @click.stop="toggleClipMuted(clip)"
                          :title="clip.muted ? 'Unmute clip in render / preview' : 'Mute clip in render / preview'"
                        >
                          <VolumeOff v-if="clip.muted" :size="14" />
                          <Volume2 v-else :size="14" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="global-playhead" :style="{ left: `${playheadPx}px` }" />
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
  --is-bg:#0f1014;
  --is-panel:#16181f;
  --is-panel-2:#1c1f28;
  --is-border:rgba(120,132,162,.22);
  --is-border-strong:rgba(134,148,182,.32);
  --is-border-soft:rgba(134,148,182,.16);
  --is-gold:#d4af37;
  --is-gold-deep:#b8922e;
  --is-text:#eae6dc;
  --is-muted:#8a8578;
  height:100%;
  min-height:0;
  display:flex;
  flex-direction:column;
  background:var(--is-bg);
  color:var(--is-text);
}
.toolbar{
  height:56px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:0 .85rem;
  border-bottom:1px solid var(--is-border-soft);
  background:var(--is-panel);
}
.toolbar-left,.toolbar-right{display:flex;gap:.5rem;align-items:center}
.tool-btn{
  height:34px;
  border:1px solid var(--is-border);
  background:var(--is-panel-2);
  color:var(--is-text);
  border-radius:.5rem;
  padding:0 .7rem;
  display:flex;
  gap:.4rem;
  align-items:center;
  cursor:pointer;
  font-size:.78rem;
  font-weight:600;
    justify-content: center;
}
.tool-btn:disabled{opacity:.55;cursor:not-allowed}
.tool-btn.ghost{background:var(--is-panel)}
.tool-btn.small{height:30px;font-size:.72rem}
.tool-btn.primary{
  background:linear-gradient(180deg,var(--is-gold) 0%,var(--is-gold-deep) 100%);
  color:#14120a;
  border-color:var(--is-gold);
  box-shadow:0 1px 0 rgba(255,255,255,.12) inset;
}
.select{
  height:34px;
  background:var(--is-panel-2);
  border:1px solid var(--is-border);
  border-radius:.5rem;
  color:var(--is-text);
  padding:0 .55rem;
}
.editor-layout{display:grid;grid-template-columns:300px 1fr;grid-template-rows:minmax(160px,1fr) auto;gap:.75rem;flex:1;padding:.75rem;min-height:0;overflow:hidden}
.resources-panel,.workspace-top,.workspace-bottom{
  background:var(--is-panel);
  border:1px solid var(--is-border-soft);
  border-radius:.65rem;
  min-height:0;
}
.resources-panel{padding:.7rem;display:flex;flex-direction:column;overflow:hidden}
.resources-panel{grid-column:1;grid-row:1}
.panel-title{font-size:.72rem;font-weight:800;color:var(--is-muted);text-transform:uppercase;margin-bottom:.45rem}
.upload-btn{
  display:flex;
  align-items:center;
  gap:.4rem;
  border:1px dashed var(--is-border);
  border-radius:.5rem;
  padding:.45rem .55rem;
  font-size:.75rem;
  color:var(--is-text);
  cursor:pointer;
  transition:opacity .2s,border-color .2s ease,background-color .2s ease;
}
.upload-btn:hover{border-color:var(--is-border-strong);background:rgba(255,255,255,.02)}
.upload-btn--busy{opacity:.75;cursor:wait}
.upload-btn input{display:none}
.upload-spin{animation:upload-spin .75s linear infinite;color:var(--is-gold,#eab308)}
@keyframes upload-spin{to{transform:rotate(360deg)}}
.resource-list{
  margin-top:.55rem;
  display:flex;
  flex-direction:column;
  gap:.45rem;
  overflow:auto;
  min-height:0;
}
.resource-list{-ms-overflow-style:none;scrollbar-width:none}
.resource-list::-webkit-scrollbar{display:none}
.resource-item{
  border:1px solid var(--is-border-soft);
  border-radius:.5rem;
  background:var(--is-bg);
  display:flex;
  align-items:center;
  gap:.55rem;
  padding:.38rem;
}
.resource-thumb{
  width:84px;
  min-width:84px;
  height:64px;
  border-radius:.42rem;
  overflow:hidden;
  border:1px solid var(--is-border-soft);
  background:rgba(255,255,255,.02);
}
.resource-thumb img,.resource-thumb video{width:100%;height:100%;object-fit:cover;display:block}
.audio-box{height:100%;display:flex;gap:.4rem;align-items:center;justify-content:center;color:#f5ecd0;font-weight:700}
.resource-main{min-width:0;flex:1;display:flex;flex-direction:column;gap:.15rem}
.resource-name{
  font-size:.78rem;
  font-weight:700;
  color:var(--is-text);
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.resource-type{
  font-size:.67rem;
  text-transform:uppercase;
  color:var(--is-muted);
  letter-spacing:.04em;
}
.resource-actions{display:flex;gap:.25rem}
.resource-actions button{border:1px solid var(--is-border);background:var(--is-panel-2);color:var(--is-text);border-radius:.35rem;cursor:pointer;padding:.2rem .3rem}
.clip-audio-toggle{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;border:1px solid var(--is-border);background:var(--is-panel-2);color:var(--is-text);border-radius:.32rem;cursor:pointer;padding:0}
.workspace-top{
  grid-column:2;
  grid-row:1;
  padding:.7rem;
  display:flex;
  flex-direction:column;
  min-height:0;
  height:100%;
  max-height:100%;
  overflow:hidden;
}
.workspace-bottom{
  grid-column:1 / -1;
  grid-row:2;
  padding:.7rem;
  display:grid;
  grid-template-rows:50px 300px;
  gap:.55rem;
}
.preview-panel{
  flex:1;
  min-height:0;
  min-width:0;
  border:1px solid var(--is-border-soft);
  border-radius:.6rem;
  background:var(--is-bg);
  display:grid;
  grid-template-columns:minmax(0,1fr) 300px;
  gap:12px;
  align-items:stretch;
  justify-content:stretch;
  overflow:hidden;
  padding:8px;
}
.preview-stage{
  min-width:0;
  min-height:0;
  overflow:hidden;
  height:100%;
  max-height:100%;
}
.preview-aspect-host{
  width:100%;
  height:100%;
  min-width:0;
  min-height:0;
  box-sizing:border-box;
  padding:6px;
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
  border:1px solid rgba(212,175,55,.55);
  border-radius:.5rem;
  background:#0a0c12;
  overflow:hidden;
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.35);
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
  background:#0e1119;
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
  box-shadow:0 0 0 1px rgba(212,175,55,.45);
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
  width:12px;
  height:12px;
  border-radius:2px;
  background:#ffd66d;
  border:1px solid #111318;
  cursor:nwse-resize;
  pointer-events:auto;
  z-index:2;
}
.inspector-panel{
  box-sizing:border-box;
  width:300px;
  min-width:300px;
  max-width:300px;
  display:flex;
  flex-direction:column;
  min-height:0;
  overflow:auto;
  padding:1rem 1rem 1.15rem;
  border-radius:.65rem;
  background:linear-gradient(165deg,#1b1f2a 0%,#141822 42%,#10141c 100%);
  border:1px solid var(--is-border-soft);
  box-shadow:
    0 10px 32px rgba(0,0,0,.42),
    inset 0 1px 0 rgba(255,255,255,.05);
  scrollbar-width:thin;
  scrollbar-color:rgba(212,175,55,.35) rgba(0,0,0,.15);
}
.inspector-panel::-webkit-scrollbar{width:6px}
.inspector-panel::-webkit-scrollbar-track{background:rgba(0,0,0,.2);border-radius:999px}
.inspector-panel::-webkit-scrollbar-thumb{background:rgba(212,175,55,.35);border-radius:999px}
.inspector-panel::-webkit-scrollbar-thumb:hover{background:rgba(212,175,55,.5)}
.inspector-panel h4{
  flex-shrink:0;
  margin:0 0 .85rem;
  padding-bottom:.55rem;
  font-size:.74rem;
  font-weight:800;
  letter-spacing:.1em;
  text-transform:uppercase;
  color:var(--is-gold);
  border-bottom:1px solid var(--is-border-soft);
  text-shadow:0 1px 0 rgba(0,0,0,.35);
}
.inspector-panel.empty{opacity:.78}
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
  height:34px;
  box-sizing:border-box;
  width:100%;
  background:rgba(14,17,25,.9);
  border:1px solid var(--is-border);
  border-radius:.5rem;
  color:var(--is-text);
  padding:0 .55rem;
  font-size:.8rem;
  transition:border-color .15s ease,box-shadow .15s ease;
}
.inspector-grid input:hover,.inspector-grid select:hover{
  border-color:rgba(212,175,55,.28);
}
.inspector-grid input:focus-visible,.inspector-grid select:focus-visible{
  outline:none;
  border-color:rgba(212,175,55,.45);
  box-shadow:0 0 0 2px rgba(212,175,55,.12);
}
.inspector-box{
  border:1px solid var(--is-border-soft);
  border-radius:.55rem;
  padding:.65rem .75rem .75rem;
  margin-bottom:.35rem;
  background:rgba(8,10,16,.5);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.04);
}
.inspector-box-title{
  font-size:.64rem;
  font-weight:800;
  color:rgba(214,196,148,.9);
  text-transform:uppercase;
  letter-spacing:.08em;
  margin:0 0 .5rem;
  padding-bottom:.4rem;
  border-bottom:1px solid var(--is-border-soft);
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
  min-height:80px;
  resize:vertical;
  padding:.5rem .55rem;
  border-radius:.5rem;
  border:1px solid var(--is-border);
  background:rgba(14,17,25,.9);
  color:var(--is-text);
  font-size:.8rem;
  line-height:1.4;
  font-family:inherit;
  transition:border-color .15s ease,box-shadow .15s ease;
}
.inspector-textarea:hover{border-color:rgba(212,175,55,.28)}
.inspector-textarea:focus-visible{
  outline:none;
  border-color:rgba(212,175,55,.45);
  box-shadow:0 0 0 2px rgba(212,175,55,.12);
}
.inspector-select,.inspector-input{
  width:100%;
  box-sizing:border-box;
  height:34px;
  border-radius:.5rem;
  border:1px solid var(--is-border);
  background:rgba(14,17,25,.9);
  color:var(--is-text);
  padding:0 .55rem;
  font-size:.8rem;
  transition:border-color .15s ease,box-shadow .15s ease;
}
.inspector-select:hover,.inspector-input:hover{border-color:rgba(212,175,55,.28)}
.inspector-select:focus-visible,.inspector-input:focus-visible{
  outline:none;
  border-color:rgba(212,175,55,.45);
  box-shadow:0 0 0 2px rgba(212,175,55,.12);
}
.inspector-select{cursor:pointer;appearance:auto}
.inspector-color-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-bottom:.15rem}
.inspector-swatch{
  width:22px;
  height:22px;
  border-radius:5px;
  border:1px solid var(--is-border);
  cursor:pointer;
  padding:0;
  flex-shrink:0;
}
.inspector-swatch.active{outline:2px solid var(--is-gold);outline-offset:1px}
.inspector-color-native{width:34px;height:34px;padding:0;border:none;border-radius:6px;cursor:pointer;background:transparent}
.inspector-input--hex{flex:1;min-width:0;max-width:160px;height:34px}
.inspector-input--readonly{
  cursor:default;
  opacity:.92;
  color:rgba(226,228,236,.88);
  background:rgba(10,12,18,.65);
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
  color:#bda56c;
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
  width:11px;
  height:11px;
  border-radius:50%;
  background:#ffd66d;
  border:1px solid #111318;
  cursor:ew-resize;
}
.timeline-toolbar{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:.5rem;height:50px;min-height:50px;max-height:50px}
.timeline-toolbar-side{display:flex;align-items:center;gap:.5rem;min-width:0}
.timeline-toolbar-left{justify-self:start;flex-wrap:wrap;row-gap:.35rem}
.timeline-add-track-btn{min-width:34px;padding:0 .4rem}
.timeline-toolbar-center{display:flex;align-items:center;justify-content:center;gap:.45rem;justify-self:center}
.timeline-toolbar-right{justify-self:end}
.timeline-icon-btn,.timeline-play-btn{min-width:38px;padding:0 .55rem;justify-content:center}
.timeline-play-btn{min-width:42px}
.inspector-audio-btn{justify-content:center;width:100%;margin-top:.15rem}
.zoom-range{width:180px}
.zoom-label,.time-view{font-size:.76rem;color:var(--is-muted)}
.timeline-shell{display:grid;grid-template-rows:280px 14px;gap:6px;height:300px;min-height:300px;max-height:300px}
/* Tách cuộn dọc / ngang: chỉ một thanh ngang (custom bên dưới), tránh 2 scrollbar chồng nhau */
.timeline-view-outer{
  position:relative;
  overflow:hidden;
  height:280px;
  min-height:280px;
  max-height:280px;
  border:1px solid var(--is-border-soft);
  border-radius:.6rem;
  background:var(--is-bg);
  display:flex;
  flex-direction:column;
}
.timeline-view-v{
  flex:1;
  min-height:0;
  overflow-x:hidden;
  overflow-y:auto;
  scrollbar-width:thin;
  scrollbar-color:#4a5370 #0e1119;
}
.timeline-view-v::-webkit-scrollbar{width:8px}
.timeline-view-v::-webkit-scrollbar-thumb{background:#4a5370;border-radius:4px}
.timeline-view-h{
  position:relative;
  width:100%;
  overflow-x:auto;
  overflow-y:visible;
  -ms-overflow-style:none;
  scrollbar-width:none;
}
.timeline-view-h::-webkit-scrollbar{display:none}
.timeline-content{position:relative;min-height:100%}
.timeline-scrollbar{position:relative;height:14px;background:#1a2030;border:1px solid var(--is-border-soft);border-radius:999px}
.timeline-scrollbar-thumb{position:absolute;left:0;top:1px;height:10px;background:#4a5370;border-radius:999px;cursor:ew-resize}
.time-ruler{height:28px;position:relative;border-bottom:1px solid var(--is-border-soft);display:flex;align-items:stretch;gap:8px}
.ruler-label-spacer{width:110px;min-width:110px}
.ruler-scale{position:relative}
.tick{position:absolute;top:4px;transform:translateX(-50%);font-size:.64rem;color:#cbb57f}
.track-row{display:grid;grid-template-columns:110px 1fr;gap:.45rem;align-items:start;min-height:50px;margin-top:.28rem;transition:opacity .18s ease,filter .18s ease}
.track-row--hidden{opacity:.42;filter:saturate(.65)}
.track-label{
  height:43px;
  border:1px solid var(--is-border);
  border-radius:.45rem;
  background:var(--is-panel-2);
  color:var(--is-gold);
  display:flex;
  align-items:center;
  justify-content:center;
  gap:.2rem;
  padding:0 .2rem;
  font-weight:800;
  font-size:.68rem;
  cursor:pointer;
  user-select:none;
  transition:outline .12s ease,box-shadow .12s ease;
}
.track-visibility-btn{
  flex-shrink:0;
  display:flex;
  align-items:center;
  justify-content:center;
  width:26px;
  height:26px;
  padding:0;
  border:none;
  border-radius:.32rem;
  background:transparent;
  color:inherit;
  cursor:pointer;
  opacity:.88;
}
.track-visibility-btn:hover{opacity:1;background:rgba(212,175,55,.12)}
.track-label-text{flex:1;min-width:0;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.track-label--active{
  outline:2px solid var(--is-gold);
  box-shadow:0 0 0 1px rgba(212,175,55,.22) inset;
}
.track-lane{position:relative;min-height:43px;border:1px solid var(--is-border-soft);border-radius:.45rem;background:#0e1119}
.timeline-clip{position:absolute;top:4px;height:35px;border:1px solid var(--is-border);border-radius:.36rem;background:var(--is-panel-2);color:var(--is-text);display:grid;grid-template-columns:auto auto 1fr auto;align-items:center;gap:.28rem;padding:.2rem .32rem}
.timeline-clip.selected{outline:2px solid var(--is-gold)}
.clip-name{text-transform:uppercase;font-size:.62rem;font-weight:800}
.clip-meta{font-size:.62rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.global-playhead{position:absolute;top:0;bottom:0;width:2px;background:var(--is-gold);z-index:30;pointer-events:none}
.global-playhead::before{content:'';position:absolute;top:-1px;left:-5px;width:12px;height:12px;background:var(--is-gold);clip-path:polygon(50% 100%,0 0,100% 0)}
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
  background:linear-gradient(165deg,var(--is-panel) 0%,#12151c 100%);
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
  color:#14120a;
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
  color:#14120a;
  border-color:var(--is-gold);
  box-shadow:0 1px 0 rgba(255,255,255,.15) inset;
}
.render-modal-btn.secondary{
  background:var(--is-panel-2);
  border-color:var(--is-border-strong);
  color:var(--is-text);
}
.render-modal-btn.secondary:hover{background:#232731}
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
  box-shadow:0 0 12px rgba(212,175,55,.35);
  transition:width .25s ease;
}
.render-progress-pct{margin-top:.55rem;text-align:center;font-weight:800;font-size:1.35rem;color:var(--is-gold);letter-spacing:.04em}
.render-modal-spin{display:block;animation:render-spin 1s linear infinite}
@keyframes render-spin{to{transform:rotate(360deg)}}
.render-modal-icon-success{color:#6bc98a;margin:0 auto .35rem;display:block}
.render-modal-icon-error{color:#e07878;margin:0 auto .35rem;display:block}
.render-modal-error-msg{color:#c9a89a;word-break:break-word}
</style>

