# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa các kiểu danh sách, từ điển, tùy chọn giá trị
from typing import List, Optional, Any, Dict
# base64, binascii, io, warnings: Giải mã và kiểm tra ảnh tham chiếu trong bộ nhớ.
import base64
import binascii
import io
import warnings

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Kiểm tra tính hợp lệ dữ liệu gửi lên và phản hồi
from pydantic import BaseModel, Field, field_validator
# Pillow: Xác minh định dạng và nội dung ảnh raster thực tế.
from PIL import Image, UnidentifiedImageError

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)
# Giới hạn dung lượng dùng chung với ảnh tải lên của ứng dụng.
from backend.core.load_control import MAX_UPLOAD_SIZE_BYTES

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
    vision_model: Optional[str] = Field(None, description="Mô hình AI phân tích ảnh nhân vật")
    image_gen_model: Optional[str] = Field(None, description="Mô hình AI tạo ảnh sprite")
    chat_model: Optional[str] = Field(None, description="Mô hình AI trợ lý hội thoại")


class ProjectTestConnectionRequest(BaseModel):
    """Schema kiểm tra kết nối API Key của dự án."""
    provider: Optional[str] = Field(None, description="Nhà cung cấp: 'gemini' hoặc 'openai'")
    api_key: Optional[str] = Field(None, description="Khóa API truyền trực tiếp (nếu có)")
    base_url: Optional[str] = Field(None, description="Địa chỉ máy chủ proxy")
    model: Optional[str] = Field(None, description="Mô hình cần thử nghiệm")


class ProjectFetchModelsRequest(BaseModel):
    """Schema yêu cầu tải danh sách model khả dụng từ nhà cung cấp."""
    provider: Optional[str] = Field(None, description="Nhà cung cấp: 'gemini' hoặc 'openai'")
    api_key: Optional[str] = Field(None, description="Khóa API truyền trực tiếp (nếu có)")
    base_url: Optional[str] = Field(None, description="Địa chỉ máy chủ proxy")


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
    reference_image: Optional[str] = Field(None, description="Ảnh tham chiếu gốc dạng Data URL Base64")

    @field_validator("reference_image")
    @classmethod
    def validate_reference_image(cls, value: Optional[str]) -> Optional[str]:
        """Kiểm tra ảnh raster và dung lượng; trả lại nguyên vẹn ảnh gốc hoặc None."""
        if value is None:
            return None
        formats = {
            "data:image/png;base64": "PNG",
            "data:image/jpeg;base64": "JPEG",
            "data:image/webp;base64": "WEBP",
            "data:image/gif;base64": "GIF",
            "data:image/bmp;base64": "BMP",
        }
        header, separator, encoded = value.partition(",")
        if not separator or header not in formats or not encoded:
            raise ValueError("Ảnh tham chiếu phải là Data URL Base64 PNG, JPEG, WebP, GIF hoặc BMP.")
        if len(encoded) > 4 * ((MAX_UPLOAD_SIZE_BYTES + 2) // 3):
            raise ValueError("Ảnh tham chiếu vượt giới hạn dung lượng tải lên.")
        try:
            raw = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError("Dữ liệu Base64 của ảnh tham chiếu không hợp lệ.") from exc
        if len(raw) > MAX_UPLOAD_SIZE_BYTES:
            raise ValueError("Ảnh tham chiếu vượt giới hạn dung lượng tải lên.")
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(io.BytesIO(raw)) as image:
                    if image.format != formats[header]:
                        raise ValueError("Định dạng ảnh không khớp loại MIME.")
                    image.verify()
                with Image.open(io.BytesIO(raw)) as image:
                    image.load()
        except (OSError, ValueError, SyntaxError, UnidentifiedImageError,
                Image.DecompressionBombError, Image.DecompressionBombWarning) as exc:
            raise ValueError("Ảnh tham chiếu không phải ảnh raster hợp lệ.") from exc
        return value
