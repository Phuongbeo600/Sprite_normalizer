// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ biểu tượng kho tài nguyên, chế độ xem lưới/danh sách, tải về, xem chi tiết và xóa
import { FolderOpen, Bookmark, Image as ImageIcon, Gamepad2, Map as MapIcon, RefreshCw } from "lucide-react";

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// PixelArtIcons: Bộ biểu tượng mỹ thuật pixel art cho rương kho báu, tinh thể và thanh kiếm cổ

// Định dạng ngày lưu và dung lượng ảnh.


// Tạo đường dẫn ảnh và tải các danh sách tài nguyên.
// Dựng cửa sổ chi tiết cho từng loại tài nguyên.
import { renderPresetDetail, renderSpriteDetail, renderCharacterDetail, renderMapDetail } from './renderAssetDetails';

// Phiên dữ liệu và thao tác được quản lý trong hook của tính năng.
import { useProjectAssets } from './useProjectAssets';
import PresetAssetList from './PresetAssetList';
import SpriteAssetList from './SpriteAssetList';
import CharacterAssetList from './CharacterAssetList';
import MapAssetPanel from './MapAssetPanel';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark Fantasy Atelier từ presets-atelier.css
import './presets-atelier.css';

/**
 * Màn hình Kho Tài Nguyên Dự Án (Project Asset Hub) — Dark Fantasy Atelier Edition.
 * Quản lý toàn bộ 4 danh mục dữ liệu được lưu trữ trong MySQL:
 * 1. Hồ Sơ & Prompt AI (project_character_presets)
 * 2. Ảnh Sprite & Sheet (project_sprites, sprite_frames) - Kèm chuyển đổi Lưới 🔲 / Danh sách ☰
 * 3. Đội Hình Nhân Vật Godot (testbed_characters, testbed_character_frames)
 * 4. Bản Đồ Nền Game (testbed_maps)
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object} props.currentProject Dự án hiện tại đang mở (chứa id, name).
 * @param {Function} [props.onLoadPresetToStudio] Nạp ngược preset vào Studio để làm việc tiếp.
 * @param {Function} [props.onLoadSpriteToWorkspace] Nạp ảnh sprite vào Workspace để tiếp tục xử lý.
 * @param {Function} [props.onDeployCharactersToGodot] Nạp danh sách nhân vật vào Godot Testbed.
 * @param {Function} [props.onSelectTab] Chuyển tab điều hướng chính của ứng dụng.
 * @param {boolean} [props.isActive] Trạng thái tab Kho Tài Nguyên đang được chọn hiển thị.
 * @returns {React.ReactElement} Giao diện Kho Tài Nguyên Dự Án.
 */
