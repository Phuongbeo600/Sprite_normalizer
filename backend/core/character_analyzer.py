# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Cấu trúc dữ liệu)
# ========================================================
# os: Quản lý đường dẫn tập tin và kiểm tra sự tồn tại của file ảnh
import os
# dataclass, asdict: Định nghĩa cấu trúc dữ liệu lưu thông số giải phẫu nhân vật
from dataclasses import dataclass, asdict
# typing: Khai báo kiểu dữ liệu cho gợi ý mã nguồn và kiểm tra tĩnh
from typing import Optional, Tuple, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# numpy: Thư viện tính toán đại số mảng đa chiều siêu tốc, dùng quét ma trận pixel
import numpy as np
# PIL (Pillow): Thư viện xử lý hình ảnh, cắt ghép, vẽ chú thích lên sprite
from PIL import Image, ImageDraw, ImageFont

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# AiVisionAnalyzer sẽ được import động khi người dùng yêu cầu phân tích bằng AI Gemini


@dataclass
class CharacterMetrics:
    """
    Cấu trúc dữ liệu lưu trữ toàn bộ chỉ số hình học và giải phẫu học của Sprite:
    - Kích thước canvas gốc và hộp bao (bounding box) thực tế của nhân vật.
    - Điểm ranh giới cổ (ranh giới đầu và thân), điểm hông/háng và mặt đất tiếp xúc.
    - Các tỷ lệ vàng: Tỷ lệ đầu/thân, số đầu (heads tall), phong cách (Chibi hay Heroic).
    """
    canvas_width: int
    canvas_height: int

    # Bounding box toàn bộ nhân vật (phần pixel nhìn thấy được)
    visible_x_min: int
    visible_y_min: int
    visible_x_max: int
    visible_y_max: int
    visible_width: int
    visible_height: int

    # Vị trí cổ (ranh giới phân tách giữa đầu và thân)
    neck_y: int

    # Phần Đầu (Head)
    head_x_min: int
    head_y_min: int
    head_x_max: int
    head_y_max: int
    head_width: int
    head_height: int

    # Phần Thân (Body = từ cổ đến chân)
    body_x_min: int
    body_y_min: int
    body_x_max: int
    body_y_max: int
    body_width: int
    body_height: int

    # Phần Ngực / Bụng (Torso - không tính phần chân)
    torso_height: int
    torso_width: int

    # Các tỷ lệ vàng quan trọng
    head_ratio: float               # head_height / visible_height (ví dụ 0.25 = 25%)
    heads_tall: float               # Chiều cao tính bằng số đầu (ví dụ 2.5 đầu, 5.0 đầu)
    head_to_body_width_ratio: float # head_width / body_width
    body_aspect_ratio: float        # body_width / body_height

    # Nhận diện phong cách
    style_category: str             # "Chibi Lùn (2.0 - 2.5 đầu)", "Semi-Chibi (3.0 - 4.0 đầu)", "Dáng Thật (5.0+ đầu)"
    summary_text: str               # Tóm tắt nhanh bằng tiếng Việt

    # Phân đoạn chi tiết bổ sung AI
    crotch_y: Optional[int] = None
    ground_y: Optional[int] = None
    detection_source: str = "Heuristic (Toán học)"
    ai_feedback: Optional[str] = None


