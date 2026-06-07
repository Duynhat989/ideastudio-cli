import { createMediaTask } from '@/composables/useStoryboardSceneGen.js';
import { storyboardService } from '@/services/storyboard.service.js';
import { getSettings } from '@/services/nanoai.js';
import { normalizeVideoModel, normalizeVideoTier } from '@/services/flowApiV3.js';
import { normalizeStoryboardStylePreset } from '@/utils/storyboardOptions.js';

export const MAX_STORYBOARD_CHARACTERS = 4;
export const MAX_CHARACTER_STYLE_REFS = 4;

export function applyVeoSettingsFromApp(settings = {}) {
    const tier = normalizeVideoTier(getSettings().videoTier);
    return {
        ...settings,
        videoTier: tier,
        videoModel: normalizeVideoModel(settings.videoModel || 'veo3Fast', tier),
    };
}

export function defaultEditorState(overrides = {}) {
    return {
        settings: applyVeoSettingsFromApp({
            duration: 60,
            language: 'VI',
            aspectRatio: '9:16',
            stylePreset: 'Anime',
            imageModel: 'GEM_PIX_2',
            videoModel: 'veo3Fast',
        }),
        templateDefaults: {
            style: 'cinematic illustration, cohesive visual style matching the selected style preset',
            character: 'Định nghĩa nhân vật chính nhất quán — Character Bible xuyên suốt video',
            scene: 'medium shot, rõ địa điểm, đạo cụ và tư thế nhân vật',
            emotion: 'biểu cảm rõ ràng, phù hợp cảm xúc từng cảnh',
            camera: 'chuyển động cinematic — zoom in chậm, pan nhẹ có chủ đích',
            lighting: 'ánh sáng tự nhiên, soft, late afternoon',
            environment: 'chi tiết môi trường sống động — gió, bụi, âm thanh nền',
            mood: 'bầu không khí cảm xúc phù hợp chủ đề',
            asmr: ['paper rustling', 'distant ambient sounds'],
            bgm: 'calm, slightly melancholic piano music',
            rules: ['ZERO visible text in images', 'NO speech bubbles or captions in frames', 'NARRATOR is voice-over only', 'Only Audio-tagged character may speak'],
        },
        activeTab: 'script',
        ideaText: '',
        outline: null,
        scenes: [],
        characterRef: { name: '', prompt: '', source: 'none', imageUrl: null },
        characterRefStyle: '',
        characterRefStyleRefs: [],
        generatedCharacters: [],
        userCharacterImages: [],
        libraryCharacterRefs: [],
        expandedScenes: {},
        ...overrides,
    };
}

function mediaTaskFromUrl(url) {
    const task = createMediaTask();
    if (url) {
        task.status = 'success';
        task.result = storyboardService.assetUrl(url);
    }
    return task;
}

/** Media gen cannot resume after reload — treat stale in-flight state as idle. */
function resetStaleMediaStatus(status, { url = null } = {}) {
    if (url) return status === 'error' ? 'error' : 'success';
    if (status === 'generating') return 'idle';
    return status || 'idle';
}

/** Script/shot AI gen interrupted — keep completed work, otherwise reset. */
function resetStaleScriptStatus(status, { shots = [] } = {}) {
    if (status !== 'generating') return status || 'pending';
    return shots.length ? 'done' : 'pending';
}

function taskUrlFromScene(fieldUrl, task, statusField) {
    const url = fieldUrl
        || (task?.result && !String(task.result).startsWith('blob:')
            ? extractRelativeAssetPath(task.result)
            : null);
    const rawStatus = task?.status || (url ? 'success' : statusField || 'idle');
    return { url, status: resetStaleMediaStatus(rawStatus, { url }) };
}

export function hydrateShot(shot) {
    const firstFrameTask = mediaTaskFromUrl(shot.firstFrameImageUrl);
    if (shot.firstFrameStatus && !shot.firstFrameImageUrl) {
        firstFrameTask.status = resetStaleMediaStatus(shot.firstFrameStatus);
    }

    const videoTask = mediaTaskFromUrl(shot.videoUrl);
    if (shot.videoStatus && !shot.videoUrl) {
        videoTask.status = resetStaleMediaStatus(shot.videoStatus);
    }

    return {
        index: shot.index,
        label: shot.label || '',
        durationSec: shot.durationSec || 5,
        imagePrompt: shot.imagePrompt || '',
        videoPrompt: shot.videoPrompt || '',
        blocks: shot.blocks || null,
        scriptStatus: resetStaleScriptStatus(shot.scriptStatus || 'done'),
        scriptError: shot.scriptError || '',
        firstFrameImageUrl: shot.firstFrameImageUrl || null,
        videoUrl: shot.videoUrl || null,
        firstFrameTask,
        videoTask,
    };
}

