// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý trạng thái)
// ========================================================
import { useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// (Không có phụ thuộc bên ngoài)

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (API dịch thuật offline Backend)
// ========================================================
import { requestTranslatePrompt } from './imageGenerationApi';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & CẤU HÌNH (Bộ đệm RAM dùng chung & nhận diện tiếng Việt)
// ========================================================
export const VIETNAMESE_CHAR_PATTERN = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
const MAX_LOCAL_TRANSLATION_CACHE = 256;
// Bộ đệm RAM dùng chung giữa ô Prompt chính và hộp Gợi ý AI Local (giữ bản gốc & bản dịch 2 chiều)
const sharedTranslationCache = new Map();

/** Lưu cặp dịch vào bộ đệm RAM dùng chung theo giới hạn kích thước cố định. */
function saveSharedCacheEntry(key, value) {
  if (sharedTranslationCache.has(key)) sharedTranslationCache.delete(key);
  if (sharedTranslationCache.size >= MAX_LOCAL_TRANSLATION_CACHE) {
    const oldestKey = sharedTranslationCache.keys().next().value;
    sharedTranslationCache.delete(oldestKey);
  }
  sharedTranslationCache.set(key, value);
}

/**
 * Ưu tiên lấy bản tiếng Anh đã lưu trong RAM nếu văn bản hiện tại đang là tiếng Việt.
 * Giúp giao diện giữ nguyên ngôn ngữ người dùng đang xem mà vẫn gửi bản tiếng Anh vào template.
 *
 * @param {string} text Văn bản hiện có trong ô Prompt.
 * @returns {string} Bản tiếng Anh từ RAM (nếu đã từng dịch), hoặc nguyên bản để Backend tự xử lý.
 */
export function resolveEnglishPromptFromCache(text) {
  const cleanText = (text || '').trim();
  if (!cleanText || !VIETNAMESE_CHAR_PATTERN.test(cleanText)) {
    return cleanText;
  }
  return sharedTranslationCache.get(`vi->en:${cleanText}`) || cleanText;
}

/**
 * Custom Hook dùng chung cho nút dịch 2 chiều (EN ⇄ VI) kèm bộ đệm RAM.
 * Lưu song song cả 2 chiều (giữ nguyên câu gốc ban đầu) để đổi qua lại tức thì không cần dịch lại.
 *
 * @param {Object} params Cấu hình văn bản hiện tại, hàm cập nhật và hướng đích mặc định.
 * @returns {Object} Trạng thái hướng dịch, cờ đang dịch và hàm bật/tắt dịch.
 */
export function useBidirectionalTranslation({
  text,
  onTextChange,
  defaultTargetLang = 'en',
  onError,
}) {
  const [targetLang, setTargetLang] = useState(defaultTargetLang);
  const [translatingDirection, setTranslatingDirection] = useState('');

  /** Đổi hướng dịch tiếp theo của nút (ví dụ 'en' hoặc 'vi'). */
  const resetTargetLang = (nextLang = defaultTargetLang) => {
    setTargetLang(nextLang);
  };

  /** Thực thi dịch theo hướng hiện tại; ưu tiên đọc bản gốc/bản dịch từ RAM trước khi gọi API. */
  const handleToggleTranslate = async () => {
    const cleanText = (text || '').trim();
    if (!cleanText || translatingDirection) return;

    const currentTarget = targetLang;
    const sourceLang = currentTarget === 'en' ? 'vi' : 'en';
    const nextTarget = sourceLang;
    const cacheKey = `${sourceLang}->${currentTarget}:${cleanText}`;
    const cached = sharedTranslationCache.get(cacheKey);

    if (cached) {
      onTextChange(cached);
      setTargetLang(nextTarget);
      onError?.('');
      return;
    }

    setTranslatingDirection(`${sourceLang}->${currentTarget}`);
    onError?.('');
    try {
      const data = await requestTranslatePrompt({
        text: cleanText,
        sourceLang,
        targetLang: currentTarget,
      });
      const translated = (data?.translated_text || '').trim();
      if (!translated) {
        throw new Error('Không nhận được kết quả dịch hợp lệ.');
      }
      saveSharedCacheEntry(cacheKey, translated);
      saveSharedCacheEntry(`${currentTarget}->${sourceLang}:${translated}`, cleanText);
      onTextChange(translated);
      setTargetLang(nextTarget);
    } catch (err) {
      onError?.(err.message || 'Không thể dịch nội dung lúc này.');
    } finally {
      setTranslatingDirection('');
    }
  };

  return {
    translateTargetLang: targetLang,
    translatingDirection,
    resetTargetLang,
    handleToggleTranslate,
  };
}
