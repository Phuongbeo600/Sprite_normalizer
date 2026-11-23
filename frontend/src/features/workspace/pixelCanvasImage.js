// 1. THƯ VIỆN NỀN TẢNG (JavaScript)
// Các thao tác dữ liệu pixel dùng trực tiếp kiểu mảng của JavaScript.

// 2. THƯ VIỆN BÊN NGOÀI
// Không có phụ thuộc bên ngoài.

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Không có phụ thuộc nội bộ.

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Không áp dụng cho thao tác dữ liệu ảnh.

/**
 * Chuyển đổi chuỗi mã HEX sang mảng 4 kênh màu RGBA [R, G, B, A] (0-255).
 *
 * @param {string} hex Mã HEX (ví dụ: '#322334', '#ffffff').
 * @returns {number[]} Mảng số nguyên [r, g, b, a].
 */
export function hexToRgbaArray(hex) {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return [0, 0, 0, 255];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255, 255];
}

/**
 * Tô vùng liên thông bốn hướng ngay trên bộ đệm ảnh bằng thuật toán hiện có.
 * @param {ImageData} imageData Bộ đệm RGBA cần chỉnh sửa.
 * @param {number} w Chiều rộng ảnh.
 * @param {number} h Chiều cao ảnh.
 * @param {number} startX Hoành độ bắt đầu.
 * @param {number} startY Tung độ bắt đầu.
 * @param {number[]} fillRgba Bốn kênh màu cần tô.
 * @returns {boolean} Có tiếp tục ghi ảnh và lưu lịch sử theo quy tắc hiện có hay không.
 */
export function fillConnectedPixels(imageData, w, h, startX, startY, fillRgba) {
  const data32 = new Uint32Array(imageData.data.buffer);

  const startIndex = startY * w + startX;
  const targetColor32 = data32[startIndex];
  const fillColor32 =
    (fillRgba[3] << 24) | (fillRgba[2] << 16) | (fillRgba[1] << 8) | fillRgba[0];

  if (targetColor32 === fillColor32) return false;

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
  return true;
}

/**
 * Xuất PNG và chuyển URL tự sinh cho component cha sau khi đã đánh dấu nguồn ảnh.
 * @param {HTMLCanvasElement} canvas Bàn vẽ cần xuất.
 * @param {Function|undefined} onImageModified Callback nhận Blob cùng URL.
 * @param {{current: string|null}} lastSelfGeneratedUrlRef Tham chiếu URL để giữ lịch sử.
 * @returns {void}
 */
export function emitCanvasImage(canvas, onImageModified, lastSelfGeneratedUrlRef) {
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
