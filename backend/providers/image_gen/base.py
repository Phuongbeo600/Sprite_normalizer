# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Lớp trừu tượng & Kiểu dữ liệu)
# ========================================================
# abc: Định nghĩa lớp trừu tượng (Abstract Base Class)
from abc import ABC, abstractmethod
# typing: Khai báo gợi ý kiểu dữ liệu danh sách, từ điển, tùy chọn
from typing import List, Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Schemas)
# ========================================================
# GeneratedImageItem, ImageGenResponse: DTO kết quả ảnh tạo ra
from backend.schemas.image_gen import ImageGenResponse, GeneratedImageItem

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class BaseImageGenProvider(ABC):
    """
    Interface cơ sở trừu tượng cho tất cả các nhà cung cấp dịch vụ Tạo ảnh AI (AI Image Generation).
    Áp dụng Strategy Pattern và Interface Segregation Principle (ISP) để:
    - Tách biệt hoàn toàn hợp đồng tạo ảnh khỏi hợp đồng phân tích thị giác / sinh văn bản (BaseAiProvider).
    - Đóng gói toàn bộ logic gọi HTTP REST API, chuyển đổi tham số, parse phản hồi nhị phân Base64 và xử lý mã lỗi riêng của từng hãng.
    """

    @abstractmethod
    def generate_images(
        self,
        api_key: str,
        prompt: str,
        negative_prompt: Optional[str] = None,
        aspect_ratio: str = "1:1",
        number_of_images: int = 1,
        base_url: Optional[str] = None
    ) -> ImageGenResponse:
        """
        Gửi yêu cầu tạo ảnh tới mô hình AI của nhà cung cấp và trả về kết quả chuẩn hóa.

        @param {str} api_key Khóa API của nhà cung cấp.
        @param {str} prompt Lời nhắc mô tả ảnh cần tạo.
        @param {Optional[str]} negative_prompt Lời nhắc các chi tiết cần tránh/cấm.
        @param {str} aspect_ratio Tỉ lệ khung hình ('1:1', '3:4', '4:3', '16:9', '9:16').
        @param {int} number_of_images Số lượng ảnh cần tạo.
        @param {Optional[str]} base_url Địa chỉ máy chủ tùy biến nếu có.
        @returns {ImageGenResponse} Đối tượng phản hồi chứa danh sách ảnh Base64 và thông tin model.
        """
        pass
