// 1. THƯ VIỆN NỀN TẢNG (Dựng khung cửa sổ tài nguyên)
import React from 'react';

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Nội dung được truyền từ từng loại tài nguyên)

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Kế thừa stylesheet của kho tài nguyên)

/** Giữ cùng hai lớp DOM và cơ chế đóng bằng nền của các cửa sổ chi tiết. */
export default function AssetDetailModal({ onClose, boxStyle, children }) {
  return (
    <div className="atelier-assets-modal-overlay" onClick={onClose}>
      <div className="atelier-assets-modal-box" style={boxStyle} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
