# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống, Logging & Xử lý JSON)
# ========================================================
# io: Xử lý bộ đệm luồng byte hình ảnh tải lên
import io
# json: Phân tích cú pháp dữ liệu JSON truyền vào
import json
# logging: Ghi nhận nhật ký cảnh báo lỗi
import logging
# typing: Định nghĩa các kiểu từ điển, tùy chọn, bộ giá trị
from typing import Annotated, Optional, Dict, Any, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# fastapi: Khởi tạo router, nhận file upload, Request và xử lý Dependency Injection
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Request
# sqlalchemy: Phiên làm việc cơ sở dữ liệu
from sqlalchemy.orm import Session
# run_in_threadpool: Giữ các tuyến đo có thể phục vụ trong lúc chờ Gemini.
from fastapi.concurrency import run_in_threadpool
# pydantic: Định nghĩa schema kiểm tra dữ liệu yêu cầu
from pydantic import BaseModel, Field
# PIL (Pillow): Mở ảnh tải lên
from PIL import Image, ImageOps

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services, Database & Schemas)
# ========================================================
# get_db: Dependency cấp phiên MySQL
from backend.db import get_db, SessionLocal
# get_current_user_optional, check_project_access: Kiểm soát quyền truy cập và bảo vệ API key dự án
from backend.core.dependencies import get_current_user_optional, check_project_access
# load_control: Kiểm soát tải, Rate Limiting và kiểm tra kích thước tệp sớm
from backend.core.load_control import (
    check_rate_limit,
    ai_gen_concurrency,
    validate_upload_file_size,
    RATE_LIMIT_AI_GEN
)
# AiProviderError: Ngoại lệ chuẩn hóa từ các nhà cung cấp AI
from backend.providers.base import AiProviderError
# CharacterAnalysisService: Dịch vụ phân tích nhân vật theo phân hệ Tab
from backend.services.character.character_analysis_service import CharacterAnalysisService
# generate_style_prompt: Phân tích cách vẽ dựa trên ảnh và số đo Python.
from backend.services.character.reference_style_service import generate_style_prompt
# ReferenceStylePrompt: Dữ liệu phong cách trả về Studio.
from backend.schemas.character.ai_analysis import ReferenceStylePrompt
# PromptBuilderService: Dịch vụ xây dựng ma trận 15 frame hoạt họa chân tay đối nghịch
from backend.services.character.prompt_builder_service import PromptBuilderService
# SessionLocal: Tạo phiên làm việc CSDL MySQL để truy xuất key của dự án
from backend.db import SessionLocal
# ProjectService: Dịch vụ dự án xử lý truy xuất cấu hình API Key
from backend.services.project_service import ProjectService
# AiCredentialsService: Dịch vụ hợp nhất phân giải thông tin xác thực AI
from backend.services.ai_credentials_service import AiCredentialsService
# Schemas: DTO yêu cầu sinh Prompt từ hồ sơ nhân vật và biên dịch ma trận frame
from backend.schemas.character.prompt import (
    GeneratePromptFromProfileRequest,
    CompileSpriteSheetPromptRequest
)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

character_analysis_router = APIRouter(prefix="/character-profile", tags=["Character Profile Analysis"])
VISION_PROVIDERS = ("gemini", "openai")


def _resolve_project_api_key(
    project_id: Optional[int],
    api_key: Optional[str],
    provider: Optional[str],
    base_url: Optional[str],
    project_service: Optional[ProjectService] = None
) -> Tuple[Optional[str], str, Optional[str]]:
    """Hàm phụ trợ lấy API Key từ cấu hình dự án thông qua ProjectService nếu không truyền trực tiếp."""
    return AiCredentialsService.resolve_credentials(
        project_id=project_id,
        api_key=api_key,
        provider=provider,
        base_url=base_url,
        project_service=project_service,
    )


