# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo package & xuất khẩu)
# ========================================================
# Package schemas.character định nghĩa toàn bộ Pydantic Schema cho AI Reference Asset Analysis

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Character Schemas & Enums)
# ========================================================
# Nhóm 1: Nhận diện & Danh tính
from .identity import (
    IdentityAnalysis,
    GenderPresentation,
    BodyType,
    ShapeLanguage
)
# Nhóm 2: Cấu trúc Giải phẫu học
from .anatomy import (
    AnatomyAnalysis,
    BodyStructure,
    LimbPlacement
)
# Nhóm 3: Phong cách Pixel Art
from .pixel_style import (
    PixelStyleAnalysis,
    PixelArtEra,
    OutlineStyle,
    ShadingStyle,
    DitheringStyle,
    PixelClusterStyle,
    DetailDensity,
    PixelCleanliness,
    LightingDirection
)
# Nhóm 4: Chất liệu & Độ phản quang
from .material import (
    MaterialType,
    Reflectivity,
    PixelTexture,
    MaterialAnalysis
)
# Nhóm 5: Hướng nhìn không gian
from .direction import (
    ViewType,
    OrientationAngle,
    DirectionProfile,
    DirectionAnalysis
)
# Nhóm 6: Hoạt họa chuyển động
from .animation import (
    AnimationType,
    LoopCharacteristics,
    AnimationProfile,
    DirectionAnimation,
    AnimationAnalysis
)
# Nhóm 7: Tổng hợp Toàn cục & Ràng buộc DNA
from .ai_analysis import (
    GlobalAnalysis,
    ConsistencyAnalysis,
    NegativeConstraints,
    AIAnalysis
)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

__all__ = [
    # Schemas gốc
    "IdentityAnalysis",
    "AnatomyAnalysis",
    "PixelStyleAnalysis",
    "MaterialAnalysis",
    "DirectionProfile",
    "DirectionAnalysis",
    "AnimationProfile",
    "DirectionAnimation",
    "AnimationAnalysis",
    "GlobalAnalysis",
    "ConsistencyAnalysis",
    "NegativeConstraints",
    "AIAnalysis",
    
    # Controlled Vocabulary Enums
    "GenderPresentation",
    "BodyType",
    "ShapeLanguage",
    "BodyStructure",
    "LimbPlacement",
    "PixelArtEra",
    "OutlineStyle",
    "ShadingStyle",
    "DitheringStyle",
    "PixelClusterStyle",
    "DetailDensity",
    "PixelCleanliness",
    "LightingDirection",
    "MaterialType",
    "Reflectivity",
    "PixelTexture",
    "ViewType",
    "OrientationAngle",
    "AnimationType",
    "LoopCharacteristics"
]
