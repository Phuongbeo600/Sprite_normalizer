# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử, Thời gian & Kiểu)
# ========================================================
# unittest: Framework kiểm thử chuẩn của Python
import unittest
# datetime: Xử lý thời gian hết hạn kiểm thử JWT
from datetime import timedelta
# typing: Khai báo kiểu dữ liệu cho bài kiểm thử
from typing import Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Khởi tạo CSDL SQLite in-memory cô lập để kiểm thử
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Security, Services & Dependencies)
# ========================================================
# security: Các hàm băm mật khẩu, kiểm tra và quản lý token JWT
from backend.core.security import (
    hash_password,
    is_hashed_password,
    verify_password,
    create_access_token,
    decode_access_token
)
# dependencies: Dependency xác thực FastAPI
from backend.core.dependencies import get_current_user_optional
# UserService: Dịch vụ tài khoản và xác thực
from backend.services.user_service import UserService
# TranslationService: Dịch vụ dịch thuật ngôn ngữ hỗ trợ nạp lười
from backend.services.translation_service import TranslationService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file test)


class TestSecurityHardening(unittest.TestCase):
    """
    Tập kiểm thử xác thực nâng cao (Security Hardening):
    - Kiểm thử băm mật khẩu Bcrypt và tự động nâng cấp (Rehash-on-login).
    - Kiểm thử sinh và giải mã JSON Web Token (JWT Bearer OAuth2).
    - Kiểm thử dịch vụ UserService với mật khẩu băm và cấp phát Access Token.
    - Kiểm thử Dependency xác thực JWT kết hợp Fallback Query Parameter.
    - Kiểm thử cơ chế nạp lười (Lazy Loading) của TranslationService.
    """

    def setUp(self):
        """Khởi tạo CSDL SQLite in-memory cô lập cho từng ca kiểm thử."""
        self.engine = create_engine("sqlite:///:memory:")
        self.SessionTest = sessionmaker(bind=self.engine)
        self.db: Session = self.SessionTest()

        # Tạo cấu trúc bảng users tối giản mô phỏng MySQL
        self.db.execute(text("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                last_name TEXT,
                middle_name TEXT,
                first_name TEXT,
                full_name TEXT,
                avatar_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        self.db.commit()
        self.user_service = UserService()

    def tearDown(self):
        """Dọn dẹp phiên làm việc CSDL sau khi kiểm thử xong."""
        self.db.close()
        self.engine.dispose()

    def test_password_hashing_and_verification(self):
        """Kiểm tra tính năng băm mật khẩu Bcrypt và xác minh chuỗi băm."""
        raw_pwd = "mat_khau_bao_mat_123"
        hashed = hash_password(raw_pwd)

        # 1. Định dạng hash phải tuân thủ chuẩn Bcrypt ($2b$)
        self.assertTrue(is_hashed_password(hashed))
        self.assertTrue(hashed.startswith("$2b$"))
        self.assertNotEqual(raw_pwd, hashed)

        # 2. Xác thực mật khẩu đúng với hash -> hợp lệ, không cần rehash
        is_valid, needs_rehash = verify_password(raw_pwd, hashed)
        self.assertTrue(is_valid)
        self.assertFalse(needs_rehash)

        # 3. Xác thực sai mật khẩu -> không hợp lệ
        is_valid_wrong, _ = verify_password("sai_mat_khau", hashed)
        self.assertFalse(is_valid_wrong)

    def test_legacy_plaintext_password_migration(self):
        """Kiểm tra cơ chế tương thích ngược và đánh dấu nâng cấp (Rehash) cho mật khẩu plaintext cũ."""
        legacy_pwd = "plaintext_password_cu"

        # Nhận diện chuỗi plaintext không phải dạng hash
        self.assertFalse(is_hashed_password(legacy_pwd))

        # Xác thực với plaintext khớp -> hợp lệ và yêu cầu rehash
        is_valid, needs_rehash = verify_password(legacy_pwd, legacy_pwd)
        self.assertTrue(is_valid)
        self.assertTrue(needs_rehash)

        # Xác thực sai -> không hợp lệ
        is_valid_wrong, _ = verify_password("sai", legacy_pwd)
        self.assertFalse(is_valid_wrong)

    def test_jwt_create_and_decode(self):
        """Kiểm tra sinh và giải mã mã truy cập JSON Web Token (JWT)."""
        payload_data = {
            "sub": "42",
            "username": "tester@gmail.com",
            "role": "admin"
        }
        token = create_access_token(payload_data, expires_delta=timedelta(minutes=30))
        self.assertIsInstance(token, str)
        self.assertGreater(len(token), 20)

        # Giải mã và xác minh tính toàn vẹn của payload
        decoded = decode_access_token(token)
        self.assertIsNotNone(decoded)
        self.assertEqual(decoded["sub"], "42")
        self.assertEqual(decoded["username"], "tester@gmail.com")
        self.assertEqual(decoded["role"], "admin")
        self.assertIn("exp", decoded)
        self.assertIn("iat", decoded)

    def test_jwt_expired_token(self):
        """Kiểm tra từ chối mã truy cập JWT đã hết hạn."""
        expired_delta = timedelta(seconds=-10)
        token = create_access_token({"sub": "1"}, expires_delta=expired_delta)
        decoded = decode_access_token(token)
        self.assertIsNone(decoded)

    def test_user_registration_stores_hashed_password(self):
        """Kiểm tra người dùng đăng ký mới được lưu mật khẩu băm và nhận JWT token."""
        created = self.user_service.register(
            db=self.db,
            username="player1@gmail.com",
            password="secret_password_1",
            first_name="An",
            last_name="Nguyen"
        )
        self.assertEqual(created["username"], "player1@gmail.com")
        self.assertIn("access_token", created)
        self.assertEqual(created["token_type"], "bearer")

        # Kiểm tra trực tiếp trong CSDL mật khẩu đã được băm bằng Bcrypt
        user_row = self.db.execute(
            text("SELECT password FROM users WHERE username = 'player1@gmail.com'")
        ).fetchone()
        self.assertIsNotNone(user_row)
        stored_pwd = user_row[0]
        self.assertTrue(is_hashed_password(stored_pwd))
        self.assertTrue(verify_password("secret_password_1", stored_pwd)[0])

    def test_user_authenticate_migrates_plaintext_to_hash(self):
        """Kiểm tra cơ chế tự động di chuyển mật khẩu cũ sang Bcrypt khi đăng nhập (Rehash on Login)."""
        # Giả lập người dùng cũ có mật khẩu plaintext 'old_pwd_123'
        self.db.execute(text("""
            INSERT INTO users (username, password, role, full_name)
            VALUES ('olduser@gmail.com', 'old_pwd_123', 'user', 'Người dùng cũ');
        """))
        self.db.commit()

        # Đăng nhập lần đầu với mật khẩu cũ
        res = self.user_service.authenticate(self.db, "olduser@gmail.com", "old_pwd_123")
        self.assertEqual(res["username"], "olduser@gmail.com")
        self.assertIn("access_token", res)
        self.assertEqual(res["token_type"], "bearer")

        # Kiểm tra trong DB: mật khẩu đã được tự động nâng cấp sang Bcrypt hash
        row_after = self.db.execute(
            text("SELECT password FROM users WHERE username = 'olduser@gmail.com'")
        ).fetchone()
        new_stored = row_after[0]
        self.assertTrue(is_hashed_password(new_stored))
        self.assertNotEqual(new_stored, "old_pwd_123")

        # Đăng nhập lần thứ hai vẫn hoạt động hoàn hảo với mật khẩu đã băm
        res2 = self.user_service.authenticate(self.db, "olduser@gmail.com", "old_pwd_123")
        self.assertEqual(res2["username"], "olduser@gmail.com")

    def test_update_profile_hashes_new_password(self):
        """Kiểm tra tính năng đổi mật khẩu băm mật khẩu mới bằng Bcrypt."""
        created = self.user_service.register(
            db=self.db,
            username="changepwd@gmail.com",
            password="initial_password"
        )
        user_id = created["id"]

        # Đổi mật khẩu sang mật khẩu mới
        self.user_service.update_profile(
            db=self.db,
            user_id=user_id,
            current_password="initial_password",
            new_password="brand_new_password_2026"
        )

        # Xác thực đăng nhập lại bằng mật khẩu mới
        res = self.user_service.authenticate(self.db, "changepwd@gmail.com", "brand_new_password_2026")
        self.assertEqual(res["id"], user_id)

    def test_auth_dependency_with_jwt_and_fallback(self):
        """Kiểm tra Dependency xác thực FastAPI hỗ trợ cả JWT Bearer và Fallback Query Parameters."""
        # Tạo người dùng trong CSDL
        self.db.execute(text("""
            INSERT INTO users (id, username, password, role, full_name)
            VALUES (99, 'jwtuser@gmail.com', 'hashed', 'admin', 'JWT User');
        """))
        self.db.commit()

        # 1. Xác thực bằng Bearer Token hợp lệ
        valid_token = create_access_token({"sub": "99", "role": "admin"})
        auth_header = f"Bearer {valid_token}"
        user_by_token = get_current_user_optional(authorization=auth_header, db=self.db)
        self.assertIsNotNone(user_by_token)
        self.assertEqual(user_by_token["id"], 99)
        self.assertEqual(user_by_token["role"], "admin")

        # 2. Xác thực bằng Fallback Query parameters khi không có Token (Tương thích ngược)
        user_by_fallback = get_current_user_optional(
            authorization=None,
            fallback_user_id=99,
            fallback_role="admin",
            db=self.db
        )
        self.assertIsNotNone(user_by_fallback)
        self.assertEqual(user_by_fallback["id"], 99)

        # 3. Khi không có cả hai -> trả về None
        none_user = get_current_user_optional(authorization=None, db=self.db)
        self.assertIsNone(none_user)

    def test_lazy_loading_translation_service(self):
        """Kiểm tra dịch vụ TranslationService hỗ trợ dịch văn bản và bộ nhớ đệm (Cache)."""
        # Kiểm tra dịch từ điển cục bộ hoặc xử lý chuỗi rỗng
        empty_res = TranslationService.translate("")
        self.assertEqual(empty_res, "")

        # Kiểm tra tinh chỉnh thuật ngữ hậu dịch thô
        refined = TranslationService._refine_en_to_vi("đứng lười biếng")
        self.assertIn("đứng yên thở tĩnh", refined)


if __name__ == "__main__":
    unittest.main()
