// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useEffect, useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon vector SVG siêu nhẹ hiển thị thư mục, quét ảnh, tạo prompt, sao chép và chuyển đổi chế độ
import {
  FolderOpen,
  Sparkles,
  Check,
  Eye,
  EyeOff,
  Dna,
  Wand2,
  Ruler,
  Zap,
  Bookmark
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// Component thanh điều hướng 3 phân hệ tra cứu hồ sơ nhân vật (đã loại bỏ tab trùng lặp)
import CharacterProfileTabs from '../components/character-profile/CharacterProfileTabs';
// Component hiển thị phân hệ 1: Phong cách & Vật liệu toàn cục
import TabGlobalView from '../components/character-profile/TabGlobalView';
// Component hiển thị phân hệ 2: 3 Hướng nhìn (Down, Side, Up)
import TabDirectionsView from '../components/character-profile/TabDirectionsView';
// Component hiển thị phân hệ 3: Hoạt họa chuyển động (Idle, Walk)
import TabAnimationsView from '../components/character-profile/TabAnimationsView';
// Component hiển thị phân hệ chính: Phòng tạo Nhân vật Mới & Sinh Prompt AI
import TabConstraintsPromptView from '../components/character-profile/TabConstraintsPromptView';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Định dạng giao diện được kế thừa từ theme.css thông qua index.css

/**
 * Màn hình Studio Chuẩn Hóa & Thiết Kế Sprite AI (Project Analysis & Generation Studio).
 * Thiết kế tinh gọn theo chuẩn Modern Creative Workspace:
 * - 1 Luồng làm việc duy nhất: [Nạp Sprite] ➔ [1-Click Phân tích Toàn diện] ➔ [Nhập Ý Tưởng & Sinh Prompt].
 * - Tự động đọc và lưu trữ thông số theo dự án (currentProject.id) trong MySQL.
 * - Hỗ trợ lưu trữ bản phân tích và Prompt vào Thư viện Presets của dự án.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object} props.currentProject Dự án hiện tại đang mở (chứa id, name).
 * @param {Object|null} props.loadedPresetData Bản ghi preset được nạp từ trang Thư viện Presets.
 * @returns {React.ReactElement} Giao diện Creative Workspace hoàn chỉnh.
 */
export default function ProjectAnalysis({ currentProject, loadedPresetData }) {
  // ========================================================
  // TRẠNG THÁI ẢNH THAM CHIẾU & LỚP PHỦ GIẢI PHẪU
  // ========================================================
  const [reference, setReference] = useState(null);
  const [annotatedUrl, setAnnotatedUrl] = useState(null);
  const [showOverlay, setShowOverlay] = useState(true);

  // Trạng thái dữ liệu đo đạc giải phẫu hình học (CharacterMetrics)
  const [metrics, setMetrics] = useState(null);
  const [analysisError, setAnalysisError] = useState('');

  // ========================================================
  // TRẠNG THÁI ĐIỀU HƯỚNG WORKSPACE STUDIO TINH GỌN
  // ========================================================
  // Chế độ làm việc chính ở Cột Phải: 'prompt_studio' (Tạo nhân vật mới) | 'dna_profile' (Tra cứu DNA mẫu)
  const [workspaceMode, setWorkspaceMode] = useState('prompt_studio');

  // ========================================================
  // TRẠNG THÁI HỒ SƠ NHÂN VẬT THAM CHIẾU (CHARACTER PROFILE)
  // ========================================================
  // Phân hệ tra cứu đang mở trong chế độ 'dna_profile': 'global' | 'directions' | 'animations'
  const [activeProfileTab, setActiveProfileTab] = useState('global');
  // Dữ liệu hồ sơ nhân vật hoàn chỉnh
  const [profileData, setProfileData] = useState({
    global_analysis: null,
    direction_analysis: null,
    animation_analysis: null,
    consistency_analysis: null,
    negative_constraints: null,
  });
  // Trạng thái quét phân tích toàn diện (1-Click Master Scan)
  const [isMasterAnalyzing, setIsMasterAnalyzing] = useState(false);
  // Trạng thái quét riêng một phân hệ đơn lẻ
  const [analyzingTab, setAnalyzingTab] = useState(null);
  // Thông báo lỗi phân tích hồ sơ
  const [profileError, setProfileError] = useState('');

  // ========================================================
  // TRẠNG THÁI BỘ MÁY SINH PROMPT & LƯU PRESET VÀO MYSQL
  // ========================================================
  const [generatedProfilePrompt, setGeneratedProfilePrompt] = useState(null);
  const [generatingProfilePrompt, setGeneratingProfilePrompt] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [loadedPresetConfig, setLoadedPresetConfig] = useState(null);

  // Dọn dẹp bộ nhớ URL tạm khi đổi ảnh
  useEffect(() => {
    if (!reference) return;
    return () => {
      URL.revokeObjectURL(reference.url);
    };
  }, [reference]);

  // Nạp dữ liệu khi người dùng bấm "Mở lại trong Studio" từ trang Hồ sơ đã lưu
  useEffect(() => {
    if (loadedPresetData) {
      if (loadedPresetData.metrics_data) {
        setMetrics(loadedPresetData.metrics_data);
      }
      if (loadedPresetData.profile_data) {
        setProfileData(loadedPresetData.profile_data);
      }
      if (loadedPresetData.positive_prompt) {
        setGeneratedProfilePrompt({
          positive_prompt: loadedPresetData.positive_prompt,
          negative_prompt: loadedPresetData.negative_prompt,
          technical_notes: loadedPresetData.technical_notes,
        });
      }
      setLoadedPresetConfig({
        new_character_concept: loadedPresetData.new_character_concept,
        outfit_and_colors: loadedPresetData.outfit_and_colors,
        weapons_and_props: loadedPresetData.weapons_and_props,
        stature_rule: loadedPresetData.stature_rule,
        target_direction: loadedPresetData.target_direction,
      });
      setWorkspaceMode('prompt_studio');
    }
  }, [loadedPresetData]);

  /**
   * Xử lý nạp ảnh nhân vật mẫu từ máy tính của người dùng.
   * 
   * @param {React.ChangeEvent<HTMLInputElement>} event Sự kiện chọn tệp.
   */
  const handleReferenceChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setReference({
        file,
        name: file.name,
        url: URL.createObjectURL(file),
      });
      setAnnotatedUrl(null);
      setMetrics(null);
      setAnalysisError('');
      setProfileData({
        global_analysis: null,
        direction_analysis: null,
        animation_analysis: null,
        consistency_analysis: null,
        negative_constraints: null,
      });
      setGeneratedProfilePrompt(null);
      setProfileError('');
      setSaveSuccessMsg('');
    }
    event.target.value = '';
  };

  /**
   * [1-CLICK MASTER SCAN]: Quét phân tích toàn diện Sprite mẫu chỉ với 1 cú click duy nhất:
   * Tự động truyền project_id để Backend đọc API Key từ CSDL MySQL của dự án này.
   */
  const handleAnalyzeMaster = async () => {
    if (!reference || isMasterAnalyzing) return;

    setIsMasterAnalyzing(true);
    setAnalysisError('');
    setProfileError('');
    setSaveSuccessMsg('');

    try {
      // 1. Quét giải phẫu pixel (Bounding box, đầu, thân, chân, tỷ lệ heads_tall)
      const formDataAnatomy = new FormData();
      formDataAnatomy.append('file', reference.file);
      formDataAnatomy.append('auto_remove_bg', 'true');
      formDataAnatomy.append('use_ai', 'true');
      if (currentProject?.id) {
        formDataAnatomy.append('project_id', currentProject.id);
      }

      const resAnatomy = await fetch('/api/analyze', {
        method: 'POST',
        body: formDataAnatomy,
      });

      if (resAnatomy.ok) {
        const anatomyData = await resAnatomy.json();
        setMetrics(anatomyData.metrics);
        setAnnotatedUrl(anatomyData.annotated_image);
        setShowOverlay(true);
      } else {
        const errData = await resAnatomy.json();
        setAnalysisError(errData.detail || 'Lỗi phân tích giải phẫu học hình ảnh.');
      }

      // 2. Quét hồ sơ DNA phong cách Pixel Art (Toàn cục, 3 hướng nhìn, chuyển động, ràng buộc)
      const formDataProfile = new FormData();
      formDataProfile.append('file', reference.file);
      formDataProfile.append('tab_name', 'all');
      if (currentProject?.id) {
        formDataProfile.append('project_id', currentProject.id);
      }

      const resProfile = await fetch('/api/character-profile/analyze-tab', {
        method: 'POST',
        body: formDataProfile,
      });

      if (resProfile.ok) {
        const profileJson = await resProfile.json();
        const fullAnalysis = profileJson.data;
        setProfileData({
          global_analysis: fullAnalysis.global_analysis || null,
          direction_analysis: fullAnalysis.direction_analysis || null,
          animation_analysis: fullAnalysis.animation_analysis || null,
          consistency_analysis: fullAnalysis.consistency_analysis || null,
          negative_constraints: fullAnalysis.negative_constraints || null,
        });
      } else {
        const errJson = await resProfile.json();
        setProfileError(errJson.detail || 'Lỗi bóc tách hồ sơ phong cách pixel.');
      }
    } catch (err) {
      setAnalysisError(err.message || 'Lỗi kết nối máy chủ khi phân tích Sprite.');
    } finally {
      setIsMasterAnalyzing(false);
    }
  };

  /**
   * Quét lại độc lập một phân hệ tra cứu (nếu người dùng cần điều chỉnh riêng).
   * 
   * @param {string} tabName Tên phân hệ ('global' | 'directions' | 'animations').
   */
  const handleAnalyzeTab = async (tabName) => {
    if (!reference || analyzingTab || isMasterAnalyzing) return;

    setAnalyzingTab(tabName);
    setProfileError('');

    const formData = new FormData();
    formData.append('file', reference.file);
    formData.append('tab_name', tabName);
    formData.append('current_profile_json', JSON.stringify(profileData));
    if (currentProject?.id) {
      formData.append('project_id', currentProject.id);
    }

    try {
      const response = await fetch('/api/character-profile/analyze-tab', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.detail || `Lỗi phân tích phân hệ ${tabName}`);
      }

      const resJson = await response.json();
      const tabData = resJson.data;

      setProfileData((prev) => {
        if (tabName === 'global') {
          return { ...prev, global_analysis: tabData };
        } else if (tabName === 'directions') {
          return { ...prev, direction_analysis: tabData };
        } else if (tabName === 'animations') {
          return { ...prev, animation_analysis: tabData };
        }
        return prev;
      });
    } catch (err) {
      setProfileError(err.message || 'Lỗi khi quét lại phân hệ.');
    } finally {
      setAnalyzingTab(null);
    }
  };

  /**
   * Sinh Prompt AI tiếng Anh tối ưu hóa cho Nhân vật Mới (Tự do sáng tạo).
   * Tự động truyền project_id để Backend đọc API Key từ MySQL của dự án.
   * 
   * @param {Object} newCharConfig Thông số cấu hình nhân vật mới do người dùng nhập.
   */
  const handleGeneratePromptFromProfile = async (newCharConfig) => {
    if (generatingProfilePrompt) return;

    setGeneratingProfilePrompt(true);
    setSaveSuccessMsg('');

    try {
      const response = await fetch('/api/character-profile/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: currentProject?.id || null,
          profile_data: profileData,
          metrics: metrics,
          core_concept: newCharConfig.core_concept || 'Pixel Art Character',
          outfit_and_colors: newCharConfig.outfit_and_colors || null,
          weapons_and_props: newCharConfig.weapons_and_props || null,
          stature_rule: newCharConfig.stature_rule || 'Bằng nhân vật gốc (Tỷ lệ chuẩn)',
          target_direction: newCharConfig.target_direction || 'Front / Down view',
          inherit_scale: newCharConfig.inherit_scale ?? true,
          inherit_style: newCharConfig.inherit_style ?? true,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.detail || 'Lỗi khi sinh Prompt từ hồ sơ.');
      }

      const resJson = await response.json();
      setGeneratedProfilePrompt(resJson.data);
    } catch (err) {
      alert(err.message || 'Lỗi kết nối máy chủ sinh prompt.');
    } finally {
      setGeneratingProfilePrompt(false);
    }
  };

  /**
   * Lưu Bản Phân Tích & Prompt hiện tại vào cơ sở dữ liệu MySQL của dự án.
   * 
   * @param {Object} newCharData Cấu hình nhân vật mới do người dùng nhập.
   */
  const handleSavePreset = async (newCharData) => {
    if (!currentProject?.id || !generatedProfilePrompt || savingPreset) return;

    setSavingPreset(true);
    setSaveSuccessMsg('');

    const payload = {
      name: newCharData.name || `${newCharData.new_character_concept} (Bản lưu Studio)`,
      sprite_name: reference?.name || 'sprite_sample.png',
      metrics_data: metrics,
      profile_data: profileData,
      new_character_concept: newCharData.new_character_concept,
      outfit_and_colors: newCharData.outfit_and_colors,
      weapons_and_props: newCharData.weapons_and_props,
      stature_rule: newCharData.stature_rule,
      target_direction: newCharData.target_direction,
      positive_prompt: generatedProfilePrompt.positive_prompt,
      negative_prompt: generatedProfilePrompt.negative_prompt,
      technical_notes: generatedProfilePrompt.technical_notes,
    };

    try {
      const response = await fetch(`/api/projects/${currentProject.id}/character-presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Không thể lưu bản ghi vào MySQL.');
      }

      setSaveSuccessMsg('Đã lưu thành công vào Hồ sơ Dự án trong MySQL!');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err) {
      alert(err.message || 'Lỗi khi lưu hồ sơ vào dự án.');
    } finally {
      setSavingPreset(false);
    }
  };

  // Trạng thái đã có dữ liệu của 3 phân hệ tra cứu
  const tabStatuses = {
    global: Boolean(profileData.global_analysis),
    directions: Boolean(profileData.direction_analysis),
    animations: Boolean(profileData.animation_analysis),
  };

  const hasAnyProfileData = Boolean(
    profileData.global_analysis ||
    profileData.direction_analysis ||
    profileData.animation_analysis ||
    metrics
  );

  return (
    <div className="studio-workspace-container">
      {/* ========================================================
          1. THANH TIÊU ĐỀ WORKSPACE & STEPPER TIẾN TRÌNH RÕ RÀNG
          ======================================================== */}
      <header className="studio-header-card">
        <div className="studio-title-group">
          <h1>
            <Sparkles size={22} color="var(--accent-purple)" />
            Studio Chuẩn Hóa &amp; Thiết Kế Sprite AI
          </h1>
          <p>
            Phân tích giải phẫu học, bóc tách quy chuẩn DNA Pixel Art và sinh Prompt đồng bộ tỷ lệ cho Game 2D.
            {currentProject && (
              <span style={{ marginLeft: '6px', color: 'var(--accent-purple)', fontWeight: 600 }}>
                • Dự án: {currentProject.name}
              </span>
            )}
          </p>
        </div>

        {/* Stepper quy trình trực quan 3 bước */}
        <nav className="studio-workflow-stepper" aria-label="Tiến trình làm việc">
          <span className={`studio-step-item ${reference ? 'completed' : 'active'}`}>
            {reference ? <Check size={13} /> : '1'} Nạp Sprite Mẫu
          </span>
          <span className="studio-step-separator">›</span>
          <span className={`studio-step-item ${isMasterAnalyzing ? 'active' : hasAnyProfileData ? 'completed' : ''}`}>
            {hasAnyProfileData ? <Check size={13} /> : '2'} Phân Tích DNA
          </span>
          <span className="studio-step-separator">›</span>
          <span className={`studio-step-item ${workspaceMode === 'prompt_studio' ? 'active' : ''}`}>
            3 Tạo Nhân Vật Mới
          </span>
        </nav>
      </header>

      {/* ========================================================
          2. BỐ CỤC LƯỚI BẤT ĐỐI XỨNG: VIEWPORT CANVAS & WORKSPACE
          ======================================================== */}
      <div className="studio-grid">
        {/* ========================================================
            CỘT TRÁI: VIEWPORT SPRITE MẪU & THẺ SỐ ĐO GIẢI PHẪU
            ======================================================== */}
        <aside className="studio-column-left">
          {/* Card Viewport hiển thị Sprite chuẩn Pixel Art */}
          <div className="studio-viewport-card">
            <div className="studio-viewport-header">
              <h3>
                <FolderOpen size={16} color="var(--accent-purple)" />
                {reference ? reference.name : 'Chưa nạp sprite mẫu'}
              </h3>
              <label className="btn-secondary-studio" style={{ padding: '5px 10px', fontSize: '0.75rem', minHeight: '30px' }}>
                <FolderOpen size={13} />
                Chọn ảnh
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleReferenceChange}
                  style={{ display: 'none' }}
                />
              </label>
            </div>

            {/* Nền caro Checkerboard Pixel Art */}
            <figure className="pixel-checkerboard-bg">
              {reference ? (
                <img
                  src={showOverlay && annotatedUrl ? annotatedUrl : reference.url}
                  alt={reference.name}
                />
              ) : (
                <span>Kéo thả hoặc bấm "Chọn ảnh" để nạp sprite tham chiếu pixel art</span>
              )}
            </figure>

            {/* Thanh công cụ điều khiển Viewport: NÚT QUÉT 1-CLICK DUY NHẤT & LỚP PHỦ */}
            <div className="studio-viewport-controls">
              <label className={`studio-toggle-chip ${showOverlay && annotatedUrl ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={showOverlay}
                  disabled={!annotatedUrl}
                  onChange={(e) => setShowOverlay(e.target.checked)}
                />
                {showOverlay ? <Eye size={13} /> : <EyeOff size={13} />}
                Lớp phủ đo lường
              </label>

              {/* NÚT CHÍNH DUY NHẤT: 1-Click Master Scan */}
              <button
                type="button"
                className="btn-primary-studio"
                disabled={!reference || isMasterAnalyzing}
                onClick={handleAnalyzeMaster}
                style={{
                  minHeight: '34px',
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  boxShadow: '0 0 12px var(--accent-purple-glow)'
                }}
              >
                <Zap size={15} className={isMasterAnalyzing ? 'spin' : ''} />
                {isMasterAnalyzing
                  ? 'Đang phân tích toàn diện…'
                  : hasAnyProfileData
                  ? 'Quét lại toàn bộ'
                  : 'Phân tích Sprite Mẫu'}
              </button>
            </div>

            {/* Chú giải màu sắc Bounding Box (Legend) */}
            {annotatedUrl && (
              <div className="studio-legend-bar">
                <span className="studio-legend-item" style={{ color: '#00e5ff' }}>■ Đầu</span>
                <span className="studio-legend-item" style={{ color: '#ff8c00' }}>■ Thân</span>
                <span className="studio-legend-item" style={{ color: '#ba55d3' }}>■ Chân</span>
                <span className="studio-legend-item" style={{ color: '#ffd700' }}>╌ Vũ khí</span>
                <span className="studio-legend-item" style={{ color: '#ff69b4' }}>╌ Áo/Cánh</span>
                <span className="studio-legend-item" style={{ color: '#a0a0a0' }}>╌ Bóng sàn</span>
              </div>
            )}
          </div>

          {/* Card Số đo Giải phẫu học Pixel (Quick Metrics Grid) */}
          <div className="studio-metric-card">
            <div className="studio-metric-card-header">
              <h4>
                <Ruler size={14} style={{ display: 'inline', marginRight: '6px' }} />
                Thông số giải phẫu hình học
              </h4>
              {metrics && (
                <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
                  ● Đã hiệu chuẩn
                </span>
              )}
            </div>

            {analysisError && (
              <p style={{ margin: 0, color: '#ef4444', fontSize: '0.775rem' }}>
                ⚠️ {analysisError}
              </p>
            )}

            {/* Lưới 4 ô số đo nổi bật */}
            {metrics ? (
              <div className="studio-metric-grid">
                <div className="studio-metric-cell">
                  <span className="metric-label">Chiều cao sinh học</span>
                  <span className="metric-val">
                    {metrics.anatomical_height || metrics.visible_height} px
                  </span>
                  <span className="metric-sub">Đã loại trừ vũ khí/bóng</span>
                </div>

                <div className="studio-metric-cell">
                  <span className="metric-label">Tỷ lệ dáng người</span>
                  <span className="metric-val">
                    1:{typeof metrics.heads_tall === 'number' ? metrics.heads_tall.toFixed(1) : metrics.heads_tall} đầu
                  </span>
                  <span className="metric-sub">{metrics.style_category || 'Dáng game'}</span>
                </div>

                <div className="studio-metric-cell">
                  <span className="metric-label">Kích thước đầu</span>
                  <span className="metric-val">{metrics.head_w} × {metrics.head_h} px</span>
                  <span className="metric-sub">{metrics.head_ratio_percent}% thân</span>
                </div>

                <div className="studio-metric-cell">
                  <span className="metric-label">Kích thước thân</span>
                  <span className="metric-val">{metrics.body_w} × {metrics.body_h} px</span>
                  <span className="metric-sub">Khung tiếp đất vững</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '0.775rem', color: 'var(--text-dim)', textAlign: 'center', padding: '12px 0' }}>
                {reference
                  ? 'Bấm "Phân tích Sprite Mẫu" ở trên để giải mã tỷ lệ pixel và phong cách.'
                  : 'Nạp ảnh sprite ở trên để bắt đầu thẩm định tỷ lệ.'}
              </div>
            )}

            {/* Thông báo bóc tách phụ kiện */}
            {metrics && (metrics.weapon_box || metrics.cape_wings_box || metrics.shadow_box) && (
              <div style={{
                fontSize: '0.75rem',
                padding: '8px 10px',
                background: 'rgba(16, 185, 129, 0.08)',
                borderLeft: '2px solid #10b981',
                borderRadius: '4px',
                color: '#34d399',
                lineHeight: '1.4'
              }}>
                🛡️ <strong>Đã tự động bóc tách:</strong> Chiều cao thân chuẩn là{' '}
                <strong>{metrics.anatomical_height || metrics.visible_height}px</strong> (đã lọc riêng vũ khí &amp; bóng sàn).
              </div>
            )}
          </div>
        </aside>

        {/* ========================================================
            CỘT PHẢI: WORKSPACE TẠO NHÂN VẬT MỚI & TRA CỨU DNA
            ======================================================== */}
        <main className="studio-column-right">
          {/* Bộ chuyển đổi 2 chế độ làm việc lớn (Segmented Switch) */}
          <div className="studio-segmented-switch">
            <button
              type="button"
              className={`studio-segment-btn ${workspaceMode === 'prompt_studio' ? 'active' : ''}`}
              onClick={() => setWorkspaceMode('prompt_studio')}
            >
              <Wand2 size={16} />
              <span>Phòng Tạo Nhân Vật Mới &amp; Sinh Prompt</span>
              <span className="badge-pill">Chính</span>
            </button>

            <button
              type="button"
              className={`studio-segment-btn ${workspaceMode === 'dna_profile' ? 'active' : ''}`}
              onClick={() => setWorkspaceMode('dna_profile')}
            >
              <Dna size={16} />
              <span>Tra Cứu Hồ Sơ DNA Mẫu (3 Phân Hệ)</span>
              {hasAnyProfileData && <span className="badge-pill">🟢 Đã có dữ liệu</span>}
            </button>
          </div>

          {/* ========================================================
              CHẾ ĐỘ 1 (CHÍNH): PHÒNG TẠO NHÂN VẬT MỚI (PROMPT STUDIO)
              ======================================================== */}
          {workspaceMode === 'prompt_studio' && (
            <TabConstraintsPromptView
              consistency={profileData.consistency_analysis}
              negativeConstraints={profileData.negative_constraints}
              fullProfile={profileData}
              onGeneratePrompt={handleGeneratePromptFromProfile}
              generatingPrompt={generatingProfilePrompt}
              generatedPromptResult={generatedProfilePrompt}
              onSavePreset={handleSavePreset}
              savingPreset={savingPreset}
              saveSuccessMsg={saveSuccessMsg}
              initialConfig={loadedPresetConfig}
            />
          )}

          {/* ========================================================
              CHẾ ĐỘ 2 (TRA CỨU): HỒ SƠ QUY CHUẨN DNA 3 PHÂN HỆ
              ======================================================== */}
          {workspaceMode === 'dna_profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Thanh chọn 3 phân hệ hồ sơ DNA tinh gọn */}
              <CharacterProfileTabs
                activeTab={activeProfileTab}
                onSelectTab={setActiveProfileTab}
                tabStatuses={tabStatuses}
                analyzingTab={analyzingTab}
                onAnalyzeTab={handleAnalyzeTab}
                disabled={!reference}
              />

              {/* Thông báo lỗi nếu có */}
              {profileError && (
                <p className="analysis-result" style={{ color: '#ef4444' }}>
                  ⚠️ {profileError}
                </p>
              )}

              {/* Phân hệ 1: Phong cách mỹ thuật & Bảng vật liệu toàn cục */}
              {activeProfileTab === 'global' && (
                <TabGlobalView data={profileData.global_analysis} />
              )}

              {/* Phân hệ 2: Không gian 3 hướng nhìn (Down / Side / Up) */}
              {activeProfileTab === 'directions' && (
                <TabDirectionsView data={profileData.direction_analysis} />
              )}

              {/* Phân hệ 3: Hoạt họa chuyển động (Idle / Walk) */}
              {activeProfileTab === 'animations' && (
                <TabAnimationsView data={profileData.animation_analysis} />
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
