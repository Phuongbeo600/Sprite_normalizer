# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Kiểu)
# ========================================================
# dataclass, asdict: Định nghĩa cấu trúc dữ liệu và chuyển đổi sang từ điển
from dataclasses import dataclass, asdict
# typing: Khai báo kiểu dữ liệu tùy chọn, bộ giá trị, từ điển
from typing import Optional, Tuple, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


@dataclass
class CharacterMetrics:
    """
    Cấu trúc dữ liệu lưu trữ toàn bộ chỉ số hình học và giải phẫu học của Sprite:
    - Kích thước canvas gốc và hộp bao (bounding box) thực tế của nhân vật.
    - Điểm ranh giới cổ (ranh giới đầu và thân), điểm hông/háng và mặt đất tiếp xúc.
    - Các tỷ lệ vàng: Tỷ lệ đầu/thân, số đầu (heads tall), phong cách (Chibi hay Heroic).
    - Tách biệt rõ ràng các vùng cơ thể sinh học và vùng ngoại vi (vũ khí, áo choàng, bóng).
    """
    canvas_width: int
    canvas_height: int

    # Bounding box toàn bộ nhân vật (phần pixel nhìn thấy được)
    visible_x_min: int
    visible_y_min: int
    visible_x_max: int
    visible_y_max: int
    visible_width: int
    visible_height: int

    # Vị trí cổ (ranh giới phân tách giữa đầu và thân)
    neck_y: int

    # Phần Đầu (Head)
    head_x_min: int
    head_y_min: int
    head_x_max: int
    head_y_max: int
    head_width: int
    head_height: int

    # Phần Thân (Body = từ cổ đến chân)
    body_x_min: int
    body_y_min: int
    body_x_max: int
    body_y_max: int
    body_width: int
    body_height: int

    # Phần Ngực / Bụng (Torso - không tính phần chân)
    torso_height: int
    torso_width: int

    # Các tỷ lệ vàng quan trọng
    head_ratio: float               # head_height / anatomical_height hoặc visible_height
    heads_tall: float               # Chiều cao tính bằng số đầu (ví dụ 2.5 đầu, 5.0 đầu)
    head_to_body_width_ratio: float # head_width / body_width
    body_aspect_ratio: float        # body_width / body_height

    # Nhận diện phong cách
    style_category: str             # "Chibi Lùn (2.0 - 2.5 đầu)", "Semi-Chibi", "Dáng Thật"
    summary_text: str               # Tóm tắt nhanh bằng tiếng Việt

    # Phân đoạn chi tiết bổ sung AI và các vùng ngoại vi
    crotch_y: Optional[int] = None
    ground_y: Optional[int] = None
    anatomical_height: Optional[int] = None                     # Chiều cao cơ thể thuần (loại bỏ vũ khí & bóng)
    torso_box: Optional[Tuple[int, int, int, int]] = None       # [ymin, xmin, ymax, xmax] pixel thật của thân trên
    legs_box: Optional[Tuple[int, int, int, int]] = None        # [ymin, xmin, ymax, xmax] pixel thật của chân
    weapon_box: Optional[Tuple[int, int, int, int]] = None      # [ymin, xmin, ymax, xmax] pixel thật của vũ khí
    cape_wings_box: Optional[Tuple[int, int, int, int]] = None  # [ymin, xmin, ymax, xmax] pixel thật của áo choàng/cánh
    shadow_box: Optional[Tuple[int, int, int, int]] = None      # [ymin, xmin, ymax, xmax] pixel thật của bóng chân
    detection_source: str = "Heuristic (Toán học)"
    ai_feedback: Optional[str] = None

    @classmethod
    def from_dict(cls, data: Optional[Dict[str, Any]] = None) -> "CharacterMetrics":
        """
        Khởi tạo đối tượng CharacterMetrics từ từ điển (dictionary).
        Tự động điền giá trị mặc định chuẩn xác nếu từ điển bị thiếu trường hoặc truyền vào None.

        @param {Optional[Dict[str, Any]]} data Từ điển chứa các số đo giải phẫu nhân vật.
        @returns {CharacterMetrics} Đối tượng CharacterMetrics đã được phục hồi đầy đủ.
        """
        d = data if isinstance(data, dict) else {}

        def _to_box(val: Any) -> Optional[Tuple[int, int, int, int]]:
            """Chuyển đổi danh sách hoặc bộ giá trị tọa độ hộp bao thành Tuple 4 số nguyên."""
            if val is None:
                return None
            if isinstance(val, (list, tuple)) and len(val) >= 4:
                return (int(val[0]), int(val[1]), int(val[2]), int(val[3]))
            return None

        def _get_val(key: str, default: Any) -> Any:
            """Lấy giá trị từ từ điển, nếu không có hoặc bằng None thì sử dụng giá trị mặc định."""
            val = d.get(key)
            return default if val is None else val

        return cls(
            canvas_width=_get_val("canvas_width", 64),
            canvas_height=_get_val("canvas_height", 64),
            visible_x_min=_get_val("visible_x_min", 0),
            visible_y_min=_get_val("visible_y_min", 0),
            visible_x_max=_get_val("visible_x_max", 63),
            visible_y_max=_get_val("visible_y_max", 63),
            visible_width=_get_val("visible_width", 64),
            visible_height=_get_val("visible_height", 64),
            neck_y=_get_val("neck_y", 20),
            head_x_min=_get_val("head_x_min", 16),
            head_y_min=_get_val("head_y_min", 0),
            head_x_max=_get_val("head_x_max", 48),
            head_y_max=_get_val("head_y_max", 20),
            head_width=_get_val("head_width", 32),
            head_height=_get_val("head_height", 20),
            body_x_min=_get_val("body_x_min", 10),
            body_y_min=_get_val("body_y_min", 21),
            body_x_max=_get_val("body_x_max", 54),
            body_y_max=_get_val("body_y_max", 63),
            body_width=_get_val("body_width", 44),
            body_height=_get_val("body_height", 43),
            torso_height=_get_val("torso_height", 20),
            torso_width=_get_val("torso_width", 44),
            head_ratio=_get_val("head_ratio", 0.31),
            heads_tall=_get_val("heads_tall", 3.2),
            head_to_body_width_ratio=_get_val("head_to_body_width_ratio", 0.73),
            body_aspect_ratio=_get_val("body_aspect_ratio", 1.02),
            style_category=_get_val("style_category", "Semi-Chibi"),
            summary_text=_get_val("summary_text", ""),
            crotch_y=d.get("crotch_y"),
            ground_y=d.get("ground_y"),
            anatomical_height=d.get("anatomical_height"),
            torso_box=_to_box(d.get("torso_box")),
            legs_box=_to_box(d.get("legs_box")),
            weapon_box=_to_box(d.get("weapon_box")),
            cape_wings_box=_to_box(d.get("cape_wings_box")),
            shadow_box=_to_box(d.get("shadow_box")),
            detection_source=_get_val("detection_source", "Heuristic (Toán học)"),
            ai_feedback=d.get("ai_feedback")
        )

    def to_dict(self) -> Dict[str, Any]:
        """
        Chuyển đổi đối tượng CharacterMetrics sang định dạng từ điển chuẩn.

        @returns {Dict[str, Any]} Bản ghi từ điển chứa toàn bộ chỉ số giải phẫu.
        """
        return asdict(self)
