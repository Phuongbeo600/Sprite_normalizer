// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
// (Không sử dụng trong file tiện ích thuần Javascript)

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// (Không phụ thuộc thư viện bên ngoài)

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không có phụ thuộc nội bộ)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// (Không áp dụng cho file tiện ích)

// Bộ nhớ đệm tạm thời phía client để tăng tốc độ phản hồi tức thì (0ms) khi chuyển đổi qua lại
const translationCache = new Map();

/**
 * Gọi API backend dịch một đoạn văn bản đơn lẻ (EN ⇄ VI) bằng mô hình offline cục bộ.
 * 
 * @param {string} text Đoạn văn bản cần dịch.
 * @param {string} [sourceLang='en'] Ngôn ngữ nguồn ('en' hoặc 'vi').
 * @param {string} [targetLang='vi'] Ngôn ngữ đích ('vi' hoặc 'en').
 * @returns {Promise<string>} Chuỗi văn bản đã dịch.
 */
export async function translateText(text, sourceLang = 'en', targetLang = 'vi') {
  if (!text || !text.trim()) return '';

  const cacheKey = `${sourceLang}->${targetLang}:${text.trim()}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text.trim(),
        source_lang: sourceLang,
        target_lang: targetLang
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Lỗi máy chủ dịch thuật`);
    }

    const data = await response.json();
    const result = data.translated_text || text;
    translationCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error('[translationApi] Lỗi dịch văn bản:', err);
    return text; // Trả về nguyên gốc nếu có lỗi để không làm gián đoạn UI
  }
}

/**
 * Gọi API backend dịch đồng loạt mảng các chuỗi văn bản (ví dụ 5 frame hoạt họa).
 * 
 * @param {string[]} texts Mảng các đoạn văn bản cần dịch.
 * @param {string} [sourceLang='en'] Ngôn ngữ nguồn ('en' hoặc 'vi').
 * @param {string} [targetLang='vi'] Ngôn ngữ đích ('vi' hoặc 'en').
 * @returns {Promise<string[]>} Mảng kết quả sau khi dịch.
 */
export async function translateBatch(texts, sourceLang = 'en', targetLang = 'vi') {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  try {
    const response = await fetch('/api/translate/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts,
        source_lang: sourceLang,
        target_lang: targetLang
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Lỗi máy chủ dịch hàng loạt`);
    }

    const data = await response.json();
    const results = data.translated_texts || texts;

    // Lưu vào bộ nhớ đệm
    texts.forEach((original, idx) => {
      const translated = results[idx] || original;
      translationCache.set(`${sourceLang}->${targetLang}:${original.trim()}`, translated);
    });

    return results;
  } catch (err) {
    console.error('[translationApi] Lỗi dịch hàng loạt:', err);
    return texts;
  }
}
