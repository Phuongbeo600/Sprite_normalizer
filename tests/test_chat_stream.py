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


if __name__ == "__main__":
    unittest.main()
