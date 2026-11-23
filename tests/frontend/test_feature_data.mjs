// 1. THƯ VIỆN NỀN TẢNG (Kiểm thử dữ liệu không cần trình duyệt)
import assert from 'node:assert/strict';
import test from 'node:test';

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Các phép chuyển đổi được bảo toàn)
import { buildWorkspaceSheetPayload } from '../../frontend/src/features/project-assets/assetMetadata.js';
import { buildPresetPayload } from '../../frontend/src/features/character-analysis/presetPayload.js';
import { buildPromptProfile } from '../../frontend/src/features/character-analysis/promptProfile.js';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)

test('khôi phục sheet với lưới thủ công, FPS và tên frame dự phòng', () => {
  const result = buildWorkspaceSheetPayload({ processing_metadata: JSON.stringify({
    rows: 2, columns: 3, x_cuts: [0, 8, 24], y_cuts: [0, 16],
    original_width: 24, original_height: 16, auto_anchor: true, fps: 12,
  }) }, [{ frame_index: 2, image_url: 'data:image/png;base64,a', id: 9 }]);
  assert.deepEqual(result, { rows: 2, columns: 3,
    regularGridSize: { width: 24, height: 16 }, autoAnchor: true, fps: 12,
    frames: [{ name: 'frame_2.png', url: 'data:image/png;base64,a', index: 2, id: 9 }] });
});

test('metadata lỗi vẫn giữ mặc định và không làm mất tên frame đã lưu', () => {
  assert.deepEqual(buildWorkspaceSheetPayload({ processing_metadata: '{bad' }, [
    { frame_name: 'idle.png', frame_index: 0, image_url: 'image', id: 4 },
  ]), { rows: 1, columns: 1, regularGridSize: null, autoAnchor: false, fps: 6,
    frames: [{ name: 'idle.png', url: 'image', index: 0, id: 4 }] });
});

test('lưu hồ sơ giữ ưu tiên prompt hiện tại và fallback từ bản đã nạp', () => {
  const profileData = { frame_actions_data: { down: {} } };
  const result = buildPresetPayload({ newCharData: { new_character_concept: 'Mage', positive_prompt: 'live' },
    reference: null, metrics: { heads_tall: 4 }, profileData,
    generatedProfilePrompt: { positive_prompt: 'saved', negative_prompt: 'negative', technical_notes: 'notes' } });
  assert.equal(result.name, 'Mage (Bản lưu Studio)');
  assert.equal(result.sprite_name, 'sprite_sample.png');
  assert.equal(result.positive_prompt, 'live');
  assert.equal(result.negative_prompt, 'negative');
  assert.equal(result.technical_notes, 'notes');
  assert.equal(result.profile_data, profileData);
  assert.equal(result.frame_actions_data, profileData.frame_actions_data);
});

test('profile prompt giữ alias hình học và quyền chọn kế thừa độc lập', () => {
  const fullProfile = { anatomy: { head_to_body_ratio: '1:5', head_width: 3 } };
  const measuredGeometry = { heads_tall: 4, visible_height: 64, head_height_px: 16, head_w: 8 };
  const pixelStyle = { outline: 'crisp' };
  const inherited = buildPromptProfile({ fullProfile, measuredGeometry, pixelStyle, keepsScale: true, keepsStyle: true });
  assert.equal(inherited.anatomy.head_to_body_ratio, '1:4');
  assert.equal(inherited.anatomy.anatomical_height, 64);
  assert.equal(inherited.anatomy.head_height, 16);
  assert.equal(inherited.anatomy.head_width, 8);
  assert.equal(inherited.metrics, measuredGeometry);
  assert.equal(inherited.pixel_style, pixelStyle);
  const independent = buildPromptProfile({ fullProfile, measuredGeometry, pixelStyle, keepsScale: false, keepsStyle: false });
  assert.equal(independent.anatomy, fullProfile.anatomy);
  assert.deepEqual(independent.pixel_style, {});
  assert.equal(independent.metrics, undefined);
});
