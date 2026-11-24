// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Biểu tượng đăng xuất cho modal xác nhận
import { LogOut } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Các trang)
// ========================================================
// Sidebar: Thanh điều hướng chính của ứng dụng
import Sidebar from './Sidebar';
// AtelierModalDialog: Hộp thoại nổi nội bộ chuẩn Dark Fantasy Atelier thay thế confirm/prompt
import AtelierModalDialog from '../shared/ui/AtelierModalDialog';
// Projects: Màn hình danh sách dự án trong MySQL
import Projects from '../features/projects/Projects';
// ProjectTabs: Vùng làm việc của dự án, giữ các màn hình khi chuyển tab.
import ProjectTabs from './ProjectTabs';
// Settings: Màn hình Cài đặt chung toàn cục (đã gỡ bỏ ô nhập key)
import Settings from '../features/settings/Settings';
// AdminUsers: Màn hình Quản trị Tài khoản người dùng trong CSDL MySQL dành riêng cho Admin
import AdminUsers from '../features/admin/AdminUsers';
// AuthModal: Màn hình Đăng nhập & Đăng ký tài khoản người dùng
import AuthModal from '../features/authentication/AuthModal';
// ProfileModal: Hộp thoại quản lý hồ sơ cá nhân, đổi avatar, đổi mật khẩu và gán dự án
import ProfileModal from '../features/authentication/ProfileModal';
// HelpCenter: Màn hình Trung tâm Hướng dẫn đa hình (Help Center)
import HelpCenter from '../features/help/HelpCenter';
// ChatWidget: Trợ lý AI Chatbot dạng bong bóng nổi phản hồi thời gian thực qua SSE
import ChatWidget from '../features/chat/ChatWidget';
import { useAuthSession } from '../features/authentication/useAuthSession';

// Đọc trạng thái cấu hình AI khi mở dự án.
import { getProjectApiConfig } from '../shared/api/projectApiConfig';

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
  const { currentUser, updateProfile, loginUser, logoutUser } = useAuthSession();

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
  // Ảnh mẫu tham chiếu được chuyển tiếp từ Studio sang Tạo ảnh AI
  const [imageGenReferenceImage, setImageGenReferenceImage] = useState(null);
  // Tệp ảnh được chuyển tiếp từ Tạo ảnh AI hoặc Studio sang Workspace hoặc Godot
  const [transferredImageForWorkspace, setTransferredImageForWorkspace] = useState(null);
  // Dữ liệu bảng màu đầy đủ đã phân tích chuyển tiếp sang Workspace để tái sử dụng ngay
  const [transferredPaletteForWorkspace, setTransferredPaletteForWorkspace] = useState(null);
  // Dữ liệu bộ frame cắt rời và thông số Sprite Sheet nạp ngược từ CSDL vào Workspace
  const [transferredSheetDataForWorkspace, setTransferredSheetDataForWorkspace] = useState(null);
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
    updateProfile(updatedUser);
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
   * Chuyển prompt, negative prompt và ảnh mẫu từ màn hình Phân tích sang màn hình Tạo ảnh AI.
   * 
   * @param {string} promptText Nội dung prompt cần tạo ảnh.
   * @param {string} [negativePromptText] Nội dung lệnh cấm cần loại trừ.
   * @param {File|string|null} [referenceImage] Tệp hoặc Data URL ảnh mẫu tham chiếu.
   */
  const handleSendPromptToImageGen = (promptText, negativePromptText = '', referenceImage = null) => {
    setImageGenPrompt(promptText);
    setImageGenNegativePrompt(negativePromptText || '');
    setImageGenReferenceImage(referenceImage);
    setActiveTab('image_gen');
  };

  /**
   * Chuyển tệp ảnh, bảng màu và bộ frame sang Workspace để cắt viền, chuẩn hóa hoặc vẽ pixel art.
   * 
   * @param {File} imageFile Tệp ảnh nguồn hoặc ảnh sinh từ AI.
   * @param {string[]|null} [paletteData=null] Bảng màu trích xuất được từ bước phân tích.
   * @param {Object|null} [sheetData=null] Trọn bộ frame cắt rời và thông số lưới nạp từ CSDL.
   */
  const handleTransferToWorkspace = (imageFile, paletteData = null, sheetData = null) => {
    setTransferredImageForWorkspace(imageFile);
    setTransferredPaletteForWorkspace(paletteData);
    setTransferredSheetDataForWorkspace(sheetData);
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
      getProjectApiConfig(project.id)
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
    loginUser(user);
    if (user?.role === 'admin') {
      setActiveTab('admin_users');
    } else {
      setActiveTab('projects');
    }
  };

  // Trạng thái hiển thị hộp thoại nổi xác nhận đăng xuất
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  /**
   * Mở hộp thoại nổi yêu cầu người dùng xác nhận đăng xuất.
   */
  const handleRequestLogout = () => {
    setShowLogoutConfirm(true);
  };

  /**
   * Thực hiện đăng xuất tài khoản sau khi người dùng bấm xác nhận trên hộp thoại nổi.
   */
  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);

    logoutUser();
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
        onLogout={handleRequestLogout}
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
              <ProjectTabs
                activeTab={activeTab}
                currentProject={currentProject}
                loadedPresetData={loadedPresetData}
                isAiEnabled={isAiEnabled}
                imageGenPrompt={imageGenPrompt}
                imageGenNegativePrompt={imageGenNegativePrompt}
                imageGenReferenceImage={imageGenReferenceImage}
                transferredImageForWorkspace={transferredImageForWorkspace}
                transferredPaletteForWorkspace={transferredPaletteForWorkspace}
                transferredSheetDataForWorkspace={transferredSheetDataForWorkspace}
                transferredImageForGodot={transferredImageForGodot}
                selectedGodotCharIds={selectedGodotCharIds}
                onCloseProject={handleCloseProject}
                onSendPromptToImageGen={handleSendPromptToImageGen}
                onTransferToWorkspace={handleTransferToWorkspace}
                onTransferToGodot={handleTransferToGodot}
                onLoadPresetToStudio={handleLoadPresetToStudio}
                onDeployCharactersToGodot={handleDeployCharactersToGodot}
                onSelectTab={setActiveTab}
                onAiEnabledChange={setIsAiEnabled}
                onResetDeployedFilter={() => setSelectedGodotCharIds(null)}
              />
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

      {/* 4. Hộp thoại nổi xác nhận đăng xuất (Dark Fantasy Atelier Confirm) */}
      <AtelierModalDialog
        isOpen={showLogoutConfirm}
        type="confirm"
        isDestructive={true}
        icon={<LogOut size={20} />}
        title="Xác Nhận Đăng Xuất"
        message="Bạn có chắc chắn muốn đăng xuất khỏi tài khoản này không? Mọi thay đổi chưa được đồng bộ có thể bị gián đoạn."
        confirmText="Đăng xuất"
        cancelText="Ở lại tiếp tục"
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      {/* 5. Trợ lý AI Chatbot dạng nổi đa nhà cung cấp */}
      <ChatWidget currentProject={currentProject} />
    </div>
  );
}
