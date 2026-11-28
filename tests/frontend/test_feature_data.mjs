// 1. THƯ VIỆN NỀN TẢNG (Kiểm thử dữ liệu không cần trình duyệt)
import assert from 'node:assert/strict';
import test from 'node:test';

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Các phép chuyển đổi được bảo toàn)
import { buildWorkspaceSheetPayload } from '../../frontend/src/features/project-assets/assetMetadata.js';

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
