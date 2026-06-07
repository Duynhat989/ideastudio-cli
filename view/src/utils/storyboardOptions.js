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

/** Visual style presets — name + description injected into AI prompts as "Name - Description" */
export const STORYBOARD_STYLE_PRESETS = [
    {
        value: 'Traditional Cartoon',
        description: 'Playful, expressive, and timeless. Focuses on exaggerated emotions and entertaining storytelling.',
    },
    {
        value: "Children's Cartoon",
        description: 'Bright, friendly, safe, and cheerful. Designed to create a fun and positive experience for young audiences.',
    },
    {
        value: 'Anime',
        description: 'Emotional, immersive, and character-driven. Often combines drama, imagination, and meaningful character growth.',
    },
    {
        value: 'Chibi',
        description: 'Cute, funny, and adorable. Emphasizes charm, innocence, and exaggerated cuteness.',
    },
    {
        value: 'Pixar Style',
        description: 'Heartwarming, emotional, and family-friendly. Blends humor, adventure, and life lessons.',
    },
    {
        value: 'Disney Style',
        description: 'Magical, inspirational, and optimistic. Celebrates dreams, courage, friendship, and love.',
    },
    {
        value: 'Comic Style',
        description: 'Dynamic, energetic, and bold. Creates the feeling of a living comic book adventure.',
    },
    {
        value: 'Superhero Style',
        description: 'Heroic, powerful, and action-packed. Focuses on bravery, responsibility, and overcoming evil.',
    },
    {
        value: 'Fantasy Style',
        description: 'Magical, mysterious, and imaginative. Filled with wonder, mythical creatures, and extraordinary worlds.',
    },
    {
        value: 'Fairy Tale Style',
        description: 'Dreamlike, enchanting, and whimsical. Often centers around magic, hope, and moral lessons.',
    },
    {
        value: 'Adventure Style',
        description: 'Exciting, exploratory, and full of discovery. Driven by journeys, challenges, and unexpected experiences.',
    },
    {
        value: 'Comedy Style',
        description: 'Fun, lighthearted, and entertaining. Built around humor, jokes, and amusing situations.',
    },
    {
        value: 'Slice of Life Style',
        description: 'Relaxed, relatable, and authentic. Focuses on everyday experiences and human emotions.',
    },
    {
        value: 'Educational Style',
        description: 'Clear, engaging, and informative. Designed to teach while keeping the audience interested.',
    },
    {
        value: 'Sci-Fi Style',
        description: 'Futuristic, innovative, and imaginative. Explores advanced technology, space, and possibilities beyond reality.',
    },
    {
        value: 'Cyberpunk Style',
        description: 'High-tech, futuristic, and edgy. Combines advanced technology with complex or dystopian societies.',
    },
    {
        value: 'Steampunk Style',
        description: 'Inventive, adventurous, and nostalgic. Blends old-world aesthetics with imaginative machinery and exploration.',
    },
    {
        value: 'Mystery Style',
        description: 'Suspenseful, intriguing, and thought-provoking. Encourages curiosity and discovery.',
    },
    {
        value: 'Detective Style',
        description: 'Intelligent, logical, and investigative. Focuses on solving puzzles, mysteries, and hidden truths.',
    },
    {
        value: 'Horror Style',
        description: 'Tense, eerie, and unsettling. Creates suspense, fear, and anticipation.',
    },
    {
        value: 'Dark Fantasy Style',
        description: 'Magical yet ominous. Combines fantasy elements with danger, mystery, and darker themes.',
    },
    {
        value: 'Gothic Style',
        description: 'Atmospheric, dramatic, and mysterious. Features elegance, darkness, and emotional depth.',
    },
    {
        value: 'Cute (Kawaii) Style',
        description: 'Extremely adorable, cheerful, and wholesome. Designed to create warmth and happiness.',
    },
    {
        value: 'Stickman Style',
        description: 'Simple, direct, and action-focused. Prioritizes movement, storytelling, and creativity over visual detail.',
    },
    {
        value: 'Minimalist Style',
        description: 'Clean, simple, and focused. Removes unnecessary complexity to highlight the core message or story.',
    },
    {
        value: 'Storybook Style',
        description: 'Warm, cozy, and imaginative. Feels like a story being read from a beloved children\'s book.',
    },
    {
        value: 'Whimsical Style',
        description: 'Playful, quirky, and imaginative. Filled with charming surprises and creative ideas.',
    },
    {
        value: 'Epic Style',
        description: 'Grand, powerful, and awe-inspiring. Focuses on large-scale adventures, conflicts, and achievements.',
    },
    {
        value: 'Cute Animal Style',
        description: 'Friendly, lovable, and heartwarming. Centers on charming animal characters and their personalities.',
    },
    {
        value: 'Parody Style',
        description: 'Humorous, satirical, and entertaining. Uses exaggeration and playful imitation for comedy.',
    },
    {
        value: 'Action Style',
        description: 'Fast-paced, energetic, and thrilling. Driven by excitement, conflict, and momentum.',
    },
    {
        value: 'Magical Style',
        description: 'Enchanting, wonder-filled, and uplifting. Creates a world where magic feels natural and ever-present.',
    },
];

