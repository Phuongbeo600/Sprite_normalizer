// 1. THƯ VIỆN NỀN TẢNG (Fetch, AbortController và giới hạn thời gian)
// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
import { getAuthHeaders } from '../../shared/api/authHeaders.js';
// 4. CẤU HÌNH: đủ thời gian cho dịch lần đầu, API ảnh và hậu xử lý.
const GENERATION_TIMEOUT_MS = 180_000;
const STATUS_TIMEOUT_MS = 15_000;
const LOCAL_START_TIMEOUT_MS = 75_000;
const TRANSLATE_TIMEOUT_MS = 45_000;

function httpError(status) {
  if (status === 429) return 'Đã hết hạn mức hoặc bị giới hạn số yêu cầu. Vui lòng thử lại sau.';
  if (status === 408 || status === 504) return 'Dịch vụ tạo ảnh đã quá thời gian phản hồi.';
  if (status === 401 || status === 403) return 'Không có quyền truy cập hoặc phiên đăng nhập/API Key không hợp lệ.';
  if (status === 502 || status === 503) return 'Không kết nối được dịch vụ tạo ảnh hoặc dịch vụ đang lỗi.';
  return `Yêu cầu tạo ảnh thất bại (HTTP ${status}).`;
}

/** Một giới hạn bao gồm fetch và đọc JSON, luôn hủy request/dọn timer khi kết thúc. */
async function requestJson(url, init, { timeoutMs, signal } = {}) {
  const controller = new AbortController();
  let timer;
  let abortListener;
  const stopped = new Promise((_, reject) => {
    abortListener = () => {
      controller.abort();
      const error = new Error('Yêu cầu đã được hủy.');
      error.name = 'AbortError';
      reject(error);
    };
    if (signal?.aborted) abortListener();
    else signal?.addEventListener('abort', abortListener, { once: true });
    timer = setTimeout(() => {
      // Reject with our message first: fetch's AbortError must not hide a timeout.
      reject(new Error(`Yêu cầu quá thời gian chờ (${Math.ceil(timeoutMs / 1000)} giây). Bạn có thể thử lại; yêu cầu trước có thể vẫn đang được Provider xử lý.`));
      controller.abort();
    }, timeoutMs);
  });
  const pending = (async () => {
    let response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) throw error;
      throw new Error('Mất kết nối tới Backend. Kiểm tra mạng và trạng thái máy chủ rồi thử lại.');
    }
    let data;
    try { data = await response.json(); }
    catch (error) {
      if (response.ok && error.name === 'TypeError') {
        throw new Error('Mất kết nối khi nhận phản hồi từ Backend.');
      }
      throw new Error(response.ok ? 'Backend trả dữ liệu JSON không hợp lệ.' : httpError(response.status));
    }
    if (!response.ok) {
      const detail = typeof data?.detail === 'string' ? data.detail : null;
      throw new Error(detail || httpError(response.status));
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Backend trả dữ liệu không hợp lệ.');
    }
    return data;
  })();
  try { return await Promise.race([pending, stopped]); }
  finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortListener);
  }
}

/** Đọc cấu hình Backend, không gọi nhà cung cấp AI. */
export function requestImageGenerationStatus(projectId, options = {}) {
  const query = projectId ? `?project_id=${projectId}` : '';
  return requestJson(`/api/image-gen/status${query}`, { headers: getAuthHeaders() },
    { timeoutMs: STATUS_TIMEOUT_MS, ...options });
}

/** Gửi đúng payload tạo ảnh; không tự thử lại để tránh phát sinh yêu cầu tính phí trùng. */
export function requestGenerateImages(payload, options = {}) {
  return requestJson('/api/image-gen/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(payload),
  }, { timeoutMs: GENERATION_TIMEOUT_MS, ...options });
}

/** Kiểm tra trạng thái máy chủ AI Local cổng 8080 (không nạp mô hình). */
export function requestLocalEnhancerStatus(options = {}) {
  return requestJson('/api/image-gen/local-enhancer/status', { headers: getAuthHeaders() },
    { timeoutMs: STATUS_TIMEOUT_MS, ...options });
}

/** Bật tiến trình AI Local cổng 8080 và chờ nạp xong mô hình GGUF vào RAM. */
export function requestStartLocalEnhancer(options = {}) {
  return requestJson('/api/image-gen/local-enhancer/start', {
    method: 'POST', headers: getAuthHeaders(),
  }, { timeoutMs: LOCAL_START_TIMEOUT_MS, ...options });
}

/** Tắt tiến trình AI Local do Backend quản lý để giải phóng ngay RAM. */
export function requestStopLocalEnhancer(options = {}) {
  return requestJson('/api/image-gen/local-enhancer/stop', {
    method: 'POST', headers: getAuthHeaders(),
  }, { timeoutMs: STATUS_TIMEOUT_MS, ...options });
}

/** Gọi dịch vụ dịch offline 2 chiều (EN ⇄ VI) có sẵn LRU Cache trên RAM Backend. */
export function requestTranslatePrompt({ text, sourceLang, targetLang }, options = {}) {
  return requestJson('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({
      text,
      source_lang: sourceLang,
      target_lang: targetLang,
    }),
  }, { timeoutMs: TRANSLATE_TIMEOUT_MS, ...options });
}

/**
 * Gọi luồng SSE nâng cao mô tả nhân vật từ AI Local cổng 8080 thông qua Backend.
 *
 * @param {Object} params Tham số yêu cầu và callback cập nhật luồng chữ trực tiếp.
 * @returns {Promise<void>} Hoàn tất khi kết thúc luồng hoặc người dùng bấm Dừng.
 */
export async function streamEnhancePromptApi({
  prompt,
  stylePreset = null,
  autoStart = true,
  signal = null,
  onStatus,
  onChunk,
  onError,
  onDone,
}) {
  try {
    const response = await fetch('/api/image-gen/enhance-prompt/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ prompt, style_preset: stylePreset, auto_start: autoStart }),
      signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      onError?.(errorData.detail || `Máy chủ báo lỗi HTTP ${response.status}`);
      return;
    }
    if (!response.body) {
      onError?.('Trình duyệt không hỗ trợ đọc luồng SSE (ReadableStream).');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const dataContent = trimmed.slice(5).trim();
        if (dataContent === '[DONE]') {
          onDone?.();
          return;
        }
        try {
          const parsed = JSON.parse(dataContent);
          if (parsed.error) {
            onError?.(parsed.error);
            return;
          }
          if (parsed.status) onStatus?.(parsed.status, parsed.message || '');
          if (parsed.text) onChunk?.(parsed.text);
        } catch {
          // Bỏ qua mảnh JSON chưa trọn vẹn trong luồng
        }
      }
    }
    onDone?.();
  } catch (err) {
    if (err.name === 'AbortError') {
      onDone?.();
    } else {
      onError?.('Mất kết nối tới Backend khi đang nhận gợi ý AI Local.');
    }
  }
}
