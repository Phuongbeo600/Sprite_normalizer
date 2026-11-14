# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Bộ đệm)
# ========================================================
# io: Xử lý byte buffer ảnh
import io
# json: Đọc các vùng và đoạn đo gửi từ trình vẽ sprite.
import json
# base64: Chuyển các PNG đã cắt sang dữ liệu xem trước trên trình duyệt.
from base64 import b64encode
# dataclasses: Chuyển đổi dataclass CharacterMetrics sang dict
from dataclasses import asdict
# typing: Định nghĩa các kiểu tùy chọn
from typing import Annotated, Literal, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# fastapi: Khởi tạo router, nhận file upload và xử lý HTTP response
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Query
from fastapi.responses import Response
# sqlalchemy: Quản lý phiên làm việc Session với MySQL
from sqlalchemy.orm import Session
# PIL (Pillow): Mở ảnh tải lên và áp dụng hướng ảnh theo thông tin EXIF.
from PIL import Image, ImageOps

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services & Repositories)
# ========================================================
# get_db: Phiên làm việc cơ sở dữ liệu MySQL
from backend.db import get_db
# SpriteRepository: Kho lưu trữ ảnh sprite gốc, ảnh tối ưu và khung cắt rời trong MySQL
from backend.repositories.sprite_repository import SpriteRepository
# SpriteService: Dịch vụ cắt viền và chuẩn hóa kích thước sprite
from backend.services.sprite_service import SpriteService
# AnatomyService: Dịch vụ phân tích giải phẫu học và tạo ảnh trực quan
from backend.services.anatomy_service import AnatomyService
# resize_image: Thu nhỏ toàn bộ ảnh theo kích thước pixel.
from backend.core.sprite_editing import recover_native_sprite, resize_sprite as resize_image
# GodotExportService: Dịch vụ đóng gói tài nguyên nhân vật xuất xưởng cho Godot 4
from backend.services.godot_export_service import GodotExportService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

sprites_router = APIRouter(tags=["Sprite Operations"])


@sprites_router.post("/detect-resolution")
def detect_sprite_resolution(file: Annotated[UploadFile, File()]):
    """Trả kích thước lưới nhận diện và PNG đã khôi phục nếu ảnh bị phóng to."""
    try:
        with Image.open(file.file) as source:
            image, scale = recover_native_sprite(ImageOps.exif_transpose(source))
            return {
                "width": image.width,
                "height": image.height,
                "scale": scale,
                "png": b64encode(SpriteService.encode_png(image)).decode("ascii") if scale > 1 else None,
            }
    except (OSError, ValueError, Image.DecompressionBombError) as error:
        raise HTTPException(status_code=400, detail="Không đọc được lưới pixel của ảnh.") from error


@sprites_router.post("/resize")
def resize_sprite(
    file: Annotated[UploadFile, File()],
    target_width: Annotated[int, Form(ge=1)],
    target_height: Annotated[int, Form(ge=1)],
):
    """Thu nhỏ ảnh và trả PNG đúng kích thước đã chọn."""
    try:
        with Image.open(file.file) as source:
            image = resize_image(ImageOps.exif_transpose(source), target_width, target_height)
            return Response(SpriteService.encode_png(image), media_type="image/png")
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (OSError, Image.DecompressionBombError) as error:
        raise HTTPException(status_code=400, detail="Không đọc được ảnh sprite.") from error


@sprites_router.post("/slice-sheet")
def slice_sprite_sheet(
    file: Annotated[UploadFile, File()],
    rows: Annotated[int, Form(ge=1, le=256)],
    columns: Annotated[int, Form(ge=1, le=256)],
    output: Annotated[Literal["json", "zip"], Form()] = "json",
    auto_anchor: Annotated[bool, Form()] = False,
):
    """Cắt lưới Sprite Sheet thích ứng và trả danh sách PNG hoặc tệp ZIP (Hỗ trợ auto_anchor)."""
    try:
        with Image.open(file.file) as source:
            image = ImageOps.exif_transpose(source)
            if output == "zip":
                return Response(
                    SpriteService.sheet_zip(image, rows, columns, auto_anchor=auto_anchor),
                    media_type="application/zip",
                    headers={"Content-Disposition": 'attachment; filename="sprite-frames.zip"'},
                )
            return {"frames": [
                {"name": name, "width": width, "height": height, "png": b64encode(png).decode("ascii")}
                for name, (width, height), png in SpriteService.sheet_frames(image, rows, columns, auto_anchor=auto_anchor)
            ]}
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (OSError, Image.DecompressionBombError) as error:
        raise HTTPException(status_code=400, detail="Không đọc được sprite sheet.") from error


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


