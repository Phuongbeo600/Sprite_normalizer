# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo package)
# ========================================================
# Package services chứa toàn bộ các lớp nghiệp vụ (Business Logic Layer)

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services)
# ========================================================
from .project_service import ProjectService
from .settings_service import SettingsService
from .sprite_service import SpriteService
from .anatomy_service import AnatomyService
from .prompt_service import PromptService
from .character_analysis_service import CharacterAnalysisService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

__all__ = [
    "ProjectService",
    "SettingsService",
    "SpriteService",
    "AnatomyService",
    "PromptService",
    "CharacterAnalysisService"
]
