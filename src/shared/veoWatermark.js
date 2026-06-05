/**
 * Che logo Veo 3 góc dưới phải: pixelate (phá chữ) → blur → nén vùng sáng → feather rộng.
 * Không dùng eq desaturate (tránh vệt xám lệch màu nền).
 */
const snapEven = (n, min = 2) => {
    const v = Math.max(min, Math.floor(Number(n) || 0));
    return Math.floor(v / 2) * 2;
};

const VEO_BLUR_PRESET = {
    peakAlpha: 255,
    blurStrength: 18,
    blurPower: 3,
    pixelDivisor: 12,
    highlightThreshold: 168,
    highlightMul: 0.52,
    highlightAdd: 48,
    padXRatio: 0.1,
    padYRatio: 0.16,
    /** Feather cạnh trái/trên — ~35% để hòa nền, không làm yếu góc logo. */
    featherXRatio: 0.35,
    featherYRatio: 0.38
};

const computeVeoWatermarkArea = (width, height) => {
    const W = Math.max(2, Math.floor(Number(width) || 1920));
    const H = Math.max(2, Math.floor(Number(height) || 1080));
    const w = snapEven(W * 0.15);
    const h = snapEven(H * 0.065);
    let x = snapEven(W * 0.862);
    let y = snapEven(H * 0.952);
    x = Math.min(x, W - w);
    y = Math.min(y, H - h);
    return {
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: snapEven(Math.min(w, W - x)),
        height: snapEven(Math.min(h, H - y))
    };
};

const computeVeoBlurCrop = (width, height, preset = VEO_BLUR_PRESET) => {
    const W = Math.max(2, Math.floor(Number(width) || 1920));
    const H = Math.max(2, Math.floor(Number(height) || 1080));
    const core = computeVeoWatermarkArea(W, H);
    const padX = snapEven(core.width * preset.padXRatio, 4);
    const padY = snapEven(core.height * preset.padYRatio, 4);
    const x = Math.max(0, core.x - padX);
    const y = Math.max(0, core.y - padY);
    const cw = snapEven(Math.min(W - x, core.width + padX * 2));
    const ch = snapEven(Math.min(H - y, core.height + padY * 2));
    const featherX = Math.max(12, Math.floor(cw * preset.featherXRatio));
    const featherY = Math.max(12, Math.floor(ch * preset.featherYRatio));
    return { x, y, width: cw, height: ch, featherX, featherY };
};

/**
 * Feather chỉ cạnh trái + trên — góc dưới-phải (chỗ logo) giữ opacity tối đa.
 */
const buildFeatherAlphaExpr = (cw, ch, fx, fy, peakAlpha = VEO_BLUR_PRESET.peakAlpha) => {
    const p = Math.max(220, Math.min(255, Math.round(Number(peakAlpha) || 255)));
    return `min(if(lt(X,${fx}),${p}*X/${fx},${p}),if(lt(Y,${fy}),${p}*Y/${fy},${p}))`;
};

const buildHighlightCrushExpr = (preset = VEO_BLUR_PRESET) => {
    const t = Math.round(preset.highlightThreshold);
    const m = Number(preset.highlightMul);
    const a = Math.round(preset.highlightAdd);
    return `if(gt(lum(X,Y),${t}),lum(X,Y)*${m}+${a},p(X,Y))`;
};

const buildPixelateChain = (cw, ch, preset = VEO_BLUR_PRESET) => {
    const div = Math.max(6, Math.round(preset.pixelDivisor));
    const sw = Math.max(2, Math.floor(cw / div));
    const sh = Math.max(2, Math.floor(ch / div));
    return `scale=${sw}:${sh}:flags=neighbor,scale=${cw}:${ch}:flags=bilinear`;
};

const buildVeoBlurFilterPart = (width, height, tag = 'veo', blurStrength = VEO_BLUR_PRESET.blurStrength) => {
    const preset = VEO_BLUR_PRESET;
    const { x, y, width: cw, height: ch, featherX, featherY } = computeVeoBlurCrop(width, height, preset);
    const lumaR = Math.min(18, Math.max(14, Math.round(Number(blurStrength) || preset.blurStrength)));
    const chromaR = Math.min(9, Math.max(5, Math.floor(lumaR / 2)));
    const lumaR2 = Math.min(18, Math.max(10, lumaR - 4));
    const chromaR2 = Math.min(9, Math.max(4, chromaR - 2));
    const alphaExpr = buildFeatherAlphaExpr(cw, ch, featherX, featherY, preset.peakAlpha);
    const lumCrush = buildHighlightCrushExpr(preset);
    const t = String(tag).replace(/[^a-zA-Z0-9_]/g, '') || 'veo';
    const patchChain = [
        `crop=${cw}:${ch}:${x}:${y}`,
        buildPixelateChain(cw, ch, preset),
        `boxblur=${lumaR}:${preset.blurPower}:${chromaR}:${preset.blurPower}`,
        `boxblur=${lumaR2}:2:${chromaR2}:2`,
        `geq=lum='${lumCrush}':cb='p(X,Y)':cr='p(X,Y)'`,
        'format=yuva420p',
        `geq=lum='p(X,Y)':cb='p(X,Y)':cr='p(X,Y)':a='${alphaExpr}'`
    ].join(',');
    return [
        `split=2[v${t}a][v${t}b]`,
        `[v${t}b]${patchChain}[v${t}bl]`,
        `[v${t}a][v${t}bl]overlay=${x}:${y}:format=auto`
    ].join(';');
};

module.exports = {
    VEO_BLUR_PRESET,
    computeVeoWatermarkArea,
    computeVeoBlurCrop,
    buildVeoBlurFilterPart
};
