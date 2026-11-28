// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT
// ========================================================
// React tạo các phần tử trong cây giao diện.
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI
// ========================================================
// lucide-react cung cấp biểu tượng cho các nút thao tác.
import { Download, Gamepad2, Trash2, Wrench, X } from "lucide-react";

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// ========================================================
// Định dạng ngày lưu và dung lượng ảnh.
import { formatBytes, formatDate } from './formatAssets';
// Tạo đường dẫn ảnh gốc và ảnh đã xử lý.
import { spriteImageUrl } from './assetRequests';

import AssetDetailModal from './AssetDetailModal';
import SpriteFramesViewer from './SpriteFramesViewer';
import ProtectedAssetImage from './ProtectedAssetImage';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC
// ========================================================

/**
 * Hiển thị ảnh sprite gốc và ảnh đã xử lý nếu có.
 * @param {Object} options Dữ liệu chi tiết và hàm xử lý do kho tài nguyên quản lý.
 * @returns {React.ReactElement} Nội dung cửa sổ chi tiết.
 */
export default function SpriteDetailsDialog({
  selectedSprite,
  projectId,
  handleDeleteSprite,
  handleDownloadSprite,
  onLoadSpriteToWorkspace,
  handleOpenInWorkspace,
  handleOpenInGodot,
  onClose
}) {
  return (
    <AssetDetailModal onClose={onClose} boxStyle={{ maxWidth: '800px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', color: '#fff', margin: '0 0 4px', fontWeight: 700 }}>
              {selectedSprite.name}
            </h2>
            <span style={{ fontSize: '0.725rem', color: 'var(--atl-text-secondary)' }}>
              Lưu ngày: {formatDate(selectedSprite.created_at)}
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

        {/* Vùng xem ảnh lớn */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: selectedSprite.has_processed ? '1fr 1fr' : '1fr',
          gap: '16px'
        }}>
          {/* Cột ảnh gốc */}
          <div>
            <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, marginBottom: '6px' }}>
              Ảnh gốc ban đầu (Raw)
            </div>
            <div style={{
              height: '240px',
              backgroundColor: '#07050e',
              borderRadius: '8px',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              <ProtectedAssetImage
                src={spriteImageUrl(projectId, selectedSprite.id)}
                alt="Raw Sprite"
                style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain', imageRendering: 'pixelated' }}
              />
            </div>
            <div style={{ fontSize: '0.7rem', color: '#6e658a', marginTop: '4px' }}>
              Dung lượng: {formatBytes(selectedSprite.raw_bytes)}
            </div>
          </div>

          {/* Cột ảnh đã xử lý */}
          {selectedSprite.has_processed && (
            <div>
              <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600, marginBottom: '6px' }}>
                Ảnh sau khi chuẩn hóa (Processed)
              </div>
              <div style={{
                height: '240px',
                backgroundColor: '#07050e',
                borderRadius: '8px',
                border: '1px solid rgba(168, 85, 247, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                <ProtectedAssetImage
                  src={spriteImageUrl(projectId, selectedSprite.id, true)}
                  alt="Processed Sprite"
                  style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain', imageRendering: 'pixelated' }}
                />
              </div>
              <div style={{ fontSize: '0.7rem', color: '#6e658a', marginTop: '4px' }}>
                Dung lượng: {formatBytes(selectedSprite.processed_bytes)}
              </div>
            </div>
          )}
        </div>

        {/* Khung hiển thị các frame cắt rời nếu là Sprite Sheet / Pack */}
        {selectedSprite.frame_count > 0 && (
          <SpriteFramesViewer spriteId={selectedSprite.id} frameCount={selectedSprite.frame_count} />
        )}

        {/* Cụm nút tác vụ dưới chân Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            type="button"
            className="atelier-assets-btn-delete"
            onClick={() => handleDeleteSprite(selectedSprite.id, selectedSprite.name)}
            style={{ color: '#f87171' }}
          >
            <Trash2 size={14} />
            <span>Xóa ảnh khỏi MySQL</span>
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="atelier-assets-btn-sub"
              onClick={() => handleDownloadSprite(selectedSprite, selectedSprite.has_processed)}
            >
              <Download size={14} />
              <span>Tải PNG về</span>
            </button>

            {onLoadSpriteToWorkspace && (
              <button
                type="button"
                className="atelier-assets-btn-sub primary-link"
                onClick={() => {
                  handleOpenInWorkspace(selectedSprite);
                  onClose();
                }}
              >
                <Wrench size={14} />
                <span>Mở vào Workspace</span>
              </button>
            )}

            {handleOpenInGodot && (
              <button
                type="button"
                className="atelier-assets-btn-sub"
                onClick={() => {
                  handleOpenInGodot(selectedSprite);
                  onClose();
                }}
                style={{ background: 'rgba(147, 51, 234, 0.25)', borderColor: 'rgba(192, 132, 252, 0.4)', color: '#c084fc' }}
              >
                <Gamepad2 size={14} />
                <span>Thử trong Godot</span>
              </button>
            )}
          </div>
        </div>
    </AssetDetailModal>
  );
}
