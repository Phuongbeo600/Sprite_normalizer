// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý giao diện và trạng thái)
// ========================================================
// Không phụ thuộc vào React.

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI
// ========================================================
// Không dùng thư viện bên ngoài.

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Thành phần giao diện và dữ liệu)
// ========================================================
// getAuthHeaders: Đính kèm JWT để backend xác minh quyền truy cập dự án.
import { getAuthHeaders } from '../../shared/api/authHeaders.js';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC
// ========================================================
// Không áp dụng cho tệp tiện ích.

/**
 * Gửi tệp hiện tại cùng các trường của đúng thao tác đang chọn.
 *
 * @param {File} file Tệp ảnh tham chiếu.
 * @param {string} url Tuyến API xử lý ảnh.
 * @param {Object} [fields={}] Các tùy chọn riêng của thao tác.
 * @returns {Promise<Object>} Kết quả xử lý ảnh từ máy chủ.
 */
export async function requestAnalysis(file, url, fields = {}) {
  const body = new FormData(); // form đóng gói ảnh thành nhị phân
  body.append('file', file); // thêm ảnh được nạp vào form
  Object.entries(fields).forEach(([name, value]) => body.append(name, value));
  const response = await fetch(url, { method: 'POST', headers: getAuthHeaders(), body });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.detail || 'Không xử lý được ảnh.');
  return payload;
}
