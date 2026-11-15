// 1. THƯ VIỆN NỀN TẢNG REACT

// 2. THƯ VIỆN BÊN NGOÀI

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN

// 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC

/**
 * Tạo đường dẫn cấu hình AI của dự án.
 *
 * @param {number} projectId Mã dự án.
 * @returns {string} Đường dẫn API cấu hình dự án.
 */
function projectApiConfigUrl(projectId) {
  return '/api/projects/' + projectId + '/api-config';
}

/**
 * Đọc cấu hình dự án cho màn cài đặt hoặc khi mở dự án.
 *
 * @param {number} projectId Mã dự án.
 * @returns {Promise<Response>} Phản hồi cấu hình để từng nơi gọi xử lý lỗi.
 */
export function getProjectApiConfig(projectId) {
  return fetch(projectApiConfigUrl(projectId));
}

/**
 * Lưu cấu hình nhà cung cấp hoặc trạng thái bật tắt AI.
 *
 * @param {number} projectId Mã dự án.
 * @param {Object} payload Các trường cấu hình cần lưu.
 * @returns {Promise<Response>} Phản hồi lưu cấu hình.
 */
export function saveProjectApiConfig(projectId, payload) {
  return fetch(projectApiConfigUrl(projectId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}
