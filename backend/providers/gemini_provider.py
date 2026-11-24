# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Xử lý JSON)
# ========================================================
# json: Phân tích cú pháp dữ liệu JSON từ API phản hồi
import json
# typing: Khai báo kiểu dữ liệu
from typing import Dict, Any, Optional, Tuple, Generator, List

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
# BaseAiProvider, AiProviderError: Lớp cơ sở trừu tượng và ngoại lệ chuẩn hóa
from .base import BaseAiProvider, AiProviderError

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class GeminiProvider(BaseAiProvider):
    """
    Hiện thực hóa kết nối tới Google Gemini API (Visual Grounding & Text Generation).
    Hỗ trợ cơ chế bảo mật khóa API qua Header, phân tích mã lỗi HTTP chuẩn mực (400, 401, 403, 404, 429, 5xx)
    và tôn trọng mô hình được chỉ định bởi người dùng mà không tự ý đổi model.
    """

    DEFAULT_MODEL = "gemini-2.5-flash"
    CANDIDATE_MODELS = [
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-flash-latest",
        "gemini-flash-lite-latest",
        "gemini-2.5-pro"
    ]
    API_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    STREAM_API_URL_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse"

    @staticmethod
    def _parse_and_raise_error(resp: requests.Response, target_model: str, clean_key: str):
        """
        Phân tích mã phản hồi HTTP và nội dung lỗi từ Google Gemini API,
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
                message="Google Gemini API (401): Khóa API không hợp lệ hoặc đã hết hạn. Vui lòng kiểm tra lại API Key.",
                status_code=401,
                provider="gemini",
            )
        elif status == 403:
            if "billing" in clean_msg.lower() or "free tier" in clean_msg.lower():
                raise AiProviderError(
                    message=(
                        "Google Gemini API (403): Dự án Google Cloud / AI Studio chưa bật thanh toán (Billing) "
                        "hoặc khu vực không hỗ trợ gói miễn phí. Vui lòng kích hoạt thanh toán tại https://aistudio.google.com/billing."
                    ),
                    status_code=403,
                    provider="gemini",
                )
            raise AiProviderError(
                message=f"Google Gemini API (403): Quyền truy cập bị từ chối đối với mô hình '{target_model}'. Chi tiết: {clean_msg}",
                status_code=403,
                provider="gemini",
            )
        elif status == 404:
            raise AiProviderError(
                message=f"Google Gemini API (404): Mô hình '{target_model}' không tồn tại hoặc đã ngừng hỗ trợ trên tài khoản này.",
                status_code=404,
                provider="gemini",
            )
        elif status == 429:
            raise AiProviderError(
                message="Google Gemini API (429): Đã vượt quá hạn mức sử dụng (Rate limit / Quota exceeded). Vui lòng thử lại sau.",
                status_code=429,
                provider="gemini",
            )
        elif status == 400:
            raise AiProviderError(
                message=f"Google Gemini API (400): Yêu cầu không hợp lệ. Chi tiết: {clean_msg}",
                status_code=400,
                provider="gemini",
            )
        else:
            raise AiProviderError(
                message=f"Google Gemini API ({status}): Máy chủ nhà cung cấp gặp sự cố tạm thời. Chi tiết: {clean_msg}",
                status_code=status,
                provider="gemini",
            )

    def test_connection(
        self,
        api_key: str,
        base_url: Optional[str] = None,
        model: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        Kiểm tra nhanh kết nối tới Google Gemini API bằng phương thức gửi qua Header bảo mật.

        @param {str} api_key Khóa Google Gemini API.
        @param {Optional[str]} base_url Không bắt buộc với Gemini.
        @param {Optional[str]} model Tên mô hình kiểm tra (mặc định gemini-2.5-flash).
        @returns {Tuple[bool, str]} (Trạng thái kết nối, Thông điệp phản hồi).
        """
        clean_key = (api_key or "").strip()
        if not clean_key:
            return False, "Chưa cung cấp Google Gemini API Key để kiểm tra."

        test_model = (model or self.DEFAULT_MODEL).strip()
        url = self.API_URL_TEMPLATE.format(model=test_model)
        headers = {
            "x-goog-api-key": clean_key,
            "Content-Type": "application/json"
        }
        payload = {
            "contents": [{"parts": [{"text": "ping"}]}],
            "generationConfig": {"maxOutputTokens": 5}
        }

        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=12)
            if resp.status_code == 200:
                return True, f"Kết nối thành công! Khóa Google Gemini API hoạt động hoàn hảo với mô hình {test_model}."

            # Bóc tách lỗi chi tiết cho người dùng
            try:
                self._parse_and_raise_error(resp, test_model, clean_key)
            except AiProviderError as ape:
                return False, ape.message

            return False, f"Google Gemini báo lỗi ({resp.status_code}): {resp.text[:120]}"
        except requests.RequestException as e:
            err_msg = str(e).replace(clean_key, "[REDACTED_API_KEY]")
            return False, f"Lỗi kết nối mạng tới Google Gemini: {err_msg}"

    def analyze_vision(
        self,
        image: Image.Image,
        api_key: str,
        prompt: str,
        base_url: Optional[str] = None,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Gửi ảnh Sprite lên Google Gemini Vision kèm mô hình chỉ định hoặc danh sách tương thích.

        @param {Image.Image} image Ảnh sprite.
        @param {str} api_key Khóa API.
        @param {str} prompt Hướng dẫn nhận diện giải phẫu học.
        @param {Optional[str]} base_url Địa chỉ máy chủ tùy chọn.
        @param {Optional[str]} model Tên mô hình cụ thể.
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

        return self._execute_generation(
            clean_key=clean_key,
            payload=payload,
            error_prefix="Không thể phân tích ảnh qua Google Gemini Vision",
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
        Gửi yêu cầu sinh văn bản có cấu trúc JSON tới Gemini API.

        @param {str} prompt Nội dung yêu cầu tạo prompt hoặc kế hoạch toán học.
        @param {str} api_key Khóa API.
        @param {Optional[str]} base_url Địa chỉ máy chủ.
        @param {Optional[str]} model Tên mô hình cụ thể.
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

        return self._execute_generation(
            clean_key=clean_key,
            payload=payload,
            error_prefix="Không thể kết nối Gemini API",
            model=model,
            timeout=25
        )

    def stream_chat(
        self,
        messages: List[Dict[str, str]],
        api_key: str,
        base_url: Optional[str] = None,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None
    ) -> Generator[str, None, None]:
        """
        Gửi hội thoại tới Google Gemini API và phát luồng (stream) từng token văn bản về theo chuẩn SSE.

        @param {List[Dict[str, str]]} messages Danh sách lịch sử tin nhắn [{'role': 'user'|'assistant', 'content': '...'}].
        @param {str} api_key Khóa Google Gemini API.
        @param {Optional[str]} base_url Không bắt buộc với Gemini (dùng mặc định Google API).
        @param {Optional[str]} system_instruction Chỉ dẫn định hình phong cách cho AI.
        @param {Optional[str]} model Tên mô hình cụ thể.
        @returns {Generator[str, None, None]} Máy phát sinh từng đoạn chữ (token).
        """
        clean_key = (api_key or "").strip()
        if not clean_key:
            raise ValueError("Chưa cấu hình Google Gemini API Key.")

        gemini_contents = []
        for msg in messages:
            role = "model" if msg.get("role") in ["assistant", "bot", "model"] else "user"
            gemini_contents.append({
                "role": role,
                "parts": [{"text": msg.get("content", "").strip()}]
            })

        payload: Dict[str, Any] = {
            "contents": gemini_contents,
            "generationConfig": {
                "temperature": 0.7,
            }
        }
        if system_instruction:
            payload["system_instruction"] = {
                "parts": [{"text": system_instruction.strip()}]
            }

        headers = {
            "x-goog-api-key": clean_key,
            "Content-Type": "application/json"
        }

        # Nếu có chỉ định model rõ ràng, chỉ gọi duy nhất model đó
        models_to_try = [model.strip()] if model and model.strip() else self.CANDIDATE_MODELS

        last_error = ""
        for m in models_to_try:
            url = self.STREAM_API_URL_TEMPLATE.format(model=m)
            try:
                resp = requests.post(url, json=payload, headers=headers, stream=True, timeout=30)
                if resp.status_code == 200:
                    for line in resp.iter_lines():
                        if line:
                            decoded = line.decode("utf-8")
                            if decoded.startswith("data: "):
                                json_str = decoded[6:].strip()
                                event_data = json.loads(json_str)
                                candidates = event_data.get("candidates", [])
                                if candidates:
                                    parts = candidates[0].get("content", {}).get("parts", [])
                                    for part in parts:
                                        text_chunk = part.get("text", "")
                                        if text_chunk:
                                            yield text_chunk
                    return

                # Nếu là model chỉ định hoặc lỗi 401/403, báo lỗi ngay lập tức
                if (model and model.strip()) or resp.status_code in (401, 403):
                    self._parse_and_raise_error(resp, m, clean_key)

                last_error = f"{m} status {resp.status_code}"
                if resp.text:
                    last_error += f": {resp.text[:100]}"
            except requests.RequestException as e:
                err_msg = str(e).replace(clean_key, "[REDACTED_API_KEY]")
                last_error = f"{m} error: {err_msg}"
                if model and model.strip():
                    raise AiProviderError(
                        message=f"Lỗi kết nối mạng tới Google Gemini ({m}): {err_msg}",
                        status_code=502,
                        provider="gemini"
                    )
                continue

        raise AiProviderError(
            message=f"Tất cả các model Gemini đều không thể phát luồng phản hồi: {last_error}",
            status_code=502,
            provider="gemini"
        )

    def _execute_generation(
        self,
        clean_key: str,
        payload: Dict[str, Any],
        error_prefix: str,
        model: Optional[str] = None,
        timeout: int = 25
    ) -> Dict[str, Any]:
        """
        Thực thi gọi API tới Google Gemini với mô hình chỉ định hoặc danh sách fallback an toàn.
        Đảm bảo không rò rỉ khóa API trong Header, phản hồi JSON sạch sẽ và kiểm soát lỗi HTTP.

        @param {str} clean_key Khóa API đã chuẩn hóa.
        @param {Dict[str, Any]} payload Nội dung JSON gửi tới Gemini.
        @param {str} error_prefix Tiền tố thông báo lỗi nếu toàn bộ model thất bại.
        @param {Optional[str]} model Tên mô hình chỉ định bởi người dùng (nếu có).
        @param {int} timeout Thời gian chờ phản hồi tối đa.
        @returns {Dict[str, Any]} Dữ liệu JSON đã giải mã từ phản hồi.
        """
        headers = {
            "x-goog-api-key": clean_key,
            "Content-Type": "application/json"
        }

        # Nếu người dùng đã chỉ định model cụ thể: CHỈ gọi duy nhất model đó, không tự động fallback
        if model and model.strip():
            target_model = model.strip()
            url = self.API_URL_TEMPLATE.format(model=target_model)
            try:
                resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
                if resp.status_code == 200:
                    raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    cleaned_json = self._clean_json_text(raw_text)
                    data = json.loads(cleaned_json)
                    data["model_used"] = target_model
                    return data
                self._parse_and_raise_error(resp, target_model, clean_key)
            except requests.RequestException as e:
                err_msg = str(e).replace(clean_key, "[REDACTED_API_KEY]")
                raise AiProviderError(
                    message=f"Lỗi kết nối mạng tới Google Gemini ({target_model}): {err_msg}",
                    status_code=502,
                    provider="gemini"
                )

        # Nếu không chỉ định model cụ thể, thử qua danh sách Candidate Models hợp lệ
        last_exception: Optional[AiProviderError] = None
        for m in self.CANDIDATE_MODELS:
            url = self.API_URL_TEMPLATE.format(model=m)
            try:
                resp = requests.post(url, json=payload, headers=headers, timeout=timeout)
                if resp.status_code == 200:
                    raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    cleaned_json = self._clean_json_text(raw_text)
                    data = json.loads(cleaned_json)
                    data["model_used"] = m
                    return data

                # Nếu gặp lỗi xác thực hoặc quyền hạn (401, 403), không thử các model tiếp theo vì key/project không hợp lệ
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
                    message=f"Lỗi kết nối mạng tới Google Gemini ({m}): {err_msg}",
                    status_code=502,
                    provider="gemini"
                )
                continue

        if last_exception:
            raise last_exception
        raise AiProviderError(
            message=f"{error_prefix}: Không thể kết nối tới Google Gemini",
            status_code=502,
            provider="gemini"
        )

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
