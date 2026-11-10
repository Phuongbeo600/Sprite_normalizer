# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử đơn vị)
# ========================================================
import unittest
# io: Xử lý bộ nhớ luồng ảnh giả lập
import io
# os: Quản lý biến môi trường trong kiểm thử ngoại tuyến
import os

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# PIL (Pillow): Tạo ảnh mẫu RGBA kiểm thử
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services & Schemas)
# ========================================================
# CharacterAnalysisService: Dịch vụ phân tích hồ sơ nhân vật theo tab
from backend.services.character_analysis_service import CharacterAnalysisService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file test backend)


class TestCharacterProfileService(unittest.TestCase):
    """
    Bộ kiểm thử đơn vị cho Dịch vụ Phân tích Hồ sơ Nhân vật theo Phân hệ Tab:
    - Tab 1: Global & Materials
    - Tab 2: Directions (Down, Side, Up)
    - Tab 3: Animations (Idle, Walk)
    - Tab 4: Consistency & Negative Constraints
    - Prompt Studio: Sinh Prompt AI đồng bộ
    """

    def setUp(self):
        """Khởi tạo ảnh RGBA mẫu 32x48 pixel làm sprite tham chiếu kiểm thử và thiết lập chế độ ngoại tuyến."""
        self.old_gemini_key = os.environ.pop("GEMINI_API_KEY", None)
        self.old_openai_key = os.environ.pop("OPENAI_API_KEY", None)
        self.sample_image = Image.new("RGBA", (32, 48), color=(0, 0, 0, 0))
        # Vẽ một vài pixel giả lập nhân vật
        for y in range(10, 40):
            for x in range(8, 24):
                self.sample_image.putpixel((x, y), (255, 100, 50, 255))

    def tearDown(self):
        """Khôi phục biến môi trường sau khi chạy kiểm thử."""
        if self.old_gemini_key is not None:
            os.environ["GEMINI_API_KEY"] = self.old_gemini_key
        if self.old_openai_key is not None:
            os.environ["OPENAI_API_KEY"] = self.old_openai_key

    def test_analyze_tab_global(self):
        """Kiểm tra phân tích Tab 1 (Toàn cục & Vật liệu kèm 6 tiêu chuẩn hệ màu sắc)."""
        result = CharacterAnalysisService.analyze_tab_global(self.sample_image)
        self.assertIn("identity", result)
        self.assertIn("anatomy", result)
        self.assertIn("pixel_style", result)
        self.assertIn("materials", result)
        self.assertIn("palette_metrics", result)
        self.assertGreater(result["palette_metrics"]["total_colors"], 0)
        self.assertTrue(len(result["materials"]) > 0)
        self.assertIn("Pixel Art", result["identity"]["character_type"])

    def test_analyze_tab_directions(self):
        """Kiểm tra phân tích Tab 2 (3 Hướng nhìn Down / Side / Up)."""
        result = CharacterAnalysisService.analyze_tab_directions(self.sample_image)
        self.assertIn("down", result)
        self.assertIn("side", result)
        self.assertIn("up", result)
        self.assertEqual(result["down"]["view_type"], "Front")
        self.assertEqual(result["side"]["view_type"], "Right Profile")
        self.assertEqual(result["up"]["view_type"], "Back")

    def test_analyze_tab_animations(self):
        """Kiểm tra phân tích Tab 3 (Hoạt họa Idle 3 frames & Walk 4 frames)."""
        result = CharacterAnalysisService.analyze_tab_animations(self.sample_image)
        self.assertIn("down", result)
        self.assertIn("side", result)
        self.assertIn("up", result)

        down_anim = result["down"]
        self.assertEqual(down_anim["idle"]["frame_count"], 3)
        self.assertEqual(down_anim["walk"]["frame_count"], 4)
        self.assertEqual(len(down_anim["idle"]["frame_descriptions"]), 3)
        self.assertEqual(len(down_anim["walk"]["frame_descriptions"]), 4)

    def test_analyze_tab_constraints(self):
        """Kiểm tra phân tích Tab 4 (Tính nhất quán & Ràng buộc phủ định)."""
        global_res = CharacterAnalysisService.analyze_tab_global(self.sample_image)
        dir_res = CharacterAnalysisService.analyze_tab_directions(self.sample_image)
        anim_res = CharacterAnalysisService.analyze_tab_animations(self.sample_image)

        result = CharacterAnalysisService.analyze_tab_constraints(
            global_data=global_res,
            direction_data=dir_res,
            animation_data=anim_res
        )

        self.assertIn("consistency_analysis", result)
        self.assertIn("negative_constraints", result)
        self.assertTrue(len(result["consistency_analysis"]["invariant_features"]) > 0)
        self.assertTrue(len(result["negative_constraints"]["forbidden_design_changes"]) > 0)

    def test_generate_character_prompt_from_profile(self):
        """Kiểm tra bộ máy sinh Prompt AI từ hồ sơ hoàn chỉnh."""
        global_res = CharacterAnalysisService.analyze_tab_global(self.sample_image)
        profile_data = {
            "global_analysis": global_res,
            "direction_analysis": {},
            "animation_analysis": {},
            "consistency_analysis": {},
            "negative_constraints": {}
        }

        prompt_res = CharacterAnalysisService.generate_character_prompt_from_profile(
            profile_data=profile_data,
            new_character_concept="Nữ hiệp sĩ tóc bạc áo giáp bạc",
            target_direction="Front / Down view"
        )

        self.assertIn("positive_prompt", prompt_res)
        self.assertIn("negative_prompt", prompt_res)
        self.assertIn("technical_notes", prompt_res)
        self.assertIn("Nữ hiệp sĩ tóc bạc áo giáp bạc", prompt_res["positive_prompt"])
        self.assertIn("pixel art", prompt_res["positive_prompt"].lower())

    def test_generate_custom_new_character_not_hardcoded(self):
        """
        Kiểm tra Prompt nhân vật mới KHÔNG bị gán cứng vào trang phục/vũ khí của nhân vật cũ:
        Ví dụ: Tạo 'Nữ phù thủy áo tím cầm trượng' từ nhân vật mẫu thì prompt mới
        phải mang đúng áo tím và trượng phép của phù thủy, không bị ám giáp sắt/kiếm cũ.
        """
        global_res = CharacterAnalysisService.analyze_tab_global(self.sample_image)
        profile_data = {
            "global_analysis": global_res,
            "direction_analysis": {},
            "animation_analysis": {},
            "consistency_analysis": {},
            "negative_constraints": {}
        }

        prompt_res = CharacterAnalysisService.generate_character_prompt_from_profile(
            profile_data=profile_data,
            new_character_concept="Nữ phù thủy bóng đêm bí ẩn",
            target_direction="Side Profile view",
            outfit_and_colors="Áo choàng nhung tím đen viền vàng",
            weapons_and_props="Trượng phép đính ngọc xanh",
            stature_rule="Nhỏ hơn nhân vật gốc (Dáng cao hơn)",
            inherit_scale=True,
            inherit_style=True
        )

        pos_prompt = prompt_res["positive_prompt"]
        self.assertIn("Nữ phù thủy bóng đêm bí ẩn", pos_prompt)
        self.assertIn("Áo choàng nhung tím đen viền vàng", pos_prompt)
        self.assertIn("Trượng phép đính ngọc xanh", pos_prompt)
        # Khẳng định không bị nhét trang phục phiêu lưu của nhân vật mẫu vào
        self.assertNotIn("Trang phục phiêu lưu", pos_prompt)
        self.assertIn("16-bit", pos_prompt.lower())


if __name__ == "__main__":
    unittest.main()
