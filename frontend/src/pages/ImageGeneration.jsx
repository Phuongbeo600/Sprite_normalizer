// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState, useEffect } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ biểu tượng tia sáng AI, tải về, chuyển tab, làm mới, kính lúp, thông báo
import {
  Sparkles,
  Download,
  Image as ImageIcon,
  Gamepad2,
  Scissors,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Sliders,
  ZoomIn,
  Copy,
  Trash2,
  ExternalLink,
  Layers,
  Wand2,
  ShieldAlert
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không có component nội bộ phụ thuộc)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa các biến màu Dark Gaming và thẻ Card từ theme.css

/**
 * Danh sách các thẻ phong cách gợi ý nhanh cho nhân vật game và sprite.
 */
const QUICK_STYLE_TAGS = [
  { id: 'pixel_16bit', label: '🗡️ Pixel Art 16-bit RPG', text: '16-bit pixel art style, crisp edges, clean dithering, retro game character' },
  { id: 'sprite_sheet', label: '📜 Sprite Sheet 4 Hướng', text: 'character sprite sheet, walk cycle, front side and back view, pixel art, game assets' },
  { id: 'chibi_cute', label: '✨ Chibi Anime Cute', text: 'cute chibi proportions, expressive face, big head small body, 2D game sprite' },
  { id: 'white_bg', label: '⚪ Nền trắng tách biệt', text: 'isolated on solid pure white background, easy to cut, no background clutter' },
  { id: 'dark_fantasy', label: '⚔️ Dark Fantasy Gothic', text: 'dark fantasy theme, gothic armor, glowing magical runes, muted colors with high contrast' },
  { id: 'topdown_rpg', label: '📐 Top-Down RPG 2D', text: 'top-down 2D RPG perspective, clear silhouette, vibrant pixel color palette' }
];

/**
 * Danh sách tùy chọn tỉ lệ khung hình chuẩn AI.
 */
const ASPECT_RATIO_OPTIONS = [
  { value: '1:1', label: '1:1 (Vuông - Chuẩn Sprite & Avatar)', desc: '1024×1024' },
  { value: '3:4', label: '3:4 (Đứng - Nhân vật đứng toàn thân)', desc: 'Dọc cao' },
  { value: '4:3', label: '4:3 (Ngang - Sprite sheet dàn ngang)', desc: 'Ngang rộng' },
  { value: '16:9', label: '16:9 (Toàn cảnh / Môi trường)', desc: 'Widescreen' }
];

/**
 * Màn hình Tạo ảnh AI (AI Image Generator).
 * Kết nối Google Gemini Imagen 3 hoặc OpenAI DALL-E 3 để sinh ảnh sprite từ văn bản mô tả.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object} props.currentProject Dự án hiện tại đang mở (chứa id, name).
 * @param {string} [props.incomingPrompt] Prompt được chuyển tiếp từ màn hình Phân tích.
 * @param {string} [props.incomingNegativePrompt] Lệnh cấm được chuyển tiếp từ màn hình Phân tích.
 * @param {Function} [props.onSelectTab] Hàm chuyển đổi tab điều hướng.
 * @param {Function} [props.onTransferToWorkspace] Hàm chuyển ảnh sang Xử lý ảnh.
 * @param {Function} [props.onTransferToGodot] Hàm chuyển ảnh sang Thử nghiệm Godot.
 * @returns {React.ReactElement} Giao diện màn hình tạo ảnh.
 */
