"""
Module: backend.repositories.offline_chat_repository
Mục đích: Kho lưu trữ quản lý phiên hội thoại và lịch sử tin nhắn Chatbot RAG Offline trên MySQL.
Ai gọi nó: `OfflineChatService`, `backend.api.v1.offline_chat` và `backend.main` (dọn phiên treo khi khởi động).
Tại sao tồn tại: Cô lập toàn bộ câu lệnh SQL, kiểm tra quyền sở hữu `user_id` và giao dịch ngắn cho lịch sử Offline Chat.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểu dữ liệu & Chuẩn hóa chuỗi)
# ========================================================
from typing import Any, Dict, List, Optional, Sequence

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Thực thi truy vấn tham số hóa trên phiên Session
from sqlalchemy import text
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (BaseRepository & Serializer JSON)
# ========================================================
from .base import BaseRepository
from .serializers import safe_json_dumps, safe_json_loads

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & CẤU HÌNH (Hằng số & Ngoại lệ miền)
# ========================================================
DEFAULT_TITLE_LIMIT = 48


class OfflineChatNotFoundError(Exception):
    """Ngoại lệ khi phiên hội thoại không tồn tại."""


class OfflineChatForbiddenError(Exception):
    """Ngoại lệ khi người dùng cố truy cập hội thoại của tài khoản khác."""


class OfflineChatConflictError(Exception):
    """Ngoại lệ khi gửi trùng request đang xử lý hoặc phiên đang sinh câu trả lời."""


def build_session_title(message: str, max_len: int = DEFAULT_TITLE_LIMIT) -> str:
    """
    Tạo tiêu đề ngắn gọn từ khoảng 45–50 ký tự đầu của câu hỏi mà không cần gọi LLM.

    @param {str} message Nội dung câu hỏi đầu tiên của người dùng.
    @param {int} max_len Độ dài tối đa trước dấu ba chấm.
    @returns {str} Tiêu đề ngắn gọn hợp lệ.
    """
    clean = " ".join((message or "").strip().split())
    if not clean:
        return "Cuộc trò chuyện mới"
    if len(clean) <= max_len:
        return clean
    clipped = clean[:max_len].rstrip()
    last_space = clipped.rfind(" ")
    if last_space >= max_len // 2:
        clipped = clipped[:last_space].rstrip()
    return f"{clipped}..."


def _to_iso(value: Any) -> str:
    """Chuyển đổi dấu thời gian SQL sang chuỗi ISO ổn định."""
    if value is None:
        return ""
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _format_session(row: Dict[str, Any]) -> Dict[str, Any]:
    """Chuẩn hóa bản ghi bảng `offline_chat_sessions` thành từ điển phản hồi."""
    return {
        "id": int(row["id"]),
        "user_id": int(row["user_id"]),
        "title": row["title"],
        "created_at": _to_iso(row.get("created_at")),
        "updated_at": _to_iso(row.get("updated_at")),
    }


def _format_message(row: Dict[str, Any]) -> Dict[str, Any]:
    """Chuẩn hóa bản ghi bảng `offline_chat_messages` kèm danh sách `sources`."""
    raw_sources = safe_json_loads(row.get("sources_json"), default=[])
    sources = raw_sources if isinstance(raw_sources, list) else []
    return {
        "id": int(row["id"]),
        "session_id": int(row["session_id"]),
        "role": row["role"],
        "content": row.get("content") or "",
        "sources": sources,
        "status": row.get("status") or "completed",
        "request_id": row["request_id"],
        "created_at": _to_iso(row.get("created_at")),
    }


def _select_completed_context_turns(rows_asc: Sequence[Dict[str, Any]]) -> List[Dict[str, str]]:
    """
    Chỉ giữ các cặp User -> Assistant đã `completed`, loại bỏ lượt lỗi/hủy/đang sinh.

    @param {Sequence[Dict[str, Any]]} rows_asc Danh sách tin nhắn theo thứ tự thời gian tăng dần.
    @returns {List[Dict[str, str]]} Danh sách lượt hội thoại tin cậy đưa vào prompt LLM.
    """
    user_by_req: Dict[str, str] = {}
    ordered_turns: List[Dict[str, str]] = []
    for row in rows_asc:
        role = (row.get("role") or "").strip().lower()
        req_id = row.get("request_id") or ""
        content = (row.get("content") or "").strip()
        if role == "user" and req_id and content:
            user_by_req[req_id] = content
        elif role == "assistant" and row.get("status") == "completed" and content:
            paired_user = user_by_req.get(req_id)
            if paired_user:
                ordered_turns.append({"role": "user", "content": paired_user})
                ordered_turns.append({"role": "assistant", "content": content})
    return ordered_turns


class OfflineChatRepository(BaseRepository):
    """Repository quản lý phiên hội thoại và tin nhắn RAG Offline theo quyền sở hữu `user_id`."""

    @staticmethod
    def _require_owned_session(db: Session, session_id: int, user_id: int) -> Dict[str, Any]:
        """Kiểm tra tồn tại và quyền sở hữu phiên hội thoại cho đúng `user_id`."""
        row = db.execute(
            text("SELECT id, user_id, title, created_at, updated_at FROM offline_chat_sessions WHERE id = :sid"),
            {"sid": session_id},
        ).mappings().first()
        if not row:
            raise OfflineChatNotFoundError("Không tìm thấy cuộc trò chuyện.")
        if int(row["user_id"]) != int(user_id):
            raise OfflineChatForbiddenError("Bạn không có quyền truy cập cuộc trò chuyện của tài khoản khác.")
        return dict(row)

    def get_all(self, db: Session, user_id: int, limit: int = 50, offset: int = 0) -> Dict[str, Any]:
        """Lấy danh sách hội thoại phân trang của người dùng, sắp mới nhất lên đầu."""
        total = int(
            db.execute(
                text("SELECT COUNT(*) FROM offline_chat_sessions WHERE user_id = :uid"),
                {"uid": user_id},
            ).scalar()
            or 0
        )
        rows = db.execute(
            text(
                "SELECT id, user_id, title, created_at, updated_at "
                "FROM offline_chat_sessions WHERE user_id = :uid "
                "ORDER BY updated_at DESC, id DESC LIMIT :limit OFFSET :offset"
            ),
            {"uid": user_id, "limit": limit, "offset": offset},
        ).mappings().all()
        return {
            "items": [_format_session(dict(r)) for r in rows],
            "total": total,
            "limit": limit,
            "offset": offset,
        }

    def get_by_id(self, db: Session, session_id: int, user_id: int) -> Dict[str, Any]:
        """Lấy thông tin một phiên hội thoại sau khi kiểm tra quyền sở hữu."""
        return _format_session(self._require_owned_session(db, session_id, user_id))

    def get_session_detail(
        self,
        db: Session,
        session_id: int,
        user_id: int,
        limit: int = 200,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """Lấy chi tiết hội thoại kèm danh sách tin nhắn phân trang theo đúng thứ tự `id ASC`."""
        session = _format_session(self._require_owned_session(db, session_id, user_id))
        total_msgs = int(
            db.execute(
                text("SELECT COUNT(*) FROM offline_chat_messages WHERE session_id = :sid"),
                {"sid": session_id},
            ).scalar()
            or 0
        )
        rows = db.execute(
            text(
                "SELECT id, session_id, role, content, sources_json, status, request_id, created_at "
                "FROM offline_chat_messages WHERE session_id = :sid "
                "ORDER BY id ASC LIMIT :limit OFFSET :offset"
            ),
            {"sid": session_id, "limit": limit, "offset": offset},
        ).mappings().all()
        return {
            "session": session,
            "messages": [_format_message(dict(r)) for r in rows],
            "total_messages": total_msgs,
            "limit": limit,
            "offset": offset,
        }

    def create(self, db: Session, user_id: int, title: str) -> Dict[str, Any]:
        """Tạo mới một phiên hội thoại thuộc về `user_id`."""
        res = db.execute(
            text("INSERT INTO offline_chat_sessions (user_id, title) VALUES (:uid, :title)"),
            {"uid": user_id, "title": title[:120]},
        )
        session_id = int(res.lastrowid)
        db.commit()
        return self.get_by_id(db, session_id, user_id)

    def rename_session(self, db: Session, session_id: int, user_id: int, new_title: str) -> Dict[str, Any]:
        """Đổi tiêu đề phiên hội thoại sau khi xác minh quyền sở hữu."""
        clean_title = " ".join((new_title or "").strip().split())[:120]
        if not clean_title:
            raise ValueError("Tiêu đề cuộc trò chuyện không được để trống.")
        self._require_owned_session(db, session_id, user_id)
        db.execute(
            text(
                "UPDATE offline_chat_sessions "
                "SET title = :title, updated_at = CURRENT_TIMESTAMP "
                "WHERE id = :sid AND user_id = :uid"
            ),
            {"title": clean_title, "sid": session_id, "uid": user_id},
        )
        db.commit()
        return self.get_by_id(db, session_id, user_id)

    def delete(self, db: Session, session_id: int, user_id: int) -> bool:
        """Xóa phiên hội thoại và toàn bộ tin nhắn thuộc quyền sở hữu của `user_id`."""
        self._require_owned_session(db, session_id, user_id)
        db.execute(text("DELETE FROM offline_chat_messages WHERE session_id = :sid"), {"sid": session_id})
        res = db.execute(
            text("DELETE FROM offline_chat_sessions WHERE id = :sid AND user_id = :uid"),
            {"sid": session_id, "uid": user_id},
        )
        db.commit()
        return bool(res.rowcount)

    def prepare_turn(
        self,
        db: Session,
        user_id: int,
        session_id: Optional[int],
        message: str,
        request_id: str,
    ) -> Dict[str, Any]:
        """
        Giao dịch ngắn trước khi chạy RAG/LLM: xác minh quyền, tạo session nếu mới,
        chống lưu trùng theo `request_id`, lưu tin User + Assistant(`generating`) và đọc lịch sử hợp lệ.
        """
        if session_id is None:
            res = db.execute(
                text("INSERT INTO offline_chat_sessions (user_id, title) VALUES (:uid, :title)"),
                {"uid": user_id, "title": build_session_title(message)},
            )
            active_session_id = int(res.lastrowid)
        else:
            self._require_owned_session(db, session_id, user_id)
            active_session_id = int(session_id)

        existing = db.execute(
            text(
                "SELECT id, session_id, role, content, sources_json, status, request_id, created_at "
                "FROM offline_chat_messages "
                "WHERE session_id = :sid AND request_id = :rid ORDER BY id ASC"
            ),
            {"sid": active_session_id, "rid": request_id},
        ).mappings().all()
        existing_assistant = next((dict(r) for r in existing if r["role"] == "assistant"), None)
        if existing_assistant:
            if existing_assistant["status"] == "generating":
                db.rollback()
                raise OfflineChatConflictError("Lượt gửi này đang được xử lý, vui lòng chờ hoàn tất.")
            session_row = self._require_owned_session(db, active_session_id, user_id)
            db.commit()
            return {"reused": True, "session": _format_session(session_row), "assistant_message": _format_message(existing_assistant)}

        busy_msg = db.execute(
            text("SELECT id FROM offline_chat_messages WHERE session_id = :sid AND status = 'generating' LIMIT 1"),
            {"sid": active_session_id},
        ).first()
        if busy_msg:
            db.rollback()
            raise OfflineChatConflictError("Cuộc trò chuyện này đang sinh câu trả lời trước đó.")

        db.execute(
            text(
                "INSERT INTO offline_chat_messages (session_id, role, content, sources_json, status, request_id) "
                "VALUES (:sid, 'user', :content, NULL, 'completed', :rid)"
            ),
            {"sid": active_session_id, "content": message, "rid": request_id},
        )
        asst_res = db.execute(
            text(
                "INSERT INTO offline_chat_messages (session_id, role, content, sources_json, status, request_id) "
                "VALUES (:sid, 'assistant', '', NULL, 'generating', :rid)"
            ),
            {"sid": active_session_id, "rid": request_id},
        )
        assistant_msg_id = int(asst_res.lastrowid)
        db.execute(
            text("UPDATE offline_chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = :sid AND user_id = :uid"),
            {"sid": active_session_id, "uid": user_id},
        )

        raw_history = db.execute(
            text(
                "SELECT id, role, content, status, request_id FROM offline_chat_messages "
                "WHERE session_id = :sid AND request_id != :rid ORDER BY id DESC LIMIT 30"
            ),
            {"sid": active_session_id, "rid": request_id},
        ).mappings().all()
        session_row = self._require_owned_session(db, active_session_id, user_id)
        db.commit()

        history_turns = _select_completed_context_turns(list(reversed([dict(r) for r in raw_history])))
        return {
            "reused": False,
            "session": _format_session(session_row),
            "assistant_message_id": assistant_msg_id,
            "history": history_turns,
        }

    def finalize_assistant_message(
        self,
        db: Session,
        session_id: int,
        user_id: int,
        assistant_message_id: int,
        content: str,
        sources: List[Dict[str, Any]],
        status: str,
    ) -> bool:
        """
        Giao dịch ngắn sau khi kết thúc stream: cập nhật nội dung, nguồn RAG và trạng thái tin Assistant.
        Nếu phiên đã bị người dùng xóa trong lúc stream thì bỏ qua an toàn, không ghi lại bản ghi mồ côi.
        """
        owned = db.execute(
            text("SELECT id FROM offline_chat_sessions WHERE id = :sid AND user_id = :uid"),
            {"sid": session_id, "uid": user_id},
        ).first()
        if not owned:
            db.rollback()
            return False

        sources_str = safe_json_dumps(sources) if sources else None
        db.execute(
            text(
                "UPDATE offline_chat_messages "
                "SET content = :content, sources_json = :sources_json, status = :status "
                "WHERE id = :mid AND session_id = :sid"
            ),
            {"content": content, "sources_json": sources_str, "status": status, "mid": assistant_message_id, "sid": session_id},
        )
        db.execute(
            text("UPDATE offline_chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = :sid AND user_id = :uid"),
            {"sid": session_id, "uid": user_id},
        )
        db.commit()
        return True

    def recover_orphan_generating_messages(self, db: Session) -> int:
        """Chuyển các bản ghi kẹt ở `generating` (do sập tiến trình đột ngột) về trạng thái kết thúc an toàn."""
        res_cancelled = db.execute(
            text(
                "UPDATE offline_chat_messages "
                "SET status = 'cancelled' "
                "WHERE status = 'generating' AND LENGTH(TRIM(content)) > 0"
            )
        )
        res_failed = db.execute(
            text(
                "UPDATE offline_chat_messages "
                "SET status = 'failed', content = 'Phiên trả lời bị gián đoạn trước khi hoàn tất.' "
                "WHERE status = 'generating' AND LENGTH(TRIM(content)) = 0"
            )
        )
        db.commit()
        return int((res_cancelled.rowcount or 0) + (res_failed.rowcount or 0))
