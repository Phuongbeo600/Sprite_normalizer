# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc & Kiểu dữ liệu)
# ========================================================
# typing: Khai báo kiểu dữ liệu từ điển, tùy chọn
from typing import Dict, Any, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# fastapi: Khởi tạo sub-router, xử lý Form và Dependency Injection
from fastapi import APIRouter, Depends, Form, HTTPException
# pydantic: Định nghĩa Schema kiểm tra tính hợp lệ dữ liệu yêu cầu
from pydantic import BaseModel, Field
# sqlalchemy: Phiên làm việc cơ sở dữ liệu
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services & Database)
# ========================================================
# get_db: Dependency cấp phiên MySQL
from backend.db import get_db
# ProjectService: Dịch vụ nghiệp vụ quản lý dự án
from backend.services.project_service import ProjectService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

projects_router = APIRouter(prefix="/projects", tags=["Quản lý Dự án"])
project_service = ProjectService()


class ProjectApiConfigRequest(BaseModel):
    """Schema cập nhật cấu hình API Key và trạng thái AI của riêng dự án trong MySQL."""
    api_provider: str = Field("gemini", description="Nhà cung cấp: 'gemini' hoặc 'openai'")
    gemini_api_key: Optional[str] = Field(None, description="Khóa Google Gemini API")
    openai_api_key: Optional[str] = Field(None, description="Khóa OpenAI API")
    openai_base_url: Optional[str] = Field("https://api.openai.com/v1", description="Địa chỉ API proxy")
    ai_enabled: Optional[bool] = Field(None, description="Trạng thái bật/tắt toàn bộ tính năng AI của dự án")


class SaveCharacterPresetRequest(BaseModel):
    """Schema lưu trữ bản phân tích và Prompt của nhân vật vào dự án."""
    name: str = Field(..., description="Tên gợi nhớ cho bản phân tích")
    sprite_name: Optional[str] = Field(None, description="Tên file sprite mẫu")
    metrics_data: Optional[Dict[str, Any]] = Field(None, description="Số đo pixel hình học từ OpenCV")
    profile_data: Optional[Dict[str, Any]] = Field(None, description="Hồ sơ phong cách DNA từ AI")
    frame_actions_data: Optional[Dict[str, Any]] = Field(None, description="Ma trận chi tiết 15 frames hoạt họa chân tay đối nghịch")
    new_character_concept: str = Field(..., description="Ý tưởng nhân vật mới đã tạo")
    outfit_and_colors: Optional[str] = Field(None, description="Trang phục & màu sắc riêng")
    weapons_and_props: Optional[str] = Field(None, description="Vũ khí & đạo cụ riêng")
    stature_rule: Optional[str] = Field("Bằng nhân vật gốc (Tỷ lệ chuẩn)", description="Quy chuẩn vóc dáng")
    target_direction: Optional[str] = Field("Front / Down view", description="Góc nhìn mục tiêu")
    positive_prompt: str = Field(..., description="Câu positive prompt tiếng Anh đầy đủ")
    negative_prompt: str = Field(..., description="Câu negative prompt tiếng Anh đầy đủ")
    technical_notes: Optional[str] = Field(None, description="Ghi chú kỹ thuật")


