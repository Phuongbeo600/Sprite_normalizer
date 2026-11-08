// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon minh họa chuyển động, nhịp chân, đánh tay và frame hình
import { Activity, Play, Repeat, CheckCircle, AlertTriangle } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không có component nội bộ phụ thuộc)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa các lớp CSS từ theme.css

/**
 * Phân hệ 3: Phân tích Hoạt họa & Động học Chuyển động (AnimationAnalysis).
 * Quản lý chuyển động Đứng yên (Idle) và Bước đi (Walk) cho từng hướng:
 * - Idle: 3 frames mỗi hướng
 * - Walk: 4 frames mỗi hướng
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object|null} props.data Dữ liệu hoạt họa nhận từ máy chủ.
 * @returns {React.ReactElement} Giao diện hiển thị chi tiết hoạt họa.
 */
export default function TabAnimationsView({ data }) {
  // Trạng thái chọn hướng (down, side, up) và kiểu animation (idle, walk)
  const [direction, setDirection] = useState('down');
  const [animType, setAnimType] = useState('idle');

  if (!data) {
    return (
      <div className="analysis-result" style={{ textAlign: 'center', padding: '24px 16px' }}>
        <p style={{ margin: 0, color: 'var(--text-dim)' }}>
          Chưa có dữ liệu phân tích Hoạt họa chuyển động. Hãy bấm <strong>"Quét lại riêng Tab này"</strong> hoặc <strong>"Quét toàn bộ hồ sơ AI"</strong> ở trên.
        </p>
      </div>
    );
  }

  const dirAnim = data[direction];
  const animProfile = dirAnim ? dirAnim[animType] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* 1. Bộ điều khiển chọn Hướng và Loại hoạt họa */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'space-between' }}>
        {/* Chọn hướng */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {['down', 'side', 'up'].map((dirKey) => (
            <button
              key={dirKey}
              type="button"
              className={`profile-tab-btn ${direction === dirKey ? 'active' : ''}`}
              onClick={() => setDirection(dirKey)}
            >
              {dirKey === 'down' ? 'Down (Trước)' : dirKey === 'side' ? 'Side (Ngang)' : 'Up (Sau)'}
            </button>
          ))}
        </div>

        {/* Chọn kiểu animation */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className={`profile-tab-btn ${animType === 'idle' ? 'active' : ''}`}
            onClick={() => setAnimType('idle')}
          >
            <Play size={13} />
            Idle (Đứng yên)
          </button>
          <button
            type="button"
            className={`profile-tab-btn ${animType === 'walk' ? 'active' : ''}`}
            onClick={() => setAnimType('walk')}
          >
            <Activity size={13} />
            Walk (Bước đi)
          </button>
        </div>
      </div>

      {/* 2. Chi tiết hồ sơ chuyển động */}
      {animProfile ? (
        <section className="profile-section-card">
          <h4>
            <Activity size={16} color="var(--accent-purple)" />
            Chuyển động {animType.toUpperCase()} - Hướng {direction.toUpperCase()} ({animProfile.frame_count} Frames)
          </h4>

          {/* Động học và Nhịp chân tay */}
          <div className="profile-field-grid">
            <div className="profile-field-item">
              <strong>Trình tự chu kỳ</strong>
              <span>{animProfile.motion_sequence || 'Tuần hoàn'}</span>
            </div>
            <div className="profile-field-item">
              <strong>Đặc điểm lặp (Loop)</strong>
              <span>{animProfile.loop_characteristics || 'Lặp mượt mà'}</span>
            </div>
            <div className="profile-field-item">
              <strong>Động học Chân (Leg Motion)</strong>
              <span>{animProfile.leg_motion || 'Ổn định'}</span>
            </div>
            <div className="profile-field-item">
              <strong>Động học Tay (Arm Motion)</strong>
              <span>{animProfile.arm_motion || 'Đánh nhẹ theo nhịp'}</span>
            </div>
          </div>

          {/* Chuyển động phụ */}
          {animProfile.secondary_motion && (
            <div className="profile-field-item">
              <strong>Chuyển động phụ (Secondary Motion - Áo choàng / Đuôi / Vũ khí)</strong>
              <span>{animProfile.secondary_motion}</span>
            </div>
          )}

          {/* Bộ phận chuyển động vs Cố định */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
            <div className="profile-field-item">
              <strong style={{ color: '#10b981' }}>Bộ phận chuyển động:</strong>
              <div className="profile-tag-list" style={{ marginTop: '4px' }}>
                {animProfile.moving_body_parts && animProfile.moving_body_parts.map((p, idx) => (
                  <span key={idx} className="profile-tag success">{p}</span>
                ))}
              </div>
            </div>

            <div className="profile-field-item">
              <strong style={{ color: 'var(--text-dim)' }}>Bộ phận cố định:</strong>
              <div className="profile-tag-list" style={{ marginTop: '4px' }}>
                {animProfile.fixed_body_parts && animProfile.fixed_body_parts.map((p, idx) => (
                  <span key={idx} className="profile-tag">{p}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Mô tả tư thế từng Frame (Frame-by-Frame descriptions) */}
          {animProfile.frame_descriptions && animProfile.frame_descriptions.length > 0 && (
            <div style={{ marginTop: '6px' }}>
              <strong style={{ fontSize: '0.725rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Mô tả giải phẫu từng Frame:
              </strong>
              <div className="profile-frame-sequence">
                {animProfile.frame_descriptions.map((desc, idx) => (
                  <div key={idx} className="profile-frame-item">
                    <span className="profile-frame-num">Frame {idx + 1}:</span>
                    <span>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sai khác quan sát được */}
          {animProfile.observed_inconsistencies && animProfile.observed_inconsistencies.length > 0 && (
            <div style={{ marginTop: '6px' }}>
              <strong style={{ fontSize: '0.725rem', color: '#ef4444', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={13} />
                Sai lệch hoặc bất thường giữa các frame:
              </strong>
              <div className="profile-tag-list" style={{ marginTop: '4px' }}>
                {animProfile.observed_inconsistencies.map((err, idx) => (
                  <span key={idx} className="profile-tag warning">⚠️ {err}</span>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : (
        <div className="analysis-result">Chưa có dữ liệu cho hoạt họa này.</div>
      )}
    </div>
  );
}
