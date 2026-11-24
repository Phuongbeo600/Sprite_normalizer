"""
Module: backend.services.character.character_analysis_service
Mục đích: Dịch vụ nghiệp vụ phân tích nhân vật pixel art chuyên sâu.
Ai gọi nó: API router `backend.api.v1.character_analysis`.
Tại sao tồn tại: Đóng vai trò nhạc trưởng (Orchestrator) kết hợp 2 tầng:
  1. Tầng Heuristics offline (NumPy, Pillow): đo đạc hệ màu sắc và giải phẫu không tốn token.
  2. Tầng AI Vision tùy chọn (Gemini hoặc OpenAI): phân tích theo các schema Pydantic.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống, Logging & Xử lý JSON)
# ========================================================
# json: Chuyển đổi và bóc tách dữ liệu JSON phản hồi từ AI
import json
# logging: Ghi nhận nhật ký hoạt động và cảnh báo lỗi
import logging
# os: Đọc biến môi trường hệ thống
import os
# typing: Định nghĩa các kiểu từ điển, danh sách, tùy chọn
from typing import Dict, Any, Optional, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# PIL (Pillow): Thao tác xử lý và ghép nối hình ảnh sprite
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Schemas, Providers & Fallbacks)
# ========================================================
# Schemas Pydantic phân tích nhân vật theo từng phân hệ Tab
from backend.schemas.character import (
    DirectionAnalysis,
    AnimationAnalysis,
    ConsistencyAnalysis,
    NegativeConstraints,
)
# GlobalVisionAnalysis: Chỉ yêu cầu AI trả phần mô tả hình ảnh
from backend.schemas.character.ai_analysis import GlobalVisionAnalysis
# AiProviderFactory: Khởi tạo Provider đa hình (Gemini / OpenAI)
from backend.providers.factory import AiProviderFactory
# SpriteService: Cung cấp đo màu cho các máy khách dùng hợp đồng hồ sơ cũ
from backend.services.sprite_service import SpriteService
# AiCredentialsService: Hợp nhất phân giải thông tin xác thực AI
from backend.services.ai_credentials_service import AiCredentialsService
# Các hàm dữ liệu dự phòng ngoại tuyến (Offline Fallbacks)
from backend.services.character.offline_fallbacks import (
    get_offline_fallback_global,
    get_offline_fallback_directions,
    get_offline_fallback_animations,
    get_offline_fallback_constraints,
)

# ========================================================
# PromptBuilderService: Ánh xạ hồ sơ đầy đủ sang ma trận frame.
from backend.services.character.prompt_builder_service import PromptBuilderService

# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


def _build_global_prompt() -> str:
    """
    Tạo nội dung câu lệnh phân tích Toàn cục cho AI Vision.

    @returns {str} Chuỗi câu lệnh phân tích JSON.
    """
    schema_str = json.dumps(GlobalVisionAnalysis.model_json_schema(), ensure_ascii=False, indent=2)
    return f"""
You are an expert Lead Pixel Artist analyzing a reference character sprite.
Analyze this reference image and extract the GLOBAL PROFILE in valid JSON matching this schema:

{schema_str}

CRITICAL INSTRUCTIONS:
1. "identity": Detect character type, gender presentation (or null), body type, distinctive features, silhouette, shape language, facial features (or null if helmeted/covered), costume description, accessories.
2. "anatomy": Describe body structure (e.g. humanoid), head, torso, arms, legs, unusual parts, landmarks, relative limb placement, anatomical ambiguities. DO NOT measure exact pixel coordinates.
3. "pixel_style": Describe art style (e.g. 16-bit SNES), outline style (e.g. dark selout), shading technique, dithering style (or null), pixel cluster style, detail density, pixel cleanliness, lighting direction (or null), visual artifacts.
4. "materials": List of MaterialAnalysis objects for distinct regions (e.g. metal armor, cloth cape, skin).

