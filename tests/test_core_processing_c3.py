# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử đơn vị)
# ========================================================
# unittest: Framework kiểm thử chuẩn của Python
import unittest

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# PIL (Pillow): Tạo và thao tác ma trận ảnh RGBA mẫu
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Core Processing & Metrics)
# ========================================================
# HeuristicAnalyzer: Thuật toán giải tích tìm cổ và đo tỷ lệ đầu/thân
from backend.core.metrics.heuristic_analyzer import HeuristicAnalyzer
# CharacterMetrics: Data model lưu trữ kết quả giải phẫu
from backend.core.metrics.character_metrics import CharacterMetrics
# analyze_sprite: Hàm phân tích toàn diện phong cách pixel art
from backend.core.metrics.pixel_art_metrics import analyze_sprite
# slice_sheet: Cắt sprite sheet thành các frame riêng biệt
from backend.core.processing.sprite_editing import slice_sheet

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file test backend)


class TestCoreProcessingC3(unittest.TestCase):
    """
    Bộ kiểm thử đặc tính (Characterization Tests) cho Giai đoạn C3.
    Khóa cứng các giá trị đầu ra của HeuristicAnalyzer và Pixel Art Metrics
    để đảm bảo không xảy ra sai lệch thuật toán dù chỉ 1 pixel hay 1 bậc bóng.
    """

    def setUp(self):
        """Khởi tạo các mẫu ảnh sprite kiểm thử theo baseline C0."""
        # Mẫu 1: Sprite nhân vật 32x48 theo chuẩn baseline C0
        self.char_img = Image.new("RGBA", (32, 48), color=(0, 0, 0, 0))
        # Vùng đầu (Y: 10-18, X: 12-20)
        for y in range(10, 19):
            for x in range(12, 21):
                self.char_img.putpixel((x, y), (255, 200, 150, 255))
        # Hõm cổ (Y: 19, X: 14-18)
        for x in range(14, 19):
            self.char_img.putpixel((x, 19), (200, 50, 50, 255))
        # Vùng thân (Y: 20-38, X: 10-22)
        for y in range(20, 39):
            for x in range(10, 23):
                self.char_img.putpixel((x, y), (50, 100, 200, 255))

        # Mẫu 2: Sprite có viền đen và bậc bóng (Dùng kiểm thử outline & ramps)
        self.bordered_img = Image.new("RGBA", (32, 48), color=(0, 0, 0, 0))
        # Thân màu tím (#8b5cf6 -> 139, 92, 246)
        for y in range(12, 36):
            for x in range(10, 22):
                self.bordered_img.putpixel((x, y), (139, 92, 246, 255))
        # Mảng bóng tím (#5b21b6 -> 91, 33, 182)
        for y in range(24, 36):
            for x in range(16, 22):
                self.bordered_img.putpixel((x, y), (91, 33, 182, 255))
        # Viền đen bao quanh (#000000 -> 0, 0, 0)
        for x in range(9, 23):
            self.bordered_img.putpixel((x, 11), (0, 0, 0, 255))
            self.bordered_img.putpixel((x, 36), (0, 0, 0, 255))
        for y in range(11, 37):
            self.bordered_img.putpixel((9, y), (0, 0, 0, 255))
            self.bordered_img.putpixel((22, y), (0, 0, 0, 255))

    def test_heuristic_analyzer_exact_baseline_metrics(self):
        """Khóa cứng đầu ra của HeuristicAnalyzer khớp 100% với mục 5.2 của Baseline C0."""
        metrics = HeuristicAnalyzer.analyze(self.char_img, auto_remove_solid_bg=False)
        self.assertIsNotNone(metrics)
        self.assertIsInstance(metrics, CharacterMetrics)

        # Kích thước nhìn thấy được (13 x 29 px)
        self.assertEqual(metrics.visible_width, 13)
        self.assertEqual(metrics.visible_height, 29)
        self.assertEqual(metrics.visible_y_min, 10)
        self.assertEqual(metrics.visible_y_max, 38)
        self.assertEqual(metrics.visible_x_min, 10)
        self.assertEqual(metrics.visible_x_max, 22)

        # Hõm cổ và tỷ lệ giải phẫu học
        self.assertEqual(metrics.neck_y, 18)
        self.assertEqual(metrics.head_y_min, 10)
        self.assertEqual(metrics.head_y_max, 18)
        self.assertEqual(metrics.head_height, 9)
        self.assertEqual(metrics.head_width, 9)
        self.assertAlmostEqual(metrics.heads_tall, 3.22, places=2)
        self.assertAlmostEqual(metrics.head_ratio, 0.31, places=2)
        self.assertEqual(metrics.style_category, "Semi-Chibi / Retro RPG (3.0 - 4.0 đầu)")

        # Thân trên và tiếp đất
        self.assertEqual(metrics.crotch_y, 27)
        self.assertEqual(metrics.ground_y, 38)

    def test_heuristic_analyzer_empty_image(self):
        """Kiểm tra xử lý ảnh trống hoặc hoàn toàn trong suốt trả về None an toàn."""
        empty = Image.new("RGBA", (16, 16), color=(0, 0, 0, 0))
        result = HeuristicAnalyzer.analyze(empty)
        self.assertIsNone(result)

    def test_heuristic_analyzer_solid_background_removal(self):
        """Kiểm tra tự động khử nền đặc màu trắng (auto_remove_solid_bg=True)."""
        solid_bg_img = Image.new("RGBA", (32, 48), color=(255, 255, 255, 255))
        # Vẽ nhân vật ở giữa nền trắng
        for y in range(10, 20):
            for x in range(12, 20):
                solid_bg_img.putpixel((x, y), (200, 50, 50, 255))

        metrics = HeuristicAnalyzer.analyze(solid_bg_img, auto_remove_solid_bg=True)
        self.assertIsNotNone(metrics)
        self.assertEqual(metrics.visible_width, 8)
        self.assertEqual(metrics.visible_height, 10)

    def test_pixel_art_metrics_outline_detection(self):
        """Khóa cứng thuật toán nhận diện đường viền trên ảnh có viền đen."""
        report = analyze_sprite(self.bordered_img)
        self.assertNotIn("error", report)
        self.assertIn("outline", report)
        outline = report["outline"]

        self.assertEqual(outline["style"], "uniform_black")
        self.assertEqual(outline["coverage"], 1.0)
        self.assertEqual(outline["thickness_px"], 1.0)
        self.assertEqual(outline["n_colors"], 1)
        self.assertIn("#000000", outline["colors"])

    def test_pixel_art_metrics_shading_ramps(self):
        """Khóa cứng thuật toán nhận diện bậc đổ bóng (ramps) trên ảnh có bóng tím."""
        report = analyze_sprite(self.bordered_img)
        self.assertIn("shading", report)
        shading = report["shading"]

        self.assertEqual(shading["n_ramps"], 1)
        self.assertEqual(shading["steps_per_ramp_max"], 2)
        ramps = shading["ramps"]
        self.assertEqual(len(ramps), 1)
        self.assertEqual(ramps[0]["steps"], 2)
        self.assertEqual(ramps[0]["hex_dark_to_light"], ["#5b21b6", "#8b5cf6"])

    def test_pixel_art_metrics_lineless_sprite(self):
        """Kiểm tra nhân vật không có viền bao được phân loại chính xác là lineless."""
        report = analyze_sprite(self.char_img)
        self.assertEqual(report["outline"]["style"], "lineless")
        self.assertEqual(report["outline"]["coverage"], 0.0)

    def test_slice_sheet_with_auto_anchor(self):
        """Kiểm tra chức năng slice_sheet với cờ auto_anchor=True hoạt động chính xác."""
        sheet = Image.new("RGBA", (64, 64), color=(0, 0, 0, 0))
        # Tạo 4 ô con có pixel
        sheet.putpixel((10, 10), (255, 0, 0, 255))
        sheet.putpixel((40, 10), (0, 255, 0, 255))
        sheet.putpixel((10, 40), (0, 0, 255, 255))
        sheet.putpixel((40, 40), (255, 255, 0, 255))

        frames = list(slice_sheet(sheet, rows=2, columns=2, auto_anchor=True))
        self.assertEqual(len(frames), 4)
        for frame in frames:
            self.assertEqual(frame.size, (32, 32))


if __name__ == "__main__":
    unittest.main()
