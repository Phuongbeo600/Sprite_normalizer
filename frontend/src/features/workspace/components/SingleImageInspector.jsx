// 1. THƯ VIỆN NỀN TẢNG (React / JavaScript)
// JSX được biên dịch bằng bộ chạy React của Vite.

// 2. THƯ VIỆN BÊN NGOÀI
// Các biểu tượng giữ nguyên nhãn và kích thước trong bảng điều khiển.
import { Sliders, Scaling, LoaderCircle, Anchor, Sparkles, Download } from 'lucide-react';

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Khung thẻ gập mở Accordion cho các công cụ thiết lập.
import CollapsibleCard from './CollapsibleCard';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Kế thừa giao diện Workspace hiện có.

/**
 * Hiển thị các công cụ xử lý và so sánh ảnh đơn.
 * @param {Object} props Dữ liệu và hàm điều khiển từ bàn làm việc.
 * @returns {React.ReactElement} Giao diện giữ nguyên cấu trúc DOM.
 */
export default function SingleImageInspector({
  openSections,
  toggleSection,
  resizeSource,
  resizeTarget,
  changeResizeTarget,
  busy,
  detectingGrid,
  keepRatio,
  setKeepRatio,
  setResizeTarget,
  dimensions,
  executeSingleCommand,
  restoringGrid,
  anchor,
  setAnchor,
  normalizeTarget,
  changeNormalizeTarget,
  result,
  showResult,
  setShowResult,
  setZoom,
  setPanOffset,
  nameStem
}) {
  return (
    <>
      <h3 className="atelier-inspector-section-title">
        <Sliders size={16} />
        <span>Thao tác ảnh đơn</span>
      </h3>

      {/* Khung 1: Thu nhỏ ảnh (Resize) */}
      <CollapsibleCard
        title="Thu nhỏ ảnh (Resize)"
        icon={Scaling}
        isOpen={openSections.resize}
        onToggle={() => toggleSection('resize')}
      >
        <div className="atelier-inspector-grid-inputs">
          <div className="atelier-inspector-field">
            <label className="atelier-inspector-label">Rộng (px)</label>
            <input
              type="number"
              min="1"
              max={resizeSource?.width || 512}
              required
              value={resizeTarget.width}
              onChange={(event) => changeResizeTarget('width', event.target.value)}
              disabled={Boolean(busy) || detectingGrid}
              className="atelier-inspector-input"
            />
          </div>
          <div className="atelier-inspector-field">
            <label className="atelier-inspector-label">Cao (px)</label>
            <input
              type="number"
              min="1"
              max={resizeSource?.height || 512}
              required
              value={resizeTarget.height}
              onChange={(event) => changeResizeTarget('height', event.target.value)}
              disabled={Boolean(busy) || detectingGrid}
              className="atelier-inspector-input"
            />
          </div>
        </div>

        <label className="atelier-inspector-checkbox">
          <input
            type="checkbox"
            checked={keepRatio}
            onChange={(event) => {
              setKeepRatio(event.target.checked);
              if (event.target.checked && resizeSource && Number(resizeTarget.width) > 0) {
                setResizeTarget({
                  ...resizeTarget,
                  height: Math.max(1, Math.round((resizeTarget.width * resizeSource.height) / resizeSource.width)),
                });
              }
            }}
            disabled={Boolean(busy) || detectingGrid}
          />
          <span>Khóa tỷ lệ khung hình</span>
        </label>

        <button
          className="atelier-btn-primary-action"
          type="button"
          disabled={!dimensions || Boolean(busy) || detectingGrid}
          onClick={() =>
            executeSingleCommand('resize', {
              target_width: resizeTarget.width,
              target_height: resizeTarget.height,
            })
          }
        >
          {busy === 'Đang thu nhỏ ảnh…' || busy === 'Đang khôi phục độ phân giải…' ? (
            <>
              <LoaderCircle size={15} className="atelier-ws-spinner-icon" />
              <span>{busy}</span>
            </>
          ) : (
            <>
              <Scaling size={15} />
              <span>{restoringGrid ? 'Khôi phục độ phân giải thật' : 'Thu nhỏ ảnh'}</span>
            </>
          )}
        </button>
      </CollapsibleCard>

      {/* Khung 2: Chuẩn hóa & Điểm neo (Anchor / Normalize) */}
      <CollapsibleCard
        title="Chuẩn hóa & Điểm neo"
        icon={Anchor}
        isOpen={openSections.anchor}
        onToggle={() => toggleSection('anchor')}
      >
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

        <div className="atelier-inspector-grid-inputs">
          <div className="atelier-inspector-field">
            <label className="atelier-inspector-label">Rộng (px)</label>
            <input
              type="number"
              min="1"
              max={512}
              required
              value={normalizeTarget.width}
              onChange={(event) => changeNormalizeTarget('width', event.target.value)}
              disabled={Boolean(busy)}
              className="atelier-inspector-input"
            />
          </div>
          <div className="atelier-inspector-field">
            <label className="atelier-inspector-label">Cao (px)</label>
            <input
              type="number"
              min="1"
              max={512}
              required
              value={normalizeTarget.height}
              onChange={(event) => changeNormalizeTarget('height', event.target.value)}
              disabled={Boolean(busy)}
              className="atelier-inspector-input"
            />
          </div>
        </div>

        <button
          className="atelier-btn-primary-action"
          type="button"
          disabled={!dimensions || Boolean(busy)}
          onClick={() =>
            executeSingleCommand('normalize', {
              target_width: normalizeTarget.width,
              target_height: normalizeTarget.height,
              anchor,
            })
          }
        >
          {busy === 'Đang chuẩn hóa ảnh…' ? (
            <>
              <LoaderCircle size={15} className="atelier-ws-spinner-icon" />
              <span>Đang chuẩn hóa…</span>
            </>
          ) : (
            <>
              <Anchor size={15} />
              <span>Chuẩn hóa khung &amp; điểm neo</span>
            </>
          )}
        </button>
      </CollapsibleCard>

      {/* Khung 3: Kết quả xử lý & Tải về (chỉ hiện khi có kết quả) */}
      {result && (
        <CollapsibleCard
          title="Kết quả xử lý"
          icon={Sparkles}
          isOpen={openSections.result}
          onToggle={() => toggleSection('result')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                  setPanOffset({ x: 0, y: 0 });
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
                  setPanOffset({ x: 0, y: 0 });
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
        </CollapsibleCard>
      )}
    </>
  );
}
