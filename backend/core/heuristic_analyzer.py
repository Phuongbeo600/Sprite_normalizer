"""
Module: backend.core.heuristic_analyzer
Mục đích: Bộ phân tích giải phẫu hình học offline của Sprite (Heuristic Anatomy Analyzer).
Ai gọi nó: `CharacterAnalysisService` và bộ kiểm thử `tests.test_heuristic_analyzer`.
Tại sao tồn tại: Trích xuất chính xác chiều cao nhân vật bằng pixel và tỷ lệ đầu/thân thông qua phép chiếu mật độ điểm ảnh ngang (Horizontal Density Projection), giúp cố định kích thước nhân vật mà không phụ thuộc vào suy đoán cảm tính của AI.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Kiểu)
# ========================================================
# typing: Định nghĩa kiểu dữ liệu tùy chọn
from typing import Optional, Tuple, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# numpy: Xử lý mảng ma trận pixel và đại số tuyến tính
import numpy as np
# PIL (Pillow): Mở ảnh và kiểm tra kích thước
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# CharacterMetrics: Cấu trúc dữ liệu kết quả phân tích
from .character_metrics import CharacterMetrics
# BackgroundMaskExtractor: Bóc tách kênh Alpha
from .masking import BackgroundMaskExtractor

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class HeuristicAnalyzer:
    """
    Bộ phân tích giải phẫu học toán học thuần túy (Offline Heuristic Analyzer).
    Sử dụng biểu đồ mật độ ngang (Horizontal Projection Profile) để tìm hõm cổ,
    tính toán tỷ lệ đầu/thân và nhận diện phong cách thiết kế Sprite 100% ngoại tuyến (0 Token).
    """

    @classmethod
    def analyze(
        cls,
        image: Image.Image,
        auto_remove_solid_bg: bool = True
    ) -> Optional[CharacterMetrics]:
        """
        Thực hiện phân tích hình học bằng thuật toán giải tích ma trận pixel.

        @param {Image.Image} image Ảnh sprite cần đo đạc.
        @param {bool} auto_remove_solid_bg Tự động khử nền đặc nếu có.
        @returns {Optional[CharacterMetrics]} Bộ thông số giải phẫu hoặc None nếu ảnh rỗng.
        """
        mask, clean_img = BackgroundMaskExtractor.extract_mask(image, auto_remove_solid_bg=auto_remove_solid_bg)
        if not np.any(mask):
            return None

        canvas_w, canvas_h = clean_img.size
        y_indices, x_indices = np.where(mask)
        y_min, y_max = int(y_indices.min()), int(y_indices.max())
        x_min, x_max = int(x_indices.min()), int(x_indices.max())

        vis_w = x_max - x_min + 1
        vis_h = y_max - y_min + 1

        # Tính biểu đồ phân bố bề ngang theo từng dòng Y
        widths = []
        for y in range(y_min, y_max + 1):
            row_xs = np.where(mask[y, :])[0]
            widths.append(len(row_xs) if len(row_xs) > 0 else 0)

        # 1. Tìm vị trí cổ sinh học (Hõm thắt hẹp đầu/thân)
        neck_search_start = max(1, int(vis_h * 0.15))
        neck_search_end = min(len(widths) - 1, int(vis_h * 0.60))

        if neck_search_end > neck_search_start:
            search_widths = widths[neck_search_start:neck_search_end]
            smoothed = []
            for i in range(len(search_widths)):
                window = search_widths[max(0, i - 1):min(len(search_widths), i + 2)]
                smoothed.append(sum(window) / len(window))
            neck_relative_idx = neck_search_start + int(np.argmin(smoothed))
        else:
            neck_relative_idx = int(vis_h * 0.30)

        neck_y = y_min + neck_relative_idx

        # 2. Xác định hộp bao của vùng Đầu (Head Box)
        head_pixels_y, head_pixels_x = np.where(mask[y_min:neck_y + 1, :])
        if len(head_pixels_x) > 0:
            head_x_min = int(head_pixels_x.min())
            head_x_max = int(head_pixels_x.max())
        else:
            head_x_min = x_min
            head_x_max = x_max

        head_w = head_x_max - head_x_min + 1
        head_h = neck_y - y_min + 1

        # 3. Xác định hộp bao của vùng Thân (Body Box)
        body_pixels_y, body_pixels_x = np.where(mask[neck_y + 1:y_max + 1, :])
        if len(body_pixels_x) > 0:
            body_x_min = int(body_pixels_x.min())
            body_x_max = int(body_pixels_x.max())
        else:
            body_x_min = x_min
            body_x_max = x_max

        body_w = body_x_max - body_x_min + 1
        body_h = y_max - (neck_y + 1) + 1

        # 4. Ước tính phần thân trên (Torso)
        torso_h = int(body_h * 0.45)
        torso_w = body_w
        if len(widths) > neck_relative_idx:
            crotch_rel = min(len(widths), neck_relative_idx + max(1, torso_h))
            if crotch_rel > neck_relative_idx:
                torso_w = int(max(widths[neck_relative_idx:crotch_rel]))

        # 5. Tính toán các tỷ lệ cơ thể
        head_ratio = head_h / max(vis_h, 1)
        heads_tall = vis_h / max(head_h, 1)
        head_to_body_w = head_w / max(body_w, 1)
        body_aspect = body_w / max(body_h, 1)

        # 6. Đánh giá phong cách thiết kế
        if heads_tall <= 2.6:
            style_cat = "Chibi Lùn (2.0 - 2.5 đầu)"
        elif heads_tall <= 4.0:
            style_cat = "Semi-Chibi / Retro RPG (3.0 - 4.0 đầu)"
        else:
            style_cat = "Dáng Thật / Heroic (5.0+ đầu)"

        summary = (
            f"Phong cách: {style_cat}\n"
            f"Kích thước hiển thị: {vis_w}x{vis_h} px (Canvas: {canvas_w}x{canvas_h} px)\n"
            f"Độ to đầu: {head_w}x{head_h} px ({head_ratio*100:.1f}% chiều cao, tỷ lệ 1:{heads_tall:.1f} đầu)\n"
            f"Độ to thân: Rộng {body_w} px, Cao {body_h} px (Tỷ lệ ngang Đầu/Thân: {head_to_body_w:.2f})"
        )

        return CharacterMetrics(
            canvas_width=canvas_w,
            canvas_height=canvas_h,
            visible_x_min=x_min,
            visible_y_min=y_min,
            visible_x_max=x_max,
            visible_y_max=y_max,
            visible_width=vis_w,
            visible_height=vis_h,
            neck_y=neck_y,
            head_x_min=head_x_min,
            head_y_min=y_min,
            head_x_max=head_x_max,
            head_y_max=neck_y,
            head_width=head_w,
            head_height=head_h,
            body_x_min=body_x_min,
            body_y_min=neck_y + 1,
            body_x_max=body_x_max,
            body_y_max=y_max,
            body_width=body_w,
            body_height=body_h,
            torso_height=torso_h,
            torso_width=torso_w,
            head_ratio=round(head_ratio, 3),
            heads_tall=round(heads_tall, 2),
            head_to_body_width_ratio=round(head_to_body_w, 2),
            body_aspect_ratio=round(body_aspect, 2),
            style_category=style_cat,
            summary_text=summary,
            crotch_y=neck_y + torso_h if torso_h < body_h else None,
            ground_y=y_max,
            anatomical_height=vis_h,
            detection_source="Heuristic (Toán học)"
        )
