from __future__ import annotations

# 1. THƯ VIỆN NỀN TẢNG PYTHON (Toán và cấu trúc dữ liệu)
import math
from dataclasses import dataclass
from typing import Optional, Tuple

# 2. THƯ VIỆN BÊN NGOÀI (Ma trận và vùng liên thông)
import numpy as np

# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Dữ liệu đo dùng chung)
from backend.core.metrics.metric_primitives import ALPHA_VISIBLE

# 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
# Không áp dụng cho thuật toán đo ảnh.

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