@projects_router.get("")
def list_projects(
    user_id: Optional[int] = None,
    role: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Đọc danh sách dự án từ MySQL theo phân quyền người dùng/admin."""
    projects = project_service.get_all_projects(db, user_id=user_id, role=role)
    return {"status": "success", "data": projects}


@projects_router.post("")
def create_project(
    name: str = Form(...),
    user_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    """Tạo một dự án mới trong MySQL có gắn quyền sở hữu của user_id."""
    try:
        new_project = project_service.create_project(db, name, user_id=user_id)
        return {
            "status": "success",
            "message": "Tạo dự án thành công!",
            "data": new_project
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu dự án: {str(e)}")


@projects_router.get("/{project_id}")
def get_project(project_id: int, db: Session = Depends(get_db)):
    """Lấy thông tin chi tiết một dự án theo ID."""
    project = project_service.get_project_by_id(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Không tìm thấy dự án.")
    return {"status": "success", "data": project}


@projects_router.put("/{project_id}")
def update_project(project_id: int, name: str = Form(...), db: Session = Depends(get_db)):
    """Cập nhật tên dự án."""
    try:
        success = project_service.update_project(db, project_id, name)
        if not success:
            raise HTTPException(status_code=404, detail="Không tìm thấy dự án để cập nhật.")
        return {"status": "success", "message": "Cập nhật dự án thành công!"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi khi cập nhật dự án: {str(e)}")


@projects_router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    """Xóa một dự án theo ID."""
    try:
        success = project_service.delete_project(db, project_id)
        if not success:
            raise HTTPException(status_code=404, detail="Không tìm thấy dự án để xóa.")
        return {"status": "success", "message": "Đã xóa dự án thành công!"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi khi xóa dự án: {str(e)}")


# ========================================================
# CÁC ENDPOINTS CẤU HÌNH API KEY CỦA RIÊNG TỪNG DỰ ÁN
# ========================================================
@projects_router.get("/{project_id}/api-config")
def get_project_api_config(project_id: int, db: Session = Depends(get_db)):
    """
    Kiểm tra và lấy trạng thái API Key của dự án từ CSDL MySQL:
    - Trả về gemini_has_key / openai_has_key (True/False).
    - Trả về gemini_masked_key / openai_masked_key (dạng AIzaSy...****).
    - Tuyệt đối không trả về raw key đầy đủ ra client.
    """
    try:
        config = project_service.get_api_config(db, project_id)
        # Ẩn key thật khi trả về cho client
        safe_config = {
            "project_id": config["project_id"],
            "project_name": config["project_name"],
            "api_provider": config["api_provider"],
            "gemini_has_key": config["gemini_has_key"],
            "gemini_masked_key": config["gemini_masked_key"],
            "openai_has_key": config["openai_has_key"],
            "openai_masked_key": config["openai_masked_key"],
            "openai_base_url": config["openai_base_url"],
            "ai_enabled": config.get("ai_enabled", True)
        }
        return {"status": "success", "data": safe_config}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi đọc cấu hình API: {str(e)}")


@projects_router.post("/{project_id}/api-config")
def update_project_api_config(
    project_id: int,
    req: ProjectApiConfigRequest,
    db: Session = Depends(get_db)
):
    """
    Lưu hoặc cập nhật chìa khóa API Key vào đúng dự án trong CSDL MySQL.
    """
    try:
        project_service.update_api_config(
            db=db,
            project_id=project_id,
            api_provider=req.api_provider,
            gemini_api_key=req.gemini_api_key,
            openai_api_key=req.openai_api_key,
            openai_base_url=req.openai_base_url,
            ai_enabled=req.ai_enabled
        )
        return {
            "status": "success",
            "message": "Đã lưu chìa khóa API vào dự án thành công trong MySQL!"
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi lưu cấu hình API: {str(e)}")


# ========================================================
# CÁC ENDPOINTS QUẢN LÝ BẢN PHÂN TÍCH & PROMPT (PRESETS)
# ========================================================
@projects_router.get("/{project_id}/character-presets")
def list_character_presets(project_id: int, db: Session = Depends(get_db)):
    """
    Lấy danh sách các bản phân tích chỉ số và prompt đã lưu của riêng dự án này.
    """
    try:
        presets = project_service.get_character_presets(db, project_id)
        return {"status": "success", "data": presets}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi lấy danh sách hồ sơ đã lưu: {str(e)}")


@projects_router.post("/{project_id}/character-presets")
def create_character_preset(
    project_id: int,
    req: SaveCharacterPresetRequest,
    db: Session = Depends(get_db)
):
    """
    Lưu một bản phân tích chỉ số giải phẫu pixel và Prompt nhân vật vào dự án trong MySQL.
    """
    try:
        created = project_service.create_character_preset(
            db=db,
            project_id=project_id,
            name=req.name,
            sprite_name=req.sprite_name,
            metrics_data=req.metrics_data,
            profile_data=req.profile_data,
            frame_actions_data=req.frame_actions_data,
            new_character_concept=req.new_character_concept,
            outfit_and_colors=req.outfit_and_colors,
            weapons_and_props=req.weapons_and_props,
            stature_rule=req.stature_rule,
            target_direction=req.target_direction,
            positive_prompt=req.positive_prompt,
            negative_prompt=req.negative_prompt,
            technical_notes=req.technical_notes
        )
        return {
            "status": "success",
            "message": "Đã lưu bản phân tích và Prompt vào hồ sơ dự án thành công!",
            "data": created
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi lưu hồ sơ phân tích: {str(e)}")


@projects_router.get("/{project_id}/character-presets/{preset_id}")
def get_character_preset_detail(
    project_id: int,
    preset_id: int,
    db: Session = Depends(get_db)
):
    """
    Lấy chi tiết toàn bộ số đo hình học, hồ sơ phong cách và prompt của một bản ghi.
    """
    try:
        detail = project_service.get_character_preset_by_id(db, preset_id, project_id)
        if not detail:
            raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi hồ sơ đã lưu.")
        return {"status": "success", "data": detail}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi đọc chi tiết hồ sơ: {str(e)}")


@projects_router.delete("/{project_id}/character-presets/{preset_id}")
def delete_character_preset(
    project_id: int,
    preset_id: int,
    db: Session = Depends(get_db)
):
    """
    Xóa một bản ghi phân tích và prompt khỏi dự án.
    """
    try:
        success = project_service.delete_character_preset(db, preset_id, project_id)
        if not success:
            raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi để xóa.")
        return {"status": "success", "message": "Đã xóa bản ghi hồ sơ thành công!"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi xóa hồ sơ: {str(e)}")
