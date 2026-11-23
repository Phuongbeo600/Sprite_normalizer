// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT
// ========================================================
// React tạo các phần tử trong cây giao diện.
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI
// ========================================================
// lucide-react cung cấp biểu tượng cho các nút thao tác.
import { ArrowRight, Check, Copy, X } from "lucide-react";

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// ========================================================
// Định dạng ngày lưu và dung lượng ảnh.

// Tạo đường dẫn ảnh gốc và ảnh đã xử lý.


import AssetDetailModal from './AssetDetailModal';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC
// ========================================================

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC
// ========================================================

/**
 * Hiển thị hồ sơ nhân vật và hai prompt đã lưu.
 * @param {Object} options Dữ liệu chi tiết và hàm xử lý do kho tài nguyên quản lý.
 * @returns {React.ReactElement} Nội dung cửa sổ chi tiết.
 */
export default function PresetDetailsDialog({
  selectedPreset,
  copiedPos,
  copiedNeg,
  handleCopyText,
  onLoadPresetToStudio,
  onClose
}) {
  return (
    <AssetDetailModal onClose={onClose}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.15rem', color: '#fff', margin: 0, fontWeight: 700 }}>
            {selectedPreset.name}
          </h2>
          <button
            type="button"
            className="atelier-assets-btn-delete"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ fontSize: '0.85rem', color: '#c084fc', fontWeight: 600 }}>
          🪄 Concept: {selectedPreset.new_character_concept}
        </div>

        {/* Prompt mô tả ảnh cần tạo */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <strong style={{ fontSize: '0.8rem', color: '#34d399' }}>Positive Prompt (Mô tả chi tiết tạo ảnh)</strong>
            <button
              type="button"
              className="atelier-assets-btn-sub"
              onClick={() => handleCopyText(selectedPreset.positive_prompt, 'positive')}
            >
              {copiedPos ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              <span>{copiedPos ? 'Đã chép' : 'Sao chép'}</span>
            </button>
          </div>
          <textarea
            readOnly
            value={selectedPreset.positive_prompt}
            rows={4}
            style={{
              width: '100%',
              background: 'rgba(10, 7, 20, 0.85)',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              borderRadius: '8px',
              color: '#ffffff',
              padding: '10px 12px',
              fontSize: '0.8rem',
              lineHeight: '1.45',
              resize: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Prompt loại bỏ chi tiết không mong muốn */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <strong style={{ fontSize: '0.8rem', color: '#f43f5e' }}>Negative Prompt (Bộ lọc loại bỏ lỗi)</strong>
            <button
              type="button"
              className="atelier-assets-btn-sub"
              onClick={() => handleCopyText(selectedPreset.negative_prompt, 'negative')}
            >
              {copiedNeg ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              <span>{copiedNeg ? 'Đã chép' : 'Sao chép'}</span>
            </button>
          </div>
          <textarea
            readOnly
            value={selectedPreset.negative_prompt}
            rows={3}
            style={{
              width: '100%',
              background: 'rgba(10, 7, 20, 0.85)',
              border: '1px solid rgba(244, 63, 94, 0.25)',
              borderRadius: '8px',
              color: '#fda4af',
              padding: '10px 12px',
              fontSize: '0.8rem',
              lineHeight: '1.45',
              resize: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Cụm nút dưới cửa sổ */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {onLoadPresetToStudio && (
            <button
              type="button"
              className="atelier-assets-btn-deploy"
              onClick={() => {
                onLoadPresetToStudio(selectedPreset);
                onClose();
              }}
            >
              <ArrowRight size={14} />
              <span>Mở lại trong Studio</span>
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
