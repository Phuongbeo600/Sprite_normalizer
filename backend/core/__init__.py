# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo package)
# ========================================================
# Package core chứa toàn bộ các thuật toán cốt lõi xử lý hình ảnh và giải phẫu

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Core Modules)
# ========================================================
from .character_metrics import CharacterMetrics
from .masking import BackgroundMaskExtractor
from .normalizer import SpriteNormalizer
from .visual_renderer import AnatomyVisualRenderer
from .heuristic_analyzer import HeuristicAnalyzer
from .inverse_scaling import InverseScalingEngine

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

__all__ = [
    "CharacterMetrics",
    "BackgroundMaskExtractor",
    "SpriteNormalizer",
    "AnatomyVisualRenderer",
    "HeuristicAnalyzer",
    "InverseScalingEngine"
]
