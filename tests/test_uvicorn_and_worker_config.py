# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử, Hệ thống & File tạm)
# ========================================================
# os, sys: Quản lý biến môi trường hệ thống và đường dẫn module
import os
import sys
# unittest: Framework kiểm thử đơn vị tiêu chuẩn của Python
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài ngoài standard library)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Main Server)
# ========================================================
# get_uvicorn_config: Hàm xác định cấu hình máy chủ Uvicorn
from backend.main import get_uvicorn_config

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file test backend)


class TestUvicornAndWorkerConfiguration(unittest.TestCase):
    """
    Bộ kiểm thử cấu hình khởi chạy Uvicorn và khả năng tương thích Multi-Worker:
    - Kiểm tra cấu hình mặc định trong môi trường Development (1 Worker, reload=True).
    - Kiểm tra cấu hình tối ưu trong môi trường Production (Multi-Worker, reload=False).
    - Kiểm tra khả năng tùy chỉnh số lượng Worker qua UVICORN_WORKERS và WEB_CONCURRENCY.
    - Kiểm tra các thông số bảo vệ quá tải: limit_concurrency, timeout_keep_alive, timeout_graceful_shutdown.
    """

    def setUp(self):
        """Lưu lại trạng thái biến môi trường trước khi kiểm thử."""
        self.original_env = dict(os.environ)

    def tearDown(self):
        """Khôi phục lại trạng thái biến môi trường gốc sau khi kiểm thử."""
        os.environ.clear()
        os.environ.update(self.original_env)

    def test_default_development_configuration(self):
        """
        Kiểm tra cấu hình mặc định trong môi trường phát triển (Development):
        - workers = 1
        - reload = True
        - host = 127.0.0.1
        - port = 8000
        """
        os.environ.pop("APP_ENV", None)
        os.environ.pop("UVICORN_WORKERS", None)
        os.environ.pop("WEB_CONCURRENCY", None)

        cfg = get_uvicorn_config()

        self.assertEqual(cfg["workers"], 1, "Môi trường Development phải chạy đúng 1 Worker.")
        self.assertTrue(cfg["reload"], "Môi trường Development phải bật reload=True.")
        self.assertEqual(cfg["host"], "127.0.0.1", "Môi trường Development mặc định lắng nghe trên 127.0.0.1.")
        self.assertEqual(cfg["port"], 8000, "Cổng mặc định phải là 8000.")
        self.assertNotIn("limit_concurrency", cfg, "Không cần áp dụng limit_concurrency ở chế độ dev.")

    def test_production_configuration_with_default_workers(self):
        """
        Kiểm tra cấu hình trong môi trường Production mặc định:
        - workers = 2 (số worker tối ưu đề xuất cho RAM và MySQL Pool).
        - reload = False (tắt reload để cho phép chạy đa tiến trình ổn định).
        - host = 0.0.0.0 (lắng nghe mọi giao diện mạng).
        - Tích hợp limit_concurrency, timeout_keep_alive, timeout_graceful_shutdown.
        """
        os.environ["APP_ENV"] = "production"
        os.environ.pop("UVICORN_WORKERS", None)
        os.environ.pop("WEB_CONCURRENCY", None)

        cfg = get_uvicorn_config()

        self.assertEqual(cfg["workers"], 2, "Môi trường Production mặc định đề xuất 2 Workers.")
        self.assertFalse(cfg["reload"], "Môi trường Production bắt buộc phải tắt reload.")
        self.assertEqual(cfg["host"], "0.0.0.0", "Môi trường Production mặc định lắng nghe trên 0.0.0.0.")
        self.assertEqual(cfg["limit_concurrency"], 100, "Mặc định giới hạn 100 kết nối đồng thời/worker.")
        self.assertEqual(cfg["timeout_keep_alive"], 10, "Mặc định keep-alive 10 giây.")
        self.assertEqual(cfg["timeout_graceful_shutdown"], 20, "Mặc định graceful shutdown 20 giây.")

    def test_production_configuration_custom_workers_env(self):
        """
        Kiểm tra khả năng tùy chỉnh số lượng Worker qua biến môi trường UVICORN_WORKERS:
        - Đặt UVICORN_WORKERS = 4 -> workers phải nhận giá trị 4.
        """
        os.environ["APP_ENV"] = "production"
        os.environ["UVICORN_WORKERS"] = "4"

        cfg = get_uvicorn_config()

        self.assertEqual(cfg["workers"], 4, "Phải nhận đúng số Worker từ UVICORN_WORKERS.")

    def test_production_configuration_web_concurrency_fallback(self):
        """
        Kiểm tra khả năng nhận biến môi trường chuẩn WEB_CONCURRENCY (chuẩn Heroku/Render/Railway):
        - Đặt WEB_CONCURRENCY = 3 -> workers phải nhận giá trị 3.
        """
        os.environ["APP_ENV"] = "production"
        os.environ.pop("UVICORN_WORKERS", None)
        os.environ["WEB_CONCURRENCY"] = "3"

        cfg = get_uvicorn_config()

        self.assertEqual(cfg["workers"], 3, "Phải nhận đúng số Worker từ WEB_CONCURRENCY khi thiếu UVICORN_WORKERS.")


if __name__ == "__main__":
    unittest.main()
