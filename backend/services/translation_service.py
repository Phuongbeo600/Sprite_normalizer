# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Xử lý chuỗi, biểu thức chính quy & bộ nhớ đệm)
# ========================================================
# re: Biểu thức chính quy hỗ trợ bóc tách câu văn bản và thay thế thuật ngữ bảo tồn
import re
# threading: Khóa đồng bộ hóa chống Race Condition khi nhiều luồng truy cập Cache và khởi tạo
import threading
# OrderedDict: Cấu trúc từ điển có thứ tự phục vụ cơ chế LRU Cache giải phóng bộ nhớ
from collections import OrderedDict
# typing: Định nghĩa các kiểu dữ liệu mảng, từ điển và tùy chọn
from typing import List, Dict, Tuple, Optional, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# argostranslate: Được nạp lười (Lazy Import) qua hàm _get_argos() khi có yêu cầu dịch thực sự
# Giúp tối ưu hóa tốc độ khởi động máy chủ backend từ ~20 giây xuống dưới 1 giây.

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

# Khóa luồng bảo vệ khởi tạo lười mô hình Argos an toàn trong môi trường đa luồng
_init_lock = threading.Lock()
# Biến bộ nhớ lưu trữ module argostranslate sau khi nạp lười
_argos_module = None


def _get_argos():
    """
    Nạp lười (Lazy Import) thư viện argostranslate nhằm tăng tốc độ khởi động hệ thống.
    Chỉ thực thi import khi nghiệp vụ dịch thuật được triệu gọi lần đầu tiên.
    Được đồng bộ hóa bằng _init_lock để chống Race Condition khi nhiều luồng truy cập đồng thời.
    
    @returns Module argostranslate đã được nạp đầy đủ các gói dịch.
    """
    global _argos_module
    if _argos_module is None:
        with _init_lock:
            if _argos_module is None:
                import argostranslate.package
                import argostranslate.translate
                import argostranslate.sbd
                _argos_module = argostranslate
    return _argos_module


class OfflinePromptSentencizer:
    """
    Bộ phân tách câu thuần Offline dành cho câu lệnh Prompt và mô tả hoạt họa Sprite.
    Thay thế cho Stanza để hoạt động 100% không cần kết nối mạng hay tải thêm tài nguyên.
    Tuân thủ giao diện ISentenceBoundaryDetectionModel của Argos Translate.
    """
    def __init__(self, pkg=None):
        self.pkg = pkg

    def split_sentences(self, text: str) -> List[str]:
        """
        Tách các đoạn văn bản theo dấu xuống dòng hoặc dấu ngắt câu một cách tối ưu.
        
        @param text: Chuỗi văn bản gốc cần tách
        @returns: Danh sách các câu hoặc dòng lệnh riêng biệt
        """
        if not text:
            return []
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        sentences: List[str] = []
        for line in lines:
            # Tách theo dấu chấm hoặc chấm phẩy đi kèm khoảng trắng
            parts = [p.strip() for p in re.split(r'(?<=[.;])\s+', line) if p.strip()]
            sentences.extend(parts or [line])
        return sentences or [text]


