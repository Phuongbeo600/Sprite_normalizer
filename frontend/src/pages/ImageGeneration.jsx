// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState, useEffect } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ biểu tượng tia sáng ma thuật, tải về, chuyển tab, làm mới, kính lúp, thông báo, ổ khóa
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
  Trash2,
  Wand2,
  ShieldAlert,
  Lock,
  Layers,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// PixelArtIcons: Biểu tượng lò rèn ma thuật pixel art cho empty state
import { PixelForge } from '../components/common/PixelArtIcons';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark Fantasy Atelier từ image-gen-atelier.css
import '../styles/image-gen-atelier.css';

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
 * Màn hình Tạo ảnh AI (AI Image Generator) — Dark Fantasy Atelier Edition.
 * Kết nối Google Gemini Imagen 3 hoặc OpenAI DALL-E 3 để rèn đúc nhân vật và sprite game từ văn bản mô tả.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object} props.currentProject Dự án hiện tại đang mở (chứa id, name).
 * @param {string} [props.incomingPrompt] Prompt được chuyển tiếp từ màn hình Phân tích.
 * @param {string} [props.incomingNegativePrompt] Lệnh cấm được chuyển tiếp từ màn hình Phân tích.
 * @param {Function} [props.onSelectTab] Hàm chuyển đổi tab điều hướng.
 * @param {Function} [props.onTransferToWorkspace] Hàm chuyển ảnh sang Xử lý ảnh.
 * @param {Function} [props.onTransferToGodot] Hàm chuyển ảnh sang Thử nghiệm Godot.
 * @param {boolean} [props.isAiEnabled=true] Trạng thái bật/tắt toàn bộ tính năng AI trong dự án.
 * @returns {React.ReactElement} Giao diện màn hình tạo ảnh.
 */
