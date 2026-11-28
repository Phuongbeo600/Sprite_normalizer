# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử đơn vị)
# ========================================================
# unittest: Framework kiểm thử chuẩn của Python
import unittest
# patch: Chặn HTTP và cô lập môi trường trong kiểm thử để xác nhận không có yêu cầu ra ngoài.
from unittest.mock import patch
# asyncio: Gọi các hàm xử lý bất đồng bộ của tuyến API.
import asyncio
# io: Xử lý bộ nhớ luồng ảnh giả lập
import io
# json: Mô phỏng tệp số đo của công cụ khoanh vùng.
import json
# os: Quản lý biến môi trường trong kiểm thử ngoại tuyến
import os

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# PIL (Pillow): Tạo ảnh mẫu RGBA kiểm thử
from PIL import Image
# UploadFile: Tạo tệp ảnh đầu vào giả lập cho tuyến API phân tích.
from fastapi import UploadFile

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services & Schemas)
# ========================================================
# Các tuyến phân tích ảnh hiện hành.
from backend.api.v1.sprites import analyze_character
# sprites: Gọi tuyến đo thủ công với đa giác hoặc đoạn thẳng.
from backend.api.v1 import sprites

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file test backend)


class TestCharacterProfileService(unittest.TestCase):
    """Kiểm thử phân tích sprite hiện tại và đo thủ công 11 thông số Point-to-Point."""

    def setUp(self):
        """Khởi tạo ảnh RGBA mẫu 32x48 pixel làm sprite tham chiếu kiểm thử."""
        analysis_env = patch.dict(os.environ, {
            "ANALYSIS_API_KEY": "", "ANALYSIS_AI_PROVIDER": "",
            "ANALYSIS_BASE_URL": "", "ANALYSIS_MODEL": "",
        })
        analysis_env.start()
        self.addCleanup(analysis_env.stop)
        self.old_gemini_key = os.environ.pop("GEMINI_API_KEY", None)
        self.old_openai_key = os.environ.pop("OPENAI_API_KEY", None)
        self.sample_image = Image.new("RGBA", (32, 48), color=(0, 0, 0, 0))
        for y in range(10, 40):
            for x in range(8, 24):
                self.sample_image.putpixel((x, y), (255, 100, 50, 255))

    def tearDown(self):
        """Khôi phục biến môi trường sau khi chạy kiểm thử."""
        if self.old_gemini_key is not None:
            os.environ["GEMINI_API_KEY"] = self.old_gemini_key
        if self.old_openai_key is not None:
            os.environ["OPENAI_API_KEY"] = self.old_openai_key

    def test_sprite_analysis_uses_python_measurements(self):
        """Kiểm tra số đo lát cắt và báo cáo màu qua các API hiện có."""
        split_image = self.sample_image.copy()
        split_image.paste((0, 0, 0, 0), (15, 10, 16, 40))
        image = split_image.resize((96, 144), Image.Resampling.NEAREST)
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")

        def upload():
            return UploadFile(
                io.BytesIO(buffer.getvalue()), filename="reference.png",
                headers={"content-type": "image/png"},
            )

        with (
            patch.dict(os.environ, {"GEMINI_API_KEY": "fake-key"}),
            patch("requests.sessions.Session.request") as outbound,
        ):
            colors = sprites.analyze_sprite_colors(upload())
            anatomy = asyncio.run(analyze_character(upload(), auto_remove_bg=True))
            outbound.assert_not_called()
        self.assertEqual(colors["palette_metrics"]["total_colors"], 1)
        self.assertEqual(anatomy["metrics"]["head_width"], 48)
        measured = anatomy.get("region_measurements", {})
        self.assertEqual(measured.get("measurements", {}).get("head", {}).get("width_px"), 24)

    def test_manual_measurements_point_to_point_11_metrics(self):
        """Kiểm tra endpoint /measure-regions tính 11 thông số Point-to-Point, chi gập và phần che khuất."""
        buffer = io.BytesIO()
        self.sample_image.save(buffer, format="PNG")
        buffer.seek(0)
        upload = UploadFile(buffer, filename="sprite.png", headers={"content-type": "image/png"})
        payload = {
            "image_size_px": [32, 48],
            "measurements": {
                "body_height": {"points": [[16, 4], [18, 44]]},
                "head_width": {"points": [[8, 12], [18, 20]]},
                "arm_length": {"points": [[10, 14], [10, 22], [16, 22]]},
                "arm_width": {"points": [[8, 16], [12, 18]]},
                "shoulder_width": {"occluded": True},
            },
        }
        report = sprites.measure_manual_regions(upload, json.dumps(payload))
        self.assertEqual(report["schema_version"], "point_to_point_v1")
        self.assertEqual(report["measurements"]["body_height"]["value_px"], 40.0)
        self.assertEqual(report["measurements"]["head_width"]["value_px"], 10.0)
        self.assertEqual(report["measurements"]["arm_length"]["value_px"], 14.0)
        self.assertEqual(report["measurements"]["arm_width"]["value_px"], 4.0)
        self.assertTrue(report["measurements"]["shoulder_width"]["occluded"])
        self.assertIsNone(report["raw_anatomy_metrics"]["shoulder_width"])
        self.assertGreaterEqual(len(report["keypoints"]), 9)
        self.assertIn("body height 40 px", report["prompt_notes"])


if __name__ == "__main__":
    unittest.main()
