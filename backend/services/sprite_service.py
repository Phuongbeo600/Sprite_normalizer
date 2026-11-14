# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Bộ đệm dữ liệu)
# ========================================================
# io: Xử lý luồng byte trong bộ nhớ RAM cho ảnh
import io
# zipfile: Đóng gói các frame PNG để tải cùng lúc.
from zipfile import ZipFile
# typing: Định nghĩa các kiểu dữ liệu
from typing import Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# PIL (Pillow): Mở và xuất định dạng ảnh
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Core Normalizer)
# ========================================================
# SpriteNormalizer: Thuật toán cắt biên và căn lề điểm neo
from backend.core.normalizer import SpriteNormalizer
# HeuristicPaletteAnalyzer: Ánh xạ báo cáo màu sang cấu trúc hồ sơ hiện có.
from backend.core.palette_analyzer import HeuristicPaletteAnalyzer
# analyze_sprite: Phân tích màu, lưới và viền bằng thuật toán Python.
from backend.core.pixel_art_metrics import analyze_sprite
# slice_sheet: Cắt từng ô, giữ kích thước và phần trong suốt của ô gốc.
from backend.core.sprite_editing import slice_sheet

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class SpriteService:
    """Xử lý ảnh sprite và đóng gói kết quả xuất."""

    @staticmethod
    def encode_png(image: Image.Image) -> bytes:
        """Mã hóa ảnh thành PNG trong bộ nhớ."""
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return buffer.getvalue()

    @classmethod
    def sheet_frames(cls, image: Image.Image, rows: int, columns: int, auto_anchor: bool = False):
        """Trả tên, kích thước và PNG cho mỗi ô của sheet."""
        for index, frame in enumerate(slice_sheet(image, rows, columns, auto_anchor=auto_anchor), start=1):
            yield f"frame_{index:03}.png", frame.size, cls.encode_png(frame)

    @classmethod
    def sheet_zip(cls, image: Image.Image, rows: int, columns: int, auto_anchor: bool = False) -> bytes:
        """Đóng gói các PNG theo đúng thứ tự hiển thị."""
        buffer = io.BytesIO()
        with ZipFile(buffer, "w") as archive:
            for name, _, png in cls.sheet_frames(image, rows, columns, auto_anchor=auto_anchor):
                archive.writestr(name, png)
        return buffer.getvalue()
    @staticmethod
    def analyze_colors(image: Image.Image) -> dict:
        """Trả báo cáo đo màu cục bộ và đặc tả bảng màu dùng trong Studio."""
        analyzer = HeuristicPaletteAnalyzer()
        report = analyze_sprite(image)
        if "error" in report:
            return {"palette_metrics": analyzer.analyze_palette(image).model_dump(), "pixel_art_report": None}
        return {
            "palette_metrics": analyzer.from_pixel_art_report(report).model_dump(),
            "pixel_art_report": report,
        }

    @staticmethod
    def normalize_image_bytes(
        image_bytes: bytes,
        target_width: int = 64,
        target_height: int = 64,
        anchor: str = "bottom_center",
        ground_y: Optional[int] = None
    ) -> bytes:
        """
        Chuẩn hóa khung hình sprite từ mảng byte và trả về mảng byte PNG đã xử lý.

        @param {bytes} image_bytes Dữ liệu nhị phân ảnh tải lên.
        @param {int} target_width Chiều rộng khung hình đích.
        @param {int} target_height Chiều cao khung hình đích.
        @param {str} anchor Điểm neo căn chỉnh ('bottom_center', 'center', 'top_left').
        @param {Optional[int]} ground_y Mốc chân tiếp đất sinh học để tránh lơ lửng do bóng.
        @returns {bytes} Mảng byte hình ảnh PNG đã căn chỉnh hoàn hảo.
        """
        image = Image.open(io.BytesIO(image_bytes))

        normalizer = SpriteNormalizer(
            target_width=target_width,
            target_height=target_height,
            anchor=anchor
        )
        normalized_img = normalizer.normalize_frame(image, ground_y=ground_y)

        return SpriteService.encode_png(normalized_img)
