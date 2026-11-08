# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc & Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa kiểu từ điển, danh sách
from typing import Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# CharacterMetrics: Dữ liệu giải phẫu nhân vật mẫu
from .character_metrics import CharacterMetrics

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class InverseScalingEngine:
    """
    Động cơ Toán học Nghịch đảo (Inverse Scaling Engine) & Phân tích Mật độ Pixel.
    
    Chịu trách nhiệm:
    1. Đánh giá mật độ hạt pixel của sprite mẫu (8-bit, 16-bit SNES, 32-bit Arcade).
    2. Tính toán tỷ lệ nghịch đảo để khi GenAI vẽ ở kích thước 1024x1024,
       sau khi nén (downsample) về kích thước game gốc, kích thước đầu và chiều cao sẽ khớp 100%.
    3. Tạo bản thiết kế Prompt tiếng Anh tối ưu hóa không gian (Spatial Framing).
    """

    @staticmethod
    def assess_detail_density(metrics: CharacterMetrics) -> Dict[str, str]:
        """
        Đánh giá mật độ hạt pixel của nhân vật mẫu để đưa từ khóa đồng bộ vào Prompt.

        @param {CharacterMetrics} metrics Chỉ số nhân vật mẫu.
        @returns {Dict[str, str]} Tên nhóm phân loại, từ khóa prompt và ghi chú giải thích.
        """
        vh = metrics.anatomical_height or metrics.visible_height
        if vh <= 40:
            return {
                "category": "Micro Pixel Art (8-bit)",
                "prompt_keywords": "clean chunky low-res pixel art, 8-bit retro gaming style, minimal clusters, bold simple shapes, zero micro-textures, flat color fills, thick crisp outlines",
                "notes": f"Nhân vật mẫu rất nhỏ ({vh}px). Prompt được tối ưu để vẽ khối to bản, cấm chi tiết vụn để không bị nát ảnh khi thu nhỏ."
            }
        elif vh <= 75:
            return {
                "category": "Classic Pixel Art (16-bit SNES / GBA)",
                "prompt_keywords": "16-bit retro pixel art, SNES / GBA sprite style, chunky pixel clusters, clean readable silhouettes, cel-shaded with limited color palette, hard shadows, crisp dark outline, no high-frequency noise",
                "notes": f"Nhân vật mẫu cỡ vừa ({vh}px - chuẩn 16-bit). Prompt áp độ bóng cel-shading và màu sắc tương phản rõ rệt."
            }
        elif vh <= 115:
            return {
                "category": "Detailed Pixel Art (32-bit Arcade / Neo-Geo)",
                "prompt_keywords": "detailed 32-bit arcade pixel art, Neo-Geo fighting game sprite aesthetic, expressive readable proportions, clean pixel clustering, controlled dithering, sharp defined borders",
                "notes": f"Nhân vật mẫu cỡ lớn ({vh}px). Prompt cho phép thêm chi tiết áo giáp/vũ khí nhưng vẫn giữ viền sắc nét."
            }
        else:
            return {
                "category": "High-Res Pixel Art",
                "prompt_keywords": "high-resolution 2D pixel art style, crisp contours, rich shading with distinct color ramps, clean outlines, no blur",
                "notes": f"Nhân vật mẫu độ phân giải cao ({vh}px)."
            }

    @classmethod
    def generate_offline_fallback_plan(
        cls,
        metrics: CharacterMetrics,
        head_rule: str,
        body_width_rule: str,
        body_height_rule: str,
        character_concept: str
    ) -> Dict[str, Any]:
        """
        Sinh kế hoạch toán học và prompt ngoại tuyến (Offline Fallback) khi không có mạng hoặc không có API Key.

        @param {CharacterMetrics} metrics Dữ liệu giải phẫu.
        @param {str} head_rule Quy tắc đầu.
        @param {str} body_width_rule Quy tắc thân ngang.
        @param {str} body_height_rule Quy tắc thân dọc.
        @param {str} character_concept Ý tưởng nhân vật mới.
        @returns {Dict[str, Any]} Bản kế hoạch hoàn chỉnh.
        """
        density_info = cls.assess_detail_density(metrics)
        framing_pct = 88
        target_char_h_ai = int(1024 * (framing_pct / 100.0))

        head_mod = 1.0
        if "to hơn" in head_rule.lower() or "lớn" in head_rule.lower():
            head_mod = 1.25
        elif "nhỏ hơn" in head_rule.lower():
            head_mod = 0.85

        target_head_h_ai = int(round(target_char_h_ai * metrics.head_ratio * head_mod))
        head_pct_char = int(round((target_head_h_ai / target_char_h_ai) * 100))

        positive = (
            f"masterpiece, full body sprite of {character_concept}, {density_info['prompt_keywords']}, "
            f"standing centered, zoomed in full body taking up exactly {framing_pct}% of the vertical canvas, "
            f"head height is exactly {target_head_h_ai}px ({head_pct_char}% of character height), "
            f"character feet touching the bottom baseline, completely isolated on solid pure magenta background #FF00FF, "
            f"clean silhouette, game asset, pixel art perfection"
        )
        negative = (
            "blurry, anti-aliased edges, gradient shading, 3d render, photo, photorealistic, "
            "cut off feet, cropped head, small figure, far away, white background, cluttered, low quality"
        )

        return {
            "recommended_game_canvas": {
                "width": metrics.canvas_width,
                "height": metrics.canvas_height,
                "explanation": f"Khung hình chuẩn theo nhân vật mẫu ({metrics.canvas_width}x{metrics.canvas_height} px)."
            },
            "inverse_math_plan": {
                "generation_resolution": "1024x1024",
                "target_head_height_ai_px": target_head_h_ai,
                "head_percentage_of_character": head_pct_char,
                "character_framing_percentage": framing_pct
            },
            "detail_level_analysis": density_info["notes"],
            "style_analysis": f"Phong cách {metrics.style_category}, tỷ lệ 1:{metrics.heads_tall} đầu.",
            "positive_prompt": positive,
            "negative_prompt": negative,
            "api_status": "Tính toán toán học nội bộ (Offline Engine - 0 Token)"
        }

    @classmethod
    def build_ai_prompt_instruction(
        cls,
        metrics: CharacterMetrics,
        head_rule: str,
        body_width_rule: str,
        body_height_rule: str,
        character_concept: str
    ) -> str:
        """
        Xây dựng prompt chỉ dẫn chuyên sâu cho LLM (Gemini/GPT-4o) để tính toán nghịch đảo và sinh Prompt.
        """
        density_info = cls.assess_detail_density(metrics)
        eff_height = metrics.anatomical_height or metrics.visible_height

        return f"""
You are a Lead Technical Pixel Artist and AI Prompt Engineering Director for 2D retro video games.
Your mission is to perform INVERSE SCALING MATHEMATICS to generate a pixel-perfect image generation prompt for DALL-E 3, Midjourney, or Stable Diffusion.

--- REFERENCE CHARACTER SPRITE ANATOMY METRICS ---
- Canvas Dimensions: {metrics.canvas_width} x {metrics.canvas_height} px
- Pure Anatomical Height: {eff_height} px
- Head Dimensions: {metrics.head_width}w x {metrics.head_height}h px
- Body Width: {metrics.body_width} px, Body Height: {metrics.body_height} px
- Biological Proportions: 1:{metrics.heads_tall:.2f} heads tall ({metrics.style_category})
- Detail Density Level: {density_info['category']} ({density_info['notes']})

--- USER CREATIVE CUSTOMIZATION GOALS ---
- Target Character Concept: {character_concept}
- Head Proportion Rule: {head_rule}
- Body Width Rule: {body_width_rule}
- Body Height Rule: {body_height_rule}

--- INVERSE MATHEMATICAL CALCULATIONS (Assumed AI Canvas: 1024 x 1024 px) ---
1. Inverse Scaling: Calculate the target head height on the 1024px canvas so that when downscaled to the game canvas ({metrics.canvas_width}x{metrics.canvas_height} px), the head height matches the reference character's head ({metrics.head_height} px).
2. Spatial Framing Constraint: Enforce that the character fills 85% to 90% of the 1024px image height (zoomed-in close-up full body) with feet touching the bottom ground baseline, eliminating excessive white padding.
3. Pixel Density & Detail Compatibility: Prevent high-frequency noise when downscaled. Enforce: {density_info['prompt_keywords']}.

--- OUTPUT FORMAT ---
Return ONLY a valid JSON object matching this schema:
{{
  "recommended_game_canvas": {{
    "width": int,
    "height": int,
    "explanation": "Vietnamese explanation of why this canvas size is optimal"
  }},
  "inverse_math_plan": {{
    "generation_resolution": "1024x1024",
    "target_head_height_ai_px": int,
    "head_percentage_of_character": int,
    "character_framing_percentage": int
  }},
  "detail_level_analysis": "Vietnamese assessment of pixel density and detail level needed to match the reference sprite without noise when downscaled",
  "style_analysis": "Vietnamese summary of proportions, head-to-body ratio, and visual style",
  "positive_prompt": "English prompt for DALL-E 3 / Midjourney / Stable Diffusion with all spatial framing and anatomical constraints embedded",
  "negative_prompt": "English negative prompt"
}}
"""
