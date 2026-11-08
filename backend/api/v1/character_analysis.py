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
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services)
# ========================================================
# CharacterAnalysisService: Dịch vụ phân tích nhân vật theo phân hệ Tab
from backend.services.character_analysis_service import CharacterAnalysisService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

character_analysis_router = APIRouter(prefix="/character-profile", tags=["Character Profile Analysis"])


class GeneratePromptFromProfileRequest(BaseModel):
    """Schema yêu cầu sinh Prompt dựa trên Hồ sơ nhân vật."""
    profile_data: Dict[str, Any] = Field(..., description="Toàn bộ dữ liệu hồ sơ nhân vật (AIAnalysis)")
    character_concept: str = Field(..., description="Ý tưởng nhân vật mới cần sinh")
    target_direction: str = Field("Front / Down view", description="Góc nhìn mục tiêu cần sinh ảnh")
    api_key: Optional[str] = Field(None, description="Khóa API tùy chọn")
    provider: Optional[str] = Field(None, description="Nhà cung cấp AI tùy chọn")
    base_url: Optional[str] = Field(None, description="Địa chỉ máy chủ proxy tùy chọn")


@character_analysis_router.post("/analyze-tab")
async def analyze_character_tab(
    file: UploadFile = File(...),
    tab_name: str = Form("global"),
    api_key: Optional[str] = Form(None),
    provider: Optional[str] = Form(None),
    base_url: Optional[str] = Form(None),
    current_profile_json: Optional[str] = Form(None)
):
    """
    Phân tích độc lập từng Tab (hoặc toàn bộ) cho Hồ sơ Nhân vật tham chiếu:
    - tab_name = 'global': Phân tích Toàn cục, Danh tính, Giải phẫu, Phong cách, Chất liệu.
    - tab_name = 'directions': Phân tích 3 hướng nhìn (Down, Side, Up).
    - tab_name = 'animations': Phân tích Hoạt họa (Idle, Walk).
    - tab_name = 'constraints': Tổng hợp Tính nhất quán và Ràng buộc phủ định.
    - tab_name = 'all': Chạy lần lượt toàn bộ cả 4 phân hệ.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Tệp tải lên phải là định dạng hình ảnh.")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGBA")

        tab_clean = tab_name.lower().strip()

        # Tab 1: Phân tích Toàn cục
        if tab_clean == "global":
            result = CharacterAnalysisService.analyze_tab_global(
                image=image, api_key=api_key, provider=provider, base_url=base_url
            )
            return {"status": "success", "tab": "global", "data": result}

        # Tab 2: Phân tích 3 hướng nhìn
        elif tab_clean == "directions":
            result = CharacterAnalysisService.analyze_tab_directions(
                image=image, api_key=api_key, provider=provider, base_url=base_url
            )
            return {"status": "success", "tab": "directions", "data": result}

        # Tab 3: Phân tích Hoạt họa
        elif tab_clean == "animations":
            result = CharacterAnalysisService.analyze_tab_animations(
                image=image, api_key=api_key, provider=provider, base_url=base_url
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
                api_key=api_key, provider=provider, base_url=base_url
            )
            return {"status": "success", "tab": "constraints", "data": result}

        # Chạy toàn bộ (All tabs tuần tự)
        elif tab_clean == "all":
            g_res = CharacterAnalysisService.analyze_tab_global(image, api_key=api_key, provider=provider, base_url=base_url)
            d_res = CharacterAnalysisService.analyze_tab_directions(image, api_key=api_key, provider=provider, base_url=base_url)
            a_res = CharacterAnalysisService.analyze_tab_animations(image, api_key=api_key, provider=provider, base_url=base_url)
            c_res = CharacterAnalysisService.analyze_tab_constraints(
                global_data=g_res, direction_data=d_res, animation_data=a_res,
                api_key=api_key, provider=provider, base_url=base_url
            )

            full_ai_analysis = {
                "global_analysis": g_res,
                "direction_analysis": d_res,
                "animation_analysis": a_res,
                "consistency_analysis": c_res.get("consistency_analysis", {}),
                "negative_constraints": c_res.get("negative_constraints", {})
            }
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
    dựa trên toàn bộ kết quả phân tích Character Profile.
    """
    try:
        prompts = CharacterAnalysisService.generate_character_prompt_from_profile(
            profile_data=request.profile_data,
            new_character_concept=request.character_concept,
            target_direction=request.target_direction,
            api_key=request.api_key,
            provider=request.provider,
            base_url=request.base_url
        )
        return {
            "status": "success",
            "data": prompts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi sinh Prompt từ hồ sơ nhân vật: {str(e)}")
