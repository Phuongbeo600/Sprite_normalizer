# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa các kiểu danh sách, từ điển, tùy chọn, bộ giá trị
from typing import Dict, Any, List, Optional, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services, Providers & Schemas)
# ========================================================
# SettingsService: Dịch vụ cấu hình hệ thống & che dấu API Key
from backend.services.settings_service import SettingsService
from backend.providers.image_gen.base import BaseImageGenProvider, ImageGenUpstreamError
# ImagePostProcessingService: Hậu xử lý cắt 15 frame, ép độ phân giải và ghép sheet
from backend.services.image_post_processing_service import ImagePostProcessingService
# save_generated_images_to_project: Lưu cặp ảnh gốc, ảnh hậu xử lý và frame con vào MySQL
from backend.services.image_gen_persistence import save_generated_images_to_project
# AiCredentialsService: Dịch vụ hợp nhất phân giải thông tin xác thực AI
from backend.services.ai_credentials_service import AiCredentialsService
# build_prompt_from_request: Pipeline xây dựng prompt hoàn chỉnh từ template động
from backend.services.image_gen_prompts import build_prompt_from_request
# load_fixed_reference_image_2_b64: Đọc và đóng gói Ảnh tham chiếu số 2 cố định từ thư mục tài nguyên
from backend.services.reference_image_assets import load_fixed_reference_image_2_b64
# ImageGenProviderFactory: Factory khởi tạo Provider tạo ảnh theo tên
from backend.providers.image_gen import (
    ImageGenProviderFactory,
    GeminiImagenProvider,
    OpenAiDalleProvider
)
# Schemas: DTO kiểm tra dữ liệu yêu cầu và phản hồi sinh ảnh
from backend.schemas.image_gen import ImageGenRequest, ImageGenResponse, GeneratedImageItem

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class ImageGenService:
    """
    Dịch vụ Điều phối Tạo ảnh AI (AI Image Generation Orchestration Service).
    - Đóng vai trò tầng nghiệp vụ (Service Layer) điều phối luồng tạo ảnh nhân vật game/sprite.
    - Phân giải thông tin xác thực hiệu lực (API Key, Provider, Base URL) qua AiCredentialsService.
    - Ủy quyền toàn bộ việc kết nối HTTP REST API và bóc tách dữ liệu sang tầng Provider (ImageGenProviderFactory).
    - Cam kết không tự động gọi API ngầm làm tiêu tốn token của người dùng.
    """

    # Danh sách model Imagen 3 của Google (Ủy quyền tham chiếu từ GeminiImagenProvider)
    GEMINI_IMAGEN_MODELS = GeminiImagenProvider.CANDIDATE_MODELS

    # Model mặc định của OpenAI cho sinh ảnh (Ủy quyền tham chiếu từ OpenAiDalleProvider)
    OPENAI_IMAGE_MODEL = OpenAiDalleProvider.DEFAULT_MODEL

    @classmethod
    def resolve_credentials(
        cls,
        project_id: Optional[int] = None,
        api_key: Optional[str] = None,
        provider: Optional[str] = None,
        base_url: Optional[str] = None
    ) -> Tuple[Optional[str], str, Optional[str]]:
        """
        Xác định thông tin xác thực hiệu lực (API Key, Provider, Base URL) qua AiCredentialsService.

        @returns {Tuple[Optional[str], str, Optional[str]]} (api_key, provider, base_url).
        """
        return AiCredentialsService.resolve_credentials(
            project_id=project_id,
            api_key=api_key,
            provider=provider,
            base_url=base_url,
            scope="image_gen",
        )

    @classmethod
    def get_status(cls, project_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Kiểm tra trạng thái sẵn sàng của cấu hình sinh ảnh (Không tiêu tốn token nào).

        @param {Optional[int]} project_id Mã dự án (nếu có).
        @returns {Dict[str, Any]} Thông tin nhà cung cấp và trạng thái có sẵn key hay chưa.
        """
        config = AiCredentialsService.resolve_image_configuration(project_id=project_id)
        key, provider, base_url = config["api_key"], config["provider"], config["base_url"]
        has_key = bool(key and key.strip())
        masked_key = SettingsService.mask_api_key(key) if has_key and config["config_source"] == "project" else ""
        ai_enabled = AiCredentialsService.is_ai_enabled(project_id, scope="image_gen")
        active_model = config["model"] or getattr(ImageGenProviderFactory.get_provider(provider), "DEFAULT_MODEL", None)

        return {
            "status": "success",
            "provider": provider,
            "has_key": has_key,
            "masked_key": masked_key,
            "ready": config.get("ready", has_key) and ai_enabled,
            "ai_enabled": ai_enabled,
            "base_url": base_url if provider == "openai" else None,
            "model": active_model,
            "config_source": config["config_source"],
        }

    @classmethod
    def generate_images(cls, request: ImageGenRequest) -> ImageGenResponse:
        """
        Thực hiện điều phối gửi yêu cầu tạo ảnh tới mô hình AI đã cấu hình.
        Chỉ chạy khi người dùng chủ động bấm nút Tạo ảnh trên giao diện.

        @param {ImageGenRequest} request Yêu cầu chứa prompt, tỉ lệ, số lượng ảnh và mã dự án.
        @returns {ImageGenResponse} Danh sách các ảnh đã được tạo kèm metadata.
        """
        # 1. Kiểm tra công tắc AI của dự án
        if request.project_id and not AiCredentialsService.is_ai_enabled(request.project_id, scope="image_gen"):
            raise ValueError(
                "Tính năng AI hiện đang bị tắt trong 'Cài đặt dự án'. "
                "Vui lòng bật lại công tắc AI trước khi thực hiện tạo ảnh!"
            )

        # 2. Trích xuất thông tin xác thực hiệu lực
        config = AiCredentialsService.resolve_image_configuration(
            project_id=request.project_id,
            api_key=request.api_key,
            provider=request.provider,
            base_url=request.base_url,
            model=request.model,
        )
        key, provider, base_url = config["api_key"], config["provider"], config["base_url"]

        if not key or not key.strip():
            provider_name = {"gemini": "Google Gemini", "cloudflare": "Cloudflare Workers AI"}.get(provider, "OpenAI")
            raise ValueError(
                f"Chưa cấu hình API Key cho {provider_name}! "
                f"Vui lòng vào tab 'Cài đặt dự án' hoặc 'Cài đặt hệ thống' để lưu khóa API trước khi tạo ảnh."
            )

        # 3. Xây dựng final prompt qua pipeline template động (không ghép chuỗi trực tiếp trong service)
        full_prompt = build_prompt_from_request(request)

        # 3.1. Bóc tách chuỗi Base64 thuần của ảnh tham chiếu số 1 (nếu có) và nạp Ảnh số 2 cố định từ thư mục tài nguyên
        clean_image_b64 = None
        if request.image and request.image.strip():
            raw_img = request.image.strip()
            clean_image_b64 = raw_img.split(",", 1)[1] if "," in raw_img else raw_img
        fixed_ref_2_b64 = load_fixed_reference_image_2_b64()

        # 4. Giải quyết model tạo ảnh: ưu tiên từ request -> cấu hình project trong CSDL
        selected_model = config["model"]

        # 5. Ủy quyền cho Provider chuyên trách thông qua Factory (Áp dụng Strategy Pattern)
        clean_neg_prompt = request.negative_prompt.strip() if request.negative_prompt else None
        provider_instance = ImageGenProviderFactory.get_provider(provider)

        provider_kwargs: Dict[str, Any] = {
            "api_key": key.strip(),
            "prompt": full_prompt,
            "negative_prompt": clean_neg_prompt,
            "aspect_ratio": request.aspect_ratio,
            "number_of_images": request.number_of_images,
            "base_url": base_url,
            "model": selected_model,
            "image": clean_image_b64,
        }
        if fixed_ref_2_b64:
            provider_kwargs["reference_image_2"] = fixed_ref_2_b64

        response = provider_instance.generate_images(**provider_kwargs)
        if not isinstance(response, ImageGenResponse) or response.status != "success" or not response.images:
            raise ImageGenUpstreamError('Dịch vụ tạo ảnh phản hồi nhưng không có danh sách ảnh hợp lệ.')
        for image in response.images:
            mime = BaseImageGenProvider.validate_image(image.b64_data)
            image.mime_type = mime
            image.data_url = f'data:{mime};base64,{image.b64_data}'
        for image in response.images:
            image.post_processing = ImagePostProcessingService.process(image, request.native_size_wh)
        return response

    @classmethod
    def save_generated_images(
        cls,
        request: ImageGenRequest,
        response: ImageGenResponse,
        db: Optional[Any] = None,
    ) -> ImageGenResponse:
        """
        Lưu ảnh gốc từ API cùng ảnh đã hậu xử lý (và các frame con) vào Kho Tài Nguyên của dự án.

        @param {ImageGenRequest} request Yêu cầu tạo ảnh chứa project_id và prompt.
        @param {ImageGenResponse} response Kết quả sinh ảnh kèm hậu xử lý.
        @param {Optional[Any]} db Phiên CSDL tùy chọn.
        @returns {ImageGenResponse} Phản hồi đã gắn saved_sprite_id và saved_to_project.
        """
        return save_generated_images_to_project(request=request, response=response, db=db)

    # ========================================================
    # CÁC PHƯƠNG THỨC ỦY QUYỀN TƯƠNG THÍCH NGƯỢC (Backward Compatibility)
    # ========================================================

    @classmethod
    def _generate_with_gemini_imagen(
        cls,
        api_key: str,
        prompt: str,
        negative_prompt: Optional[str],
        aspect_ratio: str,
        number_of_images: int,
        image: Optional[str] = None
    ) -> ImageGenResponse:
        """Phương thức tương thích ngược ủy quyền sang GeminiImagenProvider."""
        return GeminiImagenProvider().generate_images(
            api_key=api_key,
            prompt=prompt,
            negative_prompt=negative_prompt,
            aspect_ratio=aspect_ratio,
            number_of_images=number_of_images,
            image=image
        )

    @classmethod
    def _generate_with_openai(
        cls,
        api_key: str,
        base_url: Optional[str],
        prompt: str,
        negative_prompt: Optional[str],
        aspect_ratio: str,
        number_of_images: int,
        image: Optional[str] = None
    ) -> ImageGenResponse:
        """Phương thức tương thích ngược ủy quyền sang OpenAiDalleProvider."""
        return OpenAiDalleProvider().generate_images(
            api_key=api_key,
            prompt=prompt,
            negative_prompt=negative_prompt,
            aspect_ratio=aspect_ratio,
            number_of_images=number_of_images,
            base_url=base_url,
            image=image
        )