@character_analysis_router.get("/vision-status")
def get_vision_status(
    project_id: Optional[int] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Đọc trạng thái cấu hình AI cục bộ, không gọi nhà cung cấp (có kiểm tra quyền sở hữu nếu truyền project_id)."""
    if project_id is not None:
        check_project_access(db, project_id, current_user)
    ai_enabled = AiCredentialsService.is_ai_enabled(project_id) #Xem dự án này có cho dùng AI không
    credentials = _resolve_project_api_key(project_id, None, None, None)# Đi tìm bộ thông tin xác thực (API key,provider)
    key, provider, _ = CharacterAnalysisService._resolve_credentials(*credentials)
    ready = provider in VISION_PROVIDERS and bool((key or "").strip()) and ai_enabled
    active_model = AiCredentialsService.resolve_model(provider=provider, project_id=project_id, model_type="vision")
    return {
        "provider": provider,
        "ready": ready,
        "ai_enabled": ai_enabled,
        "gemini_ready": provider == "gemini" and ready,
        "model": active_model
    }


@character_analysis_router.post("/style-prompt", response_model=ReferenceStylePrompt)
async def generate_reference_style_prompt(
    file: Annotated[UploadFile, File()],#lấy ảnh nạp lên từ người dùng
    python_metrics_json: Annotated[str, Form(max_length=12000)],#Annotated dùng để kẹp luật đi kèm, kiểu là str, độ dài tối đa 12k
    project_id: Annotated[Optional[int], Form()] = None,
    api_key: Annotated[Optional[str], Form()] = None,
    provider: Annotated[Optional[str], Form()] = None,
    base_url: Annotated[Optional[str], Form()] = None,
    model: Annotated[Optional[str], Form()] = None,
    http_request: Request = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
) -> ReferenceStylePrompt:
    """Tạo chỉ dẫn phong cách từ ảnh đã chọn và các số đo của Studio (có kiểm tra quyền sở hữu nếu truyền project_id)."""
    if http_request is not None and hasattr(http_request, "headers"):
        check_rate_limit(http_request, scope="ai_vision", max_requests=RATE_LIMIT_AI_GEN, current_user=current_user)

    if project_id is not None:
        check_project_access(db, project_id, current_user)

    if project_id and not AiCredentialsService.is_ai_enabled(project_id):
        raise HTTPException(
            status_code=403,
            detail="Tính năng AI đang bị tắt trong Cài đặt dự án. Vui lòng bật lại công tắc AI trước khi thực hiện."
        )

    credentials = await run_in_threadpool(_resolve_project_api_key, project_id, api_key, provider, base_url)
    key, eff_provider, eff_base_url = CharacterAnalysisService._resolve_credentials(*credentials)
    if eff_provider not in VISION_PROVIDERS or not (key or "").strip():
        raise HTTPException(status_code=409, detail="Chưa cấu hình khóa API cho nhà cung cấp đã chọn.")

    # TASK-06: Hoàn trả kết nối CSDL về Connection Pool ngay khi kiểm tra quyền và lấy cấu hình xong,
    # tránh chiếm giữ kết nối MySQL trong suốt thời gian gọi AI Vision phân tích ảnh (3-10 giây).
    if hasattr(db, "close"):
        db.close()

    try:
        metrics = json.loads(python_metrics_json)
    except ValueError as error:
        raise HTTPException(status_code=422, detail="Số đo Python phải là JSON hợp lệ.") from error
    if not isinstance(metrics, dict):
        raise HTTPException(status_code=422, detail="Số đo Python phải là một đối tượng JSON.")

    try:
        contents = await file.read()
        validate_upload_file_size(contents)
    except (OSError, ValueError, Image.DecompressionBombError) as error:
        raise HTTPException(status_code=400, detail="Không đọc được ảnh sprite.") from error

    eff_model = AiCredentialsService.resolve_model(provider=eff_provider, model=model, project_id=project_id, model_type="vision")

    def _run_generate_style():
        with ai_gen_concurrency:
            with Image.open(io.BytesIO(contents)) as source:
                with ImageOps.exif_transpose(source).convert("RGBA") as image:
                    return generate_style_prompt(image, metrics, key.strip(), eff_provider, eff_base_url, eff_model)

    try:
        return await run_in_threadpool(_run_generate_style)
    except AiProviderError as ape:
        raise HTTPException(status_code=ape.status_code, detail=ape.message)
    except (ValueError, RuntimeError) as error:
        raise HTTPException(
            status_code=502, detail="Nhà cung cấp AI chưa trả được đoạn phong cách hợp lệ. Hãy thử lại.",
        ) from error


@character_analysis_router.post("/analyze-tab")
async def analyze_character_tab(
    file: UploadFile = File(...),
    tab_name: str = Form("global"),
    project_id: Optional[int] = Form(None),
    api_key: Optional[str] = Form(None),
    provider: Optional[str] = Form(None),
    base_url: Optional[str] = Form(None),
    model: Optional[str] = Form(None),
    current_profile_json: Optional[str] = Form(None),
    vision_only: Annotated[bool, Form()] = False,
    http_request: Request = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Phân tích độc lập từng Tab (hoặc toàn bộ) cho Hồ sơ Nhân vật tham chiếu:
    Tự động đọc API Key từ CSDL MySQL của project nếu có project_id (có kiểm tra quyền sở hữu).
    """
    if http_request is not None and hasattr(http_request, "headers"):
        check_rate_limit(http_request, scope="ai_vision", max_requests=RATE_LIMIT_AI_GEN, current_user=current_user)

    if project_id is not None:
        check_project_access(db, project_id, current_user)

    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Tệp tải lên phải là định dạng hình ảnh.")

    try:
        if vision_only and project_id and not AiCredentialsService.is_ai_enabled(project_id):
            raise HTTPException(
                status_code=403,
                detail="Tính năng AI đang bị tắt trong Cài đặt dự án."
            )

        # Tự động lấy key từ MySQL của dự án nếu cần
        credentials = await run_in_threadpool(_resolve_project_api_key, project_id, api_key, provider, base_url)
        eff_key, eff_prov, eff_base = CharacterAnalysisService._resolve_credentials(*credentials)
        if vision_only:
            if eff_prov not in VISION_PROVIDERS or not (eff_key or "").strip():
                raise HTTPException(status_code=409, detail="Chưa cấu hình khóa API cho nhà cung cấp đã chọn.")

        # TASK-06: Hoàn trả kết nối CSDL về Connection Pool ngay sau khi tra cứu xong cấu hình dự án,
        # tránh chiếm giữ kết nối MySQL trong suốt thời gian gọi AI Vision phân tích hồ sơ nhân vật (5-15 giây).
        if hasattr(db, "close"):
            db.close()

        contents = await file.read()
        validate_upload_file_size(contents)
        if tab_name.lower().strip() not in {"global", "directions", "animations", "constraints", "all"}:
            raise HTTPException(status_code=400, detail=f"Tab '{tab_name}' không hợp lệ.")

        eff_model = AiCredentialsService.resolve_model(provider=eff_prov, model=model, project_id=project_id, model_type="vision")

        def _run_analyze_profile():
            with ai_gen_concurrency:
                with Image.open(io.BytesIO(contents)) as source:
                    with source.convert("RGBA") as image:
                        return CharacterAnalysisService.analyze_profile(
                            image, tab_name, eff_key, eff_prov, eff_base,
                            current_profile_json, vision_only, model=eff_model,
                        )

        return await run_in_threadpool(_run_analyze_profile)

    except HTTPException:
        raise
    except AiProviderError as ape:
        raise HTTPException(status_code=ape.status_code, detail=ape.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi phân tích hồ sơ nhân vật: {str(e)}")


@character_analysis_router.post("/generate-prompt")
async def generate_prompt_from_profile(
    request: GeneratePromptFromProfileRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    db: Session = Depends(get_db),
):
    """
    Sinh Prompt tiếng Anh tối ưu khống chế tỷ lệ, phong cách pixel và vật liệu
    cho Nhân vật Mới dựa trên Hồ sơ nhân vật tham chiếu.
    Hỗ trợ đầy đủ ma trận 15 frames hoạt họa Sprite Sheet (3 Hướng × 5 Frames có cả Chân và Tay).
    RÀNG BUỘC BẢO MẬT: Kiểm tra quyền sở hữu nếu truyền project_id.
    """
    if request.project_id is not None:
        check_project_access(db, request.project_id, current_user)

    # TASK-06: Hoàn trả kết nối CSDL về Connection Pool ngay sau khi kiểm tra quyền dự án
    if hasattr(db, "close"):
        db.close()

    try:
        concept = request.core_concept or request.character_concept or "Pixel Art Character"# lấy ý tưởng người dùng ở ô nhập promt
        await run_in_threadpool(
            _resolve_project_api_key,
            request.project_id, request.api_key, request.provider, request.base_url
        )

        prof_data = dict(request.profile_data or {})
        if request.metrics and "metrics" not in prof_data:
            prof_data["metrics"] = request.metrics

        # Sử dụng PromptBuilderService để biên dịch ma trận 15 frame hoạt họa
        compiled = await run_in_threadpool(
            PromptBuilderService.compile_sprite_sheet_prompt,
            character_concept=concept,
            profile_data=prof_data,
            frame_actions=request.frame_actions,
            outfit_and_colors=request.outfit_and_colors,
            weapons_and_props=request.weapons_and_props,
            custom_instructions=f"Vóc dáng: {request.stature_rule}",
            inherit_scale=request.inherit_scale,
            inherit_style=request.inherit_style,
        )

        final_pos = request.compiled_positive_prompt or compiled["positive_prompt"]
        final_neg = request.compiled_negative_prompt or compiled["negative_prompt"]

        return {
            "status": "success",
            "data": {
                "positive_prompt": final_pos,
                "negative_prompt": final_neg,
                "frame_actions_data": compiled["frame_actions_data"],
                "technical_notes": (
                    f"Prompt tối ưu hóa ma trận 15 frame (3 hướng × 5 frame) cho nhân vật mới '{concept}'. "
                    f"Tích hợp chuẩn chuyển động Chân & Tay đối nghịch tự nhiên và kế thừa tỷ lệ kích thước từ Schemas."
                )
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi sinh Prompt từ hồ sơ nhân vật: {str(e)}")


@character_analysis_router.post("/frame-matrix/defaults")
def get_default_frame_matrix(profile_data: Optional[Dict[str, Any]] = None):
    """
    Trích xuất toàn bộ dữ liệu từ 7 Schemas để khởi tạo ma trận 15 frames hoạt họa
    có chuyển động chân và tay đối nghịch tự nhiên cho 3 hướng (Down, Side, Up).
    """
    try:
        matrix = PromptBuilderService.build_default_frame_actions(profile_data)
        return {
            "status": "success",
            "data": matrix
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khởi tạo ma trận frame: {str(e)}")


@character_analysis_router.post("/frame-matrix/compile")
def compile_sprite_sheet_prompt(request: CompileSpriteSheetPromptRequest):
    """
    Biên dịch toàn bộ ma trận 15 frames cùng các chỉ số giải phẫu thành câu Prompt
    Sprite Sheet 3 Tầng hoàn chỉnh sẵn sàng cho AI vẽ lưới 3x5.
    """
    try:
        compiled = PromptBuilderService.compile_sprite_sheet_prompt(
            character_concept=request.character_concept,
            profile_data=request.profile_data,
            frame_actions=request.frame_actions,
            outfit_and_colors=request.outfit_and_colors,
            weapons_and_props=request.weapons_and_props,
            custom_instructions=request.custom_instructions
        )
        return {
            "status": "success",
            "data": compiled
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi biên dịch Prompt ma trận frame: {str(e)}")


# Export lại các schemas đảm bảo tính tương thích ngược 100%
__all__ = [
    "character_analysis_router",
    "VISION_PROVIDERS",
    "GeneratePromptFromProfileRequest",
    "CompileSpriteSheetPromptRequest"
]
