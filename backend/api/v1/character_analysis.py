# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Xử lý JSON)
# ========================================================
# io: Xử lý bộ đệm luồng byte hình ảnh tải lên
import io
# json: Phân tích cú pháp dữ liệu JSON truyền vào
import json
# typing: Định nghĩa các kiểu từ điển, tùy chọn
from typing import Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# fastapi: Khởi tạo router và nhận file upload
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
# pydantic: Định nghĩa schema kiểm tra dữ liệu yêu cầu
from pydantic import BaseModel, Field
# PIL (Pillow): Mở ảnh tải lên
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services, Database & Schemas)
# ========================================================
# CharacterAnalysisService: Dịch vụ phân tích nhân vật theo phân hệ Tab
from backend.services.character_analysis_service import CharacterAnalysisService
# PromptBuilderService: Dịch vụ xây dựng ma trận 15 frame hoạt họa chân tay đối nghịch
from backend.services.prompt_builder_service import PromptBuilderService
# NewCharacterPromptRequest: Schema yêu cầu tạo nhân vật mới không bị gán cứng
from backend.schemas.prompt import NewCharacterPromptRequest
# SessionLocal: Tạo phiên làm việc CSDL MySQL để truy xuất key của dự án
from backend.db import SessionLocal
# ProjectRepository: Truy vấn cấu hình API Key của dự án
from backend.repositories.project_repository import ProjectRepository

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

character_analysis_router = APIRouter(prefix="/character-profile", tags=["Character Profile Analysis"])


class GeneratePromptFromProfileRequest(BaseModel):
    """Schema yêu cầu sinh Prompt dựa trên Hồ sơ nhân vật (Hỗ trợ tương thích ngược)."""
    project_id: Optional[int] = Field(None, description="Mã dự án để tự động lấy API Key từ MySQL")
    profile_data: Dict[str, Any] = Field(default_factory=dict, description="Toàn bộ dữ liệu hồ sơ nhân vật (AIAnalysis)")
    character_concept: Optional[str] = Field(None, description="Ý tưởng nhân vật mới (Tương thích cũ)")
    core_concept: Optional[str] = Field(None, description="Ý tưởng nhân vật mới (Chuẩn mới)")
    outfit_and_colors: Optional[str] = Field(None, description="Trang phục & màu sắc riêng của con mới")
    weapons_and_props: Optional[str] = Field(None, description="Vũ khí & đạo cụ riêng con mới cầm")
    stature_rule: str = Field("Bằng nhân vật gốc (Tỷ lệ chuẩn)", description="Quy tắc vóc dáng")
    inherit_scale: bool = Field(True, description="Kế thừa tỷ lệ kích thước game")
    inherit_style: bool = Field(True, description="Kế thừa phong cách viền & đổ bóng pixel")
    metrics: Optional[Dict[str, Any]] = Field(None, description="Số đo pixel hình học từ Bước 1")
    target_direction: str = Field("Sprite Sheet 3x5 (15 frames)", description="Góc nhìn mục tiêu cần sinh ảnh")
    frame_actions: Optional[Dict[str, Any]] = Field(None, description="Ma trận chi tiết 15 frame hoạt họa chân tay đối nghịch")
    compiled_positive_prompt: Optional[str] = Field(None, description="Câu positive prompt đã biên dịch")
    compiled_negative_prompt: Optional[str] = Field(None, description="Câu negative prompt đã biên dịch")
    api_key: Optional[str] = Field(None, description="Khóa API tùy chọn")
    provider: Optional[str] = Field(None, description="Nhà cung cấp AI tùy chọn")
    base_url: Optional[str] = Field(None, description="Địa chỉ máy chủ proxy tùy chọn")


def _resolve_project_api_key(
    project_id: Optional[int],
    api_key: Optional[str],
    provider: Optional[str],
    base_url: Optional[str]
):
    """Hàm phụ trợ lấy API Key từ CSDL MySQL của project nếu không truyền trực tiếp."""
    eff_key = api_key
    eff_prov = provider
    eff_base = base_url

    if not eff_key and project_id:
        try:
            with SessionLocal() as db:
                repo = ProjectRepository()
                cfg = repo.get_api_config(db, project_id)
                if cfg:
                    eff_prov = eff_prov or cfg.get("api_provider")
                    if eff_prov == "openai":
                        eff_key = cfg.get("_openai_raw_key")
                    else:
                        eff_key = cfg.get("_gemini_raw_key")
                    eff_base = eff_base or cfg.get("openai_base_url")
        except Exception:
            pass

    return eff_key, eff_prov or "gemini", eff_base


