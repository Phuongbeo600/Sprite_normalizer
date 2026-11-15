# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa các kiểu tùy chọn giá trị
from typing import Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Kiểm tra tính hợp lệ dữ liệu xác thực và người dùng
from pydantic import BaseModel, Field

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


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
