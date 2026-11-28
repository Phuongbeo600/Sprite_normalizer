# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Standard Library)
# ========================================================
# (Chỉ sử dụng hằng số chuỗi thuần của Python)

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


# ========================================================
# CÁC KHỐI NỘI DUNG TĨNH MẶC ĐỊNH CỦA TEMPLATE PROMPT
# ========================================================

STATIC_TASK = (
    "Create a 2D game pixel art walk-cycle sprite sheet of a single character based on the Character Design below."
)

STATIC_REFERENCE_RULES = """- Image 1 — Style and Proportions: Reference anatomical proportions, pixel density, outline technique, shading, and lighting direction. Do not copy the original character design unless requested by the user.
- Image 2 — Layout and Motion: Reference ONLY frame positions, facing directions, joint bend angles, and animation sequence.

Reproduce Image 2's poses using Image 1's body proportions; do not inherit Image 2's body shape, colors, or art style."""

STATIC_LAYOUT_AND_MOTION_RULES = """Arrange exactly 15 frames in a 3 rows × 5 columns grid.

Facing direction by row:
- Row 1: Front View.
- Row 2: Side view 90°, facing the left side of the screen (Left Profile).
- Row 3: Direct Back View.

Sequence by column:
- Col 1 — Idle: Natural standing pose.
- Col 2 — Contact A: Left foot forward, right foot behind.
- Col 3 — Passing A: Right leg transitions past the weight-bearing left leg.
- Col 4 — Contact B: Right foot forward, left foot behind.
- Col 5 — Passing B: Left leg transitions past the weight-bearing right leg.

Each frame corresponds to the exact cell in Image 2. Do not add, remove, merge, or reorder frames.

Columns 2–5 form a continuous looping walk cycle, with alternating leg strides, natural weight shift, proper ground contact, and arm swing suited to the outfit and gear."""

STATIC_CONSISTENCY_RULES = """Maintain across all 15 frames:
- Character design and recognizable identity features.
- Body proportions and relative limb lengths.
- Outfit, gear, accessories, and handedness of held items.
- Color palette, pixel density, outlines, shading, and lighting direction.

Vary only viewing angle, pose, joint bend angles, and natural secondary motion. Allow apparent perspective changes based on pose and viewing angle without distorting body proportions."""

STATIC_OUTPUT_RULES = """- Equal-sized grid cells with consistent character scale and ground anchor.
- Display the full character and gear inside each cell without clipping or overlap.
- Crisp hard-edged pixels; no anti-aliasing, blur, or smooth gradients.
- No text, labels, grid lines, skeletons, or joint markers."""

STATIC_BACKGROUND_RULES = """- True transparent PNG background (PNG Alpha Channel).
- All pixels outside the character and gear must be completely transparent (Alpha = 0).
- No solid color backdrop, white background, checkerboard pattern, or ground drop shadows."""

STATIC_PRIORITY_RULES = """When requirements conflict, prioritize in the following order:
1. Exact 3×5 grid layout and 15-frame count.
2. Character design from the user prompt.
3. Anatomical proportions, Image 1 style, and cross-frame consistency.
4. Accurate viewing angles and animation sequence.
5. Poses referenced from Image 2.
6. Decorative details.

Adapt reference poses to the character's anatomy and simplify decorative details if necessary."""

STATIC_COLOR_INHERITANCE_RULE = (
    "- Inherit the saturation and value contrast of Image 1."
)

STATIC_COLOR_DESIGN_RULE = (
    "- Choose colors that fit the new character design."
)


# ========================================================
# GIÁ TRỊ MẶC ĐỊNH CHO CÁC THÀNH PHẦN ĐỘNG
# ========================================================

DEFAULT_ANATOMICAL_DESCRIPTION = ""

DEFAULT_COLOR_COUNT_DESCRIPTION = (
    "- Use a shared color palette matched to Image 1's color budget across the entire Sprite Sheet."
)


# Khối ANATOMICAL PROPORTIONS (tự động loại bỏ khỏi Final Prompt nếu [ANATOMICAL_DESCRIPTION] rỗng)
ANATOMICAL_PROPORTIONS_BLOCK = """### ANATOMICAL PROPORTIONS

[ANATOMICAL_DESCRIPTION]
Maintain these anatomical characteristics across all 15 frames. Allow natural projection and foreshortening changes based on pose and viewing angle without distorting body proportions."""


# ========================================================
# MẪU TEMPLATE ĐỘNG TỔNG THỂ (11 MỤC CHUẨN HÓA)
# ========================================================

SPRITE_SHEET_DYNAMIC_TEMPLATE = f"""### TASK

[STATIC_TASK]

### CHARACTER DESIGN

[USER_DESCRIPTION]

### REFERENCE RULES

[STATIC_REFERENCE_RULES]

{ANATOMICAL_PROPORTIONS_BLOCK}

### COLOR CONSTRAINTS

[COLOR_COUNT_DESCRIPTION]
[STATIC_COLOR_INHERITANCE_RULE]
[STATIC_COLOR_DESIGN_RULE]

### LAYOUT & MOTION

[STATIC_LAYOUT_AND_MOTION_RULES]

### CONSISTENCY RULES

[STATIC_CONSISTENCY_RULES]

### OUTPUT RULES

[STATIC_OUTPUT_RULES]

### BACKGROUND CONSTRAINTS

[STATIC_BACKGROUND_RULES]

### PRIORITY RULES

[STATIC_PRIORITY_RULES]"""
