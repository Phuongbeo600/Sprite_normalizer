# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo package)
# ========================================================
# Package core.processing chứa các thuật toán xử lý hình ảnh, cắt ghép, căn neo và biến đổi hình học sprite

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Processing Modules)
# ========================================================
from .normalizer import SpriteNormalizer
from .masking import BackgroundMaskExtractor
from .inverse_scaling import InverseScalingEngine
from .visual_renderer import AnatomyVisualRenderer
from .sprite_editing import recover_native_sprite, resize_sprite, slice_sheet

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

__all__ = [
    "SpriteNormalizer",
    "BackgroundMaskExtractor",
    "InverseScalingEngine",
    "AnatomyVisualRenderer",
    "recover_native_sprite",
    "resize_sprite",
    "slice_sheet",
]
