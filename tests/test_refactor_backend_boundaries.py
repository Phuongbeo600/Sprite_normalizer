# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử và mã hóa)
import hashlib
import io
import json
import unittest
from unittest.mock import MagicMock, patch

# 2. THƯ VIỆN BÊN NGOÀI (Ảnh và HTTP giả lập)
import numpy as np
from PIL import Image
from fastapi import FastAPI
from fastapi.testclient import TestClient

# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Các ranh giới đã tách)
from backend.api.v1.sprites import sprites_router
from backend.core.metrics.pixel_art_metrics import analyze_sprite
from backend.development_seed import synchronize_development_login
from backend.services.sprite_workspace_service import SpriteWorkspaceService
from backend.services.user_service import public_user
from backend.services.character.character_analysis_service import CharacterAnalysisService

# 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
# Kiểm thử cô lập, không mở kết nối CSDL hoặc gọi AI.


class TestRefactorBackendBoundaries(unittest.TestCase):
    """Đặc tả hợp đồng tại các ranh giới dịch vụ và thuật toán."""

    def test_both_resize_adapters_keep_distinct_shapes_and_errors(self):
        """Hai tuyến vẫn giữ khóa JSON, tham số trim và mã lỗi riêng."""
        app = FastAPI()
        app.include_router(sprites_router)
        buffer = io.BytesIO()
        Image.new("RGBA", (8, 4), "red").save(buffer, format="PNG")
        data = {"rows": 1, "columns": 2, "target_width": 2, "target_height": 2}
        with TestClient(app) as client:
            response = client.post("/batch-resize-sheet", data=data, files={"file": ("sheet.png", buffer.getvalue(), "image/png")})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(set(response.json()["frames"][0]), {"name", "width", "height", "png"})
            response = client.post("/sprites/batch-resize-sheet", data=data, files={"file": ("sheet.png", buffer.getvalue(), "image/png")})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(set(response.json()["frames"][0]), {"name", "size", "png"})
            for route, expected in (("/batch-resize-sheet", 422), ("/sprites/batch-resize-sheet", 400)):
                response = client.post(route, data={**data, "target_width": 0}, files={"file": ("sheet.png", buffer.getvalue(), "image/png")})
                self.assertEqual(response.status_code, expected)
            for route, expected in (("/batch-resize-sheet", 400), ("/sprites/batch-resize-sheet", 500)):
                response = client.post(route, data=data, files={"file": ("bad.png", b"invalid", "image/png")})
                self.assertEqual(response.status_code, expected)

    def test_trim_option_belongs_to_stateless_adapter(self):
        """Tuyến cũ giữ mặc định gọt lề và không nhận tùy chọn của tuyến mới."""
        app = FastAPI()
        app.include_router(sprites_router)
        buffer = io.BytesIO()
        Image.new("RGBA", (4, 4), "red").save(buffer, format="PNG")
        data = {"rows": 1, "columns": 1, "target_width": 2, "target_height": 2, "trim_outer_padding": "false"}
        with patch("backend.api.v1.sprites.SpriteService.resized_sheet_frames", return_value=[]) as resize:
            with TestClient(app) as client:
                for route in ("/batch-resize-sheet", "/sprites/batch-resize-sheet"):
                    response = client.post(route, data=data, files={"file": ("sheet.png", buffer.getvalue(), "image/png")})
                    self.assertEqual(response.status_code, 200)
            self.assertFalse(resize.call_args_list[0].kwargs["trim_outer_padding"])
            self.assertNotIn("trim_outer_padding", resize.call_args_list[1].kwargs)

    def test_raw_duplicate_does_not_write(self):
        """Ảnh trùng được trả nguyên tên và mã định danh mà không ghi kho."""
        repository = MagicMock()
        repository.get_by_hash.return_value = {"id": 7, "name": "saved"}
        result = SpriteWorkspaceService(repository).save_raw(None, b"raw", "upload.png", "new", 3)
        self.assertTrue(result["is_duplicate"])
        self.assertEqual(result["name"], "saved")
        self.assertEqual(result["file_hash"], hashlib.sha256(b"raw").hexdigest())
        repository.save_raw_sprite.assert_not_called()

    def test_seed_login_preserves_commit_rollback_policy(self):
        """Đồng bộ mẫu commit thành công và rollback khi lỗi như trước."""
        for fails in (False, True):
            db = MagicMock()
            repo = MagicMock()
            if fails:
                db.execute.side_effect = RuntimeError("offline")
            result = synchronize_development_login(db, repo, "admin", "1", None,
                                                   lambda *_: (False, False), lambda _: "hashed")
            if fails:
                db.rollback.assert_called_once()
                db.commit.assert_not_called()
                self.assertIsNone(result)
            else:
                db.commit.assert_called_once()
                db.rollback.assert_not_called()
                repo.get_by_username.assert_called_once_with(db, "admin")

    def test_public_user_defaults_and_secret_exclusion(self):
        """Hồ sơ công khai giữ mặc định và loại trường mật khẩu."""
        result = public_user({"id": 3, "username": "user", "role": "user", "password": "secret"})
        self.assertEqual(result["full_name"], "user")
        self.assertEqual(result["created_at"], "")
        self.assertNotIn("password", result)

    def test_all_profile_preserves_order_and_palette_omission(self):
        """Luồng tất cả dùng kết quả trước cho constraints và bỏ palette khi chỉ thị giác."""
        service = CharacterAnalysisService
        with patch.object(service, "analyze_tab_global", return_value={"palette_metrics": 1}) as global_call, \
             patch.object(service, "analyze_tab_directions", return_value={"direction": 2}), \
             patch.object(service, "analyze_tab_animations", return_value={"animation": 3}), \
             patch.object(service, "analyze_tab_constraints", return_value={}) as constraints:
            result = service.analyze_profile(None, "all", "key", "gemini", None, vision_only=True)
        global_call.assert_called_once_with(None, api_key="key", provider="gemini", base_url=None, include_palette=False, model=None)
        self.assertEqual(constraints.call_args.kwargs["direction_data"], {"direction": 2})
        self.assertNotIn("palette_metrics", result["data"])
        self.assertIn("frame_actions_data", result["data"])

    def test_metric_stage_extraction_keeps_numeric_report(self):
        """So toàn bộ báo cáo với chữ ký lấy trước khi tách các giai đoạn đo."""
        expected = {3: "dbd9c1355be9194a2964268b5d97b9595389a140bb6ff68022061a4d11c259d4",
                    17: "054d96845e03cb2f65ac09fa2fdff97c3a89336b6bbce44395d0fb4a17482894"}
        for seed, digest in expected.items():
            values = np.random.default_rng(seed).integers(0, 5, (12, 10, 1), dtype=np.uint8) * 50
            rgb = np.concatenate((values, np.roll(values, 1, 0), np.roll(values, 2, 1)), axis=2)
            rgba = np.concatenate((rgb, np.full((12, 10, 1), 255, np.uint8)), axis=2)
            rgba[0, :, 3] = 0
            report = analyze_sprite(Image.fromarray(rgba), force_scale=1)
            self.assertEqual(hashlib.sha256(json.dumps(report, sort_keys=True).encode()).hexdigest(), digest)
