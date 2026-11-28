# 1. THƯ VIỆN NỀN TẢNG (Môi trường và kiểm thử)
# os, unittest, mock: Cô lập khóa mặc định và cấu hình dự án.
import os
import unittest
from unittest.mock import patch
# MagicMock: Mô phỏng phản hồi HTTP để kiểm tra endpoint thực tế mà không tốn phí.
from unittest.mock import MagicMock

# 2. THƯ VIỆN BÊN NGOÀI (Ngoại lệ HTTP)
# HTTPException: Xác nhận lỗi nhập cấu hình được trả thành lỗi yêu cầu rõ ràng.
from fastapi import HTTPException

# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Điều phối tạo ảnh)
from backend.services.image_gen_service import ImageGenService
from backend.schemas.image_gen import ImageGenRequest, ImageGenResponse, GeneratedImageItem
from backend.api.v1.image_gen import get_image_gen_status

# 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Dữ liệu cấu hình giả)
DEFAULTS = {"IMAGE_GEN_PROVIDER": "openai", "IMAGE_GEN_API_KEY": "system-image-secret",
            "IMAGE_GEN_BASE_URL": "https://images.example/v1", "IMAGE_GEN_MODEL": "image-model"}


PNG_SAMPLE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg=='


def generated_response():
    return ImageGenResponse(provider_used="openai", model_used="image-model", images=[
        GeneratedImageItem(id="test", b64_data=PNG_SAMPLE, data_url=f"data:image/png;base64,{PNG_SAMPLE}")])


