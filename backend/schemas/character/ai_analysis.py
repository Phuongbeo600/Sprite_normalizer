# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc & Kiểu dữ liệu)
# ========================================================
# typing: Khai báo kiểu danh sách
from typing import List

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Định nghĩa Schema kiểm tra tính hợp lệ dữ liệu tổng hợp
from pydantic import BaseModel, Field

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Character Sub-schemas)
# ========================================================
# IdentityAnalysis: Phân tích danh tính và ngoại hình tổng quát
from .identity import IdentityAnalysis
# AnatomyAnalysis: Phân tích cấu trúc giải phẫu sinh học
from .anatomy import AnatomyAnalysis
# PixelStyleAnalysis: Phân tích phong cách mỹ thuật pixel
from .pixel_style import PixelStyleAnalysis
# MaterialAnalysis: Phân tích chất liệu từng vùng
from .material import MaterialAnalysis
# DirectionAnalysis: Phân tích 3 hướng nhìn Down, Side, Up
from .direction import DirectionAnalysis
# AnimationAnalysis: Phân tích chuyển động Idle và Walk theo 3 hướng
from .animation import AnimationAnalysis

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class GlobalAnalysis(BaseModel):
    """
    Phân tích tổng thể toàn cục (Global Analysis) của nhân vật tham chiếu.
    Gom nhóm toàn bộ các đặc trưng bất biến về danh tính, cấu trúc giải phẫu học,
    phong cách đồ họa pixel art và danh sách chất liệu các vùng.
    """

    identity: IdentityAnalysis = Field(
        ...,
        description="Đặc điểm nhận diện, chủng loại, vóc dáng, ngôn ngữ hình khối và phục trang"
    )

    anatomy: AnatomyAnalysis = Field(
        ...,
        description="Cấu trúc giải phẫu sinh học, tỷ lệ tương đối giữa các chi và các mốc cơ thể"
    )

    pixel_style: PixelStyleAnalysis = Field(
        ...,
        description="Phong cách đồ họa pixel art, kỹ thuật đường viền, phân mảng đổ bóng và nguồn sáng"
    )

    materials: List[MaterialAnalysis] = Field(
        default_factory=list,
        description="Danh sách phân tích chất liệu theo từng vùng cơ thể và trang phục trên nhân vật"
    )


class ConsistencyAnalysis(BaseModel):
    """
    Phân tích tính nhất quán (Consistency Analysis) giữa các hướng nhìn và frame chuyển động.
    Xác định rõ những gì bắt buộc giữ nguyên, những gì được phép thay đổi theo góc nhìn/động học,
    và các yêu cầu bảo toàn cốt lõi khi tạo asset nhân vật mới.
    """

    invariant_features: List[str] = Field(
        default_factory=list,
        description="Những đặc điểm nhận diện bắt buộc phải giữ nguyên tuyệt đối giữa mọi góc nhìn và frame (ví dụ: Màu tóc vàng ánh kim, Biểu tượng chữ thập trên khiên, Vết sẹo trên mặt)"
    )

    view_dependent_features: List[str] = Field(
        default_factory=list,
        description="Những đặc điểm thay đổi hợp lệ theo góc xoay của nhân vật (ví dụ: Khi xoay Up thì thấy búi tóc sau đầu và lưng áo giáp, Khi xoay Down thì thấy khuôn mặt)"
    )

    animation_dependent_features: List[str] = Field(
        default_factory=list,
        description="Những đặc điểm thay đổi hợp lệ do chuyển động động học gây ra (ví dụ: Tà áo choàng bay lệch theo hướng bước chân, Bắp chân phình nhẹ khi gập gối)"
    )

    detected_inconsistencies: List[str] = Field(
        default_factory=list,
        description="Những sai lệch hoặc bất thường không mong muốn phát hiện được giữa các asset tham chiếu (ví dụ: Kiếm ở hướng Side ngắn hơn 2 pixel so với hướng Down, Thiếu bóng đổ ở frame 3)"
    )

    preservation_requirements: List[str] = Field(
        default_factory=list,
        description="Những nguyên tắc và đặc điểm cốt lõi cần bảo toàn tuyệt đối khi sinh asset nhân vật mới để đảm bảo tính đồng bộ hoàn hảo trong game"
    )


class NegativeConstraints(BaseModel):
    """
    Các ràng buộc phủ định (Negative Constraints) cho quá trình sinh asset mới.
    Định nghĩa những thay đổi, lỗi đồ họa hoặc lỗi hoạt họa bắt buộc phải né tránh.
    """

    forbidden_design_changes: List[str] = Field(
        default_factory=list,
        description="Các thay đổi thiết kế cấm kỵ làm mất đi tính nhận diện thương hiệu của nhân vật (ví dụ: Không được đổi màu giáp từ bạc sang vàng, Không được bỏ mũ trùm, Không được thay đổi chiều dài vũ khí)"
    )

    visual_defects_to_avoid: List[str] = Field(
        default_factory=list,
        description="Các lỗi đồ họa pixel art cần tránh (ví dụ: Viền bị đứt đoạn gãy khúc, Nguồn sáng bị ngược hướng với nhân vật mẫu, Xuất hiện hạt pixel mồ côi (orphan pixel), Nhòe răng cưa)"
    )

    animation_defects_to_avoid: List[str] = Field(
        default_factory=list,
        description="Các lỗi chuyển động hoạt họa cần tránh (ví dụ: Chân bị trượt trên sàn (foot sliding), Biến dạng phình to thu nhỏ thể tích bất thường (volume popping), Giật khung hình)"
    )


class AIAnalysis(BaseModel):
    """
    Mô hình dữ liệu gốc tổng hợp (Master Root Model) cho phân tích Asset tham chiếu bằng AI Vision.
    Bao gồm đầy đủ 5 trụ cột phân tích: Toàn cục, Hướng nhìn, Hoạt họa, Tính nhất quán và Ràng buộc phủ định.
    
    Hỗ trợ xuất/nhập JSON Schema hoàn chỉnh tương thích OpenAI Structured Outputs.
    """

    global_analysis: GlobalAnalysis = Field(
        ...,
        description="Phân tích tổng thể toàn cục về danh tính, giải phẫu, phong cách pixel art và chất liệu"
    )

    direction_analysis: DirectionAnalysis = Field(
        ...,
        description="Phân tích chi tiết theo đầy đủ 3 hướng nhìn tham chiếu chuẩn: Down, Side, Up"
    )

    animation_analysis: AnimationAnalysis = Field(
        ...,
        description="Phân tích hệ thống hoạt họa chuyển động Idle và Walk cho cả 3 hướng nhìn"
    )

    consistency_analysis: ConsistencyAnalysis = Field(
        ...,
        description="Phân tích tính nhất quán, các đặc tính bất biến và nguyên tắc bảo toàn"
    )

    negative_constraints: NegativeConstraints = Field(
        ...,
        description="Các ràng buộc phủ định và những lỗi đồ họa/hoạt họa cần né tránh khi sinh asset"
    )
