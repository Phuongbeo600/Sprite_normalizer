// 1. THƯ VIỆN NỀN TẢNG JAVASCRIPT
// Node kiểm tra dữ liệu điểm ảnh và xuất ảnh mà không cần trình duyệt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// 2. THƯ VIỆN BÊN NGOÀI
// Dùng bộ chuyển đổi JSX đã có sẵn trong phụ thuộc Vite.
import { transformSync } from '../../frontend/node_modules/esbuild/lib/main.js';

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Các thao tác được dùng bởi PixelCanvas.
import * as pixelImage from '../../frontend/src/features/workspace/pixelCanvasImage.js';
import { hexToRgbaArray, fillConnectedPixels, emitCanvasImage } from '../../frontend/src/features/workspace/pixelCanvasImage.js';

// 4. ĐỊNH DẠNG GIAO DIỆN VÀ CẤU HÌNH
// Không áp dụng cho kiểm thử dữ liệu ảnh.

test('đổi HEX giữ quy tắc màu viết tắt và giá trị dự phòng', () => {
  assert.deepEqual(hexToRgbaArray('#abc'), [170, 187, 204, 255]);
  assert.deepEqual(hexToRgbaArray('#12abEF'), [18, 171, 239, 255]);
  assert.deepEqual(hexToRgbaArray('invalid'), [0, 0, 0, 255]);
});

test('đổ màu chỉ đi bốn hướng và giữ các vùng tách bởi viền', () => {
  const imageData = { data: new Uint8ClampedArray([
    1, 2, 3, 255, 0, 0, 0, 255, 1, 2, 3, 255,
    1, 2, 3, 255, 0, 0, 0, 255, 1, 2, 3, 255,
    0, 0, 0, 255, 1, 2, 3, 255, 1, 2, 3, 255,
  ]) };
  assert.equal(fillConnectedPixels(imageData, 3, 3, 0, 0, [20, 30, 40, 255]), true);
  const pixels = Array.from({ length: 9 }, (_, index) => [...imageData.data.slice(index * 4, index * 4 + 4)]);
  assert.deepEqual(pixels[0], [20, 30, 40, 255]);
  assert.deepEqual(pixels[3], [20, 30, 40, 255]);
  for (const index of [2, 5, 7, 8]) assert.deepEqual(pixels[index], [1, 2, 3, 255]);
  assert.deepEqual(pixels[1], [0, 0, 0, 255]);
});

test('đổ màu trong suốt và nhánh không đổi giữ nguyên quy tắc bộ đệm', () => {
  const imageData = { data: new Uint8ClampedArray(8) };
  assert.equal(fillConnectedPixels(imageData, 2, 1, 0, 0, [0, 0, 0, 0]), false);
  assert.equal(fillConnectedPixels(imageData, 2, 1, 0, 0, [8, 9, 10, 80]), true);
  assert.deepEqual([...imageData.data], [8, 9, 10, 80, 8, 9, 10, 80]);
});

test('xuất PNG đánh dấu URL trước callback và bỏ qua Blob rỗng', () => {
  const ref = { current: null };
  const blob = new Blob(['png']);
  const calls = [];
  const canvas = { toBlob(callback, mime) { calls.push(mime); callback(blob); } };
  emitCanvasImage(canvas, (received, url) => {
    assert.equal(received, blob);
    assert.equal(ref.current, url);
    assert.match(url, /^blob:/);
    URL.revokeObjectURL(url);
  }, ref);
  assert.deepEqual(calls, ['image/png']);
  emitCanvasImage({ toBlob(callback) { callback(null); } }, () => assert.fail('Blob rỗng không phát callback'), ref);
  emitCanvasImage({ toBlob() { assert.fail('Không có callback thì không xuất ảnh'); } }, undefined, ref);
});

/**
 * Nạp PixelCanvas với canvas và hook giả lập để kiểm chứng lịch sử thao tác.
 * @returns {Object} Component đã gắn ref và các lệnh điều khiển.
 */
