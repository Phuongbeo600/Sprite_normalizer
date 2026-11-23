from __future__ import annotations

# 1. THƯ VIỆN NỀN TẢNG PYTHON (Toán và cấu trúc dữ liệu)
from typing import Any, Dict, List, Optional, Tuple

# 2. THƯ VIỆN BÊN NGOÀI (Ma trận và vùng liên thông)
import numpy as np

# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Dữ liệu đo dùng chung)
from backend.core.metrics.metric_primitives import DIRS4, _entropy, _shift, _erode4, Ctx

# 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
# Không áp dụng cho thuật toán đo ảnh.

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


