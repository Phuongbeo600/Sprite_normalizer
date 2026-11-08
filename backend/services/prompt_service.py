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
from backend.core.character_metrics import CharacterMetrics
# InverseScalingEngine: Động cơ toán học nghịch đảo
from backend.core.inverse_scaling import InverseScalingEngine
# AiProviderFactory: Khởi tạo nhà cung cấp AI Đa hình
from backend.providers.factory import AiProviderFactory
# PromptAdviceRequest: DTO yêu cầu sinh prompt
from backend.schemas.prompt import PromptAdviceRequest

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
        # 1. Phục hồi đối tượng CharacterMetrics từ dictionary
        m_dict = request.metrics
        metrics = CharacterMetrics(
            canvas_width=m_dict.get("canvas_width", 64),
            canvas_height=m_dict.get("canvas_height", 64),
            visible_x_min=m_dict.get("visible_x_min", 0),
            visible_y_min=m_dict.get("visible_y_min", 0),
            visible_x_max=m_dict.get("visible_x_max", 63),
            visible_y_max=m_dict.get("visible_y_max", 63),
            visible_width=m_dict.get("visible_width", 64),
            visible_height=m_dict.get("visible_height", 64),
            neck_y=m_dict.get("neck_y", 20),
            head_x_min=m_dict.get("head_x_min", 16),
            head_y_min=m_dict.get("head_y_min", 0),
            head_x_max=m_dict.get("head_x_max", 48),
            head_y_max=m_dict.get("head_y_max", 20),
            head_width=m_dict.get("head_width", 32),
            head_height=m_dict.get("head_height", 20),
            body_x_min=m_dict.get("body_x_min", 10),
            body_y_min=m_dict.get("body_y_min", 21),
            body_x_max=m_dict.get("body_x_max", 54),
            body_y_max=m_dict.get("body_y_max", 63),
            body_width=m_dict.get("body_width", 44),
            body_height=m_dict.get("body_height", 43),
            torso_height=m_dict.get("torso_height", 20),
            torso_width=m_dict.get("torso_width", 44),
            head_ratio=m_dict.get("head_ratio", 0.31),
            heads_tall=m_dict.get("heads_tall", 3.2),
            head_to_body_width_ratio=m_dict.get("head_to_body_width_ratio", 0.73),
            body_aspect_ratio=m_dict.get("body_aspect_ratio", 1.02),
            style_category=m_dict.get("style_category", "Semi-Chibi"),
            summary_text=m_dict.get("summary_text", ""),
            crotch_y=m_dict.get("crotch_y"),
            ground_y=m_dict.get("ground_y"),
            anatomical_height=m_dict.get("anatomical_height"),
            torso_box=m_dict.get("torso_box"),
            legs_box=m_dict.get("legs_box"),
            weapon_box=m_dict.get("weapon_box"),
            cape_wings_box=m_dict.get("cape_wings_box"),
            shadow_box=m_dict.get("shadow_box")
        )

        active_provider = (request.provider or os.getenv("AI_PROVIDER", "gemini")).lower()
        active_base_url = request.base_url or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

        if active_provider == "openai":
            effective_key = request.api_key or os.getenv("OPENAI_API_KEY")
        else:
            effective_key = request.api_key or os.getenv("GEMINI_API_KEY")

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
