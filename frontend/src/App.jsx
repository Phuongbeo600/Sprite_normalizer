// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// (Không có phụ thuộc bên ngoài)

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Các trang)
// ========================================================
// Sidebar: Thanh điều hướng chính của ứng dụng
import Sidebar from './components/Sidebar';
// Projects: Màn hình danh sách dự án trong MySQL
import Projects from './pages/Projects';
// ProjectAnalysis: Màn hình Studio phân tích mẫu và sinh prompt
import ProjectAnalysis from './pages/ProjectAnalysis';
// Workspace: Màn hình xử lý và chuẩn hóa ảnh sprite
import Workspace from './pages/Workspace';
// ProjectSavedPresets: Màn hình Thư viện Hồ sơ đã lưu của dự án
import ProjectSavedPresets from './pages/ProjectSavedPresets';
// ProjectSettings: Màn hình Cài đặt cấu hình API Key riêng của dự án
import ProjectSettings from './pages/ProjectSettings';
// Settings: Màn hình Cài đặt chung toàn cục (đã gỡ bỏ ô nhập key)
import Settings from './pages/Settings';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark UI từ theme.css thông qua index.css

/**
 * Component gốc điều hướng toàn bộ ứng dụng (App Root Router).
 * Quản lý trạng thái dự án hiện tại (currentProject) và tab đang kích hoạt:
 * - Khi ở ngoài: 'projects' | 'settings'
 * - Khi ở trong dự án: 'analysis' | 'workspace' | 'saved_presets' | 'project_settings'
 * 
 * @returns {React.ReactElement} Giao diện chính của ứng dụng.
 */
export default function App() {
  const [activeTab, setActiveTab] = useState('projects');
  const [currentProject, setCurrentProject] = useState(null);
  // Dữ liệu preset nạp từ thư viện sang Studio
  const [loadedPresetData, setLoadedPresetData] = useState(null);

  /**
   * Mở mục phân tích của dự án được chọn từ danh sách.
   * 
   * @param {Object} project Dự án được chọn.
   */
  const handleOpenProject = (project) => {
    setCurrentProject(project);
    setActiveTab('analysis');
    setLoadedPresetData(null);
  };

  /**
   * Đóng dự án đang mở và quay lại danh sách dự án.
   */
  const handleCloseProject = () => {
    setCurrentProject(null);
    setActiveTab('projects');
    setLoadedPresetData(null);
  };

  /**
   * Nạp ngược dữ liệu một bản ghi preset vào Studio để làm việc tiếp.
   * 
   * @param {Object} preset Dữ liệu chi tiết bản ghi.
   */
  const handleLoadPresetToStudio = (preset) => {
    setLoadedPresetData(preset);
    setActiveTab('analysis');
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
        {/* Màn hình 1: Danh sách Dự án */}
        {activeTab === 'projects' && (
          <Projects onOpenProject={handleOpenProject} />
        )}

        {/* Khối làm việc bên trong một Dự án cụ thể */}
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

              {/* Mục 1: Phân tích & Prompt (Studio) */}
              <div hidden={activeTab !== 'analysis'}>
                <ProjectAnalysis
                  currentProject={currentProject}
                  loadedPresetData={loadedPresetData}
                  isActive={activeTab === 'analysis'}
                />
              </div>

              {/* Mục 2: Xử lý ảnh Sprite */}
              <div hidden={activeTab !== 'workspace'}>
                <Workspace currentProject={currentProject} />
              </div>

              {/* Mục 3: Hồ sơ đã lưu (Nằm dưới "Xử lý ảnh") */}
              <div hidden={activeTab !== 'saved_presets'}>
                <ProjectSavedPresets
                  currentProject={currentProject}
                  onLoadPresetToStudio={handleLoadPresetToStudio}
                />
              </div>

              {/* Mục 4: Cài đặt dự án (Quản lý API Key riêng của dự án này) */}
              <div hidden={activeTab !== 'project_settings'}>
                <ProjectSettings currentProject={currentProject} />
              </div>
            </div>
          </div>
        )}

        {/* Màn hình Cài đặt chung ngoài Sidebar (Khi chưa mở dự án) */}
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
