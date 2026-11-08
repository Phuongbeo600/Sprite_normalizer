# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc & Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa các kiểu danh sách, chuỗi và tùy chọn giá trị
from typing import List, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Định nghĩa Schema kiểm tra tính hợp lệ dữ liệu và tài liệu hóa trường
from pydantic import BaseModel, Field

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


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

    gender_presentation: Optional[str] = Field(
        default=None,
        description="Giới tính thể hiện qua thiết kế ngoại hình nếu nhận diện được (ví dụ: Nam tính/Masculine, Nữ tính/Feminine, Trung tính/Androgynous), hoặc None nếu không rõ hoặc là sinh vật không giới tính"
    )

    body_type: Optional[str] = Field(
        default=None,
        description="Vóc dáng và thể hình của nhân vật (ví dụ: Bulky/Vạm vỡ cơ bắp, Slim/Mảnh khảnh thon gọn, Petite/Nhỏ nhắn, Chibi/Đầu to thân lùn)"
    )

    distinctive_features: List[str] = Field(
        default_factory=list,
        description="Danh sách các đặc điểm nhận diện đặc trưng độc nhất (ví dụ: Vết sẹo dài qua mắt trái, Mũ trùm che nửa mặt, Râu dài màu xám tro, Mắt phát sáng xanh)"
    )

    silhouette: str = Field(
        ...,
        description="Mô tả hình dáng bóng tổng thể (Silhouette) của nhân vật khi nhìn từ xa (ví dụ: Hình tam giác vững chãi với áo choàng xòe rộng, Hình thon dài thanh mảnh)"
    )

    shape_language: List[str] = Field(
        default_factory=list,
        description="Các đặc trưng ngôn ngữ hình khối chủ đạo được sử dụng trong thiết kế (ví dụ: Angular/Góc cạnh sắc bén thể hiện nguy hiểm, Rounded/Bo tròn thể hiện thân thiện, Heavy/Khối hộp nặng nề)"
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
