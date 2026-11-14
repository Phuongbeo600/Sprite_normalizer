// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & giao diện)
// ========================================================
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Biểu tượng dấu cộng phục vụ tạo dự án mới
import { Plus } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không có component con phụ thuộc)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa định dạng nút bấm từ theme.css thông qua index.css

/**
 * Thanh nút tác vụ danh sách dự án (Action Bar).
 * Chỉ giữ lại nút "+ Tạo dự án" theo yêu cầu tinh giản giao diện.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Function} props.onCreateProject Hàm xử lý mở hộp thoại tạo dự án mới.
 * @returns {React.ReactElement} Giao diện thanh thao tác.
 */
export default function ActionBar({ onCreateProject }) {
  return (
    <div className="minimal-action-bar">
      <button 
        type="button"
        className="btn-create-purple" 
        onClick={onCreateProject}
        title="Tạo một dự án sprite mới"
      >
        <Plus size={15} strokeWidth={2.5} />
        <span>Tạo dự án</span>
      </button>
    </div>
  );
}
