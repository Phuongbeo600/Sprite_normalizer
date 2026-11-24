# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Xử lý chuỗi JSON, Biểu thức chính quy & Luồng)
# ========================================================
# json: Đóng gói dữ liệu chuỗi phản hồi theo định dạng SSE
import json
# re: Biểu thức chính quy che dấu thông tin khóa API nhạy cảm trong thông báo lỗi
import re
# logging: Ghi nhận nhật ký trạng thái kết nối máy khách
import logging
# typing: Khai báo kiểu trả về cho Generator, AsyncGenerator và từ điển tùy chọn
from typing import AsyncGenerator, Generator, Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# APIRouter, HTTPException, Depends, Request: Định nghĩa router và tiêm phụ thuộc phiên làm việc CSDL
from fastapi import APIRouter, HTTPException, Depends, Request
# StreamingResponse: Phản hồi luồng dữ liệu HTTP dạng text/event-stream
from fastapi.responses import StreamingResponse
# run_in_threadpool: Chạy các tác vụ I/O blocking trên ThreadPool, giải phóng Event Loop của FastAPI
from fastapi.concurrency import run_in_threadpool
# Session: Phiên làm việc CSDL MySQL
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Database, Services, Schemas & Factory)
# ========================================================
# get_db: Dependency mở phiên làm việc cơ sở dữ liệu
from backend.db import get_db
# get_current_user_optional, check_project_access: Kiểm soát quyền truy cập và bảo vệ API key dự án
from backend.core.dependencies import get_current_user_optional, check_project_access
# load_control: Kiểm soát tần suất Rate Limiting và giới hạn tải đồng thời Concurrency Limiter
from backend.core.load_control import (
    check_rate_limit,
    ai_chat_concurrency,
    RATE_LIMIT_AI_CHAT
)
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
logger = logging.getLogger(__name__)


def _redact_sensitive_info(text: str) -> str:
    """Loại bỏ hoặc che dấu API Key và thông tin nhạy cảm trong thông báo lỗi."""
    if not text:
        return ""
    # Che dấu chuỗi Google Gemini API Key (bắt đầu bằng AIza kèm ít nhất 16 ký tự an toàn)
    text = re.sub(r'AIza[0-9A-Za-z-_]{16,}', '[REDACTED_API_KEY]', text)
    # Che dấu chuỗi OpenAI API Key (bắt đầu bằng sk- kèm ít nhất 16 ký tự an toàn)
    text = re.sub(r'sk-[0-9A-Za-z-_]{16,}', '[REDACTED_API_KEY]', text)
    return text


