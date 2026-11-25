# 1. THƯ VIỆN NỀN TẢNG PYTHON
# base64, io, tempfile, unittest: Tạo ảnh và cơ sở dữ liệu kiểm thử cô lập.
import base64
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

# 2. THƯ VIỆN BÊN NGOÀI
# Pillow, Pydantic, SQLAlchemy: Kiểm tra ảnh thật, xác thực dữ liệu và lưu SQLite.
from PIL import Image
from pydantic import ValidationError
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import Session

# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
# Router, kho dữ liệu và lược đồ: Kiểm tra đường đi từ yêu cầu đến dữ liệu đã lưu.
from backend.api.v1.projects import create_character_preset, get_character_preset_detail, list_character_presets
from backend.db_schema import ensure_preset_columns
from backend.repositories.character_preset_repository import CharacterPresetRepository
from backend.schemas.project import SaveCharacterPresetRequest
import backend.schemas.project as project_schemas

# 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH


def image_url(image_format="PNG", mime="image/png"):
    """Tạo ảnh raster nhỏ trong bộ nhớ rồi trả về Data URL Base64."""
    with io.BytesIO() as output:
        Image.new("RGB", (2, 3), "red").save(output, format=image_format)
        return f"data:{mime};base64,{base64.b64encode(output.getvalue()).decode()}"


def preset_data(**extra):
    """Trả về dữ liệu hồ sơ đầy đủ để phát hiện mất trường khi lưu."""
    return {
        "name": "Mẫu gốc", "sprite_name": "hero.png",
        "metrics_data": {"height": 3}, "profile_data": {"style": "pixel"},
        "frame_actions_data": {"idle": [1, 2]}, "new_character_concept": "Knight",
        "outfit_and_colors": "red", "weapons_and_props": "sword",
        "stature_rule": "same", "target_direction": "Front / Down view",
        "positive_prompt": "pixel knight", "negative_prompt": "blur",
        "technical_notes": "preserve silhouette", **extra,
    }


