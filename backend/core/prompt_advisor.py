# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc & Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa các kiểu từ điển, tùy chọn
from typing import Dict, Any, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Core & Services)
# ========================================================
# CharacterMetrics: Cấu trúc số đo giải phẫu nhân vật mẫu
from .character_metrics import CharacterMetrics
# InverseScalingEngine: Động cơ toán học nghịch đảo
from .inverse_scaling import InverseScalingEngine
# PromptService: Dịch vụ cố vấn prompt
from backend.services.prompt_service import PromptService
# PromptAdviceRequest: Schema DTO
from backend.schemas.prompt import PromptAdviceRequest

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class PromptAdvisor:
    """
    Facade Adapter cung cấp khả năng tương thích ngược cho các lời gọi PromptAdvisor cũ.
    Toàn bộ thuật toán toán học đã được chuyển sang InverseScalingEngine và PromptService.
    """

    @staticmethod
    def assess_detail_density(metrics: CharacterMetrics) -> Dict[str, str]:
        """Ủy nhiệm đánh giá mật độ pixel cho InverseScalingEngine."""
        return InverseScalingEngine.assess_detail_density(metrics)

    @classmethod
    def generate_prompt(
        cls,
        metrics: CharacterMetrics,
        head_rule: str = "Bằng nhân vật gốc (Tỷ lệ chuẩn)",
        body_width_rule: str = "Bằng nhân vật gốc",
        body_height_rule: str = "Bằng nhân vật gốc",
        character_concept: str = "Chiến binh / Quái vật",
        api_key: Optional[str] = None,
        provider: str = "gemini",
        base_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """Ủy nhiệm sinh Prompt cho PromptService."""
        from dataclasses import asdict
        req = PromptAdviceRequest(
            metrics=asdict(metrics),
            character_concept=character_concept,
            head_rule=head_rule,
            body_width_rule=body_width_rule,
            body_height_rule=body_height_rule,
            api_key=api_key,
            provider=provider,
            base_url=base_url
        )
        return PromptService.generate_prompt_advice(req)
