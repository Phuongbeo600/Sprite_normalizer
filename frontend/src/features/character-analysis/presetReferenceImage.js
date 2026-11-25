// 1. THƯ VIỆN NỀN TẢNG (Dữ liệu ảnh trong trình duyệt)
// File, Uint8Array, btoa và atob: Chuyển đổi giữa tệp ảnh và Data URL có thể lưu lâu dài.

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Không sử dụng)

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)

/** Đọc ảnh gốc của phiên, không lưu đường dẫn blob tạm vào cơ sở dữ liệu. */
export async function encodePresetReference(reference) {
  if (!reference) return null;
  if (reference.dataUrl) return reference.dataUrl;
  if (!reference.file) return null;
  const bytes = new Uint8Array(await reference.file.arrayBuffer());
  const chunks = [];
  // Chia đoạn để không vượt giới hạn số tham số khi mã hóa ảnh lớn.
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  }
  return `data:${reference.file.type || 'image/png'};base64,${btoa(chunks.join(''))}`;
}

/** Khôi phục ảnh đã lưu thành File để Studio tiếp tục đo đạc và gửi ảnh tham chiếu. */
export function restorePresetReference(dataUrl, filename = 'sprite_sample.png') {
  if (!dataUrl) return null;
  const match = /^data:(image\/[^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error('Không đọc được ảnh tham chiếu trong hồ sơ đã lưu.');
  const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
  return {
    file: new File([bytes], filename, { type: match[1] }),
    name: filename,
    url: dataUrl,
    dataUrl,
  };
}
