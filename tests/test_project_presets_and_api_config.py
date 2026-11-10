# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử đơn vị & JSON)
# ========================================================
# unittest: Framework kiểm thử chuẩn của Python
import unittest
# json: Xử lý chuỗi JSON kiểm tra dữ liệu
import json

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Tạo SQLite bộ nhớ tạm (in-memory) phục vụ kiểm thử cô lập không cần MySQL thật
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Repositories & Services)
# ========================================================
# ProjectRepository: Quản lý dự án và cấu hình API Key
from backend.repositories.project_repository import ProjectRepository
# CharacterPresetRepository: Quản lý bản phân tích và prompt đã lưu
from backend.repositories.character_preset_repository import CharacterPresetRepository
# ProjectService: Tầng nghiệp vụ điều phối
from backend.services.project_service import ProjectService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file test backend)


class TestProjectPresetsAndApiConfig(unittest.TestCase):
    """
    Bộ kiểm thử đơn vị cho tính năng Cấu hình API Key theo Dự án
    và Quản lý Thư viện Bản Phân Tích & Prompt (Presets) trong CSDL:
    - Kiểm tra lưu và đọc trạng thái API Key riêng của từng dự án.
    - Kiểm tra che giấu key an toàn (Masked Key).
    - Kiểm tra lưu trữ, truy vấn, đọc chi tiết và xóa Presets theo project_id.
    - Xác nhận tính cô lập dữ liệu 100% giữa các dự án khác nhau.
    """

    def setUp(self):
        """Khởi tạo CSDL SQLite in-memory giả lập cấu trúc MySQL để kiểm thử nhanh chóng."""
        self.engine = create_engine("sqlite:///:memory:")
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Tạo bảng projects giả lập
        self.db.execute(text("""
            CREATE TABLE projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                api_provider VARCHAR(50) DEFAULT 'gemini',
                gemini_api_key TEXT NULL,
                openai_api_key TEXT NULL,
                openai_base_url VARCHAR(255) DEFAULT 'https://api.openai.com/v1'
            )
        """))

        # Tạo bảng project_character_presets giả lập
        self.db.execute(text("""
            CREATE TABLE project_character_presets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name VARCHAR(255) NOT NULL,
                sprite_name VARCHAR(255) NULL,
                metrics_data TEXT NULL,
                profile_data TEXT NULL,
                new_character_concept VARCHAR(255) NOT NULL,
                outfit_and_colors TEXT NULL,
                weapons_and_props TEXT NULL,
                stature_rule VARCHAR(100) NULL,
                target_direction VARCHAR(100) DEFAULT 'Front / Down view',
                positive_prompt TEXT NOT NULL,
                negative_prompt TEXT NOT NULL,
                technical_notes TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        self.db.commit()

        # Khởi tạo repositories và service
        self.project_repo = ProjectRepository()
        self.preset_repo = CharacterPresetRepository()
        self.service = ProjectService(repository=self.project_repo, preset_repository=self.preset_repo)

        # Tạo 2 dự án mẫu để kiểm tra tính cô lập dữ liệu
        p1 = self.project_repo.create(self.db, name="Dự án Game Hiệp Sĩ")
        p2 = self.project_repo.create(self.db, name="Dự án Game Ninja")
        self.project_1_id = p1["id"]
        self.project_2_id = p2["id"]

    def tearDown(self):
        """Dọn dẹp phiên làm việc CSDL sau mỗi bài test."""
        self.db.close()

    def test_01_project_api_config_isolated(self):
        """Kiểm tra cấu hình API Key độc lập theo từng dự án: Dự án 1 có key, Dự án 2 chưa có."""
        # Cập nhật key cho Dự án 1 (Google Gemini)
        self.service.update_api_config(
            db=self.db,
            project_id=self.project_1_id,
            api_provider="gemini",
            gemini_api_key="AIzaSyTestGeminiKey1234567890"
        )

        # Đọc cấu hình Dự án 1
        cfg1 = self.service.get_api_config(self.db, self.project_1_id)
        self.assertTrue(cfg1["gemini_has_key"])
        self.assertFalse(cfg1["openai_has_key"])
        self.assertIn("...", cfg1["gemini_masked_key"])
        self.assertTrue(cfg1["gemini_masked_key"].startswith("AIzaSy"))

        # Đọc cấu hình Dự án 2 ➔ Khẳng định Dự án 2 hoàn toàn chưa có key
        cfg2 = self.service.get_api_config(self.db, self.project_2_id)
        self.assertFalse(cfg2["gemini_has_key"])
        self.assertEqual(cfg2["gemini_masked_key"], "")

    def test_02_create_and_list_presets_by_project(self):
        """Kiểm tra lưu bản phân tích & Prompt vào đúng dự án và chỉ đọc đúng dự án đó."""
        sample_metrics = {"anatomical_height": 48, "heads_tall": 2.5, "head_w": 20, "head_h": 16}
        sample_profile = {"pixel_style": {"outline_style": "Selout"}}

        # Lưu preset vào Dự án 1
        created = self.service.create_character_preset(
            db=self.db,
            project_id=self.project_1_id,
            name="Pháp Sư Tím Bản 1",
            sprite_name="knight_ref.png",
            metrics_data=sample_metrics,
            profile_data=sample_profile,
            new_character_concept="Nữ pháp sư tím",
            positive_prompt="masterpiece pixel art female wizard",
            negative_prompt="blurry 3d"
        )
        self.assertIn("id", created)
        preset_id = created["id"]

        # Lấy danh sách preset của Dự án 1
        p1_presets = self.service.get_character_presets(self.db, self.project_1_id)
        self.assertEqual(len(p1_presets), 1)
        self.assertEqual(p1_presets[0]["name"], "Pháp Sư Tím Bản 1")
        self.assertEqual(p1_presets[0]["metrics_data"]["anatomical_height"], 48)

        # Lấy danh sách preset của Dự án 2 ➔ Khẳng định Dự án 2 không có bản ghi nào
        p2_presets = self.service.get_character_presets(self.db, self.project_2_id)
        self.assertEqual(len(p2_presets), 0)

        # Đọc chi tiết bản ghi
        detail = self.service.get_character_preset_by_id(self.db, preset_id, self.project_1_id)
        self.assertIsNotNone(detail)
        self.assertEqual(detail["positive_prompt"], "masterpiece pixel art female wizard")

        # Xóa bản ghi
        del_success = self.service.delete_character_preset(self.db, preset_id, self.project_1_id)
        self.assertTrue(del_success)
        self.assertEqual(len(self.service.get_character_presets(self.db, self.project_1_id)), 0)

    def test_03_self_healing_missing_columns(self):
        """
        Kiểm tra cơ chế Tự Phục Hồi (Self-Healing):
        Nếu bảng projects ban đầu chỉ có các cột cũ (chưa có api_provider),
        hệ thống phải tự động bổ sung cột vào bảng và cập nhật cấu hình API thành công.
        """
        # Tạo bảng projects cũ chỉ có id, name, created_at
        legacy_engine = create_engine("sqlite:///:memory:")
        LegacySession = sessionmaker(bind=legacy_engine)
        legacy_db = LegacySession()

        legacy_db.execute(text("""
            CREATE TABLE projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        legacy_db.commit()

        # Tạo dự án trên bảng cũ
        p = self.project_repo.create(legacy_db, name="Dự án Cũ Chưa Có Cột API")
        old_proj_id = p["id"]

        # Gọi update_api_config: hệ thống phải tự phục hồi thêm cột và lưu thành công
        update_result = self.project_repo.update_api_config(
            db=legacy_db,
            project_id=old_proj_id,
            api_provider="openai",
            openai_api_key="sk-proj-testkey12345678",
            openai_base_url="https://api.openai.com/v1"
        )
        self.assertTrue(update_result)

        # Đọc lại kiểm tra xem key đã được lưu chính xác chưa
        cfg = self.project_repo.get_api_config(legacy_db, old_proj_id)
        self.assertIsNotNone(cfg)
        self.assertEqual(cfg["api_provider"], "openai")
        self.assertTrue(cfg["openai_has_key"])
        self.assertEqual(cfg["_openai_raw_key"], "sk-proj-testkey12345678")

        legacy_db.close()


if __name__ == "__main__":
    unittest.main()
