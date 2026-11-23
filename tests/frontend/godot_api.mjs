// 1. THƯ VIỆN NỀN TẢNG JAVASCRIPT
// Kiểm tra hợp đồng HTTP bằng phản hồi ngoại vi giả lập.
import test from 'node:test';
import assert from 'node:assert/strict';

// 2. THƯ VIỆN BÊN NGOÀI
// Không dùng thư viện bổ sung.

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Các thao tác HTTP giữ nguyên URL, phương thức và thân dữ liệu.
import { exportGodotArchive, loadTestbedMap, loadTestbedCharacters, saveTestbedMap, saveTestbedGroundY, createTestbedCharacter, updateTestbedCharacter, updateTestbedSlot, deleteTestbedMap, deleteTestbedCharacter } from '../../frontend/src/features/godot-testbed/testbedApi.js';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Không có cấu hình bổ sung.

test('transport giữ nguyên payload JSON và không tự đổi cách xử lý lỗi HTTP', async (t) => {
  const calls = [];
  const response = {ok: false, status: 403};
  t.mock.method(globalThis, 'fetch', async (...args) => {calls.push(args); return response;});
  const payload = {name: 'Hiệp sĩ', fps: 0, pos_x: 0, slots_data: {down_0: 'data:image/png;base64,x'}};
  assert.equal(await createTestbedCharacter(payload), response);
  await updateTestbedCharacter(7, 9, payload);
  await updateTestbedSlot(7, {slot_key: 'down_0', image_base64: 'image'});
  await saveTestbedMap(payload);
  await saveTestbedGroundY({project_id: 9, ground_y: 0});
  assert.deepEqual(calls[0], ['/api/testbed/characters', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)}]);
  assert.deepEqual(calls[1], ['/api/testbed/characters/7?project_id=9', {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)}]);
  assert.equal(calls[2][0], '/api/testbed/characters/7/slots');
  assert.equal(calls[3][0], '/api/testbed/map');
  assert.equal(calls[4][0], '/api/testbed/map/ground-y');
  assert.equal(JSON.parse(calls[4][1].body).ground_y, 0);
});

test('đọc và xóa giữ nguyên URL truy vấn dự án', async (t) => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (...args) => {calls.push(args); return {};});
  await loadTestbedMap(4);
  await loadTestbedCharacters(4);
  await deleteTestbedMap(4);
  await deleteTestbedCharacter(8, 4);
  assert.deepEqual(calls, [
    ['/api/testbed/map?project_id=4'], ['/api/testbed/characters?project_id=4'],
    ['/api/testbed/map?project_id=4', {method: 'DELETE'}],
    ['/api/testbed/characters/8?project_id=4', {method: 'DELETE'}]
  ]);
});

test('xuất Godot gửi multipart đủ trường và giữ lỗi máy chủ hoặc lỗi dự phòng', async (t) => {
  const requests = [];
  const archive = new Blob(['zip']);
  let errorResponse = null;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push([url, options]);
    if (url === 'blob:sheet') return {blob: async () => new Blob(['sheet'])};
    return errorResponse || {ok: true, blob: async () => archive};
  });
  const character = {sheetUrl: 'blob:sheet', name: 'Hiệp sĩ', rows: 3, columns: 5, fps: 8, moveSpeed: 140};
  assert.equal(await exportGodotArchive(character), archive);
  const [url, options] = requests[1];
  assert.equal(url, '/api/export-godot');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers, undefined);
  assert.equal(options.body.get('file').name, 'character_sheet.png');
  assert.deepEqual([...options.body.keys()], ['file', 'rows', 'columns', 'fps', 'move_speed', 'character_name', 'auto_anchor']);
  assert.equal(options.body.get('character_name'), 'Hiệp_sĩ');
  errorResponse = {ok: false, json: async () => ({detail: 'Denied'})};
  await assert.rejects(exportGodotArchive(character), {message: 'Denied'});
  errorResponse = {ok: false, json: async () => {throw new Error('invalid json');}};
  await assert.rejects(exportGodotArchive(character), {message: 'Không thể đóng gói tài nguyên Godot từ máy chủ.'});
});
