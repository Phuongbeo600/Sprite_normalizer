// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý giao diện và trạng thái)
// ========================================================
// React: Quản lý trạng thái, phiên ảnh tham chiếu và hiệu ứng của Studio.
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI
// ========================================================
// lucide-react: Bộ icon vector hiển thị thư mục, tiến trình, tiêu đề và điều hướng
import { ArrowRight, FolderOpen, LoaderCircle, Sparkles } from "lucide-react";

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Thành phần giao diện và dữ liệu)
// ========================================================
// TabReferenceView: Nạp ảnh và hiển thị hai báo cáo đo lường
import TabReferenceView from './components/TabReferenceView';
// Phiên dữ liệu và thao tác được quản lý trong hook của tính năng.
import { useAnalysisSession } from './useAnalysisSession';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Tệp định dạng)
// ========================================================
// Kế thừa phong cách Dark Fantasy Atelier từ analysis-atelier.css
import './analysis-atelier.css';

/**
 * Màn hình Phân Tích & Đo Đạc Sprite (Python).
 * Đo lường giải phẫu hình học và phân tích bảng màu pixel art bằng Python thuần.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object} props.currentProject Dự án hiện tại đang mở (chứa id, name).
 * @param {Object|null} props.loadedPresetData Bản ghi preset được nạp từ trang Thư viện Presets.
 * @param {boolean} props.isActive Studio đang được hiển thị trong dự án.
 * @param {Function} [props.onSelectTab] Hàm chuyển đổi tab trong dự án.
 * @param {Function} [props.onSendPromptToImageGen] Hàm chuyển tiếp ảnh mẫu sang màn hình Tạo ảnh AI.
 * @param {Function} [props.onTransferToWorkspace] Hàm chuyển ảnh sang Bàn vẽ Studio.
 * @returns {React.ReactElement} Giao diện đo đạc sprite hoàn chỉnh.
 */
export default function ProjectAnalysis({
  currentProject,
  loadedPresetData,
  isActive = true,
  onSelectTab = null,
  onSendPromptToImageGen = null,
  onTransferToWorkspace = null,
}) {
  const {
    reference,
    annotatedUrl,
    showOverlay,
    setShowOverlay,
    metrics,
    analysisError,
    colorError,
    localAction,
    profileData,
    setProfileData,
    handleReferenceChange,
    handleLocalMeasure,
    palette,
    pixelReport,
    progress,
  } = useAnalysisSession({ currentProject, loadedPresetData, isActive });

  /**
   * Chuyển sang tab Tạo ảnh AI và đính kèm ảnh tham chiếu hiện tại nếu đã nạp.
   */
  const handleGoToImageGen = () => {
    if (reference?.file && onSendPromptToImageGen) {
      onSendPromptToImageGen('', '', reference.file);
      return;
    }
    if (onSelectTab) {
      onSelectTab('image_gen');
    }
  };

  return (
    <div className="atelier-analysis-root" aria-label="Đo đạc hình học và màu sắc sprite">
      {/* ================================================================ */}
      {/* 1. THANH TIÊU ĐỀ STUDIO (STUDIO HEADER BANNER)                   */}
      {/* ================================================================ */}
      <header className="atelier-analysis-header">
        <div className="atelier-analysis-title-group">
          <h1 className="atelier-analysis-heading">
            <Sparkles size={20} />
            <span>Phân tích Giải Phẫu &amp; Đo Đạc Sprite (Python)</span>
          </h1>
          <p className="atelier-analysis-subtext">
            Bóc tách hình học pixel và phân tích bảng màu chuẩn xác bằng Python thuần.
          </p>
        </div>

        <div className="atelier-analysis-header-actions">
          {reference ? (
            <span className="atelier-analysis-file-badge" title={reference.name}>
              {reference.name}
            </span>
          ) : (
            <span className="atelier-analysis-file-badge" style={{ color: '#94a3b8', borderColor: 'rgba(255,255,255,0.1)' }}>
              Chưa nạp ảnh mẫu
            </span>
          )}

          {/* Nút nạp ảnh tham chiếu */}
          <label className="atelier-analysis-btn-upload">
            <FolderOpen size={15} />
            <span>{reference ? 'Đổi ảnh tham chiếu' : 'Chọn ảnh sprite mẫu'}</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleReferenceChange} //lắng nghe sự kiện và gọi hàm
              disabled={Boolean(progress)}
            />
          </label>

          {/* Nút chuyển nhanh sang tab Tạo ảnh AI */}
          {(onSelectTab || onSendPromptToImageGen) && (
            <button
              type="button"
              className="atelier-btn-primary-action"
              style={{ width: 'auto', padding: '8px 16px', fontSize: '0.82rem', margin: 0 }}
              onClick={handleGoToImageGen}
              title={reference?.file ? 'Chuyển sang tab Tạo ảnh AI kèm ảnh mẫu hiện tại' : 'Chuyển sang tab Tạo ảnh AI'}
            >
              <Sparkles size={15} />
              <span>Chuyển sang Tạo ảnh AI</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </header>

      {/* Thanh chỉ báo quét / tiến trình xử lý */}
      {progress && (
        <div className="atelier-analysis-progress-bar" role="status" aria-live="polite">
          <LoaderCircle size={15} className="atelier-ws-spinner-icon" />
          <span>{progress}</span>
        </div>
      )}

      {/* ================================================================ */}
      {/* 2. NỘI DUNG ĐO ĐẠC HÌNH HỌC & MÀU SẮC (TAB 1)                   */}
      {/* ================================================================ */}
      <TabReferenceView
        reference={reference}
        annotatedUrl={annotatedUrl}
        showOverlay={showOverlay}
        onToggleOverlay={(event) => setShowOverlay(event.target.checked)}
        onMeasure={handleLocalMeasure}
        localAction={localAction}
        metrics={metrics}
        regions={profileData.region_measurements}
        manualRegions={profileData.manual_region_measurements}
        onManualReport={(report) =>
          setProfileData((previous) => ({
            ...previous,
            manual_region_measurements: report,
          }))
        }
        pixelReport={pixelReport}
        palette={palette}
        analysisError={analysisError}
        colorError={colorError}
        onTransferToWorkspace={onTransferToWorkspace}
      />
    </div>
  );
}