export default function ImageGeneration({
  currentProject,
  incomingPrompt = '',
  incomingNegativePrompt = '',
  onSelectTab,
  onTransferToWorkspace,
  onTransferToGodot
}) {
  // Trạng thái cấu hình API Key đọc từ hệ thống (0 Token)
  const [configStatus, setConfigStatus] = useState(null);
  const [checkingConfig, setCheckingConfig] = useState(true);

  // Form nhập liệu
  const [prompt, setPrompt] = useState(incomingPrompt || '');
  const [negativePrompt, setNegativePrompt] = useState(incomingNegativePrompt || '');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [numberOfImages, setNumberOfImages] = useState(1);
  const [selectedPreset, setSelectedPreset] = useState('');

  // Trạng thái sinh ảnh
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Danh sách ảnh kết quả trong phiên làm việc
  const [generatedGallery, setGeneratedGallery] = useState([]);
  // Xem chi tiết ảnh phóng to
  const [modalImage, setModalImage] = useState(null);

  // Cập nhật prompt nếu có dữ liệu chuyển từ tab Phân tích sang
  useEffect(() => {
    if (incomingPrompt && incomingPrompt.trim()) {
      setPrompt(incomingPrompt.trim());
    }
  }, [incomingPrompt]);

  // Cập nhật lệnh cấm (negative prompt) nếu có dữ liệu chuyển sang
  useEffect(() => {
    if (incomingNegativePrompt && incomingNegativePrompt.trim()) {
      setNegativePrompt(incomingNegativePrompt.trim());
    }
  }, [incomingNegativePrompt]);

  // Kiểm tra cấu hình API hiện hành (hoàn toàn ngoại tuyến, không tốn token)
  const fetchApiStatus = async () => {
    setCheckingConfig(true);
    try {
      const projId = currentProject?.id ? `?project_id=${currentProject.id}` : '';
      const resp = await fetch(`/api/image-gen/status${projId}`);
      if (resp.ok) {
        const data = await resp.json();
        setConfigStatus(data);
      }
    } catch (e) {
      console.warn('Không thể kiểm tra cấu hình API tạo ảnh:', e);
    } finally {
      setCheckingConfig(false);
    }
  };

  useEffect(() => {
    fetchApiStatus();
  }, [currentProject?.id]);

  /**
   * Thêm từ khóa phong cách gợi ý vào prompt
   */
  const handleApplyStyleTag = (tagText) => {
    setPrompt((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return tagText;
      if (trimmed.includes(tagText)) return trimmed;
      return `${trimmed}, ${tagText}`;
    });
  };

  /**
   * Gửi yêu cầu sinh ảnh tới backend (Chỉ kích hoạt khi người dùng bấm nút)
   */
  const handleGenerateImage = async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      setErrorMsg('Vui lòng nhập mô tả nhân vật hoặc sprite trước khi bắt đầu tạo ảnh.');
      return;
    }

    setGenerating(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        prompt: cleanPrompt,
        negative_prompt: negativePrompt.trim() || null,
        project_id: currentProject?.id || null,
        aspect_ratio: aspectRatio,
        number_of_images: numberOfImages,
        style_preset: selectedPreset || null
      };

      const resp = await fetch('/api/image-gen/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await resp.json();

      if (!resp.ok) {
        throw new Error(resData?.detail || 'Không thể tạo ảnh từ mô hình AI. Vui lòng kiểm tra lại cấu hình.');
      }

      const newImages = resData.images || [];
      if (newImages.length === 0) {
        throw new Error('API đã phản hồi nhưng không nhận được ảnh hợp lệ.');
      }

      // Đưa các ảnh mới lên đầu bộ sưu tập
      setGeneratedGallery((prev) => [...newImages, ...prev]);
      setSuccessMsg(`Tạo thành công ${newImages.length} ảnh bằng ${resData.provider_used === 'gemini' ? 'Google Imagen 3' : 'OpenAI DALL-E'}!`);
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi gọi API tạo ảnh.');
    } finally {
      setGenerating(false);
    }
  };

  /**
   * Chuyển chuỗi Data URL Base64 thành đối tượng File để truyền sang Workspace / Godot
   */
  const dataUrlToFile = (dataUrl, filename) => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  /**
   * Tải ảnh trực tiếp về máy tính dạng PNG
   */
  const handleDownloadImage = (imgItem) => {
    const link = document.createElement('a');
    link.href = imgItem.data_url;
    link.download = `ai_sprite_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Chuyển ảnh vừa tạo sang mục Xử lý ảnh (Workspace)
   */
  const handleSendToWorkspace = (imgItem) => {
    const file = dataUrlToFile(imgItem.data_url, `generated_${imgItem.id}.png`);
    if (onTransferToWorkspace) {
      onTransferToWorkspace(file);
    } else if (onSelectTab) {
      onSelectTab('workspace');
    }
  };

  /**
   * Chuyển ảnh vừa tạo sang mục Thử nghiệm Godot
   */
  const handleSendToGodot = (imgItem) => {
    const file = dataUrlToFile(imgItem.data_url, `generated_${imgItem.id}.png`);
    if (onTransferToGodot) {
      onTransferToGodot(file);
    } else if (onSelectTab) {
      onSelectTab('godot_testbed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '16px 20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* 1. Header Trang & Trạng thái API Key */}
      <div style={{
        background: '#0d121f',
        border: '1px solid var(--border-card)',
        borderRadius: '8px',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--text-white)', fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={22} color="#facc15" />
            Tạo ảnh AI (AI Image Generator)
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-dim)', fontSize: '0.825rem' }}>
            Sinh ảnh nhân vật game &amp; sprite sheet pixel art chất lượng cao bằng Google Imagen 3 hoặc OpenAI DALL-E 3 từ văn bản mô tả.
          </p>
        </div>

        {/* Trạng thái kết nối API Key hiện hành (0 Token) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {checkingConfig ? (
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <RefreshCw size={13} className="spin" /> Đang kiểm tra cấu hình...
            </span>
          ) : configStatus?.has_key ? (
            <div style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '6px',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.775rem',
              color: '#10b981'
            }}>
              <CheckCircle2 size={15} />
              <span>
                Đã kết nối: <strong>{configStatus.provider === 'gemini' ? 'Google Gemini' : 'OpenAI'}</strong>
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                ({configStatus.masked_key || 'Đã nạp key'})
              </span>
            </div>
          ) : (
            <div style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '6px',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.775rem',
              color: '#f59e0b'
            }}>
              <AlertCircle size={15} />
              <span>Chưa có API Key ({configStatus?.provider || 'Gemini'})</span>
              {onSelectTab && (
                <button
                  type="button"
                  className="btn-ghost-studio"
                  onClick={() => onSelectTab('project_settings')}
                  style={{ fontSize: '0.725rem', padding: '2px 8px', color: '#38bdf8', textDecoration: 'underline' }}
                >
                  Nạp key ngay
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Thông báo lỗi / thành công */}
      {errorMsg && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          borderRadius: '6px',
          color: '#fca5a5',
          fontSize: '0.825rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div style={{
          padding: '10px 14px',
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid #10b981',
          borderRadius: '6px',
          color: '#6ee7b7',
          fontSize: '0.825rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 2. Khung Soạn Thảo Prompt & Cấu hình Tham Số */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.7fr) minmax(300px, 1fr)',
        gap: '16px',
        alignItems: 'start'
      }}>
        {/* CỘT TRÁI: Ô NHẬP PROMPT & THẺ PHONG CÁCH */}
        <div style={{
          background: '#0d121f',
          border: '1px solid var(--border-card)',
          borderRadius: '8px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Wand2 size={15} color="#38bdf8" />
              Mô tả nhân vật / Sprite cần tạo (Prompt):
            </label>
            {prompt && (
              <button
                type="button"
                className="btn-ghost-studio"
                onClick={() => setPrompt('')}
                style={{ fontSize: '0.725rem', padding: '2px 6px', color: '#94a3b8' }}
              >
                <Trash2 size={12} /> Xóa chữ
              </button>
            )}
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ví dụ: Nữ pháp sư chibi phong cách pixel art 16-bit, mặc áo choàng tím sao vàng, tóc bạc cầm trượng pha lê xanh, đứng trên nền trắng tách biệt..."
            rows={5}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '6px',
              background: '#070b13',
              border: '1px solid var(--border-card)',
              color: '#fff',
              fontSize: '0.85rem',
              lineHeight: 1.5,
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />

          {/* Gợi ý thẻ phong cách nhanh */}
          <div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '6px' }}>
              Thêm nhanh từ khóa chuyên dụng cho game:
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {QUICK_STYLE_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleApplyStyleTag(tag.text)}
                  style={{
                    background: '#131b2e',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    color: '#93c5fd',
                    fontSize: '0.725rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#38bdf8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ô NHẬP LỆNH CẤM / LOẠI TRỪ (NEGATIVE PROMPT) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldAlert size={14} color="#ef4444" />
                Lệnh cấm / Chi tiết cần loại trừ (Negative Prompt):
              </label>
              {negativePrompt && (
                <button
                  type="button"
                  className="btn-ghost-studio"
                  onClick={() => setNegativePrompt('')}
                  style={{ fontSize: '0.7rem', padding: '2px 6px', color: '#94a3b8' }}
                >
                  <Trash2 size={11} /> Xóa lệnh cấm
                </button>
              )}
            </div>

            <textarea
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="Các chi tiết cấm vẽ: blurry, 3D render, photorealistic, background scenery, noise, extra limbs, distorted grid..."
              rows={3}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                background: '#070b13',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                fontSize: '0.775rem',
                lineHeight: 1.4,
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
            <span style={{ fontSize: '0.675rem', color: '#94a3b8' }}>
              * Ngăn AI không vẽ 3D, không vẽ mờ nhòe hay nền phong cảnh phức tạp để đảm bảo ảnh sprite chuẩn phẳng, dễ cắt ghép.
            </span>
          </div>
        </div>

        {/* CỘT PHẢI: CẤU HÌNH THAM SỐ & NÚT TẠO ẢNH */}
        <div style={{
          background: '#0d121f',
          border: '1px solid var(--border-card)',
          borderRadius: '8px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <h4 style={{ margin: 0, color: '#e2e8f0', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sliders size={15} color="#10b981" />
            Tùy chọn tạo ảnh
          </h4>

          {/* Chọn tỉ lệ khung hình */}
          <div>
            <label style={{ fontSize: '0.775rem', color: 'var(--text-dim)', display: 'block', marginBottom: '4px' }}>
              Tỉ lệ khung hình:
            </label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '4px',
                background: '#0f172a',
                border: '1px solid var(--border-card)',
                color: '#fff',
                fontSize: '0.8rem'
              }}
            >
              {ASPECT_RATIO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Số lượng ảnh cần tạo */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.775rem', color: 'var(--text-dim)', marginBottom: '4px' }}>
              <span>Số lượng ảnh mỗi lần tạo:</span>
              <strong style={{ color: '#facc15' }}>{numberOfImages} ảnh</strong>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {[1, 2, 4].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setNumberOfImages(num)}
                  style={{
                    flex: 1,
                    padding: '5px 0',
                    background: numberOfImages === num ? '#38bdf8' : '#0f172a',
                    color: numberOfImages === num ? '#000' : '#e2e8f0',
                    fontWeight: numberOfImages === num ? 700 : 500,
                    border: '1px solid var(--border-card)',
                    borderRadius: '4px',
                    fontSize: '0.775rem',
                    cursor: 'pointer'
                  }}
                >
                  {num} ảnh
                </button>
              ))}
            </div>
            <span style={{ fontSize: '0.675rem', color: '#64748b', display: 'block', marginTop: '3px' }}>
              * Lưu ý: OpenAI DALL-E 3 tạo 1 ảnh chất lượng cao mỗi lượt.
            </span>
          </div>

          {/* NÚT BẮT ĐẦU TẠO ẢNH CHÍNH */}
          <button
            type="button"
            className="btn-primary-studio"
            disabled={generating || !prompt.trim()}
            onClick={handleGenerateImage}
            style={{
              width: '100%',
              padding: '10px 16px',
              fontSize: '0.875rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '4px'
            }}
          >
            {generating ? (
              <>
                <RefreshCw size={17} className="spin" />
                <span>Đang kết nối AI sinh ảnh...</span>
              </>
            ) : (
              <>
                <Sparkles size={17} />
                <span>Bắt đầu tạo ảnh với AI</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Bộ Sưu Tập Kết Quả Ảnh Đã Sinh (Gallery) */}
      <div style={{
        background: '#0d121f',
        border: '1px solid var(--border-card)',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, color: 'var(--text-white)', fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ImageIcon size={18} color="#38bdf8" />
            Bộ sưu tập kết quả ({generatedGallery.length} ảnh)
          </h3>
          {generatedGallery.length > 0 && (
            <button
              type="button"
              className="btn-ghost-studio"
              onClick={() => setGeneratedGallery([])}
              style={{ fontSize: '0.725rem', padding: '3px 8px', color: '#ef4444' }}
            >
              <Trash2 size={12} /> Xóa sạch bộ sưu tập
            </button>
          )}
        </div>

        {generatedGallery.length === 0 ? (
          <div style={{
            padding: '36px 20px',
            textAlign: 'center',
            color: '#64748b',
            border: '1.5px dashed rgba(255,255,255,0.08)',
            borderRadius: '6px'
          }}>
            <Sparkles size={32} color="#475569" style={{ margin: '0 auto 8px' }} />
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              Chưa có ảnh nào được tạo trong phiên này. Hãy nhập mô tả và bấm <strong>"Bắt đầu tạo ảnh với AI"</strong> ở trên!
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '14px'
          }}>
            {generatedGallery.map((imgItem) => (
              <div
                key={imgItem.id}
                style={{
                  background: '#131b2e',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                {/* Khung xem ảnh với nền lưới trong suốt */}
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '1 / 1',
                    background: '#070b13',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    cursor: 'pointer'
                  }}
                  onClick={() => setModalImage(imgItem)}
                  title="Nhấp để phóng to xem chi tiết"
                >
                  <img
                    src={imgItem.data_url}
                    alt="AI Generated Sprite"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                      imageRendering: 'pixelated',
                      display: 'block'
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'rgba(0,0,0,0.6)',
                    borderRadius: '4px',
                    padding: '4px',
                    color: '#fff'
                  }}>
                    <ZoomIn size={14} />
                  </div>
                </div>

                {/* 3 NÚT HÀNH ĐỘNG TIỆN LỢI */}
                <div style={{
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  borderTop: '1px solid rgba(255,255,255,0.06)'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {/* Nút 1: Chuyển sang Xử lý ảnh */}
                    <button
                      type="button"
                      className="btn-secondary-studio"
                      onClick={() => handleSendToWorkspace(imgItem)}
                      title="Mở ảnh này trong bàn xử lý để cắt viền, tìm hộp bao và chuẩn hóa"
                      style={{ fontSize: '0.725rem', padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    >
                      <Scissors size={13} color="#10b981" />
                      <span>Xử lý ảnh</span>
                    </button>

                    {/* Nút 2: Đưa vào Thử nghiệm Godot */}
                    <button
                      type="button"
                      className="btn-secondary-studio"
                      onClick={() => handleSendToGodot(imgItem)}
                      title="Đưa ảnh nhân vật này vào sàn thử nghiệm Godot 4"
                      style={{ fontSize: '0.725rem', padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    >
                      <Gamepad2 size={13} color="#38bdf8" />
                      <span>Thử Godot</span>
                    </button>
                  </div>

                  {/* Nút 3: Tải file PNG về máy */}
                  <button
                    type="button"
                    className="btn-ghost-studio"
                    onClick={() => handleDownloadImage(imgItem)}
                    style={{ width: '100%', fontSize: '0.725rem', padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <Download size={13} />
                    <span>Tải về máy (.PNG)</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Modal Phóng To Xem Chi Tiết Ảnh */}
      {modalImage && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setModalImage(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '85vw',
              maxHeight: '85vh',
              background: '#0d121f',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px',
              padding: '12px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={modalImage.data_url}
              alt="Zoom Preview"
              style={{
                maxWidth: '100%',
                maxHeight: '75vh',
                objectFit: 'contain',
                imageRendering: 'pixelated',
                display: 'block',
                margin: '0 auto'
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Ảnh sinh AI ({modalImage.aspect_ratio})
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary-studio"
                  onClick={() => handleDownloadImage(modalImage)}
                  style={{ fontSize: '0.75rem', padding: '4px 10px', gap: '4px' }}
                >
                  <Download size={13} /> Tải ảnh
                </button>
                <button
                  type="button"
                  className="btn-ghost-studio"
                  onClick={() => setModalImage(null)}
                  style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
