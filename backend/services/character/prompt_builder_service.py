"""
Module: backend.services.character.prompt_builder_service
Mục đích: Dịch vụ xây dựng ma trận 15 frame hoạt họa và biên dịch prompt 3 tầng.
Ai gọi nó: API router `backend.api.v1.character_analysis` và các bộ kiểm thử unit tests.
Tại sao tồn tại: Chuyển hóa toàn bộ dữ liệu phân tích từ 7 Schemas (độ nhún trọng tâm, hướng sáng, nét viền, tỷ lệ giải phẫu) thành ma trận hành động chi tiết 15 frame (3 hướng x 5 frame chân tay đối nghịch), tạo câu prompt tối ưu cho AI vẽ Sprite Sheet.
"""

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


def _build_down_frames(
    height: Any,
    head_ratio: str,
    bobbing_px: str,
    secondary_motion: str
) -> Dict[str, Any]:
    """
    Xây dựng chi tiết 5 frame cho Hướng Đi Xuống (Down / Front View).

    @param {Any} height Chiều cao nhân vật tính bằng pixel.
    @param {str} head_ratio Tỷ lệ đầu/thân.
    @param {str} bobbing_px Biên độ nhún trọng tâm tính bằng pixel.
    @param {str} secondary_motion Động học phụ (tà áo, tóc).
    @returns {Dict[str, Any]} Từ điển 5 frame hướng đi xuống (idle + 4 frame walk).
    """
    return {
        "idle": {
            "frame_index": 0,
            "label": "Frame 0: Đứng yên nhìn thẳng (Idle)",
            "type": "static",
            "action_prompt": (
                f"Front view, static idle stand: perfectly balanced upright posture ({height}px height, {head_ratio} ratio), "
                "both feet flat shoulder-width on ground, hands and equipment relaxed naturally at sides, eyes facing viewer, zero movement."
            ),
        },
        "frame_1": {
            "frame_index": 1,
            "label": "Frame 1: Chân trái bước tới + Tay phải vung trước",
            "type": "dynamic",
            "action_prompt": (
                "Front view walk stride 1: left foot strides firmly forward toward viewer, right leg pushes back; "
                "right arm swings forward across chest, left arm swings backward behind hip; natural contrapposto balance."
            ),
        },
        "frame_2": {
            "frame_index": 2,
            "label": "Frame 2: Chân thu giữa + Tay hạ sườn (Nhún trọng tâm)",
            "type": "dynamic",
            "action_prompt": (
                f"Front view walk passing pose: feet cross closely under body; both arms drop naturally beside torso; "
                f"slight vertical bobbing (torso lowers by {bobbing_px}); {secondary_motion}."
            ),
        },
        "frame_3": {
            "frame_index": 3,
            "label": "Frame 3: Chân phải bước tới + Tay trái vung trước (Đổi bên)",
            "type": "dynamic",
            "action_prompt": (
                "Front view walk stride 2: right foot strides firmly forward toward viewer, left leg pushes back; "
                "left arm swings forward across chest, right arm swings backward behind hip; inverted opposite limb balance."
            ),
        },
        "frame_4": {
            "frame_index": 4,
            "label": "Frame 4: Chân thu giữa + Tay về cân bằng (Khép vòng lặp)",
            "type": "dynamic",
            "action_prompt": (
                "Front view walk passing pose: right foot plants, left foot lifts preparing forward stride; "
                "arms return to neutral hip level; body elevates back to baseline height; seamless animation loop."
            ),
        },
    }


