// 1. THƯ VIỆN NỀN TẢNG (Phiên tạo ảnh và đồng bộ prompt)
import { useState, useEffect } from 'react';

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Giao tiếp backend)
import { requestImageGenerationStatus, requestGenerateImages } from './imageGenerationApi';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)

/** Giữ trạng thái form, yêu cầu tạo ảnh và bộ sưu tập cùng phiên hiện tại. */
export function useImageGeneration({ currentProject, incomingPrompt, incomingNegativePrompt }) {
  // Trạng thái cấu hình API Key đọc từ hệ thống (0 Token)
  const [configStatus, setConfigStatus] = useState(null); // Biến nhận trạng thái xem đã có api key chưa
  const [checkingConfig, setCheckingConfig] = useState(true); // Cờ báo hiệu đang hỏi backend

  // Form nhập liệu
  const [prompt, setPrompt] = useState(incomingPrompt || '');
  const [negativePrompt, setNegativePrompt] = useState(incomingNegativePrompt || '');
  const [selectedPreset, setSelectedPreset] = useState('');

  // Trạng thái sinh ảnh
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Danh sách ảnh kết quả trong phiên làm việc
  const [generatedGallery, setGeneratedGallery] = useState([]);
  // Xem chi tiết ảnh phóng to
  const [modalImage, setModalImage] = useState(null);

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

  // Kiểm tra cấu hình API hiện hành (hoàn toàn ngoại tuyến, không tốn token)
  const fetchApiStatus = async () => {
    setCheckingConfig(true);
    try {
      const resp = await requestImageGenerationStatus(currentProject?.id);
      if (resp.ok) {
        const data = await resp.json();
        setConfigStatus(data);
      }
    } catch (e) {
      console.warn('Không thể kiểm tra cấu hình API tạo ảnh:', e);
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
        style_preset: selectedPreset || null
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

  return { configStatus, checkingConfig, prompt, setPrompt, negativePrompt, setNegativePrompt, generating, errorMsg, successMsg, generatedGallery, setGeneratedGallery, modalImage, setModalImage, handleApplyStyleTag, handleGenerateImage };
}
