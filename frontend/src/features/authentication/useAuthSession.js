// 1. THƯ VIỆN NỀN TẢNG (Phiên đăng nhập tại App)
import { useState } from 'react';

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Giữ chính sách tài khoản và lưu trữ hiện tại)

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)

/** Sở hữu tài khoản và việc ghi localStorage; App tiếp tục điều phối điều hướng. */
export function useAuthSession() {
  // Trạng thái tài khoản người dùng hiện đang đăng nhập (lưu trong localStorage)
  // Mặc định khi chạy dự án: tự động đăng nhập vào tài khoản kiểm thử origin@gmail.com (id: 2)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('sprite_current_user');
      if (saved) return JSON.parse(saved);
      if (import.meta.env?.PROD) return null;

      // Nếu trước đó người dùng chủ động bấm Đăng xuất thì giữ ở màn hình đăng nhập
      const isLoggedOut = localStorage.getItem('sprite_logged_out');
      if (isLoggedOut === 'true') return null;

      // Mặc định tự động đăng nhập vào tài khoản origin@gmail.com để phục vụ kiểm thử
      return {
        id: 2,
        username: 'origin@gmail.com',
        role: 'user',
        first_name: 'Origin',
        last_name: 'Tester',
        full_name: 'Origin (Tài khoản mẫu kiểm thử)',
        avatar_url: ''
      };
    } catch {
      return null;
    }
  });

  const updateProfile = (updatedUser) => {
    setCurrentUser(updatedUser);
    try {
      localStorage.setItem('sprite_current_user', JSON.stringify(updatedUser));
    } catch {}
  };

  const loginUser = (user) => {
    try {
      localStorage.removeItem('sprite_logged_out');
      localStorage.setItem('sprite_current_user', JSON.stringify(user));
    } catch {}
    setCurrentUser(user);
  };

  const logoutUser = () => {
    try {
      localStorage.setItem('sprite_logged_out', 'true');
      localStorage.removeItem('sprite_current_user');
    } catch {}

    setCurrentUser(null);
  };

  return { currentUser, updateProfile, loginUser, logoutUser };
}
