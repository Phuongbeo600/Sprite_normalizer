# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo package)
# ========================================================
# Package core chứa toàn bộ các thuật toán cốt lõi xử lý hình ảnh và giải phẫu pixel art

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Processing & Metrics)
# ========================================================
# Phân hệ xử lý hình học & biến đổi sprite (Processing)
from .processing.normalizer import SpriteNormalizer
from .processing.masking import BackgroundMaskExtractor
from .processing.visual_renderer import AnatomyVisualRenderer
from .processing.sprite_editing import recover_native_sprite, resize_sprite, slice_sheet

# Phân hệ trắc lượng & phân tích nghệ thuật (Metrics)
from .metrics.palette_analyzer import HeuristicPaletteAnalyzer
from .metrics.character_metrics import CharacterMetrics
from .metrics.heuristic_analyzer import HeuristicAnalyzer
from .metrics.pixel_art_metrics import analyze_sprite
from .metrics.region_measure import measure_region, Region

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

__all__ = [
    # Processing
    "SpriteNormalizer",
    "BackgroundMaskExtractor",
    "AnatomyVisualRenderer",
    "recover_native_sprite",
    "resize_sprite",
    "slice_sheet",
    # Metrics
    "HeuristicPaletteAnalyzer",
    "CharacterMetrics",
    "HeuristicAnalyzer",
    "analyze_sprite",
    "measure_region",
    "Region",
]
