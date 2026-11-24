# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử, Môi trường & Bộ đệm)
# ========================================================
# sys, os: Thiết lập đường dẫn module gốc cho kiểm thử
import sys
import os
import asyncio
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
# json: Giải mã phản hồi SSE từ luồng kiểm thử
import json
# unittest: Framework kiểm thử đơn vị tiêu chuẩn
import unittest
# MagicMock, patch: Giả lập các cuộc gọi HTTP ra bên ngoài
from unittest.mock import MagicMock, patch

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# HTTPException: Bắt lỗi HTTP trả về từ endpoint
from fastapi import HTTPException
from fastapi.responses import StreamingResponse

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Routers, Schemas & Providers)
# ========================================================
from backend.schemas.chat import ChatMessageItem, ChatStreamRequest
from backend.providers.base import BaseAiProvider
from backend.providers.gemini_provider import GeminiProvider
from backend.providers.openai_provider import OpenAiProvider
from backend.api.v1.chat import stream_chat_endpoint, SYSTEM_ASSISTANT_PROMPT

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file kiểm thử)


class TestChatStream(unittest.TestCase):
    """Bộ kiểm thử đơn vị cho toàn bộ phân hệ phát luồng Chatbot SSE đa nhà cung cấp."""

    def test_chat_schemas_validation(self):
        """Kiểm tra tính hợp lệ của Pydantic schema ChatMessageItem và ChatStreamRequest."""
        msg = ChatMessageItem(role="user", content="Xin chào trợ lý")
        self.assertEqual(msg.role, "user")
        self.assertEqual(msg.content, "Xin chào trợ lý")

        req = ChatStreamRequest(
            messages=[msg],
            provider="gemini",
            api_key="test-api-key"
        )
        self.assertEqual(len(req.messages), 1)
        self.assertEqual(req.provider, "gemini")
        self.assertEqual(req.api_key, "test-api-key")

    def test_base_ai_provider_stream_chat_not_implemented(self):
        """Kiểm tra lớp cơ sở BaseAiProvider ném lỗi NotImplementedError khi chưa ghi đè."""
        class DummyProvider(BaseAiProvider):
            def test_connection(self, api_key: str, base_url=None):
                return True, "ok"
            def analyze_vision(self, image, api_key: str, prompt: str, base_url=None):
                return {}
            def generate_json(self, prompt: str, api_key: str, base_url=None):
                return {}

        dummy = DummyProvider()
        with self.assertRaises(NotImplementedError):
            list(dummy.stream_chat(messages=[], api_key="dummy-key"))

    @patch("backend.providers.gemini_provider.requests.post")
    def test_gemini_provider_stream_chat_success(self, mock_post):
        """Kiểm tra GeminiProvider bóc tách đúng từng token từ luồng SSE của Google Gemini."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        # Giả lập 2 dòng dữ liệu SSE trả về từ Gemini
        mock_resp.iter_lines.return_value = [
            b'data: {"candidates": [{"content": {"parts": [{"text": "Ch\xc3\xa0o"}]}}]}',
            b'data: {"candidates": [{"content": {"parts": [{"text": " b\xe1\xba\xa1n!"}]}}]}'
        ]
        mock_post.return_value = mock_resp

        provider = GeminiProvider()
        messages = [{"role": "user", "content": "Alo"}]
        chunks = list(provider.stream_chat(messages=messages, api_key="valid-key"))

        self.assertEqual(chunks, ["Chào", " bạn!"])
        mock_post.assert_called_once()

    @patch("backend.providers.openai_provider.requests.post")
    def test_openai_provider_stream_chat_success(self, mock_post):
        """Kiểm tra OpenAiProvider bóc tách đúng token từ luồng SSE chuẩn OpenAI / DeepSeek / Ollama."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        # Giả lập các dòng dữ liệu SSE chuẩn OpenAI
        mock_resp.iter_lines.return_value = [
            b'data: {"choices": [{"delta": {"content": "Hello"}}]}',
            b'data: {"choices": [{"delta": {"content": " World"}}]}',
            b'data: [DONE]'
        ]
        mock_post.return_value = mock_resp

        provider = OpenAiProvider()
        messages = [{"role": "user", "content": "Hi"}]
        chunks = list(provider.stream_chat(messages=messages, api_key="valid-openai-key"))

        self.assertEqual(chunks, ["Hello", " World"])
        mock_post.assert_called_once()

    @patch("backend.api.v1.chat.AiCredentialsService.is_ai_enabled")
    def test_chat_endpoint_ai_disabled(self, mock_is_enabled):
        """Kiểm tra router báo lỗi 403 khi dự án tắt tính năng AI."""
        mock_is_enabled.return_value = False
        req = ChatStreamRequest(
            messages=[ChatMessageItem(role="user", content="Hi")],
            project_id=1
        )
        mock_db = MagicMock()

        with self.assertRaises(HTTPException) as ctx:
            stream_chat_endpoint(request=req, db=mock_db)
        self.assertEqual(ctx.exception.status_code, 403)

    @patch("backend.api.v1.chat.AiCredentialsService.resolve_credentials")
    @patch("backend.api.v1.chat.AiCredentialsService.is_ai_enabled")
    def test_chat_endpoint_missing_api_key(self, mock_is_enabled, mock_resolve):
        """Kiểm tra router báo lỗi 400 khi người dùng chưa cung cấp API key."""
        mock_is_enabled.return_value = True
        mock_resolve.return_value = (None, "gemini", None)
        req = ChatStreamRequest(
            messages=[ChatMessageItem(role="user", content="Hi")]
        )
        mock_db = MagicMock()

        with self.assertRaises(HTTPException) as ctx:
            stream_chat_endpoint(request=req, db=mock_db)
        self.assertEqual(ctx.exception.status_code, 400)

    @patch("backend.api.v1.chat.AiProviderFactory.get_provider")
    @patch("backend.api.v1.chat.AiCredentialsService.resolve_credentials")
    @patch("backend.api.v1.chat.AiCredentialsService.is_ai_enabled")
    def test_chat_endpoint_streaming_success(self, mock_is_enabled, mock_resolve, mock_get_provider):
        """Kiểm tra router trả về StreamingResponse đúng định dạng SSE khi dữ liệu hợp lệ."""
        mock_is_enabled.return_value = True
        mock_resolve.return_value = ("valid-key", "gemini", None)
        
        mock_provider = MagicMock()
        mock_provider.stream_chat.return_value = iter(["Xin", " chào!"])
        mock_get_provider.return_value = mock_provider

        req = ChatStreamRequest(
            messages=[ChatMessageItem(role="user", content="Chào bạn")],
            api_key="valid-key"
        )
        mock_db = MagicMock()

        response = stream_chat_endpoint(request=req, db=mock_db)
        self.assertIsInstance(response, StreamingResponse)
        self.assertEqual(response.media_type, "text/event-stream")

        # Thu thập các dòng phát ra từ generator SSE (hỗ trợ cả async_generator của Starlette)
        async def collect_events(iterator):
            collected = []
            async for item in iterator:
                collected.append(item)
            return collected

        events = asyncio.run(collect_events(response.body_iterator))
        self.assertIn('data: {"text": "Xin"}\n\n', events)
        self.assertIn('data: {"text": " chào!"}\n\n', events)
        self.assertIn('data: [DONE]\n\n', events)

    @patch("backend.api.v1.chat.AiProviderFactory.get_provider")
    @patch("backend.api.v1.chat.AiCredentialsService.resolve_credentials")
    @patch("backend.api.v1.chat.AiCredentialsService.is_ai_enabled")
    def test_client_disconnect_stops_stream_and_releases_semaphore(self, mock_is_enabled, mock_resolve, mock_get_provider):
        """Kiểm tra khi client ngắt kết nối (is_disconnected), generator dừng stream và giải phóng Semaphore."""
        from backend.core.load_control import ai_chat_concurrency
        mock_is_enabled.return_value = True
        mock_resolve.return_value = ("valid-key", "gemini", None)

        mock_provider = MagicMock()
        # Giả lập phát ra 5 token
        mock_provider.stream_chat.return_value = iter(["Token1", "Token2", "Token3", "Token4", "Token5"])
        mock_get_provider.return_value = mock_provider

        req = ChatStreamRequest(
            messages=[ChatMessageItem(role="user", content="Test disconnect")],
            api_key="valid-key"
        )
        mock_db = MagicMock()

        # Giả lập Request HTTP với client ngắt kết nối sau lần đầu
        mock_http_request = MagicMock()
        disconnect_calls = [False, True]  # Lần 1: chưa ngắt, Lần 2: đã ngắt kết nối

        async def fake_is_disconnected():
            return disconnect_calls.pop(0) if disconnect_calls else True

        mock_http_request.is_disconnected = fake_is_disconnected

        # Kiểm tra slot trước khi chạy
        active_before = ai_chat_concurrency._active_count
        response = stream_chat_endpoint(request=req, http_request=mock_http_request, db=mock_db)

        async def collect_events(iterator):
            collected = []
            async for item in iterator:
                collected.append(item)
            return collected

        events = asyncio.run(collect_events(response.body_iterator))

        # Chỉ nhận token 1, sau đó client ngắt nên không nhận token 2, 3, 4, 5
        self.assertIn('data: {"text": "Token1"}\n\n', events)
        self.assertNotIn('data: {"text": "Token3"}\n\n', events)
        # Xác minh slot Semaphore đã được giải phóng hoàn toàn
        self.assertEqual(ai_chat_concurrency._active_count, active_before)

    @patch("backend.api.v1.chat.AiProviderFactory.get_provider")
    @patch("backend.api.v1.chat.AiCredentialsService.resolve_credentials")
    @patch("backend.api.v1.chat.AiCredentialsService.is_ai_enabled")
    def test_chat_error_redacts_sensitive_api_key(self, mock_is_enabled, mock_resolve, mock_get_provider):
        """Kiểm tra ngoại lệ trong quá trình stream tự động che giấu API key bảo mật."""
        mock_is_enabled.return_value = True
        mock_resolve.return_value = ("AIzaSyD-secret-api-key-1234567890", "gemini", None)

        def failing_generator():
            yield "Token1"
            raise RuntimeError("Lỗi kết nối với khóa AIzaSyD-secret-api-key-1234567890 từ Google")

        mock_provider = MagicMock()
        mock_provider.stream_chat.return_value = failing_generator()
        mock_get_provider.return_value = mock_provider

        req = ChatStreamRequest(
            messages=[ChatMessageItem(role="user", content="Hi")],
            api_key="valid-key"
        )
        mock_db = MagicMock()
        response = stream_chat_endpoint(request=req, db=mock_db)

        async def collect_events(iterator):
            collected = []
            async for item in iterator:
                collected.append(item)
            return collected

        events = asyncio.run(collect_events(response.body_iterator))
        error_event = [e for e in events if '"error"' in e]
        self.assertTrue(len(error_event) > 0)
        self.assertNotIn("AIzaSyD-secret-api-key-1234567890", error_event[0])
        self.assertIn("[REDACTED_API_KEY]", error_event[0])

    @patch("backend.api.v1.chat.AiProviderFactory.get_provider")
    @patch("backend.api.v1.chat.AiCredentialsService.resolve_credentials")
    @patch("backend.api.v1.chat.AiCredentialsService.is_ai_enabled")
    def test_context_pruning_limits_history_to_20(self, mock_is_enabled, mock_resolve, mock_get_provider):
        """Kiểm tra cơ chế Context Pruning cắt tỉa danh sách tin nhắn khi vượt quá 20 lượt."""
        mock_is_enabled.return_value = True
        mock_resolve.return_value = ("valid-key", "gemini", None)

        captured_messages = []
        mock_provider = MagicMock()

        def fake_stream(messages, *args, **kwargs):
            captured_messages.extend(messages)
            yield "Done"

        mock_provider.stream_chat.side_effect = fake_stream
        mock_get_provider.return_value = mock_provider

        # Tạo 35 tin nhắn
        many_messages = [
            ChatMessageItem(role="user" if i % 2 == 0 else "assistant", content=f"Tin nhắn {i}")
            for i in range(35)
        ]
        req = ChatStreamRequest(messages=many_messages, api_key="valid-key")
        mock_db = MagicMock()
        response = stream_chat_endpoint(request=req, db=mock_db)

        async def drain(iterator):
            async for _ in iterator:
                pass

        asyncio.run(drain(response.body_iterator))

        # Xác minh đã cắt tỉa còn 20 tin nhắn
        self.assertEqual(len(captured_messages), 20)
        # Tin nhắn đầu tiên được giữ lại làm ngữ cảnh
        self.assertEqual(captured_messages[0]["content"], "Tin nhắn 0")
        # Tin nhắn cuối cùng là tin nhắn mới nhất
        self.assertEqual(captured_messages[-1]["content"], "Tin nhắn 34")

    def test_message_content_length_validation_rejects_too_long(self):
        """Kiểm tra Pydantic từ chối tin nhắn vượt quá 10.000 ký tự."""
        from pydantic import ValidationError
        with self.assertRaises(ValidationError):
            ChatMessageItem(role="user", content="A" * 10001)


if __name__ == "__main__":
    unittest.main()
