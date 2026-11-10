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
  ScanSearch,
  Sparkles,
  Copy,
  Check,
  Eye,
  EyeOff,
  Dna,
  Wand2,
  ChevronRight,
  ShieldCheck,
  Ruler,
  Layers,
  ArrowRight
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// Component thanh điều hướng 5 phân hệ hồ sơ nhân vật
import CharacterProfileTabs from '../components/character-profile/CharacterProfileTabs';
// Component hiển thị phân hệ 1: Phong cách & Vật liệu toàn cục
import TabGlobalView from '../components/character-profile/TabGlobalView';
// Component hiển thị phân hệ 2: 3 Hướng nhìn (Down, Side, Up)
import TabDirectionsView from '../components/character-profile/TabDirectionsView';
// Component hiển thị phân hệ 3: Hoạt họa chuyển động (Idle, Walk)
import TabAnimationsView from '../components/character-profile/TabAnimationsView';
// Component hiển thị phân hệ 4: Ràng buộc tính nhất quán & Phòng tạo Prompt AI
import TabConstraintsPromptView from '../components/character-profile/TabConstraintsPromptView';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Định dạng giao diện được kế thừa từ theme.css thông qua index.css

/**
 * Màn hình Studio Chuẩn Hóa & Thiết Kế Sprite AI (Project Analysis & Generation Studio).
 * Thiết kế lại theo chuẩn Modern Creative Workspace:
 * - Stepper luồng quy trình trực quan (Nạp mẫu -> Phân tích DNA -> Tạo nhân vật mới).
 * - Khung Viewport nền caro Checkerboard chuẩn Pixel Art Aseprite/Photoshop.
 * - Thẻ chỉ số đo lường giải phẫu học nhanh (Quick Metrics Grid).
 * - Bộ chuyển đổi 2 chế độ làm việc: [1. Hồ sơ Quy chuẩn DNA] vs [2. Phòng Tạo Nhân vật Mới].
 * 
 * @returns {React.ReactElement} Giao diện Creative Workspace hoàn chỉnh.
 */
