// 1. THƯ VIỆN NỀN TẢNG (Không sử dụng)

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Xác thực quyền truy cập tài nguyên)
import { getAuthHeaders } from '../../shared/api/authHeaders.js';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)

/**
 * Tạo địa chỉ tải ảnh gốc hoặc ảnh đã xử lý của sprite.
 * @param {number} projectId Mã dự án.
 * @param {number} spriteId Mã sprite.
 * @param {boolean} [isProcessed=false] Có dùng ảnh đã xử lý hay không.
 * @returns {string} Địa chỉ tệp ảnh.
 */
export function spriteImageUrl(projectId, spriteId, isProcessed = false) {
  const variant = isProcessed ? 'processed' : 'raw';
  return `/api/sprites/${spriteId}/${variant}?project_id=${projectId}`;
}

/**
 * Tạo địa chỉ danh sách hồ sơ nhân vật trong dự án.
 * @param {number} projectId Mã dự án.
 * @returns {string} Địa chỉ danh sách hồ sơ.
 */
export function presetCollectionUrl(projectId) {
  return `/api/projects/${projectId}/character-presets`;
}

/**
 * Tạo địa chỉ chi tiết hồ sơ nhân vật.
 * @param {number} projectId Mã dự án.
 * @param {number} presetId Mã hồ sơ.
 * @returns {string} Địa chỉ hồ sơ.
 */
export function presetDetailUrl(projectId, presetId) {
  return `${presetCollectionUrl(projectId)}/${presetId}`;
}

/**
 * Tạo địa chỉ bản đồ nền của dự án.
 * @param {number} projectId Mã dự án.
 * @returns {string} Địa chỉ bản đồ.
 */
export function testbedMapUrl(projectId) {
  return `/api/testbed/map?project_id=${projectId}`;
}

/**
 * Đọc danh sách tài nguyên và chuyển lỗi tải cho giao diện hiển thị.
 * @param {string} url Địa chỉ danh sách.
 * @param {string} key Trường chứa danh sách trong dữ liệu phản hồi.
 * @returns {Promise<Array>} Danh sách tài nguyên.
 */
export async function fetchAssetList(url, key) {
  const response = await fetch(url, { headers: getAuthHeaders() });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail || 'Không thể tải danh sách tài nguyên.');
  }
  const body = await response.json();
  return body[key] || [];
}

/** Đọc phản hồi chi tiết hồ sơ; lớp gọi giữ quyền xử lý lỗi và thông báo. */
export function requestPresetDetail(projectId, presetId) {
  return fetch(presetDetailUrl(projectId, presetId), { headers: getAuthHeaders() });
}

/** Đọc các frame đã lưu của sprite. */
export function requestSpriteFrames(spriteId) {
  return fetch(`/api/sprites/${spriteId}/frames`, { headers: getAuthHeaders() });
}

/** Tải tệp sprite theo cùng quy tắc ưu tiên ảnh đã xử lý hiện tại. */
export async function fetchSpriteFile(projectId, sprite, fallbackName) {
  const res = await fetch(spriteImageUrl(projectId, sprite.id, sprite.has_processed), { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Không thể tải tệp ảnh từ máy chủ.');
  const blob = await res.blob();
  return new File([blob], sprite.name || fallbackName, { type: 'image/png' });
}

/** Xóa ảnh trong đúng phạm vi dự án. */
export function requestDeleteSprite(projectId, spriteId) {
  return fetch(`/api/sprites/${spriteId}?project_id=${projectId}`, { method: 'DELETE', headers: getAuthHeaders() });
}

/** Xóa hồ sơ đã lưu. */
export function requestDeletePreset(projectId, presetId) {
  return fetch(presetDetailUrl(projectId, presetId), { method: 'DELETE', headers: getAuthHeaders() });
}

/** Xóa nhân vật thử nghiệm trong đúng phạm vi dự án. */
export function requestDeleteCharacter(projectId, characterId) {
  return fetch(`/api/testbed/characters/${characterId}?project_id=${projectId}`, { method: 'DELETE', headers: getAuthHeaders() });
}

/** Xóa bản đồ của dự án. */
export function requestDeleteMap(projectId) {
  return fetch(testbedMapUrl(projectId), { method: 'DELETE', headers: getAuthHeaders() });
}

/** Đọc bản đồ, giữ quy tắc bỏ qua lỗi để các loại tài nguyên khác vẫn hiển thị. */
export function fetchAssetMap(projectId) {
  return fetch(testbedMapUrl(projectId), { headers: getAuthHeaders() })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j && j.status === 'success' && j.map_image_base64 ? j : null))
    .catch(() => null);
}
