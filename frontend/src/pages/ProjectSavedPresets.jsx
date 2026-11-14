// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState, useEffect, useCallback } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ biểu tượng kho tài nguyên, chế độ xem lưới/danh sách, tải về, xem chi tiết và xóa
import {
  FolderOpen,
  Bookmark,
  Image as ImageIcon,
  Gamepad2,
  Map as MapIcon,
  Sparkles,
  Eye,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  ArrowRight,
  Ruler,
  X,
  Clock,
  Layers,
  Download,
  LayoutGrid,
  List,
  Wrench,
  Maximize2
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// PixelArtIcons: Bộ biểu tượng mỹ thuật pixel art cho rương kho báu, tinh thể và thanh kiếm cổ
import { PixelChest, PixelCrystal, PixelSword } from '../components/common/PixelArtIcons';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark Fantasy Atelier từ presets-atelier.css
import '../styles/presets-atelier.css';

/**
 * Định dạng dung lượng byte thành chuỗi KB hoặc MB dễ đọc.
 * 
 * @param {number} bytes Số byte.
 * @returns {string} Chuỗi dung lượng đã định dạng.
 */
function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Định dạng ngày giờ chuẩn hiển thị tiếng Việt.
 * 
 * @param {string} dateStr Chuỗi ngày giờ từ server.
 * @returns {string} Ngày giờ dễ đọc.
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

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
 * @returns {React.ReactElement} Giao diện Kho Tài Nguyên Dự Án.
 */
export default function ProjectSavedPresets({
  currentProject,
  onLoadPresetToStudio,
  onLoadSpriteToWorkspace,
  onDeployCharactersToGodot,
  onSelectTab
}) {
  // ========================================================
  // TRẠNG THÁI TAB CON & CHẾ ĐỘ XEM
  // ========================================================
  // 'presets' | 'sprites' | 'characters' | 'maps'
  const [activeAssetTab, setActiveAssetTab] = useState('sprites');
  // Chế độ xem của tab Ảnh Sprite: 'grid' (Lưới) | 'list' (Danh sách)
  const [viewMode, setViewMode] = useState('grid');

  // ========================================================
  // TRẠNG THÁI DỮ LIỆU TỪ MYSQL
  // ========================================================
  const [presets, setPresets] = useState([]);
  const [sprites, setSprites] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [mapData, setMapData] = useState(null);

  // Danh sách ID các nhân vật được tích chọn để đưa vào phòng thử nghiệm Godot
  const [selectedCharIds, setSelectedCharIds] = useState(new Set());

  // Tự động tích chọn tất cả nhân vật khi danh sách characters tải xong
  useEffect(() => {
    if (characters && characters.length > 0) {
      setSelectedCharIds(new Set(characters.map((c) => c.id)));
    } else {
      setSelectedCharIds(new Set());
    }
  }, [characters]);

  /**
   * Đưa danh sách các nhân vật đã tích chọn sang phòng thử nghiệm Godot.
   */
  const handleDeploySelectedToGodot = () => {
    if (selectedCharIds.size === 0) return;
    if (onDeployCharactersToGodot) {
      onDeployCharactersToGodot(Array.from(selectedCharIds));
    } else if (onSelectTab) {
      onSelectTab('godot_testbed');
    }
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ========================================================
  // TRẠNG THÁI MODAL CHI TIẾT
  // ========================================================
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [selectedSprite, setSelectedSprite] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);

  const [copiedPos, setCopiedPos] = useState(false);
  const [copiedNeg, setCopiedNeg] = useState(false);

  // ========================================================
  // TẢI TOÀN BỘ TÀI NGUYÊN TỪ CƠ SỞ DỮ LIỆU MYSQL
  // ========================================================
  const fetchAllAssets = useCallback(async () => {
    if (!currentProject?.id) return;
    setLoading(true);
    setError('');

    const projectId = currentProject.id;

    try {
      // 1. Lấy danh sách Preset & Prompt AI
      const pPromise = fetch(`/api/projects/${projectId}/character-presets`)
        .then((r) => (r.ok ? r.json() : { data: [] }))
        .then((j) => j.data || [])
        .catch(() => []);

      // 2. Lấy danh sách Ảnh Sprite & Sheet
      const sPromise = fetch(`/api/sprites?project_id=${projectId}`)
        .then((r) => (r.ok ? r.json() : { sprites: [] }))
        .then((j) => j.sprites || [])
        .catch(() => []);

      // 3. Lấy danh sách Nhân vật Godot
      const cPromise = fetch(`/api/testbed/characters?project_id=${projectId}`)
        .then((r) => (r.ok ? r.json() : { characters: [] }))
        .then((j) => j.characters || [])
        .catch(() => []);

      // 4. Lấy thông tin Bản đồ nền
      const mPromise = fetch(`/api/testbed/map?project_id=${projectId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => (j && j.status === 'success' && j.map_image_base64 ? j : null))
        .catch(() => null);

      const [pRes, sRes, cRes, mRes] = await Promise.all([pPromise, sPromise, cPromise, mPromise]);

      setPresets(pRes);
      setSprites(sRes);
      setCharacters(cRes);
      setMapData(mRes);
    } catch (err) {
      setError(err.message || 'Lỗi khi đồng bộ tài nguyên từ MySQL.');
    } finally {
      setLoading(false);
    }
  }, [currentProject?.id]);

  useEffect(() => {
    fetchAllAssets();
  }, [fetchAllAssets]);

  // ========================================================
  // CÁC THAO TÁC XỬ LÝ (ACTION HANDLERS)
  // ========================================================

  /**
   * Tải ảnh sprite từ backend và chuyển vào Workspace để tiếp tục xử lý.
   * @param {Object} sprite Bản ghi sprite
   */
  const handleOpenInWorkspace = async (sprite) => {
    if (!onLoadSpriteToWorkspace) return;
    try {
      const url = sprite.has_processed
        ? `/api/sprites/${sprite.id}/processed?project_id=${currentProject.id}`
        : `/api/sprites/${sprite.id}/raw?project_id=${currentProject.id}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Không thể tải tệp ảnh từ máy chủ.');
      const blob = await res.blob();
      const file = new File([blob], sprite.name || 'sprite.png', { type: 'image/png' });
      onLoadSpriteToWorkspace(file);
    } catch (err) {
      alert('Lỗi nạp ảnh vào Workspace: ' + err.message);
    }
  };

  /**
   * Tải tệp ảnh PNG về máy tính người dùng.
   * @param {Object} sprite Bản ghi sprite
   * @param {boolean} isProcessed Cờ tải ảnh đã qua xử lý
   */
  const handleDownloadSprite = (sprite, isProcessed = false) => {
    const url = isProcessed && sprite.has_processed
      ? `/api/sprites/${sprite.id}/processed?project_id=${currentProject.id}`
      : `/api/sprites/${sprite.id}/raw?project_id=${currentProject.id}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sprite.name || 'sprite'}${isProcessed ? '_processed' : '_raw'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  /**
   * Xóa một bức ảnh sprite khỏi MySQL.
   * @param {number} spriteId Mã ảnh
   * @param {string} spriteName Tên ảnh
   */
  const handleDeleteSprite = async (spriteId, spriteName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ảnh "${spriteName}" khỏi cơ sở dữ liệu không?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/sprites/${spriteId}?project_id=${currentProject.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Lỗi khi xóa ảnh');
      setSprites((prev) => prev.filter((s) => s.id !== spriteId));
      if (selectedSprite?.id === spriteId) setSelectedSprite(null);
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa ảnh khỏi MySQL.');
    }
  };

  /**
   * Xóa một bản ghi preset khỏi MySQL.
   * @param {number} presetId Mã preset
   * @param {string} presetName Tên preset
   */
  const handleDeletePreset = async (presetId, presetName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bản ghi "${presetName}" không?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/character-presets/${presetId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Không thể xóa bản ghi khỏi cơ sở dữ liệu.');
      setPresets((prev) => prev.filter((p) => p.id !== presetId));
      if (selectedPreset?.id === presetId) setSelectedPreset(null);
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa bản ghi.');
    }
  };

  /**
   * Xóa nhân vật Godot khỏi MySQL.
   * @param {number} charId Mã nhân vật
   * @param {string} charName Tên nhân vật
   */
  const handleDeleteCharacter = async (charId, charName) => {
    if (!window.confirm(`Bạn có chắc muốn xóa nhân vật "${charName}" khỏi phòng thử nghiệm không?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/testbed/characters/${charId}?project_id=${currentProject.id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Lỗi khi xóa nhân vật');
      setCharacters((prev) => prev.filter((c) => c.id !== charId));
      if (selectedCharacter?.id === charId) setSelectedCharacter(null);
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa nhân vật.');
    }
  };

  /**
   * Xóa bản đồ nền khỏi MySQL.
   */
  const handleDeleteMap = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa bản đồ nền này khỏi cơ sở dữ liệu không?')) {
      return;
    }
    try {
      const res = await fetch(`/api/testbed/map?project_id=${currentProject.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Lỗi khi xóa bản đồ');
      setMapData(null);
      if (selectedMap) setSelectedMap(null);
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa bản đồ.');
    }
  };

  /**
   * Mở xem chi tiết preset đầy đủ.
   * @param {number} presetId Mã preset
   */
  const handleOpenPresetDetail = async (presetId) => {
    try {
      const res = await fetch(`/api/projects/${currentProject.id}/character-presets/${presetId}`);
      if (!res.ok) throw new Error('Không thể tải thông tin chi tiết hồ sơ.');
      const resJson = await res.json();
      setSelectedPreset(resJson.data);
    } catch (err) {
      alert(err.message || 'Lỗi đọc chi tiết.');
    }
  };

  /**
   * Sao chép văn bản vào bộ nhớ tạm.
   * @param {string} text Nội dung cần copy
   * @param {'positive' | 'negative'} type Loại prompt
   */
  const handleCopyText = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'positive') {
      setCopiedPos(true);
      setTimeout(() => setCopiedPos(false), 2000);
    } else {
      setCopiedNeg(true);
      setTimeout(() => setCopiedNeg(false), 2000);
    }
  };

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
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#a39bc2' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
              <span>Đang đọc dữ liệu hồ sơ từ MySQL…</span>
            </div>
          ) : presets.length === 0 ? (
            <div className="atelier-assets-empty">
              <div className="pixel-empty-icon-wrap">
                <div className="pixel-empty-circle-aura" />
                <PixelChest size={64} className="pixel-art-glow pixel-art-float" />
              </div>
              <h3>Dự án này chưa lưu hồ sơ nhân vật nào</h3>
              <p>
                Hãy sang mục <strong>"Phân tích &amp; Prompt"</strong>, nạp sprite mẫu, thiết kế ý tưởng nhân vật mới và bấm <strong>"Lưu vào Dự án"</strong> để quản lý thư viện tại đây.
              </p>
            </div>
          ) : (
            <div className="atelier-assets-grid">
              {presets.map((preset) => {
                const metrics = preset.metrics_data || {};
                const height = metrics.anatomical_height || metrics.visible_height;
                const heads = metrics.heads_tall;

                return (
                  <div key={preset.id} className="atelier-assets-card">
                    <div>
                      {/* Tiêu đề & Ngày lưu */}
                      <div className="atelier-assets-card-header">
                        <h3 className="atelier-assets-card-title">{preset.name}</h3>
                        <span className="atelier-assets-card-time">
                          <Clock size={11} />
                          {formatDate(preset.created_at)}
                        </span>
                      </div>

                      {/* Ý tưởng nhân vật mới */}
                      <div className="atelier-assets-card-concept">
                        🪄 Concept: {preset.new_character_concept}
                      </div>

                      {/* Các thẻ Tag chỉ số đo lường */}
                      <div className="atelier-assets-metrics-row">
                        {height && (
                          <span className="atelier-assets-metric-pill emerald">
                            📏 {height}px
                          </span>
                        )}
                        {heads && (
                          <span className="atelier-assets-metric-pill indigo">
                            👤 {typeof heads === 'number' ? heads.toFixed(1) : heads} đầu
                          </span>
                        )}
                        <span className="atelier-assets-metric-pill rose">
                          🧭 {preset.target_direction || 'Front View'}
                        </span>
                      </div>
                    </div>

                    {/* Các nút tác vụ */}
                    <div className="atelier-assets-card-actions">
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="atelier-assets-btn-sub"
                          onClick={() => handleOpenPresetDetail(preset.id)}
                          title="Xem toàn bộ chỉ số và prompt"
                        >
                          <Eye size={13} />
                          <span>Chi tiết</span>
                        </button>

                        {onLoadPresetToStudio && (
                          <button
                            type="button"
                            className="atelier-assets-btn-sub primary-link"
                            onClick={async () => {
                              const res = await fetch(`/api/projects/${currentProject.id}/character-presets/${preset.id}`);
                              if (res.ok) {
                                const json = await res.json();
                                onLoadPresetToStudio(json.data);
                              }
                            }}
                            title="Nạp toàn bộ số đo và prompt này vào màn hình Studio"
                          >
                            <ArrowRight size={13} />
                            <span>Mở Studio</span>
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        className="atelier-assets-btn-delete"
                        onClick={() => handleDeletePreset(preset.id, preset.name)}
                        title="Xóa bản ghi này khỏi MySQL"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------
          TAB 2: KHO ẢNH SPRITE & SHEET (LƯỚI / DANH SÁCH)
          -------------------------------------------------------- */}
      {activeAssetTab === 'sprites' && (
        <div>
          {/* Thanh phụ: Tiêu đề danh mục & Nút chuyển Lưới / Danh sách */}
          <div className="atelier-assets-toolbar-sub">
            <div>
              <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600 }}>
                Lịch sử ảnh đã thêm &amp; chuẩn hóa gần đây
              </span>
              <span style={{ fontSize: '0.75rem', color: '#6e658a', marginLeft: '8px' }}>
                (Tự động sắp xếp mới nhất lên đầu)
              </span>
            </div>

            {/* Nút chuyển đổi View Mode */}
            <div className="atelier-assets-viewmode-toggle">
              <button
                type="button"
                className={`atelier-assets-viewmode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid size={13} />
                <span>Dạng Lưới</span>
              </button>

              <button
                type="button"
                className={`atelier-assets-viewmode-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                <List size={13} />
                <span>Dạng Bảng</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#a39bc2' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
              <span>Đang tải danh sách ảnh sprite từ MySQL…</span>
            </div>
          ) : sprites.length === 0 ? (
            <div className="atelier-assets-empty">
              <div className="pixel-empty-icon-wrap">
                <div className="pixel-empty-circle-aura" />
                <PixelCrystal size={60} className="pixel-art-glow pixel-art-float" />
              </div>
              <h3>Chưa có ảnh Sprite nào được lưu trong dự án</h3>
              <p>
                Khi bạn nạp ảnh vào bàn làm việc <strong>"Xử lý ảnh"</strong> hoặc chuyển tiếp từ <strong>"Tạo ảnh AI"</strong>, ảnh gốc và ảnh đã chuẩn hóa sẽ được tự động lưu trữ tại đây.
              </p>
              {onSelectTab && (
                <button
                  type="button"
                  className="atelier-assets-btn-sub primary-link"
                  onClick={() => onSelectTab('workspace')}
                  style={{ marginTop: '8px', padding: '8px 16px' }}
                >
                  <Wrench size={14} />
                  <span>Đi đến Xử lý ảnh</span>
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* DẠNG LƯỚI (GRID VIEW) */
            <div className="atelier-assets-grid">
              {sprites.map((s) => {
                const thumbUrl = s.has_processed
                  ? `/api/sprites/${s.id}/processed?project_id=${currentProject.id}`
                  : `/api/sprites/${s.id}/raw?project_id=${currentProject.id}`;
                const totalBytes = (s.raw_bytes || 0) + (s.processed_bytes || 0);

                return (
                  <div key={s.id} className="atelier-assets-card" style={{ padding: 0, overflow: 'hidden' }}>
                    {/* Khung xem trước ảnh Thumbnail */}
                    <div className="atelier-assets-thumb-frame">
                      <img
                        src={thumbUrl}
                        alt={s.name}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />

                      {/* Tag trạng thái góc trên */}
                      <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', gap: '4px' }}>
                        {s.has_processed ? (
                          <span className="atelier-assets-metric-pill emerald" style={{ fontSize: '0.65rem' }}>
                            Đã xử lý
                          </span>
                        ) : (
                          <span className="atelier-assets-metric-pill indigo" style={{ fontSize: '0.65rem' }}>
                            Ảnh gốc (Raw)
                          </span>
                        )}
                      </div>

                      {/* Nút phóng to nhanh */}
                      <button
                        type="button"
                        onClick={() => setSelectedSprite(s)}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: 'rgba(10, 7, 20, 0.75)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: '#fff',
                          padding: '5px',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                        title="Phóng to ảnh"
                      >
                        <Maximize2 size={13} />
                      </button>
                    </div>

                    {/* Thông tin mô tả ảnh */}
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div
                        style={{ fontSize: '0.88rem', color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={s.name}
                      >
                        {s.name}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.725rem', color: 'var(--atl-text-secondary)' }}>
                        <span>{formatBytes(totalBytes)}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#6e658a' }}>
                          <Clock size={11} />
                          {formatDate(s.created_at)}
                        </span>
                      </div>

                      {/* Cụm nút hành động */}
                      <div className="atelier-assets-card-actions">
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="atelier-assets-btn-sub"
                            onClick={() => setSelectedSprite(s)}
                            title="Xem chi tiết ảnh"
                          >
                            <Eye size={12} />
                            <span>Chi tiết</span>
                          </button>

                          <button
                            type="button"
                            className="atelier-assets-btn-sub primary-link"
                            onClick={() => handleOpenInWorkspace(s)}
                            title="Nạp vào Workspace để sửa lại"
                          >
                            <Wrench size={12} />
                            <span>Workspace</span>
                          </button>

                          <button
                            type="button"
                            className="atelier-assets-btn-sub"
                            onClick={() => handleDownloadSprite(s, s.has_processed)}
                            title="Tải ảnh PNG về máy"
                          >
                            <Download size={12} />
                          </button>
                        </div>

                        <button
                          type="button"
                          className="atelier-assets-btn-delete"
                          onClick={() => handleDeleteSprite(s.id, s.name)}
                          title="Xóa ảnh khỏi MySQL"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* DẠNG BẢNG DANH SÁCH (LIST VIEW) */
            <div className="atelier-assets-table-box">
              <div className="atelier-assets-table-header">
                <span>Ảnh</span>
                <span>Tên ảnh / Tệp tin</span>
                <span>Trạng thái</span>
                <span>Dung lượng</span>
                <span>Ngày nạp</span>
                <span style={{ textAlign: 'right' }}>Thao tác</span>
              </div>

              <div>
                {sprites.map((s) => {
                  const thumbUrl = s.has_processed
                    ? `/api/sprites/${s.id}/processed?project_id=${currentProject.id}`
                    : `/api/sprites/${s.id}/raw?project_id=${currentProject.id}`;
                  const totalBytes = (s.raw_bytes || 0) + (s.processed_bytes || 0);

                  return (
                    <div key={s.id} className="atelier-assets-table-row">
                      {/* Thumbnail nhỏ */}
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          background: '#07050e',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          border: '1px solid rgba(168, 85, 247, 0.2)'
                        }}
                        onClick={() => setSelectedSprite(s)}
                      >
                        <img
                          src={thumbUrl}
                          alt={s.name}
                          style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', imageRendering: 'pixelated' }}
                        />
                      </div>

                      {/* Tên ảnh */}
                      <div style={{ color: '#fff', fontWeight: 500, paddingRight: '12px', wordBreak: 'break-word' }}>
                        {s.name}
                      </div>

                      {/* Trạng thái */}
                      <div>
                        {s.has_processed ? (
                          <span className="atelier-assets-metric-pill emerald" style={{ fontSize: '0.68rem' }}>
                            Đã xử lý
                          </span>
                        ) : (
                          <span className="atelier-assets-metric-pill indigo" style={{ fontSize: '0.68rem' }}>
                            Ảnh gốc (Raw)
                          </span>
                        )}
                      </div>

                      {/* Dung lượng */}
                      <div style={{ color: 'var(--atl-text-secondary)', fontSize: '0.75rem' }}>
                        {formatBytes(totalBytes)}
                      </div>

                      {/* Ngày lưu */}
                      <div style={{ color: '#6e658a', fontSize: '0.725rem' }}>
                        {formatDate(s.created_at)}
                      </div>

                      {/* Thao tác */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                        <button
                          type="button"
                          className="atelier-assets-btn-sub"
                          onClick={() => setSelectedSprite(s)}
                          style={{ padding: '4px 6px' }}
                          title="Xem chi tiết"
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          type="button"
                          className="atelier-assets-btn-sub primary-link"
                          onClick={() => handleOpenInWorkspace(s)}
                          style={{ padding: '4px 6px' }}
                          title="Mở vào Workspace"
                        >
                          <Wrench size={12} />
                        </button>
                        <button
                          type="button"
                          className="atelier-assets-btn-sub"
                          onClick={() => handleDownloadSprite(s, s.has_processed)}
                          style={{ padding: '4px 6px' }}
                          title="Tải về"
                        >
                          <Download size={12} />
                        </button>
                        <button
                          type="button"
                          className="atelier-assets-btn-delete"
                          onClick={() => handleDeleteSprite(s.id, s.name)}
                          title="Xóa ảnh"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------
          TAB 3: ĐỘI HÌNH NHÂN VẬT GODOT
          -------------------------------------------------------- */}
      {activeAssetTab === 'characters' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#a39bc2' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
              <span>Đang tải danh sách nhân vật Godot từ MySQL…</span>
            </div>
          ) : characters.length === 0 ? (
            <div className="atelier-assets-empty">
              <div className="pixel-empty-icon-wrap">
                <div className="pixel-empty-circle-aura" />
                <PixelSword size={56} className="pixel-art-glow-amber pixel-art-float" />
              </div>
              <h3>Chưa có nhân vật nào được lưu trong Godot Testbed</h3>
              <p>
                Hãy mở mục <strong>"Thử nghiệm Godot"</strong>, cấu hình nhân vật từ 15 ô frame hoạt họa hoặc Sprite Sheet để kiểm thử và lưu vào đội hình.
              </p>
              {onSelectTab && (
                <button
                  type="button"
                  className="atelier-assets-btn-sub primary-link"
                  onClick={() => onSelectTab('godot_testbed')}
                  style={{ marginTop: '8px', padding: '8px 16px' }}
                >
                  <Gamepad2 size={14} />
                  <span>Mở Thử nghiệm Godot</span>
                </button>
              )}
            </div>
          ) : (
            <div>
              {/* Thanh điều phối đội hình */}
              <div className="atelier-assets-squad-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.825rem', color: '#fff', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={characters.length > 0 && selectedCharIds.size === characters.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCharIds(new Set(characters.map((c) => c.id)));
                        } else {
                          setSelectedCharIds(new Set());
                        }
                      }}
                      style={{ accentColor: '#10b981', cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <span>Chọn tất cả ({selectedCharIds.size}/{characters.length} nhân vật đã chọn)</span>
                  </label>
                </div>

                <button
                  type="button"
                  className="atelier-assets-btn-deploy"
                  disabled={selectedCharIds.size === 0}
                  onClick={handleDeploySelectedToGodot}
                  title="Đưa các nhân vật đã tích chọn vào phòng thử nghiệm Godot"
                >
                  <Gamepad2 size={15} />
                  <span>Đưa {selectedCharIds.size} nhân vật vào Godot Testbed</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              {/* Lưới các thẻ nhân vật */}
              <div className="atelier-assets-grid">
                {characters.map((char) => {
                  const slotCount = Object.keys(char.slots_data || {}).length;
                  const idleDown = char.slots_data?.down_0;
                  const isChecked = selectedCharIds.has(char.id);

                  return (
                    <div
                      key={char.id}
                      className={`atelier-assets-card ${isChecked ? 'selected' : ''}`}
                      style={{ position: 'relative' }}
                    >
                      {/* Checkbox tích chọn ở góc trên phải */}
                      <label
                        style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          background: isChecked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(14, 10, 26, 0.85)',
                          border: isChecked ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid rgba(168, 85, 247, 0.2)',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.725rem',
                          color: isChecked ? '#34d399' : 'var(--atl-text-secondary)',
                          transition: 'all 0.15s ease'
                        }}
                        title="Tích chọn nhân vật này để đưa vào Godot Testbed"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedCharIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(char.id)) next.delete(char.id);
                              else next.add(char.id);
                              return next;
                            });
                          }}
                          style={{ accentColor: '#10b981', cursor: 'pointer', width: '14px', height: '14px' }}
                        />
                        <span>{isChecked ? 'Đã chọn' : 'Bỏ chọn'}</span>
                      </label>

                      <div>
                        {/* Tiêu đề & Icon */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
                              background: '#07050e',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              border: '1px solid rgba(168, 85, 247, 0.2)'
                            }}
                          >
                            {idleDown ? (
                              <img src={idleDown} alt={char.name} style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain', imageRendering: 'pixelated' }} />
                            ) : (
                              <span style={{ fontSize: '1.4rem' }}>🦸‍♂️</span>
                            )}
                          </div>

                          <div>
                            <h3 style={{ fontSize: '0.96rem', color: '#fff', margin: '0 0 2px', fontWeight: 600, paddingRight: '80px' }}>
                              {char.name}
                            </h3>
                            <div style={{ fontSize: '0.725rem', color: '#34d399', fontWeight: 600 }}>
                              🎮 {slotCount}/15 ô frame hoạt họa
                            </div>
                          </div>
                        </div>

                        {/* Các thông số kỹ thuật */}
                        <div className="atelier-assets-metrics-row">
                          <span className="atelier-assets-metric-pill neutral">
                            Tỉ lệ: {char.scale || 1.0}x
                          </span>
                          <span className="atelier-assets-metric-pill neutral">
                            Tốc độ: {char.fps || 8} FPS
                          </span>
                          <span className="atelier-assets-metric-pill neutral">
                            Vị trí X: {char.pos_x || 260}px
                          </span>
                        </div>
                      </div>

                      {/* Nút hành động */}
                      <div className="atelier-assets-card-actions">
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="atelier-assets-btn-sub"
                            onClick={() => setSelectedCharacter(char)}
                            title="Xem toàn bộ 15 ô frame của nhân vật"
                          >
                            <Eye size={12} />
                            <span>Xem 15 ô</span>
                          </button>

                          <button
                            type="button"
                            className="atelier-assets-btn-sub primary-link"
                            onClick={() => {
                              if (onDeployCharactersToGodot) {
                                onDeployCharactersToGodot([char.id]);
                              } else if (onSelectTab) {
                                onSelectTab('godot_testbed');
                              }
                            }}
                            title="Chỉ đưa riêng nhân vật này vào Godot Testbed"
                          >
                            <Gamepad2 size={12} />
                            <span>Vào Testbed</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          className="atelier-assets-btn-delete"
                          onClick={() => handleDeleteCharacter(char.id, char.name)}
                          title="Xóa nhân vật khỏi MySQL"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* --------------------------------------------------------
          TAB 4: BẢN ĐỒ NỀN GAME (TESTBED MAP)
          -------------------------------------------------------- */}
      {activeAssetTab === 'maps' && (
        <div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#a39bc2' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
              <span>Đang tải thông tin bản đồ nền từ MySQL…</span>
            </div>
          ) : !mapData ? (
            <div className="atelier-assets-empty">
              <MapIcon size={42} color="#6e658a" />
              <h3>Chưa có bản đồ nền nào được nạp</h3>
              <p>
                Bạn có thể tải ảnh môi trường game trong <strong>"Thử nghiệm Godot"</strong> để nhân vật chạy nhảy và thử độ tương phản trên map thực tế.
              </p>
              {onSelectTab && (
                <button
                  type="button"
                  className="atelier-assets-btn-sub primary-link"
                  onClick={() => onSelectTab('godot_testbed')}
                  style={{ marginTop: '8px', padding: '8px 16px' }}
                >
                  <MapIcon size={14} />
                  <span>Mở Thử nghiệm Godot</span>
                </button>
              )}
            </div>
          ) : (
            <div className="atelier-assets-card" style={{ maxWidth: '720px', padding: 0, overflow: 'hidden' }}>
              {/* Xem trước ảnh map */}
              <div
                style={{
                  width: '100%',
                  height: '260px',
                  backgroundColor: '#07050e',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  borderBottom: '1px solid rgba(168, 85, 247, 0.18)'
                }}
              >
                <img
                  src={mapData.map_image_base64}
                  alt={mapData.name}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />

                {/* Vạch kẻ sàn đỏ mô phỏng */}
                {mapData.show_ground_line && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: '25%',
                      borderBottom: '2px dashed rgba(239, 68, 68, 0.8)',
                      pointerEvents: 'none'
                    }}
                  />
                )}
              </div>

              {/* Thông tin bản đồ */}
              <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="atelier-assets-card-title">{mapData.name}</h3>
                  <span className="atelier-assets-metric-pill" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                    Độ cao sàn (ground_y): {mapData.ground_y}px
                  </span>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--atl-text-secondary)', margin: 0, lineHeight: 1.45 }}>
                  Bản đồ nền đang được áp dụng trực tiếp cho phòng thử nghiệm Godot Testbed của dự án.
                </p>

                {/* Cụm nút thao tác */}
                <div className="atelier-assets-card-actions">
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="atelier-assets-btn-sub"
                      onClick={() => setSelectedMap(mapData)}
                    >
                      <Eye size={13} />
                      <span>Xem kích thước đầy đủ</span>
                    </button>

                    {onSelectTab && (
                      <button
                        type="button"
                        className="atelier-assets-btn-sub primary-link"
                        onClick={() => onSelectTab('godot_testbed')}
                      >
                        <Gamepad2 size={13} />
                        <span>Vào phòng Testbed</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    className="atelier-assets-btn-delete"
                    onClick={handleDeleteMap}
                    title="Xóa bản đồ nền khỏi MySQL"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================
          4. CÁC CỬA SỔ MODAL XEM CHI TIẾT
          ======================================================== */}

      {/* MODAL 1: CHI TIẾT HỒ SƠ & PROMPT */}
      {selectedPreset && (
        <div
          className="atelier-assets-modal-overlay"
          onClick={() => setSelectedPreset(null)}
        >
          <div
            className="atelier-assets-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.15rem', color: '#fff', margin: 0, fontWeight: 700 }}>
                {selectedPreset.name}
              </h2>
              <button
                type="button"
                className="atelier-assets-btn-delete"
                onClick={() => setSelectedPreset(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', color: '#c084fc', fontWeight: 600 }}>
              🪄 Concept: {selectedPreset.new_character_concept}
            </div>

            {/* Positive Prompt */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '0.8rem', color: '#34d399' }}>Positive Prompt (Mô tả chi tiết tạo ảnh)</strong>
                <button
                  type="button"
                  className="atelier-assets-btn-sub"
                  onClick={() => handleCopyText(selectedPreset.positive_prompt, 'positive')}
                >
                  {copiedPos ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  <span>{copiedPos ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>
              <textarea
                readOnly
                value={selectedPreset.positive_prompt}
                rows={4}
                style={{
                  width: '100%',
                  background: 'rgba(10, 7, 20, 0.85)',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  padding: '10px 12px',
                  fontSize: '0.8rem',
                  lineHeight: '1.45',
                  resize: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Negative Prompt */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '0.8rem', color: '#f43f5e' }}>Negative Prompt (Bộ lọc loại bỏ lỗi)</strong>
                <button
                  type="button"
                  className="atelier-assets-btn-sub"
                  onClick={() => handleCopyText(selectedPreset.negative_prompt, 'negative')}
                >
                  {copiedNeg ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  <span>{copiedNeg ? 'Đã chép' : 'Sao chép'}</span>
                </button>
              </div>
              <textarea
                readOnly
                value={selectedPreset.negative_prompt}
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(10, 7, 20, 0.85)',
                  border: '1px solid rgba(244, 63, 94, 0.25)',
                  borderRadius: '8px',
                  color: '#fda4af',
                  padding: '10px 12px',
                  fontSize: '0.8rem',
                  lineHeight: '1.45',
                  resize: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Footer Modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {onLoadPresetToStudio && (
                <button
                  type="button"
                  className="atelier-assets-btn-deploy"
                  onClick={() => {
                    onLoadPresetToStudio(selectedPreset);
                    setSelectedPreset(null);
                  }}
                >
                  <ArrowRight size={14} />
                  <span>Mở lại trong Studio</span>
                </button>
              )}
              <button
                type="button"
                className="atelier-assets-btn-sub"
                onClick={() => setSelectedPreset(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CHI TIẾT ẢNH SPRITE (PHÓNG TO & SO SÁNH) */}
      {selectedSprite && (
        <div
          className="atelier-assets-modal-overlay"
          onClick={() => setSelectedSprite(null)}
        >
          <div
            className="atelier-assets-modal-box"
            style={{ maxWidth: '800px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', color: '#fff', margin: '0 0 4px', fontWeight: 700 }}>
                  {selectedSprite.name}
                </h2>
                <span style={{ fontSize: '0.725rem', color: 'var(--atl-text-secondary)' }}>
                  Lưu ngày: {formatDate(selectedSprite.created_at)}
                </span>
              </div>
              <button
                type="button"
                className="atelier-assets-btn-delete"
                onClick={() => setSelectedSprite(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Vùng xem ảnh lớn */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: selectedSprite.has_processed ? '1fr 1fr' : '1fr',
              gap: '16px'
            }}>
              {/* Cột ảnh gốc */}
              <div>
                <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, marginBottom: '6px' }}>
                  Ảnh gốc ban đầu (Raw)
                </div>
                <div style={{
                  height: '240px',
                  backgroundColor: '#07050e',
                  borderRadius: '8px',
                  border: '1px solid rgba(168, 85, 247, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden'
                }}>
                  <img
                    src={`/api/sprites/${selectedSprite.id}/raw?project_id=${currentProject.id}`}
                    alt="Raw Sprite"
                    style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain', imageRendering: 'pixelated' }}
                  />
                </div>
                <div style={{ fontSize: '0.7rem', color: '#6e658a', marginTop: '4px' }}>
                  Dung lượng: {formatBytes(selectedSprite.raw_bytes)}
                </div>
              </div>

              {/* Cột ảnh đã xử lý */}
              {selectedSprite.has_processed && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600, marginBottom: '6px' }}>
                    Ảnh sau khi chuẩn hóa (Processed)
                  </div>
                  <div style={{
                    height: '240px',
                    backgroundColor: '#07050e',
                    borderRadius: '8px',
                    border: '1px solid rgba(168, 85, 247, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}>
                    <img
                      src={`/api/sprites/${selectedSprite.id}/processed?project_id=${currentProject.id}`}
                      alt="Processed Sprite"
                      style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain', imageRendering: 'pixelated' }}
                    />
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#6e658a', marginTop: '4px' }}>
                    Dung lượng: {formatBytes(selectedSprite.processed_bytes)}
                  </div>
                </div>
              )}
            </div>

            {/* Cụm nút tác vụ dưới chân Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                type="button"
                className="atelier-assets-btn-delete"
                onClick={() => handleDeleteSprite(selectedSprite.id, selectedSprite.name)}
                style={{ color: '#f87171' }}
              >
                <Trash2 size={14} />
                <span>Xóa ảnh khỏi MySQL</span>
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="atelier-assets-btn-sub"
                  onClick={() => handleDownloadSprite(selectedSprite, selectedSprite.has_processed)}
                >
                  <Download size={14} />
                  <span>Tải PNG về</span>
                </button>

                {onLoadSpriteToWorkspace && (
                  <button
                    type="button"
                    className="atelier-assets-btn-sub primary-link"
                    onClick={() => {
                      handleOpenInWorkspace(selectedSprite);
                      setSelectedSprite(null);
                    }}
                  >
                    <Wrench size={14} />
                    <span>Mở vào Workspace</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CHI TIẾT 15 Ô FRAME CỦA NHÂN VẬT GODOT */}
      {selectedCharacter && (
        <div
          className="atelier-assets-modal-overlay"
          onClick={() => setSelectedCharacter(null)}
        >
          <div
            className="atelier-assets-modal-box"
            style={{ maxWidth: '720px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', color: '#fff', margin: '0 0 2px', fontWeight: 700 }}>
                  Bộ Khung Hoạt Họa 15 Ô: {selectedCharacter.name}
                </h2>
                <span style={{ fontSize: '0.725rem', color: '#10b981' }}>
                  Gồm 3 hàng: Hướng xuống (Down), Hướng ngang (Side), Hướng lên (Up)
                </span>
              </div>
              <button
                type="button"
                className="atelier-assets-btn-delete"
                onClick={() => setSelectedCharacter(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Bảng hiển thị 15 ô */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {['down', 'side', 'up'].map((dir) => (
                <div key={dir} style={{ background: 'rgba(10, 7, 20, 0.75)', borderRadius: '10px', padding: '12px', border: '1px solid rgba(168, 85, 247, 0.18)' }}>
                  <div style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: 600, marginBottom: '8px' }}>
                    {dir === 'down' ? '⬇ Hướng Nhìn Xuống (Down)' : dir === 'side' ? '➡ Hướng Nhìn Ngang (Side)' : '⬆ Hướng Nhìn Lên (Up)'}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                    {[0, 1, 2, 3, 4].map((c) => {
                      const slotKey = `${dir}_${c}`;
                      const slotImg = selectedCharacter.slots_data?.[slotKey];
                      return (
                        <div
                          key={slotKey}
                          style={{
                            height: '74px',
                            backgroundColor: '#07050e',
                            borderRadius: '6px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(168, 85, 247, 0.16)',
                            position: 'relative'
                          }}
                        >
                          {slotImg ? (
                            <img src={slotImg} alt={slotKey} style={{ maxWidth: '90%', maxHeight: '80%', objectFit: 'contain', imageRendering: 'pixelated' }} />
                          ) : (
                            <span style={{ fontSize: '0.65rem', color: '#6e658a' }}>Rỗng</span>
                          )}
                          <span style={{ position: 'absolute', bottom: '2px', fontSize: '0.6rem', color: '#94a3b8' }}>
                            {c === 0 ? 'idle' : `walk_${c}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {onSelectTab && (
                <button
                  type="button"
                  className="atelier-assets-btn-deploy"
                  onClick={() => {
                    onSelectTab('godot_testbed');
                    setSelectedCharacter(null);
                  }}
                >
                  <Gamepad2 size={14} />
                  <span>Mở trong Godot Testbed</span>
                </button>
              )}
              <button
                type="button"
                className="atelier-assets-btn-sub"
                onClick={() => setSelectedCharacter(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: PHÓNG TO BẢN ĐỒ NỀN */}
      {selectedMap && (
        <div
          className="atelier-assets-modal-overlay"
          onClick={() => setSelectedMap(null)}
        >
          <div
            className="atelier-assets-modal-box"
            style={{ maxWidth: '850px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.15rem', color: '#fff', margin: 0, fontWeight: 700 }}>
                {selectedMap.name}
              </h2>
              <button
                type="button"
                className="atelier-assets-btn-delete"
                onClick={() => setSelectedMap(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              maxHeight: '520px',
              overflow: 'auto',
              background: '#07050e',
              borderRadius: '10px',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px'
            }}>
              <img
                src={selectedMap.map_image_base64}
                alt={selectedMap.name}
                style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="atelier-assets-btn-sub"
                onClick={() => setSelectedMap(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
