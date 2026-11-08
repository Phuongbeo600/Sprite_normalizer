# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc, Liệt kê & Kiểu)
# ========================================================
# enum: Định nghĩa kiểu liệt kê góc nhìn chuỗi chuẩn (String Enum)
from enum import Enum
# typing: Định nghĩa các kiểu danh sách, chuỗi và tùy chọn
from typing import List, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Định nghĩa Schema kiểm tra tính hợp lệ dữ liệu hướng nhìn
from pydantic import BaseModel, Field

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class ViewType(str, Enum):
    """
    Các phân loại góc nhìn thị giác chuẩn trong thiết kế Sprite 2D.
    Kế thừa str để đảm bảo tuần tự hóa JSON và OpenAI Structured Outputs mượt mà.
    """
    FRONT = "Front"
    BACK = "Back"
    LEFT_PROFILE = "Left Profile"
    RIGHT_PROFILE = "Right Profile"
    THREE_QUARTER = "Three Quarter"


class DirectionProfile(BaseModel):
    """
    Hồ sơ giải phẫu học và thị giác cho một góc nhìn cụ thể (Direction Profile).
    Dùng chung làm cấu trúc chuẩn cho cả 3 hướng nhìn cốt lõi trong game 2D (Down, Side, Up).
    """

    view_type: ViewType = Field(
        ...,
        description="Góc nhìn thị giác của nhân vật: Front, Back, Left Profile, Right Profile hoặc Three Quarter"
    )

    body_orientation: str = Field(
        ...,
        description="Mô tả hướng xoay của thân mình nhân vật (ví dụ: Quay trực diện 100% về phía người quan sát, Xoay ngang 90 độ sang phải, Xoay lưng hoàn toàn)"
    )

    head_orientation: str = Field(
        ...,
        description="Mô tả hướng xoay và tầm nhìn của vùng đầu (ví dụ: Nhìn thẳng phía trước, Hơi cúi xuống, Ngoảnh mặt nhìn theo góc nghiêng)"
    )

    visible_body_parts: List[str] = Field(
        default_factory=list,
        description="Danh sách các bộ phận cơ thể nhìn thấy rõ ở góc nhìn này (ví dụ: Khuôn mặt, Hai mắt, Giáp ngực, Cả 2 cánh tay, 2 chân)"
    )

    occluded_body_parts: List[str] = Field(
        default_factory=list,
        description="Danh sách các bộ phận cơ thể bị che khuất khỏi tầm nhìn ở góc nhìn này (ví dụ: Cánh tay trái bị thân mình che, Lưng bị giáp ngực che, Mặt bị gáy che)"
    )

    visible_accessories: List[str] = Field(
        default_factory=list,
        description="Danh sách phụ kiện, vũ khí hoặc trang bị quan sát thấy rõ ở góc nhìn này (ví dụ: Tay cầm kiếm bên phải, Khiên tròn bên tay trái)"
    )

    accessory_placement: Optional[str] = Field(
        default=None,
        description="Vị trí tương đối và cách thức gắn kết của phụ kiện trên cơ thể ở góc nhìn này (ví dụ: Bao kiếm đeo chéo lưng từ vai phải xuống hông trái), hoặc None nếu không có phụ kiện"
    )

    silhouette_description: str = Field(
        ...,
        description="Mô tả hình dáng khối bóng (Silhouette) đặc trưng của nhân vật tại góc nhìn này"
    )

    view_specific_features: List[str] = Field(
        default_factory=list,
        description="Các chi tiết nhận diện chỉ xuất hiện hoặc nổi bật rõ rệt tại góc nhìn này (ví dụ: Biểu cảm khuôn mặt chỉ thấy ở hướng Down; Búi tóc phía sau chỉ thấy ở hướng Up; Độ cong mũi chỉ thấy ở hướng Side)"
    )

    occlusion_rules: List[str] = Field(
        default_factory=list,
        description="Quy tắc các lớp đè chồng lên nhau (Z-ordering / Occlusion rules) giữa các bộ phận ở góc nhìn này (ví dụ: Cánh tay phải nằm trước thân mình; Áo choàng phủ đè lên phía sau chân)"
    )


class DirectionAnalysis(BaseModel):
    """
    Phân tích toàn diện 3 hướng nhìn tham chiếu chuẩn của nhân vật game 2D:
    - Down: Hướng nhìn từ trước (Front/Three-Quarter front)
    - Side: Hướng nhìn ngang (Profile)
    - Up: Hướng nhìn từ sau (Back)
    """

    down: DirectionProfile = Field(
        ...,
        description="Hồ sơ phân tích góc nhìn hướng xuống (Down / Front view) - Nhìn từ trước mặt nhân vật"
    )

    side: DirectionProfile = Field(
        ...,
        description="Hồ sơ phân tích góc nhìn hướng ngang (Side / Profile view) - Nhìn từ cạnh bên nhân vật"
    )

    up: DirectionProfile = Field(
        ...,
        description="Hồ sơ phân tích góc nhìn hướng lên (Up / Back view) - Nhìn từ phía sau lưng nhân vật"
    )
