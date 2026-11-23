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
# Các giai đoạn đo được tái xuất để giữ tương thích API import hiện có.
from backend.core.metrics.metric_primitives import (
    ALPHA_VISIBLE,
    DIRS4,
    _srgb_to_linear,
    srgb_to_oklab,
    oklab_to_lch,
    oklab_to_srgb,
    circular_hue_span,
    relative_luminance,
    _entropy,
    _weighted_quantile,
    _shift,
    _erode4,
    Ctx,
)
from backend.core.metrics.pixel_grid import (
    GridResult,
    _edge_profiles,
    _best_phase,
    detect_pixel_grid,
    restore_native,
)
from backend.core.metrics.palette_metrics import (
    quantize_palette,
    analyze_palette,
)
from backend.core.metrics.outline_metrics import (
    _detect_outline_candidates,
    _classify_outline_style,
    _measure_outline_thickness_raywalk,
    analyze_outline,
)
from backend.core.metrics.ramp_metrics import (
    _contact_matrix,
    _collect_ramp_candidate_edges,
    _merge_ramp_components,
    _calculate_single_ramp_metrics,
    _determine_hue_shift_direction,
    analyze_ramps,
)


# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC
# ========================================================
# Không áp dụng cho backend.


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
