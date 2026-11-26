// 1. THƯ VIỆN NỀN TẢNG (Đo bố cục và điều khiển tiêu điểm)
// React: Giữ form luôn được gắn trong DOM khi khung kết quả trượt lên hoặc xuống.
import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

// 2. THƯ VIỆN BÊN NGOÀI (Biểu tượng hành động)
// lucide-react: Nút hạ khung, chuyển 3 chế độ ảnh, tải ảnh, xử lý ảnh, xóa và mở Godot.
import { ChevronDown, Download, FolderOpen, Gamepad2, Image as ImageIcon, Layers, LayoutGrid, Scissors, Trash2, ZoomIn } from 'lucide-react';

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Không sử dụng)

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Dùng kiểu khung trượt trong generation-result-stage.css.
import './generation-result-stage.css';

/** Đặt kết quả mới nhất phủ form; hạ xuống để chỉnh prompt mà không tháo form hay gọi API. */
export default function GenerationResultStage({ image, expanded, onExpandedChange, onPreview,
  onDownload, onSendToWorkspace, onSendToGodot, onOpenAssets, onClear, children }) {
  const stageRef = useRef(null);
  const promptRef = useRef(null);
  const resultRef = useRef(null);
  const toggleRef = useRef(null);
  const previousExpanded = useRef(false);
  const promptId = useId();
  const [heights, setHeights] = useState({ prompt: 0, result: 0 });
  // Lưu chế độ xem trong khung kết quả: 'processed' (Mục 1), 'frames' (Mục 2), 'original' (Mục 3).
  const [activeView, setActiveView] = useState('processed');
  const hasImage = Boolean(image?.data_url);
  const showResult = hasImage && expanded;

  // Mặc định quay về Mục 1 mỗi khi có ảnh mới được tạo ra.
  useEffect(() => {
    setActiveView('processed');
  }, [image?.id]);

  // Đo chiều cao thực tế, kể cả khi AI Local bổ sung gợi ý hoặc màn hình đổi kích thước.
  useLayoutEffect(() => {
    const measure = () => {
      const prompt = Math.ceil(promptRef.current?.getBoundingClientRect().height || 0);
      const result = Math.ceil(resultRef.current?.getBoundingClientRect().height || 0);
      setHeights((old) => old.prompt === prompt && old.result === result ? old : { prompt, result });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    if (promptRef.current) observer?.observe(promptRef.current);
    if (resultRef.current) observer?.observe(resultRef.current);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [hasImage, image?.id, activeView]);

  // Chuyển tiêu điểm sang phần đang hiển thị và đưa khung vào vùng nhìn của trang.
  useEffect(() => {
    const changed = previousExpanded.current !== showResult;
    previousExpanded.current = showResult;
    if (!hasImage || (!showResult && !changed)) return;
    const target = showResult ? toggleRef.current
      : (promptRef.current?.querySelector('textarea') || promptRef.current?.querySelector('input, button:not(:disabled)'));
    target?.focus({ preventScroll: true });
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    stageRef.current?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }, [showResult, hasImage, image?.id]);

  const hasProcessed = image?.post_processing?.status === 'success' && Boolean(image.post_processing.sheet_data_url);
  const frames = Array.isArray(image?.post_processing?.frames) ? image.post_processing.frames : [];
  const hasFrames = image?.post_processing?.status === 'success' && frames.length > 0;
  const resolvedView = activeView === 'frames' && !hasFrames ? 'processed' : activeView;
  const singleImageUrl = resolvedView === 'original'
    ? image?.data_url
    : (hasProcessed ? image.post_processing.sheet_data_url : image?.data_url);
  const viewSubtitle = resolvedView === 'frames'
    ? `15 Frame đã cắt (${frames.length} khung hình)`
    : (resolvedView === 'original' || !hasProcessed ? 'Ảnh gốc từ API' : 'Sheet 3×5 đã xử lý');
  const stageHeight = hasImage && heights.result
    ? (showResult ? heights.result : heights.prompt + 16 + heights.result) : undefined;

  return <div ref={stageRef} className={`atelier-gen-result-stage${hasImage ? ' has-result' : ''}${showResult ? ' result-open' : ''}`}
    style={{ height: stageHeight, '--prompt-offset': `${heights.prompt + 16}px` }}>
    <div ref={promptRef} id={promptId} className="atelier-gen-prompt-layer"
      aria-hidden={showResult || undefined} inert={showResult ? '' : undefined}>
      {children}
    </div>
    {hasImage && <section ref={resultRef} className="atelier-gen-result-layer" aria-label="Kết quả tạo ảnh mới nhất">
      <div className="atelier-gen-result-heading">
        <div>
          <h3><ImageIcon size={19} /> Kết quả vừa tạo</h3>
          <p>{viewSubtitle}{image.saved_to_project ? ' · Đã lưu vào MySQL' : ''}</p>
        </div>
        <button ref={toggleRef} type="button" className="atelier-gen-result-toggle"
          aria-expanded={!showResult} aria-controls={promptId} onClick={() => onExpandedChange(!showResult)}>
          <ChevronDown size={17} className={showResult ? '' : 'point-up'} aria-hidden="true" />
          {showResult ? 'Sửa prompt' : 'Xem kết quả'}
        </button>
      </div>
      <div className="atelier-gen-result-viewport">
        {resolvedView === 'frames' ? (
          <div className="atelier-gen-result-frames-grid" role="region" aria-label="Lưới 15 frame đã cắt">
            {frames.map((frame) => (
              <button
                key={frame.id}
                type="button"
                className="atelier-gen-result-frame-btn"
                onClick={() => onPreview(frame)}
                title={`${frame.name} (${frame.width} × ${frame.height})`}
                aria-label={`Phóng to ${frame.name}`}
              >
                <img src={frame.data_url} alt={frame.name} />
              </button>
            ))}
          </div>
        ) : (
          <button
            type="button"
            className="atelier-gen-result-image"
            aria-label={resolvedView === 'original' ? 'Phóng to ảnh gốc từ API' : 'Phóng to sheet đã xử lý'}
            onClick={() => onPreview({ ...image, data_url: singleImageUrl })}
          >
            <img
              src={singleImageUrl}
              alt={resolvedView === 'original' ? 'Ảnh gốc từ API' : 'Ảnh Sprite mới nhất'}
            />
            <span className="atelier-gen-result-zoom"><ZoomIn size={15} /> Phóng to</span>
          </button>
        )}
        {/* Thanh nổi dọc gồm 3 nút chuyển nhanh: Sheet đã cắt, 15 Frame đã cắt và Ảnh gốc */}
        <div className="atelier-gen-result-switcher" role="tablist" aria-label="Chuyển đổi ảnh kết quả">
          <button
            type="button"
            role="tab"
            aria-selected={resolvedView === 'processed'}
            className={`atelier-gen-switcher-btn${resolvedView === 'processed' ? ' active' : ''}`}
            onClick={() => setActiveView('processed')}
            title="1. Sheet 3×5 đã xử lý"
            aria-label="Xem sheet 3×5 đã xử lý"
          >
            <Layers size={15} />
            <span className="atelier-gen-switcher-index">1</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={resolvedView === 'frames'}
            disabled={!hasFrames}
            className={`atelier-gen-switcher-btn${resolvedView === 'frames' ? ' active' : ''}`}
            onClick={() => setActiveView('frames')}
            title={hasFrames ? '2. 15 Frame đã cắt' : 'Chưa có 15 frame tách rời'}
            aria-label="Xem 15 frame đã cắt"
          >
            <LayoutGrid size={15} />
            <span className="atelier-gen-switcher-index">2</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={resolvedView === 'original'}
            className={`atelier-gen-switcher-btn${resolvedView === 'original' ? ' active' : ''}`}
            onClick={() => setActiveView('original')}
            title="3. Ảnh gốc từ API"
            aria-label="Xem ảnh gốc từ API"
          >
            <ImageIcon size={15} />
            <span className="atelier-gen-switcher-index">3</span>
          </button>
        </div>
      </div>
      {image.post_processing?.status !== 'success' && image.post_processing?.message &&
        <p className="atelier-gen-result-note">{image.post_processing.message}</p>}
      <div className="atelier-gen-result-actions">
        <button type="button" className="atelier-gen-btn-download" onClick={() => onDownload(image, hasProcessed)}>
          <Download size={15} /> {hasProcessed ? 'Tải sheet đã xử lý' : 'Tải ảnh PNG'}
        </button>
        {hasProcessed && (
          <button type="button" className="atelier-gen-btn-sub" onClick={() => onDownload(image, false)}>
            <Download size={15} /> Tải ảnh gốc
          </button>
        )}
        <button type="button" className="atelier-gen-btn-sub" onClick={() => onSendToWorkspace(image)}>
          <Scissors size={15} /> Mở Workspace
        </button>
        <button type="button" className="atelier-gen-btn-sub" onClick={() => onSendToGodot(image)}>
          <Gamepad2 size={15} /> Thử Godot
        </button>
        {image.saved_to_project && onOpenAssets && (
          <button type="button" className="atelier-gen-btn-sub" onClick={onOpenAssets}>
            <FolderOpen size={15} /> Xem Kho Dự Án
          </button>
        )}
        {onClear && (
          <button type="button" className="atelier-gen-btn-clear" onClick={onClear} title="Xóa kết quả hiện tại">
            <Trash2 size={14} /> Xóa kết quả
          </button>
        )}
      </div>
    </section>}
  </div>;
}