def create_legacy_schema(engine):
    """Tạo bảng SQLite cũ có một hồ sơ chưa chứa ảnh tham chiếu."""
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE project_character_presets (
                id INTEGER PRIMARY KEY AUTOINCREMENT, project_id INTEGER NOT NULL,
                name TEXT, sprite_name TEXT, metrics_data JSON, profile_data JSON,
                new_character_concept TEXT, outfit_and_colors TEXT, weapons_and_props TEXT,
                stature_rule TEXT, target_direction TEXT, positive_prompt TEXT,
                negative_prompt TEXT, technical_notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(text("""
            INSERT INTO project_character_presets
            (project_id, name, new_character_concept, positive_prompt, negative_prompt)
            VALUES (1, 'Legacy', 'Old knight', 'old positive', 'old negative')
        """))


class TestPresetReferenceImages(unittest.TestCase):
    """Kiểm tra ảnh gốc được lưu bền vững và xác thực an toàn."""

    def setUp(self):
        """Cô lập từng ca trong thư mục và cơ sở dữ liệu tạm riêng."""
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.database = f"sqlite:///{Path(self.temporary.name) / 'presets.sqlite'}"
        self.repo = CharacterPresetRepository()

    def test_reference_image_survives_database_close_and_reopen(self):
        """Ảnh và toàn bộ trường hồ sơ tồn tại sau khi đóng rồi mở lại SQLite."""
        engine = create_engine(self.database)
        create_legacy_schema(engine)
        original = image_url()
        with Session(engine) as db:
            created = self.repo.create(db, project_id=1, **preset_data(reference_image=original))
            self.repo.create(db, project_id=2, **preset_data(reference_image=image_url("JPEG", "image/jpeg")))
        engine.dispose()

        reopened = create_engine(self.database)
        self.addCleanup(reopened.dispose)
        with Session(reopened) as db:
            detail = self.repo.get_by_id(db, created["id"], 1)
            for key, value in preset_data(reference_image=original).items():
                self.assertEqual(detail[key], value)
            listing = self.repo.get_all_by_project(db, 1)
            self.assertEqual([item["id"] for item in listing], [created["id"], 1])
            self.assertEqual(listing[0]["reference_image"], original)
            self.assertIsNone(listing[1]["reference_image"])
            self.assertIsNone(self.repo.get_by_id(db, created["id"], 2))
            self.assertEqual(self.repo.get_by_id(db, 1, 1)["positive_prompt"], "old positive")

    def test_legacy_list_heals_schema_and_migration_is_idempotent(self):
        """Danh sách tự bổ sung cột và di chuyển lặp lại không đổi dữ liệu cũ."""
        engine = create_engine(self.database)
        self.addCleanup(engine.dispose)
        create_legacy_schema(engine)
        with Session(engine) as db:
            result = self.repo.get_all_by_project(db, 1)
            self.assertIsNone(result[0]["reference_image"])
            ensure_preset_columns(db)
            ensure_preset_columns(db)
            db.commit()
            names = [column["name"] for column in inspect(engine).get_columns("project_character_presets")]
            self.assertEqual(names.count("reference_image"), 1)
            self.assertEqual(db.execute(text("SELECT COUNT(*) FROM project_character_presets")).scalar_one(), 1)
            self.assertEqual(self.repo.get_by_id(db, 1, 1)["new_character_concept"], "Old knight")

    def test_schema_accepts_real_raster_images_unchanged(self):
        """Chấp nhận năm định dạng raster thật và bảo toàn chuỗi ảnh gốc."""
        for image_format, mime in [
            ("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp"),
            ("GIF", "image/gif"), ("BMP", "image/bmp"),
        ]:
            with self.subTest(image_format=image_format):
                value = image_url(image_format, mime)
                request = SaveCharacterPresetRequest(**preset_data(reference_image=value))
                self.assertEqual(request.reference_image, value)

    def test_schema_preserves_omitted_legacy_image(self):
        """Hồ sơ không truyền ảnh hoặc truyền None vẫn hợp lệ."""
        self.assertIsNone(SaveCharacterPresetRequest(**preset_data()).reference_image)
        self.assertIsNone(SaveCharacterPresetRequest(**preset_data(reference_image=None)).reference_image)

    def test_schema_rejects_invalid_or_unsafe_reference_images(self):
        """Từ chối URL ngoài, SVG, Base64 lỗi, ảnh hỏng và loại MIME sai."""
        for value in [
            "https://example.com/reference.png", "blob:example", "",
            "data:image/png;base64,%%%", "data:image/png;base64,aGVsbG8=",
            "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=", "data:image/png,hello",
            image_url("JPEG", "image/png"), image_url().removesuffix("=")[:-8],
        ]:
            with self.subTest(value=value[:70]), self.assertRaises(ValidationError):
                SaveCharacterPresetRequest(**preset_data(reference_image=value))

    def test_schema_rejects_image_larger_than_upload_limit(self):
        """Từ chối ảnh vượt ngưỡng tải lên trước khi giải mã dữ liệu lớn."""
        with patch.object(project_schemas, "MAX_UPLOAD_SIZE_BYTES", 8, create=True):
            with self.assertRaises(ValidationError):
                SaveCharacterPresetRequest(**preset_data(reference_image=image_url()))

    def test_schema_accepts_exact_size_and_rejects_one_byte_over_limit(self):
        """Chấp nhận đúng ngưỡng byte và từ chối ảnh vượt ngưỡng một byte."""
        value = image_url()
        size = len(base64.b64decode(value.partition(",")[2]))
        with patch.object(project_schemas, "MAX_UPLOAD_SIZE_BYTES", size):
            self.assertEqual(SaveCharacterPresetRequest(**preset_data(reference_image=value)).reference_image, value)
        with patch.object(project_schemas, "MAX_UPLOAD_SIZE_BYTES", size - 1):
            with self.assertRaises(ValidationError):
                SaveCharacterPresetRequest(**preset_data(reference_image=value))

    def test_router_saves_original_image_through_service_to_database(self):
        """Router chuyển nguyên vẹn ảnh qua dịch vụ đến SQLite để đọc lại."""
        engine = create_engine(self.database)
        self.addCleanup(engine.dispose)
        create_legacy_schema(engine)
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE projects (
                    id INTEGER PRIMARY KEY, name TEXT, user_id INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(text("INSERT INTO projects (id, name, user_id) VALUES (1, 'Owner project', 7)"))
        value = image_url()
        owner = {"id": 7, "role": "user"}
        with Session(engine) as db:
            response = create_character_preset(
                1, SaveCharacterPresetRequest(**preset_data(reference_image=value)),
                current_user=owner, db=db,
            )
            saved_id = response["data"]["id"]
        with Session(engine) as db:
            detail = get_character_preset_detail(1, saved_id, current_user=owner, db=db)["data"]
            self.assertEqual(detail["reference_image"], value)
            listing = list_character_presets(1, current_user=owner, db=db)["data"]
            self.assertEqual(listing[0]["reference_image"], value)
            self.assertIsNone(listing[1]["reference_image"])
