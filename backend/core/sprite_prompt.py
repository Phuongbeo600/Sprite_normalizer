"""Chuyển JSON số đo sprite thành prompt vẽ pixel art."""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON
# ========================================================
# math: Kiểm tra tọa độ và số đo là số hữu hạn.
import math

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


PARTS = {
    "head": ("Đầu", "bề rộng ngang lớn nhất"),
    "neck": ("Cổ", "bề rộng ngang gần giữa cổ"),
    "torso": ("Thân", "bề rộng ngang lớn nhất"),
    "left_arm": ("Tay trái", "bề dày vuông góc với tay"),
    "right_arm": ("Tay phải", "bề dày vuông góc với tay"),
    "left_leg": ("Chân trái", "bề dày vuông góc với chân"),
    "right_leg": ("Chân phải", "bề dày vuông góc với chân"),
}


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


def is_number(value):
    return type(value) in (int, float) and math.isfinite(value)


def read_point(point, size):
    if (not isinstance(point, (list, tuple)) or len(point) != 2
            or any(not is_number(value) or not 0 <= value <= limit
                   for value, limit in zip(point, size))):
        raise ValueError("Tọa độ điểm sai định dạng hoặc nằm ngoài canvas.")
    return tuple(point)


def format_point(point):
    x, y = point
    return f"({x:g}, {y:g})"


def describe_part(entry, label, width_kind, size):
    if entry is None:
        return [f"- {label}: chưa có số đo."]
    if not isinstance(entry, dict):
        raise ValueError("Số đo phải là một đối tượng JSON.")
    width = entry.get("width_px")
    if not is_number(width) or width <= 0:
        raise ValueError("width_px phải là số dương.")

    start, end = (read_point(entry.get(key), size) for key in ("start", "end"))
    line = f"{format_point(start)} đến {format_point(end)}"
    if "polygon" not in entry:
        return [f"- {label}: đoạn tham chiếu dài {width:g} px, từ {line}."]

    polygon = entry["polygon"]
    if not isinstance(polygon, list) or len(polygon) < 3:
        raise ValueError("Đa giác phải có ít nhất ba điểm.")
    points = [read_point(point, size) for point in polygon]
    xs, ys = zip(*points)
    left, top, right, bottom = min(xs), min(ys), max(xs), max(ys)
    result = [
        f"- {label}: {width_kind} {width:g} px; lát cắt từ {line}.",
        f"  Vùng bao x={left:g}–{right:g}, y={top:g}–{bottom:g} "
        f"({right - left:g} px ngang × {bottom - top:g} px dọc).",
        "  Viền đa giác: " + ", ".join(map(format_point, points)) + ".",
    ]
    axis = entry.get("axis")
    if axis is not None:
        if not isinstance(axis, list) or len(axis) != 2:
            raise ValueError("Trục chi phải có hai điểm.")
        a, b = (read_point(point, size) for point in axis)
        result.append(f"  Hướng trục chi: {format_point(a)} đến {format_point(b)}.")
    return result
