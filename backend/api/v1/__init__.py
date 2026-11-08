# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo package)
# ========================================================
# Package api.v1 chứa các Router phân hệ chức năng cho API phiên bản 1

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Sub-routers)
# ========================================================
from .projects import projects_router
from .sprites import sprites_router
from .prompt import prompt_router
from .settings import settings_router
from .character_analysis import character_analysis_router

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

__all__ = [
    "projects_router",
    "sprites_router",
    "prompt_router",
    "settings_router",
    "character_analysis_router"
]