function migrateLegacySceneToShots(scene) {
    if (Array.isArray(scene.shots) && scene.shots.length) return scene.shots;
    if (!scene.blocks && !scene.prompt) return [];
    return [{
        index: 1,
        label: scene.label || `Shot 1`,
        durationSec: scene.durationSec || 5,
        imagePrompt: scene.imagePrompt || scene.prompt || scene.beat || '',
        videoPrompt: scene.prompt || '',
        blocks: scene.blocks || null,
        scriptStatus: scene.scriptStatus || 'done',
        scriptError: scene.scriptError || '',
        firstFrameImageUrl: scene.imageUrl || null,
        videoUrl: scene.videoUrl || null,
        firstFrameStatus: scene.imageStatus || (scene.imageUrl ? 'success' : 'idle'),
        videoStatus: scene.videoStatus || (scene.videoUrl ? 'success' : 'idle'),
    }];
}

export function hydrateScene(scene) {
    const env = taskUrlFromScene(scene.environmentImageUrl, null, scene.environmentImageStatus);
    const environmentImageTask = mediaTaskFromUrl(env.url);
    if (scene.environmentImageStatus && !env.url) {
        environmentImageTask.status = resetStaleMediaStatus(scene.environmentImageStatus);
    }

    const shots = migrateLegacySceneToShots(scene).map(hydrateShot);

    return {
        index: scene.index,
        label: scene.label,
        durationSec: scene.durationSec,
        beat: scene.beat || '',
        location: scene.location || '',
        environmentPrompt: scene.environmentPrompt || '',
        shotCount: scene.shotCount || null,
        environmentImageUrl: env.url,
        shots,
        scriptStatus: resetStaleScriptStatus(
            scene.scriptStatus || (shots.length ? 'done' : 'pending'),
            { shots },
        ),
        scriptError: scene.scriptError || '',
        environmentImageTask,
    };
}

export function serializeShot(shot) {
    const firstFrame = taskUrlFromScene(
        shot.firstFrameImageUrl,
        shot.firstFrameTask,
        shot.firstFrameTask?.status,
    );
    const video = taskUrlFromScene(shot.videoUrl, shot.videoTask, shot.videoTask?.status);
    return {
        index: shot.index,
        label: shot.label,
        durationSec: shot.durationSec,
        imagePrompt: shot.imagePrompt,
        videoPrompt: shot.videoPrompt,
        blocks: shot.blocks,
        scriptStatus: resetStaleScriptStatus(shot.scriptStatus || 'done'),
        scriptError: shot.scriptError || '',
        firstFrameImageUrl: firstFrame.url,
        videoUrl: video.url,
        firstFrameStatus: firstFrame.status,
        videoStatus: video.status,
    };
}

export function serializeScene(scene) {
    const env = taskUrlFromScene(
        scene.environmentImageUrl,
        scene.environmentImageTask,
        scene.environmentImageTask?.status,
    );
    return {
        index: scene.index,
        label: scene.label,
        durationSec: scene.durationSec,
        beat: scene.beat,
        location: scene.location,
        environmentPrompt: scene.environmentPrompt,
        shotCount: scene.shotCount || null,
        environmentImageUrl: env.url,
        environmentImageStatus: env.status,
        shots: (scene.shots || []).map(serializeShot),
        scriptStatus: resetStaleScriptStatus(scene.scriptStatus, { shots: scene.shots || [] }),
        scriptError: scene.scriptError || '',
    };
}

export function makeShotRow(shotOutline, videoPrompt = '') {
    return hydrateShot({
        index: shotOutline.index,
        label: shotOutline.label,
        durationSec: shotOutline.durationSec,
        imagePrompt: shotOutline.imagePrompt || '',
        videoPrompt,
        blocks: shotOutline.blocks || null,
        scriptStatus: 'done',
        scriptError: '',
    });
}

export function normalizeCharacterRefStyleRefUrl(ref = '') {
    if (typeof ref === 'string') return ref.trim();
    return String(ref?.url || ref?.imageUrl || '').trim();
}

export function serializeCharacterRefStyleRefUrl(url = '') {
    return extractRelativeAssetPath(url) || String(url || '').trim();
}

export function hydrateGeneratedCharacter(char = {}) {
    const imageUrl = char.imageUrl || null;
    const imageTask = mediaTaskFromUrl(imageUrl);
    if (char.imageStatus && !imageUrl) {
        imageTask.status = resetStaleMediaStatus(char.imageStatus);
    }
    return {
        name: char.name || char.characterName || '',
        prompt: char.prompt || char.imagePrompt || '',
        source: char.source || 'none',
        imageUrl,
        imageTask,
    };
}

