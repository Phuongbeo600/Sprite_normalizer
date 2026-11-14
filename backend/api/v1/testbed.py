# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo router & kiểu dữ liệu)
# ========================================================
# typing: Khai báo kiểu danh sách, từ điển, tùy chọn
from typing import List, Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# APIRouter, Depends, HTTPException: Bộ định tuyến FastAPI, tiêm phụ thuộc phiên DB và xử lý lỗi HTTP
from fastapi import APIRouter, Depends, HTTPException, Query
# Session: Phiên làm việc cơ sở dữ liệu SQLAlchemy
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Database, Services & Schemas)
# ========================================================
# get_db: Cung cấp phiên làm việc CSDL MySQL từ pool kết nối
from backend.db import get_db
# TestbedService: Dịch vụ nghiệp vụ phòng thử nghiệm Godot Testbed
from backend.services.testbed_service import TestbedService
# Schemas: Cấu trúc dữ liệu yêu cầu & phản hồi
from backend.schemas.testbed import (
    TestbedMapSaveRequest,
    TestbedGroundYUpdateRequest,
    TestbedMapResponse,
    TestbedCharacterSaveRequest,
    TestbedCharacterUpdateRequest,
    TestbedSlotUpdateRequest,
    TestbedCharacterListResponse
)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


testbed_router = APIRouter(prefix="/testbed", tags=["Godot Testbed (MySQL Storage)"])
service = TestbedService()


# ========================================================
# CÁC TUYẾN API CHO BẢN ĐỒ NỀN / SÀN GAME (testbed_maps)
# ========================================================

@testbed_router.get("/map", response_model=TestbedMapResponse)
def get_testbed_map(project_id: int = Query(..., description="Mã dự án"), db: Session = Depends(get_db)):
    """
    Lấy thông tin và ảnh thật của bản đồ nền đang kích hoạt của dự án.
    """
    data = service.get_map(db, project_id)
    if not data:
        return TestbedMapResponse(
            status="not_found",
            project_id=project_id,
            name="Chưa có bản đồ",
            map_image_base64=None,
            ground_y=540,
            show_ground_line=True
        )
    return TestbedMapResponse(
        status="success",
        id=data["id"],
        project_id=data["project_id"],
        name=data["name"],
        map_image_base64=data["map_image_base64"],
        ground_y=data["ground_y"],
        show_ground_line=data["show_ground_line"]
    )


@testbed_router.post("/map")
def save_testbed_map(req: TestbedMapSaveRequest, db: Session = Depends(get_db)):
    """
    Lưu hoặc thay thế bản đồ nền mới và độ cao mặt đất vào MySQL.
    """
    try:
        return service.save_map(db, req)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu bản đồ nền: {str(exc)}")


@testbed_router.put("/map/ground-y")
def update_ground_y(req: TestbedGroundYUpdateRequest, db: Session = Depends(get_db)):
    """
    Cập nhật riêng độ cao sàn mặt đất ground_y khi người dùng kéo thanh trượt.
    """
    success = service.update_ground_y(db, req.project_id, req.ground_y)
    return {"status": "success" if success else "failed", "ground_y": req.ground_y}


@testbed_router.delete("/map")
def delete_testbed_map(project_id: int = Query(..., description="Mã dự án"), db: Session = Depends(get_db)):
    """
    Xóa bản đồ nền của dự án khỏi cơ sở dữ liệu.
    """
    success = service.delete_map(db, project_id)
    return {"status": "success" if success else "failed", "message": "Đã xóa bản đồ nền khỏi MySQL"}


# ========================================================
# CÁC TUYẾN API CHO NHÂN VẬT & 15 Ô ẢNH RỜI
# ========================================================

@testbed_router.get("/characters", response_model=TestbedCharacterListResponse)
def get_testbed_characters(project_id: int = Query(..., description="Mã dự án"), db: Session = Depends(get_db)):
    """
    Lấy danh sách tất cả nhân vật của dự án kèm toàn bộ 15 ô ảnh rời đã được nạp từ MySQL.
    """
    try:
        chars = service.get_characters(db, project_id)
        return TestbedCharacterListResponse(status="success", characters=chars)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lấy danh sách nhân vật: {str(exc)}")


@testbed_router.post("/characters")
def save_testbed_character(req: TestbedCharacterSaveRequest, db: Session = Depends(get_db)):
    """
    Tạo mới hoặc lưu toàn bộ nhân vật và 15 ô ảnh rời vào MySQL.
    """
    try:
        return service.save_character(db, req)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi khi lưu nhân vật: {str(exc)}")


@testbed_router.put("/characters/{char_id}")
def update_testbed_character(
    char_id: int,
    req: TestbedCharacterUpdateRequest,
    project_id: int = Query(..., description="Mã dự án"),
    db: Session = Depends(get_db)
):
    """
    Cập nhật nhanh thông số nhân vật (tên, scale, vị trí X trên sàn, FPS).
    """
    success = service.update_character(db, char_id, project_id, req)
    return {"status": "success" if success else "failed", "id": char_id}


@testbed_router.put("/characters/{char_id}/slots")
def update_single_slot(
    char_id: int,
    req: TestbedSlotUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    Cập nhật ảnh của riêng một ô trong 15 ô (VD: ô 'down_1' bước 1 hướng xuống).
    """
    try:
        success = service.update_single_slot(db, char_id, req)
        return {"status": "success" if success else "failed", "slot_key": req.slot_key}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi khi cập nhật ô ảnh: {str(exc)}")


@testbed_router.delete("/characters/{char_id}")
def delete_testbed_character(
    char_id: int,
    project_id: int = Query(..., description="Mã dự án"),
    db: Session = Depends(get_db)
):
    """
    Xóa nhân vật khỏi phòng thử nghiệm (Tự động dọn sạch 15 ô ảnh rời nhờ ON DELETE CASCADE).
    """
    success = service.delete_character(db, char_id, project_id)
    return {"status": "success" if success else "failed", "message": f"Đã xóa nhân vật ID {char_id} khỏi MySQL"}
