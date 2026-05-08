export const getSettings = () => {
  const defaultSettings = {
    nanoToken: '',
    imageAccessToken: '',
    videoAccessToken: '',
    videoCookie: '',
    imageAspectRatio: 'IMAGE_ASPECT_RATIO_LANDSCAPE',
    videoAspectRatio: 'VIDEO_ASPECT_RATIO_LANDSCAPE',
    grokUrl: 'https://api.x.ai/v1/chat/completions',
    grokApiKey: '',
    geminiApiKey: '',
    geminiModel: 'gemini-3-flash-preview',
  };

  const savedRaw = localStorage.getItem('nano_settings');
  const setupRaw = localStorage.getItem('ideastudio.setup');
  const parsed = savedRaw ? JSON.parse(savedRaw) : {};
  const setupParsed = setupRaw ? JSON.parse(setupRaw) : {};
  const veo = setupParsed?.veoAccounts?.[0] || {};

  return {
    ...defaultSettings,
    ...parsed,
    nanoToken: setupParsed?.nano?.apiKey || parsed.nanoToken || '',
    imageAccessToken: veo.token || parsed.imageAccessToken || '',
    videoAccessToken: veo.token || parsed.videoAccessToken || '',
    videoCookie: veo.cookie || parsed.videoCookie || '',
    geminiApiKey: setupParsed?.gemini?.apiKey || parsed.geminiApiKey || '',
    geminiModel: setupParsed?.gemini?.model || parsed.geminiModel || 'gemini-3-flash-preview',
  };
};

export const saveSettings = (settings) => {
  localStorage.setItem('nano_settings', JSON.stringify(settings));
};


const toInlineImagePart = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to read image input");
  const blob = await response.blob();
  const mimeType = blob.type || 'image/png';
  const base64Data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const payload = result.includes(',') ? result.split(',')[1] : '';
      resolve(payload);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return {
    inlineData: {
      mimeType,
      data: base64Data
    }
  };
};

