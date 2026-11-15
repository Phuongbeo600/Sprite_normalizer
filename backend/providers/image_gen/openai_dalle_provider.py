# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Mã hóa Base64, Thời gian & Kiểu)
# ========================================================
# base64: Chuyển đổi nhị phân sang chuỗi Base64
import base64
# time: Tạo mã định danh duy nhất theo timestamp mili-giây
import time
# typing: Định nghĩa các kiểu dữ liệu mảng, từ điển, tùy chọn
from typing import List, Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# requests: Thực hiện các cuộc gọi HTTP REST API tới OpenAI hoặc Proxy
import requests

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
    DEFAULT_MODEL = "dall-e-3"
    DEFAULT_BASE_URL = "https://api.openai.com/v1"

    def generate_images(
        self,
        api_key: str,
        prompt: str,
        negative_prompt: Optional[str] = None,
        aspect_ratio: str = "1:1",
        number_of_images: int = 1,
        base_url: Optional[str] = None
    ) -> ImageGenResponse:
        """
        Gọi OpenAI Images API để sinh ảnh qua mô hình DALL-E 3.

        @param {str} api_key Khóa OpenAI API.
        @param {str} prompt Lời nhắc mô tả ảnh cần tạo.
        @param {Optional[str]} negative_prompt Lời nhắc các chi tiết cần loại bỏ.
        @param {str} aspect_ratio Tỉ lệ khung hình ('1:1', '3:4', '4:3', '16:9', '9:16').
        @param {int} number_of_images Số lượng ảnh (DALL-E 3 hỗ trợ n=1 trên mỗi request).
        @param {Optional[str]} base_url Địa chỉ máy chủ OpenAI hoặc Proxy.
        @returns {ImageGenResponse} Danh sách các ảnh đã được tạo kèm metadata.
        """
        clean_base = (base_url or self.DEFAULT_BASE_URL).rstrip("/")
        url = f"{clean_base}/images/generations"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

        # Ánh xạ kích thước ảnh chuẩn của OpenAI DALL-E 3
        if aspect_ratio in ("3:4", "9:16"):
            dalle_size = "1024x1792"
        elif aspect_ratio in ("4:3", "16:9"):
            dalle_size = "1792x1024"
        else:
            dalle_size = "1024x1024"

        # Ghép phần lệnh cấm vào prompt cho DALL-E nếu có
        final_openai_prompt = prompt
        if negative_prompt:
            final_openai_prompt = f"{prompt}\n\n[NEGATIVE CONSTRAINTS / DO NOT INCLUDE]: {negative_prompt}"

        # DALL-E 3 giới hạn n=1 trên mỗi lượt gọi API
        payload = {
            "model": self.DEFAULT_MODEL,
            "prompt": final_openai_prompt,
            "n": 1,
            "size": dalle_size,
            "response_format": "b64_json"
        }

        try:
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
                        message=f"Đã tạo thành công ảnh bằng OpenAI ({self.DEFAULT_MODEL})!",
                        provider_used="openai",
                        model_used=self.DEFAULT_MODEL,
                        images=items
                    )
                raise ValueError("OpenAI phản hồi thành công nhưng không có dữ liệu ảnh hợp lệ.")

            elif resp.status_code == 400:
                err_text = resp.text
                if "content_policy_violation" in err_text:
                    raise ValueError("Prompt bị OpenAI từ chối do vi phạm chính sách an toàn nội dung.")
                raise ValueError(f"Yêu cầu không hợp lệ tới OpenAI: {err_text[:200]}")
            elif resp.status_code == 401:
                raise ValueError("Khóa OpenAI API Key không hợp lệ. Vui lòng kiểm tra lại trong phần Cài đặt.")
            elif resp.status_code == 429:
                raise ValueError("Tài khoản OpenAI đã hết hạn mức sử dụng (Quota) hoặc bị giới hạn tốc độ (Rate Limit).")
            else:
                raise RuntimeError(f"OpenAI API báo lỗi ({resp.status_code}): {resp.text[:200]}")

        except requests.exceptions.Timeout:
            raise RuntimeError("Quá thời gian chờ phản hồi (Timeout 60s) từ OpenAI DALL-E API.")
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Lỗi kết nối mạng tới máy chủ OpenAI ({clean_base}): {str(e)}")
