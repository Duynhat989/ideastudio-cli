/** Video dialogue languages — `value` stored in project settings */
export const STORYBOARD_LANGUAGE_OPTIONS = [
    { value: 'VI', labelKey: 'storyboard.langVi', promptLabel: 'Tiếng Việt' },
    { value: 'EN', labelKey: 'storyboard.langEn', promptLabel: 'English' },
    { value: 'ZH', labelKey: 'storyboard.langZh', promptLabel: '中文 (Mandarin Chinese)' },
    { value: 'JA', labelKey: 'storyboard.langJa', promptLabel: '日本語 (Japanese)' },
    { value: 'KO', labelKey: 'storyboard.langKo', promptLabel: '한국어 (Korean)' },
    { value: 'TH', labelKey: 'storyboard.langTh', promptLabel: 'ภาษาไทย (Thai)' },
    { value: 'ID', labelKey: 'storyboard.langId', promptLabel: 'Bahasa Indonesia' },
    { value: 'MS', labelKey: 'storyboard.langMs', promptLabel: 'Bahasa Melayu (Malay)' },
    { value: 'ES', labelKey: 'storyboard.langEs', promptLabel: 'Español (Spanish)' },
    { value: 'PT', labelKey: 'storyboard.langPt', promptLabel: 'Português (Portuguese)' },
    { value: 'FR', labelKey: 'storyboard.langFr', promptLabel: 'Français (French)' },
    { value: 'DE', labelKey: 'storyboard.langDe', promptLabel: 'Deutsch (German)' },
    { value: 'IT', labelKey: 'storyboard.langIt', promptLabel: 'Italiano (Italian)' },
    { value: 'RU', labelKey: 'storyboard.langRu', promptLabel: 'Русский (Russian)' },
    { value: 'AR', labelKey: 'storyboard.langAr', promptLabel: 'العربية (Arabic)' },
    { value: 'HI', labelKey: 'storyboard.langHi', promptLabel: 'हिन्दी (Hindi)' },
    { value: 'TR', labelKey: 'storyboard.langTr', promptLabel: 'Türkçe (Turkish)' },
    { value: 'PL', labelKey: 'storyboard.langPl', promptLabel: 'Polski (Polish)' },
    { value: 'NL', labelKey: 'storyboard.langNl', promptLabel: 'Nederlands (Dutch)' },
    { value: 'TL', labelKey: 'storyboard.langTl', promptLabel: 'Filipino (Tagalog)' },
];

/** Visual style presets — English labels used in AI prompts */
export const STORYBOARD_STYLE_PRESETS = [
    'Anime short',
    'Ghibli',
    'Pixar 3D',
    'Kids animation',
    'Drama',
    'Romance',
    'Comedy',
    'Horror',
    'Thriller',
    'Action',
    'Fantasy',
    'Sci-fi',
    'Cyberpunk',
    'Steampunk',
    'Realistic',
    'Cinematic',
    'Noir',
    'Documentary',
    'Nature documentary',
    'News report',
    'Commercial ad',
    'Music video',
    'Vlog',
    'Historical',
    'Western',
    'Martial arts',
    'Watercolor',
    'Oil painting',
    'Comic book',
    'Claymation',
    'Stop motion',
    'Retro 80s',
    'Vaporwave',
    'Minimalist',
    'Surreal',
    'Live action',
];

const languageByValue = Object.fromEntries(
    STORYBOARD_LANGUAGE_OPTIONS.map((opt) => [opt.value, opt]),
);

/**
 * @param {string} code
 * @returns {string}
 */
export function storyboardLanguagePromptLabel(code) {
    const key = String(code || 'EN').toUpperCase();
    return languageByValue[key]?.promptLabel || languageByValue.EN.promptLabel;
}
