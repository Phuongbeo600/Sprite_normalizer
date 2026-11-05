import React from 'react';
import { Layers, Image as ImageIcon, Sliders, Settings as SettingsIcon } from 'lucide-react';

export default function Sidebar({ activeTab, onSelectTab }) {
  const menuItems = [
    { id: 'projects', label: 'Dự án (Projects)', icon: Layers },
    { id: 'workspace', label: 'Không gian làm việc (Workspace)', icon: ImageIcon },
    { id: 'settings', label: 'Cấu hình (Settings)', icon: SettingsIcon },
  ];

  return (
    <aside className="app-sidebar">
      <div>
        <div className="sidebar-logo">
          <Sliders size={22} color="#6366f1" />
          <span>Sprite Normalizer</span>
        </div>
        <nav className="sidebar-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectTab(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
      <div className="sidebar-footer">
        <div>BTL Trí tuệ nhân tạo - UET</div>
        <div style={{ fontSize: '0.75rem', marginTop: '4px', opacity: 0.7 }}>v1.0.0 (FastAPI + React)</div>
      </div>
    </aside>
  );
}
