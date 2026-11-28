# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử, Toán học & Kiểu)
# ========================================================
import unittest

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Core Metrics, Services & Prompt)
# ========================================================
from backend.core.metrics.anatomy_mapping import (
    build_anatomical_description,
    extract_raw_anatomy_metrics,
)
from backend.core.metrics.manual_anatomy_measurement import (
    MANUAL_ANATOMY_SPECS,
    compute_manual_anatomy_report,
)
from backend.schemas.image_gen import ImageGenRequest
from backend.services.character.anatomy_service import AnatomyService
from backend.services.image_gen_prompts import build_prompt_from_request

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & CẤU HÌNH (Stylesheets / Config)
# ========================================================
# (Không áp dụng cho tệp kiểm thử backend)


class TestManualAnatomyMeasurement(unittest.TestCase):
    """Kiểm thử toàn diện cho công cụ đo đoạn thẳng thủ công 11 thông số và luồng nối Template."""

    def test_11_metrics_geometry_rules_and_keypoints(self):
        """Kiểm tra đầy đủ phép tính trục Y, trục X, Euclidean qua khớp, vuông góc trục chi và keypoints."""
        raw = {
            "body_height": {"points": [[45, 5], [52, 105]]},        # |105 - 5| = 100.0
            "head_height": {"points": [[48, 5], [50, 30]]},         # |30 - 5| = 25.0
            "head_width": {"points": [[38, 12], [62, 22]]},         # |62 - 38| = 24.0
            "torso_height": {"points": [[49, 30], [50, 65]]},       # |65 - 30| = 35.0
            "torso_width": {"points": [[39, 45], [61, 47]]},        # |61 - 39| = 22.0
            "shoulder_width": {"points": [[35, 32], [65, 33]]},     # |65 - 35| = 30.0
            "hip_width": {"points": [[40, 64], [60, 65]]},          # |60 - 40| = 20.0
            "arm_length": {"points": [[35, 34], [35, 46], [44, 46]]},  # 12 + 9 = 21.0
            "arm_width": {"points": [[33, 38], [39, 42]]},          # Đốt trục dọc -> vuông góc theo X = |39-33| = 6.0
            "leg_length": {"points": [[44, 65], [44, 85], [47, 89]]},  # 20 + 5 = 25.0
            "leg_width": {"points": [[41, 75], [49, 77]]},          # Đốt trục dọc -> vuông góc theo X = |49-41| = 8.0
        }

        report = compute_manual_anatomy_report((100, 120), raw)
        self.assertEqual(len(MANUAL_ANATOMY_SPECS), 11)
        self.assertEqual(report["schema_version"], "point_to_point_v1")
        self.assertEqual(report["image_size_px"], [100, 120])

        expected = {
            "body_height": 100.0,
            "head_height": 25.0,
            "head_width": 24.0,
            "torso_height": 35.0,
            "torso_width": 22.0,
            "shoulder_width": 30.0,
            "hip_width": 20.0,
            "arm_length": 21.0,
            "arm_width": 6.0,
            "leg_length": 25.0,
            "leg_width": 8.0,
        }
        for key, val in expected.items():
            self.assertEqual(report["raw_anatomy_metrics"][key], val, msg=f"Sai số đo {key}")
            self.assertEqual(report["measurements"][key]["value_px"], val)
            self.assertEqual(report["measurements"][key]["status"], "measured")

        # Kiểm tra cấu trúc keypoints lưu nhãn vai trò điểm cho Keypoint Detection
        arm_kps = [kp for kp in report["keypoints"] if kp["metric"] == "arm_length"]
        self.assertEqual([kp["role"] for kp in arm_kps], ["start", "joint_1", "end"])

    def test_occluded_parts_are_never_inferred_and_override_auto(self):
        """Bộ phận đánh dấu che khuất giữ nguyên None, không tự suy diễn và không lấy ngược từ số đo tự động."""
        sprite = Image.new("RGBA", (80, 100), (0, 0, 0, 0))
        manual_report = AnatomyService.measure_manual_regions(
            sprite,
            {
                "image_size_px": [80, 100],
                "measurements": {
                    "body_height": {"points": [[40, 10], [40, 90]]},
                    "head_height": {"points": [[40, 10], [40, 30]]},
                    "head_width": {"occluded": True},
                    "shoulder_width": {"occluded": True},
                },
            },
        )

        auto_metrics = {"anatomical_height": 70, "head_height": 14, "head_width": 25, "torso_width": 20}
        merged = extract_raw_anatomy_metrics(metrics=auto_metrics, manual_region_measurements=manual_report)
        self.assertEqual(merged["body_height"], 80.0)   # Thủ công ghi đè tự động
        self.assertEqual(merged["head_height"], 20.0)   # Thủ công ghi đè tự động
        self.assertIsNone(merged["head_width"])         # Bị che khuất -> không lấy 25 từ auto
        self.assertIsNone(merged["shoulder_width"])     # Bị che khuất -> không tự suy diễn
        self.assertEqual(merged["torso_width"], 20.0)   # Chưa đo thủ công -> giữ fallback từ auto

    def test_rejects_out_of_bounds_or_zero_length_coordinates(self):
        """Tọa độ ngoài ảnh gốc hoặc hai điểm trùng nhau theo phương đo phải báo ValueError."""
        with self.assertRaises(ValueError):
            compute_manual_anatomy_report((64, 64), {"body_height": {"points": [[10, 5], [70, 50]]}})
        with self.assertRaises(ValueError):
            compute_manual_anatomy_report((64, 64), {"head_width": {"points": [[20, 10], [20, 30]]}})

    def test_end_to_end_manual_measurements_reach_master_prompt_template(self):
        """Kiểm tra luồng Điểm đo -> Python -> Anatomical Mapping -> Master Prompt Template."""
        manual_report = compute_manual_anatomy_report(
            (100, 120),
            {
                "body_height": {"points": [[50, 10], [50, 110]]},      # 100
                "head_height": {"points": [[50, 10], [50, 35]]},       # 25 (4.0 heads)
                "head_width": {"points": [[38, 20], [62, 20]]},        # 24
                "torso_height": {"points": [[50, 35], [50, 70]]},      # 35
                "torso_width": {"points": [[38, 50], [62, 50]]},       # 24
                "shoulder_width": {"points": [[34, 37], [66, 37]]},    # 32
                "hip_width": {"points": [[40, 70], [60, 70]]},         # 20
                "arm_length": {"points": [[34, 37], [30, 62]]},
                "arm_width": {"points": [[28, 50], [34, 50]]},
                "leg_length": {"points": [[43, 70], [43, 110]]},
                "leg_width": {"points": [[39, 90], [47, 90]]},
            },
        )
        req = ImageGenRequest(
            prompt="paladin",
            manual_region_measurements=manual_report,
        )
        final_prompt = build_prompt_from_request(req)
        self.assertIn("### ANATOMICAL PROPORTIONS", final_prompt)
        self.assertIn("4.0-head-tall proportions.", final_prompt)
        self.assertIn("Shoulders much broader than hips.", final_prompt)
        desc = build_anatomical_description(extract_raw_anatomy_metrics(manual_region_measurements=manual_report))
        self.assertIn("arms", desc)
        self.assertIn("legs", desc)
