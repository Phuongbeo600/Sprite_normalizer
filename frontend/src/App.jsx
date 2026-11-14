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
// ImageGeneration: Màn hình Tạo ảnh AI từ mô tả văn bản bằng Gemini Imagen 3 hoặc OpenAI
import ImageGeneration from './pages/ImageGeneration';
// Workspace: Màn hình xử lý và chuẩn hóa ảnh sprite
import Workspace from './pages/Workspace';
// ProjectSavedPresets: Màn hình Thư viện Hồ sơ đã lưu của dự án
import ProjectSavedPresets from './pages/ProjectSavedPresets';
// GodotTestbed: Màn hình Phòng thử nghiệm chạy thử và xuất chuẩn Godot Engine 4
import GodotTestbed from './pages/GodotTestbed';
// ProjectSettings: Màn hình Cài đặt cấu hình API Key riêng của dự án
import ProjectSettings from './pages/ProjectSettings';
// Settings: Màn hình Cài đặt chung toàn cục (đã gỡ bỏ ô nhập key)
import Settings from './pages/Settings';
// AdminUsers: Màn hình Quản trị Tài khoản người dùng trong CSDL MySQL dành riêng cho Admin
import AdminUsers from './pages/AdminUsers';
// AuthModal: Màn hình Đăng nhập & Đăng ký tài khoản người dùng
import AuthModal from './components/auth/AuthModal';
// ProfileModal: Hộp thoại quản lý hồ sơ cá nhân, đổi avatar, đổi mật khẩu và gán dự án
import ProfileModal from './components/auth/ProfileModal';
// HelpCenter: Màn hình Trung tâm Hướng dẫn đa hình (Help Center)
import HelpCenter from './pages/HelpCenter';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark UI từ theme.css thông qua index.css

/**
 * Component gốc điều hướng toàn bộ ứng dụng (App Root Router).
 * Quản lý trạng thái đăng nhập, dự án hiện tại (currentProject) và tab đang kích hoạt:
 * - Khi chưa đăng nhập: Hiển thị AuthModal (Đăng nhập / Đăng ký)
 * - Khi ở ngoài dự án: 'projects' | 'admin_users' | 'settings'
 * - Khi ở trong dự án: 'analysis' | 'image_gen' | 'workspace' | 'saved_presets' | 'godot_testbed' | 'project_settings'
 * 
 * @returns {React.ReactElement} Giao diện chính của ứng dụng.
 */
