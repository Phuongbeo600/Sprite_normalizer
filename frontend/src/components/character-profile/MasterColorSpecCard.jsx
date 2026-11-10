// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Biểu tượng bảng màu, sao chép và hoàn tất
import { Palette, Copy, Check } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không phụ thuộc component nội bộ khác)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa các lớp CSS từ theme.css

/**
 * Khung To Nhất: Bảng Quy Định Màu Sắc & Đồ Họa Cốt Lõi (Master Color Specifications Card).
 * Cho phép người dùng xem dải ô màu chủ đạo, chỉnh sửa câu prompt quy chuẩn màu
 * và khôi phục về giá trị mặc định được tính toán từ ảnh mẫu.
 * 
 * @param {Object} props Thuộc tính của component.
 * @param {string} props.masterColorPrompt Nội dung câu prompt màu sắc hiện tại.
 * @param {Function} props.setMasterColorPrompt Hàm cập nhật nội dung prompt màu sắc.
 * @param {string} props.defaultMasterColorPrompt Nội dung prompt màu sắc mặc định.
 * @param {Array<string>} [props.topHexList=[]] Danh sách mã màu HEX chủ đạo.
 * @returns {React.ReactElement} Thẻ giao diện khung màu sắc cốt lõi.
 */
export default function MasterColorSpecCard({
  masterColorPrompt,
  setMasterColorPrompt,
  defaultMasterColorPrompt,
  topHexList = []
}) {
  const [copiedColor, setCopiedColor] = useState(false);

  /**
   * Sao chép khung màu vào bộ nhớ tạm.
   */
  const handleCopyColor = () => {
    if (!masterColorPrompt) return;
    navigator.clipboard.writeText(masterColorPrompt);
    setCopiedColor(true);
    setTimeout(() => setCopiedColor(false), 2000);
  };

  return (
    <div style={{
      marginTop: '16px',
      padding: '14px',
      background: 'rgba(139, 92, 246, 0.05)',
      border: '1px solid var(--accent-purple)',
      borderRadius: '8px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <h4 style={{ margin: 0, color: 'var(--text-white)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
          <Palette size={16} color="var(--accent-purple)" />
          KHUNG TO NHẤT: Bảng Quy Định Màu Sắc & Đồ Họa Cốt Lõi (Master Color Specifications)
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn-ghost-studio"
            onClick={() => setMasterColorPrompt(defaultMasterColorPrompt)}
            style={{ fontSize: '0.725rem' }}
            title="Khôi phục câu prompt màu mặc định đo từ ảnh mẫu"
          >
            Khôi phục mặc định
          </button>
          <button
            type="button"
            className="btn-ghost-studio"
            onClick={handleCopyColor}
            style={{ color: copiedColor ? '#10b981' : 'var(--text-highlight)', fontSize: '0.725rem' }}
          >
            {copiedColor ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            {copiedColor ? 'Đã chép!' : 'Sao chép khung màu'}
          </button>
        </div>
      </div>

      <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Khung to nhất này đặt ở đầu câu Prompt để AI ép buộc toàn bộ 15 Frame hoạt họa bên dưới tuân thủ nghiêm ngặt cùng bảng màu, số màu và phong cách đổ bóng của nhân vật mẫu.
      </p>

      {/* Dải Swatches màu nếu có dữ liệu đo được */}
      {topHexList && topHexList.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600 }}>MÀU CHỦ ĐẠO:</span>
          {topHexList.slice(0, 10).map((hex, i) => (
            <span
              key={i}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '2px 6px',
                borderRadius: '4px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                fontSize: '0.7rem',
                fontFamily: 'monospace'
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 2, background: hex, display: 'inline-block' }} />
              {hex}
            </span>
          ))}
        </div>
      )}

      <textarea
        className="studio-prompt-textarea"
        rows={5}
        value={masterColorPrompt}
        onChange={(e) => setMasterColorPrompt(e.target.value)}
        style={{ borderRadius: '6px', border: '1px solid var(--border-card)', background: '#0a0f1d' }}
      />
    </div>
  );
}
