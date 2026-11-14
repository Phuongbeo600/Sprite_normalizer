# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử đơn vị)
# ========================================================
# unittest: Framework kiểm thử chuẩn của Python
import unittest
# patch, MagicMock: Chặn HTTP và CSDL trong kiểm thử để xác nhận không có yêu cầu ra ngoài.
from unittest.mock import patch, MagicMock
# asyncio: Gọi các hàm xử lý bất đồng bộ của tuyến API.
import asyncio
# io: Xử lý bộ nhớ luồng ảnh giả lập
import io
# json: Mô phỏng tệp số đo của công cụ khoanh vùng.
import json
# os: Quản lý biến môi trường trong kiểm thử ngoại tuyến
import os

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# PIL (Pillow): Tạo ảnh mẫu RGBA kiểm thử
from PIL import Image
# UploadFile: Tạo tệp ảnh đầu vào cho tuyến API phân tích.
from fastapi import UploadFile

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services & Schemas)
# ========================================================
# CharacterAnalysisService: Dịch vụ phân tích hồ sơ nhân vật theo tab
from backend.services.character_analysis_service import CharacterAnalysisService
# SettingsService: Kiểm tra hành vi của tuyến kiểm tra khóa OpenAI.
from backend.services.settings_service import SettingsService
# PromptBuilderService: Dịch vụ xây dựng ma trận 15 frame hoạt họa và biên dịch prompt 3 tầng
from backend.services.prompt_builder_service import PromptBuilderService
# ProjectService: Dịch vụ dự án hỗ trợ cấu hình API
from backend.services.project_service import ProjectService
# Các tuyến phân tích ảnh, hồ sơ và sinh prompt.
from backend.api.v1.sprites import analyze_character
# sprites: Gọi tuyến đo thủ công với đa giác hoặc đoạn thẳng.
from backend.api.v1 import sprites
# character_analysis: Gọi tuyến tạo chỉ dẫn phong cách từ ảnh mẫu.
from backend.api.v1 import character_analysis
from backend.api.v1.character_analysis import (
    GeneratePromptFromProfileRequest, analyze_character_tab, generate_prompt_from_profile,
)

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
        # Giả lập phiên CSDL để tránh kết nối socket MySQL chậm trong môi trường cô lập
        self.mock_db = MagicMock()
        self.mock_db.mappings.return_value.first.return_value = None
        self.mock_session = MagicMock()
        self.mock_session.__enter__.return_value = self.mock_db
        self.session_patcher = patch("backend.api.v1.character_analysis.SessionLocal", return_value=self.mock_session)
        self.session_patcher.start()

    def tearDown(self):
        """Khôi phục biến môi trường và dừng giả lập CSDL sau khi chạy kiểm thử."""
        self.session_patcher.stop()
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

    def test_configured_openai_creates_reference_style_through_proxy(self):
        """Kiểm tra OpenAI dùng khóa và Base URL của dự án cho ảnh và prompt."""
        base_url = "https://proxy.example/v1"
        buffer = io.BytesIO()
        self.sample_image.save(buffer, format="PNG")
        buffer.seek(0)
        upload = UploadFile(buffer, filename="sprite.png", headers={"content-type": "image/png"})
        with (
            patch("backend.api.v1.character_analysis._resolve_project_api_key", return_value=("fake-key", "openai", base_url)),
            patch("requests.post") as request,
        ):
            request.return_value.status_code = 200
            request.return_value.json.return_value = {"choices": [{"message": {"content": json.dumps({
                "style_prompt": "Place darker contours where shapes overlap.",
                "observations": ["Đường tối nằm tại mép chồng nhau."],
            })}}]}
            self.assertEqual(SettingsService.test_api_key("openai", "fake-key", base_url)["status"], "success")
            self.assertEqual(character_analysis.get_vision_status(91)["provider"], "openai")
            result = asyncio.run(character_analysis.generate_reference_style_prompt(upload, "{}", project_id=91))

        self.assertEqual(result.provider, "openai")
        self.assertEqual(result.style_prompt, "Place darker contours where shapes overlap.")
        args, kwargs = request.call_args
        self.assertEqual(args[0], f"{base_url}/chat/completions")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer fake-key")
        content = kwargs["json"]["messages"][0]["content"]
        self.assertIn("style_prompt", content[0]["text"])
        self.assertTrue(content[1]["image_url"]["url"].startswith("data:image/png;base64,"))

    def test_vision_schema_excludes_python_measurements(self):
        """Kiểm tra yêu cầu AI và kết quả khi nhà cung cấp trả thêm trường cũ."""
        raw_profile = CharacterAnalysisService._get_offline_fallback_global()
        raw_profile["palette_metrics"] = {"total_colors": 999}
        raw_profile["pixel_style"]["shading_levels"] = 7
        with patch("backend.services.character_analysis_service.AiProviderFactory.get_provider") as factory:
            vision = factory.return_value.analyze_vision
            vision.return_value = raw_profile
            result = CharacterAnalysisService.analyze_tab_global(self.sample_image, api_key="fake-key")

        sent_prompt = vision.call_args.args[2]
        self.assertNotIn('"palette_metrics"', sent_prompt)
        self.assertNotIn('"shading_levels"', sent_prompt)
        self.assertNotIn("shading levels", sent_prompt)
        self.assertEqual(result["palette_metrics"]["total_colors"], 1)
        self.assertIsNone(result["pixel_style"].get("shading_levels"))
        self.assertNotIn("distinct tone levels", result["palette_metrics"]["master_color_prompt"])
        self.assertIsNone(CharacterAnalysisService.analyze_tab_global(self.sample_image)["pixel_style"].get("shading_levels"))

    def test_analyze_tab_directions(self):
        """Kiểm tra phân tích Tab 2 (3 Hướng nhìn Down / Side / Up)."""
        result = CharacterAnalysisService.analyze_tab_directions(self.sample_image)
        self.assertIn("down", result)
        self.assertIn("side", result)
        self.assertIn("up", result)
        self.assertEqual(result["down"]["view_type"], "Front")
        self.assertEqual(result["side"]["view_type"], "Right Profile")
        self.assertEqual(result["up"]["view_type"], "Back")

    def test_sprite_analysis_and_prompt_use_new_measurements(self):
        """Kiểm tra số đo lát cắt, báo cáo màu và prompt qua các API hiện có."""
        split_image = self.sample_image.copy()
        split_image.paste((0, 0, 0, 0), (15, 10, 16, 40))
        image = split_image.resize((96, 144), Image.Resampling.NEAREST)
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")

        def upload():
            return UploadFile(
                io.BytesIO(buffer.getvalue()), filename="reference.png",
                headers={"content-type": "image/png"},
            )

        with (
            patch.dict(os.environ, {"GEMINI_API_KEY": "fake-key"}),
            patch("requests.sessions.Session.request") as outbound,
        ):
            colors = sprites.analyze_sprite_colors(upload())
            anatomy = asyncio.run(analyze_character(upload(), auto_remove_bg=True))
            outbound.assert_not_called()
        self.assertEqual(colors["palette_metrics"]["total_colors"], 1)
        self.assertEqual(anatomy["metrics"]["head_width"], 48)
        measured = anatomy.get("region_measurements", {})
        self.assertEqual(measured.get("measurements", {}).get("head", {}).get("width_px"), 24)

        profile = asyncio.run(analyze_character_tab(
            upload(), "all", None, None, None, None, None,
        ))["data"]
        self.assertEqual(profile.get("pixel_art_report", {}).get("palette", {}).get("total_colors"), 1)
        self.assertEqual(profile["palette_metrics"]["top_hex_list"], ["#ff6432"])
        self.assertEqual(profile["palette_metrics"]["contrast_ratio"], 1)
        profile["region_measurements"] = measured

        result = asyncio.run(generate_prompt_from_profile(
            GeneratePromptFromProfileRequest(profile_data=profile),
        ))
        prompt = result["data"]["positive_prompt"]
        self.assertIn("head width 24 px", prompt)
        self.assertIn("#ff6432", prompt)

        result = asyncio.run(generate_prompt_from_profile(
            GeneratePromptFromProfileRequest(profile_data=profile, inherit_scale=False, inherit_style=False),
        ))
        prompt = result["data"]["positive_prompt"]
        self.assertNotIn("head width 24 px", prompt)
        self.assertNotIn("#ff6432", prompt)

    def test_explicit_vision_scan_does_not_measure_colors(self):
        """Quét mô tả dùng ảnh và khóa Gemini, không chạy lại thuật toán đo màu."""
        buffer = io.BytesIO()
        self.sample_image.save(buffer, format="PNG")
        buffer.seek(0)
        upload = UploadFile(buffer, filename="sprite.png", headers={"content-type": "image/png"})
        with patch("backend.services.character_analysis_service.AiProviderFactory.get_provider") as factory:
            factory.return_value.analyze_vision.return_value = CharacterAnalysisService._get_offline_fallback_global()
            result = asyncio.run(analyze_character_tab(
                upload, "global", None, "fake-key", "gemini", None, None, vision_only=True,
            ))
            factory.return_value.analyze_vision.assert_called_once()
        self.assertNotIn("palette_metrics", result["data"])
        self.assertNotIn("pixel_art_report", result["data"])

    def test_style_prompt_uses_project_provider_and_python_metrics(self):
        """Kiểm tra ảnh và số đo được gửi cùng lúc để lấy đoạn phong cách."""
        buffer = io.BytesIO()
        self.sample_image.save(buffer, format="PNG")
        buffer.seek(0)
        upload = UploadFile(buffer, filename="sprite.png", headers={"content-type": "image/png"})
        with (
            patch("backend.api.v1.character_analysis._resolve_project_api_key", return_value=("fake-key", "gemini", None)) as credentials,
            patch("backend.providers.factory.AiProviderFactory.get_provider") as factory,
        ):
            vision = factory.return_value.analyze_vision
            vision.return_value = {
                "style_prompt": "Use cool shadow clusters where forms overlap.",
                "observations": ["Bóng lạnh nằm dưới mái tóc."],
            }
            result = asyncio.run(character_analysis.generate_reference_style_prompt(
                upload, '{"palette":{"total_colors":32}}', project_id=91,
            ))

        credentials.assert_called_once_with(91, None, None, None)
        factory.assert_called_once_with("gemini")
        image, key, prompt = vision.call_args.args
        self.assertEqual(image.size, self.sample_image.size)
        self.assertEqual(key, "fake-key")
        self.assertIn('"total_colors": 32', prompt)
        self.assertIn("Bạn là họa sĩ pixel art", prompt)
        self.assertEqual(result.style_prompt, "Use cool shadow clusters where forms overlap.")
        self.assertEqual(result.observations, ["Bóng lạnh nằm dưới mái tóc."])

        profile = {"reference_style": result.model_dump()}
        compiled = asyncio.run(generate_prompt_from_profile(
            GeneratePromptFromProfileRequest(profile_data=profile, core_concept="Orange explorer robot"),
        ))["data"]["positive_prompt"]
        self.assertIn("Orange explorer robot", compiled)
        self.assertIn(result.style_prompt, compiled)
        self.assertNotIn(result.observations[0], compiled)

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

    def test_manual_measurements_use_polygons_and_segments(self):
        """Kiểm tra đa giác tay có trục và đoạn đo đầu trên cùng ảnh."""
        buffer = io.BytesIO()
        self.sample_image.save(buffer, format="PNG")
        buffer.seek(0)
        upload = UploadFile(buffer, filename="sprite.png", headers={"content-type": "image/png"})
        payload = {
            "image_size_px": [32, 48],
            "measurements": {
                "head": {"start": [8, 12], "end": [16, 18], "width_px": 999},
                "left_arm": {
                    "polygon": [[8, 10], [14, 10], [14, 25], [8, 25]],
                    "axis": [[11, 10], [11, 25]],
                },
            },
        }
        report = sprites.measure_manual_regions(upload, json.dumps(payload))
        self.assertEqual(report["measurements"]["head"]["width_px"], 10)
        self.assertEqual(report["measurements"]["left_arm"]["width_px"], 6)
        self.assertEqual(len(report["measurements"]["left_arm"]["cuts"]), 3)
        self.assertIn("left arm width 6 px", report["prompt_notes"])

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
        """Kiểm tra bộ máy sinh Prompt AI từ hồ sơ hoàn chỉnh thông qua PromptBuilderService."""
        global_res = CharacterAnalysisService.analyze_tab_global(self.sample_image)
        profile_data = {
            "global_analysis": global_res,
            "direction_analysis": {},
            "animation_analysis": {},
            "consistency_analysis": {},
            "negative_constraints": {}
        }

        prompt_res = PromptBuilderService.compile_sprite_sheet_prompt(
            character_concept="Nữ hiệp sĩ tóc bạc áo giáp bạc",
            profile_data=profile_data
        )

        self.assertIn("positive_prompt", prompt_res)
        self.assertIn("negative_prompt", prompt_res)
        self.assertIn("frame_actions_data", prompt_res)
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

        prompt_res = PromptBuilderService.compile_sprite_sheet_prompt(
            character_concept="Nữ phù thủy bóng đêm bí ẩn",
            profile_data=profile_data,
            outfit_and_colors="Áo choàng nhung tím đen viền vàng",
            weapons_and_props="Trượng phép đính ngọc xanh",
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
