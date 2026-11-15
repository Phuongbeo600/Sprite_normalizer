// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon minh họa góc nhìn trước, ngang, sau và độ che khuất
import { Compass, Eye, EyeOff, Shield, ArrowDown, ArrowRight, ArrowUp } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không có component nội bộ phụ thuộc)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa các lớp CSS từ theme.css

/**
 * Phân hệ 2: Phân tích 3 Hướng nhìn nhân vật (DirectionAnalysis).
 * Quản lý hồ sơ giải phẫu của 3 góc nhìn:
 * - Down: Hướng nhìn từ trước (Front View)
 * - Side: Hướng nhìn ngang (Profile View)
 * - Up: Hướng nhìn từ sau (Back View)
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object|null} props.data Dữ liệu 3 hướng nhìn nhận từ máy chủ.
 * @returns {React.ReactElement} Giao diện hiển thị chi tiết 3 hướng nhìn.
 */
export default function TabDirectionsView({ data }) {
  // Trạng thái chọn góc nhìn đang xem (down, side, up)
  const [selectedDirection, setSelectedDirection] = useState('down');

  if (!data) {
    return (
      <div className="analysis-result" style={{ textAlign: 'center', padding: '24px 16px' }}>
        <p style={{ margin: 0, color: 'var(--text-dim)' }}>
          Chưa có dữ liệu phân tích 3 Hướng nhìn. Hãy bấm <strong>"Quét lại riêng Tab này"</strong> hoặc <strong>"Quét toàn bộ hồ sơ AI"</strong> ở trên.
        </p>
      </div>
    );
  }

  // Cấu hình nhãn và icon cho 3 hướng
  const directionTabs = [
    { key: 'down', label: 'Hướng Down (Nhìn trước - Front)', icon: ArrowDown },
    { key: 'side', label: 'Hướng Side (Nhìn ngang - Profile)', icon: ArrowRight },
    { key: 'up', label: 'Hướng Up (Nhìn sau - Back)', icon: ArrowUp },
  ];

  const currentProfile = data[selectedDirection];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* 1. Thanh chọn góc nhìn phụ (Sub-tabs) */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {directionTabs.map((dir) => {
          const Icon = dir.icon;
          const isActive = selectedDirection === dir.key;
          return (
            <button
              key={dir.key}
              type="button"
              className={`profile-tab-btn ${isActive ? 'active' : ''}`}
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => setSelectedDirection(dir.key)}
            >
              <Icon size={15} />
              <span>{dir.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. Chi tiết góc nhìn được chọn */}
      {currentProfile ? (
        <section className="profile-section-card">
          <h4>
            <Compass size={16} color="var(--accent-purple)" />
            Chi tiết góc nhìn: {currentProfile.view_type || selectedDirection.toUpperCase()}
          </h4>

          {/* Định hướng và Dáng bóng */}
          <div className="profile-field-grid">
            <div className="profile-field-item">
              <strong>Định hướng cơ thể</strong>
              <span>{currentProfile.body_orientation || 'Chính diện'}</span>
            </div>
            <div className="profile-field-item">
              <strong>Định hướng đầu</strong>
              <span>{currentProfile.head_orientation || 'Chính diện'}</span>
            </div>
            <div className="profile-field-item" style={{ gridColumn: '1 / -1' }}>
              <strong>Dáng hình bóng góc này (Silhouette)</strong>
              <span>{currentProfile.silhouette_description || 'Dáng đứng chuẩn'}</span>
            </div>
          </div>

          {/* Bộ phận nhìn thấy & Bị che khuất */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            <div className="profile-field-item">
              <strong style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Eye size={13} color="#10b981" />
                Bộ phận nhìn thấy rõ:
              </strong>
              <div className="profile-tag-list" style={{ marginTop: '4px' }}>
                {currentProfile.visible_body_parts && currentProfile.visible_body_parts.length > 0 ? (
                  currentProfile.visible_body_parts.map((part, idx) => (
                    <span key={idx} className="profile-tag success">{part}</span>
                  ))
                ) : (
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>Không có ghi nhận</span>
                )}
              </div>
            </div>

            <div className="profile-field-item">
              <strong style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <EyeOff size={13} color="#ef4444" />
                Bộ phận bị che khuất (Occluded):
              </strong>
              <div className="profile-tag-list" style={{ marginTop: '4px' }}>
                {currentProfile.occluded_body_parts && currentProfile.occluded_body_parts.length > 0 ? (
                  currentProfile.occluded_body_parts.map((part, idx) => (
                    <span key={idx} className="profile-tag warning">{part}</span>
                  ))
                ) : (
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>Không có bộ phận bị che</span>
                )}
              </div>
            </div>
          </div>

          {/* Phụ kiện và Vị trí hiển thị */}
          <div className="profile-field-item">
            <strong>Phụ kiện nhìn thấy & Vị trí đặt:</strong>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
              <div className="profile-tag-list">
                {currentProfile.visible_accessories && currentProfile.visible_accessories.map((acc, idx) => (
                  <span key={idx} className="profile-tag">🗡️ {acc}</span>
                ))}
              </div>
              {currentProfile.accessory_placement && (
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Vị trí: {currentProfile.accessory_placement}
                </span>
              )}
            </div>
          </div>

          {/* Đặc điểm riêng & Quy tắc che khuất */}
          {currentProfile.view_specific_features && currentProfile.view_specific_features.length > 0 && (
            <div>
              <strong style={{ fontSize: '0.725rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Đặc điểm độc nhất ở góc nhìn này:
              </strong>
              <div className="profile-tag-list" style={{ marginTop: '4px' }}>
                {currentProfile.view_specific_features.map((feat, idx) => (
                  <span key={idx} className="profile-tag">✦ {feat}</span>
                ))}
              </div>
            </div>
          )}

          {currentProfile.occlusion_rules && currentProfile.occlusion_rules.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              <strong style={{ fontSize: '0.725rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Quy tắc che khuất (Occlusion Rules):
              </strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                {currentProfile.occlusion_rules.map((rule, idx) => (
                  <li key={idx} style={{ marginBottom: '2px' }}>{rule}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <div className="analysis-result">Không có dữ liệu cho hướng {selectedDirection}.</div>
      )}
    </div>
  );
}
