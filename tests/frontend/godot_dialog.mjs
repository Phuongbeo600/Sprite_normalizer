// 1. THƯ VIỆN NỀN TẢNG JAVASCRIPT
// So sánh toàn bộ DOM tĩnh với kết quả đã ghi nhận trước khi gom công cụ hàng.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// 2. THƯ VIỆN BÊN NGOÀI
// Tái sử dụng esbuild và React đã có trong frontend, không thêm phụ thuộc.
const requireFrontend = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { buildSync } = requireFrontend('esbuild');
const { renderToStaticMarkup } = requireFrontend('react-dom/server');

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Biên dịch hộp thoại thật cùng icon và định nghĩa ô.
const file = new URL('../../frontend/src/features/godot-testbed/renderSlotTemplateDialog.jsx', import.meta.url);
const code = buildSync({stdin: {contents: readFileSync(file, 'utf8'), resolveDir: dirname(fileURLToPath(file)), loader: 'jsx'}, bundle: true, platform: 'node', format: 'cjs', write: false, external: ['react']}).outputFiles[0].text;
const mod = {exports: {}};
new Function('require', 'module', 'exports', code)(requireFrontend, mod, mod.exports);

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Dấu vân tay được lấy từ phiên bản trước refactor cho cả hai chế độ.
const expected = {'1_row': '1aa2d92547d0fa6b88d2e2261cb0998f0bcb82a0cc8d35559eee98cae1f0ea88', '3_rows': '6838b35042b198820d8b160175ba8f350d5512bc1845e15e77a2e98e10d279d3'};
for (const slotMode of ['1_row', '3_rows']) {
  test(`hộp thoại ${slotMode} giữ nguyên DOM, nhãn, nút và style trước refactor`, () => {
    const options = {slotMode, editingCharIdx: null, stagedCharName: 'Hero', stagedFps: 8, slotsData: {}, dragOverSlot: null, previewDownCanvasRef: {current: null}, previewSideCanvasRef: {current: null}, previewUpCanvasRef: {current: null}};
    const html = renderToStaticMarkup(mod.exports.renderSlotTemplateDialog(options));
    assert.equal(createHash('sha256').update(html).digest('hex'), expected[slotMode]);
  });
}
