// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT
// ========================================================
// (Không có phụ thuộc nền tảng React)

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// (Sử dụng Fetch API và TextDecoder tiêu chuẩn của trình duyệt)

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
// ========================================================
// (Không có phụ thuộc nội bộ)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC (Stylesheets)
// ========================================================
// (Không áp dụng cho file API)

/**
 * Gửi yêu cầu hội thoại tới máy chủ backend và đọc luồng phản hồi thời gian thực qua Server-Sent Events (SSE).
 *
 * @param {Object} params Tham số cấu hình phát luồng hội thoại.
 * @param {Array<{role: string, content: string}>} params.messages Danh sách lịch sử tin nhắn.
 * @param {number|null} [params.projectId] Mã định danh dự án hiện tại (nếu có).
 * @param {string|null} [params.provider] Tên nhà cung cấp AI ('gemini', 'openai', 'deepseek', 'ollama').
 * @param {string|null} [params.apiKey] Khóa API tùy biến truyền từ giao diện (nếu có).
 * @param {string|null} [params.baseUrl] Địa chỉ máy chủ tùy biến (dành cho proxy hoặc Ollama local).
 * @param {AbortSignal} [params.signal] Tín hiệu hủy yêu cầu stream từ phía client.
 * @param {function(string): void} params.onChunk Hàm callback gọi khi nhận được từng mảnh chữ mới.
 * @param {function(string): void} params.onError Hàm callback gọi khi xảy ra lỗi kết nối hoặc backend báo lỗi.
 * @param {function(): void} params.onDone Hàm callback gọi khi luồng phát sinh hoàn tất trọn vẹn.
 * @returns {Promise<void>} Hoàn tất khi luồng kết thúc.
 */
export async function streamChatApi({
  messages,
  projectId = null,
  provider = null,
  apiKey = null,
  baseUrl = null,
  signal = null,
  onChunk,
  onError,
  onDone,
}) {
  try {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        project_id: projectId,
        provider,
        api_key: apiKey,
        base_url: baseUrl,
      }),
      signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.detail || `Máy chủ báo lỗi HTTP ${response.status}`;
      if (onError) onError(errorMsg);
      return;
    }

    if (!response.body) {
      if (onError) onError('Trình duyệt không hỗ trợ đọc luồng dữ liệu (ReadableStream).');
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
      // Giữ lại phần dư chưa kết thúc bằng ký tự xuống dòng ở cuối buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const dataContent = trimmed.slice(6).trim();
        if (dataContent === '[DONE]') {
          if (onDone) onDone();
          return;
        }

        try {
          const parsed = JSON.parse(dataContent);
          if (parsed.error) {
            if (onError) onError(parsed.error);
            return;
          }
          if (parsed.text && onChunk) {
            onChunk(parsed.text);
          }
        } catch {
          // Bỏ qua dòng json không trọn vẹn trong luồng
        }
      }
    }

    if (onDone) onDone();
  } catch (err) {
    if (err.name === 'AbortError') {
      // Người dùng chủ động bấm nút Dừng phản hồi
      if (onDone) onDone();
      return;
    }
    if (onError) onError(err.message || 'Lỗi mạng khi kết nối tới trợ lý AI.');
  }
}
