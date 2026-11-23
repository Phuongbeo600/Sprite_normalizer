// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT
// ========================================================
// React tạo các phần tử trong cây giao diện.
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI
// ========================================================
// lucide-react cung cấp biểu tượng cho các nút thao tác.
import { X } from "lucide-react";

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
 * Hiển thị ảnh bản đồ nền ở kích thước lớn.
 * @param {Object} options Dữ liệu chi tiết và hàm xử lý do kho tài nguyên quản lý.
 * @returns {React.ReactElement} Nội dung cửa sổ chi tiết.
 */
export default function MapDetailsDialog({
  selectedMap,
  onClose
}) {
  return (
    <AssetDetailModal onClose={onClose} boxStyle={{ maxWidth: '850px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.15rem', color: '#fff', margin: 0, fontWeight: 700 }}>
            {selectedMap.name}
          </h2>
          <button
            type="button"
            className="atelier-assets-btn-delete"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{
          maxHeight: '520px',
          overflow: 'auto',
          background: '#07050e',
          borderRadius: '10px',
          border: '1px solid rgba(168, 85, 247, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px'
        }}>
          <img
            src={selectedMap.map_image_base64}
            alt={selectedMap.name}
            style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
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
