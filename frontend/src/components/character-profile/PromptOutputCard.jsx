// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState, useEffect } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Icon sao chép, thông báo sao chép, chuyển đổi ngôn ngữ dịch thuật
import { Copy, Check, Languages, Loader2 } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// translateText: Hàm gọi API dịch thuật offline cục bộ không tốn API key
import { translateText } from '../../utils/translationApi';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa các lớp CSS từ theme.css

/**
 * Thẻ hiển thị câu Prompt xuất bản (Positive Prompt hoặc Negative Prompt).
 * Tích hợp nút chuyển đổi xem bản dịch Tiếng Việt (mô hình AI Offline) bên cạnh nút Sao chép.
 * 
 * @param {Object} props Thuộc tính của component.
 * @param {string} props.title Tiêu đề của thẻ prompt.
 * @param {React.ReactNode} props.icon Biểu tượng icon hiển thị trước tiêu đề.
 * @param {string} props.titleColor Mã màu tiêu đề (ví dụ: #10b981 cho positive, #ef4444 cho negative).
 * @param {string} props.text Nội dung câu prompt tiếng Anh gốc hiển thị trong textarea.
 * @param {number} [props.rows=5] Số hàng của textarea.
 * @returns {React.ReactElement} Thẻ giao diện hiển thị prompt có nút dịch offline.
 */
export default function PromptOutputCard({
  title,
  icon,
  titleColor = 'var(--text-white)',
  text = '',
  rows = 5
}) {
  const [copied, setCopied] = useState(false);
  // Trạng thái bật/tắt xem bản dịch Tiếng Việt
  const [isViewingVietnamese, setIsViewingVietnamese] = useState(false);
  // Nội dung bản dịch tiếng Việt đã được lưu trữ
  const [vietnameseText, setVietnameseText] = useState('');
  // Trạng thái đang chạy mô hình dịch offline
  const [isTranslating, setIsTranslating] = useState(false);

  // Khi câu prompt tiếng Anh thay đổi (do sửa frame hoặc đổi đặc tả), đặt lại bản dịch
  useEffect(() => {
    setVietnameseText('');
    setIsViewingVietnamese(false);
  }, [text]);

  /**
   * Xử lý chuyển đổi ngôn ngữ (Toggle giữa Tiếng Anh gốc và Tiếng Việt).
   */
  const handleToggleLanguage = async () => {
    if (!text || !text.trim()) return;

    if (isViewingVietnamese) {
      // Đang xem tiếng Việt thì chuyển về xem tiếng Anh gốc
      setIsViewingVietnamese(false);
      return;
    }

    // Nếu đã có bản dịch trong bộ nhớ tạm thì hiển thị ngay lập tức
    if (vietnameseText) {
      setIsViewingVietnamese(true);
      return;
    }

    // Nếu chưa dịch thì gọi mô hình offline để dịch
    setIsTranslating(true);
    try {
      const translated = await translateText(text, 'en', 'vi');
      setVietnameseText(translated);
      setIsViewingVietnamese(true);
    } catch (err) {
      console.error('[PromptOutputCard] Lỗi khi dịch câu prompt:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  /**
   * Sao chép câu prompt tiếng Anh vào bộ nhớ tạm để sử dụng chuẩn mực cho các công cụ AI.
   */
  const handleCopy = () => {
    if (!text) return;
    // Luôn ưu tiên sao chép phiên bản tiếng Anh chuẩn AI để giữ nguyên chất lượng tạo ảnh
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="studio-prompt-output-card">
      <div className="studio-prompt-output-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <h4 style={{ color: titleColor, margin: 0 }}>
            {icon}
            {title}
          </h4>
          {isViewingVietnamese && (
            <span style={{
              fontSize: '0.65rem',
              padding: '1px 6px',
              borderRadius: '4px',
              background: 'rgba(56, 189, 248, 0.15)',
              color: '#38bdf8',
              fontWeight: 500
            }}>
              Bản dịch Tiếng Việt (Offline)
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Nút Dịch / Xem Tiếng Việt đặt ngay cạnh nút Sao chép */}
          <button
            type="button"
            className="btn-ghost-studio"
            onClick={handleToggleLanguage}
            disabled={isTranslating}
            title={isViewingVietnamese ? 'Xem lại câu prompt tiếng Anh chuẩn' : 'Dịch sang tiếng Việt (mô hình AI offline không cần mạng/API key)'}
            style={{
              color: isViewingVietnamese ? '#38bdf8' : 'var(--text-muted)',
              background: isViewingVietnamese ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
              borderColor: isViewingVietnamese ? 'rgba(56, 189, 248, 0.3)' : 'transparent'
            }}
          >
            {isTranslating ? (
              <Loader2 size={13} className="spin" />
            ) : (
              <Languages size={13} color={isViewingVietnamese ? '#38bdf8' : undefined} />
            )}
            <span>
              {isTranslating ? 'Đang dịch…' : isViewingVietnamese ? 'Xem Tiếng Anh' : 'Xem Tiếng Việt'}
            </span>
          </button>

          {/* Nút Sao chép */}
          <button
            type="button"
            className="btn-ghost-studio"
            onClick={handleCopy}
            title="Sao chép prompt tiếng Anh chuẩn để sử dụng"
            style={{ color: copied ? '#10b981' : 'var(--text-muted)' }}
          >
            {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
            <span>{copied ? 'Đã chép English!' : 'Sao chép'}</span>
          </button>
        </div>
      </div>

      <textarea
        className="studio-prompt-textarea"
        rows={rows}
        readOnly
        value={isViewingVietnamese && vietnameseText ? vietnameseText : text}
      />
    </div>
  );
}
