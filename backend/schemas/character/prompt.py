# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa các kiểu từ điển và tùy chọn giá trị
from typing import Dict, Any, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Kiểm tra tính hợp lệ dữ liệu yêu cầu tạo prompt
from pydantic import BaseModel, Field

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class PromptAdviceRequest(BaseModel):
    """Schema dữ liệu yêu cầu Cố vấn Prompt AI & Toán học nghịch đảo (Hệ thống cũ)."""
    metrics: Dict[str, Any] = Field(..., description="Dữ liệu đo đạc giải phẫu từ nhân vật mẫu")
    character_concept: str = Field("Chiến binh Pixel Art dũng mãnh", description="Ý tưởng nhân vật mới")
    head_rule: str = Field("Bằng nhân vật gốc (Tỷ lệ chuẩn)", description="Quy tắc kích thước đầu")
    body_width_rule: str = Field("Bằng nhân vật gốc", description="Quy tắc bề ngang thân")
    body_height_rule: str = Field("Bằng nhân vật gốc", description="Quy tắc chiều cao thân")
    api_key: Optional[str] = Field(None, description="Khóa API tùy chọn gửi kèm")
    provider: Optional[str] = Field(None, description="Nhà cung cấp AI tùy chọn ('gemini' hoặc 'openai')")
    base_url: Optional[str] = Field(None, description="Đường dẫn máy chủ proxy tùy chọn")


class NewCharacterPromptRequest(BaseModel):
    """
    Schema yêu cầu sinh Prompt cho Nhân vật Mới (Tự do sáng tạo, không bị gán cứng vào nhân vật cũ).
    Kế thừa quy chuẩn kỹ thuật (kích thước, tỷ lệ, nét viền, đổ bóng pixel) từ nhân vật tham chiếu.
    """
    core_concept: str = Field(..., description="Ý tưởng cốt lõi của nhân vật mới (vd: Nữ phù thủy, Quái vật slime, Ninja)")
    outfit_and_colors: Optional[str] = Field(None, description="Trang phục và dải màu mong muốn riêng của nhân vật mới")
    weapons_and_props: Optional[str] = Field(None, description="Vũ khí hoặc đạo cụ riêng của nhân vật mới (vd: Trượng phép, bình độc)")
    stature_rule: str = Field("Bằng nhân vật gốc (Tỷ lệ chuẩn)", description="Quy tắc vóc dáng (Giữ nguyên / Cao hơn / Thon gọn / Vạm vỡ)")
    target_direction: str = Field("Front / Down view", description="Góc nhìn mục tiêu cần sinh ảnh (Down, Side, Up)")
    inherit_scale: bool = Field(True, description="Kế thừa tỷ lệ kích thước game để vào game bằng chằn chặn nhân vật cũ")
    inherit_style: bool = Field(True, description="Kế thừa phong cách đồ họa pixel art (viền, đổ bóng, hướng sáng)")
    profile_data: Dict[str, Any] = Field(default_factory=dict, description="Dữ liệu hồ sơ nhân vật tham chiếu từ 4 tab")
    metrics: Optional[Dict[str, Any]] = Field(None, description="Dữ liệu đo đạc giải phẫu học pixel thực tế từ Bước 1")
    api_key: Optional[str] = Field(None, description="Khóa API tùy chọn")
    provider: Optional[str] = Field(None, description="Nhà cung cấp AI tùy chọn")
    base_url: Optional[str] = Field(None, description="Địa chỉ máy chủ proxy tùy chọn")
