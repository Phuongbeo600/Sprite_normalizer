// 1. THƯ VIỆN NỀN TẢNG (Fetch có sẵn trong trình duyệt)

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Hợp đồng API tạo ảnh hiện tại)
// getAuthHeaders: Gửi phiên đăng nhập khi đọc và dùng cấu hình dự án.
import { getAuthHeaders } from '../../shared/api/authHeaders.js';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)

/** Đọc cấu hình ngoại tuyến theo dự án, không gọi nhà cung cấp AI. */
export function requestImageGenerationStatus(projectId) {
  const query = projectId ? `?project_id=${projectId}` : '';
  return fetch(`/api/image-gen/status${query}`, { headers: getAuthHeaders() });
}

/** Gửi đúng payload tạo ảnh; workflow sở hữu diễn giải phản hồi và thông báo. */
export function requestGenerateImages(payload) {
  return fetch('/api/image-gen/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });
}
