// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
import {
  Pencil,
  PaintBucket,
  Pipette,
  Eraser,
  Hand,
  Grid,
  Undo2,
  Redo2,
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Schemas)
// ========================================================
// (Không có phụ thuộc nội bộ)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa định dạng từ workspace-atelier.css

/**
 * Thanh công cụ vẽ pixel art (Drawing Toolbar) chuẩn phong cách Pixel Art Studio.
 * Cung cấp các công cụ kinh điển:
 * - Bút vẽ (Pencil): Vẽ từng ô pixel theo kích thước cọ.
 * - Thùng sơn (Paint Bucket): Đổ màu cho toàn bộ mảng pixel liên thông (Flood Fill).
 * - Hút màu (Eyedropper / Pipette): Chọn nhanh màu từ bất kỳ pixel nào trên canvas.
 * - Tẩy xóa (Eraser): Xóa pixel trở về độ trong suốt.
 * - Rê khung (Hand / Pan): Kéo trượt điều hướng không gian làm việc.
 * - Lưới ô pixel (Pixel Grid): Bật/tắt đường kẻ lưới khi zoom lớn.
 * - Hoàn tác / Làm lại (Undo / Redo): Quay lại hoặc làm lại các bước vẽ.
 *
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {string} props.activeTool Công cụ đang kích hoạt ('pencil' | 'bucket' | 'eyedropper' | 'eraser' | 'pan').
 * @param {Function} props.onSelectTool Hàm chuyển đổi công cụ vẽ.
 * @param {number} props.brushSize Kích thước đầu bút vẽ (1, 2, 3 px).
 * @param {Function} props.onChangeBrushSize Hàm thay đổi kích thước cọ.
 * @param {boolean} props.showPixelGrid Trạng thái bật/tắt lưới ô pixel.
 * @param {Function} props.onTogglePixelGrid Hàm bật/tắt lưới pixel.
 * @param {boolean} props.canUndo Khả năng hoàn tác bước vẽ trước.
 * @param {boolean} props.canRedo Khả năng làm lại bước vẽ vừa hoàn tác.
 * @param {Function} props.onUndo Hàm kích hoạt hoàn tác (Undo).
 * @param {Function} props.onRedo Hàm kích hoạt làm lại (Redo).
 * @param {boolean} [props.disabled=false] Vô hiệu hóa thanh công cụ khi chưa có ảnh.
 * @returns {React.ReactElement} Giao diện thanh công cụ vẽ.
 */
export default function DrawingToolbar({
  activeTool = 'pan',
  onSelectTool,
  brushSize = 1,
  onChangeBrushSize,
  showPixelGrid = true,
  onTogglePixelGrid,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  disabled = false,
}) {
  const tools = [
    { id: 'pencil', label: 'Bút vẽ (Pencil)', icon: Pencil, shortcut: 'B' },
    { id: 'bucket', label: 'Thùng sơn (Bucket Fill)', icon: PaintBucket, shortcut: 'G' },
    { id: 'eyedropper', label: 'Hút màu (Eyedropper)', icon: Pipette, shortcut: 'I' },
    { id: 'eraser', label: 'Cục tẩy (Eraser)', icon: Eraser, shortcut: 'E' },
    { id: 'pan', label: 'Rê khung nhìn (Hand Pan)', icon: Hand, shortcut: 'H' },
  ];

  return (
    <div className="atelier-drawing-toolbar" role="toolbar" aria-label="Thanh công cụ vẽ Pixel Art">
      {/* 1. Nhóm các công cụ thao tác trực tiếp trên canvas */}
      <div className="atelier-tool-group">
        {tools.map((t) => {
          const IconComponent = t.icon;
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              type="button"
              className={`atelier-tool-btn ${isActive ? 'is-active' : ''}`}
              title={`${t.label} [${t.shortcut}]`}
              disabled={disabled}
              onClick={() => onSelectTool(t.id)}
            >
              <IconComponent size={16} />
            </button>
          );
        })}
      </div>

      <div className="atelier-tool-divider" />

      {/* 2. Cỡ đầu bút (Brush size: 1px, 2px, 3px) */}
      <div className="atelier-brush-size-group" title="Kích thước nét bút">
        {[1, 2, 3].map((size) => (
          <button
            key={size}
            type="button"
            className={`atelier-brush-btn ${brushSize === size ? 'is-active' : ''}`}
            disabled={disabled || activeTool === 'pan' || activeTool === 'eyedropper'}
            onClick={() => onChangeBrushSize(size)}
            title={`Nét vẽ ${size}px`}
          >
            {size}px
          </button>
        ))}
      </div>

      <div className="atelier-tool-divider" />

      {/* 3. Bật/tắt đường lưới ô pixel (Pixel Grid) */}
      <button
        type="button"
        className={`atelier-tool-btn ${showPixelGrid ? 'is-active' : ''}`}
        title="Bật/Tắt đường lưới ô pixel"
        disabled={disabled}
        onClick={onTogglePixelGrid}
      >
        <Grid size={16} />
      </button>

      <div className="atelier-tool-divider" />

      {/* 4. Hoàn tác (Undo) và Làm lại (Redo) */}
      <div className="atelier-history-group">
        <button
          type="button"
          className="atelier-tool-btn"
          title="Hoàn tác (Ctrl+Z)"
          disabled={disabled || !canUndo}
          onClick={onUndo}
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          className="atelier-tool-btn"
          title="Làm lại (Ctrl+Y)"
          disabled={disabled || !canRedo}
          onClick={onRedo}
        >
          <Redo2 size={15} />
        </button>
      </div>
    </div>
  );
}
