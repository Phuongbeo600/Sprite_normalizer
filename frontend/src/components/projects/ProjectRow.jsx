import React from 'react';
import { Folder, ChevronRight } from 'lucide-react';

/**
 * PROJECT ROW (Bản Tinh Giản - Hỗ Trợ Custom Icon)
 * 
 * - Nếu dự án có 'project.icon': Hiển thị file ảnh riêng (PNG, SVG, GIF...).
 * - Nếu để trống (icon: null) hoặc file ảnh chưa tải được: Tự động dùng icon Folder mặc định.
 */
export default function ProjectRow({ project, onOpen }) {
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

      {/* Thông tin chính */}
      <div className="project-text-content">
        <h3 className="project-title-name">{project.name}</h3>
        <p className="project-subtitle-status">
          {project.statusText || 'Cập nhật gần đây'}
        </p>
      </div>

      {/* Mũi tên chuyển trang > */}
      <div className="chevron-arrow-box">
        <ChevronRight size={18} />
      </div>
    </div>
  );
}
