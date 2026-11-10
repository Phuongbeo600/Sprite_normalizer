# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc, Liệt kê & Kiểu)
# ========================================================
# typing: Định nghĩa các kiểu danh sách, chuỗi, số thực và tùy chọn
from typing import List, Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Định nghĩa Schema kiểm tra tính hợp lệ dữ liệu phân tích bảng màu
from pydantic import BaseModel, Field

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class DominantColorItem(BaseModel):
    """Mô tả một mã màu chủ đạo trong bảng màu của Sprite."""
    hex_code: str = Field(..., description="Mã màu định dạng HEX (ví dụ: #8b5cf6)")
    rgb: List[int] = Field(..., description="Giá trị 3 kênh [R, G, B]")
    pixel_count: int = Field(..., description="Số lượng pixel sử dụng màu này")
    percentage: float = Field(..., description="Tỷ lệ phần trăm diện tích chiếm trên nhân vật")
    role: str = Field(default="Base", description="Vai trò: Base (Nền), Shadow (Bóng), Highlight (Sáng), Outline (Viền)")


class PaletteMetrics(BaseModel):
    """
    Hồ sơ đo lường và phân tích hệ màu sắc của Sprite bằng thuật toán Python:
    Đo đạc 100% chính xác 6 tiêu chí kỹ thuật phục vụ đồng bộ hóa nhân vật mới với nhân vật cũ.
    """
    # Tiêu chí 1: Tổng số lượng màu thực tế
    total_colors: int = Field(..., description="Tổng số lượng màu độc nhất (Unique colors) trong ảnh")
    palette_era: str = Field(default="16-bit SNES / GBA", description="Phân loại chuẩn bảng màu game")

    # Tiêu chí 2: Danh sách các mã màu chủ đạo
    dominant_colors: List[DominantColorItem] = Field(default_factory=list, description="Danh sách các màu chủ đạo xếp theo tỷ lệ diện tích")
    top_hex_list: List[str] = Field(default_factory=list, description="Danh sách các mã HEX xuất hiện nhiều nhất")

    # Tiêu chí 3: Số bậc đổ bóng
    shading_steps: int = Field(default=2, description="Số nấc đổ bóng đo được trên mỗi mảng màu (2-Tone hoặc 3-Tone)")
    shading_style_detected: str = Field(default="2-Tone Cel-Shading", description="Phong cách đổ bóng đo được")

    # Tiêu chí 4: Kỹ thuật dịch sắc độ (Hue-Shifting)
    hue_shifting_detected: bool = Field(default=False, description="Phát hiện kỹ thuật dịch màu bóng sang gam lạnh hay không")
    hue_shift_description: str = Field(default="Straight shading", description="Mô tả kỹ thuật dịch màu đo được")

    # Tiêu chí 5: Quy chuẩn màu đường viền
    outline_style_detected: str = Field(default="Selective Outline (Selout)", description="Kiểu màu viền đo được")

    # Tiêu chí 6: Độ bão hòa & Độ tương phản
    average_saturation: float = Field(default=0.5, description="Độ bão hòa màu trung bình từ 0.0 đến 1.0")
    saturation_type: str = Field(default="Vibrant Retro Saturation", description="Đánh giá mức độ đậm màu")
    contrast_ratio: float = Field(default=4.5, description="Tỷ lệ tương phản ánh sáng giữa điểm sáng nhất và tối nhất")
    contrast_type: str = Field(default="High Contrast", description="Đánh giá mức tương phản")

    # Câu lệnh Prompt quy chuẩn màu sắc chung sinh ra từ 6 tiêu chí này
    master_color_prompt: str = Field(default="", description="Đoạn prompt tiếng Anh chuẩn mô tả toàn bộ hệ màu")
