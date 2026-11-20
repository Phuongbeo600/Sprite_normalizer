// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// (Không có phụ thuộc bên ngoài)

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Schemas)
// ========================================================
// (Không có phụ thuộc nội bộ)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa định dạng từ workspace-atelier.css

/**
 * Chuyển đổi chuỗi mã HEX sang mảng 4 kênh màu RGBA [R, G, B, A] (0-255).
 *
 * @param {string} hex Mã HEX (ví dụ: '#322334', '#ffffff').
 * @returns {number[]} Mảng số nguyên [r, g, b, a].
 */
function hexToRgbaArray(hex) {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return [0, 0, 0, 255];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
}

/**
 * Bàn vẽ tương tác Pixel Art (Interactive Pixel Canvas) chuẩn phong cách Pixel Art Studio.
 * Cung cấp:
 * - Hiển thị ảnh sprite tại kích thước logic gốc (1 pixel sprite = 1 pixel canvas).
 * - Phóng to thu nhỏ với chế độ khử nhòe (image-rendering: pixelated).
 * - Lưới ô pixel (Pixel Grid) tự động hiển thị khi zoom >= 4x.
 * - Công cụ Bút vẽ (Pencil), Tẩy xóa (Eraser), Thùng sơn loang mảng (Bucket Flood Fill), Hút màu (Eyedropper).
 * - Bộ đệm lịch sử Hoàn tác (Undo) và Làm lại (Redo) 30 bước.
 */
