# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Thời gian, Hàng đợi, Khóa luồng & Hệ thống)
# ========================================================
# os: Đọc biến môi trường cấu hình giới hạn tải
import os
# time: Lấy dấu thời gian hiện tại tính bằng giây cho Sliding Window
import time
# threading: Khóa bảo vệ và Semaphore giới hạn tác vụ đồng thời trong đa luồng
import threading
# collections: Deque lưu trữ chuỗi thời gian yêu cầu và OrderedDict dọn dẹp bộ nhớ
from collections import deque
# typing: Định nghĩa các kiểu dữ liệu từ điển, tùy chọn, bộ giá trị và hàm
from typing import Dict, Optional, Any, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# fastapi: Xử lý Request HTTP, Dependency Injection và ném mã lỗi HTTP chuẩn
from fastapi import Request, HTTPException, status

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Dependencies)
# ========================================================
# get_current_user_optional: Trích xuất thông tin người dùng từ JWT Token hoặc Fallback
from backend.core.dependencies import get_current_user_optional

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & CẤU HÌNH (Stylesheets / Config)
# ========================================================
# (Không áp dụng cho file backend)


# ========================================================
# PHẦN 1: CẤU HÌNH TẬP TRUNG (Centralized Load Control Settings)
# ========================================================

# Dung lượng tải lên tối đa (Mặc định: 15 MB)
MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_MB", "15"))
MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024

# Giới hạn kích thước lưới Sprite Sheet
MAX_GRID_ROWS = 64
MAX_GRID_COLUMNS = 64
MAX_GRID_TOTAL_FRAMES = 256
MAX_TARGET_DIMENSION = 2048

# Tần suất gửi yêu cầu tối đa trong 1 phút (Requests Per Minute - RPM)
RATE_LIMIT_AI_GEN = int(os.getenv("RATE_LIMIT_AI_GEN", "10"))           # Tạo ảnh AI: 10 req/phút
RATE_LIMIT_AI_CHAT = int(os.getenv("RATE_LIMIT_AI_CHAT", "20"))         # Chatbot: 20 req/phút
RATE_LIMIT_IMAGE_PROC = int(os.getenv("RATE_LIMIT_IMAGE_PROC", "30"))   # Cắt & Chuẩn hóa ảnh: 30 req/phút
RATE_LIMIT_UPLOAD = int(os.getenv("RATE_LIMIT_UPLOAD", "60"))           # Lưu/Upload ảnh: 60 req/phút

# Giới hạn số tác vụ nặng thực thi đồng thời (Concurrency Throttling)
CONCURRENCY_AI_GEN = int(os.getenv("CONCURRENCY_AI_GEN", "3"))          # Tối đa 3 tác vụ tạo ảnh AI cùng lúc
CONCURRENCY_IMAGE_PROC = int(os.getenv("CONCURRENCY_IMAGE_PROC", "5"))  # Tối đa 5 tác vụ xử lý ảnh nặng cùng lúc
CONCURRENCY_AI_CHAT = int(os.getenv("CONCURRENCY_AI_CHAT", "6"))        # Tối đa 6 phiên chat AI cùng lúc


# ========================================================
# PHẦN 2: BỘ GIỚI HẠN TẦN SUẤT TRUY CẬP (Sliding Window Rate Limiter)
# ========================================================

