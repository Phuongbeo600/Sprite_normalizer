# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa các kiểu danh sách, từ điển và giá trị tùy chọn
from typing import Dict, Any, List, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Kiểm tra tính hợp lệ dữ liệu yêu cầu và phản hồi sinh ảnh AI
from pydantic import BaseModel, Field

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class GeneratedImageItem(BaseModel):
    """Mô tả một tệp ảnh được sinh ra từ mô hình AI."""
    id: str = Field(..., description="Mã định danh duy nhất của ảnh")
    b64_data: str = Field(..., description="Dữ liệu ảnh mã hóa chuỗi Base64")
    mime_type: str = Field("image/png", description="Định dạng MIME của ảnh")
    data_url: str = Field(..., description="Chuỗi Data URL (data:image/png;base64,...) dùng hiển thị ngay trên thẻ img")
    aspect_ratio: str = Field("1:1", description="Tỉ lệ khung hình đã chọn")
    post_processing: Optional["ImagePostProcessingResult"] = None
    saved_sprite_id: Optional[int] = Field(None, description="Mã định danh bản ghi sprite đã lưu vào MySQL (nếu có)")
    saved_to_project: bool = Field(False, description="Cờ xác nhận ảnh đã được lưu vào Kho Tài Nguyên dự án")


class ProcessedFrame(GeneratedImageItem):
    """Frame theo thứ tự hàng, tọa độ hàng/cột bắt đầu từ 0."""
    name: str
    width: int
    height: int
    row: int
    column: int


class ImagePostProcessingResult(BaseModel):
    status: str
    message: str
    failed_step: Optional[str] = None
    rows: int = 3
    columns: int = 5
    frames: List[ProcessedFrame] = Field(default_factory=list)
    sheet_b64_data: Optional[str] = Field(None, description="Chuỗi Base64 của tấm Sprite Sheet đã ghép sau hậu xử lý")
    sheet_data_url: Optional[str] = Field(None, description="Chuỗi Data URL của tấm Sprite Sheet đã ghép sau hậu xử lý")


class ImageGenRequest(BaseModel):
    """
    Schema yêu cầu sinh ảnh AI từ văn bản prompt.
    Tự động liên kết khóa API từ Cài đặt dự án hoặc Cài đặt hệ thống.
    """
    native_size_wh: Optional[tuple[int, int]] = Field(None, description="grid.native_size_wh từ Tab Phân tích: (rộng, cao) pixel thật")
    prompt: str = Field(..., description="Văn bản mô tả nhân vật / sprite cần sinh")
    image: Optional[str] = Field(None, description="Ảnh mẫu tham chiếu (chuỗi Base64 hoặc Data URL)")
    negative_prompt: Optional[str] = Field(None, description="Các chi tiết cần loại trừ (nếu mô hình hỗ trợ)")
    project_id: Optional[int] = Field(None, description="Mã dự án để tự động trích xuất API Key trong MySQL")
    aspect_ratio: str = Field("1:1", description="Tỉ lệ khung hình mong muốn: 1:1, 3:4, 4:3, 16:9")
    number_of_images: int = Field(1, ge=1, le=4, description="Số lượng ảnh cần sinh (từ 1 đến 4)")
    style_preset: Optional[str] = Field(None, description="Thẻ phong cách định sẵn (Pixel Art, Sprite Sheet, Chibi...)")
    provider: Optional[str] = Field(None, description="Ghi đè nhà cung cấp ('gemini' hoặc 'openai')")
    model: Optional[str] = Field(None, description="Mô hình AI tạo ảnh cụ thể")
    api_key: Optional[str] = Field(None, description="Ghi đè khóa API nếu người dùng truyền trực tiếp")
    base_url: Optional[str] = Field(None, description="Ghi đè máy chủ proxy nếu dùng OpenAI")
    metrics: Optional[Dict[str, Any]] = Field(None, description="Số đo giải phẫu tự động từ Tab Phân tích")
    region_measurements: Optional[Dict[str, Any]] = Field(None, description="Báo cáo lát cắt tự động từ Tab Phân tích")
    manual_region_measurements: Optional[Dict[str, Any]] = Field(None, description="Báo cáo đo đoạn thẳng thủ công (Point-to-Point) từ Tab Phân tích")
    color_count: Optional[int] = Field(None, ge=1, description="Số lượng màu tối đa đo được từ Ảnh 1 (chỉ truyền số lượng, không truyền mã màu)")


class ImageGenResponse(BaseModel):
    """Schema phản hồi kết quả sinh ảnh AI."""
    status: str = Field("success", description="Trạng thái thực thi ('success' hoặc 'error')")
    message: str = Field("Sinh ảnh AI thành công!", description="Thông điệp phản hồi cho người dùng")
    provider_used: str = Field(..., description="Nhà cung cấp đã phục vụ yêu cầu: 'gemini' hoặc 'openai'")
    model_used: str = Field(..., description="Tên mô hình AI đã thực thi (vd: imagen-3.0-generate-002, dall-e-3)")
    images: List[GeneratedImageItem] = Field(default_factory=list, description="Danh sách các ảnh đã được tạo")


class LocalEnhancerStatusResponse(BaseModel):
    """Schema trạng thái tiến trình AI Local (Hunyuan PromptEnhancer 7B) trên cổng 8080."""
    running: bool = Field(..., description="Máy chủ AI Local đang chạy hoặc đang nạp mô hình")
    ready: bool = Field(..., description="Máy chủ đã sẵn sàng tiếp nhận yêu cầu nâng cao prompt")
    managed_by_backend: bool = Field(..., description="Tiến trình đang được Backend tự động quản lý vòng đời")
    port: int = Field(8080, description="Cổng TCP của máy chủ llama-server cục bộ")
    model_name: str = Field("Hunyuan PromptEnhancer 7B (Q4_K_M)", description="Tên mô hình GGUF cục bộ")
    message: str = Field("", description="Thông báo trạng thái hiển thị cho người dùng")


class PromptEnhanceRequest(BaseModel):
    """Schema yêu cầu gợi ý và nâng cao mô tả nhân vật qua luồng SSE từ AI Local."""
    prompt: str = Field(..., min_length=1, max_length=2000, description="Mô tả nhân vật thô do người dùng nhập")
    style_preset: Optional[str] = Field(None, description="Phong cách tham khảo tùy chọn nếu có")
    auto_start: bool = Field(True, description="Tự động khởi chạy mô hình AI Local nếu đang tắt")


GeneratedImageItem.model_rebuild()
