// 1. THƯ VIỆN NỀN TẢNG JAVASCRIPT
// Không cần thư viện nền tảng bổ sung.

// 2. THƯ VIỆN BÊN NGOÀI
// Không dùng thư viện bên ngoài.

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// getAuthHeaders: Đính kèm JWT Bearer Token khi truy cập tài nguyên sprite trong kho dự án.
import { getAuthHeaders } from '../../shared/api/authHeaders.js';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Các tham số được truyền từ phòng thử nghiệm.

/**
 * Đọc metadata lưu dưới dạng đối tượng hoặc chuỗi JSON, giữ nguyên dự phòng hiện có.
 * @param {*} metadata Giá trị metadata từ kho tài nguyên.
 * @returns {Object} Metadata có thể đọc thuộc tính.
 */
export function parseVaultMetadata(metadata) {
  let meta = metadata;
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta);
    } catch {
      meta = {};
    }
  }
  return meta || {};
}

/**
 * Tải danh sách tài nguyên với thông báo lỗi hiện có của hộp thoại.
 * @param {number|string} projectId Mã dự án.
 * @returns {Promise<Object>} Phản hồi danh sách tài nguyên.
 */
export function loadVaultSprites(projectId) {
  return fetch(`/api/sprites?project_id=${projectId}`, { headers: getAuthHeaders() })
    .then((res) => {
      if (!res.ok) throw new Error('Không thể tải danh sách tài nguyên từ máy chủ.');
      return res.json();
    });
}

/**
 * Nạp ảnh và frame tùy chọn thành dữ liệu sẵn dùng cho phòng thử nghiệm.
 * @param {Object} sprite Bản ghi tài nguyên đã chọn.
 * @param {number|string} projectId Mã dự án.
 * @returns {Promise<Object>} Ảnh, metadata và frame với cùng giá trị dự phòng.
 */
export async function loadVaultAsset(sprite, projectId) {
  // 1. Tải blob ảnh nhị phân từ MySQL
  const imgRes = await fetch(`/api/sprites/${sprite.id}/raw?project_id=${projectId}`, { headers: getAuthHeaders() });
  if (!imgRes.ok) throw new Error('Không thể tải dữ liệu ảnh nhị phân từ MySQL.');
  const blob = await imgRes.blob();
  const sheetUrl = URL.createObjectURL(blob);

  // 2. Tải danh sách 15 frame con nếu có
  let framesData = [];
  try {
    const framesRes = await fetch(`/api/sprites/${sprite.id}/frames`, { headers: getAuthHeaders() });
    if (framesRes.ok) {
      const resJson = await framesRes.json();
      framesData = resJson.frames || [];
    }
  } catch (err) {
    console.warn('Không thể tải frame con:', err);
  }

  // 3. Đọc metadata cấu hình lưới
  const meta = parseVaultMetadata(sprite.processing_metadata);

  return {
    sprite,
    blob,
    sheetUrl,
    frames: framesData,
    metadata: meta,
    rows: meta.rows || 3,
    columns: meta.columns || 5,
    targetWidth: meta.frame_width || null,
    targetHeight: meta.frame_height || null,
    isBatchResized: Boolean(meta.is_batch_resized),
  };

}
