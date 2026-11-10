# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc, Liệt kê & Kiểu)
# ========================================================
# enum: Định nghĩa các kiểu liệt kê chuỗi chuẩn (String Enum) cho danh mục kiểm soát
from enum import Enum
# typing: Khai báo kiểu danh sách, chuỗi và tùy chọn giá trị
from typing import List, Optional, Union

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Định nghĩa Schema kiểm tra tính hợp lệ dữ liệu giải phẫu và validator
from pydantic import BaseModel, Field, field_validator

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class BodyStructure(str, Enum):
    """
    Quy chuẩn phân loại cấu trúc hình thái sinh học tổng thể của cơ thể.
    Kế thừa str để tương thích tuần tự hóa JSON và OpenAI Structured Outputs.
    """
    HUMANOID = "Humanoid (Bipedal 2 arms 2 legs)"
    CHIBI_HUMANOID = "Chibi Humanoid (Exaggerated proportions)"
    QUADRUPED = "Quadruped (4 legs)"
    AVIAN = "Avian (Winged / Bird-like)"
    AMORPHOUS = "Amorphous (Slime / Fluid)"
    MECHANICAL = "Mechanical / Robotic"
    SERPENTINE = "Serpentine / Snake-like"


class LimbPlacement(str, Enum):
    """
    Quy chuẩn thế đứng và vị trí tương đối của các chi so với trọng tâm thân mình.
    """
    GROUNDED_NEUTRAL = "Grounded Neutral Stance"
    COMBAT_READY = "Combat Ready Stance"
    FLOATING_AERIAL = "Floating / Aerial"
    CROUCHING = "Crouching / Low Stance"
    DYNAMIC_ACTION = "Dynamic Action Stance"


class AnatomyAnalysis(BaseModel):
    """
    Phân tích cấu trúc cơ thể và các bộ phận sinh học (Anatomy Analysis).
    Mô tả định tính về mặt thị giác cấu trúc giải phẫu học của nhân vật tham chiếu.
    
    LƯU Ý THIẾT KẾ:
    Không yêu cầu AI tự đo đếm kích thước pixel, tọa độ hoặc tỷ lệ cơ thể chính xác.
    Những thông số đo lường chính xác tuyệt đối do động cơ Python (NumPy/OpenCV)
    tính toán tự động trong phân hệ xử lý hình ảnh độc lập.
    """

    body_structure: Union[BodyStructure, str] = Field(
        default=BodyStructure.HUMANOID,
        description="Cấu trúc cơ thể tổng thể: Humanoid, Chibi Humanoid, Quadruped, Avian, Amorphous, Mechanical, Serpentine"
    )

    head_description: str = Field(
        ...,
        description="Hình dạng, đặc điểm giải phẫu và kích thước tương đối của phần đầu (ví dụ: Đầu tròn lớn chiếm tỷ trọng lớn, Mũ giáp sắt góc cạnh bao bọc kín hộp sọ)"
    )

    torso_description: str = Field(
        ...,
        description="Hình dáng và đặc điểm vùng thân mình (ngực, eo, bụng, lưng; ví dụ: Thân hình chữ V ngực nở eo thon, Thân hình tròn lùn mặc áo giáp nặng)"
    )

    arm_structure: Optional[str] = Field(
        default=None,
        description="Số lượng, tỷ lệ và đặc điểm của chi tay (ví dụ: Hai cánh tay cơ bắp mang găng sắt bảo hộ, Tay dài chạm đầu gối), hoặc None nếu sinh vật không có chi trên"
    )

    leg_structure: Optional[str] = Field(
        default=None,
        description="Số lượng, tỷ lệ và đặc điểm của chi chân (ví dụ: Hai chân ngắn dạng chibi mang ủng da dày, Chân dạng thú có móng vuốt), hoặc None nếu không có chân"
    )

    unusual_body_parts: List[str] = Field(
        default_factory=list,
        description="Các bộ phận cơ thể dị thường hoặc đặc biệt ngoài cấu trúc người chuẩn (ví dụ: Đôi cánh dơi sau lưng, Đuôi thằn lằn có gai, Cặp sừng cong nhọn trên đầu)"
    )

    identifiable_landmarks: List[str] = Field(
        default_factory=list,
        description="Các mốc giải phẫu quan trọng có thể nhận diện rõ trên sprite (ví dụ: Khớp vai, Đường phân cách cổ, Điểm gập khuỷu tay, Khớp háng/thắt lưng, Điểm gót chân chạm đất)"
    )

    relative_limb_placement: Union[LimbPlacement, str] = Field(
        default=LimbPlacement.GROUNDED_NEUTRAL,
        description="Mô tả vị trí tương đối và mối liên kết tư thế giữa các chi: Grounded Neutral Stance, Combat Ready Stance, Floating / Aerial, Crouching / Low Stance, Dynamic Action Stance"
    )

    anatomical_ambiguities: List[str] = Field(
        default_factory=list,
        description="Các bộ phận hoặc khớp nối bị che khuất, vẽ cách điệu hoặc không thể xác định cấu trúc chắc chắn từ ảnh quan sát (ví dụ: Bàn tay bị che hoàn toàn bởi tấm khiên lớn, Khớp đầu gối bị ẩn dưới váy dài)"
    )

    # ========================================================
    # BỘ CHUẨN HÓA DỮ LIỆU TỰ ĐỘNG (Field Validators)
    # ========================================================
    @field_validator("body_structure", mode="before")
    @classmethod
    def normalize_body_structure(cls, v):
        """Tự động ánh xạ chuỗi cấu trúc cơ thể sang Enum BodyStructure chuẩn."""
        if isinstance(v, str):
            clean = v.lower()
            if "chibi" in clean:
                return BodyStructure.CHIBI_HUMANOID
            if "humanoid" in clean or "người" in clean:
                return BodyStructure.HUMANOID
            if "quadruped" in clean or "bốn chân" in clean or "thú" in clean:
                return BodyStructure.QUADRUPED
            if "avian" in clean or "chim" in clean or "cánh" in clean:
                return BodyStructure.AVIAN
            if "amorphous" in clean or "nhờn" in clean or "slime" in clean:
                return BodyStructure.AMORPHOUS
            if "mech" in clean or "robot" in clean or "máy" in clean:
                return BodyStructure.MECHANICAL
            if "serpent" in clean or "snake" in clean or "rắn" in clean:
                return BodyStructure.SERPENTINE
        return v

    @field_validator("relative_limb_placement", mode="before")
    @classmethod
    def normalize_limb_placement(cls, v):
        """Tự động ánh xạ chuỗi tư thế sang Enum LimbPlacement chuẩn."""
        if isinstance(v, str):
            clean = v.lower()
            if "combat" in clean or "chiến đấu" in clean or "thủ thế" in clean:
                return LimbPlacement.COMBAT_READY
            if "float" in clean or "bay" in clean or "lơ lửng" in clean:
                return LimbPlacement.FLOATING_AERIAL
            if "crouch" in clean or "ngồi" in clean or "nhún" in clean:
                return LimbPlacement.CROUCHING
            if "action" in clean or "chạy" in clean or "nhảy" in clean:
                return LimbPlacement.DYNAMIC_ACTION
            if "ground" in clean or "đứng" in clean or "bằng vai" in clean:
                return LimbPlacement.GROUNDED_NEUTRAL
        return v