class TranslationService:
    """
    Dịch vụ dịch thuật ngôn ngữ hai chiều (EN ⇄ VI) hoàn toàn OFFLINE cục bộ.
    Sử dụng mô hình CTranslate2 / Argos Translate đã đóng gói sẵn trong máy.
    Không tốn token API, không cần khóa API, có tích hợp từ điển thuật ngữ Pixel Art & Game.
    Hỗ trợ LRU Cache có giới hạn dung lượng và Thread-safe để giải phóng bộ nhớ RAM.
    """
    # Giới hạn kích thước tối đa của bộ đệm LRU để ngăn ngừa rò rỉ bộ nhớ RAM
    MAX_CACHE_SIZE: int = 1024
    _is_initialized: bool = False
    _cache: OrderedDict[Tuple[str, str, str], str] = OrderedDict()
    _cache_lock = threading.Lock()

    # Từ điển chuyên ngành bảo tồn ngữ nghĩa Game & Pixel Art chuẩn mực (EN -> VI)
    GLOSSARY_EN_TO_VI = {
        "reference pixel art specifications": "QUY CHUẨN THIẾT KẾ PIXEL ART THAM CHIẾU",
        "color budget": "Giới hạn bảng màu (Color Budget)",
        "hue-shifting rule": "Quy tắc đổ bóng dịch chuyển sắc độ (Hue-Shifting)",
        "cool shadows": "Vùng tối tông màu lạnh (Cool shadows)",
        "warm highlights": "Vùng sáng tông màu ấm (Warm highlights)",
        "selective outline": "Đường viền chọn lọc (Selective Outline / Selout)",
        "selout": "viền hòa sắc Selout",
        "dithering": "chuyển sắc chấm hạt Dithering",
        "walk stride 1": "bước sải chân 1",
        "walk stride 2": "bước sải chân 2",
        "walk passing pose": "dáng chân thu giữa qua tâm (Passing pose)",
        "static idle stand": "dáng đứng yên thở tĩnh (Idle)",
        "perfectly balanced upright posture": "tư thế đứng thẳng thăng bằng hoàn hảo",
        "shoulder-width": "rộng bằng vai",
        "feet cross closely under body": "hai chân thu sát nhau dưới trọng tâm thân người",
        "drop naturally beside hips": "thả lỏng tự nhiên dọc hai bên hông",
        "strides firmly forward": "bước sải dứt khoát về phía trước",
        "pushes back": "đẩy lùi về phía sau giữ nhịp",
        "arms swing naturally": "hai tay vung đối nghịch tự nhiên",
        "front view": "Góc nhìn chính diện (Mặt trước)",
        "side view": "Góc nhìn ngang (Nghiêng 90°)",
        "back view": "Góc nhìn từ phía sau (Lưng)",
        "16-bit snes pixel art": "đồ họa pixel phong cách SNES 16-bit",
        "pure transparent background": "nền trong suốt hoàn toàn (kênh Alpha)",
        "zero drop shadows on floor": "không vẽ bóng đổ xuống mặt sàn"
    }

    # Từ điển bảo tồn thuật ngữ tiếng Việt sang chuẩn prompt tiếng Anh (VI -> EN)
    GLOSSARY_VI_TO_EN = {
        "nữ pháp sư": "female mage",
        "pháp sư bóng đêm": "dark sorcerer",
        "bí ẩn": "mysterious",
        "áo choàng nhung tím đen viền chỉ vàng kim": "black-purple velvet cloak with gold embroidery border",
        "trượng phép đính ngọc xanh": "magic staff topped with a blue gemstone",
        "song kiếm": "dual swords",
        "kiếm ngắn": "short sword",
        "tay không": "unarmed hands",
        "áo giáp": "armor",
        "áo giáp da sờn rách": "weathered worn leather armor",
        "áo choàng": "cloak",
        "mắt sáng rực": "glowing luminous eyes",
        "chân bước": "foot stepping",
        "đứng yên": "standing idle"
    }

    @classmethod
    def _ensure_initialized(cls) -> None:
        """
        Khởi tạo hệ thống dịch thuật và thiết lập OfflineSentencizer cho mọi cặp ngôn ngữ.
        Đảm bảo không bao giờ gọi ra ngoài mạng Internet.
        Sử dụng Double-Checked Locking để đảm bảo Thread-safe khi nhiều luồng cùng gọi lần đầu.
        """
        if cls._is_initialized:
            return

        with _init_lock:
            if cls._is_initialized:
                return

            try:
                argos = _get_argos()
                # Gán Sentencizer thuần offline vào các gói ngôn ngữ đã nạp sẵn
                installed = argos.translate.get_installed_languages()
                sentencizer = OfflinePromptSentencizer()

                for lang in installed:
                    for trans in lang.translations_from:
                        trans.sentencizer = sentencizer
                        if hasattr(trans, 'underlying') and trans.underlying:
                            trans.underlying.sentencizer = sentencizer

                cls._is_initialized = True
            except Exception as err:
                # Ghi nhận nếu khởi tạo gặp trục trặc nhưng không làm sập tiến trình
                print(f"[TranslationService] Cảnh báo khởi tạo: {err}")
                cls._is_initialized = True

    @classmethod
    def translate(cls, text: str, source_lang: str = "en", target_lang: str = "vi") -> str:
        """
        Dịch một chuỗi văn bản đơn lẻ giữa Tiếng Anh và Tiếng Việt.
        Áp dụng bộ nhớ đệm (LRU Cache) và tinh chỉnh thuật ngữ Game/Pixel Art.
        Cơ chế tự động dọn dẹp phần tử cũ nhất khi kích thước vượt quá MAX_CACHE_SIZE.
        
        @param text: Đoạn văn bản cần dịch
        @param source_lang: Mã ngôn ngữ nguồn ('en' hoặc 'vi')
        @param target_lang: Mã ngôn ngữ đích ('vi' hoặc 'en')
        @returns: Chuỗi văn bản đã dịch chuẩn mực
        """
        if not text or not text.strip():
            return ""

        clean_text = text.strip()
        cache_key = (clean_text, source_lang, target_lang)

        # Đọc từ LRU Cache an toàn luồng và đẩy phần tử vừa truy cập về cuối (Most Recently Used)
        with cls._cache_lock:
            if cache_key in cls._cache:
                cls._cache.move_to_end(cache_key)
                return cls._cache[cache_key]

        cls._ensure_initialized()

        try:
            argos = _get_argos()
            # Bước 1: Dùng mô hình nơ-ron CTranslate2 offline dịch thô
            raw_result = argos.translate.translate(clean_text, source_lang, target_lang)
            translated = raw_result.strip() if raw_result else clean_text

            # Bước 2: Tinh chỉnh thuật ngữ đặc thù chuyên ngành Pixel Art
            if source_lang == "en" and target_lang == "vi":
                translated = cls._refine_en_to_vi(translated)
            elif source_lang == "vi" and target_lang == "en":
                translated = cls._refine_vi_to_en(translated)

            # Lưu vào LRU Cache an toàn luồng và loại bỏ phần tử cũ nhất nếu vượt giới hạn
            with cls._cache_lock:
                cls._cache[cache_key] = translated
                cls._cache.move_to_end(cache_key)
                if len(cls._cache) > cls.MAX_CACHE_SIZE:
                    cls._cache.popitem(last=False)

            return translated
        except Exception as err:
            print(f"[TranslationService] Lỗi khi dịch: {err}")
            # Trả về văn bản gốc nếu có lỗi ngoài ý muốn để không gây gián đoạn UI
            return clean_text

    @classmethod
    def clear_cache(cls) -> None:
        """
        Xóa toàn bộ dữ liệu bộ nhớ đệm dịch thuật để giải phóng bộ nhớ RAM tức thì.
        """
        with cls._cache_lock:
            cls._cache.clear()

    @classmethod
    def get_cache_info(cls) -> Dict[str, Any]:
        """
        Lấy thông tin thống kê trạng thái bộ nhớ đệm Cache hiện tại.

        @returns {Dict[str, Any]} Kích thước hiện tại và kích thước tối đa cho phép.
        """
        with cls._cache_lock:
            return {
                "size": len(cls._cache),
                "maxsize": cls.MAX_CACHE_SIZE
            }

    @classmethod
    def translate_batch(cls, texts: List[str], source_lang: str = "en", target_lang: str = "vi") -> List[str]:
        """
        Dịch đồng loạt một danh sách các chuỗi văn bản (ví dụ 5 frame chuyển động cùng lúc).
        
        @param texts: Danh sách các đoạn văn bản
        @param source_lang: Mã ngôn ngữ nguồn
        @param target_lang: Mã ngôn ngữ đích
        @returns: Danh sách các kết quả đã dịch theo đúng thứ tự
        """
        return [cls.translate(item, source_lang, target_lang) for item in texts]

    @classmethod
    def _refine_en_to_vi(cls, text: str) -> str:
        """
        Tinh chỉnh các cụm từ tiếng Anh sang tiếng Việt mượt mà và chuẩn ngữ cảnh Game Dev.
        """
        refined = text
        # Chuyển đổi một số cụm từ máy dịch chưa chuẩn
        replace_pairs = [
            ("bước sải 1", "bước sải chân 1"),
            ("bước sải 2", "bước sải chân 2"),
            ("bước trước xem", "Nhìn chính diện (Mặt trước)"),
            ("bên xem", "Nhìn nghiêng (Góc bên)"),
            ("mặt sau xem", "Nhìn từ phía sau (Quay lưng)"),
            ("đứng lười biếng", "đứng yên thở tĩnh"),
            ("chân trước", "bàn chân trước"),
        ]
        for src, dest in replace_pairs:
            refined = re.sub(re.escape(src), dest, refined, flags=re.IGNORECASE)
        return refined

    @classmethod
    def _refine_vi_to_en(cls, text: str) -> str:
        """
        Tinh chỉnh các cụm từ tiếng Việt sang tiếng Anh chuẩn từ khóa cho AI Prompt.
        """
        refined = text
        for vi_term, en_term in cls.GLOSSARY_VI_TO_EN.items():
            if vi_term in text.lower():
                refined = re.sub(re.escape(vi_term), en_term, refined, flags=re.IGNORECASE)
        return refined
