// 1. THƯ VIỆN NỀN TẢNG (Đối chiếu HTML trước và sau khi tách dialog)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// 2. THƯ VIỆN BÊN NGOÀI (Dùng công cụ và React đã có của frontend)
import { build } from '../../frontend/node_modules/esbuild/lib/main.js';

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Giữ các export tương thích của kho tài nguyên)
const require = createRequire(resolve('frontend/package.json'));
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const result = await build({ entryPoints: ['frontend/src/features/project-assets/renderAssetDetails.jsx'],
  bundle: true, platform: 'node', format: 'cjs', external: ['react'], write: false });
const module = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports);

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Dấu vân tay HTML được đo trước khi tách)
const baseline = {
  renderPresetDetail: 'dc1ed21b64c44fb7f49d71ef786682ab66149a99b1112d108839df2bcd1f6bf5',
  renderSpriteDetail: '2c85a3e4be74249702643caa4b583831b8acab1902b99dd0934587e3545149c3',
  renderCharacterDetail: 'e8464719717e5747b3ab0b8d68f8503e30b265836a87f5d31d2ccf67bb219897',
  renderMapDetail: '06c15339e9689c2942225b410e728bed97ddd3d9ef0a401d5161ab411ef0c20a',
};
const fixture = { id: 1, name: 'Mage', created_at: '2026-01-01', metrics_data: {},
  frame_actions_data: {}, slot_frames: {}, processing_metadata: {}, frames: [], map_image_base64: 'abc' };

for (const [name, expected] of Object.entries(baseline)) {
  test(`${name} giữ nguyên HTML, lớp CSS và nội dung của baseline`, () => {
    const props = { selectedPreset: fixture, selectedSprite: fixture, selectedCharacter: fixture,
      selectedMap: fixture, projectId: 2, onClose() {} };
    const html = renderToStaticMarkup(React.createElement(module.exports[name], props));
    assert.equal(createHash('sha256').update(html).digest('hex'), expected);
  });
}
