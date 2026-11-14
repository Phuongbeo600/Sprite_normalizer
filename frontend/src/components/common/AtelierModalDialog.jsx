// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState, useEffect, useRef } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Biểu tượng đóng, dấu tích và cảnh báo
import { X, Sparkles, AlertTriangle, Check } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không phụ thuộc component nội bộ khác)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// pixel-identity.css: Định kiểu hộp thoại nổi chuẩn Dark Fantasy Atelier
import '../../styles/pixel-identity.css';

/**
 * Hộp thoại nổi nội bộ thay thế window.prompt và window.confirm (AtelierModalDialog).
 * Được thiết kế đồng bộ với phong cách Dark Fantasy Atelier (70% Tool + 30% Pixel Fantasy):
 * - Hỗ trợ nhập liệu trực tiếp (type="prompt") thay cho prompt() mặc định của trình duyệt.
 * - Hỗ trợ xác nhận hành động nguy hiểm hoặc đăng xuất (type="confirm") thay cho confirm().
 * - Bắt phím Enter để xác nhận và phím Escape để hủy bỏ tức thì.
 * 
 * @param {Object} props Thuộc tính của component.
 * @param {boolean} props.isOpen Trạng thái mở hộp thoại.
 * @param {'prompt'|'confirm'|'alert'} [props.type='confirm'] Loại hộp thoại.
 * @param {string} props.title Tiêu đề của hộp thoại.
 * @param {string} [props.message=''] Nội dung thông điệp mô tả.
 * @param {string} [props.defaultValue=''] Giá trị mặc định cho ô nhập liệu prompt.
 * @param {string} [props.placeholder=''] Gợi ý hiển thị trong ô nhập liệu.
 * @param {string} [props.confirmText='Xác nhận'] Nhãn nút xác nhận.
 * @param {string} [props.cancelText='Hủy bỏ'] Nhãn nút hủy bỏ.
 * @param {boolean} [props.isDestructive=false] Đánh dấu hành động nguy hiểm (nút màu đỏ).
 * @param {React.ReactNode} [props.icon] Biểu tượng hiển thị bên cạnh tiêu đề.
 * @param {Function} props.onConfirm Hàm xử lý khi người dùng xác nhận (nhận giá trị input nếu là prompt).
 * @param {Function} props.onCancel Hàm xử lý khi người dùng hủy bỏ hoặc đóng hộp thoại.
 * @returns {React.ReactElement|null} Hộp thoại nổi hiển thị trên màn hình.
 */
export default function AtelierModalDialog({
  isOpen,
  type = 'confirm',
  title,
  message = '',
  defaultValue = '',
  placeholder = '',
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  isDestructive = false,
  icon = null,
  onConfirm,
  onCancel
}) {
  // Trạng thái giá trị nhập liệu cho trường hợp prompt
  const [inputValue, setInputValue] = useState(defaultValue);
  const inputRef = useRef(null);

  // Cập nhật lại giá trị nhập liệu mỗi khi mở hộp thoại
  useEffect(() => {
    if (isOpen) {
      setInputValue(defaultValue);
      if (type === 'prompt') {
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 50);
      }
    }
  }, [isOpen, defaultValue, type]);

  // Lắng nghe sự kiện phím tắt toàn cục (Enter để xác nhận, Escape để đóng)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && type !== 'prompt') {
        e.preventDefault();
        onConfirm(inputValue);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm, inputValue, type]);

  if (!isOpen) return null;

  /**
   * Xử lý xác nhận form
   */
  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    onConfirm(inputValue);
  };

  return (
    <div
      className="atelier-dialog-overlay"
      onClick={(e) => {
        // Bấm ra ngoài vùng hộp thoại thì tự động đóng
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="atelier-dialog-box" role="dialog" aria-modal="true">
        {/* Phần đầu hộp thoại (Header) */}
        <div className="atelier-dialog-header">
          <div className="atelier-dialog-header-left">
            <div className={`atelier-dialog-icon-badge ${isDestructive ? 'danger' : 'primary'}`}>
              {icon ? icon : isDestructive ? <AlertTriangle size={20} /> : <Sparkles size={20} />}
            </div>
            <h3 className="atelier-dialog-title">{title}</h3>
          </div>

          <button
            type="button"
            className="atelier-dialog-close-btn"
            onClick={onCancel}
            title="Đóng hộp thoại (Phím Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Thân hộp thoại (Body) */}
        <form onSubmit={handleSubmit} className="atelier-dialog-body">
          {message && (
            <p className="atelier-dialog-message">
              {message}
            </p>
          )}

          {/* Ô nhập liệu nếu là dạng prompt */}
          {type === 'prompt' && (
            <input
              ref={inputRef}
              type="text"
              className="atelier-dialog-input"
              value={inputValue}
              placeholder={placeholder}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          )}

          {/* Thanh nút thao tác cuối hộp thoại (Actions) */}
          <div className="atelier-dialog-actions">
            {type !== 'alert' && (
              <button
                type="button"
                className="atelier-dialog-btn-cancel"
                onClick={onCancel}
              >
                {cancelText}
              </button>
            )}

            <button
              type="submit"
              className={`atelier-dialog-btn-confirm ${isDestructive ? 'danger' : 'primary'}`}
            >
              {isDestructive ? <Check size={14} strokeWidth={2.5} /> : null}
              <span>{confirmText}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
