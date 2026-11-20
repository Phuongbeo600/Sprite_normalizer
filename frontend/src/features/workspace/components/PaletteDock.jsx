// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState, useEffect, useMemo } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
import { Palette, RefreshCw, Check, Copy, Plus, Trash2 } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Schemas)
// ========================================================
// (Không có phụ thuộc nội bộ)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa định dạng từ workspace-atelier.css

/**
 * Cột hiển thị và chỉnh sửa bảng màu (Palette Dock) chuẩn phong cách Pixel Art Studio.
 * Cho phép người dùng:
 * - Xem danh sách đầy đủ 100% các ô màu (swatches) trích xuất từ sprite.
 * - Chọn màu Foreground (màu vẽ) và điều chỉnh mã màu HEX linh hoạt.
 * - Quét lại bảng màu tự động khi ảnh thay đổi.
 *
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {string[]} props.paletteColors Danh sách các mã màu HEX của sprite.
 * @param {string} props.activeColor Mã màu HEX đang được chọn để vẽ.
 * @param {Function} props.onSelectActiveColor Hàm cập nhật màu vẽ đang kích hoạt.
 * @param {Function} [props.onAddColor] Hàm thêm mã màu mới vào bảng màu.
 * @param {Function} [props.onDeleteColor] Hàm xóa một ô màu khỏi bảng màu theo chỉ số index.
 * @param {boolean} [props.isLoading=false] Trạng thái đang tải hoặc quét bảng màu.
 * @param {Function} [props.onRescanPalette] Hàm kích hoạt quét lại bảng màu từ ảnh hiện tại.
 * @returns {React.ReactElement} Giao diện cột Palette Dock.
 */
