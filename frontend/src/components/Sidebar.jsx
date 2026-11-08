// 1. THƯ VIỆN NỀN TẢNG REACT
// React dựng các mục điều hướng.
import React from 'react';

// 2. THƯ VIỆN BÊN NGOÀI
// Bộ biểu tượng cho logo và các mục điều hướng.
import { Folder, Settings, Bot, ScanSearch, Image } from 'lucide-react';

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Cấu hình logo và thông tin tài khoản hiển thị cuối thanh.
import { CURRENT_USER, APP_CONFIG } from '../constants/initialProjects';

// 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC

/**
 * Hiển thị các mục điều hướng theo trạng thái mở dự án.
 * @param {object} props Thuộc tính của thanh điều hướng.
 * @param {string} props.activeTab Mục đang được hiển thị.
 * @param {object|null} props.currentProject Dự án đang mở, nếu có.
 * @param {Function} props.onSelectTab Hàm chuyển sang mục được chọn.
 * @returns {React.ReactElement} Thanh điều hướng bên trái.
 */
export default function Sidebar({ activeTab, currentProject, onSelectTab }) {
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
              <button
                className={`minimal-nav-item ${activeTab === 'analysis' ? 'active' : ''}`}
                onClick={() => onSelectTab('analysis')}
              >
                <ScanSearch size={18} />
                <span>Phân tích &amp; Prompt</span>
              </button>
              <button
                className={`minimal-nav-item ${activeTab === 'workspace' ? 'active' : ''}`}
                onClick={() => onSelectTab('workspace')}
              >
                <Image size={18} />
                <span>Xử lý ảnh</span>
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

          <button
            className={`minimal-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => onSelectTab('settings')}
          >
            <Settings size={18} />
            <span>Cài đặt</span>
          </button>
        </nav>
      </div >

      {/* 3. Phần Đáy: Divider & Card Tài Khoản */}
      < div className="minimal-sidebar-bottom" >
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
            <span className="user-title">{CURRENT_USER.name}</span>
            <span className="user-subtitle">{CURRENT_USER.subtitle}</span>
          </div>
        </div>
      </div >
    </aside >
  );
}
