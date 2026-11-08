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

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Định dạng giao diện được kế thừa từ theme.css thông qua index.css

/**
 * Màn hình Phân tích Giải phẫu Sprite và Cố vấn Prompt AI (Inverse Scaling Engine).
 * Tích hợp đầy đủ các thuật toán từ mô hình MVC cũ:
 * - Bước 1: Quét hình học & giải phẫu học cơ thể Sprite (Heuristic + AI Gemini Vision).
 * - Bước 2: Toán học nghịch đảo & sinh Prompt khống chế tỷ lệ cho Midjourney / DALL-E / Stable Diffusion.
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

  // Trạng thái các trường sinh Prompt Cố vấn
  const [headRule, setHeadRule] = useState('Bằng nhân vật gốc (Tỷ lệ chuẩn)');
  const [bodyWidthRule, setBodyWidthRule] = useState('Bằng nhân vật gốc');
  const [bodyHeightRule, setBodyHeightRule] = useState('Bằng nhân vật gốc');
  const [characterConcept, setCharacterConcept] = useState('Chiến binh Pixel Art cầm kiếm phong trần');

  // Trạng thái kết quả Prompt và Toán học nghịch đảo
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
            Dùng AI Gemini Vision
          </label>
          <button
            type="button"
            disabled={!reference || analyzing}
            onClick={handleScanAnatomy}
          >
            Quét lại
          </button>
        </div>

        <h3>Kết quả đo lường giải phẫu</h3>
        {analysisError && (
          <p className="analysis-result" style={{ color: '#ef4444' }}>
            ⚠️ {analysisError}
          </p>
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
          CỘT PHẢI: BƯỚC 2 - CỐ VẤN PROMPT AI & TOÁN HỌC NGHỊCH ĐẢO
          ======================================================== */}
      <section className="analysis-panel" aria-labelledby="prompt-title">
        <h2 id="prompt-title">Bước 2. Yêu cầu và tạo prompt</h2>
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
      </section>
    </div>
  );
}
