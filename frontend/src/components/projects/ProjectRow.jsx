// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & giao diện)
// ========================================================
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Biểu tượng thư mục, mũi tên điều hướng, thùng rác, tia sáng và gamepad
import {
  Folder,
  ChevronRight,
  Trash2,
  Sparkles,
  Gamepad2,
  Layers,
  ArrowUpRight
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không có component con phụ thuộc)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark Fantasy Atelier từ dashboard-atelier.css

/**
 * Thành phần hiển thị dự án hỗ trợ cả 2 chế độ:
 * 1. Chế độ Thẻ Lưới Trực Quan (Grid Gallery Card)
 * 2. Chế độ Dòng Danh Sách Kỹ Thuật (Technical List Row)
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object} props.project Dữ liệu của một dự án (id, name, icon...).
 * @param {Function} props.onOpen Hàm mở dự án khi nhấp chuột.
 * @param {Function} [props.onDelete] Hàm gọi xóa dự án khi nhấn nút thùng rác.
 * @param {string} [props.viewMode='grid'] Chế độ hiển thị: 'grid' hoặc 'list'.
 * @param {number} [props.index=0] Thứ tự dự án để tạo nét nhận diện ngẫu nhiên.
 * @returns {React.ReactElement} Giao diện thẻ hoặc dòng dự án.
 */
export default function ProjectRow({
  project,
  onOpen,
  onDelete,
  viewMode = 'grid',
  index = 0
}) {
  // Lựa chọn icon chủ đề pixel art fantasy phù hợp cho dự án
  const renderFallbackIcon = () => {
    const mod = index % 3;
    if (mod === 0) return <Gamepad2 size={24} />;
    if (mod === 1) return <Layers size={24} />;
    return <Sparkles size={24} />;
  };

  // CHẾ ĐỘ 1: THẺ LƯỚI TRỰC QUAN (GRID CARD VIEW)
  if (viewMode === 'grid') {
    return (
      <div
        className="atelier-project-grid-card"
        onClick={() => onOpen(project)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onOpen(project);
        }}
        title={`Mở bản vẽ dự án: ${project.name}`}
      >
        {/* 1. Vùng Khung Nhìn Thumbnail (Mô phỏng bàn vẽ pixel art) */}
        <div className="atelier-card-thumbnail-stage">
          {/* Huy hiệu ID dự án ở góc */}
          <span className="atelier-card-badge-id">#{project.id}</span>

          {project.icon ? (
            <img
              src={project.icon}
              alt={project.name}
              className="atelier-card-sprite-icon"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.parentElement.querySelector('.atelier-card-fallback-avatar');
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          ) : null}

          <div
            className="atelier-card-fallback-avatar"
            style={{ display: project.icon ? 'none' : 'flex' }}
          >
            {renderFallbackIcon()}
          </div>
        </div>

        {/* 2. Thân Thẻ Dự Án (Tiêu đề, trạng thái, thẻ tag) */}
        <div className="atelier-card-body">
          <h3 className="atelier-card-title">{project.name}</h3>
          <p className="atelier-card-status-text">
            <span className="atelier-card-status-dot" />
            <span>{project.statusText || 'Bản vẽ sẵn sàng'}</span>
          </p>
        </div>

        {/* 3. Chân Thẻ Dự Án (Nút mở + Nút xóa) */}
        <div className="atelier-card-footer" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="atelier-card-open-btn"
            onClick={() => onOpen(project)}
            title="Mở không gian làm việc của dự án này"
          >
            <span>Mở dự án</span>
            <ArrowUpRight size={15} />
          </button>

          {onDelete && (
            <button
              type="button"
              className="atelier-card-delete-btn"
              onClick={() => onDelete(project)}
              title={`Xóa dự án "${project.name}" khỏi CSDL`}
              aria-label={`Xóa dự án ${project.name}`}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>
    );
  }

  // CHẾ ĐỘ 2: DÒNG DANH SÁCH KỸ THUẬT (LIST VIEW)
  return (
    <div
      className="atelier-list-row"
      onClick={() => onOpen(project)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen(project);
      }}
    >
      {/* Icon đại diện */}
      <div className="atelier-list-icon">
        {project.icon ? (
          <img
            src={project.icon}
            alt={project.name}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.parentElement.querySelector('.atelier-list-fallback');
              if (fallback) fallback.style.display = 'block';
            }}
          />
        ) : null}
        <Folder
          size={18}
          className="atelier-list-fallback"
          style={{ display: project.icon ? 'none' : 'block' }}
        />
      </div>

      {/* Thông tin chính */}
      <div className="atelier-list-main-info">
        <h3 className="atelier-list-title">{project.name}</h3>
        <p className="atelier-list-sub">
          {project.statusText || 'Cập nhật gần đây'}
        </p>
      </div>

      {/* Thẻ meta tag */}
      <div className="atelier-list-meta-tag">
        ID: #{project.id}
      </div>

      {/* Nút Xóa Dự Án */}
      {onDelete && (
        <button
          type="button"
          className="atelier-card-delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(project);
          }}
          title={`Xóa dự án "${project.name}"`}
          aria-label={`Xóa dự án ${project.name}`}
        >
          <Trash2 size={16} />
        </button>
      )}

      {/* Mũi tên điều hướng */}
      <div style={{ color: 'var(--atl-text-tertiary)', display: 'flex' }}>
        <ChevronRight size={18} />
      </div>
    </div>
  );
}
