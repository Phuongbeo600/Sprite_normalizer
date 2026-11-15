// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT
// ========================================================
// React tạo các phần tử trong cây giao diện.
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI
// ========================================================
// lucide-react cung cấp biểu tượng cho các nút thao tác.
import { Check, FolderOpen, Plus, Trash2, X, Zap } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// ========================================================
// Thứ tự và nhãn các ô của bộ hoạt họa.
import { SLOT_DEFINITIONS_3_ROWS } from './slotDefinitions';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC
// ========================================================

/**
 * Dựng cửa sổ ghép ảnh ở vị trí hiện tại trong cây giao diện của phòng thử nghiệm.
 * @param {Object} options Trạng thái, hàm xử lý và tham chiếu canvas do phòng thử nghiệm quản lý.
 * @returns {React.ReactElement} Cửa sổ ghép ảnh và khung xem trước.
 */
export function renderSlotTemplateDialog({
  editingCharIdx,
  stagedCharName,
  setStagedCharName,
  slotMode,
  setSlotMode,
  stagedFps,
  setStagedFps,
  slotsData,
  dragOverSlot,
  setDragOverSlot,
  handleBatchAutoAssignSlots,
  handleShiftRow,
  handleSwapRows,
  handleClearRow,
  handleSwapSlots,
  handleSetSlotImage,
  handleClearSlot,
  previewDownCanvasRef,
  previewSideCanvasRef,
  previewUpCanvasRef,
  handleConfirmSlotTemplate,
  onClose,
  onClearAllSlots
}) {
  /**
   * Hiển thị các ô ảnh có thể chọn, kéo thả hoặc xóa trong một hàng của mẫu.
   * @param {'down'|'side'|'up'} direction Hướng của hàng.
   * @param {string} labelColor Màu nhãn của ô có ảnh.
   * @param {string} emptyIconColor Màu biểu tượng của ô trống.
   * @returns {React.ReactElement[]} Các ô ảnh theo thứ tự trong mẫu.
   */
  const renderSlots = (direction, labelColor, emptyIconColor) => SLOT_DEFINITIONS_3_ROWS
    .filter((slot) => slot.direction === direction)
    .map((slotDef) => {
      const slotData = slotsData[slotDef.id];
      const isOver = dragOverSlot === slotDef.id;

      return (
        <label
          key={slotDef.id}
          draggable={!!slotData}
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', slotDef.id);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverSlot(slotDef.id);
          }}
          onDragLeave={() => setDragOverSlot(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverSlot(null);
            const draggedSlotId = e.dataTransfer.getData('text/plain');
            if (draggedSlotId && draggedSlotId !== slotDef.id) {
              handleSwapSlots(draggedSlotId, slotDef.id);
              return;
            }
            const file = e.dataTransfer.files[0];
            if (file) handleSetSlotImage(slotDef.id, file);
          }}
          className={`atelier-godot-slot-cell ${slotData ? 'filled' : ''} ${isOver ? 'drag-over' : ''}`}
        >
          <div style={{ width: '100%' }}>
            <span style={{ fontSize: '0.725rem', fontWeight: 700, color: slotData ? labelColor : '#e2e8f0', display: 'block' }}>
              {slotDef.label}
            </span>
            <span style={{ fontSize: '0.65rem', color: slotDef.role === 'idle' ? '#facc15' : 'var(--atl-text-muted, #716b89)' }}>
              {slotDef.desc}
            </span>
          </div>

          {slotData ? (
            <div style={{ position: 'relative', margin: '4px 0' }} title="Kéo ô này thả sang ô khác để hoán đổi">
              <img
                src={slotData.url}
                alt={slotData.name}
                style={{
                  width: '46px',
                  height: '46px',
                  objectFit: 'contain',
                  imageRendering: 'pixelated',
                  display: 'block',
                  margin: '0 auto'
                }}
              />
              <button
                type="button"
                onClick={(e) => handleClearSlot(slotDef.id, e)}
                title="Xóa ảnh khỏi ô này"
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -12,
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={10} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: 'var(--atl-text-muted, #716b89)', margin: '6px 0' }}>
              <Plus size={20} color={emptyIconColor} />
              <span style={{ fontSize: '0.65rem' }}>Thả ảnh vào</span>
            </div>
          )}

          <span style={{ fontSize: '0.625rem', color: slotData ? 'var(--atl-text-secondary, #a39bc2)' : '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90px' }}>
            {slotData ? slotData.name : 'Chưa có'}
          </span>

          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files[0];
              e.target.value = '';
              handleSetSlotImage(slotDef.id, file);
            }}
          />
        </label>
      );
    });

  return (
    <div className="atelier-godot-modal-overlay">
      <div className="atelier-godot-modal-box">
        {/* Tiêu đề cửa sổ */}
        <div className="atelier-godot-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FolderOpen size={24} color="#c084fc" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f5f3ff', fontWeight: 700 }}>
                {editingCharIdx !== null
                  ? `Chỉnh Sửa Khung Ảnh: ${stagedCharName}`
                  : 'Ghép & Nạp Nhân Vật từ Khung Ô Ảnh Rời'}
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--atl-text-secondary, #a39bc2)' }}>
                {editingCharIdx !== null
                  ? 'Nhấp vào ô bạn đã đặt nhầm để thay đổi, kéo thả file mới vào ô đó hoặc xóa đi chọn lại.'
                  : 'Nhấp vào từng ô hoặc kéo thả file ảnh từ máy tính vào đúng ô có nhãn tên tương ứng.'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="atelier-dialog-close"
            style={{ background: 'transparent', border: 'none', color: '#a39bc2', cursor: 'pointer', padding: '6px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Thanh công cụ tiện ích ở đầu modal */}
        <div className="atelier-godot-modal-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Chọn chế độ 3 hàng hoặc 1 hàng */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#f5f3ff' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="slotMode"
                  checked={slotMode === '3_rows'}
                  onChange={() => setSlotMode('3_rows')}
                  style={{ accentColor: '#c084fc' }}
                />
                <strong style={{ color: slotMode === '3_rows' ? '#c084fc' : undefined }}>Bộ đầy đủ 3 hướng (15 ô)</strong>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', marginLeft: '8px' }}>
                <input
                  type="radio"
                  name="slotMode"
                  checked={slotMode === '1_row'}
                  onChange={() => setSlotMode('1_row')}
                  style={{ accentColor: '#c084fc' }}
                />
                <strong style={{ color: slotMode === '1_row' ? '#c084fc' : undefined }}>Bộ 1 hướng đơn giản (5 ô)</strong>
              </label>
            </div>

            <div style={{ width: '1px', height: '20px', background: 'rgba(168, 85, 247, 0.2)' }} />

            {/* Tên nhân vật & FPS */}
            <input
              type="text"
              value={stagedCharName}
              onChange={(e) => setStagedCharName(e.target.value)}
              placeholder="Tên nhân vật (VD: Hero, Mage)"
              className="atelier-godot-input"
              style={{ width: '160px', padding: '5px 10px', fontSize: '0.78rem' }}
            />

            <span style={{ fontSize: '0.75rem', color: 'var(--atl-text-secondary, #a39bc2)' }}>
              FPS: <strong style={{ color: '#c084fc' }}>{stagedFps}</strong>
            </span>
            <input
              type="range"
              min={3}
              max={20}
              value={stagedFps}
              onChange={(e) => setStagedFps(Number(e.target.value))}
              style={{ width: '80px', accentColor: '#c084fc' }}
            />
          </div>

          {/* Nút nạp nhanh tự động & nút xóa */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label className="atelier-godot-btn-sub" style={{ cursor: 'pointer' }}>
              <Zap size={14} color="#facc15" /> ⚡ Nạp nhanh cả thư mục
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={handleBatchAutoAssignSlots}
              />
            </label>

            {Object.keys(slotsData).length > 0 && (
              <button
                type="button"
                className="atelier-godot-row-action-btn"
                onClick={onClearAllSlots}
                style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.35)', padding: '5px 10px' }}
              >
                <Trash2 size={13} style={{ verticalAlign: 'middle' }} /> Xóa hết ô
              </button>
            )}
          </div>
        </div>

        {/* BẢNG CÁC KHUNG Ô THEO HÀNG VỚI NHÃN RÕ RÀNG */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* NHÓM 1: HƯỚNG NHÌN XUỐNG (MẶT TRƯỚC - DOWN) */}
          <div className="atelier-godot-slot-row-card">
            <div className="atelier-godot-slot-row-header">
              <div>
                <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⬇️ HÀNG 1: HƯỚNG NHÌN XUỐNG (MẶT TRƯỚC - DOWN)
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--atl-text-muted, #716b89)' }}>
                  Dùng khi bấm phím <strong>[S]</strong> hoặc Mũi tên xuống. <em>(Có thể kéo thả ảnh giữa các ô để đổi chỗ)</em>
                </span>
              </div>

              {/* Cụm công cụ sửa nhanh hàng 1 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  title="Dịch vòng các ô sang trái 1 bước (nếu đặt nhầm lệch thứ tự)"
                  onClick={() => handleShiftRow('down', -1)}
                  className="atelier-godot-row-action-btn"
                >
                  ← Dịch
                </button>
                <button
                  type="button"
                  title="Dịch vòng các ô sang phải 1 bước"
                  onClick={() => handleShiftRow('down', 1)}
                  className="atelier-godot-row-action-btn"
                >
                  Dịch →
                </button>

                {slotMode === '3_rows' && (
                  <>
                    <button
                      type="button"
                      title="Hoán đổi toàn bộ 5 ô Hàng 1 với Hàng 2 (Đi ngang)"
                      onClick={() => handleSwapRows('down', 'side')}
                      className="atelier-godot-row-action-btn"
                      style={{ borderColor: 'rgba(16, 185, 129, 0.35)', color: '#10b981' }}
                    >
                      ⇄ Đổi với Hàng Ngang
                    </button>
                    <button
                      type="button"
                      title="Hoán đổi toàn bộ 5 ô Hàng 1 với Hàng 3 (Sau lưng)"
                      onClick={() => handleSwapRows('down', 'up')}
                      className="atelier-godot-row-action-btn"
                      style={{ borderColor: 'rgba(245, 158, 11, 0.35)', color: '#f59e0b' }}
                    >
                      ⇄ Đổi với Hàng Sau Lưng
                    </button>
                  </>
                )}

                <button
                  type="button"
                  title="Xóa hết ảnh hàng này"
                  onClick={() => handleClearRow('down')}
                  className="atelier-godot-row-action-btn"
                  style={{ borderColor: 'rgba(239, 68, 68, 0.35)', color: '#f87171' }}
                >
                  <Trash2 size={11} style={{ verticalAlign: 'middle' }} /> Xóa hàng
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {renderSlots('down', '#38bdf8', '#a855f7')}
            </div>
          </div>

          {/* NHÓM 2: HƯỚNG NHÌN NGANG (ĐI NGHIÊNG - SIDE) */}
          {slotMode === '3_rows' && (
            <div className="atelier-godot-slot-row-card">
              <div className="atelier-godot-slot-row-header">
                <div>
                  <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ➡️ HÀNG 2: HƯỚNG NHÌN NGANG (ĐI NGHIÊNG - SIDE)
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--atl-text-muted, #716b89)' }}>
                    Đi sang phải [D]. <em>(Khi đi sang trái [A], app sẽ tự lật ngược hình lại)</em>
                  </span>
                </div>

                {/* Cụm công cụ sửa nhanh hàng 2 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    title="Dịch vòng các ô sang trái 1 bước (nếu đặt nhầm lệch thứ tự)"
                    onClick={() => handleShiftRow('side', -1)}
                    className="atelier-godot-row-action-btn"
                  >
                    ← Dịch
                  </button>
                  <button
                    type="button"
                    title="Dịch vòng các ô sang phải 1 bước"
                    onClick={() => handleShiftRow('side', 1)}
                    className="atelier-godot-row-action-btn"
                  >
                    Dịch →
                  </button>

                  <button
                    type="button"
                    title="Hoán đổi toàn bộ 5 ô Hàng 2 với Hàng 1 (Nhìn xuống)"
                    onClick={() => handleSwapRows('side', 'down')}
                    className="atelier-godot-row-action-btn"
                    style={{ borderColor: 'rgba(56, 189, 248, 0.35)', color: '#38bdf8' }}
                  >
                    ⇄ Đổi với Hàng Xuống
                  </button>
                  <button
                    type="button"
                    title="Hoán đổi toàn bộ 5 ô Hàng 2 với Hàng 3 (Sau lưng)"
                    onClick={() => handleSwapRows('side', 'up')}
                    className="atelier-godot-row-action-btn"
                    style={{ borderColor: 'rgba(245, 158, 11, 0.35)', color: '#f59e0b' }}
                  >
                    ⇄ Đổi với Hàng Sau Lưng
                  </button>

                  <button
                    type="button"
                    title="Xóa hết ảnh hàng này"
                    onClick={() => handleClearRow('side')}
                    className="atelier-godot-row-action-btn"
                    style={{ borderColor: 'rgba(239, 68, 68, 0.35)', color: '#f87171' }}
                  >
                    <Trash2 size={11} style={{ verticalAlign: 'middle' }} /> Xóa hàng
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                {renderSlots('side', '#10b981', '#10b981')}
              </div>
            </div>
          )}

          {/* NHÓM 3: HƯỚNG NHÌN LÊN (SAU LƯNG - UP) */}
          {slotMode === '3_rows' && (
            <div className="atelier-godot-slot-row-card">
              <div className="atelier-godot-slot-row-header">
                <div>
                  <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ⬆️ HÀNG 3: HƯỚNG NHÌN LÊN (SAU LƯNG - UP)
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--atl-text-muted, #716b89)' }}>
                    Dùng khi bấm phím <strong>[W]</strong> hoặc Mũi tên lên
                  </span>
                </div>

                {/* Cụm công cụ sửa nhanh hàng 3 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    title="Dịch vòng các ô sang trái 1 bước (nếu đặt nhầm lệch thứ tự)"
                    onClick={() => handleShiftRow('up', -1)}
                    className="atelier-godot-row-action-btn"
                  >
                    ← Dịch
                  </button>
                  <button
                    type="button"
                    title="Dịch vòng các ô sang phải 1 bước"
                    onClick={() => handleShiftRow('up', 1)}
                    className="atelier-godot-row-action-btn"
                  >
                    Dịch →
                  </button>

                  <button
                    type="button"
                    title="Hoán đổi toàn bộ 5 ô Hàng 3 với Hàng 1 (Nhìn xuống)"
                    onClick={() => handleSwapRows('up', 'down')}
                    className="atelier-godot-row-action-btn"
                    style={{ borderColor: 'rgba(56, 189, 248, 0.35)', color: '#38bdf8' }}
                  >
                    ⇄ Đổi với Hàng Xuống
                  </button>
                  <button
                    type="button"
                    title="Hoán đổi toàn bộ 5 ô Hàng 3 với Hàng 2 (Đi ngang)"
                    onClick={() => handleSwapRows('up', 'side')}
                    className="atelier-godot-row-action-btn"
                    style={{ borderColor: 'rgba(16, 185, 129, 0.35)', color: '#10b981' }}
                  >
                    ⇄ Đổi với Hàng Ngang
                  </button>

                  <button
                    type="button"
                    title="Xóa hết ảnh hàng này"
                    onClick={() => handleClearRow('up')}
                    className="atelier-godot-row-action-btn"
                    style={{ borderColor: 'rgba(239, 68, 68, 0.35)', color: '#f87171' }}
                  >
                    <Trash2 size={11} style={{ verticalAlign: 'middle' }} /> Xóa hàng
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                {renderSlots('up', '#f59e0b', '#f59e0b')}
              </div>
            </div>
          )}
        </div>

        {/* KHUNG XEM TRƯỚC HOẠT HỌA 3 HƯỚNG TRỰC TIẾP & NÚT HOÀN TẤT */}
        <div className="atelier-godot-modal-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f5f3ff' }}>
              Xem trước 3 hướng:
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'center' }}>
                <canvas ref={previewDownCanvasRef} width={50} height={50} style={{ background: '#0e0a1a', borderRadius: '6px', display: 'block', border: '1px solid rgba(168, 85, 247, 0.3)' }} />
                <span style={{ fontSize: '0.625rem', color: '#38bdf8', marginTop: '2px', display: 'block' }}>⬇️ Xuống</span>
              </div>
              {slotMode === '3_rows' && (
                <>
                  <div style={{ textAlign: 'center' }}>
                    <canvas ref={previewSideCanvasRef} width={50} height={50} style={{ background: '#0e0a1a', borderRadius: '6px', display: 'block', border: '1px solid rgba(16, 185, 129, 0.3)' }} />
                    <span style={{ fontSize: '0.625rem', color: '#10b981', marginTop: '2px', display: 'block' }}>➡️ Ngang</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <canvas ref={previewUpCanvasRef} width={50} height={50} style={{ background: '#0e0a1a', borderRadius: '6px', display: 'block', border: '1px solid rgba(245, 158, 11, 0.3)' }} />
                    <span style={{ fontSize: '0.625rem', color: '#f59e0b', marginTop: '2px', display: 'block' }}>⬆️ Lưng</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="atelier-dialog-btn-cancel"
              onClick={onClose}
              style={{ fontSize: '0.8rem', padding: '7px 16px' }}
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              className="atelier-dialog-btn-confirm primary"
              onClick={handleConfirmSlotTemplate}
              style={{ fontSize: '0.8rem', padding: '7px 18px', gap: '6px' }}
            >
              <Check size={16} />
              {editingCharIdx !== null ? 'Hoàn tất & Cập nhật nhân vật' : 'Hoàn tất & Đưa vào Game'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