/** Map legacy preset names from older projects to current values. */
const LEGACY_STYLE_ALIASES = {
    'Anime short': 'Anime',
    Ghibli: 'Anime',
    'Pixar 3D': 'Pixar Style',
    'Kids animation': "Children's Cartoon",
    Drama: 'Slice of Life Style',
    Romance: 'Disney Style',
    Comedy: 'Comedy Style',
    Horror: 'Horror Style',
    Thriller: 'Mystery Style',
    Action: 'Action Style',
    Fantasy: 'Fantasy Style',
    'Sci-fi': 'Sci-Fi Style',
    Cyberpunk: 'Cyberpunk Style',
    Steampunk: 'Steampunk Style',
    Realistic: 'Slice of Life Style',
    Cinematic: 'Epic Style',
    Noir: 'Detective Style',
    Documentary: 'Educational Style',
    'Nature documentary': 'Educational Style',
    'News report': 'Educational Style',
    'Commercial ad': 'Minimalist Style',
    'Music video': 'Whimsical Style',
    Vlog: 'Slice of Life Style',
    Historical: 'Epic Style',
    Western: 'Adventure Style',
    'Martial arts': 'Action Style',
    Watercolor: 'Storybook Style',
    'Oil painting': 'Epic Style',
    'Comic book': 'Comic Style',
    Claymation: 'Pixar Style',
    'Stop motion': 'Whimsical Style',
    'Retro 80s': 'Cyberpunk Style',
    Vaporwave: 'Cyberpunk Style',
    Minimalist: 'Minimalist Style',
    Surreal: 'Whimsical Style',
    'Live action': 'Epic Style',
};

const styleByValue = Object.fromEntries(
    STORYBOARD_STYLE_PRESETS.map((opt) => [opt.value, opt]),
);

/**
 * Normalize stored stylePreset — resolves legacy names to current preset value.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeStoryboardStylePreset(raw) {
    const key = String(raw || '').trim();
    if (!key) return STORYBOARD_STYLE_PRESETS[0]?.value || 'Anime';
    if (styleByValue[key]) return key;
    if (LEGACY_STYLE_ALIASES[key]) return LEGACY_STYLE_ALIASES[key];
    return key;
}

/**
 * @param {string} value — stylePreset value
 * @returns {{ value: string, description: string } | null}
 */
export function getStoryboardStylePreset(value) {
    const normalized = normalizeStoryboardStylePreset(value);
    return styleByValue[normalized] || null;
}

/**
 * Prompt line for AI: "Style Name - Description"
 * @param {string} value — stylePreset value
 * @returns {string}
 */
export function formatStoryboardStyleForPrompt(value) {
    const preset = getStoryboardStylePreset(value);
    if (!preset) return String(value || '').trim();
    return `${preset.value} - ${preset.description}`;
}

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
