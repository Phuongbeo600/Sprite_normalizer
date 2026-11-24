# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Bộ đệm)
# ========================================================
# hashlib: Băm SHA-256 dữ liệu ảnh nhị phân để ngăn chặn lưu trùng lặp
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
# run_in_threadpool: Chuyển các tác vụ nặng (CPU-bound và I/O đồng bộ) vào ThreadPool để không chặn Event Loop
from fastapi.concurrency import run_in_threadpool
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
# SpriteWorkspaceService: Điều phối ảnh và metadata lưu trữ.
from backend.services.sprite_workspace_service import SpriteWorkspaceService
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


def sprite_workspace():
    """Cấp dịch vụ với repository hiện tại, giữ tương thích điểm tiêm kiểm thử."""
    return SpriteWorkspaceService(sprite_repo)


def _validate_image_upload(file: UploadFile) -> None:
    """Kiểm tra định dạng file tải lên có phải là hình ảnh hay không."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File tải lên phải là định dạng hình ảnh.")


def _parse_manual_grid(x_cuts_json: str | None, y_cuts_json: str | None) -> tuple:
    """Đọc hai danh sách biên JSON và từ chối biểu mẫu thiếu hoặc sai cấu trúc.

    @param x_cuts_json Chuỗi JSON các biên cột hoặc None khi cắt đều.
    @param y_cuts_json Chuỗi JSON các biên hàng hoặc None khi cắt đều.
    @returns Cặp danh sách biên để dịch vụ kiểm tra tọa độ theo ảnh.
    """
    if x_cuts_json is None and y_cuts_json is None:
        return None, None
    if x_cuts_json is None or y_cuts_json is None:
        raise ValueError("Lưới thủ công phải cung cấp đủ x_cuts_json và y_cuts_json.")
    try:
        x_cuts, y_cuts = json.loads(x_cuts_json), json.loads(y_cuts_json)
    except (TypeError, ValueError) as error:
        raise ValueError("Biên cắt thủ công phải là danh sách JSON hợp lệ.") from error
    if not isinstance(x_cuts, list) or not isinstance(y_cuts, list):
        raise ValueError("Biên cắt thủ công phải là hai danh sách JSON.")
    return x_cuts, y_cuts


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
    trim_outer_padding: Annotated[bool, Form()] = True, # tự động nhận diện và gọt bỏ lề trống thừa xung quanh
    x_cuts_json: Annotated[Optional[str], Form()] = None,
    y_cuts_json: Annotated[Optional[str], Form()] = None,
):
    """Cắt lưới Sprite Sheet thích ứng và trả danh sách PNG hoặc tệp ZIP (Hỗ trợ auto_anchor, ép độ phân giải & gọt lề trống)."""
    try:
        x_cuts, y_cuts = _parse_manual_grid(x_cuts_json, y_cuts_json)
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
                        target_height=target_height,
                        trim_outer_padding=trim_outer_padding,
                        x_cuts=x_cuts, y_cuts=y_cuts,
                    ),
                    media_type="application/zip",
                    headers={"Content-Disposition": 'attachment; filename="sprite-frames.zip"'},#Cho phép tải file từ hệ thống xuống
                )
            return {"frames": [
                {"name": name, "width": width, "height": height, "png": b64encode(png).decode("ascii")}
                for name, (width, height), png in SpriteService.sheet_frames(
                    image, rows, columns, auto_anchor=auto_anchor, trim_outer_padding=trim_outer_padding,
                    x_cuts=x_cuts, y_cuts=y_cuts,
                )
            ]}
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except (OSError, Image.DecompressionBombError) as error:
        raise HTTPException(status_code=400, detail="Không đọc được sprite sheet.") from error


@sprites_router.post("/batch-resize-sheet")
def batch_resize_sheet_stateless(
    file: Annotated[UploadFile, File()],
    rows: Annotated[int, Form(ge=1, le=256)],
    columns: Annotated[int, Form(ge=1, le=256)],
    target_width: Annotated[int, Form(ge=1)],
    target_height: Annotated[int, Form(ge=1)],
    auto_anchor: Annotated[bool, Form()] = False,
    trim_outer_padding: Annotated[bool, Form()] = True,
    x_cuts_json: Annotated[Optional[str], Form()] = None,
    y_cuts_json: Annotated[Optional[str], Form()] = None,
):
    """
    Cắt lưới Sprite Sheet và ép toàn bộ các khung hình về độ phân giải yêu cầu bằng thuật toán Nearest Neighbor.
    Bảo toàn 100% độ sắc nét cho đồ họa Pixel Art.
    """
    try:
        x_cuts, y_cuts = _parse_manual_grid(x_cuts_json, y_cuts_json)
        with Image.open(file.file) as source:
            image = ImageOps.exif_transpose(source)
            resized_frames = [
                {"name": name, "width": target_width, "height": target_height,
                 "png": b64encode(png).decode("ascii")}
                for name, _size, png in SpriteService.resized_sheet_frames(
                    image, rows, columns, target_width, target_height,
                    auto_anchor=auto_anchor, trim_outer_padding=trim_outer_padding,
                    x_cuts=x_cuts, y_cuts=y_cuts,
                )
            ]
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
        png_bytes = await run_in_threadpool(
            SpriteService.normalize_image_bytes,
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

        def _perform_analysis():
            with Image.open(io.BytesIO(contents)) as source:
                image = ImageOps.exif_transpose(source)

            metrics, message, annotated_b64 = AnatomyService.analyze_sprite( #metrics chứa dữ liệu đầu , cổ, chân ở python đã tính
                image=image, auto_remove_bg=auto_remove_bg,
            )
            if not metrics:
                return None, message, None, None
            regions = AnatomyService.measure_anatomy_regions(image, metrics, auto_remove_bg)
            return metrics, message, annotated_b64, regions

        metrics, message, annotated_b64, regions = await run_in_threadpool(_perform_analysis)

        if not metrics:
            raise HTTPException(status_code=400, detail=message)

        return {
            "status": "success",
            "message": message,
            "metrics": asdict(metrics),
            "region_measurements": regions,
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
        return await run_in_threadpool(sprite_workspace().save_raw, db, raw_bytes, file.filename, name, project_id)
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
        return await run_in_threadpool(sprite_workspace().save_processed, db, proc_bytes, file.filename, sprite_id, project_id)
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
    db: Session = Depends(get_db),
    x_cuts_json: Annotated[Optional[str], Form()] = None,
    y_cuts_json: Annotated[Optional[str], Form()] = None,
):
    """
    Lưu trọn gói bộ Sprite Sheet và toàn bộ các khung hình đã cắt rời vào CSDL MySQL:
    - Bảng 'project_sprites': Lưu ảnh Sheet gốc hoặc Sheet đã ghép từ các frame đã ép kích thước, băm SHA-256 chống trùng và gán folder_name.
    - Bảng 'sprite_frames': Bóc tách từng ô frame (đã ép kích thước nếu có) và lưu nguyên tử trong cùng một phiên.
    """
    try:
        x_cuts, y_cuts = _parse_manual_grid(x_cuts_json, y_cuts_json)
        raw_bytes = await file.read()
        return await run_in_threadpool(
            sprite_workspace().save_sliced_pack,
            db, raw_bytes, file.filename, project_id, rows, columns, folder_name,
            auto_anchor, fps, target_width, target_height, x_cuts, y_cuts,
        )
    except ValueError as exc:
        if x_cuts_json is not None or y_cuts_json is not None:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu bộ frame vào thư mục: {str(exc)}") from exc
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
        return sprite_workspace().get_frames(db, sprite_id)
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
    x_cuts_json: Annotated[Optional[str], Form()] = None,
    y_cuts_json: Annotated[Optional[str], Form()] = None,
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
        x_cuts, y_cuts = _parse_manual_grid(x_cuts_json, y_cuts_json)
        raw_bytes = await file.read()

        def _perform_batch_resize():
            img = ImageOps.exif_transpose(Image.open(io.BytesIO(raw_bytes)))
            return [
                {"name": name, "size": [target_width, target_height], "png": b64encode(png).decode("utf-8")}
                for name, _size, png in SpriteService.resized_sheet_frames(
                    img, rows, columns, target_width, target_height,
                    auto_anchor=auto_anchor, x_cuts=x_cuts, y_cuts=y_cuts,
                )
            ]

        frames_result = await run_in_threadpool(_perform_batch_resize)

        return {
            "status": "success",
            "rows": rows,
            "columns": columns,
            "target_width": target_width,
            "target_height": target_height,
            "frame_count": len(frames_result),
            "frames": frames_result
        }
    except ValueError as exc:
        if x_cuts_json is not None or y_cuts_json is not None:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        raise HTTPException(status_code=500, detail=f"Lỗi khi ép kích thước frame hàng loạt: {str(exc)}") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi khi ép kích thước frame hàng loạt: {str(exc)}")

