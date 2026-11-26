// 1. THƯ VIỆN NỀN TẢNG (Dựng danh sách tài nguyên)
import React from 'react';

// 2. THƯ VIỆN BÊN NGOÀI (Biểu tượng thao tác)
import { Gamepad2, Eye, Trash2, RefreshCw, Clock, Download, LayoutGrid, List, Wrench, Maximize2 } from "lucide-react";

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Định dạng và tài nguyên dùng chung)
import { PixelCrystal } from "../../shared/ui/PixelArtIcons";
import { spriteImageUrl } from "./assetRequests";
import { formatBytes, formatDate } from './formatAssets';
import ProtectedAssetImage from './ProtectedAssetImage';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Kế thừa từ trang kho tài nguyên)

/** Hiển thị một danh mục; trạng thái và thao tác do phiên kho tài nguyên sở hữu. */
export default function SpriteAssetList({ currentProject, handleDeleteSprite, handleDownloadSprite, handleOpenInGodot, handleOpenInWorkspace, loading, onSelectTab, setSelectedSprite, setViewMode, sprites, viewMode }) {
  return (
<div>
          {/* Thanh phụ: Tiêu đề danh mục & Nút chuyển Lưới / Danh sách */}
          <div className="atelier-assets-toolbar-sub">
            <div>
              <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600 }}>
                Lịch sử ảnh đã thêm &amp; chuẩn hóa gần đây
              </span>
              <span style={{ fontSize: '0.75rem', color: '#6e658a', marginLeft: '8px' }}>
                (Tự động sắp xếp mới nhất lên đầu)
              </span>
            </div>

            {/* Nút chuyển đổi View Mode */}
            <div className="atelier-assets-viewmode-toggle">
              <button
                type="button"
                className={`atelier-assets-viewmode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid size={13} />
                <span>Dạng Lưới</span>
              </button>

              <button
                type="button"
                className={`atelier-assets-viewmode-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                <List size={13} />
                <span>Dạng Bảng</span>
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#a39bc2' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
              <span>Đang tải danh sách ảnh sprite từ MySQL…</span>
            </div>
          ) : sprites.length === 0 ? (
            <div className="atelier-assets-empty">
              <div className="pixel-empty-icon-wrap">
                <div className="pixel-empty-circle-aura" />
                <PixelCrystal size={60} className="pixel-art-glow pixel-art-float" />
              </div>
              <h3>Chưa có ảnh Sprite nào được lưu trong dự án</h3>
              <p>
                Khi bạn nạp ảnh vào bàn làm việc <strong>"Xử lý ảnh"</strong> hoặc chuyển tiếp từ <strong>"Tạo ảnh AI"</strong>, ảnh gốc và ảnh đã chuẩn hóa sẽ được tự động lưu trữ tại đây.
              </p>
              {onSelectTab && (
                <button
                  type="button"
                  className="atelier-assets-btn-sub primary-link"
                  onClick={() => onSelectTab('workspace')}
                  style={{ marginTop: '8px', padding: '8px 16px' }}
                >
                  <Wrench size={14} />
                  <span>Đi đến Xử lý ảnh</span>
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* DẠNG LƯỚI (GRID VIEW) */
            <div className="atelier-assets-grid">
              {sprites.map((s) => {
                const thumbUrl = spriteImageUrl(currentProject.id, s.id, s.has_processed);
                const totalBytes = (s.raw_bytes || 0) + (s.processed_bytes || 0);

                return (
                  <div key={s.id} className="atelier-assets-card" style={{ padding: 0, overflow: 'hidden' }}>
                    {/* Khung xem trước ảnh Thumbnail */}
                    <div className="atelier-assets-thumb-frame">
                      <ProtectedAssetImage
                        src={thumbUrl}
                        alt={s.name}
                      />

                      {/* Tag trạng thái góc trên */}
                      <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {s.folder_name && s.folder_name !== 'Mặc định' && (
                            <span className="atelier-assets-metric-pill purple" style={{ fontSize: '0.62rem', background: 'rgba(124, 58, 237, 0.65)', color: '#f3e8ff', border: '1px solid #c084fc' }}>
                              📁 {s.folder_name}
                            </span>
                          )}
                          {s.frame_count > 0 && (
                            <span className="atelier-assets-metric-pill indigo" style={{ fontSize: '0.62rem', background: 'rgba(14, 165, 233, 0.45)', color: '#e0f2fe', border: '1px solid #38bdf8' }}>
                              🎞️ {s.frame_count} frames
                            </span>
                          )}
                        </div>
                        {s.has_processed ? (
                          <span className="atelier-assets-metric-pill emerald" style={{ fontSize: '0.65rem' }}>
                            Đã xử lý
                          </span>
                        ) : (
                          <span className="atelier-assets-metric-pill indigo" style={{ fontSize: '0.65rem' }}>
                            Ảnh gốc (Raw)
                          </span>
                        )}
                      </div>

                      {/* Nút phóng to nhanh */}
                      <button
                        type="button"
                        onClick={() => setSelectedSprite(s)}
                        style={{
                          position: 'absolute',
                          top: '8px',
                          right: '8px',
                          background: 'rgba(10, 7, 20, 0.75)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          color: '#fff',
                          padding: '5px',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                        title="Phóng to ảnh"
                      >
                        <Maximize2 size={13} />
                      </button>
                    </div>

                    {/* Thông tin mô tả ảnh */}
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div
                        style={{ fontSize: '0.88rem', color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={s.name}
                      >
                        {s.name}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.725rem', color: 'var(--atl-text-secondary)' }}>
                        <span>{formatBytes(totalBytes)}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#6e658a' }}>
                          <Clock size={11} />
                          {formatDate(s.created_at)}
                        </span>
                      </div>

                      {/* Cụm nút hành động */}
                      <div className="atelier-assets-card-actions">
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="atelier-assets-btn-sub"
                            onClick={() => setSelectedSprite(s)}
                            title="Xem chi tiết ảnh"
                          >
                            <Eye size={12} />
                            <span>Chi tiết</span>
                          </button>

                          <button
                            type="button"
                            className="atelier-assets-btn-sub primary-link"
                            onClick={() => handleOpenInWorkspace(s)}
                            title="Nạp vào Workspace để sửa lại"
                          >
                            <Wrench size={12} />
                            <span>Workspace</span>
                          </button>

                          <button
                            type="button"
                            className="atelier-assets-btn-sub"
                            onClick={() => handleOpenInGodot(s)}
                            title="Đưa nhân vật này vào phòng Thử nghiệm Godot"
                            style={{ background: 'rgba(147, 51, 234, 0.18)', borderColor: 'rgba(192, 132, 252, 0.35)', color: '#c084fc' }}
                          >
                            <Gamepad2 size={12} />
                            <span>Thử Godot</span>
                          </button>

                          <button
                            type="button"
                            className="atelier-assets-btn-sub"
                            onClick={() => handleDownloadSprite(s, s.has_processed)}
                            title="Tải ảnh PNG về máy"
                          >
                            <Download size={12} />
                          </button>
                        </div>

                        <button
                          type="button"
                          className="atelier-assets-btn-delete"
                          onClick={() => handleDeleteSprite(s.id, s.name)}
                          title="Xóa ảnh khỏi MySQL"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* DẠNG BẢNG DANH SÁCH (LIST VIEW) */
            <div className="atelier-assets-table-box">
              <div className="atelier-assets-table-header">
                <span>Ảnh</span>
                <span>Tên ảnh / Tệp tin</span>
                <span>Trạng thái</span>
                <span>Dung lượng</span>
                <span>Ngày nạp</span>
                <span style={{ textAlign: 'right' }}>Thao tác</span>
              </div>

              <div>
                {sprites.map((s) => {
                  const thumbUrl = spriteImageUrl(currentProject.id, s.id, s.has_processed);
                  const totalBytes = (s.raw_bytes || 0) + (s.processed_bytes || 0);

                  return (
                    <div key={s.id} className="atelier-assets-table-row">
                      {/* Thumbnail nhỏ */}
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          background: '#07050e',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          border: '1px solid rgba(168, 85, 247, 0.2)'
                        }}
                        onClick={() => setSelectedSprite(s)}
                      >
                        <ProtectedAssetImage
                          src={thumbUrl}
                          alt={s.name}
                          style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', imageRendering: 'pixelated' }}
                        />
                      </div>

                      {/* Tên ảnh */}
                      <div style={{ color: '#fff', fontWeight: 500, paddingRight: '12px', wordBreak: 'break-word', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <span>{s.name}</span>
                        {(s.folder_name && s.folder_name !== 'Mặc định' || s.frame_count > 0) && (
                          <div style={{ display: 'flex', gap: '4px', fontSize: '0.65rem' }}>
                            {s.folder_name && s.folder_name !== 'Mặc định' && (
                              <span style={{ color: '#c084fc' }}>📁 {s.folder_name}</span>
                            )}
                            {s.frame_count > 0 && (
                              <span style={{ color: '#38bdf8' }}>🎞️ {s.frame_count} frames</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Trạng thái */}
                      <div>
                        {s.has_processed ? (
                          <span className="atelier-assets-metric-pill emerald" style={{ fontSize: '0.68rem' }}>
                            Đã xử lý
                          </span>
                        ) : (
                          <span className="atelier-assets-metric-pill indigo" style={{ fontSize: '0.68rem' }}>
                            Ảnh gốc (Raw)
                          </span>
                        )}
                      </div>

                      {/* Dung lượng */}
                      <div style={{ color: 'var(--atl-text-secondary)', fontSize: '0.75rem' }}>
                        {formatBytes(totalBytes)}
                      </div>

                      {/* Ngày lưu */}
                      <div style={{ color: '#6e658a', fontSize: '0.725rem' }}>
                        {formatDate(s.created_at)}
                      </div>

                      {/* Thao tác */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                        <button
                          type="button"
                          className="atelier-assets-btn-sub"
                          onClick={() => setSelectedSprite(s)}
                          style={{ padding: '4px 6px' }}
                          title="Xem chi tiết"
                        >
                          <Eye size={12} />
                        </button>
                        <button
                          type="button"
                          className="atelier-assets-btn-sub primary-link"
                          onClick={() => handleOpenInWorkspace(s)}
                          style={{ padding: '4px 6px' }}
                          title="Mở vào Workspace"
                        >
                          <Wrench size={12} />
                        </button>
                        <button
                          type="button"
                          className="atelier-assets-btn-sub"
                          onClick={() => handleOpenInGodot(s)}
                          style={{ padding: '4px 6px', color: '#c084fc' }}
                          title="Thử trong Godot Testbed"
                        >
                          <Gamepad2 size={12} />
                        </button>
                        <button
                          type="button"
                          className="atelier-assets-btn-sub"
                          onClick={() => handleDownloadSprite(s, s.has_processed)}
                          style={{ padding: '4px 6px' }}
                          title="Tải về"
                        >
                          <Download size={12} />
                        </button>
                        <button
                          type="button"
                          className="atelier-assets-btn-delete"
                          onClick={() => handleDeleteSprite(s.id, s.name)}
                          title="Xóa ảnh"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
  );
}