class SlidingWindowRateLimiter:
    """
    Bộ giới hạn tần suất yêu cầu sử dụng thuật toán Cửa sổ trượt (Sliding Window).
    - Lưu vết các dấu thời gian yêu cầu trong 60 giây gần nhất bằng `deque`.
    - Định danh dựa trên người dùng đã xác thực (user_id/username), fallback sang địa chỉ IP.
    - Đảm bảo an toàn luồng tuyệt đối (Thread-safe) bằng `threading.Lock`.
    - Tự động dọn dẹp bản ghi cũ để không gây phình to bộ nhớ RAM.
    """

    def __init__(self, window_seconds: int = 60):
        self.window_seconds = window_seconds
        self._history: Dict[str, deque] = {}
        self._lock = threading.Lock()

    def is_allowed(self, identity_key: str, max_requests: int) -> Tuple[bool, int, int]:
        """
        Kiểm tra xem yêu cầu hiện tại có được phép thực thi hay không.

        @param identity_key: Khóa định danh khách hàng (ví dụ: 'ai_gen:user:5' hoặc 'ai_gen:ip:127.0.0.1').
        @param max_requests: Số lượng yêu cầu tối đa cho phép trong cửa sổ thời gian.
        @returns: (is_allowed, remaining_requests, retry_after_seconds)
        """
        now = time.time()
        cutoff = now - self.window_seconds

        with self._lock:
            if identity_key not in self._history:
                self._history[identity_key] = deque()

            timestamps = self._history[identity_key]

            # Loại bỏ các dấu thời gian đã nằm ngoài cửa sổ trượt
            while timestamps and timestamps[0] < cutoff:
                timestamps.popleft()

            # Kiểm tra nếu vượt quá giới hạn
            if len(timestamps) >= max_requests:
                earliest = timestamps[0]
                retry_after = max(1, int(earliest + self.window_seconds - now))
                return False, 0, retry_after

            # Ghi nhận thời điểm yêu cầu mới
            timestamps.append(now)
            remaining = max(0, max_requests - len(timestamps))
            return True, remaining, 0

    def clear(self) -> None:
        """Xóa toàn bộ lịch sử cửa sổ trượt để giải phóng bộ nhớ."""
        with self._lock:
            self._history.clear()


# ========================================================
# PHẦN 3: BỘ GIỚI HẠN TÁC VỤ ĐỒNG THỜI (Concurrency Limiter)
# ========================================================

