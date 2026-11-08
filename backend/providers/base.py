# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Lớp trừu tượng & Kiểu dữ liệu)
# ========================================================
# abc: Định nghĩa lớp trừu tượng (Abstract Base Class) và phương thức trừu tượng
from abc import ABC, abstractmethod
# typing: Khai báo kiểu dữ liệu cho gợi ý mã nguồn
from typing import Dict, Any, Optional, Tuple
# io, base64: Xử lý chuyển đổi ảnh sang Base64 chuẩn gửi lên API AI
import io
import base64

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# PIL (Pillow): Mở và chuyển đổi định dạng ảnh
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class BaseAiProvider(ABC):
    """
    Interface cơ sở trừu tượng cho tất cả các nhà cung cấp trí tuệ nhân tạo (AI Providers).
    Áp dụng Strategy Pattern và tính Đa hình (Polymorphism) để:
    - Cách ly toàn bộ logic HTTP kết nối của từng hãng (Google, OpenAI, Anthropic Claude, v.v.).
    - Cho phép mở rộng thêm Model/Provider mới mà không phải sửa bất kỳ dòng code cũ nào (OCP).
    """

    @abstractmethod
    def test_connection(self, api_key: str, base_url: Optional[str] = None) -> Tuple[bool, str]:
        """
        Kiểm tra tính hợp lệ và khả năng kết nối của API Key.

        @param {str} api_key Khóa API cần kiểm tra.
        @param {Optional[str]} base_url Địa chỉ máy chủ (dành cho proxy hoặc custom gateway).
        @returns {Tuple[bool, str]} (Thành công/Thất bại, Thông điệp giải thích).
        """
        pass

    @abstractmethod
    def analyze_vision(
        self,
        image: Image.Image,
        api_key: str,
        prompt: str,
        base_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Gửi ảnh Sprite cùng lời nhắc phân tích thị giác và nhận lại kết quả JSON có cấu trúc.

        @param {Image.Image} image Ảnh sprite cần nhận diện.
        @param {str} api_key Khóa API.
        @param {str} prompt Nội dung yêu cầu thị giác (Visual Grounding).
        @param {Optional[str]} base_url Địa chỉ máy chủ API.
        @returns {Dict[str, Any]} Dữ liệu JSON bóc tách được.
        """
        pass

    @abstractmethod
    def generate_json(
        self,
        prompt: str,
        api_key: str,
        base_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Gửi yêu cầu sinh văn bản có cấu trúc JSON (Dùng cho Cố vấn Prompt AI).

        @param {str} prompt Nội dung yêu cầu sinh văn bản.
        @param {str} api_key Khóa API.
        @param {Optional[str]} base_url Địa chỉ máy chủ API.
        @returns {Dict[str, Any]} Đối tượng JSON kết quả.
        """
        pass

    @staticmethod
    def encode_image_to_base64(image: Image.Image, max_dimension: int = 512) -> str:
        """
        Hàm dùng chung chuyển đổi PIL Image sang chuỗi base64 PNG, tự động resize nếu vượt quá kích thước.

        @param {Image.Image} image Ảnh gốc.
        @param {int} max_dimension Kích thước cạnh lớn nhất cho phép khi gửi lên AI.
        @returns {str} Chuỗi mã hóa base64.
        """
        img_to_send = image.convert("RGBA")
        max_dim = max(img_to_send.size)
        if max_dim > max_dimension:
            scale_send = float(max_dimension) / max_dim
            sw = max(1, int(round(img_to_send.width * scale_send)))
            sh = max(1, int(round(img_to_send.height * scale_send)))
            img_to_send = img_to_send.resize((sw, sh), Image.Resampling.BILINEAR)

        buffered = io.BytesIO()
        img_to_send.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode("utf-8")
