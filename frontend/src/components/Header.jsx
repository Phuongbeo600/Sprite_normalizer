import React from 'react';
import { Sparkles, Terminal } from 'lucide-react';

export default function Header({ activeTab, onOpenNewProject }) {
  const titles = {
    projects: 'Danh sách dự án',
    workspace: 'Xử lý & Chuẩn hóa Sprite',
    settings: 'Cài đặt thuật toán & hệ thống'
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <h1 className="header-title">{titles[activeTab] || 'Sprite Normalizer'}</h1>
        <span className="header-badge">MVC → Web Migration</span>
      </div>
      <div className="header-actions">
        <button className="btn btn-secondary" onClick={() => window.open('http://127.0.0.1:8000/docs', '_blank')}>
          <Terminal size={16} />
          FastAPI Docs
        </button>
        {activeTab === 'projects' && (
          <button className="btn btn-primary" onClick={onOpenNewProject}>
            <Sparkles size={16} />
            Tạo dự án mới
          </button>
        )}
      </div>
    </header>
  );
}
