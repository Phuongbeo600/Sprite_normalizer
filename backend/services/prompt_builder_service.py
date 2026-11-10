# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Kiểu)
# ========================================================
# typing: Định nghĩa các kiểu dữ liệu danh sách, từ điển, tùy chọn
from typing import Dict, Any, Optional, List

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Chỉ sử dụng thư viện tiêu chuẩn của Python cho việc xử lý chuỗi và cấu trúc dữ liệu)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class PromptBuilderService:
    """
    Dịch vụ Xây Dựng Prompt Chuyên Sâu Theo Ma Trận 15 Frame Hoạt Họa Pixel Art.
    
    Nhiệm vụ cốt lõi:
    1. Trích xuất toàn bộ các chỉ số giải phẫu hình học, quy tắc đổ bóng, hướng sáng,
       độ nhấp nhô trọng tâm và động học chuyển động từ 7 Schemas (Anatomy, Animation,
       Direction, PixelStyle).
    2. Ánh xạ (Map) thông minh các dữ liệu đó vào từng Frame cụ thể của lưới Sprite Sheet 3x5:
       - 3 Hướng: Down (Đi xuống / Mặt đối diện), Side (Đi ngang / Nhìn nghiêng), Up (Đi lên / Quay lưng).
       - Mỗi hướng gồm: 1 Frame Tĩnh (Idle Stand) + 4 Frame Động (Walk Cycle có cả chân và tay đổi tư thế).
    3. Biên dịch (Compile) toàn bộ thành một câu Prompt 3 Tầng hoàn chỉnh, chuẩn công nghiệp game pixel.
    """

    @staticmethod
    def build_default_frame_actions(profile_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Trích xuất thông tin từ 7 Schemas và khởi tạo ma trận 15 Frame hoạt họa có chuyển động chân tay đối nghịch.

        @param {Optional[Dict[str, Any]]} profile_data Dữ liệu phân tích AI từ 7 Schemas.
        @returns {Dict[str, Any]} Cấu trúc ma trận 15 frame của 3 hướng (down, side, up).
        """
        data = profile_data or {}

        # 1. Trích xuất thông số giải phẫu & phong cách từ Schemas
        anatomy = data.get("anatomy", {})
        anim_data = data.get("animations", {})
        dir_data = data.get("directions", {})
        pixel_style = data.get("pixel_style", {})

        height = anatomy.get("anatomical_height", 48)
        head_ratio = anatomy.get("head_to_body_ratio", "1:4.0")
        
        # Động học từ Animation Profile (nếu có)
        walk_profile = anim_data.get("walk_profile", {})
        bobbing_px = walk_profile.get("vertical_bobbing_pixels", "1px")
        secondary_motion = walk_profile.get("secondary_motion") or "subtle cloth and hair momentum sway"

        # Góc nhìn từ Direction Profile (nếu có)
        down_dir = dir_data.get("down_profile", {})
        side_dir = dir_data.get("side_profile", {})
        up_dir = dir_data.get("up_profile", {})

        side_occluded = side_dir.get("occluded_body_parts", ["Far-side arm and leg partially occluded by torso"])
        up_visible = up_dir.get("visible_body_parts", ["Back of head, rear torso, backpack/sheath, shoe soles"])

        # 2. Xây dựng chi tiết 5 frame cho Hướng Đi Xuống (Down / Front View)
        down_frames = {
            "idle": {
                "frame_index": 0,
                "label": "Frame 0: Đứng yên nhìn thẳng (Idle)",
                "type": "static",
                "action_prompt": (
                    f"Front view, static idle stand: perfectly balanced upright posture ({height}px height, {head_ratio} ratio), "
                    "both feet flat shoulder-width on ground, hands and equipment relaxed naturally at sides, eyes facing viewer, zero movement."
                )
            },
            "frame_1": {
                "frame_index": 1,
                "label": "Frame 1: Chân trái bước tới + Tay phải vung trước",
                "type": "dynamic",
                "action_prompt": (
                    "Front view walk stride 1: left foot strides firmly forward toward viewer, right leg pushes back; "
                    "right arm swings forward across chest, left arm swings backward behind hip; natural contrapposto balance."
                )
            },
            "frame_2": {
                "frame_index": 2,
                "label": "Frame 2: Chân thu giữa + Tay hạ sườn (Nhún trọng tâm)",
                "type": "dynamic",
                "action_prompt": (
                    f"Front view walk passing pose: feet cross closely under body; both arms drop naturally beside torso; "
                    f"slight vertical bobbing (torso lowers by {bobbing_px}); {secondary_motion}."
                )
            },
            "frame_3": {
                "frame_index": 3,
                "label": "Frame 3: Chân phải bước tới + Tay trái vung trước (Đổi bên)",
                "type": "dynamic",
                "action_prompt": (
                    "Front view walk stride 2: right foot strides firmly forward toward viewer, left leg pushes back; "
                    "left arm swings forward across chest, right arm swings backward behind hip; inverted opposite limb balance."
                )
            },
            "frame_4": {
                "frame_index": 4,
                "label": "Frame 4: Chân thu giữa + Tay về cân bằng (Khép vòng lặp)",
                "type": "dynamic",
                "action_prompt": (
                    "Front view walk passing pose: right foot plants, left foot lifts preparing forward stride; "
                    "arms return to neutral hip level; body elevates back to baseline height; seamless animation loop."
                )
            }
        }

        # 3. Xây dựng chi tiết 5 frame cho Hướng Đi Ngang (Side Profile View)
        occluded_str = ", ".join(side_occluded) if isinstance(side_occluded, list) else str(side_occluded)
        side_frames = {
            "idle": {
                "frame_index": 0,
                "label": "Frame 0: Đứng yên nhìn ngang (Idle)",
                "type": "static",
                "action_prompt": (
                    f"Strict right profile view (90 degrees), static idle stand: spine straight ({height}px height), "
                    f"feet slightly staggered for 2D depth, weapon held at ready posture, {occluded_str}, zero movement."
                )
            },
            "frame_1": {
                "frame_index": 1,
                "label": "Frame 1: Sải chân trái rộng + Đánh tay tối đa",
                "type": "dynamic",
                "action_prompt": (
                    "Right profile walk stride 1: left leg extends fully forward, right leg trails backward; "
                    "right arm swings fully forward at chest height, left arm swings backward; dynamic full stride silhouette."
                )
            },
            "frame_2": {
                "frame_index": 2,
                "label": "Frame 2: Hai chân chéo qua + Tay lướt thân (Nhún trọng tâm)",
                "type": "dynamic",
                "action_prompt": (
                    f"Right profile walk passing pose: front leg flat on ground, back leg bends at knee crossing past front leg; "
                    f"both arms swing vertically brushing past hips; torso lowers by {bobbing_px}; {secondary_motion}."
                )
            },
            "frame_3": {
                "frame_index": 3,
                "label": "Frame 3: Sải chân phải rộng + Đổi chiều tay tối đa",
                "type": "dynamic",
                "action_prompt": (
                    "Right profile walk stride 2: right leg extends fully forward, left leg trails backward; "
                    "left arm swings fully forward at chest height, right arm swings backward; mirror opposite stride silhouette."
                )
            },
            "frame_4": {
                "frame_index": 4,
                "label": "Frame 4: Hai chân chéo qua + Tay thu cân bằng (Khép vòng lặp)",
                "type": "dynamic",
                "action_prompt": (
                    "Right profile walk passing pose: back leg swings forward to cross midline; "
                    "arms swing vertically past hips; body rises back to baseline height; ready to loop smoothly."
                )
            }
        }

        # 4. Xây dựng chi tiết 5 frame cho Hướng Đi Lên (Up / Back View)
        visible_str = ", ".join(up_visible) if isinstance(up_visible, list) else str(up_visible)
        up_frames = {
            "idle": {
                "frame_index": 0,
                "label": "Frame 0: Đứng yên quay lưng (Idle)",
                "type": "static",
                "action_prompt": (
                    f"Direct back view (180 degrees), static idle stand: spine straight ({height}px height), shoulders square, "
                    f"face completely occluded, showing {visible_str}, feet flat shoulder-width, zero movement."
                )
            },
            "frame_1": {
                "frame_index": 1,
                "label": "Frame 1: Gót trái bước lên + Tay phải vung trước",
                "type": "dynamic",
                "action_prompt": (
                    "Back view walk stride 1: left leg strides upward showing shoe sole and heel, right leg trailing back; "
                    "right arm swings forward partially occluded by shoulder, left forearm swings visibly backward; clear back silhouette."
                )
            },
            "frame_2": {
                "frame_index": 2,
                "label": "Frame 2: Chân thu giữa + Tay hạ sườn (Nhún trọng tâm)",
                "type": "dynamic",
                "action_prompt": (
                    f"Back view walk passing pose: left foot plants, right knee bends lifting upward past left leg; "
                    f"both arms hang neutrally at belt level; torso lowers by {bobbing_px}; {secondary_motion}."
                )
            },
            "frame_3": {
                "frame_index": 3,
                "label": "Frame 3: Gót phải bước lên + Tay trái vung trước (Đổi bên)",
                "type": "dynamic",
                "action_prompt": (
                    "Back view walk stride 2: right leg strides upward showing shoe sole and heel, left leg trailing back; "
                    "left arm swings forward partially occluded by shoulder, right forearm swings visibly backward."
                )
            },
            "frame_4": {
                "frame_index": 4,
                "label": "Frame 4: Chân thu giữa + Tay về cân bằng (Khép vòng lặp)",
                "type": "dynamic",
                "action_prompt": (
                    "Back view walk passing pose: right foot plants, left foot lifts forward; "
                    "arms return to belt level; torso returns to baseline height; seamless loop."
                )
            }
        }

        return {
            "down": down_frames,
            "side": side_frames,
            "up": up_frames
        }

    @staticmethod
    def compile_sprite_sheet_prompt(
        character_concept: str,
        profile_data: Optional[Dict[str, Any]] = None,
        frame_actions: Optional[Dict[str, Any]] = None,
        outfit_and_colors: Optional[str] = None,
        weapons_and_props: Optional[str] = None,
        custom_instructions: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Biên dịch toàn bộ khung giải phẫu, phong cách và ma trận 15 frame thành câu Prompt 3 Tầng hoàn chỉnh.

        @param {str} character_concept Ý tưởng nhân vật mới (ví dụ: Nữ sát thủ áo giáp tím).
        @param {Optional[Dict[str, Any]]} profile_data Dữ liệu phân tích AI từ 7 Schemas.
        @param {Optional[Dict[str, Any]]} frame_actions Dữ liệu chỉnh sửa 15 frame từ người dùng.
        @param {Optional[str]} outfit_and_colors Mô tả trang phục và màu sắc.
        @param {Optional[str]} weapons_and_props Mô tả vũ khí và phụ kiện.
        @param {Optional[str]} custom_instructions Chỉ đạo nghệ thuật bổ sung.
        @returns {Dict[str, str]} Từ điển chứa 'positive_prompt' và 'negative_prompt'.
        """
        data = profile_data or {}
        anatomy = data.get("anatomy", {})
        pixel_style = data.get("pixel_style", {})
        identity = data.get("identity", {})

        # Lấy thông số kỹ thuật cốt lõi
        height = anatomy.get("anatomical_height", 48)
        head_ratio = anatomy.get("head_to_body_ratio", "1:4.0")
        era = pixel_style.get("pixel_art_era", "16-bit SNES")
        outline = pixel_style.get("outline_style", "crisp dark pixel contour")
        shading = pixel_style.get("shading_style", "2-tone cell shading")
        lighting = pixel_style.get("lighting_direction", "consistent top-left lighting")
        
        concept = character_concept.strip() if character_concept else "game character"
        outfit = f", wearing {outfit_and_colors.strip()}" if outfit_and_colors and outfit_and_colors.strip() else ""
        props = f", equipped with {weapons_and_props.strip()}" if weapons_and_props and weapons_and_props.strip() else ""

        # Lấy ma trận frame (nếu người dùng chưa tùy biến thì lấy mặc định)
        actions = frame_actions or PromptBuilderService.build_default_frame_actions(profile_data)
        down = actions.get("down", {})
        side = actions.get("side", {})
        up = actions.get("up", {})

        # ========================================================
        # BIÊN DỊCH CÂU PROMPT ĐA TẦNG (MULTI-TIER PROMPT ARCHITECTURE)
        # ========================================================
        prompt_parts = []

        # TẦNG 0 (KHUNG TO NHẤT): MASTER COLOR & GRAPHIC PALETTE SPECIFICATIONS
        # Trích xuất 6 tiêu chuẩn kỹ thuật đo được 100% từ ảnh mẫu bằng Python NumPy
        palette = data.get("palette_metrics") or data.get("global_analysis", {}).get("palette_metrics")
        if palette and isinstance(palette, dict):
            master_color_spec = palette.get("master_color_prompt", "").strip()
            if not master_color_spec:
                total_c = palette.get("total_colors", 32)
                era_c = palette.get("palette_era", era)
                top_hex = palette.get("top_hex_list", [])
                hex_str = ", ".join(top_hex[:8]) if top_hex else ""
                shading_st = palette.get("shading_style_detected", shading)
                steps = palette.get("shading_steps", 2)
                hue_desc = palette.get("hue_shift_description", "Straight shading")
                out_desc = palette.get("outline_style_detected", outline)
                sat_t = palette.get("saturation_type", "Balanced Classic Saturation")
                con_t = palette.get("contrast_type", "High Contrast")
                con_r = palette.get("contrast_ratio", 4.5)

                master_color_spec = (
                    f"MASTER COLOR & GRAPHIC PALETTE SPECIFICATIONS (STRICTLY HARMONIZED WITH REFERENCE ASSET):\n"
                    f"- Color Budget: Strictly indexed {total_c}-color palette ({era_c}), primary palette anchors: [{hex_str}].\n"
                    f"- Shading Architecture: {shading_st} per surface ({steps} distinct tone levels), strictly zero smooth airbrushing or blurry gradients.\n"
                    f"- Hue-Shifting Rule: {hue_desc}.\n"
                    f"- Outline Grammar: {out_desc}, strictly 1-pixel crisp pixel contour without orphan noise.\n"
                    f"- Palette Saturation & Contrast: {sat_t}, {con_t} curve ({con_r}:1 ratio).\n"
                    f"- Background: Isolated on pure transparent background (PNG alpha channel), zero drop shadows on floor."
                )
            if master_color_spec:
                prompt_parts.append(master_color_spec)

        # TẦNG 1: IDENTITY & STYLE MATRIX (Danh tính & Chỉ số phong cách chuẩn)
        prompt_parts.append(
            f"Masterpiece authentic {era} pixel art sprite sheet of a {concept}{outfit}{props}.\n"
            f"Strict anatomy constraints: exactly {height} pixels character height, strict {head_ratio} head-to-body proportion.\n"
            f"Rendering specifications: {outline}, {shading}, {lighting}, transparent background, isolated on pure solid transparent background (PNG alpha channel), clean cut-out sprite sheet without background elements or floor shadows."
        )

        # TẦNG 2: GRID LAYOUT & SPECIFICATIONS (Bố cục ma trận lưới 3x5)
        prompt_parts.append(
            "SPRITE SHEET GRID LAYOUT (3 Rows x 5 Columns, total 15 frames):\n"
            "- Row 1: Down / Front facing view (Frame 0: Idle, Frames 1-4: Walk cycle)\n"
            "- Row 2: Side / Right profile view (Frame 0: Idle, Frames 1-4: Walk cycle)\n"
            "- Row 3: Up / Back facing view (Frame 0: Idle, Frames 1-4: Walk cycle)\n"
            "Absolute cross-frame consistency: identical character proportions, clothing details, and color palette across all 15 frames."
        )

        # TẦNG 3: FRAME-BY-FRAME ACTION MATRIX (Đặc tả chi tiết chuyển động chân và tay từng frame)
        frame_matrix = [
            "DETAILED 15-FRAME ACTION MATRIX:",
            "[ROW 1 - DOWN / FRONT VIEW]:",
            f"  - Col 0 (Idle): {down.get('idle', {}).get('action_prompt', '')}",
            f"  - Col 1 (Walk 1): {down.get('frame_1', {}).get('action_prompt', '')}",
            f"  - Col 2 (Walk 2): {down.get('frame_2', {}).get('action_prompt', '')}",
            f"  - Col 3 (Walk 3): {down.get('frame_3', {}).get('action_prompt', '')}",
            f"  - Col 4 (Walk 4): {down.get('frame_4', {}).get('action_prompt', '')}",
            "",
            "[ROW 2 - SIDE / RIGHT PROFILE VIEW]:",
            f"  - Col 0 (Idle): {side.get('idle', {}).get('action_prompt', '')}",
            f"  - Col 1 (Walk 1): {side.get('frame_1', {}).get('action_prompt', '')}",
            f"  - Col 2 (Walk 2): {side.get('frame_2', {}).get('action_prompt', '')}",
            f"  - Col 3 (Walk 3): {side.get('frame_3', {}).get('action_prompt', '')}",
            f"  - Col 4 (Walk 4): {side.get('frame_4', {}).get('action_prompt', '')}",
            "",
            "[ROW 3 - UP / BACK VIEW]:",
            f"  - Col 0 (Idle): {up.get('idle', {}).get('action_prompt', '')}",
            f"  - Col 1 (Walk 1): {up.get('frame_1', {}).get('action_prompt', '')}",
            f"  - Col 2 (Walk 2): {up.get('frame_2', {}).get('action_prompt', '')}",
            f"  - Col 3 (Walk 3): {up.get('frame_3', {}).get('action_prompt', '')}",
            f"  - Col 4 (Walk 4): {up.get('frame_4', {}).get('action_prompt', '')}"
        ]
        prompt_parts.append("\n".join(frame_matrix))

        if custom_instructions and custom_instructions.strip():
            prompt_parts.append(f"Director notes: {custom_instructions.strip()}")

        positive_prompt = "\n\n".join(prompt_parts)

        # PROMPT PHỦ ĐỊNH (Negative Prompt chống lỗi vẽ pixel & chống nền phức tạp)
        negative_prompt = (
            "background scenery, complex background, gradient background, floor texture, tiles, shadow on floor, "
            "environment, landscape, horizon line, ground dirt, watermark, noisy background, solid colored background walls, "
            "blurry, 3D render, smooth vector graphics, photorealistic, anti-aliased edges, "
            "deformed anatomy, mismatched frame heights, inconsistent clothing colors between frames, "
            "missing limbs, extra limbs, disjointed pixel clusters, "
            "frame height flickering, head scaling distortion, irregular grid spacing."
        )

        return {
            "positive_prompt": positive_prompt,
            "negative_prompt": negative_prompt,
            "frame_actions_data": actions
        }
