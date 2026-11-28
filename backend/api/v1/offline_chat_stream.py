"""
Module: backend.api.v1.offline_chat_stream
Mục đích: Bộ phát luồng SSE cho lượt hỏi đáp RAG Offline mà không giữ kết nối/giao dịch CSDL.
Ai gọi nó: `backend.api.v1.offline_chat` tại endpoint `POST /api/offline-chat/stream`.
Tại sao tồn tại: Giữ router `offline_chat.py` gọn gàng theo chuẩn SRP, tách riêng logic điều phối SSE và chốt giao dịch ngắn thứ 2.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (JSON & Kiểu bất đồng bộ)
# ========================================================
import json
from typing import Any, AsyncGenerator, Callable, Dict, List, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
from fastapi import Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
# anyio: Giữ khối dọn dẹp và chốt trạng thái khi kết nối bị hủy.
import anyio

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Concurrency, Runtime Manager & Service)
# ========================================================
from backend.core.load_control import ai_chat_concurrency
from backend.services.ai_runtime_manager import AiRuntimeManager
from backend.api.local_ai_stream import LocalAiStreamingResponse, local_ai_stream, run_local_ai_step
from backend.services.offline_chat.offline_chat_service import OfflineChatService

# ========================================================
# 4. CẤU HÌNH & HẰNG SỐ HỆ THỐNG
# ========================================================
SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Content-Type": "text/event-stream; charset=utf-8",
    "X-Accel-Buffering": "no",
}


def sse_event(payload: Dict[str, Any]) -> str:
    """Đóng gói một bản tin JSON theo chuẩn Server-Sent Events."""
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def replay_saved_turn_sse(session_obj: Dict[str, Any], saved_msg: Dict[str, Any]) -> StreamingResponse:
    """Phát lại phản hồi đã lưu khi nhận trùng `request_id` mà không gọi lại RAG hay LLM."""
    async def replay_stream() -> AsyncGenerator[str, None]:
        yield sse_event({"session": session_obj, "message_id": saved_msg["id"]})
        yield sse_event({"sources": saved_msg.get("sources") or []})
        if saved_msg.get("content"):
            yield sse_event({"text": saved_msg["content"]})
        yield sse_event({"status": saved_msg.get("status") or "completed"})
        yield "data: [DONE]\n\n"

    return StreamingResponse(replay_stream(), media_type="text/event-stream", headers=SSE_HEADERS)


async def _is_client_disconnected(http_request: Optional[Request]) -> bool:
    """Kiểm tra an toàn xem client đã ngắt kết nối hay hủy luồng SSE chưa."""
    return bool(http_request is not None and hasattr(http_request, "is_disconnected") and await http_request.is_disconnected())


def build_offline_chat_sse_response(
    service: OfflineChatService,
    db_factory: Callable[[], Session],
    http_request: Optional[Request],
    user_id: int,
    clean_message: str,
    turn: Dict[str, Any],
    top_k: Optional[int],
    similarity_threshold: Optional[float],
) -> StreamingResponse:
    """Xây dựng phản hồi SSE cho một lượt hỏi RAG Offline sau khi giao dịch ngắn 1 đã đóng DB."""
    session_obj = turn["session"]
    session_id = int(session_obj["id"])
    assistant_msg_id = int(turn["assistant_message_id"])
    db_history: List[Dict[str, str]] = turn.get("history") or []
    sentinel = object()

    @local_ai_stream
    async def event_generator() -> AsyncGenerator[str, None]:
        sync_iter = None
        collected_parts: List[str] = []
        saved_sources: List[Dict[str, Any]] = []
        final_status = "completed"
        finalized = False

        def _commit_final(status_value: str, fallback_text: str = "") -> None:
            nonlocal finalized
            if finalized:
                return
            finalized = True
            text_out = "".join(collected_parts) if collected_parts else fallback_text
            service.finalize_conversation_turn(
                db_factory=db_factory,
                session_id=session_id,
                user_id=user_id,
                assistant_message_id=assistant_msg_id,
                content=text_out,
                sources=saved_sources,
                status=status_value,
            )

        try:
            yield sse_event({"session": session_obj, "message_id": assistant_msg_id})

            chitchat_reply = service.detect_chitchat_reply(clean_message)
            if chitchat_reply is not None:
                collected_parts.append(chitchat_reply)
                yield sse_event({"sources": []})
                yield sse_event({"text": chitchat_reply})
                await run_in_threadpool(_commit_final, "completed")
                yield sse_event({"status": "completed"})
                yield "data: [DONE]\n\n"
                return

            yield sse_event({"status": "retrieving", "message": "Đang truy xuất tài liệu từ kho tri thức offline..."})
            retrieval = await run_local_ai_step(service.prepare_rag_context, clean_message, db_history, top_k, similarity_threshold)

            if retrieval.status in ("empty_kb", "no_relevant_docs"):
                reply = (
                    "Kho tri thức offline (`docs/knowledge/`) hiện chưa có tài liệu hoặc chỉ mục còn trống. "
                    "Hãy bổ sung tài liệu Markdown vào `docs/knowledge/` và bấm cập nhật chỉ mục để tôi có dữ liệu trả lời."
                    if retrieval.status == "empty_kb"
                    else "Chưa tìm thấy đoạn tài liệu phù hợp trong kho tri thức hiện tại cho câu hỏi này, nên tôi không tự suy đoán thông tin. Bạn có thể hỏi cụ thể hơn hoặc bổ sung tài liệu vào `docs/knowledge/`."
                )
                collected_parts.append(reply)
                yield sse_event({"sources": [], **({"knowledge_empty": True} if retrieval.status == "empty_kb" else {})})
                yield sse_event({"text": reply})
                await run_in_threadpool(_commit_final, "completed")
                yield sse_event({"status": "completed"})
                yield "data: [DONE]\n\n"
                return

            messages, used_chunks = service.build_prompt_messages(clean_message, db_history, retrieval.chunks)
            saved_sources = [{"chunk_id": c.chunk_id, "doc_path": c.doc_path, "title": c.title, "score": c.score} for c in used_chunks]
            yield sse_event({"sources": saved_sources})

            if await _is_client_disconnected(http_request):
                final_status = "cancelled"
                return

            if not (await run_in_threadpool(AiRuntimeManager.get_slot_status, "qwen_chat")).get("ready"):
                yield sse_event({"status": "loading_model", "message": "Đang nạp Qwen3.5-4B vào RAM..."})

            yield sse_event({"status": "streaming", "message": "Qwen3.5-4B đang trả lời..."})
            sync_iter = await run_local_ai_step(service.stream_llm_answer, messages)

            while True:
                if await _is_client_disconnected(http_request):
                    final_status = "cancelled"
                    break
                chunk_text = await run_local_ai_step(lambda: next(sync_iter, sentinel))
                if chunk_text is sentinel:
                    break
                collected_parts.append(chunk_text)
                yield sse_event({"text": chunk_text})

            await run_in_threadpool(_commit_final, final_status)
            yield sse_event({"status": final_status})
            yield "data: [DONE]\n\n"
        except Exception as exc:
            final_status = "failed"
            await run_in_threadpool(_commit_final, "failed", f"Lỗi sinh phản hồi: {exc}")
            yield sse_event({"status": "failed", "error": str(exc)})
            yield "data: [DONE]\n\n"
        finally:
            with anyio.CancelScope(shield=True):
                try:
                    if sync_iter is not None and hasattr(sync_iter, "close"):
                        await run_local_ai_step(sync_iter.close)
                finally:
                    try:
                        if not finalized:
                            await run_in_threadpool(_commit_final, "cancelled" if final_status != "failed" else "failed")
                    finally:
                        ai_chat_concurrency.release()

    return LocalAiStreamingResponse(event_generator(), media_type="text/event-stream", headers=SSE_HEADERS)
