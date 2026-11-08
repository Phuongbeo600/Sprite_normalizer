// 1. THƯ VIỆN NỀN TẢNG REACT
// React hiển thị khung ảnh, quản lý danh sách và vòng đời xem trước.
import React, { useEffect, useState } from 'react';

// 2. THƯ VIỆN BÊN NGOÀI
// Các biểu tượng dùng cho nút nạp ảnh, phát và tải xuống.
import { Download, FolderOpen, Pause, Play, Zap } from 'lucide-react';

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN

// 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC
// Kiểu trình bày được nạp từ theme.css qua điểm khởi động ứng dụng.

/**
 * Nạp, xem trước và chuẩn hóa ảnh trong dự án đang mở.
 * @returns {React.ReactElement} Bảng điều khiển xử lý ảnh.
 */
export default function Workspace() {
  const [images, setImages] = useState([]);
  const [index, setIndex] = useState(0);
  const [preview, setPreview] = useState(null);
  const [dimensions, setDimensions] = useState(null);
  const [targetWidth, setTargetWidth] = useState(64);
  const [targetHeight, setTargetHeight] = useState(64);
  const [anchor, setAnchor] = useState('bottom_center');
  const [fps, setFps] = useState(6);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const activeImage = images[index];

  useEffect(() => {
    if (!activeImage) return;

    // Tạo đường dẫn tạm cho khung đang xem và giải phóng khi đổi khung.
    const original = URL.createObjectURL(activeImage.file);
    const normalized = activeImage.result && URL.createObjectURL(activeImage.result);
    setPreview({ image: activeImage, original, normalized });
    return () => {
      URL.revokeObjectURL(original);
      if (normalized) URL.revokeObjectURL(normalized);
    };
  }, [activeImage]);

  useEffect(() => {
    if (!playing || images.length < 2) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % images.length);
    }, 1000 / fps);
    return () => clearInterval(timer);
  }, [playing, fps, images.length]);

  /**
   * Nạp ảnh và đưa khung xem trước về ảnh đầu tiên.
   * @param {React.ChangeEvent<HTMLInputElement>} event Sự kiện chọn tệp.
   * @returns {void} Cập nhật danh sách ảnh đang xử lý.
   */
  const handleFileChange = (event) => {
    const files = Array.from(event.target.files);
    event.target.value = '';
    if (!files.length) return;

    setPlaying(false);
    setIndex(0);
    setError('');
    setImages(files.map((file) => ({ file, result: null })));
  };

  /**
   * Gửi ảnh đang chọn cùng kích thước và điểm neo đến API chuẩn hóa.
   * @param {React.FormEvent<HTMLFormElement>} event Sự kiện gửi biểu mẫu.
   * @returns {Promise<void>} Cập nhật ảnh kết quả hoặc thông báo lỗi.
   */
  const handleNormalize = async (event) => {
    event.preventDefault();
    if (!activeImage || loading) return;

    setPlaying(false);
    setLoading(true);
    setError('');
    const body = new FormData();
    body.append('file', activeImage.file);
    body.append('target_width', targetWidth);
    body.append('target_height', targetHeight);
    body.append('anchor', anchor);

    try {
      const response = await fetch('/api/normalize', { method: 'POST', body });
      if (!response.ok) throw new Error('Không chuẩn hóa được ảnh.');
      const result = await response.blob();

      // Gắn kết quả vào ảnh đã gửi, kể cả khi người dùng chuyển khung.
      setImages((current) => current.map((image) => (
        image === activeImage ? { ...image, result } : image
      )));
    } catch {
      setError('Không chuẩn hóa được ảnh. Hãy kiểm tra tệp và kết nối backend.');
    } finally {
      setLoading(false);
    }
  };

  const visiblePreview = preview?.image === activeImage ? preview : null;
  const visibleDimensions = dimensions?.preview === visiblePreview ? dimensions : null;

  return (
    <section className="analysis-panel sprite-workbench" aria-labelledby="sprite-workbench-title">
      <h2 id="sprite-workbench-title">Bước 3. Nạp nhiều ảnh, Sprite Size &amp; Export</h2>

      <label className="analysis-file">
        <FolderOpen size={17} aria-hidden="true" />
        Nạp một hoặc nhiều ảnh sprite / dải AI
        <input type="file" accept="image/png,image/jpeg,image/webp" multiple
          disabled={loading} onChange={handleFileChange} />
      </label>

      <div className="sprite-toolbar">
        <button type="button" disabled={playing || index === 0} onClick={() => setIndex(index - 1)}>◀ Trước</button>
        <span className="sprite-filename">{activeImage?.file.name ?? 'Chưa nạp ảnh.'}</span>
        <button type="button" disabled={playing || index >= images.length - 1} onClick={() => setIndex(index + 1)}>Sau ▶</button>
      </div>

      <fieldset className="sprite-strip" disabled>
        <legend>Tách dải hoạt ảnh</legend>
        <label>Số frame <input type="number" defaultValue={4} min={1} /></label>
        <label><input type="checkbox" defaultChecked /> Giữ trọn ô gốc</label>
        <button type="button">Cắt dải</button>
      </fieldset>

      <div className="sprite-action-grid">
        <button type="button" disabled>Đặt canvas cũ</button>
        <button type="button" disabled>Đặt độ phân giải thật cũ</button>
      </div>

      <form className="sprite-settings" onSubmit={handleNormalize}>
        <label className="sprite-toolbar">Điểm neo
          <select value={anchor} onChange={(event) => setAnchor(event.target.value)}>
            <option value="bottom_center">Dưới và giữa</option>
            <option value="center">Chính giữa</option>
            <option value="top_left">Góc trên bên trái</option>
          </select>
        </label>
        <div className="sprite-action-grid">
          <details className="sprite-size">
            <summary>Sprite Size (LibreSprite)</summary>
            <div className="sprite-toolbar">
              <label>Rộng <input type="number" value={targetWidth} min={1} max={512} required
                onChange={(event) => setTargetWidth(event.target.value)} /></label>
              <label>Cao <input type="number" value={targetHeight} min={1} max={512} required
                onChange={(event) => setTargetHeight(event.target.value)} /></label>
            </div>
          </details>
          <button type="submit" disabled={!activeImage || loading}>
            <Zap size={17} aria-hidden="true" /> {loading ? 'Đang chuẩn hóa…' : 'Chuẩn hóa 1-Click'}
          </button>
        </div>
      </form>

      <figure className="analysis-preview sprite-preview">
        {visiblePreview ? (
          <img src={visiblePreview.normalized || visiblePreview.original} alt={activeImage.file.name}
            onLoad={(event) => setDimensions({
              preview: visiblePreview,
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })} />
        ) : <span>Ảnh xem trước sẽ hiện ở đây</span>}
      </figure>

      <div className="sprite-toolbar">
        <button type="button" disabled={images.length < 2 || loading} onClick={() => setPlaying(!playing)}>
          {playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {playing ? 'Tạm dừng' : 'Phát'}
        </button>
        <label>Tốc độ <select value={fps} onChange={(event) => setFps(Number(event.target.value))}>
          {[3, 4, 6, 8, 12].map((rate) => <option key={rate} value={rate}>{rate} FPS</option>)}
        </select></label>
        <span className="sprite-frame-count">Frame {activeImage ? index + 1 : '–'} / {images.length || '–'}</span>
      </div>
      <p aria-live="polite">Độ phân giải {visibleDimensions
        ? `${visibleDimensions.width} × ${visibleDimensions.height} px`
        : '— Chưa có ảnh'}</p>
      {error && <p role="alert">{error}</p>}

      <div className="sprite-action-grid">
        <button type="button" disabled>Xuất hàng loạt tất cả ảnh</button>
        <button type="button" disabled>Xuất frame rời (Godot)</button>
        <button type="button" disabled>Export File (LibreSprite)</button>
        <button type="button" disabled>Xuất GIF động</button>
        {visiblePreview?.normalized ? (
          <a className="sprite-save" href={visiblePreview.normalized} download="normalized_sprite.png">
            <Download size={17} aria-hidden="true" /> Lưu file PNG
          </a>
        ) : <button type="button" className="sprite-save" disabled>Lưu file PNG</button>}
      </div>
      <p className="analysis-result">Tách dải, căn theo ảnh mẫu và xuất nâng cao đang chờ nối thuật toán MVC.</p>
    </section>
  );
}
