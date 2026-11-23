from __future__ import annotations

# 1. THƯ VIỆN NỀN TẢNG PYTHON (Toán và cấu trúc dữ liệu)
import math
from typing import Any, Dict, List, Optional, Tuple

# 2. THƯ VIỆN BÊN NGOÀI (Ma trận và vùng liên thông)
import numpy as np

# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Dữ liệu đo dùng chung)
from backend.core.metrics.metric_primitives import circular_hue_span, Ctx

# 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
# Không áp dụng cho thuật toán đo ảnh.

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


