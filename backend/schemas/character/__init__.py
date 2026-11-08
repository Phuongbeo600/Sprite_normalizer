# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo package)
# ========================================================
# Package schemas.character định nghĩa toàn bộ Pydantic Schema cho AI Reference Asset Analysis

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Character Schemas)
# ========================================================
from .identity import IdentityAnalysis
from .anatomy import AnatomyAnalysis
from .pixel_style import PixelStyleAnalysis
from .material import MaterialType, MaterialAnalysis
from .direction import ViewType, DirectionProfile, DirectionAnalysis
from .animation import AnimationType, AnimationProfile, DirectionAnimation, AnimationAnalysis
from .ai_analysis import GlobalAnalysis, ConsistencyAnalysis, NegativeConstraints, AIAnalysis

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

__all__ = [
    "IdentityAnalysis",
    "AnatomyAnalysis",
    "PixelStyleAnalysis",
    "MaterialType",
    "MaterialAnalysis",
    "ViewType",
    "DirectionProfile",
    "DirectionAnalysis",
    "AnimationType",
    "AnimationProfile",
    "DirectionAnimation",
    "AnimationAnalysis",
    "GlobalAnalysis",
    "ConsistencyAnalysis",
    "NegativeConstraints",
    "AIAnalysis"
]