@chat_router.post("/stream")
def stream_chat_endpoint(
    request: ChatStreamRequest,
    http_request: Request = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Endpoint phát luồng câu trả lời của AI theo chuẩn Server-Sent Events (SSE).
    Tự động hỗ trợ đa nhà cung cấp (Gemini, OpenAI, DeepSeek, Groq, Ollama) thông qua AiProviderFactory.
    
    TỐI ƯU VẬN HÀNH & KẾT NỐI ĐỒNG THỜI (TASK-08):
    - Kiểm tra Rate Limiting theo người dùng (20 req/phút).
    - Giới hạn số lượng phiên chat đồng thời bằng Semaphore (6 sessions / worker).
    - Kiểm tra quyền sở hữu dự án nếu request gửi kèm project_id.
    - Hoàn trả kết nối CSDL về Connection Pool ngay lập tức trước khi stream (0s giữ kết nối).
    - Sử dụng Async Generator kết hợp run_in_threadpool: Không block Event Loop của FastAPI.
    - Phát hiện ngắt kết nối sớm (Client Disconnection Detection): Dừng ngay tác vụ AI khi client đóng tab/hủy stream.
    - Bảo đảm giải phóng Semaphore 100% trong khối finally.

    @param request: Dữ liệu yêu cầu gồm lịch sử tin nhắn, mã dự án, provider, api_key và base_url tùy chọn.
    @param http_request: Yêu cầu HTTP để trích xuất IP/Header kiểm tra Rate Limit và phát hiện ngắt kết nối.
    @param current_user: Thông tin người dùng hiện tại để kiểm tra quyền truy cập.
    @param db: Phiên làm việc cơ sở dữ liệu MySQL để tra cứu cấu hình dự án.
    @returns: Luồng phản hồi trực tiếp dạng text/event-stream.
    """
    actual_user = current_user if isinstance(current_user, dict) else None
    if http_request is not None and hasattr(http_request, "headers"):
        check_rate_limit(http_request, scope="ai_chat", max_requests=RATE_LIMIT_AI_CHAT, current_user=actual_user)

    if request.project_id is not None:
        check_project_access(db, request.project_id, actual_user)

    if not ai_chat_concurrency.acquire():
        raise HTTPException(
            status_code=429,
            detail=f"Máy chủ đang phục vụ tối đa {ai_chat_concurrency.max_concurrent} phiên đối thoại AI đồng thời. Vui lòng thử lại sau ít giây!",
            headers={"Retry-After": "5"}
        )

    try:
        chunks = ChatService.prepare_stream(request, db)
        # TASK-06: Hoàn trả kết nối CSDL về Connection Pool ngay khi chuẩn bị xong luồng dữ liệu,
        # tránh chiếm giữ kết nối MySQL trong suốt thời gian client nhận SSE stream (10-30s).
        if hasattr(db, "close"):
            db.close()
    except ChatConfigurationError as error:
        ai_chat_concurrency.release()
        raise HTTPException(status_code=error.status_code, detail=error.detail) from error
    except Exception:
        ai_chat_concurrency.release()
        raise

    # Biểu tượng đánh dấu kết thúc luồng đồng bộ từ Provider
    _SENTINEL = object()
    sync_iter = iter(chunks)

    def _get_next_chunk():
        """Đọc token tiếp theo từ luồng Provider trên ThreadPool, tránh block Event Loop."""
        try:
            return next(sync_iter)
        except StopIteration:
            return _SENTINEL

    async def event_generator() -> AsyncGenerator[str, None]:
        """
        Máy phát bất đồng bộ đóng gói từng token thành khung sự kiện chuẩn Server-Sent Events.
        Tự động phát hiện khi client đóng tab hoặc hủy kết nối để ngừng stream ngay lập tức.
        """
        try:
            while True:
                # 1. Phát hiện sớm trường hợp client ngắt kết nối (đóng tab, chuyển trang, hủy request)
                if http_request is not None and hasattr(http_request, "is_disconnected"):
                    if await http_request.is_disconnected():
                        logger.info("[Chat SSE] Phát hiện Client đã ngắt kết nối; dừng phát luồng và thu hồi tài nguyên.")
                        break

                # 2. Đọc token từ requests trên ThreadPool, không block Event Loop của FastAPI
                chunk_text = await run_in_threadpool(_get_next_chunk)
                if chunk_text is _SENTINEL:
                    break

                payload = json.dumps({"text": chunk_text}, ensure_ascii=False)
                yield f"data: {payload}\n\n"

            # Phát tín hiệu hoàn tất toàn bộ câu trả lời
            yield "data: [DONE]\n\n"
        except Exception as e:
            clean_err = _redact_sensitive_info(str(e))
            logger.warning(f"[Chat SSE] Lỗi trong quá trình phát luồng: {clean_err}")
            error_payload = json.dumps({"error": clean_err}, ensure_ascii=False)
            yield f"data: {error_payload}\n\n"
            yield "data: [DONE]\n\n"
        finally:
            # Luôn giải phóng Semaphore cho người dùng khác trong mọi tình huống (kể cả ngắt kết nối giữa chừng)
            ai_chat_concurrency.release()
            if hasattr(chunks, "close"):
                try:
                    chunks.close()
                except Exception:
                    pass

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
