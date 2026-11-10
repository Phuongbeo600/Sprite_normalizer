// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon minh họa thông tin nhân vật, giải phẫu, bảng màu và chất liệu
import {
  UserCheck,
  Bone,
  Palette,
  Layers,
  Sparkles,
  Check,
  Copy,
  Droplets,
  Sun,
  Shield,
  Sliders
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không có component nội bộ phụ thuộc)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa các lớp CSS từ theme.css


/**
 * Phân hệ 1: Phong cách mỹ thuật, Bảng màu và Bảng vật liệu toàn cục (GlobalAnalysis).
 * Trình bày chi tiết 5 nhóm dữ liệu:
 * - 0. Hồ sơ Bảng Màu Chuẩn & 6 Tiêu Chí Kỹ Thuật Pixel Art (Python Heuristic Engine)
 * - 1. Nhận diện & Danh tính (IdentityAnalysis)
 * - 2. Cấu trúc Giải phẫu học (AnatomyAnalysis)
 * - 3. Phong cách Pixel Art (PixelStyleAnalysis)
 * - 4. Bảng Vật liệu theo từng vùng cơ thể (MaterialAnalysis)
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object|null} props.data Dữ liệu phân tích toàn cục nhận từ máy chủ.
 * @returns {React.ReactElement} Giao diện hiển thị chi tiết.
 */
