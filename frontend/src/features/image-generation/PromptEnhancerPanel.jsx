// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT
// ========================================================
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ biểu tượng cho hộp gợi ý SSE và các nút thao tác
import { Sparkles, Square, Check, RotateCcw, X, RefreshCw, AlertCircle, Languages } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Services)
// ========================================================
// (Nhận toàn bộ dữ liệu và callback qua props từ ImageGeneration)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách từ image-gen-atelier.css đã nạp ở component cha

/**
 * Hộp hiển thị gợi ý nâng cao mô tả nhân vật chạy chữ trực tiếp qua SSE (Cách A).
 * Đặt ngay dưới ô nhập prompt để không làm mất nội dung người dùng đang soạn.
 *
 * @param {Object} props Thuộc tính điều khiển trạng thái luồng và hành động áp dụng.
 * @returns {React.ReactElement|null} Khung gợi ý SSE hoặc null khi chưa kích hoạt.
 */
export default function PromptEnhancerPanel({
  enhancing,
  enhancePhase,
  enhancePhaseMsg,
  suggestionText,
  enhanceError,
  translateTargetLang = 'vi',
  translating = false,
  onToggleTranslate,
  onStop,
  onApply,
  onRetry,
  onClose,
}) {
  if (!enhancing && !suggestionText && !enhanceError) {
    return null;
  }

  return (
    <div className="atelier-gen-enhancer-panel" role="region" aria-label="Gợi ý từ AI Local">
      <div className="atelier-gen-enhancer-header">
        <div className="atelier-gen-enhancer-title">
          <Sparkles size={14} color="#c084fc" />
          <span>Gợi ý từ AI Local (PromptEnhancer 7B)</span>
          {enhancing && (
            <span className="atelier-gen-enhancer-badge">
              <RefreshCw size={12} className="spin" />
              <span>{enhancePhaseMsg || (enhancePhase === 'loading_model' ? 'Đang nạp model...' : 'Đang sinh chữ...')}</span>
            </span>
          )}
        </div>

        <div className="atelier-gen-enhancer-actions">
          {enhancing ? (
            <button
              type="button"
              className="atelier-gen-enhancer-btn stop"
              onClick={onStop}
              title="Dừng nhận gợi ý ngay lập tức"
            >
              <Square size={12} /> Dừng
            </button>
          ) : (
            <>
              {suggestionText.trim() && (
                <>
                  <button
                    type="button"
                    className="atelier-gen-btn-translate"
                    onClick={onToggleTranslate}
                    disabled={translating}
                    title={translateTargetLang === 'vi'
                      ? 'Dịch gợi ý AI Local sang Tiếng Việt để đọc nhanh (lưu đệm RAM)'
                      : 'Đổi lại bản gốc Tiếng Anh của AI Local (lấy tức thì từ RAM)'}
                  >
                    {translating ? (
                      <>
                        <RefreshCw size={12} className="spin" />
                        <span>Đang dịch...</span>
                      </>
                    ) : (
                      <>
                        <Languages size={12} />
                        <span>{translateTargetLang === 'en' ? 'Dịch ➔ EN' : 'Dịch ➔ VI'}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="atelier-gen-enhancer-btn apply"
                    onClick={() => onApply(suggestionText.trim())}
                    disabled={translating}
                    title="Đưa nội dung gợi ý này lên ô Prompt chính"
                  >
                    <Check size={13} /> Áp dụng vào Prompt
                  </button>
                </>
              )}
              <button
                type="button"
                className="atelier-gen-enhancer-btn retry"
                onClick={onRetry}
                disabled={translating}
                title="Yêu cầu AI Local gợi ý lại phương án khác"
              >
                <RotateCcw size={12} /> Thử lại
              </button>
            </>
          )}

          <button
            type="button"
            className="atelier-gen-enhancer-btn close"
            onClick={onClose}
            title="Đóng hộp gợi ý"
          >
            <X size={13} /> Đóng
          </button>
        </div>
      </div>

      {enhanceError && (
        <div className="atelier-gen-enhancer-error">
          <AlertCircle size={14} />
          <span>{enhanceError}</span>
        </div>
      )}

      {(suggestionText || enhancing) && (
        <div className="atelier-gen-enhancer-body">
          <span>
            {suggestionText || (enhancePhase === 'loading_model'
              ? 'Đang khởi chạy llama-server và nạp mô hình 4.3 GB vào RAM (chỉ mất vài giây ở lần đầu)...'
              : 'Đang chờ AI Local bắt đầu viết gợi ý...')}
          </span>
          {enhancing && <span className="atelier-gen-enhancer-cursor" aria-hidden="true" />}
        </div>
      )}
    </div>
  );
}
