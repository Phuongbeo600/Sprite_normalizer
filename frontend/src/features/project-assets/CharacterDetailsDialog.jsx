// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT
// ========================================================
// React tạo các phần tử trong cây giao diện.
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI
// ========================================================
// lucide-react cung cấp biểu tượng cho các nút thao tác.
import { Gamepad2, X } from "lucide-react";

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// ========================================================
// Định dạng ngày lưu và dung lượng ảnh.

// Tạo đường dẫn ảnh gốc và ảnh đã xử lý.


import AssetDetailModal from './AssetDetailModal';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC
// ========================================================

/**
 * Hiển thị các khung ảnh của nhân vật trong phòng thử nghiệm.
 * @param {Object} options Dữ liệu chi tiết và hàm xử lý do kho tài nguyên quản lý.
 * @returns {React.ReactElement} Nội dung cửa sổ chi tiết.
 */
export default function CharacterDetailsDialog({
  selectedCharacter,
  onSelectTab,
  onClose
}) {
  return (
    <AssetDetailModal onClose={onClose} boxStyle={{ maxWidth: '720px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', color: '#fff', margin: '0 0 2px', fontWeight: 700 }}>
              Bộ Khung Hoạt Họa 15 Ô: {selectedCharacter.name}
            </h2>
            <span style={{ fontSize: '0.725rem', color: '#10b981' }}>
              Gồm 3 hàng: Hướng xuống (Down), Hướng ngang (Side), Hướng lên (Up)
            </span>
          </div>
          <button
            type="button"
            className="atelier-assets-btn-delete"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Bảng hiển thị 15 ô */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {['down', 'side', 'up'].map((dir) => (
            <div key={dir} style={{ background: 'rgba(10, 7, 20, 0.75)', borderRadius: '10px', padding: '12px', border: '1px solid rgba(168, 85, 247, 0.18)' }}>
              <div style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: 600, marginBottom: '8px' }}>
                {dir === 'down' ? '⬇ Hướng Nhìn Xuống (Down)' : dir === 'side' ? '➡ Hướng Nhìn Ngang (Side)' : '⬆ Hướng Nhìn Lên (Up)'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                {[0, 1, 2, 3, 4].map((c) => {
                  const slotKey = `${dir}_${c}`;
                  const slotImg = selectedCharacter.slots_data?.[slotKey];
                  return (
                    <div
                      key={slotKey}
                      style={{
                        height: '74px',
                        backgroundColor: '#07050e',
                        borderRadius: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(168, 85, 247, 0.16)',
                        position: 'relative'
                      }}
                    >
                      {slotImg ? (
                        <img src={slotImg} alt={slotKey} style={{ maxWidth: '90%', maxHeight: '80%', objectFit: 'contain', imageRendering: 'pixelated' }} />
                      ) : (
                        <span style={{ fontSize: '0.65rem', color: '#6e658a' }}>Rỗng</span>
                      )}
                      <span style={{ position: 'absolute', bottom: '2px', fontSize: '0.6rem', color: '#94a3b8' }}>
                        {c === 0 ? 'idle' : `walk_${c}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {onSelectTab && (
            <button
              type="button"
              className="atelier-assets-btn-deploy"
              onClick={() => {
                onSelectTab('godot_testbed');
                onClose();
              }}
            >
              <Gamepad2 size={14} />
              <span>Mở trong Godot Testbed</span>
            </button>
          )}
          <button
            type="button"
            className="atelier-assets-btn-sub"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
    </AssetDetailModal>
  );
}
