const clampText = (v, max) => String(v || '').trim().slice(0, max);

const SENSITIVE_IMAGE_WORDS = [
  /\bsexy\b/gi,
  /\berotic\b/gi,
  /\bnude\b/gi,
  /\bnudity\b/gi,
  /\blingerie\b/gi,
  /\bunderwear\b/gi,
  /\bsexual\b/gi,
  /\bnsfw\b/gi,
  /\bkhoe[\s-]*than\b/gi,
  /\bgoi[\s-]*cam\b/gi,
  /\bkhieu[\s-]*dam\b/gi,
];

const SENSITIVE_VIDEO_WORDS = [
  ...SENSITIVE_IMAGE_WORDS,
];

const RISKY_VIDEO_PHRASE_REWRITES = [
  { pattern: /\bcharming\s+wink\b/gi, replacement: 'friendly smile' },
  { pattern: /\bwink\b/gi, replacement: 'smile' },
  { pattern: /\bsilk\s+pajamas?\b/gi, replacement: 'modest casual outfit' },
  { pattern: /\bpajamas?\b/gi, replacement: 'casual outfit' },
  { pattern: /\bseductive\b/gi, replacement: 'confident' },
  { pattern: /\bsensual\b/gi, replacement: 'natural' },
  { pattern: /\bbedroom\b/gi, replacement: 'bright indoor studio' },
];

export function isPolicyBlockedError(error) {
  const m = String(error?.message || error || '').toUpperCase();
  return m.includes('PUBLIC_ERROR_SEXUAL') || m.includes('NCII') || m.includes('MEDIA_GENERATION_STATUS_FAILED');
}

export function sanitizeImagePromptForSafety(prompt) {
  let text = String(prompt || '').trim();
  if (!text) return '';
  SENSITIVE_IMAGE_WORDS.forEach((pattern) => {
    text = text.replace(pattern, '');
  });
  text = text.replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.').replace(/\.{2,}/g, '.').trim();
  return clampText(text, 320);
}

export function sanitizeVideoPromptForSafety(prompt) {
  let text = String(prompt || '').trim();
  if (!text) return '';
  SENSITIVE_VIDEO_WORDS.forEach((pattern) => {
    text = text.replace(pattern, '');
  });
  RISKY_VIDEO_PHRASE_REWRITES.forEach(({ pattern, replacement }) => {
    text = text.replace(pattern, replacement);
  });
  const isHumanFocused = /\b(woman|girl|lady|female|model|person|man|boy|male)\b/i.test(text);
  if (isHumanFocused) {
    text = text
      .replace(/\b(flowing\s+softly)\b/gi, 'moving naturally')
      .replace(/\b(very\s+close[-\s]?up\s+body)\b/gi, 'medium shot');
  }
  text = text.replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.').replace(/\.{2,}/g, '.').trim();
  return clampText(text, 320);
}
