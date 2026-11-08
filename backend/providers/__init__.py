# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo package)
# ========================================================
# Package providers triển khai Strategy Pattern & Polymorphism cho các AI Model

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (AI Providers)
# ========================================================
from .base import BaseAiProvider
from .gemini_provider import GeminiProvider
from .openai_provider import OpenAiProvider
from .factory import AiProviderFactory

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

__all__ = [
    "BaseAiProvider",
    "GeminiProvider",
    "OpenAiProvider",
    "AiProviderFactory"
]
