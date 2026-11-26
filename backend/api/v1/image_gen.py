# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Luồng JSON)
# ========================================================
# json: Đóng gói từng mảnh dữ liệu SSE gửi về trình duyệt
import json
# typing: Định nghĩa các kiểu từ điển, bộ phát bất đồng bộ và giá trị tùy chọn
from typing import AsyncGenerator, Dict, Any, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# fastapi: Khởi tạo router, xử lý ngoại lệ HTTP, Dependency Injection, Request, StreamingResponse và ThreadPool
from fastapi import APIRouter, HTTPException, Query, Depends, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
# sqlalchemy: Phiên làm việc cơ sở dữ liệu
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services & Schemas)
# ========================================================
# get_db: Dependency cấp phiên MySQL
from backend.db import get_db
# get_current_user_optional, check_project_access: Kiểm soát quyền truy cập và bảo vệ API key dự án
from backend.core.dependencies import get_current_user_optional, check_project_access
# load_control: Kiểm soát tần suất Rate Limiting và giới hạn tải đồng thời Concurrency Limiter
from backend.core.load_control import (
    check_rate_limit,
    ai_gen_concurrency,
    ai_chat_concurrency,
    RATE_LIMIT_AI_GEN,
    RATE_LIMIT_AI_CHAT,
)
# Schemas: DTO kiểm tra dữ liệu yêu cầu và phản hồi sinh ảnh / gợi ý AI Local
from backend.schemas.image_gen import (
    ImageGenRequest,
    ImageGenResponse,
    LocalEnhancerStatusResponse,
    PromptEnhanceRequest,
)
# ImageGenService: Dịch vụ tích hợp tạo ảnh AI qua Gemini Imagen 3 hoặc OpenAI DALL-E 3
from backend.services.image_gen_service import ImageGenService
# LocalPromptEnhancerService: Dịch vụ bật/tắt llama-server cổng 8080 và phát luồng gợi ý prompt
from backend.services.local_prompt_enhancer_service import LocalPromptEnhancerService
from backend.providers.image_gen.base import ImageGenRequestError, ImageGenUpstreamError

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

image_gen_router = APIRouter(prefix="/image-gen", tags=["AI Image Generator"])


