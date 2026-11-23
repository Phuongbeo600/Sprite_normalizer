from __future__ import annotations

# 1. THƯ VIỆN NỀN TẢNG PYTHON (Toán và cấu trúc dữ liệu)
import math
from typing import Any, Dict, List

# 2. THƯ VIỆN BÊN NGOÀI (Ma trận và vùng liên thông)
import numpy as np

# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Dữ liệu đo dùng chung)
from backend.core.metrics.metric_primitives import (
    ALPHA_VISIBLE,
    srgb_to_oklab,
    oklab_to_lch,
    oklab_to_srgb,
    relative_luminance,
    _weighted_quantile,
    Ctx,
)

# 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
# Không áp dụng cho thuật toán đo ảnh.

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


