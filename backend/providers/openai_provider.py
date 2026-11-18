# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Xử lý JSON)
# ========================================================
# json: Phân tích cú pháp dữ liệu JSON từ API phản hồi
import json
# typing: Khai báo kiểu dữ liệu
from typing import Dict, Any, Optional, Tuple, List

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# requests: Gửi HTTP POST tới OpenAI API hoặc máy chủ Proxy
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


class OpenAiProvider(BaseAiProvider):
    """
    Kết nối OpenAI Chat Completions để phân tích ảnh và sinh JSON.
    Hỗ trợ tùy biến Base URL (Proxy/Gateway) linh hoạt.
    """

    DEFAULT_BASE_URL = "https://api.openai.com/v1"
    DEFAULT_MODEL = "gpt-6-luna"
    PROXY_MODELS = ("gpt-4o-mini", "gpt-4o", "chatgpt-4o-latest", DEFAULT_MODEL)

    @classmethod
    def _models_for_base(cls, base_url: str) -> Tuple[str, ...]:#cls class trỏ luôn vào biến hiện tại
        """Giữ thứ tự model tương thích với proxy đã cấu hình."""
        return (cls.DEFAULT_MODEL,) if base_url.lower() == cls.DEFAULT_BASE_URL else cls.PROXY_MODELS

    def test_connection(self, api_key: str, base_url: Optional[str] = None) -> Tuple[bool, str]:
        """
        Kiểm tra nhanh kết nối tới OpenAI API hoặc máy chủ Proxy.

        @param {str} api_key Khóa OpenAI API.
        @param {Optional[str]} base_url Địa chỉ máy chủ (mặc định https://api.openai.com/v1).
        @returns {Tuple[bool, str]} (Trạng thái kết nối, Thông điệp phản hồi).
        """
        clean_key = (api_key or "").strip()
        if not clean_key:
            return False, "Chưa cung cấp OpenAI API Key để kiểm tra."

        clean_base = (base_url or self.DEFAULT_BASE_URL).rstrip("/")
        headers = {
            "Authorization": f"Bearer {clean_key}",#Xin quyền truy cập open ai bằng key
            "Content-Type": "application/json"#Loại thông tin sẽ gửi lên
        }
        url = f"{clean_base}/chat/completions"
        model = self._models_for_base(clean_base)[0]#Chọn models
        payload = {"model": model, "messages": [{"role": "user", "content": "ping"}]}
        if model == self.DEFAULT_MODEL:
            payload.update(reasoning_effort="none", max_completion_tokens=8)#reasoning_effort là tham số dành riêng cho gpt-6, tắt suy nghĩ sâu trả lời ngay lập tức để kiểm tra kết nối không tốn token mấy
        else:
            payload["max_tokens"] = 5#các model cũ 

        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=12)#Chưa gửi promt, chỉ gửi ping để test kết nối
            if resp.status_code == 200:
                return True, "Kết nối thành công! Khóa OpenAI ChatGPT hoạt động hoàn hảo."
            return False, f"OpenAI ChatGPT báo lỗi ({resp.status_code}): {resp.text[:120]}"
        except Exception as e:
            return False, f"Không thể kết nối máy chủ OpenAI ({clean_base}): {str(e)}"

    def analyze_vision(
        self,
        image: Image.Image,
        api_key: str,
        prompt: str,
        base_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Gửi ảnh sprite và yêu cầu phân tích đến OpenAI.

        @param {Image.Image} image Ảnh sprite.
        @param {str} api_key Khóa API.
        @param {str} prompt Lời nhắc yêu cầu phân tích tọa độ.
        @param {Optional[str]} base_url Địa chỉ máy chủ OpenAI.
        @returns {Dict[str, Any]} Dữ liệu JSON bóc tách tọa độ hộp bao.
        """
        clean_key = (api_key or "").strip()
        if not clean_key:
            raise ValueError("Chưa cấu hình OpenAI API Key.")

        img_b64 = self.encode_image_to_base64(image)# biến ảnh thành chữ
        clean_base = (base_url or self.DEFAULT_BASE_URL).rstrip("/")# Địa chỉ máy chủ

        messages = [
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
        ]

        return self._execute_chat_completions(
            clean_key=clean_key,
            clean_base=clean_base,
            messages=messages,
            default_temperature=0.1,# giảm độ bịa của AI xuống cực thấp
            error_prefix="OpenAI ChatGPT Vision không phản hồi",
            timeout=25
        )

    def generate_json(
        self,
        prompt: str,
        api_key: str,
        base_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Gửi yêu cầu sinh văn bản có cấu trúc JSON tới OpenAI ChatGPT.

        @param {str} prompt Lời nhắc sinh prompt hoặc kế hoạch toán học.
        @param {str} api_key Khóa API.
        @param {Optional[str]} base_url Địa chỉ máy chủ OpenAI.
        @returns {Dict[str, Any]} Đối tượng JSON kết quả.
        """
        clean_key = (api_key or "").strip()
        if not clean_key:
            raise ValueError("Chưa cấu hình OpenAI API Key.")

        clean_base = (base_url or self.DEFAULT_BASE_URL).rstrip("/")
        messages = [
            {"role": "system", "content": "You are a professional pixel art art director and prompt engineer. Always return valid JSON."},
            {"role": "user", "content": prompt.strip()}
        ]

        return self._execute_chat_completions(
            clean_key=clean_key,
            clean_base=clean_base,
            messages=messages,
            default_temperature=0.3,
            error_prefix="OpenAI ChatGPT không phản hồi",
            timeout=25
        )

    def _execute_chat_completions(
        self,
        clean_key: str,
        clean_base: str,
        messages: List[Dict[str, Any]],
        default_temperature: float,
        error_prefix: str,
        timeout: int = 25
    ) -> Dict[str, Any]:
        """
        Thực thi gửi yêu cầu Chat Completions qua danh sách model tương thích của OpenAI.
        Tự động cấu hình reasoning_effort cho gpt-6-luna hoặc temperature cho các model khác.

        @param {str} clean_key Khóa OpenAI API.
        @param {str} clean_base Địa chỉ gốc API đã chuẩn hóa.
        @param {List[Dict[str, Any]]} messages Danh sách các lượt hội thoại.
        @param {float} default_temperature Nhiệt độ sáng tạo cho model thông thường.
        @param {str} error_prefix Tiền tố thông báo lỗi nếu toàn bộ model thất bại.
        @param {int} timeout Thời gian chờ phản hồi tối đa.
        @returns {Dict[str, Any]} Dữ liệu JSON bóc tách từ phản hồi.
        """
        url = f"{clean_base}/chat/completions"
        headers = {
            "Authorization": f"Bearer {clean_key}",
            "Content-Type": "application/json"
        }

        last_error = ""
        for model in self._models_for_base(clean_base):
            payload: Dict[str, Any] = {
                "model": model,
                "response_format": {"type": "json_object"},
                "messages": messages,
            }
            if model == self.DEFAULT_MODEL:
                payload["reasoning_effort"] = "none"
            else:
                payload["temperature"] = default_temperature

            try:
                resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
                if resp.status_code == 200:
                    raw_text = resp.json()["choices"][0]["message"]["content"].strip()
                    data = json.loads(raw_text)
                    data["model_used"] = f"OpenAI {model}"
                    return data
                last_error = f"{model} status {resp.status_code}: {resp.text[:100]}"
            except Exception as e:
                last_error = f"{model} error: {str(e)}"
                continue

        raise RuntimeError(f"{error_prefix}: {last_error}")
