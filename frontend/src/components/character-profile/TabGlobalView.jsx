// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon minh họa thông tin nhân vật, giải phẫu, phong cách và vật liệu
import { UserCheck, Bone, Palette, Layers, Sparkles } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không có component nội bộ phụ thuộc)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa các lớp CSS từ theme.css

/**
 * Phân hệ 1: Phong cách & Vật liệu Toàn cục (GlobalAnalysis).
 * Trình bày chi tiết 4 nhóm dữ liệu:
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
  if (!data) {
    return (
      <div className="analysis-result" style={{ textAlign: 'center', padding: '24px 16px' }}>
        <p style={{ margin: 0, color: 'var(--text-dim)' }}>
          Chưa có dữ liệu phân tích Phong cách & Vật liệu. Hãy bấm <strong>"Quét lại riêng Tab này"</strong> hoặc <strong>"Quét toàn bộ hồ sơ AI"</strong> ở trên.
        </p>
      </div>
    );
  }

  const { identity, anatomy, pixel_style, materials } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
