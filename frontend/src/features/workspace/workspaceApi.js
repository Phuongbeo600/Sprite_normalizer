// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
// Không có phụ thuộc React.

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Các gói cài đặt thêm)
// ========================================================
// Dùng các API có sẵn của trình duyệt.

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Component và dữ liệu)
// ========================================================
// Không có phụ thuộc nội bộ.

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Tệp kiểu giao diện)
// ========================================================
// Không dùng tệp kiểu giao diện.

/**
 * Gửi ảnh và thông số xử lý đến backend FastAPI.
 *
 * @param {File} file Ảnh nguồn cần xử lý.
 * @param {string} route Tuyến API backend xử lý ảnh.
 * @param {Object} fields Thông số cấu hình của thao tác.
 * @param {AbortSignal} [signal] Tín hiệu hủy yêu cầu khi ảnh nguồn thay đổi.
 * @returns {Promise<Response>} Phản hồi từ máy chủ chứa ảnh hoặc kết quả phân tách frame.
 */
export async function processImage(file, route, fields, signal) {
  const body = new FormData();
  body.append('file', file);
  Object.entries(fields).forEach(([name, value]) => body.append(name, String(value)));
  const response = await fetch(`/api/${route}`, { method: 'POST', body, signal });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      typeof payload?.detail === 'string'
        ? payload.detail
        : 'Không xử lý được ảnh. Kiểm tra thông số và kết nối backend.'
    );
  }
  return response;
}

/**
 * Lưu ảnh nguồn của dự án và báo lại mã bản ghi khi máy chủ trả về.
 *
 * @param {File} file Ảnh nguồn cần lưu.
 * @param {number|string} projectId Mã dự án hiện tại.
 * @param {string} fallbackName Tên thay thế khi tệp ảnh không có tên.
 * @param {Function} onSaved Hàm nhận mã bản ghi ảnh đã lưu.
 * @returns {void}
 */
export function saveRawSprite(file, projectId, fallbackName, onSaved) {
  const form = new FormData();
  form.append('file', file);
  form.append('project_id', projectId);
  form.append('name', file.name || fallbackName);
  fetch('/api/sprites/save-raw', { method: 'POST', body: form })
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data && data.id) {
        onSaved(data.id);
      }
    })
    .catch((err) => console.error('Lỗi khi lưu ảnh gốc vào MySQL:', err));
}

/**
 * Lưu ảnh sau xử lý vào bản ghi của ảnh nguồn.
 *
 * @param {Blob} blob Nội dung ảnh sau xử lý.
 * @param {number|string} projectId Mã dự án hiện tại.
 * @param {number|string} spriteId Mã bản ghi ảnh nguồn.
 * @returns {void}
 */
export function saveProcessedSprite(blob, projectId, spriteId) {
  const form = new FormData();
  form.append('file', blob, 'processed.png');
  form.append('project_id', projectId);
  fetch(`/api/sprites/${spriteId}/save-processed`, { method: 'POST', body: form })
    .catch((err) => console.error('Lỗi khi lưu ảnh tối ưu vào MySQL:', err));
}

/**
 * Phân tích và lấy toàn bộ bảng màu gốc của ảnh sprite qua backend.
 *
 * @param {File|Blob} file Tệp ảnh sprite cần phân tích màu.
 * @param {AbortSignal} [signal] Tín hiệu hủy yêu cầu mạng.
 * @returns {Promise<Object>} Báo cáo trắc lượng màu sắc gồm danh sách bảng màu chi tiết.
 */
export async function analyzeSpriteColors(file, signal) {
  const body = new FormData();
  body.append('file', file);

  const response = await fetch('/api/sprites/analyze-colors', { method: 'POST', body, signal });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      typeof payload?.detail === 'string'
        ? payload.detail
        : 'Không thể phân tích bảng màu của ảnh sprite.'
    );
  }
  return response.json();
}
