// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT
// ========================================================
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Biểu tượng làm mới, bật/tắt model và cập nhật chỉ mục
import { Database, Play, RefreshCw, Square } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// ========================================================
// (Dữ liệu slot, RAM và handler điều khiển do OfflineChatWidget truyền xuống)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & CẤU HÌNH
// ========================================================
const STATUS_LABELS = {
  unloaded: 'Chưa khởi động',
  loading: 'Đang tải',
  ready: 'Sẵn sàng',
  error: 'Lỗi',
};

/** Hiển thị nhãn trạng thái gọn cho một slot mô hình AI Local. */
export function OfflineModelStatusPill({ slot }) {
  const code = slot?.status || 'unloaded';
  const cls =
    code === 'ready'
      ? 'is-ready'
      : code === 'loading'
        ? 'is-loading'
        : code === 'error'
          ? 'is-error'
          : '';
  return <span className={`atelier-offline-pill ${cls}`}>{STATUS_LABELS[code] || 'Chưa khởi động'}</span>;
}

/**
 * Ngăn kéo thông số model AI Local (Qwen3.5-4B, BGE-M3), RAM khả dụng và điều khiển nâng cao.
 *
 * @param {Object} props Thông số runtime và callback điều khiển slot/chỉ mục.
 * @returns {React.ReactElement} Bảng thông số AI Local trong widget.
 */
export default function OfflineInspectorDrawer({
  effectiveQwenSlot,
  qwenSlot,
  bgeSlot,
  knowledge,
  memory,
  isKnowledgeEmpty,
  modelActionBusy,
  isStreaming,
  reindexing,
  onRefreshStatus,
  onStartModel,
  onStopModel,
  onReindex,
}) {
  return (
    <section className="atelier-offline-drawer" aria-label="Bảng thông số AI Local">
      <div className="atelier-offline-status-grid">
        <div className="atelier-offline-status-card">
          <div className="atelier-offline-status-top">
            <span>Model Chat (8081)</span>
            <OfflineModelStatusPill slot={effectiveQwenSlot} />
          </div>
          <div className="atelier-offline-status-meta">
            {qwenSlot.model_name || 'Qwen3.5-4B (Q4_K_M)'}
            {qwenSlot.rss_mb ? ` · ${qwenSlot.rss_mb} MB RAM` : ''}
          </div>
        </div>

        <div className="atelier-offline-status-card">
          <div className="atelier-offline-status-top">
            <span>BGE-M3 (8082)</span>
            <OfflineModelStatusPill slot={bgeSlot} />
          </div>
          <div className="atelier-offline-status-meta">
            {bgeSlot.rss_mb ? `${bgeSlot.rss_mb} MB RAM` : 'Tự nạp khi tìm kiếm/index'}
          </div>
        </div>

        <div className="atelier-offline-status-card">
          <div className="atelier-offline-status-top">
            <span>Kho tri thức &amp; RAM</span>
            <span className={`atelier-offline-pill ${isKnowledgeEmpty ? 'is-loading' : 'is-ready'}`}>
              {knowledge ? `${knowledge.doc_count} tệp · ${knowledge.chunk_count} đoạn` : '...'}
            </span>
          </div>
          <div className="atelier-offline-status-meta">
            {memory
              ? `RAM trống: ${memory.available_mb} / ${memory.total_mb} MB (${memory.used_percent}%)`
              : 'Đang đọc thông số RAM...'}
          </div>
        </div>
      </div>

      <div className="atelier-offline-drawer-actions">
        <button
          type="button"
          className="atelier-offline-btn"
          onClick={onRefreshStatus}
          disabled={Boolean(modelActionBusy) || isStreaming}
        >
          <RefreshCw size={13} /> Làm mới
        </button>
        {qwenSlot.running ? (
          <button
            type="button"
            className="atelier-offline-btn is-danger"
            onClick={onStopModel}
            disabled={Boolean(modelActionBusy) || isStreaming}
          >
            <Square size={13} /> {modelActionBusy === 'stopping' ? 'Đang tắt...' : 'Giải phóng RAM'}
          </button>
        ) : (
          <button
            type="button"
            className="atelier-offline-btn is-primary"
            onClick={onStartModel}
            disabled={Boolean(modelActionBusy) || isStreaming}
          >
            <Play size={13} /> {modelActionBusy === 'starting' ? 'Đang nạp...' : 'Khởi động Qwen3.5-4B'}
          </button>
        )}
        <button
          type="button"
          className="atelier-offline-btn"
          onClick={onReindex}
          disabled={reindexing || isStreaming}
        >
          <Database size={13} /> {reindexing ? 'Đang lập chỉ mục...' : 'Cập nhật chỉ mục'}
        </button>
      </div>
    </section>
  );
}