export function serializeGeneratedCharacter(char) {
    const image = taskUrlFromScene(char.imageUrl, char.imageTask, char.imageTask?.status);
    return {
        name: char.name || '',
        prompt: char.prompt || '',
        source: char.source || 'none',
        imageUrl: image.url,
        imageStatus: image.status,
    };
}

export function makeGeneratedCharacterRow(char = {}) {
    const rawPrompt = char.imagePrompt ?? char.prompt ?? '';
    const prompt = typeof rawPrompt === 'object' && rawPrompt
        ? JSON.stringify(rawPrompt, null, 2)
        : String(rawPrompt || '');
    return hydrateGeneratedCharacter({
        name: char.characterName || char.name || '',
        prompt,
        source: 'none',
        imageUrl: null,
    });
}

function migrateGeneratedCharacters(config) {
    if (Array.isArray(config?.generatedCharacters) && config.generatedCharacters.length) {
        return config.generatedCharacters.map(hydrateGeneratedCharacter);
    }
    const legacy = config?.characterRef;
    if (legacy?.prompt || legacy?.imageUrl || legacy?.name) {
        return [hydrateGeneratedCharacter({
            name: legacy.name,
            prompt: legacy.prompt,
            source: legacy.source || 'generated',
            imageUrl: legacy.imageUrl,
        })];
    }
    return [];
}

function syncLegacyCharacterRef(editor) {
    const first = editor.generatedCharacters?.[0];
    editor.characterRef = first
        ? {
            name: first.name || '',
            prompt: first.prompt || '',
            source: first.source || 'none',
            imageUrl: first.imageUrl || null,
            imageTask: first.imageTask,
        }
        : { name: '', prompt: '', source: 'none', imageUrl: null, imageTask: createMediaTask() };
}

export function makeSceneRow(sceneOutline) {
    return hydrateScene({
        index: sceneOutline.index,
        label: sceneOutline.label,
        durationSec: sceneOutline.durationSec,
        beat: sceneOutline.beat,
        location: sceneOutline.location || '',
        environmentPrompt: sceneOutline.environmentPrompt || '',
        shotCount: sceneOutline.shotCount || null,
        scriptStatus: 'pending',
        scriptError: '',
        shots: [],
    });
}