Return ONLY the raw JSON object adhering to the schema, without markdown formatting.
"""


def _build_directions_prompt() -> str:
    """
    Tạo nội dung câu lệnh phân tích 3 Hướng nhìn cho AI Vision.

    @returns {str} Chuỗi câu lệnh phân tích hướng nhìn JSON.
    """
    schema_str = json.dumps(DirectionAnalysis.model_json_schema(), ensure_ascii=False, indent=2)
    return f"""
You are an expert 2D Game Technical Artist analyzing spatial directions of a character sprite sheet.
Analyze the Down (front), Side (profile), and Up (back) views of the character and extract the DIRECTION ANALYSIS matching this schema:

{schema_str}

CRITICAL INSTRUCTIONS:
1. "down": DirectionProfile for Front / Down view (view_type="Front").
2. "side": DirectionProfile for Side / Profile view (view_type="Right Profile" or "Left Profile").
3. "up": DirectionProfile for Back / Up view (view_type="Back").
For each direction, describe: body_orientation, head_orientation, visible_body_parts, occluded_body_parts, visible_accessories, accessory_placement, silhouette_description, view_specific_features, occlusion_rules.

Return ONLY the raw JSON object adhering to the schema.
"""


def _build_animations_prompt() -> str:
    """
    Tạo nội dung câu lệnh phân tích Hoạt họa cho AI Vision.

    @returns {str} Chuỗi câu lệnh phân tích hoạt họa JSON.
    """
    schema_str = json.dumps(AnimationAnalysis.model_json_schema(), ensure_ascii=False, indent=2)
    return f"""
You are an expert 2D Game Animator analyzing sprite animation frames.
Analyze the Idle frames (3 frames) and Walk cycle frames (4 frames) for each direction (down, side, up) and extract the ANIMATION ANALYSIS matching this schema:

{schema_str}

CRITICAL INSTRUCTIONS:
1. For each direction ("down", "side", "up"), analyze both "idle" and "walk" AnimationProfile.
2. DO NOT assume a generic walk cycle. Observe and describe the actual frame sequence, leg motion, arm motion, secondary motion (cape, hair, accessories), moving parts, and fixed parts.
3. Keep frame_descriptions in exact chronological order.

Return ONLY the raw JSON object adhering to the schema.
"""


def _build_constraints_prompt(global_data: Dict[str, Any]) -> str:
    """
    Tạo nội dung câu lệnh tổng hợp Tính nhất quán và Ràng buộc phủ định.

    @param {Dict[str, Any]} global_data Dữ liệu phân tích toàn cục của nhân vật.
    @returns {str} Chuỗi câu lệnh tổng hợp JSON.
    """
    consistency_schema = json.dumps(ConsistencyAnalysis.model_json_schema(), ensure_ascii=False)
    negative_schema = json.dumps(NegativeConstraints.model_json_schema(), ensure_ascii=False)
    return f"""
You are a Game Art Director synthesizing character profile DNA constraints.
Given the previous analysis data:
- Character Type: {global_data.get('identity', {}).get('character_type')}
- Costume: {global_data.get('identity', {}).get('costume_description')}
- Pixel Style: {global_data.get('pixel_style', {}).get('art_style')}

Synthesize the CONSISTENCY ANALYSIS and NEGATIVE CONSTRAINTS matching this schema:
{{
  "consistency_analysis": {consistency_schema},
  "negative_constraints": {negative_schema}
}}

Identify:
1. Invariant features (features that must remain 100% identical across all frames).
2. View-dependent features and animation-dependent features.
3. Preservation requirements for generating new character assets.
4. Forbidden design changes, visual defects to avoid, animation defects to avoid.

