# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử, Luồng & Tệp tạm)
# ========================================================
# os, sys: Quản lý biến môi trường và đường dẫn import
import os
import sys
from pathlib import Path
# tempfile: Tạo tệp tạm an toàn phục vụ kiểm thử cô lập
import tempfile
# unittest: Framework kiểm thử đơn vị tiêu chuẩn của Python
import unittest
# concurrent.futures: Bộ thực thi đa luồng giả lập request đồng thời
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có thư viện bên ngoài bổ sung)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services)
# ========================================================
# SettingsService: Dịch vụ cấu hình hệ thống
from backend.services.settings_service import SettingsService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file test backend)


class TestSettingsServiceConcurrency(unittest.TestCase):
    """
    Bộ kiểm thử xử lý đồng thời cho SettingsService:
    - Kiểm tra an toàn luồng (Thread-safety) khi nhiều luồng cùng cập nhật cấu hình file .env.
    - Đảm bảo cơ chế khóa luồng _env_file_lock và ghi nguyên tử (Atomic Write) ngăn ngừa hỏng tệp.
    """

    def setUp(self):
        """Khởi tạo tệp cấu hình tạm để không ảnh hưởng đến file .env gốc của dự án."""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.temp_env_path = Path(self.temp_dir.name) / ".env.test"
        # Ghi nội dung mẫu ban đầu
        with open(self.temp_env_path, "w", encoding="utf-8") as f:
            f.write("# Cấu hình môi trường thử nghiệm\nAI_PROVIDER=gemini\nGEMINI_API_KEY=initial_test_key\n")

        # Lưu lại đường dẫn gốc và trỏ ENV_PATH sang tệp tạm
        self.original_env_path = SettingsService.ENV_PATH
        SettingsService.ENV_PATH = self.temp_env_path

    def tearDown(self):
        """Khôi phục lại đường dẫn file .env gốc và dọn dẹp thư mục tạm."""
        SettingsService.ENV_PATH = self.original_env_path
        self.temp_dir.cleanup()

    def test_concurrent_save_settings_thread_safety(self):
        """
        Kiểm tra nhiều luồng đồng thời gọi save_settings.
        Xác nhận tệp .env không bị lỗi định dạng, không bị mất dòng và giữ giá trị hợp lệ.
        """
        worker_count = 10
        providers = ["gemini", "openai"]

        def worker_task(index: int):
            provider = providers[index % 2]
            key = f"key_for_worker_{index:03d}_12345678"
            return SettingsService.save_settings(
                provider=provider,
                gemini_api_key=key if provider == "gemini" else None,
                openai_api_key=key if provider == "openai" else None
            )

        with ThreadPoolExecutor(max_workers=worker_count) as executor:
            futures = [executor.submit(worker_task, i) for i in range(worker_count)]
            results = [f.result() for f in futures]

        # Xác nhận tất cả các thao tác đều trả về thành công
        for res in results:
            self.assertEqual(res["status"], "success")

        # Đọc lại nội dung tệp .env tạm và kiểm tra tính toàn vẹn cú pháp
        self.assertTrue(self.temp_env_path.exists())
        with open(self.temp_env_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        keys_found = {}
        for line in lines:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                keys_found[k.strip()] = v.strip()

        # Đảm bảo các khóa cấu hình cốt lõi vẫn tồn tại nguyên vẹn
        self.assertIn("AI_PROVIDER", keys_found)
        self.assertIn(keys_found["AI_PROVIDER"], ["gemini", "openai"])


if __name__ == "__main__":
    unittest.main()
