// 1. THƯ VIỆN NỀN TẢNG JAVASCRIPT
// Giả lập duy nhất HTTP và URL ảnh để kiểm tra luồng nạp tài nguyên ngoại tuyến.
import test from 'node:test';
import assert from 'node:assert/strict';

// 2. THƯ VIỆN BÊN NGOÀI
// Không cần thư viện bổ sung.

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Đọc metadata và tải dữ liệu thực của hộp thoại chọn tài nguyên.
import { parseVaultMetadata, loadVaultSprites, loadVaultAsset } from '../../frontend/src/features/godot-testbed/vaultPickerApi.js';
import { createRosterState } from '../../frontend/src/features/godot-testbed/testbedSimulation.js';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Không có cấu hình bổ sung.

test('metadata giữ đối tượng hợp lệ và dự phòng JSON sai, null, rỗng', () => {
  const metadata = {rows: 1};
  assert.equal(parseVaultMetadata(metadata), metadata);
  assert.deepEqual(parseVaultMetadata('{"rows":1}'), metadata);
  for (const value of [null, undefined, '', '{', 'null']) assert.deepEqual(parseVaultMetadata(value), {});
});

test('tải kho báo đúng lỗi danh sách khi HTTP thất bại', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => ({ok: false}));
  await assert.rejects(loadVaultSprites(4), {message: 'Không thể tải danh sách tài nguyên từ máy chủ.'});
});

test('ảnh chính tải trước frame và giữ metadata, thông số lưới và URL ảnh', async (t) => {
  const blob = new Blob(['image']);
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(url);
    return url.includes('/raw?') ? {ok: true, blob: async () => blob} : {ok: true, json: async () => ({frames: [{id: 1}]})};
  });
  t.mock.method(URL, 'createObjectURL', () => 'blob:sheet');
  const sprite = {id: 8, processing_metadata: '{"rows":1,"columns":4,"frame_width":10,"frame_height":20,"is_batch_resized":true}'};
  const result = await loadVaultAsset(sprite, 4);
  assert.deepEqual(calls, ['/api/sprites/8/raw?project_id=4', '/api/sprites/8/frames']);
  assert.equal(result.sprite, sprite);
  assert.equal(result.blob, blob);
  assert.equal(result.sheetUrl, 'blob:sheet');
  assert.deepEqual(result.frames, [{id: 1}]);
  assert.equal(result.rows, 1);
  assert.equal(result.columns, 4);
  assert.equal(result.targetWidth, 10);
  assert.equal(result.targetHeight, 20);
  assert.equal(result.isBatchResized, true);
});

test('frame phụ thất bại vẫn trả ảnh và giữ dự phòng 3x5', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (url.includes('/frames')) throw new Error('offline');
    return {ok: true, blob: async () => new Blob(['image'])};
  });
  t.mock.method(console, 'warn', () => {});
  t.mock.method(URL, 'createObjectURL', () => 'blob:sheet');
  const result = await loadVaultAsset({id: 8}, 4);
  assert.deepEqual(result.frames, []);
  assert.equal(result.rows, 3);
  assert.equal(result.columns, 5);
  assert.equal(result.targetWidth, null);
  assert.equal(result.targetHeight, null);
});

test('lỗi ảnh chính ngừng trước yêu cầu frame và trả đúng thông báo', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {calls.push(url); return {ok: false};});
  await assert.rejects(loadVaultAsset({id: 8}, 4), {message: 'Không thể tải dữ liệu ảnh nhị phân từ MySQL.'});
  assert.deepEqual(calls, ['/api/sprites/8/raw?project_id=4']);
});

test('mỗi nhân vật có trạng thái riêng và giữ tọa độ bằng không', () => {
  const first = createRosterState(0, 0);
  const second = createRosterState(0, 0);
  first.x = 5;
  assert.equal(second.x, 0);
  assert.deepEqual(second, {x: 0, y: 0, direction: 'down', facingLeft: false, animTime: 0, animFrameIdx: 0, isMoving: false});
});
