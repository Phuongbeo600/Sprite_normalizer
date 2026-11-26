# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Kiểu)
# ========================================================
# dataclass: Lưu đặc tả màu nền đã phân tích để tái sử dụng cho từng frame
from dataclasses import dataclass
# typing: Khai báo kiểu trả về Tuple và giá trị tùy chọn
from typing import Optional, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# numpy: Thao tác ma trận kênh pixel RGBA để tách nền nhanh chóng
import numpy as np
# PIL (Pillow): Mở và chuyển đổi chế độ màu của hình ảnh
from PIL import Image
# scipy.ndimage: Gán nhãn các vùng liên thông (Connected Components) phục vụ flood-fill từ biên
from scipy import ndimage as ndi

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# defringe_edge_halo, remove_orphan_specks: Khử viền mờ xám-trắng bám mép và dọn chấm rác rời trên frame
from backend.core.processing.mask_cleanup import defringe_edge_halo, remove_orphan_specks

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


@dataclass(frozen=True)
class BackgroundSpec:
    """Đặc tả nền giả (đơn sắc hoặc ô cờ 2 màu) đã được kiểm định độ tin cậy."""

    kind: str
    colors: Tuple[np.ndarray, ...]
    tolerance: float = 28.0


def _collect_border_ring(rgba: np.ndarray) -> Tuple[np.ndarray, Tuple[np.ndarray, ...]]:
    """Trích xuất toàn bộ dải pixel viền ngoài cùng và từng cạnh (trên, dưới, trái, phải)."""
    h, w = rgba.shape[:2]
    depth = max(1, min(4, min(h, w) // 32))
    top = rgba[:depth, :, :].reshape(-1, 4)
    bottom = rgba[h - depth :, :, :].reshape(-1, 4)
    left = rgba[:, :depth, :].reshape(-1, 4)
    right = rgba[:, w - depth :, :].reshape(-1, 4)
    combined = np.concatenate([top, bottom, left, right], axis=0)
    return combined, (top[:, :3], bottom[:, :3], left[:, :3], right[:, :3])


def _dominant_color_near(
    pixels_rgb: np.ndarray,
    bin_size: int = 8,
    cluster_radius: float = 24.0,
) -> np.ndarray:
    """Tìm màu đại diện (median RGB) của cụm màu xuất hiện nhiều nhất trong tập pixel."""
    quantized = (pixels_rgb // bin_size) * bin_size
    bins, counts = np.unique(quantized, axis=0, return_counts=True)
    best_bin = bins[int(np.argmax(counts))].astype(np.float32) + (bin_size / 2.0)
    dist = np.linalg.norm(pixels_rgb.astype(np.float32) - best_bin, axis=1)
    cluster = pixels_rgb[dist <= cluster_radius]
    if len(cluster) == 0:
        return best_bin
    return np.median(cluster, axis=0).astype(np.float32)


def _count_side_coverage(sides: Tuple[np.ndarray, ...], color: np.ndarray, tol: float) -> int:
    """Đếm số cạnh (trong 4 cạnh ảnh) có ít nhất 20% pixel khớp màu ứng viên."""
    covered = 0
    for side in sides:
        if len(side) == 0:
            continue
        ratio = float((np.linalg.norm(side.astype(np.float32) - color, axis=1) <= tol).mean())
        if ratio >= 0.20:
            covered += 1
    return covered


def _count_strip_alternations(strip_rgb: np.ndarray, c1: np.ndarray, c2: np.ndarray, tol: float) -> int:
    """Đếm số lần đổi màu giữa 2 tông ô cờ trên một dải 1px dọc cạnh ảnh."""
    f_strip = strip_rgb.astype(np.float32)
    d1 = np.linalg.norm(f_strip - c1, axis=1)
    d2 = np.linalg.norm(f_strip - c2, axis=1)
    # Gán mỗi pixel về màu gần hơn trong cặp (c1, c2) nếu nằm trong ngưỡng tol
    labels = np.where((d1 <= tol) & (d1 <= d2), 1, np.where(d2 <= tol, 2, 0))
    valid = labels[labels > 0]
    if len(valid) < 2:
        return 0
    return int(np.sum(valid[1:] != valid[:-1]))


def _has_checkerboard_alternation(
    rgba: np.ndarray,
    c1: np.ndarray,
    c2: np.ndarray,
    tol: float,
) -> bool:
    """Kiểm tra hai màu ứng viên có luân phiên dọc các dải viền ngoài kiểu ô cờ hay không."""
    h, w = rgba.shape[:2]
    depth = max(1, min(4, min(h, w) // 32))
    # Quét cả lớp ngoài cùng lẫn lớp lùi nhẹ vào trong để không bị lỡ khi mép 0 có 1px viền trắng
    row_indices = sorted({0, min(depth - 1, h - 1), max(0, h - depth), h - 1})
    col_indices = sorted({0, min(depth - 1, w - 1), max(0, w - depth), w - 1})
    top_best = max(_count_strip_alternations(rgba[idx, :, :3], c1, c2, tol) for idx in row_indices if idx < depth)
    bottom_best = max(_count_strip_alternations(rgba[idx, :, :3], c1, c2, tol) for idx in row_indices if idx >= h - depth)
    left_best = max(_count_strip_alternations(rgba[:, idx, :3], c1, c2, tol) for idx in col_indices if idx < depth)
    right_best = max(_count_strip_alternations(rgba[:, idx, :3], c1, c2, tol) for idx in col_indices if idx >= w - depth)
    return (top_best + bottom_best + left_best + right_best) >= 6


def _is_checkerboard_pocket(
    patch_rgb: np.ndarray,
    comp_mask: np.ndarray,
    c1: np.ndarray,
    c2: np.ndarray,
    tol: float,
) -> bool:
    """Xác minh một vùng kín bên trong nhân vật thực sự là nền ô cờ 2 màu chứ không phải chi tiết 1 màu."""
    area = int(comp_mask.sum())
    if area < 6:
        return False

    sub_rgb = patch_rgb[comp_mask].astype(np.float32)
    d1 = np.linalg.norm(sub_rgb - c1, axis=1)
    d2 = np.linalg.norm(sub_rgb - c2, axis=1)
    count_c1 = int(np.sum((d1 <= tol) & (d1 <= d2)))
    count_c2 = int(np.sum((d2 <= tol) & (d2 < d1)))

    # Phải có mặt đủ cả hai tông màu ô cờ với tỷ lệ đáng kể để không xóa nhầm mắt/áo trắng
    min_each = max(2, int(area * 0.12))
    if count_c1 < min_each or count_c2 < min_each:
        return False

    # Kiểm tra có sự chuyển đổi qua lại giữa 2 màu trong vùng khép kín
    full_f = patch_rgb.astype(np.float32)
    fd1 = np.linalg.norm(full_f - c1, axis=2)
    fd2 = np.linalg.norm(full_f - c2, axis=2)
    lbl = np.where(comp_mask & (fd1 <= tol) & (fd1 <= fd2), 1, np.where(comp_mask & (fd2 <= tol), 2, 0))
    horiz_transitions = int(np.sum((lbl[:, 1:] > 0) & (lbl[:, :-1] > 0) & (lbl[:, 1:] != lbl[:, :-1])))
    vert_transitions = int(np.sum((lbl[1:, :] > 0) & (lbl[:-1, :] > 0) & (lbl[1:, :] != lbl[:-1, :])))
    return (horiz_transitions + vert_transitions) >= 2


class BackgroundMaskExtractor:
    """
    Bộ bóc tách mặt nạ điểm ảnh (Alpha Mask Extractor).
    - Tự động phát hiện ảnh có kênh Alpha trong suốt hay ảnh nền đặc / nền ô cờ giả (do AI sinh ra).
    - Hỗ trợ phân tích quy luật phân bố màu ở biên, flood-fill từ mép ngoài và đục sạch hốc ô cờ kín (kẽ chân, khe tay).
    """

    @staticmethod
    def _detect_checkerboard_spec(
        rgba: np.ndarray,
        opaque_rgb: np.ndarray,
        sides: Tuple[np.ndarray, ...],
    ) -> Optional[BackgroundSpec]:
        """Nhận diện nền ô cờ 2 màu trung tính (kể cả ô cờ trắng-xám rất nhạt hoặc hơi nhiễu JPEG)."""
        # Dùng cụm nhỏ để hai màu trắng-xám nhạt không bị gộp nhầm thành 1 màu trung bình
        c1 = _dominant_color_near(opaque_rgb, bin_size=4, cluster_radius=12.0)
        strict_tol = 12.0
        rem_rgb = opaque_rgb[np.linalg.norm(opaque_rgb.astype(np.float32) - c1, axis=1) > strict_tol]
        if len(rem_rgb) == 0:
            return None

        c2 = _dominant_color_near(rem_rgb, bin_size=4, cluster_radius=12.0)
        pair_dist = float(np.linalg.norm(c1 - c2))
        chroma1 = float(np.max(c1) - np.min(c1))
        chroma2 = float(np.max(c2) - np.min(c2))
        if chroma1 > 36.0 or chroma2 > 36.0 or not (6.0 <= pair_dist <= 145.0):
            return None

        f_opaque = opaque_rgb.astype(np.float32)
        d1 = np.linalg.norm(f_opaque - c1, axis=1)
        d2 = np.linalg.norm(f_opaque - c2, axis=1)
        # Chọn dung sai đủ bao phủ nhiễu nén trên ô cờ nhưng không nuốt nhầm chi tiết nhân vật
        tol = min(28.0, max(18.0, pair_dist * 0.48 + 8.0))
        assign1 = (d1 <= tol) & (d1 <= d2)
        assign2 = (d2 <= tol) & (d2 < d1)
        ratio1 = float(assign1.mean())
        ratio2 = float(assign2.mean())
        combined_ratio = float((assign1 | assign2).mean())

        if combined_ratio < 0.78 or ratio1 < 0.18 or ratio2 < 0.18:
            return None
        if _count_side_coverage(sides, c1, tol) < 3 or _count_side_coverage(sides, c2, tol) < 3:
            return None
        if not _has_checkerboard_alternation(rgba, c1, c2, tol):
            return None

        return BackgroundSpec(kind="checkerboard", colors=(c1, c2), tolerance=tol)

    @staticmethod
    def analyze_background(image: Image.Image) -> Optional[BackgroundSpec]:
        """
        Phân tích dải viền ngoài cùng của ảnh (sheet hoặc sprite) để nhận diện nền giả đáng tin cậy.
        Trả về None nếu ảnh đã trong suốt thật hoặc không đủ độ tin cậy để tách nền an toàn.

        @param {Image.Image} image Ảnh RGBA/RGB đầu vào (nên ở độ phân giải pixel thực).
        @returns {Optional[BackgroundSpec]} Đặc tả nền đơn sắc / ô cờ, hoặc None nếu cần giữ nguyên ảnh.
        """
        rgba = np.asarray(image.convert("RGBA"))
        h, w = rgba.shape[:2]
        if h < 4 or w < 4:
            return None

        border, sides = _collect_border_ring(rgba)
        opaque_mask = border[:, 3] >= 240
        # Nếu phần lớn viền ngoài đã trong suốt thật -> giữ nguyên, tránh xử lý thừa
        if float((~opaque_mask).mean()) >= 0.50:
            return None

        opaque_rgb = border[opaque_mask, :3]
        if len(opaque_rgb) < 8:
            return None

        # Ưu tiên bắt chính xác nền ô cờ 2 màu trước để giữ lại thông tin tách hốc kín (kẽ chân, khe vũ khí)
        checker_spec = BackgroundMaskExtractor._detect_checkerboard_spec(rgba, opaque_rgb, sides)
        if checker_spec is not None:
            return checker_spec

        # Trường hợp nền đơn sắc bao phủ áp đảo viền ngoài và xuất hiện ít nhất trên 3 cạnh
        tol = 28.0
        c1 = _dominant_color_near(opaque_rgb)
        match1 = np.linalg.norm(opaque_rgb.astype(np.float32) - c1, axis=1) <= tol
        ratio1 = float(match1.mean())
        if ratio1 >= 0.82 and _count_side_coverage(sides, c1, tol) >= 3:
            return BackgroundSpec(kind="solid", colors=(c1,), tolerance=tol)

        return None

    @staticmethod
    def remove_background_with_spec(
        image: Image.Image,
        spec: Optional[BackgroundSpec],
        clean_specks: bool = False,
    ) -> Image.Image:
        """
        Tách vùng nền nối với 4 cạnh ngoài (và các hốc ô cờ kín bên trong nếu nền là checkerboard) thành alpha = 0,
        kèm khử viền halo chuyển sắc bám mép và lọc bỏ chấm rác cô lập (khi `clean_specks=True`).

        @param {Image.Image} image Ảnh frame hoặc sprite cần tách nền.
        @param {Optional[BackgroundSpec]} spec Đặc tả nền từ analyze_background (None sẽ giữ nguyên ảnh).
        @param {bool} clean_specks Bật dọn chấm rác li ti cô lập ngoài khối nhân vật chính trên từng frame.
        @returns {Image.Image} Ảnh RGBA mới với nền ngoài có alpha = 0 (hoặc bản sao giữ nguyên nếu bỏ qua).
        """
        if spec is None:
            return image

        rgba_img = image.convert("RGBA")
        arr = np.array(rgba_img, copy=True)
        h, w = arr.shape[:2]
        if h == 0 or w == 0:
            return rgba_img

        rgb = arr[:, :, :3].astype(np.float32)
        # Pixel đã trong suốt sẵn hoặc khớp 1 trong các màu nền đều là ứng viên flood-fill
        cand = arr[:, :, 3] < 20
        for color in spec.colors:
            cand |= np.linalg.norm(rgb - color, axis=2) <= spec.tolerance

        if not np.any(cand):
            return rgba_img

        # Liên thông 4 hướng mặc định: giữ đường viền 1px kín che chắn chi tiết bên trong nhân vật
        labeled, num_features = ndi.label(cand)
        edge_labels = np.unique(
            np.concatenate([labeled[0], labeled[-1], labeled[:, 0], labeled[:, -1]])
        )
        valid_edge = edge_labels[edge_labels > 0]
        remove_labels = set(int(lbl) for lbl in valid_edge)

        # Với nền ô cờ 2 màu, kiểm tra các hốc khép kín bên trong (kẽ giữa 2 chân, khe tay cầm vũ khí/khiên)
        if spec.kind == "checkerboard" and len(spec.colors) == 2 and num_features > len(remove_labels):
            c1, c2 = spec.colors
            slices = ndi.find_objects(labeled)
            for label_id in range(1, num_features + 1):
                if label_id in remove_labels:
                    continue
                sl = slices[label_id - 1]
                if sl is None:
                    continue
                comp_mask = labeled[sl] == label_id
                if _is_checkerboard_pocket(arr[sl][:, :, :3], comp_mask, c1, c2, spec.tolerance):
                    remove_labels.add(label_id)

        if not remove_labels:
            return rgba_img

        bg_mask = np.isin(labeled, list(remove_labels))
        arr[bg_mask, 3] = 0
        # Khử dải halo xám-trắng mảnh bám sát mép ngoài nhân vật sau tách nền
        defringe_edge_halo(arr, spec.colors, spec.tolerance)
        if clean_specks:
            remove_orphan_specks(arr, spec.colors)
        return Image.fromarray(arr, "RGBA")

    @staticmethod
    def clean_frame_specks(image: Image.Image) -> Image.Image:
        """Dọn các chấm rác li ti cô lập trên một frame đã có sẵn kênh Alpha trong suốt."""
        rgba_img = image.convert("RGBA")
        arr = np.array(rgba_img, copy=True)
        remove_orphan_specks(arr, bg_colors=None)
        return Image.fromarray(arr, "RGBA")

    @classmethod
    def remove_fake_background(cls, image: Image.Image) -> Image.Image:
        """
        Phân tích và tách nền giả một bước cho ảnh đơn lẻ; giữ nguyên nếu không đủ độ tin cậy.

        @param {Image.Image} image Ảnh đầu vào cần làm sạch nền.
        @returns {Image.Image} Ảnh RGBA sau tách nền hoặc ảnh gốc nếu bỏ qua.
        """
        spec = cls.analyze_background(image)
        if spec is None:
            return image
        return cls.remove_background_with_spec(image, spec)

    @staticmethod
    def extract_mask(
        image: Image.Image,
        auto_remove_solid_bg: bool = True,
        bg_tolerance: int = 25
    ) -> Tuple[np.ndarray, Image.Image]:
        """
        Trích xuất mặt nạ boolean (True: pixel nhân vật, False: pixel nền) và ảnh RGBA đã làm sạch.

        @param {Image.Image} image Ảnh sprite gốc.
        @param {bool} auto_remove_solid_bg Tự động xóa nền màu đơn sắc nếu không có alpha.
        @param {int} bg_tolerance Ngưỡng sai số màu khi khử nền.
        @returns {Tuple[np.ndarray, Image.Image]} Mask nhị phân và ảnh RGBA đã xử lý alpha.
        """
        img_rgba = image.convert("RGBA")
        arr = np.array(img_rgba)
        alpha = arr[:, :, 3]

        # Kiểm tra xem ảnh đã có sẵn kênh alpha trong suốt thực sự hay không
        has_transparency = np.any(alpha < 240)
        if has_transparency:
            mask = alpha > 25
            return mask, img_rgba

        # Nếu không có alpha (thường là ảnh nền đặc do AI sinh ra)
        if auto_remove_solid_bg:
            rgb = arr[:, :, :3].astype(float)
            h, w = arr.shape[:2]
            corners = [
                rgb[0, 0],
                rgb[0, w - 1],
                rgb[h - 1, 0],
                rgb[h - 1, w - 1]
            ]
            # Tính màu nền trung bình từ 4 góc ảnh
            bg_color = np.mean(corners, axis=0)

            # Tính khoảng cách Euclidean màu
            color_diff = np.linalg.norm(rgb - bg_color, axis=2)
            mask = color_diff > bg_tolerance

            # Cập nhật lại kênh alpha trong suốt cho ảnh
            new_alpha = np.where(mask, 255, 0).astype(np.uint8)
            arr[:, :, 3] = new_alpha
            processed_img = Image.fromarray(arr, "RGBA")
            return mask, processed_img

        return (alpha > 0), img_rgba
