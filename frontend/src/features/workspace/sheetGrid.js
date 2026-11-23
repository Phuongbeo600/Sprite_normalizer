// 1. THƯ VIỆN NỀN TẢNG REACT
// Các phép tính hình học không phụ thuộc React.

// 2. THƯ VIỆN BÊN NGOÀI
// Dùng các phép toán có sẵn của JavaScript.

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Không có phụ thuộc nội bộ.

// 4. ĐỊNH DẠNG GIAO DIỆN VÀ CẤU HÌNH
// Không sử dụng định dạng giao diện.

/**
 * Tạo đường biên nguyên theo pixel ảnh gốc, gồm cả hai mép ngoài.
 * @param {number} length Chiều dài ảnh trên trục đang chia.
 * @param {number} count Số ô cần chia.
 * @returns {number[]} Các tọa độ từ mép đầu đến mép cuối.
 */
export function createGridCuts(length, count) {
  return Array.from({ length: count + 1 }, (_, index) => Math.round(index * length / count));
}

/**
 * Di chuyển một đường biên, giữ mỗi ô rộng ít nhất một pixel.
 * @param {number[]} cuts Các đường biên trên một trục.
 * @param {number} index Đường biên được chỉnh.
 * @param {number} position Tọa độ mới theo pixel ảnh gốc.
 * @param {number} extent Giới hạn ảnh trên trục.
 * @returns {number[]} Danh sách đường biên mới.
 */
export function moveGridCut(cuts, index, position, extent) {
  const minimum = index === 0 ? 0 : cuts[index - 1] + 1;
  const maximum = index === cuts.length - 1 ? extent : cuts[index + 1] - 1;
  const next = [...cuts];
  next[index] = Math.max(minimum, Math.min(maximum, Math.round(position)));
  return next;
}

/**
 * Mã hóa lưới tùy chỉnh theo hợp đồng biểu mẫu của các API cắt sheet.
 * @param {{x: number[], y: number[]}|null} cuts Các đường cắt đã chốt.
 * @returns {Object} Trường biểu mẫu bổ sung, rỗng khi dùng lưới tự động.
 */
export function gridRequestFields(cuts) {
  if (!cuts) return {};
  return { x_cuts_json: JSON.stringify(cuts.x), y_cuts_json: JSON.stringify(cuts.y) };
}

/**
 * Khôi phục biên đều của sheet đã ghép khi nạp bộ frame thủ công từ kho.
 * @param {Object} data Dữ liệu bàn giao, gồm số hàng/cột và kích thước sheet đã lưu.
 * @returns {{x: number[], y: number[]}|null} Biên mới trên sheet đã ghép, khác biên nguồn ban đầu.
 */
export function savedGridCuts(data) {
  const { regularGridSize, rows, columns } = data;
  if (!regularGridSize) return null;
  const { width, height } = regularGridSize;
  if (![width, height, rows, columns].every(Number.isInteger)
    || rows < 1 || columns < 1 || rows * columns > 256 || width < columns || height < rows) return null;
  return { x: createGridCuts(width, columns), y: createGridCuts(height, rows) };
}
