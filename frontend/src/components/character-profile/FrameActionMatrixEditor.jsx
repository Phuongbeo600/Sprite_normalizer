// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon minh họa các hướng di chuyển, dáng đứng, bước chân, xoay chiều và làm mới
import {
  Compass,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Footprints,
  User,
  Sparkles,
  RotateCcw,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không có phụ thuộc nội bộ)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách theme.css

/**
 * Component Trình Soạn Thảo Ma Trận 15 Frame Hoạt Họa Pixel Art (Frame Action Matrix Editor).
 * Hiển thị ma trận 3 hướng di chuyển (Down, Side, Up), mỗi hướng gồm:
 * - 1 Frame Tĩnh (Idle Stand - Đứng yên thở).
 * - 4 Frame Động (Walk Cycle - Bước đi có chuyển động cả CHÂN và TAY đối nghịch tự nhiên).
 * Tích hợp tự động các thông số từ 7 Schemas (độ nhún trọng tâm bobbing, hướng sáng, bộ phận che khuất).
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object} props.frameActions Dữ liệu 15 frame hoạt họa hiện tại.
 * @param {Function} props.onChangeFrame Hàm callback cập nhật nội dung một frame cụ thể.
 * @param {Function} props.onResetDirection Hàm khôi phục 5 frame của một hướng về mặc định từ Schemas.
 * @returns {React.ReactElement} Giao diện chỉnh sửa 15 frame trực quan.
 */
export default function FrameActionMatrixEditor({
  frameActions,
  onChangeFrame,
  onResetDirection
}) {
  // Tab hướng hiện đang chọn: 'down' | 'side' | 'up'
  const [activeDirection, setActiveDirection] = useState('down');
  // Trạng thái thu gọn/mở rộng bảng chỉnh sửa frame
  const [isExpanded, setIsExpanded] = useState(true);

  if (!frameActions) return null;

  // Lấy dữ liệu 5 frame của hướng đang chọn
  const currentDirFrames = frameActions[activeDirection] || {};

  // Cấu hình nhãn và icon cho 3 hướng
  const directionsConfig = [
    { key: 'down', label: 'Hướng Xuống (Mặt đối diện)', icon: ArrowDown, color: '#10b981' },
    { key: 'side', label: 'Hướng Ngang (Nhìn nghiêng 90°)', icon: ArrowRight, color: '#6366f1' },
    { key: 'up', label: 'Hướng Lên (Quay lưng lại)', icon: ArrowUp, color: '#f59e0b' },
  ];

  // Danh sách 5 khóa frame theo đúng thứ tự chu kỳ
  const frameKeys = ['idle', 'frame_1', 'frame_2', 'frame_3', 'frame_4'];

  return (
    <div style={{
      background: 'rgba(25, 27, 46, 0.75)',
      border: '1px solid var(--accent-purple-glow)',
      borderRadius: '10px',
      padding: '14px',
      marginTop: '10px'
    }}>
      {/* ========================================================
          1. THANH TIÊU ĐỀ MA TRẬN 15 FRAME & NÚT THU GỌN
          ======================================================== */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '10px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} color="var(--accent-purple)" />
          <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-white)', fontWeight: 600 }}>
            Ma Trận 15 Frame Hoạt Họa Pixel Art (3 Hướng × 5 Frames)
          </h4>
          <span style={{
            fontSize: '0.7rem',
            padding: '2px 8px',
            borderRadius: '12px',
            background: 'rgba(99, 102, 241, 0.2)',
            color: 'var(--accent-purple)',
            fontWeight: 500
          }}>
            Chuẩn Lưới 3x5
          </span>
        </div>

        <button
          type="button"
          className="btn-ghost-studio"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ fontSize: '0.75rem', padding: '4px 8px', gap: '4px' }}
        >
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {isExpanded ? 'Thu gọn' : 'Mở rộng chỉnh sửa'}
        </button>
      </div>

      <p style={{ margin: '0 0 10px', fontSize: '0.775rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
        Mỗi hướng gồm <strong>1 Frame Tĩnh (Đứng yên)</strong> và <strong>4 Frame Động (Bước đi có chuyển động cả Chân và Tay đối nghịch tự nhiên)</strong>. Dữ liệu độ nhún trọng tâm, viền và hướng sáng đã được tự động tiêm từ 7 Schemas.
      </p>

      {isExpanded && (
        <>
          {/* ========================================================
              2. THANH TAB CHUYỂN HƯỚNG (Down / Side / Up)
              ======================================================== */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '12px',
            background: 'rgba(15, 17, 28, 0.6)',
            padding: '4px',
            borderRadius: '8px'
          }}>
            {directionsConfig.map((dir) => {
              const Icon = dir.icon;
              const isActive = activeDirection === dir.key;
              return (
                <button
                  key={dir.key}
                  type="button"
                  onClick={() => setActiveDirection(dir.key)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: isActive ? 600 : 500,
                    background: isActive ? 'var(--accent-purple)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-muted)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Icon size={15} color={isActive ? '#ffffff' : dir.color} />
                  <span>{dir.label}</span>
                </button>
              );
            })}
          </div>

          {/* ========================================================
              3. DANH SÁCH 5 CARD FRAME TRỰC QUAN CỦA HƯỚNG ĐANG CHỌN
              ======================================================== */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '10px',
            marginBottom: '10px'
          }}>
            {frameKeys.map((fKey, idx) => {
              const frameItem = currentDirFrames[fKey] || {};
              const isStatic = frameItem.type === 'static' || fKey === 'idle';

              return (
                <div
                  key={fKey}
                  style={{
                    background: 'rgba(18, 20, 36, 0.9)',
                    border: isStatic ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    padding: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  {/* Tiêu đề Frame & Huy hiệu */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: '0.725rem',
                      fontWeight: 600,
                      color: isStatic ? '#a78bfa' : '#38bdf8',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {isStatic ? <User size={13} /> : <Footprints size={13} />}
                      {frameItem.label || `Frame ${idx}`}
                    </span>

                    <span style={{
                      fontSize: '0.65rem',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: isStatic ? 'rgba(167, 139, 250, 0.2)' : 'rgba(56, 189, 248, 0.15)',
                      color: isStatic ? '#c4b5fd' : '#7dd3fc'
                    }}>
                      {isStatic ? 'Tĩnh' : `Bước ${idx}`}
                    </span>
                  </div>

                  {/* Ô nhập Prompt hành động của Frame */}
                  <textarea
                    rows={4}
                    value={frameItem.action_prompt || ''}
                    onChange={(e) => onChangeFrame(activeDirection, fKey, e.target.value)}
                    placeholder="Mô tả chuyển động chân và tay bằng tiếng Anh..."
                    style={{
                      width: '100%',
                      background: 'rgba(10, 11, 20, 0.8)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '5px',
                      padding: '6px 8px',
                      fontSize: '0.725rem',
                      color: 'var(--text-white)',
                      lineHeight: '1.4',
                      resize: 'vertical',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* ========================================================
              4. NÚT PHỤC HỒI NỘI DUNG MẶC ĐỊNH CHO HƯỚNG NÀY
              ======================================================== */}
          {onResetDirection && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-ghost-studio"
                onClick={() => onResetDirection(activeDirection)}
                style={{ fontSize: '0.725rem', padding: '4px 8px', gap: '4px', color: 'var(--text-muted)' }}
                title="Khôi phục 5 frame của hướng này về nguyên bản từ 7 Schemas"
              >
                <RotateCcw size={12} />
                Phục hồi 5 frame của hướng này từ Schemas
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
