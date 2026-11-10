# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử đơn vị)
# ========================================================
# unittest: Framework kiểm thử chuẩn của Python
import unittest

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# PIL (Pillow): Tạo và kiểm tra ma trận ảnh RGBA mẫu
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Core modules cần khóa hành vi)
# ========================================================
# SpriteNormalizer: Thuật toán chuẩn hóa cắt viền và căn điểm neo
from backend.core.normalizer import SpriteNormalizer
# HeuristicAnalyzer: Thuật toán giải tích tìm cổ và đo tỷ lệ đầu/thân
from backend.core.heuristic_analyzer import HeuristicAnalyzer
# CharacterMetrics: Data model lưu trữ kết quả giải phẫu
from backend.core.character_metrics import CharacterMetrics

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file test backend)


class TestCoreCharacterization(unittest.TestCase):
    """
    Kiểm thử khóa hành vi (Characterization Test) cho các module thuật toán lõi:
    Đảm bảo 100% hành vi, tọa độ bounding box, điểm neo và chỉ số giải phẫu
    không hề thay đổi sau bất kỳ bước refactoring nào.
    """

    def setUp(self):
        """Khởi tạo ảnh sprite mẫu 32x48 pixel với nhân vật cố định ở giữa."""
        self.image = Image.new("RGBA", (32, 48), color=(0, 0, 0, 0))
        # Tạo vùng đầu: Y từ 10 đến 18, X từ 12 đến 20
        for y in range(10, 19):
            for x in range(12, 21):
                self.image.putpixel((x, y), (255, 200, 150, 255))

        # Tạo hõm cổ: Y=19, X từ 14 đến 18 (thu hẹp)
        for x in range(14, 19):
            self.image.putpixel((x, 19), (200, 50, 50, 255))

        # Tạo vùng thân: Y từ 20 đến 38, X từ 10 đến 22
        for y in range(20, 39):
            for x in range(10, 23):
                self.image.putpixel((x, y), (50, 100, 200, 255))

        self.normalizer = SpriteNormalizer(target_width=64, target_height=64, anchor="bottom_center")

    def test_normalizer_bounding_box_and_trim(self):
        """Khóa hành vi thuật toán tìm hộp bao và cắt tỉa viền trong suốt."""
        bbox = self.normalizer.get_bounding_box(self.image)
        self.assertIsNotNone(bbox)
        xmin, ymin, xmax, ymax = bbox
        self.assertEqual(xmin, 10)
        self.assertEqual(ymin, 10)
        self.assertEqual(xmax, 23)
        self.assertEqual(ymax, 39)

        trimmed = self.normalizer.trim(self.image)
        self.assertEqual(trimmed.size, (13, 29))

    def test_normalizer_frame_anchoring(self):
        """Khóa hành vi chuẩn hóa khung hình và các điểm neo khác nhau."""
        # Test anchor bottom_center
        canvas_bottom = self.normalizer.normalize_frame(self.image, target_size=(64, 64), anchor="bottom_center")
        self.assertEqual(canvas_bottom.size, (64, 64))
        # Kiểm tra pixel chân chạm đất sát đáy (Y = 64 - 29 = 35)
        self.assertGreater(canvas_bottom.getpixel((32, 63))[3], 0)

        # Test anchor center
        canvas_center = self.normalizer.normalize_frame(self.image, target_size=(64, 64), anchor="center")
        self.assertEqual(canvas_center.size, (64, 64))
        self.assertGreater(canvas_center.getpixel((32, 32))[3], 0)

    def test_heuristic_analyzer_anatomy_metrics(self):
        """Khóa hành vi thuật toán tìm cổ và đo tỷ lệ giải phẫu học."""
        metrics = HeuristicAnalyzer.analyze(self.image, auto_remove_solid_bg=False)
        self.assertIsNotNone(metrics)
        self.assertIsInstance(metrics, CharacterMetrics)

        # Khóa cứng các chỉ số kích thước hiển thị
        self.assertEqual(metrics.visible_width, 13)
        self.assertEqual(metrics.visible_height, 29)
        self.assertEqual(metrics.visible_y_min, 10)
        self.assertEqual(metrics.visible_y_max, 38)

        # Khóa cứng tọa độ vùng đầu
        self.assertEqual(metrics.head_y_min, 10)
        self.assertGreaterEqual(metrics.neck_y, 14)
        self.assertLessEqual(metrics.neck_y, 25)
        self.assertGreater(metrics.heads_tall, 1.0)


if __name__ == "__main__":
    unittest.main()