class CharacterAnalyzer:
    """
    Bộ phân tích giải phẫu học và hình học của Sprite Pixel Art.
    - Tách nền tự động bằng kênh Alpha hoặc thuật toán khoảng cách màu 4 góc.
    - Dùng biểu đồ Horizontal Projection Profile để tìm vị trí cổ tự động (Heuristic).
    - Hỗ trợ kết hợp AI Vision (Google Gemini) để phát hiện giải phẫu chính xác khi có vũ khí/áo choàng.
    - Vẽ trực quan các vùng đầu, thân, cổ, mặt đất lên ảnh.
    """

    @staticmethod
    def extract_mask(image: Image.Image, auto_remove_solid_bg: bool = True, bg_tolerance: int = 25) -> Tuple[np.ndarray, Image.Image]:
        """
        Trích xuất mặt nạ boolean (True: pixel nhân vật, False: pixel nền).
        Nếu ảnh không có kênh alpha (thường gặp khi tạo bằng AI Midjourney/DALL-E có nền trắng/đen/xanh),
        thuật toán sẽ tự động nhận diện màu nền từ 4 góc và khử nền.

        @param {Image.Image} image Ảnh sprite gốc.
        @param {bool} auto_remove_solid_bg Tự động xóa nền màu đơn sắc.
        @param {int} bg_tolerance Ngưỡng sai số màu khi khử nền.
        @returns {Tuple[np.ndarray, Image.Image]} Mask nhị phân và ảnh đã xử lý alpha.
        """
        img_rgba = image.convert('RGBA')
        arr = np.array(img_rgba)
        alpha = arr[:, :, 3]

        # Kiểm tra xem ảnh có sẵn alpha trong suốt thực sự hay không
        has_transparency = np.any(alpha < 240)

        if has_transparency:
            mask = alpha > 25
            return mask, img_rgba

        # Nếu không có alpha (ảnh nền đặc do AI sinh ra)
        if auto_remove_solid_bg:
            rgb = arr[:, :, :3].astype(float)
            h, w = arr.shape[:2]
            corners = [
                rgb[0, 0],
                rgb[0, w - 1],
                rgb[h - 1, 0],
                rgb[h - 1, w - 1]
            ]
            # Tính màu nền trung bình từ 4 góc ảnh
            bg_color = np.mean(corners, axis=0)

            # Tính khoảng cách Euclidean màu
            color_diff = np.linalg.norm(rgb - bg_color, axis=2)
            mask = color_diff > bg_tolerance

            # Cập nhật lại kênh alpha cho ảnh
            new_alpha = np.where(mask, 255, 0).astype(np.uint8)
            arr[:, :, 3] = new_alpha
            processed_img = Image.fromarray(arr, 'RGBA')
            return mask, processed_img

        return (alpha > 0), img_rgba

    @classmethod
    def analyze(cls, image_or_path: Any, auto_remove_solid_bg: bool = True) -> Optional[CharacterMetrics]:
        """
        Phân tích giải phẫu học hoàn toàn cục bộ bằng thuật toán toán học (Heuristic / Offline).
        Sử dụng biểu đồ mật độ ngang (Horizontal Projection Profile) để tìm hõm cổ và tính tỷ lệ số đầu.

        @param {Any} image_or_path Đường dẫn ảnh hoặc đối tượng PIL Image.
        @param {bool} auto_remove_solid_bg Tự động xóa nền đặc.
        @returns {Optional[CharacterMetrics]} Bộ thông số giải phẫu nhân vật hoặc None nếu ảnh rỗng.
        """
        if isinstance(image_or_path, str):
            if not os.path.exists(image_or_path):
                return None
            image = Image.open(image_or_path)
        else:
            image = image_or_path

        mask, _ = cls.extract_mask(image, auto_remove_solid_bg=auto_remove_solid_bg)

        if not np.any(mask):
            return None

        canvas_w, canvas_h = image.size
        y_indices, x_indices = np.where(mask)
        y_min, y_max = int(y_indices.min()), int(y_indices.max())
        x_min, x_max = int(x_indices.min()), int(x_indices.max())

        vis_h = y_max - y_min + 1
        vis_w = x_max - x_min + 1

        # Tạo biểu đồ chiều rộng theo từng hàng Y (Horizontal Projection Profile)
        widths = []
        left_xs = []
        right_xs = []
        counts = []

        for y in range(y_min, y_max + 1):
            xs = np.where(mask[y, :])[0]
            if len(xs) > 0:
                widths.append(int(xs.max() - xs.min() + 1))
                left_xs.append(int(xs.min()))
                right_xs.append(int(xs.max()))
                counts.append(int(len(xs)))
            else:
                widths.append(0)
                left_xs.append(x_min)
                right_xs.append(x_min)
                counts.append(0)

        widths_arr = np.array(widths, dtype=float)
        # Làm mượt biểu đồ bằng kernel trung bình có trọng số 3 hàng
        kernel = np.array([0.2, 0.6, 0.2])
        smoothed_widths = np.convolve(widths_arr, kernel, mode='same')

        # Vùng tìm kiếm cổ: Thường nằm từ 16% đến 55% chiều cao nhân vật
        neck_search_start = max(1, int(vis_h * 0.16))
        neck_search_end = min(vis_h - 2, int(vis_h * 0.55))

        if neck_search_end > neck_search_start:
            window = smoothed_widths[neck_search_start:neck_search_end]
            # Điểm thắt hẹp nhất cục bộ đại diện cho cổ
            neck_relative_idx = neck_search_start + int(np.argmin(window))
        else:
            neck_relative_idx = max(1, int(vis_h * 0.30))

        neck_y = y_min + neck_relative_idx

        # 1. Tính toán phần Đầu (Head)
        head_h = neck_relative_idx
        head_w = int(max(widths[:neck_relative_idx])) if neck_relative_idx > 0 else 0
        head_x_min = int(min(left_xs[:neck_relative_idx])) if neck_relative_idx > 0 else x_min
        head_x_max = int(max(right_xs[:neck_relative_idx])) if neck_relative_idx > 0 else x_max

        # 2. Tính toán phần Thân (Body = Cổ đến chân)
        body_h = vis_h - head_h
        body_w = int(max(widths[neck_relative_idx:])) if neck_relative_idx < vis_h else 0
        body_x_min = int(min(left_xs[neck_relative_idx:])) if neck_relative_idx < vis_h else x_min
        body_x_max = int(max(right_xs[neck_relative_idx:])) if neck_relative_idx < vis_h else x_max

        # 3. Phân tách phần Ngực/Bụng (Torso) và Chân (Legs)
        crotch_start = int(vis_h * 0.48)
        crotch_end = int(vis_h * 0.78)
        torso_h = body_h
        torso_w = body_w
        if crotch_end > crotch_start:
            sub_counts = np.array(counts[crotch_start:crotch_end], dtype=float)
            crotch_rel = crotch_start + int(np.argmin(sub_counts))
            if crotch_rel > neck_relative_idx:
                torso_h = crotch_rel - neck_relative_idx
                torso_w = int(max(widths[neck_relative_idx:crotch_rel]))

        # Tính toán các tỷ lệ cơ thể
        head_ratio = head_h / max(vis_h, 1)
        heads_tall = vis_h / max(head_h, 1)
        head_to_body_w = head_w / max(body_w, 1)
        body_aspect = body_w / max(body_h, 1)

        # Đánh giá phong cách thiết kế nhân vật
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
            detection_source="Heuristic (Toán học)"
        )

    @classmethod
    def analyze_with_ai(
        cls,
        image_or_path: Any,
        api_key: Optional[str] = None,
        auto_remove_solid_bg: bool = True
    ) -> Tuple[Optional[CharacterMetrics], str]:
        """
        Phân tích giải phẫu học kết hợp AI Vision (Google Gemini) và thuật toán Snap Pixel:
        - Nhận diện đúng hộp sọ (loại bỏ kiếm giơ cao, sừng, tai thỏ), cổ, háng và chân tiếp đất.
        - Tự động hút (snap) tọa độ vào ma trận Alpha Mask để đạt độ chính xác đến từng pixel.
        - Tự động fallback sang thuật toán Heuristic nếu không có API key hoặc gặp lỗi mạng.

        @param {Any} image_or_path Đường dẫn ảnh hoặc đối tượng PIL Image.
        @param {Optional[str]} api_key Khóa API Google Gemini.
        @param {bool} auto_remove_solid_bg Tự động xóa nền đặc.
        @returns {Tuple[Optional[CharacterMetrics], str]} Bộ thông số và thông điệp trạng thái.
        """
        if isinstance(image_or_path, str):
            if not os.path.exists(image_or_path):
                return None, "File ảnh không tồn tại."
            image = Image.open(image_or_path)
        else:
            image = image_or_path

        mask, clean_img = cls.extract_mask(image, auto_remove_solid_bg=auto_remove_solid_bg)
        if not np.any(mask):
            return None, "Không tìm thấy pixel nhân vật (ảnh trống hoặc trong suốt hoàn toàn)."

        # Nếu có API Key thì ưu tiên dùng AI Gemini Vision
        if api_key and api_key.strip():
            try:
                from .ai_vision_analyzer import AiVisionAnalyzer
                ai_data = AiVisionAnalyzer.call_gemini_vision(clean_img, api_key.strip())
                snapped = AiVisionAnalyzer.snap_and_denormalize(ai_data, clean_img.size, mask)

                canvas_w, canvas_h = clean_img.size
                y_indices, x_indices = np.where(mask)
                y_min, y_max = int(y_indices.min()), int(y_indices.max())
                x_min, x_max = int(x_indices.min()), int(x_indices.max())
                vis_w = x_max - x_min + 1
                vis_h = y_max - y_min + 1

                neck_y = snapped["neck_y"]
                crotch_y = snapped["crotch_y"]
                ground_y = snapped["ground_y"]

                head_x_min = snapped["head_x_min"]
                head_x_max = snapped["head_x_max"]
                head_y_min = snapped["head_y_min"]
                head_y_max = neck_y
                head_w = max(1, head_x_max - head_x_min + 1)
                head_h = max(1, head_y_max - head_y_min + 1)

                body_x_min = x_min
                body_x_max = x_max
                body_y_min = neck_y + 1
                body_y_max = ground_y
                body_w = vis_w
                body_h = max(1, body_y_max - body_y_min + 1)

                torso_h = max(1, crotch_y - neck_y) if crotch_y > neck_y else body_h
                torso_w = body_w

                head_ratio = head_h / max(vis_h, 1)
                heads_tall = vis_h / max(head_h, 1)
                head_to_body_w = head_w / max(body_w, 1)
                body_aspect = body_w / max(body_h, 1)

                if heads_tall <= 2.6:
                    style_cat = "Chibi Lùn (2.0 - 2.5 đầu)"
                elif heads_tall <= 4.0:
                    style_cat = "Semi-Chibi / Retro RPG (3.0 - 4.0 đầu)"
                else:
                    style_cat = "Dáng Thật / Heroic (5.0+ đầu)"

                archetype = snapped.get("character_archetype", "Character Sprite")
                notes = snapped.get("anatomy_notes", "")
                model_used = ai_data.get("model_used", "Gemini Flash")

                summary = (
                    f"✨ [NGUỒN PHÂN TÍCH: AI GEMINI VISION ({model_used})]\n"
                    f"Archetype: {archetype} | Phong cách: {style_cat}\n"
                    f"Kích thước hiển thị: {vis_w}x{vis_h} px (Canvas: {canvas_w}x{canvas_h} px)\n"
                    f"Đầu (Đã lọc vũ khí & khoảng trống): {head_w}x{head_h} px ({head_ratio*100:.1f}%, 1:{heads_tall:.1f} đầu)\n"
                    f"Ranh giới Cổ: y={neck_y} px  |  Háng: y={crotch_y} px  |  Đất: y={ground_y} px\n"
                    f"Nhận định AI: {notes}"
                )

                metrics = CharacterMetrics(
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
                    head_y_min=head_y_min,
                    head_x_max=head_x_max,
                    head_y_max=head_y_max,
                    head_width=head_w,
                    head_height=head_h,
                    body_x_min=body_x_min,
                    body_y_min=body_y_min,
                    body_x_max=body_x_max,
                    body_y_max=body_y_max,
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
                    crotch_y=crotch_y,
                    ground_y=ground_y,
                    detection_source=f"Gemini Vision ({model_used})",
                    ai_feedback=notes
                )
                return metrics, "Phân tích AI Vision thành công!"
            except Exception as e:
                # Tự động Fallback sang Heuristic khi AI lỗi mạng hoặc quá quota
                heuristic_metrics = cls.analyze(clean_img, auto_remove_solid_bg=False)
                if heuristic_metrics:
                    heuristic_metrics.detection_source = f"Heuristic (Fallback do AI: {str(e)[:40]})"
                    heuristic_metrics.summary_text = (
                        f"⚠️ [CHẾ ĐỘ FALLBACK - LỖI MẠNG AI]\n" + heuristic_metrics.summary_text
                    )
                return heuristic_metrics, f"AI gặp lỗi ({str(e)[:40]}), đã tự động chuyển sang Heuristic."

        # Không có API Key -> Phân tích bằng Heuristic Toán học ngoại tuyến
        heuristic_metrics = cls.analyze(clean_img, auto_remove_solid_bg=False)
        return heuristic_metrics, "Phân tích bằng Heuristic Toán học Cục bộ (Offline)"

    @classmethod
    def draw_annotated_image(cls, image: Image.Image, metrics: CharacterMetrics, scale: int = 1) -> Image.Image:
        """
        Vẽ overlay trực quan đánh dấu vùng Đầu (Cyan), Thân (Cam), Cổ (Vàng), Háng (Hồng) và Mặt đất (Xanh lá).

        @param {Image.Image} image Ảnh sprite gốc.
        @param {CharacterMetrics} metrics Dữ liệu giải phẫu học cần vẽ.
        @param {int} scale Hệ số phóng to để xem rõ pixel art.
        @returns {Image.Image} Ảnh đã được vẽ các hộp bao giải phẫu.
        """
        _, clean_img = cls.extract_mask(image)
        base = clean_img.convert('RGBA')

        if scale > 1:
            base = base.resize((base.width * scale, base.height * scale), Image.Resampling.NEAREST)

        overlay = Image.new('RGBA', base.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)
        font = ImageFont.load_default()

        s = scale
        hx0, hy0 = metrics.head_x_min * s, metrics.head_y_min * s
        hx1, hy1 = (metrics.head_x_max + 1) * s, (metrics.head_y_max + 1) * s

        bx0, by0 = metrics.body_x_min * s, metrics.body_y_min * s
        bx1, by1 = (metrics.body_x_max + 1) * s, (metrics.body_y_max + 1) * s

        neck_y = (metrics.neck_y + 1) * s
        line_w = max(1, 2 * s // 4)

        # 1. Vẽ hộp Đầu (Cyan)
        draw.rectangle([hx0, hy0, hx1, hy1], outline=(0, 230, 255, 230), width=line_w)
        draw.rectangle([hx0, hy0, hx1, hy1], fill=(0, 200, 255, 40))
        draw.text((hx0 + 3, hy0 + 2), f"HEAD: {metrics.head_width}x{metrics.head_height}", fill=(0, 240, 255, 255), font=font)

        # 2. Vẽ hộp Thân (Cam)
        draw.rectangle([bx0, by0, bx1, by1], outline=(255, 140, 0, 210), width=line_w)
        draw.rectangle([bx0, by0, bx1, by1], fill=(255, 120, 0, 35))

        # 3. Vẽ đường ranh giới Cổ (Vàng rực)
        draw.line([(0, neck_y), (base.width, neck_y)], fill=(255, 255, 0, 240), width=line_w)
        draw.text((4, max(0, neck_y - 12)), f"NECK: y={metrics.neck_y}", fill=(255, 255, 0, 255), font=font)

        # 4. Vẽ đường Hông/Háng (Hồng Magenta) nếu có
        if metrics.crotch_y is not None:
            crotch_y = (metrics.crotch_y + 1) * s
            draw.line([(0, crotch_y), (base.width, crotch_y)], fill=(255, 105, 180, 220), width=line_w)
            draw.text((4, max(0, crotch_y - 12)), f"CROTCH: y={metrics.crotch_y}", fill=(255, 120, 200, 255), font=font)

        # 5. Vẽ đường Mặt đất (Xanh lá Neon)
        ground_y = (metrics.ground_y + 1) * s if metrics.ground_y is not None else by1
        draw.line([(0, ground_y), (base.width, ground_y)], fill=(50, 255, 100, 230), width=max(1, line_w + 1))
        draw.text((4, max(0, ground_y - 12)), f"GROUND: y={metrics.ground_y if metrics.ground_y is not None else metrics.visible_y_max}", fill=(80, 255, 120, 255), font=font)

        # 6. Ghép lớp overlay vào ảnh gốc
        return Image.alpha_composite(base, overlay)