export function extractRelativeAssetPath(url) {
    if (!url) return null;
    const raw = String(url);
    const match = raw.match(/\/storyboards\/[^/]+\/assets\/[^"'?\s)]+/i);
    return match ? match[0] : null;
}

export function normalizeLibraryCharacterRef(ref) {
    if (!ref?.libraryId) return null;
    return {
        libraryId: String(ref.libraryId),
        name: String(ref.name || '').trim(),
        description: String(ref.description || '').trim(),
        role: String(ref.role || '').trim(),
        imageUrl: ref.imageUrl || null,
        prompt: typeof ref.prompt === 'string' ? ref.prompt : '',
    };
}

export function configToEditorState(config) {
    const base = defaultEditorState();
    if (!config) return base;
    if (config.settings) {
        const { videoTier: _savedTier, ...savedSettings } = config.settings;
        const merged = { ...base.settings, ...savedSettings };
        if (typeof merged.duration === 'string') {
            merged.duration = parseInt(merged.duration, 10) || 60;
        }
        merged.stylePreset = normalizeStoryboardStylePreset(merged.stylePreset);
        base.settings = applyVeoSettingsFromApp(merged);
    }
    if (config.templateDefaults) base.templateDefaults = { ...base.templateDefaults, ...config.templateDefaults };
    base.activeTab = config.activeTab || 'script';
    base.ideaText = config.ideaText || '';
    base.outline = config.outline || null;
    base.scenes = (config.scenes || []).map(hydrateScene);
    base.generatedCharacters = migrateGeneratedCharacters(config);
    syncLegacyCharacterRef(base);
    if (Array.isArray(config.userCharacterImages) && config.userCharacterImages.length) {
        base.userCharacterImages = [...config.userCharacterImages];
    } else if (config.userCharacterImageUrl) {
        base.userCharacterImages = [config.userCharacterImageUrl];
    }
    if (Array.isArray(config.libraryCharacterRefs) && config.libraryCharacterRefs.length) {
        base.libraryCharacterRefs = config.libraryCharacterRefs
            .map(normalizeLibraryCharacterRef)
            .filter(Boolean)
            .slice(0, MAX_STORYBOARD_CHARACTERS);
    } else {
        base.libraryCharacterRefs = [];
    }
    base.expandedScenes = config.expandedScenes || {};
    base.characterRefStyle = typeof config.characterRefStyle === 'string' ? config.characterRefStyle : '';
    if (Array.isArray(config.characterRefStyleRefs) && config.characterRefStyleRefs.length) {
        base.characterRefStyleRefs = config.characterRefStyleRefs
            .map(normalizeCharacterRefStyleRefUrl)
            .filter(Boolean);
    } else {
        base.characterRefStyleRefs = [];
    }
    return base;
}

export function editorStateToConfig(editor, meta = {}) {
    const charImageUrls = (editor.userCharacterImages || [])
        .map((url) => extractRelativeAssetPath(url) || url)
        .filter(Boolean)
        .slice(0, MAX_STORYBOARD_CHARACTERS);
    const generatedCharacters = (editor.generatedCharacters || [])
        .map(serializeGeneratedCharacter)
        .slice(0, MAX_STORYBOARD_CHARACTERS);
    syncLegacyCharacterRef(editor);
    const firstGenerated = generatedCharacters[0];
    const charRefImageUrl = firstGenerated?.imageUrl
        ? extractRelativeAssetPath(firstGenerated.imageUrl) || firstGenerated.imageUrl
        : null;
    const { videoTier: _runtimeTier, ...settingsToSave } = editor.settings || {};
    return {
        ...meta,
        settings: settingsToSave,
        templateDefaults: editor.templateDefaults,
        activeTab: editor.activeTab,
        ideaText: editor.ideaText,
        outline: editor.outline,
        scenes: (editor.scenes || []).map(serializeScene),
        generatedCharacters,
        characterRef: {
            name: firstGenerated?.name || editor.characterRef?.name || '',
            prompt: firstGenerated?.prompt || editor.characterRef?.prompt || '',
            source: firstGenerated?.source || editor.characterRef?.source || 'none',
            imageUrl: charRefImageUrl,
        },
        userCharacterImages: charImageUrls,
        libraryCharacterRefs: (editor.libraryCharacterRefs || [])
            .map(normalizeLibraryCharacterRef)
            .filter(Boolean)
            .slice(0, MAX_STORYBOARD_CHARACTERS),
        expandedScenes: editor.expandedScenes || {},
        characterRefStyle: String(editor.characterRefStyle || '').trim(),
        characterRefStyleRefs: (editor.characterRefStyleRefs || [])
            .map(serializeCharacterRefStyleRefUrl)
            .filter(Boolean)
            .slice(0, MAX_CHARACTER_STYLE_REFS),
    };
}

function pickStoryboardAssetExt(mime, kind) {
    const m = String(mime || '').toLowerCase();
    if (m.includes('png')) return 'png';
    if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
    if (m.includes('webp')) return 'webp';
    if (m.includes('gif')) return 'gif';
    if (m.includes('mp4')) return 'mp4';
    if (m.includes('webm')) return 'webm';
    if (kind === 'scene-video' || kind === 'video') return 'mp4';
    return 'png';
}

async function sourceToUploadFile(source, { kind, sceneIndex }) {
    const baseName = sceneIndex != null ? `scene${sceneIndex}-${kind}` : kind;
    if (source instanceof File) return source;
    if (source instanceof Blob) {
        const ext = pickStoryboardAssetExt(source.type, kind);
        return new File([source], `${baseName}-${Date.now()}.${ext}`, { type: source.type || undefined });
    }
    if (typeof source !== 'string') return null;
    if (source.startsWith('data:') || source.startsWith('blob:') || source.startsWith('http://') || source.startsWith('https://')) {
        const res = await fetch(source);
        if (!res.ok) throw new Error(`Không đọc được media để lưu (${res.status})`);
        const blob = await res.blob();
        const ext = pickStoryboardAssetExt(blob.type, kind);
        return new File([blob], `${baseName}-${Date.now()}.${ext}`, { type: blob.type || undefined });
    }
    return null;
}

export async function persistStoryboardAsset(projectId, source, { kind, sceneIndex = null } = {}) {
    if (!projectId || !source) return null;
    const relative = extractRelativeAssetPath(source);
    if (relative) return relative;

    try {
        const file = await sourceToUploadFile(source, { kind, sceneIndex });
        if (file) {
            const uploadRes = await storyboardService.saveAssetFile(projectId, file, { kind, sceneIndex });
            if (uploadRes?.success) {
                return uploadRes.data?.relativeUrl || extractRelativeAssetPath(uploadRes.data?.url);
            }
        }
    } catch (err) {
        console.error('Storyboard asset upload failed:', err);
    }

    if (typeof source === 'string' && source.startsWith('data:')) {
        const res = await storyboardService.saveAsset(projectId, { source, kind, sceneIndex });
        if (!res?.success) return null;
        return res.data?.relativeUrl || extractRelativeAssetPath(res.data?.url);
    }

    return null;
}
