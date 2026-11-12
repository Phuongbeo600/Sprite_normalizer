# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Bộ đệm)
# ========================================================
# io: Xử lý byte buffer ảnh
import io
# json: Đọc các vùng và đoạn đo gửi từ trình vẽ sprite.
import json
# dataclasses: Chuyển đổi dataclass CharacterMetrics sang dict
from dataclasses import asdict
# typing: Định nghĩa các kiểu tùy chọn
from typing import Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# fastapi: Khởi tạo router, nhận file upload và xử lý HTTP response
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
# PIL (Pillow): Mở ảnh tải lên và áp dụng hướng ảnh theo thông tin EXIF.
from PIL import Image, ImageOps

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


@sprites_router.post("/analyze-colors")
def analyze_sprite_colors(file: UploadFile = File(...)):
    """Đo màu và đặc trưng pixel trên máy chủ ứng dụng."""
    try:
        with Image.open(file.file) as image:
            return SpriteService.analyze_colors(ImageOps.exif_transpose(image))
    except (OSError, ValueError, Image.DecompressionBombError) as error:
        raise HTTPException(status_code=400, detail="Không đọc được ảnh để phân tích màu.") from error


@sprites_router.post("/measure-regions")
def measure_manual_regions(file: UploadFile = File(...), regions_json: str = Form(...)):
    """Đo lại các vùng người dùng vẽ, trả tọa độ lát cắt và bề rộng theo pixel gốc."""
    try:
        with Image.open(file.file) as image:
            return AnatomyService.measure_manual_regions(ImageOps.exif_transpose(image), json.loads(regions_json))
    except (OSError, ValueError, Image.DecompressionBombError) as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


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
    auto_remove_bg: bool = Form(True),
):
    """Đo tỷ lệ và tạo lớp phủ bằng các thuật toán Python."""
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File tải lên phải là định dạng hình ảnh.")

    try:
        contents = await file.read()
        with Image.open(io.BytesIO(contents)) as source:
            image = ImageOps.exif_transpose(source)

        metrics, message, annotated_b64 = AnatomyService.analyze_sprite(
            image=image, auto_remove_bg=auto_remove_bg,
        )

        if not metrics:
            raise HTTPException(status_code=400, detail=message)

        return {
            "status": "success",
            "message": message,
            "metrics": asdict(metrics),
            "region_measurements": AnatomyService.measure_anatomy_regions(image, metrics, auto_remove_bg),
            "annotated_image": annotated_b64
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi phân tích giải phẫu: {str(e)}")
