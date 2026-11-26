// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT
// ========================================================
import React, { useEffect, useRef, useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Biểu tượng giao diện)
// ========================================================
import {
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  GitBranch,
  Hand,
  Lock,
  Maximize2,
  Minus,
  PencilRuler,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Slash,
  Trash2,
  Undo2,
  Unlock,
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Canvas, Hình minh họa & Cấu hình 11 thông số)
// ========================================================
import AnatomyGuideIllustration from './AnatomyGuideIllustration';
import ManualMeasurementCanvas from './ManualMeasurementCanvas';
import {
  ALL_ANATOMY_METRICS,
  ANATOMY_GROUPS,
  ANATOMY_METRIC_BY_KEY,
} from '../manualAnatomyConfig';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC
// ========================================================
import '../manual-measure-atelier.css';

/** Tạo bản đồ dữ liệu gửi lên Python từ trạng thái measurements hiện hành. */
function serializeMeasurementsPayload(measurementsMap) {
  const payload = {};
  for (const meta of ALL_ANATOMY_METRICS) {
    const entry = measurementsMap?.[meta.key];
    if (!entry) continue;
    if (entry.occluded) {
      payload[meta.key] = { occluded: true };
    } else if (Array.isArray(entry.points) && entry.points.length >= 2) {
      payload[meta.key] = { points: entry.points };
    }
  }
  return payload;
}

/**
 * Công cụ đo đoạn thẳng giải phẫu thủ công (Point-to-Point Measurement) cho 11 thông số.
 * Thu thập tọa độ điểm đo trên ảnh gốc, gửi backend Python tính số đo và đồng bộ báo cáo cho Prompt Template.
 *
 * @param {Object} props Ảnh đang mở, báo cáo hiện hành và callback cập nhật lên phiên phân tích.
 * @returns {React.ReactElement} Màn hình đo thủ công đầy đủ chức năng.
 */
