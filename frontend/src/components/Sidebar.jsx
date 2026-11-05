//1.Thư viện nền tảng react
import React from 'react';
//2.Thư viện bên thứ ba
import { Folder, Settings, Bot } from 'lucide-react';
import { CURRENT_USER, APP_CONFIG } from '../constants/initialProjects';

export default function Sidebar({ activeTab, onSelectTab }) {
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
          <button
            className={`minimal-nav-item ${activeTab === 'projects' ? 'active' : ''}`}
            onClick={() => onSelectTab('projects')}
          >
            <Folder size={18} />
            <span>Dự án</span>
          </button>

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
