# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử, Hệ thống & File tạm)
# ========================================================
# os, sys: Quản lý biến môi trường hệ thống và đường dẫn module
import os
import sys
# unittest: Framework kiểm thử đơn vị tiêu chuẩn của Python
import unittest
# mock: Giả lập biến môi trường và gọi hàm hệ thống
from unittest.mock import patch, MagicMock
# tempfile, shutil: Tạo môi trường thư mục tạm kiểm thử ghi file .env
import tempfile
import shutil
from pathlib import Path

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài ngoài standard library)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Main Server & Settings Service)
# ========================================================
# get_uvicorn_config: Hàm xác định cấu hình máy chủ Uvicorn
from backend.main import get_uvicorn_config
# SettingsService: Dịch vụ cấu hình hệ thống hỗ trợ an toàn đa tiến trình
from backend.services.settings_service import SettingsService

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
    - Kiểm tra cơ chế tạo file tạm .env có PID/timestamp chống xung đột giữa các Worker.
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

    def test_settings_service_atomic_file_temp_naming_distinct(self):
        """
        Kiểm tra cơ chế lưu file .env qua file tạm có chứa PID và timestamp:
        - Đảm bảo tên file tạm không cố định là .env.tmp mà mang định danh tiến trình duy nhất.
        """
        temp_dir = tempfile.mkdtemp()
        mock_env_file = Path(temp_dir) / ".env"
        mock_env_file.write_text("AI_PROVIDER=gemini\n", encoding="utf-8")

        original_env_path = SettingsService.ENV_PATH
        SettingsService.ENV_PATH = mock_env_file

        created_temp_paths = []
        original_open = open

        def intercept_open(file, *args, **kwargs):
            file_str = str(file)
            if ".tmp" in file_str and ".env." in file_str:
                created_temp_paths.append(file_str)
            return original_open(file, *args, **kwargs)

        try:
            with patch("builtins.open", side_effect=intercept_open):
                SettingsService.save_settings(provider="openai", openai_api_key="sk-test-key-12345678")

            # Xác minh file tạm đã được tạo với PID trong tên
            self.assertTrue(len(created_temp_paths) > 0, "Phải tạo file tạm phân biệt khi ghi .env.")
            expected_pid_fragment = f".env.{os.getpid()}_"
            self.assertTrue(
                any(expected_pid_fragment in path for path in created_temp_paths),
                f"Tên file tạm phải chứa PID ({os.getpid()}) của tiến trình để chống xung đột."
            )
            # Xác minh file .env đã được cập nhật thành công
            content = mock_env_file.read_text(encoding="utf-8")
            self.assertIn("AI_PROVIDER=openai", content)
        finally:
            SettingsService.ENV_PATH = original_env_path
            shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