export async function callGemini(prompt, imageUrls = []) {
  const settings = getSettings();
  if (!settings.geminiApiKey) throw new Error("Gemini API Key not configured");
  const model = settings.geminiModel || 'gemini-3-flash-preview';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${settings.geminiApiKey}`;
  const parts = [{ text: prompt }];

  const safeImageUrls = (Array.isArray(imageUrls) ? imageUrls : [])
    .filter((item) => typeof item === 'string' && item && !item.includes('.mp4') && !item.includes('.webm') && !item.includes('video'))
    .slice(0, 3);
  for (const imageUrl of safeImageUrls) {
    parts.push(await toInlineImagePart(imageUrl));
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts
        }
      ],
      generationConfig: {
        thinkingConfig: {
          thinkingLevel: 'HIGH'
        }
      },
      tools: [{ googleSearch: {} }]
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "Gemini API call failed");

  const payloads = Array.isArray(data) ? data : [data];
  const texts = payloads
    .flatMap(item => item?.candidates || [])
    .flatMap(candidate => candidate?.content?.parts || [])
    .map(part => part?.text)
    .filter(Boolean);

  return texts.join('\n').trim() || 'No response text';
}

const extractTextFromGeminiPayload = (payload) => {
  const parts = payload?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p?.text).filter(Boolean).join('');
};

const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const parseErrorPayload = (rawText) => {
  try {
    return rawText ? JSON.parse(rawText) : {};
  } catch {
    return {};
  }
};
const isRetryableGeminiError = (status, message = '', code = '') => {
  const m = String(message || '').toUpperCase();
  const c = String(code || '').toUpperCase();
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    c === 'UNAVAILABLE' ||
    c === 'RESOURCE_EXHAUSTED' ||
    m.includes('HIGH DEMAND') ||
    m.includes('UNAVAILABLE') ||
    m.includes('RESOURCE_EXHAUSTED')
  );
};
const buildModelQueue = (primaryModel) => {
  const queue = [primaryModel, ...GEMINI_FALLBACK_MODELS];
  return [...new Set(queue.filter(Boolean))];
};
const compactPromptText = (prompt, maxChars = 5200) => {
  const src = String(prompt || '').trim();
  if (src.length <= maxChars) return src;
  const keepHead = Math.floor(maxChars * 0.65);
  const keepTail = maxChars - keepHead - 40;
  return `${src.slice(0, keepHead)}\n\n...[đã rút gọn tự động để tránh quá token]...\n\n${src.slice(-keepTail)}`;
};

/**
 * Gemini stream text via streamGenerateContent.
 * Calls onChunk(accumulatedText, deltaText) while receiving partial output.
 * @param {string} prompt
 * @param {{ imageUrls?: string[], onChunk?: (fullText: string, deltaText: string) => void }} options
 * @returns {Promise<string>}
 */
export async function callGeminiStreamText(prompt, options = {}) {
  const { imageUrls = [], onChunk } = options;
  const settings = getSettings();
  if (!settings.geminiApiKey) throw new Error('Gemini API Key not configured');

  const parts = [{ text: prompt }];
  const safeImageUrls = (Array.isArray(imageUrls) ? imageUrls : [])
    .filter((item) => typeof item === 'string' && item && !item.includes('.mp4') && !item.includes('.webm') && !item.includes('video'))
    .slice(0, 3);
  for (const imageUrl of safeImageUrls) {
    parts.push(await toInlineImagePart(imageUrl));
  }

  const modelQueue = buildModelQueue(settings.geminiModel || 'gemini-3-flash-preview');
  let response = null;
  let lastErr = null;
  for (const model of modelQueue) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${settings.geminiApiKey}`;
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.35,
          },
        }),
      });
      if (response.ok) break;
      let errText = '';
      try {
        errText = await response.text();
      } catch {
        errText = '';
      }
      const parsed = parseErrorPayload(errText);
      const statusCode = parsed?.error?.status || '';
      const message = parsed?.error?.message || errText || response.statusText;
      lastErr = new Error(`[${model}] ${message}`);
      const retryable = isRetryableGeminiError(response.status, message, statusCode);
      if (!retryable) {
        throw lastErr;
      }
      if (attempt < 2) {
        await wait(500 * attempt);
        continue;
      }
      break;
    }
    if (response?.ok) break;
    await wait(600);
  }

  if (!response?.ok) {
    throw lastErr || new Error('Gemini streamGenerateContent failed');
  }

  if (!response.body) {
    throw new Error('Gemini stream không có dữ liệu trả về');
  }

  const decoder = new TextDecoder('utf-8');
  const reader = response.body.getReader();
  let sseBuffer = '';
  let fullText = '';
  let sawSseEvent = false;
  let rawBuffer = '';

  const parseJsonFallback = (raw) => {
    const t = String(raw || '').trim();
    if (!t) return '';
    try {
      const parsed = JSON.parse(t);
      const payloads = Array.isArray(parsed) ? parsed : [parsed];
      const text = payloads
        .map((item) => extractTextFromGeminiPayload(item))
        .filter(Boolean)
        .join('');
      return text.trim();
    } catch {
      return '';
    }
  };

  const flushSseEvent = (eventRaw) => {
    const lines = eventRaw.split('\n');
    const dataLines = lines
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    if (!dataLines.length) return;
    const dataRaw = dataLines.join('\n');
    if (dataRaw === '[DONE]') return;
    sawSseEvent = true;
    let payload = null;
    try {
      payload = JSON.parse(dataRaw);
    } catch {
      return;
    }
    if (payload?.error?.message) {
      throw new Error(payload.error.message);
    }
    const delta = extractTextFromGeminiPayload(payload);
    if (!delta) return;
    fullText += delta;
    if (typeof onChunk === 'function') onChunk(fullText, delta);
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const decoded = decoder.decode(value, { stream: true });
      rawBuffer += decoded;
      sseBuffer += decoded.replace(/\r\n/g, '\n');
      while (true) {
        const splitAt = sseBuffer.indexOf('\n\n');
        if (splitAt === -1) break;
        const eventRaw = sseBuffer.slice(0, splitAt);
        sseBuffer = sseBuffer.slice(splitAt + 2);
        flushSseEvent(eventRaw);
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Fallback: some responses may not come as SSE events.
  if (!fullText.trim()) {
    const fromRawJson = parseJsonFallback(rawBuffer);
    if (fromRawJson) {
      fullText = fromRawJson;
      if (typeof onChunk === 'function') onChunk(fullText, fullText);
    }
  }

  // If SSE was detected, also attempt to parse any remaining buffered event body.
  if (!fullText.trim() && sawSseEvent && sseBuffer.trim()) {
    try {
      flushSseEvent(sseBuffer);
    } catch {
      // ignore tail parse error; final check below will throw meaningful error
    }
  }

  if (!fullText.trim()) {
    throw new Error('Gemini stream không có nội dung text');
  }
  return fullText.trim();
}

function parseGeminiGenerateContentJson(data) {
  if (data.error) throw new Error(data.error.message || 'Gemini API call failed');
  const cand = data?.candidates?.[0];
  if (!cand) throw new Error('Gemini: không có phản hồi hợp lệ');
  const parts = cand?.content?.parts || [];
  const text = parts.map((p) => p?.text).filter(Boolean).join('');
  if (!text) throw new Error('Gemini: nội dung rỗng');
  const normalizeJsonText = (raw) => {
    let value = String(raw || '').trim();
    value = value.replace(/^```json\s*/i, '').replace(/^```\s*/i, '');
    value = value.replace(/\s*```$/, '').trim();
    const firstObj = value.indexOf('{');
    const firstArr = value.indexOf('[');
    let start = -1;
    if (firstObj === -1) start = firstArr;
    else if (firstArr === -1) start = firstObj;
    else start = Math.min(firstObj, firstArr);
    const lastObj = value.lastIndexOf('}');
    const lastArr = value.lastIndexOf(']');
    const end = Math.max(lastObj, lastArr);
    if (start >= 0 && end > start) {
      value = value.slice(start, end + 1);
    }
    // Tolerate common model formatting issue: trailing commas in JSON.
    value = value.replace(/,\s*([}\]])/g, '$1');
    return value;
  };
  try {
    return JSON.parse(normalizeJsonText(text));
  } catch (e) {
    const preview = String(text).slice(0, 500);
    throw new Error(`JSON từ model không đọc được: ${e.message} | preview: ${preview}`);
  }
}

/**
 * Gemini `generateContent` with structured JSON (`responseMimeType` + `responseSchema`).
 * Omits tools/search so the model returns valid JSON only (avoids bad control chars in ad-hoc JSON strings).
 * @param {string} prompt
 * @param {{ responseSchema: object, imageUrls?: string[] }} options
 * @returns {Promise<Record<string, unknown>>}
 */
export async function callGeminiStructured(prompt, options = {}) {
  const { responseSchema, imageUrls = [], maxOutputTokens = 3072 } = options;
  if (!responseSchema || typeof responseSchema !== 'object') {
    throw new Error('callGeminiStructured: responseSchema is required');
  }

  const settings = getSettings();
  if (!settings.geminiApiKey) throw new Error('Gemini API Key not configured');

  const parts = [{ text: prompt }];
  const safeImageUrls = (Array.isArray(imageUrls) ? imageUrls : [])
    .filter((item) => typeof item === 'string' && item && !item.includes('.mp4') && !item.includes('.webm') && !item.includes('video'))
    .slice(0, 3);
  for (const imageUrl of safeImageUrls) {
    parts.push(await toInlineImagePart(imageUrl));
  }

  const modelQueue = buildModelQueue(settings.geminiModel || 'gemini-3-flash-preview');
  let data = {};
  let response = null;
  let lastErr = null;
  for (const model of modelQueue) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const shouldCompactPrompt = attempt >= 2;
      const payloadPrompt = shouldCompactPrompt ? compactPromptText(prompt, 3200) : prompt;
      const supportsThinkingBudget =
        String(model).includes('2.5') || String(model).includes('3-') || String(model).includes('3.');
      const generationConfig = {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.25,
        maxOutputTokens,
      };
      if (supportsThinkingBudget) {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.geminiApiKey}`;
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: payloadPrompt }, ...parts.slice(1)] }],
          generationConfig,
        }),
      });

      const text = await response.text();
      data = parseErrorPayload(text);
      if (response.ok) {
        const finishReason = data?.candidates?.[0]?.finishReason || '';
        if (String(finishReason).toUpperCase() === 'MAX_TOKENS') {
          lastErr = new Error(`[${model}] Model trả JSON bị cắt do MAX_TOKENS`);
          if (attempt < 3) {
            await wait(450 * attempt);
            continue;
          }
        } else {
          break;
        }
      } else {
        const statusCode = data?.error?.status || '';
        const message = data?.error?.message || response.statusText || 'Gemini generateContent failed';
        const detail = text && !data?.error?.message ? ` | raw: ${text.slice(0, 500)}` : '';
        lastErr = new Error(`[${model}] ${message}${detail}`);
        const retryable = isRetryableGeminiError(response.status, message, statusCode);
        if (!retryable) {
          throw lastErr;
        }
        if (attempt < 3) {
          await wait(500 * attempt);
          continue;
        }
      }

      break;
    }
    if (response?.ok && String(data?.candidates?.[0]?.finishReason || '').toUpperCase() !== 'MAX_TOKENS') break;
    await wait(600);
  }

  if (!response?.ok || String(data?.candidates?.[0]?.finishReason || '').toUpperCase() === 'MAX_TOKENS') {
    throw lastErr || new Error('Gemini generateContent failed');
  }
  return parseGeminiGenerateContentJson(data);
}

