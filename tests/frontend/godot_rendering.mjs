// 1. THƯ VIỆN NỀN TẢNG JAVASCRIPT
// Kiểm tra lệnh vẽ canvas mà không cần GPU hoặc trình duyệt.
import test from 'node:test';
import assert from 'node:assert/strict';

// 2. THƯ VIỆN BÊN NGOÀI
// Không dùng thư viện bổ sung.

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Bộ vẽ thật hoặc thân hàm ban đầu để thiết lập hợp đồng hành vi.
import { drawTestbedCanvas } from '../../frontend/src/features/godot-testbed/testbedCanvas.js';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Kích thước và ảnh ký hiệu phục vụ kiểm thử lệnh vẽ.
const character = (name) => ({name, sheetImage: name, cellWidth: 32, cellHeight: 48, rows: 3, columns: 5, marginX: 2, marginY: 3});

test('vẽ theo độ sâu, cắt đúng ô và lật ngang quanh điểm neo chân', () => {
  const calls = [];
  const ctx = new Proxy({}, {get: (_, name) => (...args) => calls.push([name, ...args])});
  drawTestbedCanvas(ctx, {characters: [character('front'), character('back')], roster: [{x: 100, y: 540, direction: 'up', animFrameIdx: 2}, {x: 200, y: 500, direction: 'side', facingLeft: true, animFrameIdx: 1}], activeCharIdx: 0, w: 1280, h: 720, groundY: 540, mapImage: 'map', pixelZoom: 2});
  assert.deepEqual(calls.filter(c => c[0] === 'drawImage'), [
    ['drawImage', 'map', 0, 0, 1280, 720],
    ['drawImage', 'back', 34, 51, 32, 48, -32, 404, 64, 96],
    ['drawImage', 'front', 66, 99, 32, 48, 68, 444, 64, 96]
  ]);
  assert.ok(calls.some(c => c[0] === 'translate' && c[1] === 200));
  assert.ok(calls.some(c => c[0] === 'scale' && c[1] === -1));
});

test('vẽ các lớp gỡ lỗi và đường đỉnh đầu theo đúng tỉ lệ', () => {
  const calls = [];
  const ctx = new Proxy({}, {get: (_, name) => (...args) => calls.push([name, ...args])});
  drawTestbedCanvas(ctx, {characters: [{...character('hero'), scale: 1.5}], roster: [{x: 200, y: 540, direction: 'down', animFrameIdx: 0}], activeCharIdx: 0, w: 1280, h: 720, groundY: 540, mapImage: 'map', pixelZoom: 2, showFloorGrid: true, showGroundLine: true, showCollision: true, showOrigin: true, showGuidelines: true});
  assert.ok(calls.some(c => c[0] === 'strokeRect'));
  assert.ok(calls.some(c => c[0] === 'moveTo' && c[1] === 0 && c[2] === 396));
  assert.ok(calls.some(c => c[0] === 'fillText' && c[1].includes('Cao 72px')));
});
