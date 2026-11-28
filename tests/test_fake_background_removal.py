# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử & Bộ đệm)
# ========================================================
import io
import os
import sys
import unittest
from base64 import b64decode, b64encode
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
import numpy as np
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Core & Services)
# ========================================================
from backend.core.processing.masking import BackgroundMaskExtractor
from backend.schemas.image_gen import GeneratedImageItem
from backend.services.image_post_processing_service import ImagePostProcessingService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & CẤU HÌNH (Không áp dụng)
# ========================================================


def _draw_outlined_sprite_on_sheet(
    sheet_arr: np.ndarray,
    rows: int = 3,
    columns: int = 5,
    cell_w: int = 16,
    cell_h: int = 16,
) -> None:
    """Vẽ nhân vật có viền tối và lõi trắng ở tâm từng ô để kiểm thử bảo vệ chi tiết."""
    for r in range(rows):
        for c in range(columns):
            ox, oy = c * cell_w, r * cell_h
            # Đường viền tối bao quanh (outline 1px)
            sheet_arr[oy + 4 : oy + 12, ox + 4 : ox + 12] = [25, 20, 35, 255]
            # Lõi trắng bên trong (mắt/áo trắng trùng màu nền để kiểm tra bảo vệ vùng kín)
            sheet_arr[oy + 6 : oy + 10, ox + 6 : ox + 10] = [255, 255, 255, 255]


