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
from pydantic import ValidationError

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

    DEFAULT_MODEL = CANDIDATE_MODELS[0]

    # Các tỉ lệ khung hình hợp lệ được hỗ trợ bởi Imagen 3
    VALID_RATIOS = {"1:1", "3:4", "4:3", "16:9", "9:16"}

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
        Gọi Google Generative Language REST API để sinh ảnh bằng Imagen 3 hoặc Gemini Multimodal Image.
        Hỗ trợ nạp ảnh mẫu tham chiếu (Image 1 & Image 2) cùng câu prompt.

        @param {str} api_key Khóa Google Gemini API.
        @param {str} prompt Lời nhắc mô tả ảnh cần tạo.
        @param {Optional[str]} negative_prompt Lời nhắc các chi tiết cần loại bỏ.
        @param {str} aspect_ratio Tỉ lệ khung hình ('1:1', '3:4', '4:3', '16:9', '9:16').
        @param {int} number_of_images Số lượng ảnh mong muốn (tối đa 4).
        @param {Optional[str]} base_url Địa chỉ máy chủ tùy chọn.
        @param {Optional[str]} model Mô hình Imagen cụ thể cần dùng.
        @param {Optional[str]} image Chuỗi Base64 ảnh mẫu tham chiếu số 1 nếu có.
        @param {Optional[str]} reference_image_2 Chuỗi Base64 ảnh tham chiếu số 2 cố định nếu có.
        @returns {ImageGenResponse} Danh sách các ảnh đã được tạo kèm metadata.
        """
        deadline = time.monotonic() + self.NETWORK_BUDGET_SECONDS
        target_ratio = aspect_ratio if aspect_ratio in self.VALID_RATIOS else "1:1"
        sample_count = min(max(1, number_of_images), 4)

        # Thu thập danh sách ảnh tham chiếu theo đúng thứ tự: Ảnh 1 trước, Ảnh 2 sau
        reference_b64_list = [
            raw.strip() for raw in (image, reference_image_2) if raw and raw.strip()
        ]

        parameters_dict: Dict[str, Any] = {
            "sampleCount": sample_count,
            "aspectRatio": target_ratio,
            "outputMimeType": "image/png"
        }
        if negative_prompt:
            parameters_dict["negativePrompt"] = negative_prompt

        instance_data: Dict[str, Any] = {"prompt": prompt}
        if reference_b64_list:
            # Endpoint :predict của Imagen chỉ hỗ trợ tối đa 1 ảnh đầu vào
            instance_data["image"] = {"bytesBase64Encoded": reference_b64_list[0]}

        payload = {
            "instances": [instance_data],
            "parameters": parameters_dict
        }

        last_error = ""
        # Thử lần lượt các mô hình Imagen 3 khả dụng hoặc mô hình chỉ định
        models_to_try = [model.strip()] if model and model.strip() else self.CANDIDATE_MODELS
        for model_name in models_to_try:
            # 1. Thử gọi qua endpoint predict (chuẩn Imagen 3)
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:predict"
            headers = {
                "x-goog-api-key": api_key,
                "Content-Type": "application/json"
            }

            try:
                resp = self._request('POST', url, json=payload, headers=headers, deadline=deadline, label=f'gemini / {model_name}')
                if resp.status_code == 200:
                    data = self._json(resp, f'gemini / {model_name}')
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

                # 2. Nếu mô hình hỗ trợ generateContent (chẳng hạn gemini-*-image hoặc multimodal generateContent)
                elif resp.status_code == 404 or "not found" in resp.text.lower():
                    gen_url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
                    parts: List[Dict[str, Any]] = [{"text": prompt}]
                    for ref_b64 in reference_b64_list:
                        parts.append({
                            "inline_data": {
                                "mime_type": "image/png",
                                "data": ref_b64
                            }
                        })
                    gen_payload = {
                        "contents": [{"parts": parts}],
                        "generationConfig": {"responseModalities": ["IMAGE"]}
                    }
                    gen_resp = self._request('POST', gen_url, json=gen_payload, headers=headers, deadline=deadline, label=f'gemini / {model_name}')
                    if gen_resp.status_code == 200:
                        gen_data = self._json(gen_resp, f'gemini / {model_name}')
                        items = []
                        for cand_idx, cand in enumerate(gen_data.get("candidates", [])):
                            for p in cand.get("content", {}).get("parts", []):
                                inline = p.get("inlineData") or p.get("inline_data")
                                if inline and inline.get("data"):
                                    b64_raw = inline.get("data")
                                    mime = inline.get("mimeType", "image/png")
                                    item_id = f"img_{int(time.time() * 1000)}_{cand_idx + 1}"
                                    items.append(GeneratedImageItem(
                                        id=item_id,
                                        b64_data=b64_raw,
                                        mime_type=mime,
                                        data_url=f"data:{mime};base64,{b64_raw}",
                                        aspect_ratio=target_ratio
                                    ))
                        if items:
                            return ImageGenResponse(
                                status="success",
                                message=f"Đã tạo thành công {len(items)} ảnh bằng Google Gemini ({model_name})!",
                                provider_used="gemini",
                                model_used=model_name,
                                images=items
                            )

                    last_error = f'gemini / {model_name}: generateContent không có ảnh hợp lệ (HTTP {gen_resp.status_code}).'

                elif resp.status_code == 400:
                    err_msg = resp.text.replace(api_key, '[REDACTED_API_KEY]')
                    # Phát hiện vi phạm bộ lọc an toàn nội dung
                    if "SAFETY" in err_msg or "blocked" in err_msg.lower():
                        raise ValueError("Yêu cầu tạo ảnh bị bộ lọc an toàn nội dung của Google từ chối. Vui lòng điều chỉnh lại prompt.")
                    last_error = f"Lỗi yêu cầu ({resp.status_code}): {err_msg[:200]}"

                else:
                    last_error = f"Google Imagen 3 báo lỗi ({resp.status_code}): {resp.text.replace(api_key, '[REDACTED_API_KEY]')[:200]}"

            except (AttributeError, TypeError, KeyError, ValidationError) as exc:
                raise ImageGenUpstreamError(f'gemini / {model_name}: cấu trúc phản hồi không hợp lệ.') from exc

        raise RuntimeError(f"Không thể tạo ảnh từ Google Imagen 3. Chi tiết: {last_error}")
