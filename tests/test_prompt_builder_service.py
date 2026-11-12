# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử đơn vị)
# ========================================================
# unittest: Framework kiểm thử chuẩn của Python
import unittest

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services & Schemas)
# ========================================================
# PromptBuilderService: Dịch vụ xây dựng ma trận 15 frame hoạt họa chân tay đối nghịch
from backend.services.prompt_builder_service import PromptBuilderService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file test backend)


class TestPromptBuilderService(unittest.TestCase):
    """
    Bộ kiểm thử cho Dịch vụ Xây Dựng Prompt Ma Trận 15 Frame Hoạt Họa Pixel Art:
    - Kiểm tra sinh đủ 3 hướng (Down, Side, Up), mỗi hướng 5 frames (1 Idle + 4 Walk) = 15 frames.
    - Kiểm tra tiêm thông số từ Schemas (chiều cao, tỷ lệ đầu, độ nhún trọng tâm bobbing).
    - Kiểm tra cả CHÂN và TAY đều chuyển động đối nghịch trong các frame đi bộ.
    - Kiểm tra biên dịch Prompt 3 Tầng hoàn chỉnh (positive_prompt và negative_prompt).
    """

    def setUp(self):
        """Khởi tạo dữ liệu giả lập từ 7 Schemas đã phân tích."""
        self.mock_profile_data = {
            "anatomy": {
                "anatomical_height": 48,
                "head_to_body_ratio": "1:4.0",
                "head_height": 12
            },
            "pixel_style": {
                "pixel_art_era": "16-bit SNES",
                "outline_style": "crisp dark pixel contour",
                "shading_style": "2-tone cell shading",
                "lighting_direction": "consistent top-left lighting"
            },
            "animations": {
                "walk_profile": {
                    "vertical_bobbing_pixels": "2px",
                    "secondary_motion": "purple cape billowing back"
                }
            },
            "directions": {
                "down_profile": {"visible_body_parts": ["Face", "Chest armor", "Both arms", "Both legs"]},
                "side_profile": {"occluded_body_parts": ["Far arm and leg hidden behind torso"]},
                "up_profile": {"visible_body_parts": ["Back of hair", "Backplate", "Shoe soles"]}
            }
        }

    def test_build_15_frames_matrix(self):
        """Kiểm tra cấu trúc ma trận 15 frame có đủ 3 hướng và các chuyển động chân tay đối nghịch."""
        matrix = PromptBuilderService.build_default_frame_actions(self.mock_profile_data)

        # Kiểm tra đủ 3 hướng
        self.assertIn("down", matrix)
        self.assertIn("side", matrix)
        self.assertIn("up", matrix)

        # Kiểm tra mỗi hướng có đủ 5 frame (idle + 4 bước)
        for direction in ["down", "side", "up"]:
            frames = matrix[direction]
            self.assertEqual(len(frames), 5, f"Hướng {direction} phải có đủ 5 frames.")
            self.assertIn("idle", frames)
            self.assertIn("frame_1", frames)
            self.assertIn("frame_2", frames)
            self.assertIn("frame_3", frames)
            self.assertIn("frame_4", frames)

        # Kiểm tra frame tĩnh (Idle) có chứa chiều cao giải phẫu từ Schema
        self.assertIn("48px height", matrix["down"]["idle"]["action_prompt"])
        self.assertIn("1:4.0 ratio", matrix["down"]["idle"]["action_prompt"])

        # Kiểm tra Frame động đi bộ có sự phối hợp cả CHÂN và TAY
        f1_prompt = matrix["down"]["frame_1"]["action_prompt"].lower()
        self.assertTrue("left foot" in f1_prompt or "left leg" in f1_prompt)
        self.assertTrue("right arm" in f1_prompt)

        # Kiểm tra độ nhún trọng tâm (bobbing) từ schema được tiêm vào frame 2
        f2_prompt = matrix["down"]["frame_2"]["action_prompt"]
        self.assertIn("2px", f2_prompt)
        self.assertIn("purple cape billowing back", f2_prompt)

    def test_compile_three_tier_prompt(self):
        """Kiểm tra biên dịch câu prompt 3 tầng từ ma trận 15 frame."""
        matrix = PromptBuilderService.build_default_frame_actions(self.mock_profile_data)
        compiled = PromptBuilderService.compile_sprite_sheet_prompt(
            character_concept="Nữ pháp sư bóng đêm",
            profile_data=self.mock_profile_data,
            frame_actions=matrix,
            outfit_and_colors="áo choàng tím và gậy phép",
            weapons_and_props="viên ngọc ma thuật"
        )

        pos = compiled["positive_prompt"]
        neg = compiled["negative_prompt"]

        # Kiểm tra Tầng 1: Phong cách & Ý tưởng
        self.assertIn("16-bit SNES", pos)
        self.assertIn("Nữ pháp sư bóng đêm", pos)
        self.assertIn("48 pixels character height", pos)

        # Kiểm tra Tầng 2: Bố cục lưới 3x5
        self.assertIn("3 Rows x 5 Columns, total 15 frames", pos)

        # Kiểm tra Tầng 3: Có đầy đủ 3 Row với các Col 0 đến Col 4
        self.assertIn("[ROW 1 - DOWN / FRONT VIEW]", pos)
        self.assertIn("[ROW 2 - SIDE / RIGHT PROFILE VIEW]", pos)
        self.assertIn("[ROW 3 - UP / BACK VIEW]", pos)
        self.assertIn("Col 0 (Idle)", pos)
        self.assertIn("Col 4 (Walk 4)", pos)

        # Kiểm tra Negative Prompt chống lỗi
        self.assertIn("blurry", neg)
        self.assertIn("deformed anatomy", neg)

    def test_prompt_takes_outline_only_from_color_spec(self):
        """Kiểm tra mô tả viền AI không lấn át đặc tả viền Python."""
        profile = {
            "pixel_style": {"outline_style": "AI colored outline", "shading_style": "Cel-shading"},
            "palette_metrics": {"outline_style_detected": "Selective Outline (Selout)"},
        }
        prompt = PromptBuilderService.compile_sprite_sheet_prompt("Knight", profile)["positive_prompt"]
        self.assertEqual(prompt.count("Outline Grammar:"), 1)
        self.assertIn("Selective Outline (Selout)", prompt)
        self.assertNotIn("AI colored outline", prompt)
        self.assertNotIn("distinct tone levels", prompt)
        self.assertIn("Cel-shading", prompt)

        prompt = PromptBuilderService.compile_sprite_sheet_prompt(
            "Knight", profile, inherit_style=False,
        )["positive_prompt"]
        self.assertNotIn("Selective Outline (Selout)", prompt)
        self.assertNotIn("AI colored outline", prompt)


if __name__ == "__main__":
    unittest.main()
