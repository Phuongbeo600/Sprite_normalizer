// 1. THƯ VIỆN NỀN TẢNG (Phiên tạo ảnh và đồng bộ prompt)
import { useState, useEffect } from 'react';

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Giao tiếp backend)
import { requestImageGenerationStatus, requestGenerateImages } from './imageGenerationApi';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)

/** Giữ trạng thái form, yêu cầu tạo ảnh và bộ sưu tập cùng phiên hiện tại. */
export function useImageGeneration({ currentProject, incomingPrompt, incomingNegativePrompt, incomingImage }) {
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

  // Trạng thái sinh ảnh
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Danh sách ảnh kết quả trong phiên làm việc
  const [generatedGallery, setGeneratedGallery] = useState([]);
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

  // Tải ảnh mẫu trực tiếp từ máy tính lên
  const handleUploadReferenceImage = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      convertFileToDataUrl(file)
        .then((dataUrl) => {
          setReferenceImage(dataUrl);
          setReferenceImageName(file.name);
        })
        .catch((err) => {
          setErrorMsg('Không thể đọc tệp ảnh mẫu tải lên.');
        });
    }
  };

  // Xóa ảnh mẫu tham chiếu nếu chỉ muốn tạo ảnh từ văn bản thuần túy
  const handleClearReferenceImage = () => {
    setReferenceImage(null);
    setReferenceImageName('');
  };

  // Kiểm tra cấu hình API hiện hành (hoàn toàn ngoại tuyến, không tốn token)
  const fetchApiStatus = async () => {
    setCheckingConfig(true);
    setConfigStatus(null);
    setErrorMsg('');
    try {
      const resp = await requestImageGenerationStatus(currentProject?.id);
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.detail || `Không đọc được cấu hình tạo ảnh (HTTP ${resp.status}).`);
      }
      const data = await resp.json();
      setConfigStatus(data);
    } catch (e) {
      setErrorMsg(e.message || 'Không thể kiểm tra cấu hình API tạo ảnh.');
    } finally {
      setCheckingConfig(false);
    }
  };

  useEffect(() => {
    fetchApiStatus();
  }, [currentProject?.id]);

  /**
   * Thêm từ khóa phong cách gợi ý vào prompt
   * @param {string} tagText Chuỗi từ khóa phong cách
   */
  const handleApplyStyleTag = (tagText) => {
    setPrompt((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return tagText;
      if (trimmed.includes(tagText)) return trimmed;
      return `${trimmed}, ${tagText}`;
    });
  };

  /**
   * Gửi yêu cầu sinh ảnh tới backend (Chỉ kích hoạt khi người dùng bấm nút)
   */
  const handleGenerateImage = async () => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt) {
      setErrorMsg('Vui lòng nhập mô tả nhân vật hoặc sprite trước khi bắt đầu tạo ảnh.');
      return;
    }

    setGenerating(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        prompt: cleanPrompt,
        negative_prompt: negativePrompt.trim() || null,
        project_id: currentProject?.id || null,
        aspect_ratio: '1:1',
        number_of_images: 1,
        style_preset: selectedPreset || null,
        image: referenceImage || null
      };

      const resp = await requestGenerateImages(payload);

      const resData = await resp.json();

      if (!resp.ok) {
        throw new Error(resData?.detail || 'Không thể tạo ảnh từ mô hình AI. Vui lòng kiểm tra lại cấu hình.');
      }

      const newImages = resData.images || [];
      if (newImages.length === 0) {
        throw new Error('API đã phản hồi nhưng không nhận được ảnh hợp lệ.');
      }

      // Đưa các ảnh mới lên đầu bộ sưu tập
      setGeneratedGallery((prev) => [...newImages, ...prev]);
      setSuccessMsg(`Tạo thành công ${newImages.length} ảnh bằng ${resData.provider_used === 'gemini' ? 'Google Imagen 3' : 'OpenAI DALL-E'}!`);
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi gọi API tạo ảnh.');
    } finally {
      setGenerating(false);
    }
  };

  return {
    configStatus,
    checkingConfig,
    prompt,
    setPrompt,
    negativePrompt,
    setNegativePrompt,
    referenceImage,
    setReferenceImage,
    referenceImageName,
    handleUploadReferenceImage,
    handleClearReferenceImage,
    generating,
    errorMsg,
    successMsg,
    generatedGallery,
    setGeneratedGallery,
    modalImage,
    setModalImage,
    handleApplyStyleTag,
    handleGenerateImage
  };
}