class ConcurrencyLimiter:
    """
    Bộ kiểm soát số lượng tác vụ nặng chạy song song tại một thời điểm.
    - Sử dụng BoundedSemaphore với cơ chế Không chặn (Non-blocking acquisition).
    - Từ chối ngay lập tức khi hệ thống đạt đỉnh tải, giải phóng Event Loop.
    - Cung cấp Context Manager đảm bảo giải phóng slot kể cả khi tác vụ ném ngoại lệ.
    """

    def __init__(self, max_concurrent: int, name: str = "Tác vụ"):
        self.max_concurrent = max_concurrent
        self.name = name
        self._semaphore = threading.BoundedSemaphore(value=max_concurrent)
        self._active_count = 0
        self._lock = threading.Lock()

    def acquire(self) -> bool:
        """
        Thử chiếm dụng một slot xử lý mà không chờ đợi (Non-blocking).
        
        @returns: True nếu chiếm được slot, False nếu hệ thống đã đạt tối đa công suất.
        """
        acquired = self._semaphore.acquire(blocking=False)
        if acquired:
            with self._lock:
                self._active_count += 1
        return acquired

    def release(self) -> None:
        """Giải phóng một slot xử lý để tác vụ khác tiếp quản."""
        try:
            self._semaphore.release()
            with self._lock:
                self._active_count = max(0, self._active_count - 1)
        except ValueError:
            # Ngăn ngừa lỗi nếu release vượt quá giá trị khởi tạo
            pass

    def __enter__(self):
        """Hỗ trợ cú pháp 'with limiter:' thuận tiện và an toàn."""
        if not self.acquire():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Máy chủ đang xử lý tối đa {self.max_concurrent} {self.name} đồng thời. Vui lòng thử lại sau ít giây!",
                headers={"Retry-After": "5"}
            )
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Luôn giải phóng Semaphore khi ra khỏi khối with."""
        self.release()

    @property
    def active_count(self) -> int:
        """Số lượng tác vụ hiện đang chạy."""
        with self._lock:
            return self._active_count


# ========================================================
# PHẦN 4: KHỞI TẠO CÁC BỘ ĐIỀU PHỐI TẬP TRUNG TOÀN CỤC
# ========================================================

# Bộ điều phối Rate Limiter
_global_rate_limiter = SlidingWindowRateLimiter(window_seconds=60)

# Các bộ điều phối Concurrency Limiter chuyên biệt
ai_gen_concurrency = ConcurrencyLimiter(CONCURRENCY_AI_GEN, name="tác vụ tạo ảnh AI")
image_proc_concurrency = ConcurrencyLimiter(CONCURRENCY_IMAGE_PROC, name="tác vụ xử lý ảnh")
ai_chat_concurrency = ConcurrencyLimiter(CONCURRENCY_AI_CHAT, name="phiên đối thoại AI")


# ========================================================
# PHẦN 5: CÁC HÀM TIỆN ÍCH KIỂM TRA ĐẦU VÀO SỚM
# ========================================================

def extract_client_identity(request: Request, current_user: Optional[Dict[str, Any]] = None) -> str:
    """
    Trích xuất danh tính khách hàng để áp dụng Rate Limiting.
    Ưu tiên tài khoản đã đăng nhập (user_id), sau đó tới IP của máy khách.

    @param request: Đối tượng Request HTTP của FastAPI.
    @param current_user: Thông tin người dùng đã giải mã từ JWT token (nếu có).
    @returns: Chuỗi định danh duy nhất (ví dụ: 'user:12' hoặc 'ip:192.168.1.5').
    """
    if isinstance(current_user, dict) and current_user.get("id"):
        return f"user:{current_user['id']}"
    if isinstance(current_user, dict) and current_user.get("username"):
        return f"user:{current_user['username']}"

    # Fallback sang địa chỉ IP nếu là khách vãng lai
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
        return f"ip:{client_ip}"

    if request.client and request.client.host:
        return f"ip:{request.client.host}"

    return "ip:unknown"


def check_rate_limit(
    request: Request,
    scope: str,
    max_requests: int,
    current_user: Optional[Dict[str, Any]] = None
) -> None:
    """
    Kiểm tra tần suất gửi yêu cầu và ném lỗi 429 nếu vượt ngưỡng cho phép.

    @param request: Đối tượng Request HTTP.
    @param scope: Phạm vi giới hạn (ví dụ: 'ai_gen', 'slice_sheet', 'chat').
    @param max_requests: Số lượng yêu cầu tối đa trong 1 phút.
    @param current_user: Người dùng hiện tại.
    """
    identity = extract_client_identity(request, current_user)
    key = f"{scope}:{identity}"

    allowed, remaining, retry_after = _global_rate_limiter.is_allowed(key, max_requests)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Bạn đã gửi quá nhiều yêu cầu ({max_requests} lần/phút). Vui lòng thử lại sau {retry_after} giây!",
            headers={
                "Retry-After": str(retry_after),
                "X-RateLimit-Limit": str(max_requests),
                "X-RateLimit-Remaining": "0"
            }
        )


def validate_upload_file_size(file_bytes: bytes, max_bytes: int = MAX_UPLOAD_SIZE_BYTES) -> None:
    """
    Kiểm tra dung lượng tệp ảnh tải lên sớm. Ném lỗi 413 Payload Too Large nếu vượt ngưỡng.

    @param file_bytes: Dữ liệu nhị phân của tệp tải lên.
    @param max_bytes: Ngưỡng kích thước byte tối đa cho phép.
    """
    actual_size = len(file_bytes)
    if actual_size > max_bytes:
        max_mb = round(max_bytes / (1024 * 1024), 1)
        actual_mb = round(actual_size / (1024 * 1024), 2)
        raise HTTPException(
            status_code=getattr(status, "HTTP_413_CONTENT_TOO_LARGE", 413),
            detail=f"Dung lượng tệp ({actual_mb} MB) vượt quá giới hạn cho phép tối đa ({max_mb} MB)!"
        )


def validate_sheet_grid_limits(
    rows: int,
    columns: int,
    target_width: Optional[int] = None,
    target_height: Optional[int] = None
) -> None:
    """
    Kiểm tra tính hợp lệ của thông số lưới cắt và độ phân giải trước khi xử lý CPU-bound.
    Ngăn chặn việc khai báo lưới khổng lồ gây cạn kiệt RAM máy chủ.

    @param rows: Số hàng của lưới.
    @param columns: Số cột của lưới.
    @param target_width: Chiều rộng đích (nếu có).
    @param target_height: Chiều cao đích (nếu có).
    """
    if rows > MAX_GRID_ROWS or columns > MAX_GRID_COLUMNS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Số hàng hoặc số cột không được vượt quá {MAX_GRID_ROWS}×{MAX_GRID_COLUMNS}!"
        )

    total_frames = rows * columns
    if total_frames > MAX_GRID_TOTAL_FRAMES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tổng số lượng khung hình ({total_frames}) vượt quá giới hạn tối đa ({MAX_GRID_TOTAL_FRAMES} frames)!"
        )

    if target_width and target_width > MAX_TARGET_DIMENSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chiều rộng mục tiêu ({target_width}px) vượt quá giới hạn cho phép ({MAX_TARGET_DIMENSION}px)!"
        )

    if target_height and target_height > MAX_TARGET_DIMENSION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chiều cao mục tiêu ({target_height}px) vượt quá giới hạn cho phép ({MAX_TARGET_DIMENSION}px)!"
        )
