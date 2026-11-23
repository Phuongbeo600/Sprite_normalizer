// 1. THƯ VIỆN NỀN TẢNG JAVASCRIPT
// Kiểm thử vận động và hoạt họa độc lập trình duyệt.
import test from 'node:test';
import assert from 'node:assert/strict';

// 2. THƯ VIỆN BÊN NGOÀI
// Không cần thư viện bổ sung.

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Dùng cùng thuật toán trước và sau khi tách mô-đun.
import { advanceTestbedSimulation } from '../../frontend/src/features/godot-testbed/testbedSimulation.js';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Cấu hình nhỏ dành riêng cho ca kiểm thử.
const character = { moveSpeed: 100, fps: 8, columns: 5 };
const initialState = () => ({ x: 200, y: 540, direction: 'down', facingLeft: false, animTime: 0, animFrameIdx: 0, isMoving: false });
const advance = (roster, keys, extra = {}) => advanceTestbedSimulation({characters: roster.map(() => character), roster, activeCharIdx: 0, keys, isDragging: false, delta: .1, w: 1280, h: 720, groundY: 540, ...extra});

test('đi chéo chuẩn hóa tốc độ, ưu tiên hướng dọc khi bằng nhau', () => {
  const roster = [initialState()];
  advance(roster, {d: true, s: true});
  assert.ok(Math.abs(roster[0].x - (200 + 10 / Math.sqrt(2))) < 1e-10);
  assert.ok(Math.abs(roster[0].y - (540 + 7 / Math.sqrt(2))) < 1e-10);
  assert.equal(roster[0].direction, 'down');
});

test('di chuyển trái lật ảnh, giới hạn sân và tiến đúng chu kỳ bước', () => {
  const roster = [{...initialState(), x: 51, animTime: .1, animFrameIdx: 4}];
  advance(roster, {arrowleft: true});
  assert.equal(roster[0].x, 50);
  assert.equal(roster[0].facingLeft, true);
  assert.equal(roster[0].direction, 'side');
  assert.equal(roster[0].animFrameIdx, 1);
  assert.equal(roster[0].animTime, 0);
});

test('đứng yên xóa bước và thời gian còn nhân vật phụ chỉ về idle khi đủ nhịp', () => {
  const roster = [{...initialState(), animFrameIdx: 3, animTime: .03}, {...initialState(), animFrameIdx: 2, animTime: 0}];
  advance(roster, {});
  assert.equal(roster[0].animFrameIdx, 0);
  assert.equal(roster[0].animTime, 0);
  assert.equal(roster[1].animFrameIdx, 2);
  advance(roster, {});
  assert.equal(roster[1].animFrameIdx, 0);
});

test('kéo chuột giữ nguyên trạng thái nhân vật đang chọn', () => {
  const roster = [{...initialState(), isMoving: true, animFrameIdx: 2}];
  const before = {...roster[0]};
  advance(roster, {w: true}, {isDragging: true});
  assert.deepEqual(roster[0], before);
});
