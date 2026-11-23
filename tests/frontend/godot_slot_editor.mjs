// 1. THƯ VIỆN NỀN TẢNG JAVASCRIPT
// Bộ lưu trạng thái tối thiểu chạy hook thật mà không cần DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 2. THƯ VIỆN BÊN NGOÀI
// Không thêm thư viện kiểm thử.

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Nạp hook thật với bộ lưu trạng thái tối thiểu, không chạy hiệu ứng trình duyệt.
import { createRosterState } from '../../frontend/src/features/godot-testbed/testbedSimulation.js';
const source = readFileSync(new URL('../../frontend/src/features/godot-testbed/useSlotTemplateEditor.js', import.meta.url), 'utf8').replace(/^import .*;$/gm, '').replace('export function', 'function');
const createHook = new Function('useState', 'useRef', 'useEffect', 'stitchSlotsToSheet', 'extractSlotsFromSheet', 'createRosterState', `${source}; return useSlotTemplateEditor;`);

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Dữ liệu từng ca được khởi tạo riêng.
function editor(characters = [], stitch = () => null) {
  const values = [];
  let cursor = 0;
  const state = (initial) => {
    const index = cursor++;
    if (!(index in values)) values[index] = initial;
    return [values[index], (next) => {values[index] = typeof next === 'function' ? next(values[index]) : next;}];
  };
  const useEditor = createHook(state, () => ({current: null}), () => {}, stitch, () => ({down_0: 'extracted'}), createRosterState);
  const options = {characters, setCharacters(next) {options.characters = typeof next === 'function' ? next(options.characters) : next;}, setActiveCharIdx(index) {options.activeCharIdx = index;}, currentProject: null, groundY: 540, rosterStateRef: {current: []}, setAddMenuOpen() {}, setErrorMsg(message) {options.error = message;}};
  const render = () => {cursor = 0; return useEditor(options);};
  render.options = options;
  return render;
}

test('hoán đổi ô có ảnh với ô trống giữ hàng khác và không sửa dữ liệu cũ', () => {
  const render = editor();
  const original = {down_0: {url: 'a'}, side_0: {url: 'b'}};
  render().setSlotsData(original);
  render().handleSwapSlots('down_0', 'down_1');
  assert.deepEqual(render().slotsData, {down_1: original.down_0, side_0: original.side_0});
  assert.deepEqual(Object.keys(original), ['down_0', 'side_0']);
});

test('dịch vòng hàng qua ô trống rồi đổi và xóa hàng giữ đúng chỉ mục', () => {
  const render = editor();
  render().setSlotsData({down_4: 'last', side_2: 'side'});
  render().handleShiftRow('down', 1);
  assert.deepEqual(render().slotsData, {down_0: 'last', side_2: 'side'});
  render().handleShiftRow('down', -1);
  render().handleSwapRows('down', 'side');
  assert.deepEqual(render().slotsData, {side_4: 'last', down_2: 'side'});
  render().handleClearRow('down');
  assert.deepEqual(render().slotsData, {side_4: 'last'});
});

test('mở lại phiên sửa tái sử dụng slot và khởi tạo mới xóa dữ liệu phiên trước', () => {
  const slotsData = {down_0: {url: 'saved'}};
  const render = editor([{name: 'Mage', fps: 9, rows: 1, slotsData}]);
  render().handleEditCharacterSlots(0);
  assert.equal(render().editingCharIdx, 0);
  assert.equal(render().stagedCharName, 'Mage');
  assert.equal(render().slotMode, '1_row');
  assert.deepEqual(render().slotsData, slotsData);
  assert.notEqual(render().slotsData, slotsData);
  render().handleOpenSlotTemplateModal();
  assert.equal(render().editingCharIdx, null);
  assert.equal(render().stagedFps, 8);
  assert.equal(render().stagedCharName, 'Hero');
  assert.deepEqual(render().slotsData, {});
});

test('xác nhận sửa giữ tọa độ, chỉ mục, ID và scale của nhân vật', (t) => {
  globalThis.Image = class {set src(value) {this.onload();}};
  t.after(() => {delete globalThis.Image;});
  const character = {id: 'saved', name: 'Mage', rows: 3, fps: 8, scale: 1.5, moveSpeed: 99, slotsData: {down_0: {url: 'data:image/png;base64,a'}}};
  const render = editor([character], () => ({dataUrl: 'data:sheet', rows: 3, columns: 5, cellW: 40, cellH: 60}));
  const state = createRosterState(123, 456);
  render.options.rosterStateRef.current = [state];
  render().handleEditCharacterSlots(0);
  render().setStagedCharName('  Changed  ');
  render().handleConfirmSlotTemplate();
  assert.equal(render.options.characters.length, 1);
  assert.equal(render.options.characters[0].id, 'saved');
  assert.equal(render.options.characters[0].scale, 1.5);
  assert.equal(render.options.characters[0].moveSpeed, 99);
  assert.equal(render.options.characters[0].name, 'Changed');
  assert.equal(render.options.rosterStateRef.current[0], state);
  assert.equal(state.x, 123);
  assert.equal(state.y, 456);
  assert.equal(render().isSlotModalOpen, false);
});

test('xác nhận nhân vật mới nối đúng chỉ mục ảnh và trạng thái vận động', (t) => {
  globalThis.Image = class {set src(value) {this.onload();}};
  t.after(() => {delete globalThis.Image;});
  const render = editor([], () => ({dataUrl: 'data:sheet', rows: 1, columns: 5, cellW: 40, cellH: 60}));
  render().setSlotsData({down_0: {url: 'data:image/png;base64,a'}});
  render().handleConfirmSlotTemplate();
  assert.equal(render.options.characters.length, 1);
  assert.equal(render.options.rosterStateRef.current.length, 1);
  assert.equal(render.options.activeCharIdx, 0);
  assert.equal(render.options.characters[0].name, 'Hero');
  assert.deepEqual(render.options.rosterStateRef.current[0], createRosterState(160, 540));
});
