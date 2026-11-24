# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa danh sách, từ điển và kiểu tùy chọn
from typing import List, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Kiểm tra tính hợp lệ dữ liệu yêu cầu hội thoại phát luồng
from pydantic import BaseModel, Field

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class ChatMessageItem(BaseModel):
    """Mô hình dữ liệu của một tin nhắn đơn lẻ trong chuỗi hội thoại."""
    role: str = Field(..., description="Vai trò của người gửi: 'user' hoặc 'assistant'")
    content: str = Field(..., description="Nội dung văn bản của tin nhắn")


class ChatStreamRequest(BaseModel):
    """Mô hình dữ liệu gửi lên endpoint phát luồng hội thoại AI đa nhà cung cấp."""
    messages: List[ChatMessageItem] = Field(..., description="Lịch sử các tin nhắn hội thoại")
    project_id: Optional[int] = Field(None, description="Mã định danh dự án trong CSDL (nếu có)")
    provider: Optional[str] = Field(None, description="Tên nhà cung cấp AI ('gemini', 'openai', 'deepseek', v.v.)")
    api_key: Optional[str] = Field(None, description="Khóa API truyền trực tiếp từ client (tùy chọn)")
    base_url: Optional[str] = Field(None, description="Địa chỉ máy chủ tùy biến (áp dụng cho OpenAI/Proxy/Local Ollama)")
    model: Optional[str] = Field(None, description="Mô hình AI chỉ định cho hội thoại (tùy chọn)")
