# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Kiểu dữ liệu)
# ========================================================
# os: Đọc biến môi trường hệ thống cho API key
import os
# typing: Định nghĩa các kiểu dữ liệu từ điển, tùy chọn
from typing import Dict, Any, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Core, Providers & Schemas)
# ========================================================
# CharacterMetrics: Cấu trúc dữ liệu số đo giải phẫu nhân vật mẫu
from backend.core.metrics.character_metrics import CharacterMetrics
# InverseScalingEngine: Động cơ toán học nghịch đảo
from backend.core.processing.inverse_scaling import InverseScalingEngine
# AiProviderFactory: Khởi tạo nhà cung cấp AI Đa hình
from backend.providers.factory import AiProviderFactory
# PromptAdviceRequest: DTO yêu cầu sinh prompt
from backend.schemas.character.prompt import PromptAdviceRequest

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class PromptService:
    """
    Dịch vụ Cố vấn Prompt AI & Toán học nghịch đảo (Prompt Service).
    - Phối hợp giữa InverseScalingEngine và AiProviderFactory.
    - Sinh prompt chuẩn xác cho Midjourney / DALL-E / Stable Diffusion để khi nén về game không bị sai tỷ lệ.
    """

    @classmethod
    def generate_prompt_advice(cls, request: PromptAdviceRequest) -> Dict[str, Any]:
        """
        Tạo bản kế hoạch tỷ lệ nghịch đảo và các câu Prompt sinh ảnh tối ưu.

        @param {PromptAdviceRequest} request Dữ liệu yêu cầu từ client.
        @returns {Dict[str, Any]} Bản phân tích chi tiết và positive/negative prompt.
        """
        # 1. Phục hồi đối tượng CharacterMetrics từ dictionary bằng phương thức chuẩn hóa
        metrics = CharacterMetrics.from_dict(request.metrics)

        active_provider = (request.provider or os.getenv("AI_PROVIDER", "gemini")).strip().lower()
        active_base_url = request.base_url or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

        key_name = "OPENAI_API_KEY" if active_provider == "openai" else "GEMINI_API_KEY"
        effective_key = request.api_key or os.getenv(key_name)

        # Nếu có API Key -> Gọi qua tính Đa hình của AiProviderFactory
        if effective_key and effective_key.strip():
            try:
                ai_provider = AiProviderFactory.get_provider(active_provider)
                prompt_text = InverseScalingEngine.build_ai_prompt_instruction(
                    metrics=metrics,
                    head_rule=request.head_rule,
                    body_width_rule=request.body_width_rule,
                    body_height_rule=request.body_height_rule,
                    character_concept=request.character_concept
                )
                data = ai_provider.generate_json(prompt_text, effective_key.strip(), base_url=active_base_url)
                data["api_status"] = f"Phân tích chuyên sâu bởi AI ({data.get('model_used', active_provider)})"
                return data
            except Exception as e:
                # Fallback sang kế hoạch toán học nội bộ
                fallback_data = InverseScalingEngine.generate_offline_fallback_plan(
                    metrics=metrics,
                    head_rule=request.head_rule,
                    body_width_rule=request.body_width_rule,
                    body_height_rule=request.body_height_rule,
                    character_concept=request.character_concept
                )
                fallback_data["api_status"] = f"Chế độ Fallback do AI lỗi ({str(e)[:40]})"
                return fallback_data

        # Không có API Key -> Chạy động cơ toán học nội bộ (Offline 0 Token)
        return InverseScalingEngine.generate_offline_fallback_plan(
            metrics=metrics,
            head_rule=request.head_rule,
            body_width_rule=request.body_width_rule,
            body_height_rule=request.body_height_rule,
            character_concept=request.character_concept
        )
