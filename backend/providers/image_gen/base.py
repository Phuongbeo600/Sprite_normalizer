# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Lớp trừu tượng & Kiểu dữ liệu)
# ========================================================
# abc: Định nghĩa lớp trừu tượng (Abstract Base Class)
from abc import ABC, abstractmethod
import base64
import binascii
import io
import time
import asyncio
import httpx
from PIL import Image
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


# Dùng lại ngoại lệ AI hiện có, giữ ValueError cho lỗi yêu cầu tương thích cũ.
from backend.providers.base import AiProviderError as ImageGenUpstreamError


class ImageGenRequestError(ImageGenUpstreamError, ValueError):
    """Lỗi xác thực/hạn mức, dùng chung status_code của AiProviderError."""


def _send(method, url, *, timeout, total_timeout, **kwargs):
    """Giữ giao diện Provider đồng bộ; hủy I/O cả khi máy chủ gửi dữ liệu nhỏ giọt."""
    async def send():
        limits = httpx.Timeout(timeout[1], connect=timeout[0])
        async with httpx.AsyncClient(timeout=limits, follow_redirects=True) as client:
            return await client.request(method, url, **kwargs)

    async def bounded():
        return await asyncio.wait_for(send(), timeout=total_timeout)

    # asyncio.run() đợi cả worker DNS khi đóng executor, có thể giữ request sau timeout.
    # Đóng loop không chờ resolver hệ điều hành; coroutine HTTP đã được hủy và đóng client.
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(bounded())
    finally:
        loop.run_until_complete(loop.shutdown_asyncgens())
        loop.close()


def _post(url, **kwargs):
    return _send('POST', url, **kwargs)


def _get(url, **kwargs):
    return _send('GET', url, **kwargs)


class BaseImageGenProvider(ABC):
    """
    Interface cơ sở trừu tượng cho tất cả các nhà cung cấp dịch vụ Tạo ảnh AI (AI Image Generation).
    Áp dụng Strategy Pattern và Interface Segregation Principle (ISP) để:
    - Tách biệt hoàn toàn hợp đồng tạo ảnh khỏi hợp đồng phân tích thị giác / sinh văn bản (BaseAiProvider).
    - Đóng gói toàn bộ logic gọi HTTP REST API, chuyển đổi tham số, parse phản hồi nhị phân Base64 và xử lý mã lỗi riêng của từng hãng.
    """

    # Tổng ngân sách mạng cho một lượt provider, gồm fallback/tải URL ảnh.
    NETWORK_BUDGET_SECONDS = 120
    CONNECT_TIMEOUT_SECONDS = 10
    READ_TIMEOUT_SECONDS = 60

    @classmethod
    def _request(cls, method, url, *, deadline, label, **kwargs):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise ImageGenUpstreamError(f'{label}: quá thời gian tạo ảnh (120s).', 504)
        # Chia phần thời gian còn lại giữa connect/read; không cấp lại ngân sách khi fallback.
        phase = remaining / 2
        timeout = (min(cls.CONNECT_TIMEOUT_SECONDS, phase), min(cls.READ_TIMEOUT_SECONDS, phase))
        try:
            transport = _post if method == 'POST' else _get
            response = transport(url, timeout=timeout, total_timeout=remaining, **kwargs)
        except (TimeoutError, httpx.TimeoutException) as exc:
            raise ImageGenUpstreamError(f'{label}: quá thời gian chờ phản hồi (Timeout).', 504) from exc
        except httpx.RequestError as exc:
            raise ImageGenUpstreamError(f'{label}: mất kết nối tới dịch vụ tạo ảnh.', 502) from exc
        if time.monotonic() > deadline:
            raise ImageGenUpstreamError(f'{label}: quá thời gian tạo ảnh (120s).', 504)
        status = response.status_code
        if status in (408, 504):
            raise ImageGenUpstreamError(f'{label}: dịch vụ quá thời gian phản hồi (HTTP {status}).', 504)
        if status == 429:
            raise ImageGenRequestError(f'{label}: hết hạn mức hoặc bị giới hạn tốc độ (Quota / Rate Limit, HTTP 429).', 429)
        if status in (401, 403):
            raise ImageGenRequestError(f'{label}: API Token/Key không hợp lệ hoặc chưa có quyền truy cập (HTTP {status}).', status)
        return response

    @staticmethod
    def _json(response, label):
        try:
            data = response.json()
            if not isinstance(data, dict):
                raise ValueError('Expected JSON object')
            return data
        except (TypeError, ValueError) as exc:
            raise ImageGenUpstreamError(f'{label}: phản hồi JSON không hợp lệ.') from exc

    @staticmethod
    def validate_image(encoded):
        """Xác minh ảnh thật dùng chung, tránh coi HTML/text Base64 là ảnh thành công."""
        try:
            raw = base64.b64decode(encoded, validate=True)
            with Image.open(io.BytesIO(raw)) as image:
                mime = Image.MIME.get(image.format)
                if mime not in {'image/png', 'image/jpeg', 'image/webp'}:
                    raise ValueError('Unsupported image format')
                image.verify()
            return mime
        except (TypeError, ValueError, binascii.Error, OSError, Image.DecompressionBombError) as exc:
            raise ImageGenUpstreamError('Dịch vụ tạo ảnh trả dữ liệu ảnh không hợp lệ.') from exc

    @abstractmethod
    def generate_images(
        self,
        api_key: str,
        prompt: str,
        negative_prompt: Optional[str] = None,
        aspect_ratio: str = "1:1",
        number_of_images: int = 1,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        image: Optional[str] = None,
        reference_image_2: Optional[str] = None
    ) -> ImageGenResponse:
        """
        Gửi yêu cầu tạo ảnh tới mô hình AI của nhà cung cấp và trả về kết quả chuẩn hóa.

        @param {str} api_key Khóa API của nhà cung cấp.
        @param {str} prompt Lời nhắc mô tả ảnh cần tạo.
        @param {Optional[str]} negative_prompt Lời nhắc các chi tiết cần tránh/cấm.
        @param {str} aspect_ratio Tỉ lệ khung hình ('1:1', '3:4', '4:3', '16:9', '9:16').
        @param {int} number_of_images Số lượng ảnh cần tạo.
        @param {Optional[str]} base_url Địa chỉ máy chủ tùy biến nếu có.
        @param {Optional[str]} model Mô hình tạo ảnh cụ thể.
        @param {Optional[str]} image Chuỗi Base64 ảnh mẫu tham chiếu số 1 nếu có.
        @param {Optional[str]} reference_image_2 Chuỗi Base64 ảnh tham chiếu số 2 cố định (Layout & Pose) nếu có.
        @returns {ImageGenResponse} Đối tượng phản hồi chứa danh sách ảnh Base64 và thông tin model.
        """
        pass
