// 1. THƯ VIỆN NỀN TẢNG REACT
// useRef: Giữ tọa độ ban đầu trong một lần kéo đường biên.
import { useRef } from 'react';

// 2. THƯ VIỆN BÊN NGOÀI
// Không dùng thư viện bên ngoài.

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// moveGridCut: Ràng buộc đường cắt trong ảnh và giữa hai đường lân cận.
import { moveGridCut } from '../sheetGrid';

// 4. ĐỊNH DẠNG GIAO DIỆN VÀ CẤU HÌNH
// Dùng các lớp trong workspace-atelier.css do màn hình cha nạp.

/**
 * Hiển thị các đường biên kéo được trên đúng hệ tọa độ ảnh nguồn.
 * @param {Object} props Thuộc tính của lưới tương tác.
 * @param {{x: number[], y: number[]}} props.cuts Tọa độ đường cắt theo pixel gốc.
 * @param {{width: number, height: number}} props.dimensions Kích thước ảnh nguồn.
 * @param {boolean} props.disabled Khóa thao tác trong khi xử lý ảnh.
 * @param {Function} props.onChange Nhận lưới mới khi kéo hoặc nhấn phím.
 * @returns {React.ReactElement} Lớp phủ đường cắt không ảnh hưởng bố cục ảnh.
 */
export default function ManualSheetGrid({ cuts, dimensions, disabled, onChange }) {
  const pointer = useRef(null);

  /**
   * Đổi tọa độ màn hình sang pixel ảnh, độc lập với mức zoom hiện tại.
   * @param {React.PointerEvent} event Sự kiện kéo đường cắt.
   * @param {'x'|'y'} axis Trục đang chỉnh.
   * @returns {number} Tọa độ pixel của con trỏ trong ảnh.
   */
  function imagePosition(event, axis) {
    const bounds = event.currentTarget.parentElement.getBoundingClientRect();
    return axis === 'x'
      ? (event.clientX - bounds.left) * dimensions.width / bounds.width
      : (event.clientY - bounds.top) * dimensions.height / bounds.height;
  }

  /**
   * Cập nhật một đường biên và giữ nguyên các đường còn lại.
   * @param {'x'|'y'} axis Trục cần chỉnh.
   * @param {number} index Chỉ số đường biên.
   * @param {number} position Vị trí theo pixel ảnh.
   * @returns {void}
   */
  function update(axis, index, position) {
    const extent = axis === 'x' ? dimensions.width : dimensions.height;
    onChange({ ...cuts, [axis]: moveGridCut(cuts[axis], index, position, extent) });
  }

  return (
    <div className="atelier-manual-grid" aria-label="Đường cắt tùy chỉnh">
      {['x', 'y'].flatMap((axis) => cuts[axis].map((position, index) => {
        const vertical = axis === 'x';
        const extent = vertical ? dimensions.width : dimensions.height;
        const label = `${vertical ? 'Đường dọc' : 'Đường ngang'} ${index + 1}`;
        return (
          <button
            key={`${axis}-${index}`}
            type="button"
            role="slider"
            aria-label={label}
            aria-orientation={vertical ? 'horizontal' : 'vertical'}
            aria-valuemin={index === 0 ? 0 : cuts[axis][index - 1] + 1}
            aria-valuemax={index === cuts[axis].length - 1 ? extent : cuts[axis][index + 1] - 1}
            aria-valuenow={position}
            title={`${label}: ${position} px · Kéo hoặc dùng phím mũi tên`}
            disabled={disabled}
            className={`atelier-cut-handle ${vertical ? 'is-vertical' : 'is-horizontal'}`}
            style={vertical ? { left: `${position / extent * 100}%` } : { top: `${position / extent * 100}%` }}
            onPointerDown={(event) => {
              if (event.button !== 0 || disabled) return;
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.focus({ preventScroll: true });
              pointer.current = { axis, index, start: imagePosition(event, axis), position };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!pointer.current || pointer.current.axis !== axis || pointer.current.index !== index) return;
              event.stopPropagation();
              update(axis, index, pointer.current.position + imagePosition(event, axis) - pointer.current.start);
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
              pointer.current = null;
              if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onLostPointerCapture={() => { pointer.current = null; }}
            onPointerCancel={() => { pointer.current = null; }}
            onKeyDown={(event) => {
              const backward = vertical ? 'ArrowLeft' : 'ArrowUp';
              const forward = vertical ? 'ArrowRight' : 'ArrowDown';
              if (event.key !== backward && event.key !== forward) return;
              event.preventDefault();
              event.stopPropagation();
              update(axis, index, position + (event.key === backward ? -1 : 1) * (event.shiftKey ? 10 : 1));
            }}
          />
        );
      }))}
    </div>
  );
}
