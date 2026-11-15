// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý giao diện và trạng thái)
// ========================================================
// React: Xây dựng giao diện bộ sưu tập và ảnh phóng to.
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI
// ========================================================
// lucide-react: Biểu tượng xem ảnh, chuyển ảnh và tải xuống.
import { Download, Gamepad2, Image as ImageIcon, Scissors, Trash2, ZoomIn } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Thành phần giao diện và dữ liệu)
// ========================================================
// PixelForge: Biểu tượng lò rèn khi chưa có ảnh kết quả.
import { PixelForge } from '../../shared/ui/PixelArtIcons';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC
// ========================================================
// Dùng định dạng chung được nạp ở màn hình tạo ảnh.

/**
 * Hiển thị ảnh trong phiên hiện tại và các thao tác với từng ảnh.
 *
 * @param {Object} props Thuộc tính của bộ sưu tập.
 * @param {Object[]} props.images Danh sách ảnh đã tạo.
 * @param {Function} props.onClear Hàm xóa bộ sưu tập.
 * @param {Function} props.onPreview Hàm mở ảnh phóng to.
 * @param {Function} props.onSendToWorkspace Hàm chuyển ảnh sang bàn xử lý.
 * @param {Function} props.onSendToGodot Hàm chuyển ảnh sang màn hình thử nghiệm Godot.
 * @param {Function} props.onDownload Hàm tải ảnh.
 * @returns {React.ReactElement} Giao diện bộ sưu tập ảnh.
 */
export function GeneratedImageGallery({
  images,
  onClear,
  onPreview,
  onSendToWorkspace,
  onSendToGodot,
  onDownload,
}) {
  return (
    <div className="atelier-gen-gallery-card">
      <div className="atelier-gen-card-header">
        <h3 className="atelier-gen-card-title" style={{ fontSize: '1rem' }}>
          <ImageIcon size={19} color="#c084fc" />
          <span>Thư Viện Kết Quả Phiên Này ({images.length} tác phẩm)</span>
        </h3>
        {images.length > 0 && (
          <button
            type="button"
            className="atelier-gen-btn-clear"
            onClick={onClear}
            style={{ color: '#f87171' }}
          >
            <Trash2 size={12} /> Xóa sạch bộ sưu tập
          </button>
        )}
      </div>

      {images.length === 0 ? (
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
          {images.map((imgItem) => (
            <div key={imgItem.id} className="atelier-gen-item">
              {/* Khung xem ảnh với nền ô cờ tối */}
              <div
                className="atelier-gen-image-frame"
                onClick={() => onPreview(imgItem)}
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
                    onClick={() => onSendToWorkspace(imgItem)}
                    title="Mở ảnh này trong bàn xử lý để cắt viền, tìm hộp bao và chuẩn hóa"
                  >
                    <Scissors size={13} color="#10b981" />
                    <span>Xử lý ảnh</span>
                  </button>

                  {/* Nút 2: Đưa vào Thử nghiệm Godot */}
                  <button
                    type="button"
                    className="atelier-gen-btn-sub"
                    onClick={() => onSendToGodot(imgItem)}
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
                  onClick={() => onDownload(imgItem)}
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
  );
}

/**
 * Hiển thị ảnh được chọn ở kích thước lớn.
 *
 * @param {Object} props Thuộc tính của cửa sổ xem ảnh.
 * @param {Object} props.modalImage Ảnh đang được xem.
 * @param {Function} props.onClose Hàm đóng cửa sổ xem ảnh.
 * @param {Function} props.onDownload Hàm tải ảnh.
 * @returns {React.ReactElement} Giao diện xem ảnh phóng to.
 */
export function GeneratedImagePreview({ modalImage, onClose, onDownload }) {
  return (
    <div
      className="atelier-gen-modal-overlay"
      onClick={onClose}
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
              onClick={() => onDownload(modalImage)}
            >
              <Download size={13} /> Tải PNG
            </button>
            <button
              type="button"
              className="atelier-gen-btn-clear"
              onClick={onClose}
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
