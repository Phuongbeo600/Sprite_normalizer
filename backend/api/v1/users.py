# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc & Kiểu)
# ========================================================
# typing: Định nghĩa kiểu tùy chọn
from typing import Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# fastapi: Khởi tạo router, xử lý lỗi HTTP và tham số truy vấn
from fastapi import APIRouter, Depends, HTTPException, Query
# sqlalchemy: Phiên làm việc cơ sở dữ liệu
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services & Database)
# ========================================================
# get_db: Dependency cấp phiên MySQL
from backend.db import get_db
# UserService: Dịch vụ nghiệp vụ quản lý tài khoản người dùng
from backend.services.user_service import UserService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

users_router = APIRouter(prefix="/users", tags=["Quản trị Người dùng (Admin)"])
user_service = UserService()


@users_router.get("")
def list_users(
    admin_role: Optional[str] = Query("admin", description="Quyền người thực hiện"),
    db: Session = Depends(get_db)
):
    """
    Lấy danh sách toàn bộ tài khoản người dùng trong CSDL MySQL (Chỉ dành cho Admin).
    """
    try:
        users = user_service.get_all_users(db, current_user_role=admin_role)
        return {
            "status": "success",
            "data": users
        }
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi tải danh sách người dùng: {str(e)}")


@users_router.delete("/{user_id}")
def delete_user(
    user_id: int,
    admin_role: Optional[str] = Query("admin", description="Quyền người thực hiện"),
    db: Session = Depends(get_db)
):
    """
    Admin thực hiện xóa một tài khoản người dùng:
    - Xóa sạch toàn bộ các dự án, sprite, 15 frame của người dùng đó khỏi MySQL.
    - Chặn tuyệt đối hành vi xóa tài khoản Admin.
    """
    try:
        success = user_service.delete_user(db, user_id=user_id, current_user_role=admin_role)
        if not success:
            raise HTTPException(status_code=404, detail="Không tìm thấy người dùng để xóa.")
        return {
            "status": "success",
            "message": "Đã xóa người dùng và dọn dẹp toàn bộ dự án liên quan thành công!"
        }
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi khi xóa người dùng: {str(e)}")
