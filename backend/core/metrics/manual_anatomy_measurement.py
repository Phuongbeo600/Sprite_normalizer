"""
Module: backend.core.metrics.manual_anatomy_measurement
Mục đích: Tính toán 11 thông số giải phẫu từ các điểm đo trên hệ tọa độ ảnh gốc (Point-to-Point Measurement).
Ai gọi nó: `backend.services.character.anatomy_service.AnatomyService.measure_manual_regions`.
Tại sao tồn tại: Thực hiện phép tính hình học chính xác bằng Python thuần (trục Y, trục X, Euclidean đa đoạn qua khớp,
độ dày vuông góc trục chi) và xuất dữ liệu kèm keypoints phục vụ ánh xạ prompt và huấn luyện Keypoint Detection.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Toán học & Kiểu dữ liệu)
# ========================================================
# math: Kiểm tra số hữu hạn (isfinite) và tính khoảng cách hình học (hypot)
import math
# typing: Khai báo kiểu dữ liệu cho điểm, đoạn thẳng, quy chuẩn thông số và báo cáo
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không phụ thuộc thư viện bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# ANATOMY_METRIC_KEYS: Danh sách 11 khóa giải phẫu chuẩn dùng chung với module ánh xạ
from backend.core.metrics.anatomy_mapping import ANATOMY_METRIC_KEYS

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & CẤU HÌNH (Stylesheets / Config)
# ========================================================
# (Không áp dụng cho module lõi backend)


Point2D = Tuple[float, float]

# Quy chuẩn 11 thông số đo thủ công theo đúng bảng định nghĩa nghiệp vụ:
# key -> (tên tiếng Việt, nhóm bộ phận, phương pháp tính, mã nhóm màu)
MANUAL_ANATOMY_SPECS: Dict[str, Tuple[str, str, str, str]] = {
    "body_height": ("Chiều cao toàn thân", "Toàn thân", "height_y", "yellow"),
    "head_height": ("Chiều cao đầu", "Đầu", "height_y", "red"),
    "head_width": ("Chiều rộng đầu", "Đầu", "width_x", "red"),
    "torso_height": ("Chiều cao thân", "Thân", "height_y", "orange"),
    "torso_width": ("Chiều rộng thân", "Thân", "width_x", "orange"),
    "shoulder_width": ("Chiều rộng vai", "Vai & Hông", "width_x", "green"),
    "hip_width": ("Chiều rộng hông", "Vai & Hông", "width_x", "green"),
    "arm_length": ("Chiều dài tay", "Tay", "polyline_euclidean", "blue"),
    "arm_width": ("Độ dày tay", "Tay", "perpendicular_width", "blue"),
    "leg_length": ("Chiều dài chân", "Chân", "polyline_euclidean", "purple"),
    "leg_width": ("Độ dày chân", "Chân", "perpendicular_width", "purple"),
}

# Ánh xạ thông số độ dày chi -> thông số trục chi tương ứng để tính theo phương vuông góc
LIMB_THICKNESS_TO_AXIS: Dict[str, str] = {
    "arm_width": "arm_length",
    "leg_width": "leg_length",
}


def _is_valid_number(value: Any) -> bool:
    """Kiểm tra giá trị là số thực/nguyên hữu hạn (loại bỏ bool, NaN, Infinity)."""
    return not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(float(value))


def read_image_point(point: Any, image_size: Tuple[int, int]) -> Point2D:
    """
    Xác thực và đọc một tọa độ điểm [x, y] theo hệ quy chiếu ảnh gốc.

    @param {Any} point Cặp tọa độ [x, y] từ Frontend hoặc tệp JSON.
    @param {Tuple[int, int]} image_size Kích thước ảnh gốc (width, height).
    @returns {Point2D} Cặp tọa độ thực (x, y) nằm trong biên ảnh gốc.
    """
    if not isinstance(point, (list, tuple)) or len(point) != 2:
        raise ValueError("Mỗi điểm đo phải gồm đúng hai tọa độ [x, y].")
    raw_x, raw_y = point
    if not _is_valid_number(raw_x) or not _is_valid_number(raw_y):
        raise ValueError("Tọa độ điểm đo phải là số hữu hạn hợp lệ.")
    x = float(raw_x)
    y = float(raw_y)
    width, height = image_size
    if not (0.0 <= x <= float(width) and 0.0 <= y <= float(height)):
        raise ValueError("Tọa độ điểm đo nằm ngoài phạm vi ảnh gốc.")
    return (round(x, 3), round(y, 3))


def _point_to_segment_dist_sq(px: float, py: float, a: Point2D, b: Point2D) -> float:
    """Tính bình phương khoảng cách từ điểm P đến đoạn thẳng AB để tìm đốt chi gần nhất."""
    vx = b[0] - a[0]
    vy = b[1] - a[1]
    seg_len_sq = vx * vx + vy * vy
    if seg_len_sq <= 1e-12:
        dx = px - a[0]
        dy = py - a[1]
        return dx * dx + dy * dy
    t = max(0.0, min(1.0, ((px - a[0]) * vx + (py - a[1]) * vy) / seg_len_sq))
    proj_x = a[0] + t * vx
    proj_y = a[1] + t * vy
    dx = px - proj_x
    dy = py - proj_y
    return dx * dx + dy * dy


def _select_nearest_axis_segment(
    boundary_p1: Point2D,
    boundary_p2: Point2D,
    axis_points: Sequence[Point2D],
) -> Optional[Tuple[Point2D, Point2D]]:
    """Chọn đoạn trục chi gần nhất với trung điểm của đoạn đo độ dày chi."""
    if len(axis_points) < 2:
        return None
    mid_x = (boundary_p1[0] + boundary_p2[0]) / 2.0
    mid_y = (boundary_p1[1] + boundary_p2[1]) / 2.0
    best_segment: Optional[Tuple[Point2D, Point2D]] = None
    best_dist = float("inf")
    for idx in range(len(axis_points) - 1):
        a = axis_points[idx]
        b = axis_points[idx + 1]
        if math.hypot(b[0] - a[0], b[1] - a[1]) <= 1e-9:
            continue
        dist_sq = _point_to_segment_dist_sq(mid_x, mid_y, a, b)
        if dist_sq < best_dist:
            best_dist = dist_sq
            best_segment = (a, b)
    return best_segment


def compute_metric_value(
    kind: str,
    points: Sequence[Point2D],
    axis_points: Optional[Sequence[Point2D]] = None,
) -> float:
    """
    Tính giá trị pixel từ tập điểm đo trên ảnh gốc theo đúng phương pháp hình học của từng loại thông số.

    @param {str} kind Phương pháp tính ('height_y', 'width_x', 'polyline_euclidean', 'perpendicular_width').
    @param {Sequence[Point2D]} points Danh sách tọa độ điểm đo trên ảnh gốc.
    @param {Optional[Sequence[Point2D]]} axis_points Danh sách điểm trục chi (dùng cho 'perpendicular_width').
    @returns {float} Giá trị pixel dương làm tròn 2 chữ số thập phân.
    """
    if kind in ("height_y", "width_x", "perpendicular_width") and len(points) != 2:
        raise ValueError("Thông số đo đoạn thẳng yêu cầu đúng 2 điểm đầu mút.")
    if kind == "polyline_euclidean" and len(points) < 2:
        raise ValueError("Thông số đo chi yêu cầu ít nhất 2 điểm nối tiếp.")

    if kind == "height_y":
        value = abs(points[1][1] - points[0][1])
    elif kind == "width_x":
        value = abs(points[1][0] - points[0][0])
    elif kind == "polyline_euclidean":
        value = sum(
            math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1])
            for i in range(len(points) - 1)
        )
    elif kind == "perpendicular_width":
        p1, p2 = points[0], points[1]
        nearest_seg = _select_nearest_axis_segment(p1, p2, axis_points or ())
        if nearest_seg is not None:
            ax, ay = nearest_seg[0]
            bx, by = nearest_seg[1]
            ux = bx - ax
            uy = by - ay
            axis_len = math.hypot(ux, uy)
            # Chiếu vector giữa hai điểm biên lên pháp tuyến đơn vị của đoạn trục chi gần nhất
            nx = -uy / axis_len
            ny = ux / axis_len
            value = abs((p2[0] - p1[0]) * nx + (p2[1] - p1[1]) * ny)
        else:
            # Nếu chưa có hoặc đã bỏ qua trục chi, đo khoảng cách Euclidean trực tiếp giữa 2 điểm biên
            value = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
    else:
        raise ValueError(f"Phương pháp tính không được hỗ trợ: {kind}.")

    rounded = round(value, 2)
    if rounded <= 0.0:
        raise ValueError("Hai điểm đo bị trùng nhau theo phương đo, giá trị pixel phải lớn hơn 0.")
    return rounded


def _build_segments(points: Sequence[Point2D]) -> List[List[List[float]]]:
    """Tạo danh sách các đoạn nối tiếp [[x1, y1], [x2, y2]] từ danh sách điểm."""
    if len(points) < 2:
        return []
    return [
        [[points[i][0], points[i][1]], [points[i + 1][0], points[i + 1][1]]]
        for i in range(len(points) - 1)
    ]


def _extract_input_points(entry: Mapping[str, Any], image_size: Tuple[int, int]) -> List[Point2D]:
    """Đọc danh sách điểm từ khóa 'points' hoặc cặp 'start'/'end' trên ảnh gốc."""
    raw_points = entry.get("points")
    if raw_points is None and ("start" in entry or "end" in entry):
        raw_points = [entry.get("start"), entry.get("end")]
    if not isinstance(raw_points, list):
        raise ValueError("Mục đo phải chứa danh sách tọa độ 'points'.")
    return [read_image_point(pt, image_size) for pt in raw_points]


def _point_role(index: int, total: int) -> str:
    """Gán nhãn vai trò điểm cho dữ liệu huấn luyện Keypoint Detection sau này."""
    if index == 0:
        return "start"
    if index == total - 1:
        return "end"
    return f"joint_{index}"


def compute_manual_anatomy_report(
    image_size: Tuple[int, int],
    raw_measurements: Any,
) -> Dict[str, Any]:
    """
    Tính toán đầy đủ báo cáo giải phẫu 11 thông số từ tọa độ điểm đo trên ảnh gốc.
    - Không dùng tọa độ màn hình hay kích thước zoom.
    - Không tự suy diễn số đo cho các bộ phận bị đánh dấu che khuất ('occluded': True).
    - Xuất đầy đủ tọa độ điểm, loại số đo, giá trị pixel và danh sách keypoints chuẩn hóa.

    @param {Tuple[int, int]} image_size Kích thước ảnh gốc (width, height).
    @param {Any} raw_measurements Từ điển các thông số đo gửi từ giao diện hoặc tệp JSON.
    @returns {Dict[str, Any]} Báo cáo chuẩn 'point_to_point_v1' kèm 'raw_anatomy_metrics' và 'keypoints'.
    """
    width, height = image_size
    if width <= 0 or height <= 0:
        raise ValueError("Kích thước ảnh gốc không hợp lệ.")
    if not isinstance(raw_measurements, Mapping):
        raise ValueError("Dữ liệu số đo thiếu bảng 'measurements'.")

    parsed_points: Dict[str, List[Point2D]] = {}
    occluded_flags: Dict[str, bool] = {}

    # Bước 1: Kiểm tra tính hợp lệ toàn bộ khóa và tọa độ điểm đo trên ảnh gốc
    for metric, entry in raw_measurements.items():
        if metric not in MANUAL_ANATOMY_SPECS:
            raise ValueError(f"Thông số giải phẫu không hợp lệ: {metric}.")
        if entry is None:
            continue
        if not isinstance(entry, Mapping):
            label = MANUAL_ANATOMY_SPECS[metric][0]
            raise ValueError(f"Số đo '{label}' sai định dạng dữ liệu.")

        is_occluded = bool(entry.get("occluded")) or entry.get("status") == "occluded"
        if is_occluded:
            occluded_flags[metric] = True
            continue

        points = _extract_input_points(entry, (width, height))
        if not points:
            continue
        parsed_points[metric] = points
        occluded_flags[metric] = False

    # Bước 2: Tính giá trị pixel bằng Python thuần và đóng gói cấu trúc Keypoint Detection
    measurements_out: Dict[str, Dict[str, Any]] = {}
    raw_anatomy_metrics: Dict[str, Optional[float]] = {key: None for key in ANATOMY_METRIC_KEYS}
    keypoints_out: List[Dict[str, Any]] = []
    prompt_parts: List[str] = []

    for metric in ANATOMY_METRIC_KEYS:
        if metric not in occluded_flags:
            continue
        _, _, kind, _ = MANUAL_ANATOMY_SPECS[metric]

        if occluded_flags[metric]:
            measurements_out[metric] = {
                "metric": metric,
                "kind": kind,
                "status": "occluded",
                "points": [],
                "segments": [],
                "value_px": None,
                "occluded": True,
            }
            raw_anatomy_metrics[metric] = None
            continue

        pts = parsed_points[metric]
        axis_metric = LIMB_THICKNESS_TO_AXIS.get(metric)
        axis_pts = parsed_points.get(axis_metric) if axis_metric and not occluded_flags.get(axis_metric) else None

        value_px = compute_metric_value(kind, pts, axis_points=axis_pts)
        measurements_out[metric] = {
            "metric": metric,
            "kind": kind,
            "status": "measured",
            "points": [[p[0], p[1]] for p in pts],
            "segments": _build_segments(pts),
            "value_px": value_px,
            "occluded": False,
        }
        raw_anatomy_metrics[metric] = value_px
        prompt_parts.append(f"{metric.replace('_', ' ')} {value_px:g} px")

        total_pts = len(pts)
        for idx, pt in enumerate(pts):
            keypoints_out.append({
                "metric": metric,
                "point_index": idx,
                "role": _point_role(idx, total_pts),
                "x": pt[0],
                "y": pt[1],
            })

    prompt_notes = (
        f"Manual point-to-point measurements in source-image pixels: {', '.join(prompt_parts)}. "
        "Scale these proportions to the target sprite height."
    ) if prompt_parts else ""

    return {
        "schema_version": "point_to_point_v1",
        "image_size_px": [width, height],
        "measurements": measurements_out,
        "raw_anatomy_metrics": raw_anatomy_metrics,
        "keypoints": keypoints_out,
        "prompt_notes": prompt_notes,
    }
