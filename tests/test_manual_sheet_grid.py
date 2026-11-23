"""Kiểm tra cắt lưới thủ công, đệm khung và hợp đồng API."""

# 1. THƯ VIỆN NỀN TẢNG PYTHON
# Bộ đệm, JSON, ZIP và kiểm thử: Tạo dữ liệu hoàn toàn trong bộ nhớ.
import io
import json
import unittest
from base64 import b64decode
from unittest.mock import patch
from zipfile import ZipFile

# 2. THƯ VIỆN BÊN NGOÀI
# FastAPI và Pillow: Gửi biểu mẫu thật và đọc kết quả ảnh.
from fastapi import FastAPI
from fastapi.testclient import TestClient
from PIL import Image

# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
# Router và thuật toán cắt: Kiểm tra cả giao thức HTTP lẫn pixel.
from backend.api.v1.sprites import get_db, sprite_repo, sprites_router
from backend.core.processing.sprite_editing import slice_sheet

# 4. ĐỊNH DẠNG GIAO DIỆN VÀ CẤU HÌNH
# Không áp dụng cho kiểm thử xử lý ảnh.


class TestManualSheetGrid(unittest.TestCase):
    def setUp(self):
        """Tạo bốn ô không đều có màu và alpha riêng để dò mất pixel."""
        self.image = Image.new("RGBA", (12, 10))
        self.x_cuts = [2, 5, 10]
        self.y_cuts = [1, 4, 9]
        self.colors = [(230, 20, 40, 128), (40, 210, 70, 255), (50, 90, 220, 255), (200, 130, 30, 255)]
        for index, (left, top, right, bottom) in enumerate([(2, 1, 5, 4), (5, 1, 10, 4), (2, 4, 5, 9), (5, 4, 10, 9)]):
            self.image.paste(self.colors[index], (left, top, right, bottom))
        app = FastAPI()
        app.include_router(sprites_router)
        app.dependency_overrides[get_db] = lambda: None
        self.client = TestClient(app)

    def post(self, endpoint="/slice-sheet", **data):
        """Gửi ảnh PNG cùng biểu mẫu lưới đã mặc định đủ hai trục."""
        buffer = io.BytesIO()
        self.image.save(buffer, format="PNG")
        form = {"rows": "2", "columns": "2", "x_cuts_json": json.dumps(self.x_cuts), "y_cuts_json": json.dumps(self.y_cuts), **data}
        return self.client.post(endpoint, data=form, files={"file": ("sheet.png", buffer.getvalue(), "image/png")})

    def test_manual_cells_preserve_pixels_and_pad_to_common_canvas(self):
        """Giữ nguyên ô thủ công dù bật gọt lề, căn giữa ngang và sát đáy."""
        frames = list(slice_sheet(self.image, 2, 2, x_cuts=self.x_cuts, y_cuts=self.y_cuts))
        self.assertEqual([frame.size for frame in frames], [(5, 5)] * 4)
        for index, frame in enumerate(frames):
            left, top = (1 if index % 2 == 0 else 0), (2 if index < 2 else 0)
            self.assertEqual(frame.getpixel((left, top)), self.colors[index])
            self.assertEqual(frame.getpixel((left, 4)), self.colors[index])
            self.assertEqual(sum(pixel[3] > 0 for pixel in frame.getdata()), (3 if index % 2 == 0 else 5) * (3 if index < 2 else 5))

    def test_auto_anchor_uses_common_size_without_scaling(self):
        """Neo nội dung từng ô về cùng canvas, không phóng to sprite nhỏ."""
        image = Image.new("RGBA", (9, 7))
        image.putpixel((1, 1), (255, 30, 80, 255))
        image.putpixel((5, 1), (80, 255, 30, 255))
        frames = list(slice_sheet(image, 1, 2, True, x_cuts=[0, 3, 9], y_cuts=[0, 7]))
        for frame in frames:
            self.assertEqual(frame.size, (6, 7))
            self.assertEqual(frame.getbbox(), (2, 6, 3, 7))

    def test_invalid_manual_boundaries_raise_value_error(self):
        """Từ chối thiếu trục, sai độ dài, sai kiểu, đảo thứ tự và vượt ảnh."""
        invalid = [(None, [0, 5, 10]), ([0, 6, 12], None), ([], [0, 5, 10]), ([0, True, 12], [0, 5, 10]), ([0, 6.0, 12], [0, 5, 10]), ([0, 6, 6], [0, 5, 10]), ([-1, 6, 12], [0, 5, 10]), ([0, 6, 13], [0, 5, 10]), ([0, 6, 12], [0, 7, 6]), ("0,6,12", [0, 5, 10])]
        for x_cuts, y_cuts in invalid:
            with self.subTest(x_cuts=x_cuts, y_cuts=y_cuts), self.assertRaises(ValueError):
                list(slice_sheet(self.image, 2, 2, x_cuts=x_cuts, y_cuts=y_cuts))

    def test_manual_auto_anchor_preserves_partial_alpha(self):
        """Neo thủ công giữ nguyên RGBA bán trong suốt và loại ô dưới ngưỡng alpha."""
        image = Image.new("RGBA", (4, 2))
        color = (230, 20, 40, 128)
        image.putpixel((0, 0), color)
        image.putpixel((2, 0), (80, 90, 100, 10))
        frames = list(slice_sheet(image, 1, 2, auto_anchor=True, x_cuts=[0, 2, 4], y_cuts=[0, 2]))
        self.assertEqual(frames[0].size, (2, 2))
        self.assertEqual(frames[0].getpixel((0, 1)), color)
        self.assertEqual(frames[0].getbbox(), (0, 1, 1, 2))
        self.assertEqual(frames[1].tobytes(), Image.new("RGBA", (2, 2)).tobytes())

    def test_manual_output_budget_rejects_before_canvas_allocation(self):
        """Chặn tổng canvas đệm quá lớn trước khi tạo hoặc trả bất kỳ frame nào."""
        with patch("backend.core.processing.sprite_editing.MAX_MANUAL_GRID_PIXELS", 99):
            frames = slice_sheet(self.image, 2, 2, x_cuts=self.x_cuts, y_cuts=self.y_cuts)
            with patch("backend.core.processing.sprite_editing.Image.new") as allocate:
                with self.assertRaisesRegex(ValueError, "pixel"):
                    next(frames)
                allocate.assert_not_called()
            response = self.post()
            self.assertEqual(response.status_code, 422, response.text)
            regular = list(slice_sheet(self.image, 2, 2, trim_outer_padding=False))
            self.assertEqual(len(regular), 4)

    def test_json_and_zip_return_identical_manual_frames(self):
        """Hai định dạng xuất chứa cùng pixel, kích thước và thứ tự hàng."""
        response = self.post()
        self.assertEqual(response.status_code, 200)
        frames = response.json()["frames"]
        archive_response = self.post(output="zip")
        self.assertEqual(archive_response.status_code, 200)
        with ZipFile(io.BytesIO(archive_response.content)) as archive:
            self.assertEqual(archive.namelist(), [frame["name"] for frame in frames])
            for index, frame in enumerate(frames):
                self.assertEqual((frame["width"], frame["height"]), (5, 5))
                png = b64decode(frame["png"])
                self.assertEqual(archive.read(frame["name"]), png)
                with Image.open(io.BytesIO(png)) as image:
                    self.assertEqual(image.getpixel((2, 4)), self.colors[index])

    def test_malformed_boundaries_are_http_422_on_both_endpoints(self):
        """Biểu mẫu lỗi không được âm thầm quay về cắt đều hoặc gây HTTP 500."""
        for endpoint in ["/slice-sheet", "/batch-resize-sheet"]:
            for value in ["[", "null", "{}", "[0,true,12]", "[0,6,13]", "[0,6,12.0]", "[0,0,12]", "[0,12]"]:
                with self.subTest(endpoint=endpoint, value=value):
                    response = self.post(endpoint, x_cuts_json=value, target_width="5", target_height="5")
                    self.assertEqual(response.status_code, 422, response.text)
            response = self.post(endpoint, y_cuts_json="", target_width="5", target_height="5")
            self.assertEqual(response.status_code, 422)

    def test_batch_resize_uses_manual_crop_before_resize(self):
        """Ép khung thủ công đã đệm thay vì cắt lại lưới đều."""
        response = self.post("/batch-resize-sheet", target_width="10", target_height="10")
        self.assertEqual(response.status_code, 200)
        with Image.open(io.BytesIO(b64decode(response.json()["frames"][0]["png"]))) as frame:
            self.assertEqual(frame.size, (10, 10))
            self.assertEqual(frame.getpixel((2, 4)), self.colors[0])
            self.assertEqual(frame.getpixel((0, 0)), (0, 0, 0, 0))

    def test_absent_cuts_preserve_centered_regular_grid(self):
        """Không truyền tọa độ vẫn bỏ phần dư đối xứng như thuật toán cũ."""
        image = Image.new("RGBA", (14, 8), (30, 50, 90, 255))
        image.putpixel((1, 0), (120, 10, 60, 255))
        frames = list(slice_sheet(image, 2, 3, trim_outer_padding=False))
        self.assertEqual([frame.size for frame in frames], [(4, 4)] * 6)
        self.assertEqual(frames[0].getpixel((0, 0)), (120, 10, 60, 255))

    def test_library_pack_saves_manual_frames_and_actual_dimensions(self):
        """Bộ lưu thư viện nhận đúng PNG thủ công và metadata kích thước đã đệm."""
        saved = {}

        def capture_pack(**payload):
            """Cô lập ghi CSDL, thu dữ liệu thật mà tuyến chuẩn bị lưu."""
            saved.update(payload)
            return {"sprite_id": 7, "folder_name": "Mặc định", "sheet_name": "sheet.png", "frame_count": 4}

        with patch.object(sprite_repo, "save_sliced_pack", side_effect=capture_pack):
            response = self.post("/sprites/save-sliced-pack", project_id="1")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual((response.json()["frame_width"], response.json()["frame_height"]), (5, 5))
        self.assertEqual((saved["metadata"]["frame_width"], saved["metadata"]["frame_height"]), (5, 5))
        self.assertEqual(saved["metadata"]["x_cuts"], self.x_cuts)
        self.assertEqual(saved["metadata"]["y_cuts"], self.y_cuts)
        self.assertEqual((saved["metadata"]["source_width"], saved["metadata"]["source_height"]), self.image.size)
        with Image.open(io.BytesIO(saved["sheet_bytes"])) as sheet:
            self.assertEqual(sheet.size, (10, 10))
            self.assertEqual((saved["metadata"]["original_width"], saved["metadata"]["original_height"]), sheet.size)
            reopened_frames = list(slice_sheet(sheet, 2, 2, trim_outer_padding=False))
            for index, frame in enumerate(saved["frames"]):
                with Image.open(io.BytesIO(frame["bytes"])) as original:
                    self.assertEqual(reopened_frames[index].tobytes(), original.tobytes())
                    self.assertEqual(sheet.crop((index % 2 * 5, index // 2 * 5, index % 2 * 5 + 5, index // 2 * 5 + 5)).tobytes(), original.tobytes())
        for index, frame in enumerate(saved["frames"]):
            self.assertEqual(frame["size"], [5, 5])
            with Image.open(io.BytesIO(frame["bytes"])) as image:
                self.assertEqual(image.getpixel((2, 4)), self.colors[index])

    def test_library_and_legacy_resize_reject_bad_cuts(self):
        """Các tuyến lưu và tương thích cũ trả HTTP 422 cho JSON lỗi."""
        for endpoint in ["/sprites/save-sliced-pack", "/sprites/batch-resize-sheet"]:
            response = self.post(endpoint, project_id="1", x_cuts_json="[", target_width="5", target_height="5")
            self.assertEqual(response.status_code, 422, response.text)

    def test_manual_coordinates_use_exif_normalized_image(self):
        """Biên dựa trên chiều ảnh sau xoay EXIF thay vì kích thước tệp gốc."""
        image = Image.new("RGB", (4, 8), (100, 150, 200))
        exif = image.getexif()
        exif[274] = 6
        buffer = io.BytesIO()
        image.save(buffer, format="PNG", exif=exif)
        response = self.client.post("/slice-sheet", data={"rows": "1", "columns": "2", "x_cuts_json": "[0,3,8]", "y_cuts_json": "[0,4]"}, files={"file": ("oriented.png", buffer.getvalue(), "image/png")})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual([(frame["width"], frame["height"]) for frame in response.json()["frames"]], [(5, 4), (5, 4)])
