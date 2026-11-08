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
from .project import ProjectCreateRequest, ProjectItem, ProjectListResponse
from .settings import SettingsResponse, SettingsUpdateRequest, TestApiKeyRequest
from .prompt import PromptAdviceRequest

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

__all__ = [
    "ProjectCreateRequest",
    "ProjectItem",
    "ProjectListResponse",
    "SettingsResponse",
    "SettingsUpdateRequest",
    "TestApiKeyRequest",
    "PromptAdviceRequest"
]
