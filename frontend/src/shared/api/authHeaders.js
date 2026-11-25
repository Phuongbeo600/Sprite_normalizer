// 1. THƯ VIỆN NỀN TẢNG (Lưu trữ phiên của trình duyệt)
// localStorage: Đọc token của tài khoản đã đăng nhập, không cần import.

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Không sử dụng)

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)

/** Đọc JWT hiện tại; trả header rỗng nếu phiên thiếu, hỏng hoặc lưu trữ bị chặn. */
export function getAuthHeaders() {
  try {
    const user = JSON.parse(localStorage.getItem('sprite_current_user') || 'null');
    if (typeof user?.access_token === 'string' && user.access_token.trim()) {
      return { Authorization: `Bearer ${user.access_token.trim()}` };
    }
  } catch {
    // Backend vẫn quyết định quyền truy cập khi không có phiên đăng nhập hợp lệ.
  }
  return {};
}
