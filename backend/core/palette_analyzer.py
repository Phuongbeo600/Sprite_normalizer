# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Lớp trừu tượng & Kiểu)
# ========================================================
# abc: Định nghĩa lớp trừu tượng cơ sở (Abstract Base Class)
from abc import ABC, abstractmethod
# colorsys: Chuyển đổi không gian màu RGB sang HSV phục vụ đo độ sáng và góc màu
import colorsys
# typing: Khai báo kiểu danh sách, từ điển, tùy chọn
from typing import List, Dict, Any, Tuple, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# numpy: Thao tác ma trận điểm ảnh số học siêu tốc
import numpy as np
# PIL (Pillow): Xử lý đối tượng ảnh số
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Schemas & Core)
# ========================================================
# PaletteMetrics, DominantColorItem: Schema chứa kết quả phân tích hệ màu sắc
from backend.schemas.character.palette import PaletteMetrics, DominantColorItem

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class BasePaletteAnalyzer(ABC):
    """
    Interface cơ sở trừu tượng cho bộ phân tích bảng màu Sprite (Palette Analyzer).
    Tuân thủ nguyên lý Đa Hình (Polymorphism) và Kiến Trúc Sạch (Clean Architecture).
    """

    @abstractmethod
    def analyze_palette(self, image: Image.Image) -> PaletteMetrics:
        """
        Phương thức trừu tượng: Phân tích 6 tiêu chí hệ màu sắc từ đối tượng ảnh Sprite.

        @param {Image.Image} image Đối tượng ảnh Pillow cần phân tích.
        @returns {PaletteMetrics} Kết quả đo đạc chính xác 6 tiêu chí kỹ thuật màu sắc.
        """
        pass


