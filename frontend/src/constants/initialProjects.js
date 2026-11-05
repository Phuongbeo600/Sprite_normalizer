/**
 * INITIAL PROJECTS DATA
 * 
 * MẸO THÊM ICON RIÊNG:
 * - Thả ảnh của bạn (png, svg, jpg, gif...) vào thư mục: frontend/public/icons/
 * - Điền tên file vào trường 'icon' bên dưới, ví dụ: icon: '/icons/ten_anh.png'
 * - Cứ để icon: null nếu chưa có, hệ thống sẽ tự dùng icon mặc định!
 */

export const INITIAL_PROJECTS = [
  {
    id: 'proj_1',
    name: 'Thử nghiệm asset',
    statusText: 'Cập nhật gần đây',
    path: 'E:/Đại học Uet/.../thử-nghiệm-asset',
    icon: null, // [ĐỂ TRỐNG ĐÂY]: Khi nào có ảnh bạn điền ví dụ: '/icons/knight.png'
  },
  {
    id: 'proj_2',
    name: 'Hiệp sĩ và Công chúa Quỷ',
    statusText: 'Cập nhật gần đây',
    path: 'E:/Indi_Game/src',
    icon: null, // [ĐỂ TRỐNG ĐÂY]: ví dụ '/icons/princess.png'
  },
  {
    id: 'proj_3',
    name: 'Pixel Sword Hero',
    statusText: 'Cập nhật gần đây',
    path: 'E:/Lien_quan_godot_game/Try_art_pixel',
    icon: null, // [ĐỂ TRỐNG ĐÂY]: ví dụ '/icons/hero.png'
  },
];

export const APP_CONFIG = {
  // Logo góc trên Sidebar: Để null sẽ dùng icon Bot mặc định, hoặc điền ví dụ: '/icons/logo.png'
  customLogoUrl: null,
};

export const CURRENT_USER = {
  name: 'Tài khoản',
  subtitle: 'Hồ sơ',
  initials: 'PH',
  avatarUrl: null, // Để null dùng avatar chữ "PH", hoặc điền '/icons/avatar.png'
};
