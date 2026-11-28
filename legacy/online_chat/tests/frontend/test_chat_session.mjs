// 1. THƯ VIỆN NỀN TẢNG (Kiểm thử các phiên làm việc)
import assert from 'node:assert/strict';
import test from 'node:test';

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Bộ chạy hook cô lập)
import { mountHook } from '../../../tests/frontend/helpers/hookHarness.mjs';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Đường dẫn tính năng Chat Online đã lưu trữ)
const root = 'legacy/online_chat/frontend/src/features/';

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
