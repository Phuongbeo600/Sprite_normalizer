# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử, Môi trường & Giả lập)
# ========================================================
# sys, os: Thiết lập đường dẫn module gốc cho kiểm thử
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
# unittest: Framework kiểm thử đơn vị tiêu chuẩn
import unittest
# patch, MagicMock: Giả lập các cuộc gọi HTTP requests độc lập
from unittest.mock import patch, MagicMock

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# PIL (Pillow): Tạo ảnh mẫu giả lập cho kiểm thử phân tích thị giác
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Providers, Services & Schemas)
# ========================================================
# Image Gen Providers & Factory
from backend.providers.image_gen import (
    BaseImageGenProvider,
    GeminiImagenProvider,
    OpenAiDalleProvider,
    ImageGenProviderFactory
)
# Vision & Text Providers
from backend.providers.gemini_provider import GeminiProvider
from backend.providers.openai_provider import OpenAiProvider
# ImageGenService: Dịch vụ điều phối tạo ảnh
from backend.services.image_gen_service import ImageGenService
# Schemas
from backend.schemas.image_gen import ImageGenRequest, ImageGenResponse

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file test backend)


class TestGeminiImagenProvider(unittest.TestCase):
    """
    Bộ kiểm thử đơn vị cho GeminiImagenProvider:
    - Tạo ảnh thành công qua Google Imagen 3 API.
    - Cơ chế tự động xoay vòng sang model dự phòng (Fallback loop).
    - Xử lý chính xác các trường hợp vi phạm bộ lọc an toàn (SAFETY).
    - Phân loại đúng các lỗi mã trạng thái 401, 403, 429 và Timeout 60s.
    """

    def setUp(self):
        self.provider = GeminiImagenProvider()

    @patch("requests.post")
    def test_generate_images_success(self, mock_post):
        """Kiểm tra tạo ảnh thành công khi Google Imagen 3 phản hồi 200 OK."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "predictions": [
                {"bytesBase64Encoded": "fake_b64_img_1", "mimeType": "image/png"},
                {"bytesBase64Encoded": "fake_b64_img_2", "mimeType": "image/png"}
            ]
        }
        mock_post.return_value = mock_resp

        res = self.provider.generate_images(
            api_key="valid-gemini-key",
            prompt="pixel art knight",
            negative_prompt="blurry, modern",
            aspect_ratio="16:9",
            number_of_images=2
        )

        self.assertIsInstance(res, ImageGenResponse)
        self.assertEqual(res.status, "success")
        self.assertEqual(len(res.images), 2)
        self.assertEqual(res.images[0].b64_data, "fake_b64_img_1")
        self.assertEqual(res.provider_used, "gemini")
        self.assertEqual(res.model_used, "imagen-3.0-generate-002")

    @patch("requests.post")
    def test_model_fallback_loop(self, mock_post):
        """Kiểm tra tự động chuyển sang model thứ hai khi model đầu tiên bị lỗi 500."""
        resp_fail = MagicMock()
        resp_fail.status_code = 500
        resp_fail.text = "Internal Server Error"

        resp_success = MagicMock()
        resp_success.status_code = 200
        resp_success.json.return_value = {
            "predictions": [{"bytesBase64Encoded": "fallback_b64", "mimeType": "image/png"}]
        }
        mock_post.side_effect = [resp_fail, resp_success]

        res = self.provider.generate_images(
            api_key="key",
            prompt="warrior",
            number_of_images=1
        )
        self.assertEqual(res.status, "success")
        self.assertEqual(res.model_used, "imagen-3.0-fast-generate-001")
        self.assertEqual(mock_post.call_count, 2)

    @patch("requests.post")
    def test_safety_filter_error(self, mock_post):
        """Kiểm tra phát hiện lỗi vi phạm bộ lọc an toàn nội dung (Safety Filter)."""
        mock_resp = MagicMock()
        mock_resp.status_code = 400
        mock_resp.text = '{"error": "SAFETY: Prompt was blocked by content filter"}'
        mock_post.return_value = mock_resp

        with self.assertRaises(ValueError) as ctx:
            self.provider.generate_images(api_key="key", prompt="inappropriate")
        self.assertIn("bộ lọc an toàn nội dung", str(ctx.exception))

    @patch("requests.post")
    def test_quota_limit_error(self, mock_post):
        """Kiểm tra bắt lỗi hạn mức Rate Limit 429."""
        mock_resp = MagicMock()
        mock_resp.status_code = 429
        mock_resp.text = "Resource has been exhausted"
        mock_post.return_value = mock_resp

        with self.assertRaises(ValueError) as ctx:
            self.provider.generate_images(api_key="key", prompt="archer")
        self.assertIn("Rate Limit", str(ctx.exception))


class TestOpenAiDalleProvider(unittest.TestCase):
    """
    Bộ kiểm thử đơn vị cho OpenAiDalleProvider:
    - Tạo ảnh thành công qua OpenAI DALL-E 3 (b64_json).
    - Tải ảnh fallback từ URL sang Base64 khi proxy không trả b64_json.
    - Ánh xạ đúng tỉ lệ kích thước (1024x1792, 1792x1024, 1024x1024).
    - Xử lý lỗi chính sách nội dung (content_policy_violation) và quota 429.
    """

    def setUp(self):
        self.provider = OpenAiDalleProvider()

    @patch("requests.post")
    def test_generate_images_b64_success(self, mock_post):
        """Kiểm tra tạo ảnh thành công trả về chuỗi b64_json trực tiếp."""
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "data": [{"b64_json": "openai_dalle_b64_data"}]
        }
        mock_post.return_value = mock_resp

        res = self.provider.generate_images(
            api_key="sk-test-key",
            prompt="cyberpunk sprite",
            aspect_ratio="3:4",
            number_of_images=1
        )
        self.assertEqual(res.status, "success")
        self.assertEqual(res.provider_used, "openai")
        self.assertEqual(res.model_used, "dall-e-3")
        self.assertEqual(res.images[0].b64_data, "openai_dalle_b64_data")

    @patch("requests.get")
    @patch("requests.post")
    def test_generate_images_url_fallback(self, mock_post, mock_get):
        """Kiểm tra cơ chế tải fallback khi proxy trả về link URL ảnh thay vì b64_json."""
        mock_post_resp = MagicMock()
        mock_post_resp.status_code = 200
        mock_post_resp.json.return_value = {
            "data": [{"url": "https://images.proxy.com/sample.png"}]
        }
        mock_post.return_value = mock_post_resp

        mock_get_resp = MagicMock()
        mock_get_resp.status_code = 200
        mock_get_resp.content = b"fake_png_binary_bytes"
        mock_get.return_value = mock_get_resp

        res = self.provider.generate_images(
            api_key="sk-test-key",
            prompt="wizard sprite",
            aspect_ratio="1:1"
        )
        self.assertEqual(res.status, "success")
        mock_get.assert_called_once_with("https://images.proxy.com/sample.png", timeout=30)
        self.assertTrue(len(res.images[0].b64_data) > 0)

    @patch("requests.post")
    def test_content_policy_violation(self, mock_post):
        """Kiểm tra bắt lỗi chính sách nội dung của OpenAI."""
        mock_resp = MagicMock()
        mock_resp.status_code = 400
        mock_resp.text = '{"error": {"code": "content_policy_violation"}}'
        mock_post.return_value = mock_resp

        with self.assertRaises(ValueError) as ctx:
            self.provider.generate_images(api_key="key", prompt="nsfw prompt")
        self.assertIn("chính sách an toàn nội dung", str(ctx.exception))


class TestImageGenProviderFactory(unittest.TestCase):
    """
    Bộ kiểm thử đơn vị cho ImageGenProviderFactory:
    - Lấy đúng Provider theo tên ('gemini', 'openai').
    - Fallback về GeminiImagenProvider khi tên không xác định.
    - Khả năng mở rộng đăng ký Provider mới (Open-Closed Principle).
    """

    def test_get_providers(self):
        gemini = ImageGenProviderFactory.get_provider("gemini")
        self.assertIsInstance(gemini, GeminiImagenProvider)

        openai = ImageGenProviderFactory.get_provider("openai")
        self.assertIsInstance(openai, OpenAiDalleProvider)

        fallback = ImageGenProviderFactory.get_provider("unknown_provider")
        self.assertIsInstance(fallback, GeminiImagenProvider)

    def test_register_new_provider(self):
        class MockCustomProvider(BaseImageGenProvider):
            def generate_images(self, *args, **kwargs):
                return ImageGenResponse(status="success", message="custom", provider_used="custom", model_used="c1", images=[])

        ImageGenProviderFactory.register("custom_provider", MockCustomProvider)
        instance = ImageGenProviderFactory.get_provider("custom_provider")
        self.assertIsInstance(instance, MockCustomProvider)


class TestImageGenService(unittest.TestCase):
    """
    Bộ kiểm thử đơn vị cho ImageGenService:
    - Điều phối luồng tạo ảnh qua Factory.
    - Kiểm tra công tắc ai_enabled và bắt lỗi khi tắt.
    - Bắt lỗi khi thiếu API Key.
    - Ghép style_preset và negative_prompt chuẩn xác.
    """

    @patch("backend.services.ai_credentials_service.AiCredentialsService.is_ai_enabled", return_value=False)
    def test_ai_disabled_raises_error(self, mock_ai_enabled):
        """Bắt buộc báo lỗi nếu tính năng AI của dự án đang bị tắt."""
        req = ImageGenRequest(project_id=1, prompt="warrior")
        with self.assertRaises(ValueError) as ctx:
            ImageGenService.generate_images(req)
        self.assertIn("Tính năng AI hiện đang bị tắt", str(ctx.exception))

    @patch("backend.services.ai_credentials_service.AiCredentialsService.is_ai_enabled", return_value=True)
    @patch.object(ImageGenService, "resolve_credentials", return_value=(None, "gemini", None))
    def test_missing_key_raises_error(self, mock_resolve, mock_ai_enabled):
        """Bắt buộc báo lỗi khi chưa cấu hình API Key."""
        req = ImageGenRequest(project_id=1, prompt="mage")
        with self.assertRaises(ValueError) as ctx:
            ImageGenService.generate_images(req)
        self.assertIn("Chưa cấu hình API Key", str(ctx.exception))

    @patch("backend.services.ai_credentials_service.AiCredentialsService.is_ai_enabled", return_value=True)
    @patch.object(ImageGenService, "resolve_credentials", return_value=("test-key-123", "gemini", None))
    @patch.object(GeminiImagenProvider, "generate_images")
    def test_orchestration_delegates_to_provider(self, mock_gemini_gen, mock_resolve, mock_ai_enabled):
        """Kiểm tra điều phối ghép style_preset và ủy quyền thành công sang GeminiImagenProvider."""
        mock_gemini_gen.return_value = ImageGenResponse(
            status="success",
            message="OK",
            provider_used="gemini",
            model_used="imagen-3.0-generate-002",
            images=[]
        )

        req = ImageGenRequest(
            project_id=1,
            prompt="goblin",
            style_preset="16-bit RPG",
            negative_prompt="modern, 3D",
            aspect_ratio="1:1",
            number_of_images=1
        )
        res = ImageGenService.generate_images(req)

        self.assertEqual(res.status, "success")
        mock_gemini_gen.assert_called_once_with(
            api_key="test-key-123",
            prompt="goblin, Style: 16-bit RPG",
            negative_prompt="modern, 3D",
            aspect_ratio="1:1",
            number_of_images=1,
            base_url=None
        )


class TestVisionAndTextProviders(unittest.TestCase):
    """
    Bộ kiểm thử đơn vị cho GeminiProvider và OpenAiProvider (Vision & Text):
    - Kiểm tra test_connection.
    - Kiểm tra helper bóc tách JSON và tự động gán model_used.
    """

    def setUp(self):
        self.gemini = GeminiProvider()
        self.openai = OpenAiProvider()
        self.dummy_image = Image.new("RGBA", (32, 48), color="red")

    @patch("requests.post")
    def test_gemini_connection(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_post.return_value = mock_resp
        ok, msg = self.gemini.test_connection("valid-key")
        self.assertTrue(ok)
        self.assertIn("thành công", msg)

    @patch("requests.post")
    def test_gemini_analyze_vision(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "candidates": [
                {"content": {"parts": [{"text": '{"box_2d": [0, 0, 32, 48]}'}]}}
            ]
        }
        mock_post.return_value = mock_resp

        data = self.gemini.analyze_vision(self.dummy_image, "gemini-key", "analyze")
        self.assertEqual(data["box_2d"], [0, 0, 32, 48])
        self.assertEqual(data["model_used"], "gemini-flash-lite-latest")

    @patch("requests.post")
    def test_openai_connection(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_post.return_value = mock_resp
        ok, msg = self.openai.test_connection("valid-key")
        self.assertTrue(ok)
        self.assertIn("thành công", msg)

    @patch("requests.post")
    def test_openai_generate_json(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": '{"prompt": "pixel hero"}'}}]
        }
        mock_post.return_value = mock_resp

        data = self.openai.generate_json("generate prompt", "openai-key")
        self.assertEqual(data["prompt"], "pixel hero")
        self.assertIn("OpenAI", data["model_used"])


if __name__ == "__main__":
    unittest.main()