@sprites_router.post("/export-godot")
def export_godot_package(
    file: Annotated[UploadFile, File()],
    rows: Annotated[int, Form(ge=1, le=256)] = 3,
    columns: Annotated[int, Form(ge=1, le=256)] = 5,
    fps: Annotated[float, Form(ge=1.0, le=60.0)] = 8.0,
    move_speed: Annotated[float, Form(ge=10.0, le=1000.0)] = 120.0,
    character_name: Annotated[str, Form()] = "Player",
    auto_anchor: Annotated[bool, Form()] = True,
):
    """
    Đóng gói toàn bộ tài nguyên nhân vật cho Godot Engine 4 (PNG, TRES, TSCN, GD) thành file ZIP.
    Đảm bảo tính chính xác 1:1 tuyệt đối về điểm neo đáy chân, tỷ lệ pixel và hộp va chạm CollisionShape2D.
    """
    try:
        with Image.open(file.file) as source:
            image = ImageOps.exif_transpose(source)
            zip_bytes = GodotExportService.export_godot_package(
                image=image,
                rows=rows,
                columns=columns,
                fps=fps,
                move_speed=move_speed,
                character_name=character_name,
                auto_anchor=auto_anchor
            )
            clean_filename = f"{character_name.strip() or 'Player'}_godot4.zip"
            return Response(
                zip_bytes,
                media_type="application/zip",
                headers={"Content-Disposition": f'attachment; filename="{clean_filename}"'}
            )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Lỗi khi đóng gói tài nguyên Godot: {str(error)}") from error


# ========================================================
# CÁC TUYẾN API LƯU TRỮ ẢNH THẬT VÀO MYSQL (project_sprites & sprite_frames)
# ========================================================
sprite_repo = SpriteRepository()


@sprites_router.get("/sprites")
def list_project_sprites(
    project_id: int = Query(..., description="Mã dự án"),
    db: Session = Depends(get_db)
):
    """
    Lấy danh sách các tấm ảnh sprite đã lưu của dự án.
    """
    try:
        sprites = sprite_repo.get_sprites_by_project(db, project_id)
        return {"status": "success", "sprites": sprites}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lấy danh sách sprite: {str(exc)}")


@sprites_router.post("/sprites/save-raw")
async def save_raw_sprite(
    file: UploadFile = File(...),
    project_id: int = Form(...),
    name: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """
    Lưu trực tiếp ảnh thô ban đầu (chưa qua xử lý) vào cột raw_image_data (MEDIUMBLOB) trong MySQL.
    """
    try:
        raw_bytes = await file.read()
        sprite_name = name or file.filename or "sprite_raw"
        sprite_id = sprite_repo.save_raw_sprite(
            db=db,
            project_id=project_id,
            name=sprite_name,
            raw_image_bytes=raw_bytes,
            metadata={"filename": file.filename, "size_bytes": len(raw_bytes)}
        )
        return {"status": "success", "id": sprite_id, "name": sprite_name, "message": "Đã lưu ảnh gốc vào MySQL thành công!"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu ảnh gốc vào CSDL: {str(exc)}")


@sprites_router.post("/sprites/{sprite_id}/save-processed")
async def save_processed_sprite(
    sprite_id: int,
    file: UploadFile = File(...),
    project_id: int = Form(...),
    db: Session = Depends(get_db)
):
    """
    Lưu trực tiếp ảnh sau khi đã tối ưu/chuẩn hóa vào cột processed_image_data (MEDIUMBLOB) trong MySQL.
    """
    try:
        proc_bytes = await file.read()
        success = sprite_repo.update_processed_sprite(
            db=db,
            sprite_id=sprite_id,
            project_id=project_id,
            processed_image_bytes=proc_bytes,
            metadata={"filename": file.filename, "size_bytes": len(proc_bytes)}
        )
        return {"status": "success" if success else "failed", "id": sprite_id, "message": "Đã lưu ảnh tối ưu vào MySQL thành công!"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu ảnh tối ưu: {str(exc)}")


@sprites_router.get("/sprites/{sprite_id}/raw")
def get_raw_sprite_image(
    sprite_id: int,
    project_id: int = Query(..., description="Mã dự án"),
    db: Session = Depends(get_db)
):
    """
    Tải ra dữ liệu ảnh gốc thật dạng image/png từ MySQL.
    """
    sprite = sprite_repo.get_sprite_by_id(db, sprite_id, project_id)
    if not sprite or not sprite.get("raw_image_data"):
        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh gốc trong MySQL.")
    return Response(content=sprite["raw_image_data"], media_type="image/png")


@sprites_router.get("/sprites/{sprite_id}/processed")
def get_processed_sprite_image(
    sprite_id: int,
    project_id: int = Query(..., description="Mã dự án"),
    db: Session = Depends(get_db)
):
    """
    Tải ra dữ liệu ảnh tối ưu thật dạng image/png từ MySQL.
    """
    sprite = sprite_repo.get_sprite_by_id(db, sprite_id, project_id)
    if not sprite or not sprite.get("processed_image_data"):
        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh tối ưu trong MySQL.")
    return Response(content=sprite["processed_image_data"], media_type="image/png")


@sprites_router.delete("/sprites/{sprite_id}")
def delete_sprite(
    sprite_id: int,
    project_id: int = Query(..., description="Mã dự án"),
    db: Session = Depends(get_db)
):
    """
    Xóa vĩnh viễn tấm ảnh sprite và toàn bộ khung cắt liên quan khỏi MySQL.
    """
    success = sprite_repo.delete_sprite(db, sprite_id, project_id)
    return {"status": "success" if success else "failed", "message": f"Đã xóa sprite ID {sprite_id} khỏi MySQL"}

