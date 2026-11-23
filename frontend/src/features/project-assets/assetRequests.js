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
 * Đọc danh sách tài nguyên và dùng danh sách rỗng khi không tải được.
 * @param {string} url Địa chỉ danh sách.
 * @param {string} key Trường chứa danh sách trong dữ liệu phản hồi.
 * @returns {Promise<Array>} Danh sách tài nguyên.
 */
export function fetchAssetList(url, key) {
  return fetch(url)
    .then((response) => (response.ok ? response.json() : { [key]: [] }))
    .then((body) => body[key] || [])
    .catch(() => []);
}

/** Đọc phản hồi chi tiết hồ sơ; lớp gọi giữ quyền xử lý lỗi và thông báo. */
export function requestPresetDetail(projectId, presetId) {
  return fetch(presetDetailUrl(projectId, presetId));
}

/** Đọc các frame đã lưu của sprite. */
export function requestSpriteFrames(spriteId) {
  return fetch(`/api/sprites/${spriteId}/frames`);
}

/** Tải tệp sprite theo cùng quy tắc ưu tiên ảnh đã xử lý hiện tại. */
export async function fetchSpriteFile(projectId, sprite, fallbackName) {
  const res = await fetch(spriteImageUrl(projectId, sprite.id, sprite.has_processed));
  if (!res.ok) throw new Error('Không thể tải tệp ảnh từ máy chủ.');
  const blob = await res.blob();
  return new File([blob], sprite.name || fallbackName, { type: 'image/png' });
}

/** Xóa ảnh trong đúng phạm vi dự án. */
export function requestDeleteSprite(projectId, spriteId) {
  return fetch(`/api/sprites/${spriteId}?project_id=${projectId}`, { method: 'DELETE' });
}

/** Xóa hồ sơ đã lưu. */
export function requestDeletePreset(projectId, presetId) {
  return fetch(presetDetailUrl(projectId, presetId), { method: 'DELETE' });
}

/** Xóa nhân vật thử nghiệm trong đúng phạm vi dự án. */
export function requestDeleteCharacter(projectId, characterId) {
  return fetch(`/api/testbed/characters/${characterId}?project_id=${projectId}`, { method: 'DELETE' });
}

/** Xóa bản đồ của dự án. */
export function requestDeleteMap(projectId) {
  return fetch(testbedMapUrl(projectId), { method: 'DELETE' });
}

/** Đọc bản đồ, giữ quy tắc bỏ qua lỗi để các loại tài nguyên khác vẫn hiển thị. */
export function fetchAssetMap(projectId) {
  return fetch(testbedMapUrl(projectId))
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j && j.status === 'success' && j.map_image_base64 ? j : null))
    .catch(() => null);
}
