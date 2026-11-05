from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import List, Optional
import io
from PIL import Image
from fastapi.responses import Response

from backend.core.normalizer import SpriteNormalizer

api_router = APIRouter(prefix="/api", tags=["Sprite Operations"])

# Danh sách mock projects lưu tạm thời
MOCK_PROJECTS = [
    {
        "id": "proj_1",
        "name": "Knight Animation Pack",
        "sprite_count": 24,
        "resolution": "64x64",
        "last_updated": "2026-11-04",
        "status": "ready"
    },
    {
        "id": "proj_2",
        "name": "Monster Slime Walk & Attack",
        "sprite_count": 16,
        "resolution": "32x32",
        "last_updated": "2026-11-03",
        "status": "in_progress"
    }
]


@api_router.get("/projects")
async def list_projects():
    """Lấy danh sách các project sprite"""
    return {"status": "success", "data": MOCK_PROJECTS}


@api_router.post("/projects")
async def create_project(name: str = Form(...), resolution: str = Form("64x64")):
    """Tạo mới một project"""
    new_project = {
        "id": f"proj_{len(MOCK_PROJECTS) + 1}",
        "name": name,
        "sprite_count": 0,
        "resolution": resolution,
        "last_updated": "2026-11-05",
        "status": "created"
    }
    MOCK_PROJECTS.append(new_project)
    return {"status": "success", "data": new_project}


@api_router.post("/normalize")
async def normalize_sprite(
    file: UploadFile = File(...),
    target_width: int = Form(64),
    target_height: int = Form(64),
    anchor: str = Form("bottom_center")
):
    """
    Nhận 1 ảnh sprite, thực hiện chuẩn hóa biên và căn lề qua thuật toán core (MVC).
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File tải lên phải là định dạng hình ảnh.")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        normalizer = SpriteNormalizer(
            target_width=target_width,
            target_height=target_height,
            anchor=anchor
        )
        normalized = normalizer.normalize_frame(image)

        out_buffer = io.BytesIO()
        normalized.save(out_buffer, format="PNG")
        out_buffer.seek(0)

        return Response(content=out_buffer.getvalue(), media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi xử lý sprite: {str(e)}")
