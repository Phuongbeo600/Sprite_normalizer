// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý giao diện và trạng thái)
// ========================================================
// React: Quản lý trạng thái tạo ảnh và đồng bộ prompt khi chuyển màn hình.
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI
// ========================================================
// lucide-react: Bộ biểu tượng cho biểu mẫu, trạng thái và thông báo.
import { Sparkles, RefreshCw, AlertCircle, CheckCircle2, Trash2, Wand2, Lock, ArrowRight } from "lucide-react";

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Thành phần giao diện và dữ liệu)
// ========================================================
// Thành phần hiển thị bộ sưu tập và ảnh phóng to.
import { GeneratedImageGallery, GeneratedImagePreview } from './GeneratedImageResults';
import { useImageGeneration } from './useImageGeneration';
// ImageApiSource: Phân biệt nguồn mặc định hệ thống và key riêng dự án.
import ImageApiSource from '../../shared/components/ImageApiSource';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Tệp định dạng)
// ========================================================
// Kế thừa phong cách Dark Fantasy Atelier từ image-gen-atelier.css
import './image-gen-atelier.css';


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
  incomingImage = null,
  onSelectTab,
  onTransferToWorkspace,
  onTransferToGodot,
  isAiEnabled = true
}) {
  const {
    configStatus,
    checkingConfig,
    prompt,
    setPrompt,
    generating,
    errorMsg,
    successMsg,
    generatedGallery,
    setGeneratedGallery,
    modalImage,
    setModalImage,
    handleGenerateImage
  } = useImageGeneration({ currentProject, incomingPrompt, incomingNegativePrompt, incomingImage });

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
            Tạo nhân vật Pixel Art và Sprite Sheet bằng dịch vụ tạo ảnh đã cấu hình.
          </p>
        </div>

        {/* Trạng thái kết nối API Key hiện hành (0 Token) */}
        <div className="image-api-status">
          {checkingConfig ? (
            <span className="atelier-gen-api-badge loading">
              <RefreshCw size={14} className="spin" /> Đang kiểm tra cấu hình...
            </span>
          ) : configStatus?.has_key ? (
            <div className="atelier-gen-api-badge connected">
              <CheckCircle2 size={15} />
              <span>
                Đã cấu hình: <strong>{configStatus.provider === 'gemini' ? 'Google Gemini' : 'API tương thích OpenAI'}</strong>
                {configStatus.model && (
                  <span style={{ marginLeft: '6px', color: '#c084fc', fontWeight: 600 }}>
                    • Model: {configStatus.model}
                  </span>
                )}
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
          {!checkingConfig && configStatus && <ImageApiSource config={configStatus} />}
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

          {/* NÚT BẮT ĐẦU TẠO ẢNH CHÍNH (Đã chuyển vào trong ô Prompt rộng rãi) */}
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
      <GeneratedImageGallery
        images={generatedGallery}
        onClear={() => setGeneratedGallery([])}
        onPreview={setModalImage}
        onSendToWorkspace={handleSendToWorkspace}
        onSendToGodot={handleSendToGodot}
        onDownload={handleDownloadImage}
      />

      {/* 4. Modal Phóng To Xem Chi Tiết Ảnh */}
      {modalImage && (
        <GeneratedImagePreview
          modalImage={modalImage}
          onClose={() => setModalImage(null)}
          onDownload={handleDownloadImage}
        />
      )}
    </div>
  );
}
