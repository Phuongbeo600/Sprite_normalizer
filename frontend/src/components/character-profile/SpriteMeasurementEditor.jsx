// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT
// ========================================================
// Các hook giữ bản vẽ nháp, tải ảnh và cập nhật canvas.
import { useEffect, useRef, useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI
// ========================================================
// lucide-react: Biểu tượng quay lại, điều chỉnh thu phóng và lưu tệp.
import { ArrowLeft, Download, Minus, Plus, Upload } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// ========================================================
// Không cần thêm thành phần nội bộ.

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC
// ========================================================
// Dùng các biến màu bộ phận và lớp định dạng trong theme.css.

const PARTS = [
  ['head', 'Đầu'], ['neck', 'Cổ'], ['torso', 'Thân'],
  ['left_arm', 'Tay trái'], ['right_arm', 'Tay phải'],
  ['left_leg', 'Chân trái'], ['right_leg', 'Chân phải'],
];
const LIMBS = new Set(['left_arm', 'right_arm', 'left_leg', 'right_leg']);
const samePoint = (a, b) => a?.[0] === b?.[0] && a?.[1] === b?.[1];

/**
 * Vẽ đa giác, trục chi và đoạn thẳng trên lưới pixel của ảnh gốc.
 *
 * @param {Object} props Ảnh đang mở, báo cáo hiện tại và thao tác lưu vào hồ sơ.
 * @returns {React.ReactElement} Bàn đo thủ công.
 */
export default function SpriteMeasurementEditor({ reference, report, onReport, onBack }) {
  const canvas = useRef(null);
  const request = useRef(null);
  const [image, setImage] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [part, setPart] = useState('head');
  const [mode, setMode] = useState('polygon');
  const [showAll, setShowAll] = useState(true);
  const [vertices, setVertices] = useState([]);
  const [awaitingAxis, setAwaitingAxis] = useState(false);
  const [axisStart, setAxisStart] = useState(null);
  const [drag, setDrag] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const measurements = report?.measurements;

  useEffect(() => {
    const preview = new Image();
    preview.onload = () => {
      setImage(preview);
      setZoom(Math.max(1, Math.min(6, Math.floor(420 / Math.max(preview.width, preview.height)))));
    };
    preview.onerror = () => setError('Không đọc được ảnh để đo.');
    preview.src = reference.url;
    return () => {
      preview.onload = null;
      preview.onerror = null;
      request.current?.abort();
    };
  }, [reference.url]);

  useEffect(() => {
    if (!image || !canvas.current) return;
    const node = canvas.current;
    const scale = Math.min(zoom * (window.devicePixelRatio || 1), 2048 / Math.max(image.width, image.height));
    node.width = Math.max(1, Math.round(image.width * scale));
    node.height = Math.max(1, Math.round(image.height * scale));
    const context = node.getContext('2d');
    context.setTransform(node.width / image.width, 0, 0, node.height / image.height, 0, 0);
    context.imageSmoothingEnabled = false;
    context.drawImage(image, 0, 0);

    const colors = getComputedStyle(node);
    const colorFor = (key) => colors.getPropertyValue(`--measure-${key}`).trim();
    const draw = (points, color, { closed = false, dashed = false, fill = false } = {}) => {
      if (points.length < 2) return;
      context.beginPath();
      points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
      if (closed) context.closePath();
      if (fill) {
        context.globalAlpha = 0.18;
        context.fillStyle = color;
        context.fill();
        context.globalAlpha = 1;
      }
      context.setLineDash(dashed ? [3 / zoom, 3 / zoom] : []);
      context.strokeStyle = '#101627';
      context.lineWidth = 3.5 / zoom;
      context.stroke();
      context.strokeStyle = color;
      context.lineWidth = 1.7 / zoom;
      context.stroke();
    };
    const dot = ([x, y], color) => {
      context.beginPath();
      context.arc(x, y, 3 / zoom, 0, Math.PI * 2);
      context.fillStyle = color;
      context.fill();
    };

    for (const [key, entry] of Object.entries(measurements || {})) {
      if (!showAll && key !== part) continue;
      const color = colorFor(key);
      if (entry.polygon) draw(entry.polygon, color, { closed: true, fill: true });
      if (entry.axis) draw(entry.axis, color, { dashed: true });
      for (const [width, start, end] of entry.cuts || []) {
        if (width && !(samePoint(start, entry.start) && samePoint(end, entry.end))) {
          draw([start, end], color, { dashed: true });
        }
      }
      draw([entry.start, entry.end], color);
    }
    const draftColor = colorFor(part);
    draw(vertices, draftColor, { closed: awaitingAxis });
    vertices.forEach((point) => dot(point, draftColor));
    if (axisStart) dot(axisStart, draftColor);
    if (drag) draw([drag.start, drag.end], draftColor);
  }, [image, zoom, part, showAll, measurements, vertices, awaitingAxis, axisStart, drag]);

  const clearDraft = () => {
    setVertices([]);
    setAwaitingAxis(false);
    setAxisStart(null);
    setDrag(null);
  };

  /** @param {Object} data Các điểm đo trên ảnh và kích thước canvas gốc. */
  const submit = async (data) => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', reference.file);
      body.append('regions_json', JSON.stringify(data));
      const response = await fetch('/api/measure-regions', { method: 'POST', body, signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Không đo được vùng này.');
      if (controller.signal.aborted) return;
      onReport(result);
      clearDraft();
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message || 'Không gửi được số đo.');
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const updateMeasurements = (next) => submit({
    image_size_px: [image.width, image.height],
    measurements: next,
  });
  const savePart = (shape) => updateMeasurements({ ...measurements, [part]: shape });

  const closePolygon = () => {
    if (awaitingAxis) {
      savePart({ polygon: vertices });
    } else if (LIMBS.has(part)) {
      setAwaitingAxis(true);
    } else {
      savePart({ polygon: vertices });
    }
  };

  const undo = () => {
    if (axisStart) setAxisStart(null);
    else if (awaitingAxis) setAwaitingAxis(false);
    else setVertices((points) => points.slice(0, -1));
  };

  const imagePoint = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const snap = (value, length, pixels) => Math.max(0, Math.min(pixels, Math.round(value / length * pixels)));
    return [
      snap(event.clientX - rect.left, rect.width, image.width),
      snap(event.clientY - rect.top, rect.height, image.height),
    ];
  };

  const pointerDown = (event) => {
    if (busy || event.button !== 0) return;
    event.currentTarget.focus();
    const point = imagePoint(event);
    if (mode === 'segment') {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({ start: point, end: point });
    } else if (awaitingAxis) {
      if (!axisStart) setAxisStart(point);
      else if (!samePoint(axisStart, point)) savePart({ polygon: vertices, axis: [axisStart, point] });
    } else if (!samePoint(vertices.at(-1), point)) {
      setVertices([...vertices, point]);
    }
  };

  const pointerUp = (event) => {
    if (!drag) return;
    const end = imagePoint(event);
    setDrag(null);
    if (!samePoint(drag.start, end)) savePart({ start: drag.start, end });
  };

  const canClose = !busy && mode === 'polygon' && new Set(vertices.map(String)).size >= 3;
  const keyboard = (event) => {
    if (busy) return;
    if (event.key === 'Enter' && canClose) closePolygon();
    else if (event.key === 'Backspace') undo();
    else if (event.key === 'Escape') clearDraft();
    else return;
    event.preventDefault();
  };

  const loadJson = async (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
      await submit(data);
    } catch {
      setError('Tệp JSON số đo không hợp lệ.');
    }
  };

  const downloadJson = () => {
    const data = { image: reference.name, image_size_px: report.image_size_px, measurements };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reference.name.replace(/\.[^.]+$/, '')}.measurements.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="studio-viewport-card sprite-measure-editor" aria-label="Đo thủ công">
      <div className="studio-viewport-header sprite-measure-toolbar">
        <button className="btn-secondary-studio" type="button" onClick={onBack} disabled={busy}>
          <ArrowLeft size={15} /> Phân tích sprite
        </button>
        <h3>Đo thủ công</h3>
        <div className="sprite-measure-actions">
          <button className="btn-ghost-studio" type="button" aria-label="Thu nhỏ" disabled={!image || zoom <= 0.25} onClick={() => setZoom(zoom / 2)}><Minus size={15} /></button>
          <output aria-label="Mức thu phóng">{zoom}×</output>
          <button className="btn-ghost-studio" type="button" aria-label="Phóng to" disabled={!image || zoom >= 8} onClick={() => setZoom(Math.min(8, zoom * 2))}><Plus size={15} /></button>
          <label className="btn-secondary-studio studio-file-button">
            <Upload size={14} /> Nạp JSON
            <input type="file" accept=".json,application/json" disabled={!image || busy} onChange={loadJson} />
          </label>
          <button className="btn-secondary-studio" type="button" disabled={!measurements || !Object.keys(measurements).length || busy} onClick={downloadJson}><Download size={14} /> Lưu JSON</button>
        </div>
      </div>

      <div className="sprite-measure-layout">
        <div className="sprite-measure-scroll">
          {image && (
            <canvas
              ref={canvas}
              style={{ width: image.width * zoom, height: image.height * zoom }}
              aria-label="Ảnh sprite để khoanh vùng hoặc kéo đoạn đo"
              tabIndex={0}
              onKeyDown={keyboard}
              onPointerDown={pointerDown}
              onPointerMove={(event) => { if (drag) setDrag({ ...drag, end: imagePoint(event) }); }}
              onPointerUp={pointerUp}
              onPointerCancel={() => setDrag(null)}
            />
          )}
        </div>
        <div className="sprite-measure-controls">
          <fieldset disabled={busy || !image}>
            <legend>Cách đo</legend>
            <label><input type="radio" name="measure-mode" checked={mode === 'polygon'} onChange={() => { clearDraft(); setMode('polygon'); }} /> Khoanh vùng</label>
            <label><input type="radio" name="measure-mode" checked={mode === 'segment'} onChange={() => { clearDraft(); setMode('segment'); }} /> Kéo đoạn</label>
          </fieldset>
          <fieldset disabled={busy || !image}>
            <legend>Bộ phận cần đo</legend>
            {PARTS.map(([key, label]) => (
              <label key={key} className="sprite-measure-part">
                <input type="radio" name="measure-part" checked={part === key} onChange={() => { clearDraft(); setPart(key); }} />
                <span className="sprite-measure-dot" style={{ backgroundColor: `var(--measure-${key})` }} />
                {label}
                <output>{measurements?.[key] ? `${measurements[key].width_px.toFixed(2)} px` : '—'}</output>
              </label>
            ))}
          </fieldset>
          <label className="sprite-measure-show-all"><input type="checkbox" checked={showAll} onChange={(event) => setShowAll(event.target.checked)} /> Xem tất cả vùng và đoạn</label>
          {mode === 'polygon' && (
            <button className="btn-primary-studio" type="button" disabled={!canClose} onClick={closePolygon}>
              {awaitingAxis ? 'Dùng trục dọc' : 'Khép vùng'}
            </button>
          )}
          <div className="sprite-measure-actions">
            <button className="btn-ghost-studio" type="button" disabled={!vertices.length || busy} onClick={undo}>Hoàn tác điểm</button>
            <button className="btn-ghost-studio" type="button" disabled={!measurements?.[part] || busy} onClick={() => savePart(null)}>Xóa số đo</button>
          </div>
        </div>
      </div>
      <p className={`sprite-measure-status ${error ? 'studio-reference-error' : ''}`} role={error ? 'alert' : 'status'}>
        {error || (busy ? 'Đang tính số đo…' : awaitingAxis
          ? 'Bấm hai điểm dọc theo tay hoặc chân để chọn trục đo.'
          : mode === 'polygon' ? 'Bấm các điểm quanh bộ phận, rồi bấm Khép vùng hoặc Enter.' : 'Kéo từ điểm đầu đến điểm cuối của đoạn cần đo.')}
      </p>
    </section>
  );
}
