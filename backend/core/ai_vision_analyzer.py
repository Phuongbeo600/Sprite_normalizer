# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Xử lý chuỗi nhị phân)
# ========================================================
# os: Đọc biến môi trường hệ thống
import os
# json: Phân tích cú pháp dữ liệu JSON trả về từ API Google Gemini
import json
# base64: Mã hóa hình ảnh sang chuỗi base64 để đính kèm vào payload gửi đi
import base64
# io: Xử lý bộ đệm nhị phân dữ liệu ảnh trong bộ nhớ RAM
import io
# typing: Định nghĩa các kiểu dữ liệu trả về cho hàm
from typing import Dict, Any, Optional, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# requests: Thư viện gửi HTTP request tới REST API của Google Generative AI
import requests
# numpy: Xử lý mảng ma trận pixel đa chiều để thực hiện thuật toán Snap Pixel
import numpy as np
# PIL (Pillow): Mở, resize và chuyển đổi định dạng ảnh
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)


class AiVisionAnalyzer:
    """
    Bộ phân tích thị giác máy tính kết nối Google Gemini Vision API (Visual Grounding).
    
    Khắc phục triệt để các hạn chế của thuật toán hình học truyền thống:
    - Nhận diện đúng hộp sọ & khuôn mặt (loại bỏ vũ khí giơ cao, trượng ma thuật, cánh, sừng).
    - Nhận diện đúng vị trí cổ sinh học (kể cả khi bị che khuất bởi giáp vai to, râu dài hoặc khăn choàng).
    - Nhận diện đúng điểm hông/háng và điểm tiếp đất của bàn chân.
    - Hút (Snap) tọa độ chuẩn hóa từ AI vào ma trận Alpha Mask để giữ độ chính xác tuyệt đối.
    """

    CANDIDATE_MODELS = [
        "gemini-flash-lite-latest",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash-lite",
        "gemini-3.8-flash"
    ]
    API_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    @classmethod
    def call_gemini_vision(cls, image: Image.Image, api_key: str) -> Dict[str, Any]:
        """
        Gửi ảnh Sprite lên Google Gemini Vision kèm cơ chế tự động Fallback qua danh sách Model.

        @param {Image.Image} image Ảnh sprite cần phân tích.
        @param {str} api_key Khóa Google Gemini API.
        @returns {Dict[str, Any]} Dữ liệu JSON chứa tọa độ chuẩn hóa (0-1000) của hộp sọ, cổ, hông, đất.
        """
        if not api_key or not api_key.strip():
            raise ValueError("Chưa cấu hình Google Gemini API Key.")

        # Chuẩn bị dữ liệu ảnh base64 gửi đi
        # Nếu ảnh lớn hơn 512px thì thu nhỏ tạm thời để gửi nhanh hơn (tọa độ tỷ lệ 0-1000 không đổi)
        buffered = io.BytesIO()
        image_to_send = image.convert("RGBA")
        max_dim = max(image_to_send.size)
        if max_dim > 512:
            scale_send = 512.0 / max_dim
            sw = max(1, int(round(image_to_send.width * scale_send)))
            sh = max(1, int(round(image_to_send.height * scale_send)))
            image_to_send = image_to_send.resize((sw, sh), Image.Resampling.BILINEAR)

        image_to_send.save(buffered, format="PNG")
        img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

        prompt = """
You are an expert in 2D video game pixel art character anatomy, sprite sheets, and character design.
Analyze the 2D character sprite in this image.

Your task is to detect the EXACT anatomical landmarks of the core body, STRICTLY IGNORING any tall held weapons (swords, axes, staves, spears), floating wings, capes blowing in the wind, or empty background space:

1. "head_box": [ymin, xmin, ymax, xmax] coordinates normalized from 0 to 1000 enclosing ONLY the actual head, face, and hair/helmet. (DO NOT expand this box to weapons held next to or above the head).
2. "neck_y": integer normalized from 0 to 1000 representing the vertical Y line of the neck (the junction between chin/jawline and collarbones/shoulders). If covered by armor or beard, estimate the true biological neck position.
3. "crotch_y": integer normalized from 0 to 1000 representing the vertical Y line of the hips/crotch where legs split from the torso (even if covered by a skirt, robe, or armor).
4. "ground_y": integer normalized from 0 to 1000 representing the vertical Y line of the lowest foot contacting the ground surface.
5. "character_archetype": short string describing the character (e.g. "Warrior with sword", "Mage", "Monster", "Chibi rogue").
6. "anatomy_notes": short 1-2 sentence assessment in Vietnamese of proportions and clothing/weapons.

Return ONLY a valid JSON object matching this schema without any markdown surrounding text:
{
  "head_box": [ymin, xmin, ymax, xmax],
  "neck_y": int,
  "crotch_y": int,
  "ground_y": int,
  "character_archetype": str,
  "anatomy_notes": str
}
"""

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt.strip()},
                        {
                            "inline_data": {
                                "mime_type": "image/png",
                                "data": img_b64
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.1
            }
        }

        last_error = ""
        # Thử lần lượt các model trong danh sách fallback
        for model in cls.CANDIDATE_MODELS:
            url = cls.API_URL_TEMPLATE.format(model=model, api_key=api_key.strip())
            try:
                resp = requests.post(url, json=payload, timeout=20)
                if resp.status_code == 200:
                    res_json = resp.json()
                    raw_text = res_json["candidates"][0]["content"]["parts"][0]["text"].strip()
                    # Làm sạch markdown json nếu có
                    if raw_text.startswith("```json"):
                        raw_text = raw_text[7:]
                    if raw_text.endswith("```"):
                        raw_text = raw_text[:-3]
                    data = json.loads(raw_text.strip())
                    data["model_used"] = model
                    return data
                else:
                    last_error = f"{model} status {resp.status_code}: {resp.text[:100]}"
            except Exception as e:
                last_error = f"{model} error: {str(e)}"
                continue

        raise RuntimeError(f"Tất cả các Model Gemini Vision đều không phản hồi: {last_error}")

    @classmethod
    def call_openai_vision(
        cls,
        image: Image.Image,
        api_key: str,
        base_url: str = "https://api.openai.com/v1"
    ) -> Dict[str, Any]:
        """
        Gửi ảnh Sprite lên OpenAI ChatGPT (GPT-4o / GPT-4o-mini Vision) để phân tích giải phẫu học.

        @param {Image.Image} image Ảnh sprite cần phân tích.
        @param {str} api_key Khóa OpenAI API (ChatGPT).
        @param {str} base_url Địa chỉ máy chủ API (mặc định https://api.openai.com/v1 hoặc URL Proxy).
        @returns {Dict[str, Any]} Dữ liệu JSON chứa tọa độ chuẩn hóa (0-1000) của hộp sọ, cổ, hông, đất.
        """
        if not api_key or not api_key.strip():
            raise ValueError("Chưa cấu hình OpenAI API Key (ChatGPT).")

        buffered = io.BytesIO()
        image_to_send = image.convert("RGBA")
        max_dim = max(image_to_send.size)
        if max_dim > 512:
            scale_send = 512.0 / max_dim
            sw = max(1, int(round(image_to_send.width * scale_send)))
            sh = max(1, int(round(image_to_send.height * scale_send)))
            image_to_send = image_to_send.resize((sw, sh), Image.Resampling.BILINEAR)

        image_to_send.save(buffered, format="PNG")
        img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

        prompt = """
You are an expert in 2D video game pixel art character anatomy, sprite sheets, and character design.
Analyze the 2D character sprite in this image.

Your task is to detect the EXACT anatomical landmarks of the core body, STRICTLY IGNORING any tall held weapons (swords, axes, staves, spears), floating wings, capes blowing in the wind, or empty background space:

1. "head_box": [ymin, xmin, ymax, xmax] coordinates normalized from 0 to 1000 enclosing ONLY the actual head, face, and hair/helmet. (DO NOT expand this box to weapons held next to or above the head).
2. "neck_y": integer normalized from 0 to 1000 representing the vertical Y line of the neck (the junction between chin/jawline and collarbones/shoulders). If covered by armor or beard, estimate the true biological neck position.
3. "crotch_y": integer normalized from 0 to 1000 representing the vertical Y line of the hips/crotch where legs split from the torso (even if covered by a skirt, robe, or armor).
4. "ground_y": integer normalized from 0 to 1000 representing the vertical Y line of the lowest foot contacting the ground surface.
5. "character_archetype": short string describing the character (e.g. "Warrior with sword", "Mage", "Monster", "Chibi rogue").
6. "anatomy_notes": short 1-2 sentence assessment in Vietnamese of proportions and clothing/weapons.

Return ONLY a valid JSON object matching this schema:
{
  "head_box": [ymin, xmin, ymax, xmax],
  "neck_y": int,
  "crotch_y": int,
  "ground_y": int,
  "character_archetype": str,
  "anatomy_notes": str
}
"""
        clean_base = base_url.rstrip("/")
        url = f"{clean_base}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key.strip()}",
            "Content-Type": "application/json"
        }

        # Danh sách model OpenAI ưu tiên
        candidate_models = ["gpt-4o-mini", "gpt-4o", "chatgpt-4o-latest"]
        last_error = ""

        for model in candidate_models:
            payload = {
                "model": model,
                "response_format": {"type": "json_object"},
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt.strip()},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{img_b64}"
                                }
                            }
                        ]
                    }
                ],
                "temperature": 0.1
            }

            try:
                resp = requests.post(url, json=payload, headers=headers, timeout=25)
                if resp.status_code == 200:
                    res_json = resp.json()
                    raw_text = res_json["choices"][0]["message"]["content"].strip()
                    data = json.loads(raw_text)
                    data["model_used"] = f"OpenAI {model}"
                    return data
                else:
                    last_error = f"{model} status {resp.status_code}: {resp.text[:100]}"
            except Exception as e:
                last_error = f"{model} error: {str(e)}"
                continue

        raise RuntimeError(f"OpenAI ChatGPT Vision không phản hồi: {last_error}")

    @classmethod
    def snap_and_denormalize(
        cls,
        ai_data: Dict[str, Any],
        image_size: Tuple[int, int],
        mask: np.ndarray
    ) -> Dict[str, Any]:
        """
        Quy đổi tọa độ chuẩn hóa (0-1000) từ Gemini thành tọa độ Pixel thật trên ảnh,
        kết hợp thuật toán Snap (Hút Pixel) trên Alpha Mask để đạt độ chuẩn xác 100%.

        @param {Dict[str, Any]} ai_data Dữ liệu giải phẫu trả về từ AI.
        @param {Tuple[int, int]} image_size Kích thước thực tế của ảnh (width, height).
        @param {np.ndarray} mask Ma trận boolean của nhân vật.
        @returns {Dict[str, Any]} Tọa độ pixel thật đã được snap chính xác.
        """
        w, h = image_size

        # 1. Đổi tọa độ tỷ lệ sang pixel thực tế
        raw_head_box = ai_data.get("head_box", [100, 200, 400, 600])
        head_ymin_px = int(round(raw_head_box[0] / 1000.0 * h))
        head_xmin_px = int(round(raw_head_box[1] / 1000.0 * w))
        head_ymax_px = int(round(raw_head_box[2] / 1000.0 * h))
        head_xmax_px = int(round(raw_head_box[3] / 1000.0 * w))

        neck_raw_px = int(round(ai_data.get("neck_y", 350) / 1000.0 * h))
        crotch_raw_px = int(round(ai_data.get("crotch_y", 650) / 1000.0 * h))
        ground_raw_px = int(round(ai_data.get("ground_y", 950) / 1000.0 * h))

        # Giới hạn trong kích thước ảnh hợp lệ
        head_ymin_px = max(0, min(h - 1, head_ymin_px))
        head_ymax_px = max(head_ymin_px + 1, min(h - 1, head_ymax_px))
        head_xmin_px = max(0, min(w - 1, head_xmin_px))
        head_xmax_px = max(head_xmin_px + 1, min(w - 1, head_xmax_px))

        # 2. Thuật toán Snap vào Pixel Mask thực tế
        y_indices, x_indices = np.where(mask)

        if len(y_indices) > 0:
            char_y_min, char_y_max = int(y_indices.min()), int(y_indices.max())
            char_x_min, char_x_max = int(x_indices.min()), int(x_indices.max())

            # Bàn chân tiếp đất thật luôn là char_y_max
            ground_snapped_px = char_y_max

            # Đỉnh đầu cao nhất có pixel
            true_top_y = char_y_min
            head_ymin_px = min(head_ymin_px, true_top_y)

            # Snap Neck Y: Tìm dòng có bề ngang thắt hẹp nhất quanh bán kính neck_raw_px
            search_start = max(char_y_min + 2, neck_raw_px - 4)
            search_end = min(char_y_max - 2, neck_raw_px + 4)

            if search_end > search_start:
                widths = []
                for y in range(search_start, search_end + 1):
                    xs = np.where(mask[y, :])[0]
                    widths.append(len(xs) if len(xs) > 0 else 9999)
                min_w_idx = int(np.argmin(widths))
                neck_snapped_px = search_start + min_w_idx
            else:
                neck_snapped_px = max(char_y_min + 1, min(char_y_max - 1, neck_raw_px))

            # Snap Head Box: Đảm bảo nằm trong vùng có pixel thực của đầu
            head_pixels_y, head_pixels_x = np.where(mask[true_top_y:neck_snapped_px + 1, :])
            if len(head_pixels_x) > 0:
                snapped_h_xmin = max(char_x_min, head_xmin_px)
                snapped_h_xmax = min(char_x_max, head_xmax_px)
                if snapped_h_xmax <= snapped_h_xmin:
                    snapped_h_xmin = int(head_pixels_x.min())
                    snapped_h_xmax = int(head_pixels_x.max())
            else:
                snapped_h_xmin = head_xmin_px
                snapped_h_xmax = head_xmax_px

            # Snap Crotch Y (Háng/Hông)
            crotch_search_start = max(neck_snapped_px + 2, crotch_raw_px - 5)
            crotch_search_end = min(char_y_max - 2, crotch_raw_px + 5)
            crotch_snapped_px = crotch_raw_px
            if crotch_search_end > crotch_search_start:
                counts = []
                for y in range(crotch_search_start, crotch_search_end + 1):
                    xs = np.where(mask[y, :])[0]
                    counts.append(len(xs) if len(xs) > 0 else 9999)
                crotch_snapped_px = crotch_search_start + int(np.argmin(counts))
            else:
                crotch_snapped_px = max(neck_snapped_px + 2, min(char_y_max - 1, crotch_raw_px))

        else:
            ground_snapped_px = ground_raw_px
            neck_snapped_px = neck_raw_px
            crotch_snapped_px = crotch_raw_px
            snapped_h_xmin = head_xmin_px
            snapped_h_xmax = head_xmax_px

        return {
            "neck_y": neck_snapped_px,
            "crotch_y": crotch_snapped_px,
            "ground_y": ground_snapped_px,
            "head_x_min": snapped_h_xmin,
            "head_x_max": snapped_h_xmax,
            "head_y_min": head_ymin_px,
            "head_y_max": neck_snapped_px,
            "character_archetype": ai_data.get("character_archetype", "Sprite Character"),
            "anatomy_notes": ai_data.get("anatomy_notes", "Đo bằng Google Gemini Vision thành công.")
        }
