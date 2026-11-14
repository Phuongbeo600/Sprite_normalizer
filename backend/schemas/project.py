# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa các kiểu danh sách, tùy chọn giá trị
from typing import List, Optional, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Kiểm tra tính hợp lệ dữ liệu gửi lên và phản hồi
from pydantic import BaseModel, Field

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class ProjectCreateRequest(BaseModel):
    """Schema dữ liệu tạo dự án mới."""
    name: str = Field(..., min_length=1, max_length=255, description="Tên dự án sprite")


class ProjectItem(BaseModel):
    """Schema chi tiết từng dự án."""
    id: int
    name: str
    created_at: Optional[Any] = None


class ProjectListResponse(BaseModel):
    """Schema phản hồi danh sách các dự án."""
    status: str = "success"
    data: List[ProjectItem]
