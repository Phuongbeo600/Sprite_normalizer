// 1. THƯ VIỆN NỀN TẢNG REACT
// Hook quản lý trạng thái, kích thước vùng xem và tài nguyên ảnh.
import { useEffect, useRef, useState } from 'react';

// 2. THƯ VIỆN BÊN NGOÀI
// lucide-react: Biểu tượng cho thao tác mở, thu phóng và xuất ảnh.
import { Download, FolderOpen, Grid2X2, Image as ImageIcon, LoaderCircle, Minus, Pause, Play, Plus } from 'lucide-react';

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Không có phụ thuộc nội bộ.

// 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC
// Các kiểu trình bày được nạp từ theme.css.

const MAX_FRAMES = 256;
const FPS_OPTIONS = [3, 4, 6, 8, 12];

/**
 * Gửi ảnh và thông số xử lý đến backend.
 * @param {File} file Ảnh nguồn.
 * @param {string} route Tên tuyến xử lý ảnh.
 * @param {Object} fields Thông số của thao tác được chọn.
 * @param {AbortSignal} [signal] Tín hiệu hủy khi ảnh nguồn thay đổi.
 * @returns {Promise<Response>} Phản hồi chứa ảnh hoặc kết quả cắt.
 */
async function processImage(file, route, fields, signal) {
  const body = new FormData();
  body.append('file', file);
  Object.entries(fields).forEach(([name, value]) => body.append(name, String(value)));
  const response = await fetch(`/api/${route}`, { method: 'POST', body, signal });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(typeof payload?.detail === 'string' ? payload.detail : 'Không xử lý được ảnh. Kiểm tra thông số và kết nối backend.');
  }
  return response;
}

/**
 * Quản lý bàn chỉnh ảnh, lưới cắt và kết quả xuất PNG.
 * @returns {React.ReactElement} Trang xử lý sprite.
 */