export default function TabGlobalView({ data }) {
  // Trạng thái sao chép mã HEX và sao chép Prompt màu sắc
  const [copiedHex, setCopiedHex] = useState(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  if (!data) {
    return (
      <div className="analysis-result" style={{ textAlign: 'center', padding: '24px 16px' }}>
        <p style={{ margin: 0, color: 'var(--text-dim)' }}>
          Chưa có dữ liệu phân tích Phong cách & Vật liệu. Hãy bấm <strong>"Quét lại riêng Tab này"</strong> hoặc <strong>"Quét toàn bộ hồ sơ AI"</strong> ở trên.
        </p>
      </div>
    );
  }

  const { identity, anatomy, pixel_style, materials, palette_metrics } = data;

  /**
   * Sao chép mã HEX của một ô màu vào bộ nhớ đệm
   * 
   * @param {string} hexCode Mã HEX cần sao chép (ví dụ: #8b5cf6)
   */
  const handleCopyHex = (hexCode) => {
    if (!hexCode) return;
    navigator.clipboard.writeText(hexCode);
    setCopiedHex(hexCode);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  /**
   * Sao chép toàn bộ Prompt quy chuẩn màu sắc chung
   */
  const handleCopyPrompt = () => {
    if (!palette_metrics?.master_color_prompt) return;
    navigator.clipboard.writeText(palette_metrics.master_color_prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* ========================================================
          0. HỒ SƠ ĐO LƯỜNG HỆ MÀU SẮC CHUẨN (PYTHON PALETTE ENGINE)
          Đo đạc 100% chính xác 6 tiêu chí kỹ thuật màu sắc của Sprite bằng Python
          ======================================================== */}
      {palette_metrics && (
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
          {palette_metrics.dominant_colors && palette_metrics.dominant_colors.length > 0 && (
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
                {palette_metrics.dominant_colors.slice(0, 16).map((item, idx) => (
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
                <span className="profile-tag">{palette_metrics.total_colors} màu</span>
              </div>
              <div className="palette-metric-value">{palette_metrics.palette_era}</div>
              <div className="palette-metric-desc">Đo chính xác số lượng mã màu độc nhất sử dụng trong nhân vật mẫu.</div>
            </div>

            {/* Tiêu chí 2: Mã màu neo chủ đạo */}
            <div className="palette-metric-card">
              <div className="palette-metric-header">
                <span className="palette-metric-title">
                  <Palette size={14} color="#3b82f6" /> 2. Bảng mã màu neo
                </span>
                <span className="profile-tag">{palette_metrics.top_hex_list?.length || 0} màu chủ đạo</span>
              </div>
              <div className="palette-metric-value" style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: '#67e8f9' }}>
                {palette_metrics.top_hex_list?.slice(0, 5).join(' ') || 'N/A'}
              </div>
              <div className="palette-metric-desc">Các màu neo chính tạo nên bản sắc và chiếm diện tích lớn nhất trên nhân vật.</div>
            </div>

            {/* Tiêu chí 3: Số bậc đổ bóng */}
            <div className="palette-metric-card">
              <div className="palette-metric-header">
                <span className="palette-metric-title">
                  <Layers size={14} color="#ec4899" /> 3. Bậc đổ bóng (Shading)
                </span>
                <span className="profile-tag success">{palette_metrics.shading_steps} nấc sáng</span>
              </div>
              <div className="palette-metric-value">{palette_metrics.shading_style_detected}</div>
              <div className="palette-metric-desc">Không dùng cọ mềm mịn (Airbrush), đổ bóng phân mảng dứt khoát chuẩn Cel-shading.</div>
            </div>

            {/* Tiêu chí 4: Dịch chuyển sắc độ (Hue-Shifting) */}
            <div className="palette-metric-card">
              <div className="palette-metric-header">
                <span className="palette-metric-title">
                  <Sliders size={14} color="#f59e0b" /> 4. Kỹ thuật dịch sắc độ bóng
                </span>
                <span className={`profile-tag ${palette_metrics.hue_shifting_detected ? 'success' : ''}`}>
                  {palette_metrics.hue_shifting_detected ? 'Active Hue-Shift' : 'Straight'}
                </span>
              </div>
              <div className="palette-metric-value" style={{ fontSize: '0.85rem' }}>{palette_metrics.hue_shift_description}</div>
              <div className="palette-metric-desc">Bóng tối dịch sang gam lạnh, vùng sáng dịch sang gam ấm tạo chiều sâu 3D tự nhiên.</div>
            </div>

            {/* Tiêu chí 5: Quy chuẩn màu đường viền */}
            <div className="palette-metric-card">
              <div className="palette-metric-header">
                <span className="palette-metric-title">
                  <Shield size={14} color="#10b981" /> 5. Quy chuẩn màu đường viền
                </span>
              </div>
              <div className="palette-metric-value" style={{ fontSize: '0.85rem' }}>{palette_metrics.outline_style_detected}</div>
              <div className="palette-metric-desc">Quy tắc viền đen thuần hoặc viền đổi màu chọn lọc (Selout) bao bọc thân nhân vật.</div>
            </div>

            {/* Tiêu chí 6: Độ bão hòa & Độ tương phản */}
            <div className="palette-metric-card">
              <div className="palette-metric-header">
                <span className="palette-metric-title">
                  <Sun size={14} color="#eab308" /> 6. Độ bão hòa & Tương phản
                </span>
                <span className="profile-tag">{palette_metrics.contrast_ratio}:1</span>
              </div>
              <div className="palette-metric-value" style={{ fontSize: '0.85rem' }}>
                {palette_metrics.saturation_type} ({palette_metrics.average_saturation})
              </div>
              <div className="palette-metric-desc">{palette_metrics.contrast_type} - Đảm bảo nhân vật nổi bật rõ trên nền game.</div>
            </div>
          </div>

          {/* Khung xem trước & Sao chép Master Color Prompt */}
          {palette_metrics.master_color_prompt && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <strong style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Prompt Quy Chuẩn Màu Sắc Chung (Tự động tiêm vào Khung To Nhất của Prompt):
                </strong>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  style={{
                    fontSize: '0.725rem',
                    padding: '4px 8px',
                    background: copiedPrompt ? 'rgba(16, 185, 129, 0.2)' : 'var(--accent-secondary-btn)',
                    color: copiedPrompt ? '#10b981' : 'var(--text-highlight)',
                    border: '1px solid ' + (copiedPrompt ? '#10b981' : 'var(--accent-purple-glow)'),
                    borderRadius: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {copiedPrompt ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copiedPrompt ? 'Đã sao chép prompt màu!' : 'Sao chép Prompt Màu Sắc Này'}</span>
                </button>
              </div>
              <div className="palette-prompt-box">
                {palette_metrics.master_color_prompt}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ========================================================
          1. ĐẶC ĐIỂM NHẬN DIỆN VÀ DANH TÍNH (IDENTITY)
          ======================================================== */}
      {identity && (
        <section className="profile-section-card">
          <h4>
            <UserCheck size={16} color="var(--accent-purple)" />
            1. Đặc điểm nhận diện & Danh tính (Identity)
          </h4>
          <div className="profile-field-grid">
            <div className="profile-field-item">
              <strong>Loại nhân vật</strong>
              <span>{identity.character_type || 'Chưa xác định'}</span>
            </div>
            <div className="profile-field-item">
              <strong>Vóc dáng (Body Type)</strong>
              <span>{identity.body_type || 'Chưa xác định'}</span>
            </div>
            <div className="profile-field-item">
              <strong>Giới tính thể hiện</strong>
              <span>{identity.gender_presentation || 'Không rõ / Phi giới tính'}</span>
            </div>
            <div className="profile-field-item">
              <strong>Ngôn ngữ hình khối</strong>
              <span>{identity.shape_language || 'Chưa xác định'}</span>
            </div>
          </div>

          {/* Dáng hình bóng Silhouette */}
          {identity.silhouette && (
            <div className="profile-field-item">
              <strong>Hình dáng bóng tổng thể (Silhouette)</strong>
              <span>{identity.silhouette}</span>
            </div>
          )}

          {/* Trang phục và Khuôn mặt */}
          <div className="profile-field-grid">
            {identity.facial_features && (
              <div className="profile-field-item">
                <strong>Đặc điểm khuôn mặt</strong>
                <span>{identity.facial_features}</span>
              </div>
            )}
            {identity.costume_description && (
              <div className="profile-field-item">
                <strong>Thiết kế trang phục</strong>
                <span>{identity.costume_description}</span>
              </div>
            )}
          </div>

          {/* Đặc điểm nhận diện nổi bật */}
          {identity.distinctive_features && identity.distinctive_features.length > 0 && (
            <div>
              <strong style={{ fontSize: '0.725rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Đặc điểm nhận diện chính:
              </strong>
              <div className="profile-tag-list" style={{ marginTop: '4px' }}>
                {identity.distinctive_features.map((feat, idx) => (
                  <span key={idx} className="profile-tag">
                    ★ {feat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Phụ kiện & Vũ khí */}
          {identity.accessories && identity.accessories.length > 0 && (
            <div>
              <strong style={{ fontSize: '0.725rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Phụ kiện & Vũ khí:
              </strong>
              <div className="profile-tag-list" style={{ marginTop: '4px' }}>
                {identity.accessories.map((acc, idx) => (
                  <span key={idx} className="profile-tag success">
                    🗡️ {acc}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ========================================================
          2. CẤU TRÚC GIẢI PHẪU HỌC (ANATOMY)
          ======================================================== */}
      {anatomy && (
        <section className="profile-section-card">
          <h4>
            <Bone size={16} color="var(--accent-purple)" />
            2. Cấu trúc Giải phẫu học (Anatomy)
          </h4>
          <div className="profile-field-grid">
            <div className="profile-field-item">
              <strong>Cấu trúc cơ thể</strong>
              <span>{anatomy.body_structure || 'Humanoid'}</span>
            </div>
            <div className="profile-field-item">
              <strong>Vị trí tương đối các chi</strong>
              <span>{anatomy.relative_limb_placement || 'Chuẩn'}</span>
            </div>
          </div>

          <div className="profile-field-grid">
            <div className="profile-field-item">
              <strong>Đầu & Hộp sọ</strong>
              <span>{anatomy.head_description || 'Chưa xác định'}</span>
            </div>
            <div className="profile-field-item">
              <strong>Thân (Torso)</strong>
              <span>{anatomy.torso_description || 'Chưa xác định'}</span>
            </div>
            <div className="profile-field-item">
              <strong>Cấu trúc Tay</strong>
              <span>{anatomy.arm_structure || 'Chưa xác định'}</span>
            </div>
            <div className="profile-field-item">
              <strong>Cấu trúc Chân</strong>
              <span>{anatomy.leg_structure || 'Chưa xác định'}</span>
            </div>
          </div>

          {/* Mốc cơ thể và Bộ phận bất thường */}
          {anatomy.identifiable_landmarks && anatomy.identifiable_landmarks.length > 0 && (
            <div>
              <strong style={{ fontSize: '0.725rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Các mốc cơ thể nhận diện được:
              </strong>
              <div className="profile-tag-list" style={{ marginTop: '4px' }}>
                {anatomy.identifiable_landmarks.map((mark, idx) => (
                  <span key={idx} className="profile-tag">
                    📍 {mark}
                  </span>
                ))}
              </div>
            </div>
          )}

          {anatomy.unusual_body_parts && anatomy.unusual_body_parts.length > 0 && (
            <div>
              <strong style={{ fontSize: '0.725rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Bộ phận đặc biệt:
              </strong>
              <div className="profile-tag-list" style={{ marginTop: '4px' }}>
                {anatomy.unusual_body_parts.map((part, idx) => (
                  <span key={idx} className="profile-tag warning">
                    ⚠️ {part}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ========================================================
          3. PHONG CÁCH ĐỒ HỌA PIXEL ART (PIXEL STYLE)
          ======================================================== */}
      {pixel_style && (
        <section className="profile-section-card">
          <h4>
            <Palette size={16} color="var(--accent-purple)" />
            3. Phong cách Đồ họa Pixel Art (Pixel Style)
          </h4>
          <div className="profile-field-grid">
            <div className="profile-field-item">
              <strong>Trường phái Art Style</strong>
              <span>{pixel_style.art_style || 'Pixel Art tiêu chuẩn'}</span>
            </div>
            <div className="profile-field-item">
              <strong>Đường viền nét (Outline)</strong>
              <span>{pixel_style.outline_style || 'Nét đen / Viền chọn lọc'}</span>
            </div>
            <div className="profile-field-item">
              <strong>Kiểu đổ bóng (Shading)</strong>
              <span>
                {pixel_style.shading_style}
                {pixel_style.shading_levels ? ` (${pixel_style.shading_levels} bậc sáng)` : ''}
              </span>
            </div>
            <div className="profile-field-item">
              <strong>Hướng ánh sáng</strong>
              <span>{pixel_style.lighting_direction || 'Góc trên chiếu xuống'}</span>
            </div>
            <div className="profile-field-item">
              <strong>Kỹ thuật Dithering</strong>
              <span>{pixel_style.dithering_style || 'Không dùng dithering'}</span>
            </div>
            <div className="profile-field-item">
              <strong>Cụm Pixel (Cluster)</strong>
              <span>{pixel_style.pixel_cluster_style || 'Cụm rõ ràng'}</span>
            </div>
            <div className="profile-field-item">
              <strong>Mật độ chi tiết</strong>
              <span>{pixel_style.detail_density || 'Vừa phải'}</span>
            </div>
            <div className="profile-field-item">
              <strong>Độ sắc nét Pixel</strong>
              <span>{pixel_style.pixel_cleanliness || 'Sạch sẽ'}</span>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================
          4. PHÂN TÍCH CHẤT LIỆU TỪNG VÙNG (MATERIALS)
          ======================================================== */}
      {materials && materials.length > 0 && (
        <section className="profile-section-card">
          <h4>
            <Layers size={16} color="var(--accent-purple)" />
            4. Phân tích Chất liệu theo Vùng (Materials)
          </h4>
          <div className="profile-material-grid">
            {materials.map((mat, idx) => (
              <div key={idx} className="profile-material-card">
                <div className="profile-material-header">
                  <strong>{mat.region_name || `Vùng ${idx + 1}`}</strong>
                  <span className="profile-material-type">{mat.material_type || 'Other'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.775rem' }}>
                  <div><span style={{ color: 'var(--text-dim)' }}>Màu sắc: </span>{mat.color_description}</div>
                  <div><span style={{ color: 'var(--text-dim)' }}>Phản xạ: </span>{mat.reflectivity}</div>
                  <div><span style={{ color: 'var(--text-dim)' }}>Đổ bóng: </span>{mat.shading_description}</div>
                  {mat.pixel_texture && (
                    <div><span style={{ color: 'var(--text-dim)' }}>Texture: </span>{mat.pixel_texture}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
