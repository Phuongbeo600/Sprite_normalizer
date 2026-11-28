# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử, Hệ thống & Mock)
# ========================================================
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import time
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
from fastapi.testclient import TestClient
import numpy as np
import requests
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (RAG Offline & FastAPI)
# ========================================================
from backend.core.security import create_access_token
from backend.main import app
from backend.repositories.offline_chat_repository import (
    OfflineChatConflictError,
    OfflineChatForbiddenError,
    OfflineChatNotFoundError,
    OfflineChatRepository,
)
from backend.services.ai_runtime_manager import AiRuntimeManager, SLOT_SPECS, _SlotState
from backend.services.offline_chat.offline_chat_service import OfflineChatService
from backend.services.offline_chat.rag.chunker import chunk_markdown_document
from backend.services.offline_chat.rag.indexer import KnowledgeIndexer
from backend.services.offline_chat.rag.rag_service import OfflineRagService
from backend.services.offline_chat.rag.retriever import (
    DocumentRetriever,
    RetrievedChunk,
    build_retrieval_query,
)

# ========================================================
# 4. CẤU HÌNH & HẰNG SỐ KIỂM THỬ
# ========================================================


def _fake_embed_texts(texts):
    """Sinh vector 4 chiều chuẩn hóa L2 có tính tất định theo từ khóa để kiểm thử không cần server."""
    rows = []
    for text in texts:
        low = text.lower()
        v = np.array([
            2.0 if ("alpha" in low or "bottom-center" in low or "neck_y" in low) else 0.1,
            2.0 if ("walk" in low or "3×5" in low or "3x5" in low or "godot" in low) else 0.1,
            2.0 if ("halo" in low or "nearest" in low) else 0.1,
            0.2,
        ], dtype=np.float32)
        v = v / np.linalg.norm(v)
        rows.append(v)
    return np.asarray(rows, dtype=np.float32)


class TestOfflineRagChunkerAndIndexer(unittest.TestCase):
    """Kiểm thử B01-B02: Kho tri thức trống, tách Markdown và đồng bộ tăng dần NPZ + JSON."""

    def test_markdown_chunker_preserves_headings_and_code_fences(self):
        """Phải giữ đường dẫn tiêu đề cha-con và không tách nhầm # trong khối code."""
        md = (
            "# Tiêu đề chính\n\n"
            "## Mục con\n"
            "Đoạn văn thứ nhất giải thích thuật toán.\n\n"
            "```python\n"
            "# Comment này không phải heading Markdown\n"
            "x = 1\n"
            "```\n\n"
            "Đoạn văn thứ hai bổ sung thêm chi tiết.\n"
        )
        chunks = chunk_markdown_document("guide.md", md, doc_hash="h1", max_chars=240, overlap_chars=40)
        self.assertGreaterEqual(len(chunks), 1)
        self.assertEqual(chunks[0]["doc_path"], "guide.md")
        self.assertEqual(chunks[0]["title"], "Tiêu đề chính > Mục con")
        self.assertTrue(any("# Comment này không phải heading Markdown" in c["content"] for c in chunks))

    def test_empty_knowledge_dir_and_incremental_sync(self):
        """Kho rỗng không gọi Embedding; thêm/sửa/xóa tài liệu chỉ nhúng lại đúng phần thay đổi."""
        with tempfile.TemporaryDirectory() as tmp:
            kb_dir = Path(tmp) / "knowledge"
            idx_dir = Path(tmp) / "index"
            kb_dir.mkdir()
            indexer = KnowledgeIndexer(knowledge_dir=kb_dir, index_dir=idx_dir)

            with patch("backend.services.offline_chat.rag.indexer.EmbeddingService.embed_texts") as mock_embed:
                empty_res = indexer.sync_index()
                self.assertEqual(empty_res["status"], "empty")
                self.assertEqual(empty_res["chunk_count"], 0)
                mock_embed.assert_not_called()

            # Thêm 2 file ban đầu
            (kb_dir / "doc1.md").write_text("# A\n\nNội dung alpha trim chuẩn hóa sprite.", encoding="utf-8")
            (kb_dir / "doc2.md").write_text("# B\n\nNội dung đóng gói Godot 4 zip.", encoding="utf-8")

            with patch("backend.services.offline_chat.rag.indexer.EmbeddingService.embed_texts", side_effect=_fake_embed_texts) as mock_embed:
                res1 = indexer.sync_index()
                self.assertEqual((res1["added"], res1["reused"]), (2, 0))
                self.assertEqual(mock_embed.call_count, 1)

                # Lần 2 không đổi file -> không gọi Embedding
                mock_embed.reset_mock()
                res2 = indexer.sync_index()
                self.assertEqual(res2["status"], "up_to_date")
                mock_embed.assert_not_called()

                # Sửa doc1, thêm doc3, xóa doc2 -> chỉ embed 2 file (doc1 + doc3), tái sử dụng 0 vì doc2 đã xóa
                (kb_dir / "doc1.md").write_text("# A\n\nNội dung alpha trim đã cập nhật mới.", encoding="utf-8")
                (kb_dir / "doc3.md").write_text("# C\n\nNội dung mới về neck_y.", encoding="utf-8")
                (kb_dir / "doc2.md").unlink()
                mock_embed.reset_mock()
                res3 = indexer.sync_index()
                self.assertEqual((res3["added"], res3["updated"], res3["removed"]), (1, 1, 1))
                self.assertEqual(mock_embed.call_count, 1)
                self.assertEqual(len(mock_embed.call_args.args[0]), 2)

            # Đổi tham số chunk -> đánh dấu index không tương thích
            incompatible_indexer = KnowledgeIndexer(knowledge_dir=kb_dir, index_dir=idx_dir, max_chunk_chars=600)
            self.assertFalse(incompatible_indexer.get_status()["index_compatible"])


