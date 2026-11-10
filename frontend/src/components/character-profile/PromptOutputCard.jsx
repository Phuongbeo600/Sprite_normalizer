// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Icon sao chép và thông báo sao chép thành công
import { Copy, Check } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không phụ thuộc component nội bộ khác)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa các lớp CSS từ theme.css

/**
 * Thẻ hiển thị câu Prompt xuất bản (Positive Prompt hoặc Negative Prompt)
 * Có tích hợp nút sao chép nhanh vào Clipboard kèm trạng thái thông báo trực quan.
 * 
 * @param {Object} props Thuộc tính của component.
 * @param {string} props.title Tiêu đề của thẻ prompt.
 * @param {React.ReactNode} props.icon Biểu tượng icon hiển thị trước tiêu đề.
 * @param {string} props.titleColor Mã màu tiêu đề (ví dụ: #10b981 cho positive, #ef4444 cho negative).
 * @param {string} props.text Nội dung câu prompt hiển thị trong textarea.
 * @param {number} [props.rows=5] Số hàng của textarea.
 * @returns {React.ReactElement} Thẻ giao diện hiển thị prompt.
 */
export default function PromptOutputCard({
  title,
  icon,
  titleColor = 'var(--text-white)',
  text = '',
  rows = 5
}) {
  const [copied, setCopied] = useState(false);

  /**
   * Sao chép câu prompt vào bộ nhớ tạm.
   */
  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="studio-prompt-output-card">
      <div className="studio-prompt-output-header">
        <h4 style={{ color: titleColor }}>
          {icon}
          {title}
        </h4>
        <button
          type="button"
          className="btn-ghost-studio"
          onClick={handleCopy}
          style={{ color: copied ? '#10b981' : 'var(--text-muted)' }}
        >
          {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
          {copied ? 'Đã chép!' : 'Sao chép'}
        </button>
      </div>
      <textarea
        className="studio-prompt-textarea"
        rows={rows}
        readOnly
        value={text}
      />
    </div>
  );
}
