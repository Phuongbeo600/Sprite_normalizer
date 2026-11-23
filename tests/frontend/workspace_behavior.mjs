// 1. THƯ VIỆN NỀN TẢNG JAVASCRIPT
// Bộ kiểm thử và trình giả lập thực thi mã giao diện trong Node.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';

// 2. THƯ VIỆN BÊN NGOÀI
// Dùng bộ chuyển đổi JSX đã có sẵn trong phụ thuộc Vite.
import { transformSync } from '../../frontend/node_modules/esbuild/lib/main.js';

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Đường dẫn component được nạp với API trình duyệt và React giả lập.
const workspacePath = resolve('frontend/src/features/workspace/Workspace.jsx');

// 4. ĐỊNH DẠNG GIAO DIỆN VÀ CẤU HÌNH
// Không cần CSS để kiểm tra các hợp đồng trạng thái và lệnh.

/**
 * Tạo môi trường hook tối thiểu để kiểm chứng điều phối mà không thêm phụ thuộc.
 * @param {Object} props Dữ liệu chuyển vào bàn làm việc.
 * @returns {Object} Bộ điều khiển render và API giả lập.
 */
function mountWorkspace(props = {}) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  let tree;
  const images = [];
  const calls = [];
  const revoked = [];
  let nextUrl = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(callback, deps) { effects.push({ callback, deps }); },
  };
  const jsx = (type, props) => ({ type, props: props || {} });
  const api = {
    async analyzeSpriteColors(file) { calls.push(['palette', file]); return { palette_metrics: { libresprite_palette: ['#abcdef', '#123456'] } }; },
    async processImage(file, command, fields) {
      calls.push([command, file, fields]);
      return { json: async () => command === 'detect-resolution' ? { width: 20, height: 10, scale: 1 } : { frames: [{ png: 'AA==', name: 'frame.png', width: 20, height: 10 }] }, blob: async () => new Blob(['png']) };
    },
    async batchResizeSheetFrames(fields) { calls.push(['batch', fields]); return { frames: [{ png: 'AA==' }], target_width: 8, target_height: 4, frame_count: 1 }; },
    async saveSlicedPackToVault(fields) { calls.push(['save', fields]); return { frame_count: 1, folder_name: fields.folderName }; },
  };
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const module = { exports: {} };
    cache.set(path, module.exports);
    const code = transformSync(readFileSync(path, 'utf8'), { loader: path.endsWith('.jsx') ? 'jsx' : 'js', format: 'cjs', jsx: 'automatic' }).code;
    const sandbox = {
      module, exports: module.exports, console, Blob, File, Uint8Array, Uint32Array, AbortController, atob,
      Image: class { constructor() { images.push(this); } },
      URL: { createObjectURL: () => `blob:test-${++nextUrl}`, revokeObjectURL: (url) => revoked.push(url) },
      setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
      window: { addEventListener() {}, removeEventListener() {} },
      document: { createElement: () => ({ click() { calls.push(['download', this.download]); } }) },
      require(id) {
        if (id === 'react') return react;
        if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
        if (id === 'lucide-react') return new Proxy({}, { get: (_, name) => `icon:${String(name)}` });
        if (id.endsWith('.css')) return {};
        if (id.includes('workspaceApi')) return api;
        if (['PixelCanvas', 'ManualSheetGrid', 'WorkspaceTimeline', 'PaletteDock', 'DrawingToolbar'].some((name) => id.endsWith(name))) {
          return { default: id, __esModule: true };
        }
        const base = resolve(dirname(path), id);
        const target = /\.(js|jsx)$/.test(base) ? base : (() => { try { readFileSync(`${base}.js`); return `${base}.js`; } catch { return `${base}.jsx`; } })();
        return load(target);
      },
    };
    vm.runInNewContext(code, sandbox, { filename: path });
    cache.set(path, module.exports);
    return module.exports;
  }
  const Workspace = load(workspacePath).default;
  function render() { cursor = 0; effects = []; tree = Workspace(props); return tree; }
  function nodes(node) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap((child) => nodes(child));
    if (typeof node.type === 'function') return nodes(node.type(node.props));
    return [node, ...nodes(node.props?.children)];
  }
  render();
  return { render, nodes: () => nodes(tree), images, calls, revoked, effects: () => effects, props };
}

