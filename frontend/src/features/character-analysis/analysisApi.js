// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý giao diện và trạng thái)
// ========================================================
// Không phụ thuộc vào React.

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI
// ========================================================
// Không dùng thư viện bên ngoài.

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Thành phần giao diện và dữ liệu)
// ========================================================
// Không dùng thành phần nội bộ.

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC
// ========================================================
// Không áp dụng cho tệp tiện ích.

/**
 * Gửi tệp hiện tại cùng các trường của đúng thao tác đang chọn.
 *
 * @param {File} file Tệp ảnh tham chiếu.
 * @param {string} url Tuyến API xử lý ảnh.
 * @param {Object} [fields={}] Các tùy chọn riêng của thao tác.
 * @returns {Promise<Object>} Kết quả xử lý ảnh từ máy chủ.
 */
export async function requestAnalysis(file, url, fields = {}) {
  const body = new FormData(); // form đóng gói ảnh thành nhị phân
  body.append('file', file); // thêm ảnh được nạp vào form
  Object.entries(fields).forEach(([name, value]) => body.append(name, value));
  const response = await fetch(url, { method: 'POST', body });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.detail || 'Không xử lý được ảnh.');
  return payload;
}

/**
 * Đọc trạng thái cấu hình AI của dự án đang mở.
 *
 * @param {string} query Chuỗi truy vấn chứa mã dự án, hoặc chuỗi rỗng.
 * @param {AbortSignal} signal Tín hiệu hủy khi rời chế độ hồ sơ mẫu.
 * @returns {Promise<Response>} Phản hồi chưa đọc của máy chủ.
 */
export function requestVisionStatus(query, signal) {
  return fetch(`/api/character-profile/vision-status${query}`, { signal });
}

/**
 * Gửi hồ sơ và cấu hình nhân vật mới đến bộ sinh prompt.
 *
 * @param {Object} data Dữ liệu cần để sinh prompt.
 * @param {string|number|undefined} data.projectId Mã dự án đang mở, nếu có.
 * @param {Object} data.profileData Hồ sơ nhân vật mẫu.
 * @param {Object|null} data.metrics Số đo của ảnh mẫu.
 * @param {Object} data.newCharConfig Cấu hình nhân vật do người dùng nhập.
 * @returns {Promise<Response>} Phản hồi chưa đọc của máy chủ.
 */
export function requestProfilePrompt({ projectId, profileData, metrics, newCharConfig }) {
  return fetch('/api/character-profile/generate-prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId || null,
      profile_data: profileData,
      metrics: metrics,
      core_concept: newCharConfig.core_concept || 'Pixel Art Character',
      outfit_and_colors: newCharConfig.outfit_and_colors || null,
      weapons_and_props: newCharConfig.weapons_and_props || null,
      stature_rule: newCharConfig.stature_rule || 'Bằng nhân vật gốc (Tỷ lệ chuẩn)',
      target_direction: newCharConfig.target_direction || 'Sprite Sheet 3x5 (15 frames)',
      inherit_scale: newCharConfig.inherit_scale ?? true,
      inherit_style: newCharConfig.inherit_style ?? true,
      frame_actions: newCharConfig.frame_actions || null,
      compiled_positive_prompt: newCharConfig.compiled_positive_prompt || null,
      compiled_negative_prompt: newCharConfig.compiled_negative_prompt || null,
    }),
  });
}

/**
 * Lưu hồ sơ nhân vật và prompt hiện tại vào dự án.
 *
 * @param {string|number} projectId Mã dự án đang mở.
 * @param {Object} payload Dữ liệu hồ sơ cần lưu.
 * @returns {Promise<Response>} Phản hồi chưa đọc của máy chủ.
 */
export function requestSavePreset(projectId, payload) {
  return fetch(`/api/projects/${projectId}/character-presets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
