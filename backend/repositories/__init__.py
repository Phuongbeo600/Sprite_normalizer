# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo package)
# ========================================================
# Package repositories triển khai Repository Pattern để đóng gói các thao tác dữ liệu

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Repositories & Serializers)
# ========================================================
# BaseRepository: Lớp cơ sở trừu tượng cho các Repository
from .base import BaseRepository
# ProjectRepository: Quản lý dự án và cấu hình API
from .project_repository import ProjectRepository
# UserRepository: Quản lý người dùng và phân quyền
from .user_repository import UserRepository
# CharacterPresetRepository: Quản lý preset thông số nhân vật
from .character_preset_repository import CharacterPresetRepository
# SpriteRepository: Quản lý ảnh sprite gốc và đã xử lý
from .sprite_repository import SpriteRepository
# TestbedRepository: Facade tổng hợp phòng thử nghiệm
from .testbed_repository import TestbedRepository
# TestbedMapRepository: Quản lý bản đồ sàn đấu testbed
from .testbed_map_repository import TestbedMapRepository
# TestbedCharacterRepository: Quản lý nhân vật testbed
from .testbed_character_repository import TestbedCharacterRepository
# TestbedFrameRepository: Quản lý khung hình ô ảnh rời testbed
from .testbed_frame_repository import TestbedFrameRepository
# Các hàm tiện ích serialize/deserialize JSON an toàn
from .serializers import safe_json_loads, safe_json_dumps, deserialize_preset_record

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

__all__ = [
    "BaseRepository",
    "ProjectRepository",
    "UserRepository",
    "CharacterPresetRepository",
    "SpriteRepository",
    "TestbedRepository",
    "TestbedMapRepository",
    "TestbedCharacterRepository",
    "TestbedFrameRepository",
    "safe_json_loads",
    "safe_json_dumps",
    "deserialize_preset_record",
]
