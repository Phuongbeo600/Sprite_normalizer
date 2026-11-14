// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState, useEffect, useCallback } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon minh họa kho tài nguyên, chế độ xem lưới/danh sách, tải về, xem chi tiết và xóa
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
// (Không có component nội bộ phụ thuộc)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa các biến màu sắc và phong cách Dark Gaming từ theme.css


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
 * Màn hình Kho Tài Nguyên Dự Án (Project Asset Hub).
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
    <div className="studio-workspace-container" style={{ padding: '0 4px' }}>
      {/* ========================================================
          1. THANH TIÊU ĐỀ KHO TÀI NGUYÊN DỰ ÁN
          ======================================================== */}
      <header className="studio-header-card">
        <div className="studio-title-group">
          <h1>
            <FolderOpen size={22} color="var(--accent-purple)" />
            Kho Tài Nguyên Dự Án
          </h1>
          <p>
            Quản lý, xem lại chi tiết và dọn dẹp các tài nguyên đã lưu trong cơ sở dữ liệu: <strong>{currentProject?.name}</strong>.
          </p>
        </div>

        <button
          type="button"
          className="btn-secondary-studio"
          onClick={fetchAllAssets}
          disabled={loading}
          style={{ minHeight: '34px', fontSize: '0.8rem', gap: '6px' }}
          title="Tải lại toàn bộ dữ liệu từ MySQL"
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Làm mới
        </button>
      </header>

      {/* Thông báo lỗi nếu có */}
      {error && (
        <div className="analysis-result" style={{ color: '#ef4444', marginBottom: '12px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* ========================================================
          2. THANH CHUYỂN ĐỔI 4 TAB CON (SEGMENTED TABS)
          ======================================================== */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        margin: '14px 0 16px',
        padding: '6px',
        background: 'rgba(15, 23, 42, 0.65)',
        borderRadius: '10px',
        border: '1px solid var(--border-panel)'
      }}>
        {/* Tab 1: Hồ sơ & Prompt */}
        <button
          type="button"
          onClick={() => setActiveAssetTab('presets')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '7px',
            fontSize: '0.825rem',
            fontWeight: activeAssetTab === 'presets' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            border: activeAssetTab === 'presets' ? '1px solid var(--accent-purple)' : '1px solid transparent',
            background: activeAssetTab === 'presets' ? 'rgba(168, 85, 247, 0.16)' : 'transparent',
            color: activeAssetTab === 'presets' ? '#fff' : 'var(--text-muted)'
          }}
        >
          <Bookmark size={15} color={activeAssetTab === 'presets' ? 'var(--accent-purple)' : 'currentColor'} />
          <span>Hồ Sơ &amp; Prompt</span>
          <span style={{
            background: activeAssetTab === 'presets' ? 'var(--accent-purple)' : 'rgba(255,255,255,0.08)',
            color: '#fff',
            fontSize: '0.7rem',
            padding: '1px 6px',
            borderRadius: '10px'
          }}>
            {presets.length}
          </span>
        </button>

        {/* Tab 2: Ảnh Sprite */}
        <button
          type="button"
          onClick={() => setActiveAssetTab('sprites')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '7px',
            fontSize: '0.825rem',
            fontWeight: activeAssetTab === 'sprites' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            border: activeAssetTab === 'sprites' ? '1px solid var(--accent-purple)' : '1px solid transparent',
            background: activeAssetTab === 'sprites' ? 'rgba(168, 85, 247, 0.16)' : 'transparent',
            color: activeAssetTab === 'sprites' ? '#fff' : 'var(--text-muted)'
          }}
        >
          <ImageIcon size={15} color={activeAssetTab === 'sprites' ? '#38bdf8' : 'currentColor'} />
          <span>Ảnh Sprite</span>
          <span style={{
            background: activeAssetTab === 'sprites' ? '#0284c7' : 'rgba(255,255,255,0.08)',
            color: '#fff',
            fontSize: '0.7rem',
            padding: '1px 6px',
            borderRadius: '10px'
          }}>
            {sprites.length}
          </span>
        </button>

        {/* Tab 3: Đội Hình Godot */}
        <button
          type="button"
          onClick={() => setActiveAssetTab('characters')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '7px',
            fontSize: '0.825rem',
            fontWeight: activeAssetTab === 'characters' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            border: activeAssetTab === 'characters' ? '1px solid var(--accent-purple)' : '1px solid transparent',
            background: activeAssetTab === 'characters' ? 'rgba(168, 85, 247, 0.16)' : 'transparent',
            color: activeAssetTab === 'characters' ? '#fff' : 'var(--text-muted)'
          }}
        >
          <Gamepad2 size={15} color={activeAssetTab === 'characters' ? '#10b981' : 'currentColor'} />
          <span>Đội Hình Godot</span>
          <span style={{
            background: activeAssetTab === 'characters' ? '#059669' : 'rgba(255,255,255,0.08)',
            color: '#fff',
            fontSize: '0.7rem',
            padding: '1px 6px',
            borderRadius: '10px'
          }}>
            {characters.length}
          </span>
        </button>

        {/* Tab 4: Bản Đồ Nền */}
        <button
          type="button"
          onClick={() => setActiveAssetTab('maps')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '7px',
            fontSize: '0.825rem',
            fontWeight: activeAssetTab === 'maps' ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            border: activeAssetTab === 'maps' ? '1px solid var(--accent-purple)' : '1px solid transparent',
            background: activeAssetTab === 'maps' ? 'rgba(168, 85, 247, 0.16)' : 'transparent',
            color: activeAssetTab === 'maps' ? '#fff' : 'var(--text-muted)'
          }}
        >
          <MapIcon size={15} color={activeAssetTab === 'maps' ? '#f59e0b' : 'currentColor'} />
          <span>Bản Đồ Nền</span>
          <span style={{
            background: activeAssetTab === 'maps' ? '#d97706' : 'rgba(255,255,255,0.08)',
            color: '#fff',
            fontSize: '0.7rem',
            padding: '1px 6px',
            borderRadius: '10px'
          }}>
            {mapData ? 1 : 0}
          </span>
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
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-dim)' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
              <span>Đang tải danh sách hồ sơ từ MySQL…</span>
            </div>
          ) : presets.length === 0 ? (
            <div className="studio-viewport-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <Bookmark size={40} color="var(--accent-purple)" style={{ opacity: 0.6, margin: '0 auto 12px' }} />
              <h3 style={{ color: 'var(--text-white)', margin: '0 0 6px' }}>Dự án này chưa có hồ sơ nào được lưu</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', maxWidth: '480px', margin: '0 auto 16px' }}>
                Hãy sang mục <strong>"Phân tích &amp; Prompt"</strong>, nạp sprite mẫu, tạo ý tưởng nhân vật mới và bấm <strong>"Lưu vào Dự án"</strong> để quản lý thư viện tại đây.
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '14px'
            }}>
              {presets.map((preset) => {
                const metrics = preset.metrics_data || {};
                const height = metrics.anatomical_height || metrics.visible_height;
                const heads = metrics.heads_tall;

                return (
                  <div
                    key={preset.id}
                    className="studio-metric-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      padding: '16px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-panel)',
                      background: 'var(--bg-card)',
                      transition: 'border-color 0.2s ease, transform 0.2s ease'
                    }}
                  >
                    <div>
                      {/* Tiêu đề & Ngày lưu */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '0.95rem', color: 'var(--text-white)', margin: 0, fontWeight: 600 }}>
                          {preset.name}
                        </h3>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={11} />
                          {formatDate(preset.created_at)}
                        </span>
                      </div>

                      {/* Ý tưởng nhân vật mới */}
                      <div style={{ fontSize: '0.8rem', color: 'var(--accent-purple)', fontWeight: 500, marginBottom: '10px' }}>
                        🪄 Concept: {preset.new_character_concept}
                      </div>

                      {/* Các thẻ Tag chỉ số đo lường */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                        {height && (
                          <span style={{
                            fontSize: '0.7rem',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: 'rgba(16, 185, 129, 0.12)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.25)'
                          }}>
                            📏 {height}px
                          </span>
                        )}
                        {heads && (
                          <span style={{
                            fontSize: '0.7rem',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: 'rgba(99, 102, 241, 0.12)',
                            color: '#a5b4fc',
                            border: '1px solid rgba(99, 102, 241, 0.25)'
                          }}>
                            👤 {typeof heads === 'number' ? heads.toFixed(1) : heads} đầu
                          </span>
                        )}
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: 'rgba(236, 72, 153, 0.12)',
                          color: '#f472b6',
                          border: '1px solid rgba(236, 72, 153, 0.25)'
                        }}>
                          🧭 {preset.target_direction || 'Front View'}
                        </span>
                      </div>
                    </div>

                    {/* Các nút tác vụ */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '12px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)'
                    }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="btn-secondary-studio"
                          onClick={() => handleOpenPresetDetail(preset.id)}
                          style={{ fontSize: '0.75rem', padding: '5px 9px', minHeight: '28px' }}
                          title="Xem toàn bộ chỉ số và prompt"
                        >
                          <Eye size={13} />
                          Chi tiết
                        </button>

                        {onLoadPresetToStudio && (
                          <button
                            type="button"
                            className="btn-secondary-studio"
                            onClick={async () => {
                              const res = await fetch(`/api/projects/${currentProject.id}/character-presets/${preset.id}`);
                              if (res.ok) {
                                const json = await res.json();
                                onLoadPresetToStudio(json.data);
                              }
                            }}
                            style={{
                              fontSize: '0.75rem',
                              padding: '5px 9px',
                              minHeight: '28px',
                              color: 'var(--accent-purple)',
                              borderColor: 'var(--accent-purple-glow)'
                            }}
                            title="Nạp toàn bộ số đo và prompt này vào màn hình Studio"
                          >
                            <ArrowRight size={13} />
                            Mở Studio
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeletePreset(preset.id, preset.name)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-dim)',
                          cursor: 'pointer',
                          padding: '6px',
                          borderRadius: '4px',
                          transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; }}
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
          TAB 2: ẢNH SPRITE & SHEET (LỊCH SỬ THÊM GẦN ĐÂY)
          -------------------------------------------------------- */}
      {activeAssetTab === 'sprites' && (
        <div>
          {/* Thanh phụ: Tiêu đề danh mục & Nút chuyển Lưới (Grid) / Danh sách (List) */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div>
              <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600 }}>
                Lịch sử ảnh đã thêm &amp; chỉnh sửa gần đây
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginLeft: '8px' }}>
                (Tự động sắp xếp mới nhất lên đầu)
              </span>
            </div>

            {/* Nút bấm chuyển đổi Chế độ xem: Grid ↔ List */}
            <div style={{
              display: 'inline-flex',
              background: '#0f172a',
              border: '1px solid var(--border-panel)',
              borderRadius: '6px',
              padding: '2px'
            }}>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: viewMode === 'grid' ? 'var(--accent-purple)' : 'transparent',
                  color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: viewMode === 'grid' ? 600 : 400
                }}
                title="Chế độ xem dạng lưới (Xem thumbnail ảnh to)"
              >
                <LayoutGrid size={13} />
                <span>Dạng Lưới</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('list')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: viewMode === 'list' ? 'var(--accent-purple)' : 'transparent',
                  color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: viewMode === 'list' ? 600 : 400
                }}
                title="Chế độ xem dạng danh sách (Đọc tên file đầy đủ)"
              >
                <List size={13} />
                <span>Dạng Danh Sách</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-dim)' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
              <span>Đang tải danh sách ảnh sprite từ MySQL…</span>
            </div>
          ) : sprites.length === 0 ? (
            <div className="studio-viewport-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <ImageIcon size={40} color="#38bdf8" style={{ opacity: 0.6, margin: '0 auto 12px' }} />
              <h3 style={{ color: 'var(--text-white)', margin: '0 0 6px' }}>Chưa có ảnh Sprite nào được lưu trong dự án</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', maxWidth: '480px', margin: '0 auto 16px' }}>
                Khi bạn nạp ảnh vào bàn làm việc <strong>"Xử lý ảnh"</strong> hoặc chuyển tiếp từ <strong>"Tạo ảnh AI"</strong>, ảnh gốc và ảnh đã chuẩn hóa sẽ được tự động lưu vĩnh viễn vào đây.
              </p>
              {onSelectTab && (
                <button
                  type="button"
                  className="btn-primary-studio"
                  onClick={() => onSelectTab('workspace')}
                  style={{ minHeight: '34px', fontSize: '0.8rem', margin: '0 auto' }}
                >
                  <Wrench size={14} />
                  Đi đến Xử lý ảnh
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* ========================================================
               CHẾ ĐỘ XEM 1: DẠNG LƯỚI (GRID VIEW)
               ======================================================== */
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: '14px'
            }}>
              {sprites.map((s) => {
                const thumbUrl = s.has_processed
                  ? `/api/sprites/${s.id}/processed?project_id=${currentProject.id}`
                  : `/api/sprites/${s.id}/raw?project_id=${currentProject.id}`;
                const totalBytes = (s.raw_bytes || 0) + (s.processed_bytes || 0);

                return (
                  <div
                    key={s.id}
                    className="studio-metric-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      border: '1px solid var(--border-panel)',
                      background: 'var(--bg-card)'
                    }}
                  >
                    {/* Khung xem trước ảnh Thumbnail */}
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: '140px',
                        background: 'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 50% / 16px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        borderBottom: '1px solid var(--border-panel)'
                      }}
                    >
                      <img
                        src={thumbUrl}
                        alt={s.name}
                        style={{
                          maxWidth: '90%',
                          maxHeight: '90%',
                          objectFit: 'contain',
                          imageRendering: 'pixelated'
                        }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />

                      {/* Tag trạng thái góc trên */}
                      <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', gap: '4px' }}>
                        {s.has_processed ? (
                          <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.9)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                            Đã xử lý
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.65rem', background: 'rgba(2, 132, 199, 0.9)', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
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
                          background: 'rgba(0,0,0,0.6)',
                          border: 'none',
                          color: '#fff',
                          padding: '4px',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                        title="Phóng to ảnh"
                      >
                        <Maximize2 size={13} />
                      </button>
                    </div>

                    {/* Thông tin mô tả ảnh */}
                    <div style={{ padding: '12px' }}>
                      <div style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 600, marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.name}>
                        {s.name}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.725rem', color: 'var(--text-dim)', marginBottom: '10px' }}>
                        <span>{formatBytes(totalBytes)}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Clock size={11} />
                          {formatDate(s.created_at)}
                        </span>
                      </div>

                      {/* Cụm nút hành động */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            className="btn-secondary-studio"
                            onClick={() => setSelectedSprite(s)}
                            style={{ fontSize: '0.725rem', padding: '4px 8px', minHeight: '26px' }}
                            title="Xem chi tiết ảnh"
                          >
                            <Eye size={12} />
                            Chi tiết
                          </button>

                          <button
                            type="button"
                            className="btn-secondary-studio"
                            onClick={() => handleOpenInWorkspace(s)}
                            style={{ fontSize: '0.725rem', padding: '4px 8px', minHeight: '26px', color: '#38bdf8' }}
                            title="Nạp vào Workspace để sửa lại"
                          >
                            <Wrench size={12} />
                            Workspace
                          </button>

                          <button
                            type="button"
                            className="btn-secondary-studio"
                            onClick={() => handleDownloadSprite(s, s.has_processed)}
                            style={{ fontSize: '0.725rem', padding: '4px 8px', minHeight: '26px' }}
                            title="Tải ảnh PNG về máy"
                          >
                            <Download size={12} />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteSprite(s.id, s.name)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; }}
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
            /* ========================================================
               CHẾ ĐỘ XEM 2: DẠNG DANH SÁCH (LIST VIEW)
               ======================================================== */
            <div style={{
              background: 'var(--bg-card)',
              borderRadius: '10px',
              border: '1px solid var(--border-panel)',
              overflow: 'hidden'
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '60px 1fr 120px 90px 140px 130px',
                padding: '10px 14px',
                background: 'rgba(0,0,0,0.3)',
                borderBottom: '1px solid var(--border-panel)',
                fontSize: '0.75rem',
                color: 'var(--text-dim)',
                fontWeight: 600
              }}>
                <span>Ảnh</span>
                <span>Tên ảnh / File</span>
                <span>Trạng thái</span>
                <span>Dung lượng</span>
                <span>Ngày nạp</span>
                <span style={{ textAlign: 'right' }}>Thao tác</span>
              </div>

              <div>
                {sprites.map((s, idx) => {
                  const thumbUrl = s.has_processed
                    ? `/api/sprites/${s.id}/processed?project_id=${currentProject.id}`
                    : `/api/sprites/${s.id}/raw?project_id=${currentProject.id}`;
                  const totalBytes = (s.raw_bytes || 0) + (s.processed_bytes || 0);

                  return (
                    <div
                      key={s.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '60px 1fr 120px 90px 140px 130px',
                        padding: '8px 14px',
                        alignItems: 'center',
                        fontSize: '0.8rem',
                        borderBottom: idx === sprites.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.04)',
                        background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'
                      }}
                    >
                      {/* Thumbnail nhỏ */}
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          background: 'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 50% / 8px 8px',
                          borderRadius: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedSprite(s)}
                      >
                        <img
                          src={thumbUrl}
                          alt={s.name}
                          style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', imageRendering: 'pixelated' }}
                        />
                      </div>

                      {/* Tên ảnh hiển thị rõ ràng */}
                      <div style={{ color: '#fff', fontWeight: 500, paddingRight: '12px', wordBreak: 'break-word' }}>
                        {s.name}
                      </div>

                      {/* Trạng thái */}
                      <div>
                        {s.has_processed ? (
                          <span style={{ fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '4px' }}>
                            Đã xử lý
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', background: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', border: '1px solid rgba(2, 132, 199, 0.3)', padding: '2px 8px', borderRadius: '4px' }}>
                            Ảnh gốc (Raw)
                          </span>
                        )}
                      </div>

                      {/* Dung lượng */}
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {formatBytes(totalBytes)}
                      </div>

                      {/* Ngày lưu */}
                      <div style={{ color: 'var(--text-dim)', fontSize: '0.725rem' }}>
                        {formatDate(s.created_at)}
                      </div>

                      {/* Thao tác */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                        <button
                          type="button"
                          className="btn-secondary-studio"
                          onClick={() => setSelectedSprite(s)}
                          style={{ padding: '3px 6px', minHeight: '24px' }}
                          title="Xem chi tiết"
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          type="button"
                          className="btn-secondary-studio"
                          onClick={() => handleOpenInWorkspace(s)}
                          style={{ padding: '3px 6px', minHeight: '24px', color: '#38bdf8' }}
                          title="Mở vào Workspace"
                        >
                          <Wrench size={12} />
                        </button>
                        <button
                          type="button"
                          className="btn-secondary-studio"
                          onClick={() => handleDownloadSprite(s, s.has_processed)}
                          style={{ padding: '3px 6px', minHeight: '24px' }}
                          title="Tải về"
                        >
                          <Download size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSprite(s.id, s.name)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '3px 6px' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; }}
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
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-dim)' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
              <span>Đang tải danh sách nhân vật Godot từ MySQL…</span>
            </div>
          ) : characters.length === 0 ? (
            <div className="studio-viewport-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <Gamepad2 size={40} color="#10b981" style={{ opacity: 0.6, margin: '0 auto 12px' }} />
              <h3 style={{ color: 'var(--text-white)', margin: '0 0 6px' }}>Chưa có nhân vật nào được lưu trong Godot Testbed</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', maxWidth: '480px', margin: '0 auto 16px' }}>
                Hãy mở mục <strong>"Thử nghiệm Godot"</strong>, tạo nhân vật từ 15 ô frame hoặc nạp Sprite Sheet để kiểm thử và lưu vào đội hình.
              </p>
              {onSelectTab && (
                <button
                  type="button"
                  className="btn-primary-studio"
                  onClick={() => onSelectTab('godot_testbed')}
                  style={{ minHeight: '34px', fontSize: '0.8rem', margin: '0 auto' }}
                >
                  <Gamepad2 size={14} />
                  Mở Thử nghiệm Godot
                </button>
              )}
            </div>
          ) : (
            <div>
              {/* Thanh công cụ Đội hình: Checkbox chọn tất cả & Nút nạp đội hình đã chọn vào Godot Testbed */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
                flexWrap: 'wrap',
                gap: '10px',
                padding: '10px 14px',
                background: 'rgba(15, 23, 42, 0.65)',
                borderRadius: '8px',
                border: '1px solid var(--border-panel)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.825rem', color: '#fff', fontWeight: 500 }}>
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
                  className="btn-primary-studio"
                  disabled={selectedCharIds.size === 0}
                  onClick={handleDeploySelectedToGodot}
                  style={{
                    minHeight: '34px',
                    fontSize: '0.8rem',
                    gap: '8px',
                    padding: '6px 14px',
                    background: selectedCharIds.size > 0 ? '#10b981' : undefined,
                    borderColor: selectedCharIds.size > 0 ? '#059669' : undefined,
                    opacity: selectedCharIds.size === 0 ? 0.5 : 1,
                    cursor: selectedCharIds.size === 0 ? 'not-allowed' : 'pointer'
                  }}
                  title="Đưa các nhân vật đã tích chọn vào phòng thử nghiệm Godot"
                >
                  <Gamepad2 size={15} />
                  <span>Đưa {selectedCharIds.size} nhân vật đã chọn vào Godot Testbed</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              {/* Lưới các thẻ nhân vật kèm Checkbox tích chọn riêng */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '14px'
              }}>
                {characters.map((char) => {
                  const slotCount = Object.keys(char.slots_data || {}).length;
                  const idleDown = char.slots_data?.down_0;
                  const isChecked = selectedCharIds.has(char.id);

                  return (
                    <div
                      key={char.id}
                      className="studio-metric-card"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        borderRadius: '10px',
                        padding: '16px',
                        border: isChecked ? '1px solid #10b981' : '1px solid var(--border-panel)',
                        boxShadow: isChecked ? '0 0 14px rgba(16, 185, 129, 0.2)' : 'none',
                        background: 'var(--bg-card)',
                        position: 'relative',
                        transition: 'border-color 0.2s, box-shadow 0.2s'
                      }}
                    >
                      {/* Checkbox tích chọn ở góc trên bên phải của Card */}
                      <label
                        style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          background: isChecked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(15, 23, 42, 0.8)',
                          border: isChecked ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-card)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '0.725rem',
                          color: isChecked ? '#34d399' : 'var(--text-muted)'
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
                          style={{ accentColor: '#10b981', cursor: 'pointer', width: '15px', height: '15px' }}
                        />
                        <span>{isChecked ? 'Đã chọn' : 'Bỏ chọn'}</span>
                      </label>

                      <div>
                        {/* Tiêu đề & Icon */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
                              background: 'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 50% / 8px 8px',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              border: '1px solid var(--border-panel)'
                            }}
                          >
                            {idleDown ? (
                              <img src={idleDown} alt={char.name} style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain', imageRendering: 'pixelated' }} />
                            ) : (
                              <span style={{ fontSize: '1.4rem' }}>🦸‍♂️</span>
                            )}
                          </div>

                          <div>
                            <h3 style={{ fontSize: '0.95rem', color: '#fff', margin: '0 0 2px', fontWeight: 600, paddingRight: '80px' }}>
                              {char.name}
                            </h3>
                            <div style={{ fontSize: '0.725rem', color: '#34d399', fontWeight: 500 }}>
                              🎮 {slotCount}/15 ô frame đã nạp
                            </div>
                          </div>
                        </div>

                        {/* Các thông số kỹ thuật */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                            Tỉ lệ: {char.scale || 1.0}x
                          </span>
                          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                            Tốc độ: {char.fps || 8} FPS
                          </span>
                          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                            Vị trí X: {char.pos_x || 260}px
                          </span>
                        </div>
                      </div>

                      {/* Nút hành động */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn-secondary-studio"
                            onClick={() => setSelectedCharacter(char)}
                            style={{ fontSize: '0.75rem', padding: '4px 9px', minHeight: '28px' }}
                            title="Xem toàn bộ 15 ô frame của nhân vật"
                          >
                            <Eye size={12} />
                            Xem 15 ô
                          </button>

                          <button
                            type="button"
                            className="btn-secondary-studio"
                            onClick={() => {
                              if (onDeployCharactersToGodot) {
                                onDeployCharactersToGodot([char.id]);
                              } else if (onSelectTab) {
                                onSelectTab('godot_testbed');
                              }
                            }}
                            style={{ fontSize: '0.75rem', padding: '4px 9px', minHeight: '28px', color: '#10b981' }}
                            title="Chỉ đưa riêng nhân vật này vào Godot Testbed"
                          >
                            <Gamepad2 size={12} />
                            Vào Testbed
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteCharacter(char.id, char.name)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; }}
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
            <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-dim)' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
              <span>Đang tải thông tin bản đồ nền từ MySQL…</span>
            </div>
          ) : !mapData ? (
            <div className="studio-viewport-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <MapIcon size={40} color="#f59e0b" style={{ opacity: 0.6, margin: '0 auto 12px' }} />
              <h3 style={{ color: 'var(--text-white)', margin: '0 0 6px' }}>Chưa có bản đồ nền nào được lưu</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', maxWidth: '480px', margin: '0 auto 16px' }}>
                Bạn có thể nạp một tấm ảnh cảnh quan môi trường trong <strong>"Thử nghiệm Godot"</strong> để nhân vật chạy nhảy trên nền map thực tế.
              </p>
              {onSelectTab && (
                <button
                  type="button"
                  className="btn-primary-studio"
                  onClick={() => onSelectTab('godot_testbed')}
                  style={{ minHeight: '34px', fontSize: '0.8rem', margin: '0 auto' }}
                >
                  <MapIcon size={14} />
                  Mở Thử nghiệm Godot
                </button>
              )}
            </div>
          ) : (
            <div
              className="studio-metric-card"
              style={{
                borderRadius: '10px',
                border: '1px solid var(--border-panel)',
                background: 'var(--bg-card)',
                maxWidth: '680px',
                overflow: 'hidden'
              }}
            >
              {/* Xem trước ảnh map */}
              <div
                style={{
                  width: '100%',
                  height: '240px',
                  background: 'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 50% / 16px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  borderBottom: '1px solid var(--border-panel)'
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
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '1rem', color: '#fff', margin: 0, fontWeight: 600 }}>
                    {mapData.name}
                  </h3>
                  <span style={{ fontSize: '0.75rem', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '2px 8px', borderRadius: '4px' }}>
                    Độ cao sàn (ground_y): {mapData.ground_y}px
                  </span>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
                  Bản đồ nền đang được áp dụng trực tiếp cho phòng thử nghiệm Godot Testbed của dự án.
                </p>

                {/* Cụm nút thao tác */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="btn-secondary-studio"
                      onClick={() => setSelectedMap(mapData)}
                      style={{ fontSize: '0.75rem', padding: '5px 12px', minHeight: '30px' }}
                    >
                      <Eye size={13} />
                      Xem kích thước đầy đủ
                    </button>

                    {onSelectTab && (
                      <button
                        type="button"
                        className="btn-secondary-studio"
                        onClick={() => onSelectTab('godot_testbed')}
                        style={{ fontSize: '0.75rem', padding: '5px 12px', minHeight: '30px', color: '#f59e0b' }}
                      >
                        <Gamepad2 size={13} />
                        Vào phòng Testbed
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleDeleteMap}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '6px' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; }}
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
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-panel)',
            borderRadius: '12px',
            maxWidth: '640px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>
                {selectedPreset.name}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedPreset(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--accent-purple)', fontWeight: 500, marginBottom: '16px' }}>
              🪄 Concept: {selectedPreset.new_character_concept}
            </div>

            {/* Positive Prompt */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '0.8rem', color: '#10b981' }}>Positive Prompt (Mô tả chi tiết tạo ảnh)</strong>
                <button
                  type="button"
                  className="btn-secondary-studio"
                  onClick={() => handleCopyText(selectedPreset.positive_prompt, 'positive')}
                  style={{ fontSize: '0.725rem', padding: '4px 8px', minHeight: '26px' }}
                >
                  {copiedPos ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  {copiedPos ? 'Đã chép' : 'Sao chép'}
                </button>
              </div>
              <textarea
                readOnly
                value={selectedPreset.positive_prompt}
                rows={4}
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid var(--border-panel)',
                  borderRadius: '6px',
                  color: 'var(--text-white)',
                  padding: '8px 10px',
                  fontSize: '0.8rem',
                  lineHeight: '1.4',
                  resize: 'none'
                }}
              />
            </div>

            {/* Negative Prompt */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '0.8rem', color: '#ef4444' }}>Negative Prompt (Bộ lọc loại bỏ lỗi)</strong>
                <button
                  type="button"
                  className="btn-secondary-studio"
                  onClick={() => handleCopyText(selectedPreset.negative_prompt, 'negative')}
                  style={{ fontSize: '0.725rem', padding: '4px 8px', minHeight: '26px' }}
                >
                  {copiedNeg ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  {copiedNeg ? 'Đã chép' : 'Sao chép'}
                </button>
              </div>
              <textarea
                readOnly
                value={selectedPreset.negative_prompt}
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid var(--border-panel)',
                  borderRadius: '6px',
                  color: 'var(--text-muted)',
                  padding: '8px 10px',
                  fontSize: '0.8rem',
                  lineHeight: '1.4',
                  resize: 'none'
                }}
              />
            </div>

            {/* Footer Modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {onLoadPresetToStudio && (
                <button
                  type="button"
                  className="btn-primary-studio"
                  onClick={() => {
                    onLoadPresetToStudio(selectedPreset);
                    setSelectedPreset(null);
                  }}
                  style={{ minHeight: '34px', fontSize: '0.8rem', padding: '6px 14px' }}
                >
                  <ArrowRight size={14} />
                  Mở lại trong Studio
                </button>
              )}
              <button
                type="button"
                className="btn-secondary-studio"
                onClick={() => setSelectedPreset(null)}
                style={{ minHeight: '34px', fontSize: '0.8rem' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CHI TIẾT ẢNH SPRITE (PHÓNG TO & SO SÁNH) */}
      {selectedSprite && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-panel)',
            borderRadius: '12px',
            maxWidth: '780px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: '0 0 4px' }}>
                  {selectedSprite.name}
                </h2>
                <span style={{ fontSize: '0.725rem', color: 'var(--text-dim)' }}>
                  Lưu ngày: {formatDate(selectedSprite.created_at)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSprite(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Vùng xem ảnh lớn */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: selectedSprite.has_processed ? '1fr 1fr' : '1fr',
              gap: '16px',
              marginBottom: '20px'
            }}>
              {/* Cột ảnh gốc */}
              <div>
                <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, marginBottom: '6px' }}>
                  Ảnh gốc ban đầu (Raw)
                </div>
                <div style={{
                  height: '240px',
                  background: 'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 50% / 16px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-panel)',
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
                <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>
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
                    background: 'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 50% / 16px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-panel)',
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
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                    Dung lượng: {formatBytes(selectedSprite.processed_bytes)}
                  </div>
                </div>
              )}
            </div>

            {/* Cụm nút tác vụ dưới chân Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <button
                type="button"
                onClick={() => handleDeleteSprite(selectedSprite.id, selectedSprite.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                <Trash2 size={13} />
                Xóa ảnh khỏi MySQL
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary-studio"
                  onClick={() => handleDownloadSprite(selectedSprite, selectedSprite.has_processed)}
                  style={{ minHeight: '34px', fontSize: '0.8rem', gap: '6px' }}
                >
                  <Download size={14} />
                  Tải PNG về
                </button>

                {onLoadSpriteToWorkspace && (
                  <button
                    type="button"
                    className="btn-primary-studio"
                    onClick={() => {
                      handleOpenInWorkspace(selectedSprite);
                      setSelectedSprite(null);
                    }}
                    style={{ minHeight: '34px', fontSize: '0.8rem', gap: '6px' }}
                  >
                    <Wrench size={14} />
                    Mở vào Workspace
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CHI TIẾT 15 Ô FRAME CỦA NHÂN VẬT GODOT */}
      {selectedCharacter && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-panel)',
            borderRadius: '12px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: '0 0 2px' }}>
                  Bộ Khung Hoạt Họa 15 Ô: {selectedCharacter.name}
                </h2>
                <span style={{ fontSize: '0.725rem', color: '#10b981' }}>
                  Gồm 3 hàng: Hướng xuống (Down), Hướng ngang (Side), Hướng lên (Up)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCharacter(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Bảng hiển thị 15 ô */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {['down', 'side', 'up'].map((dir) => (
                <div key={dir} style={{ background: 'rgba(0,0,0,0.25)', borderRadius: '8px', padding: '10px', border: '1px solid var(--border-panel)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--accent-purple)', fontWeight: 600, marginBottom: '6px' }}>
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
                            height: '70px',
                            background: 'repeating-conic-gradient(#1e293b 0% 25%, #0f172a 0% 50%) 50% / 8px 8px',
                            borderRadius: '4px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid var(--border-card)',
                            position: 'relative'
                          }}
                        >
                          {slotImg ? (
                            <img src={slotImg} alt={slotKey} style={{ maxWidth: '90%', maxHeight: '80%', objectFit: 'contain', imageRendering: 'pixelated' }} />
                          ) : (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>Rỗng</span>
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {onSelectTab && (
                <button
                  type="button"
                  className="btn-primary-studio"
                  onClick={() => {
                    onSelectTab('godot_testbed');
                    setSelectedCharacter(null);
                  }}
                  style={{ minHeight: '34px', fontSize: '0.8rem', gap: '6px' }}
                >
                  <Gamepad2 size={14} />
                  Mở trong Godot Testbed
                </button>
              )}
              <button
                type="button"
                className="btn-secondary-studio"
                onClick={() => setSelectedCharacter(null)}
                style={{ minHeight: '34px', fontSize: '0.8rem' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: PHÓNG TO BẢN ĐỒ NỀN */}
      {selectedMap && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-panel)',
            borderRadius: '12px',
            maxWidth: '850px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.1rem', color: '#fff', margin: 0 }}>
                {selectedMap.name}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedMap(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{
              maxHeight: '520px',
              overflow: 'auto',
              background: '#020617',
              borderRadius: '8px',
              border: '1px solid var(--border-panel)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              marginBottom: '16px'
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
                className="btn-secondary-studio"
                onClick={() => setSelectedMap(null)}
                style={{ minHeight: '34px', fontSize: '0.8rem' }}
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
