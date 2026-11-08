# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc & Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa kiểu từ điển, lớp Type
from typing import Dict, Type

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# BaseAiProvider: Interface trừu tượng cơ sở
from .base import BaseAiProvider
# GeminiProvider: Hiện thực hóa cho Google Gemini
from .gemini_provider import GeminiProvider
# OpenAiProvider: Hiện thực hóa cho OpenAI ChatGPT
from .openai_provider import OpenAiProvider

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class AiProviderFactory:
    """
    Factory Pattern khởi tạo các nhà cung cấp AI theo tên gọi.
    
    Lợi ích kiến trúc:
    - Triệt tiêu 100% các câu lệnh kiểm tra điều kiện if/else rải rác trong hệ thống.
    - Mở rộng dễ dàng: Khi có thêm nhà cung cấp mới (Claude, DeepSeek, v.v.),
      chỉ cần tạo class mới kế thừa BaseAiProvider và gọi AiProviderFactory.register("claude", ClaudeProvider).
    """

    _registry: Dict[str, Type[BaseAiProvider]] = {
        "gemini": GeminiProvider,
        "openai": OpenAiProvider,
    }

    @classmethod
    def register(cls, name: str, provider_cls: Type[BaseAiProvider]) -> None:
        """
        Đăng ký một Provider mới vào hệ thống mà không cần sửa code cũ.

        @param {str} name Tên định danh (vd: 'claude', 'deepseek', 'ollama').
        @param {Type[BaseAiProvider]} provider_cls Lớp kế thừa BaseAiProvider.
        """
        cls._registry[name.lower().strip()] = provider_cls

    @classmethod
    def get_provider(cls, name: str) -> BaseAiProvider:
        """
        Lấy đối tượng Provider tương ứng theo tên.
        Mặc định nếu tên không khớp sẽ trả về GeminiProvider.

        @param {str} name Tên nhà cung cấp ('gemini', 'openai', v.v.).
        @returns {BaseAiProvider} Đối tượng Provider đã khởi tạo.
        """
        clean_name = (name or "gemini").lower().strip()
        provider_cls = cls._registry.get(clean_name, GeminiProvider)
        return provider_cls()
