// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & giao diện)
// ========================================================
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Biểu tượng thư mục, mũi tên điều hướng và thùng rác xóa dự án
import { Folder, ChevronRight, Trash2 } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không có component con phụ thuộc)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark UI từ theme.css thông qua index.css

/**
 * Thành phần hiển thị một dòng thẻ dự án (Project Row).
 * Hỗ trợ hiển thị tên, trạng thái cập nhật, icon riêng và nút xóa dự án:
 * - Khi nhấn vào hàng: Kích hoạt sự kiện mở dự án.
 * - Khi nhấn vào icon thùng rác: Kích hoạt xóa dự án mà không mở dự án.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object} props.project Dữ liệu của một dự án (id, name, icon...).
 * @param {Function} props.onOpen Hàm mở dự án khi nhấp chuột vào dòng thẻ.
 * @param {Function} [props.onDelete] Hàm gọi xóa dự án khi nhấn nút thùng rác.
 * @returns {React.ReactElement} Giao diện hàng thẻ dự án.
 */
export default function ProjectRow({ project, onOpen, onDelete }) {
  return (
    <div 
      className="minimal-project-row"
      onClick={() => onOpen(project)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen(project);
      }}
    >
      {/* Khung Icon Dự Án (Hỗ trợ ảnh riêng của bạn) */}
      <div className="folder-icon-box">
        {project.icon ? (
          <img
            src={project.icon}
            alt={project.name}
            className="custom-project-icon-img"
            onError={(e) => {
              // Tự động chuyển về icon Folder nếu đường dẫn ảnh bị lỗi/chưa có file
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.parentElement.querySelector('.fallback-folder-icon');
              if (fallback) fallback.style.display = 'block';
            }}
          />
        ) : null}

        <Folder
          size={20}
          className="folder-icon-svg fallback-folder-icon"
          style={{ display: project.icon ? 'none' : 'block' }}
        />
      </div>

      {/* Thông tin chính của dự án */}
      <div className="project-text-content">
        <h3 className="project-title-name">{project.name}</h3>
        <p className="project-subtitle-status">
          {project.statusText || 'Cập nhật gần đây'}
        </p>
      </div>

      {/* Nút Xóa Dự Án (Icon thùng rác, ngăn chặn mở dự án khi bấm) */}
      {onDelete && (
        <button
          type="button"
          className="btn-delete-project-action"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(project);
          }}
          title={`Xóa dự án "${project.name}"`}
          aria-label={`Xóa dự án ${project.name}`}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            padding: '7px 9px',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '8px',
            transition: 'all 0.2s ease',
            zIndex: 2
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ef4444';
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.16)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#94a3b8';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <Trash2 size={16} />
        </button>
      )}

      {/* Mũi tên chuyển trang > */}
      <div className="chevron-arrow-box">
        <ChevronRight size={18} />
      </div>
    </div>
  );
}
