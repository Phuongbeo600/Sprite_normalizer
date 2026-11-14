// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
// React quản lý vòng đời, trạng thái bàn vẽ, kích thước vùng xem và tài nguyên ảnh.
import { useEffect, useRef, useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon vector cho mở ảnh, thu phóng, hoạt họa, cắt khung và tải về
import {
  Download,
  FolderOpen,
  Grid2X2,
  Image as ImageIcon,
  LoaderCircle,
  Minus,
  Pause,
  Play,
  Plus,
  Sliders,
  Sparkles,
  Layers,
  ZoomIn,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không có component nội bộ phụ thuộc)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark Fantasy Atelier chuyên biệt cho bàn làm việc Workspace
import '../styles/workspace-atelier.css';

const MAX_FRAMES = 256;
const FPS_OPTIONS = [3, 4, 6, 8, 12];

/**
 * Gửi ảnh và thông số xử lý đến backend FastAPI.
 * 
 * @param {File} file Ảnh nguồn cần xử lý.
 * @param {string} route Tuyến API backend xử lý ảnh.
 * @param {Object} fields Thông số cấu hình của thao tác.
 * @param {AbortSignal} [signal] Tín hiệu hủy yêu cầu khi ảnh nguồn thay đổi.
 * @returns {Promise<Response>} Phản hồi từ máy chủ chứa ảnh hoặc kết quả phân tách frame.
 */
async function processImage(file, route, fields, signal) {
  const body = new FormData();
  body.append('file', file);
  Object.entries(fields).forEach(([name, value]) => body.append(name, String(value)));
  const response = await fetch(`/api/${route}`, { method: 'POST', body, signal });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      typeof payload?.detail === 'string'
        ? payload.detail
        : 'Không xử lý được ảnh. Kiểm tra thông số và kết nối backend.'
    );
  }
  return response;
}

/**
 * Bàn làm việc Xử lý & Chuẩn hóa Sprite (Dark Fantasy Atelier Workspace).
 * Cung cấp đầy đủ công cụ studio chuyên nghiệp:
 * - Chuẩn hóa ảnh đơn (Resize, Anchor, Bounding Box).
 * - Phân tách Sprite Sheet (Cắt lưới ma trận, Căn tâm & neo chân).
 * - Dò lưới pixel tự động và phục hồi độ phân giải gốc.
 * - Trình phát thử hoạt họa (Animation Timeline Player) điều chỉnh FPS.
 * - Xuất tệp PNG đơn lẻ hoặc gói nén ZIP chuẩn Godot Engine 4.3.
 * - Tự động lưu trữ lịch sử ảnh vào cơ sở dữ liệu MySQL.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object} [props.currentProject] Dự án hiện tại đang mở.
 * @param {File|null} [props.incomingFile] Tệp ảnh được chuyển tiếp từ màn hình Tạo ảnh AI.
 * @returns {React.ReactElement} Giao diện bàn làm việc chuẩn hóa sprite.
 */
