# 1. THƯ VIỆN NỀN TẢNG (Môi trường và kiểm thử)
# os, unittest, mock: Cô lập cấu hình và thay thế kết nối mạng.
import os
import unittest
from unittest.mock import MagicMock, patch

# 2. THƯ VIỆN BÊN NGOÀI (Ảnh kiểm thử)
# Pillow: Tạo ảnh sprite trong bộ nhớ.
from PIL import Image

# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Cấu hình và nhà cung cấp)
from backend.services.ai_credentials_service import AiCredentialsService
from backend.providers.openai_provider import OpenAiProvider
# ChatService và schema: Kiểm tra cấu hình xuyên suốt đến lời gọi hội thoại.
from backend.services.chat_service import ChatService
from backend.schemas.chat import ChatStreamRequest

# 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
# Không sử dụng cấu hình giao diện.


class TestScopedAiConfig(unittest.TestCase):
    """Bảo vệ sự độc lập cấu hình và khả năng gửi ảnh an toàn."""

    def test_scopes_override_project_and_resolve_models(self):
        """Mỗi nghiệp vụ dùng trọn bộ cấu hình riêng trước cấu hình dự án."""
        env = {
            "CHAT_AI_PROVIDER": "openai", "CHAT_API_KEY": "chat-secret",
            "CHAT_BASE_URL": "https://api.deepseek.com", "CHAT_MODEL": "deepseek-chat",
            "ANALYSIS_AI_PROVIDER": "openai", "ANALYSIS_API_KEY": "analysis-secret",
            "ANALYSIS_BASE_URL": "https://analysis.example/v1", "ANALYSIS_MODEL": "vision-model",
        }
        service = MagicMock()
        service.resolve_project_credentials.return_value = ("db-key", "gemini", None)
        with patch.dict(os.environ, env, clear=True):
            for scope, key, base, model in (
                ("chat", "chat-secret", "https://api.deepseek.com", "deepseek-chat"),
                ("analysis", "analysis-secret", "https://analysis.example/v1", "vision-model"),
            ):
                self.assertEqual(AiCredentialsService.resolve_credentials(
                    project_id=7, db=MagicMock(), project_service=service, scope=scope,
                ), (key, "openai", base))
                self.assertEqual(AiCredentialsService.resolve_model(
                    provider="openai", scope=scope,
                ), model)

    def test_empty_scope_falls_back_and_explicit_values_win(self):
        """Biến trống dùng cấu hình chung, tham số trực tiếp vẫn có ưu tiên cao nhất."""
        with patch.dict(os.environ, {
            "CHAT_API_KEY": "  ", "AI_PROVIDER": "openai", "OPENAI_API_KEY": "general-key",
            "OPENAI_BASE_URL": "https://general.example/v1", "OPENAI_MODEL": "general-model",
        }, clear=True):
            self.assertEqual(AiCredentialsService.resolve_credentials(scope="chat"),
                             ("general-key", "openai", "https://general.example/v1"))
            self.assertEqual(AiCredentialsService.resolve_model(scope="chat"), "general-model")
            self.assertEqual(AiCredentialsService.resolve_credentials(
                api_key="direct", provider="openai", base_url="https://direct.example", scope="chat",
            ), ("direct", "openai", "https://direct.example"))

    def test_environment_key_enables_only_its_scope(self):
        """Khóa Chatbox hợp lệ vượt cờ tắt, không kích hoạt nhầm phân tích."""
        service = MagicMock()
        service.get_api_config.return_value = {"ai_enabled": False}
        with patch.dict(os.environ, {"CHAT_API_KEY": "chat-secret"}, clear=True):
            self.assertTrue(AiCredentialsService.is_ai_enabled(
                7, db=MagicMock(), project_service=service, scope="chat"))
            self.assertFalse(AiCredentialsService.is_ai_enabled(
                7, db=MagicMock(), project_service=service, scope="analysis"))

    def test_explicit_credentials_override_full_scope(self):
        """Cấu hình trực tiếp thay được cả khóa, nhà cung cấp và địa chỉ mặc định."""
        with patch.dict(os.environ, {
            "CHAT_AI_PROVIDER": "openai", "CHAT_API_KEY": "scope-secret",
            "CHAT_BASE_URL": "https://api.deepseek.com", "CHAT_MODEL": "deepseek-chat",
        }, clear=True):
            self.assertEqual(AiCredentialsService.resolve_credentials(
                api_key="direct", provider="gemini", base_url="https://direct.example", scope="chat",
            ), ("direct", "gemini", "https://direct.example"))
            self.assertEqual(AiCredentialsService.resolve_model(model="direct-model", scope="chat"), "direct-model")

    def test_scoped_provider_uses_legacy_key_to_enable_ai(self):
        """Khóa chung của nhà cung cấp nghiệp vụ phải vượt cờ tắt dự án."""
        service = MagicMock()
        service.get_api_config.return_value = {"ai_enabled": False}
        with patch.dict(os.environ, {
            "AI_PROVIDER": "gemini", "OPENAI_API_KEY": "legacy-openai-key",
            "CHAT_AI_PROVIDER": "openai", "ANALYSIS_AI_PROVIDER": "openai",
        }, clear=True):
            for scope in ("chat", "analysis"):
                self.assertTrue(AiCredentialsService.is_ai_enabled(
                    7, db=MagicMock(), project_service=service, scope=scope))

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

    def test_empty_image_has_no_invented_geometry(self):
        """Ảnh trong suốt không gây lỗi và không sinh tọa độ cổ giả."""
        description = OpenAiProvider._describe_image_metrics(Image.new("RGBA", (4, 6)))
        self.assertIn('"neck_y": null', description)
        self.assertIn('"sampled_colors": []', description)

    def test_deepseek_receives_metrics_as_text(self):
        """DeepSeek nhận JSON và số đo ảnh thuần văn bản, không nhận image_url."""
        image = Image.new("RGBA", (16, 24))
        image.paste((255, 0, 0, 255), (4, 2, 12, 22))
        response = MagicMock(status_code=200)
        response.json.return_value = {"choices": [{"message": {"content": '{"result": "ok"}'}}]}
        with patch("backend.providers.openai_provider.requests.post", return_value=response) as post:
            result = OpenAiProvider().analyze_vision(image, "secret", "Return JSON", "https://api.deepseek.com/v1")
        self.assertEqual(result["result"], "ok")
        payload = post.call_args.kwargs["json"]
        self.assertEqual(payload["model"], "deepseek-chat")
        content = payload["messages"][0]["content"]
        self.assertIsInstance(content, str)
        for metric in ("HSV", "16", "24", "neck_y", "JSON"):
            self.assertIn(metric, content)

    def test_other_hosts_keep_base64_images(self):
        """Máy chủ hỗ trợ thị giác vẫn nhận ảnh Base64 nguyên vẹn."""
        provider = OpenAiProvider()
        with patch.object(provider, "_execute_chat_completions", return_value={}) as execute:
            provider.analyze_vision(Image.new("RGBA", (2, 2)), "secret", "JSON", "https://api.deepseek.com.example/v1")
        content = execute.call_args.kwargs["messages"][0]["content"]
        self.assertEqual(content[1]["type"], "image_url")
        self.assertTrue(content[1]["image_url"]["url"].startswith("data:image/png;base64,"))
