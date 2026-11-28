# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử, Bộ đệm & Mã hóa)
# ========================================================
import io
import os
import sys
import unittest
from base64 import b64decode, b64encode
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Router, Service, Repo & Schemas)
# ========================================================
from backend.api.v1.image_gen import image_gen_router
from backend.db import get_db
from backend.repositories.sprite_repository import SpriteRepository
from backend.schemas.image_gen import GeneratedImageItem, ImageGenRequest, ImageGenResponse
from backend.services.image_gen_persistence import save_generated_images_to_project
from backend.services.image_gen_service import ImageGenService
from backend.services.image_post_processing_service import ImagePostProcessingService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & CẤU HÌNH (Không áp dụng)
# ========================================================


def _make_png_bytes(size=(50, 24), color=(80, 120, 200, 255)) -> bytes:
    """Tạo ảnh PNG hợp lệ trong bộ nhớ phục vụ kiểm thử."""
    img = Image.new("RGBA", size, color)
    for index in range(15):
        x, y = (index % 5) * 10, (index // 5) * 8
        img.paste((index * 15, 80, 90, 255), (x, y, x + 10, y + 8))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    img.close()
    return buf.getvalue()


def _create_sqlite_sprite_session():
    """Khởi tạo SQLite in-memory mô phỏng 2 bảng project_sprites và sprite_frames."""
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE project_sprites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                file_hash TEXT NULL,
                folder_name TEXT DEFAULT 'Mặc định',
                is_sheet INTEGER DEFAULT 1,
                raw_image_data BLOB NULL,
                processed_image_data BLOB NULL,
                processing_metadata TEXT NULL,
                status TEXT DEFAULT 'raw',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (project_id, file_hash)
            );
        """))
        conn.execute(text("""
            CREATE TABLE sprite_frames (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sprite_id INTEGER NOT NULL,
                project_id INTEGER NULL,
                frame_index INTEGER NOT NULL,
                frame_name TEXT NULL,
                frame_image_data BLOB NOT NULL,
                metadata TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
    Session = sessionmaker(bind=engine)
    return engine, Session()


class TestImageGenPersistence(unittest.TestCase):
    """Kiểm thử ghép sheet hậu xử lý và lưu đồng thời ảnh gốc + ảnh xử lý vào CSDL."""

    def test_post_processing_composes_processed_sheet_3x5(self):
        """Hậu xử lý thành công phải tạo đủ tấm sheet 3x5 ghép từ 15 frame chuẩn hóa."""
        raw_bytes = _make_png_bytes()
        b64_raw = b64encode(raw_bytes).decode("ascii")
        item = GeneratedImageItem(id="img_1", b64_data=b64_raw, data_url=f"data:image/png;base64,{b64_raw}")

        result = ImagePostProcessingService.process(item, (20, 20))

        self.assertEqual(result.status, "success")
        self.assertIsNotNone(result.sheet_b64_data)
        self.assertTrue(result.sheet_data_url.startswith("data:image/png;base64,"))
        with Image.open(io.BytesIO(b64decode(result.sheet_b64_data))) as sheet:
            self.assertEqual(sheet.size, (100, 60))
            # Ô (row=1, col=2) tương ứng index=7 có màu (105, 80, 90, 255) ở tâm ô
            self.assertEqual(sheet.getpixel((2 * 20 + 10, 1 * 20 + 10)), (7 * 15, 80, 90, 255))

    def test_repository_saves_both_raw_processed_and_15_frames(self):
        """Kho lưu trữ phải lưu đầy đủ ảnh gốc API, sheet hậu xử lý và 15 frame con."""
        engine, db = _create_sqlite_sprite_session()
        try:
            repo = SpriteRepository()
            raw_bytes = _make_png_bytes()
            b64_raw = b64encode(raw_bytes).decode("ascii")
            item = GeneratedImageItem(id="img_2", b64_data=b64_raw, data_url=f"data:image/png;base64,{b64_raw}")
            item.post_processing = ImagePostProcessingService.process(item, (20, 20))
            response = ImageGenResponse(provider_used="gemini", model_used="gemini-2.5-flash-image", images=[item])
            request = ImageGenRequest(prompt="Hiệp sĩ pixel giáp tím", project_id=7, native_size_wh=(20, 20))

            save_generated_images_to_project(request=request, response=response, db=db, repository=repo)

            self.assertTrue(item.saved_to_project)
            self.assertIsNotNone(item.saved_sprite_id)

            sprites = repo.get_sprites_by_project(db, 7)
            self.assertEqual(len(sprites), 1)
            self.assertEqual(sprites[0]["folder_name"], "Tạo ảnh AI")
            self.assertEqual(sprites[0]["status"], "processed")
            self.assertEqual(sprites[0]["has_raw"], 1)
            self.assertEqual(sprites[0]["has_processed"], 1)
            self.assertEqual(sprites[0]["frame_count"], 15)

            stored = repo.get_sprite_by_id(db, item.saved_sprite_id, 7)
            self.assertEqual(stored["raw_image_data"], raw_bytes)
            self.assertEqual(stored["processed_image_data"], b64decode(item.post_processing.sheet_b64_data))
            self.assertEqual(len(repo.get_sprite_frames(db, item.saved_sprite_id)), 15)
        finally:
            db.close()
            engine.dispose()

    def test_repository_saves_raw_only_when_post_processing_skipped(self):
        """Khi hậu xử lý bị bỏ qua (thiếu native_size_wh), vẫn phải lưu ảnh gốc API vào dự án."""
        engine, db = _create_sqlite_sprite_session()
        try:
            repo = SpriteRepository()
            raw_bytes = _make_png_bytes()
            b64_raw = b64encode(raw_bytes).decode("ascii")
            item = GeneratedImageItem(id="img_3", b64_data=b64_raw, data_url=f"data:image/png;base64,{b64_raw}")
            item.post_processing = ImagePostProcessingService.process(item, None)
            response = ImageGenResponse(provider_used="openai", model_used="gpt-image-1.5", images=[item])
            request = ImageGenRequest(prompt="Cung thủ", project_id=3)

            save_generated_images_to_project(request=request, response=response, db=db, repository=repo)

            self.assertTrue(item.saved_to_project)
            sprites = repo.get_sprites_by_project(db, 3)
            self.assertEqual(len(sprites), 1)
            self.assertEqual(sprites[0]["status"], "raw")
            self.assertEqual(sprites[0]["has_raw"], 1)
            self.assertEqual(sprites[0]["has_processed"], 0)
            self.assertEqual(sprites[0]["frame_count"], 0)
        finally:
            db.close()
            engine.dispose()

    def test_persistence_failure_does_not_discard_generated_images(self):
        """Nếu lưu MySQL gặp lỗi, phản hồi ảnh AI vẫn được trả về nguyên vẹn cho người dùng."""
        raw_bytes = _make_png_bytes()
        b64_raw = b64encode(raw_bytes).decode("ascii")
        item = GeneratedImageItem(id="img_4", b64_data=b64_raw, data_url=f"data:image/png;base64,{b64_raw}")
        response = ImageGenResponse(provider_used="gemini", model_used="test", images=[item])
        request = ImageGenRequest(prompt="Pháp sư", project_id=5)

        bad_repo = MagicMock()
        bad_repo.save_generated_sprite_pack.side_effect = RuntimeError("DB offline")
        bad_db = MagicMock()

        with patch("backend.services.image_gen_persistence.logger"):
            result = save_generated_images_to_project(request=request, response=response, db=bad_db, repository=bad_repo)

        self.assertEqual(len(result.images), 1)
        self.assertFalse(result.images[0].saved_to_project)
        self.assertIsNone(result.images[0].saved_sprite_id)
        bad_db.rollback.assert_called_once()

    def test_generate_endpoint_closes_db_before_ai_and_persists_after(self):
        """Endpoint tạo ảnh phải giải phóng DB trước khi gọi AI và lưu kết quả sau khi tạo xong."""
        app = FastAPI()
        app.include_router(image_gen_router)
        mock_db = MagicMock()
        app.dependency_overrides[get_db] = lambda: mock_db

        raw_bytes = _make_png_bytes()
        b64_raw = b64encode(raw_bytes).decode("ascii")
        item = GeneratedImageItem(id="img_5", b64_data=b64_raw, data_url=f"data:image/png;base64,{b64_raw}")
        mock_response = ImageGenResponse(provider_used="gemini", model_used="test", images=[item])

        def fake_save(request, response, db=None):
            response.images[0].saved_sprite_id = 42
            response.images[0].saved_to_project = True
            return response

        with patch("backend.api.v1.image_gen.check_project_access"), \
             patch("backend.api.v1.image_gen.check_rate_limit"), \
             patch.object(ImageGenService, "generate_images", return_value=mock_response) as gen_mock, \
             patch.object(ImageGenService, "save_generated_images", side_effect=fake_save) as save_mock:
            with TestClient(app) as client:
                resp = client.post("/image-gen/generate", json={"prompt": "Kỵ sĩ", "project_id": 11})

        self.assertEqual(resp.status_code, 200)
        body = resp.json()
        self.assertEqual(body["images"][0]["saved_sprite_id"], 42)
        self.assertTrue(body["images"][0]["saved_to_project"])
        mock_db.close.assert_called_once()
        gen_mock.assert_called_once()
        save_mock.assert_called_once()


if __name__ == "__main__":
    unittest.main()
