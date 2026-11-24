# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Lớp trừu tượng & Kiểu dữ liệu)
# ========================================================
# abc: Định nghĩa lớp trừu tượng (Abstract Base Class) và phương thức trừu tượng
from abc import ABC, abstractmethod
# typing: Khai báo kiểu dữ liệu cho gợi ý mã nguồn
from typing import Dict, Any, Optional, Tuple, Generator, List
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


class AiProviderError(RuntimeError):
    """
    Ngoại lệ chuẩn hóa cho các lỗi trả về từ nhà cung cấp AI bên thứ ba.
    Bao gồm mã lỗi HTTP (status_code), thông điệp đã làm sạch và tên nhà cung cấp.
    """

    def __init__(self, message: str, status_code: int = 502, provider: str = "ai"):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.provider = provider


class BaseAiProvider(ABC):
    """
    Interface cơ sở trừu tượng cho tất cả các nhà cung cấp trí tuệ nhân tạo (AI Providers).
    Áp dụng Strategy Pattern và tính Đa hình (Polymorphism) để:
    - Cách ly toàn bộ logic HTTP kết nối của từng hãng (Google, OpenAI, Anthropic Claude, v.v.).
    - Cho phép mở rộng thêm Model/Provider mới mà không phải sửa bất kỳ dòng code cũ nào (OCP).
    """

    @abstractmethod
    def test_connection(
        self,
        api_key: str,
        base_url: Optional[str] = None,
        model: Optional[str] = None
    ) -> Tuple[bool, str]:
        """
        Kiểm tra tính hợp lệ và khả năng kết nối của API Key.

        @param {str} api_key Khóa API cần kiểm tra.
        @param {Optional[str]} base_url Địa chỉ máy chủ (dành cho proxy hoặc custom gateway).
        @param {Optional[str]} model Tên mô hình AI tùy chọn để kiểm tra.
        @returns {Tuple[bool, str]} (Thành công/Thất bại, Thông điệp giải thích).
        """
        pass

    @abstractmethod
    def analyze_vision(
        self,
        image: Image.Image,
        api_key: str,
        prompt: str,
        base_url: Optional[str] = None,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Gửi ảnh Sprite cùng lời nhắc phân tích thị giác và nhận lại kết quả JSON có cấu trúc.

        @param {Image.Image} image Ảnh sprite cần nhận diện.
        @param {str} api_key Khóa API.
        @param {str} prompt Nội dung yêu cầu thị giác (Visual Grounding).
        @param {Optional[str]} base_url Địa chỉ máy chủ API.
        @param {Optional[str]} model Tên mô hình AI cụ thể được chỉ định.
        @returns {Dict[str, Any]} Dữ liệu JSON bóc tách được.
        """
        pass

    @abstractmethod
    def generate_json(
        self,
        prompt: str,
        api_key: str,
        base_url: Optional[str] = None,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Gửi yêu cầu sinh văn bản có cấu trúc JSON (Dùng cho Cố vấn Prompt AI).

        @param {str} prompt Nội dung yêu cầu sinh văn bản.
        @param {str} api_key Khóa API.
        @param {Optional[str]} base_url Địa chỉ máy chủ API.
        @param {Optional[str]} model Tên mô hình AI cụ thể được chỉ định.
        @returns {Dict[str, Any]} Đối tượng JSON kết quả.
        """
        pass

    def stream_chat(
        self,
        messages: List[Dict[str, str]],
        api_key: str,
        base_url: Optional[str] = None,
        system_instruction: Optional[str] = None,
        model: Optional[str] = None
    ) -> Generator[str, None, None]:
        """
        Gửi hội thoại tới mô hình AI và phát luồng (stream) từng token văn bản về theo chuẩn SSE.
        Mặc định ném lỗi NotImplementedError nếu Provider cụ thể chưa hỗ trợ phát luồng.

        @param {List[Dict[str, str]]} messages Danh sách lịch sử hội thoại [{'role': 'user'|'assistant', 'content': '...'}].
        @param {str} api_key Khóa API bảo mật của nhà cung cấp.
        @param {Optional[str]} base_url Địa chỉ máy chủ tùy biến (áp dụng cho OpenAI/Proxy/Local Ollama).
        @param {Optional[str]} system_instruction Chỉ dẫn định hình phong cách cho AI.
        @param {Optional[str]} model Tên mô hình AI cụ thể được chỉ định.
        @returns {Generator[str, None, None]} Máy phát sinh từng đoạn chữ (token).
        """
        raise NotImplementedError("Nhà cung cấp AI này chưa hiện thực hóa phương thức stream_chat.")

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
        return base64.b64encode(buffered.getvalue()).decode("utf-8")# lấy ảnh từ ram ra thành byte nhị phân, base64 ép thành chữ, rồi chuyển thành str