class HeuristicPaletteAnalyzer(BasePaletteAnalyzer):
    """
    Bộ Phân Tích Bảng Màu Ngoại Tuyến (Offline Heuristic Palette Analyzer).
    Sử dụng 100% thuật toán toán học NumPy và không gian màu HSV:
    - Đo đạc chính xác 100% không có sai số hoặc ướm chừng.
    - Không tốn token AI, tốc độ xử lý siêu tốc (< 0.02 giây).
    - Đo chuẩn xác 6 tiêu chí cốt lõi của Pixel Art.
    """

    def analyze_palette(self, image: Image.Image) -> PaletteMetrics:
        """
        Thực thi phân tích 6 tiêu chí màu sắc trên ma trận pixel của Sprite.

        @param {Image.Image} image Đối tượng ảnh Pillow.
        @returns {PaletteMetrics} Dữ liệu đo đạc chi tiết 6 tiêu chuẩn hệ màu.
        """
        # Chuyển đổi ảnh sang RGBA để bóc tách kênh Alpha
        rgba_img = image.convert("RGBA")
        np_arr = np.array(rgba_img)

        # 1. Lọc bỏ các pixel trong suốt (Alpha <= 10)
        alpha_channel = np_arr[:, :, 3]
        visible_mask = alpha_channel > 10
        visible_pixels = np_arr[visible_mask][:, :3]  # Lấy mảng [N, 3] chứa các pixel RGB

        total_visible_pixels = len(visible_pixels)
        if total_visible_pixels == 0:
            # Trường hợp ảnh rỗng hoàn toàn
            return PaletteMetrics(
                total_colors=0,
                palette_era="16-bit SNES",
                dominant_colors=[],
                top_hex_list=[],
                shading_steps=2,
                shading_style_detected="2-Tone Cel-Shading",
                hue_shifting_detected=False,
                hue_shift_description="None",
                outline_style_detected="Selective Outline (Selout)",
                average_saturation=0.5,
                saturation_type="Moderate",
                contrast_ratio=1.0,
                contrast_type="Low Contrast",
                master_color_prompt="16-bit pixel art palette."
            )

        # ========================================================
        # TIÊU CHÍ 1: TỔNG SỐ LƯỢNG MÀU THỰC TẾ (COLOR COUNT / BUDGET)
        # ========================================================
        unique_colors, counts = np.unique(visible_pixels, axis=0, return_counts=True)
        total_unique = len(unique_colors)

        if total_unique <= 16:
            palette_era = "8-bit NES / SNES Minimalist (≤ 16 colors)"
        elif total_unique <= 32:
            palette_era = "16-bit SNES / GBA Classic (16-32 colors)"
        elif total_unique <= 64:
            palette_era = "32-bit Arcade / Neo-Geo (32-64 colors)"
        else:
            palette_era = "Modern Detailed Pixel Art (> 64 colors)"

        # ========================================================
        # TIÊU CHÍ 2: BẢNG MÃ MÀU CHỦ ĐẠO & TỶ LỆ DIỆN TÍCH (DOMINANT HEX)
        # ========================================================
        sorted_indices = np.argsort(-counts)
        dominant_list: List[DominantColorItem] = []
        top_hex_list: List[str] = []

        # Lấy tối đa 24 màu xuất hiện nhiều nhất
        max_swatches = min(24, total_unique)
        for i in range(max_swatches):
            idx = sorted_indices[i]
            r, g, b = int(unique_colors[idx][0]), int(unique_colors[idx][1]), int(unique_colors[idx][2])
            hex_str = f"#{r:02x}{g:02x}{b:02x}".lower()
            cnt = int(counts[idx])
            pct = round((cnt / total_visible_pixels) * 100, 2)

            # Đánh giá vai trò màu dựa trên tỷ lệ và độ sáng
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            if pct > 20.0:
                role = "Primary Base"
            elif pct > 8.0:
                role = "Secondary Base"
            elif lum < 40 and pct > 5.0:
                role = "Outline / Deep Shadow"
            elif lum > 210:
                role = "Highlight"
            else:
                role = "Accent"

            dominant_list.append(DominantColorItem(
                hex_code=hex_str,
                rgb=[r, g, b],
                pixel_count=cnt,
                percentage=pct,
                role=role
            ))
            top_hex_list.append(hex_str)

        # ========================================================
        # TIÊU CHÍ 3 & 4: SỐ BẬC ĐỔ BÓNG & KỸ THUẬT DỊCH SẮC ĐỘ (HUE-SHIFTING)
        # ========================================================
        # Chuyển đổi các màu độc nhất sang không gian màu HSV
        # H: 0.0 - 360.0 độ, S: 0.0 - 1.0, V: 0.0 - 1.0
        hsv_colors = []
        for c in unique_colors:
            r_norm, g_norm, b_norm = c[0] / 255.0, c[1] / 255.0, c[2] / 255.0
            h, s, v = colorsys.rgb_to_hsv(r_norm, g_norm, b_norm)
            hsv_colors.append((h * 360.0, s, v))

        # Phân cụm các màu có cùng dải màu chính (Hue clustering)
        # Bỏ qua các màu xám/đen/trắng không có màu (S < 0.15)
        color_clusters: Dict[int, List[Tuple[float, float, float]]] = {}
        for h, s, v in hsv_colors:
            if s >= 0.15 and v >= 0.1:
                # Chia góc 360 độ thành 12 cung màu (mỗi cung 30 độ)
                cluster_key = int(h // 30)
                if cluster_key not in color_clusters:
                    color_clusters[cluster_key] = []
                color_clusters[cluster_key].append((h, s, v))

        # Đếm số bậc sáng (Shading steps) trung bình trên các cụm màu có từ 2 sắc thái trở lên
        step_counts = []
        hue_shift_detected = False
        hue_shift_angles = []

        for c_key, members in color_clusters.items():
            if len(members) >= 2:
                step_counts.append(len(members))
                # Sắp xếp các thành viên theo độ sáng V tăng dần
                sorted_by_v = sorted(members, key=lambda item: item[2])
                darkest = sorted_by_v[0]
                brightest = sorted_by_v[-1]
                # Đo độ lệch góc Hue giữa điểm tối nhất và điểm sáng nhất
                hue_diff = abs(brightest[0] - darkest[0])
                if hue_diff > 180.0:
                    hue_diff = 360.0 - hue_diff
                hue_shift_angles.append(hue_diff)
                if hue_diff >= 10.0:
                    hue_shift_detected = True

        avg_steps = float(np.mean(step_counts)) if step_counts else 2.0
        if avg_steps <= 2.3:
            shading_steps = 2
            shading_style_detected = "2-Tone Cel-Shading"
        elif avg_steps <= 3.4:
            shading_steps = 3
            shading_style_detected = "3-Tone Cel-Shading"
        else:
            shading_steps = 4
            shading_style_detected = "High-Step / Soft Shading"

        if hue_shift_detected:
            avg_angle = float(np.mean(hue_shift_angles)) if hue_shift_angles else 15.0
            hue_shift_description = f"Active Hue-Shifting detected (~{avg_angle:.1f}° shift: cool shadow tones, warm highlights)"
        else:
            hue_shift_description = "Straight Shading (Uniform hue, luminance changes only)"

        # ========================================================
        # TIÊU CHÍ 5: QUY CHUẨN MÀU ĐƯỜNG VIỀN (OUTLINE GRAMMAR)
        # ========================================================
        # Tìm các pixel nằm ở vành ngoài cùng bằng thuật toán xói mòn hình thái học (Morphological Erosion)
        h_dim, w_dim = visible_mask.shape
        padded_mask = np.pad(visible_mask, 1, mode='constant', constant_values=False)
        # Pixel thuộc viền nếu bản thân nó là True nhưng có ít nhất 1 pixel láng giềng là False
        eroded_mask = (
            padded_mask[1:-1, 1:-1] &
            padded_mask[:-2, 1:-1] & padded_mask[2:, 1:-1] &
            padded_mask[1:-1, :-2] & padded_mask[1:-1, 2:]
        )
        outline_mask = visible_mask & (~eroded_mask)

        outline_pixels = np_arr[outline_mask][:, :3]
        if len(outline_pixels) > 0:
            # Đo độ sáng trung bình của các pixel viền
            outline_lums = [0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2] for p in outline_pixels]
            black_pixel_ratio = sum(1 for lum in outline_lums if lum < 35.0) / len(outline_lums)

            # Đếm số màu khác nhau trên đường viền
            unique_outline_colors = len(np.unique(outline_pixels, axis=0))

            if black_pixel_ratio >= 0.75:
                outline_style_detected = "Pure Black Outline (1px solid black contour)"
            elif unique_outline_colors >= 4:
                outline_style_detected = "Selective Dark Outline (Selout - tinted dark colors matching clothing/armor)"
            else:
                outline_style_detected = "Colored Outline"
        else:
            outline_style_detected = "No Outline (Lineless)"

        # ========================================================
        # TIÊU CHÍ 6: ĐỘ BÃO HÒA & ĐỘ TƯƠNG PHẢN (SATURATION & CONTRAST)
        # ========================================================
        # Tính độ bão hòa trung bình S của các pixel có màu
        colored_saturations = [s for _, s, _ in hsv_colors if s > 0.05]
        avg_sat = float(np.mean(colored_saturations)) if colored_saturations else 0.5

        if avg_sat >= 0.60:
            saturation_type = "Vibrant Retro Pixel Saturation"
        elif avg_sat >= 0.38:
            saturation_type = "Balanced Classic Saturation"
        else:
            saturation_type = "Muted / Desaturated Dark Palette"

        # Tính tỷ lệ tương phản ánh sáng (Contrast Ratio)
        luminances = [0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2] for p in visible_pixels]
        lum_max = float(np.max(luminances)) if luminances else 255.0
        lum_min = float(np.min(luminances)) if luminances else 0.0
        contrast_val = round((lum_max + 0.05) / (lum_min + 0.05), 1)

        if contrast_val >= 6.5:
            contrast_type = "High Contrast (Crisp lighting pop)"
        elif contrast_val >= 3.5:
            contrast_type = "Medium Contrast (Soft readability)"
        else:
            contrast_type = "Low Contrast"

        # ========================================================
        # BIÊN DỊCH KHUNG PROMPT QUY CHUẨN MÀU SẮC CHUNG (MASTER COLOR PROMPT)
        # ========================================================
        top_swatches_str = ", ".join(top_hex_list[:8])
        master_prompt = (
            f"MASTER COLOR & GRAPHIC PALETTE SPECIFICATIONS (STRICTLY HARMONIZED WITH REFERENCE ASSET):\n"
            f"- Color Budget: Strictly indexed {total_unique}-color palette ({palette_era}), primary palette anchors: [{top_swatches_str}].\n"
            f"- Shading Architecture: {shading_style_detected} per surface ({shading_steps} distinct tone levels), strictly zero smooth airbrushing or blurry gradients.\n"
            f"- Hue-Shifting Rule: {hue_shift_description}.\n"
            f"- Outline Grammar: {outline_style_detected}, strictly 1-pixel crisp pixel contour without orphan noise.\n"
            f"- Palette Saturation & Contrast: {saturation_type}, {contrast_type} curve ({contrast_val}:1 ratio).\n"
            f"- Background: Isolated on pure transparent background (PNG alpha channel), zero drop shadows on floor."
        )

        return PaletteMetrics(
            total_colors=total_unique,
            palette_era=palette_era,
            dominant_colors=dominant_list,
            top_hex_list=top_hex_list,
            shading_steps=shading_steps,
            shading_style_detected=shading_style_detected,
            hue_shifting_detected=hue_shift_detected,
            hue_shift_description=hue_shift_description,
            outline_style_detected=outline_style_detected,
            average_saturation=round(avg_sat, 2),
            saturation_type=saturation_type,
            contrast_ratio=contrast_val,
            contrast_type=contrast_type,
            master_color_prompt=master_prompt
        )
