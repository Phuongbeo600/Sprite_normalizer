# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa các kiểu tùy chọn giá trị
from typing import Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Kiểm tra tính hợp lệ dữ liệu cấu hình
from pydantic import BaseModel, Field

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class SettingsResponse(BaseModel):
    """Schema dữ liệu trả về thông tin cấu hình hiện tại của hệ thống."""
    status: str = "success"
    provider: str
    gemini_masked_key: str
    openai_masked_key: str
    openai_base_url: str


class SettingsUpdateRequest(BaseModel):
    """Schema dữ liệu cập nhật cài đặt API Key & Nhà cung cấp."""
    provider: str = Field(..., description="Nhà cung cấp AI ('gemini' hoặc 'openai')")
    gemini_api_key: Optional[str] = Field(None, description="Khóa Google Gemini API mới")
    openai_api_key: Optional[str] = Field(None, description="Khóa OpenAI API mới")
    openai_base_url: Optional[str] = Field(None, description="Đường dẫn máy chủ OpenAI Proxy")


class TestApiKeyRequest(BaseModel):
    """Schema kiểm tra kết nối API Key."""
    provider: str = Field(..., description="Nhà cung cấp cần kiểm tra ('gemini' hoặc 'openai')")
    api_key: Optional[str] = Field(None, description="Khóa API truyền lên để kiểm tra")
    base_url: Optional[str] = Field(None, description="Đường dẫn máy chủ proxy tùy chọn")
