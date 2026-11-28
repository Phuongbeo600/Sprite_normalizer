# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Mã hóa, Tệp tạm & Kiểm thử)
# ========================================================
# base64, io: Tạo và giải mã dữ liệu ảnh nhị phân trong bộ nhớ
import base64
import io
# os, tempfile, pathlib: Tạo thư mục tạm cô lập khỏi tài nguyên thật trên đĩa
import os
from pathlib import Path
import tempfile
# unittest: Framework kiểm thử đơn vị và mock HTTP
import unittest
from unittest.mock import MagicMock, patch

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# Pillow: Tạo ảnh kiểm thử RGBA/JPEG và kiểm tra kết quả giải mã
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services & Schemas)
# ========================================================
# ImageGenRequest: DTO yêu cầu tạo ảnh AI
from backend.schemas.image_gen import ImageGenRequest
# ImageGenService: Dịch vụ điều phối tạo ảnh AI
from backend.services.image_gen_service import ImageGenService
# reference_image_assets: Module quét thư mục và đóng gói Ảnh tham chiếu số 2 cố định
from backend.services.reference_image_assets import (
    FIXED_REFERENCE_IMAGE_2_DIR,
    find_fixed_reference_image_2_path,
    load_fixed_reference_image_2_b64,
)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & CẤU HÌNH (Stylesheets / Config)
# ========================================================
# (Không áp dụng cho tệp kiểm thử backend)


def _encode_png_b64(size, color, mode="RGBA") -> str:
    """Tạo chuỗi Base64 PNG từ kích thước và màu sắc cho trước để dùng trong kiểm thử."""
    with io.BytesIO() as buffer:
        Image.new(mode, size, color).save(buffer, format="PNG")
        return base64.b64encode(buffer.getvalue()).decode("ascii")


