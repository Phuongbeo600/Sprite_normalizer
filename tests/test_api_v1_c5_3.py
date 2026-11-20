# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử, Môi trường & Bộ đệm)
# ========================================================
# sys, os: Thiết lập đường dẫn module gốc cho kiểm thử
import sys
import os
import asyncio
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
# io: Xử lý bộ đệm ảnh nhị phân trong bộ nhớ
import io
# unittest: Framework kiểm thử đơn vị tiêu chuẩn
import unittest
# MagicMock: Giả lập đối tượng kiểm thử
from unittest.mock import MagicMock

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# fastapi: Khởi tạo đối tượng UploadFile và bắt ngoại lệ HTTPException
from fastapi import HTTPException, UploadFile
# PIL (Pillow): Tạo ảnh mẫu kiểm thử định dạng PNG
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Routers, Schemas & Repositories)
# ========================================================
# Schemas xác thực mới tách từ auth.py
from backend.schemas.auth import LoginRequest, RegisterRequest, UpdateProfileRequest
# Schemas dự án mới tách từ projects.py
from backend.schemas.project import ProjectApiConfigRequest, SaveCharacterPresetRequest
# Schemas prompt mới tách từ character_analysis.py
from backend.schemas.character.prompt import (
    GeneratePromptFromProfileRequest,
    CompileSpriteSheetPromptRequest
)
# sprites router & helpers
from backend.api.v1.sprites import (
    get_sprite_repository,
    _validate_image_upload,
    detect_sprite_resolution,
    resize_sprite,
    slice_sprite_sheet,
    save_raw_sprite,
    save_sliced_pack,
    get_sprite_frames,
    get_frame_image
)
from backend.repositories.sprite_repository import SpriteRepository
from backend.api.v1.auth import get_user_service
from backend.services.user_service import UserService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file test backend)


class TestApiV1SchemasC53(unittest.TestCase):
    """
    Bộ kiểm thử đơn vị cho các Pydantic DTOs/Schemas được tách từ Router (U-11):
    - Auth Schemas: LoginRequest, RegisterRequest, UpdateProfileRequest.
    - Project Schemas: ProjectApiConfigRequest, SaveCharacterPresetRequest.
    - Character Prompt Schemas: GeneratePromptFromProfileRequest, CompileSpriteSheetPromptRequest.
    """

    def test_auth_schemas(self):
        """Kiểm tra khởi tạo và kiểm thực tính hợp lệ của Auth Schemas."""
        login = LoginRequest(username="admin@test.com", password="pwd")
        self.assertEqual(login.username, "admin@test.com")

        reg = RegisterRequest(username="user@gmail.com", password="123", first_name="An")
        self.assertEqual(reg.first_name, "An")
        self.assertIsNone(reg.last_name)

        up = UpdateProfileRequest(user_id=5, first_name="Bình")
        self.assertEqual(up.user_id, 5)
        self.assertEqual(up.first_name, "Bình")

    def test_project_schemas(self):
        """Kiểm tra khởi tạo và giá trị mặc định của Project Schemas."""
        cfg = ProjectApiConfigRequest()
        self.assertEqual(cfg.api_provider, "gemini")
        self.assertEqual(cfg.openai_base_url, "https://api.openai.com/v1")
        self.assertIsNone(cfg.ai_enabled)

        preset = SaveCharacterPresetRequest(
            name="Preset 1",
            new_character_concept="Chiến binh",
            positive_prompt="warrior knight",
            negative_prompt="modern, 3D"
        )
        self.assertEqual(preset.name, "Preset 1")
        self.assertEqual(preset.stature_rule, "Bằng nhân vật gốc (Tỷ lệ chuẩn)")

    def test_character_prompt_schemas(self):
        """Kiểm tra khởi tạo các schema yêu cầu tạo Prompt từ hồ sơ nhân vật."""
        gen = GeneratePromptFromProfileRequest()
        self.assertEqual(gen.stature_rule, "Bằng nhân vật gốc (Tỷ lệ chuẩn)")
        self.assertTrue(gen.inherit_scale)
        self.assertTrue(gen.inherit_style)

        compile_req = CompileSpriteSheetPromptRequest(
            character_concept="Ninja bóng đêm"
        )
        self.assertEqual(compile_req.character_concept, "Ninja bóng đêm")
        self.assertEqual(compile_req.profile_data, {})


