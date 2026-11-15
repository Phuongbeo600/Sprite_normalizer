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
