# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Bộ đệm dữ liệu)
# ========================================================
# io: Xử lý bộ đệm nhị phân cho ảnh render
import io
# base64: Mã hóa ảnh kết quả sang chuỗi base64 gửi về Frontend
import base64
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
from backend.core.metrics.character_metrics import CharacterMetrics
# BackgroundMaskExtractor: Bóc tách kênh Alpha Mask
from backend.core.processing.masking import BackgroundMaskExtractor
# HeuristicAnalyzer: Phân tích giải phẫu học toán học ngoại tuyến
from backend.core.metrics.heuristic_analyzer import HeuristicAnalyzer
# compute_manual_anatomy_report: Tính 11 số đo giải phẫu theo tọa độ điểm đo thủ công
from backend.core.metrics.manual_anatomy_measurement import compute_manual_anatomy_report
# measure_region: Đo lát cắt trên vùng do bộ phân tích giải phẫu xác định.
from backend.core.metrics.region_measure import measure_region
# build_region_report: Định dạng báo cáo lát cắt vùng đo tự động.
from backend.core.metrics.sprite_prompt import build_region_report
# AnatomyVisualRenderer: Vẽ các lớp phủ trực quan Head/Torso/Legs/Weapons
from backend.core.processing.visual_renderer import AnatomyVisualRenderer

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
        """Tính 11 số đo giải phẫu bằng Python thuần từ tọa độ điểm đo trên ảnh gốc."""
        if not isinstance(data, dict) or data.get("image_size_px") != list(image.size):
            raise ValueError("Kích thước trong tệp số đo phải khớp với ảnh đang mở.")
        return compute_manual_anatomy_report(image.size, data.get("measurements"))

    @classmethod
    def _render_annotated_base64(cls, image: Image.Image, metrics: CharacterMetrics) -> str:
        """Vẽ lớp phủ giải phẫu và mã hóa sang Data URL Base64."""
        annotated_img = AnatomyVisualRenderer.render_overlay(image, metrics, scale=2)
        out_buffer = io.BytesIO()
        annotated_img.save(out_buffer, format="PNG")
        b64_str = base64.b64encode(out_buffer.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{b64_str}"