@image_gen_router.get("/status")
def get_image_gen_status(
    project_id: Optional[int] = Query(None, description="Mã dự án để kiểm tra khóa API"),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Kiểm tra trạng thái cấu hình nhà cung cấp và khóa API hiện hành (có kiểm tra quyền sở hữu nếu truyền project_id).
    Hàm này chỉ đọc cấu hình bộ nhớ/CSDL, hoàn toàn KHÔNG gọi ra ngoài nên tiêu tốn 0 token.
    """
    if project_id is not None:
        check_project_access(db, project_id, current_user)
    try:
        return ImageGenService.get_status(project_id=project_id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Không thể kiểm tra cấu hình tạo ảnh: {str(e)}")


@image_gen_router.post("/generate", response_model=ImageGenResponse)
def generate_image(
    request: ImageGenRequest,
    http_request: Request = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Tạo ảnh nhân vật / sprite bằng mô hình AI (Google Imagen 3 hoặc OpenAI DALL-E 3).
    Sử dụng hàm đồng bộ (def) để FastAPI tự động chuyển giao tác vụ gọi mạng HTTP kéo dài
    vào Starlette ThreadPool, giải phóng hoàn toàn Event Loop cho các người dùng khác.
    RÀNG BUỘC BẢO MẬT & KIỂM SOÁT TẢI:
    - Kiểm tra Rate Limiting theo người dùng (10 req/phút).
    - Giới hạn số lượng tác vụ tạo ảnh đồng thời bằng Semaphore (3 tasks).
    - Nếu truyền project_id, bắt buộc phải kiểm tra quyền sở hữu dự án để tránh dùng chùa API key.
    """
    if http_request is not None and hasattr(http_request, "headers"):
        check_rate_limit(http_request, scope="ai_gen", max_requests=RATE_LIMIT_AI_GEN, current_user=current_user)

    if request.project_id is not None:
        check_project_access(db, request.project_id, current_user)
        # Hoàn trả kết nối CSDL về Connection Pool ngay khi kiểm tra xong quyền sở hữu,
        # tránh chiếm giữ kết nối MySQL trong lúc chờ API AI tạo ảnh (5-15 giây)
        if hasattr(db, "close"):
            db.close()
    try:
        with ai_gen_concurrency:
            response = ImageGenService.generate_images(request)
        if request.project_id is not None:
            ImageGenService.save_generated_images(request, response)
        return response
    except HTTPException:
        raise
    except (ImageGenRequestError, ImageGenUpstreamError) as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error
    except ValueError as ve:
        # Lỗi người dùng (thiếu key, vi phạm chính sách prompt, tham số không hợp lệ)
        raise HTTPException(status_code=400, detail=str(ve))
    except RuntimeError as re:
        # Lỗi kết nối hoặc lỗi dịch vụ từ nhà cung cấp
        raise HTTPException(status_code=502, detail=str(re))
    except Exception as e:
        # Lỗi hệ thống bất ngờ
        raise HTTPException(status_code=500, detail=f"Lỗi không xác định khi tạo ảnh: {str(e)}")


@image_gen_router.get("/local-enhancer/status", response_model=LocalEnhancerStatusResponse)
def get_local_enhancer_status():
    """Kiểm tra trạng thái bật/tắt/nạp mô hình của AI Local trên cổng 8080 (không tốn tài nguyên)."""
    try:
        return LocalPromptEnhancerService.get_status()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Không thể kiểm tra AI Local: {str(exc)}") from exc


@image_gen_router.post("/local-enhancer/start", response_model=LocalEnhancerStatusResponse)
def start_local_enhancer():
    """Khởi chạy máy chủ llama-server.exe nạp mô hình PromptEnhancer 7B vào RAM."""
    try:
        return LocalPromptEnhancerService.start()
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Không thể bật AI Local: {str(exc)}") from exc


@image_gen_router.post("/local-enhancer/stop", response_model=LocalEnhancerStatusResponse)
def stop_local_enhancer():
    """Tắt tiến trình AI Local do Backend quản lý để giải phóng ngay RAM."""
    try:
        return LocalPromptEnhancerService.stop()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Không thể tắt AI Local: {str(exc)}") from exc


def _sse_event(payload: Dict[str, Any]) -> str:
    """Đóng gói từ điển JSON thành một khung sự kiện chuẩn Server-Sent Events."""
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@image_gen_router.post("/enhance-prompt/stream")
def stream_enhance_prompt_endpoint(
    request: PromptEnhanceRequest,
    http_request: Request = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """
    Phát luồng gợi ý nâng cao mô tả nhân vật từ AI Local (cổng 8080) theo chuẩn SSE.
    Nếu cổng 8080 chưa bật và `auto_start=True`, tự động phát trạng thái nạp model rồi stream ngay.
    """
    actual_user = current_user if isinstance(current_user, dict) else None
    if http_request is not None and hasattr(http_request, "headers"):
        check_rate_limit(http_request, scope="local_ai_enhance", max_requests=RATE_LIMIT_AI_CHAT, current_user=actual_user)

    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Vui lòng nhập mô tả nhân vật trước khi nhờ AI Local gợi ý.")

    if not ai_chat_concurrency.acquire():
        raise HTTPException(
            status_code=429,
            detail="Hệ thống đang xử lý tối đa số luồng AI đồng thời. Vui lòng thử lại sau ít giây!",
            headers={"Retry-After": "5"},
        )

    _sentinel = object()

    async def event_generator() -> AsyncGenerator[str, None]:
        """Đọc luồng token từ AI Local trên ThreadPool và đẩy về trình duyệt qua SSE."""
        sync_iter = None
        try:
            current_status = await run_in_threadpool(LocalPromptEnhancerService.get_status)
            if not current_status.get("ready"):
                if not request.auto_start:
                    yield _sse_event({"error": "AI Local trên cổng 8080 đang tắt. Hãy bật công tắc AI Local trước."})
                    yield "data: [DONE]\n\n"
                    return
                yield _sse_event({"status": "loading_model", "message": "Đang bật AI Local và nạp mô hình 4.3 GB vào RAM..."})
                await run_in_threadpool(LocalPromptEnhancerService.start)

            if http_request is not None and hasattr(http_request, "is_disconnected") and await http_request.is_disconnected():
                return

            yield _sse_event({"status": "streaming", "message": "AI Local đang viết gợi ý..."})
            sync_iter = await run_in_threadpool(
                LocalPromptEnhancerService.stream_enhance_prompt,
                request.prompt,
                request.style_preset,
                False,
            )

            while True:
                if http_request is not None and hasattr(http_request, "is_disconnected") and await http_request.is_disconnected():
                    break
                chunk_text = await run_in_threadpool(lambda: next(sync_iter, _sentinel))
                if chunk_text is _sentinel:
                    break
                yield _sse_event({"text": chunk_text})

            yield "data: [DONE]\n\n"
        except Exception as exc:
            yield _sse_event({"error": str(exc)})
            yield "data: [DONE]\n\n"
        finally:
            ai_chat_concurrency.release()
            if sync_iter is not None and hasattr(sync_iter, "close"):
                try:
                    sync_iter.close()
                except Exception:
                    pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream; charset=utf-8",
            "X-Accel-Buffering": "no",
        },
    )
