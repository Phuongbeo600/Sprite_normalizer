// 1. THƯ VIỆN NỀN TẢNG REACT
// React dựng giao diện, useState lưu dự án và mục đang mở.
import React, { useState } from 'react';

// 2. THƯ VIỆN BÊN NGOÀI

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Thanh điều hướng của ứng dụng.
import Sidebar from './components/Sidebar';
// Danh sách dự án đã lưu.
import Projects from './pages/Projects';
// Màn hình phân tích ảnh mẫu và tạo prompt.
import ProjectAnalysis from './pages/ProjectAnalysis';
// Màn hình xử lý ảnh.
import Workspace from './pages/Workspace';
// Màn hình cài đặt chung.
import Settings from './pages/Settings';

// 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC

/**
 * Điều hướng giữa danh sách, dự án đang mở và cài đặt.
 * @returns {React.ReactElement} Giao diện chính của ứng dụng.
 */
export default function App() {
  const [activeTab, setActiveTab] = useState('projects');
  const [currentProject, setCurrentProject] = useState(null);

  /**
   * Mở mục phân tích của dự án được chọn.
   * @param {object} project Dự án được chọn từ danh sách.
   * @returns {void} Cập nhật dự án và mục đang mở.
   */
  const handleOpenProject = (project) => {
    setCurrentProject(project);
    setActiveTab('analysis');
  };

  /** @returns {void} Đóng dự án và quay lại danh sách. */
  const handleCloseProject = () => {
    setCurrentProject(null);
    setActiveTab('projects');
  };

  return (
    <div className="app-layout">
      {/* 1. Sidebar Cột Trái Cố Định */}
      <Sidebar
        activeTab={activeTab}
        currentProject={currentProject}
        onSelectTab={setActiveTab}
      />

      {/* 2. Vùng Hiển Thị Nội Dung Chính (Có hình nền Hiệp sĩ & Lâu đài Gothic) */}
      <main className="main-content-viewport">
        {activeTab === 'projects' && (
          <Projects onOpenProject={handleOpenProject} />
        )}

        {currentProject && (
          <div hidden={activeTab === 'settings'}>
            <div className="subpage-container">
              <div className="subpage-top-bar">
                <button className="btn-back-nav" onClick={handleCloseProject}>
                  ← Quay lại danh sách dự án
                </button>
                <span className="subpage-current-name">
                  Dự án: {currentProject.name}
                </span>
              </div>
              {/* Giữ ảnh và biểu mẫu khi chuyển mục trong cùng một dự án. */}
              <div hidden={activeTab !== 'analysis'}>
                <ProjectAnalysis />
              </div>
              <div hidden={activeTab !== 'workspace'}>
                <Workspace currentProject={currentProject} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="subpage-container">
            <div className="subpage-top-bar">
              <button className="btn-back-nav" onClick={handleCloseProject}>
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
