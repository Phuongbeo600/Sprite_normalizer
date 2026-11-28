"""
Module: backend.api.v1.offline_chat
Mục đích: Cung cấp bộ endpoint FastAPI độc lập cho Chatbot RAG Offline & Lịch sử hội thoại (/api/offline-chat/*).
Ai gọi nó: `backend.api.router` và giao diện `OfflineChatWidget.jsx`.
Tại sao tồn tại: Cô lập hoàn toàn tuyến API, xác thực JWT và CRUD phiên hội thoại RAG Offline khỏi Chat API cũ.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểu dữ liệu & Callable)
# ========================================================
from typing import Any, Callable, Dict, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# fastapi: Router, kiểm tra Header JWT, Query phân trang và thực thi trên ThreadPool
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Core, DB, Repositories, SSE & Services)
# ========================================================
from backend.api.v1.offline_chat_stream import build_offline_chat_sse_response, replay_saved_turn_sse
from backend.core.dependencies import get_current_user_optional
from backend.core.load_control import RATE_LIMIT_AI_CHAT, ai_chat_concurrency, check_rate_limit
from backend.core.security import decode_access_token
from backend.db import SessionLocal
from backend.repositories.offline_chat_repository import (
    OfflineChatConflictError,
    OfflineChatForbiddenError,
    OfflineChatNotFoundError,
)
from backend.repositories.user_repository import UserRepository
from backend.schemas.offline_chat import (
    OfflineChatStreamRequest,
    OfflineReindexRequest,
    OfflineSessionRenameRequest,
)
from backend.services.ai_runtime_manager import AiRuntimeManager
from backend.services.offline_chat.offline_chat_service import OfflineChatService

# ========================================================
# 4. CẤU HÌNH & HẰNG SỐ HỆ THỐNG
# ========================================================
offline_chat_router = APIRouter(prefix="/offline-chat", tags=["Offline RAG Chatbot"])


def _get_service() -> OfflineChatService:
    """Khởi tạo service điều phối theo cấu hình kho tri thức hiện hành."""
    return OfflineChatService()


def _get_db_factory() -> Callable[[], Session]:
    """Trả về factory mở phiên CSDL ngắn, tách riêng để kiểm thử dễ thay thế."""
    return SessionLocal


def _require_jwt_user(authorization: Optional[str] = Header(default=None)) -> Dict[str, Any]:
    """
    Xác thực người dùng chỉ qua JWT Bearer từ Backend, tuyệt đối không tin `user_id` từ Frontend.

    @param {Optional[str]} authorization Header Authorization dạng `Bearer <token>`.
    @returns {Dict[str, Any]} Bản ghi tài khoản hợp lệ đã xác thực.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Vui lòng đăng nhập để sử dụng lịch sử Chatbot Offline.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization[7:].strip()
    payload = decode_access_token(token)
    user_id = payload.get("sub") if isinstance(payload, dict) else None
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    db = _get_db_factory()()
    try:
        user = UserRepository().get_by_id(db, int(user_id))
    finally:
        db.close()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tài khoản không tồn tại hoặc đã bị thu hồi.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def _raise_domain_http_error(exc: Exception) -> None:
    """Chuyển đổi ngoại lệ miền của Offline Chat sang mã HTTP tương ứng."""
    if isinstance(exc, OfflineChatNotFoundError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if isinstance(exc, OfflineChatForbiddenError):
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if isinstance(exc, OfflineChatConflictError):
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if isinstance(exc, ValueError):
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    raise HTTPException(status_code=500, detail=str(exc)) from exc


@offline_chat_router.get("/status")
async def get_offline_chat_status():
    """Trả về trạng thái mô hình AI Local (RAM, cổng) và thông tin chỉ mục tri thức RAG."""
    service = _get_service()
    return await run_in_threadpool(service.get_full_status)


@offline_chat_router.post("/model/start")
async def start_offline_chat_model(
    http_request: Request = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """Nạp trước mô hình Qwen3.5-4B vào RAM theo nhu cầu người dùng."""
    actual_user = current_user if isinstance(current_user, dict) else None
    if http_request is not None and hasattr(http_request, "headers"):
        check_rate_limit(http_request, scope="offline_rag_control", max_requests=RATE_LIMIT_AI_CHAT, current_user=actual_user)
    try:
        slot_status = await run_in_threadpool(AiRuntimeManager.ensure_started, "qwen_chat")
        return {"status": "success", "slot": slot_status, "runtime": AiRuntimeManager.get_all_status()}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except MemoryError as exc:
        raise HTTPException(status_code=507, detail=str(exc)) from exc
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@offline_chat_router.post("/model/stop")
async def stop_offline_chat_model(
    http_request: Request = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """Giải phóng các mô hình RAG Offline khỏi RAM khi người dùng tắt chủ động."""
    actual_user = current_user if isinstance(current_user, dict) else None
    if http_request is not None and hasattr(http_request, "headers"):
        check_rate_limit(http_request, scope="offline_rag_control", max_requests=RATE_LIMIT_AI_CHAT, current_user=actual_user)
    try:
        qwen = await run_in_threadpool(AiRuntimeManager.stop_slot, "qwen_chat", False)
        bge = await run_in_threadpool(AiRuntimeManager.stop_slot, "bge_m3_embedding", False)
        return {"status": "success", "slots": {"qwen_chat": qwen, "bge_m3_embedding": bge}, "runtime": AiRuntimeManager.get_all_status()}
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@offline_chat_router.post("/knowledge/reindex")
async def reindex_offline_knowledge(
    request: OfflineReindexRequest,
    http_request: Request = None,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
):
    """Đồng bộ tăng dần (hoặc xây dựng lại) chỉ mục vector NPZ + JSON từ `docs/knowledge/`."""
    actual_user = current_user if isinstance(current_user, dict) else None
    if http_request is not None and hasattr(http_request, "headers"):
        check_rate_limit(http_request, scope="offline_rag_reindex", max_requests=RATE_LIMIT_AI_CHAT, current_user=actual_user)
    try:
        service = _get_service()
        summary = await run_in_threadpool(service.rag_service.reindex_knowledge, request.force_rebuild)
        return {"status": "success", "sync": summary, "knowledge": await run_in_threadpool(service.rag_service.get_knowledge_status)}
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except MemoryError as exc:
        raise HTTPException(status_code=507, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@offline_chat_router.get("/sessions")
async def list_offline_sessions(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: Dict[str, Any] = Depends(_require_jwt_user),
):
    """Lấy danh sách các cuộc trò chuyện thuộc quyền sở hữu của người dùng hiện tại."""
    service = _get_service()
    db = _get_db_factory()()
    try:
        return service.list_sessions(db, user_id=current_user["id"], limit=limit, offset=offset)
    finally:
        db.close()


@offline_chat_router.get("/sessions/{session_id}")
async def get_offline_session_detail(
    session_id: int,
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: Dict[str, Any] = Depends(_require_jwt_user),
):
    """Khôi phục nội dung tin nhắn và nguồn RAG đã lưu của một cuộc trò chuyện."""
    service = _get_service()
    db = _get_db_factory()()
    try:
        return service.get_session_detail(db, session_id=session_id, user_id=current_user["id"], limit=limit, offset=offset)
    except Exception as exc:
        _raise_domain_http_error(exc)
    finally:
        db.close()


@offline_chat_router.patch("/sessions/{session_id}")
async def rename_offline_session(
    session_id: int,
    request: OfflineSessionRenameRequest,
    current_user: Dict[str, Any] = Depends(_require_jwt_user),
):
    """Đổi tên một cuộc trò chuyện thuộc quyền sở hữu của người dùng hiện tại."""
    service = _get_service()
    db = _get_db_factory()()
    try:
        updated = service.rename_session(db, session_id=session_id, user_id=current_user["id"], title=request.title)
        return {"session": updated}
    except Exception as exc:
        db.rollback()
        _raise_domain_http_error(exc)
    finally:
        db.close()


@offline_chat_router.delete("/sessions/{session_id}")
async def delete_offline_session(
    session_id: int,
    current_user: Dict[str, Any] = Depends(_require_jwt_user),
):
    """Xóa một cuộc trò chuyện và toàn bộ tin nhắn liên quan theo đúng chủ sở hữu."""
    service = _get_service()
    db = _get_db_factory()()
    try:
        service.delete_session(db, session_id=session_id, user_id=current_user["id"])
        return {"status": "deleted", "session_id": session_id}
    except Exception as exc:
        db.rollback()
        _raise_domain_http_error(exc)
    finally:
        db.close()


@offline_chat_router.post("/stream")
async def stream_offline_rag_chat(
    request: OfflineChatStreamRequest,
    http_request: Request = None,
    current_user: Dict[str, Any] = Depends(_require_jwt_user),
):
    """Lưu lượt hỏi vào DB (giao dịch ngắn 1), chạy RAG + Qwen SSE (không giữ DB) và chốt kết quả."""
    if http_request is not None and hasattr(http_request, "headers"):
        check_rate_limit(http_request, scope="offline_rag_chat", max_requests=RATE_LIMIT_AI_CHAT, current_user=current_user)

    clean_message = (request.message or "").strip()
    clean_request_id = (request.request_id or "").strip()
    if not clean_message:
        raise HTTPException(status_code=400, detail="Vui lòng nhập câu hỏi trước khi gửi.")
    if not clean_request_id:
        raise HTTPException(status_code=400, detail="Thiếu request_id hợp lệ.")

    if not ai_chat_concurrency.acquire():
        raise HTTPException(
            status_code=429,
            detail="Hệ thống AI Local đang xử lý yêu cầu khác. Vui lòng thử lại sau ít giây!",
            headers={"Retry-After": "5"},
        )

    service = _get_service()
    db_factory = _get_db_factory()
    user_id = int(current_user["id"])

    try:
        db = db_factory()
        try:
            turn = service.prepare_conversation_turn(
                db=db,
                user_id=user_id,
                session_id=request.session_id,
                message=clean_message,
                request_id=clean_request_id,
            )
        finally:
            db.close()
    except Exception as exc:
        ai_chat_concurrency.release()
        _raise_domain_http_error(exc)

    if turn.get("reused"):
        ai_chat_concurrency.release()
        return replay_saved_turn_sse(turn["session"], turn["assistant_message"])

    return build_offline_chat_sse_response(
        service=service,
        db_factory=db_factory,
        http_request=http_request,
        user_id=user_id,
        clean_message=clean_message,
        turn=turn,
        top_k=request.top_k,
        similarity_threshold=request.similarity_threshold,
    )
