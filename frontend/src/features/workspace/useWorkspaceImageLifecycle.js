// 1. THƯ VIỆN NỀN TẢNG (React / JavaScript)
// React quản lý thu hồi URL và hủy yêu cầu khi ảnh thay đổi.
import { useEffect } from 'react';

// 2. THƯ VIỆN BÊN NGOÀI
// Không có phụ thuộc bên ngoài.

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// API nhận diện lưới pixel của ảnh nguồn.
import { processImage } from './workspaceApi';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Kế thừa giao diện Workspace hiện có.

/**
 * Giữ thứ tự và phụ thuộc của các tác vụ vòng đời ảnh trong Workspace.
 * @param {Object} state Ảnh nguồn, kết quả và các hàm cập nhật lưới.
 * @returns {void}
 */
export default function useWorkspaceImageLifecycle({
  source, result, dimensions, sourceFile, setDetectingGrid, setNativeGrid, setGridError,
}) {
  // Thu hồi bộ nhớ URL Blob khi ảnh bị thay đổi hoặc hủy
  const sourceUrl = source?.url;
  const resultUrl = result?.url;
  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  // Tự động dò độ phân giải lưới pixel khi nạp ảnh nguồn
  useEffect(() => {
    if (!dimensions || !sourceFile) return;
    const controller = new AbortController();
    setDetectingGrid(true);
    async function detectGrid() {
      try {
        const response = await processImage(sourceFile, 'detect-resolution', {}, controller.signal);
        const { png, width, height, scale } = await response.json();
        if (controller.signal.aborted) return;
        const file = png
          ? new File([Uint8Array.from(atob(png), (char) => char.charCodeAt(0))], 'native.png', { type: 'image/png' })
          : sourceFile;
        setNativeGrid({ width, height, scale, file });
      } catch (failure) {
        if (!controller.signal.aborted) setGridError(failure.message);
      } finally {
        setDetectingGrid(false);
      }
    }
    detectGrid();
    return () => controller.abort();
  }, [dimensions, sourceFile]);

}

/**
 * Tạo bộ giải mã ảnh, giữ quy tắc chỉ nhận kết quả của lần mở mới nhất.
 * @param {Object} state Tệp, URL, phiên mở ảnh và callback cập nhật trạng thái.
 * @returns {HTMLImageElement} Ảnh chưa được gán nguồn để bên gọi đặt lại trạng thái trước.
 */
export function createSourceDecoder({
  file, url, version, uploadVersion, decodeError, setDetectingGrid, setSource, setError,
}) {
  const image = new Image();
  image.onload = () => {
    if (version !== uploadVersion.current) return;
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    setDetectingGrid(true);
    setSource({ file, url, dimensions: { width, height, url } });
  };
  image.onerror = () => {
    if (version === uploadVersion.current) {
      setError(decodeError);
    }
  };

  return image;
}
