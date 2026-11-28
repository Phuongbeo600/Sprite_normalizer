// 1. THƯ VIỆN NỀN TẢNG (Kiểm thử yêu cầu HTTP)
// assert và test: Xác nhận token, nội dung và kết thúc luồng chat.
import assert from 'node:assert/strict';
import test from 'node:test';

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Giao thức Chatbox)
// streamChatApi: Thực thi đúng đường gửi yêu cầu từ giao diện.
import { streamChatApi } from '../../frontend/src/shared/api/chatApi.js';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)

/** Chạy transport với phiên lưu trữ và phản hồi SSE được cô lập. */
async function captureChat(savedUser) {
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const previousFetch = globalThis.fetch;
  let request;
  const chunks = [];
  let completed = false;
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: () => savedUser },
    });
    globalThis.fetch = async (url, options) => {
      request = { url, ...options };
      return new Response('data: {"text":"Chào bạn"}\n\ndata: [DONE]\n\n');
    };
    await streamChatApi({ messages: [{ role: 'user', content: 'Xin chào' }], projectId: 9,
      onChunk: (text) => chunks.push(text), onDone: () => { completed = true; },
      onError: (error) => assert.fail(error) });
    return { request, chunks, completed };
  } finally {
    globalThis.fetch = previousFetch;
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
    else delete globalThis.localStorage;
  }
}

test('chat dự án gửi JWT đã đăng nhập và vẫn đọc đủ luồng SSE', async () => {
  const { request, chunks, completed } = await captureChat(JSON.stringify({ id: 2, access_token: 'session-jwt' }));
  assert.equal(request.headers.Authorization, 'Bearer session-jwt');
  assert.equal(request.headers['Content-Type'], 'application/json');
  assert.equal(JSON.parse(request.body).project_id, 9);
  assert.deepEqual(chunks, ['Chào bạn']);
  assert.equal(completed, true);
});

test('tài khoản mẫu không được giả mạo token đăng nhập', async () => {
  const { request } = await captureChat(JSON.stringify({ id: 2, role: 'user' }));
  assert.equal(request.headers.Authorization, undefined);
});

test('dữ liệu phiên hỏng không làm sập transport chat', async () => {
  const { request, completed } = await captureChat('{broken');
  assert.equal(request.headers.Authorization, undefined);
  assert.equal(completed, true);
});
