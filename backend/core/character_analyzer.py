# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc & Kiểu dữ liệu)
# ========================================================
# typing: Khai báo kiểu dữ liệu cho gợi ý mã nguồn
from typing import Optional, Tuple, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# numpy: Thao tác ma trận boolean Alpha Mask
import numpy as np
# PIL (Pillow): Mở ảnh
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Clean Architecture Core Modules)
# ========================================================
# CharacterMetrics: Cấu trúc dữ liệu giải phẫu học
from .character_metrics import CharacterMetrics
# BackgroundMaskExtractor: Bộ bóc tách kênh Alpha Mask
from .masking import BackgroundMaskExtractor
# HeuristicAnalyzer: Bộ phân tích giải phẫu toán học nội bộ
from .heuristic_analyzer import HeuristicAnalyzer
# AnatomyVisualRenderer: Bộ vẽ lớp phủ trực quan Pillow
from .visual_renderer import AnatomyVisualRenderer

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class CharacterAnalyzer:
    """
    Facade Adapter cung cấp giao diện tương thích ngược cho các thành phần cũ:
    - Ủy nhiệm bóc tách mask cho BackgroundMaskExtractor.
    - Ủy nhiệm phân tích toán học cho HeuristicAnalyzer.
    - Ủy nhiệm vẽ đồ họa cho AnatomyVisualRenderer.
    - Ủy nhiệm phân tích kết hợp AI cho AnatomyService.
    """

    @staticmethod
    def extract_mask(
        image: Image.Image,
        auto_remove_solid_bg: bool = True,
        bg_tolerance: int = 25
    ) -> Tuple[np.ndarray, Image.Image]:
        """Ủy nhiệm bóc tách mask."""
        return BackgroundMaskExtractor.extract_mask(
            image, auto_remove_solid_bg=auto_remove_solid_bg, bg_tolerance=bg_tolerance
        )

    @classmethod
    def analyze(
        cls,
        image_or_path: Any,
        auto_remove_solid_bg: bool = True
    ) -> Optional[CharacterMetrics]:
        """Ủy nhiệm phân tích giải phẫu học toán học (Heuristic)."""
        if isinstance(image_or_path, str):
            image = Image.open(image_or_path)
        else:
            image = image_or_path
        return HeuristicAnalyzer.analyze(image, auto_remove_solid_bg=auto_remove_solid_bg)

    @classmethod
    def analyze_with_ai(
        cls,
        image_or_path: Any,
        api_key: Optional[str] = None,
        provider: str = "gemini",
        base_url: Optional[str] = None,
        auto_remove_solid_bg: bool = True
    ) -> Tuple[Optional[CharacterMetrics], str]:
        """Ủy nhiệm phân tích giải phẫu kết hợp AI thông qua AnatomyService."""
        from backend.services.anatomy_service import AnatomyService
        if isinstance(image_or_path, str):
            image = Image.open(image_or_path)
        else:
            image = image_or_path

        metrics, message, _ = AnatomyService.analyze_sprite(
            image=image,
            api_key=api_key,
            provider=provider,
            base_url=base_url,
            auto_remove_bg=auto_remove_solid_bg,
            use_ai=bool(api_key and api_key.strip())
        )
        return metrics, message

    @classmethod
    def draw_annotated_image(
        cls,
        image: Image.Image,
        metrics: CharacterMetrics,
        scale: int = 1
    ) -> Image.Image:
        """Ủy nhiệm vẽ lớp phủ trực quan cho AnatomyVisualRenderer."""
        return AnatomyVisualRenderer.render_overlay(image, metrics, scale=scale)