export default function Workspace() {
  const [mode, setMode] = useState('single');
  const [source, setSource] = useState(null);
  const [result, setResult] = useState(null);
  const [showResult, setShowResult] = useState(true);
  const [target, setTarget] = useState({ width: 64, height: 64 });
  const [keepRatio, setKeepRatio] = useState(true);
  const [command, setCommand] = useState('resize');
  const [anchor, setAnchor] = useState('bottom_center');
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(5);
  const [autoAnchor, setAutoAnchor] = useState(false);
  const [sheet, setSheet] = useState(null);
  const [frameIndex, setFrameIndex] = useState(null);
  const [fps, setFps] = useState(6);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [nativeGrid, setNativeGrid] = useState(null);
  const [detectingGrid, setDetectingGrid] = useState(false);
  const [gridError, setGridError] = useState('');
  const viewport = useRef(null);
  const drag = useRef(null);
  const uploadVersion = useRef(0);

  const dimensions = source?.dimensions;
  const sourceFile = source?.file;
  const resizeSource = nativeGrid || dimensions;
  const restoringGrid = command === 'resize' && nativeGrid?.scale > 1
    && Number(target.width) === nativeGrid.width && Number(target.height) === nativeGrid.height;
  const sheetMode = mode === 'sheet';
  const frame = !sheetMode || frameIndex === null ? null : sheet?.frames[frameIndex];
  const preview = sheetMode ? frame || dimensions : (showResult && result) || dimensions;
  const gridCount = Number(rows) * Number(columns);
  const numRows = Math.max(1, Number(rows) || 1);
  const numCols = Math.max(1, Number(columns) || 1);
  const cellWidth = dimensions ? Math.floor(dimensions.width / numCols) : 0;
  const cellHeight = dimensions ? Math.floor(dimensions.height / numRows) : 0;
  const remainderX = dimensions ? dimensions.width % numCols : 0;
  const remainderY = dimensions ? dimensions.height % numRows : 0;
  const marginX = Math.floor(remainderX / 2);
  const marginY = Math.floor(remainderY / 2);
  const gridValid = dimensions && Number.isInteger(Number(rows)) && Number.isInteger(Number(columns))
    && Number(rows) > 0 && Number(columns) > 0 && gridCount <= MAX_FRAMES
    && cellWidth >= 1 && cellHeight >= 1;
  const fitZoom = preview
    ? Math.max(0.01, Math.min((viewportSize.width - 32) / preview.width, (viewportSize.height - 32) / preview.height, 16))
    : 1;
  const activeZoom = zoom ?? fitZoom;
  const nameStem = source?.file.name.replace(/\.[^.]+$/, '') || 'sprite';

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);

  const sourceUrl = source?.url;
  const resultUrl = result?.url;
  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

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

  useEffect(() => {
    if (command === 'normalize') {
      setTarget({ width: 64, height: 64 });
    } else if (resizeSource) {
      setTarget({ width: resizeSource.width, height: resizeSource.height });
    }
  }, [command, resizeSource]);

  useEffect(() => {
    if (!playing || !sheet || !sheetMode) return;
    const timer = setInterval(() => {
      setFrameIndex((index) => ((index ?? -1) + 1) % sheet.frames.length);
    }, 1000 / fps);
    return () => clearInterval(timer);
  }, [playing, sheet, sheetMode, fps]);

  function selectMode(next) {
    setMode(next);
    setPlaying(false);
    setZoom(null);
    setError('');
  }

  function openImage(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    const version = ++uploadVersion.current;
    const url = URL.createObjectURL(file);
    const image = new Image();
    setNativeGrid(null);
    setGridError('');
    setDetectingGrid(false);
    setSource({ file, url, dimensions: null });
    setResult(null);
    setSheet(null);
    setFrameIndex(null);
    setPlaying(false);
    setZoom(null);
    setError('');
    setShowResult(true);
    image.onload = () => {
      if (version !== uploadVersion.current) return;
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      setDetectingGrid(true);
      setSource({ file, url, dimensions: { width, height, url } });
    };
    image.onerror = () => {
      if (version === uploadVersion.current) setError('Không đọc được ảnh. Hãy chọn tệp PNG, JPEG hoặc WebP hợp lệ.');
    };
    image.src = url;
  }

  function changeTarget(axis, value) {
    const next = { ...target, [axis]: value };
    if (command === 'resize' && keepRatio && resizeSource && Number(value) > 0) {
      const other = axis === 'width' ? 'height' : 'width';
      next[other] = Math.max(1, Math.round(Number(value) * resizeSource[other] / resizeSource[axis]));
    }
    setTarget(next);
  }

  async function applyEdit(event) {
    event.preventDefault();
    if (!dimensions || busy || (sheetMode ? !gridValid : detectingGrid)) return;
    const progress = restoringGrid ? 'Đang khôi phục lưới…' : 'Đang thu nhỏ…';
    setBusy(sheetMode ? 'Đang cắt frame…' : command === 'resize' ? progress : 'Đang chuẩn hóa…');
    setError('');
    setPlaying(false);
    try {
      if (sheetMode) {
        const response = await processImage(source.file, 'slice-sheet', { rows, columns, auto_anchor: autoAnchor });
        const { frames } = await response.json();
        setSheet({
          rows,
          columns,
          frames: frames.map(({ png, ...details }) => ({ ...details, url: `data:image/png;base64,${png}` })),
        });
        setFrameIndex(0);
      } else {
        const fields = { target_width: target.width, target_height: target.height };
        if (command === 'normalize') fields.anchor = anchor;
        const file = command === 'resize' ? nativeGrid?.file || source.file : source.file;
        const response = await processImage(file, command, fields);
        const blob = await response.blob();
        setResult({ url: URL.createObjectURL(blob), width: Number(target.width), height: Number(target.height) });
        setShowResult(true);
      }
      setZoom(null);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy('');
    }
  }

  async function exportSheet() {
    if (!sheet || busy) return;
    setBusy('Đang tạo ZIP…');
    setError('');
    try {
      const response = await processImage(source.file, 'slice-sheet', {
        rows: sheet.rows, columns: sheet.columns, output: 'zip', auto_anchor: autoAnchor,
      });
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `${nameStem}-frames.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy('');
    }
  }

  function selectFrame(index) {
    setPlaying(false);
    setFrameIndex(index);
    setZoom(null);
  }

  function changeGrid(setValue, value) {
    setValue(value);
    setSheet(null);
    selectFrame(null);
    setError('');
  }

  function startPan(event) {
    if (event.button !== 0 || !preview) return;
    const node = event.currentTarget;
    drag.current = { x: event.clientX + node.scrollLeft, y: event.clientY + node.scrollTop };
    node.setPointerCapture(event.pointerId);
    node.classList.add('is-panning');
  }

  function movePan(event) {
    if (!drag.current) return;
    event.currentTarget.scrollLeft = drag.current.x - event.clientX;
    event.currentTarget.scrollTop = drag.current.y - event.clientY;
  }

  function stopPan(event) {
    drag.current = null;
    event.currentTarget.classList.remove('is-panning');
  }

  return (
    <section className="sprite-editor" aria-labelledby="sprite-editor-heading">
      <header className="sprite-editor-header">
        <div className="sprite-editor-title">
          <h2 id="sprite-editor-heading">Xử lý ảnh</h2>
          {source && <span title={source.file.name}>{source.file.name}</span>}
        </div>
        <div className="sprite-editor-toolbar">
          <label className="btn-secondary-studio studio-file-button">
            <FolderOpen size={16} /> Mở ảnh
            <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Mở ảnh" disabled={Boolean(busy)} onChange={openImage} />
          </label>
          <div className="sprite-editor-switch" role="group" aria-label="Chế độ xử lý">
            <button className="btn-ghost-studio" type="button" aria-pressed={!sheetMode} disabled={Boolean(busy)} onClick={() => selectMode('single')}>
              <ImageIcon size={16} /> Ảnh đơn
            </button>
            <button className="btn-ghost-studio" type="button" aria-pressed={sheetMode} disabled={Boolean(busy)} onClick={() => selectMode('sheet')}>
              <Grid2X2 size={16} /> Sprite sheet
            </button>
          </div>
          <div className="sprite-editor-zoom" role="group" aria-label="Thu phóng ảnh xem trước">
            <button type="button" className="btn-ghost-studio" disabled={!preview} onClick={() => setZoom(null)}>Vừa khung</button>
            <button type="button" className="btn-ghost-studio" aria-label="Thu nhỏ vùng xem" disabled={!preview || activeZoom <= 0.05} onClick={() => setZoom(Math.max(0.05, activeZoom / 1.5))}><Minus size={16} /></button>
            <output>{preview ? `${Math.round(activeZoom * 100)}%` : '—'}</output>
            <button type="button" className="btn-ghost-studio" aria-label="Phóng to vùng xem" disabled={!preview || activeZoom >= 32} onClick={() => setZoom(Math.min(32, activeZoom * 1.5))}><Plus size={16} /></button>
          </div>
        </div>
      </header>

      <div className="sprite-editor-body">
        <div className="sprite-editor-stage">
          <div className="sprite-editor-viewport" ref={viewport} aria-label="Bàn chỉnh sprite"
            onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan} onLostPointerCapture={stopPan}>
            {preview ? (
              <div className="sprite-editor-canvas" style={{ width: preview.width * activeZoom, height: preview.height * activeZoom }}>
                <img src={preview.url} alt={frame?.name || source.file.name} draggable={false} />
                {sheetMode && frameIndex === null && gridValid && (
                  <div className="sprite-editor-grid" aria-hidden="true" style={{
                    position: 'absolute',
                    left: marginX * activeZoom,
                    top: marginY * activeZoom,
                    width: cellWidth * numCols * activeZoom,
                    height: cellHeight * numRows * activeZoom,
                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                    gridTemplateRows: `repeat(${rows}, 1fr)`,
                  }}>
                    {Array.from({ length: gridCount }, (_, index) => <span key={index} />)}
                  </div>
                )}
              </div>
            ) : (
              <div className="sprite-editor-empty"><ImageIcon size={30} aria-hidden="true" /><p>Mở ảnh để bắt đầu</p><span>PNG, JPEG hoặc WebP</span></div>
            )}
          </div>
          <div className="sprite-editor-status">
            <span>{preview ? `${preview.width} × ${preview.height} px` : 'Chưa có ảnh'}</span>
            {frame && <span>Frame {frameIndex + 1} / {sheet.frames.length}</span>}
            <span role="status">{(busy || detectingGrid) && <><LoaderCircle size={15} className="sprite-editor-spinner" /> {busy || 'Đang dò lưới pixel…'}</>}</span>
          </div>
        </div>

        <form className="sprite-editor-options" onSubmit={applyEdit}>
          {dimensions && <p>Kích thước tệp: {dimensions.width} × {dimensions.height} px</p>}
          {nativeGrid && (
            <p>{nativeGrid.scale > 1
              ? `Lưới pixel nhận diện: ${nativeGrid.width} × ${nativeGrid.height} px (~${nativeGrid.scale}×)`
              : 'Chưa phát hiện lưới phóng to. Dùng kích thước tệp.'}</p>
          )}
          {gridError && <p className="studio-reference-error">Không dò được lưới pixel. Dùng kích thước tệp.</p>}
          {sheetMode ? (
            <>
              <h3>Cắt sprite sheet</h3>
              <div className="sprite-editor-fields">
                <label>Số hàng<input type="number" min="1" max={MAX_FRAMES} required value={rows} disabled={Boolean(busy)} onChange={(event) => changeGrid(setRows, event.target.value)} /></label>
                <label>Số cột<input type="number" min="1" max={MAX_FRAMES} required value={columns} disabled={Boolean(busy)} onChange={(event) => changeGrid(setColumns, event.target.value)} /></label>
              </div>
              <label className="sprite-editor-checkbox" style={{ margin: '6px 0', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                <input type="checkbox" checked={autoAnchor} onChange={(e) => setAutoAnchor(e.target.checked)} disabled={Boolean(busy)} />
                <span>Căn tâm &amp; neo chân (Bottom-Center)</span>
              </label>
              {gridValid && (
                <div style={{ margin: '4px 0 8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <p style={{ margin: '0 0 2px' }}>{gridCount} frame · {cellWidth} × {cellHeight} px mỗi ô</p>
                  {(remainderX > 0 || remainderY > 0) && (
                    <span style={{ fontSize: '0.725rem', color: 'var(--accent-purple-glow, #a78bfa)' }}>
                      ✓ Đã tự động căn giữa lưới (bỏ {remainderX}px viền ngang, {remainderY}px viền dọc).
                    </span>
                  )}
                </div>
              )}
              {dimensions && !gridValid && (
                <p className="studio-reference-error">
                  Dùng lưới tối đa {MAX_FRAMES} ô. Kích thước ảnh phải đủ lớn cho số hàng và số cột.
                </p>
              )}
              <button className="btn-primary-studio" type="submit" disabled={!gridValid || Boolean(busy)}>{busy === 'Đang cắt frame…' ? busy : 'Cắt frame'}</button>
              {sheet && (
                <>
                  <button className="btn-secondary-studio" type="button" onClick={() => selectFrame(null)}>Xem sheet gốc</button>
                  {frame && <a className="btn-secondary-studio sprite-editor-download" href={frame.url} download={frame.name}><Download size={16} /> Tải frame PNG</a>}
                  <button className="btn-secondary-studio" type="button" disabled={Boolean(busy)} onClick={exportSheet}><Download size={16} /> {busy === 'Đang tạo ZIP…' ? busy : 'Tải tất cả (ZIP)'}</button>
                </>
              )}
            </>
          ) : (
            <>
              <h3>Ảnh đơn</h3>
              <label>Thao tác
                <select value={command} disabled={Boolean(busy) || detectingGrid} onChange={(event) => setCommand(event.target.value)}>
                  <option value="resize">Thu nhỏ ảnh</option>
                  <option value="normalize">Chuẩn hóa khung và điểm neo</option>
                </select>
              </label>
              <div className="sprite-editor-fields">
                <label>Rộng (px)<input type="number" min="1" max={command === 'resize' ? resizeSource?.width : 512} required value={target.width} onChange={(event) => changeTarget('width', event.target.value)} disabled={Boolean(busy) || detectingGrid} /></label>
                <label>Cao (px)<input type="number" min="1" max={command === 'resize' ? resizeSource?.height : 512} required value={target.height} onChange={(event) => changeTarget('height', event.target.value)} disabled={Boolean(busy) || detectingGrid} /></label>
              </div>
              {command === 'resize' ? (
                <label className="sprite-editor-checkbox"><input type="checkbox" checked={keepRatio} onChange={(event) => {
                  setKeepRatio(event.target.checked);
                  if (event.target.checked && resizeSource && Number(target.width) > 0) {
                    setTarget({ ...target, height: Math.max(1, Math.round(target.width * resizeSource.height / resizeSource.width)) });
                  }
                }} disabled={Boolean(busy) || detectingGrid} /> Khóa tỷ lệ</label>
              ) : (
                <label>Điểm neo<select value={anchor} onChange={(event) => setAnchor(event.target.value)} disabled={Boolean(busy)}>
                  <option value="bottom_center">Dưới và giữa</option>
                  <option value="center">Chính giữa</option>
                  <option value="top_left">Góc trên bên trái</option>
                </select></label>
              )}
              <button className="btn-primary-studio" type="submit" disabled={!dimensions || Boolean(busy) || detectingGrid}>
                {busy || (command === 'resize' && (restoringGrid ? 'Khôi phục độ phân giải thật' : 'Thu nhỏ')) || 'Chuẩn hóa'}
              </button>
              {result && (
                <>
                  <div className="sprite-editor-switch" role="group" aria-label="So sánh ảnh">
                    <button className="btn-ghost-studio" type="button" aria-pressed={!showResult} onClick={() => { setShowResult(false); setZoom(null); }}>Gốc</button>
                    <button className="btn-ghost-studio" type="button" aria-pressed={showResult} onClick={() => { setShowResult(true); setZoom(null); }}>Kết quả</button>
                  </div>
                  <a className="btn-secondary-studio sprite-editor-download" href={result.url} download={`${nameStem}-processed.png`}><Download size={16} /> Tải PNG</a>
                </>
              )}
            </>
          )}
          {error && <p className="studio-reference-error" role="alert">{error}</p>}
        </form>
      </div>

      {sheetMode && sheet && (
        <section className="sprite-editor-timeline" aria-label="Các frame đã cắt">
          <div className="sprite-editor-toolbar">
            <button className="btn-secondary-studio" type="button" disabled={sheet.frames.length < 2 || Boolean(busy)} onClick={() => {
              if (!playing && frameIndex === null) setFrameIndex(0);
              setPlaying(!playing);
            }}>
              {playing ? <Pause size={15} /> : <Play size={15} />} {playing ? 'Tạm dừng' : 'Phát thử'}
            </button>
            <label>Tốc độ <select value={fps} onChange={(event) => setFps(Number(event.target.value))}>
              {FPS_OPTIONS.map((rate) => <option key={rate} value={rate}>{rate} FPS</option>)}
            </select></label>
            <span>{sheet.frames.length} frame · lưới {sheet.rows} × {sheet.columns}</span>
          </div>
          <div className="sprite-editor-frames">
            {sheet.frames.map((item, index) => (
              <button className="btn-ghost-studio" type="button" key={item.name} aria-pressed={frameIndex === index} aria-label={`Frame ${index + 1}`} onClick={() => selectFrame(index)}>
                <img src={item.url} alt="" loading="lazy" /> <span>{index + 1}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
