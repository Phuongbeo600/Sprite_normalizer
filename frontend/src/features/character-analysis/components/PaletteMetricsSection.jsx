// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon đo lường bảng màu, đổ bóng, viền, bão hòa và sao chép
import {
  Palette,
  Droplets,
  Layers,
  Sliders,
  Shield,
  Sun,
  Sparkles,
  Check,
  Copy
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không phụ thuộc component nội bộ khác)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa các lớp CSS từ theme.css

/**
 * Phần hiển thị 6 tiêu chuẩn kỹ thuật bảng màu Pixel Art (PaletteMetricsSection)
 * Được đo đạc toán học chính xác 100% bằng thuật toán NumPy của Python:
 * - Bảng Swatches mã màu chủ đạo theo tỷ lệ phần trăm
 * - Lưới 6 thẻ tiêu chuẩn: Ngân sách màu, Màu neo, Bậc bóng, Hue-shift, Viền, Tương phản
 * - Khung câu lệnh Master Color Prompt kèm nút sao chép
 * 
 * @param {Object} props Thuộc tính của component.
 * @param {Object} props.paletteMetrics Dữ liệu đo đạc bảng màu (PaletteMetrics).
 * @returns {React.ReactElement} Khối giao diện hiển thị bảng màu.
 */
export default function PaletteMetricsSection({ paletteMetrics }) {
  const [copiedHex, setCopiedHex] = useState(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  if (!paletteMetrics) return null;

  /**
   * Sao chép mã HEX của một ô màu vào clipboard.
   * 
   * @param {string} hexCode Mã HEX cần sao chép.
   */
  const handleCopyHex = (hexCode) => {
    if (!hexCode) return;
    navigator.clipboard.writeText(hexCode);
    setCopiedHex(hexCode);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  /**
   * Sao chép toàn bộ Master Color Prompt.
   */
  const handleCopyPrompt = () => {
    if (!paletteMetrics?.master_color_prompt) return;
    navigator.clipboard.writeText(paletteMetrics.master_color_prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <section className="profile-section-card" style={{ border: '1px solid var(--accent-purple)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <h4 style={{ margin: 0 }}>
          <Palette size={16} color="var(--accent-purple)" />
          0. Bảng Màu Chuẩn & 6 Tiêu Chí Kỹ Thuật (Python Palette Engine)
        </h4>
        <span className="profile-tag success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <Sparkles size={12} />
          Đo đạc chính xác 100% (NumPy)
        </span>
      </div>

      {/* Dải ô vuông màu chủ đạo (Color Swatches) */}
      {paletteMetrics.dominant_colors && paletteMetrics.dominant_colors.length > 0 && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <strong style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              Bảng mã màu chủ đạo theo tỷ lệ bao phủ (Bấm ô để sao chép mã HEX):
            </strong>
            {copiedHex && (
              <span style={{ fontSize: '0.7rem', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Check size={12} /> Đã chép mã {copiedHex}!
              </span>
            )}
          </div>
          <div className="palette-swatches-grid">
            {paletteMetrics.dominant_colors.slice(0, 16).map((item, idx) => (
              <div
                key={idx}
                className="palette-swatch-item"
                onClick={() => handleCopyHex(item.hex_code)}
                title={`Mã: ${item.hex_code} | Tỷ lệ: ${item.percentage}% | Bấm để copy`}
              >
                <div className="palette-swatch-color" style={{ backgroundColor: item.hex_code }} />
                <span className="palette-swatch-hex">{item.hex_code}</span>
                <div className="palette-swatch-meta">
                  <span>{item.percentage}%</span>
                  <span className="palette-swatch-role">{item.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lưới 6 Thẻ Tiêu Chuẩn Kỹ Thuật Pixel Art */}
      <div className="palette-metrics-grid">
        {/* Tiêu chí 1: Tổng số màu */}
        <div className="palette-metric-card">
          <div className="palette-metric-header">
            <span className="palette-metric-title">
              <Droplets size={14} color="#8b5cf6" /> 1. Ngân sách màu (Color Budget)
            </span>
            <span className="profile-tag">{paletteMetrics.total_colors} màu</span>
          </div>
          <div className="palette-metric-value">{paletteMetrics.palette_era}</div>
          <div className="palette-metric-desc">Đo chính xác số lượng mã màu độc nhất sử dụng trong nhân vật mẫu.</div>
        </div>

        {/* Tiêu chí 2: Mã màu neo chủ đạo */}
        <div className="palette-metric-card">
          <div className="palette-metric-header">
            <span className="palette-metric-title">
              <Palette size={14} color="#3b82f6" /> 2. Bảng mã màu neo
            </span>
            <span className="profile-tag">{paletteMetrics.top_hex_list?.length || 0} màu chủ đạo</span>
          </div>
          <div className="palette-metric-value" style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#67e8f9' }}>
            {paletteMetrics.top_hex_list?.slice(0, 5).join(' ') || 'N/A'}
          </div>
          <div className="palette-metric-desc">Các màu neo chính tạo nên bản sắc và chiếm diện tích lớn nhất trên nhân vật.</div>
        </div>

        {/* Tiêu chí 3: Số bậc đổ bóng */}
        <div className="palette-metric-card">
          <div className="palette-metric-header">
            <span className="palette-metric-title">
              <Layers size={14} color="#ec4899" /> 3. Bậc đổ bóng (Shading)
            </span>
            <span className="profile-tag success">Ước lượng {paletteMetrics.shading_steps} bậc</span>
          </div>
          <div className="palette-metric-value">{paletteMetrics.shading_style_detected}</div>
          <div className="palette-metric-desc">Thống kê từ các dải màu sáng–tối trên sprite mẫu.</div>
        </div>

        {/* Tiêu chí 4: Dịch chuyển sắc độ (Hue-Shifting) */}
        <div className="palette-metric-card">
          <div className="palette-metric-header">
            <span className="palette-metric-title">
              <Sliders size={14} color="#f59e0b" /> 4. Kỹ thuật dịch sắc độ bóng
            </span>
            <span className={`profile-tag ${paletteMetrics.hue_shifting_detected ? 'success' : ''}`}>
              {paletteMetrics.hue_shifting_detected ? 'Active Hue-Shift' : 'Straight'}
            </span>
          </div>
          <div className="palette-metric-value" style={{ fontSize: '0.85rem' }}>{paletteMetrics.hue_shift_description}</div>
          <div className="palette-metric-desc">Bóng tối dịch sang gam lạnh, vùng sáng dịch sang gam ấm tạo chiều sâu 3D tự nhiên.</div>
        </div>

        {/* Tiêu chí 5: Quy chuẩn màu đường viền */}
        <div className="palette-metric-card">
          <div className="palette-metric-header">
            <span className="palette-metric-title">
              <Shield size={14} color="#10b981" /> 5. Quy chuẩn màu đường viền
            </span>
          </div>
          <div className="palette-metric-value" style={{ fontSize: '0.85rem' }}>{paletteMetrics.outline_style_detected}</div>
          <div className="palette-metric-desc">Quy tắc viền đen thuần hoặc viền đổi màu chọn lọc (Selout) bao bọc thân nhân vật.</div>
        </div>

        {/* Tiêu chí 6: Độ bão hòa & Độ tương phản */}
        <div className="palette-metric-card">
          <div className="palette-metric-header">
            <span className="palette-metric-title">
              <Sun size={14} color="#eab308" /> 6. Độ bão hòa & Tương phản
            </span>
            <span className="profile-tag">{paletteMetrics.contrast_ratio}:1</span>
          </div>
          <div className="palette-metric-value" style={{ fontSize: '0.85rem' }}>
            {paletteMetrics.saturation_type} ({paletteMetrics.average_saturation})
          </div>
          <div className="palette-metric-desc">{paletteMetrics.contrast_type} - Đảm bảo nhân vật nổi bật rõ trên nền game.</div>
        </div>
      </div>

      {/* Khung xem trước & Sao chép Master Color Prompt */}
      {paletteMetrics.master_color_prompt && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-white)' }}>
              Master Color Prompt (Câu lệnh kỹ thuật chuẩn hóa để tạo Sprite đồng bộ):
            </span>
            <button
              type="button"
              className="btn-ghost-studio"
              onClick={handleCopyPrompt}
              style={{ color: copiedPrompt ? '#10b981' : 'var(--text-muted)' }}
            >
              {copiedPrompt ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
              {copiedPrompt ? 'Đã sao chép!' : 'Sao chép Prompt Màu'}
            </button>
          </div>
          <pre
            style={{
              margin: 0,
              padding: '10px 12px',
              borderRadius: '6px',
              background: '#0a0f1d',
              border: '1px solid var(--border-card)',
              color: '#cbd5e1',
              fontSize: '0.75rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'monospace',
              lineHeight: 1.5
            }}
          >
            {paletteMetrics.master_color_prompt}
          </pre>
        </div>
      )}
    </section>
  );
}
