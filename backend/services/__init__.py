# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo package)
# ========================================================
# Package services chứa toàn bộ các lớp nghiệp vụ điều phối của hệ thống (Business Logic Layer)

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services)
# ========================================================
# Phân hệ Phân tích Giải phẫu Nhân vật (Character)
from .character.anatomy_service import AnatomyService
from .character import anatomy_service

# Phân hệ Phòng thử nghiệm Godot (Testbed)
from .testbed.testbed_service import TestbedService
from .testbed.godot_export_service import GodotExportService

# Các dịch vụ độc lập
from .project_service import ProjectService
from .settings_service import SettingsService
from .sprite_service import SpriteService
from .user_service import UserService
from .image_gen_service import ImageGenService
from .ai_credentials_service import AiCredentialsService
from .translation_service import TranslationService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

__all__ = [
    # Character
    "AnatomyService",
    # Godot Testbed
    "TestbedService",
    "GodotExportService",
    # Domain Services
    "ProjectService",
    "SettingsService",
    "SpriteService",
    "UserService",
    "ImageGenService",
    "AiCredentialsService",
    "TranslationService",
]
