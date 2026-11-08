# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc & Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa các kiểu từ điển, tùy chọn, bộ giá trị
from typing import Dict, Any, Optional, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# PIL (Pillow): Thao tác ảnh
from PIL import Image
# numpy: Ma trận điểm ảnh
import numpy as np

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Providers & Services)
# ========================================================
# AiProviderFactory: Khởi tạo Provider đa hình
from backend.providers.factory import AiProviderFactory
# AnatomyService: Dịch vụ giải phẫu học
from backend.services.anatomy_service import AnatomyService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class AiVisionAnalyzer:
    """
    Facade Adapter cung cấp khả năng tương thích ngược cho các lời gọi AiVisionAnalyzer cũ.
    Toàn bộ logic kết nối API đã được chuyển sang tầng Đa hình (Polymorphism) backend/providers/.
    """

    @classmethod
    def call_gemini_vision(cls, image: Image.Image, api_key: str) -> Dict[str, Any]:
        """Ủy nhiệm gọi Gemini Vision cho GeminiProvider."""
        provider = AiProviderFactory.get_provider("gemini")
        return provider.analyze_vision(image, api_key, AnatomyService.VISION_PROMPT)

    @classmethod
    def call_openai_vision(
        cls,
        image: Image.Image,
        api_key: str,
        base_url: str = "https://api.openai.com/v1"
    ) -> Dict[str, Any]:
        """Ủy nhiệm gọi OpenAI Vision cho OpenAiProvider."""
        provider = AiProviderFactory.get_provider("openai")
        return provider.analyze_vision(image, api_key, AnatomyService.VISION_PROMPT, base_url=base_url)

    @classmethod
    def snap_and_denormalize(
        cls,
        ai_data: Dict[str, Any],
        image_size: Tuple[int, int],
        mask: np.ndarray
    ) -> Dict[str, Any]:
        """Ủy nhiệm thuật toán Snap Pixel cho AnatomyService."""
        dummy_img = Image.new("RGBA", image_size)
        metrics = AnatomyService._snap_and_build_metrics(ai_data, dummy_img, mask)
        return {
            "neck_y": metrics.neck_y,
            "crotch_y": metrics.crotch_y,
            "ground_y": metrics.ground_y,
            "head_x_min": metrics.head_x_min,
            "head_x_max": metrics.head_x_max,
            "head_y_min": metrics.head_y_min,
            "head_y_max": metrics.head_y_max,
            "torso_box": metrics.torso_box,
            "legs_box": metrics.legs_box,
            "weapon_box": metrics.weapon_box,
            "cape_wings_box": metrics.cape_wings_box,
            "shadow_box": metrics.shadow_box,
            "character_archetype": metrics.style_category,
            "anatomy_notes": metrics.ai_feedback or ""
        }
