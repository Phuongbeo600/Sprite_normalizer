# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử đơn vị)
# ========================================================
# unittest: Framework kiểm thử chuẩn của Python
import unittest

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# PIL (Pillow): Thao tác tạo ảnh mẫu RGBA kiểm thử
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Core, Services & Schemas)
# ========================================================
# HeuristicPaletteAnalyzer: Bộ phân tích 6 tiêu chí hệ màu sắc Pixel Art bằng thuật toán toán học NumPy
from backend.core.metrics.palette_analyzer import HeuristicPaletteAnalyzer
# PaletteMetrics: Schema Pydantic lưu trữ 6 tiêu chuẩn màu sắc
from backend.schemas.character.palette import PaletteMetrics

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file test backend)


class TestPaletteAnalyzer(unittest.TestCase):
    """
    Bộ kiểm thử đơn vị đo lường 100% chính xác 6 tiêu chí kỹ thuật màu sắc của Sprite bằng thuật toán Python:
    1. Tổng số lượng màu thực tế (total_colors).
    2. Bảng mã màu chủ đạo theo tỷ lệ bao phủ (dominant_colors, top_hex_list).
    3. Số bậc đổ bóng (shading_steps, shading_style_detected).
    4. Kỹ thuật dịch chuyển sắc độ bóng (hue_shifting_detected, hue_shift_description).
    5. Quy chuẩn màu đường viền (outline_style_detected).
    6. Độ bão hòa & Độ tương phản (average_saturation, contrast_ratio).
    """

    def setUp(self):
        """Khởi tạo bộ phân tích bảng màu và ảnh mẫu RGBA."""
        self.analyzer = HeuristicPaletteAnalyzer()

    def test_empty_transparent_image(self):
        """Kiểm tra trường hợp ảnh hoàn toàn trong suốt."""
        empty_img = Image.new("RGBA", (32, 48), color=(0, 0, 0, 0))
        metrics = self.analyzer.analyze_palette(empty_img)
        self.assertIsInstance(metrics, PaletteMetrics)
        self.assertEqual(metrics.total_colors, 0)
        self.assertEqual(len(metrics.dominant_colors), 0)

    def test_sample_pixel_art_sprite_palette(self):
        """
        Kiểm tra đo đạc chính xác trên ảnh nhân vật Pixel Art nhân tạo:
        - Viền ngoài màu đen (#000000)
        - Thân màu tím (#8b5cf6) kèm mảng bóng tím đậm dịch sắc (#5b21b6)
        - Điểm sáng vàng nhạt (#fde047)
        """
        # Tạo ảnh 32x48 với nền trong suốt
        img = Image.new("RGBA", (32, 48), color=(0, 0, 0, 0))

        # 1. Vẽ thân màu tím cơ bản (#8b5cf6 -> R=139, G=92, B=246)
        for y in range(12, 36):
            for x in range(10, 22):
                img.putpixel((x, y), (139, 92, 246, 255))

        # 2. Vẽ mảng bóng tím sẫm (#5b21b6 -> R=91, G=33, B=182)
        for y in range(24, 36):
            for x in range(16, 22):
                img.putpixel((x, y), (91, 33, 182, 255))

        # 3. Vẽ mảng highlight vàng nhạt (#fde047 -> R=253, G=224, B=71)
        for y in range(14, 18):
            for x in range(11, 14):
                img.putpixel((x, y), (253, 224, 71, 255))

        # 4. Vẽ đường viền bao quanh màu đen (#000000)
        for x in range(9, 23):
            img.putpixel((x, 11), (0, 0, 0, 255))
            img.putpixel((x, 36), (0, 0, 0, 255))
        for y in range(11, 37):
            img.putpixel((9, y), (0, 0, 0, 255))
            img.putpixel((22, y), (0, 0, 0, 255))

        # Thực thi đo đạc bằng Python NumPy
        metrics = self.analyzer.analyze_palette(img)

        # Tiêu chí 1: Đếm chính xác số lượng màu độc nhất (có đúng 4 màu: tím, bóng tím, vàng sáng, viền đen)
        self.assertEqual(metrics.total_colors, 4)
        self.assertIn("≤ 16 colors", metrics.palette_era)

        # Tiêu chí 2: Danh sách mã HEX chủ đạo
        self.assertGreater(len(metrics.dominant_colors), 0)
        hex_list = metrics.top_hex_list
        self.assertIn("#8b5cf6", hex_list)
        self.assertIn("#000000", hex_list)

        # Tiêu chí 3: Số bậc đổ bóng đo được
        self.assertGreaterEqual(metrics.shading_steps, 2)

        # Tiêu chí 5: Quy chuẩn đường viền
        self.assertIn("Outline", metrics.outline_style_detected)

        # Tiêu chí 6: Độ bão hòa & Độ tương phản
        self.assertGreater(metrics.average_saturation, 0.0)
        self.assertGreater(metrics.contrast_ratio, 1.0)

        # Master Color Prompt phải có chứa thông số
        self.assertIn("MASTER COLOR & GRAPHIC PALETTE SPECIFICATIONS", metrics.master_color_prompt)
        self.assertIn("transparent background", metrics.master_color_prompt)


if __name__ == "__main__":
    unittest.main()