function mountPixelCanvas() {
  const slots = [];
  const effects = [];
  const images = [];
  const notifications = [];
  const modified = [];
  let cursor = 0;
  let tree;
  let pixels = new Uint8ClampedArray(4);
  let urlCounter = 0;
  const reference = { current: null };
  const props = {
    imageUrl: 'original.png', activeTool: 'pencil', activeColor: '#ff0000',
    onHistoryChange: (state) => notifications.push(state),
    onImageModified: (blob, url) => modified.push({ blob, url }),
  };
  const ctx = {
    getImageData() { return { data: pixels.slice() }; },
    putImageData(snapshot) { pixels = snapshot.data.slice(); },
    clearRect() { pixels.fill(0); },
    drawImage() { pixels.set([1, 2, 3, 255]); },
    fillRect() { pixels.set([255, 0, 0, 255]); },
  };
  const canvas = {
    width: 1, height: 1,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    toBlob: (callback) => callback(new Blob([pixels])),
  };
  const react = {
    useRef(initial) { const index = cursor++; return slots[index] ||= { current: initial }; },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value) => { slots[index] = value; }];
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, offset) => slots[index].deps[offset] !== value)) slots[index] = { callback, deps };
      return slots[index].callback;
    },
    useEffect(callback, deps) { effects.push({ callback, deps }); },
    useImperativeHandle(ref, create) { ref.current = create(); },
    forwardRef: (component) => component,
  };
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  const code = transformSync(readFileSync('frontend/src/features/workspace/components/PixelCanvas.jsx', 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic' }).code;
  vm.runInNewContext(code, {
    module, exports: module.exports, Blob, Uint32Array,
    Image: class { constructor() { images.push(this); this.naturalWidth = 1; this.naturalHeight = 1; } },
    URL: { createObjectURL: () => `blob:pixel-${++urlCounter}` },
    require(id) {
      if (id === 'react') return react;
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (id === '../pixelCanvasImage') return {
        ...pixelImage,
        emitCanvasImage(canvas, callback, ref) {
          if (callback) canvas.toBlob((blob) => {
            if (blob) {
              const url = `blob:pixel-${++urlCounter}`;
              ref.current = url;
              callback(blob, url);
            }
          }, 'image/png');
        },
      };
      throw new Error(id);
    },
  });
  function render() {
    cursor = 0;
    effects.length = 0;
    tree = module.exports.default(props, reference);
    tree.props.children[0].props.ref.current = canvas;
  }
  const event = { clientX: 0, clientY: 0, button: 0, currentTarget: {}, stopPropagation() {} };
  render();
  effects[0].callback();
  images[0].onload();
  return {
    render, props, effects, images, notifications, modified, reference,
    stroke() { tree.props.onPointerDown(event); tree.props.onPointerUp(event); },
    pixel: () => [...pixels],
  };
}

test('PixelCanvas hoàn tác, làm lại và URL tự sinh giữ lịch sử cùng callback hiện có', () => {
  const rig = mountPixelCanvas();
  assert.equal(rig.notifications.at(-1).canUndo, false);
  rig.stroke();
  assert.deepEqual(rig.pixel(), [255, 0, 0, 255]);
  assert.equal(rig.modified.length, 1);
  rig.reference.current.undo();
  assert.deepEqual(rig.pixel(), [1, 2, 3, 255]);
  assert.equal(rig.notifications.at(-1).canRedo, true);
  rig.reference.current.redo();
  assert.deepEqual(rig.pixel(), [255, 0, 0, 255]);
  assert.equal(rig.modified.length, 3);
  rig.props.imageUrl = rig.modified.at(-1).url;
  rig.render();
  rig.effects[0].callback();
  assert.equal(rig.images.length, 1);
  assert.equal(rig.notifications.at(-1).canUndo, true);
  rig.reference.current.undo();
  rig.stroke();
  assert.equal(rig.notifications.at(-1).canRedo, false);
});

test('PixelCanvas giới hạn 30 snapshot và không phát ảnh khi hoàn tác vượt biên', () => {
  const rig = mountPixelCanvas();
  for (let index = 0; index < 35; index++) rig.stroke();
  const before = rig.modified.length;
  for (let index = 0; index < 35; index++) rig.reference.current.undo();
  assert.equal(rig.modified.length - before, 29);
  assert.equal(rig.notifications.at(-1).canUndo, false);
  assert.equal(rig.notifications.at(-1).canRedo, true);
});
