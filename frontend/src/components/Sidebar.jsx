// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ biểu tượng vector SVG cho logo, điều hướng Sidebar, đăng xuất và quản trị admin
import {
  Folder,
  Settings,
  Bot,
  ScanSearch,
  Image,
  Bookmark,
  Sliders,
  Gamepad2,
  Sparkles,
  FolderOpen,
  Lock,
  Users,
  LogOut,
  ShieldCheck
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// initialProjects: Cấu hình logo hiển thị ở đầu thanh
import { APP_CONFIG } from '../constants/initialProjects';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark UI từ theme.css

/**
 * Thanh điều hướng chính bên trái (Sidebar).
 * Hỗ trợ phân định rõ ràng giữa chế độ Tổng quan (Danh sách Dự án, Quản trị Admin)
 * và chế độ Làm việc bên trong một Dự án cụ thể:
 * - Khi đang mở dự án:
 *   1. Phân tích & Prompt
 *   2. Tạo ảnh AI (kèm huy hiệu khóa nếu tắt AI)
 *   3. Xử lý ảnh
 *   4. Kho tài nguyên
 *   5. Thử nghiệm Godot
 *   6. Cài đặt dự án
 * - Khi ở ngoài:
 *   1. Dự án
 *   2. Quản lý tài khoản (Chỉ dành riêng cho tài khoản Admin)
 *   3. Cài đặt chung
 * - Cuối thanh: Thông tin tài khoản đăng nhập và nút Đăng xuất.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {string} props.activeTab Mục đang được kích hoạt hiển thị.
 * @param {Object|null} props.currentProject Dự án đang được mở.
 * @param {Function} props.onSelectTab Hàm chuyển đổi mục hiển thị.
 * @param {boolean} [props.isAiEnabled=true] Trạng thái bật/tắt toàn bộ tính năng AI trong dự án.
 * @param {Object|null} [props.currentUser] Thông tin tài khoản người dùng hiện đang đăng nhập.
 * @param {Function} [props.onLogout] Hàm xử lý đăng xuất tài khoản.
 * @param {Function} [props.onOpenProfile] Hàm mở modal quản lý hồ sơ cá nhân.
 * @returns {React.ReactElement} Giao diện thanh Sidebar.
 */
export default function Sidebar({
  activeTab,
  currentProject,
  onSelectTab,
  isAiEnabled = true,
  currentUser = null,
  onLogout = null,
  onOpenProfile = null
}) {
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
          ) : currentUser?.role === 'admin' ? (
            /* Khi là Quản trị viên (Admin): Chỉ hiển thị mục Quản lý tài khoản (không có Dự án và Cài đặt) */
            <button
              className={`minimal-nav-item ${activeTab === 'admin_users' ? 'active' : ''}`}
              onClick={() => onSelectTab('admin_users')}
              style={{
                color: activeTab === 'admin_users' ? '#ffffff' : '#c084fc',
                background: activeTab === 'admin_users' ? 'rgba(168, 85, 247, 0.25)' : 'transparent'
              }}
              title="Trang quản trị toàn bộ người dùng trong CSDL MySQL"
            >
              <Users size={18} color="#c084fc" />
              <span>Quản lý tài khoản</span>
            </button>
          ) : (
            /* Khi là Người dùng thường: Hiển thị mục Dự án và Cài đặt */
            <>
              {/* Mục Danh sách Dự án */}
              <button
                className={`minimal-nav-item ${activeTab === 'projects' ? 'active' : ''}`}
                onClick={() => onSelectTab('projects')}
              >
                <Folder size={18} />
                <span>Dự án</span>
              </button>

              {/* Mục Cài đặt chung ngoài danh sách dự án */}
              <button
                className={`minimal-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => onSelectTab('settings')}
              >
                <Settings size={18} />
                <span>Cài đặt</span>
              </button>
            </>
          )}
        </nav>
      </div>

      {/* 3. Phần Đáy: Divider & Card Tài Khoản Đăng Nhập / Đăng Xuất */}
      <div className="minimal-sidebar-bottom">
        <div className="sidebar-divider" />
        <div
          className="minimal-user-card"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px' }}
        >
          {/* Vùng nhấn mở Modal Hồ Sơ Cá Nhân (Ảnh đại diện + Tên người dùng) */}
          <div
            onClick={onOpenProfile}
            role="button"
            tabIndex={0}
            title="Nhấp vào đây để xem hồ sơ, đổi ảnh đại diện hoặc mật khẩu"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              overflow: 'hidden',
              cursor: onOpenProfile ? 'pointer' : 'default',
              flex: 1,
              borderRadius: '8px',
              padding: '4px',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (onOpenProfile) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            }}
            onMouseLeave={(e) => {
              if (onOpenProfile) e.currentTarget.style.background = 'transparent';
            }}
          >
            <div
              className="minimal-user-avatar"
              style={{
                background: currentUser?.role === 'admin'
                  ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)'
                  : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.8rem',
                flexShrink: 0,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1.5px solid rgba(255, 255, 255, 0.15)'
              }}
            >
              {currentUser?.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt="Avatar"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    // Dự phòng nếu ảnh đại diện bị hỏng đường dẫn
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : currentUser?.role === 'admin' ? (
                'AD'
              ) : (
                (currentUser?.first_name ? currentUser.first_name.slice(0, 2).toUpperCase() : currentUser?.username?.slice(0, 2)?.toUpperCase()) || 'US'
              )}
            </div>

            <div className="minimal-user-info" style={{ overflow: 'hidden' }}>
              <span
                className="minimal-user-name"
                style={{
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  fontWeight: 600
                }}
              >
                {currentUser?.full_name || currentUser?.username || 'Tài khoản'}
              </span>
              <span
                className="minimal-user-email"
                style={{
                  fontSize: '0.675rem',
                  color: currentUser?.role === 'admin' ? '#c084fc' : '#38bdf8',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden'
                }}
              >
                {currentUser?.role === 'admin' ? 'Quản trị viên (Admin)' : (currentUser?.username || 'Người dùng')}
              </span>
            </div>
          </div>

          {/* Nút Đăng Xuất (LogOut) */}
          {onLogout && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onLogout();
              }}
              title="Đăng xuất khỏi tài khoản"
              aria-label="Đăng xuất"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                padding: '6px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94a3b8';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
