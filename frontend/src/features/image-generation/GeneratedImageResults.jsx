// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý giao diện và trạng thái)
// ========================================================
// React: Xây dựng giao diện cửa sổ phóng to ảnh kết quả.
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI
// ========================================================
// lucide-react: Biểu tượng tải xuống ảnh từ cửa sổ phóng to.
import { Download } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Không sử dụng)
// ========================================================

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC
// ========================================================
// Dùng định dạng chung được nạp ở màn hình tạo ảnh.

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
