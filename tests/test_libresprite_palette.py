"""
Kiểm thử đơn vị cho thuật toán Octree Color Quantization (LibreSprite chuyển đổi sang Python).
"""
import unittest
import numpy as np
from PIL import Image

from backend.core.processing.palette_generator import (
    LibreSpriteOctreeQuantizer,
    create_palette_from_sprite
)
from backend.services.sprite_service import SpriteService


class TestLibreSpritePalette(unittest.TestCase):
    def test_pure_pixel_art_palette(self):
        """Kiểm tra với sprite thuần 4 màu: bảng màu phải giữ nguyên 100% 4 màu."""
        img = Image.new("RGBA", (16, 16), color=(0, 0, 0, 0))
        # 4 màu rõ rệt
        colors = [
            (255, 0, 0, 255),    # Đỏ
            (0, 255, 0, 255),    # Xanh lá
            (0, 0, 255, 255),    # Xanh dương
            (255, 255, 0, 255),  # Vàng
        ]
        for y in range(4):
            for x in range(4):
                img.putpixel((x, y), colors[y])

        result = create_palette_from_sprite(img, max_colors=16)
        self.assertEqual(result["raw_colors_count"], 4)
        self.assertEqual(result["clean_colors_count"], 4)
        self.assertEqual(result["ai_intermediate_colors"], 0)
        self.assertFalse(result["has_ai_noise_warning"])

        # Kiểm tra danh sách hex
        hex_set = set(result["hex_list"])
        self.assertIn("#ff0000", hex_set)
        self.assertIn("#00ff00", hex_set)
        self.assertIn("#0000ff", hex_set)
        self.assertIn("#ffff00", hex_set)

    def test_color_budget_reduction(self):
        """Kiểm tra khi ảnh có nhiều hơn max_colors (ví dụ 100 màu), thuật toán phải nén về đúng <= max_colors."""
        img = Image.new("RGBA", (32, 32), color=(0, 0, 0, 0))
        # Tạo 64 màu khác nhau
        for y in range(8):
            for x in range(8):
                img.putpixel((x, y), (x * 30, y * 30, (x + y) * 15, 255))

        # Ép về tối đa 16 màu
        result = create_palette_from_sprite(img, max_colors=16)
        self.assertLessEqual(result["clean_colors_count"], 16)
        self.assertGreaterEqual(result["raw_colors_count"], 32)
        self.assertTrue(result["has_ai_noise_warning"])

    def test_luminance_sorting(self):
        """Kiểm tra các ô màu được sắp xếp theo độ sáng Rec. 709 tăng dần."""
        img = Image.new("RGBA", (4, 4), color=(0, 0, 0, 0))
        img.putpixel((0, 0), (255, 255, 255, 255)) # Trắng: sáng nhất
        img.putpixel((1, 0), (10, 10, 10, 255))       # Đen gần tối nhất
        img.putpixel((2, 0), (100, 100, 100, 255))   # Xám: trung bình

        result = create_palette_from_sprite(img, max_colors=16)
        pal = result["palette"]
        self.assertEqual(len(pal), 3)
        # Sắp xếp tăng dần theo luminance
        self.assertLess(pal[0]["luminance"], pal[1]["luminance"])
        self.assertLess(pal[1]["luminance"], pal[2]["luminance"])

    def test_sprite_service_integration(self):
        """Kiểm tra tích hợp vào SpriteService.analyze_colors."""
        img = Image.new("RGBA", (32, 32), color=(0, 0, 0, 0))
        for y in range(8, 24):
            for x in range(8, 24):
                img.putpixel((x, y), (120, 50, 200, 255))

        res = SpriteService.analyze_colors(img)
        self.assertIn("palette_metrics", res)
        self.assertIn("raw_colors_count", res["palette_metrics"])
        self.assertIn("libresprite_palette", res["palette_metrics"])


if __name__ == "__main__":
    unittest.main()
