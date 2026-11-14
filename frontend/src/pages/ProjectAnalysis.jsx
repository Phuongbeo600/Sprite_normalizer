// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useEffect, useRef, useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon vector SVG siêu nhẹ hiển thị thư mục, quét ảnh, tạo prompt, sao chép và chuyển đổi chế độ
import { Dna, FolderOpen, LoaderCircle, Ruler, Sparkles, Wand2 } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// Component thanh điều hướng 3 phân hệ tra cứu hồ sơ nhân vật (đã loại bỏ tab trùng lặp)
import CharacterProfileTabs from '../components/character-profile/CharacterProfileTabs';
// Component hiển thị phân hệ 1: Phong cách & Vật liệu toàn cục
import TabGlobalView from '../components/character-profile/TabGlobalView';
// Component hiển thị phân hệ 2: 3 Hướng nhìn (Down, Side, Up)
import TabDirectionsView from '../components/character-profile/TabDirectionsView';
// Component hiển thị phân hệ 3: Hoạt họa chuyển động (Idle, Walk)
import TabAnimationsView from '../components/character-profile/TabAnimationsView';
// TabReferenceView: Nạp ảnh và hiển thị hai báo cáo đo lường.
import TabReferenceView from '../components/character-profile/TabReferenceView';
// Component hiển thị phân hệ sinh prompt cho nhân vật mới.
import TabConstraintsPromptView from '../components/character-profile/TabConstraintsPromptView';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Định dạng giao diện được kế thừa từ theme.css thông qua index.css

/**
 * Chọn các số đo Python để gửi cùng ảnh tham chiếu.
 *
 * @param {Object} data Bảng màu, báo cáo pixel và số đo của ảnh đang mở.
 * @returns {Object} Dữ liệu đo có nguồn rõ ràng và không chứa mô tả AI.
 */
function collectPythonMeasurements({ palette, pixelReport, metrics, profileData }) {
  const report = {};
  if (palette?.total_colors > 0) {
    report.palette = {
      total_colors: palette.total_colors,
      dominant_hex: palette.top_hex_list,
      outline_style: palette.outline_style_detected,
      shading_steps_estimate: palette.shading_steps,
      hue_shift: palette.hue_shift_description,
      saturation: palette.average_saturation,
      contrast_ratio: palette.contrast_ratio,
    };
  }
  if (pixelReport) {
    report.pixel_grid = pixelReport.grid;
    report.outline = pixelReport.outline;
    report.detail = pixelReport.detail;
    report.clusters = pixelReport.clusters;
  }
  if (metrics) {
    report.automatic_geometry = {
      image_size_px: [metrics.canvas_width, metrics.canvas_height],
      character_height_px: metrics.anatomical_height ?? metrics.visible_height,
      character_width_px: metrics.visible_width,
      heads_tall: metrics.heads_tall,
      head_width_px: metrics.head_width ?? metrics.head_w,
      head_height_px: metrics.head_height ?? metrics.head_h,
      body_width_px: metrics.body_width ?? metrics.body_w,
      body_height_px: metrics.body_height ?? metrics.body_h,
      ground_y: metrics.ground_y,
    };
  }
  for (const [name, regions] of [
    ['automatic_regions', profileData.region_measurements],
    ['manual_regions', profileData.manual_region_measurements],
  ]) {
    const entries = Object.entries(regions?.measurements || {});
    if (entries.length) {
      report[name] = {
        image_size_px: regions.image_size_px,
        measurements: Object.fromEntries(entries.map(([part, measurement]) => [part, {
          type: measurement.polygon ? 'cross_section' : 'reference_segment',
          width_px: measurement.width_px,
        }])),
      };
    }
  }
  return report;
}

