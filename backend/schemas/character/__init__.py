# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo package & xuất khẩu)
# ========================================================
# Package schemas.character chứa các Pydantic Schema dùng cho đo bảng màu
# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Character Schemas)
# ========================================================
from .palette import (
    DominantColorItem,
    PaletteMetrics,
)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

__all__ = [
    "DominantColorItem",
    "PaletteMetrics",
]