export default function PaletteDock({
  paletteColors = [],
  activeColor = '#000000',
  onSelectActiveColor,
  onAddColor,
  onDeleteColor,
  isLoading = false,
  onRescanPalette,
}) {
  // Chỉ số ô màu đang được chọn trong bảng màu
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Giá trị chuỗi HEX nhập tay trong ô input
  const [hexInputText, setHexInputText] = useState(activeColor);
  // Trạng thái đã sao chép mã màu vào clipboard
  const [copied, setCopied] = useState(false);

  // Chuẩn hóa và lọc danh sách mã màu HEX hợp lệ
  const safeColors = useMemo(() => {
    return Array.isArray(paletteColors)
      ? paletteColors
          .map((c) => (typeof c === 'string' ? c : c?.hex_code || c?.hex || ''))
          .filter((c) => typeof c === 'string' && c.startsWith('#'))
      : [];
  }, [paletteColors]);

  // Đồng bộ giá trị input HEX khi activeColor từ ngoài thay đổi (ví dụ khi hút màu)
  useEffect(() => {
    if (typeof activeColor === 'string') {
      setHexInputText(activeColor);
      const idx = safeColors.findIndex(
        (c) => typeof c === 'string' && c.toLowerCase() === activeColor.toLowerCase()
      );
      if (idx !== -1) {
        setSelectedIndex(idx);
      } else if (selectedIndex >= safeColors.length && safeColors.length > 0) {
        setSelectedIndex(safeColors.length - 1);
      }
    }
  }, [activeColor, safeColors, selectedIndex]);

  /**
   * Xử lý khi người dùng bấm thêm màu vào bảng màu
   */
  const handleAddColor = () => {
    const targetColor =
      hexInputText && /^#[0-9A-Fa-f]{3,8}$/.test(hexInputText) ? hexInputText : activeColor;
    if (onAddColor && targetColor) {
      onAddColor(targetColor);
    }
  };

  /**
   * Xử lý khi người dùng bấm xóa ô màu đang chọn
   */
  const handleDeleteColor = () => {
    if (onDeleteColor && selectedIndex >= 0 && safeColors.length > 1) {
      onDeleteColor(selectedIndex);
    }
  };

  /**
   * Xử lý khi người dùng click vào một ô màu trong bảng màu
   */
  const handleSwatchClick = (color, index) => {
    const hex = typeof color === 'string' ? color : color?.hex_code || color?.hex || '#ffffff';
    setSelectedIndex(index);
    setHexInputText(hex);
    if (onSelectActiveColor) {
      onSelectActiveColor(hex);
    }
  };

  /**
   * Xử lý khi người dùng đổi màu qua hộp chọn màu HTML5 Color Picker
   */
  const handleColorPickerChange = (e) => {
    const newHex = e.target.value;
    setHexInputText(newHex);
    if (onSelectActiveColor) {
      onSelectActiveColor(newHex);
    }
  };

  /**
   * Xử lý khi người dùng gõ trực tiếp mã HEX vào ô input
   */
  const handleHexInputChange = (e) => {
    const val = e.target.value;
    setHexInputText(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      if (onSelectActiveColor) {
        onSelectActiveColor(val);
      }
    }
  };

  /**
   * Sao chép mã màu HEX hiện tại vào bộ nhớ tạm
   */
  const handleCopyHex = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(activeColor);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <aside className="atelier-palette-dock" aria-label="Bảng màu Sprite Studio">
      {/* 1. Tiêu đề bảng màu & Số lượng màu */}
      <div className="atelier-palette-header">
        <div className="atelier-palette-title-wrap">
          <Palette size={16} className="atelier-palette-icon" />
          <h3 className="atelier-palette-title">BẢNG MÀU SPRITE</h3>
        </div>
        <div className="atelier-palette-actions">
          <span className="atelier-palette-badge" title="Tổng số màu trích xuất">
            {safeColors.length} màu
          </span>
          {onRescanPalette && (
            <button
              type="button"
              className="atelier-palette-btn-icon"
              title="Quét lại bảng màu từ ảnh hiện tại"
              disabled={isLoading}
              onClick={onRescanPalette}
            >
              <RefreshCw size={13} className={isLoading ? 'atelier-spin' : ''} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Lưới các ô màu (Swatches Grid) */}
      <div className="atelier-palette-swatches-scroll">
        {safeColors.length > 0 ? (
          <div className="atelier-palette-grid">
            {safeColors.map((color, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={`${color}-${index}`}
                  type="button"
                  className={`atelier-swatch-cell ${isSelected ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  title={`${color} [Idx-${index}]`}
                  onClick={() => handleSwatchClick(color, index)}
                >
                  {isSelected && <span className="atelier-swatch-dot" />}
                </button>
              );
            })}
            {/* Ô thêm màu nhanh dạng Libresprite/Aseprite ở cuối lưới */}
            {onAddColor && (
              <button
                type="button"
                className="atelier-swatch-add-cell"
                title={`Thêm màu ${activeColor} vào bảng màu`}
                disabled={isLoading}
                onClick={handleAddColor}
              >
                <Plus size={12} />
              </button>
            )}
          </div>
        ) : (
          <div className="atelier-palette-empty">
            <p>Chưa có bảng màu. Hãy mở ảnh sprite để tự động trích xuất bảng màu.</p>
          </div>
        )}
      </div>

      {/* Khoảng đệm co giãn đẩy hộp chọn màu xuống góc dưới giống bảng vẽ chuyên nghiệp */}
      <div style={{ flex: 1, minHeight: '8px' }} />

      {/* 3. Khung điều khiển màu đang kích hoạt (Active Color Controls) */}
      <div className="atelier-palette-active-card">
        <div className="atelier-palette-active-row">
          {/* Ô swatch màu kèm Color Picker ẩn */}
          <label
            className="atelier-active-swatch-box"
            style={{ backgroundColor: activeColor }}
            title="Bấm để mở hộp chọn màu tự do"
          >
            <input
              type="color"
              className="atelier-hidden-color-input"
              value={activeColor.startsWith('#') && activeColor.length === 7 ? activeColor : '#000000'}
              onChange={handleColorPickerChange}
              disabled={isLoading}
            />
          </label>

          {/* Ô nhập mã HEX & Chỉ số màu */}
          <div className="atelier-active-details">
            <div className="atelier-active-input-wrap">
              <input
                type="text"
                className="atelier-active-hex-input"
                value={hexInputText}
                maxLength={9}
                onChange={handleHexInputChange}
                title="Nhập mã màu HEX"
                disabled={isLoading}
              />
              <button
                type="button"
                className="atelier-btn-copy-hex"
                title="Sao chép mã HEX"
                onClick={handleCopyHex}
              >
                {copied ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
              </button>
              {onAddColor && (
                <button
                  type="button"
                  className="atelier-palette-btn-action add"
                  title="Thêm màu này vào bảng màu"
                  disabled={isLoading}
                  onClick={handleAddColor}
                >
                  <Plus size={13} />
                </button>
              )}
            </div>

            <div className="atelier-active-footer-row">
              <span className="atelier-active-index-pill">
                Idx-{selectedIndex >= 0 ? selectedIndex : 0}
              </span>
              {onDeleteColor && (
                <button
                  type="button"
                  className="atelier-palette-btn-action delete"
                  title={safeColors.length <= 1 ? 'Không thể xóa màu cuối cùng' : 'Xóa ô màu này khỏi bảng màu'}
                  disabled={isLoading || safeColors.length <= 1 || selectedIndex < 0}
                  onClick={handleDeleteColor}
                >
                  <Trash2 size={11} />
                  <span>Xóa ô</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