export {
  GEMINI_REFINE_SCRIPT_SCHEMA,
  GEMINI_FLOW_GRAPH_SCHEMA,
  GEMINI_FLOW_FRAME_SCHEMA,
  GEMINI_FLOW_CLIP_BATCH_SCHEMA,
} from './geminiFlowSchemas.js';

async function pollTask(taskId, nanoToken, type) {
  const url = `https://flow-api.nanoai.pics/api/v2/task?taskId=${taskId}`;
  const extractTaskErrorMessage = (payload) => {
    const mediaErrors = (payload?.data?.media || [])
      .map((m) => {
        const mediaStatus = m?.mediaMetadata?.mediaStatus;
        const primary = mediaStatus?.error?.message || '';
        const reason = Array.isArray(mediaStatus?.failureReasons) && mediaStatus.failureReasons.length
          ? mediaStatus.failureReasons.join(', ')
          : '';
        return [primary, reason].filter(Boolean).join(' | ');
      })
      .filter(Boolean);
    if (mediaErrors.length) return mediaErrors[0];
    return (
      payload?.data?.error?.message ||
      payload?.data?.error?.status ||
      (typeof payload?.data === 'string' ? payload.data : '') ||
      payload?.error ||
      payload?.message ||
      'Task failed'
    );
  };

  while (true) {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${nanoToken}`
      }
    });
    const result = await response.json();

    if (result.success && result.code === 'success') {
      return type === 'image' ? result.data.fifeUrl : result.data.mediaUrl;
    }

    if (result.code === 'processing') {
      await new Promise(resolve => setTimeout(resolve, 3000));
      continue;
    }
    throw new Error(extractTaskErrorMessage(result));
  }
}

async function toBase64(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Nano image APIs expect full data URLs: `data:image/jpeg;base64,...`, not plain http(s) URLs. */
async function ensureFullImageDataUrls(urls) {
  const list = (Array.isArray(urls) ? urls : []).filter((u) => typeof u === 'string' && u.trim());
  return Promise.all(
    list.map(async (u) => {
      const t = u.trim();
      if (t.toLowerCase().startsWith('data:image/')) return t;
      return await toBase64(t);
    })
  );
}

const isInternalRetryableError = (error) => {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('internal error encountered');
};

const withInternalRetry = async (runner, maxAttempts = 3) => {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await runner(attempt);
    } catch (error) {
      lastError = error;
      const canRetry = isInternalRetryableError(error) && attempt < maxAttempts;
      if (!canRetry) throw error;
      await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
    }
  }
  throw lastError || new Error('Internal error encountered.');
};

export async function generateNanoImage(params) {
  return withInternalRetry(async () => {
    const settings = getSettings();
    if (!settings.nanoToken || !settings.imageAccessToken) {
      throw new Error("Please configure NanoAI settings first");
    }

    const imageUrls = await ensureFullImageDataUrls(params.imageUrls);

    const response = await fetch("https://flow-api.nanoai.pics/api/v2/images/create", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.nanoToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken: settings.imageAccessToken,
        promptText: params.prompt,
        imageUrls,
        aspectRatio: params.aspectRatio || "IMAGE_ASPECT_RATIO_PORTRAIT",
        imageModel: params.imageModel
      })
    });

    const data = await response.json();
    if (!data.taskId) throw new Error(data.message || "Failed to create image task");

    const mediaUrl = await pollTask(data.taskId, settings.nanoToken, 'image');
    return await toBase64(mediaUrl);
  }, 3);
}

export async function generateNanoVideo(params) {
  return withInternalRetry(async () => {
    const settings = getSettings();
    if (!settings.nanoToken || !settings.videoAccessToken || !settings.videoCookie) {
      throw new Error("Please configure NanoAI settings first");
    }

    const imageUrls = await ensureFullImageDataUrls(params.imageUrls);

    const response = await fetch("https://flow-api.nanoai.pics/api/v2/videos/create", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.nanoToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken: settings.videoAccessToken,
        cookie: settings.videoCookie,
        promptText: params.prompt,
        imageUrls,
        aspectRatio: params.aspectRatio || "VIDEO_ASPECT_RATIO_PORTRAIT",
        videoModel: params.videoModel,
        type: params.type
      })
    });

    const data = await response.json();
    if (!data.taskId) throw new Error(data.message || "Failed to create video task");

    const mediaUrl = await pollTask(data.taskId, settings.nanoToken, 'video');
    const videoResponse = await fetch(mediaUrl);
    const blob = await videoResponse.blob();
    return URL.createObjectURL(blob);
  }, 3);
}

export async function mergeNanoVideos(videoUrls) {
  const settings = getSettings();
  if (!settings.nanoToken || !settings.videoAccessToken || !settings.videoCookie) {
    throw new Error("Please configure NanoAI settings first");
  }

  const response = await fetch("https://flow-api.nanoai.pics/api/v2/videos/merge", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.nanoToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      accessToken: settings.videoAccessToken,
      cookie: settings.videoCookie,
      videoUrls: videoUrls
    })
  });

  const data = await response.json();
  if (!data.taskId) throw new Error(data.message || "Failed to create merge task");

  const mediaUrl = await pollTask(data.taskId, settings.nanoToken, 'video');
  const videoResponse = await fetch(mediaUrl);
  const blob = await videoResponse.blob();
  return URL.createObjectURL(blob);
}


// ============================================================================
// PHẦN 2: CÁC HÀM XỬ LÝ VIDEO MOTION (Thêm mới)
// ============================================================================

/**
 * 1. Upload ảnh base64 lên Studio
 */
export async function uploadMotionImage(base64String) {
  const settings = getSettings();
  const response = await fetch("https://flow-api.nanoai.pics/api/studio/upload", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.nanoToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ base64: base64String })
  });

  const data = await response.json();
  if (!data.success) throw new Error(data.message || "Upload image failed");
  return data.data.url;
}

/**
 * 2. Upload video file lên Studio
 */
export async function uploadMotionVideo(videoFileOrBlob) {
  const settings = getSettings();
  if (!settings.nanoToken) {
    throw new Error("Nano API Key not configured");
  }
  if (!videoFileOrBlob) {
    throw new Error("Missing video file for upload");
  }

  if (typeof videoFileOrBlob === 'string') {
    const localAssetMatch = videoFileOrBlob.includes('/resources/') || videoFileOrBlob.includes('metadata/resources/');
    if (localAssetMatch) {
      const localRes = await fetch("http://localhost:27123/api/meta/upload-video-from-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetPath: videoFileOrBlob,
          nanoToken: settings.nanoToken
        })
      });
      const localData = await localRes.json();
      if (!localRes.ok || !localData?.success) {
        throw new Error(localData?.message || "Upload video from asset failed");
      }
      return localData?.data?.url;
    }
  }

  const formData = new FormData();
  if (videoFileOrBlob instanceof File) {
    formData.append("video", videoFileOrBlob, videoFileOrBlob.name || "kling-input.mp4");
  } else {
    formData.append("video", videoFileOrBlob, "kling-input.mp4");
  }

  const response = await fetch("https://flow-api.nanoai.pics/api/studio/upload-video", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.nanoToken}`
    },
    body: formData
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(
      (typeof data?.data === 'string' ? data.data : '') ||
      data?.error ||
      data?.message ||
      `Upload video failed (status ${response.status})`
    );
  }
  return data.data.url;
}

