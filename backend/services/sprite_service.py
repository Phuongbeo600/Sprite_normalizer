# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Bộ đệm dữ liệu)
# ========================================================
# io: Xử lý luồng byte trong bộ nhớ RAM cho ảnh
import io
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

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class SpriteService:
    """
    Dịch vụ xử lý và chuẩn hóa kích thước Sprite (Sprite Normalization Service).
    Đóng gói toàn bộ luồng đọc byte ảnh, gọi thuật toán SpriteNormalizer và xuất dữ liệu PNG.
    """

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

        out_buffer = io.BytesIO()
        normalized_img.save(out_buffer, format="PNG")
        return out_buffer.getvalue()
