// 1. THƯ VIỆN NỀN TẢNG (Quản lý phiên làm việc React)
import { useState, useEffect, useRef } from "react";

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Dữ liệu và yêu cầu của tính năng)
import { requestAnalysis } from './analysisApi';
// Ảnh tham chiếu được khôi phục thành File khi mở lại hồ sơ đã lưu.
import { restorePresetReference } from './presetReferenceImage';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)

/** Sở hữu trạng thái và thao tác của phiên đo đạc Python hiện tại. */
export function useAnalysisSession({ loadedPresetData }) {
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

  const [profileData, setProfileData] = useState({
    palette_metrics: null,
    pixel_art_report: null,
    region_measurements: null,
    manual_region_measurements: null,
  });

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
      setColorError('');
      try {
        setReference(restorePresetReference(loadedPresetData.reference_image, loadedPresetData.sprite_name || 'sprite_sample.png'));
      } catch (error) {
        setColorError(error.message);
      }
      setMetrics(loadedPresetData.metrics_data || null);
      const savedProfile = loadedPresetData.profile_data || {};
      setProfileData({
        ...savedProfile,
        palette_metrics: savedProfile.palette_metrics || savedProfile.global_analysis?.palette_metrics,
        pixel_art_report: savedProfile.pixel_art_report || savedProfile.global_analysis?.pixel_art_report,
      });
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
        palette_metrics: null,
        pixel_art_report: null,
        region_measurements: null,
        manual_region_measurements: null,
      });
    }
    event.target.value = '';
  };

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

  const palette = profileData.palette_metrics;
  const pixelReport = profileData.pixel_art_report;
  const progress = localAction === 'colors' ? 'Đang phân tích màu bằng Python…' : '';

  return {
    reference,
    referenceSize,
    metrics,
    colorError,
    localAction,
    profileData,
    setProfileData,
    handleReferenceChange,
    handleLocalMeasure,
    palette,
    pixelReport,
    progress,
  };
}
