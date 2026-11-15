"""
Module: backend.core.heuristic_analyzer
Mục đích: Bộ phân tích giải phẫu hình học offline của Sprite (Heuristic Anatomy Analyzer).
Ai gọi nó: `CharacterAnalysisService` và bộ kiểm thử `tests.test_heuristic_analyzer`.
Tại sao tồn tại: Trích xuất chính xác chiều cao nhân vật bằng pixel và tỷ lệ đầu/thân thông qua phép chiếu mật độ điểm ảnh ngang (Horizontal Density Projection), giúp cố định kích thước nhân vật mà không phụ thuộc vào suy đoán cảm tính của AI.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Kiểu)
# ========================================================
# typing: Định nghĩa kiểu dữ liệu danh sách, bộ giá trị, tùy chọn
from typing import Optional, Tuple, List, Any

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
from backend.core.processing.masking import BackgroundMaskExtractor

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

    @staticmethod
    def _extract_bounding_coordinates(mask: np.ndarray) -> Tuple[int, int, int, int, int, int]:
        """
        Xác định tọa độ biên và kích thước bao ngoài của phần pixel nhìn thấy được.

        @param {np.ndarray} mask Ma trận boolean biểu diễn vùng pixel có nội dung.
        @returns {Tuple[int, int, int, int, int, int]} (y_min, y_max, x_min, x_max, vis_w, vis_h).
        """
        y_indices, x_indices = np.where(mask)
        y_min, y_max = int(y_indices.min()), int(y_indices.max())
        x_min, x_max = int(x_indices.min()), int(x_indices.max())
        vis_w = x_max - x_min + 1
        vis_h = y_max - y_min + 1
        return y_min, y_max, x_min, x_max, vis_w, vis_h

    @staticmethod
    def _compute_row_widths(mask: np.ndarray, y_min: int, y_max: int) -> List[int]:
        """
        Tính toán biểu đồ phân bố bề ngang (số lượng pixel hiển thị) theo từng dòng trục Y.

        @param {np.ndarray} mask Ma trận boolean của ảnh.
        @param {int} y_min Tọa độ Y nhỏ nhất.
        @param {int} y_max Tọa độ Y lớn nhất.
        @returns {List[int]} Danh sách bề rộng từng dòng quét.
        """
        widths = []
        for y in range(y_min, y_max + 1):
            row_xs = np.where(mask[y, :])[0]
            widths.append(len(row_xs) if len(row_xs) > 0 else 0)
        return widths

    @staticmethod
    def _detect_neck_position(widths: List[int], vis_h: int, y_min: int) -> Tuple[int, int]:
        """
        Tìm vị trí hõm cổ sinh học (điểm thắt hẹp tự nhiên phân tách giữa đầu và thân)
        bằng phép trượt cửa sổ làm mịn và tìm điểm cực tiểu.

        @param {List[int]} widths Biểu đồ bề rộng theo từng dòng Y.
        @param {int} vis_h Chiều cao hiển thị của nhân vật.
        @param {int} y_min Tọa độ đỉnh đầu.
        @returns {Tuple[int, int]} (Tọa độ neck_y tuyệt đối, Chỉ số neck_relative_idx tương đối).
        """
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
        return neck_y, neck_relative_idx

    @staticmethod
    def _calculate_head_box(
        mask: np.ndarray,
        y_min: int,
        neck_y: int,
        fallback_x_min: int,
        fallback_x_max: int
    ) -> Tuple[int, int, int, int]:
        """
        Xác định hộp bao và kích thước của vùng đầu (từ đỉnh đầu đến hõm cổ).

        @param {np.ndarray} mask Ma trận boolean của ảnh.
        @param {int} y_min Tọa độ đỉnh đầu.
        @param {int} neck_y Tọa độ hõm cổ.
        @param {int} fallback_x_min Tọa độ x_min dự phòng.
        @param {int} fallback_x_max Tọa độ x_max dự phòng.
        @returns {Tuple[int, int, int, int]} (head_x_min, head_x_max, head_w, head_h).
        """
        head_pixels_y, head_pixels_x = np.where(mask[y_min:neck_y + 1, :])
        if len(head_pixels_x) > 0:
            head_x_min = int(head_pixels_x.min())
            head_x_max = int(head_pixels_x.max())
        else:
            head_x_min = fallback_x_min
            head_x_max = fallback_x_max

        head_w = head_x_max - head_x_min + 1
        head_h = neck_y - y_min + 1
        return head_x_min, head_x_max, head_w, head_h

    @staticmethod
    def _calculate_body_box(
        mask: np.ndarray,
        neck_y: int,
        y_max: int,
        fallback_x_min: int,
        fallback_x_max: int
    ) -> Tuple[int, int, int, int]:
        """
        Xác định hộp bao và kích thước của vùng thân (từ dưới cổ đến điểm tiếp đất).

        @param {np.ndarray} mask Ma trận boolean của ảnh.
        @param {int} neck_y Tọa độ hõm cổ.
        @param {int} y_max Tọa độ đáy chân tiếp đất.
        @param {int} fallback_x_min Tọa độ x_min dự phòng.
        @param {int} fallback_x_max Tọa độ x_max dự phòng.
        @returns {Tuple[int, int, int, int]} (body_x_min, body_x_max, body_w, body_h).
        """
        body_pixels_y, body_pixels_x = np.where(mask[neck_y + 1:y_max + 1, :])
        if len(body_pixels_x) > 0:
            body_x_min = int(body_pixels_x.min())
            body_x_max = int(body_pixels_x.max())
        else:
            body_x_min = fallback_x_min
            body_x_max = fallback_x_max

        body_w = body_x_max - body_x_min + 1
        body_h = y_max - (neck_y + 1) + 1
        return body_x_min, body_x_max, body_w, body_h

    @staticmethod
    def _estimate_torso(
        body_w: int,
        body_h: int,
        widths: List[int],
        neck_relative_idx: int
    ) -> Tuple[int, int]:
        """
        Ước tính chiều cao và bề rộng phần thân trên (Torso - không tính phần chân).

        @param {int} body_w Chiều rộng toàn thân.
        @param {int} body_h Chiều cao toàn thân.
        @param {List[int]} widths Biểu đồ bề rộng theo trục Y.
        @param {int} neck_relative_idx Chỉ số vị trí cổ tương đối.
        @returns {Tuple[int, int]} (torso_h, torso_w).
        """
        torso_h = int(body_h * 0.45)
        torso_w = body_w
        if len(widths) > neck_relative_idx:
            crotch_rel = min(len(widths), neck_relative_idx + max(1, torso_h))
            if crotch_rel > neck_relative_idx:
                torso_w = int(max(widths[neck_relative_idx:crotch_rel]))
        return torso_h, torso_w

    @staticmethod
    def _classify_style(heads_tall: float) -> str:
        """
        Phân loại phong cách thiết kế Sprite dựa trên chiều cao tính theo số đầu.

        @param {float} heads_tall Tỷ lệ số đầu (heads tall).
        @returns {str} Chuỗi định danh phong cách thiết kế.
        """
        if heads_tall <= 2.6:
            return "Chibi Lùn (2.0 - 2.5 đầu)"
        elif heads_tall <= 4.0:
            return "Semi-Chibi / Retro RPG (3.0 - 4.0 đầu)"
        else:
            return "Dáng Thật / Heroic (5.0+ đầu)"

    @staticmethod
    def _build_summary_text(
        style_cat: str,
        vis_w: int,
        vis_h: int,
        canvas_w: int,
        canvas_h: int,
        head_w: int,
        head_h: int,
        head_ratio: float,
        heads_tall: float,
        body_w: int,
        body_h: int,
        head_to_body_w: float
    ) -> str:
        """
        Tạo văn bản tóm tắt các thông số giải phẫu học bằng tiếng Việt.
        """
        return (
            f"Phong cách: {style_cat}\n"
            f"Kích thước hiển thị: {vis_w}x{vis_h} px (Canvas: {canvas_w}x{canvas_h} px)\n"
            f"Độ to đầu: {head_w}x{head_h} px ({head_ratio*100:.1f}% chiều cao, tỷ lệ 1:{heads_tall:.1f} đầu)\n"
            f"Độ to thân: Rộng {body_w} px, Cao {body_h} px (Tỷ lệ ngang Đầu/Thân: {head_to_body_w:.2f})"
        )

    @classmethod
    def analyze(
        cls,
        image: Image.Image,
        auto_remove_solid_bg: bool = True
    ) -> Optional[CharacterMetrics]:
        """
        Thực hiện phân tích hình học bằng thuật toán giải tích ma trận pixel:
        Đóng vai trò hàm điều phối pipeline sạch sẽ qua các bước con độc lập.

        @param {Image.Image} image Ảnh sprite cần đo đạc.
        @param {bool} auto_remove_solid_bg Tự động khử nền đặc nếu có.
        @returns {Optional[CharacterMetrics]} Bộ thông số giải phẫu hoặc None nếu ảnh rỗng.
        """
        # 1. Bóc tách mặt nạ Alpha
        mask, clean_img = BackgroundMaskExtractor.extract_mask(image, auto_remove_solid_bg=auto_remove_solid_bg)
        if not np.any(mask):
            return None

        canvas_w, canvas_h = clean_img.size

        # 2. Xác định tọa độ bounding box phần hiển thị
        y_min, y_max, x_min, x_max, vis_w, vis_h = cls._extract_bounding_coordinates(mask)

        # 3. Tính biểu đồ phân bố bề ngang theo từng dòng Y
        widths = cls._compute_row_widths(mask, y_min, y_max)

        # 4. Tìm vị trí hõm cổ sinh học (phân tách đầu và thân)
        neck_y, neck_relative_idx = cls._detect_neck_position(widths, vis_h, y_min)

        # 5. Xác định kích thước và hộp bao vùng đầu
        head_x_min, head_x_max, head_w, head_h = cls._calculate_head_box(
            mask, y_min, neck_y, x_min, x_max
        )

        # 6. Xác định kích thước và hộp bao vùng thân
        body_x_min, body_x_max, body_w, body_h = cls._calculate_body_box(
            mask, neck_y, y_max, x_min, x_max
        )

        # 7. Ước tính kích thước phần thân trên (Torso)
        torso_h, torso_w = cls._estimate_torso(body_w, body_h, widths, neck_relative_idx)

        # 8. Tính toán các tỷ lệ cơ thể
        head_ratio = head_h / max(vis_h, 1)
        heads_tall = vis_h / max(head_h, 1)
        head_to_body_w = head_w / max(body_w, 1)
        body_aspect = body_w / max(body_h, 1)

        # 9. Đánh giá phong cách thiết kế và tạo mô tả tóm tắt
        style_cat = cls._classify_style(heads_tall)
        summary = cls._build_summary_text(
            style_cat=style_cat,
            vis_w=vis_w, vis_h=vis_h,
            canvas_w=canvas_w, canvas_h=canvas_h,
            head_w=head_w, head_h=head_h,
            head_ratio=head_ratio, heads_tall=heads_tall,
            body_w=body_w, body_h=body_h,
            head_to_body_w=head_to_body_w
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
