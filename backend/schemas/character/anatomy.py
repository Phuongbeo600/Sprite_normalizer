# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc & Kiểu dữ liệu)
# ========================================================
# typing: Khai báo kiểu danh sách, chuỗi và tùy chọn giá trị
from typing import List, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Định nghĩa Schema kiểm tra tính hợp lệ dữ liệu giải phẫu
from pydantic import BaseModel, Field

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class AnatomyAnalysis(BaseModel):
    """
    Phân tích cấu trúc cơ thể và các bộ phận sinh học (Anatomy Analysis).
    Mô tả định tính về mặt thị giác cấu trúc giải phẫu học của nhân vật tham chiếu.
    
    LƯU Ý THIẾT KẾ:
    Không yêu cầu AI tự đo đếm kích thước pixel, tọa độ hoặc tỷ lệ cơ thể chính xác.
    Những thông số đo lường chính xác tuyệt đối đó sẽ được động cơ Python (NumPy/OpenCV)
    tính toán tự động trong giai đoạn tiếp theo của hệ thống.
    """

    body_structure: str = Field(
        ...,
        description="Cấu trúc cơ thể tổng thể (ví dụ: Humanoid/Dạng người chuẩn 2 tay 2 chân, Quadruped/Thú bốn chân, Amorphous/Chất nhờn vô định hình, Chibi humanoid)"
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

    relative_limb_placement: str = Field(
        ...,
        description="Mô tả vị trí tương đối và mối liên kết tư thế giữa các chi so với trục thân mình (ví dụ: Hai tay buông sát thân hơi chếch ra trước, Hai chân đứng rộng bằng vai tạo thế đứng vững)"
    )

    anatomical_ambiguities: List[str] = Field(
        default_factory=list,
        description="Các bộ phận hoặc khớp nối bị che khuất, vẽ cách điệu hoặc không thể xác định cấu trúc chắc chắn từ ảnh quan sát (ví dụ: Bàn tay bị che hoàn toàn bởi tấm khiên lớn, Khớp đầu gối bị ẩn dưới váy dài)"
    )
