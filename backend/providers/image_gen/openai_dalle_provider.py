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
import requests
# Pillow: Xác minh ảnh thật và giữ đúng định dạng PNG khi gửi multipart.
from PIL import Image, UnidentifiedImageError

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Providers & Schemas)
# ========================================================
# BaseImageGenProvider: Interface trừu tượng cơ sở cho dịch vụ tạo ảnh
from .base import BaseImageGenProvider
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

    def generate_images(
        self,
        api_key: str,
        prompt: str,
        negative_prompt: Optional[str] = None,
        aspect_ratio: str = "1:1",
        number_of_images: int = 1,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        image: Optional[str] = None
    ) -> ImageGenResponse:
        """
        Gọi OpenAI Images API để sinh ảnh qua mô hình DALL-E / GPT Image.
        Hỗ trợ tiếp nhận ảnh mẫu tham chiếu (Image-to-Image / Edits / Reference Conditioning).

        @param {str} api_key Khóa OpenAI API.
        @param {str} prompt Lời nhắc mô tả ảnh cần tạo.
        @param {Optional[str]} negative_prompt Lời nhắc các chi tiết cần loại bỏ.
        @param {str} aspect_ratio Tỉ lệ khung hình ('1:1', '3:4', '4:3', '16:9', '9:16').
        @param {int} number_of_images Số lượng ảnh (DALL-E 3 hỗ trợ n=1 trên mỗi request).
        @param {Optional[str]} base_url Địa chỉ máy chủ OpenAI hoặc Proxy.
        @param {Optional[str]} model Mô hình tạo ảnh OpenAI cụ thể nếu có.
        @param {Optional[str]} image Chuỗi Base64 ảnh mẫu tham chiếu nếu có.
        @returns {ImageGenResponse} Danh sách các ảnh đã được tạo kèm metadata.
        """
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
        reference_png = self._reference_png(image) if image and image.strip() else None

        url = f"{clean_base}/images/generations"
        payload = {
            "model": eff_model,
            "prompt": final_openai_prompt,
            "n": 1,
            "size": dalle_size
        }

        try:
            if reference_png is not None:
                edit_url = f"{clean_base}/images/edits"
                edit_headers = {"Authorization": f"Bearer {api_key}"}
                files = {"image": ("reference.png", reference_png, "image/png")}
                # requests tự tạo multipart boundary; không đặt Content-Type JSON cho ảnh.
                if eff_model == "dall-e-2":
                    payload["size"] = "512x512" if aspect_ratio == "1:1" else "1024x1024"
                resp = requests.post(edit_url, headers=edit_headers, files=files, data=payload, timeout=60)
            else:
                resp = requests.post(url, json=payload, headers=headers, timeout=60)
            if resp.status_code == 200:
                data = resp.json()
                items: List[GeneratedImageItem] = []
                data_list = data.get("data", [])

                for idx, entry in enumerate(data_list):
                    b64_raw = entry.get("b64_json")
                    if not b64_raw and entry.get("url"):
                        # Trường hợp proxy chỉ trả về link URL ảnh thì tải ảnh về chuyển sang Base64
                        img_resp = requests.get(entry["url"], timeout=30)
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
                raise ValueError("OpenAI phản hồi thành công nhưng không có dữ liệu ảnh hợp lệ.")

            elif resp.status_code in (400, 404, 422):
                err_text = resp.text.replace(api_key, "[REDACTED_API_KEY]") if api_key else resp.text
                if "content_policy_violation" in err_text:
                    raise ValueError("Prompt bị OpenAI từ chối do vi phạm chính sách an toàn nội dung.")
                if reference_png is not None:
                    raise ValueError(
                        f"Không thể tạo ảnh từ ảnh mẫu với model '{eff_model}' (HTTP {resp.status_code}). "
                        f"Hãy kiểm tra dịch vụ/model có hỗ trợ API chỉnh ảnh /images/edits. Chi tiết: {err_text[:200]}"
                    )
                raise ValueError(f"Yêu cầu không hợp lệ tới OpenAI: {err_text[:200]}")
            elif resp.status_code == 401:
                raise ValueError("Khóa OpenAI API Key không hợp lệ. Vui lòng kiểm tra lại trong phần Cài đặt.")
            elif resp.status_code == 429:
                raise ValueError("Tài khoản OpenAI đã hết hạn mức sử dụng (Quota) hoặc bị giới hạn tốc độ (Rate Limit).")
            else:
                raise RuntimeError(f"OpenAI API báo lỗi ({resp.status_code}): {resp.text[:200]}")

        except requests.exceptions.Timeout:
            raise RuntimeError("Quá thời gian chờ phản hồi (Timeout 60s) từ API tạo ảnh.")
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Lỗi kết nối mạng tới máy chủ OpenAI ({clean_base}): {str(e).replace(api_key, '[REDACTED_API_KEY]') if api_key else str(e)}")

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
