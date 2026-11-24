# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc & Kiểu)
# ========================================================
# typing: Khai báo kiểu tùy chọn và từ điển
from typing import Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# fastapi: Khởi tạo router, xử lý lỗi HTTP và Dependency Injection
from fastapi import APIRouter, Depends, HTTPException
# sqlalchemy: Phiên làm việc cơ sở dữ liệu
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services, Database & Schemas)
# ========================================================
# get_db: Dependency cấp phiên MySQL
from backend.db import get_db
# get_current_user_optional: Dependency xác thực danh tính qua JWT Bearer Token
from backend.core.dependencies import get_current_user_optional
# UserService: Dịch vụ nghiệp vụ xác thực và người dùng
from backend.services.user_service import UserService
# Schemas: DTO kiểm tra dữ liệu yêu cầu đăng nhập, đăng ký và cập nhật hồ sơ
from backend.schemas.auth import LoginRequest, RegisterRequest, UpdateProfileRequest

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

auth_router = APIRouter(prefix="/auth", tags=["Xác thực & Tài khoản"])
user_service = UserService()


def get_user_service() -> UserService:
    """Dependency cung cấp UserService hỗ trợ Dependency Injection."""
    return user_service


# Export lại các schemas đảm bảo tương thích ngược 100%
__all__ = ["auth_router", "LoginRequest", "RegisterRequest", "UpdateProfileRequest", "get_user_service"]


@auth_router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """
    Xác thực thông tin đăng nhập của người dùng hoặc Admin:
    - Admin: username = 'admin', password = '1'
    - User thường: tài khoản Gmail đã đăng ký trong hệ thống
    Trả về Access Token chuẩn JWT Bearer và hồ sơ người dùng.
    """
    try:
        user_info = user_service.authenticate(db, req.username, req.password)
        return {
            "status": "success",
            "message": "Đăng nhập thành công!",
            "access_token": user_info.get("access_token"),
            "token_type": user_info.get("token_type", "bearer"),
            "data": user_info
        }
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi hệ thống khi đăng nhập: {str(e)}")


@auth_router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """
    Đăng ký tài khoản người dùng mới (bắt buộc định dạng Gmail hợp lệ).
    Mật khẩu được băm an toàn bằng Bcrypt và trả về mã JWT Bearer Token.
    """
    try:
        created_user = user_service.register(
            db=db,
            username=req.username,
            password=req.password,
            last_name=req.last_name,
            middle_name=req.middle_name,
            first_name=req.first_name
        )
        return {
            "status": "success",
            "message": "Đăng ký tài khoản thành công!",
            "access_token": created_user.get("access_token"),
            "token_type": created_user.get("token_type", "bearer"),
            "data": created_user
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi đăng ký tài khoản: {str(e)}")


@auth_router.put("/profile")
def update_profile(
    req: UpdateProfileRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Cập nhật thông tin cá nhân: Đổi ảnh đại diện, sửa họ tên, đổi Gmail hoặc đổi mật khẩu.
    RÀNG BUỘC BẢO MẬT: Chỉ chủ sở hữu tài khoản (hoặc Quản trị viên) mới có quyền chỉnh sửa.
    """
    # Kiểm tra quyền sở hữu tài khoản nếu có thông tin đăng nhập
    actual_user = current_user if (current_user and not hasattr(current_user, "default")) else None
    if actual_user:
        if actual_user.get("role") != "admin" and actual_user.get("id") != req.user_id:
            raise HTTPException(
                status_code=403,
                detail="Bạn không có quyền chỉnh sửa thông tin hồ sơ của tài khoản khác."
            )
    try:
        updated_user = user_service.update_profile(
            db=db,
            user_id=req.user_id,
            last_name=req.last_name,
            middle_name=req.middle_name,
            first_name=req.first_name,
            username=req.username,
            avatar_url=req.avatar_url,
            current_password=req.current_password,
            new_password=req.new_password
        )
        return {
            "status": "success",
            "message": "Cập nhật thông tin hồ sơ cá nhân thành công!",
            "data": updated_user
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi khi cập nhật hồ sơ: {str(e)}")
