# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Xử lý JSON)
# ========================================================
# json: Phân tích cú pháp dữ liệu JSON từ API phản hồi
import json
# typing: Khai báo kiểu dữ liệu
from typing import Dict, Any, Optional, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# requests: Gửi HTTP POST tới Google Generative Language REST API
import requests
# PIL (Pillow): Mở và chuyển đổi định dạng ảnh
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# BaseAiProvider: Lớp cơ sở trừu tượng
from .base import BaseAiProvider

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class GeminiProvider(BaseAiProvider):
    """
    Hiện thực hóa kết nối tới Google Gemini API (Visual Grounding & Text Generation).
    Hỗ trợ cơ chế tự động xoay vòng danh sách model (Fallback loop) khi gặp quá tải hoặc hạn mức.
    """

    CANDIDATE_MODELS = [
        "gemini-flash-lite-latest",
        "gemini-3.1-flash-lite",
        "gemini-2.5-flash-lite",
        "gemini-3.8-flash"
    ]
    API_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    def test_connection(self, api_key: str, base_url: Optional[str] = None) -> Tuple[bool, str]:
        """
        Kiểm tra nhanh kết nối tới Google Gemini API.

        @param {str} api_key Khóa Google Gemini API.
        @param {Optional[str]} base_url Không bắt buộc với Gemini.
        @returns {Tuple[bool, str]} (Trạng thái kết nối, Thông điệp phản hồi).
        """
        clean_key = (api_key or "").strip()
        if not clean_key:
            return False, "Chưa cung cấp Google Gemini API Key để kiểm tra."

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={clean_key}"
        payload = {
            "contents": [{"parts": [{"text": "ping"}]}],
            "generationConfig": {"maxOutputTokens": 5}
        }

        try:
            resp = requests.post(url, json=payload, timeout=10)
            if resp.status_code == 200:
                return True, "Kết nối thành công! Khóa Google Gemini API hoạt động hoàn hảo."
            return False, f"Google Gemini báo lỗi ({resp.status_code}): {resp.text[:120]}"
        except Exception as e:
            return False, f"Lỗi kết nối mạng tới Google Gemini: {str(e)}"

    def analyze_vision(
        self,
        image: Image.Image,
        api_key: str,
        prompt: str,
        base_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Gửi ảnh Sprite lên Google Gemini Vision kèm cơ chế Fallback qua các model flash.

        @param {Image.Image} image Ảnh sprite.
        @param {str} api_key Khóa API.
        @param {str} prompt Hướng dẫn nhận diện giải phẫu học.
        @param {Optional[str]} base_url Địa chỉ máy chủ tùy chọn.
        @returns {Dict[str, Any]} Dữ liệu JSON bóc tách tọa độ hộp bao.
        """
        clean_key = (api_key or "").strip()
        if not clean_key:
            raise ValueError("Chưa cấu hình Google Gemini API Key.")

        img_b64 = self.encode_image_to_base64(image)

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
        for model in self.CANDIDATE_MODELS:
            url = self.API_URL_TEMPLATE.format(model=model, api_key=clean_key)
            try:
                resp = requests.post(url, json=payload, timeout=20)
                if resp.status_code == 200:
                    raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    cleaned_json = self._clean_json_text(raw_text)
                    data = json.loads(cleaned_json)
                    data["model_used"] = model
                    return data
                last_error = f"{model} status {resp.status_code}: {resp.text[:100]}"
            except Exception as e:
                last_error = f"{model} error: {str(e)}"
                continue

        raise RuntimeError(f"Tất cả các Model Gemini Vision đều không phản hồi: {last_error}")

    def generate_json(
        self,
        prompt: str,
        api_key: str,
        base_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Gửi yêu cầu sinh văn bản có cấu trúc JSON tới Gemini API.

        @param {str} prompt Nội dung yêu cầu tạo prompt hoặc kế hoạch toán học.
        @param {str} api_key Khóa API.
        @param {Optional[str]} base_url Địa chỉ máy chủ.
        @returns {Dict[str, Any]} Đối tượng JSON kết quả.
        """
        clean_key = (api_key or "").strip()
        if not clean_key:
            raise ValueError("Chưa cấu hình Google Gemini API Key.")

        payload = {
            "contents": [{"parts": [{"text": prompt.strip()}]}],
            "generationConfig": {
                "response_mime_type": "application/json",
                "temperature": 0.3
            }
        }

        last_error = ""
        for model in self.CANDIDATE_MODELS:
            url = self.API_URL_TEMPLATE.format(model=model, api_key=clean_key)
            try:
                resp = requests.post(url, json=payload, timeout=20)
                if resp.status_code == 200:
                    raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    cleaned_json = self._clean_json_text(raw_text)
                    data = json.loads(cleaned_json)
                    data["model_used"] = model
                    return data
                last_error = f"{model} status {resp.status_code}"
            except Exception as e:
                last_error = f"{model} error: {str(e)}"
                continue

        raise RuntimeError(f"Không thể kết nối Gemini API: {last_error}")

    @staticmethod
    def _clean_json_text(raw_text: str) -> str:
        """Loại bỏ ký tự markdown bao quanh JSON nếu AI trả về kèm ```json."""
        text = raw_text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return text.strip()