class TestOfflineRetrieverAndRuntimeManager(unittest.TestCase):
    """Kiểm thử B03-B04: Truy xuất nối tiếp, lọc trùng và quản lý RAM/Idle/In-flight AI Local."""

    def test_followup_query_and_dedup_and_threshold(self):
        """Câu hỏi nối tiếp giữ ngữ cảnh câu trước; lọc bỏ chunk dưới ngưỡng và trùng nội dung."""
        history = [
            {"role": "user", "content": "Thuật toán Alpha Trim hoạt động thế nào?"},
            {"role": "assistant", "content": "Alpha Trim quét kênh độ mờ để tìm bounding box."},
        ]
        retrieval_q = build_retrieval_query("Giải thích chi tiết hơn về nó đi", history)
        self.assertIn("Alpha Trim", retrieval_q)

        chunks = [
            {"chunk_id": "c1", "doc_path": "a.md", "title": "Alpha", "content": "Thuật toán Alpha Trim tìm bounding box chuẩn hóa"},
            {"chunk_id": "c2", "doc_path": "a.md", "title": "Alpha 2", "content": "Thuật toán Alpha Trim tìm bounding box chuẩn hóa"},
            {"chunk_id": "c3", "doc_path": "b.md", "title": "Godot", "content": "Xuất gói Godot 4 zip SpriteFrames"},
        ]
        vecs = _fake_embed_texts([c["content"] for c in chunks])
        q_vec = _fake_embed_texts([retrieval_q])[0]

        res = DocumentRetriever.retrieve_from_vectors(
            query="Giải thích chi tiết hơn về nó đi",
            vectors=vecs,
            chunks=chunks,
            history=history,
            top_k=3,
            similarity_threshold=0.70,
            query_vector=q_vec,
        )
        self.assertEqual(res.status, "ok")
        self.assertEqual(len(res.chunks), 1)  # c2 trùng nội dung với c1 và c3 dưới ngưỡng 0.70
        self.assertEqual(res.chunks[0].chunk_id, "c1")

        # Ngưỡng quá cao -> trả no_relevant_docs
        empty_res = DocumentRetriever.retrieve_from_vectors(
            query="Câu hỏi không khớp",
            vectors=vecs,
            chunks=chunks,
            similarity_threshold=0.9999,
            query_vector=np.array([0.0, 0.0, 0.0, 1.0], dtype=np.float32),
        )
        self.assertEqual(empty_res.status, "no_relevant_docs")

    def test_runtime_manager_idle_protection_and_eviction(self):
        """Không được giải phóng slot đang bận; giải phóng slot rảnh khi quá idle hoặc thiếu RAM."""
        old_states = AiRuntimeManager._states
        AiRuntimeManager._states = {k: _SlotState() for k in SLOT_SPECS}
        try:
            busy_proc = MagicMock()
            busy_proc.poll.return_value = None
            idle_proc = MagicMock()
            idle_proc.poll.return_value = None

            AiRuntimeManager._states["qwen_chat"].process = busy_proc
            AiRuntimeManager._states["qwen_chat"].active_requests = 1
            AiRuntimeManager._states["qwen_chat"].last_used_at = time.monotonic() - 9999

            AiRuntimeManager._states["bge_m3_embedding"].process = idle_proc
            AiRuntimeManager._states["bge_m3_embedding"].active_requests = 0
            AiRuntimeManager._states["bge_m3_embedding"].last_used_at = time.monotonic() - 9999

            reaped = AiRuntimeManager.reap_idle_slots()
            self.assertEqual(reaped, ["bge_m3_embedding"])
            idle_proc.terminate.assert_called_once()
            busy_proc.terminate.assert_not_called()

            # Khi thiếu RAM hoàn toàn (không thể giải phóng slot bận) -> ném MemoryError
            with patch.object(AiRuntimeManager, "_probe_health", return_value="offline"), patch.object(
                AiRuntimeManager, "get_memory_snapshot", return_value={"total_mb": 8192.0, "available_mb": 300.0, "used_percent": 96.0}
            ), patch("pathlib.Path.is_file", return_value=True):
                with self.assertRaises(MemoryError):
                    AiRuntimeManager.ensure_started("bge_m3_embedding")

            AiRuntimeManager.shutdown_all()
            busy_proc.terminate.assert_called_once()
        finally:
            AiRuntimeManager._states = old_states


