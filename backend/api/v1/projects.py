# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc & Kiểu dữ liệu)
# ========================================================
# typing: Khai báo kiểu dữ liệu từ điển, tùy chọn
from typing import Dict, Any, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# requests: Thực hiện các cuộc gọi kiểm tra hoặc truy vấn danh sách model
import requests
# fastapi: Khởi tạo sub-router, xử lý Form và Dependency Injection
from fastapi import APIRouter, Depends, Form, HTTPException
# sqlalchemy: Phiên làm việc cơ sở dữ liệu
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services, Database & Schemas)
# ========================================================
# get_db: Dependency cấp phiên MySQL
from backend.db import get_db
# get_current_user_optional: Dependency xác thực người dùng an toàn qua JWT hoặc Fallback
from backend.core.dependencies import get_current_user_optional
# ProjectService: Dịch vụ nghiệp vụ quản lý dự án
from backend.services.project_service import ProjectService
# AiProviderFactory: Khởi tạo provider AI
from backend.providers.factory import AiProviderFactory
# AiProviderError: Ngoại lệ chuẩn hóa
from backend.providers.base import AiProviderError
# Schemas: DTO cấu hình API dự án và lưu trữ bản phân tích preset
from backend.schemas.project import (
    ProjectApiConfigRequest,
    SaveCharacterPresetRequest,
    ProjectTestConnectionRequest,
    ProjectFetchModelsRequest
)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

projects_router = APIRouter(prefix="/projects", tags=["Quản lý Dự án"])
project_service = ProjectService()


def get_project_service() -> ProjectService:
    """Dependency cung cấp ProjectService hỗ trợ Dependency Injection."""
    return project_service


# Export lại các schemas đảm bảo tương thích ngược 100%
__all__ = [
    "projects_router",
    "project_service",
    "get_project_service",
    "ProjectApiConfigRequest",
    "SaveCharacterPresetRequest",
    "ProjectTestConnectionRequest",
    "ProjectFetchModelsRequest"
]


