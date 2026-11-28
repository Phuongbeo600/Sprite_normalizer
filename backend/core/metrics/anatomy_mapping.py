"""
Module: backend.core.metrics.anatomy_mapping
Mục đích: Ánh xạ các số đo giải phẫu hình học thành mô tả tiếng Anh theo quy tắc và ngưỡng phân loại cố định.
Ai gọi nó: `backend.services.image_gen_prompts` và các bộ kiểm thử đơn vị.
Tại sao tồn tại: Cung cấp cầu nối thuần toán học (0 token, không dùng LLM/Vision AI) giữa số đo thô từ ảnh
và biến [ANATOMICAL_DESCRIPTION] trong Master Prompt Template.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Toán học & Kiểu dữ liệu)
# ========================================================
# math: Kiểm tra số hữu hạn (isfinite) và tính khoảng cách hai điểm trục chi (dist)
import math
# typing: Khai báo kiểu tùy chọn, ánh xạ, bộ quy tắc và từ điển
from typing import Any, Dict, List, Mapping, Optional, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không phụ thuộc thư viện bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không phụ thuộc mô-đun nội bộ để giữ tầng Core độc lập tuyệt đối)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


# Kiểu quy tắc phân ngưỡng: (ngưỡng trên độc quyền hoặc None cho nhánh còn lại, giá trị đầu ra)
ThresholdRule = Tuple[Optional[float], Any]


# ========================================================
# BẢNG QUY TẮC & NGƯỠNG PHÂN LOẠI CẤU HÌNH V1
# ========================================================

# 3.2A. Kích thước đầu tương đối: head_height / body_height
HEAD_SIZE_RULES: Tuple[ThresholdRule, ...] = (
    (0.125, "Very small head"),
    (0.18, "Small head"),
    (0.25, "Medium-sized head"),
    (0.35, "Relatively large head"),
    (0.50, "Large head"),
    (None, "Very large head"),
)

# 3.2B. Chiều rộng đầu so với thân: head_width / torso_width
# Mỗi giá trị là cặp (mô tả khi đứng một mình, cụm nối khi ghép sau mô tả kích thước đầu)
HEAD_WIDTH_RULES: Tuple[ThresholdRule, ...] = (
    (0.60, ("Head much narrower than torso", "much narrower than the torso")),
    (0.85, ("Head narrower than torso", "narrower than the torso")),
    (1.15, ("Head approximately as wide as torso", "approximately as wide as the torso")),
    (1.50, ("Head wider than torso", "wider than the torso")),
    (None, ("Head much wider than torso", "much wider than the torso")),
)

# 3.3A. Chiều dài thân tương đối: torso_height / body_height
TORSO_LENGTH_RULES: Tuple[ThresholdRule, ...] = (
    (0.25, "Very short"),
    (0.35, "Short"),
    (0.45, "Medium-length"),
    (None, "Long"),
)

# 3.3B. Hình dáng thân: torso_width / torso_height
# Mỗi giá trị là bộ (mô tả khi đứng một mình, tính từ ghép trước 'torso', hậu tố ghép sau 'torso')
TORSO_SHAPE_RULES: Tuple[ThresholdRule, ...] = (
    (0.60, ("Narrow torso", "narrow", None)),
    (0.85, ("Moderately narrow torso", "moderately narrow", None)),
    (1.15, ("Torso with similar width and height", None, "with similar width and height")),
    (1.50, ("Broad torso", "broad", None)),
    (None, ("Very broad torso", "very broad", None)),
)

# 3.4. Tỷ lệ vai và hông: shoulder_width / hip_width
SHOULDER_HIP_RULES: Tuple[ThresholdRule, ...] = (
    (0.70, "Shoulders much narrower than hips"),
    (0.90, "Shoulders narrower than hips"),
    (1.10, "Shoulders and hips of similar width"),
    (1.40, "Shoulders broader than hips"),
    (None, "Shoulders much broader than hips"),
)

# 3.5A. Chiều dài tay tương đối: arm_length / body_height
ARM_LENGTH_RULES: Tuple[ThresholdRule, ...] = (
    (0.20, "Very short"),
    (0.30, "Short"),
    (0.40, "Medium-length"),
    (0.50, "Long"),
    (None, "Very long"),
)

# 3.6A. Chiều dài chân tương đối: leg_length / body_height
LEG_LENGTH_RULES: Tuple[ThresholdRule, ...] = (
    (0.25, "Very short"),
    (0.35, "Relatively short"),
    (0.45, "Medium-length"),
    (0.55, "Relatively long"),
    (None, "Very long"),
)

# 3.5B & 3.6B. Độ dày tương đối của tay và chân: limb_width / limb_length
LIMB_THICKNESS_RULES: Tuple[ThresholdRule, ...] = (
    (0.10, "very thin"),
    (0.20, "thin"),
    (0.30, "medium-thickness"),
    (0.45, "thick"),
    (None, "very thick"),
)

# Giới hạn tối thiểu khi trích xuất tự động từ ảnh (tránh ảnh quá nhỏ/dummy không đủ độ phân giải tách đầu-thân)
MIN_AUTO_BODY_HEIGHT_PX = 8.0
MIN_AUTO_HEAD_HEIGHT_PX = 2.0

# Khóa chuẩn của bộ dữ liệu giải phẫu đầu vào
ANATOMY_METRIC_KEYS: Tuple[str, ...] = (
    "body_height",
    "head_height",
    "head_width",
    "torso_height",
    "torso_width",
    "shoulder_width",
    "hip_width",
    "arm_length",
    "arm_width",
    "leg_length",
    "leg_width",
)


def classify_by_threshold(value: float, rules: Tuple[ThresholdRule, ...]) -> Any:
    """
    Ánh xạ một giá trị tỷ lệ thực sang nhãn cấu hình trong bảng ngưỡng nửa mở [low, upper_bound).

    @param {float} value Giá trị tỷ lệ cần phân loại.
    @param {Tuple[ThresholdRule, ...]} rules Bảng quy tắc ngưỡng sắp xếp tăng dần.
    @returns {Any} Giá trị nhãn tương ứng với khoảng chứa value.
    """
    for upper_bound, label in rules:
        if upper_bound is None or value < upper_bound:
            return label
    return rules[-1][1]


def _valid_positive(value: Any) -> Optional[float]:
    """
    Kiểm tra và chuẩn hóa một số đo dương hữu hạn (loại bỏ None, bool, <= 0, NaN, Infinity).

    @param {Any} value Giá trị đầu vào thô.
    @returns {Optional[float]} Số thực dương hợp lệ hoặc None.
    """
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    numeric = float(value)
    if not math.isfinite(numeric) or numeric <= 0.0:
        return None
    return numeric


def _safe_ratio(numerator: Optional[float], denominator: Optional[float]) -> Optional[float]:
    """
    Tính tỷ số an toàn khi cả tử số và mẫu số đều hợp lệ, hữu hạn và dương.

    @param {Optional[float]} numerator Tử số.
    @param {Optional[float]} denominator Mẫu số.
    @returns {Optional[float]} Tỷ số dương hữu hạn hoặc None.
    """
    if numerator is None or denominator is None or denominator <= 0.0:
        return None
    ratio = numerator / denominator
    if not math.isfinite(ratio) or ratio <= 0.0:
        return None
    return ratio


def _read_value(source: Any, key: str) -> Any:
    """Đọc thuộc tính hoặc khóa từ điển một cách đồng nhất."""
    if isinstance(source, Mapping):
        return source.get(key)
    return getattr(source, key, None)


def _describe_body_proportions(body_height: Optional[float], head_height: Optional[float]) -> Optional[str]:
    """Mô tả tỷ lệ chiều cao cơ thể tính theo số đầu (làm tròn 1 chữ số thập phân)."""
    if body_height is None or head_height is None or head_height >= body_height:
        return None
    heads_tall = _safe_ratio(body_height, head_height)
    if heads_tall is None:
        return None
    return f"Approximately {round(heads_tall, 1):.1f}-head-tall proportions."


def _describe_head(
    body_height: Optional[float],
    head_height: Optional[float],
    head_width: Optional[float],
    torso_width: Optional[float],
) -> Optional[str]:
    """Mô tả kích thước đầu tương đối và tương quan chiều rộng đầu so với thân."""
    size_ratio = (
        _safe_ratio(head_height, body_height)
        if body_height is not None and head_height is not None and head_height < body_height
        else None
    )
    width_ratio = _safe_ratio(head_width, torso_width)

    size_label = classify_by_threshold(size_ratio, HEAD_SIZE_RULES) if size_ratio is not None else None
    width_entry = classify_by_threshold(width_ratio, HEAD_WIDTH_RULES) if width_ratio is not None else None

    if size_label and width_entry:
        return f"{size_label}, {width_entry[1]}."
    if size_label:
        return f"{size_label}."
    if width_entry:
        return f"{width_entry[0]}."
    return None


def _describe_torso(
    body_height: Optional[float],
    torso_height: Optional[float],
    torso_width: Optional[float],
) -> Optional[str]:
    """Mô tả chiều dài tương đối và hình dáng tỷ lệ rộng/cao của phần thân."""
    len_ratio = (
        _safe_ratio(torso_height, body_height)
        if body_height is not None and torso_height is not None and torso_height < body_height
        else None
    )
    shape_ratio = _safe_ratio(torso_width, torso_height)

    len_adj = classify_by_threshold(len_ratio, TORSO_LENGTH_RULES) if len_ratio is not None else None
    shape_entry = classify_by_threshold(shape_ratio, TORSO_SHAPE_RULES) if shape_ratio is not None else None

    if len_adj and shape_entry:
        _, shape_adj, shape_suffix = shape_entry
        if shape_suffix:
            return f"{len_adj} torso {shape_suffix}."
        return f"{len_adj}, {shape_adj} torso."
    if len_adj:
        return f"{len_adj} torso."
    if shape_entry:
        return f"{shape_entry[0]}."
    return None


def _describe_shoulders_and_hips(
    shoulder_width: Optional[float],
    hip_width: Optional[float],
) -> Optional[str]:
    """Mô tả tương quan chiều rộng giữa vai và hông."""
    ratio = _safe_ratio(shoulder_width, hip_width)
    if ratio is None:
        return None
    label = classify_by_threshold(ratio, SHOULDER_HIP_RULES)
    return f"{label}."


def _describe_limb(
    limb_length: Optional[float],
    limb_width: Optional[float],
    body_height: Optional[float],
    length_rules: Tuple[ThresholdRule, ...],
    limb_noun: str,
    max_body_ratio: float,
) -> Optional[str]:
    """
    Hàm dùng chung mô tả chiều dài và độ dày tương đối của tay hoặc chân.

    @param {Optional[float]} limb_length Chiều dài giải phẫu của một chi.
    @param {Optional[float]} limb_width Độ dày đại diện của một chi.
    @param {Optional[float]} body_height Chiều cao toàn cơ thể.
    @param {Tuple[ThresholdRule, ...]} length_rules Bảng ngưỡng phân loại chiều dài chi.
    @param {str} limb_noun Danh từ chi ('arms' hoặc 'legs').
    @param {float} max_body_ratio Giới hạn tỷ lệ limb_length / body_height hợp lệ.
    @returns {Optional[str]} Câu mô tả chi bằng tiếng Anh hoặc None nếu thiếu/sai số liệu.
    """
    len_ratio = (
        _safe_ratio(limb_length, body_height)
        if body_height is not None and limb_length is not None and limb_length <= body_height * max_body_ratio
        else None
    )
    thick_ratio = (
        _safe_ratio(limb_width, limb_length)
        if limb_length is not None and limb_width is not None and limb_width <= limb_length * 1.5
        else None
    )

    len_adj = classify_by_threshold(len_ratio, length_rules) if len_ratio is not None else None
    thick_adj = classify_by_threshold(thick_ratio, LIMB_THICKNESS_RULES) if thick_ratio is not None else None

    if len_adj and thick_adj:
        if thick_adj == "medium-thickness":
            return f"{len_adj} {limb_noun} of medium thickness."
        return f"{len_adj}, {thick_adj} {limb_noun}."
    if len_adj:
        return f"{len_adj} {limb_noun}."
    if thick_adj:
        return f"{thick_adj.capitalize()} {limb_noun}."
    return None


def _empty_raw_metrics() -> Dict[str, Optional[float]]:
    """Tạo bộ từ điển 11 thông số giải phẫu có giá trị mặc định None."""
    return {key: None for key in ANATOMY_METRIC_KEYS}


def _extract_region_width(region_report: Optional[Mapping[str, Any]], part: str) -> Optional[float]:
    """Đọc bề rộng đo được cho một bộ phận từ báo cáo region_measurements nếu hợp lệ."""
    if not isinstance(region_report, Mapping):
        return None
    measurements = region_report.get("measurements")
    if not isinstance(measurements, Mapping):
        return None
    entry = measurements.get(part)
    if not isinstance(entry, Mapping):
        return None
    return _valid_positive(entry.get("width_px"))


def _apply_manual_point_measurements(
    result: Dict[str, Optional[float]],
    manual_report: Optional[Mapping[str, Any]],
) -> None:
    """
    Áp dụng kết quả đo đoạn thẳng thủ công (Point-to-Point) vào từ điển 11 số đo:
    - Luôn ưu tiên số đo thủ công hơn số đo tự động của cùng thông số.
    - Nếu bộ phận bị đánh dấu che khuất ('occluded': True), giữ giá trị None và không tự suy diễn.
    """
    if not isinstance(manual_report, Mapping):
        return

    measurements = manual_report.get("measurements")
    raw_map = manual_report.get("raw_anatomy_metrics")

    for key in ANATOMY_METRIC_KEYS:
        if isinstance(measurements, Mapping) and key in measurements:
            entry = measurements.get(key)
            if not isinstance(entry, Mapping):
                continue
            if bool(entry.get("occluded")) or entry.get("status") == "occluded":
                result[key] = None
                continue
            manual_val = _valid_positive(entry.get("value_px"))
            if manual_val is not None:
                result[key] = manual_val
            continue

        if isinstance(raw_map, Mapping) and key in raw_map:
            manual_val = _valid_positive(raw_map.get(key))
            if manual_val is not None:
                result[key] = manual_val


def extract_raw_anatomy_metrics(
    metrics: Any = None,
    region_measurements: Optional[Mapping[str, Any]] = None,
    manual_region_measurements: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Optional[float]]:
    """
    Chuẩn hóa dữ liệu từ module phân tích giải phẫu hiện có (CharacterMetrics / AnatomyService)
    hoặc từ điển thô thành bộ 11 khóa chuẩn của module ánh xạ.

    @param {Any} metrics Đối tượng CharacterMetrics hoặc dict chứa số đo giải phẫu.
    @param {Optional[Mapping[str, Any]]} region_measurements Báo cáo lát cắt tự động.
    @param {Optional[Mapping[str, Any]]} manual_region_measurements Báo cáo khoanh vùng thủ công.
    @returns {Dict[str, Optional[float]]} Từ điển 11 thông số chuẩn (None nếu thiếu hoặc chưa tin cậy).
    """
    result = _empty_raw_metrics()
    if metrics is None and region_measurements is None and manual_region_measurements is None:
        return result

    # Kiểm tra đây có phải bản ghi chuẩn 11 biến trực tiếp (chứa khóa chuẩn mà không có visible_height/neck_y)
    is_direct_schema = (
        isinstance(metrics, Mapping)
        and "visible_height" not in metrics
        and "anatomical_height" not in metrics
        and "neck_y" not in metrics
        and any(k in metrics for k in ("body_height", "shoulder_width", "hip_width", "arm_length", "leg_length"))
    )

    if is_direct_schema:
        for key in ANATOMY_METRIC_KEYS:
            result[key] = _valid_positive(metrics.get(key))
        return result

    # Trích xuất từ CharacterMetrics (trong đó CharacterMetrics.body_height chỉ tính từ cổ tới chân)
    if metrics is not None:
        anat_h = _valid_positive(_read_value(metrics, "anatomical_height"))
        vis_h = _valid_positive(_read_value(metrics, "visible_height"))
        total_h = anat_h if anat_h is not None else vis_h
        head_h = _valid_positive(_read_value(metrics, "head_height"))

        # Kiểm tra ngưỡng tin cậy tối thiểu cho phép đo tự động từ ảnh
        neck_y = _read_value(metrics, "neck_y")
        vis_y_min = _read_value(metrics, "visible_y_min")
        vis_y_max = _read_value(metrics, "visible_y_max")
        neck_valid = True
        if isinstance(neck_y, (int, float)) and isinstance(vis_y_min, (int, float)) and isinstance(vis_y_max, (int, float)):
            neck_valid = vis_y_min < neck_y < vis_y_max

        if (
            total_h is None
            or total_h < MIN_AUTO_BODY_HEIGHT_PX
            or head_h is None
            or head_h < MIN_AUTO_HEAD_HEIGHT_PX
            or not neck_valid
        ):
            return result

        result["body_height"] = total_h
        result["head_height"] = head_h
        result["head_width"] = _valid_positive(_read_value(metrics, "head_width"))
        result["torso_height"] = _valid_positive(_read_value(metrics, "torso_height"))
        result["torso_width"] = _valid_positive(_read_value(metrics, "torso_width"))

    # Xác minh hệ tọa độ nhất quán nếu có thông số ảnh nguồn trên region_measurements / manual
    canvas_w = _valid_positive(_read_value(metrics, "canvas_width")) if metrics is not None else None
    canvas_h = _valid_positive(_read_value(metrics, "canvas_height")) if metrics is not None else None

    def _same_canvas(report: Optional[Mapping[str, Any]]) -> bool:
        if not isinstance(report, Mapping):
            return False
        if canvas_w is None or canvas_h is None:
            return True
        img_size = report.get("image_size_px")
        if not (isinstance(img_size, (list, tuple)) and len(img_size) == 2):
            return True
        return float(img_size[0]) == canvas_w and float(img_size[1]) == canvas_h

    if _same_canvas(region_measurements):
        region_head_w = _extract_region_width(region_measurements, "head")
        region_torso_w = _extract_region_width(region_measurements, "torso")
        if region_head_w is not None:
            result["head_width"] = region_head_w
        if region_torso_w is not None:
            result["torso_width"] = region_torso_w

    if _same_canvas(manual_region_measurements):
        _apply_manual_point_measurements(result, manual_region_measurements)

    return result


def map_anatomical_proportions(raw_metrics: Any) -> List[str]:
    """
    Ánh xạ bộ số đo giải phẫu thô thành danh sách các câu mô tả hình học tiếng Anh theo đúng thứ tự 6 nhóm:
    1. Tỷ lệ tổng thể, 2. Đầu, 3. Thân, 4. Vai và hông, 5. Tay, 6. Chân.

    @param {Any} raw_metrics Từ điển 11 số đo hoặc đối tượng CharacterMetrics.
    @returns {List[str]} Danh sách các câu mô tả hợp lệ (rỗng nếu không có đặc điểm nào đủ dữ liệu).
    """
    if raw_metrics is None:
        return []

    normalized = (
        extract_raw_anatomy_metrics(raw_metrics)
        if not (isinstance(raw_metrics, Mapping) and set(raw_metrics.keys()) <= set(ANATOMY_METRIC_KEYS))
        else {key: _valid_positive(raw_metrics.get(key)) for key in ANATOMY_METRIC_KEYS}
    )

    body_height = normalized["body_height"]
    head_height = normalized["head_height"]
    head_width = normalized["head_width"]
    torso_height = normalized["torso_height"]
    torso_width = normalized["torso_width"]
    shoulder_width = normalized["shoulder_width"]
    hip_width = normalized["hip_width"]
    arm_length = normalized["arm_length"]
    arm_width = normalized["arm_width"]
    leg_length = normalized["leg_length"]
    leg_width = normalized["leg_width"]

    candidates = [
        _describe_body_proportions(body_height, head_height),
        _describe_head(body_height, head_height, head_width, torso_width),
        _describe_torso(body_height, torso_height, torso_width),
        _describe_shoulders_and_hips(shoulder_width, hip_width),
        _describe_limb(arm_length, arm_width, body_height, ARM_LENGTH_RULES, "arms", max_body_ratio=1.2),
        _describe_limb(leg_length, leg_width, body_height, LEG_LENGTH_RULES, "legs", max_body_ratio=0.999999),
    ]
    return [line for line in candidates if line]


def build_anatomical_description(raw_metrics: Any) -> str:
    """
    Tổng hợp toàn bộ mô tả giải phẫu hợp lệ thành khối gạch đầu dòng cho [ANATOMICAL_DESCRIPTION].

    @param {Any} raw_metrics Từ điển 11 số đo hoặc đối tượng CharacterMetrics.
    @returns {str} Chuỗi mô tả nhiều dòng dạng '- ...' hoặc chuỗi rỗng nếu không có dữ liệu hợp lệ.
    """
    descriptions = map_anatomical_proportions(raw_metrics)
    if not descriptions:
        return ""
    return "\n".join(f"- {sentence}" for sentence in descriptions)
