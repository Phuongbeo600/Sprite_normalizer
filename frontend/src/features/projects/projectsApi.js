// 1. THƯ VIỆN NỀN TẢNG REACT

// 2. THƯ VIỆN BÊN NGOÀI

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN

// 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC

/**
 * Yêu cầu danh sách dự án theo tài khoản đăng nhập.
 *
 * @param {Object|null} user Tài khoản hiện tại, có thể chưa được xác định.
 * @param {AbortSignal} signal Tín hiệu hủy khi rời màn hình hoặc đổi tài khoản.
 * @returns {Promise<Response>} Phản hồi từ máy chủ.
 */
export function listProjects(user, signal) {
  const queryParams = new URLSearchParams();
  if (user?.id) queryParams.append('user_id', user.id);
  if (user?.role) queryParams.append('role', user.role);

  const query = queryParams.toString();
  return fetch(query ? '/api/projects?' + query : '/api/projects', { signal });
}

/**
 * Gửi biểu mẫu tạo dự án.
 *
 * @param {FormData} body Tên dự án và mã tài khoản nếu có.
 * @returns {Promise<Response>} Phản hồi từ máy chủ.
 */
export function createProject(body) {
  return fetch('/api/projects', { method: 'POST', body });
}

/**
 * Gửi yêu cầu xóa dự án sau khi người dùng xác nhận.
 *
 * @param {number} projectId Mã dự án cần xóa.
 * @returns {Promise<Response>} Phản hồi từ máy chủ.
 */
export function deleteProject(projectId) {
  return fetch('/api/projects/' + projectId, { method: 'DELETE' });
}
