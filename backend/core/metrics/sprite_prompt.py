"""Chuyển JSON số đo sprite thành prompt vẽ pixel art."""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON
# ========================================================
# Không phụ thuộc thư viện nền tảng.

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI
# ========================================================
# Không dùng thư viện bên ngoài.

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
# ========================================================
# Không phụ thuộc mô-đun nội bộ.

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC
# ========================================================
# Không áp dụng cho backend.


def build_region_report(size, measurements):
    """Đóng gói số đo và mô tả tỷ lệ dùng chung cho trình soạn prompt."""
    widths = [
        f"{part.replace('_', ' ')} {'width' if 'polygon' in entry else 'reference segment'} {entry['width_px']:g} px"
        for part, entry in measurements.items()
    ]
    return {
        "image_size_px": size,
        "measurements": measurements,
        "prompt_notes": (
            f"Reference cross-sections in source-image pixels: {', '.join(widths)}. "
            "Scale these proportions to the target sprite height."
        ) if widths else "",
    }