export default function Workspace({ currentProject, incomingFile = null }) {
  // Chế độ làm việc: 'single' (Ảnh đơn) | 'sheet' (Sprite Sheet hoạt họa)
  const [mode, setMode] = useState('single');
  // Dữ liệu ảnh nguồn ban đầu
  const [source, setSource] = useState(null);
  // Dữ liệu ảnh sau khi xử lý
  const [result, setResult] = useState(null);
  // Hiển thị kết quả hay ảnh gốc (ở chế độ so sánh)
  const [showResult, setShowResult] = useState(true);
  // Kích thước mục tiêu cần co giãn
  const [target, setTarget] = useState({ width: 64, height: 64 });
  // Khóa tỉ lệ khung hình (Keep aspect ratio)
  const [keepRatio, setKeepRatio] = useState(true);
  // Lệnh xử lý ảnh đơn: 'resize' (Thu nhỏ) | 'normalize' (Chuẩn hóa khung & neo)
  const [command, setCommand] = useState('resize');
  // Điểm neo cố định: 'bottom_center' | 'center' | 'top_left'
  const [anchor, setAnchor] = useState('bottom_center');
  // Số hàng và số cột khi cắt Sprite Sheet
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(5);
  // Tự động căn tâm & neo chân (Bottom-Center)
  const [autoAnchor, setAutoAnchor] = useState(false);
  // Dữ liệu Sprite Sheet sau khi bóc tách frame
  const [sheet, setSheet] = useState(null);
  // Vị trí frame đang được chọn xem
  const [frameIndex, setFrameIndex] = useState(null);
  // Tốc độ khung hình hoạt họa (Frames per second)
  const [fps, setFps] = useState(6);
  // Trạng thái phát hoạt họa tự động
  const [playing, setPlaying] = useState(false);
  // Hệ số thu phóng vùng xem (Zoom scale)
  const [zoom, setZoom] = useState(null);
  // Kích thước thực tế của vùng xem viewport
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  // Thông báo trạng thái xử lý đang chạy
  const [busy, setBusy] = useState('');
  // Thông báo lỗi nếu xảy ra sự cố
  const [error, setError] = useState('');
  // Lưới pixel tự nhiên được nhận diện
  const [nativeGrid, setNativeGrid] = useState(null);
  // Trạng thái đang dò lưới pixel tự động
  const [detectingGrid, setDetectingGrid] = useState(false);
  // Lỗi khi dò lưới pixel
  const [gridError, setGridError] = useState('');
  // Mã định danh bản ghi sprite trong CSDL MySQL
  const [spriteDbId, setSpriteDbId] = useState(null);

  // Tham chiếu DOM đến vùng xem và tọa độ kéo chuột
  const viewport = useRef(null);
  const drag = useRef(null);
  const uploadVersion = useRef(0);

  // Tính toán các giá trị phái sinh
  const dimensions = source?.dimensions;
  const sourceFile = source?.file;
  const resizeSource = nativeGrid || dimensions;
  const restoringGrid =
    command === 'resize' &&
    nativeGrid?.scale > 1 &&
    Number(target.width) === nativeGrid.width &&
    Number(target.height) === nativeGrid.height;
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
  const gridValid =
    dimensions &&
    Number.isInteger(Number(rows)) &&
    Number.isInteger(Number(columns)) &&
    Number(rows) > 0 &&
    Number(columns) > 0 &&
    gridCount <= MAX_FRAMES &&
    cellWidth >= 1 &&
    cellHeight >= 1;
  const fitZoom = preview
    ? Math.max(
        0.01,
        Math.min((viewportSize.width - 32) / preview.width, (viewportSize.height - 32) / preview.height, 16)
      )
    : 1;
  const activeZoom = zoom ?? fitZoom;
  const nameStem = source?.file.name.replace(/\.[^.]+$/, '') || 'sprite';

  // Lắng nghe thay đổi kích thước khung nhìn để tính toán zoom vừa vặn
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);

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

  // Cập nhật kích thước mục tiêu theo lệnh thao tác
  useEffect(() => {
    if (command === 'normalize') {
      setTarget({ width: 64, height: 64 });
    } else if (resizeSource) {
      setTarget({ width: resizeSource.width, height: resizeSource.height });
    }
  }, [command, resizeSource]);

  // Vòng lặp phát thử hoạt họa cho Sprite Sheet theo FPS
  useEffect(() => {
    if (!playing || !sheet || !sheetMode) return;
    const timer = setInterval(() => {
      setFrameIndex((index) => ((index ?? -1) + 1) % sheet.frames.length);
    }, 1000 / fps);
    return () => clearInterval(timer);
  }, [playing, sheet, sheetMode, fps]);

  /**
   * Chuyển đổi giữa chế độ Xử lý ảnh đơn và Cắt Sprite Sheet
   */
  function selectMode(next) {
    setMode(next);
    setPlaying(false);
    setZoom(null);
    setError('');
  }

  /**
   * Mở ảnh từ ổ cứng thông qua thẻ input file
   */
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

    // Tự động lưu ảnh thô ban đầu vào CSDL MySQL
    if (currentProject?.id) {
      const form = new FormData();
      form.append('file', file);
      form.append('project_id', currentProject.id);
      form.append('name', file.name || 'sprite_raw');
      fetch('/api/sprites/save-raw', { method: 'POST', body: form })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.id) {
            setSpriteDbId(data.id);
          }
        })
        .catch((err) => console.error('Lỗi khi lưu ảnh gốc vào MySQL:', err));
    }

    image.onload = () => {
      if (version !== uploadVersion.current) return;
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      setDetectingGrid(true);
      setSource({ file, url, dimensions: { width, height, url } });
    };
    image.onerror = () => {
      if (version === uploadVersion.current) {
        setError('Không đọc được ảnh. Hãy chọn tệp PNG, JPEG hoặc WebP hợp lệ.');
      }
    };
    image.src = url;
  }

  // Tự động nạp tệp ảnh được chuyển tiếp từ mục Tạo ảnh AI
  useEffect(() => {
    if (!incomingFile) return;
    const version = ++uploadVersion.current;
    const url = URL.createObjectURL(incomingFile);
    const image = new Image();
    setNativeGrid(null);
    setGridError('');
    setDetectingGrid(false);
    setSource({ file: incomingFile, url, dimensions: null });
    setResult(null);
    setSheet(null);
    setFrameIndex(null);
    setPlaying(false);
    setZoom(null);
    setError('');
    setShowResult(true);

    // Tự động lưu ảnh gốc AI vào MySQL
    if (currentProject?.id) {
      const form = new FormData();
      form.append('file', incomingFile);
      form.append('project_id', currentProject.id);
      form.append('name', incomingFile.name || 'sprite_ai_raw');
      fetch('/api/sprites/save-raw', { method: 'POST', body: form })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.id) {
            setSpriteDbId(data.id);
          }
        })
        .catch((err) => console.error('Lỗi khi lưu ảnh gốc vào MySQL:', err));
    }

    image.onload = () => {
      if (version !== uploadVersion.current) return;
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      setDetectingGrid(true);
      setSource({ file: incomingFile, url, dimensions: { width, height, url } });
    };
    image.onerror = () => {
      if (version === uploadVersion.current) {
        setError('Không đọc được ảnh chuyển từ Tạo ảnh AI.');
      }
    };
    image.src = url;
  }, [incomingFile]);

  /**
   * Thay đổi kích thước mục tiêu với tùy chọn khóa tỷ lệ
   */
  function changeTarget(axis, value) {
    const next = { ...target, [axis]: value };
    if (command === 'resize' && keepRatio && resizeSource && Number(value) > 0) {
      const other = axis === 'width' ? 'height' : 'width';
      next[other] = Math.max(1, Math.round((Number(value) * resizeSource[other]) / resizeSource[axis]));
    }
    setTarget(next);
  }

  /**
   * Thực thi áp dụng chỉnh sửa (Cắt Sheet hoặc Chuẩn hóa ảnh đơn)
   */
  async function applyEdit(event) {
    event.preventDefault();
    if (!dimensions || busy || (sheetMode ? !gridValid : detectingGrid)) return;
    const progress = restoringGrid ? 'Đang khôi phục lưới…' : 'Đang thu nhỏ…';
    setBusy(sheetMode ? 'Đang cắt frame…' : command === 'resize' ? progress : 'Đang chuẩn hóa…');
    setError('');
    setPlaying(false);
    try {
      if (sheetMode) {
        const response = await processImage(source.file, 'slice-sheet', {
          rows,
          columns,
          auto_anchor: autoAnchor,
        });
        const { frames } = await response.json();
        setSheet({
          rows,
          columns,
          frames: frames.map(({ png, ...details }) => ({
            ...details,
            url: `data:image/png;base64,${png}`,
          })),
        });
        setFrameIndex(0);
      } else {
        const fields = { target_width: target.width, target_height: target.height };
        if (command === 'normalize') fields.anchor = anchor;
        const file = command === 'resize' ? nativeGrid?.file || source.file : source.file;
        const response = await processImage(file, command, fields);
        const blob = await response.blob();
        setResult({
          url: URL.createObjectURL(blob),
          width: Number(target.width),
          height: Number(target.height),
        });
        setShowResult(true);

        // Lưu ảnh đã chuẩn hóa vào MySQL
        if (currentProject?.id && spriteDbId) {
          const form = new FormData();
          form.append('file', blob, 'processed.png');
          form.append('project_id', currentProject.id);
          fetch(`/api/sprites/${spriteDbId}/save-processed`, { method: 'POST', body: form })
            .catch((err) => console.error('Lỗi khi lưu ảnh tối ưu vào MySQL:', err));
        }
      }
      setZoom(null);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy('');
    }
  }

  /**
   * Xuất toàn bộ các frame đã cắt thành file ZIP
   */
  async function exportSheet() {
    if (!sheet || busy) return;
    setBusy('Đang tạo ZIP…');
    setError('');
    try {
      const response = await processImage(source.file, 'slice-sheet', {
        rows: sheet.rows,
        columns: sheet.columns,
        output: 'zip',
        auto_anchor: autoAnchor,
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

  /**
   * Chọn xem một frame cụ thể trong danh sách
   */
  function selectFrame(index) {
    setPlaying(false);
    setFrameIndex(index);
    setZoom(null);
  }

  /**
   * Cập nhật thông số hàng/cột của lưới cắt
   */
  function changeGrid(setValue, value) {
    setValue(value);
    setSheet(null);
    selectFrame(null);
    setError('');
  }

  /**
   * Bắt đầu kéo trượt (Pan) trên canvas
   */
  function startPan(event) {
    if (event.button !== 0 || !preview) return;
    const node = event.currentTarget;
    drag.current = { x: event.clientX + node.scrollLeft, y: event.clientY + node.scrollTop };
    node.setPointerCapture(event.pointerId);
    node.classList.add('is-panning');
  }

  /**
   * Di chuyển trượt (Pan)
   */
  function movePan(event) {
    if (!drag.current) return;
    event.currentTarget.scrollLeft = drag.current.x - event.clientX;
    event.currentTarget.scrollTop = drag.current.y - event.clientY;
  }

  /**
   * Kết thúc kéo trượt
   */
  function stopPan(event) {
    drag.current = null;
    event.currentTarget.classList.remove('is-panning');
  }

  return (
    <div className="atelier-workspace-root" aria-label="Bàn làm việc chuẩn hóa sprite">
      {/* ================================================================ */}
      {/* 1. THANH CÔNG CỤ ĐỈNH WORKSPACE (STUDIO HEADER TOOLBAR)          */}
      {/* ================================================================ */}
      <header className="atelier-ws-header">
        <div className="atelier-ws-title-group">
          <h2 className="atelier-ws-title">
            <Sliders size={18} color="#c084fc" />
            <span>Xử lý &amp; Chuẩn hóa Sprite</span>
          </h2>
          {source && (
            <span className="atelier-ws-file-pill" title={source.file.name}>
              {source.file.name}
            </span>
          )}
        </div>

        <div className="atelier-ws-toolbar-actions">
          {/* Nút Mở Ảnh Nguồn */}
          <label className="atelier-ws-btn-upload">
            <FolderOpen size={15} />
            <span>Mở ảnh</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Mở ảnh"
              disabled={Boolean(busy)}
              onChange={openImage}
            />
          </label>

          {/* Segmented Control Chọn Chế Độ Làm Việc */}
          <div className="atelier-ws-mode-switch" role="group" aria-label="Chế độ xử lý">
            <button
              type="button"
              className={`atelier-ws-mode-btn ${!sheetMode ? 'active' : ''}`}
              disabled={Boolean(busy)}
              onClick={() => selectMode('single')}
            >
              <ImageIcon size={14} />
              <span>Ảnh đơn</span>
            </button>
            <button
              type="button"
              className={`atelier-ws-mode-btn ${sheetMode ? 'active' : ''}`}
              disabled={Boolean(busy)}
              onClick={() => selectMode('sheet')}
            >
              <Grid2X2 size={14} />
              <span>Sprite Sheet</span>
            </button>
          </div>

          {/* Cụm Thu Phóng Canvas (Zoom Controls) */}
          <div className="atelier-ws-zoom-cluster" role="group" aria-label="Thu phóng vùng xem">
            <button
              type="button"
              className="atelier-ws-zoom-btn"
              disabled={!preview}
              onClick={() => setZoom(null)}
              title="Khôi phục kích thước vừa khung nhìn"
            >
              Vừa khung
            </button>
            <button
              type="button"
              className="atelier-ws-zoom-btn"
              aria-label="Thu nhỏ vùng xem"
              disabled={!preview || activeZoom <= 0.05}
              onClick={() => setZoom(Math.max(0.05, activeZoom / 1.5))}
            >
              <Minus size={14} />
            </button>
            <span className="atelier-ws-zoom-readout">
              {preview ? `${Math.round(activeZoom * 100)}%` : '—'}
            </span>
            <button
              type="button"
              className="atelier-ws-zoom-btn"
              aria-label="Phóng to vùng xem"
              disabled={!preview || activeZoom >= 32}
              onClick={() => setZoom(Math.min(32, activeZoom * 1.5))}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* ================================================================ */}
      {/* 2. THÂN WORKSPACE: VÙNG CANVAS (TRÁI) & BẢNG THÔNG SỐ (PHẢI)      */}
      {/* ================================================================ */}
      <div className="atelier-ws-body">
        {/* CỘT TRÁI: BÀN CHỈNH CANVAS & THANH TRẠNG THÁI */}
        <div className="atelier-ws-stage">
          <div
            className="atelier-ws-viewport"
            ref={viewport}
            aria-label="Bàn vẽ canvas sprite"
            onPointerDown={startPan}
            onPointerMove={movePan}
            onPointerUp={stopPan}
            onLostPointerCapture={stopPan}
          >
            {preview ? (
              <div
                className="atelier-ws-canvas"
                style={{
                  width: preview.width * activeZoom,
                  height: preview.height * activeZoom,
                }}
              >
                <img
                  src={preview.url}
                  alt={frame?.name || source.file.name}
                  draggable={false}
                />
                {sheetMode && frameIndex === null && gridValid && (
                  <div
                    className="atelier-ws-grid"
                    aria-hidden="true"
                    style={{
                      left: marginX * activeZoom,
                      top: marginY * activeZoom,
                      width: cellWidth * numCols * activeZoom,
                      height: cellHeight * numRows * activeZoom,
                      gridTemplateColumns: `repeat(${columns}, 1fr)`,
                      gridTemplateRows: `repeat(${rows}, 1fr)`,
                    }}
                  >
                    {Array.from({ length: gridCount }, (_, index) => (
                      <span key={index} />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="atelier-ws-empty">
                <div className="atelier-ws-empty-icon">
                  <ImageIcon size={30} />
                </div>
                <h4>Chưa có ảnh sprite nào được mở</h4>
                <p>Bấm nút "Mở ảnh" ở trên hoặc kéo thả tệp PNG, JPEG, WebP vào bàn vẽ để bắt đầu chuẩn hóa.</p>
              </div>
            )}
          </div>

          {/* Thanh trạng thái dưới Canvas */}
          <div className="atelier-ws-status-bar">
            <div className="atelier-ws-status-left">
              <span className="atelier-ws-status-pill">
                {preview ? `${preview.width} × ${preview.height} px` : 'Chưa có ảnh'}
              </span>
              {frame && (
                <span style={{ color: '#c084fc' }}>
                  Frame {frameIndex + 1} / {sheet.frames.length}
                </span>
              )}
            </div>

            <div role="status">
              {(busy || detectingGrid) && (
                <span className="atelier-ws-status-spinner">
                  <LoaderCircle size={14} className="atelier-ws-spinner-icon" />
                  <span>{busy || 'Đang dò lưới pixel tự nhiên…'}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: BẢNG THÔNG SỐ & THIẾT LẬP (INSPECTOR PANEL) */}
        <form className="atelier-ws-inspector" onSubmit={applyEdit}>
          {dimensions && (
            <div className="atelier-inspector-info-card">
              <p>Kích thước gốc: {dimensions.width} × {dimensions.height} px</p>
              {nativeGrid && (
                <span>
                  {nativeGrid.scale > 1
                    ? `Lưới pixel nhận diện: ${nativeGrid.width} × ${nativeGrid.height} px (~${nativeGrid.scale}×)`
                    : 'Chưa phát hiện lưới phóng to. Dùng kích thước tệp.'}
                </span>
              )}
            </div>
          )}

          {gridError && (
            <p className="atelier-ws-error">
              Không dò được lưới pixel. Dùng kích thước tệp.
            </p>
          )}

          {sheetMode ? (
            /* THIẾT LẬP CHẾ ĐỘ SPRITE SHEET */
            <>
              <h3 className="atelier-inspector-section-title">
                <Grid2X2 size={16} />
                <span>Cắt Sprite Sheet</span>
              </h3>

              <div className="atelier-inspector-grid-inputs">
                <div className="atelier-inspector-field">
                  <label className="atelier-inspector-label">Số hàng</label>
                  <input
                    type="number"
                    min="1"
                    max={MAX_FRAMES}
                    required
                    value={rows}
                    disabled={Boolean(busy)}
                    className="atelier-inspector-input"
                    onChange={(event) => changeGrid(setRows, event.target.value)}
                  />
                </div>
                <div className="atelier-inspector-field">
                  <label className="atelier-inspector-label">Số cột</label>
                  <input
                    type="number"
                    min="1"
                    max={MAX_FRAMES}
                    required
                    value={columns}
                    disabled={Boolean(busy)}
                    className="atelier-inspector-input"
                    onChange={(event) => changeGrid(setColumns, event.target.value)}
                  />
                </div>
              </div>

              <label className="atelier-inspector-checkbox">
                <input
                  type="checkbox"
                  checked={autoAnchor}
                  onChange={(e) => setAutoAnchor(e.target.checked)}
                  disabled={Boolean(busy)}
                />
                <span>Căn tâm &amp; neo chân (Bottom-Center)</span>
              </label>

              {gridValid && (
                <div className="atelier-inspector-info-card">
                  <p>{gridCount} frame · {cellWidth} × {cellHeight} px mỗi ô</p>
                  {(remainderX > 0 || remainderY > 0) && (
                    <span>
                      ✓ Tự động căn giữa lưới (bỏ {remainderX}px viền ngang, {remainderY}px viền dọc).
                    </span>
                  )}
                </div>
              )}

              {dimensions && !gridValid && (
                <p className="atelier-ws-error">
                  Dùng lưới tối đa {MAX_FRAMES} ô. Kích thước ảnh phải đủ lớn cho số hàng và số cột.
                </p>
              )}

              <button
                className="atelier-btn-primary-action"
                type="submit"
                disabled={!gridValid || Boolean(busy)}
              >
                {busy === 'Đang cắt frame…' ? (
                  <>
                    <LoaderCircle size={15} className="atelier-ws-spinner-icon" />
                    <span>Đang cắt frame…</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>Cắt frame hoạt họa</span>
                  </>
                )}
              </button>

              {sheet && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                  <button
                    className="atelier-btn-secondary-action"
                    type="button"
                    onClick={() => selectFrame(null)}
                  >
                    Xem sheet gốc
                  </button>

                  {frame && (
                    <a
                      className="atelier-btn-secondary-action"
                      href={frame.url}
                      download={frame.name}
                    >
                      <Download size={14} />
                      <span>Tải frame PNG</span>
                    </a>
                  )}

                  <button
                    className="atelier-btn-secondary-action"
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={exportSheet}
                  >
                    <Download size={14} />
                    <span>{busy === 'Đang tạo ZIP…' ? busy : 'Tải tất cả (ZIP)'}</span>
                  </button>
                </div>
              )}
            </>
          ) : (
            /* THIẾT LẬP CHẾ ĐỘ ẢNH ĐƠN */
            <>
              <h3 className="atelier-inspector-section-title">
                <Sliders size={16} />
                <span>Thao tác ảnh đơn</span>
              </h3>

              <div className="atelier-inspector-field">
                <label className="atelier-inspector-label">Loại thao tác</label>
                <select
                  value={command}
                  disabled={Boolean(busy) || detectingGrid}
                  className="atelier-inspector-select"
                  onChange={(event) => setCommand(event.target.value)}
                >
                  <option value="resize">Thu nhỏ ảnh (Resize)</option>
                  <option value="normalize">Chuẩn hóa khung và điểm neo (Normalize)</option>
                </select>
              </div>

              <div className="atelier-inspector-grid-inputs">
                <div className="atelier-inspector-field">
                  <label className="atelier-inspector-label">Rộng (px)</label>
                  <input
                    type="number"
                    min="1"
                    max={command === 'resize' ? resizeSource?.width : 512}
                    required
                    value={target.width}
                    onChange={(event) => changeTarget('width', event.target.value)}
                    disabled={Boolean(busy) || detectingGrid}
                    className="atelier-inspector-input"
                  />
                </div>
                <div className="atelier-inspector-field">
                  <label className="atelier-inspector-label">Cao (px)</label>
                  <input
                    type="number"
                    min="1"
                    max={command === 'resize' ? resizeSource?.height : 512}
                    required
                    value={target.height}
                    onChange={(event) => changeTarget('height', event.target.value)}
                    disabled={Boolean(busy) || detectingGrid}
                    className="atelier-inspector-input"
                  />
                </div>
              </div>

              {command === 'resize' ? (
                <label className="atelier-inspector-checkbox">
                  <input
                    type="checkbox"
                    checked={keepRatio}
                    onChange={(event) => {
                      setKeepRatio(event.target.checked);
                      if (event.target.checked && resizeSource && Number(target.width) > 0) {
                        setTarget({
                          ...target,
                          height: Math.max(1, Math.round((target.width * resizeSource.height) / resizeSource.width)),
                        });
                      }
                    }}
                    disabled={Boolean(busy) || detectingGrid}
                  />
                  <span>Khóa tỷ lệ khung hình</span>
                </label>
              ) : (
                <div className="atelier-inspector-field">
                  <label className="atelier-inspector-label">Điểm neo (Anchor)</label>
                  <select
                    value={anchor}
                    onChange={(event) => setAnchor(event.target.value)}
                    disabled={Boolean(busy)}
                    className="atelier-inspector-select"
                  >
                    <option value="bottom_center">Dưới và giữa (Bottom-Center: Chuẩn game)</option>
                    <option value="center">Chính giữa (Center)</option>
                    <option value="top_left">Góc trên bên trái (Top-Left)</option>
                  </select>
                </div>
              )}

              <button
                className="atelier-btn-primary-action"
                type="submit"
                disabled={!dimensions || Boolean(busy) || detectingGrid}
              >
                {busy ||
                  (command === 'resize' &&
                    (restoringGrid ? 'Khôi phục độ phân giải thật' : 'Thu nhỏ')) ||
                  'Chuẩn hóa ảnh'}
              </button>

              {result && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                  <div
                    className="atelier-ws-mode-switch"
                    role="group"
                    aria-label="So sánh ảnh"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  >
                    <button
                      type="button"
                      style={{ flex: 1 }}
                      className={`atelier-ws-mode-btn ${!showResult ? 'active' : ''}`}
                      onClick={() => {
                        setShowResult(false);
                        setZoom(null);
                      }}
                    >
                      Ảnh gốc
                    </button>
                    <button
                      type="button"
                      style={{ flex: 1 }}
                      className={`atelier-ws-mode-btn ${showResult ? 'active' : ''}`}
                      onClick={() => {
                        setShowResult(true);
                        setZoom(null);
                      }}
                    >
                      Kết quả
                    </button>
                  </div>

                  <a
                    className="atelier-btn-secondary-action"
                    href={result.url}
                    download={`${nameStem}-processed.png`}
                  >
                    <Download size={14} />
                    <span>Tải ảnh PNG</span>
                  </a>
                </div>
              )}
            </>
          )}

          {error && <p className="atelier-ws-error" role="alert">{error}</p>}
        </form>
      </div>

      {/* ================================================================ */}
      {/* 3. DẢI TIMELINE PHÁT HOẠT HỌA (ANIMATION TIMELINE REEL)          */}
      {/* ================================================================ */}
      {sheetMode && sheet && (
        <section className="atelier-ws-timeline" aria-label="Các frame hoạt họa đã cắt">
          <div className="atelier-timeline-bar">
            <div className="atelier-timeline-controls">
              <button
                className="atelier-btn-play"
                type="button"
                disabled={sheet.frames.length < 2 || Boolean(busy)}
                onClick={() => {
                  if (!playing && frameIndex === null) setFrameIndex(0);
                  setPlaying(!playing);
                }}
              >
                {playing ? <Pause size={14} /> : <Play size={14} />}
                <span>{playing ? 'Tạm dừng' : 'Phát thử'}</span>
              </button>

              <div className="atelier-fps-selector">
                <span>Tốc độ:</span>
                <select
                  value={fps}
                  onChange={(event) => setFps(Number(event.target.value))}
                >
                  {FPS_OPTIONS.map((rate) => (
                    <option key={rate} value={rate}>
                      {rate} FPS
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ fontSize: '0.78rem', color: '#c084fc', fontWeight: 600 }}>
              {sheet.frames.length} frame · lưới {sheet.rows} × {sheet.columns}
            </div>
          </div>

          <div className="atelier-timeline-reel">
            {sheet.frames.map((item, index) => (
              <button
                className={`atelier-frame-thumb-btn ${frameIndex === index ? 'active' : ''}`}
                type="button"
                key={item.name}
                aria-pressed={frameIndex === index}
                aria-label={`Frame ${index + 1}`}
                onClick={() => selectFrame(index)}
              >
                <img src={item.url} alt="" loading="lazy" />
                <span>#{index + 1}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
