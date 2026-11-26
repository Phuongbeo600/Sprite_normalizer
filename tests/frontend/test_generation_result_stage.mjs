// 1. THƯ VIỆN NỀN TẢNG (Kiểm thử trạng thái trình bày kết quả)
// test và assert: Xác nhận tự mở, hạ khung và giữ dữ liệu khi tạo ảnh lại.
import test from 'node:test';
import assert from 'node:assert/strict';

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Phiên tạo ảnh thật)
import { mountHook } from './helpers/hookHarness.mjs';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Dữ liệu HTTP giả lập)
const hook = 'frontend/src/features/image-generation/useImageGeneration.js';
const tick = () => new Promise((resolve) => setImmediate(resolve));
const firstImage = { id: 'first', data_url: 'data:image/png;base64,aW1hZ2U=' };
const props = { currentProject: { id: 9 }, incomingPrompt: 'pixel knight', incomingNegativePrompt: 'blur', incomingImage: firstImage.data_url };

test('kết quả tự mở khi tạo thành công; sửa prompt và xem lại không mất nội dung hoặc ảnh', async () => {
  const session = mountHook(hook, 'useImageGeneration', props, {
    fetch: async (url) => ({ ok: true, json: async () => url.includes('/status')
      ? { ready: true } : { images: [firstImage], provider_used: 'cloudflare' } }),
  });
  try {
    session.flushEffects(); await tick(); session.render();
    assert.equal(session.value.resultExpanded, false);
    await session.value.handleGenerateImage(); session.render();
    assert.equal(session.value.resultExpanded, true);
    session.value.setResultExpanded(false); session.render();
    assert.equal(session.value.prompt, 'pixel knight');
    assert.equal(session.value.negativePrompt, 'blur');
    assert.equal(session.value.referenceImage, firstImage.data_url);
    assert.equal(session.value.generatedGallery[0].id, 'first');
    session.value.setResultExpanded(true); session.render();
    assert.equal(session.value.resultExpanded, true);
  } finally { session.unmount(); }
});

test('đang tạo lại và khi lỗi giữ form mở, không xóa ảnh kết quả cũ', async () => {
  let complete;
  let count = 0;
  const session = mountHook(hook, 'useImageGeneration', props, {}, {
    './imageGenerationApi': {
      requestImageGenerationStatus: async () => ({ ready: true }),
      requestGenerateImages: async () => {
        if (++count === 1) return { images: [firstImage] };
        return new Promise((resolve, reject) => { complete = () => reject(new Error('Không tạo được ảnh.')); });
      },
    },
  });
  try {
    await session.value.handleGenerateImage(); session.render();
    assert.equal(session.value.resultExpanded, true);
    const pending = session.value.handleGenerateImage(); session.render();
    assert.equal(session.value.resultExpanded, false);
    assert.equal(session.value.generating, true);
    complete(); await pending; session.render();
    assert.equal(session.value.resultExpanded, false);
    assert.equal(session.value.generatedGallery[0].id, 'first');
    assert.equal(session.value.errorMsg, 'Không tạo được ảnh.');
  } finally { session.unmount(); }
});

test('tạo thành công lần tiếp theo đưa ảnh mới lên trước và mở lại khung kết quả', async () => {
  let count = 0;
  const session = mountHook(hook, 'useImageGeneration', props, {}, {
    './imageGenerationApi': {
      requestImageGenerationStatus: async () => ({ ready: true }),
      requestGenerateImages: async () => ({ images: [{ ...firstImage, id: String(++count) }] }),
    },
  });
  try {
    await session.value.handleGenerateImage(); session.render();
    session.value.setResultExpanded(false); session.render();
    await session.value.handleGenerateImage(); session.render();
    assert.equal(session.value.resultExpanded, true);
    assert.deepEqual(Array.from(session.value.generatedGallery, (image) => image.id), ['2', '1']);
  } finally { session.unmount(); }
});

test('chuyển dự án hạ khung kết quả đang mở để không che form của dự án mới', async () => {
  const session = mountHook(hook, 'useImageGeneration', props, {}, {
    './imageGenerationApi': {
      requestImageGenerationStatus: async () => ({ ready: true }),
      requestGenerateImages: async () => ({ images: [firstImage] }),
    },
  });
  try {
    session.flushEffects(); await tick(); session.render();
    await session.value.handleGenerateImage(); session.render();
    session.render({ ...props, currentProject: { id: 10 } });
    session.flushEffects(); await tick(); session.render();
    assert.equal(session.value.resultExpanded, false);
  } finally { session.unmount(); }
});
