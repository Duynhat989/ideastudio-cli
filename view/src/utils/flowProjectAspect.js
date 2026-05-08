/**
 * Giá trị `aspect-ratio` CSS (chuỗi cho style binding) theo cấu hình project Flow.
 * @param {Record<string, unknown> | null | undefined} project
 * @returns {string} ví dụ "16 / 9", "9 / 16", "1 / 1"
 */
export function cssAspectRatioFromProject(project) {
  if (!project || typeof project !== 'object') return '16 / 9';

  const preset = String(project.aspectPreset || '').toLowerCase();
  if (preset === 'portrait') return '9 / 16';
  if (preset === 'landscape') return '16 / 9';
  if (preset === 'square') return '1 / 1';

  const img = project.imageAspectRatio;
  if (img === 'IMAGE_ASPECT_RATIO_PORTRAIT') return '9 / 16';
  if (img === 'IMAGE_ASPECT_RATIO_LANDSCAPE') return '16 / 9';
  if (img === 'IMAGE_ASPECT_RATIO_SQUARE') return '1 / 1';

  const vid = project.videoAspectRatio;
  if (vid === 'VIDEO_ASPECT_RATIO_PORTRAIT') return '9 / 16';
  if (vid === 'VIDEO_ASPECT_RATIO_LANDSCAPE') return '16 / 9';
  if (vid === 'VIDEO_ASPECT_RATIO_SQUARE') return '1 / 1';

  return '16 / 9';
}
