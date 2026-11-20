# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Bộ đệm)
# ========================================================
# hashlib: Băm SHA-256 dữ liệu ảnh nhị phân để ngăn chặn lưu trùng lặp
import hashlib
# io: Xử lý byte buffer ảnh
import io
# json: Đọc các vùng và đoạn đo gửi từ trình vẽ sprite
import json
# base64: Chuyển các PNG đã cắt sang dữ liệu xem trước trên trình duyệt
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
# PIL (Pillow): Mở ảnh tải lên và áp dụng hướng ảnh theo thông tin EXIF
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
from backend.services.character.anatomy_service import AnatomyService
# resize_image: Thu nhỏ toàn bộ ảnh theo kích thước pixel
from backend.core.processing.sprite_editing import recover_native_sprite, resize_sprite as resize_image
# GodotExportService: Dịch vụ đóng gói tài nguyên nhân vật xuất xưởng cho Godot 4
from backend.services.testbed.godot_export_service import GodotExportService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

sprites_router = APIRouter(tags=["Sprite Operations"])
sprite_repo = SpriteRepository()


def get_sprite_repository() -> SpriteRepository:
    """Dependency cung cấp instance SpriteRepository hỗ trợ Dependency Injection."""
    return sprite_repo


def _validate_image_upload(file: UploadFile) -> None:
    """Kiểm tra định dạng file tải lên có phải là hình ảnh hay không."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File tải lên phải là định dạng hình ảnh.")


# ========================================================
# PHẦN 1: CÁC TUYẾN XỬ LÝ & GIẢI TÍCH ẢNH KHÔNG LƯU TRẠNG THÁI (Stateless Processing)
# ========================================================

@sprites_router.post("/detect-resolution")
def detect_sprite_resolution(file: Annotated[UploadFile, File()]):
    """Trả kích thước lưới nhận diện và PNG đã khôi phục nếu ảnh bị phóng to."""
    try:
        with Image.open(file.file) as source:
            image, scale = recover_native_sprite(ImageOps.exif_transpose(source))#Thu nhỏ ảnh về đúng kích thước thật mà AI đã phóng to lên
            return {
                "width": image.width,
                "height": image.height,
                "scale": scale,
                "png": b64encode(SpriteService.encode_png(image)).decode("ascii") if scale > 1 else None,#ảnh trả về đã chuẩn hoá
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
            return Response(SpriteService.encode_png(image), media_type="image/png") # Response trả về một đối tượng luôn chứ không phải file json
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (OSError, Image.DecompressionBombError) as error:
        raise HTTPException(status_code=400, detail="Không đọc được ảnh sprite.") from error


@sprites_router.post("/slice-sheet")
def slice_sprite_sheet(
    file: Annotated[UploadFile, File()],# không điền gì trong File() vì là trường bắt buộc nếu người dùng không tải file lên sẽ báo lỗi
    rows: Annotated[int, Form(ge=1, le=256)],
    columns: Annotated[int, Form(ge=1, le=256)],
    output: Annotated[Literal["json", "zip"], Form()] = "json",
    auto_anchor: Annotated[bool, Form()] = False, # tự động căn tâm, neo chân
    target_width: Annotated[Optional[int], Form(ge=1)] = None,
    target_height: Annotated[Optional[int], Form(ge=1)] = None,
):
    """Cắt lưới Sprite Sheet thích ứng và trả danh sách PNG hoặc tệp ZIP (Hỗ trợ auto_anchor & ép độ phân giải Nearest Neighbor)."""
    try:
        with Image.open(file.file) as source:
            image = ImageOps.exif_transpose(source)
            if output == "zip":
                return Response(
                    SpriteService.sheet_zip(
                        image,
                        rows,
                        columns,
                        auto_anchor=auto_anchor,
                        target_width=target_width,
                        target_height=target_height
                    ),
                    media_type="application/zip",
                    headers={"Content-Disposition": 'attachment; filename="sprite-frames.zip"'},#Cho phép tải file từ hệ thống xuống
                )
            return {"frames": [
                {"name": name, "width": width, "height": height, "png": b64encode(png).decode("ascii")}
                for name, (width, height), png in SpriteService.sheet_frames(image, rows, columns, auto_anchor=auto_anchor)
            ]}
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (OSError, Image.DecompressionBombError) as error:
        raise HTTPException(status_code=400, detail="Không đọc được sprite sheet.") from error


@sprites_router.post("/batch-resize-sheet")
def batch_resize_sheet(
    file: Annotated[UploadFile, File()],
    rows: Annotated[int, Form(ge=1, le=256)],
    columns: Annotated[int, Form(ge=1, le=256)],
    target_width: Annotated[int, Form(ge=1)],
    target_height: Annotated[int, Form(ge=1)],
    auto_anchor: Annotated[bool, Form()] = False,
):
    """
    Cắt lưới Sprite Sheet và ép toàn bộ các khung hình về độ phân giải yêu cầu bằng thuật toán Nearest Neighbor.
    Bảo toàn 100% độ sắc nét cho đồ họa Pixel Art.
    """
    try:
        with Image.open(file.file) as source:
            image = ImageOps.exif_transpose(source)
            from backend.core.processing.sprite_editing import slice_sheet
            resized_frames = []
            for idx, frame_img in enumerate(slice_sheet(image, rows, columns, auto_anchor=auto_anchor), start=1):
                resized = resize_image(frame_img, target_width, target_height)
                png_bytes = SpriteService.encode_png(resized)
                resized_frames.append({
                    "name": f"frame_{idx:03}.png",
                    "width": target_width,
                    "height": target_height,
                    "png": b64encode(png_bytes).decode("ascii")
                })
            return {
                "status": "success",
                "target_width": target_width,
                "target_height": target_height,
                "frame_count": len(resized_frames),
                "frames": resized_frames
            }
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (OSError, Image.DecompressionBombError) as error:
        raise HTTPException(status_code=400, detail="Không đọc được sprite sheet.") from error


@sprites_router.post("/analyze-colors")
def analyze_sprite_colors(file: UploadFile = File(...)):
    """Đo màu và đặc trưng pixel trên máy chủ ứng dụng."""
    try:
        with Image.open(file.file) as image:
            return SpriteService.analyze_colors(ImageOps.exif_transpose(image))#analyze_color-thuật toán phân tích màu và exif_transpose là xoay ảnh về đúng chiều
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
    _validate_image_upload(file)

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
    _validate_image_upload(file)

    try:
        contents = await file.read()
        with Image.open(io.BytesIO(contents)) as source:
            image = ImageOps.exif_transpose(source)

        metrics, message, annotated_b64 = AnatomyService.analyze_sprite( #metrics chứa dữ liệu đầu , cổ, chân ở python đã tính
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
# PHẦN 2: CÁC TUYẾN QUẢN LÝ DỮ LIỆU SPRITE CSDL MYSQL (Project Sprites CRUD)
# ========================================================

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
    Lưu ảnh thô ban đầu vào MySQL với cơ chế băm SHA-256 chống lưu trùng lặp.
    Nếu ảnh đã tồn tại trong dự án, hệ thống trả về thông báo và ID hiện có mà không tạo bản ghi rác mới.
    """
    try:
        raw_bytes = await file.read()
        sprite_name = name or file.filename or "sprite_raw"
        file_hash = hashlib.sha256(raw_bytes).hexdigest() if raw_bytes else None

        # Kiểm tra chống trùng lặp theo mã băm SHA-256
        existing = sprite_repo.get_by_hash(db, project_id, file_hash) if file_hash else None
        if existing:
            return {
                "status": "success",
                "id": existing["id"],
                "name": existing["name"],
                "file_hash": file_hash,
                "is_duplicate": True,
                "message": f"Ảnh này đã tồn tại trong dự án (Mã: {existing['id']}), hệ thống tự động tái sử dụng và chặn lưu trùng lặp."
            }

        sprite_id = sprite_repo.save_raw_sprite(
            db=db,
            project_id=project_id,
            name=sprite_name,
            raw_image_bytes=raw_bytes,
            metadata={"filename": file.filename, "size_bytes": len(raw_bytes), "file_hash": file_hash}
        )
        return {
            "status": "success",
            "id": sprite_id,
            "name": sprite_name,
            "file_hash": file_hash,
            "is_duplicate": False,
            "message": "Đã lưu ảnh gốc vào MySQL thành công!"
        }
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


