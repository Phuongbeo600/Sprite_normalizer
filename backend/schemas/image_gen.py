# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa các kiểu danh sách, từ điển và giá trị tùy chọn
from typing import Dict, Any, List, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Kiểm tra tính hợp lệ dữ liệu yêu cầu và phản hồi sinh ảnh AI
from pydantic import BaseModel, Field

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class GeneratedImageItem(BaseModel):
    """Mô tả một tệp ảnh được sinh ra từ mô hình AI."""
    id: str = Field(..., description="Mã định danh duy nhất của ảnh")
    b64_data: str = Field(..., description="Dữ liệu ảnh mã hóa chuỗi Base64")
    mime_type: str = Field("image/png", description="Định dạng MIME của ảnh")
    data_url: str = Field(..., description="Chuỗi Data URL (data:image/png;base64,...) dùng hiển thị ngay trên thẻ img")
    aspect_ratio: str = Field("1:1", description="Tỉ lệ khung hình đã chọn")


class ImageGenRequest(BaseModel):
    """
    Schema yêu cầu sinh ảnh AI từ văn bản prompt.
    Tự động liên kết khóa API từ Cài đặt dự án hoặc Cài đặt hệ thống.
    """
    prompt: str = Field(..., description="Văn bản mô tả nhân vật / sprite cần sinh")
    negative_prompt: Optional[str] = Field(None, description="Các chi tiết cần loại trừ (nếu mô hình hỗ trợ)")
    project_id: Optional[int] = Field(None, description="Mã dự án để tự động trích xuất API Key trong MySQL")
    aspect_ratio: str = Field("1:1", description="Tỉ lệ khung hình mong muốn: 1:1, 3:4, 4:3, 16:9")
    number_of_images: int = Field(1, ge=1, le=4, description="Số lượng ảnh cần sinh (từ 1 đến 4)")
    style_preset: Optional[str] = Field(None, description="Thẻ phong cách định sẵn (Pixel Art, Sprite Sheet, Chibi...)")
    provider: Optional[str] = Field(None, description="Ghi đè nhà cung cấp ('gemini' hoặc 'openai')")
    api_key: Optional[str] = Field(None, description="Ghi đè khóa API nếu người dùng truyền trực tiếp")
    base_url: Optional[str] = Field(None, description="Ghi đè máy chủ proxy nếu dùng OpenAI")


class ImageGenResponse(BaseModel):
    """Schema phản hồi kết quả sinh ảnh AI."""
    status: str = Field("success", description="Trạng thái thực thi ('success' hoặc 'error')")
    message: str = Field("Sinh ảnh AI thành công!", description="Thông điệp phản hồi cho người dùng")
    provider_used: str = Field(..., description="Nhà cung cấp đã phục vụ yêu cầu: 'gemini' hoặc 'openai'")
    model_used: str = Field(..., description="Tên mô hình AI đã thực thi (vd: imagen-3.0-generate-002, dall-e-3)")
    images: List[GeneratedImageItem] = Field(default_factory=list, description="Danh sách các ảnh đã được tạo")
