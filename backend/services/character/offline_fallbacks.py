"""
Module: backend.services.character.offline_fallbacks
Mục đích: Cung cấp dữ liệu phân tích dự phòng ngoại tuyến (0 Token / Offline Fallback) cho Hồ sơ Nhân vật.
Ai gọi nó: `CharacterAnalysisService` khi người dùng không cung cấp API Key hoặc chế độ ngoại tuyến.
Tại sao tồn tại: Tách biệt hoàn toàn các cấu trúc từ điển tĩnh dài hơn 120 dòng ra khỏi Service nghiệp vụ, tuân thủ nguyên lý Single Responsibility Principle (SRP) và Clean Architecture.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa kiểu từ điển, danh sách, tùy chọn
from typing import Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Enums)
# ========================================================
# Controlled Vocabulary Enums chuẩn hóa dữ liệu hồ sơ nhân vật
from backend.schemas.character import (
    PixelArtEra,
    OutlineStyle,
    ShadingStyle,
    DitheringStyle,
    PixelClusterStyle,
    DetailDensity,
    PixelCleanliness,
    LightingDirection,
    GenderPresentation,
    BodyType,
    ShapeLanguage,
    BodyStructure,
    LimbPlacement,
    MaterialType,
    Reflectivity,
    PixelTexture,
    ViewType,
    OrientationAngle,
    AnimationType,
    LoopCharacteristics,
)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


def get_offline_fallback_global() -> Dict[str, Any]:
    """
    Tạo dữ liệu phân tích toàn cục dự phòng ngoại tuyến chuẩn theo Controlled Vocabulary Enums.

    @returns {Dict[str, Any]} Cấu trúc hồ sơ toàn cục (Identity, Anatomy, Pixel Style, Materials).
    """
    return {
        "identity": {
            "character_type": "Nhân vật Sprite Pixel Art (Chế độ Ngoại tuyến)",
            "gender_presentation": GenderPresentation.UNSPECIFIED.value,
            "body_type": BodyType.CHIBI.value,
            "distinctive_features": ["Thiết kế chuẩn game 2D"],
            "silhouette": "Hình khối cân đối",
            "shape_language": [ShapeLanguage.ROUNDED.value, ShapeLanguage.HEAVY_BLOCK.value],
            "facial_features": "Khuôn mặt pixel art tối giản",
            "costume_description": "Trang phục phiêu lưu phong cách cổ điển",
            "accessories": ["Trang bị cơ bản"],
        },
        "anatomy": {
            "body_structure": BodyStructure.CHIBI_HUMANOID.value,
            "head_description": "Đầu to rõ nét, chiếm 30-35% chiều cao",
            "torso_description": "Thân trên khối hộp gọn gàng",
            "arm_structure": "Hai tay buông xuôi linh hoạt",
            "leg_structure": "Hai chân ngắn vững chãi",
            "unusual_body_parts": [],
            "identifiable_landmarks": ["Đường cổ", "Thắt lưng", "Gót chân"],
            "relative_limb_placement": LimbPlacement.GROUNDED_NEUTRAL.value,
            "anatomical_ambiguities": [],
        },
        "pixel_style": {
            "art_style": PixelArtEra.CLASSIC_16BIT.value,
            "outline_style": OutlineStyle.SELECTIVE_OUTLINE.value,
            "shading_style": ShadingStyle.CEL_SHADING.value,
            "dithering_style": DitheringStyle.NONE.value,
            "pixel_cluster_style": PixelClusterStyle.CHUNKY_CLUSTERS.value,
            "detail_density": DetailDensity.MODERATE.value,
            "pixel_cleanliness": PixelCleanliness.VERY_CLEAN.value,
            "lighting_direction": LightingDirection.TOP_LEFT.value,
            "visual_artifacts": [],
        },
        "materials": [
            {
                "region_name": "Vùng da mặt",
                "material_type": MaterialType.SKIN.value,
                "color_description": "Tone da tự nhiên",
                "shadow_description": "Bóng ngả cam ấm",
                "highlight_description": None,
                "reflectivity": Reflectivity.MATTE.value,
                "pixel_texture": PixelTexture.SMOOTH.value,
                "shading_description": "Phân mảng phẳng mềm",
            },
            {
                "region_name": "Trang phục",
                "material_type": MaterialType.CLOTH.value,
                "color_description": "Màu sắc chủ đạo theo sprite",
                "shadow_description": "Bóng đậm tạo nếp gấp",
                "highlight_description": None,
                "reflectivity": Reflectivity.MATTE.value,
                "pixel_texture": PixelTexture.FIBROUS.value,
                "shading_description": "Đổ bóng mảng 2 cấp độ",
            },
        ],
    }


def get_offline_fallback_directions() -> Dict[str, Any]:
    """
    Tạo dữ liệu 3 hướng nhìn dự phòng ngoại tuyến chuẩn theo ViewType và OrientationAngle Enums.

    @returns {Dict[str, Any]} Cấu trúc 3 hướng nhìn (Down, Side, Up).
    """
    def _make_dir(view: ViewType, orient: OrientationAngle) -> Dict[str, Any]:
        return {
            "view_type": view.value,
            "body_orientation": orient.value,
            "head_orientation": orient.value,
            "visible_body_parts": ["Đầu", "Thân", "Chi nhìn thấy"],
            "occluded_body_parts": ["Bộ phận phía sau"],
            "visible_accessories": ["Phụ kiện trước"],
            "accessory_placement": "Theo trục cơ thể",
            "silhouette_description": f"Hình dáng đặc trưng góc nhìn {view.value}",
            "view_specific_features": [f"Chi tiết nổi bật góc {view.value}"],
            "occlusion_rules": ["Thân trước che thân sau"],
        }

    return {
        "down": _make_dir(ViewType.FRONT, OrientationAngle.FRONT_FACING),
        "side": _make_dir(ViewType.RIGHT_PROFILE, OrientationAngle.RIGHT_PROFILE),
        "up": _make_dir(ViewType.BACK, OrientationAngle.BACK_FACING),
    }


def get_offline_fallback_animations() -> Dict[str, Any]:
    """
    Tạo dữ liệu hoạt họa dự phòng ngoại tuyến chuẩn theo AnimationType và LoopCharacteristics Enums.

    @returns {Dict[str, Any]} Cấu trúc hoạt họa Idle và Walk cho 3 hướng nhìn.
    """
    def _make_anim_prof(anim_type: AnimationType, count: int, seq: str, loop_char: LoopCharacteristics = LoopCharacteristics.SEAMLESS) -> Dict[str, Any]:
        return {
            "animation_type": anim_type.value,
            "frame_count": count,
            "frame_descriptions": [f"Frame {i+1}: Tư thế {anim_type.value} nhịp {i+1}" for i in range(count)],
            "moving_body_parts": ["Chân", "Tay"] if anim_type == AnimationType.WALK else ["Ngực nhún"],
            "fixed_body_parts": ["Trục đầu"],
            "leg_motion": "Bước chân so le tuần hoàn" if anim_type == AnimationType.WALK else "Đứng yên bám sàn",
            "arm_motion": "Vung tay theo bước chân" if anim_type == AnimationType.WALK else "Hạ xuôi tự nhiên",
            "secondary_motion": "Tà áo đung đưa nhẹ",
            "motion_sequence": seq,
            "loop_characteristics": loop_char.value,
            "observed_inconsistencies": [],
        }

    dir_anim = {
        "idle": _make_anim_prof(AnimationType.IDLE, 3, "F1 -> F2 nhún -> F3 về ban đầu"),
        "walk": _make_anim_prof(AnimationType.WALK, 4, "Chân trái bước -> Thu chân -> Chân phải bước -> Thu chân"),
    }
    return {"down": dir_anim, "side": dir_anim, "up": dir_anim}


def get_offline_fallback_constraints(global_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Tạo dữ liệu ràng buộc và tính nhất quán dự phòng ngoại tuyến.

    @param {Dict[str, Any]} global_data Dữ liệu phân tích toàn cục của nhân vật.
    @returns {Dict[str, Any]} Dữ liệu bao gồm consistency_analysis và negative_constraints.
    """
    return {
        "consistency_analysis": {
            "invariant_features": ["Màu sắc chủ đạo của trang phục", "Tỷ lệ đầu to thân lùn Chibi"],
            "view_dependent_features": ["Khuôn mặt chỉ thấy ở hướng Down", "Lưng thấy ở hướng Up"],
            "animation_dependent_features": ["Độ vung của chân khi bước đi"],
            "detected_inconsistencies": [],
            "preservation_requirements": ["Giữ nguyên phong cách viền Selout và bảng màu gốc"],
        },
        "negative_constraints": {
            "forbidden_design_changes": ["Không tự ý đổi màu nhận diện", "Không biến nhân vật thành tỷ lệ người thật 8 đầu"],
            "visual_defects_to_avoid": ["Tránh viền đen tuyền lem nhem", "Tránh pillow shading", "Tránh hạt pixel mồ côi"],
            "animation_defects_to_avoid": ["Tránh trượt chân (foot sliding)", "Tránh giật khung hình khi lặp vòng"],
        },
    }
