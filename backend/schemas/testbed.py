# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểu dữ liệu & Cấu trúc)
# ========================================================
# typing: Định nghĩa các kiểu dữ liệu mảng, từ điển và tùy chọn
from typing import List, Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Kiểm tra tính hợp lệ dữ liệu yêu cầu và phản hồi HTTP
from pydantic import BaseModel, Field

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class TestbedMapSaveRequest(BaseModel):
    """Schema yêu cầu lưu hoặc cập nhật bản đồ nền phòng thử nghiệm."""
    project_id: int = Field(..., description="Mã dự án sở hữu bản đồ")
    name: Optional[str] = Field("Bản đồ nền mặc định", description="Tên bản đồ nền")
    map_image_base64: str = Field(..., description="Dữ liệu ảnh thật bản đồ nền dạng chuỗi Base64 Data URL")
    ground_y: int = Field(540, description="Tọa độ trục Y mặt đất nơi chân nhân vật đứng tiếp xúc")
    show_ground_line: bool = Field(True, description="Trạng thái hiển thị vạch kẻ sàn mặt đất")


class TestbedGroundYUpdateRequest(BaseModel):
    """Schema yêu cầu cập nhật riêng độ cao sàn mặt đất ground_y."""
    project_id: int = Field(..., description="Mã dự án")
    ground_y: int = Field(..., description="Tọa độ trục Y mới của mặt đất")


class TestbedMapResponse(BaseModel):
    """Schema phản hồi thông tin bản đồ nền của phòng thử nghiệm."""
    status: str = Field("success", description="Trạng thái phản hồi")
    id: Optional[int] = Field(None, description="Mã bản đồ nền trong database")
    project_id: int = Field(..., description="Mã dự án")
    name: str = Field("Bản đồ nền mặc định", description="Tên bản đồ")
    map_image_base64: Optional[str] = Field(None, description="Ảnh thật dạng Data URL")
    ground_y: int = Field(540, description="Tọa độ trục Y mặt đất")
    show_ground_line: bool = Field(True, description="Hiển thị vạch kẻ sàn")


class TestbedCharacterSaveRequest(BaseModel):
    """Schema yêu cầu tạo mới hoặc cập nhật một nhân vật trong phòng thử nghiệm."""
    id: Optional[int] = Field(None, description="Mã nhân vật (nếu cập nhật nhân vật đã có)")
    project_id: int = Field(..., description="Mã dự án")
    name: str = Field("Hiệp sĩ", description="Tên nhân vật")
    cell_width: int = Field(32, description="Chiều rộng ô hiển thị px")
    cell_height: int = Field(48, description="Chiều cao ô hiển thị px")
    fps: int = Field(8, description="Tốc độ bước chân")
    scale_ratio: float = Field(1.0, description="Tỉ lệ thu phóng riêng")
    pos_x: int = Field(260, description="Tọa độ X đứng ngang trên sàn")
    order_index: int = Field(0, description="Thứ tự hiển thị trong đội hình")
    # slots_data: Từ điển ánh xạ slot_key -> chuỗi ảnh Base64 Data URL (VD: { 'down_0': 'data:image/png;base64,...' })
    slots_data: Optional[Dict[str, str]] = Field(default_factory=dict, description="Danh sách các ô ảnh rời")


class TestbedCharacterUpdateRequest(BaseModel):
    """Schema yêu cầu cập nhật thông số điều chỉnh nhanh của nhân vật (tên, scale, vị trí X, fps)."""
    name: Optional[str] = Field(None, description="Tên mới của nhân vật")
    scale_ratio: Optional[float] = Field(None, description="Tỉ lệ thu phóng mới")
    pos_x: Optional[int] = Field(None, description="Tọa độ X mới")
    fps: Optional[int] = Field(None, description="FPS mới")
    order_index: Optional[int] = Field(None, description="Thứ tự mới")


class TestbedSlotUpdateRequest(BaseModel):
    """Schema yêu cầu thay đổi ảnh của riêng một ô cụ thể trong 15 ô."""
    project_id: int = Field(..., description="Mã dự án")
    slot_key: str = Field(..., description="Mã ô cần thay ảnh (VD: 'down_0', 'down_1', 'side_2'...)")
    frame_image_base64: str = Field(..., description="Ảnh thật mới của ô đó dạng Base64 Data URL")
    direction: Optional[str] = Field("down", description="Hướng nhìn")
    frame_index: Optional[int] = Field(0, description="Thứ tự frame")


class TestbedCharacterItem(BaseModel):
    """Schema dữ liệu chi tiết của một nhân vật kèm đầy đủ các ô ảnh rời."""
    id: int = Field(..., description="Mã nhân vật trong database")
    project_id: int = Field(..., description="Mã dự án")
    name: str = Field(..., description="Tên nhân vật")
    cell_width: int = Field(32, description="Chiều rộng ô px")
    cell_height: int = Field(48, description="Chiều cao ô px")
    fps: int = Field(8, description="Tốc độ bước chân")
    scale_ratio: float = Field(1.0, description="Tỉ lệ thu phóng")
    pos_x: int = Field(260, description="Tọa độ X trên sàn")
    order_index: int = Field(0, description="Thứ tự đội hình")
    slots_data: Dict[str, str] = Field(default_factory=dict, description="Dữ liệu các ô ảnh rời (slot_key -> Data URL)")


class TestbedCharacterListResponse(BaseModel):
    """Schema phản hồi danh sách nhân vật phòng thử nghiệm của dự án."""
    status: str = Field("success", description="Trạng thái thực thi")
    characters: List[TestbedCharacterItem] = Field(default_factory=list, description="Danh sách nhân vật")
