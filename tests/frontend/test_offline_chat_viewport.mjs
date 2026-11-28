// 1. THƯ VIỆN NỀN TẢNG (Kiểm thử hành vi cuộn hội thoại)
import test from 'node:test';
import assert from 'node:assert/strict';

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Môi trường hook có sẵn)
import { mountHook } from './helpers/hookHarness.mjs';

// 4. CẤU HÌNH KIỂM THỬ
const hook = 'frontend/src/features/offline-chat/useChatViewport.js';

test('đọc tin cũ không bị kéo xuống khi nhận token, nút xuống cuối bật lại chế độ theo dõi', () => {
  const props = { messages: [], activeSessionId: 1, isOpen: true, historyLoading: false };
  const session = mountHook(hook, 'useChatViewport', props);
  const viewport = { scrollTop: 0, scrollHeight: 1000, clientHeight: 400, scrollTo({ top }) { this.scrollTop = top; } };
  session.value.messagesRef.current = viewport;
  session.flushEffects();
  viewport.scrollTop = 200;
  session.value.handleScroll();
  session.render({ ...props, messages: [{ content: 'token mới' }] });
  session.flushEffects(); session.render();
  assert.equal(viewport.scrollTop, 200);
  assert.equal(session.value.showScrollButton, true);
  session.value.scrollToBottom();
  session.render();
  assert.equal(session.value.showScrollButton, false);
  viewport.scrollHeight = 1200;
  session.render({ ...props, messages: [{ content: 'token tiếp theo' }] });
  session.flushEffects();
  assert.equal(viewport.scrollTop, 1200);
  session.unmount();
});

test('mở hội thoại khác và tải lịch sử xong đưa người đọc xuống tin mới nhất', () => {
  const props = { messages: [], activeSessionId: 1, isOpen: true, historyLoading: false };
  const session = mountHook(hook, 'useChatViewport', props);
  const viewport = { scrollTop: 0, scrollHeight: 1000, clientHeight: 400, scrollTo({ top }) { this.scrollTop = top; } };
  session.value.messagesRef.current = viewport;
  session.flushEffects();
  viewport.scrollTop = 100;
  session.value.handleScroll();
  session.render({ ...props, activeSessionId: 2, historyLoading: true }); session.flushEffects();
  session.render({ ...props, activeSessionId: 2, messages: [{ content: 'lịch sử' }] }); session.flushEffects();
  assert.equal(viewport.scrollTop, 1000);
  session.unmount();
});

test('Markdown hoặc ảnh tải muộn vẫn theo cuối, nhưng không cuộn khi đang đọc tin cũ', () => {
  let resized;
  let disconnected = false;
  const session = mountHook(hook, 'useChatViewport', {
    messages: [{ content: 'hội thoại' }], activeSessionId: 1, isOpen: true, historyLoading: false,
  }, {
    ResizeObserver: class {
      constructor(callback) { resized = callback; }
      observe() {}
      disconnect() { disconnected = true; }
    },
  });
  const viewport = { scrollTop: 0, scrollHeight: 100, clientHeight: 400, firstElementChild: {} };
  session.value.messagesRef.current = viewport;
  session.flushEffects();
  assert.equal(typeof resized, 'function');
  viewport.scrollHeight = 1200;
  resized();
  assert.equal(viewport.scrollTop, 1200);
  viewport.scrollTop = 200;
  session.value.handleScroll();
  viewport.scrollHeight = 1500;
  resized(); session.render();
  assert.equal(viewport.scrollTop, 200);
  assert.equal(session.value.showScrollButton, true);
  session.unmount();
  assert.equal(disconnected, true);
});
