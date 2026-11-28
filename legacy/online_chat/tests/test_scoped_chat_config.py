# 1. THƯ VIỆN NỀN TẢNG (Môi trường và kiểm thử)
# os, unittest, mock: Cô lập cấu hình và thay thế kết nối mạng.
import os
import unittest
from unittest.mock import MagicMock, patch

# 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Chat Online đã lưu trữ)
from backend.services.chat_service import ChatService
from backend.schemas.chat import ChatStreamRequest

# 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
# Không sử dụng cấu hình giao diện.


class TestScopedChatConfig(unittest.TestCase):
    """Kiểm thử phần cấu hình scoped `chat` được tách từ `tests/test_scoped_ai_config.py`."""

    def test_chat_without_project_uses_environment_model(self):
        """Chatbox không cần dự án vẫn dùng đủ bộ khóa, địa chỉ và mô hình chat riêng."""
        request = ChatStreamRequest(messages=[{"role": "user", "content": "Xin chào"}])
        provider = MagicMock()
        provider.stream_chat.return_value = iter(["Chào bạn"])
        with patch.dict(os.environ, {
            "CHAT_AI_PROVIDER": "openai", "CHAT_API_KEY": "chat-secret",
            "CHAT_BASE_URL": "https://api.deepseek.com", "CHAT_MODEL": "deepseek-chat",
        }, clear=True), patch("backend.services.chat_service.AiProviderFactory.get_provider", return_value=provider):
            self.assertEqual(list(ChatService.prepare_stream(request, MagicMock())), ["Chào bạn"])
        kwargs = provider.stream_chat.call_args.kwargs
        self.assertEqual(kwargs["api_key"], "chat-secret")
        self.assertEqual(kwargs["base_url"], "https://api.deepseek.com")
        self.assertEqual(kwargs["model"], "deepseek-chat")
