# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Mã hóa Base64, Thời gian & Kiểu)
# ========================================================
# base64: Chuyển đổi nhị phân sang chuỗi Base64
import base64
# io: Đọc và chuẩn hóa ảnh tham chiếu thành PNG trong bộ nhớ.
import io
# binascii: Bắt lỗi chuỗi Base64 không hợp lệ trước khi gọi API.
import binascii
# time: Tạo mã định danh duy nhất theo timestamp mili-giây
import time
# typing: Định nghĩa các kiểu dữ liệu mảng, từ điển, tùy chọn
from typing import List, Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# requests: Thực hiện các cuộc gọi HTTP REST API tới OpenAI hoặc Proxy
from pydantic import ValidationError
# Pillow: Xác minh ảnh thật và giữ đúng định dạng PNG khi gửi multipart.
from PIL import Image, UnidentifiedImageError

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Providers & Schemas)
# ========================================================
# BaseImageGenProvider: Interface trừu tượng cơ sở cho dịch vụ tạo ảnh
from .base import BaseImageGenProvider, ImageGenUpstreamError
# GeneratedImageItem, ImageGenResponse: Cấu trúc dữ liệu phản hồi sinh ảnh
from backend.schemas.image_gen import ImageGenResponse, GeneratedImageItem

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class OpenAiDalleProvider(BaseImageGenProvider):
    """
    Hiện thực hóa dịch vụ Tạo ảnh qua OpenAI Images API (DALL-E 3).
    - Hỗ trợ tùy biến Base URL (Proxy/Gateway) linh hoạt.
    - Ánh xạ tỉ lệ khung hình sang các kích thước chuẩn của DALL-E 3 (1024x1024, 1024x1792, 1792x1024).
    - Tự động chuyển đổi các ràng buộc cấm (Negative Constraints) vào prompt định hướng DALL-E.
    - Hỗ trợ tải fallback URL sang Base64 nếu proxy không hỗ trợ b64_json trực tiếp.
    """

    # Model mặc định cho tác vụ tạo ảnh của OpenAI
    DEFAULT_MODEL = "gpt-image-1.5"
    DEFAULT_BASE_URL = "https://api.openai.com/v1"

    @staticmethod
    def _supports_transparent_background(eff_model: str) -> bool:
        """Kiểm tra model có thuộc dòng GPT Image hỗ trợ tham số background='transparent' hay không."""
        return eff_model.strip().lower().startswith("gpt-image")

    @staticmethod
    def _is_unsupported_transparent_param_error(resp) -> bool:
        """Nhận diện lỗi HTTP 400 do proxy không hỗ trợ trường background hoặc output_format."""
        if resp.status_code != 400:
            return False
        text_lower = (resp.text or "").lower()
        mentions_param = "background" in text_lower or "output_format" in text_lower
        mentions_unknown = "unknown" in text_lower or "unsupported" in text_lower or "invalid" in text_lower
        return mentions_param and mentions_unknown

    def _post_image_request(
        self,
        target_url: str,
        headers: Dict[str, str],
        payload: Dict[str, Any],
        files: Any,
        deadline: float,
        eff_model: str,
    ):
        """Gửi yêu cầu tạo/sửa ảnh tới OpenAI hoặc Proxy; tự bỏ tham số transparent nếu proxy từ chối."""
        request_kwargs: Dict[str, Any] = {"headers": headers, "deadline": deadline, "label": f"openai / {eff_model}"}
        if files is not None:
            resp = self._request("POST", target_url, files=files, data=payload, **request_kwargs)
        else:
            resp = self._request("POST", target_url, json=payload, **request_kwargs)

        if "background" in payload and self._is_unsupported_transparent_param_error(resp):
            fallback_payload = {k: v for k, v in payload.items() if k not in ("background", "output_format")}
            if files is not None:
                return self._request("POST", target_url, files=files, data=fallback_payload, **request_kwargs)
            return self._request("POST", target_url, json=fallback_payload, **request_kwargs)
        return resp

    def generate_images(
        self,
        api_key: str,
        prompt: str,
        negative_prompt: Optional[str] = None,
        aspect_ratio: str = "1:1",
        number_of_images: int = 1,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        image: Optional[str] = None,
        reference_image_2: Optional[str] = None
    ) -> ImageGenResponse:
        """
        Gọi OpenAI Images API để sinh ảnh qua mô hình DALL-E / GPT Image.
        Hỗ trợ tiếp nhận ảnh mẫu tham chiếu (Image-to-Image / Edits / Reference Conditioning),
        bao gồm gửi đồng thời Ảnh 1 (Style & Proportions) và Ảnh 2 (Layout & Pose) qua `image[]`.

        @param {str} api_key Khóa OpenAI API.
        @param {str} prompt Lời nhắc mô tả ảnh cần tạo.
        @param {Optional[str]} negative_prompt Lời nhắc các chi tiết cần loại bỏ.
        @param {str} aspect_ratio Tỉ lệ khung hình ('1:1', '3:4', '4:3', '16:9', '9:16').
        @param {int} number_of_images Số lượng ảnh (DALL-E 3 hỗ trợ n=1 trên mỗi request).
        @param {Optional[str]} base_url Địa chỉ máy chủ OpenAI hoặc Proxy.
        @param {Optional[str]} model Mô hình tạo ảnh OpenAI cụ thể nếu có.
        @param {Optional[str]} image Chuỗi Base64 ảnh mẫu tham chiếu số 1 nếu có.
        @param {Optional[str]} reference_image_2 Chuỗi Base64 ảnh tham chiếu số 2 cố định nếu có.
        @returns {ImageGenResponse} Danh sách các ảnh đã được tạo kèm metadata.
        """
        deadline = time.monotonic() + self.NETWORK_BUDGET_SECONDS
        clean_base = (base_url or self.DEFAULT_BASE_URL).rstrip("/")
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        # Mô hình tạo ảnh thực tế được chỉ định hoặc mặc định
        eff_model = (model or self.DEFAULT_MODEL).strip()

        # Ánh xạ kích thước ảnh chuẩn của OpenAI DALL-E 3
        if aspect_ratio in ("3:4", "9:16"):
            dalle_size = "1024x1536"
        elif aspect_ratio in ("4:3", "16:9"):
            dalle_size = "1536x1024"
        else:
            dalle_size = "1024x1024"

        # Ghép phần lệnh cấm vào prompt cho DALL-E nếu có
        final_openai_prompt = prompt
        if negative_prompt:
            final_openai_prompt = f"{prompt}\n\n[NEGATIVE CONSTRAINTS / DO NOT INCLUDE]: {negative_prompt}"

        # Khi có ảnh, mọi model đều đi qua edits; dịch vụ đích quyết định khả năng hỗ trợ.
        # Không chuyển ngầm sang generations nếu chỉnh ảnh thất bại.
        reference_entries = []
        if image and image.strip():
            reference_entries.append(("reference_1.png", self._reference_png(image)))
        if reference_image_2 and reference_image_2.strip():
            reference_entries.append(("reference_2.png", self._reference_png(reference_image_2)))

        url = f"{clean_base}/images/generations"
        payload: Dict[str, Any] = {
            "model": eff_model,
            "prompt": final_openai_prompt,
            "n": 1,
            "size": dalle_size
        }
        # Bật cờ nền trong suốt và định dạng PNG thật cho các model GPT Image hỗ trợ kênh Alpha
        if self._supports_transparent_background(eff_model):
            payload["background"] = "transparent"
            payload["output_format"] = "png"

        try:
            if reference_entries:
                edit_url = f"{clean_base}/images/edits"
                edit_headers = {"Authorization": f"Bearer {api_key}"}
                if len(reference_entries) == 1:
                    files = {"image": ("reference.png", reference_entries[0][1], "image/png")}
                else:
                    # Gửi đa ảnh tham chiếu theo đúng thứ tự (Ảnh 1 trước, Ảnh 2 sau) qua trường image[]
                    files = [
                        ("image[]", (filename, raw_png, "image/png"))
                        for filename, raw_png in reference_entries
                    ]
                # requests tự tạo multipart boundary; không đặt Content-Type JSON cho ảnh.
                if eff_model == "dall-e-2":
                    payload["size"] = "512x512" if aspect_ratio == "1:1" else "1024x1024"
                resp = self._post_image_request(edit_url, edit_headers, payload, files, deadline, eff_model)
            else:
                resp = self._post_image_request(url, headers, payload, None, deadline, eff_model)
            if resp.status_code == 200:
                data = self._json(resp, f'openai / {eff_model}')
                items: List[GeneratedImageItem] = []
                data_list = data.get("data", [])

                for idx, entry in enumerate(data_list):
                    b64_raw = entry.get("b64_json")
                    if not b64_raw and entry.get("url"):
                        # Trường hợp proxy chỉ trả về link URL ảnh thì tải ảnh về chuyển sang Base64
                        img_resp = self._request('GET', entry["url"], deadline=deadline, label=f'openai / {eff_model}')
                        if img_resp.status_code == 200:
                            b64_raw = base64.b64encode(img_resp.content).decode("utf-8")

                    if b64_raw:
                        item_id = f"img_{int(time.time() * 1000)}_{idx + 1}"
                        data_url = f"data:image/png;base64,{b64_raw}"
                        items.append(GeneratedImageItem(
                            id=item_id,
                            b64_data=b64_raw,
                            mime_type="image/png",
                            data_url=data_url,
                            aspect_ratio=aspect_ratio
                        ))

                if items:
                    return ImageGenResponse(
                        status="success",
                        message=f"Đã tạo thành công ảnh bằng OpenAI ({eff_model})!",
                        provider_used="openai",
                        model_used=eff_model,
                        images=items
                    )
                raise ImageGenUpstreamError("OpenAI phản hồi thành công nhưng không có dữ liệu ảnh hợp lệ.")

            elif resp.status_code in (400, 404, 422):
                err_text = resp.text.replace(api_key, "[REDACTED_API_KEY]") if api_key else resp.text
                if "content_policy_violation" in err_text:
                    raise ValueError("Prompt bị OpenAI từ chối do vi phạm chính sách an toàn nội dung.")
                if reference_entries:
                    raise ValueError(
                        f"Không thể tạo ảnh từ ảnh mẫu với model '{eff_model}' (HTTP {resp.status_code}). "
                        f"Hãy kiểm tra dịch vụ/model có hỗ trợ API chỉnh ảnh /images/edits. Chi tiết: {err_text[:200]}"
                    )
                raise ValueError(f"Yêu cầu không hợp lệ tới OpenAI: {err_text[:200]}")

            else:
                raise RuntimeError(f"OpenAI API báo lỗi ({resp.status_code}): {resp.text.replace(api_key, '[REDACTED_API_KEY]')[:200]}")

        except (AttributeError, TypeError, KeyError, ValidationError) as exc:
            raise ImageGenUpstreamError(f'openai / {eff_model}: cấu trúc phản hồi không hợp lệ.') from exc

    @staticmethod
    def _reference_png(image: str) -> bytes:
        """Xác minh ảnh Base64 hoặc Data URL rồi trả PNG để gửi đúng MIME.

        @param image Ảnh tham chiếu nhận từ giao diện hoặc yêu cầu API trực tiếp.
        @returns Nội dung PNG nhị phân, giữ kích thước và kênh trong suốt.
        """
        encoded = image.split(",", 1)[1] if image.startswith("data:") and "," in image else image
        try:
            raw = base64.b64decode("".join(encoded.split()), validate=True)
            with Image.open(io.BytesIO(raw)) as source, io.BytesIO() as buffer:
                source.convert("RGBA").save(buffer, format="PNG")
                return buffer.getvalue()
        except (binascii.Error, ValueError, OSError, UnidentifiedImageError, Image.DecompressionBombError) as exc:
            raise ValueError("Ảnh mẫu không hợp lệ hoặc không đọc được. Hãy tải lại ảnh PNG, JPEG hoặc WebP.") from exc
