# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Xử lý chuỗi JSON & Luồng)
# ========================================================
# json: Đóng gói dữ liệu chuỗi phản hồi theo định dạng SSE
import json
# typing: Khai báo kiểu trả về cho Generator
from typing import Generator

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# APIRouter, HTTPException, Depends: Định nghĩa router và tiêm phụ thuộc phiên làm việc CSDL
from fastapi import APIRouter, HTTPException, Depends
# StreamingResponse: Phản hồi luồng dữ liệu HTTP dạng text/event-stream
from fastapi.responses import StreamingResponse
# Session: Phiên làm việc CSDL MySQL
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Database, Services, Schemas & Factory)
# ========================================================
# get_db: Dependency mở phiên làm việc cơ sở dữ liệu
from backend.db import get_db
# AiCredentialsService: Phân giải thông tin xác thực AI (3 cấp ưu tiên)
from backend.services.ai_credentials_service import AiCredentialsService
# AiProviderFactory: Khởi tạo nhà cung cấp AI theo Strategy/Factory Pattern
from backend.providers.factory import AiProviderFactory
# ChatStreamRequest: Schema kiểm tra dữ liệu yêu cầu hội thoại
from backend.schemas.chat import ChatStreamRequest
# ChatService: Chuẩn bị cấu hình và nội dung hội thoại.
from backend.services.chat_service import ChatService, ChatConfigurationError, SYSTEM_ASSISTANT_PROMPT

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

chat_router = APIRouter(prefix="/chat", tags=["AI Chatbot"])



@chat_router.post("/stream")
def stream_chat_endpoint(
    request: ChatStreamRequest,
    db: Session = Depends(get_db)
):
    """
    Endpoint phát luồng câu trả lời của AI theo chuẩn Server-Sent Events (SSE).
    Tự động hỗ trợ đa nhà cung cấp (Gemini, OpenAI, DeepSeek, Groq, Ollama) thông qua AiProviderFactory.

    @param request: Dữ liệu yêu cầu gồm lịch sử tin nhắn, mã dự án, provider, api_key và base_url tùy chọn.
    @param db: Phiên làm việc cơ sở dữ liệu MySQL để tra cứu cấu hình dự án.
    @returns: Luồng phản hồi trực tiếp dạng text/event-stream.
    """
    try:
        chunks = ChatService.prepare_stream(request, db)
    except ChatConfigurationError as error:
        raise HTTPException(status_code=error.status_code, detail=error.detail) from error

    def event_generator() -> Generator[str, None, None]:
        """Máy phát đóng gói từng token thành khung sự kiện chuẩn Server-Sent Events."""
        try:
            for chunk_text in chunks:
                payload = json.dumps({"text": chunk_text}, ensure_ascii=False)
                yield f"data: {payload}\n\n"

            # Phát tín hiệu hoàn tất toàn bộ câu trả lời
            yield "data: [DONE]\n\n"
        except Exception as e:
            error_payload = json.dumps({"error": str(e)}, ensure_ascii=False)
            yield f"data: {error_payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream; charset=utf-8",
            "X-Accel-Buffering": "no"
        }
    )
