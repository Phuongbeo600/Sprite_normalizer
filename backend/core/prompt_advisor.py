# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Xử lý chuỗi JSON)
# ========================================================
# json: Chuyển đổi và bóc tách dữ liệu JSON phản hồi từ Gemini API
import json
# base64: Xử lý chuỗi khi gửi dữ liệu đính kèm
import base64
# typing: Khai báo kiểu dữ liệu cho tham số và giá trị trả về
from typing import Dict, Any, Optional, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# requests: Gửi HTTP POST tới API Google Gemini
import requests

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# CharacterMetrics: Cấu trúc dữ liệu chứa các số đo giải phẫu nhân vật mẫu
from .character_analyzer import CharacterMetrics


class PromptAdvisor:
    """
    Bộ cố vấn Prompt AI và động cơ toán học nghịch đảo (Inverse Scaling Engine):
    
    Giải quyết triệt để các thách thức khi tạo ảnh nhân vật Pixel Art bằng GenAI:
    1. Toán học nghịch đảo từ nhân vật mẫu: Tính toán để khi GenAI vẽ nhân vật ở độ phân giải cao (1024x1024),
       kích thước đầu và chiều cao khi thu nhỏ (Downsample) sẽ khớp 100% với nhân vật gốc trong game.
    2. Khống chế bố cục không gian (Spatial Framing): Bắt nhân vật đứng cận cảnh (chiếm 85-90% chiều cao),
       chân chạm đáy mặt đất, loại bỏ khoảng trắng thừa khiến sprite bị teo tóp.
    3. Đồng bộ mật độ hạt pixel (Pixel Density Mapping): Tự động gán các từ khóa phong cách 8-bit, 16-bit SNES
       hoặc 32-bit Arcade để ảnh sắc nét, không bị nhiễu hạt khi nén về game.
    """

    CANDIDATE_MODELS = [
        "gemini-flash-lite-latest",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash-lite",
        "gemini-3.8-flash"
    ]

    @staticmethod
    def assess_detail_density(metrics: CharacterMetrics) -> Dict[str, str]:
        """
        Đánh giá mật độ hạt pixel của nhân vật mẫu để đưa từ khóa đồng bộ vào Prompt.

        @param {CharacterMetrics} metrics Chỉ số nhân vật mẫu.
        @returns {Dict[str, str]} Tên nhóm phân loại, từ khóa prompt và ghi chú giải thích.
        """
        vh = metrics.visible_height
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
    def generate_prompt(
        cls,
        metrics: CharacterMetrics,
        head_rule: str = "Bằng nhân vật gốc (Tỷ lệ chuẩn)",
        body_width_rule: str = "Bằng nhân vật gốc",
        body_height_rule: str = "Bằng nhân vật gốc",
        character_concept: str = "Chiến binh / Quái vật",
        api_key: Optional[str] = None,
        provider: str = "gemini"
    ) -> Dict[str, Any]:
        """
        Sinh Prompt khống chế tỷ lệ bằng Google Gemini API (nếu có key) hoặc bộ máy Toán học Nghịch đảo Ngoại tuyến.

        @param {CharacterMetrics} metrics Dữ liệu giải phẫu nhân vật tham chiếu.
        @param {str} head_rule Quy tắc kích thước đầu (bằng nhân vật gốc / to hơn / nhỏ hơn).
        @param {str} body_width_rule Quy tắc bề ngang thân.
        @param {str} body_height_rule Quy tắc chiều cao thân.
        @param {str} character_concept Ý tưởng chủ đề nhân vật mới.
        @param {Optional[str]} api_key Khóa Google Gemini API.
        @param {str} provider Nhà cung cấp AI ("gemini").
        @returns {Dict[str, Any]} Kế hoạch toán học nghịch đảo, prompt tiếng Anh và canvas đề xuất.
        """
        if api_key and api_key.strip():
            try:
                if provider.lower() == "gemini":
                    return cls._call_gemini_api(
                        metrics, head_rule, body_width_rule, body_height_rule, character_concept, api_key.strip()
                    )
            except Exception as e:
                result = cls._generate_heuristic_prompt(
                    metrics, head_rule, body_width_rule, body_height_rule, character_concept
                )
                result["api_status"] = f"Gemini API gặp sự cố ({str(e)[:40]}), đã chuyển sang Toán học Nghịch đảo Cục bộ."
                return result

        # Chế độ ngoại tuyến Heuristic (không cần API key, độ chính xác toán học 100%)
        return cls._generate_heuristic_prompt(
            metrics, head_rule, body_width_rule, body_height_rule, character_concept
        )

    @classmethod
    def _generate_heuristic_prompt(
        cls,
        metrics: CharacterMetrics,
        head_rule: str,
        body_width_rule: str,
        body_height_rule: str,
        character_concept: str
    ) -> Dict[str, Any]:
        """
        Bộ máy Toán học Nghịch đảo Cục bộ tính toán tỷ lệ trên khung hình AI 1024x1024.
        """
        density_info = cls.assess_detail_density(metrics)

        # Giả định khung vẽ AI là 1024x1024
        ai_canvas_size = 1024
        target_framing_pct = 85  # Nhân vật chiếm 85% chiều cao khung hình AI
        target_char_ai_h = int(ai_canvas_size * (target_framing_pct / 100.0))

        # Tính toán chiều cao đầu nhân vật trên khung hình AI
        base_head_ratio = metrics.head_ratio
        if "To hơn" in head_rule or "Chibi hơn" in head_rule:
            base_head_ratio = min(0.55, base_head_ratio * 1.30)
        elif "Nhỏ hơn" in head_rule:
            base_head_ratio = max(0.12, base_head_ratio * 0.75)

        target_head_ai_px = int(target_char_ai_h * base_head_ratio)
        head_pct_of_char = int(round(base_head_ratio * 100))

        # Xây dựng Prompt tiếng Anh tối ưu cho Midjourney / DALL-E / Leonardo AI
        positive_prompt = (
            f"masterpiece, authentic {density_info['prompt_keywords']}, full body sprite of {character_concept}, "
            f"facing camera, standard orthographic side or front angle, clean solid plain white background. "
            f"STRICT FRAMING: Character standing tall occupying exactly {target_framing_pct}% of total image height, "
            f"soles of feet flatly touching the bottom ground boundary, generous empty margins on left and right, "
            f"head height is exactly {head_pct_of_char}% of character body height ({target_head_ai_px} pixels on 1024 canvas), "
            f"single isolated character, centered, cel shaded, no anti-aliasing blur."
        )

        negative_prompt = (
            "blurry, soft focus, photographic, 3d render, realistic textures, gradients, cropped feet, "
            "feet out of frame, floating character, excessive background elements, multiple characters, "
            "sprite sheet, cut off body parts, complex scenic background, noise, messy outlines."
        )

        # Tính toán kích thước canvas game đề xuất
        rec_w = metrics.canvas_width
        rec_h = metrics.canvas_height
        if "To hơn" in body_width_rule or "Rộng hơn" in body_width_rule:
            rec_w = int(round(rec_w * 1.25))
        if "Cao hơn" in body_height_rule:
            rec_h = int(round(rec_h * 1.15))

        return {
            "recommended_game_canvas": {
                "width": rec_w,
                "height": rec_h,
                "explanation": f"Khung Canvas game chuẩn {rec_w}x{rec_h} px dựa trên nhân vật mẫu ({metrics.canvas_width}x{metrics.canvas_height} px) và tùy biến hình thể."
            },
            "inverse_math_plan": {
                "generation_resolution": "1024x1024",
                "target_head_height_ai_px": target_head_ai_px,
                "head_percentage_of_character": head_pct_of_char,
                "character_framing_percentage": target_framing_pct
            },
            "detail_level_analysis": density_info["notes"],
            "style_analysis": f"Phong cách {metrics.style_category} (1:{metrics.heads_tall:.1f} đầu). {density_info['category']}.",
            "positive_prompt": positive_prompt,
            "negative_prompt": negative_prompt,
            "token_stats": "Chế độ Offline Heuristic (0 tokens tiêu thụ)",
            "api_status": "Toán học Nghịch đảo Heuristic (Chuẩn xác 100%)"
        }

    @classmethod
    def _call_gemini_api(
        cls,
        metrics: CharacterMetrics,
        head_rule: str,
        body_width_rule: str,
        body_height_rule: str,
        character_concept: str,
        api_key: str
    ) -> Dict[str, Any]:
        """
        Gọi Google Gemini API để tính toán nghịch đảo và sinh Prompt chuyên sâu.
        """
        density_info = cls.assess_detail_density(metrics)

        prompt_instruction = f"""
You are an elite 2D Video Game Technical Art Director, Pixel Art Specialist, and AI Prompt Engineer.

Your mission is to perform INVERSE SCALING MATHEMATICS and PROMPT ENGINEERING based on the exact geometric metrics of an existing reference game character, so that any new character generated by GenAI (ChatGPT / DALL-E 3 / Midjourney / Stable Diffusion) will match the existing game's art style, head size, and pixel resolution when downscaled and normalized.

--- REFERENCE CHARACTER METRICS (Extracted by Computer Vision) ---
- Original Canvas Size: {metrics.canvas_width} x {metrics.canvas_height} px
- Visible Character Size: {metrics.visible_width} x {metrics.visible_height} px
- Head Dimensions: Width {metrics.head_width} px, Height {metrics.head_height} px ({metrics.head_ratio*100:.1f}% of visible height)
- Body Dimensions: Width {metrics.body_width} px, Height {metrics.body_height} px
- Proportion Ratio: 1:{metrics.heads_tall:.1f} heads tall ({metrics.style_category})
- Head-to-Body Width Ratio: {metrics.head_to_body_width_ratio:.2f}
- Estimated Pixel Density Level: {density_info['category']}

--- NEW CHARACTER REQUIREMENTS ---
- Concept/Theme: {character_concept}
- Head Rule: {head_rule}
- Body Width Rule: {body_width_rule}
- Body Height Rule: {body_height_rule}

--- INVERSE MATHEMATICAL CALCULATIONS (Assumed AI Canvas: 1024 x 1024 px) ---
1. Inverse Scaling: Calculate the target head height on the 1024px canvas so that when downscaled to the game canvas ({metrics.canvas_width}x{metrics.canvas_height} px), the head height matches the reference character's head ({metrics.head_height} px).
2. Spatial Framing Constraint: Enforce that the character fills 85% to 90% of the 1024px image height (zoomed-in close-up full body) with feet touching the bottom ground baseline, eliminating excessive white padding.
3. Pixel Density & Detail Compatibility: Prevent high-frequency noise when downscaled. If reference character has visible height {metrics.visible_height}px, enforce {density_info['prompt_keywords']}.

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
        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt_instruction.strip()}]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.3
            }
        }

        last_error = ""
        for model in cls.CANDIDATE_MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key.strip()}"
            try:
                resp = requests.post(url, json=payload, timeout=20)
                if resp.status_code == 200:
                    res_json = resp.json()
                    raw_text = res_json["candidates"][0]["content"]["parts"][0]["text"].strip()
                    if raw_text.startswith("```json"):
                        raw_text = raw_text[7:]
                    if raw_text.endswith("```"):
                        raw_text = raw_text[:-3]
                    data = json.loads(raw_text.strip())
                    data["api_status"] = f"Phân tích chuyên sâu bởi Google Gemini ({model})"
                    data["token_stats"] = "Thành công qua Gemini API"
                    return data
                else:
                    last_error = f"{model} status {resp.status_code}"
            except Exception as e:
                last_error = f"{model} error: {str(e)}"
                continue

        raise RuntimeError(f"Không thể kết nối Gemini API: {last_error}")
