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
# Schemas cho Dự án
from .project import (
    ProjectCreateRequest,
    ProjectItem,
    ProjectListResponse,
    ProjectApiConfigRequest,
    SaveCharacterPresetRequest
)
# Schemas đo màu nhân vật đang dùng
from .character import (
    DominantColorItem,
    PaletteMetrics,
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
    # Schemas hệ thống dự án
    "ProjectCreateRequest",
    "ProjectItem",
    "ProjectListResponse",
    "ProjectApiConfigRequest",
    "SaveCharacterPresetRequest",
    # Schemas nhân vật đang sử dụng
    "DominantColorItem",
    "PaletteMetrics",
]
