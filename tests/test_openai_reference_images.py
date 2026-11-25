# 1. THƯ VIỆN NỀN TẢNG (Mã hóa ảnh và kiểm thử)
# base64, io: Tạo ảnh tham chiếu có thể kiểm tra nội dung nhị phân.
import base64
import io
# os, unittest, mock: Cô lập môi trường và chặn toàn bộ HTTP thật.
import os
import unittest
from unittest.mock import MagicMock, patch

# 2. THƯ VIỆN BÊN NGOÀI (Ảnh và ngoại lệ HTTP)
# Pillow: Tạo và xác minh ảnh; requests: Giả lập hết thời gian chờ.
from PIL import Image
import requests

# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Provider và điều phối)
from backend.providers.image_gen import OpenAiDalleProvider
from backend.services.image_gen_service import ImageGenService
from backend.schemas.image_gen import ImageGenRequest

# 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)


class TestOpenAiReferenceImages(unittest.TestCase):
    """Bảo vệ ảnh thật, prompt và negative trên đường gửi đến dịch vụ tạo ảnh."""

    def setUp(self):
        """Tạo ảnh PNG nhỏ và phản hồi API giả, không dùng khóa hay mạng thật."""
        self.provider = OpenAiDalleProvider()
        with io.BytesIO() as buffer:
            Image.new("RGBA", (8, 8), (255, 0, 0, 255)).save(buffer, format="PNG")
            self.image = base64.b64encode(buffer.getvalue()).decode("ascii")
        self.response = MagicMock(status_code=200)
        self.response.json.return_value = {"data": [{"b64_json": self.image}]}

    def test_reference_prompt_negative_and_custom_model_reach_edits(self):
        """Yêu cầu có ảnh dùng multipart edits với đúng ảnh, prompt, negative và model tùy chỉnh."""
        with patch("requests.post", return_value=self.response) as post:
            result = self.provider.generate_images("test-key", "pixel knight", "blur, extra arms",
                image=self.image, base_url="https://proxy.example/v1/", model="custom-image-model")
        self.assertEqual(result.status, "success")
        self.assertEqual(post.call_count, 1)
        self.assertEqual(post.call_args.args[0], "https://proxy.example/v1/images/edits")
        kwargs = post.call_args.kwargs
        self.assertNotIn("json", kwargs)
        self.assertNotIn("Content-Type", kwargs["headers"])
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test-key")
        self.assertEqual(kwargs["data"]["model"], "custom-image-model")
        for text in ("pixel knight", "blur, extra arms"):
            self.assertIn(text, kwargs["data"]["prompt"])
        name, raw, mime = kwargs["files"]["image"]
        self.assertEqual((name, mime), ("reference.png", "image/png"))
        with Image.open(io.BytesIO(raw)) as actual:
            self.assertEqual(actual.size, (8, 8))
            self.assertEqual(actual.convert("RGBA").getpixel((0, 0)), (255, 0, 0, 255))

    def test_default_model_receives_reference(self):
        """Model mặc định không được bỏ qua ảnh như luồng cũ."""
        with patch("requests.post", return_value=self.response) as post:
            self.provider.generate_images("test-key", "sprite", image=self.image)
        self.assertTrue(post.call_args.args[0].endswith("/images/edits"))
        self.assertEqual(post.call_args.kwargs["data"]["model"], self.provider.DEFAULT_MODEL)

    def test_no_reference_keeps_generations_and_negative(self):
        """Không có ảnh vẫn dùng JSON generations và giữ nguyên negative."""
        with patch("requests.post", return_value=self.response) as post:
            self.provider.generate_images("test-key", "sprite", "blurry")
        self.assertTrue(post.call_args.args[0].endswith("/images/generations"))
        self.assertIn("blurry", post.call_args.kwargs["json"]["prompt"])
        self.assertNotIn("files", post.call_args.kwargs)

    def test_reference_errors_never_fall_back_to_text_generation(self):
        """Lỗi API có ảnh không tạo yêu cầu thứ hai chỉ có văn bản."""
        for status in (400, 401, 404, 422, 429, 500):
            with self.subTest(status=status):
                response = MagicMock(status_code=status, text='{"error":{"message":"Unsupported edit"}}')
                with patch("requests.post", return_value=response) as post:
                    with self.assertRaises((ValueError, RuntimeError)):
                        self.provider.generate_images("test-key", "sprite", image=self.image, model="dall-e-2")
                self.assertEqual(post.call_count, 1)
                self.assertTrue(post.call_args.args[0].endswith("/images/edits"))

    def test_empty_edit_result_is_an_error(self):
        """Phản hồi không có ảnh phải báo lỗi, không đổi sang generations."""
        self.response.json.return_value = {"data": []}
        with patch("requests.post", return_value=self.response) as post:
            with self.assertRaises(ValueError):
                self.provider.generate_images("test-key", "sprite", image=self.image, model="dall-e-2")
        self.assertEqual(post.call_count, 1)

    def test_reference_timeout_never_falls_back(self):
        """Hết thời gian chờ ảnh mẫu không phát sinh thêm yêu cầu tốn phí."""
        with patch("requests.post", side_effect=requests.exceptions.Timeout) as post:
            with self.assertRaises(RuntimeError):
                self.provider.generate_images("test-key", "sprite", image=self.image, model="dall-e-2")
        self.assertEqual(post.call_count, 1)

    def test_invalid_reference_does_not_call_api(self):
        """Ảnh hỏng bị chặn trước HTTP thay vì bị bỏ qua."""
        for image in ("invalid!!", base64.b64encode(b"not an image").decode("ascii")):
            with self.subTest(image=image), patch("requests.post", return_value=self.response) as post:
                with self.assertRaises(ValueError):
                    self.provider.generate_images("test-key", "sprite", image=image)
                post.assert_not_called()

    def test_jpeg_data_url_is_uploaded_as_valid_png(self):
        """Ảnh JPEG tải lên không bị gắn nhãn PNG sai định dạng."""
        with io.BytesIO() as buffer:
            Image.new("RGB", (4, 6), "blue").save(buffer, format="JPEG")
            image = "data:image/jpeg;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
        with patch("requests.post", return_value=self.response) as post:
            self.provider.generate_images("test-key", "sprite", image=image)
        raw = post.call_args.kwargs["files"]["image"][1]
        with Image.open(io.BytesIO(raw)) as uploaded:
            self.assertEqual(uploaded.format, "PNG")
            self.assertEqual(uploaded.size, (4, 6))

    def test_service_delivers_all_inputs_to_real_provider_transport(self):
        """Kiểm tra xuyên suốt từ DTO qua service đến multipart HTTP của provider."""
        with patch.dict(os.environ, {"IMAGE_GEN_PROVIDER": "openai", "IMAGE_GEN_API_KEY": "test-key",
            "IMAGE_GEN_BASE_URL": "https://proxy.example/v1", "IMAGE_GEN_MODEL": "custom-model"}, clear=True), patch(
            "requests.post", return_value=self.response,
        ) as post:
            ImageGenService.generate_images(ImageGenRequest(prompt="pixel knight", negative_prompt="blurry",
                image="data:image/png;base64," + self.image))
        self.assertIn("pixel knight", post.call_args.kwargs["data"]["prompt"])
        self.assertIn("blurry", post.call_args.kwargs["data"]["prompt"])
        self.assertIn("ảnh mẫu tham chiếu", post.call_args.kwargs["data"]["prompt"])
        self.assertEqual(post.call_args.kwargs["data"]["model"], "custom-model")
        self.assertTrue(post.call_args.kwargs["files"]["image"][1])
