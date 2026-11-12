// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT
// ========================================================
// useState: Chuyển giữa kết quả phân tích và bàn đo thủ công.
import { useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI
// ========================================================
// lucide-react: Biểu tượng cho ảnh mẫu, bảng màu và số đo.
import { Eye, EyeOff, FolderOpen, LoaderCircle, Palette, Ruler, Wand2 } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// ========================================================
// SpriteMeasurementEditor: Bàn đo đa giác và đoạn thẳng trên ảnh gốc.
import SpriteMeasurementEditor from './SpriteMeasurementEditor';
// PaletteMetricsSection: Các chỉ số đo màu chi tiết.
import PaletteMetricsSection from './PaletteMetricsSection';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC
// ========================================================
// Dùng các lớp định dạng Studio trong theme.css.

const REGION_LABELS = { head: 'Đầu', neck: 'Cổ', torso: 'Thân trên' };

/**
 * Hiển thị ảnh tham chiếu, số đo giải phẫu và báo cáo màu của lần phân tích hiện tại.
 *
 * @param {Object} props Ảnh tham chiếu, trạng thái phân tích và các thao tác Studio.
 * @returns {React.ReactElement} Khu vực nạp và phân tích ảnh.
 */
export default function TabReferenceView({
  reference, annotatedUrl, showOverlay, onToggleOverlay, onMeasure, localAction,
  metrics, regions, pixelReport, palette, analysisError, colorError, onOpenPrompt,
  manualRegions, onManualReport,
}) {
  const [editingMeasurements, setEditingMeasurements] = useState(false);
  const measurements = Object.entries(regions?.measurements || {});
  const manualCount = Object.keys(manualRegions?.measurements || {}).length;
  const swatches = palette?.dominant_colors?.slice(0, 12) || [];
  const ready = manualCount > 0 || measurements.length > 0 || palette?.total_colors > 0;
  const busy = Boolean(localAction);

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
    <div className="studio-grid studio-reference-grid">
      <section className="studio-viewport-card" aria-label="Ảnh sprite tham chiếu">
        <div className="studio-viewport-header">
          <h3><FolderOpen size={16} /> {reference?.name || 'Ảnh tham chiếu'}</h3>
        </div>
        <figure className="pixel-checkerboard-bg studio-reference-preview">
          {reference ? (
            <img src={showOverlay && annotatedUrl ? annotatedUrl : reference.url} alt={reference.name} />
          ) : (
            <span>Chọn ảnh PNG, JPEG hoặc WebP để phân tích.</span>
          )}
        </figure>
        <div className="studio-viewport-controls">
          <label className={`studio-toggle-chip ${showOverlay && annotatedUrl ? 'active' : ''}`}>
            <input type="checkbox" checked={showOverlay} disabled={!annotatedUrl} onChange={onToggleOverlay} />
            {showOverlay ? <Eye size={14} /> : <EyeOff size={14} />}
            Lớp phủ giải phẫu
          </label>
        </div>
        {showOverlay && annotatedUrl && (
          <div className="studio-legend-bar" aria-label="Chú giải lớp phủ">
            <span className="studio-legend-item studio-legend-head">■ Đầu</span>
            <span className="studio-legend-item studio-legend-torso">■ Thân</span>
            <span className="studio-legend-item studio-legend-legs">■ Chân</span>
          </div>
        )}
      </section>

      <div className="studio-column-right" aria-busy={busy}>
        <p className="studio-reference-meta">Các phép đo chạy bằng Python trên backend của app, không gửi ảnh tới Gemini hay OpenAI.</p>
        <section className="studio-metric-card">
          <div className="studio-metric-card-header">
            <h4><Ruler size={16} /> Kích thước &amp; tỷ lệ</h4>
            <button className="btn-secondary-studio" type="button" disabled={!reference || busy} onClick={() => setEditingMeasurements(true)}>
              Khoanh vùng đo kích thước{manualCount > 0 && ` (${manualCount})`}
            </button>
          </div>
          <button className="btn-secondary-studio studio-auto-measure" type="button" disabled={!reference || busy} onClick={() => onMeasure('size')}>
            {localAction === 'size' && <LoaderCircle size={15} className="spin" />}
            {localAction === 'size' ? 'Đang đo kích thước…' : 'Đo kích thước tự động'}
          </button>
          {manualCount > 0 && <p className="studio-reference-meta">{manualCount} bộ phận đã đo thủ công. Prompt ưu tiên bộ số đo này.</p>}
          {analysisError && <p className="studio-reference-error" role="alert">{analysisError}</p>}
          {metrics ? (
            <>
              <div className="studio-metric-grid">
                <div className="studio-metric-cell">
                  <span className="metric-label">Chiều cao nhân vật</span>
                  <strong className="metric-val">{metrics.anatomical_height || metrics.visible_height} px</strong>
                </div>
                <div className="studio-metric-cell">
                  <span className="metric-label">Tỷ lệ chiều cao</span>
                  <strong className="metric-val">{metrics.heads_tall} đầu</strong>
                </div>
                <div className="studio-metric-cell">
                  <span className="metric-label">Khung đầu</span>
                  <strong className="metric-val">{metrics.head_width ?? metrics.head_w} × {metrics.head_height ?? metrics.head_h} px</strong>
                </div>
                <div className="studio-metric-cell">
                  <span className="metric-label">Khung thân</span>
                  <strong className="metric-val">{metrics.body_width ?? metrics.body_w} × {metrics.body_height ?? metrics.body_h} px</strong>
                </div>
              </div>
              {measurements.length > 0 && (
                <>
                  <p className="studio-reference-meta">Bề rộng lát cắt trên ảnh gốc</p>
                  <dl className="studio-reference-readings">
                    {measurements.map(([part, measurement]) => (
                      <div key={part}><dt>{REGION_LABELS[part] || part}</dt><dd>{measurement.width_px} px</dd></div>
                    ))}
                  </dl>
                </>
              )}
            </>
          ) : (
            <p className="studio-reference-meta">Khoanh vùng để đo từng bộ phận, hoặc chạy đo tự động để xem tỷ lệ tổng thể.</p>
          )}
        </section>

        <section className="studio-metric-card">
          <div className="studio-metric-card-header">
            <h4><Palette size={16} /> Màu sắc &amp; phong cách pixel</h4>
            <button className="btn-primary-studio" type="button" disabled={!reference || busy} onClick={() => onMeasure('colors')}>
              {localAction === 'colors' && <LoaderCircle size={15} className="spin" />}
              {localAction === 'colors' ? 'Đang phân tích màu…' : 'Phân tích màu'}
            </button>
          </div>
          {colorError && <p className="studio-reference-error" role="alert">{colorError}</p>}
          {pixelReport ? (
            <dl className="studio-reference-readings">
              <div><dt>Màu trên lưới</dt><dd>{pixelReport.palette.total_colors}</dd></div>
              <div><dt>Lưới pixel gốc</dt><dd>{pixelReport.grid.native_size_wh.join(' × ')}</dd></div>
              <div><dt>Độ tương phản</dt><dd>{pixelReport.palette.contrast_ratio_wcag}:1</dd></div>
              <div><dt>Dải đổ bóng</dt><dd>{pixelReport.shading.n_ramps}</dd></div>
            </dl>
          ) : (
            <p className="studio-reference-meta">
              {palette
                ? palette.total_colors > 0
                  ? `Bảng màu hồ sơ có ${palette.total_colors} màu.`
                  : 'Ảnh chưa có pixel nhìn thấy để phân tích màu.'
                : 'Bảng màu và lưới pixel xuất hiện sau khi phân tích ảnh.'}
            </p>
          )}
          {swatches.length > 0 && (
            <ul className="studio-reference-swatches" aria-label="Màu chủ đạo">
              {swatches.map((swatch) => (
                <li key={swatch.hex_code}>
                  <span style={{ backgroundColor: swatch.hex_code }} />
                  <code>{swatch.hex_code}</code>
                </li>
              ))}
            </ul>
          )}
          {palette?.total_colors > 0 && (
            <details className="studio-measure-details">
              <summary>Chi tiết phép đo màu</summary>
              <PaletteMetricsSection paletteMetrics={palette} />
            </details>
          )}
        </section>
        {ready && (
          <div className="studio-reference-next">
            <button type="button" className="btn-primary-studio" onClick={onOpenPrompt} disabled={busy}>
              <Wand2 size={16} /> Dùng kết quả để sinh prompt
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
