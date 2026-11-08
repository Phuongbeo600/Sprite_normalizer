# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Kiểu)
# ========================================================
# dataclass, asdict: Định nghĩa cấu trúc dữ liệu lưu thông số giải phẫu nhân vật
from dataclasses import dataclass, asdict
# typing: Khai báo kiểu dữ liệu
from typing import Optional, Tuple

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
