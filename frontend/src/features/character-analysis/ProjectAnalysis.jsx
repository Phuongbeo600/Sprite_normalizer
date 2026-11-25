// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý giao diện và trạng thái)
// ========================================================
// React: Quản lý trạng thái, phiên ảnh tham chiếu và hiệu ứng của Studio.
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI
// ========================================================
// lucide-react: Bộ icon vector hiển thị thư mục, quét ảnh, tạo prompt, sao chép và chuyển đổi chế độ, ổ khóa
import { Dna, FolderOpen, LoaderCircle, Ruler, Sparkles, Wand2, Lock } from "lucide-react";

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Thành phần giao diện và dữ liệu)
// ========================================================
// Component thanh điều hướng 3 phân hệ tra cứu hồ sơ nhân vật
import CharacterProfileTabs from './components/CharacterProfileTabs';
// Component hiển thị phân hệ 1: Phong cách & Vật liệu toàn cục
import TabGlobalView from './components/TabGlobalView';
// Component hiển thị phân hệ 2: 3 Hướng nhìn (Down, Side, Up)
import TabDirectionsView from './components/TabDirectionsView';
// Component hiển thị phân hệ 3: Hoạt họa chuyển động (Idle, Walk)
import TabAnimationsView from './components/TabAnimationsView';
// TabReferenceView: Nạp ảnh và hiển thị hai báo cáo đo lường
import TabReferenceView from './components/TabReferenceView';
// Component hiển thị phân hệ sinh prompt cho nhân vật mới
import TabConstraintsPromptView from './components/TabConstraintsPromptView';
// PromptStudioEmptyState: Màn hình trang trí Pixel Art khi chưa đo đạc sprite ở Tab 1
import PromptStudioEmptyState from './components/PromptStudioEmptyState';
// Các hàm gửi yêu cầu phân tích, sinh prompt và lưu hồ sơ.
// Hàm gom số đo Python để gửi cho bộ phân tích phong cách.

// Phiên dữ liệu và thao tác được quản lý trong hook của tính năng.
import { useAnalysisSession } from './useAnalysisSession';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Tệp định dạng)
// ========================================================
// Kế thừa phong cách Dark Fantasy Atelier từ analysis-atelier.css
import './analysis-atelier.css';

/**
 * Màn hình Studio Phân Tích & Sinh Prompt AI (Project Analysis & Generation Studio).
 * Thiết kế tinh xảo theo phong cách Dark Fantasy Atelier:
 * - Quy trình 3 phân hệ trực quan: Đo đạc Sprite ➔ Hồ sơ Mẫu AI ➔ Sinh Prompt 15-Frame.
 * - Đo lường giải phẫu hình học tự động bằng Python thuần.
 * - Khởi tạo phong cách và chỉ dẫn vẽ pixel qua AI Vision (Gemini / OpenAI).
 * - Tự động lưu trữ và nạp lại cấu hình dự án từ CSDL MySQL.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object} props.currentProject Dự án hiện tại đang mở (chứa id, name).
 * @param {Object|null} props.loadedPresetData Bản ghi preset được nạp từ trang Thư viện Presets.
 * @param {boolean} props.isActive Studio đang được hiển thị trong dự án.
 * @param {Function} [props.onSendPromptToImageGen] Hàm chuyển tiếp prompt sang màn hình Tạo ảnh AI.
 * @param {boolean} [props.isAiEnabled=true] Trạng thái bật/tắt toàn bộ tính năng AI trong dự án.
 * @returns {React.ReactElement} Giao diện Creative Workspace hoàn chỉnh.
 */