/**
 * 3. Polling kiểm tra trạng thái Task Video liên tục đến khi xong
 */
async function pollMotionVideoTask(taskId) {
  const settings = getSettings();
  const maxRetries = 200;  // Giới hạn số lần polling để tránh loop vô hạn  5000ms x 200 = ~16.6 phút, nếu sau thời gian này vẫn chưa có kết quả thì sẽ timeout
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const pickErrorMessage = (payload) => {
    if (!payload) return "Video processing failed";
    if (typeof payload === 'string') return payload;
    return (
      payload?.data?.error?.message ||
      payload?.data?.error?.status ||
      (typeof payload?.data === 'string' ? payload.data : '') ||
      payload?.error ||
      payload?.message ||
      payload?.code ||
      "Video processing failed"
    );
  };

  for (let i = 0; i < maxRetries; i++) {
    // Đã đổi localhost thành domain thật để chạy production
    const response = await fetch(`https://flow-api.nanoai.pics/api/studio/get-task?taskId=${taskId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${settings.nanoToken}`,
        "Content-Type": "application/json"
      }
    });
    const data = await response.json();

    // Thành công
    if (data.success && data.code === "success" && data.data?.status === "COMPLETED") {
      return data.data.generated[0]; // Trả về link mp4
    }

    // Thất bại hoặc có lỗi
    if (data.code === "error" || data.data?.status === "FAILED") {
      throw new Error(pickErrorMessage(data));
    }

    // Đang xử lý (processing) -> Chờ 5 giây rồi gọi lại
    await delay(10 * 1000);
  }

  throw new Error("Polling timeout: Video generation took too long.");
}