def _build_side_frames(
    height: Any,
    bobbing_px: str,
    secondary_motion: str,
    side_occluded: Any
) -> Dict[str, Any]:
    """
    Xây dựng chi tiết 5 frame cho Hướng Đi Ngang (Side Profile View).

    @param {Any} height Chiều cao nhân vật tính bằng pixel.
    @param {str} bobbing_px Biên độ nhún trọng tâm tính bằng pixel.
    @param {str} secondary_motion Động học phụ.
    @param {Any} side_occluded Danh sách các bộ phận bị che khuất ở góc nhìn nghiêng.
    @returns {Dict[str, Any]} Từ điển 5 frame hướng đi ngang (idle + 4 frame walk).
    """
    occluded_str = ", ".join(side_occluded) if isinstance(side_occluded, list) else str(side_occluded)
    return {
        "idle": {
            "frame_index": 0,
            "label": "Frame 0: Đứng yên nhìn ngang (Idle)",
            "type": "static",
            "action_prompt": (
                f"Strict right profile view (90 degrees), static idle stand: spine straight ({height}px height), "
                f"feet slightly staggered for 2D depth, weapon held at ready posture, {occluded_str}, zero movement."
            ),
        },
        "frame_1": {
            "frame_index": 1,
            "label": "Frame 1: Sải chân trái rộng + Đánh tay tối đa",
            "type": "dynamic",
            "action_prompt": (
                "Right profile walk stride 1: left leg extends fully forward, right leg trails backward; "
                "right arm swings fully forward at chest height, left arm swings backward; dynamic full stride silhouette."
            ),
        },
        "frame_2": {
            "frame_index": 2,
            "label": "Frame 2: Hai chân chéo qua + Tay lướt thân (Nhún trọng tâm)",
            "type": "dynamic",
            "action_prompt": (
                f"Right profile walk passing pose: front leg flat on ground, back leg bends at knee crossing past front leg; "
                f"both arms swing vertically brushing past hips; torso lowers by {bobbing_px}; {secondary_motion}."
            ),
        },
        "frame_3": {
            "frame_index": 3,
            "label": "Frame 3: Sải chân phải rộng + Đổi chiều tay tối đa",
            "type": "dynamic",
            "action_prompt": (
                "Right profile walk stride 2: right leg extends fully forward, left leg trails backward; "
                "left arm swings fully forward at chest height, right arm swings backward; mirror opposite stride silhouette."
            ),
        },
        "frame_4": {
            "frame_index": 4,
            "label": "Frame 4: Hai chân chéo qua + Tay thu cân bằng (Khép vòng lặp)",
            "type": "dynamic",
            "action_prompt": (
                "Right profile walk passing pose: back leg swings forward to cross midline; "
                "arms swing vertically past hips; body rises back to baseline height; ready to loop smoothly."
            ),
        },
    }


def _build_up_frames(
    height: Any,
    bobbing_px: str,
    secondary_motion: str,
    up_visible: Any
) -> Dict[str, Any]:
    """
    Xây dựng chi tiết 5 frame cho Hướng Đi Lên (Up / Back View).

    @param {Any} height Chiều cao nhân vật tính bằng pixel.
    @param {str} bobbing_px Biên độ nhún trọng tâm tính bằng pixel.
    @param {str} secondary_motion Động học phụ.
    @param {Any} up_visible Danh sách các bộ phận nhìn thấy từ phía sau.
    @returns {Dict[str, Any]} Từ điển 5 frame hướng đi lên (idle + 4 frame walk).
    """
    visible_str = ", ".join(up_visible) if isinstance(up_visible, list) else str(up_visible)
    return {
        "idle": {
            "frame_index": 0,
            "label": "Frame 0: Đứng yên quay lưng (Idle)",
            "type": "static",
            "action_prompt": (
                f"Direct back view (180 degrees), static idle stand: spine straight ({height}px height), shoulders square, "
                f"face completely occluded, showing {visible_str}, feet flat shoulder-width, zero movement."
            ),
        },
        "frame_1": {
            "frame_index": 1,
            "label": "Frame 1: Gót trái bước lên + Tay phải vung trước",
            "type": "dynamic",
            "action_prompt": (
                "Back view walk stride 1: left leg strides upward showing shoe sole and heel, right leg trailing back; "
                "right arm swings forward partially occluded by shoulder, left forearm swings visibly backward; clear back silhouette."
            ),
        },
        "frame_2": {
            "frame_index": 2,
            "label": "Frame 2: Chân thu giữa + Tay hạ sườn (Nhún trọng tâm)",
            "type": "dynamic",
            "action_prompt": (
                f"Back view walk passing pose: left foot plants, right knee bends lifting upward past left leg; "
                f"both arms hang neutrally at belt level; torso lowers by {bobbing_px}; {secondary_motion}."
            ),
        },
        "frame_3": {
            "frame_index": 3,
            "label": "Frame 3: Gót phải bước lên + Tay trái vung trước (Đổi bên)",
            "type": "dynamic",
            "action_prompt": (
                "Back view walk stride 2: right leg strides upward showing shoe sole and heel, left leg trailing back; "
                "left arm swings forward partially occluded by shoulder, right forearm swings visibly backward."
            ),
        },
        "frame_4": {
            "frame_index": 4,
            "label": "Frame 4: Chân thu giữa + Tay về cân bằng (Khép vòng lặp)",
            "type": "dynamic",
            "action_prompt": (
                "Back view walk passing pose: right foot plants, left foot lifts forward; "
                "arms return to belt level; torso returns to baseline height; seamless loop."
            ),
        },
    }


