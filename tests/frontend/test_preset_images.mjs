// 1. THƯ VIỆN NỀN TẢNG (Kiểm thử ảnh và trạng thái hồ sơ)
// test, assert: Xác nhận ảnh không mất khi lưu và mở lại phiên làm việc.
import test from 'node:test';
import assert from 'node:assert/strict';
// createRequire, resolve: Dùng React và công cụ đóng gói của frontend hiện tại.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// 2. THƯ VIỆN BÊN NGOÀI (Dựng giao diện thật để kiểm tra ảnh)
import { build } from '../../frontend/node_modules/esbuild/lib/main.js';

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Phiên Studio thật)
import { mountHook } from './helpers/hookHarness.mjs';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Ảnh giả lập ngoại tuyến)
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const bytes = Buffer.from(image.split(',')[1], 'base64');
const hook = 'frontend/src/features/character-analysis/useAnalysisSession.js';
const props = { currentProject: { id: 9 }, isActive: false };
const globals = { btoa, atob, setTimeout: () => 0 };
const requireFrontend = createRequire(resolve('frontend/package.json'));
const React = requireFrontend('react');
const { renderToStaticMarkup } = requireFrontend('react-dom/server');
const result = await build({ entryPoints: {
  list: 'frontend/src/features/project-assets/PresetAssetList.jsx',
  detail: 'frontend/src/features/project-assets/PresetDetailsDialog.jsx',
}, outdir: 'unused-test-output', bundle: true, platform: 'node', format: 'cjs', external: ['react'], write: false });
const components = {};
for (const name of ['list', 'detail']) {
  const module = { exports: {} };
  const code = result.outputFiles.find((file) => file.path.endsWith(`${name}.js`)).text;
  new Function('require', 'module', 'exports', code)(requireFrontend, module, module.exports);
  components[name] = module.exports.default;
}

test('lưu hồ sơ gửi ảnh tham chiếu nhị phân dưới dạng Data URL cùng prompt và số đo', async () => {
  let payload;
  const errors = [];
  const session = mountHook(hook, 'useAnalysisSession', props, {
    ...globals, alert: (message) => errors.push(message),
    fetch: async (url, options) => {
      payload = JSON.parse(options.body);
      return Response.json({ status: 'success', data: { id: 7 } });
    },
  });
  try {
    session.value.handleReferenceChange({ target: { files: [new File([bytes], 'mage.png', { type: 'image/png' })], value: 'mage.png' } });
    session.render();
    await session.value.handleSavePreset({ positive_prompt: 'pixel mage', negative_prompt: 'blur', new_character_concept: 'Mage' });
    session.render();
    assert.equal(payload.reference_image, image);
    assert.equal(payload.sprite_name, 'mage.png');
    assert.equal(payload.positive_prompt, 'pixel mage');
    assert.equal(payload.negative_prompt, 'blur');
    assert.deepEqual(errors, []);
  } finally { session.unmount(); }
});

test('mở lại hồ sơ khôi phục ảnh, File, prompt và dữ liệu cũ; lưu tiếp không mất ảnh', async () => {
  let saved;
  const preset = { reference_image: image, sprite_name: 'old-mage.png', positive_prompt: 'saved positive',
    negative_prompt: 'saved negative', metrics_data: { heads_tall: 4 },
    profile_data: { reference_style: { style_prompt: 'selout' } }, frame_actions_data: { down: {} } };
  const session = mountHook(hook, 'useAnalysisSession', { ...props, loadedPresetData: preset }, {
    ...globals, fetch: async (url, options) => { saved = JSON.parse(options.body); return Response.json({ status: 'success' }); },
    alert: (message) => assert.fail(message),
  });
  try {
    session.flushEffects(); session.render();
    assert.equal(session.value.reference.name, 'old-mage.png');
    assert.equal(session.value.reference.url, image);
    assert.equal(session.value.reference.file.type, 'image/png');
    assert.deepEqual(Buffer.from(await session.value.reference.file.arrayBuffer()), bytes);
    assert.equal(session.value.metrics.heads_tall, 4);
    assert.equal(session.value.profileData.reference_style.style_prompt, 'selout');
    assert.equal(session.value.generatedProfilePrompt.positive_prompt, 'saved positive');
    assert.deepEqual(JSON.parse(JSON.stringify(session.value.loadedPresetConfig.frame_actions_data)), { down: {} });
    await session.value.handleSavePreset({ new_character_concept: 'Updated mage' });
    assert.equal(saved.reference_image, image);
    assert.equal(saved.sprite_name, 'old-mage.png');
    assert.equal(saved.positive_prompt, 'saved positive');
  } finally { session.unmount(); }
});

test('hồ sơ cũ không có ảnh vẫn nạp prompt và giữ ảnh rỗng', () => {
  const session = mountHook(hook, 'useAnalysisSession', { ...props,
    loadedPresetData: { positive_prompt: 'legacy prompt', negative_prompt: '', profile_data: {} } }, globals);
  try {
    session.flushEffects(); session.render();
    assert.equal(session.value.reference, null);
    assert.equal(session.value.generatedProfilePrompt.positive_prompt, 'legacy prompt');
  } finally { session.unmount(); }
});

test('không đọc được ảnh thì báo lỗi và không lưu hồ sơ thiếu ảnh', async () => {
  const errors = [];
  let requests = 0;
  class UnreadableFile extends File {
    /** Mô phỏng tệp đã bị mất quyền đọc sau khi người dùng chọn ảnh. */
    arrayBuffer() { return Promise.reject(new Error('Không đọc được tệp ảnh.')); }
  }
  const session = mountHook(hook, 'useAnalysisSession', props, {
    ...globals, alert: (message) => errors.push(message), fetch: async () => { requests++; },
  });
  try {
    session.value.handleReferenceChange({ target: { files: [new UnreadableFile([bytes], 'mage.png', { type: 'image/png' })], value: '' } });
    session.render();
    await session.value.handleSavePreset({ positive_prompt: 'pixel mage' });
    session.render();
    assert.equal(requests, 0);
    assert.equal(session.value.savingPreset, false);
    assert.deepEqual(errors, ['Không đọc được tệp ảnh.']);
  } finally { session.unmount(); }
});

for (const view of ['list', 'detail']) {
  test(`ảnh lưu cùng hồ sơ xuất hiện trong ${view === 'list' ? 'danh sách' : 'chi tiết'} khi mở lại dự án`, () => {
    const preset = { id: 7, name: 'Mage', sprite_name: 'mage.png', reference_image: image,
      positive_prompt: 'pixel mage', negative_prompt: 'blur' };
    const html = renderToStaticMarkup(React.createElement(components[view], {
      presets: [preset], selectedPreset: preset, loading: false, onClose() {},
    }));
    assert.ok(html.includes(`src="${image}"`));
    assert.match(html, /<img[^>]+alt="[^"]*mage.png/);
  });
}