def _create_test_sqlite_db():
    """Tạo CSDL SQLite in-memory mô phỏng bảng users, offline_chat_sessions và offline_chat_messages."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.begin() as conn:
        conn.execute(text("PRAGMA foreign_keys = ON;"))
        conn.execute(text("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                last_name TEXT NULL,
                middle_name TEXT NULL,
                first_name TEXT NULL,
                full_name TEXT NULL,
                avatar_url TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        conn.execute(text("""
            CREATE TABLE offline_chat_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """))
        conn.execute(text("""
            CREATE TABLE offline_chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                sources_json TEXT NULL,
                status TEXT NOT NULL DEFAULT 'completed',
                request_id TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (session_id, request_id, role),
                FOREIGN KEY (session_id) REFERENCES offline_chat_sessions(id) ON DELETE CASCADE
            );
        """))
        conn.execute(text("INSERT INTO users (id, username, password, role) VALUES (1, 'alice', 'h1', 'user');"))
        conn.execute(text("INSERT INTO users (id, username, password, role) VALUES (2, 'bob', 'h2', 'user');"))
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


class TestOfflineChatServiceAndRouter(unittest.TestCase):
    """Kiểm thử B05: Bảo vệ prompt injection, token budget, phản hồi SSE và giữ nguyên Chat API cũ."""

    def test_prompt_builder_separates_context_and_respects_budget(self):
        """Prompt phải đánh dấu tài liệu chỉ đọc, giữ lịch sử vừa ngân sách và trả đúng nguồn đã nạp."""
        chunks = [
            RetrievedChunk(chunk_id="1", doc_path="doc.md", title="Mục 1", content="Thông tin chuẩn A", score=0.9),
            RetrievedChunk(chunk_id="2", doc_path="doc.md", title="Mục 2", content="Thông tin chuẩn B " * 400, score=0.8),
        ]
        history = [{"role": "user", "content": "Tin cũ " * 500}, {"role": "assistant", "content": "Đáp gần nhất"}]
        messages, used = OfflineChatService.build_prompt_messages("Hỏi tiếp", history, chunks)
        self.assertEqual(messages[0]["role"], "system")
        self.assertIn("DỮ LIỆU CHỈ ĐỌC", messages[0]["content"])
        self.assertEqual(len(used), 1)  # Mục 2 bị loại do vượt REF_DOCS_CHAR_BUDGET -> không báo sai nguồn
        self.assertEqual(used[0].chunk_id, "1")
        self.assertIn("Hỏi tiếp", messages[-1]["content"])

    def test_sse_stream_endpoint_handles_empty_kb_and_real_flow(self):
        """Endpoint /api/offline-chat/stream phát SSE chuẩn cả khi kho rỗng lẫn khi có tài liệu."""
        client = TestClient(app)
        db_factory = _create_test_sqlite_db()
        headers = {"Authorization": f"Bearer {create_access_token({'sub': '1', 'username': 'alice', 'role': 'user'})}"}

        with tempfile.TemporaryDirectory() as tmp:
            empty_indexer = KnowledgeIndexer(knowledge_dir=Path(tmp) / "kb", index_dir=Path(tmp) / "idx")
            empty_service = OfflineChatService(rag_service=OfflineRagService(indexer=empty_indexer))
            with patch("backend.api.v1.offline_chat._get_service", return_value=empty_service), patch(
                "backend.api.v1.offline_chat._get_db_factory", return_value=db_factory
            ):
                resp = client.post(
                    "/api/offline-chat/stream",
                    headers=headers,
                    json={"session_id": None, "message": "Hỏi thử", "request_id": "req-empty-kb-1"},
                )
                self.assertEqual(resp.status_code, 200)
                self.assertIn('"knowledge_empty": true', resp.text)
                self.assertIn("data: [DONE]", resp.text)

        real_service = OfflineChatService()
        real_service.prepare_rag_context = MagicMock(
            return_value=MagicMock(
                status="ok",
                chunks=[RetrievedChunk(chunk_id="c1", doc_path="01.md", title="Alpha", content="Alpha Trim", score=0.88)],
            )
        )
        real_service.stream_llm_answer = MagicMock(return_value=iter(["Alpha ", "Trim hoạt động tốt."]))

        with patch("backend.api.v1.offline_chat._get_service", return_value=real_service), patch(
            "backend.api.v1.offline_chat._get_db_factory", return_value=db_factory
        ), patch(
            "backend.api.v1.offline_chat.AiRuntimeManager.get_slot_status", return_value={"ready": True}
        ):
            resp = client.post(
                "/api/offline-chat/stream",
                headers=headers,
                json={"session_id": None, "message": "Alpha Trim là gì?", "request_id": "req-real-flow-1"},
            )
            self.assertEqual(resp.status_code, 200)
            self.assertIn('"session"', resp.text)
            self.assertIn('"sources"', resp.text)
            self.assertIn('"01.md"', resp.text)
            self.assertIn("Alpha ", resp.text)
            self.assertIn('"completed"', resp.text)
            self.assertIn("data: [DONE]", resp.text)

    def test_stream_llm_answer_forces_utf8_on_llama_server_sse(self):
        """Phải ép resp.encoding = 'utf-8' để tránh lỗi chữ tiếng Việt khi llama-server thiếu charset."""
        fake_resp = requests.Response()
        fake_resp.status_code = 200
        fake_resp.headers["Content-Type"] = "text/event-stream"
        sse_bytes = (
            'data: {"choices":[{"delta":{"content":"Thuật toán Alpha Trim"}}]}\n\n'
            "data: [DONE]\n\n"
        ).encode("utf-8")
        fake_resp.raw = io.BytesIO(sse_bytes)
        fake_resp._content_consumed = False

        with patch("backend.services.offline_chat.offline_chat_service.AiRuntimeManager.use_slot") as mock_slot, patch(
            "backend.services.offline_chat.offline_chat_service.requests.post", return_value=fake_resp
        ):
            mock_slot.return_value.__enter__.return_value = "http://127.0.0.1:8081"
            chunks = list(OfflineChatService.stream_llm_answer([{"role": "user", "content": "test"}]))

        self.assertEqual("".join(chunks), "Thuật toán Alpha Trim")

    def test_chitchat_greeting_skips_rag_sources_and_persists_turn(self):
        """Câu chào ngắn phản hồi trực tiếp, không gắn nguồn và vẫn lưu lịch sử hợp lệ."""
        client = TestClient(app)
        db_factory = _create_test_sqlite_db()
        headers = {"Authorization": f"Bearer {create_access_token({'sub': '1', 'username': 'alice', 'role': 'user'})}"}
        with patch("backend.api.v1.offline_chat._get_db_factory", return_value=db_factory):
            resp = client.post(
                "/api/offline-chat/stream",
                headers=headers,
                json={"session_id": None, "message": "xin chào", "request_id": "req-hello-1"},
            )
            self.assertEqual(resp.status_code, 200)
            self.assertIn('"sources": []', resp.text)
            self.assertIn("Chào bạn", resp.text)
            self.assertIn("data: [DONE]", resp.text)

            sessions_resp = client.get("/api/offline-chat/sessions", headers=headers)
            self.assertEqual(sessions_resp.status_code, 200)
            items = sessions_resp.json()["items"]
            self.assertEqual(len(items), 1)
            self.assertEqual(items[0]["title"], "xin chào")


class TestOfflineChatHistoryPersistence(unittest.TestCase):
    """Kiểm thử toàn diện quản lý lịch sử hội thoại, bảo mật ownership, giao dịch ngắn và xử lý sự cố."""

    def test_auth_required_and_cross_user_isolation(self):
        """Từ chối khi thiếu JWT; người khác tài khoản nhận 403 cho xem/sửa/xóa/gửi tiếp."""
        client = TestClient(app)
        db_factory = _create_test_sqlite_db()
        alice_hdr = {"Authorization": f"Bearer {create_access_token({'sub': '1', 'username': 'alice', 'role': 'user'})}"}
        bob_hdr = {"Authorization": f"Bearer {create_access_token({'sub': '2', 'username': 'bob', 'role': 'user'})}"}

        with patch("backend.api.v1.offline_chat._get_db_factory", return_value=db_factory):
            self.assertEqual(client.get("/api/offline-chat/sessions").status_code, 401)
            self.assertEqual(
                client.post("/api/offline-chat/stream?user_id=1", json={"message": "hi", "request_id": "r-nojwt-1"}).status_code,
                401,
            )

            create_resp = client.post(
                "/api/offline-chat/stream",
                headers=alice_hdr,
                json={"session_id": None, "message": "xin chào từ Alice để test quyền sở hữu dài hơn 45 ký tự", "request_id": "r-alice-1"},
            )
            self.assertEqual(create_resp.status_code, 200)
            sid = client.get("/api/offline-chat/sessions", headers=alice_hdr).json()["items"][0]["id"]
            self.assertLessEqual(len(client.get("/api/offline-chat/sessions", headers=alice_hdr).json()["items"][0]["title"]), 52)

            # Bob không thể nhìn thấy session của Alice trong danh sách cũng như đọc/sửa/xóa/gửi vào
            self.assertEqual(client.get("/api/offline-chat/sessions", headers=bob_hdr).json()["items"], [])
            self.assertEqual(client.get(f"/api/offline-chat/sessions/{sid}", headers=bob_hdr).status_code, 403)
            self.assertEqual(client.patch(f"/api/offline-chat/sessions/{sid}", headers=bob_hdr, json={"title": "Hack"}).status_code, 403)
            self.assertEqual(client.delete(f"/api/offline-chat/sessions/{sid}", headers=bob_hdr).status_code, 403)
            self.assertEqual(
                client.post("/api/offline-chat/stream", headers=bob_hdr, json={"session_id": sid, "message": "hi", "request_id": "r-bob-1"}).status_code,
                403,
            )

    def test_restore_sources_rename_delete_without_starting_models(self):
        """Mở lịch sử cũ, đổi tên và xóa không bao giờ kích hoạt Qwen/BGE-M3."""
        client = TestClient(app)
        db_factory = _create_test_sqlite_db()
        alice_hdr = {"Authorization": f"Bearer {create_access_token({'sub': '1', 'username': 'alice', 'role': 'user'})}"}

        mock_service = OfflineChatService()
        mock_service.prepare_rag_context = MagicMock(
            return_value=MagicMock(
                status="ok",
                chunks=[RetrievedChunk(chunk_id="c9", doc_path="02.md", title="Godot 4", content="Walk 3x5", score=0.91)],
            )
        )
        mock_service.stream_llm_answer = MagicMock(return_value=iter(["Xuất gói Godot gồm PNG + JSON."]))

        with patch("backend.api.v1.offline_chat._get_service", return_value=mock_service), patch(
            "backend.api.v1.offline_chat._get_db_factory", return_value=db_factory
        ), patch("backend.api.v1.offline_chat.AiRuntimeManager.get_slot_status", return_value={"ready": True}), patch(
            "backend.api.v1.offline_chat.AiRuntimeManager.ensure_started"
        ) as mock_start:
            resp = client.post(
                "/api/offline-chat/stream",
                headers=alice_hdr,
                json={"session_id": None, "message": "Xuất Godot gồm những gì?", "request_id": "r-godot-1"},
            )
            self.assertEqual(resp.status_code, 200)
            sid = client.get("/api/offline-chat/sessions", headers=alice_hdr).json()["items"][0]["id"]

            # Đọc lại lịch sử -> khôi phục nguyên nguồn đã lưu trong DB, KHÔNG gọi RAG/LLM lại
            mock_service.prepare_rag_context.reset_mock()
            mock_service.stream_llm_answer.reset_mock()
            detail = client.get(f"/api/offline-chat/sessions/{sid}", headers=alice_hdr)
            self.assertEqual(detail.status_code, 200)
            msgs = detail.json()["messages"]
            self.assertEqual([m["role"] for m in msgs], ["user", "assistant"])
            self.assertEqual(msgs[1]["sources"][0]["doc_path"], "02.md")
            mock_service.prepare_rag_context.assert_not_called()
            mock_service.stream_llm_answer.assert_not_called()
            mock_start.assert_not_called()

            rename = client.patch(f"/api/offline-chat/sessions/{sid}", headers=alice_hdr, json={"title": "Quy trình Godot"})
            self.assertEqual(rename.status_code, 200)
            self.assertEqual(rename.json()["session"]["title"], "Quy trình Godot")

            delete = client.delete(f"/api/offline-chat/sessions/{sid}", headers=alice_hdr)
            self.assertEqual(delete.status_code, 200)
            self.assertEqual(client.get(f"/api/offline-chat/sessions/{sid}", headers=alice_hdr).status_code, 404)

    def test_idempotent_request_id_short_tx_and_failed_turn_excluded_from_context(self):
        """Chống trùng theo request_id, không giữ DB connection khi inference, và lọc bỏ lượt failed/cancelled khỏi ngữ cảnh."""
        client = TestClient(app)
        raw_factory = _create_test_sqlite_db()
        open_connections = {"count": 0}

        class TrackedSession:
            def __init__(self, inner):
                self._inner = inner
                open_connections["count"] += 1

            def __getattr__(self, name):
                return getattr(self._inner, name)

            def close(self):
                open_connections["count"] -= 1
                return self._inner.close()

        def tracked_factory():
            return TrackedSession(raw_factory())

        alice_hdr = {"Authorization": f"Bearer {create_access_token({'sub': '1', 'username': 'alice', 'role': 'user'})}"}
        service = OfflineChatService()
        seen_open_conns_during_llm = []
        seen_histories = []

        def fake_rag(query, history, top_k=None, similarity_threshold=None):
            seen_open_conns_during_llm.append(open_connections["count"])
            seen_histories.append(list(history))
            return MagicMock(
                status="ok",
                chunks=[RetrievedChunk(chunk_id="c1", doc_path="01.md", title="Alpha", content="Alpha Trim", score=0.9)],
            )

        service.prepare_rag_context = fake_rag

        with patch("backend.api.v1.offline_chat._get_service", return_value=service), patch(
            "backend.api.v1.offline_chat._get_db_factory", return_value=tracked_factory
        ), patch("backend.api.v1.offline_chat.AiRuntimeManager.get_slot_status", return_value={"ready": True}):
            # Lượt 1 thành công
            service.stream_llm_answer = lambda msgs: iter(["Alpha Trim cắt viền rỗng."])
            r1 = client.post("/api/offline-chat/stream", headers=alice_hdr, json={"session_id": None, "message": "Alpha Trim là gì?", "request_id": "req-turn-1"})
            self.assertEqual(r1.status_code, 200)
            self.assertEqual(seen_open_conns_during_llm[-1], 0)  # KHÔNG giữ DB connection khi chạy RAG/LLM!
            sid = client.get("/api/offline-chat/sessions", headers=alice_hdr).json()["items"][0]["id"]

            # Gửi lại đúng request_id của lượt 1 -> trả về kết quả đã lưu, KHÔNG nhân đôi bản ghi hay gọi LLM
            service.stream_llm_answer = MagicMock(side_effect=AssertionError("Không được gọi lại LLM khi trùng request_id"))
            r_dup = client.post("/api/offline-chat/stream", headers=alice_hdr, json={"session_id": sid, "message": "Alpha Trim là gì?", "request_id": "req-turn-1"})
            self.assertEqual(r_dup.status_code, 200)
            self.assertEqual(len(client.get(f"/api/offline-chat/sessions/{sid}", headers=alice_hdr).json()["messages"]), 2)

            # Lượt 2 gặp lỗi khi đang stream -> lưu status='failed'
            def failing_stream(_msgs):
                raise RuntimeError("Mô phỏng lỗi tiến trình Qwen")
                yield ""

            service.stream_llm_answer = failing_stream
            r2 = client.post("/api/offline-chat/stream", headers=alice_hdr, json={"session_id": sid, "message": "Câu hỏi bị lỗi?", "request_id": "req-turn-2"})
            self.assertEqual(r2.status_code, 200)
            msgs_after_fail = client.get(f"/api/offline-chat/sessions/{sid}", headers=alice_hdr).json()["messages"]
            self.assertEqual(msgs_after_fail[-1]["status"], "failed")

            # Lượt 3 hỏi nối tiếp -> lịch sử gửi cho RAG/LLM chỉ chứa Lượt 1 hoàn chỉnh, KHÔNG chứa Lượt 2 lỗi!
            service.stream_llm_answer = lambda msgs: iter(["Tiếp tục trả lời bình thường."])
            r3 = client.post("/api/offline-chat/stream", headers=alice_hdr, json={"session_id": sid, "message": "Nói rõ hơn bước neo điểm?", "request_id": "req-turn-3"})
            self.assertEqual(r3.status_code, 200)
            self.assertEqual(len(seen_histories[-1]), 2)
            self.assertEqual(seen_histories[-1][0]["content"], "Alpha Trim là gì?")
            self.assertEqual(open_connections["count"], 0)

    def test_orphan_recovery_and_deleted_session_mid_stream(self):
        """Khôi phục bản ghi kẹt generating sau restart, lưu cancelled giữ phần chữ dở và chặn ghi mồ côi sau xóa."""
        db_factory = _create_test_sqlite_db()
        repo = OfflineChatRepository()
        db = db_factory()
        try:
            turn = repo.prepare_turn(db, user_id=1, session_id=None, message="Câu hỏi kẹt", request_id="req-orphan-1")
            sid = turn["session"]["id"]
            aid = turn["assistant_message_id"]
            recovered = repo.recover_orphan_generating_messages(db)
            self.assertEqual(recovered, 1)
            detail = repo.get_session_detail(db, session_id=sid, user_id=1)
            self.assertEqual(detail["messages"][1]["status"], "failed")

            # Chốt lượt hủy giữa chừng (`cancelled`) và kiểm tra lượt kế tiếp không nạp câu bị hủy vào ngữ cảnh
            cancel_turn = repo.prepare_turn(db, user_id=1, session_id=sid, message="Hỏi đang stream", request_id="req-cancel-1")
            repo.finalize_assistant_message(db, sid, 1, cancel_turn["assistant_message_id"], "Nội dung dở dang", [], "cancelled")
            next_turn = repo.prepare_turn(db, user_id=1, session_id=sid, message="Hỏi tiếp", request_id="req-next-1")
            self.assertEqual(next_turn["history"], [])

            # Xóa session trước khi finalize -> trả False và không ghi bản ghi mồ côi hoặc dựng lại session
            repo.delete(db, session_id=sid, user_id=1)
            ok = repo.finalize_assistant_message(db, sid, 1, cancel_turn["assistant_message_id"], "Nội dung trễ", [], "completed")
            self.assertFalse(ok)
            self.assertEqual(repo.get_all(db, user_id=1)["total"], 0)
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
