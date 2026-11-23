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
from backend.core.processing.normalizer import SpriteNormalizer
# HeuristicPaletteAnalyzer: Ánh xạ báo cáo màu sang cấu trúc hồ sơ hiện có.
from backend.core.metrics.palette_analyzer import HeuristicPaletteAnalyzer
# analyze_sprite: Phân tích màu, lưới và viền bằng thuật toán Python.
from backend.core.metrics.pixel_art_metrics import analyze_sprite
# color_noise_statistics: Giữ thống kê màu nhất quán với thuật toán tạo palette.
from backend.core.metrics.metric_primitives import color_noise_statistics
# slice_sheet: Cắt từng ô, giữ kích thước và phần trong suốt của ô gốc.
# resize_sprite: Thu nhỏ hoặc ép kích thước từng ô theo thuật toán Nearest Neighbor
from backend.core.processing.sprite_editing import slice_sheet, resize_sprite

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
    def sheet_frames(
        cls,
        image: Image.Image,
        rows: int,
        columns: int,
        auto_anchor: bool = False,
        trim_outer_padding: bool = True,
        x_cuts: list[int] | None = None,
        y_cuts: list[int] | None = None,
    ):
        """Trả tên, kích thước và PNG cho mỗi ô của sheet (hỗ trợ tự gọt lề trống)."""
        for index, frame in enumerate(slice_sheet(
            image, rows, columns, auto_anchor=auto_anchor,
            trim_outer_padding=trim_outer_padding, x_cuts=x_cuts, y_cuts=y_cuts,
        ), start=1):
            yield f"frame_{index:03}.png", frame.size, cls.encode_png(frame)

    @classmethod
    def resized_sheet_frames(cls, image, rows, columns, target_width, target_height,
                             auto_anchor=False, trim_outer_padding=True, x_cuts=None, y_cuts=None):
        """Cắt và ép các ô, trả tên, kích thước và PNG để từng API tự định dạng kết quả.

        @param image Ảnh sheet đã được bên gọi áp dụng hướng EXIF.
        @returns Bộ lặp tên frame, kích thước đích và dữ liệu PNG.
        """
        for name, _size, png in cls.sheet_frames(
            image, rows, columns, auto_anchor=auto_anchor,
            trim_outer_padding=trim_outer_padding, x_cuts=x_cuts, y_cuts=y_cuts,
        ):
            with Image.open(io.BytesIO(png)) as frame:
                resized = resize_sprite(frame, target_width, target_height)
                yield name, resized.size, cls.encode_png(resized)

    @classmethod
    def sheet_zip(
        cls,
        image: Image.Image,
        rows: int,
        columns: int,
        auto_anchor: bool = False,
        target_width: Optional[int] = None,
        target_height: Optional[int] = None,
        trim_outer_padding: bool = True,
        x_cuts: list[int] | None = None,
        y_cuts: list[int] | None = None,
    ) -> bytes:
        """Đóng gói các PNG theo đúng thứ tự hiển thị (Hỗ trợ ép kích thước Nearest Neighbor và gọt lề trống)."""
        buffer = io.BytesIO()
        with ZipFile(buffer, "w") as archive:
            for name, (w, h), png in cls.sheet_frames(
                image, rows, columns, auto_anchor=auto_anchor,
                trim_outer_padding=trim_outer_padding, x_cuts=x_cuts, y_cuts=y_cuts,
            ):
                if target_width and target_height and (target_width != w or target_height != h):
                    frame_img = Image.open(io.BytesIO(png))
                    resized = resize_sprite(frame_img, width=target_width, height=target_height)
                    archive.writestr(name, cls.encode_png(resized))
                else:
                    archive.writestr(name, png)
        return buffer.getvalue()
    @staticmethod
    def analyze_colors(image: Image.Image) -> dict:
        """Trả báo cáo đo màu cục bộ và đặc tả bảng màu dùng trong Studio tích hợp thuật toán LibreSprite."""
        analyzer = HeuristicPaletteAnalyzer()
        report = analyze_sprite(image)
        if "error" in report:
            libresprite_res = analyzer.create_libresprite_palette(image, max_colors=256)
            fallback_metrics = analyzer.analyze_palette(image).model_dump()
            fallback_metrics["raw_colors_count"] = libresprite_res["raw_colors_count"]
            fallback_metrics["libresprite_palette"] = libresprite_res["palette"]
            return {"palette_metrics": fallback_metrics, "pixel_art_report": None}

        libresprite_res = analyzer.create_libresprite_palette(image, max_colors=256)
        metrics = analyzer.from_pixel_art_report(report)
        metrics_dict = metrics.model_dump()

        raw_count = libresprite_res["raw_colors_count"]
        clean_count = metrics.total_colors
        noise_stats = color_noise_statistics(raw_count, clean_count)
        ai_noise = noise_stats["ai_intermediate_colors"]
        has_warning = noise_stats["has_ai_noise_warning"]

        metrics_dict["raw_colors_count"] = raw_count
        metrics_dict["ai_intermediate_colors"] = ai_noise
        metrics_dict["has_ai_noise_warning"] = has_warning
        metrics_dict["libresprite_palette"] = libresprite_res["palette"]

        # Đồng bộ vào pixel_art_report để frontend hiển thị
        report["palette"]["raw_colors_count"] = raw_count
        report["palette"]["clean_colors_count"] = clean_count
        report["palette"]["ai_intermediate_colors"] = ai_noise
        report["palette"]["has_ai_noise_warning"] = has_warning
        report["palette"]["libresprite_palette"] = libresprite_res["palette"]

        return {
            "palette_metrics": metrics_dict,
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
