"""
Module: backend.schemas.offline_chat
Mục đích: Khai báo lược đồ dữ liệu (Pydantic v2) cho phân hệ Chatbot RAG Offline độc lập.
Ai gọi nó: `backend.api.v1.offline_chat` và `backend.services.offline_chat.offline_chat_service`.
Tại sao tồn tại: Tách biệt hoàn toàn hợp đồng dữ liệu Offline RAG khỏi Chat API cũ.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểu dữ liệu)
# ========================================================
from typing import List, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Kiểm tra dữ liệu đầu vào/đầu ra và giới hạn độ dài an toàn
from pydantic import BaseModel, Field

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không phụ thuộc tầng khác)

# ========================================================
# 4. CẤU HÌNH & HẰNG SỐ HỆ THỐNG (Config)
# ========================================================
# (Không áp dụng)


class OfflineChatStreamRequest(BaseModel):
    """Yêu cầu hỏi đáp RAG Offline phát luồng SSE gắn với lịch sử hội thoại trên DB."""

    session_id: Optional[int] = Field(
        None,
        ge=1,
        description="ID cuộc trò chuyện cũ, để trống khi bắt đầu cuộc trò chuyện mới",
    )
    message: str = Field(..., min_length=1, max_length=4000, description="Câu hỏi hiện tại của người dùng")
    request_id: str = Field(
        ...,
        min_length=4,
        max_length=64,
        description="Định danh duy nhất của lượt gửi để chống lưu trùng khi thử lại",
    )
    top_k: Optional[int] = Field(None, ge=1, le=8, description="Số đoạn tài liệu tối đa cần truy xuất")
    similarity_threshold: Optional[float] = Field(
        None,
        ge=0.0,
        le=1.0,
        description="Ngưỡng tương đồng Cosine tối thiểu để giữ lại đoạn tài liệu",
    )


class OfflineSessionRenameRequest(BaseModel):
    """Yêu cầu đổi tiêu đề cuộc trò chuyện RAG Offline."""

    title: str = Field(..., min_length=1, max_length=120, description="Tiêu đề mới của cuộc trò chuyện")


class OfflineReindexRequest(BaseModel):
    """Yêu cầu đồng bộ tăng dần hoặc xây dựng lại toàn bộ chỉ mục tri thức."""

    force_rebuild: bool = Field(False, description="True để xóa chỉ mục cũ và nhúng lại toàn bộ tài liệu")


class OfflineSourceItem(BaseModel):
    """Thông tin trích dẫn nguồn tài liệu đã được đưa vào ngữ cảnh trả lời."""

    chunk_id: str = Field(..., description="Mã định danh chunk")
    doc_path: str = Field(..., description="Đường dẫn tương đối của tài liệu nguồn")
    title: str = Field(..., description="Tiêu đề mục tài liệu")
    score: float = Field(..., description="Điểm tương đồng Cosine với truy vấn")
