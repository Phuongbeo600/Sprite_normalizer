"""
pixel_art_metrics.py
====================
Đo đặc trưng phong cách Pixel Art bằng thuật toán (không LLM).

Pipeline
--------
1. detect_pixel_grid()   Tìm chu kỳ lưới pixel (kể cả phóng to không nguyên, ảnh AI có nhiễu)
                         bằng "comb filter" trên profile gradient + lift so với baseline ngẫu nhiên.
2. restore_native()      Khôi phục ảnh về độ phân giải pixel thật (median theo ô).
3. quantize_palette()    Gộp màu gần nhau trong OKLab (khử nhiễu AI/JPEG) -> ảnh index.
4. analyze_*()           Palette, ramp đổ bóng (đồ thị kề màu + union-find), hue-shift (hồi quy
                         góc hue theo lightness), cluster (connected components), viền
                         (silhouette + entropy có điều kiện + ray-walk đo độ dày), mật độ chi tiết.
5. fingerprint()/compare_styles()  So sánh sprite tham chiếu và sprite AI sinh ra.

Phụ thuộc: numpy, scipy, Pillow.
"""
# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON
# ========================================================
# __future__: Hoãn đánh giá chú thích kiểu.
from __future__ import annotations

# math: Tính các chỉ số hình học và màu.
import math
# dataclasses: Lưu tham số lưới pixel và dữ liệu bảng màu.
from dataclasses import dataclass
# typing: Khai báo kiểu dữ liệu của các hàm phân tích.
from typing import Any, Dict, List, Optional, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI
# ========================================================
# NumPy: Xử lý ma trận pixel và thống kê màu.
import numpy as np
# Pillow: Nhận và chuyển đổi ảnh đầu vào.
from PIL import Image
# SciPy: Gán nhãn các vùng pixel liên thông.
from scipy import ndimage as ndi

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
# ========================================================
# Không phụ thuộc mô-đun nội bộ.

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC
# ========================================================
# Không áp dụng cho backend.

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
# 1. PHÁT HIỆN LƯỚI PIXEL
# =============================================================================
@dataclass
class GridResult:
    period: float        # kích thước 1 pixel logic tính bằng pixel ảnh (1.0 = ảnh đã native)
    phase_x: float       # toạ độ biên ô đầu tiên theo trục x
    phase_y: float
    confidence: float    # lift (0..1): phần năng lượng cạnh nằm trên lưới trừ baseline ngẫu nhiên
    on_grid_fraction: float


