# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo package)
# ========================================================
# Package services.character chứa các dịch vụ nghiệp vụ phân tích hồ sơ nhân vật và Prompt Studio

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Character Services)
# ========================================================
from .character_analysis_service import CharacterAnalysisService
from .prompt_builder_service import PromptBuilderService
from .reference_style_service import generate_style_prompt
from .anatomy_service import AnatomyService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

__all__ = [
    "CharacterAnalysisService",
    "PromptBuilderService",
    "generate_style_prompt",
    "AnatomyService",
]