export default function ImageGeneration({
  currentProject,
  incomingPrompt = '',
  incomingNegativePrompt = '',
  onSelectTab,
  onTransferToWorkspace,
  onTransferToGodot,
  isAiEnabled = true
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
   * @param {string} tagText Chuỗi từ khóa phong cách
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
   * @param {string} dataUrl Chuỗi base64 của ảnh
   * @param {string} filename Tên tệp tin cần tạo
   * @returns {File} Đối tượng File trình duyệt
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
   * @param {Object} imgItem Đối tượng ảnh kết quả
   */
  const handleDownloadImage = (imgItem) => {
    const link = document.createElement('a');
    link.href = imgItem.data_url;
    link.download = `atelier_sprite_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Chuyển ảnh vừa tạo sang mục Xử lý ảnh (Workspace)
   * @param {Object} imgItem Đối tượng ảnh kết quả
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
   * @param {Object} imgItem Đối tượng ảnh kết quả
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
    <div className="atelier-gen-root">
      {/* 1. Header Trang & Trạng thái API Key */}
      <div className="atelier-gen-header">
        <div className="atelier-gen-header-title">
          <h2 className="atelier-gen-title-heading">
            <Sparkles size={22} color="#c084fc" />
            <span>Phòng Rèn Ảnh AI (AI Image Forge)</span>
          </h2>
          <p className="atelier-gen-title-subtext">
            Khởi tạo nhân vật Pixel Art &amp; Sprite Sheet độ phân giải cao bằng Google Imagen 3 hoặc OpenAI DALL-E 3.
          </p>
        </div>

        {/* Trạng thái kết nối API Key hiện hành (0 Token) */}
        <div>
          {checkingConfig ? (
            <span className="atelier-gen-api-badge loading">
              <RefreshCw size={14} className="spin" /> Đang kiểm tra cấu hình...
            </span>
          ) : configStatus?.has_key ? (
            <div className="atelier-gen-api-badge connected">
              <CheckCircle2 size={15} />
              <span>
                Đã kết nối: <strong>{configStatus.provider === 'gemini' ? 'Google Gemini' : 'OpenAI'}</strong>
              </span>
              <span style={{ opacity: 0.75, fontSize: '0.7rem' }}>
                ({configStatus.masked_key || 'Đã nạp key'})
              </span>
            </div>
          ) : (
            <div className="atelier-gen-api-badge warning">
              <AlertCircle size={15} />
              <span>Chưa nạp API Key ({configStatus?.provider || 'Gemini'})</span>
              {onSelectTab && (
                <button
                  type="button"
                  className="atelier-gen-link-btn"
                  onClick={() => onSelectTab('project_settings')}
                >
                  Nạp key ngay ➔
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CẢNH BÁO: TÍNH NĂNG AI ĐANG BỊ TẮT TRONG CÀI ĐẶT DỰ ÁN */}
      {!isAiEnabled && (
        <div className="atelier-gen-lock-banner">
          <div className="atelier-gen-lock-content">
            <Lock size={18} color="#f87171" />
            <span>
              <strong>Chế độ an toàn đang bật:</strong> Toàn bộ các cổng gọi API sinh ảnh AI trong dự án này đã bị tạm khóa.
            </span>
          </div>

          {onSelectTab && (
            <button
              type="button"
              className="atelier-gen-btn-unlock"
              onClick={() => onSelectTab('project_settings')}
            >
              <span>Vào Cài Đặt Dự Án để mở khóa</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      )}

      {/* Thông báo lỗi / thành công */}
      {errorMsg && (
        <div className="atelier-gen-alert error">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="atelier-gen-alert success">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 2. Khung Soạn Thảo Prompt & Cấu hình Tham Số */}
      <div className="atelier-gen-workspace-grid">
        {/* CỘT TRÁI: Ô NHẬP PROMPT & THẺ PHONG CÁCH */}
        <div className="atelier-gen-card">
          <div className="atelier-gen-card-header">
            <label className="atelier-gen-card-title">
              <Wand2 size={16} color="#c084fc" />
              <span>Mô tả nhân vật / Sprite cần tạo (Prompt):</span>
            </label>
            {prompt && (
              <button
                type="button"
                className="atelier-gen-btn-clear"
                onClick={() => setPrompt('')}
                title="Xóa nội dung prompt"
              >
                <Trash2 size={12} /> Xóa chữ
              </button>
            )}
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ví dụ: Hiệp sĩ Dark Fantasy phong cách pixel art 16-bit, mặc giáp thép đen viền tím phát sáng, cầm trường kiếm ánh bạc, đứng trên nền trắng thuần khiết..."
            rows={5}
            className="atelier-gen-textarea"
          />

          {/* Gợi ý thẻ phong cách nhanh */}
          <div>
            <span className="atelier-gen-tags-label">
              Từ khóa chuyên dụng cho rèn đúc Sprite Game:
            </span>
            <div className="atelier-gen-tags-grid">
              {QUICK_STYLE_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className="atelier-gen-tag-chip"
                  onClick={() => handleApplyStyleTag(tag.text)}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ô NHẬP LỆNH CẤM / LOẠI TRỪ (NEGATIVE PROMPT) */}
          <div className="atelier-gen-negative-box">
            <div className="atelier-gen-card-header">
              <label className="atelier-gen-card-title" style={{ color: '#fda4af', fontSize: '0.8rem' }}>
                <ShieldAlert size={15} color="#f43f5e" />
                <span>Lệnh cấm / Chi tiết cần loại trừ (Negative Prompt):</span>
              </label>
              {negativePrompt && (
                <button
                  type="button"
                  className="atelier-gen-btn-clear"
                  onClick={() => setNegativePrompt('')}
                  title="Xóa lệnh cấm"
                >
                  <Trash2 size={11} /> Xóa
                </button>
              )}
            </div>

            <textarea
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="Các chi tiết cấm vẽ: blurry, 3D render, photorealistic, background scenery, noise, extra limbs, distorted grid, gradient background..."
              rows={3}
              className="atelier-gen-negative-textarea"
            />
            <span className="atelier-gen-hint">
              * Ngăn AI không vẽ khối 3D, bóng nhòe hay phông nền phức tạp để bảo đảm ảnh sprite phẳng, dễ tách viền.
            </span>
          </div>
        </div>

        {/* CỘT PHẢI: CẤU HÌNH THAM SỐ & NÚT TẠO ẢNH */}
        <div className="atelier-gen-card">
          <div className="atelier-gen-card-header">
            <h4 className="atelier-gen-card-title">
              <Sliders size={16} color="#10b981" />
              <span>Thiết lập Tham số</span>
            </h4>
          </div>

          {/* Chọn tỉ lệ khung hình */}
          <div>
            <label className="atelier-gen-tags-label">Tỉ lệ khung hình (Aspect Ratio):</label>
            <select
              value={aspectRatio}
              onChange={(e) => setAspectRatio(e.target.value)}
              className="atelier-gen-select"
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
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span className="atelier-gen-tags-label" style={{ margin: 0 }}>Số lượng ảnh mỗi lần rèn:</span>
              <strong style={{ color: '#c084fc', fontSize: '0.8rem' }}>{numberOfImages} ảnh</strong>
            </div>
            <div className="atelier-gen-count-selector">
              {[1, 2, 4].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setNumberOfImages(num)}
                  className={`atelier-gen-count-btn ${numberOfImages === num ? 'active' : ''}`}
                >
                  {num} ảnh
                </button>
              ))}
            </div>
            <span className="atelier-gen-hint" style={{ marginTop: '6px', display: 'block' }}>
              * Lưu ý: OpenAI DALL-E 3 tạo 1 ảnh độ nét cao chuẩn nhất trên mỗi lượt gọi.
            </span>
          </div>

          {/* NÚT BẮT ĐẦU TẠO ẢNH CHÍNH */}
          <button
            type="button"
            className="atelier-gen-btn-submit"
            disabled={generating || !prompt.trim() || !isAiEnabled}
            onClick={handleGenerateImage}
            title={!isAiEnabled ? 'Tính năng AI đang bị khóa trong Cài đặt dự án' : ''}
          >
            {generating ? (
              <>
                <RefreshCw size={17} className="spin" />
                <span>Đang kết nối thần lực AI sinh ảnh...</span>
              </>
            ) : !isAiEnabled ? (
              <>
                <Lock size={17} />
                <span>Đã Khóa (Tính Năng AI Đang Tắt)</span>
              </>
            ) : (
              <>
                <Sparkles size={17} />
                <span>Bắt Đầu Rèn Đúc Ảnh Sprite</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Bộ Sưu Tập Kết Quả Ảnh Đã Sinh (Gallery) */}
      <div className="atelier-gen-gallery-card">
        <div className="atelier-gen-card-header">
          <h3 className="atelier-gen-card-title" style={{ fontSize: '1rem' }}>
            <ImageIcon size={19} color="#c084fc" />
            <span>Thư Viện Kết Quả Phiên Này ({generatedGallery.length} tác phẩm)</span>
          </h3>
          {generatedGallery.length > 0 && (
            <button
              type="button"
              className="atelier-gen-btn-clear"
              onClick={() => setGeneratedGallery([])}
              style={{ color: '#f87171' }}
            >
              <Trash2 size={12} /> Xóa sạch bộ sưu tập
            </button>
          )}
        </div>

        {generatedGallery.length === 0 ? (
          <div className="atelier-gen-empty-state">
            <div className="pixel-empty-icon-wrap">
              <div className="pixel-empty-circle-aura" />
              <PixelForge size={56} className="pixel-art-glow-amber pixel-art-float" />
            </div>
            <p style={{ margin: 0, fontSize: '0.86rem', color: '#a39bc2' }}>
              Chưa có ảnh nào được tạo trong phiên này.
            </p>
            <span style={{ fontSize: '0.76rem', color: '#6e658a' }}>
              Hãy nhập mô tả nhân vật và bấm <strong>"Bắt Đầu Rèn Đúc Ảnh Sprite"</strong> ở bảng trên!
            </span>
          </div>
        ) : (
          <div className="atelier-gen-grid">
            {generatedGallery.map((imgItem) => (
              <div key={imgItem.id} className="atelier-gen-item">
                {/* Khung xem ảnh với nền ô cờ tối */}
                <div
                  className="atelier-gen-image-frame"
                  onClick={() => setModalImage(imgItem)}
                  title="Nhấp để phóng to xem chi tiết pixel"
                >
                  <img
                    src={imgItem.data_url}
                    alt="AI Generated Sprite"
                  />
                  <div className="atelier-gen-zoom-overlay">
                    <ZoomIn size={14} />
                  </div>
                </div>

                {/* Nút hành động */}
                <div className="atelier-gen-item-actions">
                  <div className="atelier-gen-action-row">
                    {/* Nút 1: Chuyển sang Xử lý ảnh */}
                    <button
                      type="button"
                      className="atelier-gen-btn-sub"
                      onClick={() => handleSendToWorkspace(imgItem)}
                      title="Mở ảnh này trong bàn xử lý để cắt viền, tìm hộp bao và chuẩn hóa"
                    >
                      <Scissors size={13} color="#10b981" />
                      <span>Xử lý ảnh</span>
                    </button>

                    {/* Nút 2: Đưa vào Thử nghiệm Godot */}
                    <button
                      type="button"
                      className="atelier-gen-btn-sub"
                      onClick={() => handleSendToGodot(imgItem)}
                      title="Đưa ảnh nhân vật này vào sàn thử nghiệm Godot 4"
                    >
                      <Gamepad2 size={13} color="#38bdf8" />
                      <span>Thử Godot</span>
                    </button>
                  </div>

                  {/* Nút 3: Tải file PNG về máy */}
                  <button
                    type="button"
                    className="atelier-gen-btn-download"
                    onClick={() => handleDownloadImage(imgItem)}
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
          className="atelier-gen-modal-overlay"
          onClick={() => setModalImage(null)}
        >
          <div
            className="atelier-gen-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={modalImage.data_url}
              alt="Zoom Preview"
              className="atelier-gen-modal-image"
            />
            <div className="atelier-gen-modal-footer">
              <span style={{ fontSize: '0.78rem', color: '#c084fc', fontWeight: 600 }}>
                Ảnh sinh AI ({modalImage.aspect_ratio || '1:1'})
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="atelier-gen-btn-sub"
                  onClick={() => handleDownloadImage(modalImage)}
                >
                  <Download size={13} /> Tải PNG
                </button>
                <button
                  type="button"
                  className="atelier-gen-btn-clear"
                  onClick={() => setModalImage(null)}
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
