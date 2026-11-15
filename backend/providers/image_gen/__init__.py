# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo package)
# ========================================================
# Package image_gen đóng gói toàn bộ logic kết nối và adapter tạo ảnh AI (Imagen 3, DALL-E)

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Image Gen Providers)
# ========================================================
from .base import BaseImageGenProvider
from .gemini_imagen_provider import GeminiImagenProvider
from .openai_dalle_provider import OpenAiDalleProvider
from .factory import ImageGenProviderFactory

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

__all__ = [
    "BaseImageGenProvider",
    "GeminiImagenProvider",
    "OpenAiDalleProvider",
    "ImageGenProviderFactory"
]