def _edge_profiles(rgba: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    f = rgba.astype(np.float32).copy()
    f[f[..., 3] < ALPHA_VISIBLE] = 0.0
    out = []
    for axis in (1, 0):
        d = np.abs(np.diff(f, axis=axis)).sum(axis=2)
        noise = float(np.median(d))                  # nền nhiễu = median độ lệch (vùng phẳng chiếm đa số)
        d = np.where(d >= max(18.0, 4.0 * noise), d, 0.0)
        out.append(d.sum(axis=0 if axis == 1 else 1))
    return out[0], out[1]  # profile x (W-1), profile y (H-1)


def _best_phase(profile: np.ndarray, period: float, step: float = 0.25):
    n, total = profile.size, float(profile.sum())
    if total <= 0:
        return 0.0, 0.0, 0.0, 0
    phases = np.arange(0.0, period, step)
    k = np.arange(int(n / period) + 2)
    idx = np.round(phases[:, None] + k[None, :] * period).astype(int) - 1  # biên b nằm giữa pixel b-1 và b
    valid = (idx >= 0) & (idx < n)
    energy = np.where(valid, profile[np.clip(idx, 0, n - 1)], 0.0).sum(axis=1)
    cnt = valid.sum(axis=1)
    lift = energy / total - cnt / n
    j = int(lift.argmax())
    return float(lift[j]), float(phases[j]), float(energy[j]), int(cnt[j])


def detect_pixel_grid(rgba: np.ndarray, max_period: Optional[float] = None,
                      min_lift: float = 0.40, min_on_grid: float = 0.60,
                      min_edges_per_axis: int = 0) -> GridResult:
    """
    Tìm chu kỳ p và pha sao cho các cạnh màu (gradient) rơi vào lưới {phase + k*p}.
    score(p) = (năng lượng cạnh trên lưới / tổng) - (tỷ lệ vị trí lưới trong ảnh)
    -> bội số của p thật (2p, 3p) bị loại vì bỏ sót cạnh; ước số (p/2) bị loại vì baseline cao hơn.
    """
    H, W = rgba.shape[:2]
    px, py = _edge_profiles(rgba)
    tx, ty = float(px.sum()), float(py.sum())
    if tx + ty <= 0 or min(np.count_nonzero(px), np.count_nonzero(py)) < min_edges_per_axis:
        return GridResult(1.0, 0.0, 0.0, 0.0, 0.0)
    max_period = max_period or max(2.0, min(80.0, min(H, W) / 8.0))
    best = None
    for p in np.arange(2.0, max_period + 1e-9, 0.05):
        lx, phx, ex, cx = _best_phase(px, p)
        ly, phy, ey, cy = _best_phase(py, p)
        n_all = px.size + py.size
        on = (ex + ey) / (tx + ty)
        lift = on - (cx + cy) / n_all
        if best is None or lift > best[0] + 1e-9:
            best = (lift, round(float(p), 2), phx, phy, on)
    lift, p, phx, phy, on = best
    if lift < min_lift or on < min_on_grid:
        return GridResult(1.0, 0.0, 0.0, max(lift, 0.0), on)
    return GridResult(p, phx, phy, lift, on)


def restore_native(rgba: np.ndarray, grid: GridResult) -> np.ndarray:
    """Mỗi ô lưới -> 1 pixel, lấy median trong vùng giữa ô (bỏ viền ô bị nhoè/anti-alias)."""
    if grid.period <= 1.0001:
        return rgba

    def cells(n: int, phase: float, p: float):
        out, k = [], 0
        while True:
            c = phase + (k - 0.5) * p
            if c >= n:
                break
            if c >= 0:
                hw = max(0.5, 0.3 * p)
                lo = max(0, int(math.ceil(c - hw)))
                hi = min(n, int(math.floor(c + hw)) + 1)
                if hi > lo:
                    out.append((lo, hi))
            k += 1
        return out

    H, W = rgba.shape[:2]
    rows, cols = cells(H, grid.phase_y, grid.period), cells(W, grid.phase_x, grid.period)
    f = rgba.astype(np.float32)
    stage = np.stack([np.median(f[a:b], axis=0) for a, b in rows], axis=0)       # (R, W, 4)
    native = np.stack([np.median(stage[:, a:b], axis=1) for a, b in cols], axis=1)  # (R, C, 4)
    return native.round().astype(np.uint8)


def _auto_alpha(rgba: np.ndarray) -> np.ndarray:
    """Ảnh không có kênh alpha: flood-fill từ biên theo màu nền phổ biến nhất."""
    if rgba[..., 3].min() < 255:
        return rgba
    H, W = rgba.shape[:2]
    border = np.concatenate([rgba[0], rgba[-1], rgba[:, 0], rgba[:, -1]])[:, :3]
    cols, cnt = np.unique(border, axis=0, return_counts=True)
    bg = cols[cnt.argmax()].astype(int)
    same = (np.abs(rgba[..., :3].astype(int) - bg).max(axis=2) <= 8)
    lab, _ = ndi.label(same)
    edge_labels = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg_mask = np.isin(lab, edge_labels[edge_labels > 0])
    out = rgba.copy()
    out[bg_mask, 3] = 0
    return out


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


def quantize_palette(native: np.ndarray, merge_de: float = 0.025) -> Ctx:
    """
    Lượng tử hoá bảng màu:
    1. Khử nhiễu cục bộ và anti-aliasing bằng ngưỡng OKLab thích ứng (adaptive threshold).
    2. Cập nhật trọng tâm cụm (weighted centroid) trong không gian OKLab, thay vì ghim cứng leader tĩnh.
    3. Tinh chỉnh K-means (Lloyd) để cực tiểu hoá sai số toàn phương MSE của bảng màu.
    4. Trả về màu đại diện là giá trị chuyển đổi sRGB chuẩn của trọng tâm.
    """
    vis = native[..., 3] >= ALPHA_VISIBLE
    flat = native[..., :3][vis]
    uniq, inv, cnt = np.unique(flat, axis=0, return_inverse=True, return_counts=True)
    inv = inv.reshape(-1)
    lab = srgb_to_oklab(uniq)

    # Thích ứng ngưỡng khi gặp ảnh AI/ảnh nén có dải màu gradient dày đặc
    target_de = merge_de
    if len(uniq) > 48 and target_de < 0.05:
        target_de = max(target_de, min(0.065, 0.025 + 0.008 * math.log2(len(uniq) / 32.0)))

    order = np.argsort(-cnt)                      # màu phổ biến làm "leader" trước
    leader_lab: List[np.ndarray] = []
    cluster_members: List[List[int]] = []
    for i in order:
        if leader_lab:
            d = np.linalg.norm(np.array(leader_lab) - lab[i], axis=1)
            j = int(d.argmin())
            if d[j] <= target_de:
                cluster_members[j].append(int(i))
                continue
        leader_lab.append(lab[i].copy())
        cluster_members.append([int(i)])

    K = len(leader_lab)
    centroids = np.zeros((K, 3))
    for k in range(K):
        m = cluster_members[k]
        w = cnt[m].astype(float)
        centroids[k] = (lab[m] * w[:, None]).sum(axis=0) / max(w.sum(), 1e-9)

    # Tinh chỉnh Lloyd (K-means) để cực tiểu hóa sai số biểu diễn
    assign = np.empty(len(uniq), dtype=int)
    for _ in range(2):
        dists = np.linalg.norm(lab[:, None, :] - centroids[None, :, :], axis=2)
        assign = dists.argmin(axis=1)
        new_centroids = np.zeros_like(centroids)
        for k in range(K):
            mask = (assign == k)
            if mask.any():
                w = cnt[mask].astype(float)
                new_centroids[k] = (lab[mask] * w[:, None]).sum(axis=0) / max(w.sum(), 1e-9)
            else:
                new_centroids[k] = centroids[k]
        centroids = new_centroids

    # Gộp các centroid quá gần nhau sau khi hội tụ
    merged = True
    while merged:
        merged = False
        K = len(centroids)
        for i in range(K):
            for j in range(i + 1, K):
                if np.linalg.norm(centroids[i] - centroids[j]) < target_de * 0.75:
                    mask_i = (assign == i)
                    mask_j = (assign == j)
                    w_i = cnt[mask_i].sum()
                    w_j = cnt[mask_j].sum()
                    centroids[i] = (centroids[i] * w_i + centroids[j] * w_j) / max(w_i + w_j, 1)
                    assign[assign == j] = i
                    assign[assign > j] -= 1
                    centroids = np.delete(centroids, j, axis=0)
                    merged = True
                    break
            if merged:
                break

    K = len(centroids)
    idx = np.full(native.shape[:2], -1, dtype=int)
    idx[vis] = assign[inv]
    counts = np.bincount(assign, weights=cnt, minlength=K).astype(int)
    # Đại diện RGB bằng trọng tâm chuyển đổi chuẩn, thay vì 1 pixel nhiễu ngẫu nhiên
    rgb = oklab_to_srgb(centroids)
    lch = oklab_to_lch(centroids)
    return Ctx(idx, vis, rgb, centroids, lch, counts, K)


# =============================================================================
# 3. PHÂN TÍCH BẢNG MÀU
# =============================================================================
def analyze_palette(ctx: Ctx, top: int = 16) -> Dict[str, Any]:
    total = int(ctx.counts.sum())
    order = np.argsort(-ctx.counts)[:top]
    dominant = [{
        "hex": "#%02x%02x%02x" % tuple(int(v) for v in ctx.rgb[i]),
        "area_pct": round(100.0 * ctx.counts[i] / total, 2),
        "pixels": int(ctx.counts[i]),
        "L": round(float(ctx.lch[i, 0]), 3), "C": round(float(ctx.lch[i, 1]), 3),
        "h": round(float(ctx.lch[i, 2]), 1),
    } for i in order]
    Y = relative_luminance(ctx.rgb)
    hi, lo = _weighted_quantile(Y, ctx.counts, 0.98), _weighted_quantile(Y, ctx.counts, 0.02)
    peaks = ctx.rgb.max(axis=1)
    saturation = np.divide(
        peaks - ctx.rgb.min(axis=1), peaks, out=np.zeros(ctx.K), where=peaks > 0
    )
    return {
        "total_colors": ctx.K,
        "dominant": dominant,
        "average_saturation": round(float(np.average(saturation, weights=ctx.counts)), 4),
        "mean_chroma": round(float((ctx.lch[:, 1] * ctx.counts).sum() / total), 4),
        "lightness_p5": round(_weighted_quantile(ctx.lch[:, 0], ctx.counts, 0.05), 3),
        "lightness_p95": round(_weighted_quantile(ctx.lch[:, 0], ctx.counts, 0.95), 3),
        "contrast_ratio_wcag": round((hi + 0.05) / (lo + 0.05), 2),
    }


# =============================================================================
# 4. VIỀN (outline)
# =============================================================================
def _detect_outline_candidates(
    ctx: Ctx,
    boundary: np.ndarray,
    interior: np.ndarray,
    total_boundary_px: int,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Xác định các màu ứng viên viền ngoài dựa trên tỷ lệ xuất hiện ở đường biên ngoài
    và độ tương phản ánh sáng so với phần thân nhân vật.

    @param ctx: Ngữ cảnh chứa ảnh chỉ số màu, bảng màu và tọa độ LCH.
    @param boundary: Mặt nạ nhị phân đánh dấu các pixel ở đường biên ngoài.
    @param interior: Mặt nạ nhị phân phần bên trong sau khi xói mòn 4 hướng.
    @param total_boundary_px: Tổng số pixel của đường biên ngoài.
    @returns: Tuple gồm (mảng boolean đánh dấu màu viền, số lượng pixel biên của từng màu).
    """
    idx, K = ctx.idx, ctx.K
    b_count = np.bincount(idx[boundary], minlength=K)
    body = interior if interior.any() else ctx.vis
    body_L = float(np.median(ctx.lch[idx[body], 0]))

    # Nhận diện màu viền:
    # 1. Màu viền chuyên dụng (>=40% pixel màu này nằm ở biên ngoài).
    # 2. Hoặc màu tối chủ đạo bao quanh thân (>=10% chu vi ngoài B và tối hơn đáng kể so với thân L <= body_L - 0.12).
    # Không để việc màu viền được dùng thêm làm inlines/bóng bên trong làm mất dấu viền.
    is_dark = (ctx.lch[:, 0] <= body_L - 0.12) | (ctx.lch[:, 0] < 0.35)
    dedicated_boundary = (b_count / np.maximum(ctx.counts, 1)) >= 0.40
    major_dark_boundary = is_dark & (b_count >= 0.10 * total_boundary_px)

    cand = (
        (b_count >= 0.02 * total_boundary_px)
        & (dedicated_boundary | major_dark_boundary)
        & (
            (ctx.lch[:, 0] <= body_L - 0.08)
            | ((ctx.lch[:, 0] >= 0.85) & (b_count / np.maximum(ctx.counts, 1) >= 0.70))
        )
    )
    return cand, b_count


def _classify_outline_style(
    ctx: Ctx,
    idx: np.ndarray,
    boundary: np.ndarray,
    is_out: np.ndarray,
    out_mask: np.ndarray,
    out_ext: np.ndarray,
) -> Tuple[str, Optional[float]]:
    """
    Phân loại kiểu viền dựa trên entropy có điều kiện H(màu viền | màu thân kề bên).

    @param ctx: Ngữ cảnh pixel art chứa bảng màu và số đếm pixel.
    @param idx: Mảng chỉ số màu 2 chiều.
    @param boundary: Mặt nạ biên ngoài.
    @param is_out: Mảng boolean đánh dấu màu nào là màu viền.
    @param out_mask: Mặt nạ nhị phân 2 chiều của các pixel viền.
    @param out_ext: Mảng boolean mở rộng có thêm phần tử nền False ở cuối.
    @returns: Tuple gồm (tên kiểu viền: str, tỷ lệ entropy có điều kiện: Optional[float]).
    """
    K = ctx.K
    nb_color = np.full(idx.shape, -1, dtype=int)
    for dy, dx in DIRS4:
        nb = _shift(idx, dy, dx, -1)
        ok = (nb >= 0) & ~out_ext[nb] & (nb_color == -1)
        nb_color[ok] = nb[ok]

    sel = out_mask & boundary & (nb_color >= 0)
    n_out = int(is_out.sum())
    h_o = _entropy(np.bincount(idx[sel], minlength=K)) if sel.any() else 0.0

    if n_out == 1 or h_o < 0.15:
        c = int(np.flatnonzero(is_out)[np.argmax(ctx.counts[is_out])])
        dark_neutral = ctx.lch[c, 0] < 0.25 and ctx.lch[c, 1] < 0.05
        style = "uniform_black" if dark_neutral else "uniform_colored"
        return style, None

    joint = np.bincount(nb_color[sel] * K + idx[sel], minlength=K * K).reshape(K, K)
    h_cond = sum(joint[n].sum() * _entropy(joint[n]) for n in range(K)) / max(joint.sum(), 1)
    ratio = float(h_cond / h_o) if h_o > 0 else 0.0
    style = "selout" if ratio < 0.5 else "multicolor_nonselective"
    return style, ratio


def _measure_outline_thickness_raywalk(
    idx: np.ndarray,
    vis: np.ndarray,
    out_mask: np.ndarray,
) -> Tuple[float, Dict[int, int]]:
    """
    Đo độ dày đường viền (tính bằng pixel) bằng thuật toán ray-walk từ biên ngoài vào thân.

    @param idx: Mảng chỉ số màu 2 chiều.
    @param vis: Mặt nạ các pixel nhìn thấy được (alpha >= ngưỡng).
    @param out_mask: Mặt nạ các pixel thuộc viền ngoài.
    @returns: Tuple gồm (độ dày phổ biến nhất: float, biểu đồ đếm tần suất độ dày: Dict[int, int]).
    """
    h_dim, w_dim = idx.shape
    runs: List[np.ndarray] = []

    for dy, dx in DIRS4:
        facing_bg = vis & ~_shift(vis, dy, dx, False) & out_mask
        ys, xs = np.nonzero(facing_bg)
        run = np.zeros(len(ys), dtype=int)
        alive = np.ones(len(ys), dtype=bool)
        for k in range(8):
            y, x = ys - dy * k, xs - dx * k
            inb = (y >= 0) & (y < h_dim) & (x >= 0) & (x < w_dim)
            cond = np.zeros(len(ys), dtype=bool)
            cond[inb] = out_mask[y[inb], x[inb]]
            alive &= cond
            run += alive
        runs.append(run)

    runs_all = np.concatenate(runs) if runs else np.array([], dtype=int)
    hist = np.bincount(runs_all, minlength=2)[1:] if runs_all.size else np.array([])
    thickness = float(np.argmax(hist) + 1) if hist.size and hist.sum() else 0.0
    thickness_hist = {int(i + 1): int(v) for i, v in enumerate(hist) if v}
    return thickness, thickness_hist


def analyze_outline(ctx: Ctx) -> Tuple[Dict[str, Any], np.ndarray]:
    """
    Phân tích đường viền ngoài của sprite: độ phủ, phong cách, độ dày và màu sắc.

    @param ctx: Ngữ cảnh pixel art chứa ảnh chỉ số màu và thông tin bảng màu.
    @returns: Tuple gồm (thông tin chi tiết đường viền: Dict, mảng boolean đánh dấu màu viền: np.ndarray).
    """
    idx, vis, K = ctx.idx, ctx.vis, ctx.K
    interior = _erode4(vis)
    boundary = vis & ~interior
    total_boundary_px = int(boundary.sum())
    base = {
        "style": "none",
        "coverage": 0.0,
        "n_colors": 0,
        "colors": [],
        "thickness_px": 0.0,
        "thickness_hist": {},
        "conditional_entropy_ratio": None,
    }
    is_out = np.zeros(K, dtype=bool)
    if total_boundary_px == 0:
        return base, is_out

    cand, b_count = _detect_outline_candidates(ctx, boundary, interior, total_boundary_px)
    coverage = float(b_count[cand].sum() / total_boundary_px)
    base["coverage"] = round(coverage, 3)
    if coverage < 0.5:
        base["style"] = "lineless"
        return base, is_out

    is_out = cand
    out_ext = np.append(is_out, False)
    out_mask = vis & out_ext[idx]

    # Xác định kiểu dáng viền và độ dày bằng các hàm con tách biệt
    style, ratio = _classify_outline_style(ctx, idx, boundary, is_out, out_mask, out_ext)
    thickness, thickness_hist = _measure_outline_thickness_raywalk(idx, vis, out_mask)

    base.update({
        "style": style,
        "n_colors": int(is_out.sum()),
        "colors": ["#%02x%02x%02x" % tuple(int(v) for v in ctx.rgb[i]) for i in np.flatnonzero(is_out)],
        "thickness_px": thickness,
        "thickness_hist": thickness_hist,
        "conditional_entropy_ratio": None if ratio is None else round(ratio, 3),
        "partial": coverage < 0.85,
    })
    return base, is_out


# =============================================================================
# 5. RAMP ĐỔ BÓNG + HUE-SHIFT
# =============================================================================
def _contact_matrix(ctx: Ctx) -> np.ndarray:
    K, idx = ctx.K, ctx.idx
    M = np.zeros((K, K), dtype=np.int64)
    for a, b in ((idx[:, :-1], idx[:, 1:]), (idx[:-1, :], idx[1:, :])):
        m = (a >= 0) & (b >= 0) & (a != b)
        M += np.bincount(a[m] * K + b[m], minlength=K * K).reshape(K, K)
    return M + M.T


def _collect_ramp_candidate_edges(
    ctx: Ctx,
    contact: np.ndarray,
    tot: np.ndarray,
    usable: np.ndarray,
    max_step_dL: float,
    max_step_hue: float,
) -> List[Tuple[int, int, int]]:
    """
    Thu thập các cặp màu kề nhau có khả năng thuộc cùng dải chuyển tiếp bóng (ramp).

    @param ctx: Ngữ cảnh pixel art chứa tọa độ không gian màu LCH.
    @param contact: Ma trận số lượng điểm tiếp xúc giữa các cặp màu.
    @param tot: Tổng số điểm tiếp xúc biên của từng màu.
    @param usable: Mảng boolean đánh dấu màu hợp lệ (không phải viền và có tần suất >= 2).
    @param max_step_dL: Ngưỡng chênh lệch sáng tối đa giữa 2 bậc kề.
    @param max_step_hue: Ngưỡng chênh lệch góc hue tối đa giữa 2 bậc kề.
    @returns: Danh sách các cạnh (số lượng pixel tiếp xúc, màu i, màu j) sắp xếp giảm dần theo trọng số tiếp xúc.
    """
    K = ctx.K
    L, C, h = ctx.lch[:, 0], ctx.lch[:, 1], ctx.lch[:, 2]
    edges: List[Tuple[int, int, int]] = []

    for i in range(K):
        for j in range(i + 1, K):
            if not (usable[i] and usable[j]) or contact[i, j] < 2:
                continue
            if contact[i, j] < 0.04 * min(tot[i], tot[j]):
                continue
            dL = abs(L[i] - L[j])
            if not (0.015 <= dL <= max_step_dL):
                continue
            if max(C[i], C[j]) < 0.035:
                ok = True  # Ramp xám hoặc màu trung tính
            else:
                dh = abs((h[i] - h[j] + 180.0) % 360.0 - 180.0)
                ok = abs(C[i] - C[j]) <= 0.12 and (
                    dh <= max_step_hue or (min(C[i], C[j]) < 0.025 and abs(C[i] - C[j]) <= 0.06)
                )
            if ok:
                edges.append((int(contact[i, j]), i, j))

    # Ưu tiên gộp từ cặp tiếp xúc mạnh nhất trước (Greedy Kruskal theo trọng số kề)
    edges.sort(reverse=True, key=lambda x: x[0])
    return edges


def _merge_ramp_components(
    K: int,
    edges: List[Tuple[int, int, int]],
    C: np.ndarray,
    h: np.ndarray,
    usable: np.ndarray,
    max_steps: int,
    max_ramp_span: float,
) -> Dict[int, List[int]]:
    """
    Gộp các màu kề thành từng dải màu ramp theo thuật toán Union-Find (Kruskal có ràng buộc).

    @param K: Tổng số màu trong bảng màu.
    @param edges: Danh sách các cạnh kề tiềm năng đã sắp xếp.
    @param C: Mảng độ bão hòa màu (Chroma).
    @param h: Mảng góc sắc tướng (Hue).
    @param usable: Mảng boolean đánh dấu màu hợp lệ.
    @param max_steps: Số bậc màu tối đa trong một ramp.
    @param max_ramp_span: Tổng cung góc hue tối đa của một ramp có sắc độ.
    @returns: Dictionary ánh xạ chỉ số nhóm đại diện -> danh sách chỉ số màu thành viên.
    """
    parent = list(range(K))
    members: Dict[int, List[int]] = {i: [i] for i in range(K)}

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for _, i, j in edges:
        ri, rj = find(i), find(j)
        if ri == rj:
            continue
        comb = members[ri] + members[rj]
        if len(comb) > max_steps:
            continue
        comb_chroma = [m for m in comb if C[m] >= 0.035]
        if len(comb_chroma) >= 2:
            span = circular_hue_span(h[comb_chroma])
            if span > max_ramp_span:
                continue
        parent[rj] = ri
        members[ri] = comb
        del members[rj]

    groups: Dict[int, List[int]] = {}
    for i in range(K):
        if usable[i]:
            groups.setdefault(find(i), []).append(i)
    return groups


def _calculate_single_ramp_metrics(
    m_list: List[int],
    ctx: Ctx,
    L: np.ndarray,
    C: np.ndarray,
    h: np.ndarray,
    warm: np.ndarray,
) -> Dict[str, Any]:
    """
    Tính toán các chỉ số cho một dải màu đổ bóng (độ chênh sáng, hue shift, warmth shift).

    @param m_list: Danh sách chỉ số màu thuộc dải ramp.
    @param ctx: Ngữ cảnh pixel art chứa bảng màu và số lượng pixel.
    @param L: Mảng độ sáng Lightness.
    @param C: Mảng độ bão hòa Chroma.
    @param h: Mảng góc sắc tướng Hue.
    @param warm: Mảng giá trị độ ấm màu.
    @returns: Dict chứa thông tin bậc màu, mã hex, dải sáng, hue shift và warmth shift.
    """
    m = np.array(sorted(m_list, key=lambda i: L[i]))
    dL = float(L[m].max() - L[m].min())
    w = ctx.counts[m].astype(float)
    hue_total: Optional[float] = None
    warm_total: Optional[float] = None
    chroma_m = C[m] >= 0.03

    if chroma_m.sum() >= 2:
        dL_chroma = float(L[m][chroma_m].max() - L[m][chroma_m].min())
        if dL_chroma > 1e-4:
            ang = np.radians(h[m][chroma_m])
            ref = math.degrees(
                math.atan2((np.sin(ang) * w[chroma_m]).sum(), (np.cos(ang) * w[chroma_m]).sum())
            )
            dh = (h[m][chroma_m] - ref + 180.0) % 360.0 - 180.0
            if np.ptp(L[m][chroma_m]) > 1e-4:
                slope = np.polyfit(L[m][chroma_m], dh, 1, w=np.sqrt(w[chroma_m] * C[m][chroma_m]))[0]
                # Nhân với dL_chroma thực tế thay vì ngoại suy mù quáng qua toàn dải dL
                hue_total = float(slope * dL_chroma)

    if dL > 1e-4:
        warm_total = float(np.polyfit(L[m], warm[m], 1, w=np.sqrt(w))[0] * dL)

    return {
        "steps": int(len(m)),
        "pixels": int(w.sum()),
        "hex_dark_to_light": ["#%02x%02x%02x" % tuple(int(v) for v in ctx.rgb[i]) for i in m],
        "lightness_range": round(dL, 3),
        "hue_shift_deg_dark_to_light": None if hue_total is None else round(hue_total, 1),
        "warmth_shift_dark_to_light": None if warm_total is None else round(warm_total, 3),
    }


def _determine_hue_shift_direction(hue_abs: float, warm_mean: float) -> str:
    """
    Xác định hướng dịch chuyển sắc tướng / độ ấm tổng thể của toàn bộ các ramp.

    @param hue_abs: Độ dịch chuyển sắc tướng tuyệt đối trung bình (độ).
    @param warm_mean: Độ dịch chuyển ấm/lạnh trung bình có dấu.
    @returns: Chuỗi mô tả hướng dịch chuyển màu.
    """
    if hue_abs < 6.0 and abs(warm_mean) < 0.012:
        return "straight (no hue shift)"
    if warm_mean > 0.012:
        return "cool shadows -> warm highlights"
    if warm_mean < -0.012:
        return "warm shadows -> cool highlights"
    return "hue rotates without warm/cool bias"


def analyze_ramps(
    ctx: Ctx,
    is_outline: np.ndarray,
    warm_axis_deg: float = 65.0,
    max_step_dL: float = 0.25,
    max_step_hue: float = 45.0,
    max_ramp_span: float = 85.0,
    max_steps: int = 10,
) -> Dict[str, Any]:
    """
    Phân tích các dải màu đổ bóng (ramps) và quy luật dịch màu (hue-shifting) của sprite.

    Hai màu thuộc cùng một ramp (vật liệu) nếu: kề nhau thật sự trong ảnh (đủ tỷ lệ tiếp xúc),
    chênh sáng vừa phải (một bậc), và cùng vùng hue/chroma.
    Ràng buộc chặn bao đóng bắc cầu: tổng cung hue của các màu có sắc độ không vượt quá max_ramp_span
    và không vượt quá max_steps, ngăn chặn gom toàn bộ nhân vật thành một ramp khổng lồ.

    @param ctx: Ngữ cảnh pixel art chứa bảng màu và ma trận pixel.
    @param is_outline: Mảng boolean đánh dấu các màu thuộc viền ngoài.
    @param warm_axis_deg: Trục góc độ ấm màu (mặc định 65 độ theo chuẩn da/ánh sáng vàng).
    @param max_step_dL: Độ chênh sáng tối đa giữa 2 bậc kề nhau trong một ramp.
    @param max_step_hue: Độ lệch góc hue tối đa giữa 2 bậc kề nhau.
    @param max_ramp_span: Tổng cung góc hue tối đa cho toàn bộ một dải ramp.
    @param max_steps: Số bậc tối đa được gom vào một ramp.
    @returns: Dict chứa thống kê dải bóng, số ramp, hướng hue shift và danh sách chi tiết các ramp.
    """
    K = ctx.K
    contact = _contact_matrix(ctx)
    tot = contact.sum(axis=1)
    L, C, h = ctx.lch[:, 0], ctx.lch[:, 1], ctx.lch[:, 2]
    usable = (~is_outline) & (ctx.counts >= 2)

    # 1. Thu thập các cặp màu kề nhau có khả năng thuộc cùng dải chuyển tiếp bóng
    edges = _collect_ramp_candidate_edges(ctx, contact, tot, usable, max_step_dL, max_step_hue)

    # 2. Gộp các thành phần theo thuật toán Kruskal với Union-Find
    groups = _merge_ramp_components(K, edges, C, h, usable, max_steps, max_ramp_span)

    # 3. Tính toán độ ấm và số liệu cho từng ramp
    wa = math.radians(warm_axis_deg)
    warm = ctx.lab[:, 1] * math.cos(wa) + ctx.lab[:, 2] * math.sin(wa)
    ramps: List[Dict[str, Any]] = []
    isolated = 0

    for m_list in groups.values():
        if len(m_list) < 2:
            isolated += 1
            continue
        ramps.append(_calculate_single_ramp_metrics(m_list, ctx, L, C, h, warm))

    ramps.sort(key=lambda r: -r["pixels"])
    tw = sum(r["pixels"] for r in ramps) or 1
    steps_w = sum(r["steps"] * r["pixels"] for r in ramps) / tw if ramps else 0.0

    # 4. Thống kê tổng hợp hướng dịch chuyển sắc tướng
    hs = [
        (r["hue_shift_deg_dark_to_light"], r["pixels"])
        for r in ramps
        if r["hue_shift_deg_dark_to_light"] is not None
    ]
    ws = [
        (r["warmth_shift_dark_to_light"], r["pixels"])
        for r in ramps
        if r["warmth_shift_dark_to_light"] is not None
    ]

    hue_mean = sum(a * b for a, b in hs) / sum(b for _, b in hs) if hs else 0.0
    hue_abs = sum(abs(a) * b for a, b in hs) / sum(b for _, b in hs) if hs else 0.0
    warm_mean = sum(a * b for a, b in ws) / sum(b for _, b in ws) if ws else 0.0
    direction = _determine_hue_shift_direction(hue_abs, warm_mean)

    return {
        "n_ramps": len(ramps),
        "isolated_colors": isolated,
        "steps_per_ramp_weighted": round(steps_w, 2),
        "steps_per_ramp_max": max((r["steps"] for r in ramps), default=0),
        "hue_shift_deg_mean_signed": round(hue_mean, 1),
        "hue_shift_deg_mean_abs": round(hue_abs, 1),
        "warmth_shift_mean": round(warm_mean, 3),
        "hue_shift_direction": direction,
        "ramps": ramps,
    }


# =============================================================================
# 6. CỤM PIXEL VÀ MẬT ĐỘ CHI TIẾT
# =============================================================================
def analyze_clusters(ctx: Ctx) -> Dict[str, Any]:
    idx, vis, K = ctx.idx, ctx.vis, ctx.K
    lab_g = np.zeros(idx.shape, dtype=np.int64)
    off = 0
    for c in range(K):
        l, n = ndi.label(idx == c)          # Liên thông theo bốn hướng mặc định
        if n:
            m = l > 0
            lab_g[m] = l[m] + off
            off += n
    sizes = np.bincount(lab_g.ravel(), minlength=off + 1)[1:]
    pad = np.pad(lab_g, 1)
    per = np.zeros(off + 1)
    core = pad[1:-1, 1:-1]
    for nb in (pad[:-2, 1:-1], pad[2:, 1:-1], pad[1:-1, :-2], pad[1:-1, 2:]):
        d = core != nb
        per += np.bincount(core[d], minlength=off + 1)
    perim_ratio = per[1:] / (4.0 * np.sqrt(sizes))      # hình vuông = 1.0, càng cao càng "rách"
    vis_px = int(vis.sum())

    same = np.zeros(idx.shape, dtype=int)
    for dy, dx in DIRS4:
        same += (_shift(idx, dy, dx, -2) == idx)
    orphan_px = int(((same == 0) & vis).sum())
    stub_px = int(((same == 1) & vis).sum())
    return {
        "n_clusters": int(off),
        "clusters_per_100px": round(100.0 * off / max(vis_px, 1), 2),
        "orphan_cluster_ratio": round(float((sizes == 1).mean()), 3),
        "orphan_pixel_ratio": round(orphan_px / max(vis_px, 1), 4),
        "stub_pixel_ratio": round(stub_px / max(vis_px, 1), 4),
        "small_cluster_ratio_le3": round(float((sizes <= 3).mean()), 3),
        "median_size": float(np.median(sizes)),
        "mean_size": round(float(sizes.mean()), 2),
        "p90_size": float(np.percentile(sizes, 90)),
        "perimeter_ratio_weighted": round(float((perim_ratio * sizes).sum() / sizes.sum()), 3),
    }


def analyze_detail(ctx: Ctx) -> Dict[str, Any]:
    idx, vis, K = ctx.idx, ctx.vis, ctx.K
    pairs = diff = 0
    for a, b in ((idx[:, :-1], idx[:, 1:]), (idx[:-1, :], idx[1:, :])):
        m = (a >= 0) & (b >= 0)
        pairs += int(m.sum())
        diff += int((m & (a != b)).sum())
    edge_px = np.zeros(idx.shape, dtype=bool)
    for dy, dx in DIRS4:
        nb = _shift(idx, dy, dx, -1)
        edge_px |= (nb >= 0) & (nb != idx)
    edge_px &= vis
    ys, xs = np.nonzero(vis)
    bh, bw = int(ys.max() - ys.min() + 1), int(xs.max() - xs.min() + 1)
    ent = _entropy(ctx.counts)
    return {
        "sprite_bbox_wh": [bw, bh],
        "fill_ratio": round(float(vis.sum()) / (bw * bh), 3),
        "color_entropy_bits": round(ent, 3),
        "color_entropy_norm": round(ent / math.log2(K), 3) if K > 1 else 0.0,
        "transition_rate": round(diff / max(pairs, 1), 4),
        "edge_pixel_fraction": round(float(edge_px.sum()) / max(int(vis.sum()), 1), 3),
    }


# =============================================================================
# 7. API CHÍNH
# =============================================================================
def analyze_sprite(image: Image.Image, force_scale: Optional[float] = None,
                   merge_de: float = 0.025) -> Dict[str, Any]:
    rgba = _auto_alpha(np.array(image.convert("RGBA")))
    if force_scale is not None:
        grid = GridResult(float(force_scale), 0.0, 0.0, 1.0, 1.0) if force_scale > 1 else GridResult(1.0, 0, 0, 1.0, 1.0)
    else:
        grid = detect_pixel_grid(rgba)
    native = restore_native(rgba, grid)
    if not (native[..., 3] >= ALPHA_VISIBLE).any():
        return {"error": "no visible pixels"}
    ctx = quantize_palette(native, merge_de)
    outline, is_out = analyze_outline(ctx)
    a = native[..., 3]
    non_bg = a > 10
    semi_ratio = float(((a > 10) & (a < 250)).sum() / max(int(non_bg.sum()), 1))

    # Đo số màu thô ban đầu (kể cả nhiễu do AI sinh ra) theo thuật toán quét điểm ảnh của LibreSprite
    raw_vis = rgba[..., 3] > 10
    raw_pixels = rgba[..., :3][raw_vis]
    raw_unique_count = int(len(np.unique(raw_pixels, axis=0))) if len(raw_pixels) > 0 else 0
    clean_count = int(ctx.K)
    ai_intermediate = max(0, raw_unique_count - clean_count)
    has_noise = bool((raw_unique_count > clean_count * 1.25) and (ai_intermediate >= 4))
    noise_ratio = round(ai_intermediate / max(raw_unique_count, 1), 3)

    pal_report = analyze_palette(ctx)
    pal_report["raw_colors_count"] = raw_unique_count
    pal_report["clean_colors_count"] = clean_count
    pal_report["ai_intermediate_colors"] = ai_intermediate
    pal_report["has_ai_noise_warning"] = has_noise
    pal_report["noise_ratio"] = noise_ratio

    return {
        "grid": {"pixel_size": grid.period, "phase_xy": [grid.phase_x, grid.phase_y],
                 "confidence": round(grid.confidence, 3), "on_grid_fraction": round(grid.on_grid_fraction, 3),
                 "native_size_wh": [native.shape[1], native.shape[0]]},
        "semi_transparent_ratio": round(semi_ratio, 4),
        "palette": pal_report,
        "outline": outline,
        "shading": analyze_ramps(ctx, is_out),
        "clusters": analyze_clusters(ctx),
        "detail": analyze_detail(ctx),
    }


# =============================================================================
# 8. FINGERPRINT & SO SÁNH PHONG CÁCH
# =============================================================================
# (key, hàm trích, dung sai, kiểu: "rel" tương đối | "abs" tuyệt đối)
_FP = [
    ("sprite_height_px", lambda r: r["detail"]["sprite_bbox_wh"][1], 0.20, "rel"),
    ("total_colors", lambda r: r["palette"]["total_colors"], 0.35, "rel"),
    ("mean_chroma", lambda r: r["palette"]["mean_chroma"], 0.25, "rel"),
    ("contrast_ratio", lambda r: r["palette"]["contrast_ratio_wcag"], 0.35, "rel"),
    ("steps_per_ramp", lambda r: r["shading"]["steps_per_ramp_weighted"], 0.8, "abs"),
    ("hue_shift_abs_deg", lambda r: r["shading"]["hue_shift_deg_mean_abs"], 10.0, "abs"),
    ("warmth_shift", lambda r: r["shading"]["warmth_shift_mean"], 0.03, "abs"),
    ("outline_thickness", lambda r: r["outline"]["thickness_px"], 0.5, "abs"),
    ("outline_coverage", lambda r: r["outline"]["coverage"], 0.2, "abs"),
    ("orphan_pixel_ratio", lambda r: r["clusters"]["orphan_pixel_ratio"], 0.03, "abs"),
    ("median_cluster_size", lambda r: r["clusters"]["median_size"], 0.5, "rel"),
    ("perimeter_ratio", lambda r: r["clusters"]["perimeter_ratio_weighted"], 0.25, "rel"),
    ("transition_rate", lambda r: r["detail"]["transition_rate"], 0.25, "rel"),
    ("color_entropy_norm", lambda r: r["detail"]["color_entropy_norm"], 0.2, "abs"),
]


def fingerprint(report: Dict[str, Any]) -> Dict[str, float]:
    return {k: float(f(report)) for k, f, _, _ in _FP}


def compare_styles(ref: Dict[str, Any], cand: Dict[str, Any]) -> Dict[str, Any]:
    """So khớp phong cách. 'ok' = trong dung sai. Dùng làm cổng kiểm tra sau khi AI sinh ảnh."""
    rows = []
    for key, f, tol, kind in _FP:
        a, b = float(f(ref)), float(f(cand))
        delta = abs(a - b) / max(abs(a), 1e-9) if kind == "rel" else abs(a - b)
        rows.append({"metric": key, "ref": round(a, 4), "cand": round(b, 4),
                     "delta": round(delta, 4), "tolerance": tol, "ok": bool(delta <= tol)})
    same_outline = ref["outline"]["style"] == cand["outline"]["style"]
    score = (sum(r["ok"] for r in rows) + same_outline) / (len(rows) + 1)
    return {"match_score": round(score, 3), "outline_style_match": same_outline, "details": rows}
