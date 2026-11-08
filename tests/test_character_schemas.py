# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử đơn vị & JSON)
# ========================================================
# unittest: Framework kiểm thử chuẩn của Python
import unittest
# json: Thao tác kiểm tra chuỗi JSON tuần tự hóa
import json

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Bắt lỗi kiểm tra tính hợp lệ ValidationError
from pydantic import ValidationError

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Pydantic Schemas)
# ========================================================
# Import toàn bộ các Schema nhân vật mới
from backend.schemas.character import (
    IdentityAnalysis,
    AnatomyAnalysis,
    PixelStyleAnalysis,
    MaterialType,
    MaterialAnalysis,
    ViewType,
    DirectionProfile,
    DirectionAnalysis,
    AnimationType,
    AnimationProfile,
    DirectionAnimation,
    AnimationAnalysis,
    GlobalAnalysis,
    ConsistencyAnalysis,
    NegativeConstraints,
    AIAnalysis
)
# Import các Schema hiện hữu của hệ thống để xác nhận không bị ảnh hưởng
from backend.schemas import (
    ProjectCreateRequest,
    ProjectItem,
    SettingsUpdateRequest,
    PromptAdviceRequest
)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file test backend)


class TestCharacterSchemas(unittest.TestCase):
    """
    Bộ kiểm thử đơn vị cho toàn bộ Pydantic Schema của AI Reference Asset Analysis.
    Kiểm tra 7 tiêu chí theo yêu cầu kỹ thuật:
    1. Import thành công.
    2. Khởi tạo và validate dữ liệu hợp lệ.
    3. Bắt lỗi khi dữ liệu sai kiểu.
    4. Tuần tự hóa JSON (Serialize).
    5. Giải tuần tự hóa từ JSON (Deserialize).
    6. Xử lý chính xác các trường tùy chọn (None).
    7. Không làm ảnh hưởng đến các Schema hiện có của hệ thống.
    """

    def setUp(self):
        """Khởi tạo dữ liệu mẫu hợp lệ cho một nhân vật hiệp sĩ pixel art hoàn chỉnh."""
        self.identity_data = {
            "character_type": "Hiệp sĩ áo giáp sắt",
            "gender_presentation": "Masculine",
            "body_type": "Chibi Bulky",
            "distinctive_features": ["Mũ sắt có chỏm lông đỏ", "Tấm khiên tròn chữ thập vàng"],
            "silhouette": "Hình thang thấp vững chãi",
            "shape_language": ["Heavy", "Angular"],
            "facial_features": "Mặt bị che khuất bởi khe mũ giáp sắt",
            "costume_description": "Áo giáp thép tấm màu xám bạc viền đồng, thắt lưng da nâu",
            "accessories": ["Thanh kiếm bản ngắn", "Khiên tròn"]
        }

        self.anatomy_data = {
            "body_structure": "Humanoid Chibi 2.5 đầu",
            "head_description": "Đầu to tròn mang mũ sắt chiếm 35% chiều cao",
            "torso_description": "Thân hình khối hộp ngắn mặc giáp ngực",
            "arm_structure": "Hai tay ngắn mang găng sắt bảo hộ",
            "leg_structure": "Hai chân ngắn mang ủng sắt nặng",
            "unusual_body_parts": [],
            "identifiable_landmarks": ["Đường ranh giới cổ", "Khớp háng", "Gót chân tiếp đất"],
            "relative_limb_placement": "Hai tay hạ thấp trước ngực, hai chân đứng ngang bằng vai",
            "anatomical_ambiguities": ["Cổ chân bị giáp ủng che khuất hoàn toàn"]
        }

        self.pixel_style_data = {
            "art_style": "16-bit SNES / GBA Retro RPG",
            "outline_style": "Dark selective outline (Selout)",
            "shading_style": "Cel-shading 3 mảng sáng tối rõ ràng",
            "shading_levels": 3,
            "dithering_style": None,
            "pixel_cluster_style": "Chunky pixel clusters",
            "detail_density": "Moderate",
            "pixel_cleanliness": "Clean, không có stray pixels",
            "lighting_direction": "Top-left",
            "visual_artifacts": []
        }

        self.material_data = [
            {
                "region_name": "Tấm giáp ngực",
                "material_type": "Metal",
                "color_description": "Xám thép ánh xanh lam lạnh",
                "shadow_description": "Xanh thẫm tương phản gắt",
                "highlight_description": "Chấm trắng 1 pixel ở cạnh mép",
                "reflectivity": "High-reflectivity metallic",
                "pixel_texture": "Smooth plate",
                "shading_description": "Phân mảng góc cạnh sắc sảo"
            },
            {
                "region_name": "Áo choàng",
                "material_type": "Cloth",
                "color_description": "Đỏ sẫm",
                "shadow_description": "Đỏ mận chín ngả đen",
                "highlight_description": None,
                "reflectivity": "Matte",
                "pixel_texture": "Soft fabric",
                "shading_description": "Chuyển mảng mềm theo nếp gấp"
            }
        ]

        # Hồ sơ hướng nhìn mẫu
        self.direction_down_data = {
            "view_type": "Front",
            "body_orientation": "Quay trực diện về người chơi",
            "head_orientation": "Nhìn thẳng",
            "visible_body_parts": ["Mặt trước mũ giáp", "Ngực", "Hai tay", "Hai chân"],
            "occluded_body_parts": ["Lưng", "Gáy"],
            "visible_accessories": ["Kiếm tay phải", "Khiên tay trái"],
            "accessory_placement": "Khiên giơ ngang ngực, kiếm hạ xuôi hông",
            "silhouette_description": "Hình thang đối xứng vững chãi",
            "view_specific_features": ["Khe nhìn của mũ giáp sắt", "Họa tiết chữ thập trên khiên"],
            "occlusion_rules": ["Khiên đè lên cẳng tay trái", "Giáp ngực đè lên đai thắt lưng"]
        }

        self.direction_side_data = {
            "view_type": "Right Profile",
            "body_orientation": "Ngoảnh ngang 90 độ sang phải",
            "head_orientation": "Nhìn ngang sang phải",
            "visible_body_parts": ["Cạnh phải mũ", "Mạn sườn phải", "Cánh tay phải", "Hai chân nhìn so le"],
            "occluded_body_parts": ["Nửa thân trái", "Cánh tay trái bị thân che"],
            "visible_accessories": ["Thanh kiếm cầm tay phải", "Bao kiếm đeo sau lưng"],
            "accessory_placement": "Kiếm chìa ra phía trước",
            "silhouette_description": "Hình chữ nhật đứng với mũi kiếm nhô ra",
            "view_specific_features": ["Gờ nổi chóp nón mũ sắt"],
            "occlusion_rules": ["Thân mình che hoàn toàn khiên bên tay trái"]
        }

        self.direction_up_data = {
            "view_type": "Back",
            "body_orientation": "Quay lưng hoàn toàn về phía người quan sát",
            "head_orientation": "Nhìn về hướng bắc",
            "visible_body_parts": ["Gáy mũ sắt", "Lưng áo choàng", "Gót hai chân"],
            "occluded_body_parts": ["Khuôn mặt", "Giáp ngực", "Bụng"],
            "visible_accessories": ["Áo choàng phủ lưng", "Chuôi kiếm thò ra sau vai"],
            "accessory_placement": "Áo choàng buông thẳng từ vai",
            "silhouette_description": "Hình chữ A xòe nhẹ phía dưới gót",
            "view_specific_features": ["Búi lông đỏ gắn chóp mũ nhìn từ sau"],
            "occlusion_rules": ["Áo choàng che hoàn toàn phần lưng và mông"]
        }

        # Hoạt họa mẫu cho 1 hướng
        self.animation_profile_idle = {
            "animation_type": "Idle",
            "frame_count": 3,
            "frame_descriptions": [
                "Frame 1: Đứng thẳng thả lỏng, ngực hít nhẹ",
                "Frame 2: Thân mình nhún xuống 1px tại hõm gối, ngực nở tối đa",
                "Frame 3: Thân mình nâng về vị trí cân bằng"
            ],
            "moving_body_parts": ["Giáp ngực nâng hạ 1px", "Búi lông mũ đung đưa"],
            "fixed_body_parts": ["Hai bàn chân bám sát mặt đất", "Khiên giữ nguyên vị trí"],
            "leg_motion": "Không dịch chuyển chân, gối hơi nhún 1px ở frame 2",
            "arm_motion": "Cánh tay giữ kiếm hơi nâng lên 1px theo nhịp thở",
            "secondary_motion": "Tà áo choàng nhấp nhô nhẹ 1px ở rìa dưới",
            "motion_sequence": "Thở vào (F1) -> Giữ hơi nhún nhẹ (F2) -> Thở ra về ban đầu (F3)",
            "loop_characteristics": "Seamless loop 3 frame mượt mà",
            "observed_inconsistencies": []
        }

        self.animation_profile_walk = {
            "animation_type": "Walk",
            "frame_count": 4,
            "frame_descriptions": [
                "Frame 1: Chân trái bước tới chạm đất, tay phải vung tới",
                "Frame 2: Hai chân đi qua nhau ở vị trí trọng tâm",
                "Frame 3: Chân phải bước tới chạm đất, tay trái vung tới",
                "Frame 4: Chân trái thu về vị trí chuyển tiếp"
            ],
            "moving_body_parts": ["Hai chân", "Hai tay", "Tà áo choàng"],
            "fixed_body_parts": ["Đầu và mũ giáp giữ thẳng trục"],
            "leg_motion": "Chân bước so le nhịp nhàng theo chu kỳ 4 frame",
            "arm_motion": "Tay cầm kiếm vung nhẹ theo nhịp chân",
            "secondary_motion": "Áo choàng hất nhẹ về sau khi chân chạm đất",
            "motion_sequence": "Chân trái bước -> Thu chân -> Chân phải bước -> Thu chân",
            "loop_characteristics": "Seamless walk cycle 4 frame",
            "observed_inconsistencies": []
        }

        self.direction_anim_data = {
            "idle": self.animation_profile_idle,
            "walk": self.animation_profile_walk
        }

        self.consistency_data = {
            "invariant_features": ["Màu xám thép của giáp", "Búi lông đỏ trên mũ", "Khiên chữ thập vàng"],
            "view_dependent_features": ["Khe mũ chỉ thấy ở hướng Down", "Áo choàng chiếm đa số diện tích ở hướng Up"],
            "animation_dependent_features": ["Độ vung của chân và tay", "Độ phấp phới của tà áo choàng"],
            "detected_inconsistencies": [],
            "preservation_requirements": ["Giữ đúng tỷ lệ Chibi 2.5 đầu", "Màu viền phải là viền màu chọn lọc Selout"]
        }

        self.negative_constraints_data = {
            "forbidden_design_changes": ["Không đổi màu búi lông đỏ", "Không bỏ khiên tròn"],
            "visual_defects_to_avoid": ["Tránh dùng viền đen tuyền toàn bộ", "Tránh pillow shading"],
            "animation_defects_to_avoid": ["Tránh trượt chân (foot sliding)", "Tránh giật khung hình khi lặp"]
        }

        # Dữ liệu đầy đủ cho AIAnalysis
        self.valid_ai_analysis_dict = {
            "global_analysis": {
                "identity": self.identity_data,
                "anatomy": self.anatomy_data,
                "pixel_style": self.pixel_style_data,
                "materials": self.material_data
            },
            "direction_analysis": {
                "down": self.direction_down_data,
                "side": self.direction_side_data,
                "up": self.direction_up_data
            },
            "animation_analysis": {
                "down": self.direction_anim_data,
                "side": self.direction_anim_data,
                "up": self.direction_anim_data
            },
            "consistency_analysis": self.consistency_data,
            "negative_constraints": self.negative_constraints_data
        }

    def test_01_imports_succeed(self):
        """Tiêu chí 1: Các model Pydantic có thể import bình thường không lỗi."""
        self.assertTrue(issubclass(IdentityAnalysis, IdentityAnalysis))
        self.assertTrue(issubclass(AnatomyAnalysis, AnatomyAnalysis))
        self.assertTrue(issubclass(PixelStyleAnalysis, PixelStyleAnalysis))
        self.assertTrue(issubclass(MaterialAnalysis, MaterialAnalysis))
        self.assertTrue(issubclass(DirectionProfile, DirectionProfile))
        self.assertTrue(issubclass(DirectionAnalysis, DirectionAnalysis))
        self.assertTrue(issubclass(AnimationProfile, AnimationProfile))
        self.assertTrue(issubclass(DirectionAnimation, DirectionAnimation))
        self.assertTrue(issubclass(AnimationAnalysis, AnimationAnalysis))
        self.assertTrue(issubclass(GlobalAnalysis, GlobalAnalysis))
        self.assertTrue(issubclass(ConsistencyAnalysis, ConsistencyAnalysis))
        self.assertTrue(issubclass(NegativeConstraints, NegativeConstraints))
        self.assertTrue(issubclass(AIAnalysis, AIAnalysis))

    def test_02_valid_data_validation(self):
        """Tiêu chí 2: AIAnalysis nhận và kiểm tra dữ liệu hợp lệ thành công."""
        analysis = AIAnalysis.model_validate(self.valid_ai_analysis_dict)
        self.assertEqual(analysis.global_analysis.identity.character_type, "Hiệp sĩ áo giáp sắt")
        self.assertEqual(analysis.direction_analysis.down.view_type, ViewType.FRONT)
        self.assertEqual(analysis.direction_analysis.side.view_type, ViewType.RIGHT_PROFILE)
        self.assertEqual(analysis.direction_analysis.up.view_type, ViewType.BACK)
        self.assertEqual(analysis.animation_analysis.down.idle.frame_count, 3)
        self.assertEqual(analysis.animation_analysis.down.walk.frame_count, 4)
        self.assertEqual(len(analysis.global_analysis.materials), 2)
        self.assertEqual(analysis.global_analysis.materials[0].material_type, MaterialType.METAL)
        self.assertEqual(analysis.global_analysis.materials[1].material_type, MaterialType.CLOTH)

    def test_03_invalid_data_caught(self):
        """Tiêu chí 3: Dữ liệu sai kiểu được phát hiện chính xác qua ValidationError."""
        # 3.1. Sai kiểu frame_count (truyền số 0 hoặc âm trong khi ge=1)
        invalid_dict = json.loads(json.dumps(self.valid_ai_analysis_dict))
        invalid_dict["animation_analysis"]["down"]["idle"]["frame_count"] = 0
        with self.assertRaises(ValidationError):
            AIAnalysis.model_validate(invalid_dict)

        # 3.2. Sai giá trị Enum material_type
        invalid_dict2 = json.loads(json.dumps(self.valid_ai_analysis_dict))
        invalid_dict2["global_analysis"]["materials"][0]["material_type"] = "PlasticRubberUnrecognized"
        with self.assertRaises(ValidationError):
            AIAnalysis.model_validate(invalid_dict2)

        # 3.3. Thiếu trường bắt buộc
        invalid_dict3 = json.loads(json.dumps(self.valid_ai_analysis_dict))
        del invalid_dict3["global_analysis"]["identity"]["character_type"]
        with self.assertRaises(ValidationError):
            AIAnalysis.model_validate(invalid_dict3)

    def test_04_serialization_to_json(self):
        """Tiêu chí 4: Serialize thành JSON thành công (qua model_dump_json)."""
        analysis = AIAnalysis.model_validate(self.valid_ai_analysis_dict)
        json_str = analysis.model_dump_json(indent=2)
        self.assertIsInstance(json_str, str)
        self.assertIn("Hiệp sĩ áo giáp sắt", json_str)
        self.assertIn("16-bit SNES / GBA Retro RPG", json_str)
        self.assertIn("Metal", json_str)

        # Kiểm tra JSON hợp lệ hoàn toàn
        parsed = json.loads(json_str)
        self.assertEqual(parsed["global_analysis"]["identity"]["character_type"], "Hiệp sĩ áo giáp sắt")

    def test_05_deserialization_from_json(self):
        """Tiêu chí 5: Deserialize từ JSON string về AIAnalysis thành công."""
        original = AIAnalysis.model_validate(self.valid_ai_analysis_dict)
        json_str = original.model_dump_json()

        deserialized = AIAnalysis.model_validate_json(json_str)
        self.assertEqual(deserialized.global_analysis.identity.character_type, original.global_analysis.identity.character_type)
        self.assertEqual(deserialized.direction_analysis.down.view_type, original.direction_analysis.down.view_type)
        self.assertEqual(deserialized.animation_analysis.down.walk.frame_count, original.animation_analysis.down.walk.frame_count)

    def test_06_optional_fields_handle_none(self):
        """Tiêu chí 6: Các trường tùy chọn xử lý đúng đắn khi nhận giá trị None."""
        identity = IdentityAnalysis(
            character_type="Bóng ma bóng tối",
            gender_presentation=None,
            body_type=None,
            distinctive_features=[],
            silhouette="Hình dải khói lượn sóng",
            shape_language=["Curved", "Fluid"],
            facial_features=None,
            costume_description="Không mặc trang phục, toàn thân là khói đen",
            accessories=[]
        )
        self.assertIsNone(identity.gender_presentation)
        self.assertIsNone(identity.body_type)
        self.assertIsNone(identity.facial_features)

        style = PixelStyleAnalysis(
            art_style="Minimalist Pixel",
            outline_style="No outline",
            shading_style="Flat",
            shading_levels=None,
            dithering_style=None,
            pixel_cluster_style="Fine",
            detail_density="Minimal",
            pixel_cleanliness="Clean",
            lighting_direction=None,
            visual_artifacts=[]
        )
        self.assertIsNone(style.shading_levels)
        self.assertIsNone(style.dithering_style)
        self.assertIsNone(style.lighting_direction)

    def test_07_existing_project_schemas_unaffected(self):
        """Tiêu chí 7: Schema mới không làm ảnh hưởng đến các Schema hiện có của dự án."""
        # Kiểm tra ProjectCreateRequest
        p_req = ProjectCreateRequest(name="Dự án Game 1")
        self.assertEqual(p_req.name, "Dự án Game 1")

        # Kiểm tra ProjectItem
        p_item = ProjectItem(id=1, name="Dự án Game 1")
        self.assertEqual(p_item.id, 1)

        # Kiểm tra SettingsUpdateRequest
        s_req = SettingsUpdateRequest(provider="openai", openai_api_key="sk-test123456789")
        self.assertEqual(s_req.provider, "openai")

        # Kiểm tra PromptAdviceRequest
        pr_req = PromptAdviceRequest(
            metrics={"head_width": 32, "head_height": 20},
            character_concept="Chiến binh"
        )
        self.assertEqual(pr_req.character_concept, "Chiến binh")

    def test_08_json_schema_generation(self):
        """Kiểm tra tính tương thích sinh JSON Schema cho OpenAI Structured Outputs."""
        schema = AIAnalysis.model_json_schema()
        self.assertIsInstance(schema, dict)
        self.assertEqual(schema["type"], "object")
        self.assertIn("global_analysis", schema["properties"])
        self.assertIn("direction_analysis", schema["properties"])
        self.assertIn("animation_analysis", schema["properties"])
        self.assertIn("consistency_analysis", schema["properties"])
        self.assertIn("negative_constraints", schema["properties"])


if __name__ == "__main__":
    unittest.main()
