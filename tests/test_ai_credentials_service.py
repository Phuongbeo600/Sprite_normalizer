# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử đơn vị & Môi trường)
# ========================================================
# unittest: Framework kiểm thử chuẩn của Python
import unittest
# os: Quản lý biến môi trường trong kiểm thử
import os
# patch, MagicMock: Giả lập các cuộc gọi hạ tầng
from unittest.mock import patch, MagicMock

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Tạo SQLite bộ nhớ tạm (in-memory) phục vụ kiểm thử cô lập
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services)
# ========================================================
# AiCredentialsService: Dịch vụ hợp nhất phân giải thông tin xác thực AI
from backend.services.ai_credentials_service import AiCredentialsService
# CharacterAnalysisService: Dịch vụ phân tích nhân vật
from backend.services.character.character_analysis_service import CharacterAnalysisService
# ImageGenService: Dịch vụ tạo ảnh AI
from backend.services.image_gen_service import ImageGenService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file test backend)


class TestAiCredentialsService(unittest.TestCase):
    """
    Bộ kiểm thử đơn vị cho Dịch vụ Hợp Nhất Phân Giải Thông Tin Xác Thực AI (AiCredentialsService).
    - Kiểm tra thứ tự ưu tiên 3 cấp: Khóa trực tiếp > CSDL Dự án > Biến môi trường.
    - Kiểm tra logic kiểm tra cờ ai_enabled của dự án.
    - Xác nhận tính tương thích với CharacterAnalysisService và ImageGenService.
    """

    def setUp(self):
        """Khởi tạo SQLite in-memory giả lập bảng projects."""
        self.engine = create_engine("sqlite:///:memory:")
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Tạo bảng projects với các cột cấu hình AI
        self.db.execute(text("""
            CREATE TABLE projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                api_provider TEXT DEFAULT 'gemini',
                gemini_api_key TEXT DEFAULT NULL,
                openai_api_key TEXT DEFAULT NULL,
                openai_base_url TEXT DEFAULT 'https://api.openai.com/v1',
                ai_enabled BOOLEAN DEFAULT 1
            )
        """))

        # Chèn dự án 1: Có key Gemini, ai_enabled = 1
        self.db.execute(text("""
            INSERT INTO projects (id, name, api_provider, gemini_api_key, ai_enabled)
            VALUES (1, 'Dự án bật AI', 'gemini', 'db-gemini-key-12345', 1)
        """))

        # Chèn dự án 2: Có key OpenAI, ai_enabled = 0 (bị tắt)
        self.db.execute(text("""
            INSERT INTO projects (id, name, api_provider, openai_api_key, openai_base_url, ai_enabled)
            VALUES (2, 'Dự án tắt AI', 'openai', 'db-openai-key-67890', 'https://proxy.custom/v1', 0)
        """))
        self.db.commit()

        # Lưu lại biến môi trường cũ
        self.old_gemini_key = os.environ.get("GEMINI_API_KEY")
        self.old_openai_key = os.environ.get("OPENAI_API_KEY")
        self.old_provider = os.environ.get("AI_PROVIDER")

    def tearDown(self):
        """Khôi phục biến môi trường và đóng phiên CSDL."""
        self.db.close()
        if self.old_gemini_key is not None:
            os.environ["GEMINI_API_KEY"] = self.old_gemini_key
        else:
            os.environ.pop("GEMINI_API_KEY", None)

        if self.old_openai_key is not None:
            os.environ["OPENAI_API_KEY"] = self.old_openai_key
        else:
            os.environ.pop("OPENAI_API_KEY", None)

        if self.old_provider is not None:
            os.environ["AI_PROVIDER"] = self.old_provider
        else:
            os.environ.pop("AI_PROVIDER", None)

    def test_direct_key_has_highest_priority(self):
        """Ưu tiên số 1: Khóa truyền trực tiếp phải ghi đè CSDL và biến môi trường."""
        os.environ["GEMINI_API_KEY"] = "env-key"
        key, provider, base_url = AiCredentialsService.resolve_credentials(
            project_id=1,
            api_key="direct-key-999",
            provider="gemini",
            db=self.db,
        )
        self.assertEqual(key, "direct-key-999")
        self.assertEqual(provider, "gemini")

    def test_database_key_has_second_priority(self):
        """Ưu tiên số 2: Khi không truyền trực tiếp, phải lấy từ CSDL dự án."""
        os.environ["GEMINI_API_KEY"] = "env-key"
        key, provider, base_url = AiCredentialsService.resolve_credentials(
            project_id=1,
            api_key=None,
            db=self.db,
        )
        self.assertEqual(key, "db-gemini-key-12345")
        self.assertEqual(provider, "gemini")

        # Dự án 2 dùng OpenAI
        key2, provider2, base2 = AiCredentialsService.resolve_credentials(
            project_id=2,
            api_key=None,
            db=self.db,
        )
        self.assertEqual(key2, "db-openai-key-67890")
        self.assertEqual(provider2, "openai")
        self.assertEqual(base2, "https://proxy.custom/v1")

    def test_environment_variable_fallback(self):
        """Ưu tiên số 3: Khi không có trong CSDL hoặc không có project_id, lấy từ .env."""
        os.environ["GEMINI_API_KEY"] = "env-gemini-key"
        os.environ["AI_PROVIDER"] = "gemini"
        key, provider, base_url = AiCredentialsService.resolve_credentials(
            project_id=None,
            api_key=None,
            db=self.db,
        )
        self.assertEqual(key, "env-gemini-key")
        self.assertEqual(provider, "gemini")

    def test_is_ai_enabled_logic(self):
        """Kiểm tra cờ ai_enabled: dự án 1 bật, dự án 2 tắt, dự án không tồn tại mặc định bật."""
        self.assertTrue(AiCredentialsService.is_ai_enabled(1, db=self.db))
        self.assertFalse(AiCredentialsService.is_ai_enabled(2, db=self.db))
        self.assertTrue(AiCredentialsService.is_ai_enabled(None, db=self.db))
        self.assertTrue(AiCredentialsService.is_ai_enabled(999, db=self.db))

    def test_service_delegations_preserve_behavior(self):
        """Xác nhận CharacterAnalysisService và ImageGenService ủy quyền chính xác."""
        os.environ["GEMINI_API_KEY"] = "env-key-abc"
        # CharacterAnalysisService._resolve_credentials
        k1, p1, b1 = CharacterAnalysisService._resolve_credentials(None, "gemini", None)
        self.assertEqual(k1, "env-key-abc")
        self.assertEqual(p1, "gemini")

        # ImageGenService.resolve_credentials
        k2, p2, b2 = ImageGenService.resolve_credentials(project_id=1)
        # Giả lập SessionLocal để ImageGenService dùng db SQLite
        with patch("backend.services.ai_credentials_service.SessionLocal", return_value=self.db):
            k3, p3, b3 = ImageGenService.resolve_credentials(project_id=1)
            self.assertEqual(k3, "db-gemini-key-12345")


if __name__ == "__main__":
    unittest.main()
