"""Kiểm tra PNG thu nhỏ và các frame tách từ sprite sheet."""

# 1. THƯ VIỆN NỀN TẢNG PYTHON
# io, unittest, zipfile: Đọc ảnh và ZIP trong bộ nhớ để kiểm tra.
import io
import unittest
from base64 import b64decode
from zipfile import ZipFile

# 2. THƯ VIỆN BÊN NGOÀI
# FastAPI và Pillow: Tạo tệp tải lên và ảnh mẫu.
from fastapi import HTTPException, UploadFile
from PIL import Image

# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
# sprites: Các tuyến xử lý ảnh dùng trong bàn chỉnh.
from backend.api.v1 import sprites

# 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC
# Không áp dụng cho kiểm thử backend.


def upload(image):
    """Đóng gói ảnh mẫu thành tệp PNG tải lên."""
    bitmap = io.BytesIO()
    image.save(bitmap, format="PNG")
    bitmap.seek(0)
    return UploadFile(bitmap, filename="source.png")


class TestSpriteWorkspace(unittest.TestCase):
    def test_detect_native_grid_and_restore_original_pixels(self):
        """Nhận diện ảnh phóng 3 lần, khôi phục đúng ảnh và viền trong suốt."""
        original = Image.new("RGBA", (12, 10))
        for y in range(1, 9):
            for x in range(1, 11):
                original.putpixel((x, y), (x * 23, y * 27, 200, 255))
        enlarged = original.resize((36, 30), Image.Resampling.NEAREST)
        result = sprites.detect_sprite_resolution(upload(enlarged))
        self.assertEqual((result["width"], result["height"], result["scale"]), (12, 10, 3))
        with Image.open(io.BytesIO(b64decode(result["png"]))) as restored:
            self.assertEqual(restored.tobytes(), original.tobytes())

        result = sprites.detect_sprite_resolution(upload(original))
        self.assertEqual((result["width"], result["height"], result["scale"]), (12, 10, 1))
        self.assertIsNone(result["png"])

    def test_resize_keeps_transparent_margins_and_pixel_colors(self):
        """Thu nhỏ toàn ảnh và giữ nguyên giá trị RGBA lấy mẫu."""
        image = Image.new("RGBA", (8, 4))
        image.paste((230, 40, 20, 128), (2, 0, 6, 4))
        response = sprites.resize_sprite(upload(image), 4, 2)
        with Image.open(io.BytesIO(response.body)) as png:
            self.assertEqual(png.size, (4, 2))
            self.assertEqual(list(png.getdata())[:4], [(0, 0, 0, 0), (230, 40, 20, 128), (230, 40, 20, 128), (0, 0, 0, 0)])

    def test_sheet_zip_preserves_cell_bounds_and_row_order(self):
        """ZIP chứa đủ ô gốc theo thứ tự hàng, kể cả ô trong suốt."""
        image = Image.new("RGBA", (9, 4))
        for index, point in enumerate([(0, 0), (3, 0), (6, 0), (0, 2), (3, 2)], start=1):
            image.putpixel(point, (index, 50, 100, 255))
        response = sprites.slice_sprite_sheet(upload(image), 2, 3, "zip")
        with ZipFile(io.BytesIO(response.body)) as archive:
            self.assertEqual(archive.namelist(), [f"frame_{index:03}.png" for index in range(1, 7)])
            for index, name in enumerate(archive.namelist(), start=1):
                with Image.open(io.BytesIO(archive.read(name))) as png:
                    self.assertEqual(png.size, (3, 2))
                    self.assertEqual(png.getpixel((2, 1)), (0, 0, 0, 0))
                    expected = (index, 50, 100, 255) if index <= 5 else (0, 0, 0, 0)
                    self.assertEqual(png.getpixel((0, 0)), expected)

    def test_rejects_grid_with_remainder(self):
        """
        Kiểm tra thuật toán cắt Sprite Sheet với phần dư và từ chối kích thước không hợp lệ:
        1. Lưới có phần dư pixel: Tự động căn giữa lề (Center Margin), cắt thành công các frame đều nhau.
        2. Kích thước ảnh quá nhỏ so với số cột (kích thước ô < 1px): Quăng lỗi HTTPException 422.
        """
        # 1. Kiểm tra ảnh 10x8 cắt 2 hàng 3 cột (width = 10 // 3 = 3, height = 8 // 2 = 4, dư 1px được căn giữa lề)
        result = sprites.slice_sprite_sheet(upload(Image.new("RGBA", (10, 8))), 2, 3, "json")
        self.assertIn("frames", result)
        self.assertEqual(len(result["frames"]), 6)
        self.assertEqual(result["frames"][0]["width"], 3)
        self.assertEqual(result["frames"][0]["height"], 4)

        # 2. Kiểm tra trường hợp thực sự không hợp lệ: Chiều rộng ảnh (2px) nhỏ hơn số cột (5) -> Ô < 1px quăng lỗi 422
        with self.assertRaises(HTTPException) as raised:
            sprites.slice_sprite_sheet(upload(Image.new("RGBA", (2, 4))), 2, 5, "json")
        self.assertEqual(raised.exception.status_code, 422)
