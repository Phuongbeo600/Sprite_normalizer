# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểu dữ liệu)
# ========================================================
# typing: Khai báo kiểu cho mảng màu nền tùy chọn.
from typing import Optional, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# numpy: Tính toán khoảng cách màu, độ bão hòa và ma trận lân cận 8 hướng.
import numpy as np
# scipy.ndimage: Giãn nở biên, gán nhãn 8-liên thông và tính khoảng cách Euclidean.
from scipy import ndimage as ndi

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Không sử dụng)
# ========================================================

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & CẤU HÌNH (Không áp dụng)
# ========================================================

_STRUCT_8 = np.ones((3, 3), dtype=bool)
_STRUCT_8_INT = np.ones((3, 3), dtype=int)


def _neighbor_stats(
    rgb: np.ndarray,
    opaque: np.ndarray,
    dist_bg: np.ndarray,
    same_color_tol: float = 22.0,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Tính số hàng xóm cùng màu, số hàng xóm trong suốt và khoảng cách nền lớn nhất quanh mỗi pixel."""
    h, w = opaque.shape
    pad_rgb = np.pad(rgb, ((1, 1), (1, 1), (0, 0)), mode="edge")
    pad_op = np.pad(opaque, ((1, 1), (1, 1)), mode="constant", constant_values=False)
    pad_dist = np.pad(dist_bg, ((1, 1), (1, 1)), mode="constant", constant_values=0.0)

    same_count = np.zeros((h, w), dtype=np.int16)
    trans_count = np.zeros((h, w), dtype=np.int16)
    max_nb_dist = np.zeros((h, w), dtype=np.float32)

    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            ys = slice(1 + dy, 1 + dy + h)
            xs = slice(1 + dx, 1 + dx + w)
            nb_op = pad_op[ys, xs]
            trans_count += (~nb_op).astype(np.int16)
            nb_rgb = pad_rgb[ys, xs]
            same_color = nb_op & (np.linalg.norm(nb_rgb - rgb, axis=2) <= same_color_tol)
            same_count += same_color.astype(np.int16)
            nb_dist = np.where(nb_op, pad_dist[ys, xs], 0.0)
            max_nb_dist = np.maximum(max_nb_dist, nb_dist)

    return same_count, trans_count, max_nb_dist


def defringe_edge_halo(
    arr: np.ndarray,
    bg_colors: Tuple[np.ndarray, ...],
    base_tolerance: float,
    passes: int = 2,
) -> None:
    """
    Khử dải viền chuyển sắc (halo xám-trắng hoặc alpha mờ) bám sát mép ngoài nhân vật sau tách nền.
    Chỉ xử lý khi nền là tông sáng trung tính và bảo vệ các mảng trắng/bạc dày >= 2px của nhân vật.

    @param {np.ndarray} arr Mảng RGBA uint8 (H, W, 4) được chỉnh sửa trực tiếp.
    @param {Tuple[np.ndarray, ...]} bg_colors Danh sách màu nền đặc trưng của ảnh.
    @param {float} base_tolerance Ngưỡng sai số màu gốc đã dùng để tách nền.
    @param {int} passes Số lượt quét bóc lớp halo mảnh 1-2px ngoài cùng.
    """
    if not bg_colors or arr.shape[0] < 4 or arr.shape[1] < 4:
        return

    bg_lumas = [float(np.mean(c)) for c in bg_colors]
    bg_chromas = [float(np.max(c) - np.min(c)) for c in bg_colors]
    # Chỉ kích hoạt trên nền sáng trung tính (trắng / ô cờ xám nhạt) để tránh ăn vào điểm sáng trên nền tối
    if min(bg_lumas) < 180.0 or max(bg_chromas) > 36.0:
        return

    rgb = arr[:, :, :3].astype(np.float32)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    luma = rgb.mean(axis=2)
    dist_bg = np.min([np.linalg.norm(rgb - c, axis=2) for c in bg_colors], axis=0)
    max_halo_dist = min(110.0, base_tolerance + 60.0)

    for _ in range(max(1, passes)):
        alpha = arr[:, :, 3]
        opaque = alpha > 0
        if not np.any(opaque):
            return
        touches_trans = ndi.binary_dilation(~opaque, structure=_STRUCT_8) & opaque
        if not np.any(touches_trans):
            return

        same_count, trans_count, max_nb_dist = _neighbor_stats(rgb, opaque, dist_bg)
        # 1) Dải bán trong suốt quá mờ sát mép (anti-aliasing yếu)
        weak_alpha_edge = touches_trans & (alpha < 96)
        # 2) Viền xám/trắng nhạt mảnh nằm kẹp giữa nền trong suốt và đường viền đậm bên trong
        halo_bridge = (
            touches_trans
            & (chroma <= 34.0)
            & (luma >= 155.0)
            & (dist_bg <= max_halo_dist)
            & (same_count <= 2)
            & (trans_count >= 2)
            & (max_nb_dist >= dist_bg + 32.0)
        )
        remove_mask = weak_alpha_edge | halo_bridge
        if not np.any(remove_mask):
            return
        arr[remove_mask, 3] = 0


def remove_orphan_specks(
    arr: np.ndarray,
    bg_colors: Optional[Tuple[np.ndarray, ...]] = None,
) -> None:
    """
    Loại bỏ các chấm rác li ti cô lập tách rời khỏi khối nhân vật chính trên từng frame.
    Dùng liên thông 8 hướng để giữ nguyên đường kiếm/giáo/tóc mảnh nét chéo nối với nhân vật.

    @param {np.ndarray} arr Mảng RGBA uint8 (H, W, 4) của 1 frame được chỉnh sửa trực tiếp.
    @param {Optional[Tuple[np.ndarray, ...]]} bg_colors Màu nền để nhận diện thêm hạt bụi sáng gần thân.
    """
    h, w = arr.shape[:2]
    if h < 16 or w < 16:
        return

    opaque = arr[:, :, 3] > 0
    labeled, num_features = ndi.label(opaque, structure=_STRUCT_8_INT)
    if num_features <= 1:
        return

    areas = np.bincount(labeled.ravel())
    areas[0] = 0
    main_label = int(np.argmax(areas))
    main_area = int(areas[main_label])
    if main_area < 25:
        return

    max_speck_area = min(28, max(2, int(main_area * 0.008)))
    dist_to_main = ndi.distance_transform_edt(labeled != main_label)
    slices = ndi.find_objects(labeled)

    has_bright_bg = bool(
        bg_colors and min(float(np.mean(c)) for c in bg_colors) >= 180.0
    )

    for comp_id in range(1, num_features + 1):
        if comp_id == main_label:
            continue
        area = int(areas[comp_id])
        if area > max_speck_area:
            continue
        sl = slices[comp_id - 1]
        if sl is None:
            continue

        comp_mask = labeled[sl] == comp_id
        min_dist = float(dist_to_main[sl][comp_mask].min())
        if min_dist >= 3.5:
            arr[sl][comp_mask, 3] = 0
            continue

        if has_bright_bg and min_dist >= 1.5 and area <= 8:
            sub_rgb = arr[sl][comp_mask, :3].astype(np.float32)
            avg_chroma = float(np.mean(sub_rgb.max(axis=1) - sub_rgb.min(axis=1)))
            avg_luma = float(np.mean(sub_rgb))
            if avg_chroma <= 36.0 and avg_luma >= 150.0:
                arr[sl][comp_mask, 3] = 0