const PixelCanvas = forwardRef(function PixelCanvas(
  {
    imageUrl,
    zoom = 1,
    activeTool = 'pan',
    activeColor = '#000000',
    brushSize = 1,
    showPixelGrid = true,
    onColorPicked,
    onImageModified,
    onHistoryChange,
    onPanStart,
    onPanMove,
    onPanEnd,
  },
  ref
) {
  // Thẻ Canvas chính lưu trữ dữ liệu pixel ảnh
  const canvasRef = useRef(null);
  // Thẻ Canvas phụ vẽ lưới ô pixel khi phóng to
  const gridCanvasRef = useRef(null);
  // Cờ đánh dấu chuột đang nhấn để vẽ nét liền
  const isPointerDownRef = useRef(false);
  // Tọa độ pixel vẽ cuối cùng để tránh vẽ lặp lại cùng một pixel
  const lastPixelRef = useRef({ x: -1, y: -1 });

  // Danh sách lịch sử các bước vẽ (mỗi phần tử là một ImageData)
  const historyRef = useRef([]);
  // Vị trí con trỏ lịch sử hiện tại
  const historyIndexRef = useRef(-1);
  // Lưu URL blob do chính PixelCanvas tự xuất ra để tránh tải lại ảnh lặp
  const lastSelfGeneratedUrlRef = useRef(null);
  // Cờ ghi nhận đang kéo rê khung nhìn (Pan)
  const isPanningRef = useRef(false);

  // Kích thước logic thực tế của ảnh (width, height)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  /**
   * Cập nhật trạng thái hoàn tác/làm lại cho component cha
   */
  const notifyHistoryChange = useCallback(() => {
    if (onHistoryChange) {
      onHistoryChange({
        canUndo: historyIndexRef.current > 0,
        canRedo: historyIndexRef.current < historyRef.current.length - 1,
      });
    }
  }, [onHistoryChange]);

  /**
   * Lưu một bản chụp ImageData mới vào ngăn xếp lịch sử
   */
  const pushHistorySnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Xóa các bước redo phía sau nếu người dùng thực hiện vẽ mới
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(snapshot);
    if (historyRef.current.length > 30) {
      historyRef.current.shift();
    }
    historyIndexRef.current = historyRef.current.length - 1;
    notifyHistoryChange();

    // Thông báo cho component cha về ảnh đã chỉnh sửa
    if (onImageModified) {
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          lastSelfGeneratedUrlRef.current = url;
          onImageModified(blob, url);
        }
      }, 'image/png');
    }
  }, [notifyHistoryChange, onImageModified]);

  /**
   * Tải ảnh nguồn vào Canvas và khởi tạo bước lịch sử đầu tiên
   */
  useEffect(() => {
    if (!imageUrl) return;

    // Nếu imageUrl chính là URL do bàn vẽ vừa tự sinh ra, không tải lại ảnh và không xóa lịch sử
    if (imageUrl === lastSelfGeneratedUrlRef.current) {
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      setDimensions({ width: img.naturalWidth, height: img.naturalHeight });

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      // Lưu trạng thái ảnh gốc ban đầu
      const initialSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
      historyRef.current = [initialSnapshot];
      historyIndexRef.current = 0;
      notifyHistoryChange();
    };
    img.src = imageUrl;
  }, [imageUrl, notifyHistoryChange]);

  /**
   * Vẽ lưới ô pixel (Pixel Grid Overlay) khi phóng to lớn hơn hoặc bằng 4x
   */
  useEffect(() => {
    const gridCanvas = gridCanvasRef.current;
    if (!gridCanvas || dimensions.width === 0 || dimensions.height === 0) return;

    gridCanvas.width = dimensions.width * zoom;
    gridCanvas.height = dimensions.height * zoom;

    const ctx = gridCanvas.getContext('2d');
    ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

    if (zoom >= 4 && showPixelGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1;

      // Kẻ các đường dọc
      for (let x = 0; x <= dimensions.width; x++) {
        const posX = Math.floor(x * zoom) + 0.5;
        ctx.beginPath();
        ctx.moveTo(posX, 0);
        ctx.lineTo(posX, gridCanvas.height);
        ctx.stroke();
      }

      // Kẻ các đường ngang
      for (let y = 0; y <= dimensions.height; y++) {
        const posY = Math.floor(y * zoom) + 0.5;
        ctx.beginPath();
        ctx.moveTo(0, posY);
        ctx.lineTo(gridCanvas.width, posY);
        ctx.stroke();
      }
    }
  }, [dimensions, zoom, showPixelGrid]);

  /**
   * Thuật toán đổ màu loang mảng liên thông (Queue-based Flood Fill trên 32-bit Array)
   */
  const performFloodFill = (startX, startY, fillRgba) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;
    const data32 = new Uint32Array(imgData.data.buffer);

    const startIndex = startY * w + startX;
    const targetColor32 = data32[startIndex];
    const fillColor32 =
      (fillRgba[3] << 24) | (fillRgba[2] << 16) | (fillRgba[1] << 8) | fillRgba[0];

    if (targetColor32 === fillColor32) return;

    // Hàng đợi tọa độ BFS
    const queue = [startX, startY];
    while (queue.length > 0) {
      const cy = queue.pop();
      const cx = queue.pop();

      const idx = cy * w + cx;
      if (data32[idx] !== targetColor32) continue;

      data32[idx] = fillColor32;

      if (cx > 0 && data32[idx - 1] === targetColor32) queue.push(cx - 1, cy);
      if (cx < w - 1 && data32[idx + 1] === targetColor32) queue.push(cx + 1, cy);
      if (cy > 0 && data32[idx - w] === targetColor32) queue.push(cx, cy - 1);
      if (cy < h - 1 && data32[idx + w] === targetColor32) queue.push(cx, cy + 1);
    }

    ctx.putImageData(imgData, 0, 0);
    pushHistorySnapshot();
  };

  /**
   * Tính toán tọa độ pixel logic từ sự kiện con trỏ chuột
   */
  const getPixelCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: -1, y: -1 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    const x = Math.floor((clientX - rect.left) / zoom);
    const y = Math.floor((clientY - rect.top) / zoom);
    return {
      x: Math.max(0, Math.min(canvas.width - 1, x)),
      y: Math.max(0, Math.min(canvas.height - 1, y)),
    };
  };

  /**
   * Thực hiện vẽ hoặc xóa một điểm pixel tại (px, py)
   */
  const applyBrushAt = (px, py) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const offset = Math.floor(brushSize / 2);

    if (activeTool === 'pencil') {
      ctx.fillStyle = activeColor;
      ctx.fillRect(px - offset, py - offset, brushSize, brushSize);
    } else if (activeTool === 'eraser') {
      ctx.clearRect(px - offset, py - offset, brushSize, brushSize);
    }
  };

  /**
   * Xử lý khi nhấn chuột (Pointer Down)
   */
  const handlePointerDown = (e) => {
    if (activeTool === 'pan' || e.button === 1) {
      e.stopPropagation();
      isPanningRef.current = true;
      if (onPanStart) onPanStart(e);
      return;
    }

    if (e.button !== 0) return;

    const { x, y } = getPixelCoords(e);
    if (x < 0 || y < 0) return;

    if (activeTool === 'eyedropper') {
      // Hút màu từ pixel dưới trỏ chuột
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const pixel = ctx.getImageData(x, y, 1, 1).data;
      if (pixel[3] > 0) {
        const hex =
          '#' +
          ((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2])
            .toString(16)
            .slice(1);
        if (onColorPicked) onColorPicked(hex);
      }
      return;
    }

    if (activeTool === 'bucket') {
      // Đổ màu mảng liên thông
      const fillRgba = hexToRgbaArray(activeColor);
      performFloodFill(x, y, fillRgba);
      return;
    }

    if (activeTool === 'pencil' || activeTool === 'eraser') {
      isPointerDownRef.current = true;
      lastPixelRef.current = { x, y };
      applyBrushAt(x, y);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Bỏ qua
      }
    }
  };

  /**
   * Xử lý khi di chuyển chuột (Pointer Move) để vẽ nét liền
   */
  const handlePointerMove = (e) => {
    if (isPanningRef.current || activeTool === 'pan') {
      e.stopPropagation();
      if (onPanMove) onPanMove(e);
      return;
    }

    if (!isPointerDownRef.current) return;
    const { x, y } = getPixelCoords(e);
    if (x === lastPixelRef.current.x && y === lastPixelRef.current.y) return;

    lastPixelRef.current = { x, y };
    applyBrushAt(x, y);
  };

  /**
   * Xử lý khi nhả chuột (Pointer Up)
   */
  const handlePointerUp = (e) => {
    if (isPanningRef.current || activeTool === 'pan') {
      e.stopPropagation();
      isPanningRef.current = false;
      if (onPanEnd) onPanEnd(e);
      return;
    }

    if (isPointerDownRef.current) {
      isPointerDownRef.current = false;
      try {
        if (e.currentTarget?.hasPointerCapture?.(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Bỏ qua
      }
      pushHistorySnapshot();
    }
  };

  /**
   * Cung cấp các phương thức điều khiển cho component cha thông qua ref
   */
  useImperativeHandle(ref, () => ({
    undo: () => {
      if (historyIndexRef.current <= 0) return;
      historyIndexRef.current -= 1;
      const snapshot = historyRef.current[historyIndexRef.current];
      const canvas = canvasRef.current;
      if (canvas && snapshot) {
        const ctx = canvas.getContext('2d');
        ctx.putImageData(snapshot, 0, 0);
        notifyHistoryChange();
        if (onImageModified) {
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              lastSelfGeneratedUrlRef.current = url;
              onImageModified(blob, url);
            }
          }, 'image/png');
        }
      }
    },
    redo: () => {
      if (historyIndexRef.current >= historyRef.current.length - 1) return;
      historyIndexRef.current += 1;
      const snapshot = historyRef.current[historyIndexRef.current];
      const canvas = canvasRef.current;
      if (canvas && snapshot) {
        const ctx = canvas.getContext('2d');
        ctx.putImageData(snapshot, 0, 0);
        notifyHistoryChange();
        if (onImageModified) {
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              lastSelfGeneratedUrlRef.current = url;
              onImageModified(blob, url);
            }
          }, 'image/png');
        }
      }
    },
    getBlob: async () => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    },
  }));

  // Xác định lớp CSS cho con trỏ chuột theo từng công cụ
  const cursorClass =
    activeTool === 'pencil'
      ? 'cursor-pencil'
      : activeTool === 'bucket'
      ? 'cursor-bucket'
      : activeTool === 'eyedropper'
      ? 'cursor-eyedropper'
      : activeTool === 'eraser'
      ? 'cursor-eraser'
      : 'cursor-pan';

  return (
    <div
      className={`atelier-pixel-canvas-wrapper ${cursorClass}`}
      style={{
        width: dimensions.width * zoom,
        height: dimensions.height * zoom,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onLostPointerCapture={handlePointerUp}
    >
      {/* 1. Canvas vẽ dữ liệu pixel chính */}
      <canvas
        ref={canvasRef}
        className="atelier-main-pixel-canvas"
        style={{
          width: dimensions.width * zoom,
          height: dimensions.height * zoom,
        }}
      />

      {/* 2. Canvas lớp phủ lưới ô pixel khi phóng to */}
      <canvas
        ref={gridCanvasRef}
        className="atelier-grid-overlay-canvas"
        style={{
          width: dimensions.width * zoom,
          height: dimensions.height * zoom,
        }}
      />
    </div>
  );
});

export default PixelCanvas;
