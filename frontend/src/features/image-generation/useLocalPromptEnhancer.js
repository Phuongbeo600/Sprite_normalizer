// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý trạng thái & tham chiếu hủy luồng)
// ========================================================
import { useState, useEffect, useRef } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// (Không có phụ thuộc bên ngoài)

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (API giao tiếp AI Local cổng 8080)
// ========================================================
// Các hàm kiểm tra, bật/tắt server và đọc luồng SSE gợi ý prompt
import {
  requestLocalEnhancerStatus,
  requestStartLocalEnhancer,
  requestStopLocalEnhancer,
  streamEnhancePromptApi,
} from './imageGenerationApi';
import { useBidirectionalTranslation } from './useBidirectionalTranslation';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & CẤU HÌNH (Stylesheets / Config)
// ========================================================
// (Không áp dụng cho custom hook)

/**
 * Custom Hook quản lý công tắc Bật/Tắt AI Local (cổng 8080)
 * và luồng phát gợi ý nâng cao mô tả nhân vật theo thời gian thực qua SSE.
 *
 * @returns {Object} Trạng thái AI Local, nội dung gợi ý SSE và các hàm điều khiển.
 */
export function useLocalPromptEnhancer() {
  const [enhancerStatus, setEnhancerStatus] = useState({
    running: false,
    ready: false,
    managed_by_backend: false,
    port: 8080,
    model_name: 'Hunyuan PromptEnhancer 7B (Q4_K_M)',
    message: 'AI Local đang tắt (tiết kiệm RAM).',
  });
  const [togglingEnhancer, setTogglingEnhancer] = useState(false);
  const [toggleAction, setToggleAction] = useState('');
  const [enhancing, setEnhancing] = useState(false);
  const [enhancePhase, setEnhancePhase] = useState('');
  const [enhancePhaseMsg, setEnhancePhaseMsg] = useState('');
  const [suggestionText, setSuggestionText] = useState('');
  const [enhanceError, setEnhanceError] = useState('');

  const streamControllerRef = useRef(null);

  const {
    translateTargetLang: suggestionTranslateTargetLang,
    translatingDirection: translatingSuggestionDirection,
    resetTargetLang: resetSuggestionTargetLang,
    handleToggleTranslate: handleToggleTranslateSuggestion,
  } = useBidirectionalTranslation({
    text: suggestionText,
    onTextChange: setSuggestionText,
    defaultTargetLang: 'vi',
    onError: setEnhanceError,
  });

  /** Làm mới trạng thái bật/tắt thực tế của AI Local từ Backend. */
  const refreshEnhancerStatus = async (signal) => {
    try {
      const data = await requestLocalEnhancerStatus({ signal });
      if (!signal?.aborted) setEnhancerStatus(data);
    } catch {
      // Bỏ qua lỗi khi hủy request lúc đóng component
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    refreshEnhancerStatus(controller.signal);
    return () => {
      controller.abort();
      streamControllerRef.current?.abort();
      streamControllerRef.current = null;
    };
  }, []);

  /** Dừng luồng SSE gợi ý đang chạy (nếu có). */
  const handleStopEnhancing = () => {
    if (streamControllerRef.current) {
      streamControllerRef.current.abort();
      streamControllerRef.current = null;
    }
    setEnhancing(false);
    setEnhancePhase('');
    setEnhancePhaseMsg('');
  };

  /** Bật hoặc tắt tiến trình llama-server cổng 8080 để chủ động tiết kiệm RAM. */
  const handleToggleEnhancer = async () => {
    if (togglingEnhancer) return;
    setTogglingEnhancer(true);
    setEnhanceError('');

    try {
      if (enhancerStatus.running) {
        setToggleAction('stopping');
        if (enhancing) handleStopEnhancing();
        const nextStatus = await requestStopLocalEnhancer();
        setEnhancerStatus(nextStatus);
      } else {
        setToggleAction('starting');
        setEnhancerStatus((prev) => ({
          ...prev,
          running: true,
          ready: false,
          message: 'Đang nạp mô hình 4.3 GB vào RAM...',
        }));
        const nextStatus = await requestStartLocalEnhancer();
        setEnhancerStatus(nextStatus);
      }
    } catch (err) {
      setEnhanceError(err.message || 'Không thể thay đổi trạng thái AI Local.');
      await refreshEnhancerStatus();
    } finally {
      setTogglingEnhancer(false);
      setToggleAction('');
    }
  };

  /**
   * Kích hoạt luồng SSE nâng cao mô tả nhân vật từ chữ người dùng nhập.
   * Tự động bật cổng 8080 nếu đang tắt để tránh thao tác rườm rà.
   *
   * @param {string} rawPrompt Văn bản mô tả gốc trong ô nhập liệu.
   * @param {string|null} [stylePreset=null] Phong cách tham chiếu tùy chọn.
   */
  const handleEnhancePrompt = async (rawPrompt, stylePreset = null) => {
    const cleanPrompt = (rawPrompt || '').trim();
    if (!cleanPrompt || enhancing || togglingEnhancer) return;

    const controller = new AbortController();
    streamControllerRef.current = controller;
    setEnhancing(true);
    setEnhanceError('');
    setSuggestionText('');
    resetSuggestionTargetLang('vi');
    setEnhancePhase('connecting');
    setEnhancePhaseMsg('Đang kết nối AI Local...');

    await streamEnhancePromptApi({
      prompt: cleanPrompt,
      stylePreset,
      autoStart: true,
      signal: controller.signal,
      onStatus: (phase, message) => {
        if (streamControllerRef.current !== controller) return;
        setEnhancePhase(phase);
        setEnhancePhaseMsg(message);
        if (phase === 'loading_model') {
          setEnhancerStatus((prev) => ({ ...prev, running: true, ready: false, message }));
        } else if (phase === 'streaming') {
          setEnhancerStatus((prev) => ({ ...prev, running: true, ready: true }));
        }
      },
      onChunk: (chunkText) => {
        if (streamControllerRef.current !== controller) return;
        setSuggestionText((prev) => prev + chunkText);
      },
      onError: (errMsg) => {
        if (streamControllerRef.current !== controller) return;
        setEnhanceError(errMsg || 'Không thể nhận gợi ý từ AI Local.');
        setEnhancing(false);
        setEnhancePhase('');
        streamControllerRef.current = null;
        refreshEnhancerStatus();
      },
      onDone: () => {
        if (streamControllerRef.current !== controller) return;
        setEnhancing(false);
        setEnhancePhase('');
        setEnhancePhaseMsg('');
        streamControllerRef.current = null;
        refreshEnhancerStatus();
      },
    });
  };

  /** Đóng và xóa sạch nội dung hộp gợi ý hiện tại. */
  const handleClearSuggestion = () => {
    if (enhancing) handleStopEnhancing();
    setSuggestionText('');
    setEnhanceError('');
    setEnhancePhase('');
    setEnhancePhaseMsg('');
    resetSuggestionTargetLang('vi');
  };

  return {
    enhancerStatus,
    togglingEnhancer,
    toggleAction,
    enhancing,
    enhancePhase,
    enhancePhaseMsg,
    suggestionText,
    enhanceError,
    suggestionTranslateTargetLang,
    translatingSuggestion: Boolean(translatingSuggestionDirection),
    handleToggleEnhancer,
    handleEnhancePrompt,
    handleStopEnhancing,
    handleClearSuggestion,
    handleToggleTranslateSuggestion,
  };
}
