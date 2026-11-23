// 1. THƯ VIỆN NỀN TẢNG (React / JavaScript)
// JSX được biên dịch bằng bộ chạy React của Vite.

// 2. THƯ VIỆN BÊN NGOÀI
// Các biểu tượng giữ nguyên nhãn và kích thước trong bảng điều khiển.
import { Grid2X2, LoaderCircle, Sparkles, Scaling, Download, FolderPlus } from 'lucide-react';

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Các thẻ gập mở dùng chung của Workspace.
import CollapsibleCard from './CollapsibleCard';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Kế thừa giao diện Workspace hiện có.

/**
 * Hiển thị các công cụ cắt, ép kích thước và xuất Sprite Sheet.
 * @param {Object} props Dữ liệu và hàm điều khiển từ bàn làm việc.
 * @returns {React.ReactElement} Giao diện giữ nguyên cấu trúc DOM.
 */
export default function SheetInspector({
  MAX_FRAMES,
  openSections,
  toggleSection,
  rows,
  columns,
  sheetLocked,
  changeGrid,
  setRows,
  setColumns,
  manualCuts,
  gridValid,
  resetManualCuts,
  changeManualCuts,
  frameIndex,
  selectFrame,
  autoAnchor,
  setAutoAnchor,
  gridCount,
  cellWidth,
  cellHeight,
  remainderX,
  remainderY,
  dimensions,
  busy,
  executeSliceSheet,
  sheet,
  batchResizeTarget,
  changeBatchResizeTarget,
  batchResizing,
  batchKeepRatio,
  setBatchKeepRatio,
  setBatchResizeTarget,
  source,
  executeBatchResize,
  batchResizeMsg,
  batchResizedSize,
  setPackFolderName,
  setSavePackStatus,
  setShowSavePackModal,
  frame,
  exportSheet
}) {
  return (
    <>
      <h3 className="atelier-inspector-section-title">
        <Grid2X2 size={16} />
        <span>Sprite Sheet Studio</span>
      </h3>

      {/* Khung 1: Cắt lưới Sprite Sheet */}
      <CollapsibleCard
        title="Cắt lưới Sprite Sheet"
        icon={Grid2X2}
        isOpen={openSections.sheetSlice}
        onToggle={() => toggleSection('sheetSlice')}
      >
        <div className="atelier-inspector-grid-inputs">
          <div className="atelier-inspector-field">
            <label className="atelier-inspector-label">Số hàng</label>
            <input
              type="number"
              min="1"
              max={MAX_FRAMES}
              required
              value={rows}
              disabled={sheetLocked}
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
              disabled={sheetLocked}
              className="atelier-inspector-input"
              onChange={(event) => changeGrid(setColumns, event.target.value)}
            />
          </div>
        </div>

        <label className="atelier-inspector-checkbox">
          <input
            type="checkbox"
            checked={Boolean(manualCuts)}
            disabled={!gridValid || sheetLocked}
            onChange={(event) => event.target.checked ? resetManualCuts() : changeManualCuts(null)}
          />
          <span>Chỉnh đường cắt thủ công</span>
        </label>
        {manualCuts && (
          <div className="atelier-inspector-info-card">
            <p>Kéo đường dọc/ngang và mép ngoài vào khoảng trống giữa các nhân vật.</p>
            <p>Chọn một đường rồi dùng phím mũi tên để chỉnh 1 px, Shift để chỉnh 10 px.</p>
            <p>Các ô được đệm trong suốt về cùng kích thước, giữ tỷ lệ nhân vật.</p>
            <button
              type="button"
              className="atelier-btn-secondary-action"
              disabled={sheetLocked}
              onClick={resetManualCuts}
            >
              Chia đều lại đường cắt
            </button>
            {frameIndex !== null && (
              <button type="button" className="atelier-btn-secondary-action" disabled={sheetLocked} onClick={() => selectFrame(null)}>
                Về sheet gốc để chỉnh đường cắt
              </button>
            )}
          </div>
        )}

        <label className="atelier-inspector-checkbox">
          <input
            type="checkbox"
            checked={autoAnchor}
            onChange={(e) => {
              setAutoAnchor(e.target.checked);
              if (manualCuts) changeManualCuts(manualCuts);
            }}
            disabled={sheetLocked}
          />
          <span>Căn tâm &amp; neo chân (Bottom-Center)</span>
        </label>

        {gridValid && (
          <div className="atelier-inspector-info-card" style={{ margin: '2px 0' }}>
            <p>{gridCount} frame · {cellWidth} × {cellHeight} px {manualCuts ? 'sau khi đệm' : 'mỗi ô'}</p>
            {!manualCuts && (remainderX > 0 || remainderY > 0) && (
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
          type="button"
          disabled={!gridValid || Boolean(busy)}
          onClick={executeSliceSheet}
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
      </CollapsibleCard>

      {/* Khung: Ép độ phân giải frame hàng loạt (Batch Resize) */}
      {sheet && (
        <CollapsibleCard
          title="Ép độ phân giải frame (Batch Resize)"
          icon={Scaling}
          isOpen={openSections.sheetBatchResize}
          onToggle={() => toggleSection('sheetBatchResize')}
        >
          <div className="atelier-inspector-info-card" style={{ padding: '6px 10px', margin: '0 0 6px 0' }}>
            <p style={{ fontSize: '0.74rem', color: '#c084fc', margin: 0 }}>
              Kích thước ô gốc: <strong>{cellWidth} × {cellHeight} px</strong>
            </p>
          </div>

          <div className="atelier-inspector-grid-inputs">
            <div className="atelier-inspector-field">
              <label className="atelier-inspector-label">Chiều rộng (px)</label>
              <input
                type="number"
                min="1"
                max="2048"
                value={batchResizeTarget.width}
                onChange={(e) => changeBatchResizeTarget('width', e.target.value)}
                disabled={batchResizing}
                className="atelier-inspector-input"
              />
            </div>
            <div className="atelier-inspector-field">
              <label className="atelier-inspector-label">Chiều cao (px)</label>
              <input
                type="number"
                min="1"
                max="2048"
                value={batchResizeTarget.height}
                onChange={(e) => changeBatchResizeTarget('height', e.target.value)}
                disabled={batchResizing}
                className="atelier-inspector-input"
              />
            </div>
          </div>

          <label className="atelier-inspector-checkbox" style={{ margin: '4px 0' }}>
            <input
              type="checkbox"
              checked={batchKeepRatio}
              onChange={(e) => setBatchKeepRatio(e.target.checked)}
              disabled={batchResizing}
            />
            <span>Khóa tỷ lệ khung hình</span>
          </label>

          {/* Các nút chọn nhanh kích thước thông dụng - Căn 5 cột gọn gàng */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', margin: '2px 0 6px 0' }}>
            {[16, 32, 48, 64, 128].map((size) => (
              <button
                key={size}
                type="button"
                className="atelier-btn-secondary-action"
                style={{
                  width: '100%',
                  padding: '5px 2px',
                  fontSize: '0.68rem',
                  justifyContent: 'center',
                  textAlign: 'center',
                }}
                onClick={() => {
                  if (batchKeepRatio && cellWidth > 0 && cellHeight > 0) {
                    const ratio = cellHeight / cellWidth;
                    setBatchResizeTarget({ width: size, height: Math.max(1, Math.round(size * ratio)) });
                  } else {
                    setBatchResizeTarget({ width: size, height: size });
                  }
                }}
                disabled={batchResizing}
              >
                {size}×{size}
              </button>
            ))}
          </div>

          <button
            className="atelier-btn-primary-action"
            type="button"
            disabled={!source?.file || !sheet || batchResizing}
            onClick={executeBatchResize}
            style={{
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              borderColor: '#34d399',
              boxShadow: '0 0 15px rgba(16, 185, 129, 0.25)',
              marginTop: '2px',
            }}
          >
            {batchResizing ? (
              <>
                <LoaderCircle size={15} className="atelier-ws-spinner-icon" />
                <span>Đang ép kích thước…</span>
              </>
            ) : (
              <>
                <Scaling size={15} />
                <span>Ép toàn bộ {sheet?.frames?.length || (rows * columns)} frame</span>
              </>
            )}
          </button>

          {batchResizeMsg && (
            <p style={{ fontSize: '0.75rem', color: '#34d399', marginTop: '6px', textAlign: 'center' }}>
              {batchResizeMsg}
            </p>
          )}
        </CollapsibleCard>
      )}

      {/* Khung 2: Xuất tài nguyên (Export & Download) */}
      {sheet && (
        <CollapsibleCard
          title="Xuất tài nguyên (Export)"
          icon={Download}
          isOpen={openSections.sheetExport}
          onToggle={() => toggleSection('sheetExport')}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Nút lưu trọn gói vào Thư mục Kho tài nguyên */}
            <button
              className="atelier-btn-primary-action"
              type="button"
              onClick={() => {
                const base = (source?.file?.name || 'SpriteSheet').replace(/\.[^/.]+$/, '');
                const sizeTag = batchResizedSize ? `_${batchResizedSize.width}x${batchResizedSize.height}` : '';
                setPackFolderName(`${base}_${sheet.rows}x${sheet.columns}${sizeTag}`);
                setSavePackStatus({ success: false, message: '' });
                setShowSavePackModal(true);
              }}
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)',
                borderColor: '#c084fc',
                boxShadow: '0 0 15px rgba(168, 85, 247, 0.35)',
                marginBottom: '4px'
              }}
            >
              <FolderPlus size={15} />
              <span>Lưu bộ Frame vào Thư mục</span>
            </button>

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
        </CollapsibleCard>
      )}
    </>
  );
}
