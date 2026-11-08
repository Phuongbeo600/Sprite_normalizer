# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc, Liệt kê & Kiểu)
# ========================================================
# enum: Định nghĩa kiểu liệt kê chuỗi chuẩn (String Enum)
from enum import Enum
# typing: Định nghĩa các kiểu tùy chọn
from typing import Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Định nghĩa Schema kiểm tra tính hợp lệ dữ liệu chất liệu
from pydantic import BaseModel, Field

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

    reflectivity: str = Field(
        ...,
        description="Mức độ và tính chất phản xạ ánh sáng của bề mặt (ví dụ: Matte/Lì hoàn toàn không bóng, Semi-gloss/Bóng mờ vừa phải, High-reflectivity metallic/Kim loại phản chiếu sắc nét)"
    )

    pixel_texture: str = Field(
        ...,
        description="Đặc trưng họa tiết bề mặt thể hiện qua sự sắp xếp pixel (ví dụ: Smooth/Mịn phẳng mượt mà, Rough grain/Hạt ráp sần sùi, Fibrous/Sợi dệt vải, Scaly/Vảy sừng nhấp nhô)"
    )

    shading_description: str = Field(
        ...,
        description="Cách thức xử lý kỹ thuật đổ bóng đặc trưng cho chất liệu này (ví dụ: Chuyển sắc tương phản gắt tạo khối sắc nhọn cho sắt thép, Mảng chuyển sắc rộng mềm mại cho nếp gấp áo vải)"
    )