class TestFakeBackgroundRemoval(unittest.TestCase):
    """Kiểm thử thuật toán tách nền giả đơn sắc, ô cờ 2 màu và bảo vệ chi tiết."""

    def test_solid_background_removed_while_protecting_interior_white(self):
        """Nền trắng đơn sắc nối với biên phải bị xóa (alpha=0), vùng trắng kín bên trong được giữ nguyên."""
        arr = np.full((48, 80, 4), [255, 255, 255, 255], dtype=np.uint8)
        _draw_outlined_sprite_on_sheet(arr)
        sheet = Image.fromarray(arr, "RGBA")

        cleaned = BackgroundMaskExtractor.remove_fake_background(sheet)
        out = np.asarray(cleaned)

        # Góc ngoài nền trắng -> alpha = 0
        self.assertEqual(out[0, 0, 3], 0)
        # Viền nhân vật và phần trắng bên trong viền vẫn giữ alpha = 255
        self.assertEqual(out[4, 4, 3], 255)
        self.assertEqual(tuple(out[7, 7]), (255, 255, 255, 255))

    def test_checkerboard_2_color_removed_across_post_processing_pipeline(self):
        """Nền ô cờ trắng/xám phải được tách sạch thành alpha=0 qua trọn pipeline 15 frame và Sheet 3x5."""
        h, w = 48, 80
        yy, xx = np.indices((h, w))
        is_light = ((yy // 4) + (xx // 4)) % 2 == 0
        arr = np.empty((h, w, 4), dtype=np.uint8)
        arr[is_light] = [250, 250, 250, 255]
        arr[~is_light] = [204, 204, 204, 255]
        _draw_outlined_sprite_on_sheet(arr)

        buf = io.BytesIO()
        Image.fromarray(arr, "RGBA").save(buf, format="PNG")
        b64_raw = b64encode(buf.getvalue()).decode("ascii")
        item = GeneratedImageItem(id="cf_check", b64_data=b64_raw, data_url=f"data:image/png;base64,{b64_raw}")

        result = ImagePostProcessingService.process(item, (20, 20))

        self.assertEqual(result.status, "success")
        self.assertEqual(len(result.frames), 15)
        self.assertIsNotNone(result.sheet_b64_data)

        # Kiểm tra từng frame đều sạch nền ô cờ ở viền ngoài và giữ nguyên lõi trắng bên trong
        with Image.open(io.BytesIO(b64decode(result.frames[0].b64_data))) as f0:
            f0_arr = np.asarray(f0)
            self.assertEqual(f0_arr[0, 0, 3], 0)
            self.assertEqual(f0_arr[19, 0, 3], 0)
            self.assertTrue(np.any((f0_arr[..., 0] == 255) & (f0_arr[..., 3] == 255)))

        with Image.open(io.BytesIO(b64decode(result.sheet_b64_data))) as sheet_out:
            self.assertEqual(sheet_out.size, (100, 60))
            self.assertEqual(sheet_out.getpixel((0, 0))[3], 0)

    def test_already_transparent_image_is_preserved_unchanged(self):
        """Ảnh đã có nền trong suốt thật ở viền phải được giữ nguyên 100%."""
        arr = np.zeros((48, 80, 4), dtype=np.uint8)
        _draw_outlined_sprite_on_sheet(arr)
        img = Image.fromarray(arr, "RGBA")

        spec = BackgroundMaskExtractor.analyze_background(img)
        self.assertIsNone(spec)
        cleaned = BackgroundMaskExtractor.remove_fake_background(img)
        self.assertTrue(np.array_equal(np.asarray(cleaned), arr))

    def test_ambiguous_scenic_background_is_not_falsely_removed(self):
        """Ảnh có nền bầu trời + bãi cỏ 2 màu bão hòa cao hoặc cảnh phức tạp không được nhận nhầm để xóa."""
        arr = np.zeros((48, 80, 4), dtype=np.uint8)
        arr[:24, :, :] = [70, 140, 235, 255]   # Bầu trời xanh
        arr[24:, :, :] = [65, 175, 80, 255]    # Bãi cỏ xanh lá
        _draw_outlined_sprite_on_sheet(arr)
        img = Image.fromarray(arr, "RGBA")

        self.assertIsNone(BackgroundMaskExtractor.analyze_background(img))
        cleaned = BackgroundMaskExtractor.remove_fake_background(img)
        self.assertTrue(np.array_equal(np.asarray(cleaned), arr))

    def test_pipeline_keeps_original_frames_if_background_analysis_fails(self):
        """Nếu bước phân tích/tách nền gặp lỗi bất ngờ, pipeline vẫn giữ ảnh gốc và không sập."""
        arr = np.full((24, 50, 4), [240, 240, 240, 255], dtype=np.uint8)
        _draw_outlined_sprite_on_sheet(arr, rows=3, columns=5, cell_w=10, cell_h=8)
        buf = io.BytesIO()
        Image.fromarray(arr, "RGBA").save(buf, format="PNG")
        b64_raw = b64encode(buf.getvalue()).decode("ascii")
        item = GeneratedImageItem(id="fallback", b64_data=b64_raw, data_url=f"data:image/png;base64,{b64_raw}")

        with patch("backend.services.image_post_processing_service.logger"), patch.object(
            BackgroundMaskExtractor, "analyze_background", side_effect=RuntimeError("unexpected")
        ):
            result = ImagePostProcessingService.process(item, (20, 20))

        self.assertEqual(result.status, "success")
        self.assertEqual(len(result.frames), 15)

    def test_faint_checkerboard_and_enclosed_pockets_removed_while_protecting_solid_eyes(self):
        """Ô cờ trắng-xám rất nhạt kèm viền 1px trắng và hốc ô cờ kẹt giữa 2 chân phải được tách sạch, vẫn giữ mắt trắng."""
        h, w = 64, 64
        yy, xx = np.indices((h, w))
        is_light = ((yy // 4) + (xx // 4)) % 2 == 0
        arr = np.empty((h, w, 4), dtype=np.uint8)
        # Hai màu ô cờ trắng và xám nhạt rất sát nhau (khoảng cách ~22.5)
        arr[is_light] = [255, 255, 255, 255]
        arr[~is_light] = [242, 242, 242, 255]
        # Tạo viền nhiễu trắng 1px ở hàng 0 để kiểm thử quét sâu hơn lớp ngoài cùng
        arr[0, :, :] = [255, 255, 255, 255]

        # Vẽ khung viền nhân vật đóng kín gồm 2 vùng khép kín bên trong:
        # 1) Khoang trên (16:28, 20:44): mắt/giáp trắng thuần [255, 255, 255] -> phải giữ lại alpha=255
        # 2) Khoang dưới (32:54, 20:44): hốc nền ô cờ kẹt giữa hai chân & cán giáo -> phải tách thành alpha=0
        arr[14:56, 18:46] = [20, 20, 30, 255]
        arr[16:28, 20:44] = [255, 255, 255, 255]
        pocket_light = is_light[32:54, 20:44]
        arr[32:54, 20:44][pocket_light] = [255, 255, 255, 255]
        arr[32:54, 20:44][~pocket_light] = [242, 242, 242, 255]

        img = Image.fromarray(arr, "RGBA")
        spec = BackgroundMaskExtractor.analyze_background(img)
        self.assertIsNotNone(spec)
        self.assertEqual(spec.kind, "checkerboard")

        cleaned = BackgroundMaskExtractor.remove_fake_background(img)
        out = np.asarray(cleaned)
        # Nền ngoài bị xóa
        self.assertEqual(out[6, 6, 3], 0)
        # Hốc ô cờ kín bên trong bị đục trong suốt
        self.assertEqual(out[40, 28, 3], 0)
        # Mắt/giáp trắng 1 màu bên trong vẫn được bảo vệ
        self.assertEqual(tuple(out[22, 30]), (255, 255, 255, 255))

    def test_sheet_with_wide_checkerboard_margin_trims_and_removes_background(self):
        """Sheet AI có lề ô cờ rộng xung quanh vẫn phải được tách nền trước khi cắt để căn đúng 15 frame."""
        h, w = 64, 140
        yy, xx = np.indices((h, w))
        is_light = ((yy // 4) + (xx // 4)) % 2 == 0
        arr = np.empty((h, w, 4), dtype=np.uint8)
        arr[is_light] = [254, 254, 254, 255]
        arr[~is_light] = [238, 238, 238, 255]

        # Vẽ 3x5 nhân vật nằm gọn trong vùng giữa (x=30..110, y=8..56) để tạo lề caro rộng hai bên
        for r in range(3):
            for c in range(5):
                ox = 30 + c * 16
                oy = 8 + r * 16
                arr[oy + 2 : oy + 14, ox + 2 : ox + 14] = [30, 35, 50, 255]
                arr[oy + 5 : oy + 11, ox + 5 : ox + 11] = [180, 90, 70, 255]

        buf = io.BytesIO()
        Image.fromarray(arr, "RGBA").save(buf, format="PNG")
        b64_raw = b64encode(buf.getvalue()).decode("ascii")
        item = GeneratedImageItem(id="wide_margin", b64_data=b64_raw, data_url=f"data:image/png;base64,{b64_raw}")

        result = ImagePostProcessingService.process(item, (20, 20))
        self.assertEqual(result.status, "success")
        self.assertEqual(len(result.frames), 15)
        for frame in result.frames:
            with Image.open(io.BytesIO(b64decode(frame.b64_data))) as f_img:
                f_arr = np.asarray(f_img)
                opaque_pixels = f_arr[f_arr[..., 3] > 0]
                self.assertGreater(len(opaque_pixels), 0)
                # Đảm bảo toàn bộ nền ô cờ sáng (238/254) đã được tách sạch khỏi mọi frame
                self.assertFalse(np.any(opaque_pixels[:, 0] >= 230))
                self.assertTrue(np.any((f_arr[..., 0] == 180) & (f_arr[..., 3] == 255)))

    def test_edge_halo_and_orphan_specks_removed_while_keeping_white_boot_and_diagonal_sword(self):
        """Khử viền halo xám nhạt 1px và chấm rác lơ lửng, vẫn giữ mảng giày trắng và kiếm chéo nối thân."""
        from backend.core.processing.masking import BackgroundSpec
        arr = np.full((64, 64, 4), [255, 255, 255, 255], dtype=np.uint8)
        # Thân nhân vật có viền tối [25, 25, 35]
        arr[16:48, 20:44] = [25, 25, 35, 255]
        # Mũi giày trắng xám 4x6 ở rìa dưới phải (dist=32.1 > tol=28, nằm trong dải halo nhưng dày >= 2px nên phải giữ)
        arr[44:48, 38:44] = [230, 236, 248, 255]
        # Dải halo xám nhạt 1px bám dọc mép trái viền đen (mô phỏng anti-aliasing AI)
        arr[18:40, 19] = [212, 212, 212, 255]
        # Thanh kiếm chéo nối liền bằng góc 8-hướng từ tay (cột 19..15)
        for k in range(1, 6):
            arr[24 + k, 20 - k] = [140, 145, 160, 255]
        # Chấm rác li ti bay lơ lửng độc lập ở xa thân (góc dưới phải & rìa trái)
        arr[52:54, 52:54] = [210, 210, 210, 255]
        arr[10, 8:10] = [200, 200, 200, 255]

        spec = BackgroundSpec(kind="solid", colors=(np.array([255.0, 255.0, 255.0], dtype=np.float32),), tolerance=28.0)
        cleaned = BackgroundMaskExtractor.remove_background_with_spec(
            Image.fromarray(arr, "RGBA"), spec, clean_specks=True
        )
        out = np.asarray(cleaned)

        # Halo xám mảnh ở mép trái bị xóa sạch
        self.assertEqual(out[20, 19, 3], 0)
        # Chấm rác bay lơ lửng bị xóa sạch
        self.assertEqual(out[52, 52, 3], 0)
        self.assertEqual(out[10, 8, 3], 0)
        # Giày trắng đặc và mũi kiếm chéo 8-liên thông được bảo toàn
        self.assertEqual(tuple(out[46, 40]), (230, 236, 248, 255))
        self.assertEqual(tuple(out[47, 41]), (230, 236, 248, 255))
        self.assertEqual(tuple(out[29, 15]), (140, 145, 160, 255))


if __name__ == "__main__":
    unittest.main()
