// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// ChevronDown: Mũi tên chỉ hướng đóng mở của khung accordion
import { ChevronDown } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Schemas)
// ========================================================
// (Không có phụ thuộc nội bộ)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa định dạng từ workspace-atelier.css

/**
 * Khung thẻ gập mở (Accordion Collapsible Card) chuẩn phong cách Atelier Studio.
 * Cho phép người dùng bấm vào thanh tiêu đề để thu gọn hoặc mở rộng nội dung bên trong,
 * tạo không gian làm việc gọn gàng và dễ dàng mở rộng thêm các tính năng mới trong tương lai.
 *
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {string} props.title Tiêu đề của khung (ví dụ: "Thu nhỏ ảnh", "Chuẩn hóa & Điểm neo").
 * @param {React.ComponentType} [props.icon] Biểu tượng Lucide hiển thị cạnh tiêu đề.
 * @param {boolean} [props.isOpen=true] Trạng thái đang mở rộng hay thu gọn.
 * @param {Function} props.onToggle Hàm chuyển đổi trạng thái đóng/mở.
 * @param {React.ReactNode} props.children Nội dung chi tiết bên trong khung.
 * @param {string} [props.className] Lớp CSS tùy biến bổ sung.
 * @returns {React.ReactElement} Khung thẻ gập mở Accordion.
 */
export default function CollapsibleCard({
  title,
  icon: IconComponent,
  isOpen = true,
  onToggle,
  children,
  className = '',
}) {
  return (
    <div className={`atelier-collapsible-card ${isOpen ? 'is-open' : 'is-collapsed'} ${className}`}>
      <button
        type="button"
        className="atelier-collapsible-header"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <div className="atelier-collapsible-title-wrap">
          {IconComponent && <IconComponent size={15} className="atelier-collapsible-icon" />}
          <span className="atelier-collapsible-title">{title}</span>
        </div>
        <div className={`atelier-collapsible-chevron ${isOpen ? 'is-open' : ''}`}>
          <ChevronDown size={16} />
        </div>
      </button>

      {isOpen && (
        <div className="atelier-collapsible-body">
          {children}
        </div>
      )}
    </div>
  );
}
