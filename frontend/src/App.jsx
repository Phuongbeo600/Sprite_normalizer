//1. Thư viện nền tảng React
import React, { useState } from 'react';//useState: giúp react làm cho giao diện tự động cập nhật
//2. Component nội bộ của dự án
import Sidebar from './components/Sidebar';
import Projects from './pages/Projects';
import Workspace from './pages/Workspace';
import Settings from './pages/Settings';

export default function App() {
  const [activeTab, setActiveTab] = useState('projects'); //useState trả về hai phần tử, một là giá trị cũ, hai là hàm để cập nhật giá trị
  const [currentProject, setCurrentProject] = useState(null);// giá trị trong ngoặc là giá trị khởi tạo ban đầu

  const handleOpenProject = (project) => {
    setCurrentProject(project);
    setActiveTab('workspace');
  };

  return (
    <div className="app-layout">
      {/* 1. Sidebar Cột Trái Cố Định */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* 2. Vùng Hiển Thị Nội Dung Chính (Có hình nền Hiệp sĩ & Lâu đài Gothic) */}
      <main className="main-content-viewport">
        {activeTab === 'projects' && (
          <Projects onOpenProject={handleOpenProject} />
        )}

        {activeTab === 'workspace' && (
          <div className="subpage-container">
            <div className="subpage-top-bar">
              <button className="btn-back-nav" onClick={() => setActiveTab('projects')}>
                ← Quay lại danh sách dự án
              </button>
              <span className="subpage-current-name">
                {currentProject ? `Dự án: ${currentProject.name}` : 'Không gian làm việc'}
              </span>
            </div>
            <Workspace currentProject={currentProject} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="subpage-container">
            <div className="subpage-top-bar">
              <button className="btn-back-nav" onClick={() => setActiveTab('projects')}>
                ← Quay lại danh sách dự án
              </button>
            </div>
            <Settings />
          </div>
        )}
      </main>
    </div>
  );
}
