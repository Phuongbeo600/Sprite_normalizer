# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc & Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa các kiểu danh sách, chuỗi, số nguyên và tùy chọn
from typing import List, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Định nghĩa Schema kiểm tra tính hợp lệ dữ liệu phong cách pixel
from pydantic import BaseModel, Field

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class PixelStyleAnalysis(BaseModel):
    """
    Phân tích phong cách mỹ thuật Pixel Art (Pixel Style Analysis).
    Mô tả định tính về mặt thẩm mỹ pixel, kỹ thuật viền (outlines), cách thức phân mảng sáng tối (shading),
    cụm hạt pixel (pixel clustering) và hướng nguồn sáng chủ đạo.
    
    LƯU Ý THIẾT KẾ:
    Không yêu cầu AI tự đếm chính xác số màu trong palette, đo bề dày viền theo pixel hay trích xuất mã màu HEX.
    Những thông số định lượng này sẽ do các thuật toán xử lý ảnh Python thực hiện độc lập.
    """

    art_style: str = Field(
        ...,
        description="Mô tả phong cách mỹ thuật tổng thể (ví dụ: Retro 8-bit NES, 16-bit SNES/GBA JRPG cổ điển, 32-bit Arcade Neo-Geo, Hiện đại/Modern indie pixel art)"
    )

    outline_style: str = Field(
        ...,
        description="Đặc điểm của đường viền bao quanh nhân vật (ví dụ: Black outline viền đen tuyền, Selective outline/Selout viền đổi màu theo mảng sáng tối, No outline không viền, Viền bán trong suốt)"
    )

    shading_style: str = Field(
        ...,
        description="Phong cách đổ bóng chủ đạo (ví dụ: Flat shading/Mảng màu phẳng đơn giản, Cel-shading/Phân tách sáng tối tương phản gắt sắc sảo, Soft ramp/Chuyển sắc mượt, Pillow shading/Đổ bóng gối viền)"
    )

    shading_levels: Optional[int] = Field(
        default=None,
        description="Số lượng mức độ sáng/tối đổ bóng ước lượng trên mỗi dải màu chính (ví dụ: 2-tone gồm mảng sáng và mảng tối, 3-tone gồm highlight-mid-shadow), hoặc None nếu không xác định được rõ ràng"
    )

    dithering_style: Optional[str] = Field(
        default=None,
        description="Đặc điểm kỹ thuật hòa trộn hạt (Dithering) nếu có sử dụng (ví dụ: Checkerboard pattern/Hạt so le bàn cờ, Line dithering/Đường sọc đan xen, None/Không dùng dithering)"
    )

    pixel_cluster_style: str = Field(
        ...,
        description="Đặc trưng cách thức tổ chức các cụm pixel (Pixel Clustering) (ví dụ: Chunky clusters/Cụm khối to bản rõ ràng dễ đọc, Micro clusters/Cụm hạt nhỏ tỉ mỉ, Long continuous strokes/Nét chuỗi hạt liền)"
    )

    detail_density: str = Field(
        ...,
        description="Mức độ dày đặc của các chi tiết nhỏ trên bề mặt nhân vật (ví dụ: Minimalist/Tối giản tinh gọn khối to, Moderate/Mức độ vừa phải chuẩn game retro, High density/Dày đặc chi tiết tinh xảo)"
    )

    pixel_cleanliness: str = Field(
        ...,
        description="Độ sắc nét và tính kỷ luật trong cách đặt hạt pixel (ví dụ: Very clean/Nét sạch không có hạt mồ côi (orphan pixel) hay gãy khúc (jaggies), Hand-crafted/Vẽ tay thủ công mượt mà, Noisy/Nhiều hạt phân tán)"
    )

    lighting_direction: Optional[str] = Field(
        default=None,
        description="Hướng chiếu sáng chính quan sát được trên nhân vật (ví dụ: Top-left/Từ trên cao góc trái, Frontal/Chiếu thẳng diện mạo, Top-down/Chiếu đỉnh đầu xuống, None nếu ánh sáng tản đều đa hướng)"
    )

    visual_artifacts: List[str] = Field(
        default_factory=list,
        description="Các lỗi hoặc dấu hiệu bất thường quan sát thấy trong cấu trúc pixel art (ví dụ: Stray pixel/Pixel lạc màu ngẫu nhiên, Double outline/Viền kép thừa thãi, Jaggies/Đường chéo gãy nhấp nhô, Nhòe do nén JPG)"
    )