/** @returns {Promise<void>} Đợi các nhánh Promise của API giả lập hoàn tất. */
async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); }

/** @param {Object} rig Môi trường kiểm thử. @returns {Object} Các thuộc tính bảng màu. */
function palette(rig) { return rig.nodes().find((node) => node.type === './components/PaletteDock').props; }

/** @param {Object} rig Môi trường kiểm thử. @param {string} text Nhãn nút. @returns {Object} Nút tìm thấy. */
function button(rig, text) {
  const textOf = (node) => Array.isArray(node) ? node.map(textOf).join('') : typeof node === 'object' && node ? textOf(node.props?.children) : String(node ?? '');
  return rig.nodes().find((node) => node.type === 'button' && textOf(node).includes(text));
}

test('mở ảnh đặt lại ô tệp, dùng kích thước giải mã mới nhất và tái quét bảng màu', async () => {
  const rig = mountWorkspace();
  const upload = rig.nodes().find((node) => node.type === 'input' && node.props.type === 'file');
  const first = new File(['a'], 'first.png');
  const second = new File(['b'], 'second.png');
  const event = { target: { files: [first], value: 'first.png' } };
  upload.props.onChange(event);
  assert.equal(event.target.value, '');
  upload.props.onChange({ target: { files: [second], value: 'second.png' } });
  Object.assign(rig.images[0], { naturalWidth: 99, naturalHeight: 99 });
  rig.images[0].onload();
  Object.assign(rig.images[1], { naturalWidth: 20, naturalHeight: 10 });
  rig.images[1].onload();
  await settle();
  rig.render();
  assert.equal(rig.nodes().find((node) => node.type === 'span' && node.props.title === 'second.png')?.props.children, 'second.png');
  assert.deepEqual([...palette(rig).paletteColors], ['#abcdef', '#123456']);
  assert.equal(palette(rig).activeColor, '#abcdef');
  const lifecycle = rig.effects().filter(({ deps }) => deps?.[0] === 'blob:test-2');
  assert.equal(lifecycle.length, 1);
  lifecycle[0].callback()();
  assert.deepEqual(rig.revoked, ['blob:test-2']);
});

test('bảng màu giữ quy tắc thêm HEX viết tắt, trùng màu và xóa ô lân cận', () => {
  const rig = mountWorkspace();
  palette(rig).onAddColor('#ABC');
  rig.render();
  palette(rig).onAddColor('#aabbcc');
  rig.render();
  assert.deepEqual([...palette(rig).paletteColors], ['#aabbcc', '#aabbcc']);
  palette(rig).onDeleteColor(0);
  rig.render();
  assert.deepEqual([...palette(rig).paletteColors], ['#aabbcc']);
  palette(rig).onDeleteColor(0);
  rig.render();
  assert.equal(palette(rig).paletteColors.length, 1);
});