def _extract_geometry_metrics(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Trích xuất các chỉ số hình học giải phẫu chi tiết của phần đầu và thân (tính bằng pixel).

    @param {Dict[str, Any]} data Dữ liệu hồ sơ gốc (profile_data).
    @returns {Dict[str, Any]} Từ điển chứa các số đo pixel thực tế.
    """
    anatomy = data.get("anatomy") or (data.get("global_analysis") or {}).get("anatomy") or {}
    metrics = data.get("metrics") or data.get("automatic_geometry") or {}

    heads_tall = metrics.get("heads_tall") or anatomy.get("heads_tall")
    head_ratio = anatomy.get("head_to_body_ratio")
    if heads_tall is None and isinstance(head_ratio, str) and ":" in head_ratio:
        try:
            heads_tall = float(head_ratio.split(":")[1])
        except (ValueError, TypeError, IndexError):
            pass
    if heads_tall is not None:
        try:
            heads_tall = float(heads_tall)
        except (ValueError, TypeError):
            heads_tall = None

    head_h = (
        metrics.get("head_height")
        or metrics.get("head_height_px")
        or metrics.get("head_h")
        or anatomy.get("head_height")
    )
    head_w = (
        metrics.get("head_width")
        or metrics.get("head_width_px")
        or metrics.get("head_w")
        or anatomy.get("head_width")
    )
    body_h = (
        metrics.get("body_height")
        or metrics.get("body_height_px")
        or metrics.get("body_h")
        or anatomy.get("body_height")
    )
    body_w = (
        metrics.get("body_width")
        or metrics.get("body_width_px")
        or metrics.get("body_w")
        or anatomy.get("body_width")
    )
    head_to_body_w = (
        metrics.get("head_to_body_width_ratio")
        or anatomy.get("head_to_body_width_ratio")
    )
    char_h = (
        metrics.get("anatomical_height")
        or metrics.get("visible_height")
        or metrics.get("character_height_px")
        or anatomy.get("anatomical_height")
    )

    return {
        "heads_tall": heads_tall,
        "head_height": head_h,
        "head_width": head_w,
        "body_height": body_h,
        "body_width": body_w,
        "head_to_body_width_ratio": head_to_body_w,
        "character_height": char_h,
    }


def _build_tier0_palette_spec(data: Dict[str, Any], default_era: str, inherit_style: bool) -> Optional[str]:
    """
    Biên dịch Tầng 0: Master Color & Graphic Palette Specifications (Trích xuất từ NumPy/Pillow).

    @param {Dict[str, Any]} data Dữ liệu hồ sơ gốc.
    @param {str} default_era Kỷ nguyên pixel mặc định.
    @param {bool} inherit_style Có kế thừa phong cách/bảng màu hay không.
    @returns {Optional[str]} Chuỗi mô tả đặc tả màu sắc hoặc None.
    """
    palette = data.get("palette_metrics") or (data.get("global_analysis") or {}).get("palette_metrics")
    if not (inherit_style and isinstance(palette, dict) and palette):
        return None

    # Tệp hồ sơ cũ có thể chứa câu ép số bậc sáng cho từng chất liệu.
    master_color_spec = "\n".join(
        line for line in (palette.get("master_color_prompt") or "").splitlines()
        if not (line.startswith("- Shading Architecture: ") and " distinct tone levels)" in line)
    ).strip()

    if not master_color_spec:
        total_c = palette.get("total_colors", 32)
        era_c = palette.get("palette_era", default_era)
        top_hex = palette.get("top_hex_list", [])
        hex_str = ", ".join(top_hex[:8]) if top_hex else ""
        hue_desc = palette.get("hue_shift_description", "Straight shading")
        outline = palette.get("outline_style_detected")
        outline_line = f"- Outline Grammar: {outline}.\n" if outline else ""
        sat_t = palette.get("saturation_type", "Balanced Classic Saturation")
        con_t = palette.get("contrast_type", "High Contrast")
        con_r = palette.get("contrast_ratio", 4.5)

        master_color_spec = (
            f"MASTER COLOR & GRAPHIC PALETTE SPECIFICATIONS (STRICTLY HARMONIZED WITH REFERENCE ASSET):\n"
            f"- Color Budget: Strictly indexed {total_c}-color palette ({era_c}), primary palette anchors: [{hex_str}].\n"
            f"- Hue-Shifting Rule: {hue_desc}.\n"
            f"{outline_line}"
            f"- Palette Saturation & Contrast: {sat_t}, {con_t} curve ({con_r}:1 ratio).\n"
            f"- Background: Isolated on pure transparent background (PNG alpha channel), zero drop shadows on floor."
        )

    return master_color_spec if master_color_spec else None


def _build_tier1_identity_and_style(
    data: Dict[str, Any],
    concept: str,
    outfit: str,
    props: str,
    era: str,
    height: Any,
    head_ratio: str,
    shading: str,
    lighting: str,
    inherit_style: bool,
    inherit_scale: bool,
) -> List[str]:
    """
    Biên dịch Tầng 1: Identity & Style Matrix (Danh tính, tỷ lệ giải phẫu, tham chiếu phong cách).
    Tích hợp các số đo pixel thực tế của phần đầu và tỷ lệ thân được tính toán từ thuật toán Python.

    @returns {List[str]} Danh sách các đoạn prompt của Tầng 1.
    """
    geom = _extract_geometry_metrics(data)
    head_h = geom.get("head_height")
    head_w = geom.get("head_width")
    body_h = geom.get("body_height")
    head_to_body_w = geom.get("head_to_body_width_ratio")
    heads_tall = geom.get("heads_tall")

    anatomy_constraints = [
        f"Strict anatomy constraints: exactly {height} pixels character height, strict {head_ratio} head-to-body proportion."
    ]

    if inherit_scale and head_h and head_w:
        pixel_dim = f"Strict anatomical pixel dimensions: head bounding box is strictly {head_h}px tall by {head_w}px wide (head ratio {head_ratio})."
        if body_h:
            pixel_dim += f" Torso and legs: {body_h}px tall."
        if head_to_body_w:
            pixel_dim += f" Head-to-body width ratio: {head_to_body_w}."
        anatomy_constraints.append(pixel_dim)

    if inherit_scale and heads_tall is not None:
        if heads_tall >= 3.6:
            anatomy_constraints.append(
                "Anatomy style: mature semi-realistic human proportions, slender heroic silhouette, small compact head proportion. "
                "Any helmet, hood, or headwear must be compact and tightly fitted to the skull contours, strictly avoiding oversized helmet bulk or cartoonish bobblehead scale."
            )
        elif heads_tall < 3.0:
            anatomy_constraints.append(
                "Anatomy style: stylized cute chibi proportions, compact stout body, expressive oversized head."
            )
        else:
            anatomy_constraints.append(
                "Anatomy style: balanced semi-chibi stylized proportions."
            )

    anatomy_section = "\n".join(anatomy_constraints)

    parts: List[str] = [
        (
            f"Masterpiece authentic {era} pixel art sprite sheet of a {concept}{outfit}{props}.\n"
            f"{anatomy_section}\n"
            f"Rendering specifications: {shading}, {lighting}, transparent background, isolated on pure solid transparent background (PNG alpha channel), clean cut-out sprite sheet without background elements or floor shadows."
        )
    ]

    reference_style = data.get("reference_style")
    style_prompt = reference_style.get("style_prompt") if isinstance(reference_style, dict) else None
    if inherit_style and isinstance(style_prompt, str) and style_prompt.strip():
        parts.append(f"REFERENCE STYLE GUIDANCE:\n{style_prompt.strip()}")

    manual = data.get("manual_region_measurements")
    regions = manual if isinstance(manual, dict) and manual.get("measurements") else data.get("region_measurements")
    region_notes = regions.get("prompt_notes") if isinstance(regions, dict) else None
    if inherit_scale and isinstance(region_notes, str) and region_notes.strip():
        parts.append(region_notes.strip())

    return parts


def _build_tier2_grid_layout() -> str:
    """
    Biên dịch Tầng 2: Cấu trúc lưới ma trận Sprite Sheet 3x5 cố định.

    @returns {str} Chuỗi mô tả bố cục lưới 3 hàng x 5 cột.
    """
    return (
        "SPRITE SHEET GRID LAYOUT (3 Rows x 5 Columns, total 15 frames):\n"
        "- Row 1: Down / Front facing view (Frame 0: Idle, Frames 1-4: Walk cycle)\n"
        "- Row 2: Side / Right profile view (Frame 0: Idle, Frames 1-4: Walk cycle)\n"
        "- Row 3: Up / Back facing view (Frame 0: Idle, Frames 1-4: Walk cycle)\n"
        "Absolute cross-frame consistency: identical character proportions, clothing details, and color palette across all 15 frames."
    )


def _build_tier3_frame_matrix(
    down: Dict[str, Any],
    side: Dict[str, Any],
    up: Dict[str, Any]
) -> str:
    """
    Biên dịch Tầng 3: Frame-by-Frame Action Matrix chi tiết 15 khung hình.

    @param {Dict[str, Any]} down Dữ liệu 5 frame hướng đi xuống.
    @param {Dict[str, Any]} side Dữ liệu 5 frame hướng đi ngang.
    @param {Dict[str, Any]} up Dữ liệu 5 frame hướng đi lên.
    @returns {str} Chuỗi đặc tả chi tiết 15 frame.
    """
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
        f"  - Col 4 (Walk 4): {up.get('frame_4', {}).get('action_prompt', '')}",
    ]
    return "\n".join(frame_matrix)


def _build_negative_prompt(
    data: Optional[Any] = None,
    heads_tall: Optional[float] = None,
    inherit_style: bool = True,
    inherit_scale: bool = True,
) -> str:
    """
    Tạo câu Negative Prompt tiêu chuẩn chống các khuyết tật pixel art và chống phông nền.
    Tự động cấm các yếu tố phá hủy tính nhất quán đối chiếu theo nhân vật mẫu (Reference-Aware):
    - Cấm lệch phong cách viền (nếu mẫu viền đen thì cấm lineless; nếu mẫu lineless thì cấm viền đen dày).
    - Cấm đổ bóng mịn / 3D / airbrush / gradient / bóng gối bông pillow shading.
    - Cấm ngược nguồn sáng so với mẫu (ví dụ: cấm bottom lighting, harsh backlighting).
    - Cấm lệch tỷ lệ giải phẫu (dáng chuẩn thì cấm Chibi/đầu to; dáng Chibi thì cấm chân dài).

    @param {Optional[Any]} data Dữ liệu hồ sơ gốc của nhân vật mẫu (hoặc heads_tall nếu truyền trực tiếp).
    @param {Optional[float]} heads_tall Số đầu của nhân vật để lọc phong cách phù hợp.
    @param {bool} inherit_style Có áp dụng cấm lệch nét vẽ và đổ bóng của mẫu hay không.
    @param {bool} inherit_scale Có áp dụng cấm lệch tỷ lệ vóc dáng của mẫu hay không.
    @returns {str} Chuỗi Negative Prompt đã được tùy biến theo mẫu.
    """
    # Hỗ trợ truyền heads_tall trực tiếp ở vị trí tham số đầu tiên (tương thích ngược)
    if isinstance(data, (int, float)):
        heads_tall = float(data)
        data = None

    tokens = [
        "background scenery, complex background, gradient background, floor texture, tiles, shadow on floor",
        "environment, landscape, horizon line, ground dirt, watermark, noisy background, solid colored background walls",
        "blurry, 3D render, smooth vector graphics, photorealistic, anti-aliased edges",
        "deformed anatomy, mismatched frame heights, inconsistent clothing colors between frames",
        "missing limbs, extra limbs, disjointed pixel clusters",
        "frame height flickering, head scaling distortion, irregular grid spacing",
    ]

    profile = data if isinstance(data, dict) else {}
    palette = profile.get("palette_metrics") or (profile.get("global_analysis") or {}).get("palette_metrics") or {}
    pixel_style = profile.get("pixel_style") or (profile.get("global_analysis") or {}).get("pixel_style") or {}

    # 1. Cấm lệch Nét vẽ, Viền và Đổ bóng của Mẫu (khi bật inherit_style)
    if inherit_style:
        tokens.append("smooth color gradients, soft airbrush shading, modern 3D lighting, pillow shading, subpixel blur")

        # Cấm lệch phong cách nét viền (Outline Grammar)
        outline = str(
            palette.get("outline_style_detected")
            or pixel_style.get("outline_style")
            or ""
        ).lower()

        if "black" in outline or "dark" in outline or "crisp" in outline:
            tokens.append("lineless, borderless, faint outline, broken outline, colored outer contour")
        elif "lineless" in outline or "sel-out" in outline or "selective" in outline or "none" in outline:
            tokens.append("heavy black outline, thick cartoon contour, dark ink lines")

        # Cấm ngược hướng sáng so với mẫu
        lighting = str(pixel_style.get("lighting_direction") or "").lower()
        if any(kw in lighting for kw in ["top", "overhead", "left", "right"]):
            tokens.append("bottom lighting, underlighting, harsh rim light, backlighting, multiple conflicting light sources")

    # 2. Cấm lệch Tỷ lệ giải phẫu số đầu (khi bật inherit_scale)
    if inherit_scale and heads_tall is not None:
        if heads_tall >= 3.5:
            tokens.append(
                "chibi, super-deformed, SD style, oversized head, bobblehead, giant bulky helmet, "
                "exaggerated head size, 2-heads tall, 3-heads tall, cute stout body, dwarfish proportions, big head"
            )
        elif heads_tall < 3.0:
            tokens.append(
                "realistic human anatomy, tall slender model, elongated legs, tiny head, 5-heads tall, 8-heads tall"
            )

    return ", ".join(tokens)


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

        # 1. Trích xuất thông số giải phẫu & phong cách từ Schemas và Metrics
        anatomy = data.get("anatomy", {})
        anim_data = data.get("animations", {})
        dir_data = data.get("directions", {})
        geom = _extract_geometry_metrics(data)

        height = anatomy.get("anatomical_height") or geom.get("character_height") or 48
        head_ratio = anatomy.get("head_to_body_ratio") or (f"1:{geom.get('heads_tall')}" if geom.get('heads_tall') else "1:4.0")

        # Động học từ Animation Profile (nếu có)
        walk_profile = anim_data.get("walk_profile", {})
        bobbing_px = walk_profile.get("vertical_bobbing_pixels", "1px")
        secondary_motion = walk_profile.get("secondary_motion") or "subtle cloth and hair momentum sway"

        # Góc nhìn từ Direction Profile (nếu có)
        side_dir = dir_data.get("side_profile", {})
        up_dir = dir_data.get("up_profile", {})

        side_occluded = side_dir.get("occluded_body_parts", ["Far-side arm and leg partially occluded by torso"])
        up_visible = up_dir.get("visible_body_parts", ["Back of head, rear torso, backpack/sheath, shoe soles"])

        # 2. Xây dựng từng hướng độc lập thông qua các hàm chuyên trách
        down_frames = _build_down_frames(height, head_ratio, bobbing_px, secondary_motion)
        side_frames = _build_side_frames(height, bobbing_px, secondary_motion, side_occluded)
        up_frames = _build_up_frames(height, bobbing_px, secondary_motion, up_visible)

        return {
            "down": down_frames,
            "side": side_frames,
            "up": up_frames,
        }

    @staticmethod
    def compile_sprite_sheet_prompt(
        character_concept: str,
        profile_data: Optional[Dict[str, Any]] = None,
        frame_actions: Optional[Dict[str, Any]] = None,
        outfit_and_colors: Optional[str] = None,
        weapons_and_props: Optional[str] = None,
        custom_instructions: Optional[str] = None,
        inherit_scale: bool = True,
        inherit_style: bool = True,
    ) -> Dict[str, Any]:
        """
        Biên dịch toàn bộ khung giải phẫu, phong cách và ma trận 15 frame thành câu Prompt 3 Tầng hoàn chỉnh.

        @param {str} character_concept Ý tưởng nhân vật mới (ví dụ: Nữ sát thủ áo giáp tím).
        @param {Optional[Dict[str, Any]]} profile_data Dữ liệu phân tích AI từ 7 Schemas.
        @param {Optional[Dict[str, Any]]} frame_actions Dữ liệu chỉnh sửa 15 frame từ người dùng.
        @param {Optional[str]} outfit_and_colors Mô tả trang phục và màu sắc.
        @param {Optional[str]} weapons_and_props Mô tả vũ khí và phụ kiện.
        @param {Optional[str]} custom_instructions Chỉ đạo nghệ thuật bổ sung.
        @param {bool} inherit_scale Dùng số đo lát cắt tham chiếu.
        @param {bool} inherit_style Dùng bảng màu tham chiếu.
        @returns {Dict[str, Any]} Từ điển chứa 'positive_prompt', 'negative_prompt' và 'frame_actions_data'.
        """
        data = profile_data or {}
        anatomy = data.get("anatomy", {})
        pixel_style = data.get("pixel_style", {})
        geom = _extract_geometry_metrics(data)

        # Lấy thông số kỹ thuật cốt lõi
        height = anatomy.get("anatomical_height") or geom.get("character_height") or 48
        head_ratio = anatomy.get("head_to_body_ratio") or (f"1:{geom.get('heads_tall')}" if geom.get('heads_tall') else "1:4.0")
        era = pixel_style.get("pixel_art_era", "16-bit SNES")
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
        prompt_parts: List[str] = []

        # TẦNG 0: MASTER COLOR & GRAPHIC PALETTE SPECIFICATIONS
        tier0_palette = _build_tier0_palette_spec(data, era, inherit_style)
        if tier0_palette:
            prompt_parts.append(tier0_palette)

        # TẦNG 1: IDENTITY & STYLE MATRIX
        tier1_parts = _build_tier1_identity_and_style(
            data, concept, outfit, props, era, height, head_ratio,
            shading, lighting, inherit_style, inherit_scale
        )
        prompt_parts.extend(tier1_parts)

        # TẦNG 2: GRID LAYOUT & SPECIFICATIONS
        prompt_parts.append(_build_tier2_grid_layout())

        # TẦNG 3: FRAME-BY-FRAME ACTION MATRIX
        prompt_parts.append(_build_tier3_frame_matrix(down, side, up))

        if custom_instructions and custom_instructions.strip():
            prompt_parts.append(f"Director notes: {custom_instructions.strip()}")

        positive_prompt = "\n\n".join(prompt_parts)
        heads_tall_for_neg = geom.get("heads_tall") if inherit_scale else None
        negative_prompt = _build_negative_prompt(
            data=data,
            heads_tall=heads_tall_for_neg,
            inherit_style=inherit_style,
            inherit_scale=inherit_scale,
        )

        return {
            "positive_prompt": positive_prompt,
            "negative_prompt": negative_prompt,
            "frame_actions_data": actions,
        }
