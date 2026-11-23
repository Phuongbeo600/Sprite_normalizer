// 1. THƯ VIỆN NỀN TẢNG (Dựng danh sách tài nguyên)
import React from 'react';

// 2. THƯ VIỆN BÊN NGOÀI (Biểu tượng thao tác)
import { Gamepad2, Map as MapIcon, Eye, Trash2, RefreshCw } from "lucide-react";

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Định dạng và tài nguyên dùng chung)


// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Kế thừa từ trang kho tài nguyên)

/** Hiển thị một danh mục; trạng thái và thao tác do phiên kho tài nguyên sở hữu. */
export default function MapAssetPanel({ handleDeleteMap, loading, mapData, onSelectTab, setSelectedMap }) {
  return (
<div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#a39bc2' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
              <span>Đang tải thông tin bản đồ nền từ MySQL…</span>
            </div>
          ) : !mapData ? (
            <div className="atelier-assets-empty">
              <MapIcon size={42} color="#6e658a" />
              <h3>Chưa có bản đồ nền nào được nạp</h3>
              <p>
                Bạn có thể tải ảnh môi trường game trong <strong>"Thử nghiệm Godot"</strong> để nhân vật chạy nhảy và thử độ tương phản trên map thực tế.
              </p>
              {onSelectTab && (
                <button
                  type="button"
                  className="atelier-assets-btn-sub primary-link"
                  onClick={() => onSelectTab('godot_testbed')}
                  style={{ marginTop: '8px', padding: '8px 16px' }}
                >
                  <MapIcon size={14} />
                  <span>Mở Thử nghiệm Godot</span>
                </button>
              )}
            </div>
          ) : (
            <div className="atelier-assets-card" style={{ maxWidth: '720px', padding: 0, overflow: 'hidden' }}>
              {/* Xem trước ảnh map */}
              <div
                style={{
                  width: '100%',
                  height: '260px',
                  backgroundColor: '#07050e',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  borderBottom: '1px solid rgba(168, 85, 247, 0.18)'
                }}
              >
                <img
                  src={mapData.map_image_base64}
                  alt={mapData.name}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />

                {/* Vạch kẻ sàn đỏ mô phỏng */}
                {mapData.show_ground_line && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: '25%',
                      borderBottom: '2px dashed rgba(239, 68, 68, 0.8)',
                      pointerEvents: 'none'
                    }}
                  />
                )}
              </div>

              {/* Thông tin bản đồ */}
              <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="atelier-assets-card-title">{mapData.name}</h3>
                  <span className="atelier-assets-metric-pill" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                    Độ cao sàn (ground_y): {mapData.ground_y}px
                  </span>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--atl-text-secondary)', margin: 0, lineHeight: 1.45 }}>
                  Bản đồ nền đang được áp dụng trực tiếp cho phòng thử nghiệm Godot Testbed của dự án.
                </p>

                {/* Cụm nút thao tác */}
                <div className="atelier-assets-card-actions">
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      className="atelier-assets-btn-sub"
                      onClick={() => setSelectedMap(mapData)}
                    >
                      <Eye size={13} />
                      <span>Xem kích thước đầy đủ</span>
                    </button>

                    {onSelectTab && (
                      <button
                        type="button"
                        className="atelier-assets-btn-sub primary-link"
                        onClick={() => onSelectTab('godot_testbed')}
                      >
                        <Gamepad2 size={13} />
                        <span>Vào phòng Testbed</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    className="atelier-assets-btn-delete"
                    onClick={handleDeleteMap}
                    title="Xóa bản đồ nền khỏi MySQL"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
  );
}
