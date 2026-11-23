// 1. THƯ VIỆN NỀN TẢNG (Kiểm thử các phiên làm việc)
import assert from 'node:assert/strict';
import test from 'node:test';

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Bộ chạy hook cô lập)
import { mountHook } from './helpers/hookHarness.mjs';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Đường dẫn tính năng)
const root = 'frontend/src/features/';
const tick = () => new Promise((resolve) => setImmediate(resolve));
const jsonResponse = (data, ok = true) => ({ ok, json: async () => data });

test('phiên đăng nhập giữ tài khoản mẫu, ghi hồ sơ và cờ chủ động đăng xuất', () => {
  const data = new Map();
  const localStorage = { getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
  const mount = () => mountHook(`${root}authentication/useAuthSession.js`, 'useAuthSession', {}, { localStorage });
  const session = mount();
  assert.equal(session.value.currentUser.username, 'origin@gmail.com');
  session.value.logoutUser();
  assert.equal(session.render().currentUser, null);
  assert.equal(mount().value.currentUser, null);
  session.value.loginUser({ id: 3, username: 'user', role: 'admin' });
  assert.equal(session.render().currentUser.id, 3);
  assert.equal(data.has('sprite_logged_out'), false);
  session.value.updateProfile({ id: 3, username: 'updated' });
  assert.equal(mount().value.currentUser.username, 'updated');
  data.set('sprite_current_user', '{broken');
  assert.equal(mount().value.currentUser, null);
});

test('tạo ảnh giữ payload một ảnh vuông, đồng bộ prompt và thêm kết quả mới lên trước', async () => {
  const calls = [];
  let index = 0;
  const session = mountHook(`${root}image-generation/useImageGeneration.js`, 'useImageGeneration', {
    currentProject: { id: 7 }, incomingPrompt: '  Mage  ', incomingNegativePrompt: ' blur ',
  }, { fetch: async (url, options) => {
    calls.push([url, options]);
    return jsonResponse(url.includes('/status') ? { provider: 'openai', ready: true }
      : { images: [{ id: ++index }], provider_used: 'openai' });
  } });
  session.flushEffects(); await tick(); session.render();
  assert.equal(calls[0][0], '/api/image-gen/status?project_id=7');
  assert.equal(session.value.prompt, 'Mage');
  await session.value.handleGenerateImage(); session.render();
  assert.deepEqual(JSON.parse(calls[1][1].body), { prompt: 'Mage', negative_prompt: 'blur', project_id: 7,
    aspect_ratio: '1:1', number_of_images: 1, style_preset: null });
  await session.value.handleGenerateImage(); session.render();
  assert.equal(session.value.generatedGallery[0].id, 2);
  assert.equal(session.value.generatedGallery[1].id, 1);
  assert.match(session.value.successMsg, /OpenAI DALL-E/);
  assert.equal(session.value.generating, false);
});

test('tạo ảnh báo lỗi API và không gửi prompt rỗng', async () => {
  let count = 0;
  const session = mountHook(`${root}image-generation/useImageGeneration.js`, 'useImageGeneration', {
    currentProject: null, incomingPrompt: '', incomingNegativePrompt: '',
  }, { fetch: async () => { count++; return jsonResponse({ detail: 'provider error' }, false); } });
  await session.value.handleGenerateImage(); session.render();
  assert.equal(count, 0);
  session.value.setPrompt('Mage'); session.render();
  await session.value.handleGenerateImage(); session.render();
  assert.equal(count, 1);
  assert.equal(session.value.errorMsg, 'provider error');
  assert.equal(session.value.generating, false);
});

test('kho tài nguyên chỉ tải một đợt khi mở, tải lại khi quay lại tab và không tải khi ẩn', async () => {
  const calls = [];
  const props = { currentProject: { id: 4 }, isActive: true };
  const session = mountHook(`${root}project-assets/useProjectAssets.js`, 'useProjectAssets', props, {
    fetch: async (url) => { calls.push(url); return jsonResponse({ data: [], sprites: [], characters: [] }); },
  });
  session.flushEffects(); await tick(); session.render(); session.flushEffects();
  assert.equal(calls.length, 4);
  session.render({ ...props, isActive: false }); session.flushEffects(); await tick();
  assert.equal(calls.length, 4);
  session.render(props); session.flushEffects(); await tick();
  assert.equal(calls.length, 8);
});

test('nạp hồ sơ vẫn giữ prompt đã lưu và dữ liệu hình học dự phòng', () => {
  const session = mountHook(`${root}character-analysis/useAnalysisSession.js`, 'useAnalysisSession', {
    currentProject: { id: 1 }, isActive: true,
    loadedPresetData: { positive_prompt: 'saved positive', negative_prompt: 'saved negative',
      technical_notes: 'saved notes', metrics_data: { heads_tall: 4 }, profile_data: {} },
  });
  session.flushEffects(); session.render();
  assert.equal(session.value.workspaceMode, 'prompt_studio');
  assert.equal(session.value.hasMeasured, true);
  assert.equal(session.value.generatedProfilePrompt.positive_prompt, 'saved positive');
  assert.equal(session.value.metrics.heads_tall, 4);
});

test('chat gửi đúng transcript, ghép chunk và dừng bằng cùng AbortController', async () => {
  let request;
  let resolve;
  const pending = new Promise((done) => { resolve = done; });
  const session = mountHook(`${root}chat/useStreamingChat.js`, 'useStreamingChat', { currentProject: { id: 9 } }, {}, {
    '../../shared/api/chatApi': { streamChatApi: async (options) => { request = options; await pending; } },
  });
  const sending = session.value.handleSendMessage(' Mage ');
  session.render();
  assert.equal(request.projectId, 9);
  assert.equal(request.provider, null);
  assert.equal(request.messages[0].content, 'Mage');
  request.onError('connection error'); session.render();
  assert.equal(session.value.errorMessage, 'connection error');
  session.value.setErrorMessage(null); session.render();
  assert.equal(session.value.errorMessage, null);
  request.onChunk('one'); request.onChunk('two'); session.render();
  assert.equal(session.value.messages[1].content, 'onetwo');
  session.value.handleStopStreaming(); session.render();
  assert.equal(request.signal.aborted, true);
  assert.equal(session.value.isStreaming, false);
  session.value.handleClearChat(); session.render();
  assert.equal(session.value.messages.length, 0);
  resolve(); await sending;
});
