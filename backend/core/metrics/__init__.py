# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo package)
# ========================================================
# Package core.metrics chứa các thuật toán trắc lượng, phân tích 6 tiêu chuẩn màu sắc và giải phẫu pixel art

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Metrics Modules)
# ========================================================
from .palette_analyzer import HeuristicPaletteAnalyzer
from .character_metrics import CharacterMetrics
from .heuristic_analyzer import HeuristicAnalyzer
from .pixel_art_metrics import analyze_sprite
from .region_measure import measure_region, Region

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

__all__ = [
    "HeuristicPaletteAnalyzer",
    "CharacterMetrics",
    "HeuristicAnalyzer",
    "analyze_sprite",
    "measure_region",
    "Region",
]