class TestSpriteRouterRefactoringC53(unittest.TestCase):
    """
    Bộ kiểm thử đơn vị cho Router Sprites sau refactor (U-03):
    - Kiểm tra dependency get_sprite_repository.
    - Kiểm tra helper _validate_image_upload.
    - Kiểm tra các endpoint xử lý ảnh không lưu trạng thái (Stateless).
    """

    def test_dependencies(self):
        """Kiểm tra các hàm Dependency Injection trả về đúng kiểu instance."""
        repo = get_sprite_repository()
        self.assertIsInstance(repo, SpriteRepository)

        svc = get_user_service()
        self.assertIsInstance(svc, UserService)

    def test_validate_image_upload_helper(self):
        """Kiểm tra helper _validate_image_upload chặn các định dạng không phải ảnh."""
        # File hợp lệ
        valid_file = MagicMock(spec=UploadFile)
        valid_file.content_type = "image/png"
        _validate_image_upload(valid_file)  # Không ném lỗi

        # File không hợp lệ (PDF)
        invalid_file = MagicMock(spec=UploadFile)
        invalid_file.content_type = "application/pdf"
        with self.assertRaises(HTTPException) as ctx:
            _validate_image_upload(invalid_file)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("định dạng hình ảnh", ctx.exception.detail)

    def test_stateless_sprite_endpoints(self):
        """Kiểm tra các endpoint xử lý ảnh không lưu trạng thái hoạt động chính xác."""
        # Tạo ảnh mẫu 16x16 pixel màu đỏ trong bộ nhớ
        img = Image.new("RGBA", (16, 16), color="red")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        upload_file = UploadFile(buf, filename="sample.png")

        # 1. detect_sprite_resolution
        res_detect = detect_sprite_resolution(upload_file)
        self.assertEqual(res_detect["width"], 16)
        self.assertEqual(res_detect["height"], 16)
        self.assertEqual(res_detect["scale"], 1)

        # 2. resize_sprite
        buf.seek(0)
        upload_resize = UploadFile(buf, filename="sample.png")
        resp_resize = resize_sprite(upload_resize, target_width=32, target_height=32)
        self.assertEqual(resp_resize.media_type, "image/png")
        resized_img = Image.open(io.BytesIO(resp_resize.body))
        self.assertEqual(resized_img.size, (32, 32))

        # 3. slice_sprite_sheet
        buf.seek(0)
        upload_slice = UploadFile(buf, filename="sample.png")
        res_slice = slice_sprite_sheet(upload_slice, rows=2, columns=2, output="json")
        self.assertIn("frames", res_slice)
        self.assertEqual(len(res_slice["frames"]), 4)

    def test_save_raw_sprite_api_duplicate_detection(self):
        """Kiểm tra API save_raw_sprite phát hiện ảnh trùng lặp qua băm SHA-256 và trả về is_duplicate=True."""
        from unittest.mock import patch

        # Giả lập trường hợp phát hiện mã băm đã tồn tại
        with patch("backend.api.v1.sprites.sprite_repo.get_by_hash") as mock_get_hash:
            mock_get_hash.return_value = {"id": 88, "name": "existing_hero.png"}

            buf = io.BytesIO(b"duplicate_sprite_test_bytes")
            upload_file = UploadFile(buf, filename="hero_copy.png")
            mock_db = MagicMock()

            result = asyncio.run(save_raw_sprite(
                file=upload_file,
                project_id=1,
                name="hero_copy.png",
                db=mock_db
            ))

            self.assertEqual(result["status"], "success")
            self.assertEqual(result["id"], 88)
            self.assertTrue(result["is_duplicate"])
            self.assertIn("chặn lưu trùng lặp", result["message"])

    def test_save_sliced_pack_api(self):
        """Kiểm tra API save_sliced_pack lưu bộ frame vào thư mục thành công."""
        from unittest.mock import patch

        img = Image.new("RGBA", (32, 32), color="purple")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)

        upload_file = UploadFile(buf, filename="mage_3x3.png")
        mock_db = MagicMock()

        with patch("backend.api.v1.sprites.sprite_repo.save_sliced_pack") as mock_save_pack:
            mock_save_pack.return_value = {
                "sprite_id": 12,
                "folder_name": "Phap_Su_Tim",
                "sheet_name": "mage_3x3.png",
                "frame_count": 4,
                "is_duplicate_sheet": False
            }

            result = asyncio.run(save_sliced_pack(
                file=upload_file,
                project_id=1,
                folder_name="Phap_Su_Tim",
                rows=2,
                columns=2,
                auto_anchor=False,
                fps=6,
                db=mock_db
            ))

            self.assertEqual(result["status"], "success")
            self.assertEqual(result["sprite_id"], 12)
            self.assertEqual(result["folder_name"], "Phap_Su_Tim")
            self.assertEqual(result["frame_count"], 4)
            self.assertIn("Phap_Su_Tim", result["message"])


if __name__ == "__main__":
    unittest.main()
