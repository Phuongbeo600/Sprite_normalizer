# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc & Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa kiểu từ điển, kiểu lớp Type
from typing import Dict, Type

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Providers)
# ========================================================
# BaseImageGenProvider: Interface trừu tượng cơ sở
from .base import BaseImageGenProvider
# GeminiImagenProvider: Hiện thực hóa cho Google Imagen 3
from .gemini_imagen_provider import GeminiImagenProvider
# OpenAiDalleProvider: Hiện thực hóa cho OpenAI DALL-E 3
from .openai_dalle_provider import OpenAiDalleProvider
from .cloudflare_workers_ai_provider import CloudflareWorkersAiProvider

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class ImageGenProviderFactory:
    """
    Factory Pattern khởi tạo các nhà cung cấp dịch vụ Tạo ảnh AI theo tên gọi.

    Lợi ích kiến trúc:
    - Loại bỏ 100% các khối rẽ nhánh if/else kiểm tra nhà cung cấp trong Service.
    - Đảm bảo tính mở rộng (Open-Closed Principle): Khi bổ sung thêm dịch vụ tạo ảnh mới
      (như Stability AI SDXL, Midjourney Proxy, ComfyUI, v.v.), chỉ cần tạo class mới
      kế thừa BaseImageGenProvider và đăng ký qua ImageGenProviderFactory.register(...).
    """

    _registry: Dict[str, Type[BaseImageGenProvider]] = {
        "gemini": GeminiImagenProvider,
        "openai": OpenAiDalleProvider,
        "cloudflare": CloudflareWorkersAiProvider,
    }

    @classmethod
    def register(cls, name: str, provider_cls: Type[BaseImageGenProvider]) -> None:
        """
        Đăng ký một Image Gen Provider mới vào hệ thống mà không cần sửa code cũ.

        @param {str} name Tên định danh (vd: 'stability', 'comfyui', 'midjourney').
        @param {Type[BaseImageGenProvider]} provider_cls Lớp kế thừa BaseImageGenProvider.
        """
        cls._registry[name.lower().strip()] = provider_cls

    @classmethod
    def get_provider(cls, name: str) -> BaseImageGenProvider:
        """
        Lấy đối tượng Provider tương ứng theo tên nhà cung cấp.
        Mặc định nếu tên không khớp sẽ trả về GeminiImagenProvider.

        @param {str} name Tên nhà cung cấp ('gemini', 'openai', v.v.).
        @returns {BaseImageGenProvider} Đối tượng Provider đã khởi tạo.
        """
        clean_name = (name or "gemini").lower().strip()
        provider_cls = cls._registry.get(clean_name, GeminiImagenProvider)
        return provider_cls()
