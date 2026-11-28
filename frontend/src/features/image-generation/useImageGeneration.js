// 1. THƯ VIỆN NỀN TẢNG (Phiên tạo ảnh và đồng bộ prompt)
import { useState, useEffect, useRef } from 'react';

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Giao tiếp backend & hook dịch 2 chiều)
import { requestImageGenerationStatus, requestGenerateImages } from './imageGenerationApi';
import {
  useBidirectionalTranslation,
  resolveEnglishPromptFromCache,
  VIETNAMESE_CHAR_PATTERN,
} from './useBidirectionalTranslation';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)

/** Giữ trạng thái form, yêu cầu tạo ảnh và bộ sưu tập cùng phiên hiện tại. */
export function useImageGeneration({
  currentProject,
  incomingPrompt,
  incomingNegativePrompt,
  incomingImage,
  incomingAnatomyData,
}) {
  // Trạng thái cấu hình API Key đọc từ hệ thống (0 Token)
  const [configStatus, setConfigStatus] = useState(null); // Biến nhận trạng thái xem đã có api key chưa
  const [checkingConfig, setCheckingConfig] = useState(true); // Cờ báo hiệu đang hỏi backend

  // Form nhập liệu
  const [prompt, setPrompt] = useState(incomingPrompt || '');
  const [negativePrompt, setNegativePrompt] = useState(incomingNegativePrompt || '');
  const [selectedPreset, setSelectedPreset] = useState('');

  // Ảnh mẫu tham chiếu (dạng Base64 Data URL để gửi kèm prompt cho AI)
  const [referenceImage, setReferenceImage] = useState(null);
  const [referenceImageName, setReferenceImageName] = useState('');
  // Số đo giải phẫu đồng bộ từ Tab Phân tích (nếu người dùng đã đo thủ công hoặc tự động)
  const [anatomyData, setAnatomyData] = useState(incomingAnatomyData || null);

  // Trạng thái sinh ảnh
  const [generating, setGenerating] = useState(false);
  const generationRequest = useRef(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Danh sách ảnh kết quả trong phiên làm việc
  const [generatedGallery, setGeneratedGallery] = useState([]);
  // Khung kết quả chỉ tự phủ form sau một yêu cầu tạo ảnh thành công.
  const [resultExpanded, setResultExpanded] = useState(false);
  // Xem chi tiết ảnh phóng to
  const [modalImage, setModalImage] = useState(null);

  // Chuyển đổi đối tượng File hoặc Blob sang chuỗi Base64 Data URL
  const convertFileToDataUrl = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  /** Đọc độ phân giải pixel thật (width × height) của chuỗi Data URL ảnh mẫu (chỉ chạy trên trình duyệt). */
  const readDataUrlDimensions = (dataUrl) => {
    if (typeof Image === 'undefined' || !dataUrl) return Promise.resolve(null);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve(img.naturalWidth > 0 && img.naturalHeight > 0 ? [img.naturalWidth, img.naturalHeight] : null);
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  };

  // Đồng bộ ảnh mẫu tham chiếu nếu được chuyển từ Studio sang
  useEffect(() => {
    if (incomingImage) {
      if (typeof incomingImage === 'string') {
        setReferenceImage(incomingImage);
        setReferenceImageName('Ảnh sprite mẫu từ Studio');
      } else if (incomingImage instanceof File || incomingImage instanceof Blob) {
        convertFileToDataUrl(incomingImage)
          .then((dataUrl) => {
            setReferenceImage(dataUrl);
            setReferenceImageName(incomingImage.name || 'Ảnh sprite mẫu tham chiếu');
          })
          .catch((err) => console.warn('Lỗi đọc ảnh mẫu tham chiếu:', err));
      }
    }
  }, [incomingImage]);

  // Cập nhật prompt nếu có dữ liệu chuyển từ tab Phân tích sang
  useEffect(() => {
    if (incomingPrompt && incomingPrompt.trim()) {
      setPrompt(incomingPrompt.trim());
    }
  }, [incomingPrompt]);

  // Cập nhật lệnh cấm (negative prompt) nếu có dữ liệu chuyển sang
  useEffect(() => {
    if (incomingNegativePrompt && incomingNegativePrompt.trim()) {
      setNegativePrompt(incomingNegativePrompt.trim());
    }
  }, [incomingNegativePrompt]);

  // Đồng bộ số đo giải phẫu khi chuyển từ Tab Phân tích sang
  useEffect(() => {
    setAnatomyData(incomingAnatomyData || null);
  }, [incomingAnatomyData]);

  // Tải ảnh mẫu trực tiếp từ máy tính lên
  const handleUploadReferenceImage = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      convertFileToDataUrl(file)
        .then(async (dataUrl) => {
          setReferenceImage(dataUrl);
          setReferenceImageName(file.name);
          const dims = await readDataUrlDimensions(dataUrl);
          setAnatomyData(dims ? { native_size_wh: dims } : null);
        })
        .catch(() => {
          setErrorMsg('Không thể đọc tệp ảnh mẫu tải lên.');
        });
    }
  };

  // Xóa ảnh mẫu tham chiếu nếu chỉ muốn tạo ảnh từ văn bản thuần túy
  const handleClearReferenceImage = () => {
    setReferenceImage(null);
    setReferenceImageName('');
    setAnatomyData(null);
  };

  // Kiểm tra cấu hình API hiện hành (hoàn toàn ngoại tuyến, không tốn token)
  const fetchApiStatus = async (signal) => {
    setCheckingConfig(true);
    setConfigStatus(null);
    setErrorMsg('');
    try {
      const data = await requestImageGenerationStatus(currentProject?.id, { signal });
      if (signal.aborted) return;
      setConfigStatus(data);
    } catch (e) {
      if (!signal.aborted) setErrorMsg(e.message || 'Không thể kiểm tra cấu hình API tạo ảnh.');
    } finally {
      if (!signal.aborted) setCheckingConfig(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    setGenerating(false);
    setResultExpanded(false);
    fetchApiStatus(controller.signal);
    return () => {
      controller.abort();
      generationRequest.current?.abort();
      generationRequest.current = null;
    };
  }, [currentProject?.id]);

  /**
   * Gửi yêu cầu sinh ảnh tới backend (Chỉ kích hoạt khi người dùng bấm nút)
   */
  const handleGenerateImage = async () => {
    if (generationRequest.current) return;
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      setErrorMsg('Vui lòng nhập mô tả nhân vật hoặc sprite trước khi bắt đầu tạo ảnh.');
      return;
    }

    const controller = new AbortController();
    generationRequest.current = controller;
    setResultExpanded(false);
    setGenerating(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Ưu tiên lấy bản tiếng Anh sẵn trong RAM (nếu người dùng đang để tiếng Việt đọc trên UI)
      const promptForTemplate = resolveEnglishPromptFromCache(cleanPrompt);
      const payload = {
        prompt: promptForTemplate,
        negative_prompt: negativePrompt.trim() || null,
        project_id: currentProject?.id || null,
        aspect_ratio: '1:1',
        number_of_images: 1,
        style_preset: selectedPreset || null,
        image: referenceImage || null,
        native_size_wh: anatomyData?.native_size_wh || null,
        metrics: anatomyData?.metrics || null,
        region_measurements: anatomyData?.region_measurements || null,
        manual_region_measurements: anatomyData?.manual_region_measurements || null,
        color_count: anatomyData?.color_count || null,
      };

      const resData = await requestGenerateImages(payload, { signal: controller.signal });
      if (controller.signal.aborted) return;
      const newImages = resData.images;
      if (!Array.isArray(newImages) || !newImages.length || newImages.some((item) =>
        !item || !item.id || typeof item.data_url !== 'string' || !item.data_url.startsWith('data:image/'))) {
        throw new Error('API phản hồi nhưng không nhận được ảnh hợp lệ; dữ liệu kết quả không hợp lệ.');
      }

      // Đưa các ảnh mới lên đầu bộ sưu tập
      setGeneratedGallery((prev) => [...newImages, ...prev]);
      setResultExpanded(true);
      const savedCount = newImages.filter((item) => item.saved_to_project).length;
      const providerLabel = `${resData.provider_used || configStatus?.provider || 'Provider chưa xác định'} / ${resData.model_used || configStatus?.model || 'Model chưa xác định'}`;
      setSuccessMsg(
        savedCount > 0
          ? `Tạo thành công ${newImages.length} ảnh bằng ${providerLabel} và đã lưu vào Kho Tài Nguyên Dự Án (MySQL)!`
          : `Tạo thành công ${newImages.length} ảnh bằng ${providerLabel}!`
      );
    } catch (err) {
      if (generationRequest.current === controller && err.name !== 'AbortError') {
        setErrorMsg(err.message || 'Lỗi khi gọi API tạo ảnh.');
      }
    } finally {
      if (generationRequest.current === controller) {
        generationRequest.current = null;
        setGenerating(false);
      }
    }
  };

  const {
    translateTargetLang,
    translatingDirection,
    resetTargetLang,
    handleToggleTranslate,
  } = useBidirectionalTranslation({
    text: prompt,
    onTextChange: setPrompt,
    defaultTargetLang: 'en',
    onError: setErrorMsg,
  });

  /** Cập nhật nội dung prompt khi người dùng gõ hoặc xóa; tự đặt lại về 'en' nếu là tiếng Việt hoặc rỗng. */
  const handlePromptChange = (nextValue) => {
    setPrompt(nextValue);
    if (!nextValue || !nextValue.trim() || VIETNAMESE_CHAR_PATTERN.test(nextValue)) {
      resetTargetLang('en');
    }
  };

  /** Áp dụng gợi ý từ AI Local vào ô prompt và chọn sẵn hướng dịch phù hợp với ngôn ngữ của gợi ý. */
  const handleApplyEnhancerSuggestion = (suggestedText) => {
    setPrompt(suggestedText);
    resetTargetLang(VIETNAMESE_CHAR_PATTERN.test(suggestedText) ? 'en' : 'vi');
  };

  return {
    configStatus,
    checkingConfig,
    prompt,
    setPrompt,
    handlePromptChange,
    handleApplyEnhancerSuggestion,
    negativePrompt,
    setNegativePrompt,
    referenceImage,
    setReferenceImage,
    referenceImageName,
    handleUploadReferenceImage,
    handleClearReferenceImage,
    generating,
    translateTargetLang,
    translatingDirection,
    errorMsg,
    successMsg,
    generatedGallery,
    setGeneratedGallery,
    resultExpanded,
    setResultExpanded,
    modalImage,
    setModalImage,
    handleGenerateImage,
    handleToggleTranslate
  };
}
