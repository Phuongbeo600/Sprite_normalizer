from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
import io
from PIL import Image
from fastapi.responses import Response
from sqlalchemy import text

from backend.core.normalizer import SpriteNormalizer
from backend.db import get_db

api_router = APIRouter(prefix="/api", tags=["Sprite Operations"])


@api_router.get("/projects")
def list_projects(db=Depends(get_db)):
    """Đọc danh sách dự án từ MySQL và trả về dự án mới nhất trước."""
    rows = db.execute(
        text("SELECT id, name, created_at FROM projects ORDER BY id DESC")
    ).mappings()

    return {"status": "success", "data": [dict(row) for row in rows]}





@api_router.post("/projects")
def create_project(name: str = Form(...), db=Depends(get_db)):
    """Lưu tên dự án vào MySQL và trả về ID được cấp cùng tên đã lưu."""
    name = name.strip()

    if not name or len(name) > 255:
        raise HTTPException(
            status_code=422,
            detail="Tên dự án phải có từ 1 đến 255 ký tự.",
        )

    result = db.execute(
        text("INSERT INTO projects (name) VALUES (:name)"),
        {"name": name},
    )
    project_id = result.lastrowid
    db.commit()

    return {"status": "success", "data": {"id": project_id, "name": name}}


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
