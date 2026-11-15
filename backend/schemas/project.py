# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa các kiểu danh sách, từ điển, tùy chọn giá trị
from typing import List, Optional, Any, Dict

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Kiểm tra tính hợp lệ dữ liệu gửi lên và phản hồi
from pydantic import BaseModel, Field

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class ProjectCreateRequest(BaseModel):
    """Schema dữ liệu tạo dự án mới."""
    name: str = Field(..., min_length=1, max_length=255, description="Tên dự án sprite")


class ProjectItem(BaseModel):
    """Schema chi tiết từng dự án."""
    id: int
    name: str
    created_at: Optional[Any] = None


class ProjectListResponse(BaseModel):
    """Schema phản hồi danh sách các dự án."""
    status: str = "success"
    data: List[ProjectItem]


class ProjectApiConfigRequest(BaseModel):
    """Schema cập nhật cấu hình API Key và trạng thái AI của riêng dự án trong MySQL."""
    api_provider: str = Field("gemini", description="Nhà cung cấp: 'gemini' hoặc 'openai'")
    gemini_api_key: Optional[str] = Field(None, description="Khóa Google Gemini API")
    openai_api_key: Optional[str] = Field(None, description="Khóa OpenAI API")
    openai_base_url: Optional[str] = Field("https://api.openai.com/v1", description="Địa chỉ API proxy")
    ai_enabled: Optional[bool] = Field(None, description="Trạng thái bật/tắt toàn bộ tính năng AI của dự án")


class SaveCharacterPresetRequest(BaseModel):
    """Schema lưu trữ bản phân tích và Prompt của nhân vật vào dự án."""
    name: str = Field(..., description="Tên gợi nhớ cho bản phân tích")
    sprite_name: Optional[str] = Field(None, description="Tên file sprite mẫu")
    metrics_data: Optional[Dict[str, Any]] = Field(None, description="Số đo pixel hình học từ OpenCV")
    profile_data: Optional[Dict[str, Any]] = Field(None, description="Hồ sơ phong cách DNA từ AI")
    frame_actions_data: Optional[Dict[str, Any]] = Field(None, description="Ma trận chi tiết 15 frames hoạt họa chân tay đối nghịch")
    new_character_concept: str = Field(..., description="Ý tưởng nhân vật mới đã tạo")
    outfit_and_colors: Optional[str] = Field(None, description="Trang phục & màu sắc riêng")
    weapons_and_props: Optional[str] = Field(None, description="Vũ khí & đạo cụ riêng")
    stature_rule: Optional[str] = Field("Bằng nhân vật gốc (Tỷ lệ chuẩn)", description="Quy chuẩn vóc dáng")
    target_direction: Optional[str] = Field("Front / Down view", description="Góc nhìn mục tiêu")
    positive_prompt: str = Field(..., description="Câu positive prompt tiếng Anh đầy đủ")
    negative_prompt: str = Field(..., description="Câu negative prompt tiếng Anh đầy đủ")
    technical_notes: Optional[str] = Field(None, description="Ghi chú kỹ thuật")