class TestReferenceImage2Packaging(unittest.TestCase):
    """Kiểm thử thư mục Ảnh tham chiếu số 2 cố định và luồng gửi kèm Prompt + Ảnh 1 lên API."""

    def test_default_folder_exists_and_empty_dir_returns_none(self):
        """Thư mục lưu Ảnh 2 mặc định phải tồn tại và thư mục chưa có ảnh trả về None."""
        self.assertTrue(FIXED_REFERENCE_IMAGE_2_DIR.is_dir())
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / "README.md").write_text("docs", encoding="utf-8")
            self.assertIsNone(find_fixed_reference_image_2_path(tmp_path))
            self.assertIsNone(load_fixed_reference_image_2_b64(tmp_path))

    def test_loads_and_normalizes_fixed_image_2_with_priority_name(self):
        """Ưu tiên tên chuẩn trong thư mục và chuẩn hóa JPEG/PNG sang PNG RGBA Base64."""
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            Image.new("RGB", (6, 6), (0, 255, 0)).save(tmp_path / "aaa_other.jpg", format="JPEG")
            Image.new("RGBA", (10, 12), (10, 20, 30, 200)).save(tmp_path / "pose_layout.png", format="PNG")

            chosen = find_fixed_reference_image_2_path(tmp_path)
            self.assertIsNotNone(chosen)
            self.assertEqual(chosen.name, "pose_layout.png")

            b64_str = load_fixed_reference_image_2_b64(tmp_path)
            self.assertIsNotNone(b64_str)
            with Image.open(io.BytesIO(base64.b64decode(b64_str))) as loaded:
                self.assertEqual(loaded.format, "PNG")
                self.assertEqual(loaded.size, (10, 12))
                self.assertEqual(loaded.convert("RGBA").getpixel((0, 0)), (10, 20, 30, 200))

    def test_corrupt_image_2_raises_clear_error(self):
        """Tệp ảnh hỏng trong thư mục Ảnh 2 phải báo lỗi ValueError rõ ràng."""
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / "broken.png").write_bytes(b"not-a-valid-png")
            with self.assertRaises(ValueError) as ctx:
                load_fixed_reference_image_2_b64(tmp_path)
            self.assertIn("broken.png", str(ctx.exception))

    def test_service_sends_prompt_image1_and_fixed_image2_to_openai_edits(self):
        """Đóng gói và gửi đồng thời Prompt + Ảnh 1 + Ảnh 2 cố định qua multipart image[] của OpenAI."""
        img1_b64 = _encode_png_b64((8, 8), (255, 0, 0, 255))
        img2_b64 = _encode_png_b64((12, 12), (0, 0, 255, 255))

        mock_resp = MagicMock(status_code=200)
        mock_resp.json.return_value = {"data": [{"b64_json": img1_b64}]}

        with patch.dict(
            os.environ,
            {
                "IMAGE_GEN_PROVIDER": "openai",
                "IMAGE_GEN_API_KEY": "test-openai-key",
                "IMAGE_GEN_MODEL": "gpt-image-1.5",
            },
            clear=True,
        ), patch(
            "backend.services.image_gen_service.load_fixed_reference_image_2_b64",
            return_value=img2_b64,
        ), patch(
            "backend.providers.image_gen.openai_dalle_provider.requests.post",
            return_value=mock_resp,
        ) as post:
            req = ImageGenRequest(
                prompt="forest ranger",
                image=f"data:image/png;base64,{img1_b64}",
            )
            res = ImageGenService.generate_images(req)

        self.assertEqual(res.status, "success")
        self.assertTrue(post.call_args.args[0].endswith("/images/edits"))
        data = post.call_args.kwargs["data"]
        self.assertIn("### CHARACTER DESIGN\n\nforest ranger", data["prompt"])
        self.assertIn("### REFERENCE RULES", data["prompt"])

        files = post.call_args.kwargs["files"]
        self.assertIsInstance(files, list)
        self.assertEqual(len(files), 2)
        self.assertEqual(files[0][0], "image[]")
        self.assertEqual(files[1][0], "image[]")
        self.assertEqual(files[0][1][0], "reference_1.png")
        self.assertEqual(files[1][1][0], "reference_2.png")

        with Image.open(io.BytesIO(files[0][1][1])) as uploaded_1:
            self.assertEqual(uploaded_1.convert("RGBA").getpixel((0, 0)), (255, 0, 0, 255))
        with Image.open(io.BytesIO(files[1][1][1])) as uploaded_2:
            self.assertEqual(uploaded_2.convert("RGBA").getpixel((0, 0)), (0, 0, 255, 255))

    def test_service_sends_prompt_image1_and_fixed_image2_to_gemini_generate_content(self):
        """Gửi đồng thời Prompt + Ảnh 1 + Ảnh 2 cố định theo đúng thứ tự vào Gemini generateContent."""
        img1_b64 = _encode_png_b64((8, 8), (255, 0, 0, 255))
        img2_b64 = _encode_png_b64((12, 12), (0, 255, 0, 255))

        resp_predict_404 = MagicMock(status_code=404, text="Not found for predict")
        resp_gen_ok = MagicMock(status_code=200)
        resp_gen_ok.json.return_value = {
            "candidates": [
                {"content": {"parts": [{"inlineData": {"data": img1_b64, "mimeType": "image/png"}}]}}
            ]
        }

        with patch.dict(
            os.environ,
            {
                "IMAGE_GEN_PROVIDER": "gemini",
                "IMAGE_GEN_API_KEY": "test-gemini-key",
                "IMAGE_GEN_MODEL": "gemini-2.5-flash-image",
            },
            clear=True,
        ), patch(
            "backend.services.image_gen_service.load_fixed_reference_image_2_b64",
            return_value=img2_b64,
        ), patch(
            "backend.providers.image_gen.gemini_imagen_provider.requests.post",
            side_effect=[resp_predict_404, resp_gen_ok],
        ) as post:
            req = ImageGenRequest(
                prompt="fire knight",
                image=f"data:image/png;base64,{img1_b64}",
            )
            res = ImageGenService.generate_images(req)

        self.assertEqual(res.status, "success")
        self.assertEqual(post.call_count, 2)
        gen_call = post.call_args_list[1]
        self.assertIn(":generateContent", gen_call.args[0])
        parts = gen_call.kwargs["json"]["contents"][0]["parts"]
        self.assertEqual(len(parts), 3)
        self.assertIn("fire knight", parts[0]["text"])
        self.assertEqual(parts[1]["inline_data"]["data"], img1_b64)
        self.assertEqual(parts[2]["inline_data"]["data"], img2_b64)

    def test_service_sends_fixed_image2_even_when_image1_absent(self):
        """Nếu chỉ có Ảnh 2 cố định trong thư mục và chưa có Ảnh 1, OpenAI vẫn gửi kèm qua /images/edits."""
        img2_b64 = _encode_png_b64((12, 12), (0, 0, 255, 255))
        mock_resp = MagicMock(status_code=200)
        mock_resp.json.return_value = {"data": [{"b64_json": img2_b64}]}

        with patch.dict(
            os.environ,
            {
                "IMAGE_GEN_PROVIDER": "openai",
                "IMAGE_GEN_API_KEY": "test-openai-key",
                "IMAGE_GEN_MODEL": "gpt-image-1.5",
            },
            clear=True,
        ), patch(
            "backend.services.image_gen_service.load_fixed_reference_image_2_b64",
            return_value=img2_b64,
        ), patch(
            "backend.providers.image_gen.openai_dalle_provider.requests.post",
            return_value=mock_resp,
        ) as post:
            res = ImageGenService.generate_images(ImageGenRequest(prompt="arcane archer"))

        self.assertEqual(res.status, "success")
        self.assertTrue(post.call_args.args[0].endswith("/images/edits"))
        self.assertIn("image", post.call_args.kwargs["files"])
