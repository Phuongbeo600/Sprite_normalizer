// 1. THƯ VIỆN NỀN TẢNG (Quản lý phiên làm việc React)
import { useState, useEffect, useRef } from "react";

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Dữ liệu và yêu cầu của tính năng)
import { requestAnalysis, requestSavePreset, requestVisionStatus } from './analysisApi';
import { collectPythonMeasurements } from './collectPythonMeasurements';
import { buildPresetPayload } from './presetPayload';
// Ảnh tham chiếu được mã hóa để lưu MySQL và khôi phục thành File khi mở lại hồ sơ.
import { encodePresetReference, restorePresetReference } from './presetReferenceImage';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)

/** Sở hữu trạng thái và thao tác của phiên; giữ nguyên thứ tự hiệu ứng hiện tại. */
export function useAnalysisSession({ currentProject, loadedPresetData, isActive }) {
  // ========================================================
  // TRẠNG THÁI ẢNH THAM CHIẾU & ĐO ĐẠC MÀU SẮC
  // ========================================================
  const [reference, setReference] = useState(null);
  const [referenceSize, setReferenceSize] = useState(null);
  const referenceVersion = useRef(0);

  // Trạng thái dữ liệu đo đạc giải phẫu hình học (CharacterMetrics khi nạp từ preset)
  const [metrics, setMetrics] = useState(null);
  const [colorError, setColorError] = useState('');
  const [localAction, setLocalAction] = useState(null);

  // ========================================================
  // TRẠNG THÁI ĐIỀU HƯỚNG WORKSPACE STUDIO TINH GỌN
  // ========================================================
  const [workspaceMode, setWorkspaceMode] = useState('reference');

  // ========================================================
  // TRẠNG THÁI HỒ SƠ NHÂN VẬT THAM CHIẾU (CHARACTER PROFILE)
  // ========================================================
  const [activeProfileTab, setActiveProfileTab] = useState('global');
  const [profileData, setProfileData] = useState({
    global_analysis: null,
    direction_analysis: null,
    animation_analysis: null,
    consistency_analysis: null,
    negative_constraints: null,
  });
  const [visionStatus, setVisionStatus] = useState('checking');
  const [visionError, setVisionError] = useState('');
  const [visionProvider, setVisionProvider] = useState(null);
  const [isGeneratingStyle, setIsGeneratingStyle] = useState(false);
  const [profileError, setProfileError] = useState('');

  // ========================================================
  // TRẠNG THÁI BỘ MÁY SINH PROMPT & LƯU PRESET VÀO MYSQL
  // ========================================================
  const [generatedProfilePrompt, setGeneratedProfilePrompt] = useState(null);
  const [savingPreset, setSavingPreset] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [loadedPresetConfig, setLoadedPresetConfig] = useState(null);

  // Dọn dẹp bộ nhớ URL tạm và tự động đọc kích thước pixel gốc (W × H) của ảnh mẫu
  useEffect(() => {
    if (!reference?.url) {
      setReferenceSize(null);
      return undefined;
    }
    let cancelled = false;
    let preview = null;
    if (typeof Image !== 'undefined') {
      preview = new Image();
      preview.onload = () => {
        if (!cancelled && preview.naturalWidth > 0 && preview.naturalHeight > 0) {
          setReferenceSize([preview.naturalWidth, preview.naturalHeight]);
        }
      };
      preview.onerror = () => {
        if (!cancelled) setReferenceSize(null);
      };
      preview.src = reference.url;
    }
    return () => {
      cancelled = true;
      if (preview) {
        preview.onload = null;
        preview.onerror = null;
      }
      URL.revokeObjectURL(reference.url);
    };
  }, [reference]);

  // Nạp dữ liệu khi người dùng bấm "Mở lại trong Studio" từ trang Hồ sơ đã lưu
  useEffect(() => {
    if (loadedPresetData) {
      referenceVersion.current += 1;
      setReference(null);
      setLocalAction(null);
      setIsGeneratingStyle(false);
      setColorError('');
      setProfileError('');
      try {
        setReference(restorePresetReference(loadedPresetData.reference_image, loadedPresetData.sprite_name || 'sprite_sample.png'));
      } catch (error) {
        setProfileError(error.message);
      }
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
        url: URL.createObjectURL(file),// tạo một đường dẫn từ file nhị phân được lưu trong ram
      });
      setMetrics(null);
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

  // Chỉ đọc trạng thái cấu hình của dự án khi mở Hồ sơ mẫu
  const projectId = currentProject?.id;
  useEffect(() => {
    if (!isActive || workspaceMode !== 'dna_profile') return;
    const controller = new AbortController();
    const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
    setVisionStatus('checking');
    setVisionError('');
    requestVisionStatus(query, controller.signal)
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.detail || `Không đọc được cấu hình AI (HTTP ${response.status}).`);
        }
        const data = await response.json();
        if (!controller.signal.aborted) {
          setVisionProvider(data.provider);
          setVisionStatus(data.ready ? 'ready' : 'missing');
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setVisionStatus('error');
          setVisionError(error.message || 'Không kết nối được máy chủ. Hãy kiểm tra kết nối mạng.');
        }
      });
    return () => controller.abort();
  }, [isActive, workspaceMode, projectId]);

  /**
   * Chạy phân tích bảng màu cục bộ bằng thuật toán Python.
   * 
   * @param {'colors'} [action='colors'] Phép đo Python được yêu cầu.
   */
  const handleLocalMeasure = async (action = 'colors') => {
    if (!reference || localAction || action !== 'colors') return; //reference là biến lưu nạp ảnh , localAction lưu trạng thái đo đạc hiện tại
    const version = referenceVersion.current; // kiểm tra xem nếu người dùng đột ngột huỷ ảnh đang nạp mà nạp ảnh khác thì tính lại
    setLocalAction('colors');// đánh dấu trên màn hình là đang làm
    setColorError('');
    try {
      const result = await requestAnalysis(reference.file, '/api/analyze-colors');
      if (version !== referenceVersion.current) return;
      setProfileData((previous) => ({ ...previous, ...result }));
    } catch (error) {
      if (version === referenceVersion.current) setColorError(error.message);
    } finally {
      if (version === referenceVersion.current) setLocalAction(null);
    }
  };

  /**
   * Gửi ảnh và số đo đến nhà cung cấp AI đã cấu hình cho dự án.
   */
  const handleGenerateReferenceStyle = async () => {
    if (!reference || isGeneratingStyle || localAction || visionStatus !== 'ready') return;
    const version = referenceVersion.current;
    setIsGeneratingStyle(true);
    setProfileError('');
    try {
      const fields = { python_metrics_json: JSON.stringify(pythonMeasurements) };
      if (projectId) fields.project_id = projectId;
      const result = await requestAnalysis(reference.file, '/api/character-profile/style-prompt', fields);
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
   * Sinh Prompt AI tối ưu cho Nhân vật Mới (Tự do sáng tạo).
   * 
   * @param {Object} newCharConfig Thông số cấu hình nhân vật mới do người dùng nhập.
   */
  // NOTE: Giao diện hiện biên dịch prompt trực tiếp bằng promptCompiler; không còn callback gửi yêu cầu tại đây.

  /**
   * Lưu Bản Phân Tích & Prompt hiện tại vào cơ sở dữ liệu MySQL của dự án.
   * 
   * @param {Object} newCharData Cấu hình nhân vật mới do người dùng nhập.
   */
  const handleSavePreset = async (newCharData) => {
    if (!currentProject?.id || savingPreset) return;

    const posPrompt = newCharData.positive_prompt || generatedProfilePrompt?.positive_prompt;

    if (!posPrompt) {
      alert('Chưa có câu Prompt để lưu. Vui lòng kiểm tra lại cấu hình nhân vật.');
      return;
    }

    setSavingPreset(true);
    setSaveSuccessMsg('');

    try {
      const referenceImage = await encodePresetReference(reference);
      const payload = buildPresetPayload({ newCharData, reference, metrics, profileData, generatedProfilePrompt, referenceImage });
      const response = await requestSavePreset(currentProject.id, payload);

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
    isGeneratingStyle && `Đang chờ ${providerLabel} viết chỉ dẫn phong cách…`,
  ].filter(Boolean).join(' ');

  // Kiểm tra người dùng đã hoàn thành đo đạc ở Tab 1 (hoặc đã nạp preset có sẵn từ MySQL) hay chưa
  const hasMeasured = Boolean(
    metrics ||
    loadedPresetConfig ||
    (palette && palette.total_colors > 0) ||
    (profileData?.region_measurements && Object.keys(profileData.region_measurements?.measurements || {}).length > 0) ||
    (profileData?.manual_region_measurements && Object.keys(profileData.manual_region_measurements?.measurements || {}).length > 0)
  );

  return { reference, referenceSize, metrics, colorError, localAction, workspaceMode, setWorkspaceMode, activeProfileTab, setActiveProfileTab, profileData, setProfileData, visionStatus, visionError, isGeneratingStyle, profileError, generatedProfilePrompt, savingPreset, saveSuccessMsg, loadedPresetConfig, handleReferenceChange, handleLocalMeasure, handleGenerateReferenceStyle, handleSavePreset, tabStatuses, palette, pixelReport, referenceStyle, providerLabel, resultProviderLabel, pythonMeasurements, progress, hasMeasured };
}
