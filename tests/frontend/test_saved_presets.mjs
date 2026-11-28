// 1. THƯ VIỆN NỀN TẢNG (Kiểm thử phiên và phản hồi HTTP)
import assert from 'node:assert/strict';
import test from 'node:test';

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Chạy hook và transport thật)
import { mountHook } from './helpers/hookHarness.mjs';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Dữ liệu ngoại tuyến)
const tick = () => new Promise((resolve) => setImmediate(resolve));
const root = 'frontend/src/features/';

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
