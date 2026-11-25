// 1. THƯ VIỆN NỀN TẢNG (Kiểm thử HTTP và quyền truy cập)
// assert, test: Xác nhận token và thông báo lỗi của hồ sơ mẫu.
import assert from 'node:assert/strict';
import test from 'node:test';

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Transport và phiên phân tích)
import { requestVisionStatus, requestAnalysis, requestProfilePrompt, requestSavePreset } from '../../frontend/src/features/character-analysis/analysisApi.js';
import { mountHook } from './helpers/hookHarness.mjs';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)

test('hồ sơ mẫu gửi token ở bước đọc trạng thái, tải ảnh, sinh prompt và lưu hồ sơ', async () => {
  const previousFetch = globalThis.fetch;
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const calls = [];
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true,
      value: { getItem: () => JSON.stringify({ access_token: 'analysis-session' }) } });
    globalThis.fetch = async (url, options) => {
      calls.push({ url, ...options });
      return new Response('{"ready":true}');
    };
    const controller = new AbortController();
    await requestVisionStatus('?project_id=9', controller.signal);
    await requestAnalysis(new Blob(['sprite']), '/api/character-profile/style-prompt', { project_id: 9 });
    await requestProfilePrompt({ projectId: 9, profileData: {}, metrics: {}, newCharConfig: {} });
    await requestSavePreset(9, { name: 'Mẫu' });
    for (const call of calls) assert.equal(call.headers?.Authorization, 'Bearer analysis-session');
    assert.equal(calls[0].signal, controller.signal);
    assert.equal(calls[1].headers['Content-Type'], undefined);
    assert.equal(calls[1].body.get('project_id'), '9');
    assert.equal(calls[2].headers['Content-Type'], 'application/json');
  } finally {
    globalThis.fetch = previousFetch;
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
    else delete globalThis.localStorage;
  }
});

test('lỗi đăng nhập từ backend được giữ nguyên khi đọc trạng thái AI', async () => {
  const detail = 'Yêu cầu đăng nhập để truy cập tài nguyên của dự án này.';
  const session = mountHook('frontend/src/features/character-analysis/useAnalysisSession.js', 'useAnalysisSession', {
    currentProject: { id: 9 }, isActive: true,
  }, {}, {
    './analysisApi': { requestVisionStatus: async () => ({ ok: false, json: async () => ({ detail }) }) },
  });
  session.value.setWorkspaceMode('dna_profile');
  session.render();
  session.flushEffects();
  await new Promise((resolve) => setImmediate(resolve));
  session.render();
  assert.equal(session.value.visionStatus, 'error');
  assert.equal(session.value.visionError, detail);
  session.unmount();
});
