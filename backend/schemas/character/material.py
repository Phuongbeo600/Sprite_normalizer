# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc, Liệt kê & Kiểu)
# ========================================================
# enum: Định nghĩa kiểu liệt kê chuỗi chuẩn (String Enum) cho danh mục kiểm soát
from enum import Enum
# typing: Định nghĩa các kiểu tùy chọn và hợp nhất kiểu
from typing import Optional, Union

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Định nghĩa Schema kiểm tra tính hợp lệ dữ liệu chất liệu và validator
from pydantic import BaseModel, Field, field_validator

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class MaterialType(str, Enum):
    """
    Danh mục phân loại các loại chất liệu bề mặt phổ biến trong thiết kế nhân vật game.
    Kế thừa str để đảm bảo khả năng tương thích tuần tự hóa JSON và OpenAI Structured Outputs.
    """
    SKIN = "Skin"
    METAL = "Metal"
    CLOTH = "Cloth"
    LEATHER = "Leather"
    FUR = "Fur"
    BONE = "Bone"
    MAGICAL_GLOW = "Magical Glow"
    OTHER = "Other"


class Reflectivity(str, Enum):
    """
    Quy chuẩn mức độ phản xạ ánh sáng của bề mặt chất liệu.
    """
    MATTE = "Matte (No shine)"
    SEMI_GLOSS = "Semi-Gloss (Subtle sheen)"
    METALLIC = "Metallic (High specular highlights)"
    GLOSSY = "Glossy / Glass (Sharp highlights)"
    EMISSIVE = "Emissive / Glowing (Self-illuminating)"


class PixelTexture(str, Enum):
    """
    Quy chuẩn đặc trưng họa tiết bề mặt thể hiện qua sự sắp xếp hạt pixel.
    """
    SMOOTH = "Smooth (Even tone)"
    ROUGH = "Rough / Grainy (Textured surface)"
    FIBROUS = "Fibrous (Woven cloth/fabric)"
    SCALY = "Scaly / Segmented (Reptile/Plating)"
    ORGANIC = "Organic / Soft flesh"


class MaterialAnalysis(BaseModel):
    """
    Phân tích chất liệu theo từng vùng giải phẫu hoặc trang phục của nhân vật (Material Analysis).
    Một nhân vật sẽ bao gồm danh sách nhiều vùng chất liệu khác nhau (ví dụ: Giáp sắt, Áo choàng vải, Da mặt).
    """

    region_name: str = Field(
        ...,
        description="Tên vùng trên cơ thể hoặc trang phục của nhân vật (ví dụ: Tấm giáp ngực kim loại, Găng tay da, Áo choàng lụa, Da mặt và cánh tay)"
    )

    material_type: MaterialType = Field(
        ...,
        description="Loại chất liệu bề mặt: Skin, Metal, Cloth, Leather, Fur, Bone, Magical Glow hoặc Other"
    )

    color_description: str = Field(
        ...,
        description="Mô tả cảm nhận thị giác về màu sắc chủ đạo của vùng (ví dụ: Màu xám thép ánh bạc lạnh, Màu đỏ nhung sẫm, Màu da rám nắng)"
    )

    shadow_description: Optional[str] = Field(
        default=None,
        description="Đặc điểm sắc thái của vùng tối trên chất liệu (ví dụ: Vùng tối ngả xanh đậm tạo chiều sâu kim loại, Đổ bóng xám đất mềm trên vải), hoặc None nếu vùng phẳng sáng đều"
    )

    highlight_description: Optional[str] = Field(
        default=None,
        description="Đặc điểm vùng sáng phản quang (Highlight) (ví dụ: Đốm sáng trắng gắt (specular highlight) ở gờ mép kim loại, Vệt sáng mờ nhạt trên bề mặt da lì), hoặc None nếu chất liệu không có highlight"
    )

    reflectivity: Union[Reflectivity, str] = Field(
        default=Reflectivity.MATTE,
        description="Mức độ và tính chất phản xạ ánh sáng: Matte (No shine), Semi-Gloss, Metallic, Glossy, Emissive"
    )

    pixel_texture: Union[PixelTexture, str] = Field(
        default=PixelTexture.SMOOTH,
        description="Đặc trưng họa tiết bề mặt pixel: Smooth (Even tone), Rough / Grainy, Fibrous (Fabric), Scaly / Segmented, Organic"
    )

    shading_description: str = Field(
        ...,
        description="Cách thức xử lý kỹ thuật đổ bóng đặc trưng cho chất liệu này (ví dụ: Chuyển sắc tương phản gắt tạo khối sắc nhọn cho sắt thép, Mảng chuyển sắc rộng mềm mại cho nếp gấp áo vải)"
    )

    # ========================================================
    # BỘ CHUẨN HÓA DỮ LIỆU TỰ ĐỘNG (Field Validators)
    # ========================================================
    @field_validator("reflectivity", mode="before")
    @classmethod
    def normalize_reflectivity(cls, v):
        """Tự động ánh xạ chuỗi phản xạ sang Enum Reflectivity chuẩn."""
        if isinstance(v, str):
            clean = v.lower()
            if "metal" in clean or "kim loại" in clean:
                return Reflectivity.METALLIC
            if "semi" in clean or "sheen" in clean:
                return Reflectivity.SEMI_GLOSS
            if "emissive" in clean or "glow" in clean or "phát sáng" in clean:
                return Reflectivity.EMISSIVE
            if "gloss" in clean or "bóng" in clean:
                return Reflectivity.GLOSSY
            if "matte" in clean or "lì" in clean or "phẳng" in clean:
                return Reflectivity.MATTE
        return v

    @field_validator("pixel_texture", mode="before")
    @classmethod
    def normalize_pixel_texture(cls, v):
        """Tự động ánh xạ chuỗi họa tiết pixel sang Enum PixelTexture chuẩn."""
        if isinstance(v, str):
            clean = v.lower()
            if "rough" in clean or "grain" in clean or "sần" in clean or "ráp" in clean:
                return PixelTexture.ROUGH
            if "fib" in clean or "fabric" in clean or "vải" in clean or "dệt" in clean:
                return PixelTexture.FIBROUS
            if "scale" in clean or "scaly" in clean or "vảy" in clean or "plate" in clean:
                return PixelTexture.SCALY
            if "organic" in clean or "thịt" in clean:
                return PixelTexture.ORGANIC
            if "smooth" in clean or "mịn" in clean or "phẳng" in clean:
                return PixelTexture.SMOOTH
        return v
