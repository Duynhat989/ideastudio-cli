/**
 * Heuristic for flow graph media URLs (persisted assets, blob:, data:, remote).
 * Used for <video> vs <img> previews and Kling motion payload routing.
 */
export function isLikelyFlowVideoUrl(s) {
  if (!s || typeof s !== 'string') return false;
  const t = s.trim().toLowerCase();
  if (t.startsWith('data:video/')) return true;
  if (t.startsWith('blob:')) return true;
  if (/\.(mp4|webm|mov|m4v|avi|mkv|ogv|m3u8)(\?|#|$)/i.test(t)) return true;
  if (/-video-\d+/i.test(s)) return true;
  if (/\/videos?\//i.test(t)) return true;
  if (t.includes('type=video')) return true;
  return false;
}

export function isLikelyFlowImageUrl(s) {
  if (!s || typeof s !== 'string') return false;
  const t = s.trim().toLowerCase();
  if (t.startsWith('data:image/')) return true;
  if (/\.(png|jpe?g|webp|gif|bmp|svg)(\?|#|$)/i.test(t)) return true;
  if (/-image-\d+/i.test(s)) return true;
  return false;
}

/** True when preview should use <video> (not <img>). */
export function shouldUseVideoPreview(s) {
  if (!s || typeof s !== 'string') return false;
  const v = isLikelyFlowVideoUrl(s);
  const i = isLikelyFlowImageUrl(s);
  if (v && !i) return true;
  if (!v && i) return false;
  if (v && i) {
    const low = s.toLowerCase();
    if (low.startsWith('data:')) return low.startsWith('data:video/');
    if (/-video-/i.test(s) && !/-image-/i.test(s)) return true;
    if (/-image-/i.test(s) && !/-video-/i.test(s)) return false;
    return true;
  }
  return false;
}
