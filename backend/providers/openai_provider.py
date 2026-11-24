# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Xử lý JSON)
# ========================================================
# json: Phân tích cú pháp dữ liệu JSON từ API phản hồi
import json
# typing: Khai báo kiểu dữ liệu
from typing import Dict, Any, Optional, Tuple, List, Generator

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
# BaseAiProvider, AiProviderError: Lớp cơ sở trừu tượng và ngoại lệ chuẩn hóa
from .base import BaseAiProvider, AiProviderError

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class OpenAiProvider(BaseAiProvider):
    """
    Kết nối OpenAI Chat Completions để phân tích ảnh và sinh JSON.
    Hỗ trợ tùy biến Base URL (Proxy/Gateway) linh hoạt, chuẩn hóa mã lỗi HTTP (400, 401, 403, 404, 429, 5xx)
    và tôn trọng mô hình người dùng đã chỉ định mà không tự ý đổi model.
    """

    DEFAULT_BASE_URL = "https://api.openai.com/v1"
    DEFAULT_MODEL = "gpt-6-luna"
    PROXY_MODELS = ("gpt-4o-mini", "gpt-4o", "chatgpt-4o-latest", DEFAULT_MODEL)

    @classmethod
    def _models_for_base(cls, base_url: str) -> Tuple[str, ...]:#cls class trỏ luôn vào biến hiện tại
        """Giữ thứ tự model tương thích với proxy đã cấu hình."""
        return (cls.DEFAULT_MODEL,) if base_url.lower() == cls.DEFAULT_BASE_URL else cls.PROXY_MODELS

    @staticmethod
    def _parse_and_raise_error(resp: requests.Response, target_model: str, clean_key: str):
        """
        Phân tích mã phản hồi HTTP và nội dung lỗi từ OpenAI API,
        che dấu khóa API bảo mật và ném ngoại lệ chuẩn hóa AiProviderError.

        @param {requests.Response} resp Đối tượng phản hồi từ requests.
        @param {str} target_model Tên mô hình mục tiêu đang được gọi.
        @param {str} clean_key Khóa API đang dùng để làm sạch nếu bị rò rỉ trong phản hồi.
        @raises {AiProviderError} Ngoại lệ chứa mã HTTP và thông điệp lỗi tiếng Việt rõ ràng.
        """
        status = resp.status_code
        raw_text = resp.text or ""
        if clean_key in raw_text:
            raw_text = raw_text.replace(clean_key, "[REDACTED_API_KEY]")

        clean_msg = ""
        try:
            err_json = resp.json().get("error", {})
            clean_msg = err_json.get("message", "").strip()
        except Exception:
            clean_msg = raw_text[:200].strip()

        if clean_key in clean_msg:
            clean_msg = clean_msg.replace(clean_key, "[REDACTED_API_KEY]")

        if status == 401:
            raise AiProviderError(
                message="OpenAI API (401): Khóa API không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại API Key.",
                status_code=401,
                provider="openai",
            )
        elif status == 403:
            raise AiProviderError(
                message=f"OpenAI API (403): Quyền truy cập bị từ chối đối với mô hình '{target_model}'. Chi tiết: {clean_msg}",
                status_code=403,
                provider="openai",
            )
        elif status == 404:
            raise AiProviderError(
                message=f"OpenAI API (404): Mô hình '{target_model}' không tồn tại hoặc tài khoản không có quyền truy cập.",
                status_code=404,
                provider="openai",
            )
        elif status == 429:
            raise AiProviderError(
                message="OpenAI API (429): Đã vượt quá hạn mức sử dụng (Rate limit / Quota / Insufficient credit). Vui lòng kiểm tra hạn ngạch tài khoản.",
                status_code=429,
                provider="openai",
            )
        elif status == 400:
            raise AiProviderError(
                message=f"OpenAI API (400): Yêu cầu không hợp lệ. Chi tiết: {clean_msg}",
                status_code=400,
                provider="openai",
            )
        else:
            raise AiProviderError(
                message=f"OpenAI API ({status}): Máy chủ OpenAI gặp sự cố tạm thời. Chi tiết: {clean_msg}",
                status_code=status,
                provider="openai",
            )

    def test_connection(
        self,
        api_key: str,
        base_url: Optional[str] = None,
        model: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        Kiểm tra nhanh kết nối tới OpenAI API hoặc máy chủ Proxy.

        @param {str} api_key Khóa OpenAI API.
        @param {Optional[str]} base_url Địa chỉ máy chủ (mặc định https://api.openai.com/v1).
        @param {Optional[str]} model Tên mô hình chỉ định để kiểm tra kết nối.
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
        target_model = (model or self._models_for_base(clean_base)[0]).strip()#Chọn models
        payload = {"model": target_model, "messages": [{"role": "user", "content": "ping"}]}
        if target_model == self.DEFAULT_MODEL:
            payload.update(reasoning_effort="none", max_completion_tokens=8)#reasoning_effort là tham số dành riêng cho gpt-6, tắt suy nghĩ sâu trả lời ngay lập tức để kiểm tra kết nối không tốn token mấy
        else:
            payload["max_tokens"] = 5#các model cũ 

        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=12)#Chưa gửi promt, chỉ gửi ping để test kết nối
            if resp.status_code == 200:
                return True, f"Kết nối thành công! Khóa OpenAI ChatGPT hoạt động hoàn hảo với mô hình {target_model}."

            try:
                self._parse_and_raise_error(resp, target_model, clean_key)
            except AiProviderError as ape:
                return False, ape.message

            return False, f"OpenAI ChatGPT báo lỗi ({resp.status_code}): {resp.text[:120]}"
        except requests.RequestException as e:
            err_msg = str(e).replace(clean_key, "[REDACTED_API_KEY]")
            return False, f"Không thể kết nối máy chủ OpenAI ({clean_base}): {err_msg}"

    def analyze_vision(
        self,
        image: Image.Image,
        api_key: str,
        prompt: str,
        base_url: Optional[str] = None,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Gửi ảnh sprite và yêu cầu phân tích đến OpenAI.

        @param {Image.Image} image Ảnh sprite.
        @param {str} api_key Khóa API.
        @param {str} prompt Lời nhắc yêu cầu phân tích tọa độ.
        @param {Optional[str]} base_url Địa chỉ máy chủ OpenAI.
        @param {Optional[str]} model Tên mô hình AI chỉ định.
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
            model=model,
            timeout=25
        )

    def generate_json(
        self,
        prompt: str,
        api_key: str,
        base_url: Optional[str] = None,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Gửi yêu cầu sinh văn bản có cấu trúc JSON tới OpenAI ChatGPT.

        @param {str} prompt Lời nhắc sinh prompt hoặc kế hoạch toán học.
        @param {str} api_key Khóa API.
        @param {Optional[str]} base_url Địa chỉ máy chủ OpenAI.
        @param {Optional[str]} model Tên mô hình AI chỉ định.
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
            model=model,
            timeout=25
        )

    def _execute_chat_completions(
        self,
        clean_key: str,
        clean_base: str,
        messages: List[Dict[str, Any]],
        default_temperature: float,
        error_prefix: str,
        model: Optional[str] = None,
        timeout: int = 25
    ) -> Dict[str, Any]:
        """
        Thực thi gửi yêu cầu Chat Completions qua mô hình chỉ định hoặc danh sách model tương thích của OpenAI.
        Tự động cấu hình reasoning_effort cho gpt-6-luna hoặc temperature cho các model khác.

        @param {str} clean_key Khóa OpenAI API.
        @param {str} clean_base Địa chỉ gốc API đã chuẩn hóa.
        @param {List[Dict[str, Any]]} messages Danh sách các lượt hội thoại.
        @param {float} default_temperature Nhiệt độ sáng tạo cho model thông thường.
        @param {str} error_prefix Tiền tố thông báo lỗi nếu toàn bộ model thất bại.
        @param {Optional[str]} model Tên mô hình chỉ định bởi người dùng.
        @param {int} timeout Thời gian chờ phản hồi tối đa.
        @returns {Dict[str, Any]} Dữ liệu JSON bóc tách từ phản hồi.
        """
        url = f"{clean_base}/chat/completions"
        headers = {
            "Authorization": f"Bearer {clean_key}",
            "Content-Type": "application/json"
        }

        # Nếu người dùng đã chỉ định model cụ thể: CHỈ gọi duy nhất model đó, không tự ý chuyển sang model khác
        if model and model.strip():
            target_model = model.strip()
            payload: Dict[str, Any] = {
                "model": target_model,
                "response_format": {"type": "json_object"},
                "messages": messages,
            }
            if target_model == self.DEFAULT_MODEL:
                payload["reasoning_effort"] = "none"
            else:
                payload["temperature"] = default_temperature

            try:
                resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
                if resp.status_code == 200:
                    raw_text = resp.json()["choices"][0]["message"]["content"].strip()
                    data = json.loads(raw_text)
                    data["model_used"] = f"OpenAI {target_model}"
                    return data
                self._parse_and_raise_error(resp, target_model, clean_key)
            except requests.RequestException as e:
                err_msg = str(e).replace(clean_key, "[REDACTED_API_KEY]")
                raise AiProviderError(
                    message=f"Lỗi kết nối máy chủ OpenAI ({clean_base}) với mô hình {target_model}: {err_msg}",
                    status_code=502,
                    provider="openai"
                )

        # Nếu không chỉ định model cụ thể, thử qua danh sách model tương thích
        last_exception: Optional[AiProviderError] = None
        for m in self._models_for_base(clean_base):
            payload: Dict[str, Any] = {
                "model": m,
                "response_format": {"type": "json_object"},
                "messages": messages,
            }
            if m == self.DEFAULT_MODEL:
                payload["reasoning_effort"] = "none"
            else:
                payload["temperature"] = default_temperature

            try:
                resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
                if resp.status_code == 200:
                    raw_text = resp.json()["choices"][0]["message"]["content"].strip()
                    data = json.loads(raw_text)
                    data["model_used"] = f"OpenAI {m}"
                    return data

                # Nếu gặp lỗi xác thực hoặc quyền hạn (401, 403), không thử các model tiếp theo
                if resp.status_code in (401, 403):
                    self._parse_and_raise_error(resp, m, clean_key)

                # Đối với 404 hoặc 429, bóc tách lỗi và ghi nhận
                try:
                    self._parse_and_raise_error(resp, m, clean_key)
                except AiProviderError as ape:
                    last_exception = ape

            except requests.RequestException as e:
                err_msg = str(e).replace(clean_key, "[REDACTED_API_KEY]")
                last_exception = AiProviderError(
                    message=f"Lỗi kết nối máy chủ OpenAI ({clean_base}) với mô hình {m}: {err_msg}",
                    status_code=502,
                    provider="openai"
                )
                continue

        if last_exception:
            raise last_exception
        raise AiProviderError(f"{error_prefix}: Không thể kết nối máy chủ OpenAI ({clean_base})", status_code=502, provider="openai")

    def stream_chat(
        self,
        messages: List[Dict[str, str]],
        api_key: str,
        base_url: Optional[str] = None,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None
    ) -> Generator[str, None, None]:
        """
        Gửi hội thoại tới OpenAI (hoặc DeepSeek, Groq, Ollama) và phát luồng (stream) từng token văn bản về theo chuẩn SSE.

        @param {List[Dict[str, str]]} messages Danh sách lịch sử tin nhắn [{'role': 'user'|'assistant', 'content': '...'}].
        @param {str} api_key Khóa API bảo mật.
        @param {Optional[str]} base_url Địa chỉ máy chủ (vd: https://api.openai.com/v1, https://api.deepseek.com/v1, http://localhost:11434/v1).
        @param {Optional[str]} system_instruction Chỉ dẫn định hình phong cách cho AI.
        @param {Optional[str]} model Tên mô hình cụ thể.
        @returns {Generator[str, None, None]} Máy phát sinh từng đoạn chữ (token).
        """
        clean_key = (api_key or "").strip()
        if not clean_key:
            raise ValueError("Chưa cấu hình API Key cho OpenAI/Proxy.")

        clean_base = (base_url or self.DEFAULT_BASE_URL).rstrip("/")
        url = f"{clean_base}/chat/completions"
        headers = {
            "Authorization": f"Bearer {clean_key}",
            "Content-Type": "application/json"
        }

        # Chuẩn bị danh sách tin nhắn kèm system prompt nếu có
        chat_messages = []
        if system_instruction:
            chat_messages.append({"role": "system", "content": system_instruction.strip()})
        for msg in messages:
            chat_messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "").strip()
            })

        # Nếu có chỉ định model rõ ràng, chỉ gọi duy nhất model đó
        models_to_try = (model.strip(),) if model and model.strip() else self._models_for_base(clean_base)

        last_error = ""
        for m in models_to_try:
            payload: Dict[str, Any] = {
                "model": m,
                "messages": chat_messages,
                "stream": True
            }
            if m != self.DEFAULT_MODEL:
                payload["temperature"] = 0.7

            try:
                resp = requests.post(url, json=payload, headers=headers, stream=True, timeout=30)
                if resp.status_code == 200:
                    for line in resp.iter_lines():
                        if line:
                            decoded = line.decode("utf-8")
                            if decoded.startswith("data: "):
                                data_str = decoded[6:].strip()
                                if data_str == "[DONE]":
                                    break
                                try:
                                    event_data = json.loads(data_str)
                                    choices = event_data.get("choices", [])
                                    if choices:
                                        delta = choices[0].get("delta", {})
                                        content_chunk = delta.get("content", "")
                                        if content_chunk:
                                            yield content_chunk
                                except Exception:
                                    continue
                    return

                # Nếu là model chỉ định hoặc lỗi 401/403, báo lỗi ngay lập tức
                if (model and model.strip()) or resp.status_code in (401, 403):
                    self._parse_and_raise_error(resp, m, clean_key)

                last_error = f"{m} status {resp.status_code}: {resp.text[:100]}"
            except requests.RequestException as e:
                err_msg = str(e).replace(clean_key, "[REDACTED_API_KEY]")
                last_error = f"{m} error: {err_msg}"
                if model and model.strip():
                    raise AiProviderError(
                        message=f"Lỗi kết nối máy chủ OpenAI ({clean_base}) với mô hình {m}: {err_msg}",
                        status_code=502,
                        provider="openai"
                    )
                continue

        raise AiProviderError(
            message=f"Tất cả các model OpenAI/Proxy đều không thể phát luồng phản hồi: {last_error}",
            status_code=502,
            provider="openai"
        )
