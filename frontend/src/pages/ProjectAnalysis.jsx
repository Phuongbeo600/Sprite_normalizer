// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useEffect, useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon vector SVG siêu nhẹ hiển thị thư mục, quét ảnh, tạo prompt và sao chép
import { FolderOpen, ScanSearch, Sparkles, Copy, Check, Eye, EyeOff } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// Component thanh điều hướng phân hệ phân tích hồ sơ nhân vật
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
 * Màn hình Phân tích Giải phẫu Sprite và Cố vấn Prompt AI (Inverse Scaling Engine & AI Reference Profile).
 * Tích hợp kiến trúc phân hệ Tab hiện đại:
 * - Bước 1: Quét hình học & giải phẫu học cơ thể Sprite (Heuristic + AI Gemini Vision).
 * - Bước 2: Hồ sơ Nhân vật tham chiếu theo Tab (Global, Directions, Animations, Constraints)
 *           kết hợp Cố vấn Prompt AI & Toán học nghịch đảo.
 * 
 * @returns {React.ReactElement} Giao diện phân tích 2 cột trực quan.
 */
export default function ProjectAnalysis() {
  // Trạng thái ảnh tham chiếu và ảnh đã vẽ lớp phủ giải phẫu
  const [reference, setReference] = useState(null);
  const [annotatedUrl, setAnnotatedUrl] = useState(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [useGemini, setUseGemini] = useState(false);

  // Trạng thái dữ liệu đo đạc giải phẫu (CharacterMetrics)
  const [metrics, setMetrics] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');

  // ========================================================
  // TRẠNG THÁI PHÂN HỆ HỒ SƠ NHÂN VẬT THEO TAB (CHARACTER PROFILE)
  // ========================================================
  // Tab đang kích hoạt: 'global' | 'directions' | 'animations' | 'constraints' | 'inverse_math'
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

  return (
    <div className="analysis-layout">
      {/* ========================================================
          CỘT TRÁI: BƯỚC 1 - NHÂN VẬT THAM CHIẾU & PHÂN TÍCH GIẢI PHẪU
          ======================================================== */}
      <section className="analysis-panel" aria-labelledby="reference-title">
        <h2 id="reference-title">Bước 1. Nhân vật tham chiếu</h2>
        <div className="analysis-actions">
          <label className="analysis-file">
            <FolderOpen size={17} aria-hidden="true" />
            Chọn sprite mẫu
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleReferenceChange} />
          </label>
          <button
            type="button"
            disabled={!reference || analyzing}
            onClick={handleScanAnatomy}
          >
            <ScanSearch size={17} />
            {analyzing ? 'Đang phân tích…' : 'Quét giải phẫu'}
          </button>
        </div>

        {/* Khung xem trước ảnh mẫu và lớp phủ Bounding Box */}
        <figure className="analysis-preview">
          {reference ? (
            <img
              src={showOverlay && annotatedUrl ? annotatedUrl : reference.url}
              alt={reference.name}
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            <span>Ảnh tham chiếu sẽ hiện ở đây</span>
          )}
        </figure>

        {/* Các tùy chọn hiển thị và quét lại */}
        <div className="analysis-options">
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showOverlay}
              disabled={!annotatedUrl}
              onChange={(e) => setShowOverlay(e.target.checked)}
            />
            {showOverlay ? <Eye size={15} /> : <EyeOff size={15} />}
            Vẽ lớp phủ đo lường (Overlay)
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={useGemini}
              onChange={(e) => setUseGemini(e.target.checked)}
            />
            Dùng AI Vision (Gemini / ChatGPT)
          </label>
          <button
            type="button"
            disabled={!reference || analyzing}
            onClick={handleScanAnatomy}
          >
            Quét lại
          </button>
        </div>

        {/* Chú giải trực quan các vùng phân tách (Legend) */}
        {annotatedUrl && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            fontSize: '0.75rem',
            padding: '8px 10px',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: '6px',
            border: '1px solid var(--border-color, #333)',
            marginBottom: '10px'
          }}>
            <span style={{ color: '#00e5ff', fontWeight: 600 }}>■ [HEAD] Đầu</span>
            <span style={{ color: '#ff8c00', fontWeight: 600 }}>■ [TORSO] Thân</span>
            <span style={{ color: '#ba55d3', fontWeight: 600 }}>■ [LEGS] Chân</span>
            <span style={{ color: '#ffd700', fontWeight: 600, borderBottom: '1px dashed #ffd700' }}>╌ [WEAPON] Vũ khí</span>
            <span style={{ color: '#ff69b4', fontWeight: 600, borderBottom: '1px dashed #ff69b4' }}>╌ [CAPE/WINGS] Áo/Cánh</span>
            <span style={{ color: '#a0a0a0', fontWeight: 600, borderBottom: '1px dashed #a0a0a0' }}>╌ [SHADOW] Bóng sàn</span>
          </div>
        )}

        <h3>Kết quả đo lường giải phẫu</h3>
        {analysisError && (
          <p className="analysis-result" style={{ color: '#ef4444' }}>
            ⚠️ {analysisError}
          </p>
        )}

        {/* Thông báo thông minh nếu phát hiện phụ kiện ngoại vi */}
        {metrics && (metrics.weapon_box || metrics.cape_wings_box || metrics.shadow_box) && (
          <div style={{
            fontSize: '0.8rem',
            padding: '8px 12px',
            marginBottom: '8px',
            background: 'rgba(16, 185, 129, 0.1)',
            borderLeft: '3px solid #10b981',
            borderRadius: '4px',
            color: '#34d399',
            lineHeight: '1.4'
          }}>
            🛡️ <strong>AI & Python đã tự động tách vùng:</strong> Chiều cao cơ thể sinh học thuần là{' '}
            <strong>{metrics.anatomical_height || metrics.visible_height}px</strong> (đã loại bỏ vũ khí/bóng sàn khỏi tỷ lệ chuẩn hóa).
          </div>
        )}

        <div
          className="analysis-result"
          style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5', fontSize: '0.875rem' }}
        >
          {metrics
            ? metrics.summary_text
            : (reference
                ? `Đã chọn ${reference.name}. Hãy bấm "Quét giải phẫu" để đo lường tỷ lệ đầu, thân và điểm tiếp đất.`
                : 'Chọn ảnh nhân vật mẫu để xem trước.')
          }
        </div>
      </section>

      {/* ========================================================
          CỘT PHẢI: BƯỚC 2 - HỒ SƠ PHÂN TÍCH NHÂN VẬT & PROMPT STUDIO THEO TAB
          ======================================================== */}
      <section className="analysis-panel" aria-labelledby="prompt-title">
        <h2 id="prompt-title">Bước 2. Hồ sơ Phân tích AI & Cố vấn Prompt</h2>

        {/* Thanh chuyển đổi phân hệ Tab */}
        <CharacterProfileTabs
          activeTab={activeProfileTab}
          onSelectTab={setActiveProfileTab}
          tabStatuses={tabStatuses}
          analyzingTab={analyzingTab}
          onAnalyzeTab={handleAnalyzeTab}
          onAnalyzeAll={handleAnalyzeAll}
          disabled={!reference}
        />

        {/* Thông báo lỗi nếu phân tích thất bại */}
        {profileError && (
          <p className="analysis-result" style={{ color: '#ef4444' }}>
            ⚠️ {profileError}
          </p>
        )}

        {/* ========================================================
            NỘI DUNG TỪNG PHÂN HỆ TAB
            ======================================================== */}

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

        {/* Tab 4: Ràng buộc tính nhất quán & Phòng tạo Prompt AI */}
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

        {/* Tab 5: Kế hoạch Toán học nghịch đảo (Inverse Scaling Engine) */}
        {activeProfileTab === 'inverse_math' && (
          <div>
            <div className="analysis-fields">
              <label>Đầu nhân vật mới
                <select value={headRule} onChange={(e) => setHeadRule(e.target.value)}>
                  <option value="Bằng nhân vật gốc (Tỷ lệ chuẩn)">Bằng nhân vật mẫu (Tỷ lệ chuẩn)</option>
                  <option value="To hơn nhân vật gốc (Chibi hơn)">Lớn hơn nhân vật mẫu (Chibi hơn)</option>
                  <option value="Nhỏ hơn nhân vật gốc (Dáng cao hơn)">Nhỏ hơn nhân vật mẫu (Dáng cao)</option>
                </select>
              </label>
              <label>Chiều rộng thân
                <select value={bodyWidthRule} onChange={(e) => setBodyWidthRule(e.target.value)}>
                  <option value="Bằng nhân vật gốc">Bằng nhân vật mẫu</option>
                  <option value="Rộng hơn nhân vật gốc">Rộng hơn nhân vật mẫu (Cơ bắp/Mập)</option>
                  <option value="Hẹp hơn nhân vật gốc">Hẹp hơn nhân vật mẫu (Gầy/Thon)</option>
                </select>
              </label>
              <label>Chiều cao thân
                <select value={bodyHeightRule} onChange={(e) => setBodyHeightRule(e.target.value)}>
                  <option value="Bằng nhân vật gốc">Bằng nhân vật mẫu</option>
                  <option value="Cao hơn nhân vật gốc">Cao hơn nhân vật mẫu</option>
                  <option value="Thấp hơn nhân vật gốc">Thấp hơn nhân vật mẫu</option>
                </select>
              </label>
              <label>Ý tưởng nhân vật mới (Concept)
                <input
                  type="text"
                  value={characterConcept}
                  placeholder="Ví dụ: Nữ hiệp sĩ áo giáp bạc cầm khiên, Slime độc tím..."
                  onChange={(e) => setCharacterConcept(e.target.value)}
                />
              </label>
            </div>

            <button
              type="button"
              className="analysis-generate"
              disabled={!metrics || generatingPrompt}
              onClick={handleGeneratePromptAdvice}
              style={{ marginTop: '8px' }}
            >
              <Sparkles size={18} />
              {generatingPrompt ? 'Đang tính toán nghịch đảo…' : 'Phân tích tỉ lệ và tạo prompt AI'}
            </button>

            {/* Phân tích kế hoạch tỷ lệ & toán học nghịch đảo */}
            <div
              className="analysis-result"
              style={{ whiteSpace: 'pre-wrap', lineHeight: '1.5', fontSize: '0.825rem', margin: '12px 0' }}
            >
              {mathPlanText || 'Chưa có phân tích phong cách hoặc kế hoạch tỉ lệ. Hãy quét giải phẫu Bước 1 trước.'}
            </div>

            {/* Positive Prompt */}
            <div className="analysis-output-title">
              <h3 id="positive-prompt-title">Positive Prompt (Cho Midjourney / DALL-E)</h3>
              <button
                type="button"
                disabled={!positivePrompt}
                onClick={() => handleCopyPrompt(positivePrompt, 'positive')}
              >
                {copiedPositive ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                {copiedPositive ? 'Đã sao chép!' : 'Sao chép'}
              </button>
            </div>
            <textarea
              aria-labelledby="positive-prompt-title"
              rows={7}
              readOnly
              value={positivePrompt}
              placeholder="Prompt tiếng Anh tối ưu hóa không gian và tỷ lệ đầu sẽ xuất hiện ở đây..."
            />

            {/* Negative Prompt */}
            <div className="analysis-output-title" style={{ marginTop: '12px' }}>
              <h3 id="negative-prompt-title">Negative Prompt (Chống lỗi giải phẫu & nhòe)</h3>
              <button
                type="button"
                disabled={!negativePrompt}
                onClick={() => handleCopyPrompt(negativePrompt, 'negative')}
              >
                {copiedNegative ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                {copiedNegative ? 'Đã sao chép!' : 'Sao chép'}
              </button>
            </div>
            <textarea
              aria-labelledby="negative-prompt-title"
              rows={3}
              readOnly
              value={negativePrompt}
              placeholder="Negative prompt chống cắt chân, chống nhiễu hạt..."
            />
          </div>
        )}
      </section>
    </div>
  );
}
