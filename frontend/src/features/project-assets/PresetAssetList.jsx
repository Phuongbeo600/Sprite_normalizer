// 1. THƯ VIỆN NỀN TẢNG (Dựng danh sách tài nguyên)
import React from 'react';

// 2. THƯ VIỆN BÊN NGOÀI (Biểu tượng thao tác)
import { Eye, Trash2, RefreshCw, ArrowRight, Clock } from "lucide-react";

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Định dạng và tài nguyên dùng chung)
import { PixelChest } from "../../shared/ui/PixelArtIcons";
import { formatDate } from "./formatAssets";

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Kế thừa từ trang kho tài nguyên)

/** Hiển thị một danh mục; trạng thái và thao tác do phiên kho tài nguyên sở hữu. */
export default function PresetAssetList({ handleDeletePreset, handleLoadPresetToStudio, handleOpenPresetDetail, loading, onLoadPresetToStudio, presets }) {
  return (
<div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#a39bc2' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
              <span>Đang đọc dữ liệu hồ sơ từ MySQL…</span>
            </div>
          ) : presets.length === 0 ? (
            <div className="atelier-assets-empty">
              <div className="pixel-empty-icon-wrap">
                <div className="pixel-empty-circle-aura" />
                <PixelChest size={64} className="pixel-art-glow pixel-art-float" />
              </div>
              <h3>Dự án này chưa lưu hồ sơ nhân vật nào</h3>
              <p>
                Hãy sang mục <strong>"Phân tích &amp; Prompt"</strong>, nạp sprite mẫu, thiết kế ý tưởng nhân vật mới và bấm <strong>"Lưu vào Dự án"</strong> để quản lý thư viện tại đây.
              </p>
            </div>
          ) : (
            <div className="atelier-assets-grid">
              {presets.map((preset) => {
                const metrics = preset.metrics_data || {};
                const height = metrics.anatomical_height || metrics.visible_height;
                const heads = metrics.heads_tall;

                return (
                  <div key={preset.id} className="atelier-assets-card">
                    <div>
                      {/* Tiêu đề & Ngày lưu */}
                      <div className="atelier-assets-card-header">
                        <h3 className="atelier-assets-card-title">{preset.name}</h3>
                        <span className="atelier-assets-card-time">
                          <Clock size={11} />
                          {formatDate(preset.created_at)}
                        </span>
                      </div>

                      {/* Ý tưởng nhân vật mới */}
                      <div className="atelier-assets-card-concept">
                        🪄 Concept: {preset.new_character_concept}
                      </div>

                      {/* Các thẻ Tag chỉ số đo lường */}
                      <div className="atelier-assets-metrics-row">
                        {height && (
                          <span className="atelier-assets-metric-pill emerald">
                            📏 {height}px
                          </span>
                        )}
                        {heads && (
                          <span className="atelier-assets-metric-pill indigo">
                            👤 {typeof heads === 'number' ? heads.toFixed(1) : heads} đầu
                          </span>
                        )}
                        <span className="atelier-assets-metric-pill rose">
                          🧭 {preset.target_direction || 'Front View'}
                        </span>
                      </div>
                    </div>

                    {/* Các nút tác vụ */}
                    <div className="atelier-assets-card-actions">
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="atelier-assets-btn-sub"
                          onClick={() => handleOpenPresetDetail(preset.id)}
                          title="Xem toàn bộ chỉ số và prompt"
                        >
                          <Eye size={13} />
                          <span>Chi tiết</span>
                        </button>

                        {onLoadPresetToStudio && (
                          <button
                            type="button"
                            className="atelier-assets-btn-sub primary-link"
                            onClick={() => handleLoadPresetToStudio(preset.id)}
                            title="Nạp toàn bộ số đo và prompt này vào màn hình Studio"
                          >
                            <ArrowRight size={13} />
                            <span>Mở Studio</span>
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        className="atelier-assets-btn-delete"
                        onClick={() => handleDeletePreset(preset.id, preset.name)}
                        title="Xóa bản ghi này khỏi MySQL"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
  );
}