export default function App() {
  // Trạng thái tài khoản người dùng hiện đang đăng nhập (lưu trong localStorage)
  // Mặc định khi chạy dự án: tự động đăng nhập vào tài khoản kiểm thử origin@gmail.com (id: 2)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('sprite_current_user');
      if (saved) return JSON.parse(saved);

      // Nếu trước đó người dùng chủ động bấm Đăng xuất thì giữ ở màn hình đăng nhập
      const isLoggedOut = localStorage.getItem('sprite_logged_out');
      if (isLoggedOut === 'true') return null;

      // Mặc định tự động đăng nhập vào tài khoản origin@gmail.com để phục vụ kiểm thử
      return {
        id: 2,
        username: 'origin@gmail.com',
        role: 'user',
        first_name: 'Origin',
        last_name: 'Tester',
        full_name: 'Origin (Tài khoản mẫu kiểm thử)',
        avatar_url: ''
      };
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('sprite_current_user');
      const u = saved ? JSON.parse(saved) : null;
      return u?.role === 'admin' ? 'admin_users' : 'projects';
    } catch {
      return 'projects';
    }
  });
  const [currentProject, setCurrentProject] = useState(null);
  // Dữ liệu preset nạp từ thư viện sang Studio
  const [loadedPresetData, setLoadedPresetData] = useState(null);

  // Dữ liệu prompt & negative prompt chuyển từ Studio sang Tạo ảnh AI
  const [imageGenPrompt, setImageGenPrompt] = useState('');
  const [imageGenNegativePrompt, setImageGenNegativePrompt] = useState('');
  // Tệp ảnh được chuyển tiếp từ Tạo ảnh AI sang Workspace hoặc Godot
  const [transferredImageForWorkspace, setTransferredImageForWorkspace] = useState(null);
  const [transferredImageForGodot, setTransferredImageForGodot] = useState(null);
  // Danh sách ID nhân vật được tích chọn từ Kho tài nguyên để đưa vào Godot Testbed
  const [selectedGodotCharIds, setSelectedGodotCharIds] = useState(null);
  // Trạng thái bật/tắt toàn bộ tính năng AI của dự án hiện tại (mặc định true)
  const [isAiEnabled, setIsAiEnabled] = useState(true);
  // Trạng thái hiển thị modal hồ sơ cá nhân
  const [showProfileModal, setShowProfileModal] = useState(false);

  /**
   * Cập nhật thông tin tài khoản người dùng sau khi chỉnh sửa thành công từ ProfileModal.
   * 
   * @param {Object} updatedUser Dữ liệu người dùng mới từ máy chủ MySQL.
   */
  const handleProfileUpdated = (updatedUser) => {
    setCurrentUser(updatedUser);
    try {
      localStorage.setItem('sprite_current_user', JSON.stringify(updatedUser));
    } catch {}
  };

  /**
   * Đưa danh sách các nhân vật được tích chọn từ Kho tài nguyên sang phòng thử nghiệm Godot.
   * 
   * @param {number[]} charIds Mảng ID nhân vật trong MySQL.
   */
  const handleDeployCharactersToGodot = (charIds) => {
    setSelectedGodotCharIds(charIds);
    setActiveTab('godot_testbed');
  };

  /**
   * Chuyển prompt và negative prompt từ màn hình Phân tích sang màn hình Tạo ảnh AI.
   * 
   * @param {string} promptText Nội dung prompt cần tạo ảnh.
   * @param {string} [negativePromptText] Nội dung lệnh cấm cần loại trừ.
   */
  const handleSendPromptToImageGen = (promptText, negativePromptText = '') => {
    setImageGenPrompt(promptText);
    setImageGenNegativePrompt(negativePromptText || '');
    setActiveTab('image_gen');
  };

  /**
   * Chuyển tệp ảnh vừa sinh từ Tạo ảnh AI sang Workspace để cắt viền và chuẩn hóa.
   * 
   * @param {File} imageFile Tệp ảnh sinh ra từ AI.
   */
  const handleTransferToWorkspace = (imageFile) => {
    setTransferredImageForWorkspace(imageFile);
    setActiveTab('workspace');
  };

  /**
   * Chuyển tệp ảnh vừa sinh từ Tạo ảnh AI sang Thử nghiệm Godot để test nhịp chạy.
   * 
   * @param {File} imageFile Tệp ảnh sinh ra từ AI.
   */
  const handleTransferToGodot = (imageFile) => {
    setTransferredImageForGodot(imageFile);
    setActiveTab('godot_testbed');
  };

  /**
   * Mở mục phân tích của dự án được chọn từ danh sách.
   * Đồng thời tự động nạp trạng thái Bật/Tắt AI của dự án từ MySQL.
   * 
   * @param {Object} project Dự án được chọn.
   */
  const handleOpenProject = (project) => {
    setCurrentProject(project);
    setActiveTab('analysis');
    setLoadedPresetData(null);

    // Đọc trạng thái cấu hình AI của dự án từ MySQL
    if (project?.id) {
      fetch(`/api/projects/${project.id}/api-config`)
        .then((res) => (res.ok ? res.json() : null))
        .then((resJson) => {
          if (resJson?.data) {
            setIsAiEnabled(resJson.data.ai_enabled !== false);
          }
        })
        .catch(() => {
          setIsAiEnabled(true);
        });
    }
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
   * Xử lý đăng nhập thành công từ AuthModal.
   * 
   * @param {Object} user Dữ liệu người dùng nhận từ API.
   */
  const handleLoginSuccess = (user) => {
    try {
      localStorage.removeItem('sprite_logged_out');
      localStorage.setItem('sprite_current_user', JSON.stringify(user));
    } catch {}
    setCurrentUser(user);
    if (user?.role === 'admin') {
      setActiveTab('admin_users');
    } else {
      setActiveTab('projects');
    }
  };

  /**
   * Xử lý đăng xuất tài khoản và quay về màn hình đăng nhập.
   */
  const handleLogout = () => {
    const confirmed = window.confirm('Bạn có chắc chắn muốn đăng xuất khỏi tài khoản này không?');
    if (!confirmed) return;

    try {
      localStorage.setItem('sprite_logged_out', 'true');
      localStorage.removeItem('sprite_current_user');
    } catch {}

    setCurrentUser(null);
    setCurrentProject(null);
    setActiveTab('projects');
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

  /**
   * Quay lại màn hình làm việc từ Trung tâm Hướng dẫn (Help Center).
   */
  const handleReturnFromHelp = () => {
    if (currentUser?.role === 'admin') {
      setActiveTab('admin_users');
    } else {
      setActiveTab('projects');
    }
  };

  // NẾU CHƯA ĐĂNG NHẬP: Hiển thị Màn hình Đăng nhập / Đăng ký
  if (!currentUser) {
    return <AuthModal onLoginSuccess={handleLoginSuccess} />;
  }

  // NẾU ĐANG Ở MỤC HƯỚNG DẪN: Hiển thị toàn màn hình Trung tâm Hướng dẫn (như Ảnh số 2)
  if (activeTab === 'help') {
    return <HelpCenter onBack={handleReturnFromHelp} />;
  }

  return (
    <div className="app-layout atelier-app-layout">
      {/* 1. Sidebar Cột Trái Cố Định */}
      <Sidebar
        activeTab={activeTab}
        currentProject={currentProject}
        onSelectTab={setActiveTab}
        isAiEnabled={isAiEnabled}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenProfile={() => setShowProfileModal(true)}
      />

      {/* 2. Vùng Hiển Thị Nội Dung Chính (Có hình nền Hiệp sĩ & Lâu đài Gothic) */}
      <main className="main-content-viewport">
        {/* Nếu là Quản trị viên (Admin): Chỉ hiển thị duy nhất màn hình Quản trị Tài khoản người dùng */}
        {currentUser?.role === 'admin' ? (
          <AdminUsers currentUser={currentUser} />
        ) : (
          <>
            {/* Màn hình 1: Danh sách Dự án (Lọc theo tài khoản người dùng) */}
            {activeTab === 'projects' && (
              <Projects
                onOpenProject={handleOpenProject}
                currentUser={currentUser}
              />
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
                      onSendPromptToImageGen={handleSendPromptToImageGen}
                      isAiEnabled={isAiEnabled}
                    />
                  </div>

                  {/* Mục 2: Tạo ảnh AI (Google Imagen 3 / OpenAI DALL-E) */}
                  <div hidden={activeTab !== 'image_gen'}>
                    <ImageGeneration
                      currentProject={currentProject}
                      incomingPrompt={imageGenPrompt}
                      incomingNegativePrompt={imageGenNegativePrompt}
                      onSelectTab={setActiveTab}
                      onTransferToWorkspace={handleTransferToWorkspace}
                      onTransferToGodot={handleTransferToGodot}
                      isAiEnabled={isAiEnabled}
                    />
                  </div>

                  {/* Mục 3: Xử lý ảnh Sprite */}
                  <div hidden={activeTab !== 'workspace'}>
                    <Workspace
                      currentProject={currentProject}
                      incomingFile={transferredImageForWorkspace}
                    />
                  </div>

                  {/* Mục 4: Kho tài nguyên dự án (Quản lý hồ sơ, ảnh sprite, đội hình Godot, map nền) */}
                  <div hidden={activeTab !== 'saved_presets'}>
                    <ProjectSavedPresets
                      currentProject={currentProject}
                      onLoadPresetToStudio={handleLoadPresetToStudio}
                      onLoadSpriteToWorkspace={handleTransferToWorkspace}
                      onDeployCharactersToGodot={handleDeployCharactersToGodot}
                      onSelectTab={setActiveTab}
                    />
                  </div>

                  {/* Mục 5: Thử nghiệm Godot Engine 4 (Testbed & Export) */}
                  <div hidden={activeTab !== 'godot_testbed'}>
                    <GodotTestbed
                      currentProject={currentProject}
                      incomingFile={transferredImageForGodot}
                      deployedCharacterIds={selectedGodotCharIds}
                      onResetDeployedFilter={() => setSelectedGodotCharIds(null)}
                    />
                  </div>

                  {/* Mục 6: Cài đặt dự án (Quản lý API Key riêng của dự án này) */}
                  <div hidden={activeTab !== 'project_settings'}>
                    <ProjectSettings
                      currentProject={currentProject}
                      onAiEnabledChange={setIsAiEnabled}
                    />
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
          </>
        )}
      </main>

      {/* 3. Modal Hồ Sơ Cá Nhân (Avatar, Họ Tên, Gmail, Đổi Mật Khẩu, Gán Dự Án 2) */}
      {showProfileModal && (
        <ProfileModal
          currentUser={currentUser}
          onClose={() => setShowProfileModal(false)}
          onProfileUpdated={handleProfileUpdated}
        />
      )}
    </div>
  );
}
