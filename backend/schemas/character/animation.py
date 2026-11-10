# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc, Liệt kê & Kiểu)
# ========================================================
# enum: Định nghĩa kiểu liệt kê chuỗi chuẩn (String Enum)
from enum import Enum
# typing: Định nghĩa các kiểu danh sách, chuỗi và tùy chọn
from typing import List, Optional, Union

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Định nghĩa Schema kiểm tra tính hợp lệ dữ liệu hoạt họa animation và validator
from pydantic import BaseModel, Field, field_validator

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class AnimationType(str, Enum):
    """
    Phân loại các trạng thái chuyển động cốt lõi của Sprite nhân vật game.
    Kế thừa str để đảm bảo tuần tự hóa JSON và OpenAI Structured Outputs.
    """
    IDLE = "Idle"
    WALK = "Walk"


class LoopCharacteristics(str, Enum):
    """
    Quy chuẩn đặc tính lặp vòng của hoạt họa chuyển động.
    """
    SEAMLESS = "Seamless Loop"
    PING_PONG = "Ping-Pong Loop"
    ONE_SHOT = "One-Shot"


class AnimationProfile(BaseModel):
    """
    Hồ sơ phân tích chuyển động cho một hành động cụ thể (Idle hoặc Walk).
    Đo lường sự thay đổi tư thế, các bộ phận động, các bộ phận tĩnh và chu kỳ lặp
    dựa trên các frame hình ảnh tham chiếu thực tế.
    
    LƯU Ý THIẾT KẾ:
    Tuyệt đối không tự động gán mặc định chu trình đi bộ (Walk Cycle) là Contact -> Passing -> Opposite Contact -> Passing.
    AI phải phân tích và ghi nhận thứ tự tư thế động học thực tế diễn ra qua từng frame ảnh đầu vào.
    """

    animation_type: AnimationType = Field(
        ...,
        description="Loại chuyển động được phân tích: Idle (Đứng thở/chờ) hoặc Walk (Bước đi)"
    )

    frame_count: int = Field(
        ...,
        ge=1,
        description="Số lượng frame ảnh đầu vào thực tế được phân tích cho chuyển động này (ví dụ: 3 frame cho Idle, 4 frame cho Walk)"
    )

    frame_descriptions: List[str] = Field(
        default_factory=list,
        description="Danh sách mô tả chi tiết tư thế của từng frame theo đúng thứ tự thời gian xuất hiện (Frame 1 -> Frame N)"
    )

    moving_body_parts: List[str] = Field(
        default_factory=list,
        description="Danh sách các bộ phận cơ thể có sự dịch chuyển tọa độ hoặc thay đổi hình dạng qua các frame (ví dụ: Cẳng chân phải, Bàn tay trái, Tà áo choàng, Ngực nhấp nhô)"
    )

    fixed_body_parts: List[str] = Field(
        default_factory=list,
        description="Danh sách các bộ phận cơ thể tương đối cố định hoặc giữ nguyên trục tọa độ chính qua các frame (ví dụ: Hộp sọ đầu, Trục sống lưng, Tay cầm khiên)"
    )

    leg_motion: Optional[str] = Field(
        default=None,
        description="Mô tả động học chi tiết chuyển động của chân và bàn chân qua từng frame (ví dụ: Chân trái bước tới gập gối, chân phải làm trụ đẩy gót), hoặc None nếu Idle đứng yên"
    )

    arm_motion: Optional[str] = Field(
        default=None,
        description="Mô tả động học chi tiết chuyển động của tay và vai qua từng frame (ví dụ: Đánh tay so le nhịp nhàng theo bước chân), hoặc None nếu tay bất động"
    )

    secondary_motion: Optional[str] = Field(
        default=None,
        description="Chuyển động phụ bổ trợ quán tính (Secondary Animation) như tà áo choàng phấp phới, tóc bay, dây thắt lưng đung đưa, thanh kiếm nhấp nhô theo nhịp thở"
    )

    motion_sequence: str = Field(
        ...,
        description="Mô tả toàn bộ trình tự và nhịp điệu của chu kỳ chuyển động quan sát thực tế từ frame đầu đến frame cuối"
    )

    loop_characteristics: Union[LoopCharacteristics, str] = Field(
        default=LoopCharacteristics.SEAMLESS,
        description="Đặc điểm lặp của chuyển động: Seamless Loop, Ping-Pong Loop, One-Shot"
    )

    observed_inconsistencies: List[str] = Field(
        default_factory=list,
        description="Những điểm sai khác, lỗi mất đồng bộ pixel hoặc biến dạng thể tích bất thường phát hiện thấy giữa các frame tham chiếu"
    )

    # ========================================================
    # BỘ CHUẨN HÓA DỮ LIỆU TỰ ĐỘNG (Field Validators)
    # ========================================================
    @field_validator("loop_characteristics", mode="before")
    @classmethod
    def normalize_loop(cls, v):
        """Tự động ánh xạ chuỗi đặc tính lặp sang Enum LoopCharacteristics chuẩn."""
        if isinstance(v, str):
            clean = v.lower()
            if "ping" in clean or "pong" in clean or "đổi chiều" in clean:
                return LoopCharacteristics.PING_PONG
            if "one" in clean or "shot" in clean or "đơn" in clean:
                return LoopCharacteristics.ONE_SHOT
            if "seamless" in clean or "mượt" in clean or "hoàn hảo" in clean:
                return LoopCharacteristics.SEAMLESS
        return v


class DirectionAnimation(BaseModel):
    """
    Tập hợp chuyển động Idle và Walk cho một hướng nhìn cụ thể (ví dụ: Hướng Down).
    """

    idle: AnimationProfile = Field(
        ...,
        description="Hồ sơ phân tích hoạt họa trạng thái đứng chờ (Idle) ở hướng nhìn này"
    )

    walk: AnimationProfile = Field(
        ...,
        description="Hồ sơ phân tích hoạt họa trạng thái bước đi (Walk) ở hướng nhìn này"
    )


class AnimationAnalysis(BaseModel):
    """
    Phân tích toàn diện hệ thống chuyển động (Animation System) của nhân vật
    theo đầy đủ 3 hướng nhìn tham chiếu chuẩn (Down, Side, Up).
    """

    down: DirectionAnimation = Field(
        ...,
        description="Hệ thống chuyển động Idle và Walk cho góc nhìn hướng xuống (Down / Front view)"
    )

    side: DirectionAnimation = Field(
        ...,
        description="Hệ thống chuyển động Idle và Walk cho góc nhìn hướng ngang (Side / Profile view)"
    )

    up: DirectionAnimation = Field(
        ...,
        description="Hệ thống chuyển động Idle và Walk cho góc nhìn hướng lên (Up / Back view)"
    )
