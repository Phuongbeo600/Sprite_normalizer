# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử & Dataclasses)
# ========================================================
# unittest: Framework kiểm thử đơn vị tiêu chuẩn của Python
import unittest
# dataclasses: Chuyển đổi qua lại giữa dataclass và từ điển
from dataclasses import asdict
# unittest.mock: Giả lập môi trường biến môi trường và nhà cung cấp AI
from unittest.mock import patch

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không sử dụng thư viện bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Data Models & Services)
# ========================================================
# CharacterMetrics: Cấu trúc dữ liệu số đo giải phẫu nhân vật mẫu
from backend.core.metrics.character_metrics import CharacterMetrics

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file kiểm thử backend)


class TestCharacterMetricsMapping(unittest.TestCase):
    """
    Bộ kiểm thử đặc tính (Characterization Tests) cho việc chuyển đổi dữ liệu
    từ điển (Dictionary) sang đối tượng CharacterMetrics.
    Bảo đảm hành vi mapping không bị hồi quy trong Giai đoạn C2.
    """

    def setUp(self):
        """Khởi tạo mẫu dữ liệu từ điển giải phẫu đầy đủ và chuẩn mực."""
        self.full_dict = {
            "canvas_width": 128,
            "canvas_height": 128,
            "visible_x_min": 10,
            "visible_y_min": 15,
            "visible_x_max": 90,
            "visible_y_max": 115,
            "visible_width": 81,
            "visible_height": 101,
            "neck_y": 42,
            "head_x_min": 25,
            "head_y_min": 15,
            "head_x_max": 75,
            "head_y_max": 42,
            "head_width": 51,
            "head_height": 28,
            "body_x_min": 15,
            "body_y_min": 43,
            "body_x_max": 85,
            "body_y_max": 115,
            "body_width": 71,
            "body_height": 73,
            "torso_height": 35,
            "torso_width": 60,
            "head_ratio": 0.277,
            "heads_tall": 3.61,
            "head_to_body_width_ratio": 0.718,
            "body_aspect_ratio": 0.973,
            "style_category": "Semi-Chibi / Retro RPG",
            "summary_text": "Sprite mẫu hiệp sĩ tỷ lệ 3.6 đầu",
            "crotch_y": 78,
            "ground_y": 115,
            "anatomical_height": 101,
            "torso_box": [43, 20, 78, 80],
            "legs_box": [79, 25, 115, 75],
            "weapon_box": [30, 85, 100, 110],
            "cape_wings_box": [45, 10, 95, 30],
            "shadow_box": [112, 20, 118, 80],
            "detection_source": "Heuristic (Toán học)",
            "ai_feedback": "Tỷ lệ chuẩn mực"
        }

    def test_full_dict_mapping(self):
        """Kiểm tra việc khôi phục toàn bộ 38 trường dữ liệu từ từ điển đầy đủ."""
        metrics = CharacterMetrics.from_dict(self.full_dict)

        self.assertEqual(metrics.canvas_width, 128)
        self.assertEqual(metrics.canvas_height, 128)
        self.assertEqual(metrics.visible_width, 81)
        self.assertEqual(metrics.visible_height, 101)
        self.assertEqual(metrics.neck_y, 42)
        self.assertEqual(metrics.head_height, 28)
        self.assertEqual(metrics.body_width, 71)
        self.assertAlmostEqual(metrics.head_ratio, 0.277, places=3)
        self.assertAlmostEqual(metrics.heads_tall, 3.61, places=2)
        self.assertEqual(metrics.style_category, "Semi-Chibi / Retro RPG")
        self.assertEqual(metrics.crotch_y, 78)
        self.assertEqual(metrics.torso_box, (43, 20, 78, 80))
        self.assertEqual(metrics.legs_box, (79, 25, 115, 75))

    def test_default_values_on_empty_dict(self):
        """Kiểm tra các giá trị mặc định chuẩn xác khi truyền từ điển rỗng."""
        metrics = CharacterMetrics.from_dict({})

        self.assertEqual(metrics.canvas_width, 64)
        self.assertEqual(metrics.canvas_height, 64)
        self.assertEqual(metrics.visible_x_min, 0)
        self.assertEqual(metrics.visible_y_max, 63)
        self.assertEqual(metrics.neck_y, 20)
        self.assertEqual(metrics.head_ratio, 0.31)
        self.assertEqual(metrics.heads_tall, 3.2)
        self.assertEqual(metrics.style_category, "Semi-Chibi")
        self.assertIsNone(metrics.crotch_y)
        self.assertIsNone(metrics.torso_box)

    def test_none_input_handled_safely(self):
        """Kiểm tra truyền None không gây ngoại lệ mà trả về đối tượng với giá trị mặc định."""
        metrics = CharacterMetrics.from_dict(None)
        self.assertIsInstance(metrics, CharacterMetrics)
        self.assertEqual(metrics.canvas_width, 64)
        self.assertEqual(metrics.canvas_height, 64)
        self.assertEqual(metrics.style_category, "Semi-Chibi")

    def test_none_field_values_fallback_to_defaults(self):
        """Kiểm tra các trường có giá trị None tường minh sẽ tự động khôi phục giá trị mặc định."""
        metrics = CharacterMetrics.from_dict({
            "canvas_width": None,
            "neck_y": None,
            "style_category": None
        })
        self.assertEqual(metrics.canvas_width, 64)
        self.assertEqual(metrics.neck_y, 20)
        self.assertEqual(metrics.style_category, "Semi-Chibi")

    def test_box_conversion_list_to_tuple(self):
        """Kiểm tra danh sách tọa độ hộp bao (List) được chuyển đổi thành Tuple an toàn."""
        metrics = CharacterMetrics.from_dict({
            "torso_box": [1, 2, 3, 4],
            "legs_box": (5, 6, 7, 8),
            "weapon_box": None,
            "cape_wings_box": "không hợp lệ"
        })
        self.assertEqual(metrics.torso_box, (1, 2, 3, 4))
        self.assertEqual(metrics.legs_box, (5, 6, 7, 8))
        self.assertIsNone(metrics.weapon_box)
        self.assertIsNone(metrics.cape_wings_box)

    def test_to_dict_roundtrip(self):
        """Kiểm tra việc chuyển đổi hai chiều từ điển ⇄ CharacterMetrics bảo toàn toàn vẹn dữ liệu."""
        original = CharacterMetrics.from_dict(self.full_dict)
        exported_dict = original.to_dict()
        restored = CharacterMetrics.from_dict(exported_dict)
        self.assertEqual(original, restored)


if __name__ == "__main__":
    unittest.main()