export default function ProjectAnalysis({
  currentProject,
  loadedPresetData,
  isActive = true,
  onSendPromptToImageGen = null,
  onTransferToWorkspace = null,
  isAiEnabled = true,
}) {
  const {
    reference, annotatedUrl, showOverlay, setShowOverlay, metrics, analysisError, colorError, localAction, workspaceMode, setWorkspaceMode, activeProfileTab, setActiveProfileTab, profileData, setProfileData, visionStatus, visionError, isGeneratingStyle, profileError, generatedProfilePrompt, savingPreset, saveSuccessMsg, loadedPresetConfig, handleReferenceChange, handleLocalMeasure, handleGenerateReferenceStyle, handleSavePreset, tabStatuses, palette, pixelReport, referenceStyle, providerLabel, resultProviderLabel, pythonMeasurements, progress, hasMeasured
  } = useAnalysisSession({ currentProject, loadedPresetData, isActive });

  return (
    <div className="atelier-analysis-root" aria-label="Studio phân tích giải phẫu và sinh prompt">
      {/* ================================================================ */}
      {/* 1. THANH TIÊU ĐỀ STUDIO (STUDIO HEADER BANNER)                   */}
      {/* ================================================================ */}
      <header className="atelier-analysis-header">
        <div className="atelier-analysis-title-group">
          <h1 className="atelier-analysis-heading">
            <Sparkles size={20} />
            <span>Phân tích Giải Phẫu &amp; Sinh Prompt AI</span>
          </h1>
          <p className="atelier-analysis-subtext">
            Bóc tách hình học pixel bằng Python thuần &amp; Tạo prompt hoạt họa ma trận 15-frame chuẩn xác.
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
      {/* 2. BỘ CHUYỂN ĐỔI CHẾ ĐỘ STUDIO (SEGMENTED WORKSPACE TABS)        */}
      {/* ================================================================ */}
      <nav className="atelier-analysis-nav" aria-label="Khu vực làm việc Studio">
        <button
          type="button"
          className={`atelier-analysis-nav-btn ${workspaceMode === 'reference' ? 'active' : ''}`}
          aria-pressed={workspaceMode === 'reference'}
          onClick={() => setWorkspaceMode('reference')}
        >
          <Ruler size={16} />
          <span>1. Đo đạc Sprite (Python)</span>
          {metrics && <span className="atelier-analysis-nav-badge">Đã đo</span>}
        </button>

        <button
          type="button"
          className={`atelier-analysis-nav-btn ${workspaceMode === 'dna_profile' ? 'active' : ''}`}
          aria-pressed={workspaceMode === 'dna_profile'}
          onClick={() => setWorkspaceMode('dna_profile')}
        >
          <Dna size={16} />
          <span>2. Hồ sơ Mẫu AI</span>
          {referenceStyle && <span className="atelier-analysis-nav-badge">Sẵn sàng</span>}
        </button>

        <button
          type="button"
          className={`atelier-analysis-nav-btn ${workspaceMode === 'prompt_studio' ? 'active' : ''}`}
          aria-pressed={workspaceMode === 'prompt_studio'}
          onClick={() => setWorkspaceMode('prompt_studio')}
        >
          <Wand2 size={16} />
          <span>3. Phòng tạo Prompt 15-Frame</span>
          {generatedProfilePrompt && <span className="atelier-analysis-nav-badge">Đã sinh</span>}
        </button>
      </nav>

      {/* ================================================================ */}
      {/* 3. NỘI DUNG TỪNG PHÂN HỆ WORKSPACE                               */}
      {/* ================================================================ */}

      {/* PHÂN HỆ 1: ĐO ĐẠC HÌNH HỌC & MÀU SẮC (TAB REFERENCE) */}
      {workspaceMode === 'reference' && (
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
          onOpenPrompt={() => setWorkspaceMode('prompt_studio')}
          onTransferToWorkspace={onTransferToWorkspace}
        />
      )}

      {/* PHÂN HỆ 2: HỒ SƠ PHONG CÁCH AI (DNA PROFILE) */}
      {workspaceMode === 'dna_profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Card Sinh Prompt Phong Cách từ Ảnh Mẫu */}
          <section className="atelier-dna-card" aria-busy={isGeneratingStyle}>
            <div className="atelier-dna-heading">
              <h2>Khởi tạo chỉ dẫn phong cách bằng AI Vision</h2>
              <button
                type="button"
                className="atelier-btn-primary-action"
                style={{ width: 'auto', padding: '8px 18px', margin: 0 }}
                disabled={!reference || visionStatus !== 'ready' || isGeneratingStyle || Boolean(localAction) || !isAiEnabled}
                onClick={handleGenerateReferenceStyle}
              >
                {isGeneratingStyle ? (
                  <>
                    <LoaderCircle size={15} className="atelier-ws-spinner-icon" />
                    <span>Đang phân tích phong cách AI…</span>
                  </>
                ) : !isAiEnabled ? (
                  <>
                    <Lock size={15} />
                    <span>Đã Khóa (Tính năng AI đang tắt)</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    <span>Tạo prompt phong cách bằng {providerLabel}</span>
                  </>
                )}
              </button>
            </div>

            {!isAiEnabled && (
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#f87171', fontWeight: 600 }}>
                ⚠️ Tính năng AI hiện đang bị TẮT trong Cài đặt dự án. Nút tạo chỉ dẫn phong cách AI đã được khóa an toàn.
              </p>
            )}

            <p style={{ margin: 0, fontSize: '0.82rem', color: '#a39bc2' }}>
              Hệ thống sẽ gửi ảnh sprite và toàn bộ số đo Python đến {providerLabel} để phân tích ngữ pháp nét viền, kỹ thuật đổ bóng và bảng màu tái sử dụng được.
            </p>

            {reference && Object.keys(pythonMeasurements).length === 0 && (
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--atl-gold, #f59e0b)' }}>
                💡 Gợi ý: Hãy chạy đo đạc sprite ở Tab 1 trước để AI có đầy đủ số đo chính xác.
              </p>
            )}

            {visionStatus !== 'ready' && (
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8' }}>
                {visionStatus === 'checking' && 'Đang kiểm tra cấu hình kết nối AI…'}
                {visionStatus === 'missing' && `Chưa cấu hình API Key ${providerLabel} cho dự án này.`}
                {visionStatus === 'error' && visionError}
              </p>
            )}

            {profileError && <p className="atelier-ws-error" role="alert">{profileError}</p>}
          </section>

          {/* Kết quả chỉ dẫn vẽ phong cách */}
          {referenceStyle?.style_prompt && (
            <section className="atelier-dna-card">
              <div className="atelier-dna-heading">
                <h2>Chỉ dẫn vẽ phong cách từ {resultProviderLabel}</h2>
                <button
                  className="atelier-btn-secondary-action"
                  style={{ width: 'auto', padding: '6px 14px' }}
                  type="button"
                  onClick={() => setWorkspaceMode('prompt_studio')}
                >
                  <Wand2 size={15} />
                  <span>Mở phòng tạo Prompt</span>
                </button>
              </div>

              <div className="atelier-dna-result-box">
                {referenceStyle.style_prompt}
              </div>

              {referenceStyle.observations?.length > 0 && (
                <details className="studio-measure-details">
                  <summary>{resultProviderLabel} quan sát được những gì?</summary>
                  <ul style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                    {referenceStyle.observations.map((item, index) => (
                      <li key={index} style={{ marginBottom: '4px' }}>{item}</li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          )}

          {/* Hồ sơ chi tiết các phân hệ đã lưu */}
          {Object.values(tabStatuses).some(Boolean) && (
            <details className="studio-measure-details">
              <summary>Hồ sơ phân tích chi tiết (Toàn cục, Hướng nhìn &amp; Hoạt họa)</summary>
              <div style={{ marginTop: '12px' }}>
                <CharacterProfileTabs
                  activeTab={activeProfileTab}
                  onSelectTab={setActiveProfileTab}
                  tabStatuses={tabStatuses}
                />
                {activeProfileTab === 'global' && (
                  <TabGlobalView data={profileData.global_analysis} showPalette={false} />
                )}
                {activeProfileTab === 'directions' && (
                  <TabDirectionsView data={profileData.direction_analysis} />
                )}
                {activeProfileTab === 'animations' && (
                  <TabAnimationsView data={profileData.animation_analysis} />
                )}
              </div>
            </details>
          )}
        </div>
      )}

      {/* PHÂN HỆ 3: PHÒNG SINH PROMPT & RÀNG BUỘC 15-FRAME (TAB CONSTRAINTS PROMPT) */}
      <div hidden={workspaceMode !== 'prompt_studio'}>
        {hasMeasured ? (
          <TabConstraintsPromptView
            consistency={profileData.consistency_analysis}
            negativeConstraints={profileData.negative_constraints}
            fullProfile={profileData}
            measuredGeometry={metrics}
            onSavePreset={handleSavePreset}
            savingPreset={savingPreset}
            saveSuccessMsg={saveSuccessMsg}
            initialConfig={loadedPresetConfig}
            onSendPromptToImageGen={onSendPromptToImageGen}
            isAiEnabled={isAiEnabled}
            referenceFile={reference}
          />
        ) : (
          <PromptStudioEmptyState
            hasReference={Boolean(reference)}
            onGoToMeasure={() => setWorkspaceMode('reference')}
          />
        )}
      </div>
    </div>
  );
}
