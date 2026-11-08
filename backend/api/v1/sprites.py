# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Bộ đệm)
# ========================================================
# io: Xử lý byte buffer ảnh
import io
# dataclasses: Chuyển đổi dataclass CharacterMetrics sang dict
from dataclasses import asdict
# typing: Định nghĩa các kiểu tùy chọn
from typing import Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# fastapi: Khởi tạo router, nhận file upload và xử lý HTTP response
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
# PIL (Pillow): Mở ảnh tải lên
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services)
# ========================================================
# SpriteService: Dịch vụ cắt viền và chuẩn hóa kích thước sprite
from backend.services.sprite_service import SpriteService
# AnatomyService: Dịch vụ phân tích giải phẫu học và tạo ảnh trực quan
from backend.services.anatomy_service import AnatomyService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

sprites_router = APIRouter(tags=["Sprite Operations"])


@sprites_router.post("/normalize")
async def normalize_sprite(
    file: UploadFile = File(...),
    target_width: int = Form(64),
    target_height: int = Form(64),
    anchor: str = Form("bottom_center"),
    ground_y: Optional[int] = Form(None)
):
    """
    Chuẩn hóa kích thước khung hình sprite, cắt viền thừa và căn lề điểm neo.
    Hỗ trợ căn chỉnh thông minh theo mốc chân tiếp đất sinh học (ground_y) do AI phát hiện.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File tải lên phải là định dạng hình ảnh.")

    try:
        contents = await file.read()
        png_bytes = SpriteService.normalize_image_bytes(
            image_bytes=contents,
            target_width=target_width,
            target_height=target_height,
            anchor=anchor,
            ground_y=ground_y
        )
        return Response(content=png_bytes, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi xử lý sprite: {str(e)}")


@sprites_router.post("/analyze")
async def analyze_character(
    file: UploadFile = File(...),
    api_key: Optional[str] = Form(None),
    provider: Optional[str] = Form(None),
    base_url: Optional[str] = Form(None),
    auto_remove_bg: bool = Form(True),
    use_ai: bool = Form(False)
):
    """
    Phân tích tỷ lệ giải phẫu học của Sprite:
    - Nhận diện phân tách giữa Vùng cơ thể sinh học và Vùng ngoại vi (Vũ khí, Áo choàng, Bóng).
    - Hỗ trợ Heuristic Toán học ngoại tuyến (0 Token) hoặc AI Vision (Gemini / ChatGPT).
    - Trả về bộ số đo CharacterMetrics và ảnh lớp phủ trực quan hóa Base64.
    """
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File tải lên phải là định dạng hình ảnh.")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        metrics, message, annotated_b64 = AnatomyService.analyze_sprite(
            image=image,
            api_key=api_key,
            provider=provider or "gemini",
            base_url=base_url,
            auto_remove_bg=auto_remove_bg,
            use_ai=use_ai
        )

        if not metrics:
            raise HTTPException(status_code=400, detail=message)

        return {
            "status": "success",
            "message": message,
            "metrics": asdict(metrics),
            "annotated_image": annotated_b64
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi phân tích giải phẫu: {str(e)}")