/**
 * Màn hình Studio Chuẩn Hóa & Thiết Kế Sprite AI (Project Analysis & Generation Studio).
 * Thiết kế tinh gọn theo chuẩn Modern Creative Workspace:
 * - Chọn ảnh một lần để đo bằng Python hoặc mô tả bằng Gemini theo yêu cầu.
 * - Tự động đọc và lưu trữ thông số theo dự án (currentProject.id) trong MySQL.
 * - Hỗ trợ lưu trữ bản phân tích và Prompt vào Thư viện Presets của dự án.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object} props.currentProject Dự án hiện tại đang mở (chứa id, name).
 * @param {Object|null} props.loadedPresetData Bản ghi preset được nạp từ trang Thư viện Presets.
 * @param {boolean} props.isActive Studio đang được hiển thị trong dự án.
 * @param {Function} [props.onSendPromptToImageGen] Hàm chuyển tiếp prompt sang màn hình Tạo ảnh AI.
 * @returns {React.ReactElement} Giao diện Creative Workspace hoàn chỉnh.
 */
export default function ProjectAnalysis({ currentProject, loadedPresetData, isActive = true, onSendPromptToImageGen = null }) {
  // ========================================================
  // TRẠNG THÁI ẢNH THAM CHIẾU & LỚP PHỦ GIẢI PHẪU
  // ========================================================
  const [reference, setReference] = useState(null);
  const referenceVersion = useRef(0);
  const [annotatedUrl, setAnnotatedUrl] = useState(null);
  const [showOverlay, setShowOverlay] = useState(true);

  // Trạng thái dữ liệu đo đạc giải phẫu hình học (CharacterMetrics)
  const [metrics, setMetrics] = useState(null);
  const [analysisError, setAnalysisError] = useState('');
  const [colorError, setColorError] = useState('');
  const [localAction, setLocalAction] = useState(null);

  // ========================================================
  // TRẠNG THÁI ĐIỀU HƯỚNG WORKSPACE STUDIO TINH GỌN
  // ========================================================
  const [workspaceMode, setWorkspaceMode] = useState('reference');

  // ========================================================
  // TRẠNG THÁI HỒ SƠ NHÂN VẬT THAM CHIẾU (CHARACTER PROFILE)
  // ========================================================
  // Phân hệ tra cứu đang mở trong chế độ 'dna_profile': 'global' | 'directions' | 'animations'
  const [activeProfileTab, setActiveProfileTab] = useState('global');
  // Dữ liệu hồ sơ nhân vật hoàn chỉnh
  const [profileData, setProfileData] = useState({
    global_analysis: null,
    direction_analysis: null,
    animation_analysis: null,
    consistency_analysis: null,
    negative_constraints: null,
  });
  const [visionStatus, setVisionStatus] = useState('checking');
  const [visionProvider, setVisionProvider] = useState(null);
  const [isGeneratingStyle, setIsGeneratingStyle] = useState(false);
  // Thông báo lỗi phân tích hồ sơ
  const [profileError, setProfileError] = useState('');

  // ========================================================
  // TRẠNG THÁI BỘ MÁY SINH PROMPT & LƯU PRESET VÀO MYSQL
  // ========================================================
  const [generatedProfilePrompt, setGeneratedProfilePrompt] = useState(null);
  const [generatingProfilePrompt, setGeneratingProfilePrompt] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [loadedPresetConfig, setLoadedPresetConfig] = useState(null);

  // Dọn dẹp bộ nhớ URL tạm khi đổi ảnh
  useEffect(() => {
    if (!reference) return;
    return () => {
      URL.revokeObjectURL(reference.url);
    };
  }, [reference]);

  // Nạp dữ liệu khi người dùng bấm "Mở lại trong Studio" từ trang Hồ sơ đã lưu
  useEffect(() => {
    if (loadedPresetData) {
      referenceVersion.current += 1;
      setReference(null);
      setAnnotatedUrl(null);
      setLocalAction(null);
      setIsGeneratingStyle(false);
      setAnalysisError('');
      setColorError('');
      setProfileError('');
      setMetrics(loadedPresetData.metrics_data || null);
      const savedProfile = loadedPresetData.profile_data || {};
      setProfileData({
        ...savedProfile,
        palette_metrics: savedProfile.palette_metrics || savedProfile.global_analysis?.palette_metrics,
        pixel_art_report: savedProfile.pixel_art_report || savedProfile.global_analysis?.pixel_art_report,
      });
      if (loadedPresetData.positive_prompt) {
        setGeneratedProfilePrompt({
          positive_prompt: loadedPresetData.positive_prompt,
          negative_prompt: loadedPresetData.negative_prompt,
          technical_notes: loadedPresetData.technical_notes,
        });
      }
      setLoadedPresetConfig({
        new_character_concept: loadedPresetData.new_character_concept,
        outfit_and_colors: loadedPresetData.outfit_and_colors,
        weapons_and_props: loadedPresetData.weapons_and_props,
        stature_rule: loadedPresetData.stature_rule,
        target_direction: loadedPresetData.target_direction,
        frame_actions_data: loadedPresetData.frame_actions_data,
      });
      setWorkspaceMode('prompt_studio');
    }
  }, [loadedPresetData]);

  /**
   * Xử lý nạp ảnh nhân vật mẫu từ máy tính của người dùng.
   * 
   * @param {React.ChangeEvent<HTMLInputElement>} event Sự kiện chọn tệp.
   */
  const handleReferenceChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      referenceVersion.current += 1;
      setReference({
        file,
        name: file.name,
        url: URL.createObjectURL(file),
      });
      setAnnotatedUrl(null);
      setMetrics(null);
      setAnalysisError('');
      setColorError('');
      setProfileData({
        global_analysis: null,
        direction_analysis: null,
        animation_analysis: null,
        consistency_analysis: null,
        negative_constraints: null,
      });
      setGeneratedProfilePrompt(null);
      setProfileError('');
      setSaveSuccessMsg('');
    }
    event.target.value = '';
  };

  // Chỉ đọc trạng thái cấu hình của dự án khi mở Hồ sơ mẫu.
  const projectId = currentProject?.id;
  useEffect(() => {
    if (!isActive || workspaceMode !== 'dna_profile') return;
    const controller = new AbortController();
    const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
    setVisionStatus('checking');
    fetch(`/api/character-profile/vision-status${query}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Không đọc được cấu hình AI.');
        const data = await response.json();
        if (!controller.signal.aborted) {
          setVisionProvider(data.provider);
          setVisionStatus(data.ready ? 'ready' : 'missing');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setVisionStatus('error');
      });
    return () => controller.abort();
  }, [isActive, workspaceMode, projectId]);

  /**
   * Gửi tệp hiện tại cùng các trường của đúng thao tác đang chọn.
   * @param {string} url Tuyến API xử lý ảnh.
   * @param {Object} fields Các tùy chọn riêng của thao tác.
   */
  const requestAnalysis = async (url, fields = {}) => {
    const body = new FormData();
    body.append('file', reference.file);
    Object.entries(fields).forEach(([name, value]) => body.append(name, value));
    const response = await fetch(url, { method: 'POST', body });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || 'Không xử lý được ảnh.');
    return payload;
  };

  /** @param {'colors'|'size'} action Phép đo Python được yêu cầu. */
  const handleLocalMeasure = async (action) => {
    if (!reference || localAction) return;
    const version = referenceVersion.current;
    const measureColors = action === 'colors';
    const setError = measureColors ? setColorError : setAnalysisError;
    setLocalAction(action);
    setError('');
    try {
      const result = await requestAnalysis(measureColors ? '/api/analyze-colors' : '/api/analyze');
      if (version !== referenceVersion.current) return;
      if (measureColors) {
        setProfileData((previous) => ({ ...previous, ...result }));
      } else {
        setMetrics(result.metrics);
        setAnnotatedUrl(result.annotated_image);
        setShowOverlay(true);
        setProfileData((previous) => ({ ...previous, region_measurements: result.region_measurements }));
      }
    } catch (error) {
      if (version === referenceVersion.current) setError(error.message);
    } finally {
      if (version === referenceVersion.current) setLocalAction(null);
    }
  };

  /** Gửi ảnh và số đo đến nhà cung cấp AI đã cấu hình cho dự án. */
  const handleGenerateReferenceStyle = async () => {
    if (!reference || isGeneratingStyle || localAction || visionStatus !== 'ready') return;
    const version = referenceVersion.current;
    setIsGeneratingStyle(true);
    setProfileError('');
    try {
      const fields = { python_metrics_json: JSON.stringify(pythonMeasurements) };
      if (projectId) fields.project_id = projectId;
      const result = await requestAnalysis('/api/character-profile/style-prompt', fields);
      if (version === referenceVersion.current) {
        setProfileData((previous) => ({ ...previous, reference_style: result }));
      }
    } catch (error) {
      if (version === referenceVersion.current) setProfileError(error.message);
    } finally {
      if (version === referenceVersion.current) setIsGeneratingStyle(false);
    }
  };

  /**
   * Sinh Prompt AI tiếng Anh tối ưu hóa cho Nhân vật Mới (Tự do sáng tạo).
   * Tự động truyền project_id để Backend đọc API Key từ MySQL của dự án.
   * 
   * @param {Object} newCharConfig Thông số cấu hình nhân vật mới do người dùng nhập.
   */
  const handleGeneratePromptFromProfile = async (newCharConfig) => {
    if (generatingProfilePrompt) return;

    setGeneratingProfilePrompt(true);
    setSaveSuccessMsg('');

    try {
      const response = await fetch('/api/character-profile/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: currentProject?.id || null,
          profile_data: profileData,
          metrics: metrics,
          core_concept: newCharConfig.core_concept || 'Pixel Art Character',
          outfit_and_colors: newCharConfig.outfit_and_colors || null,
          weapons_and_props: newCharConfig.weapons_and_props || null,
          stature_rule: newCharConfig.stature_rule || 'Bằng nhân vật gốc (Tỷ lệ chuẩn)',
          target_direction: newCharConfig.target_direction || 'Sprite Sheet 3x5 (15 frames)',
          inherit_scale: newCharConfig.inherit_scale ?? true,
          inherit_style: newCharConfig.inherit_style ?? true,
          frame_actions: newCharConfig.frame_actions || null,
          compiled_positive_prompt: newCharConfig.compiled_positive_prompt || null,
          compiled_negative_prompt: newCharConfig.compiled_negative_prompt || null,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.detail || 'Lỗi khi sinh Prompt từ hồ sơ.');
      }

      const resJson = await response.json();
      setGeneratedProfilePrompt(resJson.data);
    } catch (err) {
      alert(err.message || 'Lỗi kết nối máy chủ sinh prompt.');
    } finally {
      setGeneratingProfilePrompt(false);
    }
  };

  /**
   * Lưu Bản Phân Tích & Prompt hiện tại vào cơ sở dữ liệu MySQL của dự án.
   * 
   * @param {Object} newCharData Cấu hình nhân vật mới do người dùng nhập.
   */
  const handleSavePreset = async (newCharData) => {
    if (!currentProject?.id || savingPreset) return;

    const posPrompt = newCharData.positive_prompt || generatedProfilePrompt?.positive_prompt;
    const negPrompt = newCharData.negative_prompt || generatedProfilePrompt?.negative_prompt;

    if (!posPrompt) {
      alert('Chưa có câu Prompt để lưu. Vui lòng kiểm tra lại cấu hình nhân vật.');
      return;
    }

    setSavingPreset(true);
    setSaveSuccessMsg('');

    const payload = {
      name: newCharData.name || `${newCharData.new_character_concept} (Bản lưu Studio)`,
      sprite_name: reference?.name || 'sprite_sample.png',
      metrics_data: metrics,
      profile_data: profileData,
      frame_actions_data: newCharData.frame_actions_data || profileData?.frame_actions_data || null,
      new_character_concept: newCharData.new_character_concept,
      outfit_and_colors: newCharData.outfit_and_colors,
      weapons_and_props: newCharData.weapons_and_props,
      stature_rule: newCharData.stature_rule,
      target_direction: newCharData.target_direction,
      positive_prompt: posPrompt,
      negative_prompt: negPrompt || '',
      technical_notes: generatedProfilePrompt?.technical_notes || 'Bản lưu ma trận 15 frame Sprite Sheet 3x5',
    };

    try {
      const response = await fetch(`/api/projects/${currentProject.id}/character-presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Không thể lưu bản ghi vào MySQL.');
      }

      setSaveSuccessMsg('Đã lưu thành công vào Hồ sơ Dự án trong MySQL!');
      setTimeout(() => setSaveSuccessMsg(''), 4000);
    } catch (err) {
      alert(err.message || 'Lỗi khi lưu hồ sơ vào dự án.');
    } finally {
      setSavingPreset(false);
    }
  };

  // Trạng thái đã có dữ liệu của 3 phân hệ tra cứu
  const tabStatuses = {
    global: Boolean(profileData.global_analysis),
    directions: Boolean(profileData.direction_analysis),
    animations: Boolean(profileData.animation_analysis),
  };

  const palette = profileData.palette_metrics || profileData.global_analysis?.palette_metrics;
  const pixelReport = profileData.pixel_art_report;
  const referenceStyle = profileData.reference_style;
  const providerLabel = { gemini: 'Gemini', openai: 'OpenAI' }[visionProvider] || 'AI';
  const resultProviderLabel = referenceStyle?.provider === 'openai' ? 'OpenAI' : 'Gemini';
  const pythonMeasurements = collectPythonMeasurements({ palette, pixelReport, metrics, profileData });
  const progress = [
    localAction === 'colors' && 'Đang phân tích màu bằng Python…',
    localAction === 'size' && 'Đang đo kích thước bằng Python…',
    isGeneratingStyle && `Đang chờ ${providerLabel} viết chỉ dẫn phong cách…`,
  ].filter(Boolean).join(' ');

  return (
    <div className="studio-workspace-container">
      <header className="studio-header-card">
        <div className="studio-title-group">
          <h1><Sparkles size={22} /> Phân tích &amp; Prompt</h1>
          <p className="studio-source-name">{reference?.name || 'Chưa chọn ảnh sprite'}</p>
        </div>
        <label className="btn-secondary-studio studio-file-button">
          <FolderOpen size={16} /> {reference ? 'Đổi ảnh' : 'Chọn ảnh sprite'}
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleReferenceChange} disabled={Boolean(progress)} />
        </label>
      </header>
      <div className="studio-scan-status" role="status" aria-live="polite">
        {progress && <><LoaderCircle size={16} className="spin" /> {progress}</>}
      </div>

      <nav className="studio-segmented-switch studio-workspace-nav" aria-label="Khu vực làm việc">
        {[
          ['reference', 'Đo sprite', Ruler],
          ['dna_profile', 'Hồ sơ mẫu', Dna],
          ['prompt_studio', 'Sinh Prompt', Wand2],
        ].map(([mode, label, Icon]) => (
          <button
            key={mode}
            type="button"
            className={`studio-segment-btn ${workspaceMode === mode ? 'active' : ''}`}
            aria-pressed={workspaceMode === mode}
            onClick={() => setWorkspaceMode(mode)}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </nav>

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
          onManualReport={(report) => setProfileData((previous) => ({
            ...previous,
            manual_region_measurements: report,
          }))}
          pixelReport={pixelReport}
          palette={palette}
          analysisError={analysisError}
          colorError={colorError}
          onOpenPrompt={() => setWorkspaceMode('prompt_studio')}
        />
      )}

      <div hidden={workspaceMode !== 'prompt_studio'}>
        <TabConstraintsPromptView
          consistency={profileData.consistency_analysis}
          negativeConstraints={profileData.negative_constraints}
          fullProfile={profileData}
          measuredGeometry={metrics}
          onGeneratePrompt={handleGeneratePromptFromProfile}
          generatingPrompt={generatingProfilePrompt}
          generatedPromptResult={generatedProfilePrompt}
          onSavePreset={handleSavePreset}
          savingPreset={savingPreset}
          saveSuccessMsg={saveSuccessMsg}
          initialConfig={loadedPresetConfig}
          onSendPromptToImageGen={onSendPromptToImageGen}
        />
      </div>

      {workspaceMode === 'dna_profile' && (
        <div className="studio-column-right">
          <section className="studio-metric-card" aria-busy={isGeneratingStyle}>
            <div className="studio-measure-heading">
              <h2>Prompt phong cách từ ảnh mẫu</h2>
              <button
                type="button"
                className="btn-primary-studio"
                disabled={!reference || visionStatus !== 'ready' || isGeneratingStyle || Boolean(localAction)}
                onClick={handleGenerateReferenceStyle}
              >
                {isGeneratingStyle ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
                {isGeneratingStyle ? 'Đang phân tích phong cách…' : `Tạo prompt phong cách bằng ${providerLabel}`}
              </button>
            </div>
            <p className="studio-reference-meta">
              Khi bấm tạo, app gửi ảnh và các số đo Python đang có tới {providerLabel} để viết chỉ dẫn vẽ dùng lại được.
            </p>
            {reference && Object.keys(pythonMeasurements).length === 0 && (
              <p className="studio-reference-meta">Chưa có số đo. Bạn có thể đo sprite trước để bổ sung dữ liệu.</p>
            )}
            {visionStatus !== 'ready' && (
              <p className="studio-reference-meta">
                {visionStatus === 'checking' && 'Đang kiểm tra cấu hình AI…'}
                {visionStatus === 'missing' && `Chưa cấu hình khóa ${providerLabel} cho dự án.`}
                {visionStatus === 'error' && 'Không đọc được cấu hình AI. Hãy mở lại tab để thử lại.'}
              </p>
            )}
            {profileError && <p className="studio-reference-error" role="alert">{profileError}</p>}
          </section>

          {referenceStyle?.style_prompt && (
            <section className="studio-metric-card">
              <div className="studio-measure-heading">
                <h2>Chỉ dẫn vẽ từ {resultProviderLabel}</h2>
                <button className="btn-secondary-studio" type="button" onClick={() => setWorkspaceMode('prompt_studio')}>
                  <Wand2 size={16} /> Mở Sinh Prompt
                </button>
              </div>
              <p className="studio-style-prompt-text">{referenceStyle.style_prompt}</p>
              {referenceStyle.observations?.length > 0 && (
                <details className="studio-measure-details">
                  <summary>{resultProviderLabel} quan sát được gì?</summary>
                  <ul className="studio-style-observations">
                    {referenceStyle.observations.map((item, index) => <li key={index}>{item}</li>)}
                  </ul>
                </details>
              )}
            </section>
          )}

          {Object.values(tabStatuses).some(Boolean) && (
            <details className="studio-metric-card studio-measure-details">
              <summary>Hồ sơ chi tiết đã lưu</summary>
              <CharacterProfileTabs
                activeTab={activeProfileTab}
                onSelectTab={setActiveProfileTab}
                tabStatuses={tabStatuses}
              />
              {activeProfileTab === 'global' && <TabGlobalView data={profileData.global_analysis} showPalette={false} />}
              {activeProfileTab === 'directions' && <TabDirectionsView data={profileData.direction_analysis} />}
              {activeProfileTab === 'animations' && <TabAnimationsView data={profileData.animation_analysis} />}
            </details>
          )}
        </div>
      )}
    </div>
  );
}
