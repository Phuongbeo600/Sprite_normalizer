// 1. THƯ VIỆN NỀN TẢNG JAVASCRIPT
// node:test và assert: Kiểm tra tọa độ và hợp đồng lưới mà không cần trình duyệt.
import test from 'node:test';
import assert from 'node:assert/strict';

// 2. THƯ VIỆN BÊN NGOÀI
// Không dùng thư viện bổ sung.

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Các phép tính lưới dùng bởi Workspace và lớp phủ tương tác.
import { createGridCuts, moveGridCut, gridRequestFields, savedGridCuts } from '../../frontend/src/features/workspace/sheetGrid.js';

// 4. ĐỊNH DẠNG GIAO DIỆN VÀ CẤU HÌNH
// Không áp dụng cho kiểm thử hình học.

test('chia sáu cột bao phủ toàn bộ ảnh kể cả pixel lẻ', () => {
  assert.deepEqual(createGridCuts(101, 6), [0, 17, 34, 51, 67, 84, 101]);
});

test('kéo đường cắt giữ ô rộng ít nhất một pixel và không đổi dữ liệu cũ', () => {
  const cuts = [0, 20, 40, 60];
  assert.deepEqual(moveGridCut(cuts, 1, 90, 60), [0, 39, 40, 60]);
  assert.deepEqual(moveGridCut(cuts, 2, -2, 60), [0, 20, 21, 60]);
  assert.deepEqual(cuts, [0, 20, 40, 60]);
});

test('mép ngoài bị giới hạn bởi ảnh và đường liền kề', () => {
  assert.deepEqual(moveGridCut([0, 20, 40], 0, -10, 40), [0, 20, 40]);
  assert.deepEqual(moveGridCut([0, 20, 40], 0, 30, 40), [19, 20, 40]);
  assert.deepEqual(moveGridCut([0, 20, 40], 2, 80, 40), [0, 20, 40]);
  assert.deepEqual(moveGridCut([0, 20, 40], 2, 25.6, 40), [0, 20, 26]);
});

test('biểu mẫu gửi đúng biên gốc hoặc giữ chế độ cắt tự động', () => {
  assert.deepEqual(gridRequestFields(null), {});
  assert.deepEqual(gridRequestFields({ x: [2, 30, 60], y: [4, 25] }), {
    x_cuts_json: '[2,30,60]', y_cuts_json: '[4,25]',
  });
});

test('mở lại sheet đã ghép dùng biên mới để bảo toàn ô có nhiều pixel trong suốt', () => {
  const cuts = savedGridCuts({ rows: 1, columns: 2, regularGridSize: { width: 40, height: 10 } });
  assert.deepEqual(cuts, { x: [0, 20, 40], y: [0, 10] });
  assert.deepEqual(gridRequestFields(cuts), { x_cuts_json: '[0,20,40]', y_cuts_json: '[0,10]' });
  assert.equal(savedGridCuts({ rows: 1, columns: 2 }), null);
  assert.equal(savedGridCuts({ rows: 1, columns: 2, regularGridSize: { width: 1, height: 10 } }), null);
});
