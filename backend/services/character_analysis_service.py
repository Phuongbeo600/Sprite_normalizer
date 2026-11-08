# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Xử lý JSON)
# ========================================================
# json: Chuyển đổi và bóc tách dữ liệu JSON phản hồi từ AI
import json
# os: Đọc biến môi trường hệ thống
import os
# typing: Định nghĩa các kiểu từ điển, danh sách, tùy chọn
from typing import Dict, Any, Optional, List, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# PIL (Pillow): Thao tác xử lý và ghép nối hình ảnh sprite
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Schemas & Providers)
# ========================================================
# Schemas phân tích nhân vật theo từng phân hệ Tab
from backend.schemas.character import (
    GlobalAnalysis,
    DirectionAnalysis,
    AnimationAnalysis,
    ConsistencyAnalysis,
    NegativeConstraints,
    AIAnalysis
)
# AiProviderFactory: Khởi tạo Provider đa hình (Gemini / OpenAI)
from backend.providers.factory import AiProviderFactory

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class CharacterAnalysisService:
    """
    Dịch vụ Phân tích Hồ sơ Nhân vật tham chiếu theo từng phân hệ Tab (Tab-based Analysis Service).
    
    Áp dụng kiến trúc 'Chia để trị' (Divide and Conquer):
    - Tab 1: Phân tích Toàn cục & Chất liệu (Global & Materials: Identity, Anatomy, Pixel Style, Materials).
    - Tab 2: Phân tích 3 Hướng nhìn không gian (Direction Analysis: Down, Side, Up).
    - Tab 3: Phân tích Hoạt họa chuyển động (Animation Analysis: Idle & Walk).
    - Tab 4: Tổng hợp Tính nhất quán & Sinh Prompt đồng bộ (Consistency, Constraints & Prompt Generation).
    """

    @classmethod
    def analyze_tab_global(
        cls,
        image: Image.Image,
        api_key: Optional[str] = None,
        provider: str = "gemini",
        base_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        [TAB 1]: Phân tích Toàn cục, Danh tính, Giải phẫu sinh học, Phong cách Pixel Art và Chất liệu từng vùng.
        Chỉ cần 1 ảnh tham chiếu chính diện (hướng Down).
        """
        effective_key, effective_provider, clean_base = cls._resolve_credentials(api_key, provider, base_url)

        prompt = f"""
You are an expert Lead Pixel Artist analyzing a reference character sprite.
Analyze this reference image and extract the GLOBAL PROFILE in valid JSON matching this schema:

{json.dumps(GlobalAnalysis.model_json_schema(), ensure_ascii=False, indent=2)}

CRITICAL INSTRUCTIONS:
1. "identity": Detect character type, gender presentation (or null), body type, distinctive features, silhouette, shape language, facial features (or null if helmeted/covered), costume description, accessories.
2. "anatomy": Describe body structure (e.g. humanoid), head, torso, arms, legs, unusual parts, landmarks, relative limb placement, anatomical ambiguities. DO NOT measure exact pixel coordinates.
3. "pixel_style": Describe art style (e.g. 16-bit SNES), outline style (e.g. dark selout), shading style, shading levels (integer or null), dithering style (or null), pixel cluster style, detail density, pixel cleanliness, lighting direction (or null), visual artifacts.
4. "materials": List of MaterialAnalysis objects for distinct regions (e.g. metal armor, cloth cape, skin).

Return ONLY the raw JSON object adhering to the schema, without markdown formatting.
"""
        if effective_key:
            ai_provider = AiProviderFactory.get_provider(effective_provider)
            raw_data = ai_provider.analyze_vision(image, effective_key, prompt, base_url=clean_base)
            # Validate qua Pydantic schema
            validated = GlobalAnalysis.model_validate(raw_data)
            return validated.model_dump()
        else:
            return cls._get_offline_fallback_global()

    @classmethod
    def analyze_tab_directions(
        cls,
        image: Image.Image,
        api_key: Optional[str] = None,
        provider: str = "gemini",
        base_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        [TAB 2]: Phân tích 3 hướng nhìn tham chiếu chuẩn (Down / Front, Side / Profile, Up / Back).
        """
        effective_key, effective_provider, clean_base = cls._resolve_credentials(api_key, provider, base_url)

        prompt = f"""
You are an expert 2D Game Technical Artist analyzing spatial directions of a character sprite sheet.
Analyze the Down (front), Side (profile), and Up (back) views of the character and extract the DIRECTION ANALYSIS matching this schema:

{json.dumps(DirectionAnalysis.model_json_schema(), ensure_ascii=False, indent=2)}

CRITICAL INSTRUCTIONS:
1. "down": DirectionProfile for Front / Down view (view_type="Front").
2. "side": DirectionProfile for Side / Profile view (view_type="Right Profile" or "Left Profile").
3. "up": DirectionProfile for Back / Up view (view_type="Back").
For each direction, describe: body_orientation, head_orientation, visible_body_parts, occluded_body_parts, visible_accessories, accessory_placement, silhouette_description, view_specific_features, occlusion_rules.

Return ONLY the raw JSON object adhering to the schema.
"""
        if effective_key:
            ai_provider = AiProviderFactory.get_provider(effective_provider)
            raw_data = ai_provider.analyze_vision(image, effective_key, prompt, base_url=clean_base)
            validated = DirectionAnalysis.model_validate(raw_data)
            return validated.model_dump()
        else:
            return cls._get_offline_fallback_directions()

    @classmethod
    def analyze_tab_animations(
        cls,
        image: Image.Image,
        api_key: Optional[str] = None,
        provider: str = "gemini",
        base_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        [TAB 3]: Phân tích hệ thống hoạt họa chuyển động Idle và Walk qua các frame tham chiếu.
        """
        effective_key, effective_provider, clean_base = cls._resolve_credentials(api_key, provider, base_url)

        prompt = f"""
You are an expert 2D Game Animator analyzing sprite animation frames.
Analyze the Idle frames (3 frames) and Walk cycle frames (4 frames) for each direction (down, side, up) and extract the ANIMATION ANALYSIS matching this schema:

{json.dumps(AnimationAnalysis.model_json_schema(), ensure_ascii=False, indent=2)}

CRITICAL INSTRUCTIONS:
1. For each direction ("down", "side", "up"), analyze both "idle" and "walk" AnimationProfile.
2. DO NOT assume a generic walk cycle. Observe and describe the actual frame sequence, leg motion, arm motion, secondary motion (cape, hair, accessories), moving parts, and fixed parts.
3. Keep frame_descriptions in exact chronological order.

Return ONLY the raw JSON object adhering to the schema.
"""
        if effective_key:
            ai_provider = AiProviderFactory.get_provider(effective_provider)
            raw_data = ai_provider.analyze_vision(image, effective_key, prompt, base_url=clean_base)
            validated = AnimationAnalysis.model_validate(raw_data)
            return validated.model_dump()
        else:
            return cls._get_offline_fallback_animations()

    @classmethod
    def analyze_tab_constraints(
        cls,
        global_data: Dict[str, Any],
        direction_data: Dict[str, Any],
        animation_data: Dict[str, Any],
        api_key: Optional[str] = None,
        provider: str = "gemini",
        base_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        [TAB 4]: Tổng hợp Tính nhất quán (Consistency Analysis) và Các ràng buộc phủ định (Negative Constraints).
        """
        effective_key, effective_provider, clean_base = cls._resolve_credentials(api_key, provider, base_url)

        prompt = f"""
You are a Game Art Director synthesizing character profile DNA constraints.
Given the previous analysis data:
- Character Type: {global_data.get('identity', {}).get('character_type')}
- Costume: {global_data.get('identity', {}).get('costume_description')}
- Pixel Style: {global_data.get('pixel_style', {}).get('art_style')}

Synthesize the CONSISTENCY ANALYSIS and NEGATIVE CONSTRAINTS matching this schema:
{{
  "consistency_analysis": {json.dumps(ConsistencyAnalysis.model_json_schema(), ensure_ascii=False)},
  "negative_constraints": {json.dumps(NegativeConstraints.model_json_schema(), ensure_ascii=False)}
}}

Identify:
1. Invariant features (features that must remain 100% identical across all frames).
2. View-dependent features and animation-dependent features.
3. Preservation requirements for generating new character assets.
4. Forbidden design changes, visual defects to avoid, animation defects to avoid.

Return ONLY the raw JSON object adhering to the schema.
"""
        if effective_key:
            ai_provider = AiProviderFactory.get_provider(effective_provider)
            raw_data = ai_provider.generate_json(prompt, effective_key, base_url=clean_base)
            consistency = ConsistencyAnalysis.model_validate(raw_data.get("consistency_analysis", {}))
            negatives = NegativeConstraints.model_validate(raw_data.get("negative_constraints", {}))
            return {
                "consistency_analysis": consistency.model_dump(),
                "negative_constraints": negatives.model_dump()
            }
        else:
            return cls._get_offline_fallback_constraints(global_data)

    @classmethod
    def generate_character_prompt_from_profile(
        cls,
        profile_data: Dict[str, Any],
        new_character_concept: str,
        target_direction: str = "Front / Down view",
        api_key: Optional[str] = None,
        provider: str = "gemini",
        base_url: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Sinh Prompt hình ảnh tối ưu dựa trên toàn bộ DNA của Hồ sơ nhân vật (Character Profile):
        Khống chế Midjourney / DALL-E / Stable Diffusion sinh ra nhân vật mới đồng bộ 100% phong cách.
        """
        effective_key, effective_provider, clean_base = cls._resolve_credentials(api_key, provider, base_url)

        g = profile_data.get("global_analysis", {})
        ident = g.get("identity", {})
        style = g.get("pixel_style", {})
        mats = g.get("materials", [])
        mat_summary = ", ".join([f"{m.get('region_name')}: {m.get('color_description')} ({m.get('material_type')})" for m in mats[:4]])

        neg = profile_data.get("negative_constraints", {})
        forbidden = ", ".join(neg.get("forbidden_design_changes", [])[:4])
        visual_defects = ", ".join(neg.get("visual_defects_to_avoid", [])[:4])

        prompt_instruction = f"""
You are a Lead Prompt Engineer for 2D Pixel Art games.
We need to generate a NEW character asset ({new_character_concept}) that perfectly matches the artistic DNA of an existing reference character.

REFERENCE ARTISTIC DNA:
- Art Style: {style.get('art_style', '16-bit retro pixel art')}
- Outline Style: {style.get('outline_style', 'selective dark outline')}
- Shading Style: {style.get('shading_style', 'cel-shading')}
- Pixel Clusters: {style.get('pixel_cluster_style', 'clean chunky clusters')}
- Materials Palette: {mat_summary}
- Target View: {target_direction}

DEFECTS & FORBIDDEN:
- Avoid: {visual_defects}
- Do not violate: {forbidden}

Generate a concise, high-impact POSITIVE PROMPT and NEGATIVE PROMPT in JSON:
{{
  "positive_prompt": "English prompt for text-to-image generator",
  "negative_prompt": "English negative prompt"
}}
"""
        if effective_key:
            ai_provider = AiProviderFactory.get_provider(effective_provider)
            data = ai_provider.generate_json(prompt_instruction, effective_key, base_url=clean_base)
            return {
                "positive_prompt": data.get("positive_prompt", f"pixel art sprite of {new_character_concept}, {style.get('art_style', '16-bit')}, clean silhouette"),
                "negative_prompt": data.get("negative_prompt", "blurry, 3d render, photo, photorealistic, noise, antialiasing"),
                "technical_notes": data.get("technical_notes", f"Prompt tối ưu hóa theo góc nhìn {target_direction}, bảo lưu phong cách {style.get('art_style', 'Pixel Art')}.")
            }
        else:
            return {
                "positive_prompt": f"masterpiece, full body pixel art sprite of {new_character_concept}, {style.get('art_style', '16-bit SNES style')}, {style.get('outline_style', 'dark selout')}, clean pixel clusters, solid isolated background, game asset",
                "negative_prompt": "blurry, 3d render, photo, photorealistic, jaggies, noise, antialiasing, cut off feet, cropped",
                "technical_notes": f"Prompt tối ưu hóa theo góc nhìn {target_direction}, bảo lưu phong cách {style.get('art_style', '16-bit SNES style')}."
            }

    @staticmethod
    def _resolve_credentials(
        api_key: Optional[str],
        provider: Optional[str],
        base_url: Optional[str]
    ) -> Tuple[Optional[str], str, Optional[str]]:
        """Hàm phụ trợ xác định API Key, Nhà cung cấp và Base URL hiệu dụng."""
        clean_provider = (provider or os.getenv("AI_PROVIDER", "gemini")).lower().strip()
        clean_base = base_url or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

        if clean_provider == "openai":
            key = api_key or os.getenv("OPENAI_API_KEY")
        else:
            key = api_key or os.getenv("GEMINI_API_KEY")

        return key, clean_provider, clean_base

    # ========================================================
    # DỮ LIỆU DỰ PHÒNG NGOẠI TUYẾN (Offline Fallbacks - 0 Token)
    # ========================================================
    @staticmethod
    def _get_offline_fallback_global() -> Dict[str, Any]:
        return {
            "identity": {
                "character_type": "Nhân vật Sprite Pixel Art (Chế độ Ngoại tuyến)",
                "gender_presentation": "Không xác định",
                "body_type": "Chibi / Retro RPG",
                "distinctive_features": ["Thiết kế chuẩn game 2D"],
                "silhouette": "Hình khối cân đối",
                "shape_language": ["Balanced", "Compact"],
                "facial_features": "Khuôn mặt pixel art tối giản",
                "costume_description": "Trang phục phiêu lưu phong cách cổ điển",
                "accessories": ["Trang bị cơ bản"]
            },
            "anatomy": {
                "body_structure": "Humanoid Chibi 2.5 - 3.0 đầu",
                "head_description": "Đầu to rõ nét, chiếm 30-35% chiều cao",
                "torso_description": "Thân trên khối hộp gọn gàng",
                "arm_structure": "Hai tay buông xuôi linh hoạt",
                "leg_structure": "Hai chân ngắn vững chãi",
                "unusual_body_parts": [],
                "identifiable_landmarks": ["Đường cổ", "Thắt lưng", "Gót chân"],
                "relative_limb_placement": "Các chi gắn đối xứng quanh trục thân",
                "anatomical_ambiguities": []
            },
            "pixel_style": {
                "art_style": "16-bit SNES / GBA Classic Pixel Art",
                "outline_style": "Selective outline (Selout) viền sẫm",
                "shading_style": "Cel-shading 3 tông sáng tối",
                "shading_levels": 3,
                "dithering_style": None,
                "pixel_cluster_style": "Chunky readable clusters",
                "detail_density": "Moderate",
                "pixel_cleanliness": "Clean pixel placement",
                "lighting_direction": "Top-left",
                "visual_artifacts": []
            },
            "materials": [
                {
                    "region_name": "Vùng da mặt",
                    "material_type": "Skin",
                    "color_description": "Tone da tự nhiên",
                    "shadow_description": "Bóng ngả cam ấm",
                    "highlight_description": None,
                    "reflectivity": "Matte",
                    "pixel_texture": "Smooth",
                    "shading_description": "Phân mảng phẳng mềm"
                },
                {
                    "region_name": "Trang phục",
                    "material_type": "Cloth",
                    "color_description": "Màu sắc chủ đạo theo sprite",
                    "shadow_description": "Bóng đậm tạo nếp gấp",
                    "highlight_description": None,
                    "reflectivity": "Matte",
                    "pixel_texture": "Fabric",
                    "shading_description": "Đổ bóng mảng 2 cấp độ"
                }
            ]
        }

    @staticmethod
    def _get_offline_fallback_directions() -> Dict[str, Any]:
        def _make_dir(view, orient):
            return {
                "view_type": view,
                "body_orientation": orient,
                "head_orientation": orient,
                "visible_body_parts": ["Đầu", "Thân", "Chi nhìn thấy"],
                "occluded_body_parts": ["Bộ phận phía sau"],
                "visible_accessories": ["Phụ kiện trước"],
                "accessory_placement": "Theo trục cơ thể",
                "silhouette_description": f"Hình dáng đặc trưng góc nhìn {view}",
                "view_specific_features": [f"Chi tiết nổi bật góc {view}"],
                "occlusion_rules": ["Thân trước che thân sau"]
            }
        return {
            "down": _make_dir("Front", "Nhìn trực diện hướng trước"),
            "side": _make_dir("Right Profile", "Ngoảnh ngang 90 độ"),
            "up": _make_dir("Back", "Nhìn từ phía sau lưng")
        }

    @staticmethod
    def _get_offline_fallback_animations() -> Dict[str, Any]:
        def _make_anim_prof(anim_type, count, seq):
            return {
                "animation_type": anim_type,
                "frame_count": count,
                "frame_descriptions": [f"Frame {i+1}: Tư thế {anim_type} nhịp {i+1}" for i in range(count)],
                "moving_body_parts": ["Chân", "Tay"] if anim_type == "Walk" else ["Ngực nhún"],
                "fixed_body_parts": ["Trục đầu"],
                "leg_motion": "Bước chân so le tuần hoàn" if anim_type == "Walk" else "Đứng yên bám sàn",
                "arm_motion": "Vung tay theo bước chân" if anim_type == "Walk" else "Hạ xuôi tự nhiên",
                "secondary_motion": "Tà áo đung đưa nhẹ",
                "motion_sequence": seq,
                "loop_characteristics": f"Seamless loop {count} frame",
                "observed_inconsistencies": []
            }
        dir_anim = {
            "idle": _make_anim_prof("Idle", 3, "F1 -> F2 nhún -> F3 về ban đầu"),
            "walk": _make_anim_prof("Walk", 4, "Chân trái bước -> Thu chân -> Chân phải bước -> Thu chân")
        }
        return {"down": dir_anim, "side": dir_anim, "up": dir_anim}

    @staticmethod
    def _get_offline_fallback_constraints(global_data: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "consistency_analysis": {
                "invariant_features": ["Màu sắc chủ đạo của trang phục", "Tỷ lệ đầu to thân lùn Chibi"],
                "view_dependent_features": ["Khuôn mặt chỉ thấy ở hướng Down", "Lưng thấy ở hướng Up"],
                "animation_dependent_features": ["Độ vung của chân khi bước đi"],
                "detected_inconsistencies": [],
                "preservation_requirements": ["Giữ nguyên phong cách viền Selout và bảng màu gốc"]
            },
            "negative_constraints": {
                "forbidden_design_changes": ["Không tự ý đổi màu nhận diện", "Không biến nhân vật thành tỷ lệ người thật 8 đầu"],
                "visual_defects_to_avoid": ["Tránh viền đen tuyền lem nhem", "Tránh pillow shading", "Tránh hạt pixel mồ côi"],
                "animation_defects_to_avoid": ["Tránh trượt chân (foot sliding)", "Tránh giật khung hình khi lặp vòng"]
            }
        }
