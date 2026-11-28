// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT
// ========================================================
// (Sử dụng Fetch API và TextDecoder chuẩn trình duyệt)

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI
// ========================================================
// (Không phụ thuộc thư viện bên ngoài)

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// ========================================================
// getAuthHeaders: Đính kèm phiên xác thực hiện tại nếu Backend yêu cầu
import { getAuthHeaders } from '../../shared/api/authHeaders.js';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & CẤU HÌNH
// ========================================================
const STATUS_TIMEOUT_MS = 12_000;
const CONTROL_TIMEOUT_MS = 75_000;
const REINDEX_TIMEOUT_MS = 180_000;

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = STATUS_TIMEOUT_MS) {
  const controller = new AbortController();
  const externalSignal = options.signal;
  let abortedByCaller = false;
  const onExternalAbort = () => {
    abortedByCaller = true;
    controller.abort();
  };
  if (externalSignal?.aborted) onExternalAbort();
  else externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      ...options,
      headers: { ...getAuthHeaders(), ...(options.headers || {}) },
      signal: controller.signal,
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data?.detail || `Lỗi máy chủ (HTTP ${resp.status}).`);
    }
    return data;
  } catch (err) {
    if (abortedByCaller) throw err;
    if (err.name === 'AbortError') {
      throw new Error(`Yêu cầu quá thời gian chờ (${Math.round(timeoutMs / 1000)}s).`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

/** Đọc trạng thái Runtime AI Local (Qwen3.5-4B, BGE-M3, RAM) và kho tri thức RAG. */
export function fetchOfflineChatStatus(options = {}) {
  return fetchJsonWithTimeout('/api/offline-chat/status', { method: 'GET', ...options }, STATUS_TIMEOUT_MS);
}

/** Chủ động nạp mô hình Qwen3.5-4B vào RAM trước khi hỏi đáp. */
export function startOfflineChatModel() {
  return fetchJsonWithTimeout('/api/offline-chat/model/start', { method: 'POST' }, CONTROL_TIMEOUT_MS);
}

/** Giải phóng Qwen3.5-4B và BGE-M3 khỏi RAM. */
export function stopOfflineChatModel() {
  return fetchJsonWithTimeout('/api/offline-chat/model/stop', { method: 'POST' }, STATUS_TIMEOUT_MS);
}

/** Cập nhật tăng dần hoặc xây dựng lại toàn bộ chỉ mục vector từ docs/knowledge/. */
export function reindexOfflineKnowledge(forceRebuild = false) {
  return fetchJsonWithTimeout(
    '/api/offline-chat/knowledge/reindex',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force_rebuild: Boolean(forceRebuild) }),
    },
    REINDEX_TIMEOUT_MS
  );
}

/** Gửi câu hỏi (chỉ gồm session_id, message, request_id) và đọc luồng SSE trả về từ Backend. */
export async function streamOfflineChatApi({
  sessionId = null,
  message,
  requestId,
  signal,
  onSession,
  onStatus,
  onSources,
  onChunk,
  onError,
  onDone,
}) {
  try {
    const resp = await fetch('/api/offline-chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({
        session_id: sessionId ?? null,
        message,
        request_id: requestId,
      }),
      signal,
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      onError?.(errData?.detail || `Máy chủ trả lỗi HTTP ${resp.status}.`);
      return;
    }

    if (!resp.body) {
      onError?.('Trình duyệt không hỗ trợ đọc luồng phản hồi SSE.');
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    const processLine = (rawLine) => {
      const line = rawLine.trim();
      if (!line.startsWith('data:')) return false;
      const dataStr = line.slice(5).trim();
      if (!dataStr) return false;
      if (dataStr === '[DONE]') return true;

      let parsed;
      try {
        parsed = JSON.parse(dataStr);
      } catch {
        return false;
      }

      if (parsed.session) {
        onSession?.(parsed.session, parsed.message_id);
      }
      if (parsed.error) {
        onError?.(parsed.error);
        return true;
      }
      if (parsed.status || parsed.message) {
        onStatus?.(parsed.status || '', parsed.message || '');
      }
      if (Array.isArray(parsed.sources)) {
        onSources?.(parsed.sources, Boolean(parsed.knowledge_empty));
      }
      if (typeof parsed.text === 'string' && parsed.text.length > 0) {
        onChunk?.(parsed.text);
      }
      return false;
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (processLine(line)) {
          onDone?.({ aborted: false });
          return;
        }
      }
    }

    if (buffer.trim()) {
      processLine(buffer);
    }
    onDone?.({ aborted: false });
  } catch (err) {
    if (err.name === 'AbortError') {
      onDone?.({ aborted: true });
      return;
    }
    onError?.(err.message || 'Mất kết nối tới máy chủ Chatbot RAG Offline.');
  }
}

/** Lấy danh sách các cuộc trò chuyện RAG Offline thuộc tài khoản hiện tại. */
export function fetchOfflineSessions({ limit = 50, offset = 0, signal } = {}) {
  return fetchJsonWithTimeout(
    `/api/offline-chat/sessions?limit=${limit}&offset=${offset}`,
    { method: 'GET', signal },
    STATUS_TIMEOUT_MS
  );
}

/** Khôi phục toàn bộ tin nhắn và nguồn tham khảo của một cuộc trò chuyện cũ. */
export function fetchOfflineSessionDetail(sessionId, { limit = 200, offset = 0, signal } = {}) {
  return fetchJsonWithTimeout(
    `/api/offline-chat/sessions/${sessionId}?limit=${limit}&offset=${offset}`,
    { method: 'GET', signal },
    STATUS_TIMEOUT_MS
  );
}

/** Đổi tiêu đề cuộc trò chuyện RAG Offline. */
export function renameOfflineSession(sessionId, title) {
  return fetchJsonWithTimeout(
    `/api/offline-chat/sessions/${sessionId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    },
    STATUS_TIMEOUT_MS
  );
}

/** Xóa cuộc trò chuyện RAG Offline khỏi cơ sở dữ liệu. */
export function deleteOfflineSession(sessionId) {
  return fetchJsonWithTimeout(
    `/api/offline-chat/sessions/${sessionId}`,
    { method: 'DELETE' },
    STATUS_TIMEOUT_MS
  );
}
