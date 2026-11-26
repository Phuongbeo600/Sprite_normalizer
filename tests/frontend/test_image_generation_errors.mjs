import assert from 'node:assert/strict';
import test from 'node:test';
import { requestGenerateImages } from '../../frontend/src/features/image-generation/imageGenerationApi.js';
import { mountHook } from './helpers/hookHarness.mjs';

const hook = 'frontend/src/features/image-generation/useImageGeneration.js';
const tick = () => new Promise((done) => setImmediate(done));
const image = { id: 'one', data_url: 'data:image/png;base64,aW1hZ2U=' };

test('deadline aborts a stalled request and stalled response body', async () => {
  const previous = globalThis.fetch;
  try {
    for (const body of [false, true]) {
      let signal;
      globalThis.fetch = async (_url, options) => {
        signal = options.signal;
        if (body) return { ok: true, json: () => new Promise(() => {}) };
        return new Promise(() => {});
      };
      await assert.rejects(requestGenerateImages({}, { timeoutMs: 20 }), /quá thời gian/i);
      assert.equal(signal.aborted, true);
    }
  } finally { globalThis.fetch = previous; }
});

test('HTTP failures survive non-JSON bodies and network errors are distinct', async () => {
  const previous = globalThis.fetch;
  try {
    for (const [status, expected] of [[429, /hạn mức|giới hạn/i], [504, /quá thời gian/i], [502, /dịch vụ|kết nối/i]]) {
      globalThis.fetch = async () => ({ ok: false, status, json: async () => { throw new SyntaxError('HTML'); } });
      await assert.rejects(requestGenerateImages({}), expected);
    }
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(requestGenerateImages({}), /kết nối/i);
    globalThis.fetch = async () => ({ ok: true, json: async () => { throw new SyntaxError('bad'); } });
    await assert.rejects(requestGenerateImages({}), /không hợp lệ/i);
    globalThis.fetch = async () => ({ ok: true, json: async () => { throw new TypeError('terminated'); } });
    await assert.rejects(requestGenerateImages({}), /kết nối/i);
  } finally { globalThis.fetch = previous; }
});

test('loading clears after errors and retry displays actual provider and model', async () => {
  let attempt = 0;
  const session = mountHook(hook, 'useImageGeneration', { incomingPrompt: 'knight' }, {
    fetch: async (url) => url.includes('/status')
      ? { ok: true, json: async () => ({ provider: 'cloudflare', model: 'configured', ready: true }) }
      : ++attempt === 1
        ? { ok: false, status: 429, json: async () => ({ detail: 'Cloudflare hết hạn mức.' }) }
        : { ok: true, json: async () => ({ status: 'success', images: [image], provider_used: 'cloudflare', model_used: 'actual-model' }) },
  });
  session.flushEffects(); await tick(); session.render();
  await session.value.handleGenerateImage(); session.render();
  assert.equal(session.value.generating, false);
  assert.match(session.value.errorMsg, /hết hạn mức/);
  await session.value.handleGenerateImage(); session.render();
  assert.equal(session.value.generating, false);
  assert.equal(session.value.errorMsg, '');
  assert.match(session.value.successMsg, /cloudflare.*actual-model/);
  assert.doesNotMatch(session.value.successMsg, /OpenAI|Gemini/);
  session.unmount();
});

test('invalid generation payload releases loading without adding broken gallery entries', async () => {
  for (const payload of [null, { images: {} }, { images: [] }, { images: [{ id: 'broken' }] }]) {
    const session = mountHook(hook, 'useImageGeneration', { incomingPrompt: 'knight' }, {
      fetch: async () => ({ ok: true, json: async () => payload }),
    });
    await session.value.handleGenerateImage(); session.render();
    assert.equal(session.value.generating, false);
    assert.equal(session.value.generatedGallery.length, 0);
    assert.match(session.value.errorMsg, /không hợp lệ|không nhận được ảnh/i);
    session.unmount();
  }
});

test('hook timeout clears loading and permits an explicit retry', async () => {
  let attempts = 0;
  const session = mountHook(hook, 'useImageGeneration', { incomingPrompt: 'knight' }, {
    setTimeout: (callback, milliseconds) => setTimeout(callback, Math.min(milliseconds, 20)),
    fetch: async () => ++attempts === 1 ? new Promise(() => {})
      : { ok: true, json: async () => ({ images: [image], provider_used: 'cloudflare', model_used: 'actual' }) },
  });
  await session.value.handleGenerateImage(); session.render();
  assert.equal(session.value.generating, false);
  assert.match(session.value.errorMsg, /quá thời gian/);
  await session.value.handleGenerateImage(); session.render();
  assert.equal(session.value.generating, false);
  assert.equal(session.value.generatedGallery.length, 1);
  assert.equal(attempts, 2);
  session.unmount();
});

test('changing projects cancels stale work and duplicate submissions do not send requests', async () => {
  let resolveOld;
  let calls = 0;
  let oldSignal;
  const old = new Promise((done) => { resolveOld = done; });
  const props = { currentProject: { id: 1 }, incomingPrompt: 'knight' };
  const session = mountHook(hook, 'useImageGeneration', props, {
    fetch: async (url, options) => {
      if (url.includes('/status')) return { ok: true, json: async () => ({ provider: 'cloudflare', model: 'actual' }) };
      calls++;
      oldSignal = options.signal;
      return old;
    },
  });
  session.flushEffects(); await tick(); session.render();
  const pending = session.value.handleGenerateImage();
  await session.value.handleGenerateImage();
  assert.equal(calls, 1);
  session.render({ ...props, currentProject: { id: 2 } }); session.flushEffects();
  await pending; await tick(); session.render();
  assert.equal(oldSignal.aborted, true);
  assert.equal(session.value.generating, false);
  assert.equal(session.value.errorMsg, '');
  resolveOld({ ok: true, json: async () => ({ images: [image] }) });
  await tick(); session.render();
  assert.equal(session.value.generatedGallery.length, 0);
  session.unmount();
});


test('status timeout clears configuration loading and reports its cause', async () => {
  const session = mountHook(hook, 'useImageGeneration', {}, {
    setTimeout: (callback, milliseconds) => setTimeout(callback, Math.min(milliseconds, 20)),
    fetch: async () => new Promise(() => {}),
  });
  session.flushEffects();
  await new Promise((done) => setTimeout(done, 40));
  session.render();
  assert.equal(session.value.checkingConfig, false);
  assert.equal(session.value.configStatus, null);
  assert.match(session.value.errorMsg, /quá thời gian/);
  session.unmount();
});
