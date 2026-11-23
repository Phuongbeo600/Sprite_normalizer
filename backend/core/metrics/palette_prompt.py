# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểu dữ liệu)
from typing import List

# 2. THƯ VIỆN BÊN NGOÀI
# Không cần phụ thuộc ngoài.

# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
# Chỉ biên dịch văn bản từ số đo đã tính.

# 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
# Cấu trúc chỉ dẫn màu tương thích với hồ sơ hiện có.

def compose_master_color_prompt(
    total_unique: int,
    palette_era: str,
    top_hex_list: List[str],
    hue_shift_desc: str,
    outline_style: str,
    saturation_type: str,
    contrast_type: str,
    contrast_val: float,
    outline_thickness: float = 1,
) -> str:
    """Biên dịch chuỗi Master Color Prompt hợp chuẩn với Asset tham chiếu."""
    top_swatches_str = ", ".join(top_hex_list[:8])
    contour = (
        f", strictly {outline_thickness:g}-pixel crisp pixel contour without orphan noise."
        if outline_thickness > 0 else ", preserve crisp silhouette edges without adding an outline."
    )
    return (
        f"MASTER COLOR & GRAPHIC PALETTE SPECIFICATIONS (STRICTLY HARMONIZED WITH REFERENCE ASSET):\n"
        f"- Color Budget: Strictly indexed {total_unique}-color palette ({palette_era}), primary palette anchors: [{top_swatches_str}].\n"
        f"- Hue-Shifting Rule: {hue_shift_desc}.\n"
        f"- Outline Grammar: {outline_style}{contour}\n"
        f"- Palette Saturation & Contrast: {saturation_type}, {contrast_type} curve ({contrast_val}:1 ratio).\n"
        f"- Background: Isolated on pure transparent background (PNG alpha channel), zero drop shadows on floor."
    )