@character_analysis_router.post("/analyze-tab")
async def analyze_character_tab(
    file: UploadFile = File(...),
    tab_name: str = Form("global"),
    project_id: Optional[int] = Form(None),
    api_key: Optional[str] = Form(None),
    provider: Optional[str] = Form(None),
    base_url: Optional[str] = Form(None),
    current_profile_json: Optional[str] = Form(None)
):
    """
    Phân tích độc lập từng Tab (hoặc toàn bộ) cho Hồ sơ Nhân vật tham chiếu:
    Tự động đọc API Key từ CSDL MySQL của project nếu có project_id.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Tệp tải lên phải là định dạng hình ảnh.")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGBA")

        # Tự động lấy key từ MySQL của dự án nếu cần
        eff_key, eff_prov, eff_base = _resolve_project_api_key(project_id, api_key, provider, base_url)
        tab_clean = tab_name.lower().strip()

        # Tab 1: Phân tích Toàn cục
        if tab_clean == "global":
            result = CharacterAnalysisService.analyze_tab_global(
                image=image, api_key=eff_key, provider=eff_prov, base_url=eff_base
            )
            return {"status": "success", "tab": "global", "data": result}

        # Tab 2: Phân tích 3 hướng nhìn
        elif tab_clean == "directions":
            result = CharacterAnalysisService.analyze_tab_directions(
                image=image, api_key=eff_key, provider=eff_prov, base_url=eff_base
            )
            return {"status": "success", "tab": "directions", "data": result}

        # Tab 3: Phân tích Hoạt họa
        elif tab_clean == "animations":
            result = CharacterAnalysisService.analyze_tab_animations(
                image=image, api_key=eff_key, provider=eff_prov, base_url=eff_base
            )
            return {"status": "success", "tab": "animations", "data": result}

        # Tab 4: Phân tích Tính nhất quán & Ràng buộc
        elif tab_clean == "constraints":
            curr_profile = json.loads(current_profile_json) if current_profile_json else {}
            g_data = curr_profile.get("global_analysis", {})
            d_data = curr_profile.get("direction_analysis", {})
            a_data = curr_profile.get("animation_analysis", {})
            result = CharacterAnalysisService.analyze_tab_constraints(
                global_data=g_data, direction_data=d_data, animation_data=a_data,
                api_key=eff_key, provider=eff_prov, base_url=eff_base
            )
            return {"status": "success", "tab": "constraints", "data": result}

        # Chạy toàn bộ (All tabs tuần tự)
        elif tab_clean == "all":
            g_res = CharacterAnalysisService.analyze_tab_global(image, api_key=eff_key, provider=eff_prov, base_url=eff_base)
            d_res = CharacterAnalysisService.analyze_tab_directions(image, api_key=eff_key, provider=eff_prov, base_url=eff_base)
            a_res = CharacterAnalysisService.analyze_tab_animations(image, api_key=eff_key, provider=eff_prov, base_url=eff_base)
            c_res = CharacterAnalysisService.analyze_tab_constraints(
                global_data=g_res, direction_data=d_res, animation_data=a_res,
                api_key=eff_key, provider=eff_prov, base_url=eff_base
            )

            full_ai_analysis = {
                "global_analysis": g_res,
                "direction_analysis": d_res,
                "animation_analysis": a_res,
                "consistency_analysis": c_res.get("consistency_analysis", {}),
                "negative_constraints": c_res.get("negative_constraints", {}),
                "palette_metrics": g_res.get("palette_metrics")
            }
            # Tự động ánh xạ dữ liệu 7 Schemas sang ma trận 15 frame hoạt họa có chân tay đối nghịch
            full_ai_analysis["frame_actions_data"] = PromptBuilderService.build_default_frame_actions(full_ai_analysis)
            return {"status": "success", "tab": "all", "data": full_ai_analysis}

        else:
            raise HTTPException(status_code=400, detail=f"Tab '{tab_name}' không hợp lệ.")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi phân tích hồ sơ nhân vật: {str(e)}")


@character_analysis_router.post("/generate-prompt")
async def generate_prompt_from_profile(request: GeneratePromptFromProfileRequest):
    """
    Sinh Prompt tiếng Anh tối ưu khống chế tỷ lệ, phong cách pixel và vật liệu
    cho Nhân vật Mới dựa trên Hồ sơ nhân vật tham chiếu.
    Hỗ trợ đầy đủ ma trận 15 frames hoạt họa Sprite Sheet (3 Hướng × 5 Frames có cả Chân và Tay).
    """
    try:
        concept = request.core_concept or request.character_concept or "Pixel Art Character"
        eff_key, eff_prov, eff_base = _resolve_project_api_key(
            request.project_id, request.api_key, request.provider, request.base_url
        )

        # Sử dụng PromptBuilderService để biên dịch ma trận 15 frame hoạt họa
        compiled = PromptBuilderService.compile_sprite_sheet_prompt(
            character_concept=concept,
            profile_data=request.profile_data,
            frame_actions=request.frame_actions,
            outfit_and_colors=request.outfit_and_colors,
            weapons_and_props=request.weapons_and_props,
            custom_instructions=f"Vóc dáng: {request.stature_rule}"
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


class CompileSpriteSheetPromptRequest(BaseModel):
    """Schema yêu cầu biên dịch câu Prompt 3 Tầng hoàn chỉnh từ ma trận 15 frames."""
    character_concept: str = Field(..., description="Ý tưởng nhân vật mới")
    profile_data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Dữ liệu phân tích 7 Schemas")
    frame_actions: Optional[Dict[str, Any]] = Field(None, description="Ma trận 15 frame đã chỉnh sửa từ người dùng")
    outfit_and_colors: Optional[str] = Field(None, description="Trang phục & màu sắc")
    weapons_and_props: Optional[str] = Field(None, description="Vũ khí & phụ kiện")
    custom_instructions: Optional[str] = Field(None, description="Ghi chú đạo diễn bổ sung")


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
