# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Bộ đệm dữ liệu)
# ========================================================
# io: Xử lý bộ đệm nhị phân cho ảnh render
import io
# base64: Mã hóa ảnh kết quả sang chuỗi base64 gửi về Frontend
import base64
# os: Đọc cấu hình biến môi trường
import os
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
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Core & Providers)
# ========================================================
# CharacterMetrics: Data model lưu trữ kết quả giải phẫu
from backend.core.character_metrics import CharacterMetrics
# BackgroundMaskExtractor: Bóc tách kênh Alpha Mask
from backend.core.masking import BackgroundMaskExtractor
# HeuristicAnalyzer: Phân tích giải phẫu học toán học ngoại tuyến
from backend.core.heuristic_analyzer import HeuristicAnalyzer
# AnatomyVisualRenderer: Vẽ các lớp phủ trực quan Head/Torso/Legs/Weapons
from backend.core.visual_renderer import AnatomyVisualRenderer
# AiProviderFactory: Khởi tạo nhà cung cấp AI Đa hình
from backend.providers.factory import AiProviderFactory

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class AnatomyService:
    """
    Dịch vụ điều phối phân tích giải phẫu học Sprite (Anatomy Service).
    - Lựa chọn giải thuật phân tích: Heuristic Toán học (Offline 0 Token) hoặc AI Vision Đa hình (Gemini / ChatGPT).
    - Thực thi thuật toán Snap Pixel (Hút viền) trên Alpha Mask thực tế để đảm bảo độ chính xác 100%.
    - Tính toán tỷ lệ cơ thể thuần (loại bỏ vũ khí & bóng).
    - Tạo ảnh lớp phủ trực quan hóa (Visual Overlay) Base64.
    """

    VISION_PROMPT = """
You are an expert in 2D video game pixel art character anatomy, sprite sheets, and character design.
Analyze the 2D character sprite in this image.

Your task is to segment and detect coordinates normalized from 0 to 1000 [ymin, xmin, ymax, xmax] for BOTH anatomical body parts and non-body parts/accessories:

1. ANATOMICAL BODY PARTS (STRICTLY EXCLUDE weapons, capes, wings, shadows):
- "head_box": [ymin, xmin, ymax, xmax] enclosing ONLY the actual head, face, and hair/helmet.
- "torso_box": [ymin, xmin, ymax, xmax] enclosing the torso from neck to crotch/hips (chest, abdomen, waist).
- "legs_box": [ymin, xmin, ymax, xmax] enclosing the legs and feet from crotch/hips down to ground contact.
- "neck_y": integer (0-1000) representing the biological neck line junction.
- "crotch_y": integer (0-1000) representing the hips/crotch line where legs split from torso.
- "ground_y": integer (0-1000) representing the lowest foot contacting the ground surface.

2. NON-BODY REGIONS / ACCESSORIES (Set to null if not present):
- "weapon_box": [ymin, xmin, ymax, xmax] or null enclosing held weapons (swords, shields, spears, staves, bows, guns).
- "cape_wings_box": [ymin, xmin, ymax, xmax] or null enclosing flying capes, loose fabrics, scarves, or wings.
- "shadow_box": [ymin, xmin, ymax, xmax] or null enclosing contact shadow or aura on the floor beneath feet.

3. ARCHETYPE & NOTES:
- "character_archetype": short string describing character (e.g. "Knight with greatsword", "Mage", "Monster").
- "anatomy_notes": short 1-2 sentence assessment in Vietnamese of body proportions vs accessories.

Return ONLY a valid JSON object matching this schema:
{
  "head_box": [ymin, xmin, ymax, xmax],
  "torso_box": [ymin, xmin, ymax, xmax],
  "legs_box": [ymin, xmin, ymax, xmax],
  "weapon_box": [ymin, xmin, ymax, xmax] or null,
  "cape_wings_box": [ymin, xmin, ymax, xmax] or null,
  "shadow_box": [ymin, xmin, ymax, xmax] or null,
  "neck_y": int,
  "crotch_y": int,
  "ground_y": int,
  "character_archetype": str,
  "anatomy_notes": str
}
"""

    @classmethod
    def analyze_sprite(
        cls,
        image: Image.Image,
        api_key: Optional[str] = None,
        provider: str = "gemini",
        base_url: Optional[str] = None,
        auto_remove_bg: bool = True,
        use_ai: bool = False
    ) -> Tuple[Optional[CharacterMetrics], str, str]:
        """
        Phân tích giải phẫu học toàn diện và trả về bộ chỉ số + ảnh trực quan Base64.

        @param {Image.Image} image Ảnh sprite gốc.
        @param {Optional[str]} api_key Khóa API tùy chọn.
        @param {str} provider Nhà cung cấp AI ('gemini' hoặc 'openai').
        @param {Optional[str]} base_url Địa chỉ máy chủ proxy.
        @param {bool} auto_remove_bg Tự động khử nền đặc.
        @param {bool} use_ai Có kích hoạt AI Vision hay không.
        @returns {Tuple[Optional[CharacterMetrics], str, str]} (Metrics, Message, Annotated Image Data URL).
        """
        mask, clean_img = BackgroundMaskExtractor.extract_mask(image, auto_remove_solid_bg=auto_remove_bg)
        if not np.any(mask):
            return None, "Không tìm thấy pixel nhân vật (ảnh trống hoặc trong suốt).", ""

        active_provider = (provider or os.getenv("AI_PROVIDER", "gemini")).lower()
        active_base_url = base_url or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

        # Xác định API key hiệu dụng
        if use_ai:
            if active_provider == "openai":
                effective_key = api_key or os.getenv("OPENAI_API_KEY")
            else:
                effective_key = api_key or os.getenv("GEMINI_API_KEY")
        else:
            effective_key = None

        # Trường hợp 1: Chạy AI Vision thông qua tính Đa hình của AiProviderFactory
        if effective_key and effective_key.strip():
            try:
                ai_provider = AiProviderFactory.get_provider(active_provider)
                ai_data = ai_provider.analyze_vision(
                    clean_img, effective_key.strip(), cls.VISION_PROMPT, base_url=active_base_url
                )

                # Chuyển đổi tọa độ & Snap Pixel
                metrics = cls._snap_and_build_metrics(ai_data, clean_img, mask)
                annotated_base64 = cls._render_annotated_base64(clean_img, metrics)
                return metrics, "Phân tích AI Vision thành công!", annotated_base64
            except Exception as e:
                # Tự động Fallback sang Heuristic khi AI lỗi mạng hoặc quá hạn mức
                heuristic_metrics = HeuristicAnalyzer.analyze(clean_img, auto_remove_solid_bg=False)
                if heuristic_metrics:
                    heuristic_metrics.detection_source = f"Heuristic (Fallback do AI: {str(e)[:35]})"
                    heuristic_metrics.summary_text = (
                        f"⚠️ [CHẾ ĐỘ FALLBACK - LỖI MẠNG AI]\n" + heuristic_metrics.summary_text
                    )
                    annotated_base64 = cls._render_annotated_base64(clean_img, heuristic_metrics)
                    return heuristic_metrics, f"AI gặp lỗi ({str(e)[:40]}), đã tự động chuyển sang Heuristic.", annotated_base64

        # Trường hợp 2: Chạy thuật toán Heuristic toán học nội bộ (Offline 0 Token)
        heuristic_metrics = HeuristicAnalyzer.analyze(clean_img, auto_remove_solid_bg=False)
        if not heuristic_metrics:
            return None, "Không thể phân tích giải phẫu ảnh bằng thuật toán toán học.", ""

        annotated_base64 = cls._render_annotated_base64(clean_img, heuristic_metrics)
        return heuristic_metrics, "Phân tích bằng Heuristic Toán học Cục bộ (Offline 0 Token)", annotated_base64

    @classmethod
    def _snap_and_build_metrics(
        cls,
        ai_data: Dict[str, Any],
        image: Image.Image,
        mask: np.ndarray
    ) -> CharacterMetrics:
        """Thuật toán Snap Pixel và tính toán tỷ lệ thuần từ dữ liệu AI."""
        w, h = image.size

        def _denorm_box(raw_box: Optional[Any]) -> Optional[Tuple[int, int, int, int]]:
            if not raw_box or not isinstance(raw_box, (list, tuple)) or len(raw_box) < 4:
                return None
            try:
                ymin = max(0, min(h - 1, int(round(float(raw_box[0]) / 1000.0 * h))))
                xmin = max(0, min(w - 1, int(round(float(raw_box[1]) / 1000.0 * w))))
                ymax = max(ymin + 1, min(h - 1, int(round(float(raw_box[2]) / 1000.0 * h))))
                xmax = max(xmin + 1, min(w - 1, int(round(float(raw_box[3]) / 1000.0 * w))))
                return (ymin, xmin, ymax, xmax)
            except (ValueError, TypeError):
                return None

        raw_head_box = ai_data.get("head_box", [100, 200, 400, 600])
        head_ymin_px = int(round(raw_head_box[0] / 1000.0 * h))
        head_xmin_px = int(round(raw_head_box[1] / 1000.0 * w))
        head_ymax_px = int(round(raw_head_box[2] / 1000.0 * h))
        head_xmax_px = int(round(raw_head_box[3] / 1000.0 * w))

        neck_raw_px = int(round(ai_data.get("neck_y", 350) / 1000.0 * h))
        crotch_raw_px = int(round(ai_data.get("crotch_y", 650) / 1000.0 * h))
        ground_raw_px = int(round(ai_data.get("ground_y", 950) / 1000.0 * h))

        head_ymin_px = max(0, min(h - 1, head_ymin_px))
        head_ymax_px = max(head_ymin_px + 1, min(h - 1, head_ymax_px))
        head_xmin_px = max(0, min(w - 1, head_xmin_px))
        head_xmax_px = max(head_xmin_px + 1, min(w - 1, head_xmax_px))

        torso_box = _denorm_box(ai_data.get("torso_box"))
        legs_box = _denorm_box(ai_data.get("legs_box"))
        weapon_box = _denorm_box(ai_data.get("weapon_box"))
        cape_wings_box = _denorm_box(ai_data.get("cape_wings_box"))
        shadow_box = _denorm_box(ai_data.get("shadow_box"))

        y_indices, x_indices = np.where(mask)
        char_y_min, char_y_max = int(y_indices.min()), int(y_indices.max())
        char_x_min, char_x_max = int(x_indices.min()), int(x_indices.max())

        vis_w = char_x_max - char_x_min + 1
        vis_h = char_y_max - char_y_min + 1

        # Xử lý điểm tiếp đất gót chân (loại bỏ bóng đổ)
        if shadow_box is not None:
            shadow_ymin = shadow_box[0]
            feet_y_indices = y_indices[y_indices <= max(char_y_min + 5, shadow_ymin)]
            ground_snapped = int(feet_y_indices.max()) if len(feet_y_indices) > 0 else min(char_y_max, ground_raw_px)
        else:
            ground_snapped = char_y_max

        # Đỉnh đầu
        if weapon_box is not None and weapon_box[0] < head_ymin_px:
            head_ymin_px = max(char_y_min, head_ymin_px)
        else:
            head_ymin_px = min(head_ymin_px, char_y_min)

        # Snap Neck Y
        search_start = max(char_y_min + 2, neck_raw_px - 4)
        search_end = min(char_y_max - 2, neck_raw_px + 4)
        if search_end > search_start:
            widths = [len(np.where(mask[y, :])[0]) for y in range(search_start, search_end + 1)]
            neck_snapped = search_start + int(np.argmin(widths))
        else:
            neck_snapped = max(char_y_min + 1, min(char_y_max - 1, neck_raw_px))

        # Snap Head X
        head_px_y, head_px_x = np.where(mask[head_ymin_px:neck_snapped + 1, :])
        if len(head_px_x) > 0:
            head_xmin_snapped = max(char_x_min, head_xmin_px)
            head_xmax_snapped = min(char_x_max, head_xmax_px)
            if head_xmax_snapped <= head_xmin_snapped:
                head_xmin_snapped = int(head_px_x.min())
                head_xmax_snapped = int(head_px_x.max())
        else:
            head_xmin_snapped = head_xmin_px
            head_xmax_snapped = head_xmax_px

        # Snap Crotch Y
        crotch_start = max(neck_snapped + 2, crotch_raw_px - 5)
        crotch_end = min(char_y_max - 2, crotch_raw_px + 5)
        if crotch_end > crotch_start:
            counts = [len(np.where(mask[y, :])[0]) for y in range(crotch_start, crotch_end + 1)]
            crotch_snapped = crotch_start + int(np.argmin(counts))
        else:
            crotch_snapped = max(neck_snapped + 2, min(char_y_max - 1, crotch_raw_px))

        head_w = max(1, head_xmax_snapped - head_xmin_snapped + 1)
        head_h = max(1, neck_snapped - head_ymin_px + 1)

        # Chiều cao cơ thể sinh học thuần (loại bỏ vũ khí & bóng)
        anatomical_h = max(1, ground_snapped - head_ymin_px + 1)

        body_w = vis_w
        body_h = max(1, ground_snapped - (neck_snapped + 1) + 1)
        torso_h = max(1, crotch_snapped - neck_snapped) if crotch_snapped > neck_snapped else body_h
        torso_w = body_w

        head_ratio = head_h / max(anatomical_h, 1)
        heads_tall = anatomical_h / max(head_h, 1)
        head_to_body_w = head_w / max(body_w, 1)
        body_aspect = body_w / max(body_h, 1)

        if heads_tall <= 2.6:
            style_cat = "Chibi Lùn (2.0 - 2.5 đầu)"
        elif heads_tall <= 4.0:
            style_cat = "Semi-Chibi / Retro RPG (3.0 - 4.0 đầu)"
        else:
            style_cat = "Dáng Thật / Heroic (5.0+ đầu)"

        archetype = ai_data.get("character_archetype", "Sprite Character")
        notes = ai_data.get("anatomy_notes", "")
        model_used = ai_data.get("model_used", "AI Vision")

        acc_found = []
        if weapon_box:
            acc_found.append(f"Vũ khí ({weapon_box[3] - weapon_box[1] + 1}x{weapon_box[2] - weapon_box[0] + 1}px)")
        if cape_wings_box:
            acc_found.append(f"Áo choàng/Cánh ({cape_wings_box[3] - cape_wings_box[1] + 1}x{cape_wings_box[2] - cape_wings_box[0] + 1}px)")
        if shadow_box:
            acc_found.append(f"Bóng sàn ({shadow_box[3] - shadow_box[1] + 1}x{shadow_box[2] - shadow_box[0] + 1}px)")

        acc_str = " | ".join(acc_found) if acc_found else "Không phát hiện phụ kiện thừa"

        summary = (
            f"✨ [NGUỒN PHÂN TÍCH: AI VISION ({model_used})]\n"
            f"Archetype: {archetype} | Phong cách: {style_cat}\n"
            f"Chiều cao cơ thể thuần: {anatomical_h} px (Ảnh hiển thị: {vis_w}x{vis_h} px, Canvas: {w}x{h} px)\n"
            f"Đầu sinh học: {head_w}x{head_h} px (Chiếm {head_ratio*100:.1f}% cơ thể, chuẩn 1:{heads_tall:.1f} đầu)\n"
            f"Ranh giới Cổ: y={neck_snapped} px  |  Háng: y={crotch_snapped} px  |  Chân chạm đất: y={ground_snapped} px\n"
            f"Vùng ngoại vi (Đã loại trừ khỏi tỷ lệ): {acc_str}\n"
            f"Nhận định AI: {notes}"
        )

        return CharacterMetrics(
            canvas_width=w,
            canvas_height=h,
            visible_x_min=char_x_min,
            visible_y_min=char_y_min,
            visible_x_max=char_x_max,
            visible_y_max=char_y_max,
            visible_width=vis_w,
            visible_height=vis_h,
            neck_y=neck_snapped,
            head_x_min=head_xmin_snapped,
            head_y_min=head_ymin_px,
            head_x_max=head_xmax_snapped,
            head_y_max=neck_snapped,
            head_width=head_w,
            head_height=head_h,
            body_x_min=char_x_min,
            body_y_min=neck_snapped + 1,
            body_x_max=char_x_max,
            body_y_max=ground_snapped,
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
            crotch_y=crotch_snapped,
            ground_y=ground_snapped,
            anatomical_height=anatomical_h,
            torso_box=torso_box,
            legs_box=legs_box,
            weapon_box=weapon_box,
            cape_wings_box=cape_wings_box,
            shadow_box=shadow_box,
            detection_source=f"AI Vision ({model_used})",
            ai_feedback=notes
        )

    @classmethod
    def _render_annotated_base64(cls, image: Image.Image, metrics: CharacterMetrics) -> str:
        """Vẽ lớp phủ giải phẫu và mã hóa sang Data URL Base64."""
        annotated_img = AnatomyVisualRenderer.render_overlay(image, metrics, scale=2)
        out_buffer = io.BytesIO()
        annotated_img.save(out_buffer, format="PNG")
        b64_str = base64.b64encode(out_buffer.getvalue()).decode("utf-8")
        return f"data:image/png;base64,{b64_str}"
