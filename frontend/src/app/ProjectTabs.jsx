// 1. THƯ VIỆN NỀN TẢNG REACT
// React: Dựng các màn hình của dự án.
import React from 'react';

// 2. THƯ VIỆN BÊN NGOÀI

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// ProjectAnalysis: Màn hình Studio phân tích mẫu và sinh prompt
import ProjectAnalysis from '../features/character-analysis/ProjectAnalysis';
// ImageGeneration: Màn hình Tạo ảnh AI từ mô tả văn bản bằng Gemini Imagen 3 hoặc OpenAI
import ImageGeneration from '../features/image-generation/ImageGeneration';
// Workspace: Màn hình xử lý và chuẩn hóa ảnh sprite
import Workspace from '../features/workspace/Workspace';
// ProjectSavedPresets: Màn hình Thư viện Hồ sơ đã lưu của dự án
import ProjectSavedPresets from '../features/project-assets/ProjectAssets';
// GodotTestbed: Màn hình Phòng thử nghiệm chạy thử và xuất chuẩn Godot Engine 4
import GodotTestbed from '../features/godot-testbed/GodotTestbed';
// ProjectSettings: Màn hình Cài đặt cấu hình API Key riêng của dự án
import ProjectSettings from '../features/settings/ProjectSettings';

// 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC

/**
 * Hiển thị các màn hình của dự án. Các tab dùng thuộc tính hidden để giữ
 * trạng thái và hiệu ứng của màn hình khi người dùng chuyển tab.
 *
 * @param {Object} props Dự án, tab hiện tại và dữ liệu bàn giao do App sở hữu.
 * @returns {React.ReactElement} Vùng làm việc của dự án đang mở.
 */
export default function ProjectTabs({
  activeTab,
  currentProject,
  loadedPresetData,
  isAiEnabled,
  imageGenPrompt,
  imageGenNegativePrompt,
  transferredImageForWorkspace,
  transferredImageForGodot,
  selectedGodotCharIds,
  onCloseProject,
  onSendPromptToImageGen,
  onTransferToWorkspace,
  onTransferToGodot,
  onLoadPresetToStudio,
  onDeployCharactersToGodot,
  onSelectTab,
  onAiEnabledChange,
  onResetDeployedFilter
}) {
  return (
    <div hidden={activeTab === 'settings'}>
      <div className="subpage-container">
        <div className="subpage-top-bar">
          <button className="btn-back-nav" onClick={onCloseProject}>
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
            onSendPromptToImageGen={onSendPromptToImageGen}
            isAiEnabled={isAiEnabled}
          />
        </div>

        {/* Mục 2: Tạo ảnh AI (Google Imagen 3 / OpenAI DALL-E) */}
        <div hidden={activeTab !== 'image_gen'}>
          <ImageGeneration
            currentProject={currentProject}
            incomingPrompt={imageGenPrompt}
            incomingNegativePrompt={imageGenNegativePrompt}
            onSelectTab={onSelectTab}
            onTransferToWorkspace={onTransferToWorkspace}
            onTransferToGodot={onTransferToGodot}
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
            onLoadPresetToStudio={onLoadPresetToStudio}
            onLoadSpriteToWorkspace={onTransferToWorkspace}
            onDeployCharactersToGodot={onDeployCharactersToGodot}
            onSelectTab={onSelectTab}
            isActive={activeTab === 'saved_presets'}
          />
        </div>

        {/* Mục 5: Thử nghiệm Godot Engine 4 (Testbed & Export) */}
        <div hidden={activeTab !== 'godot_testbed'}>
          <GodotTestbed
            currentProject={currentProject}
            incomingFile={transferredImageForGodot}
            deployedCharacterIds={selectedGodotCharIds}
            onResetDeployedFilter={onResetDeployedFilter}
          />
        </div>

        {/* Mục 6: Cài đặt dự án (Quản lý API Key riêng của dự án này) */}
        <div hidden={activeTab !== 'project_settings'}>
          <ProjectSettings
            currentProject={currentProject}
            onAiEnabledChange={onAiEnabledChange}
          />
        </div>
      </div>
    </div>
  );
}