@projects_router.get("")
def list_projects(
    user_id: Optional[int] = None,
    role: Optional[str] = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Đọc danh sách dự án từ MySQL theo phân quyền người dùng/admin (hỗ trợ JWT Bearer Token hoặc Query fallback)."""
    effective_user_id = user_id if user_id is not None else (current_user.get("id") if current_user else None)
    effective_role = role if role is not None else (current_user.get("role") if current_user else None)
    projects = project_service.get_all_projects(db, user_id=effective_user_id, role=effective_role)
    return {"status": "success", "data": projects}


@projects_router.post("")
def create_project(
    name: str = Form(...),
    user_id: Optional[int] = Form(None),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Tạo một dự án mới trong MySQL có gắn quyền sở hữu của user_id (hỗ trợ tự động nhận diện từ JWT)."""
    effective_user_id = user_id if user_id is not None else (current_user.get("id") if current_user else None)
    try:
        new_project = project_service.create_project(db, name, user_id=effective_user_id)
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
    - Trả về vision_model, image_gen_model, chat_model đã cấu hình.
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
            "ai_enabled": config.get("ai_enabled", True),
            "vision_model": config.get("vision_model", ""),
            "image_gen_model": config.get("image_gen_model", ""),
            "chat_model": config.get("chat_model", ""),
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
    Lưu hoặc cập nhật chìa khóa API Key và các mô hình được chọn vào đúng dự án trong CSDL MySQL.
    """
    try:
        project_service.update_api_config(
            db=db,
            project_id=project_id,
            api_provider=req.api_provider,
            gemini_api_key=req.gemini_api_key,
            openai_api_key=req.openai_api_key,
            openai_base_url=req.openai_base_url,
            ai_enabled=req.ai_enabled,
            vision_model=req.vision_model,
            image_gen_model=req.image_gen_model,
            chat_model=req.chat_model,
        )
        return {
            "status": "success",
            "message": "Đã lưu cấu hình API và các mô hình vào dự án thành công trong MySQL!"
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi lưu cấu hình API: {str(e)}")


@projects_router.post("/{project_id}/test-connection")
def test_project_connection(
    project_id: int,
    req: ProjectTestConnectionRequest,
    db: Session = Depends(get_db)
):
    """
    Kiểm tra nhanh kết nối API Key cho dự án.
    Ưu tiên khóa API truyền trực tiếp từ client (khi đang nhập), nếu thiếu sẽ đọc khóa đã lưu trong MySQL.
    """
    try:
        eff_key, eff_prov, eff_base = project_service.resolve_project_credentials(
            db=db,
            project_id=project_id,
            api_key=req.api_key,
            provider=req.provider,
            base_url=req.base_url,
        )
        clean_provider = (req.provider or eff_prov or "gemini").lower().strip()
        if not eff_key or not eff_key.strip():
            return {
                "status": "error",
                "message": f"Chưa có API Key cho nhà cung cấp {clean_provider.upper()}. Vui lòng nhập khóa API.",
                "provider": clean_provider
            }

        ai_provider = AiProviderFactory.get_provider(clean_provider)
        ok, msg = ai_provider.test_connection(
            api_key=eff_key.strip(),
            base_url=eff_base,
            model=req.model
        )
        return {
            "status": "success" if ok else "error",
            "message": msg,
            "provider": clean_provider
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Lỗi khi kiểm tra kết nối: {str(e)}",
            "provider": req.provider or "gemini"
        }


@projects_router.post("/{project_id}/fetch-models")
def fetch_project_models(
    project_id: int,
    req: ProjectFetchModelsRequest,
    db: Session = Depends(get_db)
):
    """
    Tự động truy vấn danh sách model thực tế từ API của nhà cung cấp và phân loại theo chức năng:
    - vision: Phân tích ảnh nhân vật & trắc lượng phong cách.
    - image_gen: Tạo ảnh Sprite Sheet (Imagen 3 / DALL-E).
    - chat: Trợ lý hội thoại Studio.
    """
    try:
        eff_key, eff_prov, eff_base = project_service.resolve_project_credentials(
            db=db,
            project_id=project_id,
            api_key=req.api_key,
            provider=req.provider,
            base_url=req.base_url,
        )
        clean_provider = (req.provider or eff_prov or "gemini").lower().strip()
        if not eff_key or not eff_key.strip():
            return {
                "status": "error",
                "message": f"Chưa có API Key cho {clean_provider.upper()} để tải danh sách mô hình.",
                "provider": clean_provider,
                "models": {"vision": [], "image_gen": [], "chat": []}
            }

        vision_models = []
        image_gen_models = []
        chat_models = []

        if clean_provider == "gemini":
            url = "https://generativelanguage.googleapis.com/v1beta/models"
            resp = requests.get(url, headers={"x-goog-api-key": eff_key.strip()}, timeout=15)
            if resp.status_code != 200:
                err_msg = resp.text
                try:
                    err_msg = resp.json().get("error", {}).get("message", err_msg)
                except Exception:
                    pass
                return {
                    "status": "error",
                    "message": f"Google Gemini API ({resp.status_code}): {err_msg[:200]}",
                    "provider": "gemini",
                    "models": {"vision": [], "image_gen": [], "chat": []}
                }

            models_data = resp.json().get("models", [])
            for m in models_data:
                name = m.get("name", "").replace("models/", "")
                disp = m.get("displayName", name)
                desc = m.get("description", "")
                methods = m.get("supportedGenerationMethods", [])

                # Mô hình tạo ảnh (Imagen / Image)
                if "imageGeneration" in methods or name.startswith("imagen-") or "image" in name:
                    image_gen_models.append({
                        "id": name,
                        "name": disp,
                        "description": desc[:100] if desc else "Mô hình tạo ảnh của Google"
                    })

                # Mô hình sinh nội dung Text / Vision
                if "generateContent" in methods:
                    if not any(skip in name for skip in ["tts", "transcribe", "clip", "robotics"]):
                        item = {
                            "id": name,
                            "name": disp,
                            "description": desc[:100] if desc else "Mô hình đa phương thức Gemini"
                        }
                        vision_models.append(item)
                        chat_models.append(item)

            # Đảm bảo các mô hình Imagen 3 chuẩn có sẵn trong danh mục tạo ảnh
            standard_imagen = [
                {"id": "imagen-3.0-generate-002", "name": "Imagen 3 (Chất lượng cao)", "description": "Tạo ảnh chi tiết cao độ nét cao"},
                {"id": "imagen-3.0-fast-generate-001", "name": "Imagen 3 Fast", "description": "Tạo ảnh nhanh"}
            ]
            for simg in standard_imagen:
                if not any(im["id"] == simg["id"] for im in image_gen_models):
                    image_gen_models.insert(0, simg)

        else:
            # OpenAI / OpenAI-compatible
            clean_base = (req.base_url or eff_base or "https://api.openai.com/v1").rstrip("/")
            url = f"{clean_base}/models"
            resp = requests.get(url, headers={"Authorization": f"Bearer {eff_key.strip()}"}, timeout=15)
            if resp.status_code != 200:
                err_msg = resp.text
                try:
                    err_msg = resp.json().get("error", {}).get("message", err_msg)
                except Exception:
                    pass
                return {
                    "status": "error",
                    "message": f"OpenAI API ({resp.status_code}): {err_msg[:200]}",
                    "provider": "openai",
                    "models": {"vision": [], "image_gen": [], "chat": []}
                }

            models_data = resp.json().get("data", [])
            for m in models_data:
                mid = m.get("id", "")
                # Vision models
                if any(v in mid for v in ["gpt-4o", "gpt-4-turbo", "o1", "chatgpt-4o", "gpt-4"]):
                    vision_models.append({"id": mid, "name": mid, "description": "Mô hình thị giác đa phương thức OpenAI"})
                # Image gen models
                if "dall-e" in mid or "image" in mid:
                    image_gen_models.append({"id": mid, "name": mid, "description": "Mô hình sinh ảnh DALL-E"})
                # Chat models
                if any(c in mid for c in ["gpt-", "o1", "chatgpt"]):
                    chat_models.append({"id": mid, "name": mid, "description": "Mô hình hội thoại OpenAI"})

            # Bổ sung DALL-E chuẩn nếu chưa có
            standard_dalle = [
                {"id": "dall-e-3", "name": "DALL-E 3", "description": "Tạo ảnh chất lượng cao 1024x1024"},
                {"id": "dall-e-2", "name": "DALL-E 2", "description": "Tạo ảnh nhanh 512x512"}
            ]
            for sd in standard_dalle:
                if not any(im["id"] == sd["id"] for im in image_gen_models):
                    image_gen_models.insert(0, sd)

        return {
            "status": "success",
            "provider": clean_provider,
            "models": {
                "vision": vision_models,
                "image_gen": image_gen_models,
                "chat": chat_models
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Lỗi kết nối khi tải danh sách mô hình: {str(e)}",
            "provider": req.provider or "gemini",
            "models": {"vision": [], "image_gen": [], "chat": []}
        }


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
