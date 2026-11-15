/**
 * Danh sách định nghĩa các ô mẫu (Slot Template) cho bộ hoạt họa 3 hướng.
 * Mỗi ô có nhãn hướng dẫn cụ thể về tên file và vai trò frame để người dùng
 * biết chính xác ảnh nào cần đưa vào ô nào.
 */
export const SLOT_DEFINITIONS_3_ROWS = [
  // Hàng 1: Hướng Nhìn Xuống (Down / Mặt trước)
  { id: 'down_0', row: 0, col: 0, direction: 'down', role: 'idle', label: 'idle_down', desc: 'Đứng yên' },
  { id: 'down_1', row: 0, col: 1, direction: 'down', role: 'walk', label: 'walk_down_0', desc: 'Bước 1' },
  { id: 'down_2', row: 0, col: 2, direction: 'down', role: 'walk', label: 'walk_down_1', desc: 'Bước 2' },
  { id: 'down_3', row: 0, col: 3, direction: 'down', role: 'walk', label: 'walk_down_2', desc: 'Bước 3' },
  { id: 'down_4', row: 0, col: 4, direction: 'down', role: 'walk', label: 'walk_down_3', desc: 'Bước 4' },

  // Hàng 2: Hướng Nhìn Ngang (Side / Đi nghiêng)
  { id: 'side_0', row: 1, col: 0, direction: 'side', role: 'idle', label: 'idle_side', desc: 'Đứng yên' },
  { id: 'side_1', row: 1, col: 1, direction: 'side', role: 'walk', label: 'walk_side_0', desc: 'Bước 1' },
  { id: 'side_2', row: 1, col: 2, direction: 'side', role: 'walk', label: 'walk_side_1', desc: 'Bước 2' },
  { id: 'side_3', row: 1, col: 3, direction: 'side', role: 'walk', label: 'walk_side_2', desc: 'Bước 3' },
  { id: 'side_4', row: 1, col: 4, direction: 'side', role: 'walk', label: 'walk_side_3', desc: 'Bước 4' },

  // Hàng 3: Hướng Nhìn Lên (Up / Sau lưng)
  { id: 'up_0', row: 2, col: 0, direction: 'up', role: 'idle', label: 'idle_up', desc: 'Đứng yên' },
  { id: 'up_1', row: 2, col: 1, direction: 'up', role: 'walk', label: 'walk_up_0', desc: 'Bước 1' },
  { id: 'up_2', row: 2, col: 2, direction: 'up', role: 'walk', label: 'walk_up_1', desc: 'Bước 2' },
  { id: 'up_3', row: 2, col: 3, direction: 'up', role: 'walk', label: 'walk_up_2', desc: 'Bước 3' },
  { id: 'up_4', row: 2, col: 4, direction: 'up', role: 'walk', label: 'walk_up_3', desc: 'Bước 4' },
];
