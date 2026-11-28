# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử, Base64, Bộ đệm & Toán học)
# ========================================================
# base64, io: Mã hóa ảnh sprite thử nghiệm sang Data URL Base64
import base64
import io
# math, unittest: Giá trị NaN/Infinity và khung kiểm thử đơn vị
import math
import unittest

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# PIL (Pillow): Tạo ảnh sprite RGBA kiểm thử tích hợp đường ống đo -> ánh xạ -> prompt
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Core Metrics, Services & Schemas)
# ========================================================
from backend.core.metrics.anatomy_mapping import (
    build_anatomical_description,
    extract_raw_anatomy_metrics,
    map_anatomical_proportions,
)
from backend.core.metrics.character_metrics import CharacterMetrics
from backend.schemas.image_gen import ImageGenRequest
from backend.services.image_gen_prompts import build_prompt_from_request

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file kiểm thử backend)


class TestAnatomyMapping(unittest.TestCase):
    """
    Bộ kiểm thử cho module ánh xạ tỷ lệ giải phẫu (Anatomical Semantic Mapping)
    và tích hợp trực tiếp vào Master Prompt Template.
    """

    def test_example_input_matches_expected_output(self):
        """Kiểm tra đúng bộ dữ liệu mẫu đầu vào cho ra chính xác 6 dòng mô tả theo thứ tự chuẩn."""
        # Arrange
        raw_metrics = {
            "body_height": 128,
            "head_height": 46,
            "head_width": 42,
            "torso_height": 40,
            "torso_width": 38,
            "shoulder_width": 44,
            "hip_width": 32,
            "arm_length": 32,
            "arm_width": 8,
            "leg_length": 42,
            "leg_width": 14,
        }
        expected = "\n".join([
            "- Approximately 2.8-head-tall proportions.",
            "- Large head, approximately as wide as the torso.",
            "- Short torso with similar width and height.",
            "- Shoulders broader than hips.",
            "- Short arms of medium thickness.",
            "- Relatively short, thick legs.",
        ])

        # Act
        actual = build_anatomical_description(raw_metrics)

        # Assert
        self.assertEqual(actual, expected)

    def test_all_threshold_boundaries_and_forbidden_style_labels(self):
        """Kiểm tra các khoảng ngưỡng phân loại cho cả 6 nhóm và đảm bảo không gắn nhãn phong cách."""
        # Arrange & Act: nhóm đầu nhỏ + dáng cao, vai hẹp, tay dài mỏng, chân rất dài mảnh
        tall_metrics = {
            "body_height": 100,
            "head_height": 12,
            "head_width": 10,
            "torso_height": 36,
            "torso_width": 18,
            "shoulder_width": 14,
            "hip_width": 22,
            "arm_length": 45,
            "arm_width": 4,
            "leg_length": 55,
            "leg_width": 5,
        }
        tall_desc = build_anatomical_description(tall_metrics)

        # Assert
        self.assertIn("- Approximately 8.3-head-tall proportions.", tall_desc)
        self.assertIn("- Very small head, much narrower than the torso.", tall_desc)
        self.assertIn("- Medium-length, narrow torso.", tall_desc)
        self.assertIn("- Shoulders much narrower than hips.", tall_desc)
        self.assertIn("- Long, very thin arms.", tall_desc)
        self.assertIn("- Very long, very thin legs.", tall_desc)

        for forbidden in ("chibi", "anime", "realistic", "muscular"):
            self.assertNotIn(forbidden, tall_desc.lower())

        # Nhánh còn lại: đầu rất to/rộng, thân dài rất rộng, vai rất rộng, tay rất ngắn rất dày
        compact_metrics = {
            "body_height": 100,
            "head_height": 50,
            "head_width": 45,
            "torso_height": 45,
            "torso_width": 70,
            "shoulder_width": 60,
            "hip_width": 40,
            "arm_length": 18,
            "arm_width": 9,
            "leg_length": 20,
            "leg_width": 10,
        }
        # head_width/torso_width = 45/70 = 0.642 -> narrower than the torso
        # torso_width/torso_height = 70/45 = 1.555 -> very broad
        compact_desc = build_anatomical_description(compact_metrics)
        self.assertIn("- Approximately 2.0-head-tall proportions.", compact_desc)
        self.assertIn("- Very large head, narrower than the torso.", compact_desc)
        self.assertIn("- Long, very broad torso.", compact_desc)
        self.assertIn("- Shoulders much broader than hips.", compact_desc)
        self.assertIn("- Very short, very thick arms.", compact_desc)
        self.assertIn("- Very short, very thick legs.", compact_desc)

    def test_partial_metrics_keeps_single_valid_feature_per_group(self):
        """Nếu một nhóm chỉ có 1 đặc điểm hợp lệ thì vẫn sinh mô tả cho đặc điểm đó."""
        # Arrange
        partial = {
            "head_width": 30,
            "torso_width": 20,
            "torso_height": 40,
            "body_height": 100,
            "arm_length": 35,
            "leg_length": 40,
            "leg_width": 8,
        }

        # Act
        lines = map_anatomical_proportions(partial)

        # Assert: head_width/torso_width = 1.50; torso_height/body_height = 0.40 (Medium-length);
        # torso_width/torso_height = 0.50 (narrow); leg_width/leg_length = 0.20 (of medium thickness)
        self.assertEqual(lines, [
            "Head much wider than torso.",
            "Medium-length, narrow torso.",
            "Medium-length arms.",
            "Medium-length legs of medium thickness.",
        ])

    def test_invalid_numbers_and_impossible_geometry_are_ignored(self):
        """Kiểm tra dữ liệu thiếu, số âm, 0, NaN, Infinity, bool và tỷ lệ vô lý không gây lỗi."""
        # Arrange
        invalid_cases = {
            "body_height": 100,
            "head_height": 120,  # đầu cao hơn toàn thân -> không hợp lệ
            "head_width": -10,
            "torso_height": float("nan"),
            "torso_width": float("inf"),
            "shoulder_width": True,
            "hip_width": 0,
            "arm_length": "32",
            "arm_width": 5,
            "leg_length": 110,   # chân dài hơn toàn thân -> không hợp lệ
            "leg_width": -3,
        }

        # Act & Assert
        self.assertEqual(map_anatomical_proportions(invalid_cases), [])
        self.assertEqual(build_anatomical_description(invalid_cases), "")
        self.assertEqual(build_anatomical_description(None), "")
        self.assertEqual(build_anatomical_description({}), "")

    def test_extract_from_character_metrics_uses_anatomical_height_and_manual_axes(self):
        """
        Đảm bảo CharacterMetrics.body_height (chỉ tính cổ->chân) không bị nhầm với chiều cao toàn thân,
        và chi tiết tay/chân chỉ lấy khi có trục đo axis hợp lệ (không lấy từ bounding box).
        """
        # Arrange: Toàn thân 80px (đầu 20px, cổ->chân 60px), thân trên 28px rộng 24px
        cm = CharacterMetrics(
            canvas_width=96,
            canvas_height=96,
            visible_x_min=20,
            visible_y_min=8,
            visible_x_max=60,
            visible_y_max=87,
            visible_width=41,
            visible_height=80,
            neck_y=27,
            head_x_min=30,
            head_y_min=8,
            head_x_max=49,
            head_y_max=27,
            head_width=20,
            head_height=20,
            body_x_min=20,
            body_y_min=28,
            body_x_max=60,
            body_y_max=87,
            body_width=41,
            body_height=60,
            torso_height=28,
            torso_width=36,  # bị phình bởi 2 tay nếu chưa cắt lát torso
            head_ratio=0.25,
            heads_tall=4.0,
            head_to_body_width_ratio=0.49,
            body_aspect_ratio=0.68,
            style_category="Semi-Chibi / Retro RPG (3.0 - 4.0 đầu)",
            summary_text="",
            anatomical_height=80,
        )
        regions = {
            "image_size_px": [96, 96],
            "measurements": {
                "head": {"width_px": 20},
                "torso": {"width_px": 24},  # lát cắt thân sạch hơn
            },
        }
        manual = {
            "schema_version": "point_to_point_v1",
            "image_size_px": [96, 96],
            "measurements": {
                "torso_width": {"status": "measured", "value_px": 26.0, "occluded": False},
                "arm_length": {"status": "measured", "value_px": 26.0, "occluded": False},
                "arm_width": {"status": "measured", "value_px": 6.0, "occluded": False},
                "leg_length": {"status": "occluded", "value_px": None, "occluded": True},
                "leg_width": {"status": "measured", "value_px": 10.0, "occluded": False},
            },
        }

        # Act
        auto_only = extract_raw_anatomy_metrics(cm, regions)
        with_manual = extract_raw_anatomy_metrics(cm, regions, manual)

        # Assert
        self.assertEqual(auto_only["body_height"], 80.0)
        self.assertEqual(auto_only["torso_width"], 24.0)
        self.assertIsNone(auto_only["shoulder_width"])
        self.assertIsNone(auto_only["hip_width"])
        self.assertIsNone(auto_only["arm_length"])
        self.assertIsNone(auto_only["leg_length"])

        self.assertEqual(with_manual["torso_width"], 26.0)
        self.assertEqual(with_manual["arm_length"], 26.0)
        self.assertEqual(with_manual["arm_width"], 6.0)
        self.assertIsNone(with_manual["leg_length"])
        self.assertEqual(with_manual["leg_width"], 10.0)

        desc = build_anatomical_description(with_manual)
        self.assertIn("- Approximately 4.0-head-tall proportions.", desc)
        self.assertIn("- Relatively large head, narrower than the torso.", desc)
        self.assertIn("- Medium-length torso with similar width and height.", desc)
        self.assertIn("- Medium-length arms of medium thickness.", desc)
        self.assertNotIn("legs", desc.lower())

    def test_prompt_pipeline_connects_image_analysis_and_removes_block_when_empty(self):
        """
        Kiểm tra luồng Image Analysis -> Raw Metrics -> Anatomical Mapping -> Prompt Compiler:
        - Có ảnh sprite hợp lệ -> chèn khối ANATOMICAL PROPORTIONS có các gạch đầu dòng đo được.
        - Không có ảnh hoặc không đo được -> bỏ toàn bộ khối ANATOMICAL PROPORTIONS khỏi Final Prompt.
        """
        # Arrange: Tạo sprite 64x64 có nhân vật đứng (đầu to ở trên, hõm cổ thắt hẹp, thân và chân)
        sprite = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        # Đầu: y=8..25 (18px), x=22..41 (20px)
        for y in range(8, 26):
            for x in range(22, 42):
                sprite.putpixel((x, y), (240, 200, 170, 255))
        # Cổ thắt: y=26..27, x=29..34 (6px)
        for y in range(26, 28):
            for x in range(29, 35):
                sprite.putpixel((x, y), (220, 180, 150, 255))
        # Thân: y=28..45, x=23..40 (18px)
        for y in range(28, 46):
            for x in range(23, 41):
                sprite.putpixel((x, y), (70, 90, 180, 255))
        # Hai chân tách khe: y=46..55 (tổng chiều cao nhân vật = 48px từ y=8..55)
        for y in range(46, 56):
            for x in range(24, 30):
                sprite.putpixel((x, y), (50, 50, 70, 255))
            for x in range(34, 40):
                sprite.putpixel((x, y), (50, 50, 70, 255))

        with io.BytesIO() as buf:
            sprite.save(buf, format="PNG")
            data_url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

        # Act
        prompt_with_image = build_prompt_from_request(ImageGenRequest(prompt="forest ranger", image=data_url))
        prompt_without_image = build_prompt_from_request(ImageGenRequest(prompt="forest ranger"))

        # Assert
        self.assertIn("### ANATOMICAL PROPORTIONS\n\n- Approximately ", prompt_with_image)
        self.assertIn("-head-tall proportions.", prompt_with_image)
        self.assertIn("Maintain these anatomical characteristics across all 15 frames.", prompt_with_image)
        self.assertIn("### COLOR CONSTRAINTS", prompt_with_image)

        self.assertNotIn("### ANATOMICAL PROPORTIONS", prompt_without_image)
        self.assertNotIn("[ANATOMICAL_DESCRIPTION]", prompt_without_image)
        self.assertIn("### CHARACTER DESIGN\n\nforest ranger", prompt_without_image)
        self.assertIn("### COLOR CONSTRAINTS", prompt_without_image)


if __name__ == "__main__":
    unittest.main()
