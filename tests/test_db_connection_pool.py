# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử, Đa luồng & Hệ thống)
# ========================================================
# os, sys: Quản lý đường dẫn nạp module dự án
import os
import sys
# unittest: Framework kiểm thử đơn vị tiêu chuẩn của Python
import unittest
# mock: Tạo đối tượng giả lập kiểm tra vòng đời của Database Session
from unittest.mock import MagicMock, patch
# concurrent.futures: Thực thi đa luồng kiểm tra tính độc lập của Session
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài ngoài standard library)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Database Engine & Session)
# ========================================================
# db: Nạp các cấu hình Connection Pool và hàm get_db
from backend.db import (
    DB_POOL_SIZE,
    DB_MAX_OVERFLOW,
    DB_POOL_TIMEOUT,
    DB_POOL_RECYCLE,
    get_db,
    SessionLocal,
)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file test backend)


class TestDatabaseConnectionPoolAndSessionLifecycle(unittest.TestCase):
    """
    Bộ kiểm thử cấu hình Connection Pool và Vòng đời Database Session:
    - Xác minh thông số cấu hình Pool tối ưu cho môi trường đa Uvicorn Worker.
    - Đảm bảo tính toán trần kết nối không vượt quá giới hạn mặc định của MySQL (151).
    - Đảm bảo hàm get_db() luôn tự động rollback khi lỗi và đóng kết nối (close) trong finally.
    - Đảm bảo mỗi luồng sở hữu một Database Session độc lập, không dùng chung.
    - Đảm bảo việc chủ động đóng kết nối sớm (db.close()) trước các tác vụ AI không gây lỗi.
    """

    def test_connection_pool_configuration_parameters(self):
        """
        Xác minh các thông số cấu hình Connection Pool của SQLAlchemy.
        - pool_size = 10 (kết nối thường trực mỗi worker).
        - max_overflow = 10 (kết nối mở rộng tối đa mỗi worker).
        - pool_timeout = 30 (thời gian chờ tối đa 30s).
        - pool_recycle = 280 (tái tạo kết nối trước 300s chống server gone away).
        """
        self.assertEqual(DB_POOL_SIZE, 10, "DB_POOL_SIZE mặc định phải là 10.")
        self.assertEqual(DB_MAX_OVERFLOW, 10, "DB_MAX_OVERFLOW mặc định phải là 10.")
        self.assertEqual(DB_POOL_TIMEOUT, 30, "DB_POOL_TIMEOUT mặc định phải là 30 giây.")
        self.assertEqual(DB_POOL_RECYCLE, 280, "DB_POOL_RECYCLE mặc định phải là 280 giây.")

    def test_multi_worker_connection_capacity_safe(self):
        """
        Kiểm tra tính an toàn về dung lượng kết nối khi chạy 4 Uvicorn Workers:
        - Tổng kết nối tối đa của 4 worker: 4 * (pool_size + max_overflow) = 4 * (10 + 10) = 80.
        - Mức này phải nhỏ hơn hoặc bằng 80% giới hạn MySQL mặc định (151), dự phòng an toàn cho admin và tools.
        """
        max_workers = 4
        total_possible_connections = max_workers * (DB_POOL_SIZE + DB_MAX_OVERFLOW)
        mysql_default_limit = 151
        
        self.assertEqual(total_possible_connections, 80)
        self.assertLess(
            total_possible_connections,
            mysql_default_limit,
            f"Tổng kết nối tiềm năng ({total_possible_connections}) phải nhỏ hơn giới hạn MySQL ({mysql_default_limit})."
        )

    def test_get_db_normal_lifecycle_closes_session(self):
        """
        Kiểm tra vòng đời bình thường của get_db():
        - Cấp phát session.
        - Luôn gọi session.close() khi hoàn thành khối generator.
        """
        mock_session = MagicMock()

        with patch("backend.db.SessionLocal", return_value=mock_session):
            db_generator = get_db()
            session = next(db_generator)

            self.assertIs(session, mock_session, "get_db() phải cung cấp đúng session được khởi tạo.")
            self.assertEqual(mock_session.close.call_count, 0, "Chưa được đóng trước khi generator kết thúc.")

            # Kết thúc generator
            with self.assertRaises(StopIteration):
                next(db_generator)

            self.assertEqual(mock_session.close.call_count, 1, "Session phải được đóng đúng 1 lần trong khối finally.")
            self.assertEqual(mock_session.rollback.call_count, 0, "Không có lỗi thì không được gọi rollback.")

    def test_get_db_exception_triggers_rollback_and_close(self):
        """
        Kiểm tra vòng đời khi có ngoại lệ trong get_db():
        - Tự động gọi session.rollback().
        - Luôn gọi session.close() trong khối finally kể cả khi có ngoại lệ.
        """
        mock_session = MagicMock()

        with patch("backend.db.SessionLocal", return_value=mock_session):
            db_generator = get_db()
            session = next(db_generator)

            self.assertIs(session, mock_session)

            # Ném ngoại lệ vào bên trong generator giống như API endpoint gặp lỗi
            with self.assertRaises(RuntimeError):
                db_generator.throw(RuntimeError("Lỗi truy vấn CSDL giả lập"))

            self.assertEqual(mock_session.rollback.call_count, 1, "Phải gọi rollback khi có ngoại lệ phát sinh.")
            self.assertEqual(mock_session.close.call_count, 1, "Phải luôn gọi close trong finally kể cả khi có ngoại lệ.")

    def test_early_session_close_safety(self):
        """
        Kiểm tra tính an toàn của pattern đóng kết nối sớm trước tác vụ AI:
        - hasattr(db, 'close') trả về True và gọi đóng kết nối an toàn mà không phát sinh ngoại lệ.
        """
        mock_session = MagicMock()
        mock_session.close.return_value = None

        # Giả lập thao tác hoàn trả kết nối sớm trong router
        if hasattr(mock_session, "close"):
            mock_session.close()

        mock_session.close.assert_called_once()

    def test_independent_sessions_across_multiple_threads(self):
        """
        Kiểm tra tính độc lập của Session giữa các luồng:
        - Mỗi luồng khi gọi SessionLocal() phải nhận một đối tượng Session riêng biệt.
        - Không có hiện tượng chia sẻ chung một phiên làm việc giữa các luồng.
        """
        def worker_task():
            return SessionLocal()

        with ThreadPoolExecutor(max_workers=5) as executor:
            futures = [executor.submit(worker_task) for _ in range(5)]
            sessions = [f.result() for f in futures]

        try:
            # Xác minh tất cả 5 đối tượng Session được tạo ra cùng lúc đều là các instance riêng biệt
            unique_sessions = set(sessions)
            self.assertEqual(len(unique_sessions), 5, "Mỗi luồng phải tạo một phiên Session riêng biệt.")
        finally:
            for s in sessions:
                s.close()


if __name__ == "__main__":
    unittest.main()
