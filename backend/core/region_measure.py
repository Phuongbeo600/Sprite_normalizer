"""Đo các lát cắt qua phần pixel nhìn thấy trong đa giác."""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON
# ========================================================
# dataclasses: Định nghĩa cấu trúc dữ liệu kết quả đo.
from dataclasses import dataclass
# math: Tính giao điểm với lưới và độ dài lát cắt.
from math import ceil, floor, isclose, sqrt

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


@dataclass(frozen=True)
class Region:
    polygon: tuple
    axis: tuple | None
    cuts: tuple
    representative: tuple

    @property
    def width(self):
        return self.representative[0]


def visible_pixels(image, polygon, bounds):
    left, top, right, bottom = bounds
    edges = tuple(zip(polygon, polygon[1:] + polygon[:1]))
    pixels = image.load()
    visible = set()
    for y in range(top, bottom):
        row = y + 0.5
        crossings = sorted(
            x1 + (row - y1) * (x2 - x1) / (y2 - y1)
            for (x1, y1), (x2, y2) in edges
            if min(y1, y2) <= row < max(y1, y2)
        )
        for start, end in zip(crossings[::2], crossings[1::2]):
            for x in range(max(left, ceil(start - 0.5)), min(right, ceil(end - 0.5))):
                if pixels[x, y][3] > 0:
                    visible.add((x, y))
    return visible


def longest_cut(pixels, bounds, center, direction):
    """Duyệt các ô pixel dọc theo đường thẳng qua các giao điểm với lưới."""
    left, top, right, bottom = bounds
    cx, cy = center
    dx, dy = direction
    crossings = set()
    if dx:
        crossings.update((x - cx) / dx for x in range(left, right + 1))
    if dy:
        crossings.update((y - cy) / dy for y in range(top, bottom + 1))

    best = (0.0, center, center)
    start = None
    distances = sorted(crossings)
    for a, b in zip(distances, distances[1:]):
        if isclose(a, b, abs_tol=1e-9, rel_tol=0):
            continue
        midpoint = (a + b) / 2
        cell = floor(cx + midpoint * dx), floor(cy + midpoint * dy)
        if cell not in pixels:
            start = None
            continue
        if start is None:
            start = a
        if b - start > best[0]:
            best = (
                b - start,
                (cx + start * dx, cy + start * dy),
                (cx + b * dx, cy + b * dy),
            )
    return best


def measure_region(image, part, polygon, axis=None):
    """Đo bề rộng bộ phận trong đa giác trên ảnh RGBA.

    @param image Ảnh RGBA dùng để xác định pixel nhìn thấy.
    @param part Tên bộ phận, dùng để chọn hướng và vị trí lát cắt.
    @param polygon Các đỉnh nguyên của đa giác nằm trong biên ảnh.
    @param axis Hai điểm chỉ hướng chi. Có thể bỏ qua để dùng trục dọc.
    @returns Vùng đo cùng các lát cắt và lát cắt đại diện.
    """
    polygon = tuple(map(tuple, polygon))
    if len(set(polygon)) < 3:
        raise ValueError("Cần ít nhất ba điểm khác nhau để khoanh vùng.")
    xs, ys = zip(*polygon)
    left, top, right, bottom = bounds = min(xs), min(ys), max(xs), max(ys)
    pixels = visible_pixels(image, polygon, bounds)
    if not pixels:
        raise ValueError("Vùng khoanh chưa chứa pixel nhìn thấy.")

    if part in ("head", "neck", "torso"):
        rows = sorted({y for _, y in pixels})
        middle = (top + bottom) / 2
        rows.sort(key=lambda y: abs(y + 0.5 - middle))
        if part == "neck":
            rows = rows[:1]
        widest = max(
            (longest_cut(pixels, bounds, (left, y + 0.5), (1, 0)) for y in rows),
            key=lambda cut: cut[0],
        )
        return Region(polygon, None, (widest,), widest)

    if axis is None:
        middle_x = (left + right) / 2
        (x1, y1), (x2, y2) = (middle_x, top), (middle_x, bottom)
    else:
        (x1, y1), (x2, y2) = axis
    dx, dy = x2 - x1, y2 - y1
    length = sqrt(dx * dx + dy * dy)
    if length == 0:
        raise ValueError("Hai điểm chỉ hướng chi cần khác nhau.")
    normal = dy / length, -dx / length
    cuts = tuple(
        longest_cut(pixels, bounds, (x1 + fraction * dx, y1 + fraction * dy), normal)
        for fraction in (0.5, 0.4, 0.6)
    )
    median = sorted(cuts, key=lambda cut: cut[0])[1][0]
    if median == 0:
        raise ValueError("Lát cắt giữa chi chưa đi qua đủ pixel. Hãy thử đặt lại trục chi.")
    representative = next(cut for cut in cuts if cut[0] == median)
    return Region(polygon, axis, cuts, representative)
