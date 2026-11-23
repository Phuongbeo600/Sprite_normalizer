// 1. THƯ VIỆN NỀN TẢNG (React / JavaScript)
// JSX được biên dịch bằng bộ chạy React của Vite.

// 2. THƯ VIỆN BÊN NGOÀI
// Các biểu tượng giữ nguyên nhãn và kích thước trong bảng điều khiển.
import { FolderPlus, X, Check, AlertCircle, LoaderCircle } from 'lucide-react';

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Không có phụ thuộc nội bộ.

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Kế thừa giao diện Workspace hiện có.

/**
 * Hiển thị hộp thoại lưu bộ frame vào kho tài nguyên.
 * @param {Object} props Dữ liệu và hàm điều khiển từ bàn làm việc.
 * @returns {React.ReactElement} Giao diện giữ nguyên cấu trúc DOM.
 */
export default function SaveSheetPackDialog({
  setShowSavePackModal,
  packFolderName,
  setPackFolderName,
  source,
  sheet,
  fps,
  batchResizedSize,
  cellWidth,
  cellHeight,
  savePackStatus,
  savingPack,
  handleConfirmSavePack
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 3, 13, 0.78)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px'
      }}
      onClick={() => setShowSavePackModal(false)}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#120d24',
          border: '1px solid #7c3aed',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6), 0 0 24px rgba(124, 58, 237, 0.25)',
          borderRadius: '14px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tiêu đề Modal */}
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, rgba(124, 58, 237, 0.15) 0%, transparent 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderPlus size={18} color="#c084fc" />
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#f3e8ff' }}>
              Lưu bộ Frame vào Thư mục Kho
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowSavePackModal(false)}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Nội dung Modal */}
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: '#cbd5e1',
                marginBottom: '6px'
              }}
            >
              Tên Thư mục / Bộ hoạt họa nhân vật:
            </label>
            <input
              type="text"
              value={packFolderName}
              onChange={(e) => setPackFolderName(e.target.value)}
              placeholder="Ví dụ: Pháp sư tím_3x5"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '9px 12px',
                backgroundColor: '#1b1433',
                border: '1px solid rgba(192, 132, 252, 0.35)',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '0.875rem',
                outline: 'none'
              }}
              autoFocus
            />
          </div>

          {/* Tóm tắt nội dung gói lưu */}
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '10px',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              fontSize: '0.8rem',
              color: '#94a3b8'
            }}
          >
            <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '2px' }}>
              📦 Nội dung gói tài nguyên sẽ lưu:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <div>• <strong>Sheet gốc:</strong> {source?.dimensions?.width || 0}×{source?.dimensions?.height || 0}px</div>
              <div>• <strong>Số frame:</strong> {sheet?.frames?.length || (sheet?.rows * sheet?.columns)} frame</div>
              <div>• <strong>Lưới cắt:</strong> {sheet?.rows} hàng × {sheet?.columns} cột</div>
              <div>• <strong>Tốc độ:</strong> {fps} FPS</div>
              <div style={{ gridColumn: 'span 2', color: batchResizedSize ? '#34d399' : '#c084fc', marginTop: '2px' }}>
                • <strong>Kích thước từng frame:</strong> {batchResizedSize ? `${batchResizedSize.width} × ${batchResizedSize.height} px (Đã ép độ phân giải)` : `${cellWidth} × ${cellHeight} px (Gốc)`}
              </div>
            </div>
          </div>

          {/* Thông báo trạng thái */}
          {savePackStatus.message && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: savePackStatus.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${savePackStatus.success ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                color: savePackStatus.success ? '#6ee7b7' : '#fca5a5'
              }}
            >
              {savePackStatus.success ? <Check size={16} /> : <AlertCircle size={16} />}
              <span>{savePackStatus.message}</span>
            </div>
          )}
        </div>

        {/* Chân Modal */}
        <div
          style={{
            padding: '12px 18px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.2)'
          }}
        >
          <button
            type="button"
            className="atelier-btn-secondary-action"
            onClick={() => setShowSavePackModal(false)}
            disabled={savingPack}
            style={{ padding: '7px 14px', margin: 0 }}
          >
            Hủy
          </button>
          <button
            type="button"
            className="atelier-btn-primary-action"
            onClick={handleConfirmSavePack}
            disabled={savingPack || !packFolderName.trim()}
            style={{
              padding: '7px 18px',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)'
            }}
          >
            {savingPack ? (
              <>
                <LoaderCircle size={14} className="atelier-ws-spinner-icon" />
                <span>Đang lưu vào kho…</span>
              </>
            ) : (
              <>
                <Check size={14} />
                <span>Xác nhận Lưu vào Kho</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
