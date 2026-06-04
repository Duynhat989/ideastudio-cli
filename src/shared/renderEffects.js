const OUTPUT_FPS = 30;
const FRAME_DUR = 1 / OUTPUT_FPS;

const FADE_EFFECT_TYPES = [
    { id: 'none', label: 'Không', defaultDuration: 0 },
    { id: 'linear', label: 'Linear', defaultDuration: 0.5 },
    { id: 'smooth', label: 'Mượt', defaultDuration: 0.8 },
    { id: 'slow', label: 'Chậm', defaultDuration: 1.2 },
    { id: 'fast', label: 'Nhanh', defaultDuration: 0.3 }
];

const TRANSITION_EFFECT_TYPES = [
    { id: 'none', label: 'Không', defaultDuration: 0 },
    { id: 'fade', label: 'Crossfade', defaultDuration: 0.5 },
    { id: 'dissolve', label: 'Dissolve', defaultDuration: 0.6 },
    { id: 'fadeblack', label: 'Fade qua đen', defaultDuration: 0.5 },
    { id: 'fadewhite', label: 'Fade qua trắng', defaultDuration: 0.5 },
    { id: 'wipeleft', label: 'Wipe trái', defaultDuration: 0.5 },
    { id: 'wiperight', label: 'Wipe phải', defaultDuration: 0.5 },
    { id: 'wipeup', label: 'Wipe lên', defaultDuration: 0.5 },
    { id: 'wipedown', label: 'Wipe xuống', defaultDuration: 0.5 },
    { id: 'slideleft', label: 'Trượt trái', defaultDuration: 0.5 },
    { id: 'slideright', label: 'Trượt phải', defaultDuration: 0.5 },
    { id: 'smoothleft', label: 'Smooth trái', defaultDuration: 0.6 },
    { id: 'smoothright', label: 'Smooth phải', defaultDuration: 0.6 },
    { id: 'smoothup', label: 'Smooth lên', defaultDuration: 0.6 },
    { id: 'smoothdown', label: 'Smooth xuống', defaultDuration: 0.6 },
    { id: 'circleopen', label: 'Vòng tròn mở', defaultDuration: 0.6 },
    { id: 'circleclose', label: 'Vòng tròn đóng', defaultDuration: 0.6 },
    { id: 'radial', label: 'Radial', defaultDuration: 0.6 },
    { id: 'distance', label: 'Distance', defaultDuration: 0.6 },
    { id: 'pixelize', label: 'Pixelize', defaultDuration: 0.5 },
    { id: 'hblur', label: 'Blur ngang', defaultDuration: 0.5 },
    { id: 'squeezeh', label: 'Squeeze ngang', defaultDuration: 0.5 },
    { id: 'squeezev', label: 'Squeeze dọc', defaultDuration: 0.5 }
];

/** dissolve → ffmpeg xfade fade */
const XFADE_TRANSITION_MAP = {
    dissolve: 'fade'
};

const normalizeEffectType = (raw) => {
    const s = String(raw || 'none').trim().toLowerCase();
    return s || 'none';
};

const resolveFadeDuration = (type, explicitDuration, clipDuration, fallback = 0.5) => {
    if (normalizeEffectType(type) === 'none') return 0;
    const preset = FADE_EFFECT_TYPES.find((e) => e.id === normalizeEffectType(type));
    const base = Number(explicitDuration);
    const d = Number.isFinite(base) && base > 0 ? base : (preset?.defaultDuration || fallback);
    const maxD = Math.max(FRAME_DUR, Number(clipDuration || 0) / 2);
    return Math.max(FRAME_DUR, Math.min(maxD, d));
};

