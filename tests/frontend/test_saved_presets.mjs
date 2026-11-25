// 1. THƯ VIỆN NỀN TẢNG (Kiểm thử phiên và phản hồi HTTP)
import assert from 'node:assert/strict';
import test from 'node:test';

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Chạy hook và transport thật)
import { mountHook } from './helpers/hookHarness.mjs';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Dữ liệu ngoại tuyến)
const tick = () => new Promise((resolve) => setImmediate(resolve));
const root = 'frontend/src/features/';

test('lưu prompt trong Studio rồi mở Hồ sơ có thể xem, nạp lại và xóa bản lưu của tài khoản', async () => {
  let saved = null;
  let loaded = null;
  const alerts = [];
  const globals = {
    localStorage: { getItem: () => JSON.stringify({ access_token: 'preset-session' }) },
    alert: (message) => alerts.push(message),
    window: { confirm: () => true },
    setTimeout: () => 0,
    fetch: async (url, options = {}) => {
      if (options.headers?.Authorization !== 'Bearer preset-session') {
        return Response.json({ detail: 'Yêu cầu đăng nhập.' }, { status: 401 });
      }
      if (url === '/api/projects/9/character-presets') {
        if (options.method === 'POST') saved = { id: 17, ...JSON.parse(options.body) };
        return Response.json({ status: 'success', data: options.method === 'POST' ? saved : saved ? [saved] : [] });
      }
      if (url === '/api/projects/9/character-presets/17') {
        if (options.method === 'DELETE') {
          saved = null;
          return Response.json({ status: 'success' });
        }
        return Response.json({ status: 'success', data: saved });
      }
      if (url.startsWith('/api/sprites?')) return Response.json({ sprites: [] });
      if (url.startsWith('/api/testbed/characters?')) return Response.json({ characters: [] });
      if (url.startsWith('/api/testbed/map?')) return Response.json({ status: 'success' });
      throw new Error(`Tuyến ngoài dự kiến: ${url}`);
    },
  };
  const props = { currentProject: { id: 9 }, isActive: true, onLoadPresetToStudio: (preset) => { loaded = preset; } };
  const assets = mountHook(`${root}project-assets/useProjectAssets.js`, 'useProjectAssets', props, globals);
  const studio = mountHook(`${root}character-analysis/useAnalysisSession.js`, 'useAnalysisSession', props, globals);
  try {
    assets.flushEffects(); await tick(); assets.render();
    assets.render({ ...props, isActive: false }); assets.flushEffects();
    await studio.value.handleSavePreset({ name: 'Pháp sư', positive_prompt: 'pixel mage', negative_prompt: 'blur' });
    studio.render();
    assert.match(studio.value.saveSuccessMsg, /Đã lưu thành công/);
    assets.render(props); assets.flushEffects(); await tick(); assets.render();
    assert.equal(assets.value.error, '');
    assert.equal(assets.value.presets.length, 1);
    assert.equal(assets.value.presets[0].positive_prompt, 'pixel mage');
    await assets.value.handleOpenPresetDetail(17); assets.render();
    assert.equal(assets.value.selectedPreset.negative_prompt, 'blur');
    await assets.value.handleLoadPresetToStudio(17);
    assert.equal(loaded.name, 'Pháp sư');
    await assets.value.handleDeletePreset(17, 'Pháp sư'); assets.render();
    assert.equal(assets.value.presets.length, 0);
    assert.equal(assets.value.selectedPreset, null);
    assert.equal(saved, null);
    assert.deepEqual(alerts, []);
  } finally {
    assets.unmount(); studio.unmount();
  }
});

for (const failure of [
  { name: 'hết phiên đăng nhập', fetch: async () => Response.json({ detail: 'Phiên đăng nhập đã hết hạn.' }, { status: 401 }), message: 'Phiên đăng nhập đã hết hạn.' },
  { name: 'mất kết nối', fetch: async () => { throw new Error('Mất kết nối máy chủ.'); }, message: 'Mất kết nối máy chủ.' },
  { name: 'phản hồi lỗi không có JSON', fetch: async () => new Response('Bad Gateway', { status: 502 }), message: 'Không thể tải danh sách tài nguyên.' },
]) {
  test(`Hồ sơ báo lỗi ${failure.name} thay vì coi là tải thành công danh sách rỗng`, async () => {
    const session = mountHook(`${root}project-assets/useProjectAssets.js`, 'useProjectAssets', {
      currentProject: { id: 9 }, isActive: true,
    }, { fetch: failure.fetch });
    try {
      session.flushEffects(); await tick(); session.render();
      assert.equal(session.value.error, failure.message);
      assert.equal(session.value.loading, false);
    } finally {
      session.unmount();
    }
  });
}