class TestImageGenDefaults(unittest.TestCase):
    """Bảo đảm tạo ảnh ưu tiên key dự án và báo đúng nguồn cấu hình."""

    def test_default_config_is_complete_and_does_not_expose_system_key(self):
        """Dự án chưa nhập key dùng trọn bộ cấu hình hệ thống, không lộ khóa."""
        with patch.dict(os.environ, DEFAULTS, clear=True):
            self.assertEqual(ImageGenService.resolve_credentials(),
                             ("system-image-secret", "openai", "https://images.example/v1"))
            status = ImageGenService.get_status()
        self.assertTrue(status["ready"])
        self.assertEqual(status["config_source"], "system")
        self.assertEqual(status["model"], "image-model")
        self.assertEqual(status["masked_key"], "")
        self.assertNotIn("system-image-secret", str(status))

    def test_untouched_project_uses_system_provider(self):
        """Provider mặc định Gemini trong CSDL không ghi đè mặc định OpenAI của hệ thống."""
        with patch.dict(os.environ, DEFAULTS, clear=True), patch(
            "backend.services.project_service.ProjectService.get_api_config",
            return_value={"api_provider": "gemini", "openai_base_url": "https://api.openai.com/v1"},
        ), patch("backend.services.ai_credentials_service.SessionLocal"):
            self.assertEqual(ImageGenService.resolve_credentials(project_id=9),
                             ("system-image-secret", "openai", "https://images.example/v1"))

    def test_project_key_overrides_entire_system_config(self):
        """Key riêng được ưu tiên cùng provider, địa chỉ và model riêng."""
        cfg = {"api_provider": "gemini", "_gemini_raw_key": "project-gemini-key", "image_gen_model": "project-model"}
        with patch.dict(os.environ, DEFAULTS, clear=True), patch(
            "backend.services.project_service.ProjectService.get_api_config", return_value=cfg,
        ), patch("backend.services.ai_credentials_service.SessionLocal"):
            key, provider, base = ImageGenService.resolve_credentials(project_id=9)
            status = ImageGenService.get_status(project_id=9)
        self.assertEqual((key, provider), ("project-gemini-key", "gemini"))
        self.assertNotEqual(base, "https://images.example/v1")
        self.assertEqual(status["config_source"], "project")
        self.assertEqual(status["model"], "project-model")

    def test_explicit_key_wins_and_never_borrows_other_provider_endpoint(self):
        """Tham số trực tiếp thắng key mặc định, không trộn nhà cung cấp."""
        with patch.dict(os.environ, DEFAULTS, clear=True):
            key, provider, base = ImageGenService.resolve_credentials(api_key="direct-key", provider="gemini")
        self.assertEqual((key, provider), ("direct-key", "gemini"))
        self.assertNotEqual(base, "https://images.example/v1")

    def test_generation_without_project_uses_default_model(self):
        """Mô hình mặc định được truyền đến provider ngay cả khi chưa mở dự án."""
        with patch.dict(os.environ, DEFAULTS, clear=True), patch(
            "backend.providers.image_gen.OpenAiDalleProvider.generate_images", return_value=generated_response(),
        ) as generate:
            result = ImageGenService.generate_images(ImageGenRequest(prompt="Sprite"))
        self.assertEqual(result.status, "success")
        self.assertEqual(generate.call_args.kwargs["api_key"], "system-image-secret")
        self.assertEqual(generate.call_args.kwargs["model"], "image-model")

    def test_empty_defaults_preserve_legacy_environment(self):
        """Chưa cấu hình IMAGE_GEN vẫn tương thích biến môi trường cũ."""
        with patch.dict(os.environ, {"AI_PROVIDER": "gemini", "GEMINI_API_KEY": "legacy-gemini"}, clear=True):
            key, provider, _ = ImageGenService.resolve_credentials()
        self.assertEqual((key, provider), ("legacy-gemini", "gemini"))

    def test_inactive_project_key_does_not_change_system_model(self):
        """Key cũ của provider không được chọn không làm lệch model giữa trạng thái và tạo ảnh."""
        cfg = {"api_provider": "gemini", "_openai_raw_key": "inactive-key", "image_gen_model": "inactive-model"}
        with patch.dict(os.environ, DEFAULTS, clear=True), patch(
            "backend.services.project_service.ProjectService.get_api_config", return_value=cfg,
        ), patch("backend.services.ai_credentials_service.SessionLocal"), patch(
            "backend.providers.image_gen.OpenAiDalleProvider.generate_images", return_value=generated_response(),
        ) as generate:
            ImageGenService.generate_images(ImageGenRequest(project_id=9, prompt="Sprite"))
        self.assertEqual(generate.call_args.kwargs["api_key"], "system-image-secret")
        self.assertEqual(generate.call_args.kwargs["model"], "image-model")

    def test_system_key_respects_project_ai_switch(self):
        """Key mặc định không tự bật lại tạo ảnh khi người dùng chủ động tắt AI."""
        cfg = {"api_provider": "gemini", "ai_enabled": False}
        with patch.dict(os.environ, DEFAULTS, clear=True), patch(
            "backend.services.project_service.ProjectService.get_api_config", return_value=cfg,
        ), patch("backend.services.ai_credentials_service.SessionLocal"):
            status = ImageGenService.get_status(project_id=9)
        self.assertEqual(status["config_source"], "system")
        self.assertFalse(status["ready"])

    def test_openai_compatible_service_uses_configured_endpoint_and_model(self):
        """Dịch vụ bên thứ ba dùng nguyên URL, key và model cấu hình trong môi trường."""
        response = MagicMock(status_code=200)
        response.json.return_value = {"data": [{"b64_json": PNG_SAMPLE}]}
        with patch.dict(os.environ, DEFAULTS, clear=True), patch(
            "backend.services.image_gen_service.load_fixed_reference_image_2_b64", return_value=None,
        ), patch(
            "backend.providers.image_gen.base._post", return_value=response,
        ) as post:
            result = ImageGenService.generate_images(ImageGenRequest(prompt="Sprite"))
        self.assertEqual(result.status, "success")
        self.assertEqual(post.call_args.args[0], "https://images.example/v1/images/generations")
        self.assertEqual(post.call_args.kwargs["json"]["model"], "image-model")
        self.assertEqual(post.call_args.kwargs["headers"]["Authorization"], "Bearer system-image-secret")

    def test_api_key_in_model_is_rejected_without_exposing_it(self):
        """Nhập nhầm key vào model phải báo đúng trường và không đưa key ra trạng thái công khai."""
        secret = "sk-proj-test-secret-not-a-model"
        with patch.dict(os.environ, {**DEFAULTS, "IMAGE_GEN_MODEL": secret}, clear=True):
            with self.assertRaises(ValueError) as error:
                ImageGenService.get_status()
        self.assertIn("IMAGE_GEN_MODEL", str(error.exception))
        self.assertNotIn(secret, str(error.exception))

    def test_google_provider_rejects_openai_key_without_exposing_it(self):
        """Cấu hình nhầm key OpenAI cho Google phải chỉ rõ cách sửa trước khi gọi mạng."""
        secret = "sk-proj-test-image-key"
        with patch.dict(os.environ, {"IMAGE_GEN_PROVIDER": "gemini", "IMAGE_GEN_API_KEY": secret}, clear=True):
            with self.assertRaises(ValueError) as error:
                ImageGenService.get_status()
        self.assertIn("IMAGE_GEN_PROVIDER", str(error.exception))
        self.assertNotIn(secret, str(error.exception))

    def test_status_route_reports_invalid_config_without_secret(self):
        """Tuyến trạng thái trả HTTP 400 và thông báo an toàn khi model bị nhập nhầm key."""
        secret = "sk-proj-invalid-model-secret"
        with patch.dict(os.environ, {**DEFAULTS, "IMAGE_GEN_MODEL": secret}, clear=True):
            with self.assertRaises(HTTPException) as error:
                get_image_gen_status(project_id=None, current_user=None, db=MagicMock())
        self.assertEqual(error.exception.status_code, 400)
        self.assertIn("IMAGE_GEN_MODEL", error.exception.detail)
        self.assertNotIn(secret, error.exception.detail)
