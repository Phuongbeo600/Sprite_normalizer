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
// Kế thừa phong cách Dark Fantasy Atelier từ analysis-atelier.css
import '../../styles/analysis-atelier.css';

/**
 * Component Trình Soạn Thảo Ma Trận 15 Frame Hoạt Họa Pixel Art (Frame Action Matrix Editor) — Dark Fantasy Atelier Edition.
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
    { key: 'down', label: 'Hướng Xuống (Mặt trước)', icon: ArrowDown, color: '#10b981' },
    { key: 'side', label: 'Hướng Ngang (Nghiêng 90°)', icon: ArrowRight, color: '#c084fc' },
    { key: 'up', label: 'Hướng Lên (Sau lưng)', icon: ArrowUp, color: '#f59e0b' },
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
      setIsViewingVi((prev) => ({ ...prev, [frameKeyId]: false }));
      return;
    }

    if (translatedFrames[frameKeyId]) {
      setIsViewingVi((prev) => ({ ...prev, [frameKeyId]: true }));
      return;
    }

    if (!originalPrompt || !originalPrompt.trim()) return;

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
    const isAllCurrentlyVi = frameKeys.every((fKey) => Boolean(isViewingVi[`${activeDirection}_${fKey}`]));

    if (isAllCurrentlyVi) {
      setIsViewingVi((prev) => {
        const nextState = { ...prev };
        frameKeys.forEach((fKey) => {
          nextState[`${activeDirection}_${fKey}`] = false;
        });
        return nextState;
      });
      return;
    }

    const neededPrompts = [];
    const neededKeys = [];
    frameKeys.forEach((fKey) => {
      const frameKeyId = `${activeDirection}_${fKey}`;
      if (!translatedFrames[frameKeyId]) {
        const promptText = currentDirFrames[fKey]?.action_prompt || '';
        if (promptText.trim()) {
          neededPrompts.push(promptText);
          neededKeys.push(frameKeyId);
        }
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
    <div className="atelier-matrix-card">
      {/* 1. THANH TIÊU ĐỀ MA TRẬN 15 FRAME & NÚT THU GỌN */}
      <div className="atelier-matrix-header">
        <div className="atelier-matrix-title-group">
          <Layers size={18} color="#c084fc" />
          <h4 className="atelier-matrix-title">
            Ma Trận 15 Frame Hoạt Họa Pixel Art (3 Hướng × 5 Frames)
          </h4>
          <span className="atelier-matrix-badge">
            Chuẩn Lưới 3x5
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Nút dịch đồng loạt 5 frame */}
          <button
            type="button"
            className="atelier-prompt-btn-translate"
            onClick={handleToggleAllFrames}
            disabled={batchTranslating}
            title="Dịch toàn bộ 5 frame của hướng hiện tại sang Tiếng Việt bằng mô hình AI offline"
            style={{ padding: '5px 12px', fontSize: '0.74rem' }}
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
            className="atelier-assets-btn-sub"
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ padding: '5px 10px', fontSize: '0.74rem' }}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>{isExpanded ? 'Thu gọn' : 'Mở rộng'}</span>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 2. CHỌN HƯỚNG NHÌN (3 DIRECTION TABS) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div className="atelier-matrix-dir-tabs">
              {directionsConfig.map((dir) => {
                const IconComponent = dir.icon;
                const isActive = activeDirection === dir.key;
                return (
                  <button
                    key={dir.key}
                    type="button"
                    onClick={() => setActiveDirection(dir.key)}
                    className={`atelier-matrix-dir-btn ${isActive ? 'active' : ''}`}
                  >
                    <IconComponent size={14} color={isActive ? '#c084fc' : dir.color} />
                    <span>{dir.label}</span>
                  </button>
                );
              })}
            </div>

            {onResetDirection && (
              <button
                type="button"
                className="atelier-assets-btn-sub"
                onClick={() => onResetDirection(activeDirection)}
                title="Khôi phục 5 frame của hướng này về mặc định"
                style={{ fontSize: '0.725rem', padding: '4px 8px' }}
              >
                <RotateCcw size={12} />
                <span>Khôi phục mặc định</span>
              </button>
            )}
          </div>

          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--atl-text-secondary)', lineHeight: 1.45 }}>
            Mỗi hướng gồm <strong>1 Frame Tĩnh</strong> (Đứng yên thở) và <strong>4 Frame Động</strong> (Bước đi có chuyển động cả Chân và Tay đối nghịch tự nhiên). Bạn có thể bấm nút <Languages size={12} style={{ display: 'inline' }} /> ở từng khung nhỏ để xem bản dịch tiếng Việt offline.
          </p>

          {/* 3. LƯỚI 5 KHUNG FRAME HOẠT HỌA */}
          <div className="atelier-matrix-frames-grid">
            {frameKeys.map((fKey, index) => {
              const frameItem = currentDirFrames[fKey] || {};
              const frameKeyId = `${activeDirection}_${fKey}`;
              const isVi = Boolean(isViewingVi[frameKeyId]);
              const isLoadingThis = Boolean(loadingFrames[frameKeyId]);
              const displayedText = isVi && translatedFrames[frameKeyId]
                ? translatedFrames[frameKeyId]
                : frameItem.action_prompt || '';

              const isIdle = fKey === 'idle';

              return (
                <div key={fKey} className="atelier-matrix-frame-card">
                  <div className="atelier-matrix-frame-top">
                    <span className="atelier-matrix-frame-label">
                      {isIdle ? <User size={13} color="#10b981" /> : <Footprints size={13} color="#c084fc" />}
                      <span>{isIdle ? 'Frame 0 (Idle)' : `Frame ${index} (Walk)`}</span>
                    </span>

                    <button
                      type="button"
                      className="atelier-assets-btn-sub"
                      onClick={() => handleToggleFrameLang(activeDirection, fKey, frameItem.action_prompt)}
                      disabled={isLoadingThis}
                      style={{ padding: '2px 6px', fontSize: '0.68rem' }}
                      title={isVi ? 'Quay lại tiếng Anh' : 'Dịch sang tiếng Việt'}
                    >
                      {isLoadingThis ? (
                        <Loader2 size={11} className="spin" />
                      ) : (
                        <Languages size={11} color={isVi ? '#38bdf8' : undefined} />
                      )}
                      <span>{isVi ? 'VI' : 'EN'}</span>
                    </button>
                  </div>

                  <span style={{ fontSize: '0.7rem', color: '#a39bc2', display: 'block' }}>
                    {frameItem.label || (isIdle ? 'Đứng yên' : `Bước ${index}`)}
                  </span>

                  <textarea
                    className="atelier-matrix-frame-textarea"
                    rows={4}
                    value={displayedText}
                    readOnly={isVi}
                    onChange={(e) => {
                      if (!isVi) {
                        onChangeFrame(activeDirection, fKey, e.target.value);
                      }
                    }}
                    placeholder="Mô tả hành động của frame..."
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
