# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Kiểu)
# ========================================================
# typing: Định nghĩa các kiểu dữ liệu
from typing import Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# PIL (Pillow): Vẽ đồ họa, hình chữ nhật, đường kẻ và chữ lên ảnh
from PIL import Image, ImageDraw, ImageFont

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# CharacterMetrics: Dữ liệu tọa độ giải phẫu học
from .character_metrics import CharacterMetrics
# BackgroundMaskExtractor: Làm sạch ảnh trước khi vẽ
from .masking import BackgroundMaskExtractor

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class AnatomyVisualRenderer:
    """
    Bộ vẽ đồ họa trực quan giải phẫu học (Visual Overlay Renderer).
    Chịu trách nhiệm duy nhất là hiển thị các hộp bao (Bounding Boxes) phân lớp lên ảnh sprite:
    - Vùng cơ thể sinh học: Viền nét liền (Solid lines) gồm Đầu (Cyan), Thân (Cam), Chân (Tím).
    - Ranh giới giải phẫu: Cổ (Vàng), Háng (Hồng), Chân tiếp đất (Xanh lá).
    - Vùng ngoại vi: Viền nét đứt (Dashed lines) gồm Vũ khí (Vàng), Áo choàng/Cánh (Hồng), Bóng sàn (Xám).
    """

    @classmethod
    def render_overlay(
        cls,
        image: Image.Image,
        metrics: CharacterMetrics,
        scale: int = 2
    ) -> Image.Image:
        """
        Vẽ các lớp phủ giải phẫu học lên sprite.

        @param {Image.Image} image Ảnh sprite gốc.
        @param {CharacterMetrics} metrics Dữ liệu giải phẫu học.
        @param {int} scale Hệ số phóng to để hiển thị rõ ràng trên web (mặc định 2x).
        @returns {Image.Image} Ảnh RGBA đã được vẽ các hộp bao trực quan.
        """
        _, clean_img = BackgroundMaskExtractor.extract_mask(image)
        base = clean_img.convert("RGBA")

        if scale > 1:
            base = base.resize((base.width * scale, base.height * scale), Image.Resampling.NEAREST)

        overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        font = ImageFont.load_default()

        s = scale
        hx0, hy0 = metrics.head_x_min * s, metrics.head_y_min * s
        hx1, hy1 = (metrics.head_x_max + 1) * s, (metrics.head_y_max + 1) * s

        bx0, by0 = metrics.body_x_min * s, metrics.body_y_min * s
        bx1, by1 = (metrics.body_x_max + 1) * s, (metrics.body_y_max + 1) * s

        neck_y = (metrics.neck_y + 1) * s
        line_w = max(1, 2 * s // 4)

        def draw_dashed_rect(x0, y0, x1, y1, color, dash_len=4, width=1):
            """Hàm phụ trợ vẽ hình chữ nhật viền đứt nét cho các vùng ngoại vi."""
            dash_step = max(2, dash_len * 2)
            # Cạnh ngang trên & dưới
            for x in range(int(x0), int(x1), dash_step):
                seg_end = min(x + dash_len, int(x1))
                draw.line([(x, y0), (seg_end, y0)], fill=color, width=width)
                draw.line([(x, y1), (seg_end, y1)], fill=color, width=width)
            # Cạnh dọc trái & phải
            for y in range(int(y0), int(y1), dash_step):
                seg_end = min(y + dash_len, int(y1))
                draw.line([(x0, y), (x0, seg_end)], fill=color, width=width)
                draw.line([(x1, y), (x1, seg_end)], fill=color, width=width)

        # 1. Vẽ hộp Đầu sinh học (Cyan nét liền)
        draw.rectangle([hx0, hy0, hx1, hy1], outline=(0, 230, 255, 230), width=line_w)
        draw.rectangle([hx0, hy0, hx1, hy1], fill=(0, 200, 255, 40))
        draw.text((hx0 + 3, hy0 + 2), f"HEAD: {metrics.head_width}x{metrics.head_height}", fill=(0, 240, 255, 255), font=font)

        # 2. Vẽ hộp Thân trên (Cam nét liền)
        if metrics.torso_box:
            ty0, tx0, ty1, tx1 = [c * s for c in metrics.torso_box]
            draw.rectangle([tx0, ty0, tx1, ty1], outline=(255, 140, 0, 210), width=line_w)
            draw.rectangle([tx0, ty0, tx1, ty1], fill=(255, 120, 0, 35))
            draw.text((tx0 + 3, ty0 + 2), "TORSO", fill=(255, 150, 0, 255), font=font)
        else:
            crotch_bound = (metrics.crotch_y + 1) * s if metrics.crotch_y else by1
            draw.rectangle([bx0, by0, bx1, crotch_bound], outline=(255, 140, 0, 210), width=line_w)
            draw.rectangle([bx0, by0, bx1, crotch_bound], fill=(255, 120, 0, 35))
            draw.text((bx0 + 3, by0 + 2), "TORSO", fill=(255, 150, 0, 255), font=font)

        # 3. Vẽ hộp Chân (Tím nét liền)
        if metrics.legs_box:
            ly0, lx0, ly1, lx1 = [c * s for c in metrics.legs_box]
            draw.rectangle([lx0, ly0, lx1, ly1], outline=(186, 85, 211, 220), width=line_w)
            draw.rectangle([lx0, ly0, lx1, ly1], fill=(186, 85, 211, 30))
            draw.text((lx0 + 3, ly0 + 2), "LEGS", fill=(210, 120, 240, 255), font=font)
        elif metrics.crotch_y is not None:
            cy_start = (metrics.crotch_y + 1) * s
            g_end = (metrics.ground_y + 1) * s if metrics.ground_y else by1
            if g_end > cy_start:
                draw.rectangle([bx0, cy_start, bx1, g_end], outline=(186, 85, 211, 200), width=line_w)
                draw.rectangle([bx0, cy_start, bx1, g_end], fill=(186, 85, 211, 25))
                draw.text((bx0 + 3, cy_start + 2), "LEGS", fill=(210, 120, 240, 255), font=font)

        # 4. Vẽ các vùng ngoại vi (Nét đứt Dashed)
        if metrics.weapon_box:
            wy0, wx0, wy1, wx1 = [c * s for c in metrics.weapon_box]
            draw_dashed_rect(wx0, wy0, wx1, wy1, color=(255, 215, 0, 230), dash_len=max(3, s * 2), width=line_w)
            draw.text((wx0 + 2, max(0, wy0 - 10)), "[WEAPON]", fill=(255, 215, 0, 255), font=font)

        if metrics.cape_wings_box:
            cy0, cx0, cy1, cx1 = [c * s for c in metrics.cape_wings_box]
            draw_dashed_rect(cx0, cy0, cx1, cy1, color=(255, 105, 180, 210), dash_len=max(3, s * 2), width=line_w)
            draw.text((cx0 + 2, max(0, cy0 - 10)), "[CAPE/WINGS]", fill=(255, 105, 180, 255), font=font)

        if metrics.shadow_box:
            sy0, sx0, sy1, sx1 = [c * s for c in metrics.shadow_box]
            draw_dashed_rect(sx0, sy0, sx1, sy1, color=(160, 160, 160, 200), dash_len=max(3, s * 2), width=line_w)
            draw.text((sx0 + 2, max(0, sy0 - 10)), "[SHADOW (LỌC BỎ)]", fill=(180, 180, 180, 255), font=font)

        # 5. Vẽ đường ranh giới Cổ (Vàng rực)
        draw.line([(0, neck_y), (base.width, neck_y)], fill=(255, 255, 0, 240), width=line_w)
        draw.text((4, max(0, neck_y - 12)), f"NECK: y={metrics.neck_y}", fill=(255, 255, 0, 255), font=font)

        # 6. Vẽ đường Hông/Háng (Hồng Magenta)
        if metrics.crotch_y is not None:
            crotch_y = (metrics.crotch_y + 1) * s
            draw.line([(0, crotch_y), (base.width, crotch_y)], fill=(255, 105, 180, 220), width=line_w)
            draw.text((4, max(0, crotch_y - 12)), f"CROTCH: y={metrics.crotch_y}", fill=(255, 120, 200, 255), font=font)

        # 7. Vẽ đường Mặt đất (Xanh lá Neon)
        ground_y = (metrics.ground_y + 1) * s if metrics.ground_y is not None else by1
        draw.line([(0, ground_y), (base.width, ground_y)], fill=(50, 255, 100, 230), width=max(1, line_w + 1))
        draw.text((4, max(0, ground_y - 12)), f"GROUND: y={metrics.ground_y if metrics.ground_y is not None else metrics.visible_y_max}", fill=(80, 255, 120, 255), font=font)

        return Image.alpha_composite(base, overlay)