Return ONLY the raw JSON object adhering to the schema.
"""


class CharacterAnalysisService:
    """
    Dịch vụ Phân tích Hồ sơ Nhân vật tham chiếu theo từng phân hệ Tab (Tab-based Analysis Service).
    
    Áp dụng kiến trúc 'Chia để trị' (Divide and Conquer):
    - Tab 1: Phân tích Toàn cục & Chất liệu (Global & Materials: Identity, Anatomy, Pixel Style, Materials).
    - Tab 2: Phân tích 3 Hướng nhìn không gian (Direction Analysis: Down, Side, Up).
    - Tab 3: Phân tích Hoạt họa chuyển động (Animation Analysis: Idle & Walk).
    - Tab 4: Tổng hợp Tính nhất quán & Sinh Prompt đồng bộ (Consistency, Constraints & Prompt Generation).
    """

    # Các bí danh (aliases) duy trì tương thích ngược 100% với mã nguồn cũ và các bài test
    _get_offline_fallback_global = staticmethod(get_offline_fallback_global)
    _get_offline_fallback_directions = staticmethod(get_offline_fallback_directions)
    _get_offline_fallback_animations = staticmethod(get_offline_fallback_animations)
    _get_offline_fallback_constraints = staticmethod(get_offline_fallback_constraints)

    @classmethod
    def analyze_tab_global(
        cls,
        image: Image.Image,
        api_key: Optional[str] = None,
        provider: str = "gemini",
        base_url: Optional[str] = None,
        include_palette: bool = True,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        [TAB 1]: Phân tích Toàn cục, Danh tính, Giải phẫu sinh học, Phong cách Pixel Art và Chất liệu từng vùng.
        Chỉ cần 1 ảnh tham chiếu chính diện (hướng Down).

        @param {Image.Image} image Ảnh sprite tham chiếu.
        @param {Optional[str]} api_key Khóa API AI tùy chọn.
        @param {str} provider Nhà cung cấp AI (gemini hoặc openai).
        @param {Optional[str]} base_url Địa chỉ máy chủ proxy tùy chọn.
        @param {bool} include_palette Có kèm số đo màu sắc hay không.
        @param {Optional[str]} model Tên mô hình AI tùy chọn.
        @returns {Dict[str, Any]} Dữ liệu phân tích toàn cục.
        """
        effective_key, effective_provider, clean_base = cls._resolve_credentials(api_key, provider, base_url)
        prompt = _build_global_prompt()

        if effective_key:
            ai_provider = AiProviderFactory.get_provider(effective_provider)
            raw_data = ai_provider.analyze_vision(image, effective_key, prompt, base_url=clean_base, model=model)
            result = GlobalVisionAnalysis.model_validate(raw_data).model_dump()
        else:
            result = cls._get_offline_fallback_global()

        result["pixel_style"]["shading_levels"] = None
        if include_palette:
            result.update(SpriteService.analyze_colors(image))
        return result

    @classmethod
    def analyze_tab_directions(
        cls,
        image: Image.Image,
        api_key: Optional[str] = None,
        provider: str = "gemini",
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        [TAB 2]: Phân tích 3 hướng nhìn tham chiếu chuẩn (Down / Front, Side / Profile, Up / Back).

        @param {Image.Image} image Ảnh sprite tham chiếu.
        @param {Optional[str]} api_key Khóa API AI tùy chọn.
        @param {str} provider Nhà cung cấp AI (gemini hoặc openai).
        @param {Optional[str]} base_url Địa chỉ máy chủ proxy tùy chọn.
        @param {Optional[str]} model Tên mô hình AI tùy chọn.
        @returns {Dict[str, Any]} Dữ liệu phân tích 3 hướng nhìn.
        """
        effective_key, effective_provider, clean_base = cls._resolve_credentials(api_key, provider, base_url)

        if not effective_key:
            return cls._get_offline_fallback_directions()

        prompt = _build_directions_prompt()
        ai_provider = AiProviderFactory.get_provider(effective_provider)
        raw_data = ai_provider.analyze_vision(image, effective_key, prompt, base_url=clean_base, model=model)
        return DirectionAnalysis.model_validate(raw_data).model_dump()

    @classmethod
    def analyze_tab_animations(
        cls,
        image: Image.Image,
        api_key: Optional[str] = None,
        provider: str = "gemini",
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        [TAB 3]: Phân tích hệ thống hoạt họa chuyển động Idle và Walk qua các frame tham chiếu.

        @param {Image.Image} image Ảnh sprite tham chiếu.
        @param {Optional[str]} api_key Khóa API AI tùy chọn.
        @param {str} provider Nhà cung cấp AI (gemini hoặc openai).
        @param {Optional[str]} base_url Địa chỉ máy chủ proxy tùy chọn.
        @param {Optional[str]} model Tên mô hình AI tùy chọn.
        @returns {Dict[str, Any]} Dữ liệu phân tích hoạt họa Idle và Walk.
        """
        effective_key, effective_provider, clean_base = cls._resolve_credentials(api_key, provider, base_url)

        if not effective_key:
            return cls._get_offline_fallback_animations()

        prompt = _build_animations_prompt()
        ai_provider = AiProviderFactory.get_provider(effective_provider)
        raw_data = ai_provider.analyze_vision(image, effective_key, prompt, base_url=clean_base, model=model)
        return AnimationAnalysis.model_validate(raw_data).model_dump()

    @classmethod
    def analyze_tab_constraints(
        cls,
        global_data: Dict[str, Any],
        direction_data: Dict[str, Any],
        animation_data: Dict[str, Any],
        api_key: Optional[str] = None,
        provider: str = "gemini",
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        [TAB 4]: Tổng hợp Tính nhất quán (Consistency Analysis) và Các ràng buộc phủ định (Negative Constraints).

        @param {Dict[str, Any]} global_data Dữ liệu phân tích toàn cục.
        @param {Dict[str, Any]} direction_data Dữ liệu phân tích hướng nhìn.
        @param {Dict[str, Any]} animation_data Dữ liệu phân tích hoạt họa.
        @param {Optional[str]} api_key Khóa API AI tùy chọn.
        @param {str} provider Nhà cung cấp AI.
        @param {Optional[str]} base_url Địa chỉ máy chủ proxy.
        @param {Optional[str]} model Tên mô hình AI tùy chọn.
        @returns {Dict[str, Any]} Dữ liệu nhất quán và ràng buộc phủ định.
        """
        effective_key, effective_provider, clean_base = cls._resolve_credentials(api_key, provider, base_url)

        if not effective_key:
            return cls._get_offline_fallback_constraints(global_data)

        prompt = _build_constraints_prompt(global_data)
        ai_provider = AiProviderFactory.get_provider(effective_provider)
        raw_data = ai_provider.generate_json(prompt, effective_key, base_url=clean_base, model=model)
        consistency = ConsistencyAnalysis.model_validate(raw_data.get("consistency_analysis", {}))
        negatives = NegativeConstraints.model_validate(raw_data.get("negative_constraints", {}))
        return {
            "consistency_analysis": consistency.model_dump(),
            "negative_constraints": negatives.model_dump(),
        }

    @staticmethod
    def analyze_profile(image, tab_name, eff_key, eff_prov, eff_base, current_profile_json=None, vision_only=False, model=None):
        """Điều phối một tab hoặc toàn bộ hồ sơ trong cùng một luồng xử lý.

        @param tab_name Tên tab yêu cầu từ bên gọi.
        @param model Tên mô hình AI tùy chọn.
        @returns Kết quả hồ sơ và nhãn tab theo hợp đồng hiện có.
        """
        tab_clean = tab_name.lower().strip()

        # Tab 1: Phân tích Toàn cục
        if tab_clean == "global":
            result = CharacterAnalysisService.analyze_tab_global(
                image=image, api_key=eff_key, provider=eff_prov, base_url=eff_base, include_palette=not vision_only,
                model=model,
            )
            return {"status": "success", "tab": "global", "data": result}

        # Tab 2: Phân tích 3 hướng nhìn
        elif tab_clean == "directions":
            result = CharacterAnalysisService.analyze_tab_directions(
                image=image, api_key=eff_key, provider=eff_prov, base_url=eff_base,
                model=model,
            )
            return {"status": "success", "tab": "directions", "data": result}

        # Tab 3: Phân tích Hoạt họa
        elif tab_clean == "animations":
            result = CharacterAnalysisService.analyze_tab_animations(
                image=image, api_key=eff_key, provider=eff_prov, base_url=eff_base,
                model=model,
            )
            return {"status": "success", "tab": "animations", "data": result}

        # Tab 4: Phân tích Tính nhất quán & Ràng buộc
        elif tab_clean == "constraints":
            curr_profile = json.loads(current_profile_json) if current_profile_json else {}
            g_data = curr_profile.get("global_analysis", {})
            d_data = curr_profile.get("direction_analysis", {})
            a_data = curr_profile.get("animation_analysis", {})
            result = CharacterAnalysisService.analyze_tab_constraints(
                global_data=g_data, direction_data=d_data, animation_data=a_data,
                api_key=eff_key, provider=eff_prov, base_url=eff_base,
                model=model,
            )
            return {"status": "success", "tab": "constraints", "data": result}

        # Chạy toàn bộ (All tabs tuần tự)
        elif tab_clean == "all":
            global_res = CharacterAnalysisService.analyze_tab_global(
                image, api_key=eff_key, provider=eff_prov, base_url=eff_base, include_palette=not vision_only,
                model=model,
            )
            direction_res = CharacterAnalysisService.analyze_tab_directions(
                image, api_key=eff_key, provider=eff_prov, base_url=eff_base,
                model=model,
            )
            animation_res = CharacterAnalysisService.analyze_tab_animations(
                image, api_key=eff_key, provider=eff_prov, base_url=eff_base,
                model=model,
            )
            constraints_res = CharacterAnalysisService.analyze_tab_constraints(
                global_data=global_res, direction_data=direction_res, animation_data=animation_res,
                api_key=eff_key, provider=eff_prov, base_url=eff_base,
                model=model,
            )

            full_ai_analysis = {
                "global_analysis": global_res,
                "direction_analysis": direction_res,
                "animation_analysis": animation_res,
                "consistency_analysis": constraints_res.get("consistency_analysis", {}),
                "negative_constraints": constraints_res.get("negative_constraints", {}),
            }
            if not vision_only:
                full_ai_analysis["palette_metrics"] = global_res.get("palette_metrics")
                full_ai_analysis["pixel_art_report"] = global_res.get("pixel_art_report")
            # Tự động ánh xạ dữ liệu 7 Schemas sang ma trận 15 frame hoạt họa có chân tay đối nghịch
            full_ai_analysis["frame_actions_data"] = PromptBuilderService.build_default_frame_actions(full_ai_analysis)
            return {"status": "success", "tab": "all", "data": full_ai_analysis}

        else:
            raise ValueError(f"Tab '{tab_name}' không hợp lệ.")


    @staticmethod
    def _resolve_credentials(
        api_key: Optional[str],
        provider: Optional[str],
        base_url: Optional[str],
    ) -> Tuple[Optional[str], str, Optional[str]]:
        """
        Hàm phụ trợ xác định API Key, Nhà cung cấp và Base URL hiệu dụng.

        @param {Optional[str]} api_key Khóa API truyền vào.
        @param {Optional[str]} provider Tên nhà cung cấp AI.
        @param {Optional[str]} base_url Địa chỉ máy chủ proxy.
        @returns {Tuple[Optional[str], str, Optional[str]]} (Khóa hiệu dụng, Provider, Base URL).
        """
        return AiCredentialsService.resolve_credentials(
            project_id=None,
            api_key=api_key,
            provider=provider,
            base_url=base_url,
        )
