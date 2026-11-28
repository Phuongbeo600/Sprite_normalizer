"""Cầu nối SSE và worker AI Local, bảo đảm dọn tài nguyên trước khi trả lượt."""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Ngữ cảnh và hàm bọc)
# ========================================================
from functools import wraps
import threading

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Bất đồng bộ và HTTP)
# ========================================================
# anyio: Chờ worker kết thúc mà không khóa vòng lặp sự kiện khi client hủy.
import anyio
# StreamingResponse: Giữ nguyên hợp đồng HTTP/SSE của các endpoint hiện có.
from starlette.responses import StreamingResponse

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Ngữ cảnh hủy)
# ========================================================
from backend.services.local_ai_execution import inference_cancel_event

# ========================================================
# 4. CẤU HÌNH & HẰNG SỐ
# ========================================================
# Mỗi kết nối SSE sở hữu một tín hiệu hủy độc lập.


class LocalAiStreamingResponse(StreamingResponse):
    """Luôn đóng generator trong cùng tác vụ, kể cả lỗi gửi hoặc disconnect."""

    async def stream_response(self, send):
        """Dọn generator trước khi kết nối kết thúc, không thay nội dung HTTP."""
        try:
            await super().stream_response(send)
        finally:
            with anyio.CancelScope(shield=True):
                await self.body_iterator.aclose()


async def run_local_ai_step(func, *args):
    """Chạy bước đồng bộ; hủy coroutine vẫn phải đợi worker thoát.

    @param func Hàm đồng bộ, nhận tín hiệu hủy qua ContextVar.
    @param args Các tham số giữ nguyên của service hiện có.
    @returns Kết quả của hàm sau khi worker thực sự hoàn thành.
    """
    done = anyio.Event()
    event = inference_cancel_event.get()
    result, errors = [], []

    async def execute():
        """Bảo vệ worker khỏi hủy ngoài và thu kết quả sau khi chạy xong."""
        with anyio.CancelScope(shield=True):
            try:
                # Mỗi bước có limiter riêng để các worker chờ không chặn bước tiếp theo của lượt đang chạy.
                result.append(await anyio.to_thread.run_sync(lambda: func(*args), limiter=anyio.CapacityLimiter(1)))
            except BaseException as exc:
                errors.append(exc)
            finally:
                done.set()

    async with anyio.create_task_group() as group:
        group.start_soon(execute)
        try:
            await done.wait()
        except anyio.get_cancelled_exc_class():
            if event is not None:
                event.set()
            with anyio.CancelScope(shield=True):
                await done.wait()
            raise
    if errors:
        raise errors[0]
    return result[0]


def local_ai_stream(func):
    """Gắn tín hiệu hủy riêng cho mỗi stream, không thay đổi dữ liệu SSE."""
    @wraps(func)
    async def stream(*args, **kwargs):
        """Giữ ngữ cảnh đến khi generator và worker được dọn xong."""
        event = threading.Event()
        token = inference_cancel_event.set(event)
        iterator = func(*args, **kwargs)
        try:
            async for item in iterator:
                yield item
        finally:
            event.set()
            try:
                with anyio.CancelScope(shield=True):
                    await iterator.aclose()
            finally:
                inference_cancel_event.reset(token)
    return stream