const resolveTransitionDuration = (type, explicitDuration, prevDuration, nextDuration) => {
    if (normalizeEffectType(type) === 'none') return 0;
    const preset = TRANSITION_EFFECT_TYPES.find((e) => e.id === normalizeEffectType(type));
    const base = Number(explicitDuration);
    const d = Number.isFinite(base) && base > 0 ? base : (preset?.defaultDuration || 0.5);
    const maxD = Math.max(FRAME_DUR, Math.min(Number(prevDuration || 0) / 2, Number(nextDuration || 0) / 2));
    return Math.max(FRAME_DUR, Math.min(maxD, d));
};

const mapXfadeTransition = (type) => {
    const t = normalizeEffectType(type);
    if (t === 'none') return 'fade';
    return XFADE_TRANSITION_MAP[t] || t;
};

const buildFadeInFilter = (clip, clipDuration) => {
    const type = normalizeEffectType(clip?.fadeInType);
    if (type === 'none') return '';
    const d = resolveFadeDuration(type, clip?.fadeInDuration, clipDuration);
    if (d <= 0) return '';
    return `fade=t=in:st=0:d=${d}:alpha=1`;
};

const buildFadeOutFilter = (clip, clipDuration) => {
    const type = normalizeEffectType(clip?.fadeOutType);
    if (type === 'none') return '';
    const d = resolveFadeDuration(type, clip?.fadeOutDuration, clipDuration);
    if (d <= 0) return '';
    const st = Math.max(0, Number(clipDuration || 0) - d);
    return `fade=t=out:st=${st}:d=${d}:alpha=1`;
};

const buildFadeFilters = (clip, clipDuration) => {
    const parts = [];
    const fin = buildFadeInFilter(clip, clipDuration);
    const fout = buildFadeOutFilter(clip, clipDuration);
    if (fin) parts.push(fin);
    if (fout) parts.push(fout);
    return parts;
};

const computePreviewOpacity = (clip, relTime, clipDuration) => {
    let opacity = 1;
    const rel = Math.max(0, Number(relTime || 0));
    const dur = Math.max(FRAME_DUR, Number(clipDuration || 0));

    const fadeInD = resolveFadeDuration(clip?.fadeInType, clip?.fadeInDuration, dur);
    if (fadeInD > 0 && rel < fadeInD) {
        opacity *= rel / fadeInD;
    }

    const fadeOutD = resolveFadeDuration(clip?.fadeOutType, clip?.fadeOutDuration, dur);
    if (fadeOutD > 0 && rel > dur - fadeOutD) {
        opacity *= Math.max(0, dur - rel) / fadeOutD;
    }

    return Math.max(0, Math.min(1, opacity));
};

const defaultClipEffects = () => ({
    fadeInType: 'none',
    fadeInDuration: 0.5,
    fadeOutType: 'none',
    fadeOutDuration: 0.5,
    transitionType: 'none',
    transitionDuration: 0.5
});

const ensureClipEffects = (clip) => {
    if (!clip || typeof clip !== 'object') return;
    const d = defaultClipEffects();
    if (clip.fadeInType == null) clip.fadeInType = d.fadeInType;
    if (clip.fadeOutType == null) clip.fadeOutType = d.fadeOutType;
    if (clip.transitionType == null) clip.transitionType = d.transitionType;
    if (clip.fadeInDuration == null || Number.isNaN(Number(clip.fadeInDuration))) clip.fadeInDuration = d.fadeInDuration;
    if (clip.fadeOutDuration == null || Number.isNaN(Number(clip.fadeOutDuration))) clip.fadeOutDuration = d.fadeOutDuration;
    if (clip.transitionDuration == null || Number.isNaN(Number(clip.transitionDuration))) clip.transitionDuration = d.transitionDuration;
};

module.exports = {
    OUTPUT_FPS,
    FRAME_DUR,
    FADE_EFFECT_TYPES,
    TRANSITION_EFFECT_TYPES,
    normalizeEffectType,
    resolveFadeDuration,
    resolveTransitionDuration,
    mapXfadeTransition,
    buildFadeInFilter,
    buildFadeOutFilter,
    buildFadeFilters,
    computePreviewOpacity,
    defaultClipEffects,
    ensureClipEffects
};
