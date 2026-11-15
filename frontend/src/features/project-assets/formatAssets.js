/**
 * Định dạng dung lượng byte thành chuỗi KB hoặc MB dễ đọc.
 *
 * @param {number} bytes Số byte.
 * @returns {string} Chuỗi dung lượng đã định dạng.
 */
export function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Định dạng ngày giờ chuẩn hiển thị tiếng Việt.
 *
 * @param {string} dateStr Chuỗi ngày giờ từ server.
 * @returns {string} Ngày giờ dễ đọc.
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}