test('nạp bộ frame chuyển tiếp bảo toàn biên, dữ liệu xuất ZIP và lưu kho', async () => {
  const file = new File(['sheet'], 'hero.png');
  const rig = mountWorkspace({ currentProject: { id: 7 }, incomingFile: file, incomingPalette: ['#ff0000'], incomingSheetData: {
    rows: 1, columns: 2, fps: 12, autoAnchor: true, regularGridSize: { width: 40, height: 10 }, frames: [{ url: 'data:frame', name: 'frame.png', width: 20, height: 10 }],
  } });
  rig.effects().find(({ deps }) => deps?.[0] === file).callback();
  Object.assign(rig.images[0], { naturalWidth: 40, naturalHeight: 10 });
  rig.images[0].onload();
  rig.render();
  assert.equal(rig.calls.filter(([command]) => command === 'palette').length, 0);
  await button(rig, 'Tải tất cả (ZIP)').props.onClick();
  const exported = rig.calls.find(([command]) => command === 'slice-sheet')[2];
  assert.equal(exported.x_cuts_json, '[0,20,40]');
  assert.equal(exported.y_cuts_json, '[0,10]');
  assert.equal(exported.auto_anchor, true);
  button(rig, 'Lưu bộ Frame vào Thư mục').props.onClick();
  rig.render();
  const folderInput = rig.nodes().find((node) => node.type === 'input' && node.props.type === 'text');
  assert.equal(folderInput.props.value, 'hero_1x2');
  await button(rig, 'Xác nhận Lưu vào Kho').props.onClick();
  const saved = rig.calls.find(([command]) => command === 'save')[1];
  assert.equal(saved.projectId, 7);
  assert.equal(saved.fps, 12);
  assert.equal(JSON.stringify(saved.cuts), JSON.stringify({ x: [0, 20, 40], y: [0, 10] }));
});



test('lỗi giải mã cũ bị bỏ qua còn lỗi ảnh hiện tại dùng đúng thông báo', () => {
  const rig = mountWorkspace();
  const upload = rig.nodes().find((node) => node.type === 'input' && node.props.type === 'file');
  upload.props.onChange({ target: { files: [new File(['a'], 'first.png')], value: '' } });
  upload.props.onChange({ target: { files: [new File(['b'], 'second.png')], value: '' } });
  rig.images[0].onerror();
  rig.render();
  assert.equal(rig.nodes().some((node) => node.props.role === 'alert'), false);
  rig.images[1].onerror();
  rig.render();
  assert.equal(rig.nodes().find((node) => node.props.role === 'alert').props.children, 'Không đọc được ảnh. Hãy chọn tệp PNG, JPEG hoặc WebP hợp lệ.');
});

test('ép frame giữ biên gốc và dùng kích thước mới cho ZIP, tên gói và lưu kho', async () => {
  const file = new File(['sheet'], 'hero.png');
  const rig = mountWorkspace({ currentProject: { id: 7 }, incomingFile: file, incomingPalette: ['#ff0000'], incomingSheetData: {
    rows: 1, columns: 2, regularGridSize: { width: 40, height: 10 }, frames: [{ url: 'data:frame', name: 'frame.png', width: 20, height: 10 }],
  } });
  rig.effects().find(({ deps }) => deps?.[0] === file).callback();
  Object.assign(rig.images[0], { naturalWidth: 40, naturalHeight: 10 });
  rig.images[0].onload();
  rig.render();
  await button(rig, 'Ép toàn bộ').props.onClick();
  rig.render();
  const batch = rig.calls.find(([command]) => command === 'batch')[1];
  assert.equal(JSON.stringify(batch.cuts), JSON.stringify({ x: [0, 20, 40], y: [0, 10] }));
  await button(rig, 'Tải tất cả (ZIP)').props.onClick();
  const exported = rig.calls.find(([command]) => command === 'slice-sheet')[2];
  assert.equal(exported.target_width, 8);
  assert.equal(exported.target_height, 4);
  assert.ok(rig.calls.some(([command, name]) => command === 'download' && name === 'hero-frames_8x4.zip'));
  button(rig, 'Lưu bộ Frame vào Thư mục').props.onClick();
  rig.render();
  assert.equal(rig.nodes().find((node) => node.type === 'input' && node.props.type === 'text').props.value, 'hero_1x2_8x4');
  await button(rig, 'Xác nhận Lưu vào Kho').props.onClick();
  const saved = rig.calls.find(([command]) => command === 'save')[1];
  assert.equal(saved.targetWidth, 8);
  assert.equal(saved.targetHeight, 4);
  button(rig, 'Cắt frame hoạt họa').props.onClick();
  await settle();
  rig.render();
  await button(rig, 'Tải tất cả (ZIP)').props.onClick();
  const resliced = rig.calls.filter(([command]) => command === 'slice-sheet').at(-1)[2];
  assert.equal(resliced.target_width, undefined);
});
