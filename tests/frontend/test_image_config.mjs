// 1. THƯ VIỆN NỀN TẢNG (Kiểm thử hợp đồng cấu hình tạo ảnh)
// test và assert: Kiểm tra JWT và nguồn cấu hình hệ thống, dự án.
import test from 'node:test';
import assert from 'node:assert/strict';

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (API tạo ảnh và cài đặt)
import { requestImageGenerationStatus, requestGenerateImages } from '../../frontend/src/features/image-generation/imageGenerationApi.js';
import { getProjectApiConfig, saveProjectApiConfig } from '../../frontend/src/shared/api/projectApiConfig.js';
import { mountHook } from './helpers/hookHarness.mjs';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)

test('đọc mặc định tạo ảnh và lưu key riêng đều gửi JWT của tài khoản hiện tại', async () => {
  const previousFetch = globalThis.fetch;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const calls = [];
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true,
      value: { getItem: () => JSON.stringify({ access_token: 'image-session' }) } });
    globalThis.fetch = async (url, options) => {
      calls.push({ url, ...options });
      return new Response('{"config_source":"system","has_key":true}');
    };
    await requestImageGenerationStatus(9);
    await requestGenerateImages({ project_id: 9, prompt: 'Sprite' });
    await getProjectApiConfig(9);
    await saveProjectApiConfig(9, { gemini_api_key: 'private-key' });
    for (const call of calls) assert.equal(call.headers?.Authorization, 'Bearer image-session');
    assert.equal(calls[0].url, '/api/image-gen/status?project_id=9');
    assert.equal(JSON.parse(calls[3].body).gemini_api_key, 'private-key');
  } finally {
    globalThis.fetch = previousFetch;
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('phiên tạo ảnh giữ nguồn mặc định hệ thống để giao diện hiển thị', async () => {
  const session = mountHook('frontend/src/features/image-generation/useImageGeneration.js', 'useImageGeneration', {
    currentProject: { id: 9 },
  }, { fetch: async () => ({ ok: true, json: async () => ({ has_key: true, config_source: 'system', provider: 'gemini' }) }) });
  session.flushEffects();
  await new Promise((resolve) => setImmediate(resolve));
  session.render();
  assert.equal(session.value.configStatus.config_source, 'system');
  session.unmount();
});

test('nút tạo ảnh gửi đồng thời ảnh mẫu, prompt và negative đến backend', async () => {
  const calls = [];
  const reference = 'data:image/png;base64,c3ByaXRl';
  const session = mountHook('frontend/src/features/image-generation/useImageGeneration.js', 'useImageGeneration', {
    currentProject: { id: 9 }, incomingPrompt: '  pixel knight  ',
    incomingNegativePrompt: '  blurry, extra arms  ', incomingImage: reference,
  }, { fetch: async (url, options) => {
    calls.push({ url, ...options });
    return { ok: true, json: async () => url.includes('/status')
      ? { ready: true, provider: 'openai', config_source: 'system' }
      : { images: [{ id: 'new-image' }], provider_used: 'openai' } };
  } });
  session.flushEffects();
  await new Promise((resolve) => setImmediate(resolve));
  session.render();
  await session.value.handleGenerateImage();
  const request = calls.find((call) => call.url === '/api/image-gen/generate');
  const body = JSON.parse(request.body);
  assert.equal(body.image, reference);
  assert.equal(body.prompt, 'pixel knight');
  assert.equal(body.negative_prompt, 'blurry, extra arms');
  session.unmount();
});

test('lỗi nhập key vào model được hiển thị thay vì báo sẵn sàng hoặc thiếu key chung chung', async () => {
  const detail = 'Hãy điền tên model vào IMAGE_GEN_MODEL, không nhập API key.';
  const session = mountHook('frontend/src/features/image-generation/useImageGeneration.js', 'useImageGeneration', {
    currentProject: null,
  }, { fetch: async () => ({ ok: false, status: 400, json: async () => ({ detail }) }) });
  session.flushEffects();
  await new Promise((resolve) => setImmediate(resolve));
  session.render();
  assert.equal(session.value.errorMsg, detail);
  assert.equal(session.value.configStatus, null);
  session.unmount();
});

test('chuyển sang dự án có cấu hình hợp lệ sẽ xóa lỗi cấu hình của dự án trước', async () => {
  const session = mountHook('frontend/src/features/image-generation/useImageGeneration.js', 'useImageGeneration', {
    currentProject: { id: 1 },
  }, { fetch: async (url) => url.endsWith('project_id=1')
    ? { ok: false, status: 400, json: async () => ({ detail: 'Cấu hình sai.' }) }
    : { ok: true, json: async () => ({ ready: true, config_source: 'system', provider: 'openai' }) } });
  session.flushEffects();
  await new Promise((resolve) => setImmediate(resolve));
  session.render();
  assert.equal(session.value.errorMsg, 'Cấu hình sai.');
  session.render({ currentProject: { id: 2 } });
  session.flushEffects();
  await new Promise((resolve) => setImmediate(resolve));
  session.render();
  assert.equal(session.value.configStatus.ready, true);
  assert.equal(session.value.errorMsg, '');
  session.unmount();
});
