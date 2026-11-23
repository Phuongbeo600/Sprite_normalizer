from __future__ import annotations

# 1. THƯ VIỆN NỀN TẢNG PYTHON (Toán và cấu trúc dữ liệu)
from dataclasses import dataclass

# 2. THƯ VIỆN BÊN NGOÀI (Ma trận và vùng liên thông)
import numpy as np

# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Dữ liệu đo dùng chung)
# Các hàm số học và ngữ cảnh không phụ thuộc tầng ứng dụng.

# 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
# Không áp dụng cho thuật toán đo ảnh.

ALPHA_VISIBLE = 128  # alpha >= ngưỡng này mới coi là pixel nhìn thấy
DIRS4 = ((-1, 0), (1, 0), (0, -1), (0, 1))

# =============================================================================
# 0. TIỆN ÍCH MÀU (OKLab)
# =============================================================================
def _srgb_to_linear(rgb: np.ndarray) -> np.ndarray:
    c = rgb.astype(np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def srgb_to_oklab(rgb: np.ndarray) -> np.ndarray:
    """(N,3) uint8 sRGB -> (N,3) OKLab. Khoảng cách Euclid ~ khác biệt cảm nhận."""
    lin = _srgb_to_linear(np.atleast_2d(rgb))
    r, g, b = lin[:, 0], lin[:, 1], lin[:, 2]
    l = np.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    m = np.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    s = np.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return np.stack([
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    ], axis=1)


def oklab_to_lch(lab: np.ndarray) -> np.ndarray:
    """-> (L, C, h_degrees)."""
    return np.stack([lab[:, 0], np.hypot(lab[:, 1], lab[:, 2]),
                     np.degrees(np.arctan2(lab[:, 2], lab[:, 1])) % 360.0], axis=1)


def oklab_to_srgb(lab: np.ndarray) -> np.ndarray:
    """(N,3) float OKLab -> (N,3) uint8 sRGB (phép nghịch đảo chính xác của sRGB->OKLab)."""
    lab = np.atleast_2d(lab)
    L, a, b = lab[:, 0], lab[:, 1], lab[:, 2]
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    r_lin = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g_lin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    b_lin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s

    def _lin_to_srgb(c):
        c = np.clip(c, 0.0, 1.0)
        return np.where(c <= 0.0031308, 12.92 * c, 1.055 * (c ** (1.0 / 2.4)) - 0.055)

    rgb = np.stack([_lin_to_srgb(r_lin), _lin_to_srgb(g_lin), _lin_to_srgb(b_lin)], axis=1)
    return np.round(rgb * 255.0).astype(np.uint8)


def circular_hue_span(hues: np.ndarray) -> float:
    """Khoảng mở rộng góc nhỏ nhất chứa toàn bộ tập góc hues (0..360 độ)."""
    if hues.size <= 1:
        return 0.0
    h_sorted = np.sort(hues % 360.0)
    gaps = np.diff(h_sorted)
    wrap_gap = 360.0 - (h_sorted[-1] - h_sorted[0])
    max_gap = max(float(gaps.max()), float(wrap_gap))
    return 360.0 - max_gap


def relative_luminance(rgb: np.ndarray) -> np.ndarray:
    """Luminance tuyến tính WCAG (thang 0..1)."""
    lin = _srgb_to_linear(np.atleast_2d(rgb))
    return 0.2126 * lin[:, 0] + 0.7152 * lin[:, 1] + 0.0722 * lin[:, 2]


def _entropy(counts: np.ndarray) -> float:
    counts = counts[counts > 0].astype(np.float64)
    if counts.size == 0:
        return 0.0
    p = counts / counts.sum()
    return float(-(p * np.log2(p)).sum())


def _weighted_quantile(values: np.ndarray, weights: np.ndarray, q: float) -> float:
    order = np.argsort(values)
    v, w = values[order], weights[order].astype(np.float64)
    cw = np.cumsum(w) - 0.5 * w
    cw /= w.sum()
    return float(np.interp(q, cw, v))


def _shift(a: np.ndarray, dy: int, dx: int, fill) -> np.ndarray:
    """out[y, x] = a[y+dy, x+dx]; ngoài biên = fill."""
    H, W = a.shape
    out = np.full_like(a, fill)
    out[max(0, -dy):H - max(0, dy), max(0, -dx):W - max(0, dx)] = \
        a[max(0, dy):H - max(0, -dy), max(0, dx):W - max(0, -dx)]
    return out


def _erode4(m: np.ndarray) -> np.ndarray:
    p = np.pad(m, 1, constant_values=False)
    return m & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]


# =============================================================================
# 2. LƯỢNG TỬ HOÁ PALETTE (OKLab leader clustering)
# =============================================================================
@dataclass
class Ctx:
    idx: np.ndarray        # (H,W) int, -1 = trong suốt
    vis: np.ndarray        # (H,W) bool
    rgb: np.ndarray        # (K,3) uint8
    lab: np.ndarray        # (K,3)
    lch: np.ndarray        # (K,3)
    counts: np.ndarray     # (K,) số pixel mỗi màu
    K: int




def color_noise_statistics(raw_count, clean_count):
    """Thống kê màu trung gian với ngưỡng cảnh báo và làm tròn hiện hành."""
    intermediate = max(0, raw_count - clean_count)
    return {
        "raw_colors_count": raw_count,
        "clean_colors_count": clean_count,
        "ai_intermediate_colors": intermediate,
        "has_ai_noise_warning": (raw_count > clean_count * 1.25) and (intermediate >= 4),
        "noise_ratio": round(intermediate / max(raw_count, 1), 3),
    }
