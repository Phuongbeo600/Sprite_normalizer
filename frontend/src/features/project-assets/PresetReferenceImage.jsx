// 1. THƯ VIỆN NỀN TẢNG (Hiển thị ảnh đã lưu)
// React: Dựng ảnh tham chiếu trong danh sách và chi tiết hồ sơ.
import React from 'react';

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Không sử dụng)

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Kế thừa kiểu ảnh từ presets-atelier.css của kho hồ sơ.

/** Hồ sơ cũ không có ảnh giữ nguyên giao diện; hồ sơ mới hiển thị ảnh tham chiếu đã lưu. */
export default function PresetReferenceImage({ image, name, detail = false }) {
  if (!image) return null;
  return <div className={`atelier-preset-reference${detail ? ' detail' : ''}`}>
    <img src={image} alt={`Ảnh tham chiếu đã phân tích: ${name || 'sprite mẫu'}`} loading="lazy" />
  </div>;
}
