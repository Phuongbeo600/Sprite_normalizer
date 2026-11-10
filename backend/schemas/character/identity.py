# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc, Liệt kê & Kiểu)
# ========================================================
# enum: Định nghĩa các kiểu liệt kê chuỗi chuẩn (String Enum) cho danh mục kiểm soát
from enum import Enum
# typing: Định nghĩa các kiểu danh sách, chuỗi và tùy chọn giá trị
from typing import List, Optional, Union

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Định nghĩa Schema kiểm tra tính hợp lệ dữ liệu và trình kiểm tra trường dữ liệu
from pydantic import BaseModel, Field, field_validator

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class GenderPresentation(str, Enum):
    """
    Phân loại giới tính thể hiện qua ngôn ngữ thiết kế thị giác.
    Kế thừa str để tương thích tuần tự hóa JSON và OpenAI Structured Outputs.
    """
    MASCULINE = "Masculine"
    FEMININE = "Feminine"
    ANDROGYNOUS = "Androgynous"
    NON_BINARY = "Non-Binary / Agender"
    UNSPECIFIED = "Unspecified / Creature"


class BodyType(str, Enum):
    """
    Phân loại vóc dáng và tỷ lệ giải phẫu học cơ thể nhân vật.
    """
    CHIBI = "Chibi (2.0 - 2.5 heads)"
    SEMI_CHIBI = "Semi-Chibi (3.0 - 3.5 heads)"
    SLENDER = "Slender / Slim"
    REGULAR = "Regular / Average"
    BULKY = "Bulky / Muscular"
    HEROIC = "Heroic (5.0+ heads)"
    PETITE = "Petite / Small"


class ShapeLanguage(str, Enum):
    """
    Ngôn ngữ hình khối chủ đạo được sử dụng trong thiết kế sprite.
    """
    ANGULAR = "Angular (Sharp, dangerous, rigid)"
    ROUNDED = "Rounded (Soft, friendly, bouncy)"
    HEAVY_BLOCK = "Heavy / Blocky (Sturdy, solid)"
    CURVED = "Curved / Fluid (Agile, dynamic)"


class IdentityAnalysis(BaseModel):
    """
    Phân tích danh tính và đặc điểm nhận diện nhân vật (Identity Analysis).
    Thu thập các thông tin thị giác tổng quát về chủng loại, giới tính, vóc dáng,
    ngôn ngữ hình khối và các phụ kiện đặc trưng của nhân vật tham chiếu.
    """

    character_type: str = Field(
        ...,
        description="Loại hoặc danh mục nhân vật (ví dụ: Chiến binh dũng sĩ, Pháp sư bóng tối, Yêu tinh Goblin, Người máy sinh học)"
    )

    gender_presentation: Optional[Union[GenderPresentation, str]] = Field(
        default=None,
        description="Giới tính thể hiện qua thiết kế ngoại hình: Masculine, Feminine, Androgynous, Non-Binary / Agender, Unspecified / Creature hoặc null"
    )

    body_type: Optional[Union[BodyType, str]] = Field(
        default=None,
        description="Vóc dáng và thể hình của nhân vật: Chibi (2.0 - 2.5 heads), Semi-Chibi (3.0 - 3.5 heads), Slender / Slim, Regular / Average, Bulky / Muscular, Heroic, Petite hoặc null"
    )

    distinctive_features: List[str] = Field(
        default_factory=list,
        description="Danh sách các đặc điểm nhận diện đặc trưng độc nhất (ví dụ: Vết sẹo dài qua mắt trái, Mũ trùm che nửa mặt, Râu dài màu xám tro, Mắt phát sáng xanh)"
    )

    silhouette: str = Field(
        ...,
        description="Mô tả hình dáng bóng tổng thể (Silhouette) của nhân vật khi nhìn từ xa (ví dụ: Hình tam giác vững chãi với áo choàng xòe rộng, Hình thon dài thanh mảnh)"
    )

    shape_language: List[Union[ShapeLanguage, str]] = Field(
        default_factory=list,
        description="Các đặc trưng ngôn ngữ hình khối chủ đạo: Angular, Rounded, Heavy / Blocky, Curved / Fluid"
    )

    facial_features: Optional[str] = Field(
        default=None,
        description="Mô tả chi tiết các đặc điểm khuôn mặt nhận diện được (màu mắt, kiểu tóc, râu, biểu cảm gương mặt), hoặc None nếu mặt bị che khuất hoàn toàn bởi mặt nạ/mũ giáp"
    )

    costume_description: str = Field(
        ...,
        description="Mô tả chi tiết trang phục, áo giáp và thiết kế phục trang tổng thể của nhân vật"
    )

    accessories: List[str] = Field(
        default_factory=list,
        description="Danh sách phụ kiện, vũ khí hoặc trang bị đi kèm (ví dụ: Thanh trường kiếm đeo lưng, Túi phép thuật bên hông, Dây chuyền bùa chú)"
    )

    # ========================================================
    # BỘ CHUẨN HÓA DỮ LIỆU TỰ ĐỘNG (Field Validators)
    # ========================================================
    @field_validator("gender_presentation", mode="before")
    @classmethod
    def normalize_gender(cls, v):
        """Tự động ánh xạ chuỗi giới tính sang Enum GenderPresentation chuẩn."""
        if isinstance(v, str):
            clean = v.lower()
            if "masculine" in clean or "nam" in clean:
                return GenderPresentation.MASCULINE
            if "feminine" in clean or "nữ" in clean:
                return GenderPresentation.FEMININE
            if "androgynous" in clean or "trung tính" in clean:
                return GenderPresentation.ANDROGYNOUS
            if "non-binary" in clean or "phi giới tính" in clean:
                return GenderPresentation.NON_BINARY
            if "creature" in clean or "không xác định" in clean or "unspecified" in clean:
                return GenderPresentation.UNSPECIFIED
        return v

    @field_validator("body_type", mode="before")
    @classmethod
    def normalize_body_type(cls, v):
        """Tự động ánh xạ chuỗi vóc dáng sang Enum BodyType chuẩn."""
        if isinstance(v, str):
            clean = v.lower()
            if "chibi" in clean and ("semi" in clean or "3" in clean):
                return BodyType.SEMI_CHIBI
            if "chibi" in clean or "lùn" in clean or "2." in clean:
                return BodyType.CHIBI
            if "bulky" in clean or "muscular" in clean or "vạm vỡ" in clean or "cơ bắp" in clean:
                return BodyType.BULKY
            if "slender" in clean or "slim" in clean or "thanh mảnh" in clean:
                return BodyType.SLENDER
            if "heroic" in clean or "tall" in clean or "cao" in clean:
                return BodyType.HEROIC
            if "petite" in clean or "nhỏ" in clean:
                return BodyType.PETITE
            if "regular" in clean or "average" in clean:
                return BodyType.REGULAR
        return v
