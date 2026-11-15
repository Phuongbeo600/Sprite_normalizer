// 1. THƯ VIỆN NỀN TẢNG REACT

// 2. THƯ VIỆN BÊN NGOÀI

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN

// 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC

/**
 * Gửi dữ liệu xác thực hoặc hồ sơ dưới dạng JSON.
 *
 * @param {string} action Đoạn đường dẫn trong nhóm API tài khoản.
 * @param {string} method Phương thức HTTP.
 * @param {Object} payload Dữ liệu đã được kiểm tra ở biểu mẫu.
 * @returns {Promise<Response>} Phản hồi để biểu mẫu tự xử lý trạng thái.
 */
function sendAuthJson(action, method, payload) {
  return fetch('/api/auth/' + action, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

/**
 * Gửi thông tin đăng nhập từ biểu mẫu hoặc sau khi đăng ký.
 *
 * @param {string} username Tên đăng nhập đã bỏ khoảng trắng thừa.
 * @param {string} password Mật khẩu đã bỏ khoảng trắng thừa.
 * @returns {Promise<Response>} Phản hồi đăng nhập.
 */
export function login(username, password) {
  return sendAuthJson('login', 'POST', { username, password });
}

/**
 * Gửi dữ liệu đăng ký đã qua kiểm tra.
 *
 * @param {Object} payload Tên đăng nhập, mật khẩu và các trường họ tên.
 * @returns {Promise<Response>} Phản hồi đăng ký.
 */
export function register(payload) {
  return sendAuthJson('register', 'POST', payload);
}

/**
 * Gửi dữ liệu cập nhật hồ sơ hoặc đổi mật khẩu.
 *
 * @param {Object} payload Mã tài khoản và các trường cần cập nhật.
 * @returns {Promise<Response>} Phản hồi cập nhật hồ sơ.
 */
export function updateProfile(payload) {
  return sendAuthJson('profile', 'PUT', payload);
}
