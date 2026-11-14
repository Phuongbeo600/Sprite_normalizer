# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc & Kiểu)
# ========================================================
# typing: Khai báo kiểu từ điển và tùy chọn
from typing import Dict, Any, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# fastapi: Khởi tạo router, xử lý lỗi HTTP và Dependency Injection
from fastapi import APIRouter, Depends, HTTPException, Body
# pydantic: Định nghĩa Schema kiểm tra tính hợp lệ dữ liệu
from pydantic import BaseModel, Field
# sqlalchemy: Phiên làm việc cơ sở dữ liệu
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services & Database)
# ========================================================
# get_db: Dependency cấp phiên MySQL
from backend.db import get_db
# UserService: Dịch vụ nghiệp vụ xác thực và người dùng
from backend.services.user_service import UserService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

auth_router = APIRouter(prefix="/auth", tags=["Xác thực & Tài khoản"])
user_service = UserService()


class LoginRequest(BaseModel):
    """Schema yêu cầu đăng nhập tài khoản."""
    username: str = Field(..., description="Tên tài khoản hoặc địa chỉ Gmail")
    password: str = Field(..., description="Mật khẩu")


class RegisterRequest(BaseModel):
    """Schema yêu cầu đăng ký tài khoản mới có Họ, Tên đệm, Tên và Gmail."""
    username: str = Field(..., description="Tên tài khoản định dạng Gmail")
    password: str = Field(..., description="Mật khẩu")
    last_name: Optional[str] = Field(None, description="Họ của người dùng")
    middle_name: Optional[str] = Field(None, description="Tên đệm")
    first_name: Optional[str] = Field(None, description="Tên chính")


class UpdateProfileRequest(BaseModel):
    """Schema cập nhật hồ sơ cá nhân và đổi mật khẩu."""
    user_id: int = Field(..., description="Mã ID tài khoản")
    last_name: Optional[str] = Field(None, description="Họ mới")
    middle_name: Optional[str] = Field(None, description="Tên đệm mới")
    first_name: Optional[str] = Field(None, description="Tên mới")
    username: Optional[str] = Field(None, description="Gmail tài khoản mới")
    avatar_url: Optional[str] = Field(None, description="Ảnh đại diện Base64")
    current_password: Optional[str] = Field(None, description="Mật khẩu cũ (nếu muốn đổi mật khẩu)")
    new_password: Optional[str] = Field(None, description="Mật khẩu mới")


@auth_router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """
    Xác thực thông tin đăng nhập của người dùng hoặc Admin:
    - Admin: username = 'admin', password = '1'
    - User thường: tài khoản Gmail đã đăng ký trong hệ thống
    """
    try:
        user_info = user_service.authenticate(db, req.username, req.password)
        return {
            "status": "success",
            "message": "Đăng nhập thành công!",
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
            "data": created_user
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi đăng ký tài khoản: {str(e)}")


@auth_router.put("/profile")
def update_profile(req: UpdateProfileRequest, db: Session = Depends(get_db)):
    """
    Cập nhật thông tin cá nhân: Đổi ảnh đại diện, sửa họ tên, đổi Gmail hoặc đổi mật khẩu.
    """
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
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Lỗi khi cập nhật hồ sơ: {str(e)}")
