// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Biểu tượng bảng màu ma thuật, sao chép nội dung và dấu tích hoàn tất
import { Palette, Copy, Check, RotateCcw } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không phụ thuộc component nội bộ khác)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// analysis-atelier.css: Hệ thống phong cách Dark Fantasy Atelier huyền bí
import '../../styles/analysis-atelier.css';

/**
 * Khung To Nhất: Bảng Quy Định Màu Sắc & Đồ Họa Cốt Lõi (Master Color Specifications Card).
 * Cho phép người dùng kiểm tra dải ô màu chủ đạo, tinh chỉnh đặc tả prompt màu
 * và khôi phục về giá trị mặc định được tính toán từ ảnh mẫu Pixel Art.
 * 
 * @param {Object} props Thuộc tính của component.
 * @param {string} props.masterColorPrompt Nội dung câu prompt màu sắc hiện tại.
 * @param {Function} props.setMasterColorPrompt Hàm cập nhật nội dung prompt màu sắc.
 * @param {string} props.defaultMasterColorPrompt Nội dung prompt màu sắc mặc định.
 * @param {Array<string>} [props.topHexList=[]] Danh sách mã màu HEX chủ đạo.
 * @returns {React.ReactElement} Thẻ giao diện khung màu sắc cốt lõi phong cách Atelier.
 */
export default function MasterColorSpecCard({
  masterColorPrompt,
  setMasterColorPrompt,
  defaultMasterColorPrompt,
  topHexList = []
}) {
  // Trạng thái đã sao chép câu prompt màu vào clipboard hay chưa
  const [copiedColor, setCopiedColor] = useState(false);

  /**
   * Sao chép khung màu vào bộ nhớ tạm của hệ điều hành.
   */
  const handleCopyColor = () => {
    if (!masterColorPrompt) return;
    navigator.clipboard.writeText(masterColorPrompt);
    setCopiedColor(true);
    setTimeout(() => setCopiedColor(false), 2000);
  };

  return (
    <div className="atelier-master-color-card">
      {/* Tiêu đề thanh công cụ và các nút thao tác nhanh */}
      <div className="atelier-master-color-header">
        <h4 className="atelier-master-color-title">
          <Palette size={16} color="#c084fc" />
          <span>KHUNG TO NHẤT: Bảng Quy Định Màu Sắc & Đồ Họa Cốt Lõi (Master Color Specifications)</span>
        </h4>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Nút khôi phục câu prompt mặc định */}
          <button
            type="button"
            className="atelier-matrix-dir-btn"
            onClick={() => setMasterColorPrompt(defaultMasterColorPrompt)}
            title="Khôi phục câu prompt màu mặc định được trích xuất từ ảnh mẫu"
            style={{ padding: '5px 10px', fontSize: '0.725rem' }}
          >
            <RotateCcw size={12} />
            <span>Khôi phục mặc định</span>
          </button>

          {/* Nút sao chép câu prompt màu vào bộ nhớ đệm */}
          <button
            type="button"
            className="atelier-matrix-dir-btn"
            onClick={handleCopyColor}
            title="Sao chép toàn bộ đặc tả màu sắc vào Clipboard"
            style={{
              padding: '5px 12px',
              fontSize: '0.725rem',
              color: copiedColor ? '#34d399' : '#c084fc',
              borderColor: copiedColor ? 'rgba(52, 211, 153, 0.4)' : undefined,
              background: copiedColor ? 'rgba(16, 185, 129, 0.15)' : undefined
            }}
          >
            {copiedColor ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
            <span>{copiedColor ? 'Đã sao chép!' : 'Sao chép khung màu'}</span>
          </button>
        </div>
      </div>

      {/* Lời giải thích ý nghĩa của khung đặc tả màu sắc */}
      <p style={{ margin: 0, fontSize: '0.775rem', color: 'var(--atl-text-secondary, #a39bc2)', lineHeight: 1.5 }}>
        Khung to nhất này đặt ở đầu câu Prompt để AI ép buộc toàn bộ 15 Frame hoạt họa bên dưới tuân thủ nghiêm ngặt cùng bảng màu, số màu và phong cách đổ bóng của nhân vật mẫu.
      </p>

      {/* Dải Swatches màu chủ đạo trích xuất từ mẫu pixel */}
      {topHexList && topHexList.length > 0 && (
        <div className="atelier-color-swatches-row">
          <span style={{ fontSize: '0.7rem', color: '#c084fc', fontWeight: 700, letterSpacing: '0.5px' }}>
            MÀU CHỦ ĐẠO ({Math.min(10, topHexList.length)}):
          </span>
          {topHexList.slice(0, 10).map((hex, i) => (
            <span key={i} className="atelier-color-swatch-chip">
              <span className="atelier-color-swatch-dot" style={{ background: hex }} />
              {hex}
            </span>
          ))}
        </div>
      )}

      {/* Hộp soạn thảo văn bản câu prompt màu sắc */}
      <textarea
        className="atelier-matrix-frame-textarea"
        rows={5}
        value={masterColorPrompt}
        onChange={(e) => setMasterColorPrompt(e.target.value)}
        placeholder="Nhập quy định bảng màu cốt lõi..."
        style={{ fontSize: '0.8rem', padding: '10px 12px', minHeight: '100px' }}
      />
    </div>
  );
}
