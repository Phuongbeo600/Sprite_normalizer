"""
Module: backend.services.character_analysis_service
Mục đích: Dịch vụ nghiệp vụ phân tích nhân vật pixel art chuyên sâu.
Ai gọi nó: API router `backend.api.v1.character_analysis`.
Tại sao tồn tại: Đóng vai trò nhạc trưởng (Orchestrator) kết hợp 2 tầng:
  1. Tầng Heuristics offline (NumPy, Pillow): đo đạc hệ màu sắc và giải phẫu không tốn token.
  2. Tầng AI Vision online (Gemini, OpenAI): phân tích chi tiết theo 7 Schemas Pydantic.
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
from typing import Dict, Any, Optional, List, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# PIL (Pillow): Thao tác xử lý và ghép nối hình ảnh sprite
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Schemas, Enums & Providers)
# ========================================================
# Schemas và Controlled Vocabulary Enums phân tích nhân vật theo từng phân hệ Tab
from backend.schemas.character import (
    GlobalAnalysis,
    DirectionAnalysis,
    AnimationAnalysis,
    ConsistencyAnalysis,
    NegativeConstraints,
    AIAnalysis,
    PixelArtEra,
    OutlineStyle,
    ShadingStyle,
    DitheringStyle,
    PixelClusterStyle,
    DetailDensity,
    PixelCleanliness,
    LightingDirection,
    GenderPresentation,
    BodyType,
    ShapeLanguage,
    BodyStructure,
    LimbPlacement,
    MaterialType,
    Reflectivity,
    PixelTexture,
    ViewType,
    OrientationAngle,
    AnimationType,
    LoopCharacteristics
)
# AiProviderFactory: Khởi tạo Provider đa hình (Gemini / OpenAI)
from backend.providers.factory import AiProviderFactory
# HeuristicPaletteAnalyzer: Bộ phân tích 6 tiêu chí hệ màu sắc Pixel Art bằng thuật toán toán học NumPy
from backend.core.palette_analyzer import HeuristicPaletteAnalyzer
# PaletteMetrics: Schema kết quả đo lường và phân tích hệ màu sắc
from backend.schemas.character.palette import PaletteMetrics

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
        # Đo đạc 100% chính xác 6 tiêu chuẩn kỹ thuật màu sắc của ảnh Sprite bằng thuật toán Python NumPy
        palette_analyzer = HeuristicPaletteAnalyzer()
        palette_metrics = palette_analyzer.analyze_palette(image)

        if effective_key:
            ai_provider = AiProviderFactory.get_provider(effective_provider)
            raw_data = ai_provider.analyze_vision(image, effective_key, prompt, base_url=clean_base)
            if isinstance(raw_data, dict):
                raw_data["palette_metrics"] = palette_metrics.model_dump()
            # Validate qua Pydantic schema
            validated = GlobalAnalysis.model_validate(raw_data)
            return validated.model_dump()
        else:
            fallback = cls._get_offline_fallback_global()
            fallback["palette_metrics"] = palette_metrics.model_dump()
            return fallback

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
        outfit_and_colors: Optional[str] = None,
        weapons_and_props: Optional[str] = None,
        stature_rule: str = "Bằng nhân vật gốc (Tỷ lệ chuẩn)",
        inherit_scale: bool = True,
        inherit_style: bool = True,
        metrics: Optional[Dict[str, Any]] = None,
        api_key: Optional[str] = None,
        provider: str = "gemini",
        base_url: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Sinh Prompt hình ảnh tối ưu dựa trên toàn bộ DNA của Hồ sơ nhân vật (Character Profile):
        TÁCH BẠCH RẠCH RÒI 2 LUỒNG DỮ LIỆU:
        1. Ý tưởng mới (New Concept): Do người dùng tự do nhập (Pháp sư, Ninja, Quái vật...).
           -> Trang phục, màu sắc, vũ khí 100% là của con mới, KHÔNG bị gán cứng vào hiệp sĩ/kiếm/giáp cũ.
        2. Quy chuẩn kỹ thuật (Technical Blueprint): Kế thừa từ nhân vật tham chiếu.
           -> Tỷ lệ kích thước vào game không to không bé, nét viền pixel, số bậc đổ bóng, góc nhìn, che khuất.
        """
        effective_key, effective_provider, clean_base = cls._resolve_credentials(api_key, provider, base_url)

        # 1. Trích xuất thông tin nhân vật tham chiếu (Chỉ lấy quy chuẩn kỹ thuật, không lấy trang phục/vũ khí)
        global_data = profile_data.get("global_analysis", {}) or {}
        identity_data = global_data.get("identity", {}) or {}
        anatomy_data = global_data.get("anatomy", {}) or {}
        pixel_style_data = global_data.get("pixel_style", {}) or {}
        materials_data = global_data.get("materials", []) or []

        # 2. Xác định góc nhìn mục tiêu và quy tắc che khuất từ Phân hệ 2 (Directions)
        direction_data = profile_data.get("direction_analysis", {}) or {}
        clean_target_lower = (target_direction or "").lower()
        if "side" in clean_target_lower or "profile" in clean_target_lower:
            dir_key = "side"
        elif "back" in clean_target_lower or "up" in clean_target_lower:
            dir_key = "up"
        else:
            dir_key = "down"

        direction_profile = direction_data.get(dir_key, {}) or {}

        # 3. Trích xuất Phân hệ 4 (Consistency & Negative Constraints)
        consistency_data = profile_data.get("consistency_analysis", {}) or {}
        negative_data = profile_data.get("negative_constraints", {}) or {}

        # ========================================================
        # A. XỬ LÝ DỮ LIỆU CỦA NHÂN VẬT MỚI (NEW CHARACTER DATA)
        # ========================================================
        clean_concept = (new_character_concept or "").strip() or "Pixel Art Character"
        clean_outfit = (outfit_and_colors or "").strip() if outfit_and_colors else ""
        clean_weapons = (weapons_and_props or "").strip() if weapons_and_props else ""

        # Quy chuẩn vóc dáng (Stature)
        base_body_type = identity_data.get("body_type") or "Chibi / Stylized Proportions"
        if "To hơn" in stature_rule or "Chibi hơn" in stature_rule:
            stature_desc = "Cute oversized head, compact chibi proportions (2.0 heads tall)"
        elif "Nhỏ hơn" in stature_rule or "Dáng cao" in stature_rule:
            stature_desc = "Taller elongated proportions, semi-heroic stature (4.0 - 5.0 heads tall)"
        elif "Rộng hơn" in stature_rule or "Cơ bắp" in stature_rule:
            stature_desc = "Broad-shouldered, muscular stocky build"
        elif "Hẹp hơn" in stature_rule or "Thon" in stature_rule:
            stature_desc = "Slender, lean nimble build"
        else:
            stature_desc = f"{base_body_type} proportion, {identity_data.get('shape_language', 'balanced compact silhouette')}"

        # ========================================================
        # B. QUY CHUẨN KỸ THUẬT KẾ THỪA TỪ NHÂN VẬT THAM CHIẾU
        # ========================================================
        # Tỷ lệ kích thước game (Geometric Scale Blueprint)
        scale_guidance = ""
        if inherit_scale:
            if metrics:
                char_h = metrics.get("anatomical_height") or metrics.get("visible_height", 48)
                heads_tall = metrics.get("heads_tall", 3.0)
                scale_guidance = (
                    f"Scale constraint: Character height ~{char_h}px relative ratio, "
                    f"proportional head-to-body ratio {heads_tall:.1f} heads tall, "
                    f"full-body framing occupying exactly 80% canvas height, feet aligned to ground baseline"
                )
            else:
                scale_guidance = "Scale constraint: Standard 2D game sprite framing, character occupying 80% canvas height, grounded feet"

        # Quy chuẩn đồ họa Pixel (Pixel Art Blueprint)
        art_style = pixel_style_data.get("art_style") or "16-bit retro console pixel art"
        outline_style = pixel_style_data.get("outline_style") or "Selective dark outline (selout)"
        shading_style = pixel_style_data.get("shading_style") or "Cel-shading with hue-shifting"
        shading_levels = pixel_style_data.get("shading_levels") or 3
        dithering_style = pixel_style_data.get("dithering_style") or "Clean clusters, no heavy dithering"
        cluster_style = pixel_style_data.get("pixel_cluster_style") or "Crisp, intentional pixel clusters without stray noise"
        lighting_dir = pixel_style_data.get("lighting_direction") or "Top-left directional light (45 degrees)"

        # Quy tắc góc nhìn và che khuất (Perspective & Occlusion)
        view_type = direction_profile.get("view_type") or target_direction
        body_orient = direction_profile.get("body_orientation") or "Facing forward"
        head_orient = direction_profile.get("head_orientation") or "Facing forward"
        limb_placement = anatomy_data.get("relative_limb_placement") or "Grounded stance"
        occlusion_rules = ", ".join(direction_profile.get("occlusion_rules", [])[:3]) or "Layer held accessories naturally over body"

        # Lỗi cấm kỵ (Negative Constraints)
        visual_defects = negative_data.get("visual_defects_to_avoid", []) or [
            "Pillow shading", "Banding", "Orphan stray pixels", "Dithering noise", "Mixed pixel resolutions"
        ]
        visual_defects_str = ", ".join(visual_defects[:5])

        # ========================================================
        # C. SINH PROMPT THÔNG QUA AI VISION / LLM (NẾU CÓ KEY)
        # ========================================================
        prompt_instruction = f"""
You are a Lead Art Director & Prompt Engineer specializing in 2D Pixel Art game asset creation.
Your task is to generate a POSITIVE PROMPT and NEGATIVE PROMPT for modern generative AI (Midjourney v6, SDXL, DALL-E 3) to create a BRAND NEW CHARACTER:

NEW CHARACTER SPECIFICATIONS (CUSTOM REQUEST):
- Core Identity / Subject: {clean_concept}
- Desired Outfit & Colors: {clean_outfit if clean_outfit else "Design an authentic, stylish outfit fitting this character concept"}
- Desired Weapons & Props: {clean_weapons if clean_weapons else "Equip fitting props/weapons matching this concept (or bare hands if unarmed)"}
- Body Stature Rule: {stature_desc}

TECHNICAL RENDERING BLUEPRINT (INHERITED FROM GAME DESIGN SYSTEM):
- Target Perspective: {view_type} (Body {body_orient}, Head {head_orient}, Stance: {limb_placement})
- Layering / Occlusion Rules: {occlusion_rules}
- Game Canvas Scale: {scale_guidance if inherit_scale else "Standard full body framing"}
- Pixel Art Style: {art_style if inherit_style else "Retro pixel art"}
- Outline Rule: {outline_style}
- Shading Rule: {shading_style} ({shading_levels} distinct shades)
- Lighting Angle: {lighting_dir}
- Cluster Rule: {cluster_style}, {dithering_style}
- Forbidden Defects: {visual_defects_str}

CRITICAL INSTRUCTIONS:
1. DO NOT copy swords, armor, or knight gear from the reference character unless explicitly requested in the New Character Specifications.
2. The Positive Prompt MUST describe the NEW character ({clean_concept}) with its own outfit and weapon, while strictly obeying the perspective, pixel technique, shading, and canvas scale rules.
3. The Negative Prompt MUST aggressively filter out realistic 3D renders, blurry art, pillow shading, banding, stray orphan noise, and cut-off feet.
4. Include concise Vietnamese technical notes summarizing how the new character was mapped into the game's design system.

Return ONLY a valid JSON object:
{{
  "positive_prompt": "Ultra-detailed English positive prompt...",
  "negative_prompt": "Exhaustive English negative prompt...",
  "technical_notes": "Tóm tắt ngắn gọn bằng tiếng Việt..."
}}
"""
        if effective_key:
            try:
                ai_provider = AiProviderFactory.get_provider(effective_provider)
                ai_response_data = ai_provider.generate_json(prompt_instruction, effective_key, base_url=clean_base)
                ai_positive_prompt = ai_response_data.get("positive_prompt")
                ai_negative_prompt = ai_response_data.get("negative_prompt")
                ai_technical_notes = ai_response_data.get("technical_notes")
                if ai_positive_prompt and ai_negative_prompt:
                    return {
                        "positive_prompt": ai_positive_prompt,
                        "negative_prompt": ai_negative_prompt,
                        "technical_notes": ai_technical_notes or f"Prompt tối ưu hóa cho nhân vật mới ({clean_concept}), kế thừa góc nhìn {view_type} và phong cách {art_style}."
                    }
            except Exception as exc:
                logging.warning(
                    f"Không thể sinh prompt qua AI Provider '{effective_provider}': {exc}. Tự động chuyển sang chế độ ngoại tuyến."
                )

        # ========================================================
        # D. BỘ MÁY TỔNG HỢP PROMPT NGOẠI TUYẾN (OFFLINE ENGINE - 0 TOKEN)
        # ========================================================
        outfit_part = f"wearing {clean_outfit}, " if clean_outfit else ""
        weapon_part = f"holding {clean_weapons}, " if clean_weapons else ""

        offline_pos = (
            f"masterpiece, best quality, standalone full body 2D pixel art character sprite of {clean_concept}, "
            f"{outfit_part}{weapon_part}"
            f"exact {view_type} angle, body {body_orient}, head {head_orient}, {limb_placement}, "
            f"{stature_desc}, "
            f"authentic {art_style}, crisp {outline_style}, professional {shading_style} with {shading_levels} distinct shades, "
            f"{lighting_dir} casting dynamic directional shadows, {cluster_style}, {dithering_style}, "
            f"{scale_guidance}, "
            f"perfect 1x pixel grid alignment, crisp sharp edges, solid isolated neutral dark background, game asset sprite sheet ready"
        )

        offline_neg = (
            f"blurry, 3d render, realistic photograph, vector illustration, smooth gradients, anti-aliasing blur, "
            f"pillow shading, color banding, stray orphan noise pixels, messy dithering, mixed pixel resolutions, non-pixel art, "
            f"{visual_defects_str}, "
            f"cropped, cut off feet, out of frame, awkward anatomy, extra limbs, mutated hands, multiple views, text, watermark, signature"
        )

        tech_notes_lines = [
            f"🛡️ [BỘ MÁY TỔNG HỢP PROMPT NHÂN VẬT MỚI]:",
            f"• Ý tưởng nhân vật mới: {clean_concept}",
            f"• Trang phục & Vũ khí riêng: {clean_outfit or 'Theo concept'} | {clean_weapons or 'Tự do'}",
            f"• Vóc dáng: {stature_desc}",
            f"• Kế thừa góc nhìn: {view_type} (Đầu {head_orient}, Thân {body_orient})",
            f"• Kế thừa kỹ thuật đồ họa: {art_style} (Viền: {outline_style}, Đổ bóng: {shading_style} {shading_levels} bậc sáng)",
            f"• Khống chế tỷ lệ game: {scale_guidance or 'Chuẩn hóa tỷ lệ'}"
        ]

        return {
            "positive_prompt": offline_pos,
            "negative_prompt": offline_neg,
            "technical_notes": "\n".join(tech_notes_lines)
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
        """Tạo dữ liệu phân tích toàn cục dự phòng ngoại tuyến chuẩn theo Controlled Vocabulary Enums."""
        return {
            "identity": {
                "character_type": "Nhân vật Sprite Pixel Art (Chế độ Ngoại tuyến)",
                "gender_presentation": GenderPresentation.UNSPECIFIED.value,
                "body_type": BodyType.CHIBI.value,
                "distinctive_features": ["Thiết kế chuẩn game 2D"],
                "silhouette": "Hình khối cân đối",
                "shape_language": [ShapeLanguage.ROUNDED.value, ShapeLanguage.HEAVY_BLOCK.value],
                "facial_features": "Khuôn mặt pixel art tối giản",
                "costume_description": "Trang phục phiêu lưu phong cách cổ điển",
                "accessories": ["Trang bị cơ bản"]
            },
            "anatomy": {
                "body_structure": BodyStructure.CHIBI_HUMANOID.value,
                "head_description": "Đầu to rõ nét, chiếm 30-35% chiều cao",
                "torso_description": "Thân trên khối hộp gọn gàng",
                "arm_structure": "Hai tay buông xuôi linh hoạt",
                "leg_structure": "Hai chân ngắn vững chãi",
                "unusual_body_parts": [],
                "identifiable_landmarks": ["Đường cổ", "Thắt lưng", "Gót chân"],
                "relative_limb_placement": LimbPlacement.GROUNDED_NEUTRAL.value,
                "anatomical_ambiguities": []
            },
            "pixel_style": {
                "art_style": PixelArtEra.CLASSIC_16BIT.value,
                "outline_style": OutlineStyle.SELECTIVE_OUTLINE.value,
                "shading_style": ShadingStyle.CEL_SHADING.value,
                "shading_levels": 3,
                "dithering_style": DitheringStyle.NONE.value,
                "pixel_cluster_style": PixelClusterStyle.CHUNKY_CLUSTERS.value,
                "detail_density": DetailDensity.MODERATE.value,
                "pixel_cleanliness": PixelCleanliness.VERY_CLEAN.value,
                "lighting_direction": LightingDirection.TOP_LEFT.value,
                "visual_artifacts": []
            },
            "materials": [
                {
                    "region_name": "Vùng da mặt",
                    "material_type": MaterialType.SKIN.value,
                    "color_description": "Tone da tự nhiên",
                    "shadow_description": "Bóng ngả cam ấm",
                    "highlight_description": None,
                    "reflectivity": Reflectivity.MATTE.value,
                    "pixel_texture": PixelTexture.SMOOTH.value,
                    "shading_description": "Phân mảng phẳng mềm"
                },
                {
                    "region_name": "Trang phục",
                    "material_type": MaterialType.CLOTH.value,
                    "color_description": "Màu sắc chủ đạo theo sprite",
                    "shadow_description": "Bóng đậm tạo nếp gấp",
                    "highlight_description": None,
                    "reflectivity": Reflectivity.MATTE.value,
                    "pixel_texture": PixelTexture.FIBROUS.value,
                    "shading_description": "Đổ bóng mảng 2 cấp độ"
                }
            ]
        }

    @staticmethod
    def _get_offline_fallback_directions() -> Dict[str, Any]:
        """Tạo dữ liệu 3 hướng nhìn dự phòng ngoại tuyến chuẩn theo ViewType và OrientationAngle Enums."""
        def _make_dir(view, orient):
            return {
                "view_type": view.value,
                "body_orientation": orient.value,
                "head_orientation": orient.value,
                "visible_body_parts": ["Đầu", "Thân", "Chi nhìn thấy"],
                "occluded_body_parts": ["Bộ phận phía sau"],
                "visible_accessories": ["Phụ kiện trước"],
                "accessory_placement": "Theo trục cơ thể",
                "silhouette_description": f"Hình dáng đặc trưng góc nhìn {view.value}",
                "view_specific_features": [f"Chi tiết nổi bật góc {view.value}"],
                "occlusion_rules": ["Thân trước che thân sau"]
            }
        return {
            "down": _make_dir(ViewType.FRONT, OrientationAngle.FRONT_FACING),
            "side": _make_dir(ViewType.RIGHT_PROFILE, OrientationAngle.RIGHT_PROFILE),
            "up": _make_dir(ViewType.BACK, OrientationAngle.BACK_FACING)
        }

    @staticmethod
    def _get_offline_fallback_animations() -> Dict[str, Any]:
        """Tạo dữ liệu hoạt họa dự phòng ngoại tuyến chuẩn theo AnimationType và LoopCharacteristics Enums."""
        def _make_anim_prof(anim_type, count, seq, loop_char=LoopCharacteristics.SEAMLESS):
            return {
                "animation_type": anim_type.value,
                "frame_count": count,
                "frame_descriptions": [f"Frame {i+1}: Tư thế {anim_type.value} nhịp {i+1}" for i in range(count)],
                "moving_body_parts": ["Chân", "Tay"] if anim_type == AnimationType.WALK else ["Ngực nhún"],
                "fixed_body_parts": ["Trục đầu"],
                "leg_motion": "Bước chân so le tuần hoàn" if anim_type == AnimationType.WALK else "Đứng yên bám sàn",
                "arm_motion": "Vung tay theo bước chân" if anim_type == AnimationType.WALK else "Hạ xuôi tự nhiên",
                "secondary_motion": "Tà áo đung đưa nhẹ",
                "motion_sequence": seq,
                "loop_characteristics": loop_char.value,
                "observed_inconsistencies": []
            }
        dir_anim = {
            "idle": _make_anim_prof(AnimationType.IDLE, 3, "F1 -> F2 nhún -> F3 về ban đầu"),
            "walk": _make_anim_prof(AnimationType.WALK, 4, "Chân trái bước -> Thu chân -> Chân phải bước -> Thu chân")
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
