# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa các kiểu từ điển và tùy chọn giá trị
from typing import Dict, Any, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Kiểm tra tính hợp lệ dữ liệu yêu cầu tạo prompt
from pydantic import BaseModel, Field

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class PromptAdviceRequest(BaseModel):
    """Schema dữ liệu yêu cầu Cố vấn Prompt AI & Toán học nghịch đảo."""
    metrics: Dict[str, Any] = Field(..., description="Dữ liệu đo đạc giải phẫu từ nhân vật mẫu")
    character_concept: str = Field("Chiến binh Pixel Art dũng mãnh", description="Ý tưởng nhân vật mới")
    head_rule: str = Field("Bằng nhân vật gốc (Tỷ lệ chuẩn)", description="Quy tắc kích thước đầu")
    body_width_rule: str = Field("Bằng nhân vật gốc", description="Quy tắc bề ngang thân")
    body_height_rule: str = Field("Bằng nhân vật gốc", description="Quy tắc chiều cao thân")
    api_key: Optional[str] = Field(None, description="Khóa API tùy chọn gửi kèm")
    provider: Optional[str] = Field(None, description="Nhà cung cấp AI tùy chọn ('gemini' hoặc 'openai')")
    base_url: Optional[str] = Field(None, description="Đường dẫn máy chủ proxy tùy chọn")
