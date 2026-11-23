// 1. THƯ VIỆN NỀN TẢNG JAVASCRIPT
// Không cần thư viện nền tảng bổ sung.

// 2. THƯ VIỆN BÊN NGOÀI
// Không dùng thư viện bên ngoài.

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Không có phụ thuộc nội bộ.

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Các tham số được truyền từ phòng thử nghiệm.

/**
 * Gửi dữ liệu JSON và giữ nguyên phản hồi để bên gọi xử lý lỗi theo từng thao tác.
 * @param {string} url Đường dẫn API.
 * @param {string} method Phương thức HTTP.
 * @param {Object} payload Dữ liệu cần lưu.
 * @returns {Promise<Response>} Phản hồi HTTP chưa phân tích.
 */
function sendJson(url, method, payload) {
  return fetch(url, {method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)});
}

/**
 * Mã dự án cần đọc bản đồ.
 * @param {*} projectId Mã dự án cần đọc bản đồ.
 * @returns {Promise<Response>} Phản hồi HTTP chưa phân tích.
 */
export function loadTestbedMap(projectId) {
  return fetch(`/api/testbed/map?project_id=${projectId}`);
}

/**
 * Mã dự án cần đọc đội hình.
 * @param {*} projectId Mã dự án cần đọc đội hình.
 * @returns {Promise<Response>} Phản hồi HTTP chưa phân tích.
 */
export function loadTestbedCharacters(projectId) {
  return fetch(`/api/testbed/characters?project_id=${projectId}`);
}

/**
 * Dữ liệu bản đồ cần lưu.
 * @param {*} payload Dữ liệu bản đồ cần lưu.
 * @returns {Promise<Response>} Phản hồi HTTP chưa phân tích.
 */
export function saveTestbedMap(payload) {
  return sendJson('/api/testbed/map', 'POST', payload);
}

/**
 * Độ cao sàn và mã dự án.
 * @param {*} payload Độ cao sàn và mã dự án.
 * @returns {Promise<Response>} Phản hồi HTTP chưa phân tích.
 */
export function saveTestbedGroundY(payload) {
  return sendJson('/api/testbed/map/ground-y', 'PUT', payload);
}

/**
 * Dữ liệu nhân vật mới.
 * @param {*} payload Dữ liệu nhân vật mới.
 * @returns {Promise<Response>} Phản hồi HTTP chưa phân tích.
 */
export function createTestbedCharacter(payload) {
  return sendJson('/api/testbed/characters', 'POST', payload);
}

/**
 * Nhân vật, dự án và thông số cập nhật.
 * @param {*} characterId Nhân vật, dự án và thông số cập nhật.
 * @param {*} projectId Nhân vật, dự án và thông số cập nhật.
 * @param {*} payload Nhân vật, dự án và thông số cập nhật.
 * @returns {Promise<Response>} Phản hồi HTTP chưa phân tích.
 */
export function updateTestbedCharacter(characterId, projectId, payload) {
  return sendJson(`/api/testbed/characters/${characterId}?project_id=${projectId}`, 'PUT', payload);
}

/**
 * Nhân vật và dữ liệu khung ảnh.
 * @param {*} characterId Nhân vật và dữ liệu khung ảnh.
 * @param {*} payload Nhân vật và dữ liệu khung ảnh.
 * @returns {Promise<Response>} Phản hồi HTTP chưa phân tích.
 */
export function updateTestbedSlot(characterId, payload) {
  return sendJson(`/api/testbed/characters/${characterId}/slots`, 'PUT', payload);
}

/**
 * Mã dự án cần xóa bản đồ.
 * @param {*} projectId Mã dự án cần xóa bản đồ.
 * @returns {Promise<Response>} Phản hồi HTTP chưa phân tích.
 */
export function deleteTestbedMap(projectId) {
  return fetch(`/api/testbed/map?project_id=${projectId}`, {method: 'DELETE'});
}

/**
 * Mã nhân vật và dự án cần xóa.
 * @param {*} characterId Mã nhân vật và dự án cần xóa.
 * @param {*} projectId Mã nhân vật và dự án cần xóa.
 * @returns {Promise<Response>} Phản hồi HTTP chưa phân tích.
 */
export function deleteTestbedCharacter(characterId, projectId) {
  return fetch(`/api/testbed/characters/${characterId}?project_id=${projectId}`, {method: 'DELETE'});
}

/**
 * Tải ảnh và yêu cầu gói Godot độc lập với thao tác tải xuống của giao diện.
 * @param {Object} activeChar Nhân vật với ảnh và thông số xuất.
 * @returns {Promise<Blob>} Nội dung gói Godot hoặc lỗi máy chủ hiện có.
 */
export async function exportGodotArchive(activeChar) {
  const responseBlob = await fetch(activeChar.sheetUrl).then((r) => r.blob());
  const formData = new FormData();
  formData.append('file', responseBlob, activeChar.sheetFileName || 'character_sheet.png');
  formData.append('rows', String(activeChar.rows));
  formData.append('columns', String(activeChar.columns));
  formData.append('fps', String(activeChar.fps));
  formData.append('move_speed', String(activeChar.moveSpeed));
  formData.append('character_name', activeChar.name.replace(/\s+/g, '_'));
  formData.append('auto_anchor', 'true');

  const response = await fetch('/api/export-godot', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.detail || 'Không thể đóng gói tài nguyên Godot từ máy chủ.');
  }

  return response.blob();
}
