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
# BaseAiProvider: Interface cơ sở cho phân tích thị giác và sinh văn bản
from .base import BaseAiProvider
# GeminiProvider: Provider Google Gemini
from .gemini_provider import GeminiProvider
# OpenAiProvider: Provider OpenAI
from .openai_provider import OpenAiProvider
# AiProviderFactory: Factory cho Vision/Text Provider
from .factory import AiProviderFactory
# Subpackage image_gen: Nhà cung cấp dịch vụ tạo ảnh AI
from .image_gen import (
    BaseImageGenProvider,
    GeminiImagenProvider,
    OpenAiDalleProvider,
    ImageGenProviderFactory
)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

__all__ = [
    "BaseAiProvider",
    "GeminiProvider",
    "OpenAiProvider",
    "AiProviderFactory",
    "BaseImageGenProvider",
    "GeminiImagenProvider",
    "OpenAiDalleProvider",
    "ImageGenProviderFactory"
]