@sprites_router.post("/sprites/save-sliced-pack")
async def save_sliced_pack(
    file: Annotated[UploadFile, File(description="Tệp ảnh Sprite Sheet gốc")],
    project_id: Annotated[int, Form(description="Mã định danh dự án")],
    rows: Annotated[int, Form(description="Số hàng trong lưới")],
    columns: Annotated[int, Form(description="Số cột trong lưới")],
    folder_name: Annotated[str, Form(description="Tên thư mục gom nhóm")] = "Mặc định",
    auto_anchor: Annotated[bool, Form(description="Tự động căn tâm và neo chân")] = False,
    fps: Annotated[int, Form(description="Tốc độ khung hình hoạt họa")] = 6,
    target_width: Annotated[Optional[int], Form(description="Chiều rộng mục tiêu cho từng frame (nếu ép kích thước)")] = None,
    target_height: Annotated[Optional[int], Form(description="Chiều cao mục tiêu cho từng frame (nếu ép kích thước)")] = None,
    db: Session = Depends(get_db)
):
    """
    Lưu trọn gói bộ Sprite Sheet và toàn bộ các khung hình đã cắt rời vào CSDL MySQL:
    - Bảng 'project_sprites': Lưu ảnh Sheet gốc hoặc Sheet đã ghép từ các frame đã ép kích thước, băm SHA-256 chống trùng và gán folder_name.
    - Bảng 'sprite_frames': Bóc tách từng ô frame (đã ép kích thước nếu có) và lưu nguyên tử trong cùng một phiên.
    """
    try:
        raw_bytes = await file.read()
        sheet_name = file.filename or f"sheet_{rows}x{columns}.png"

        # Mở ảnh bằng Pillow và tự động cắt thành các ô frame
        image = Image.open(io.BytesIO(raw_bytes))
        image = ImageOps.exif_transpose(image)

        is_batch_resized = bool(target_width and target_height and target_width > 0 and target_height > 0)

        frames_list = []
        resized_pil_frames = []

        for idx, (frame_name, frame_size, png_bytes) in enumerate(
            SpriteService.sheet_frames(image, rows=rows, columns=columns, auto_anchor=auto_anchor),
            start=1
        ):
            if is_batch_resized:
                frame_img = Image.open(io.BytesIO(png_bytes))
                resized = resize_image(frame_img, width=target_width, height=target_height)
                resized_pil_frames.append(resized)
                buf = io.BytesIO()
                resized.save(buf, format="PNG")
                final_png_bytes = buf.getvalue()
                final_size = [target_width, target_height]
            else:
                final_png_bytes = png_bytes
                final_size = list(frame_size)

            frames_list.append({
                "index": idx,
                "name": frame_name,
                "bytes": final_png_bytes,
                "size": final_size,
                "metadata": {
                    "width": final_size[0],
                    "height": final_size[1],
                    "row": (idx - 1) // columns + 1,
                    "col": (idx - 1) % columns + 1
                }
            })

        # Nếu có ép kích thước: Tự động ghép 15 frame nhỏ thành một tấm Sprite Sheet mới hoàn chỉnh
        if is_batch_resized and resized_pil_frames:
            new_sheet_w = columns * target_width
            new_sheet_h = rows * target_height
            new_sheet_img = Image.new("RGBA", (new_sheet_w, new_sheet_h), (0, 0, 0, 0))

            for f_idx, rf_img in enumerate(resized_pil_frames):
                col_i = f_idx % columns
                row_i = f_idx // columns
                new_sheet_img.paste(rf_img, (col_i * target_width, row_i * target_height))

            s_buf = io.BytesIO()
            new_sheet_img.save(s_buf, format="PNG")
            final_sheet_bytes = s_buf.getvalue()
            name_stem = sheet_name.rsplit(".", 1)[0]
            sheet_name = f"{name_stem}_{target_width}x{target_height}.png"
        else:
            final_sheet_bytes = raw_bytes

        metadata = {
            "rows": rows,
            "columns": columns,
            "auto_anchor": auto_anchor,
            "fps": fps,
            "original_width": image.width,
            "original_height": image.height,
            "frame_width": target_width if is_batch_resized else (image.width // columns),
            "frame_height": target_height if is_batch_resized else (image.height // rows),
            "is_batch_resized": is_batch_resized,
            "frame_count": len(frames_list),
            "filename": sheet_name
        }

        result = sprite_repo.save_sliced_pack(
            db=db,
            project_id=project_id,
            folder_name=folder_name.strip() or "Mặc định",
            sheet_name=sheet_name,
            sheet_bytes=final_sheet_bytes,
            frames=frames_list,
            metadata=metadata
        )

        return {
            "status": "success",
            "sprite_id": result["sprite_id"],
            "folder_name": result["folder_name"],
            "sheet_name": result["sheet_name"],
            "frame_count": result["frame_count"],
            "is_batch_resized": is_batch_resized,
            "frame_width": target_width if is_batch_resized else (image.width // columns),
            "frame_height": target_height if is_batch_resized else (image.height // rows),
            "message": f"Đã lưu thành công bộ {result['frame_count']} frame ({'đã ép ' + str(target_width) + '×' + str(target_height) + 'px' if is_batch_resized else 'gốc'}) vào thư mục '{result['folder_name']}'!"
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu bộ frame vào thư mục: {str(exc)}")


@sprites_router.get("/sprites/{sprite_id}/frames")
def get_sprite_frames(
    sprite_id: int,
    db: Session = Depends(get_db)
):
    """
    Lấy danh sách các frame cắt rời của một tấm Sprite Sheet trong CSDL.
    """
    try:
        frames = sprite_repo.get_sprite_frames(db, sprite_id)
        # Bổ sung URL tải ảnh cho từng frame
        for f in frames:
            f["image_url"] = f"/api/sprites/frames/{f['id']}/image"
            if isinstance(f.get("metadata"), str):
                try:
                    f["metadata"] = json.loads(f["metadata"])
                except Exception:
                    pass
        return {"status": "success", "sprite_id": sprite_id, "frames": frames}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lấy danh sách frame: {str(exc)}")


@sprites_router.get("/sprites/frames/{frame_id}/image")
def get_frame_image(
    frame_id: int,
    db: Session = Depends(get_db)
):
    """
    Tải ảnh nhị phân trực tiếp của một frame cắt rời từ MySQL dạng image/png.
    """
    img_bytes = sprite_repo.get_frame_image(db, frame_id)
    if not img_bytes:
        raise HTTPException(status_code=404, detail="Không tìm thấy ảnh frame trong MySQL.")
    return Response(content=img_bytes, media_type="image/png")


@sprites_router.post("/sprites/batch-resize-sheet")
async def batch_resize_sheet(
    file: UploadFile = File(..., description="Tệp ảnh Sprite Sheet gốc"),
    rows: int = Form(..., description="Số hàng trong lưới"),
    columns: int = Form(..., description="Số cột trong lưới"),
    target_width: int = Form(..., description="Chiều rộng mục tiêu cho từng frame"),
    target_height: int = Form(..., description="Chiều cao mục tiêu cho từng frame"),
    auto_anchor: bool = Form(False, description="Tự động căn tâm và neo chân"),
):
    """
    Ép kích thước hàng loạt toàn bộ các frame trong Sprite Sheet:
    1. Cắt Sprite Sheet thành danh sách các ô frame.
    2. Sử dụng thuật toán Nearest Neighbor (resize_sprite) ép từng frame về (target_width x target_height) mà không làm vỡ nét pixel art.
    3. Mã hóa Base64 trả về cho frontend cập nhật tức thì trên Timeline và Canvas.
    """
    if target_width < 1 or target_height < 1:
        raise HTTPException(status_code=400, detail="Chiều rộng và chiều cao mục tiêu phải >= 1 pixel.")

    try:
        raw_bytes = await file.read()
        image = Image.open(io.BytesIO(raw_bytes))
        image = ImageOps.exif_transpose(image)

        frames_result = []
        for frame_name, _original_size, png_bytes in SpriteService.sheet_frames(
            image, rows=rows, columns=columns, auto_anchor=auto_anchor
        ):
            frame_img = Image.open(io.BytesIO(png_bytes))
            resized_frame = resize_image(frame_img, width=target_width, height=target_height)

            out_buf = io.BytesIO()
            resized_frame.save(out_buf, format="PNG")
            b64_str = b64encode(out_buf.getvalue()).decode("utf-8")

            frames_result.append({
                "name": frame_name,
                "size": [target_width, target_height],
                "png": b64_str
            })

        return {
            "status": "success",
            "rows": rows,
            "columns": columns,
            "target_width": target_width,
            "target_height": target_height,
            "frame_count": len(frames_result),
            "frames": frames_result
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi khi ép kích thước frame hàng loạt: {str(exc)}")

