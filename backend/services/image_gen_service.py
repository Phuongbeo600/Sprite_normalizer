# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống, Chuỗi & Xử lý Base64)
# ========================================================
# base64: Xử lý giải mã và mã hóa chuỗi byte ảnh Base64
import base64
# logging: Ghi nhật ký lỗi và cảnh báo hệ thống
import logging
# os: Đọc biến môi trường hệ thống
import os
# time: Tạo mã định danh duy nhất theo timestamp
import time
# typing: Định nghĩa các kiểu danh sách, từ điển, tùy chọn
from typing import Dict, Any, List, Optional, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# requests: Gửi HTTP POST tới Google Generative Language REST API hoặc OpenAI API
import requests

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services, Repositories & Schemas)
# ========================================================
# SessionLocal: Kết nối CSDL MySQL quản lý dự án
from backend.db import SessionLocal
# ProjectService: Dịch vụ truy xuất API Key cấu hình trong MySQL của dự án
from backend.services.project_service import ProjectService
# SettingsService: Dịch vụ cấu hình hệ thống & che dấu API Key
from backend.services.settings_service import SettingsService
# Schemas: DTO kiểm tra dữ liệu yêu cầu và phản hồi sinh ảnh
from backend.schemas.image_gen import ImageGenRequest, ImageGenResponse, GeneratedImageItem

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class ImageGenService:
    """
    Dịch vụ Tạo ảnh AI (AI Image Generation Service).
    - Hỗ trợ tạo ảnh Sprite / Nhân vật game qua Google Gemini Imagen 3 hoặc OpenAI DALL-E 3.
    - Tự động liên kết khóa API từ Cài đặt dự án trong MySQL hoặc Cài đặt chung (.env).
    - Cam kết không tự động gọi API ngầm làm tiêu tốn token của người dùng.
    """

    # Danh sách model Imagen 3 của Google Generative Language
    GEMINI_IMAGEN_MODELS = [
        "imagen-3.0-generate-002",
        "imagen-3.0-fast-generate-001"
    ]

    # Model mặc định của OpenAI cho sinh ảnh chất lượng cao
    OPENAI_IMAGE_MODEL = "dall-e-3"

    @classmethod
    def resolve_credentials(
        cls,
        project_id: Optional[int] = None,
        api_key: Optional[str] = None,
        provider: Optional[str] = None,
        base_url: Optional[str] = None
    ) -> Tuple[Optional[str], str, Optional[str]]:
        """
        Xác định thông tin xác thực hiệu lực (API Key, Provider, Base URL):
        1. Ưu tiên khóa API truyền trực tiếp.
        2. Nếu có project_id: Tra cứu trong CSDL MySQL của dự án.
        3. Nếu chưa có: Lấy từ biến môi trường toàn cục (.env).
        
        @returns {Tuple[Optional[str], str, Optional[str]]} (api_key, provider, base_url).
        """
        eff_key = api_key
        eff_prov = provider
        eff_base = base_url

        # 1. Tra cứu CSDL dự án nếu có project_id
        if not eff_key and project_id:
            try:
                service = ProjectService()
                with SessionLocal() as db:
                    eff_key, eff_prov, eff_base = service.resolve_project_credentials(
                        db=db,
                        project_id=project_id,
                        api_key=api_key,
                        provider=provider,
                        base_url=base_url
                    )
            except Exception as exc:
                logging.warning(f"Không thể đọc cấu hình API Key từ CSDL dự án {project_id}: {exc}")

        # 2. Tra cứu biến môi trường hệ thống (.env) nếu vẫn chưa có
        clean_provider = (eff_prov or os.getenv("AI_PROVIDER", "gemini")).lower().strip()
        clean_base = eff_base or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

        if not eff_key:
            env_var = "OPENAI_API_KEY" if clean_provider == "openai" else "GEMINI_API_KEY"
            eff_key = os.getenv(env_var)

        return eff_key, clean_provider, clean_base

    @classmethod
    def get_status(cls, project_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Kiểm tra trạng thái sẵn sàng của cấu hình sinh ảnh (Không tiêu tốn token nào).
        
        @param {Optional[int]} project_id Mã dự án (nếu có).
        @returns {Dict[str, Any]} Thông tin nhà cung cấp và trạng thái có sẵn key hay chưa.
        """
        key, provider, base_url = cls.resolve_credentials(project_id=project_id)
        has_key = bool(key and key.strip())
        masked_key = SettingsService.mask_api_key(key) if has_key else ""

        ai_enabled = True
        if project_id:
            try:
                service = ProjectService()
                with SessionLocal() as db:
                    cfg = service.get_api_config(db, project_id)
                    if cfg and cfg.get("ai_enabled") is False:
                        ai_enabled = False
            except Exception:
                pass

        return {
            "status": "success",
            "provider": provider,
            "has_key": has_key,
            "masked_key": masked_key,
            "ready": has_key and ai_enabled,
            "ai_enabled": ai_enabled,
            "base_url": base_url if provider == "openai" else None
        }

    @classmethod
    def generate_images(cls, request: ImageGenRequest) -> ImageGenResponse:
        """
        Thực hiện gửi yêu cầu tạo ảnh tới mô hình AI đã cấu hình.
        Chỉ chạy khi người dùng chủ động bấm nút Tạo ảnh trên giao diện.

        @param {ImageGenRequest} request Yêu cầu chứa prompt, tỉ lệ, số lượng ảnh và mã dự án.
        @returns {ImageGenResponse} Danh sách các ảnh đã được tạo kèm metadata.
        """
        # Kiểm tra công tắc AI của dự án
        if request.project_id:
            try:
                service = ProjectService()
                with SessionLocal() as db:
                    cfg = service.get_api_config(db, request.project_id)
                    if cfg and cfg.get("ai_enabled") is False:
                        raise ValueError(
                            "Tính năng AI hiện đang bị tắt trong 'Cài đặt dự án'. "
                            "Vui lòng bật lại công tắc AI trước khi thực hiện tạo ảnh!"
                        )
            except ValueError:
                raise
            except Exception:
                pass

        # 1. Trích xuất thông tin xác thực hiệu lực
        key, provider, base_url = cls.resolve_credentials(
            project_id=request.project_id,
            api_key=request.api_key,
            provider=request.provider,
            base_url=request.base_url
        )

        if not key or not key.strip():
            provider_name = "Google Gemini" if provider == "gemini" else "OpenAI"
            raise ValueError(
                f"Chưa cấu hình API Key cho {provider_name}! "
                f"Vui lòng vào tab 'Cài đặt dự án' hoặc 'Cài đặt hệ thống' để lưu khóa API trước khi tạo ảnh."
            )

        # 2. Xây dựng prompt hoàn chỉnh kết hợp phong cách (style_preset) nếu có
        prompt_parts = [request.prompt.strip()]
        if request.style_preset:
            prompt_parts.append(f"Style: {request.style_preset.strip()}")
        full_prompt = ", ".join(prompt_parts)

        # 3. Phân luồng gọi API theo nhà cung cấp
        clean_neg_prompt = request.negative_prompt.strip() if request.negative_prompt else None
        if provider == "openai":
            return cls._generate_with_openai(
                api_key=key.strip(),
                base_url=base_url,
                prompt=full_prompt,
                negative_prompt=clean_neg_prompt,
                aspect_ratio=request.aspect_ratio,
                number_of_images=request.number_of_images
            )
        else:
            return cls._generate_with_gemini_imagen(
                api_key=key.strip(),
                prompt=full_prompt,
                negative_prompt=clean_neg_prompt,
                aspect_ratio=request.aspect_ratio,
                number_of_images=request.number_of_images
            )

    @classmethod
    def _generate_with_gemini_imagen(
        cls,
        api_key: str,
        prompt: str,
        negative_prompt: Optional[str],
        aspect_ratio: str,
        number_of_images: int
    ) -> ImageGenResponse:
        """
        Gọi Google Generative Language REST API để sinh ảnh bằng Imagen 3.
        Hỗ trợ cơ chế Fallback tự động qua các model Imagen khả dụng và nạp negativePrompt chuẩn.
        """
        # Chuẩn hóa tỉ lệ theo chuẩn Imagen 3 ("1:1", "3:4", "4:3", "16:9", "9:16")
        valid_ratios = {"1:1", "3:4", "4:3", "16:9", "9:16"}
        target_ratio = aspect_ratio if aspect_ratio in valid_ratios else "1:1"
        sample_count = min(max(1, number_of_images), 4)

        parameters_dict = {
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
        for model_name in cls.GEMINI_IMAGEN_MODELS:
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

    @classmethod
    def _generate_with_openai(
        cls,
        api_key: str,
        base_url: Optional[str],
        prompt: str,
        negative_prompt: Optional[str],
        aspect_ratio: str,
        number_of_images: int
    ) -> ImageGenResponse:
        """
        Gọi OpenAI Images API để sinh ảnh qua mô hình DALL-E 3 (hoặc DALL-E 2).
        Ghép nối Negative Constraints vào prompt để định hướng DALL-E loại bỏ chi tiết xấu.
        """
        clean_base = (base_url or "https://api.openai.com/v1").rstrip("/")
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
            "model": cls.OPENAI_IMAGE_MODEL,
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
                        message=f"Đã tạo thành công ảnh bằng OpenAI ({cls.OPENAI_IMAGE_MODEL})!",
                        provider_used="openai",
                        model_used=cls.OPENAI_IMAGE_MODEL,
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
