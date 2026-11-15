# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo package)
# ========================================================
# File đánh dấu package schemas chứa các định dạng đối tượng truyền tải dữ liệu (DTO)

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Pydantic Schemas)
# ========================================================
# Schemas xác thực người dùng
from .auth import LoginRequest, RegisterRequest, UpdateProfileRequest
# Schemas cho Dự án, Cài đặt và Cố vấn Prompt
from .project import (
    ProjectCreateRequest,
    ProjectItem,
    ProjectListResponse,
    ProjectApiConfigRequest,
    SaveCharacterPresetRequest
)
from .settings import SettingsResponse, SettingsUpdateRequest, TestApiKeyRequest
from .character.prompt import (
    PromptAdviceRequest,
    NewCharacterPromptRequest,
    GeneratePromptFromProfileRequest,
    CompileSpriteSheetPromptRequest
)
# Schema mới cho Phân tích Asset nhân vật tham chiếu AI
from .character import (
    IdentityAnalysis,
    AnatomyAnalysis,
    PixelStyleAnalysis,
    MaterialType,
    MaterialAnalysis,
    ViewType,
    DirectionProfile,
    DirectionAnalysis,
    AnimationType,
    AnimationProfile,
    DirectionAnimation,
    AnimationAnalysis,
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
    # Schemas xác thực
    "LoginRequest",
    "RegisterRequest",
    "UpdateProfileRequest",
    # Schemas hệ thống dự án & cài đặt
    "ProjectCreateRequest",
    "ProjectItem",
    "ProjectListResponse",
    "ProjectApiConfigRequest",
    "SaveCharacterPresetRequest",
    "SettingsResponse",
    "SettingsUpdateRequest",
    "TestApiKeyRequest",
    "PromptAdviceRequest",
    "NewCharacterPromptRequest",
    "GeneratePromptFromProfileRequest",
    "CompileSpriteSheetPromptRequest",
    # Schemas phân tích nhân vật mới
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
