// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Biểu tượng cho ảnh mẫu, bảng màu, thước đo, mắt ẩn hiện, đũa phép và tải
import {
  Eye,
  EyeOff,
  FolderOpen,
  LoaderCircle,
  Palette,
  Ruler,
  Wand2,
  Crop,
  Sparkles,
  ArrowRight
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// SpriteMeasurementEditor: Bàn đo đa giác và đoạn thẳng thủ công trên ảnh gốc
import SpriteMeasurementEditor from './SpriteMeasurementEditor';
// PaletteMetricsSection: Các chỉ số đo màu chi tiết
import PaletteMetricsSection from './PaletteMetricsSection';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark Fantasy Atelier từ analysis-atelier.css
import '../../styles/analysis-atelier.css';

const REGION_LABELS = { head: 'Đầu', neck: 'Cổ', torso: 'Thân trên' };

/**
 * Hiển thị ảnh tham chiếu, số đo giải phẫu và báo cáo màu sắc theo phong cách Dark Fantasy Atelier.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object|null} props.reference Tệp ảnh tham chiếu đang chọn.
 * @param {string|null} props.annotatedUrl URL ảnh có vẽ lớp phủ giải phẫu.
 * @param {boolean} props.showOverlay Trạng thái bật/tắt lớp phủ.
 * @param {Function} props.onToggleOverlay Hàm đổi trạng thái lớp phủ.
 * @param {Function} props.onMeasure Hàm gọi đo đạc Python (size / colors).
 * @param {string|null} props.localAction Thao tác đo đang thực thi.
 * @param {Object|null} props.metrics Số đo hình học nhân vật.
 * @param {Object|null} props.regions Số đo các vùng tự động.
 * @param {Object|null} props.pixelReport Báo cáo thông số pixel art.
 * @param {Object|null} props.palette Dữ liệu bảng màu.
 * @param {string} props.analysisError Thông báo lỗi đo hình học.
 * @param {string} props.colorError Thông báo lỗi phân tích màu.
 * @param {Function} props.onOpenPrompt Hàm chuyển sang tab Sinh Prompt.
 * @param {Object|null} props.manualRegions Số đo khoanh vùng thủ công.
 * @param {Function} props.onManualReport Hàm nhận báo cáo đo thủ công.
 * @returns {React.ReactElement} Giao diện tab Đo đạc Sprite Atelier.
 */
export default function TabReferenceView({
  reference,
  annotatedUrl,
  showOverlay,
  onToggleOverlay,
  onMeasure,
  localAction,
  metrics,
  regions,
  pixelReport,
  palette,
  analysisError,
  colorError,
  onOpenPrompt,
  manualRegions,
  onManualReport,
}) {
  const [editingMeasurements, setEditingMeasurements] = useState(false);
  const measurements = Object.entries(regions?.measurements || {});
  const manualCount = Object.keys(manualRegions?.measurements || {}).length;
  const swatches = palette?.dominant_colors?.slice(0, 12) || [];
  const ready = manualCount > 0 || measurements.length > 0 || palette?.total_colors > 0;
  const busy = Boolean(localAction);

  // Mở trình chỉnh sửa khoanh vùng lát cắt thủ công
  if (reference && editingMeasurements) {
    return (
      <SpriteMeasurementEditor
        key={reference.url}
        reference={reference}
        report={manualRegions}
        onReport={onManualReport}
        onBack={() => setEditingMeasurements(false)}
      />
    );
  }

  return (
    <div className="atelier-reference-layout">
      {/* ================================================================ */}
      {/* CỘT TRÁI: VÙNG CANVAS HIỂN THỊ ẢNH THAM CHIẾU & LỚP PHỦ           */}
      {/* ================================================================ */}
      <section className="atelier-ref-card" aria-label="Ảnh sprite tham chiếu">
        <div className="atelier-ref-card-header">
          <h3>
            <FolderOpen size={16} color="#c084fc" />
            <span>{reference?.name || 'Ảnh tham chiếu chưa nạp'}</span>
          </h3>
        </div>

        {/* Khung Bàn Vẽ Caro Hiển Thị Ảnh Mẫu */}
        <div className="atelier-ref-preview-stage">
          {reference ? (
            <img
              src={showOverlay && annotatedUrl ? annotatedUrl : reference.url}
              alt={reference.name}
            />
          ) : (
            <div className="atelier-ref-empty-notice">
              Bấm nút "Chọn ảnh sprite" ở trên để nạp tệp PNG, JPEG hoặc WebP phục vụ bóc tách giải phẫu.
            </div>
          )}
        </div>

        {/* Thanh Điều Khiển Bật/Tắt Lớp Phủ Giải Phẫu */}
        <div className="atelier-ref-card-controls">
          <label className={`atelier-ref-toggle-chip ${showOverlay && annotatedUrl ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={showOverlay}
              disabled={!annotatedUrl}
              onChange={onToggleOverlay}
            />
            {showOverlay ? <Eye size={15} /> : <EyeOff size={15} />}
            <span>Lớp phủ giải phẫu nhân vật</span>
          </label>
        </div>

        {/* Chú giải vùng màu giải phẫu */}
        {showOverlay && annotatedUrl && (
          <div className="atelier-ref-legend-bar" aria-label="Chú giải lớp phủ">
            <span className="atelier-legend-item-head">■ Đầu (Head)</span>
            <span className="atelier-legend-item-torso">■ Thân (Torso)</span>
            <span className="atelier-legend-item-legs">■ Chân (Legs)</span>
          </div>
        )}
      </section>

      {/* ================================================================ */}
      {/* CỘT PHẢI: BẢNG CHỈ SỐ GIẢI PHẪU & MÀU SẮC (METRICS INSPECTOR)     */}
      {/* ================================================================ */}
      <div className="atelier-metrics-column" aria-busy={busy}>
        {/* THẺ 1: KÍCH THƯỚC & TỶ LỆ HÌNH HỌC */}
        <section className="atelier-metric-card">
          <div className="atelier-metric-header">
            <h4 className="atelier-metric-title">
              <Ruler size={16} />
              <span>Kích thước &amp; Tỷ lệ giải phẫu</span>
            </h4>
            <button
              className="atelier-btn-secondary-action"
              style={{ width: 'auto', padding: '5px 12px', fontSize: '0.75rem' }}
              type="button"
              disabled={!reference || busy}
              onClick={() => setEditingMeasurements(true)}
            >
              <Crop size={13} />
              <span>Khoanh vùng đo{manualCount > 0 ? ` (${manualCount})` : ''}</span>
            </button>
          </div>

          <button
            className="atelier-btn-secondary-action"
            type="button"
            disabled={!reference || busy}
            onClick={() => onMeasure('size')}
          >
            {localAction === 'size' ? (
              <>
                <LoaderCircle size={14} className="atelier-ws-spinner-icon" />
                <span>Đang tính toán giải phẫu Python…</span>
              </>
            ) : (
              <>
                <Sparkles size={14} color="#c084fc" />
                <span>Đo kích thước tự động (Python)</span>
              </>
            )}
          </button>

          {manualCount > 0 && (
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--atl-emerald, #10b981)', fontWeight: 600 }}>
              ✓ Đã đo {manualCount} bộ phận thủ công. Bộ máy tạo Prompt sẽ ưu tiên các số đo này.
            </p>
          )}

          {analysisError && <p className="atelier-ws-error" role="alert">{analysisError}</p>}

          {metrics ? (
            <>
              {/* Lưới 4 chỉ số giải phẫu chính */}
              <div className="atelier-stats-grid">
                <div className="atelier-stat-cell">
                  <span className="atelier-stat-cell-label">Chiều cao nhân vật</span>
                  <span className="atelier-stat-cell-value">
                    {metrics.anatomical_height || metrics.visible_height} px
                  </span>
                </div>
                <div className="atelier-stat-cell">
                  <span className="atelier-stat-cell-label">Tỷ lệ vóc dáng</span>
                  <span className="atelier-stat-cell-value">
                    {metrics.heads_tall} đầu
                  </span>
                </div>
                <div className="atelier-stat-cell">
                  <span className="atelier-stat-cell-label">Khung đầu (W × H)</span>
                  <span className="atelier-stat-cell-value">
                    {metrics.head_width ?? metrics.head_w} × {metrics.head_height ?? metrics.head_h} px
                  </span>
                </div>
                <div className="atelier-stat-cell">
                  <span className="atelier-stat-cell-label">Khung thân (W × H)</span>
                  <span className="atelier-stat-cell-value">
                    {metrics.body_width ?? metrics.body_w} × {metrics.body_height ?? metrics.body_h} px
                  </span>
                </div>
              </div>

              {/* Danh sách các lát cắt đo lường */}
              {measurements.length > 0 && (
                <div style={{ marginTop: '4px' }}>
                  <p style={{ margin: '0 0 6px', fontSize: '0.74rem', color: '#a39bc2', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                    Bề rộng các lát cắt trên ảnh gốc:
                  </p>
                  <div className="atelier-readings-grid">
                    {measurements.map(([part, measurement]) => (
                      <div className="atelier-reading-box" key={part}>
                        <span className="atelier-reading-label">{REGION_LABELS[part] || part}</span>
                        <span className="atelier-reading-value">{measurement.width_px} px</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
              Bấm nút "Đo kích thước tự động" hoặc khoanh vùng thủ công để phân tích tỷ lệ vóc dáng.
            </p>
          )}
        </section>

        {/* THẺ 2: MÀU SẮC & PHONG CÁCH PIXEL ART */}
        <section className="atelier-metric-card">
          <div className="atelier-metric-header">
            <h4 className="atelier-metric-title">
              <Palette size={16} />
              <span>Bảng màu &amp; Phong cách Pixel Art</span>
            </h4>
            <button
              className="atelier-btn-primary-action"
              style={{ width: 'auto', padding: '6px 14px', fontSize: '0.78rem', margin: 0 }}
              type="button"
              disabled={!reference || busy}
              onClick={() => onMeasure('colors')}
            >
              {localAction === 'colors' ? (
                <>
                  <LoaderCircle size={14} className="atelier-ws-spinner-icon" />
                  <span>Đang phân tích màu…</span>
                </>
              ) : (
                <>
                  <Palette size={14} />
                  <span>Phân tích màu sắc</span>
                </>
              )}
            </button>
          </div>

          {colorError && <p className="atelier-ws-error" role="alert">{colorError}</p>}

          {pixelReport ? (
            <div className="atelier-readings-grid">
              <div className="atelier-reading-box">
                <span className="atelier-reading-label">Màu trên lưới</span>
                <span className="atelier-reading-value">{pixelReport.palette.total_colors} màu</span>
              </div>
              <div className="atelier-reading-box">
                <span className="atelier-reading-label">Lưới pixel gốc</span>
                <span className="atelier-reading-value">{pixelReport.grid.native_size_wh.join(' × ')}</span>
              </div>
              <div className="atelier-reading-box">
                <span className="atelier-reading-label">Độ tương phản WCAG</span>
                <span className="atelier-reading-value">{pixelReport.palette.contrast_ratio_wcag}:1</span>
              </div>
              <div className="atelier-reading-box">
                <span className="atelier-reading-label">Dải đổ bóng (Ramps)</span>
                <span className="atelier-reading-value">{pixelReport.shading.n_ramps} dải</span>
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
              {palette
                ? palette.total_colors > 0
                  ? `Bảng màu hồ sơ có ${palette.total_colors} màu nhận diện.`
                  : 'Ảnh chưa có pixel nhìn thấy để phân tích màu.'
                : 'Bảng màu và dải đổ bóng sẽ xuất hiện sau khi phân tích.'}
            </p>
          )}

          {/* Dải Swatches màu chủ đạo */}
          {swatches.length > 0 && (
            <div>
              <p style={{ margin: '0 0 6px', fontSize: '0.74rem', color: '#a39bc2', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                Màu sắc chủ đạo nhận diện:
              </p>
              <ul className="atelier-swatches-grid" aria-label="Màu chủ đạo">
                {swatches.map((swatch) => (
                  <li className="atelier-swatch-item" key={swatch.hex_code}>
                    <span className="atelier-swatch-color" style={{ backgroundColor: swatch.hex_code }} />
                    <span className="atelier-swatch-code">{swatch.hex_code}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {palette?.total_colors > 0 && (
            <details className="studio-measure-details">
              <summary>Xem chi tiết toàn bộ phép đo màu</summary>
              <div style={{ marginTop: '10px' }}>
                <PaletteMetricsSection paletteMetrics={palette} />
              </div>
            </details>
          )}
        </section>

        {/* Nút Chuyển Tiếp Sang Sinh Prompt */}
        {ready && (
          <div className="atelier-ref-next-bar">
            <button
              type="button"
              className="atelier-btn-primary-action"
              style={{ width: '100%', maxWidth: '300px' }}
              onClick={onOpenPrompt}
              disabled={busy}
            >
              <span>Dùng kết quả chuyển sang Sinh Prompt</span>
              <ArrowRight size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
