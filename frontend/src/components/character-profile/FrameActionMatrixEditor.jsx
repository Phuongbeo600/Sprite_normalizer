// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon minh họa các hướng di chuyển, dáng đứng, bước chân, xoay chiều, ngôn ngữ dịch và tải
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
  ChevronUp,
  Languages,
  Loader2
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// translateText, translateBatch: Hàm gọi API dịch thuật offline cục bộ không tốn API key
import { translateText, translateBatch } from '../../utils/translationApi';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách theme.css

/**
 * Component Trình Soạn Thảo Ma Trận 15 Frame Hoạt Họa Pixel Art (Frame Action Matrix Editor).
 * Hiển thị ma trận 3 hướng di chuyển (Down, Side, Up), mỗi hướng gồm:
 * - 1 Frame Tĩnh (Idle Stand - Đứng yên thở).
 * - 4 Frame Động (Walk Cycle - Bước đi có chuyển động cả CHÂN và TAY đối nghịch tự nhiên).
 * Tích hợp nút xem bản dịch Tiếng Việt (AI Offline cục bộ) trên từng khung frame nhỏ và dịch hàng loạt 5 frames.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object} props.frameActions Dữ liệu 15 frame hoạt họa hiện tại.
 * @param {Function} props.onChangeFrame Hàm callback cập nhật nội dung một frame cụ thể.
 * @param {Function} props.onResetDirection Hàm khôi phục 5 frame của một hướng về mặc định từ Schemas.
 * @returns {React.ReactElement} Giao diện chỉnh sửa 15 frame trực quan kèm dịch offline.
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

  // Bộ nhớ lưu trữ bản dịch tiếng Việt cho từng frame theo khóa `${direction}_${fKey}`
  const [translatedFrames, setTranslatedFrames] = useState({});
  // Trạng thái đang chuyển đổi sang tiếng Việt cho từng frame: { [key]: boolean }
  const [isViewingVi, setIsViewingVi] = useState({});
  // Trạng thái loading của từng frame: { [key]: boolean }
  const [loadingFrames, setLoadingFrames] = useState({});
  // Trạng thái đang dịch đồng loạt cả 5 frame của hướng hiện tại
  const [batchTranslating, setBatchTranslating] = useState(false);

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

  /**
   * Bật/tắt xem bản dịch Tiếng Việt cho một khung frame nhỏ cụ thể.
   */
  const handleToggleFrameLang = async (direction, fKey, originalPrompt) => {
    const frameKeyId = `${direction}_${fKey}`;
    const currentlyVi = Boolean(isViewingVi[frameKeyId]);

    if (currentlyVi) {
      // Đang xem tiếng Việt thì quay lại tiếng Anh gốc
      setIsViewingVi((prev) => ({ ...prev, [frameKeyId]: false }));
      return;
    }

    // Nếu đã có bản dịch sẵn trong cache của frame này
    if (translatedFrames[frameKeyId]) {
      setIsViewingVi((prev) => ({ ...prev, [frameKeyId]: true }));
      return;
    }

    if (!originalPrompt || !originalPrompt.trim()) return;

    // Gọi mô hình offline để dịch frame này
    setLoadingFrames((prev) => ({ ...prev, [frameKeyId]: true }));
    try {
      const viResult = await translateText(originalPrompt, 'en', 'vi');
      setTranslatedFrames((prev) => ({ ...prev, [frameKeyId]: viResult }));
      setIsViewingVi((prev) => ({ ...prev, [frameKeyId]: true }));
    } catch (err) {
      console.error('[FrameActionMatrixEditor] Lỗi dịch frame:', err);
    } finally {
      setLoadingFrames((prev) => ({ ...prev, [frameKeyId]: false }));
    }
  };

  /**
   * Dịch đồng loạt cả 5 frame của hướng hiện tại sang Tiếng Việt.
   */
  const handleToggleAllFrames = async () => {
    // Kiểm tra xem hiện tại cả 5 frame đã xem tiếng Việt chưa
    const allVi = frameKeys.every((fKey) => Boolean(isViewingVi[`${activeDirection}_${fKey}`]));

    if (allVi) {
      // Đang bật tiếng Việt cho cả 5 thì chuyển tất cả về tiếng Anh gốc
      setIsViewingVi((prev) => {
        const nextState = { ...prev };
        frameKeys.forEach((fKey) => {
          nextState[`${activeDirection}_${fKey}`] = false;
        });
        return nextState;
      });
      return;
    }

    // Thu thập các frame chưa được dịch
    const neededKeys = [];
    const neededPrompts = [];
    frameKeys.forEach((fKey) => {
      const keyId = `${activeDirection}_${fKey}`;
      const prompt = currentDirFrames[fKey]?.action_prompt || '';
      if (!translatedFrames[keyId] && prompt.trim()) {
        neededKeys.push(keyId);
        neededPrompts.push(prompt);
      }
    });

    if (neededPrompts.length > 0) {
      setBatchTranslating(true);
      try {
        const results = await translateBatch(neededPrompts, 'en', 'vi');
        const newTranslations = {};
        neededKeys.forEach((keyId, idx) => {
          newTranslations[keyId] = results[idx] || '';
        });
        setTranslatedFrames((prev) => ({ ...prev, ...newTranslations }));
      } catch (err) {
        console.error('[FrameActionMatrixEditor] Lỗi dịch đồng loạt 5 frame:', err);
      } finally {
        setBatchTranslating(false);
      }
    }

    // Bật chế độ xem Tiếng Việt cho cả 5 frame
    setIsViewingVi((prev) => {
      const nextState = { ...prev };
      frameKeys.forEach((fKey) => {
        nextState[`${activeDirection}_${fKey}`] = true;
      });
      return nextState;
    });
  };

  const isCurrentAllVi = frameKeys.every((fKey) => Boolean(isViewingVi[`${activeDirection}_${fKey}`]));

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
        paddingBottom: '8px',
        flexWrap: 'wrap',
        gap: '8px'
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Nút dịch đồng loạt cả 5 frame của hướng đang xem */}
          <button
            type="button"
            className="btn-ghost-studio"
            onClick={handleToggleAllFrames}
            disabled={batchTranslating}
            title="Dịch toàn bộ 5 frame của hướng hiện tại sang Tiếng Việt bằng mô hình AI offline"
            style={{
              fontSize: '0.75rem',
              padding: '4px 8px',
              gap: '4px',
              color: isCurrentAllVi ? '#38bdf8' : 'var(--text-muted)',
              background: isCurrentAllVi ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
              borderColor: isCurrentAllVi ? 'rgba(56, 189, 248, 0.3)' : 'transparent'
            }}
          >
            {batchTranslating ? (
              <Loader2 size={13} className="spin" />
            ) : (
              <Languages size={13} color={isCurrentAllVi ? '#38bdf8' : undefined} />
            )}
            <span>
              {batchTranslating ? 'Đang dịch 5 frame…' : isCurrentAllVi ? 'Xem lại 5 frame English' : 'Dịch cả 5 frame sang Tiếng Việt'}
            </span>
          </button>

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
      </div>

      <p style={{ margin: '0 0 10px', fontSize: '0.775rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
        Mỗi hướng gồm <strong>1 Frame Tĩnh (Đứng yên)</strong> và <strong>4 Frame Động (Bước đi có chuyển động cả Chân và Tay đối nghịch tự nhiên)</strong>. Bạn có thể bấm nút <strong>[🌐]</strong> ở từng khung nhỏ để xem bản dịch tiếng Việt offline.
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
              const frameKeyId = `${activeDirection}_${fKey}`;
              const isViewingViFrame = Boolean(isViewingVi[frameKeyId]);
              const isLoadingFrame = Boolean(loadingFrames[frameKeyId]);
              const viText = translatedFrames[frameKeyId] || '';

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
                  {/* Tiêu đề Frame, Huy hiệu & Nút Dịch Tiếng Việt cho từng khung nhỏ */}
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

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {/* Nút dịch offline cho từng khung nhỏ */}
                      <button
                        type="button"
                        onClick={() => handleToggleFrameLang(activeDirection, fKey, frameItem.action_prompt)}
                        disabled={isLoadingFrame}
                        title={isViewingViFrame ? 'Xem lại prompt tiếng Anh gốc của frame này' : 'Dịch mô tả frame này sang Tiếng Việt (Offline)'}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          background: isViewingViFrame ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                          border: isViewingViFrame ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                          color: isViewingViFrame ? '#38bdf8' : 'var(--text-muted)',
                          borderRadius: '4px',
                          padding: '1px 5px',
                          fontSize: '0.65rem',
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                      >
                        {isLoadingFrame ? (
                          <Loader2 size={10} className="spin" />
                        ) : (
                          <Languages size={10} />
                        )}
                        <span>{isViewingViFrame ? 'VI' : 'EN'}</span>
                      </button>

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
                  </div>

                  {/* Ô nhập Prompt hành động của Frame (Hiển thị Tiếng Việt nếu đang bật chế độ dịch) */}
                  <textarea
                    rows={4}
                    value={isViewingViFrame ? (viText || 'Đang dịch…') : (frameItem.action_prompt || '')}
                    onChange={(e) => {
                      if (!isViewingViFrame) {
                        onChangeFrame(activeDirection, fKey, e.target.value);
                      }
                    }}
                    readOnly={isViewingViFrame}
                    placeholder="Mô tả chuyển động chân và tay bằng tiếng Anh..."
                    title={isViewingViFrame ? 'Đang ở chế độ xem bản dịch Tiếng Việt (chỉ đọc). Bấm lại nút [VI] để chuyển sang tiếng Anh chỉnh sửa.' : 'Mô tả chuyển động bằng tiếng Anh'}
                    style={{
                      width: '100%',
                      background: isViewingViFrame ? 'rgba(15, 23, 42, 0.9)' : 'rgba(10, 11, 20, 0.8)',
                      border: isViewingViFrame ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '5px',
                      padding: '6px 8px',
                      fontSize: '0.725rem',
                      color: isViewingViFrame ? '#e0f2fe' : 'var(--text-white)',
                      lineHeight: '1.4',
                      resize: 'vertical',
                      fontFamily: isViewingViFrame ? 'inherit' : 'monospace'
                    }}
                  />
                  {isViewingViFrame && (
                    <div style={{ fontSize: '0.65rem', color: '#38bdf8', fontStyle: 'italic', textAlign: 'right' }}>
                      Bản dịch Tiếng Việt (Bấm lại [VI] để sửa tiếng Anh)
                    </div>
                  )}
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