export default function ProjectAnalysis() {
  // ========================================================
  // TRẠNG THÁI ẢNH THAM CHIẾU & LỚP PHỦ GIẢI PHẪU
  // ========================================================
  const [reference, setReference] = useState(null);
  const [annotatedUrl, setAnnotatedUrl] = useState(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [useGemini, setUseGemini] = useState(false);

  // Trạng thái dữ liệu đo đạc giải phẫu (CharacterMetrics)
  const [metrics, setMetrics] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  // ========================================================
  // TRẠNG THÁI ĐIỀU HƯỚNG WORKSPACE STUDIO MỚI
  // ========================================================
  // Chế độ làm việc chính ở Cột Phải: 'dna_profile' (Hồ sơ quy chuẩn) | 'prompt_studio' (Tạo nhân vật mới)
  const [workspaceMode, setWorkspaceMode] = useState('prompt_studio');

  // ========================================================
  // TRẠNG THÁI PHÂN HỆ HỒ SƠ NHÂN VẬT THEO TAB (CHARACTER PROFILE)
  // ========================================================
  // Tab phân hệ đang kích hoạt: 'global' | 'directions' | 'animations' | 'constraints' | 'inverse_math'
  const [activeProfileTab, setActiveProfileTab] = useState('global');
  // Dữ liệu hồ sơ nhân vật hoàn chỉnh
  const [profileData, setProfileData] = useState({
    global_analysis: null,
    direction_analysis: null,
    animation_analysis: null,
    consistency_analysis: null,
    negative_constraints: null,
  });
  // Tab đang được gửi yêu cầu phân tích lên máy chủ (null | string)
  const [analyzingTab, setAnalyzingTab] = useState(null);
  // Lỗi phân tích hồ sơ
  const [profileError, setProfileError] = useState('');
  // Kết quả sinh prompt từ hồ sơ nhân vật
  const [generatedProfilePrompt, setGeneratedProfilePrompt] = useState(null);
  const [generatingProfilePrompt, setGeneratingProfilePrompt] = useState(false);

  // ========================================================
  // TRẠNG THÁI TOÁN HỌC NGHỊCH ĐẢO CŨ (INVERSE SCALING ENGINE)
  // ========================================================
  const [headRule, setHeadRule] = useState('Bằng nhân vật gốc (Tỷ lệ chuẩn)');
  const [bodyWidthRule, setBodyWidthRule] = useState('Bằng nhân vật gốc');
  const [bodyHeightRule, setBodyHeightRule] = useState('Bằng nhân vật gốc');
  const [characterConcept, setCharacterConcept] = useState('Chiến binh Pixel Art cầm kiếm phong trần');
  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [positivePrompt, setPositivePrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [mathPlanText, setMathPlanText] = useState('');
  const [copiedPositive, setCopiedPositive] = useState(false);
  const [copiedNegative, setCopiedNegative] = useState(false);

  // Dọn dẹp bộ nhớ URL tạm khi đổi ảnh
  useEffect(() => {
    if (!reference) return;
    return () => {
      URL.revokeObjectURL(reference.url);
    };
  }, [reference]);

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
      setPositivePrompt('');
      setNegativePrompt('');
      setMathPlanText('');
      // Đặt lại dữ liệu hồ sơ nhân vật khi đổi ảnh mới
      setProfileData({
        global_analysis: null,
        direction_analysis: null,
        animation_analysis: null,
        consistency_analysis: null,
        negative_constraints: null,
      });
      setGeneratedProfilePrompt(null);
      setProfileError('');
    }
    event.target.value = '';
  };

  /**
   * Gọi API Backend /api/analyze để phân tích giải phẫu học cơ thể:
   * Quét Bounding Box, hộp sọ, cổ, háng, chân tiếp đất bằng Heuristic hoặc AI Gemini Vision.
   */
  const handleScanAnatomy = async () => {
    if (!reference || analyzing) return;

    setAnalyzing(true);
    setAnalysisError('');

    const formData = new FormData();
    formData.append('file', reference.file);
    formData.append('auto_remove_bg', 'true');
    formData.append('use_ai', useGemini ? 'true' : 'false');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Không thể phân tích giải phẫu ảnh.');
      }

      const resData = await response.json();
      setMetrics(resData.metrics);
      setAnnotatedUrl(resData.annotated_image);
      setShowOverlay(true);
    } catch (err) {
      setAnalysisError(err.message || 'Lỗi kết nối máy chủ phân tích.');
    } finally {
      setAnalyzing(false);
    }
  };

  /**
   * Phân tích độc lập một Tab trong Hồ sơ nhân vật (Tiết kiệm token tối đa).
   * 
   * @param {string} tabName Tên phân hệ cần quét ('global' | 'directions' | 'animations' | 'constraints').
   */
  const handleAnalyzeTab = async (tabName) => {
    if (!reference || analyzingTab) return;

    setAnalyzingTab(tabName);
    setProfileError('');

    const formData = new FormData();
    formData.append('file', reference.file);
    formData.append('tab_name', tabName);
    formData.append('current_profile_json', JSON.stringify(profileData));

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

      // Cập nhật từng trường tương ứng trong hồ sơ
      setProfileData((prev) => {
        if (tabName === 'global') {
          return { ...prev, global_analysis: tabData };
        } else if (tabName === 'directions') {
          return { ...prev, direction_analysis: tabData };
        } else if (tabName === 'animations') {
          return { ...prev, animation_analysis: tabData };
        } else if (tabName === 'constraints') {
          return {
            ...prev,
            consistency_analysis: tabData.consistency_analysis,
            negative_constraints: tabData.negative_constraints,
          };
        }
        return prev;
      });
    } catch (err) {
      setProfileError(err.message || 'Lỗi khi quét phân hệ.');
    } finally {
      setAnalyzingTab(null);
    }
  };

  /**
   * Phân tích toàn bộ 4 phân hệ của Hồ sơ nhân vật tham chiếu.
   */
  const handleAnalyzeAll = async () => {
    if (!reference || analyzingTab) return;

    setAnalyzingTab('all');
    setProfileError('');

    const formData = new FormData();
    formData.append('file', reference.file);
    formData.append('tab_name', 'all');

    try {
      const response = await fetch('/api/character-profile/analyze-tab', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.detail || 'Lỗi phân tích toàn bộ hồ sơ');
      }

      const resJson = await response.json();
      const fullAnalysis = resJson.data;

      setProfileData({
        global_analysis: fullAnalysis.global_analysis || null,
        direction_analysis: fullAnalysis.direction_analysis || null,
        animation_analysis: fullAnalysis.animation_analysis || null,
        consistency_analysis: fullAnalysis.consistency_analysis || null,
        negative_constraints: fullAnalysis.negative_constraints || null,
      });
    } catch (err) {
      setProfileError(err.message || 'Lỗi khi quét toàn bộ hồ sơ.');
    } finally {
      setAnalyzingTab(null);
    }
  };

  /**
   * Sinh Prompt AI tiếng Anh tối ưu hóa cho Nhân vật Mới (Tự do sáng tạo).
   * Kế thừa quy chuẩn kỹ thuật (kích thước khung game, tỷ lệ, nét vẽ, bóng) từ nhân vật tham chiếu.
   * 
   * @param {Object} newCharConfig Thông số cấu hình nhân vật mới do người dùng nhập.
   */
  const handleGeneratePromptFromProfile = async (newCharConfig) => {
    if (generatingProfilePrompt) return;

    setGeneratingProfilePrompt(true);

    try {
      const response = await fetch('/api/character-profile/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
   * Gọi API Backend /api/prompt-advice để chạy bộ máy Toán học Nghịch đảo (Inverse Scaling Engine)
   * và sinh Prompt tiếng Anh khống chế tỷ lệ cho GenAI.
   */
  const handleGeneratePromptAdvice = async () => {
    if (!metrics || generatingPrompt) return;

    setGeneratingPrompt(true);

    try {
      const response = await fetch('/api/prompt-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: metrics,
          character_concept: characterConcept || 'Chiến binh Pixel Art',
          head_rule: headRule,
          body_width_rule: bodyWidthRule,
          body_height_rule: bodyHeightRule,
        }),
      });

      if (!response.ok) {
        throw new Error('Không thể sinh prompt cố vấn.');
      }

      const resJson = await response.json();
      const data = resJson.data;

      setPositivePrompt(data.positive_prompt || '');
      setNegativePrompt(data.negative_prompt || '');

      // Trình bày kế hoạch toán học nghịch đảo trực quan
      const plan = data.inverse_math_plan;
      const canvas = data.recommended_game_canvas;
      const planDesc = (
        `📐 [KẾ HOẠCH TOÁN HỌC NGHỊCH ĐẢO - INVERSE SCALING]:\n` +
        `• Khung vẽ AI Gen (1024x1024): Nhân vật chiếm ${plan.character_framing_percentage}% chiều cao (chân chạm đáy).\n` +
        `• Chiều cao đầu trên khung AI: ${plan.target_head_height_ai_px}px (${plan.head_percentage_of_character}% thân).\n` +
        `• Khung Canvas Game đề xuất: ${canvas.width}x${canvas.height}px (${canvas.explanation})\n` +
        `• Mật độ chi tiết: ${data.detail_level_analysis}\n` +
        `• Phong cách tỷ lệ: ${data.style_analysis}`
      );
      setMathPlanText(planDesc);
    } catch (err) {
      alert(err.message || 'Lỗi khi gọi API cố vấn Prompt.');
    } finally {
      setGeneratingPrompt(false);
    }
  };

  /**
   * Sao chép nội dung prompt vào clipboard máy tính.
   * 
   * @param {string} text Đoạn văn bản cần sao chép.
   * @param {string} type Loại prompt ('positive' hoặc 'negative').
   */
  const handleCopyPrompt = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'positive') {
      setCopiedPositive(true);
      setTimeout(() => setCopiedPositive(false), 2000);
    } else {
      setCopiedNegative(true);
      setTimeout(() => setCopiedNegative(false), 2000);
    }
  };

  // Trạng thái đã phân tích của từng tab
  const tabStatuses = {
    global: Boolean(profileData.global_analysis),
    directions: Boolean(profileData.direction_analysis),
    animations: Boolean(profileData.animation_analysis),
    constraints: Boolean(profileData.consistency_analysis && profileData.negative_constraints),
    inverse_math: Boolean(metrics),
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
          1. THANH TIÊU ĐỀ WORKSPACE & STEPPER LUỒNG THAO TÁC
          ======================================================== */}
      <header className="studio-header-card">
        <div className="studio-title-group">
          <h1>
            <Sparkles size={22} color="var(--accent-purple)" />
            Studio Chuẩn Hóa & Thiết Kế Sprite AI
          </h1>
          <p>
            Phân tích giải phẫu học, bóc tách quy chuẩn DNA Pixel Art và sinh Prompt đồng bộ tỷ lệ cho Game 2D.
          </p>
        </div>

        {/* Stepper quy trình trực quan */}
        <nav className="studio-workflow-stepper" aria-label="Tiến trình làm việc">
          <span className={`studio-step-item ${reference ? 'completed' : 'active'}`}>
            {reference ? <Check size={13} /> : '1'} Nạp Sprite Mẫu
          </span>
          <span className="studio-step-separator">›</span>
          <span className={`studio-step-item ${analyzing ? 'active' : hasAnyProfileData ? 'completed' : ''}`}>
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

            {/* Thanh công cụ điều khiển nổi bên dưới Viewport */}
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

              <label className={`studio-toggle-chip ${useGemini ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={useGemini}
                  onChange={(e) => setUseGemini(e.target.checked)}
                />
                AI Vision
              </label>

              {/* Nút chính Quét giải phẫu */}
              <button
                type="button"
                className="btn-primary-studio"
                disabled={!reference || analyzing}
                onClick={handleScanAnatomy}
                style={{ minHeight: '32px', padding: '6px 12px', fontSize: '0.775rem' }}
              >
                <ScanSearch size={14} className={analyzing ? 'spin' : ''} />
                {analyzing ? 'Đang đo lường…' : metrics ? 'Quét lại' : 'Quét giải phẫu'}
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
                  ? 'Bấm "Quét giải phẫu" ở trên để đo tỷ lệ pixel của nhân vật mẫu.'
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
                <strong>{metrics.anatomical_height || metrics.visible_height}px</strong> (đã lọc riêng vũ khí & bóng sàn).
              </div>
            )}
          </div>
        </aside>

        {/* ========================================================
            CỘT PHẢI: WORKSPACE HỒ SƠ DNA & PHÒNG TẠO NHÂN VẬT MỚI
            ======================================================== */}
        <main className="studio-column-right">
          {/* Bộ chuyển đổi 2 chế độ làm việc lớn (Segmented Control Tabs) */}
          <div className="studio-segmented-switch">
            <button
              type="button"
              className={`studio-segment-btn ${workspaceMode === 'prompt_studio' ? 'active' : ''}`}
              onClick={() => setWorkspaceMode('prompt_studio')}
            >
              <Wand2 size={16} />
              <span>Phòng Tạo Nhân Vật Mới & Sinh Prompt</span>
              <span className="badge-pill">Chính</span>
            </button>

            <button
              type="button"
              className={`studio-segment-btn ${workspaceMode === 'dna_profile' ? 'active' : ''}`}
              onClick={() => setWorkspaceMode('dna_profile')}
            >
              <Dna size={16} />
              <span>Hồ sơ Quy chuẩn DNA (5 Phân hệ)</span>
              {hasAnyProfileData && <span className="badge-pill">🟢 Đã có dữ liệu</span>}
            </button>
          </div>

          {/* ========================================================
              CHẾ ĐỘ 1: PHÒNG TẠO NHÂN VẬT MỚI (PROMPT STUDIO)
              ======================================================== */}
          {workspaceMode === 'prompt_studio' && (
            <TabConstraintsPromptView
              consistency={profileData.consistency_analysis}
              negativeConstraints={profileData.negative_constraints}
              fullProfile={profileData}
              onGeneratePrompt={handleGeneratePromptFromProfile}
              generatingPrompt={generatingProfilePrompt}
              generatedPromptResult={generatedProfilePrompt}
            />
          )}

          {/* ========================================================
              CHẾ ĐỘ 2: HỒ SƠ QUY CHUẨN DNA CỦA NHÂN VẬT MẪU
              ======================================================== */}
          {workspaceMode === 'dna_profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Thanh chọn 5 phân hệ hồ sơ */}
              <CharacterProfileTabs
                activeTab={activeProfileTab}
                onSelectTab={setActiveProfileTab}
                tabStatuses={tabStatuses}
                analyzingTab={analyzingTab}
                onAnalyzeTab={handleAnalyzeTab}
                onAnalyzeAll={handleAnalyzeAll}
                disabled={!reference}
              />

              {/* Thông báo lỗi nếu có */}
              {profileError && (
                <p className="analysis-result" style={{ color: '#ef4444' }}>
                  ⚠️ {profileError}
                </p>
              )}

              {/* Tab 1: Phong cách & Vật liệu Toàn cục */}
              {activeProfileTab === 'global' && (
                <TabGlobalView data={profileData.global_analysis} />
              )}

              {/* Tab 2: 3 Hướng nhìn (Down / Side / Up) */}
              {activeProfileTab === 'directions' && (
                <TabDirectionsView data={profileData.direction_analysis} />
              )}

              {/* Tab 3: Hoạt họa chuyển động (Idle / Walk) */}
              {activeProfileTab === 'animations' && (
                <TabAnimationsView data={profileData.animation_analysis} />
              )}

              {/* Tab 4: Ràng buộc tính nhất quán */}
              {activeProfileTab === 'constraints' && (
                <TabConstraintsPromptView
                  consistency={profileData.consistency_analysis}
                  negativeConstraints={profileData.negative_constraints}
                  fullProfile={profileData}
                  onGeneratePrompt={handleGeneratePromptFromProfile}
                  generatingPrompt={generatingProfilePrompt}
                  generatedPromptResult={generatedProfilePrompt}
                />
              )}

              {/* Tab 5: Kế hoạch Toán học nghịch đảo */}
              {activeProfileTab === 'inverse_math' && (
                <div className="profile-section-card">
                  <h4 style={{ color: 'var(--text-white)' }}>
                    <Ruler size={16} color="var(--accent-purple)" />
                    Kế hoạch Toán học Nghịch đảo (Inverse Scaling Engine)
                  </h4>
                  <div className="analysis-fields">
                    <label>
                      Đầu nhân vật mới:
                      <select value={headRule} onChange={(e) => setHeadRule(e.target.value)}>
                        <option value="Bằng nhân vật gốc (Tỷ lệ chuẩn)">Bằng nhân vật mẫu (Tỷ lệ chuẩn)</option>
                        <option value="To hơn nhân vật gốc (Chibi hơn)">Lớn hơn nhân vật mẫu (Chibi hơn)</option>
                        <option value="Nhỏ hơn nhân vật gốc (Dáng cao hơn)">Nhỏ hơn nhân vật mẫu (Dáng cao)</option>
                      </select>
                    </label>
                    <label>
                      Chiều rộng thân:
                      <select value={bodyWidthRule} onChange={(e) => setBodyWidthRule(e.target.value)}>
                        <option value="Bằng nhân vật gốc">Bằng nhân vật mẫu</option>
                        <option value="Rộng hơn nhân vật gốc">Rộng hơn nhân vật mẫu (Cơ bắp/Mập)</option>
                        <option value="Hẹp hơn nhân vật gốc">Hẹp hơn nhân vật mẫu (Gầy/Thon)</option>
                      </select>
                    </label>
                    <label>
                      Chiều cao thân:
                      <select value={bodyHeightRule} onChange={(e) => setBodyHeightRule(e.target.value)}>
                        <option value="Bằng nhân vật gốc">Bằng nhân vật mẫu</option>
                        <option value="Cao hơn nhân vật gốc">Cao hơn nhân vật mẫu</option>
                        <option value="Thấp hơn nhân vật gốc">Thấp hơn nhân vật mẫu</option>
                      </select>
                    </label>
                    <label>
                      Ý tưởng (Concept cũ):
                      <input
                        type="text"
                        value={characterConcept}
                        onChange={(e) => setCharacterConcept(e.target.value)}
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    className="btn-primary-studio"
                    disabled={!metrics || generatingPrompt}
                    onClick={handleGeneratePromptAdvice}
                    style={{ marginTop: '8px' }}
                  >
                    <Sparkles size={16} />
                    {generatingPrompt ? 'Đang tính toán nghịch đảo…' : 'Tính tỷ lệ nghịch đảo'}
                  </button>

                  {/* Kế hoạch toán học */}
                  <div
                    className="analysis-result"
                    style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5', fontSize: '0.8rem', marginTop: '10px' }}
                  >
                    {mathPlanText || 'Hãy quét giải phẫu nhân vật mẫu ở Cột trái để chạy bộ máy tính toán tỷ lệ.'}
                  </div>

                  {/* Positive Prompt cũ */}
                  {positivePrompt && (
                    <div style={{ marginTop: '10px' }}>
                      <div className="analysis-output-title">
                        <h3 style={{ fontSize: '0.85rem' }}>Positive Prompt (Tỷ lệ nghịch đảo)</h3>
                        <button
                          type="button"
                          onClick={() => handleCopyPrompt(positivePrompt, 'positive')}
                          style={{ minHeight: '30px', padding: '4px 8px', fontSize: '0.75rem' }}
                        >
                          {copiedPositive ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                          {copiedPositive ? 'Đã sao chép!' : 'Sao chép'}
                        </button>
                      </div>
                      <textarea rows={5} readOnly value={positivePrompt} />
                    </div>
                  )}

                  {/* Negative Prompt cũ */}
                  {negativePrompt && (
                    <div style={{ marginTop: '10px' }}>
                      <div className="analysis-output-title">
                        <h3 style={{ fontSize: '0.85rem' }}>Negative Prompt</h3>
                        <button
                          type="button"
                          onClick={() => handleCopyPrompt(negativePrompt, 'negative')}
                          style={{ minHeight: '30px', padding: '4px 8px', fontSize: '0.75rem' }}
                        >
                          {copiedNegative ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                          {copiedNegative ? 'Đã sao chép!' : 'Sao chép'}
                        </button>
                      </div>
                      <textarea rows={3} readOnly value={negativePrompt} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
