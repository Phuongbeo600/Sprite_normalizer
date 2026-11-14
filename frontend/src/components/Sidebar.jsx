// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ biểu tượng vector SVG cho logo và các mục điều hướng Sidebar
import { Folder, Settings, Bot, ScanSearch, Image, Bookmark, Sliders, Gamepad2, Sparkles, FolderOpen, Lock } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// initialProjects: Cấu hình logo và thông tin tài khoản hiển thị cuối thanh
import { CURRENT_USER, APP_CONFIG } from '../constants/initialProjects';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark UI từ theme.css

/**
 * Thanh điều hướng chính bên trái (Sidebar).
 * Hỗ trợ phân định rõ ràng giữa chế độ Tổng quan (Danh sách Dự án)
 * và chế độ Làm việc bên trong một Dự án cụ thể:
 * - Khi đang mở dự án:
 *   1. Phân tích & Prompt
 *   2. Xử lý ảnh
 *   3. Hồ sơ đã lưu (Nằm dưới "Xử lý ảnh")
 *   4. Thử nghiệm Godot (Môi trường test nhân vật chuẩn Godot Engine 4)
 *   5. Cài đặt dự án (Quản lý API Key riêng của dự án)
 * - Khi ở ngoài:
 *   1. Dự án
 *   2. Cài đặt chung (Đã gỡ bỏ ô nhập key theo yêu cầu)
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {string} props.activeTab Mục đang được kích hoạt hiển thị.
 * @param {Object|null} props.currentProject Dự án đang được mở.
 * @param {Function} props.onSelectTab Hàm chuyển đổi mục hiển thị.
 * @param {boolean} [props.isAiEnabled=true] Trạng thái bật/tắt toàn bộ tính năng AI trong dự án.
 * @returns {React.ReactElement} Giao diện thanh Sidebar.
 */
export default function Sidebar({ activeTab, currentProject, onSelectTab, isAiEnabled = true }) {
  return (
    <aside className="minimal-sidebar">
      <div>
        {/* 1. Logo Tinh Giản: Icon riêng hoặc Bot mặc định */}
        <div className="minimal-logo">
          {APP_CONFIG?.customLogoUrl ? (
            <img
              src={APP_CONFIG.customLogoUrl}
              alt="Logo"
              className="custom-logo-img"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <Bot size={22} className="logo-icon" />
          )}
          <span className="logo-text">Sprite AI</span>
        </div>

        {/* 2. Menu Điều Hướng */}
        <nav className="minimal-nav">
          {currentProject ? (
            <>
              {/* Mục 1: Phân tích & Prompt */}
              <button
                className={`minimal-nav-item ${activeTab === 'analysis' ? 'active' : ''}`}
                onClick={() => onSelectTab('analysis')}
              >
                <ScanSearch size={18} />
                <span>Phân tích &amp; Prompt</span>
              </button>

              {/* Mục 2: Tạo ảnh AI */}
              <button
                className={`minimal-nav-item ${activeTab === 'image_gen' ? 'active' : ''}`}
                onClick={() => onSelectTab('image_gen')}
                style={{ opacity: isAiEnabled ? 1 : 0.75 }}
                title={!isAiEnabled ? 'Tính năng AI đang tắt trong Cài đặt dự án' : 'Tạo ảnh AI Sprite Sheet'}
              >
                <Sparkles size={18} />
                <span>Tạo ảnh AI</span>
                {!isAiEnabled && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: '0.625rem',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px'
                    }}
                  >
                    <Lock size={9} />
                    Tắt
                  </span>
                )}
              </button>

              {/* Mục 3: Xử lý ảnh */}
              <button
                className={`minimal-nav-item ${activeTab === 'workspace' ? 'active' : ''}`}
                onClick={() => onSelectTab('workspace')}
              >
                <Image size={18} />
                <span>Xử lý ảnh</span>
              </button>

              {/* Mục 4: Kho tài nguyên dự án (Quản lý hồ sơ, ảnh sprite, đội hình Godot, map nền) */}
              <button
                className={`minimal-nav-item ${activeTab === 'saved_presets' ? 'active' : ''}`}
                onClick={() => onSelectTab('saved_presets')}
              >
                <FolderOpen size={18} />
                <span>Kho tài nguyên</span>
              </button>

              {/* Mục 4: Thử nghiệm Godot (Kiểm thử nhân vật & xuất scene Godot 4) */}
              <button
                className={`minimal-nav-item ${activeTab === 'godot_testbed' ? 'active' : ''}`}
                onClick={() => onSelectTab('godot_testbed')}
              >
                <Gamepad2 size={18} />
                <span>Thử nghiệm Godot</span>
              </button>

              {/* Mục 5: Cài đặt dự án (Cấu hình API Key riêng cho dự án này) */}
              <button
                className={`minimal-nav-item ${activeTab === 'project_settings' ? 'active' : ''}`}
                onClick={() => onSelectTab('project_settings')}
              >
                <Sliders size={18} />
                <span>Cài đặt dự án</span>
              </button>
            </>
          ) : (
            <button
              className={`minimal-nav-item ${activeTab === 'projects' ? 'active' : ''}`}
              onClick={() => onSelectTab('projects')}
            >
              <Folder size={18} />
              <span>Dự án</span>
            </button>
          )}

          {/* Mục Cài đặt chung khi ở ngoài danh sách dự án */}
          {!currentProject && (
            <button
              className={`minimal-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => onSelectTab('settings')}
            >
              <Settings size={18} />
              <span>Cài đặt</span>
            </button>
          )}
        </nav>
      </div>

      {/* 3. Phần Đáy: Divider & Card Tài Khoản */}
      <div className="minimal-sidebar-bottom">
        <div className="sidebar-divider" />
        <div
          className="minimal-user-card"
          title="Quản lý tài khoản"
          role="button"
          tabIndex={0}
        >
          <div className="minimal-user-avatar">
            {CURRENT_USER.avatarUrl ? (
              <img
                src={CURRENT_USER.avatarUrl}
                alt="Avatar"
                className="custom-user-avatar-img"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              CURRENT_USER.initials
            )}
          </div>
          <div className="minimal-user-info">
            <span className="minimal-user-name">{CURRENT_USER.name}</span>
            <span className="minimal-user-email">{CURRENT_USER.email}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