export default function ProjectSavedPresets({
  currentProject,
  onLoadPresetToStudio,
  onLoadSpriteToWorkspace,
  onDeployCharactersToGodot,
  onTransferToGodot,
  onSelectTab,
  isActive = false
}) {
  // ========================================================
  // TRẠNG THÁI TAB CON & CHẾ ĐỘ XEM
  // ========================================================
  // 'presets' | 'sprites' | 'characters' | 'maps'
  const [activeAssetTab, setActiveAssetTab] = useState('sprites');
  // Chế độ xem của tab Ảnh Sprite: 'grid' (Lưới) | 'list' (Danh sách)
  const [viewMode, setViewMode] = useState('grid');

  const {
    handleLoadPresetToStudio, presets, sprites, characters, mapData, selectedCharIds, setSelectedCharIds, handleDeploySelectedToGodot, loading, error, selectedPreset, setSelectedPreset, selectedSprite, setSelectedSprite, selectedCharacter, setSelectedCharacter, selectedMap, setSelectedMap, copiedPos, copiedNeg, fetchAllAssets, handleOpenInWorkspace, handleOpenInGodot, handleDownloadSprite, handleDeleteSprite, handleDeletePreset, handleDeleteCharacter, handleDeleteMap, handleOpenPresetDetail, handleCopyText
  } = useProjectAssets({ currentProject, isActive, onLoadPresetToStudio, onLoadSpriteToWorkspace, onDeployCharactersToGodot, onTransferToGodot, onSelectTab });

  return (
    <div className="atelier-assets-root">
      {/* ========================================================
          1. THANH TIÊU ĐỀ KHO TÀI NGUYÊN DỰ ÁN
          ======================================================== */}
      <div className="atelier-assets-header">
        <div className="atelier-assets-header-title">
          <h2 className="atelier-assets-title-heading">
            <FolderOpen size={22} color="#c084fc" />
            <span>Kho Tài Nguyên Dự Án (Project Asset Vault)</span>
          </h2>
          <p className="atelier-assets-title-subtext">
            Quản lý, phân loại và tái sử dụng các dữ liệu đã rèn trong dự án <strong>{currentProject?.name}</strong>.
          </p>
        </div>

        <button
          type="button"
          className="atelier-assets-btn-refresh"
          onClick={fetchAllAssets}
          disabled={loading}
          title="Tải lại toàn bộ dữ liệu từ MySQL"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          <span>Làm mới Vault</span>
        </button>
      </div>

      {/* Thông báo lỗi nếu có */}
      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: '10px',
          color: '#fca5a5',
          fontSize: '0.825rem'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* ========================================================
          2. THANH CHUYỂN ĐỔI 4 TAB CON (SEGMENTED TABS)
          ======================================================== */}
      <div className="atelier-assets-tabs">
        {/* Tab 1: Hồ sơ & Prompt */}
        <button
          type="button"
          className={`atelier-assets-tab-btn ${activeAssetTab === 'presets' ? 'active' : ''}`}
          onClick={() => setActiveAssetTab('presets')}
        >
          <Bookmark size={15} color={activeAssetTab === 'presets' ? '#c084fc' : 'currentColor'} />
          <span>Hồ Sơ &amp; Prompt AI</span>
          <span className="atelier-assets-tab-badge">{presets.length}</span>
        </button>

        {/* Tab 2: Ảnh Sprite */}
        <button
          type="button"
          className={`atelier-assets-tab-btn ${activeAssetTab === 'sprites' ? 'active' : ''}`}
          onClick={() => setActiveAssetTab('sprites')}
        >
          <ImageIcon size={15} color={activeAssetTab === 'sprites' ? '#38bdf8' : 'currentColor'} />
          <span>Kho Ảnh Sprite</span>
          <span className="atelier-assets-tab-badge">{sprites.length}</span>
        </button>

        {/* Tab 3: Đội Hình Godot */}
        <button
          type="button"
          className={`atelier-assets-tab-btn ${activeAssetTab === 'characters' ? 'active' : ''}`}
          onClick={() => setActiveAssetTab('characters')}
        >
          <Gamepad2 size={15} color={activeAssetTab === 'characters' ? '#10b981' : 'currentColor'} />
          <span>Đội Hình Godot</span>
          <span className="atelier-assets-tab-badge">{characters.length}</span>
        </button>

        {/* Tab 4: Bản Đồ Nền */}
        <button
          type="button"
          className={`atelier-assets-tab-btn ${activeAssetTab === 'maps' ? 'active' : ''}`}
          onClick={() => setActiveAssetTab('maps')}
        >
          <MapIcon size={15} color={activeAssetTab === 'maps' ? '#f59e0b' : 'currentColor'} />
          <span>Bản Đồ Nền Game</span>
          <span className="atelier-assets-tab-badge">{mapData ? 1 : 0}</span>
        </button>
      </div>

      {/* ========================================================
          3. NỘI DUNG CHI TIẾT TỪNG TAB
          ======================================================== */}

      {/* --------------------------------------------------------
          TAB 1: HỒ SƠ & PROMPT AI
          -------------------------------------------------------- */}
      {activeAssetTab === 'presets' && (
        <PresetAssetList handleDeletePreset={handleDeletePreset} handleLoadPresetToStudio={handleLoadPresetToStudio} handleOpenPresetDetail={handleOpenPresetDetail} loading={loading} onLoadPresetToStudio={onLoadPresetToStudio} presets={presets} />
      )}

      {/* --------------------------------------------------------
          TAB 2: KHO ẢNH SPRITE & SHEET (LƯỚI / DANH SÁCH)
          -------------------------------------------------------- */}
      {activeAssetTab === 'sprites' && (
        <SpriteAssetList currentProject={currentProject} handleDeleteSprite={handleDeleteSprite} handleDownloadSprite={handleDownloadSprite} handleOpenInGodot={handleOpenInGodot} handleOpenInWorkspace={handleOpenInWorkspace} loading={loading} onSelectTab={onSelectTab} setSelectedSprite={setSelectedSprite} setViewMode={setViewMode} sprites={sprites} viewMode={viewMode} />
      )}

      {/* --------------------------------------------------------
          TAB 3: ĐỘI HÌNH NHÂN VẬT GODOT
          -------------------------------------------------------- */}
      {activeAssetTab === 'characters' && (
        <CharacterAssetList characters={characters} handleDeleteCharacter={handleDeleteCharacter} handleDeploySelectedToGodot={handleDeploySelectedToGodot} loading={loading} onDeployCharactersToGodot={onDeployCharactersToGodot} onSelectTab={onSelectTab} selectedCharIds={selectedCharIds} setSelectedCharIds={setSelectedCharIds} setSelectedCharacter={setSelectedCharacter} />
      )}

      {/* --------------------------------------------------------
          TAB 4: BẢN ĐỒ NỀN GAME (TESTBED MAP)
          -------------------------------------------------------- */}
      {activeAssetTab === 'maps' && (
        <MapAssetPanel handleDeleteMap={handleDeleteMap} loading={loading} mapData={mapData} onSelectTab={onSelectTab} setSelectedMap={setSelectedMap} />
      )}

      {/* ========================================================
          4. CÁC CỬA SỔ MODAL XEM CHI TIẾT
          ======================================================== */}

      {/* MODAL 1: CHI TIẾT HỒ SƠ & PROMPT */}
      {selectedPreset && renderPresetDetail({
        selectedPreset,
        copiedPos,
        copiedNeg,
        handleCopyText,
        onLoadPresetToStudio,
        onClose: () => setSelectedPreset(null)
      })}

      {/* MODAL 2: CHI TIẾT ẢNH SPRITE (PHÓNG TO & SO SÁNH) */}
      {selectedSprite && renderSpriteDetail({
        selectedSprite,
        projectId: currentProject.id,
        handleDeleteSprite,
        handleDownloadSprite,
        onLoadSpriteToWorkspace,
        handleOpenInWorkspace,
        handleOpenInGodot,
        onClose: () => setSelectedSprite(null)
      })}

      {/* MODAL 3: CHI TIẾT 15 Ô FRAME CỦA NHÂN VẬT GODOT */}
      {selectedCharacter && renderCharacterDetail({
        selectedCharacter,
        onSelectTab,
        onClose: () => setSelectedCharacter(null)
      })}

      {/* MODAL 4: PHÓNG TO BẢN ĐỒ NỀN */}
      {selectedMap && renderMapDetail({
        selectedMap,
        onClose: () => setSelectedMap(null)
      })}
    </div>
  );
}
