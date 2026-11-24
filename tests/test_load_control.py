# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử đơn vị & Thời gian)
# ========================================================
# os, sys: Quản lý biến môi trường và đường dẫn import
import os
import sys
# unittest: Framework kiểm thử đơn vị tiêu chuẩn của Python
import unittest
# MagicMock: Đối tượng giả lập để kiểm tra Request HTTP
from unittest.mock import MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# fastapi: Đối tượng Request và ngoại lệ HTTP
from fastapi import Request, HTTPException

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Load Control Core)
# ========================================================
# Các thành phần cốt lõi của hệ thống kiểm soát tải
from backend.core.load_control import (
    SlidingWindowRateLimiter,
    ConcurrencyLimiter,
    extract_client_identity,
    check_rate_limit,
    validate_upload_file_size,
    validate_sheet_grid_limits,
    MAX_GRID_TOTAL_FRAMES
)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file test backend)


class TestLoadControlAndRateLimiting(unittest.TestCase):
    """
    Bộ kiểm thử đơn vị cho hệ thống kiểm soát tải và Rate Limiting (TASK-05):
    - Kiểm tra cơ chế giới hạn tần suất Sliding Window Rate Limiter.
    - Kiểm tra trích xuất danh tính khách hàng (JWT User ID vs IP).
    - Kiểm tra Semaphore giới hạn tác vụ đồng thời Non-blocking.
    - Kiểm tra kiểm soát dung lượng file tải lên (HTTP 413) và giới hạn lưới Sprite Sheet (HTTP 400).
    """

    def setUp(self):
        """Khởi tạo môi trường kiểm thử độc lập."""
        self.limiter = SlidingWindowRateLimiter(window_seconds=2)

    def test_sliding_window_rate_limiter_allows_and_blocks(self):
        """Kiểm tra giới hạn số lượng request cho phép và chặn khi vượt ngưỡng."""
        key = "test:user:101"
        max_requests = 3

        # 3 request đầu tiên phải được phép
        for i in range(max_requests):
            allowed, remaining, retry_after = self.limiter.is_allowed(key, max_requests)
            self.assertTrue(allowed)
            self.assertEqual(remaining, max_requests - (i + 1))
            self.assertEqual(retry_after, 0)

        # Request thứ 4 vượt ngưỡng phải bị chặn
        allowed, remaining, retry_after = self.limiter.is_allowed(key, max_requests)
        self.assertFalse(allowed)
        self.assertEqual(remaining, 0)
        self.assertGreater(retry_after, 0)

    def test_client_identity_extraction(self):
        """Kiểm tra ưu tiên định danh bằng User ID từ JWT so với IP."""
        mock_request = MagicMock(spec=Request)
        mock_request.client.host = "192.168.1.50"
        mock_request.headers = {}

        # 1. Người dùng đã xác thực (có user_id trong JWT)
        user = {"id": 42, "username": "hero@gmail.com", "role": "user"}
        identity_user = extract_client_identity(mock_request, current_user=user)
        self.assertEqual(identity_user, "user:42")

        # 2. Khách vãng lai (chưa đăng nhập) -> fallback về IP
        identity_guest = extract_client_identity(mock_request, current_user=None)
        self.assertEqual(identity_guest, "ip:192.168.1.50")

        # 3. Khách qua proxy X-Forwarded-For
        mock_request.headers = {"X-Forwarded-For": "203.0.113.195, 10.0.0.1"}
        identity_proxy = extract_client_identity(mock_request, current_user=None)
        self.assertEqual(identity_proxy, "ip:203.0.113.195")

    def test_concurrency_limiter_non_blocking_and_release(self):
        """
        Kiểm tra ConcurrencyLimiter không gây chặn luồng (Non-blocking)
        và từ chối bằng HTTP 429 khi đạt tối đa số tác vụ đồng thời.
        """
        concurrency = ConcurrencyLimiter(max_concurrent=2, name="tác vụ test")
        self.assertEqual(concurrency.active_count, 0)

        # Chiếm slot 1 và slot 2
        self.assertTrue(concurrency.acquire())
        self.assertTrue(concurrency.acquire())
        self.assertEqual(concurrency.active_count, 2)

        # Slot thứ 3 phải bị từ chối ngay lập tức mà không chờ
        self.assertFalse(concurrency.acquire())

        # Giải phóng slot 1
        concurrency.release()
        self.assertEqual(concurrency.active_count, 1)

        # Giờ có thể chiếm lại slot thành công
        self.assertTrue(concurrency.acquire())
        self.assertEqual(concurrency.active_count, 2)

        # Dọn dẹp
        concurrency.release()
        concurrency.release()
        self.assertEqual(concurrency.active_count, 0)

    def test_concurrency_limiter_context_manager_exception_safety(self):
        """Kiểm tra Context Manager 'with limiter:' tự động giải phóng Semaphore khi xảy ra lỗi."""
        concurrency = ConcurrencyLimiter(max_concurrent=1, name="tác vụ an toàn")

        try:
            with concurrency:
                self.assertEqual(concurrency.active_count, 1)
                raise RuntimeError("Lỗi bất ngờ trong quá trình xử lý!")
        except RuntimeError:
            pass

        # Sau khi thoát khối with có lỗi, Semaphore vẫn phải được giải phóng hoàn toàn
        self.assertEqual(concurrency.active_count, 0)

        # Tiếp tục sử dụng bình thường không bị kẹt slot
        with concurrency:
            self.assertEqual(concurrency.active_count, 1)
        self.assertEqual(concurrency.active_count, 0)

    def test_validate_upload_file_size(self):
        """Kiểm tra kiểm soát dung lượng file tải lên sớm (ném HTTP 413 nếu quá lớn)."""
        limit_bytes = 1024 * 1024  # 1 MB

        # 1. Tệp hợp lệ nhỏ hơn 1 MB
        small_file = b"x" * (500 * 1024)
        validate_upload_file_size(small_file, max_bytes=limit_bytes)

        # 2. Tệp quá khổ 2 MB -> Phải ném HTTP 413 Payload Too Large
        large_file = b"x" * (2 * 1024 * 1024)
        with self.assertRaises(HTTPException) as ctx:
            validate_upload_file_size(large_file, max_bytes=limit_bytes)
        self.assertEqual(ctx.exception.status_code, 413)

    def test_validate_sheet_grid_limits(self):
        """Kiểm tra kiểm soát số lượng ô frame và độ phân giải trước khi xử lý CPU-bound."""
        # 1. Thông số hợp lệ (3 hàng × 5 cột)
        validate_sheet_grid_limits(rows=3, columns=5, target_width=64, target_height=64)

        # 2. Tổng số frame vượt quá ngưỡng MAX_GRID_TOTAL_FRAMES (ví dụ 20 hàng × 20 cột = 400 ô)
        with self.assertRaises(HTTPException) as ctx_grid:
            validate_sheet_grid_limits(rows=20, columns=20)
        self.assertEqual(ctx_grid.exception.status_code, 400)
        self.assertIn("vượt quá giới hạn tối đa", ctx_grid.exception.detail)

        # 3. Kích thước đích vượt quá 2048px
        with self.assertRaises(HTTPException) as ctx_dim:
            validate_sheet_grid_limits(rows=1, columns=1, target_width=3000)
        self.assertEqual(ctx_dim.exception.status_code, 400)
        self.assertIn("vượt quá giới hạn cho phép", ctx_dim.exception.detail)


if __name__ == "__main__":
    unittest.main()