export default function SpriteMeasurementEditor({ reference, report, onReport, onBack }) {
  const requestRef = useRef(null);
  const [image, setImage] = useState(null);
  const [zoom, setZoom] = useState(4);
  const [fitSignal, setFitSignal] = useState(0);
  const [panMode, setPanMode] = useState(false);
  const [axisLockEnabled, setAxisLockEnabled] = useState(true);

  const [activeMetric, setActiveMetric] = useState('body_height');
  const [polylineMode, setPolylineMode] = useState(false);
  const [draftPoints, setDraftPoints] = useState([]);

  const [hiddenMetrics, setHiddenMetrics] = useState({});
  const [showOnlyActive, setShowOnlyActive] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Bản nháp kết quả đo trong phiên chỉnh sửa; chỉ đồng bộ sang Tab Phân tích khi bấm Lưu
  const [draftReport, setDraftReport] = useState(report || null);
  const initialMap = report?.measurements || {};
  const [history, setHistory] = useState([initialMap]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const measurements = draftReport?.measurements || {};
  const activeMeta = ANATOMY_METRIC_BY_KEY[activeMetric] || ALL_ANATOMY_METRICS[0];

  useEffect(() => {
    const preview = new Image();
    preview.onload = () => setImage(preview);
    preview.onerror = () => setError('Không đọc được ảnh để đo giải phẫu.');
    preview.src = reference.url;
    return () => {
      preview.onload = null;
      preview.onerror = null;
      requestRef.current?.abort();
    };
  }, [reference.url]);

  // Tự tắt chế độ đo qua khớp nếu chuyển sang thông số chỉ có 2 điểm
  useEffect(() => {
    if (!activeMeta.supportsPolyline && polylineMode) {
      setPolylineMode(false);
      setDraftPoints([]);
    }
  }, [activeMeta, polylineMode]);

  /** Gửi bảng tọa độ lên backend Python tính số đo thực tế và lưu vào lịch sử Undo/Redo. */
  const submitToPython = async (nextMeasurementsPayload, { recordHistory = true } = {}) => {
    if (!image || requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      body.append('file', reference.file);
      body.append('regions_json', JSON.stringify({
        image_size_px: [image.width, image.height],
        measurements: nextMeasurementsPayload,
      }));
      const response = await fetch('/api/measure-regions', {
        method: 'POST',
        body,
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || 'Không tính được số đo giải phẫu.');
      if (controller.signal.aborted) return;

      setDraftReport(result);
      setDraftPoints([]);

      if (recordHistory) {
        const snapshot = result.measurements || {};
        setHistory((prev) => [...prev.slice(0, historyIndex + 1), snapshot]);
        setHistoryIndex((prev) => prev + 1);
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure.message || 'Không gửi được tọa độ lên máy chủ Python.');
      }
    } finally {
      requestRef.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  };

  const handleSelectMetric = (metricKey) => {
    setActiveMetric(metricKey);
    setDraftPoints([]);
    setPanMode(false);
    setError('');
  };

  const handleCommitPoints = (metricKey, points) => {
    const nextPayload = serializeMeasurementsPayload(measurements);
    nextPayload[metricKey] = { points };
    // Tự hiện lại đường đo nếu người dùng vừa vẽ mới trên thông số đó
    if (hiddenMetrics[metricKey]) {
      setHiddenMetrics((prev) => ({ ...prev, [metricKey]: false }));
    }
    submitToPython(nextPayload);
  };

  const handleToggleOccluded = (metricKey) => {
    const nextPayload = serializeMeasurementsPayload(measurements);
    const currentlyOccluded = Boolean(measurements[metricKey]?.occluded);
    if (currentlyOccluded) {
      delete nextPayload[metricKey];
    } else {
      nextPayload[metricKey] = { occluded: true };
    }
    if (metricKey === activeMetric) setDraftPoints([]);
    submitToPython(nextPayload);
  };

  const handleDeleteMetric = (metricKey) => {
    if (!measurements[metricKey]) return;
    const nextPayload = serializeMeasurementsPayload(measurements);
    delete nextPayload[metricKey];
    submitToPython(nextPayload);
  };

  const handleUndo = () => {
    if (busy || historyIndex <= 0) return;
    const prevIndex = historyIndex - 1;
    const targetSnapshot = history[prevIndex];
    setHistoryIndex(prevIndex);
    submitToPython(serializeMeasurementsPayload(targetSnapshot), { recordHistory: false });
  };

  const handleRedo = () => {
    if (busy || historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    const targetSnapshot = history[nextIndex];
    setHistoryIndex(nextIndex);
    submitToPython(serializeMeasurementsPayload(targetSnapshot), { recordHistory: false });
  };

  // Phím tắt Ctrl+Z / Ctrl+Y cho Hoàn tác & Làm lại
  useEffect(() => {
    const onShortcut = (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  });

  /** Lưu kết quả đo hiện tại sang Tab Phân tích và đóng màn hình đo thủ công. */
  const handleSaveMeasurements = () => {
    if (busy || !draftReport) return;
    onReport(draftReport);
    onBack();
  };

  const measuredCount = ALL_ANATOMY_METRICS.filter((m) => measurements[m.key]?.status === 'measured').length;
  const occludedCount = ALL_ANATOMY_METRICS.filter((m) => measurements[m.key]?.occluded).length;
  const unmeasuredCount = ALL_ANATOMY_METRICS.length - measuredCount - occludedCount;

  return (
    <section className="manual-measure-studio" aria-label="Công cụ đo đoạn thẳng giải phẫu thủ công">
      {/* Thanh công cụ trên cùng */}
      <header className="manual-measure-topbar">
        <div className="manual-measure-title-group">
          <button type="button" className="manual-tool-btn" onClick={onBack} disabled={busy}>
            <ArrowLeft size={15} />
            <span>Quay lại Phân tích</span>
          </button>
          <h3>Đo đoạn thẳng giải phẫu (11 thông số)</h3>
        </div>

        <div className="manual-measure-toolbar-group">
          <button
            type="button"
            className={`manual-tool-btn ${!panMode ? 'active' : ''}`}
            onClick={() => setPanMode(false)}
            title="Công cụ đo đoạn thẳng"
          >
            <PencilRuler size={14} />
            <span>Đo điểm</span>
          </button>
          <button
            type="button"
            className={`manual-tool-btn ${panMode ? 'active' : ''}`}
            onClick={() => setPanMode((prev) => !prev)}
            title="Di chuyển ảnh (hoặc giữ phím Space + kéo chuột)"
          >
            <Hand size={14} />
            <span>Di chuyển ảnh</span>
          </button>

          <button
            type="button"
            className="manual-tool-btn"
            onClick={() => setZoom((z) => Math.max(0.5, Number((z / 1.5).toFixed(2))))}
            disabled={!image}
            aria-label="Thu nhỏ"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            className="manual-tool-btn"
            onClick={() => setFitSignal((s) => s + 1)}
            disabled={!image}
            title="Căn vừa khung nhìn"
          >
            <Maximize2 size={13} />
            <span>{zoom}×</span>
          </button>
          <button
            type="button"
            className="manual-tool-btn"
            onClick={() => setZoom((z) => Math.min(24, Number((z * 1.5).toFixed(2))))}
            disabled={!image}
            aria-label="Phóng to"
          >
            <Plus size={14} />
          </button>

          <button
            type="button"
            className="manual-tool-btn"
            onClick={handleUndo}
            disabled={busy || historyIndex <= 0}
            title="Hoàn tác (Ctrl+Z)"
          >
            <Undo2 size={14} />
            <span>Hoàn tác</span>
          </button>
          <button
            type="button"
            className="manual-tool-btn"
            onClick={handleRedo}
            disabled={busy || historyIndex >= history.length - 1}
            title="Làm lại (Ctrl+Y)"
          >
            <Redo2 size={14} />
            <span>Làm lại</span>
          </button>

          <button
            type="button"
            className={`manual-tool-btn ${axisLockEnabled ? 'active' : ''}`}
            onClick={() => setAxisLockEnabled((prev) => !prev)}
            title="Tự động khóa vuông góc trục Ox (chiều cao) và trục Oy (chiều rộng) để chống run tay; với tay/chân có thể giữ Shift"
          >
            {axisLockEnabled ? <Lock size={14} /> : <Unlock size={14} />}
            <span>{axisLockEnabled ? 'Khóa trục Ox/Oy' : 'Đo tự do'}</span>
          </button>

          <button
            type="button"
            className={`manual-tool-btn ${showOnlyActive ? 'active' : ''}`}
            onClick={() => setShowOnlyActive((prev) => !prev)}
            title="Ẩn các đường khác để tập trung vào thông số đang chọn"
          >
            {showOnlyActive ? <EyeOff size={14} /> : <Eye size={14} />}
            <span>{showOnlyActive ? 'Chỉ hiện mục chọn' : 'Hiện tất cả'}</span>
          </button>

          <button
            type="button"
            className="manual-tool-btn manual-save-btn"
            onClick={handleSaveMeasurements}
            disabled={busy || !image || (!draftReport && !Object.keys(measurements).length)}
            title="Lưu toàn bộ kết quả đo và hiển thị tại Tab Phân tích"
          >
            <Save size={14} />
            <span>Lưu kết quả đo</span>
          </button>
        </div>
      </header>

      {/* Khu vực làm việc 2 cột: Canvas lớn bên trái + Bảng điều khiển/Tổng hợp bên phải */}
      <div className="manual-measure-workspace">
        <div className="manual-canvas-column">
          {activeMeta.supportsPolyline && (
            <div className="manual-limb-subbar">
              <span>
                Đang chọn <strong>{activeMeta.label}</strong>: hỗ trợ kéo thẳng 1 đoạn hoặc nối nhiều đoạn qua khớp nếu chi đang gập.
              </span>
              <div className="manual-measure-toolbar-group">
                <button
                  type="button"
                  className={`manual-tool-btn ${polylineMode ? 'active' : ''}`}
                  onClick={() => {
                    setPolylineMode((prev) => !prev);
                    setDraftPoints([]);
                    setPanMode(false);
                  }}
                >
                  <GitBranch size={13} />
                  <span>{polylineMode ? 'Đang đo qua khớp' : 'Đo nhiều đoạn qua khớp'}</span>
                </button>
                {polylineMode && draftPoints.length >= 2 && (
                  <button
                    type="button"
                    className="manual-tool-btn active"
                    onClick={() => handleCommitPoints(activeMetric, draftPoints)}
                    disabled={busy}
                  >
                    <Check size={13} />
                    <span>Hoàn tất chi ({draftPoints.length} điểm)</span>
                  </button>
                )}
                {polylineMode && draftPoints.length > 0 && (
                  <button
                    type="button"
                    className="manual-tool-btn"
                    onClick={() => setDraftPoints([])}
                  >
                    <RotateCcw size={13} />
                    <span>Hủy nháp</span>
                  </button>
                )}
              </div>
            </div>
          )}

          <ManualMeasurementCanvas
            image={image}
            measurements={measurements}
            activeMetric={activeMetric}
            hiddenMetrics={hiddenMetrics}
            showOnlyActive={showOnlyActive}
            panMode={panMode}
            axisLockEnabled={axisLockEnabled}
            polylineMode={polylineMode}
            draftPoints={draftPoints}
            zoom={zoom}
            onZoomChange={setZoom}
            fitSignal={fitSignal}
            busy={busy}
            onSelectMetric={handleSelectMetric}
            onCommitPoints={handleCommitPoints}
            onAddDraftPoint={(pt) => setDraftPoints((prev) => [...prev, pt])}
            onFinishPolyline={() => {
              if (draftPoints.length >= 2) handleCommitPoints(activeMetric, draftPoints);
            }}
            onDeleteActive={() => handleDeleteMetric(activeMetric)}
            onUndoDraftPoint={() => setDraftPoints((prev) => prev.slice(0, -1))}
            onCancelDraft={() => setDraftPoints([])}
          />

          <p className={`manual-status-line ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}>
            {error
              || (busy
                ? 'Đang gửi tọa độ ảnh gốc lên Backend Python để tính số đo…'
                : polylineMode
                  ? 'Bấm lần lượt các khớp (Vai → Khuỷu → Cổ tay hoặc Hông → Gối → Cổ chân; giữ Shift để thẳng hàng), nhấn Enter hoặc nhấp đúp để hoàn tất.'
                  : 'Nhấn giữ và kéo chuột để tạo đoạn đo (tự khóa vuông góc Ox/Oy khi đo cao/rộng; giữ Shift để khóa trục tay/chân); giữ Space để kéo ảnh.')}
          </p>
        </div>

        {/* Cột phải: Hình minh họa, 11 thông số theo nhóm và Bảng tổng hợp */}
        <aside className="manual-inspector-column">
          <AnatomyGuideIllustration activeMetric={activeMetric} />

          <div className="manual-groups-card">
            <div className="manual-section-header">
              <h4>11 thông số giải phẫu</h4>
              <span style={{ fontSize: '0.73rem', color: 'var(--atl-emerald)' }}>
                {measuredCount}/11 đã đo
              </span>
            </div>

            {ANATOMY_GROUPS.map((group) => (
              <div key={group.id} className="manual-group-block">
                <div className="manual-group-title">
                  <span className="manual-color-dot" style={{ backgroundColor: `var(${group.colorVar})` }} />
                  <span>{group.label} ({group.colorName})</span>
                </div>

                {group.metrics.map((metric) => {
                  const entry = measurements[metric.key];
                  const isOccluded = Boolean(entry?.occluded);
                  const isMeasured = entry?.status === 'measured' && entry?.value_px !== null;
                  const isHidden = Boolean(hiddenMetrics[metric.key]);
                  const isActive = activeMetric === metric.key;

                  return (
                    <div
                      key={metric.key}
                      className={`manual-metric-row ${isActive ? 'is-active' : ''} ${isOccluded ? 'is-occluded' : ''}`}
                    >
                      <button
                        type="button"
                        className="manual-metric-select"
                        onClick={() => handleSelectMetric(metric.key)}
                      >
                        <span>{metric.label}</span>
                        <span
                          className={`manual-metric-value ${isOccluded ? 'is-occluded' : !isMeasured ? 'is-muted' : ''}`}
                        >
                          {isOccluded ? 'Che khuất' : isMeasured ? `${entry.value_px} px` : '—'}
                        </span>
                      </button>

                      <button
                        type="button"
                        className="manual-icon-btn"
                        disabled={!isMeasured}
                        onClick={() =>
                          setHiddenMetrics((prev) => ({ ...prev, [metric.key]: !prev[metric.key] }))
                        }
                        title={isHidden ? 'Hiện đường đo' : 'Ẩn đường đo'}
                        aria-label={`${isHidden ? 'Hiện' : 'Ẩn'} ${metric.label}`}
                      >
                        {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>

                      <button
                        type="button"
                        className={`manual-icon-btn ${isOccluded ? 'is-on' : ''}`}
                        disabled={busy}
                        onClick={() => handleToggleOccluded(metric.key)}
                        title={isOccluded ? 'Bỏ đánh dấu che khuất để đo lại' : 'Đánh dấu bộ phận bị che khuất (bỏ qua)'}
                        aria-label={`Đánh dấu che khuất ${metric.label}`}
                      >
                        <Slash size={13} />
                      </button>

                      <button
                        type="button"
                        className="manual-icon-btn"
                        disabled={busy || !entry}
                        onClick={() => handleDeleteMetric(metric.key)}
                        title="Xóa số đo để đo lại"
                        aria-label={`Xóa ${metric.label}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="manual-summary-card">
            <div className="manual-section-header">
              <h4>Bảng tổng hợp kết quả</h4>
            </div>
            <div className="manual-summary-stats">
              <span>Đã đo: <strong>{measuredCount}</strong></span>
              <span>•</span>
              <span>Che khuất: <strong>{occludedCount}</strong></span>
              <span>•</span>
              <span>Chưa đo: <strong>{unmeasuredCount}</strong></span>
            </div>
            <table className="manual-summary-table">
              <thead>
                <tr>
                  <th>Thông số</th>
                  <th>Trạng thái</th>
                  <th>Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {ALL_ANATOMY_METRICS.map((metric) => {
                  const entry = measurements[metric.key];
                  const isOccluded = Boolean(entry?.occluded);
                  const isMeasured = entry?.status === 'measured' && entry?.value_px !== null;
                  return (
                    <tr key={metric.key} onClick={() => handleSelectMetric(metric.key)} style={{ cursor: 'pointer' }}>
                      <td>{metric.label}</td>
                      <td>{isOccluded ? 'Che khuất' : isMeasured ? 'Đã đo' : 'Chưa đo'}</td>
                      <td>{isMeasured ? `${entry.value_px} px` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </aside>
      </div>
    </section>
  );
}
