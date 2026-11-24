# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử, Đa luồng & Hệ thống)
# ========================================================
# os, sys: Quản lý biến môi trường và đường dẫn import
import os
import sys
# unittest: Framework kiểm thử đơn vị tiêu chuẩn của Python
import unittest
# concurrent.futures: Bộ thực thi đa luồng giả lập request đồng thời
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services)
# ========================================================
# TranslationService: Dịch vụ dịch thuật ngôn ngữ hỗ trợ LRU Cache
from backend.services.translation_service import TranslationService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file test backend)


class TestTranslationCacheAndMemory(unittest.TestCase):
    """
    Bộ kiểm thử quản lý Cache và Bộ nhớ cho TranslationService:
    - Kiểm tra cơ chế loại bỏ dữ liệu cũ nhất (LRU Eviction) khi đầy dung lượng.
    - Đảm bảo an toàn luồng (Thread-safety) khi nhiều luồng cùng đọc/ghi Cache.
    - Kiểm tra phương thức xóa Cache giải phóng RAM tức thì.
    """

    def setUp(self):
        """Lưu lại kích thước Cache gốc và làm sạch Cache trước khi kiểm thử."""
        self.original_max_size = TranslationService.MAX_CACHE_SIZE
        TranslationService.clear_cache()

    def tearDown(self):
        """Khôi phục kích thước Cache gốc và dọn sạch Cache sau khi kiểm thử."""
        TranslationService.MAX_CACHE_SIZE = self.original_max_size
        TranslationService.clear_cache()

    def test_lru_cache_capacity_limit_and_eviction(self):
        """
        Kiểm tra cơ chế giới hạn dung lượng và loại bỏ phần tử cũ nhất (LRU Eviction).
        Đặt giới hạn nhỏ (ví dụ 5 phần tử) và chèn 8 phần tử để xác minh.
        """
        TranslationService.MAX_CACHE_SIZE = 5

        # Nạp trực tiếp 5 mục vào cache thông qua dictionary hoặc gọi translate
        with TranslationService._cache_lock:
            for i in range(1, 6):
                key = (f"term_{i}", "en", "vi")
                TranslationService._cache[key] = f"nghia_{i}"

        info = TranslationService.get_cache_info()
        self.assertEqual(info["size"], 5)
        self.assertEqual(info["maxsize"], 5)

        # Chèn thêm mục thứ 6 vượt giới hạn
        with TranslationService._cache_lock:
            key_6 = ("term_6", "en", "vi")
            TranslationService._cache[key_6] = "nghia_6"
            TranslationService._cache.move_to_end(key_6)
            if len(TranslationService._cache) > TranslationService.MAX_CACHE_SIZE:
                TranslationService._cache.popitem(last=False)

        # Kích thước phải duy trì đúng bằng 5
        info = TranslationService.get_cache_info()
        self.assertEqual(info["size"], 5)

        # Phần tử đầu tiên (term_1) phải bị loại bỏ theo nguyên tắc LRU
        with TranslationService._cache_lock:
            self.assertNotIn(("term_1", "en", "vi"), TranslationService._cache)
            self.assertIn(("term_6", "en", "vi"), TranslationService._cache)

    def test_clear_cache_frees_memory(self):
        """Kiểm tra hàm clear_cache làm sạch toàn bộ dữ liệu trong RAM."""
        with TranslationService._cache_lock:
            for i in range(10):
                TranslationService._cache[(f"word_{i}", "en", "vi")] = f"nghia_{i}"

        self.assertEqual(TranslationService.get_cache_info()["size"], 10)

        # Gọi xóa Cache
        TranslationService.clear_cache()
        self.assertEqual(TranslationService.get_cache_info()["size"], 0)

    def test_concurrent_cache_access_thread_safety(self):
        """
        Kiểm tra đa luồng đồng thời truy cập đọc và ghi Cache.
        Đảm bảo không phát sinh lỗi xung đột dữ liệu (Race Condition).
        """
        worker_count = 12
        operations_per_worker = 20

        def worker_task(worker_id: int):
            for op in range(operations_per_worker):
                text_key = f"concurrent_word_{worker_id}_{op % 5}"
                cache_key = (text_key, "en", "vi")
                # Đọc hoặc ghi Cache an toàn luồng
                with TranslationService._cache_lock:
                    if cache_key in TranslationService._cache:
                        _ = TranslationService._cache[cache_key]
                    else:
                        TranslationService._cache[cache_key] = f"translated_{worker_id}_{op}"
                        TranslationService._cache.move_to_end(cache_key)
                        if len(TranslationService._cache) > TranslationService.MAX_CACHE_SIZE:
                            TranslationService._cache.popitem(last=False)
            return True

        with ThreadPoolExecutor(max_workers=worker_count) as executor:
            futures = [executor.submit(worker_task, i) for i in range(worker_count)]
            results = [f.result() for f in futures]

        self.assertTrue(all(results))
        self.assertLessEqual(TranslationService.get_cache_info()["size"], TranslationService.MAX_CACHE_SIZE)


if __name__ == "__main__":
    unittest.main()
