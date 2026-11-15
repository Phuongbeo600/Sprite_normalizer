# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Thời gian & Kiểu dữ liệu)
# ========================================================
# time: Tạo mã định danh duy nhất theo timestamp mili-giây
import time
# typing: Định nghĩa các kiểu dữ liệu mảng, từ điển, tùy chọn
from typing import List, Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# requests: Thực hiện các cuộc gọi HTTP REST API tới máy chủ Google
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


class GeminiImagenProvider(BaseImageGenProvider):
    """
    Hiện thực hóa dịch vụ Tạo ảnh qua Google Generative Language REST API (Imagen 3).
    - Hỗ trợ cơ chế tự động xoay vòng qua danh sách model Imagen 3 dự phòng khi gặp sự cố.
    - Xử lý chi tiết các mã trạng thái HTTP, bóc tách ảnh Base64 và phân loại lỗi an toàn nội dung (Safety Filters).
    """

    # Danh sách các phiên bản mô hình Imagen 3 khả dụng của Google
    CANDIDATE_MODELS = [
        "imagen-3.0-generate-002",
        "imagen-3.0-fast-generate-001"
    ]

    # Các tỉ lệ khung hình hợp lệ được hỗ trợ bởi Imagen 3
    VALID_RATIOS = {"1:1", "3:4", "4:3", "16:9", "9:16"}

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
        Gọi Google Generative Language REST API để sinh ảnh bằng Imagen 3.
        Hỗ trợ cơ chế Fallback tự động qua các model Imagen khả dụng và nạp negativePrompt chuẩn.

        @param {str} api_key Khóa Google Gemini API.
        @param {str} prompt Lời nhắc mô tả ảnh cần tạo.
        @param {Optional[str]} negative_prompt Lời nhắc các chi tiết cần loại bỏ.
        @param {str} aspect_ratio Tỉ lệ khung hình ('1:1', '3:4', '4:3', '16:9', '9:16').
        @param {int} number_of_images Số lượng ảnh mong muốn (tối đa 4).
        @param {Optional[str]} base_url Địa chỉ máy chủ tùy chọn.
        @returns {ImageGenResponse} Danh sách các ảnh đã được tạo kèm metadata.
        """
        target_ratio = aspect_ratio if aspect_ratio in self.VALID_RATIOS else "1:1"
        sample_count = min(max(1, number_of_images), 4)

        parameters_dict: Dict[str, Any] = {
            "sampleCount": sample_count,
            "aspectRatio": target_ratio,
            "outputMimeType": "image/png"
        }
        if negative_prompt:
            parameters_dict["negativePrompt"] = negative_prompt

        payload = {
            "instances": [
                {"prompt": prompt}
            ],
            "parameters": parameters_dict
        }

        last_error = ""
        # Thử lần lượt các mô hình Imagen 3 khả dụng
        for model_name in self.CANDIDATE_MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:predict?key={api_key}"
            headers = {"Content-Type": "application/json"}

            try:
                resp = requests.post(url, json=payload, headers=headers, timeout=60)
                if resp.status_code == 200:
                    data = resp.json()
                    predictions = data.get("predictions", [])
                    if not predictions:
                        last_error = "Google Imagen 3 phản hồi thành công nhưng không có ảnh nào trong kết quả."
                        continue

                    items: List[GeneratedImageItem] = []
                    for idx, pred in enumerate(predictions):
                        b64_raw = pred.get("bytesBase64Encoded", "")
                        mime = pred.get("mimeType", "image/png")
                        if b64_raw:
                            item_id = f"img_{int(time.time() * 1000)}_{idx + 1}"
                            data_url = f"data:{mime};base64,{b64_raw}"
                            items.append(GeneratedImageItem(
                                id=item_id,
                                b64_data=b64_raw,
                                mime_type=mime,
                                data_url=data_url,
                                aspect_ratio=target_ratio
                            ))

                    if items:
                        return ImageGenResponse(
                            status="success",
                            message=f"Đã tạo thành công {len(items)} ảnh bằng Google Imagen 3 ({model_name})!",
                            provider_used="gemini",
                            model_used=model_name,
                            images=items
                        )

                elif resp.status_code == 400:
                    err_msg = resp.text
                    # Phát hiện vi phạm bộ lọc an toàn nội dung
                    if "SAFETY" in err_msg or "blocked" in err_msg.lower():
                        raise ValueError("Yêu cầu tạo ảnh bị bộ lọc an toàn nội dung của Google từ chối. Vui lòng điều chỉnh lại prompt.")
                    last_error = f"Lỗi yêu cầu ({resp.status_code}): {err_msg[:200]}"
                elif resp.status_code == 401 or resp.status_code == 403:
                    raise ValueError("Khóa Google Gemini API không hợp lệ hoặc chưa được cấp quyền dùng mô hình Imagen 3.")
                elif resp.status_code == 429:
                    raise ValueError("Đã đạt giới hạn hạn mức (Rate Limit / Quota) của Google API. Vui lòng thử lại sau vài giây.")
                else:
                    last_error = f"Google Imagen 3 báo lỗi ({resp.status_code}): {resp.text[:200]}"

            except requests.exceptions.Timeout:
                last_error = f"Quá thời gian chờ phản hồi (Timeout 60s) từ Google Imagen 3 ({model_name})."
            except requests.exceptions.RequestException as e:
                last_error = f"Lỗi kết nối mạng tới Google Imagen API: {str(e)}"

        raise RuntimeError(f"Không thể tạo ảnh từ Google Imagen 3. Chi tiết: {last_error}")