/**
 * 4. Tạo 1 Video Motion duy nhất (Hàm gộp các bước)
 */
export async function generateMotionVideo(params) {
  const settings = getSettings();

  // Nếu có base64 hoặc file thì upload trước, nếu truyền thẳng url thì dùng luôn
  let imageUrl = params.imageUrl;
  let videoUrl = params.videoUrl;

  if (params.imageBase64) {
    imageUrl = await uploadMotionImage(params.imageBase64);
  }
  if (params.videoFile) {
    videoUrl = await uploadMotionVideo(params.videoFile);
  }

  if (!imageUrl || !videoUrl) {
    throw new Error("Missing image_url or video_url for motion video");
  }

  // Call API gen video
  const response = await fetch("https://flow-api.nanoai.pics/api/studio/gen-video-motion", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${settings.nanoToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      image_url: imageUrl,
      video_url: videoUrl,
      time_video: params.timeVideo || 9,
      prompt: params.prompt || "dancing",
      character_orientation: params.characterOrientation || "video",
      cfg_scale: params.cfgScale || 0.5
    })
  });

  const data = await response.json();
  if (!response.ok || data?.success === false) {
    const message =
      (typeof data?.data === 'string' ? data.data : '') ||
      data?.error ||
      data?.message ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  // Giả sử API gen-video-motion trả về task_id (Dựa trên flow thông thường)
  const taskId = data.taskId || data.data?.taskId || data.data?.task_id || data.task_id;
  if (!taskId) throw new Error("Failed to create motion video task");

  // Polling đợi kết quả
  const resultVideoUrl = await pollMotionVideoTask(taskId);

  return resultVideoUrl; // Trả về dạng URL mp4
}

/**
 * 5. TẠO NHIỀU VIDEO MOTION CÙNG LÚC
 * - Nhận vào 1 mảng các config. 
 * - Chạy song song (Promise.allSettled) để tối ưu thời gian.
 * - Trả về mảng kết quả tương ứng.
 */
export async function generateMultipleMotionVideos(videoConfigsList) {
  if (!Array.isArray(videoConfigsList) || videoConfigsList.length === 0) {
    return [];
  }

  // Chạy song song tất cả các request tạo video
  const results = await Promise.allSettled(
    videoConfigsList.map(config => generateMotionVideo(config))
  );

  // Xử lý kết quả trả về
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return {
        index,
        success: true,
        videoUrl: result.value // URL video đã tạo thành công
      };
    } else {
      return {
        index,
        success: false,
        error: result.reason.message || "Unknown error"
      };
    }
  });
}