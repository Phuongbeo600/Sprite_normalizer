// 1. THƯ VIỆN NỀN TẢNG (React / JavaScript)
// React lưu bảng màu và màu bút hiện tại.
import { useState } from 'react';

// 2. THƯ VIỆN BÊN NGOÀI
// Không có phụ thuộc bên ngoài.

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// API trích xuất bảng màu hiện có.
import { analyzeSpriteColors } from './workspaceApi';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Kế thừa giao diện Workspace hiện có.

/**
 * Quản lý bảng màu cùng các quy tắc thêm, xóa và quét màu hiện có.
 * @returns {Object} Trạng thái bảng màu và các hàm cập nhật.
 */
export default function useWorkspacePalette() {
  // Danh sách các mã màu HEX của bảng màu sprite
  const [paletteColors, setPaletteColors] = useState([]);
  // Mã màu Foreground đang được chọn để vẽ
  const [activeColor, setActiveColor] = useState('#ffffff');
  // Trạng thái đang quét trích xuất bảng màu
  const [isPaletteLoading, setIsPaletteLoading] = useState(false);

  /**
   * Trích xuất bảng màu đầy đủ từ ảnh sprite qua backend
   *
   * @param {File|Blob} file Tệp ảnh sprite cần phân tích.
   * @returns {Promise<void>}
   */
  async function fetchPalette(file) {
    if (!file) return;
    try {
      setIsPaletteLoading(true);
      const data = await analyzeSpriteColors(file);
      const pal =
        data?.palette_metrics?.libresprite_palette ||
        data?.pixel_art_report?.palette?.libresprite_palette ||
        data?.pixel_art_report?.palette?.colors?.map((c) => c.hex) ||
        [];
      if (pal.length > 0) {
        setPaletteColors(pal);
        setActiveColor(pal[0]);
      }
    } catch (err) {
      console.warn('Không trích xuất được bảng màu tự động:', err);
    } finally {
      setIsPaletteLoading(false);
    }
  }


  /**
   * Thêm một mã màu mới vào danh sách bảng màu sprite hiện tại.
   *
   * @param {string} colorToAppend Mã màu HEX cần thêm (ví dụ '#ff0055').
   * @returns {void}
   */
  function handleAddPaletteColor(colorToAppend) {
    if (!colorToAppend || typeof colorToAppend !== 'string') return;
    const cleanHex = colorToAppend.trim();
    if (!/^#[0-9A-Fa-f]{3,8}$/.test(cleanHex)) return;

    let fullHex = cleanHex.toLowerCase();
    if (fullHex.length === 4) {
      fullHex = `#${fullHex[1]}${fullHex[1]}${fullHex[2]}${fullHex[2]}${fullHex[3]}${fullHex[3]}`;
    }

    setPaletteColors((prev) => [...prev, fullHex]);
    setActiveColor(fullHex);
  }


  /**
   * Xóa một ô màu khỏi bảng màu theo vị trí chỉ số (index).
   *
   * @param {number} indexToRemove Vị trí chỉ số màu cần xóa trong mảng màu.
   * @returns {void}
   */
  function handleDeletePaletteColor(indexToRemove) {
    if (paletteColors.length <= 1) return;
    if (indexToRemove < 0 || indexToRemove >= paletteColors.length) return;

    const nextColors = paletteColors.filter((_, idx) => idx !== indexToRemove);
    setPaletteColors(nextColors);

    // Tự động chuyển màu active sang ô lân cận để không bị mất dấu
    const nextIndex = Math.min(indexToRemove, nextColors.length - 1);
    if (nextIndex >= 0 && nextColors[nextIndex]) {
      setActiveColor(nextColors[nextIndex]);
    }
  }

  return { paletteColors, setPaletteColors, activeColor, setActiveColor, isPaletteLoading, fetchPalette, handleAddPaletteColor, handleDeletePaletteColor };
}
