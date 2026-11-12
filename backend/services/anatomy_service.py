# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Bộ đệm dữ liệu)
# ========================================================
# io: Xử lý bộ đệm nhị phân cho ảnh render
import io
# base64: Mã hóa ảnh kết quả sang chuỗi base64 gửi về Frontend
import base64
# math: Đo khoảng cách giữa hai đầu đoạn.
import math
# typing: Định nghĩa các kiểu dữ liệu
from typing import Optional, Dict, Any, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# numpy: Thao tác ma trận boolean Alpha Mask cho thuật toán Snap Pixel
import numpy as np
# PIL (Pillow): Thao tác xử lý kích thước ảnh
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Thuật toán xử lý ảnh)
# ========================================================
# CharacterMetrics: Data model lưu trữ kết quả giải phẫu
from backend.core.character_metrics import CharacterMetrics
# BackgroundMaskExtractor: Bóc tách kênh Alpha Mask
from backend.core.masking import BackgroundMaskExtractor
# HeuristicAnalyzer: Phân tích giải phẫu học toán học ngoại tuyến
from backend.core.heuristic_analyzer import HeuristicAnalyzer
# measure_region: Đo lát cắt trên vùng do bộ phân tích giải phẫu xác định.
from backend.core.region_measure import measure_region
# Các bộ phận được hỗ trợ, kiểm tra điểm và định dạng báo cáo số đo.
from backend.core.sprite_prompt import PARTS, build_region_report, read_point
# AnatomyVisualRenderer: Vẽ các lớp phủ trực quan Head/Torso/Legs/Weapons
from backend.core.visual_renderer import AnatomyVisualRenderer

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class AnatomyService:
    """Điều phối phép đo hình học và lớp phủ giải phẫu trên ảnh sprite."""

    @classmethod
    def analyze_sprite(
        cls, image: Image.Image, auto_remove_bg: bool = True
    ) -> Tuple[Optional[CharacterMetrics], str, str]:
        """Đo giải phẫu bằng mặt nạ pixel và trả lớp phủ PNG."""
        mask, clean_img = BackgroundMaskExtractor.extract_mask(
            image, auto_remove_solid_bg=auto_remove_bg,
        )
        if not np.any(mask):
            return None, "Không tìm thấy pixel nhân vật (ảnh trống hoặc trong suốt).", ""

        metrics = HeuristicAnalyzer.analyze(clean_img, auto_remove_solid_bg=False)
        if not metrics:
            return None, "Không thể phân tích giải phẫu ảnh bằng thuật toán toán học.", ""

        return metrics, "Đã đo kích thước bằng Python.", cls._render_annotated_base64(clean_img, metrics)

    @staticmethod
    def measure_anatomy_regions(
        image: Image.Image, metrics: CharacterMetrics, auto_remove_bg: bool
    ) -> Dict[str, Any]:
        """Đo lát cắt trên các vùng có sẵn và giữ nguyên bộ số đo giải phẫu cũ."""
        mask, clean_image = BackgroundMaskExtractor.extract_mask(
            image, auto_remove_solid_bg=auto_remove_bg
        )
        clean_image.putalpha(Image.fromarray(mask.astype(np.uint8) * 255))
        head = (metrics.head_y_min, metrics.head_x_min, metrics.head_y_max, metrics.head_x_max)
        neck = (metrics.neck_y, metrics.visible_x_min, metrics.neck_y, metrics.visible_x_max)
        torso = metrics.torso_box
        if torso is None and metrics.crotch_y is not None:
            torso = (metrics.body_y_min, metrics.body_x_min, metrics.crotch_y, metrics.body_x_max)

        measurements = {}
        for part, box in (("head", head), ("neck", neck), ("torso", torso)):
            if box is None:
                continue
            top, left, bottom, right = box
            top, left = max(0, top), max(0, left)
            bottom = min(image.height, bottom + 1)
            right = min(image.width, right + 1)
            if top >= bottom or left >= right or not mask[top:bottom, left:right].any():
                continue
            polygon = ((left, top), (right, top), (right, bottom), (left, bottom))
            region = measure_region(clean_image, part, polygon)
            _, start, end = region.representative
            width = round(region.width, 2)
            measurements[part] = {
                "polygon": polygon, "start": start, "end": end, "width_px": width,
            }
        return build_region_report(image.size, measurements)

    @staticmethod
    def measure_manual_regions(image: Image.Image, data: Dict[str, Any]) -> Dict[str, Any]:
        """Tính lại số đo từ các điểm và trục do người dùng vẽ trên ảnh gốc."""
        if not isinstance(data, dict) or data.get("image_size_px") != list(image.size):
            raise ValueError("Kích thước trong tệp số đo phải khớp với ảnh đang mở.")
        shapes = data.get("measurements")
        if not isinstance(shapes, dict):
            raise ValueError("Dữ liệu số đo thiếu bảng measurements.")

        rgba = image.convert("RGBA")
        measurements = {}
        for part, shape in shapes.items():
            if part not in PARTS:
                raise ValueError(f"Bộ phận không hợp lệ: {part}.")
            if shape is None:
                continue
            if not isinstance(shape, dict):
                raise ValueError(f"Số đo {PARTS[part][0].lower()} sai định dạng.")
            if "polygon" in shape:
                vertices = shape["polygon"]
                if not isinstance(vertices, list):
                    raise ValueError("Đa giác phải là danh sách các điểm.")
                polygon = [read_point(point, image.size) for point in vertices]
                if any(type(coord) is not int for point in polygon for coord in point):
                    raise ValueError("Tọa độ đa giác phải là số nguyên theo lưới pixel.")
                axis = shape.get("axis")
                if axis is not None:
                    if not isinstance(axis, list) or len(axis) != 2 or part in ("head", "neck", "torso"):
                        raise ValueError("Trục tay hoặc chân cần đúng hai điểm.")
                    axis = tuple(read_point(point, image.size) for point in axis)
                region = measure_region(rgba, part, polygon, axis)
                width, start, end = region.representative
                measurements[part] = {
                    "polygon": polygon, "axis": axis, "cuts": region.cuts,
                    "start": start, "end": end, "width_px": round(width, 2),
                }
            else:
                start = read_point(shape.get("start"), image.size)
                end = read_point(shape.get("end"), image.size)
                width = round(math.dist(start, end), 2)
                if not width:
                    raise ValueError("Hai đầu đoạn đo cần khác nhau.")
                measurements[part] = {"start": start, "end": end, "width_px": width}
        return build_region_report(image.size, measurements)

    @classmethod
    def _render_annotated_base64(cls, image: Image.Image, metrics: CharacterMetrics) -> str:
        """Vẽ lớp phủ giải phẫu và mã hóa sang Data URL Base64."""
        annotated_img = AnatomyVisualRenderer.render_overlay(image, metrics, scale=2)
        out_buffer = io.BytesIO()
        annotated_img.save(out_buffer, format="PNG")
        b64_str = base64.b64encode(out_buffer.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{b64_str}"
