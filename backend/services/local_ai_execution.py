"""Hàng đợi CPU và cầu nối hủy giữa luồng SSE với worker AI Local."""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Ngữ cảnh và đồng bộ)
# ========================================================
from collections import deque
from contextlib import contextmanager
from contextvars import ContextVar
import threading
import time

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Lập lịch bất đồng bộ)
# ========================================================
# Hàng đợi chỉ dùng thư viện chuẩn, không phụ thuộc framework HTTP.

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
# ========================================================
# Không phụ thuộc manager hoặc service để tránh import vòng.

# ========================================================
# 4. CẤU HÌNH & NGỮ CẢNH YÊU CẦU
# ========================================================
inference_cancel_event = ContextVar("local_ai_cancel_event", default=None)


def check_cancelled(cancel_event=None):
    """Ném InterruptedError khi yêu cầu hiện tại đã bị hủy.

    @param cancel_event Tín hiệu riêng; mặc định đọc ngữ cảnh SSE.
    @returns None nếu yêu cầu vẫn còn hiệu lực.
    """
    event = cancel_event if cancel_event is not None else inference_cancel_event.get()
    if event is not None and event.is_set():
        raise InterruptedError("Đã hủy yêu cầu AI Local.")


class InferenceQueue:
    """Hàng đợi FIFO giới hạn số tác vụ CPU, hỗ trợ hủy khi chờ."""

    def __init__(self, capacity=1):
        """Khởi tạo số lượt chạy đồng thời, tối thiểu một lượt."""
        self.capacity = max(1, int(capacity))
        self._condition = threading.Condition()
        self._waiters = deque()
        self._active = 0

    @contextmanager
    def use(self, cancel_event=None, timeout=180.0):
        """Giữ lượt đến khi thân tác vụ kết thúc, không nạp model khi chờ.

        @param cancel_event Tín hiệu hủy; kiểm tra lại tối đa mỗi 50ms.
        @param timeout Thời gian chờ tối đa tính bằng giây.
        @returns Ngữ cảnh sở hữu một lượt CPU.
        """
        ticket = object()
        deadline = time.monotonic() + timeout
        with self._condition:
            self._waiters.append(ticket)
            try:
                while True:
                    check_cancelled(cancel_event)
                    if self._waiters[0] is ticket and self._active < self.capacity:
                        self._waiters.popleft()
                        self._active += 1
                        self._condition.notify_all()
                        break
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        raise TimeoutError("Hết thời gian chờ lượt xử lý AI Local trên CPU.")
                    self._condition.wait(min(0.05, remaining))
            except BaseException:
                self._waiters.remove(ticket)
                self._condition.notify_all()
                raise
        try:
            yield
        finally:
            with self._condition:
                self._active -= 1
                self._condition.notify_all()
