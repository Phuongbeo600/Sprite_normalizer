# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Base64, Bộ đệm, Dataclass, Regex & Kiểu)
# ========================================================
# base64, binascii, io: Giải mã ảnh Base64/Data URL đầu vào sang ảnh Pillow để đo giải phẫu
import base64
import binascii
import io
# dataclasses: Khai báo cấu trúc dữ liệu chứa toàn bộ thành phần prompt động và tĩnh
from dataclasses import dataclass
# re: Nhận diện ký tự tiếng Việt có dấu để bảo đảm prompt đưa vào template luôn là tiếng Anh
import re
# typing: Khai báo kiểu tùy chọn, ánh xạ và từ điển placeholder
from typing import Any, Dict, Mapping, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# Pillow: Mở ảnh tham chiếu và chuẩn hóa hướng EXIF trước khi phân tích giải phẫu
from PIL import Image, ImageOps, UnidentifiedImageError

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Core Metrics, Templates & Services)
# ========================================================
# anatomy_mapping: Chuyển đổi số đo giải phẫu thành mô tả tiếng Anh chuẩn hóa
from backend.core.metrics.anatomy_mapping import (
    build_anatomical_description,
    extract_raw_anatomy_metrics,
)
# AnatomyService: Thuật toán đo ảnh giải phẫu hiện có
from backend.services.character.anatomy_service import AnatomyService
# SpriteService: Đo số lượng màu thực tế trên lưới pixel từ ảnh tham chiếu
from backend.services.sprite_service import SpriteService
# Mẫu prompt cố định và các khối giá trị mặc định tách riêng tại image_gen_prompt_template
from backend.services.image_gen_prompt_template import (
    ANATOMICAL_PROPORTIONS_BLOCK,
    DEFAULT_ANATOMICAL_DESCRIPTION,
    DEFAULT_COLOR_COUNT_DESCRIPTION,
    SPRITE_SHEET_DYNAMIC_TEMPLATE,
    STATIC_BACKGROUND_RULES,
    STATIC_COLOR_DESIGN_RULE,
    STATIC_COLOR_INHERITANCE_RULE,
    STATIC_CONSISTENCY_RULES,
    STATIC_LAYOUT_AND_MOTION_RULES,
    STATIC_OUTPUT_RULES,
    STATIC_PRIORITY_RULES,
    STATIC_REFERENCE_RULES,
    STATIC_TASK,
)
# TranslationService: Bảo đảm prompt gửi vào template luôn được dịch sang tiếng Anh nếu còn tiếng Việt
from backend.services.translation_service import TranslationService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

# Biểu thức chính quy nhận diện ký tự tiếng Việt có dấu
_VIETNAMESE_CHAR_PATTERN = re.compile(
    r"[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]",
    re.IGNORECASE,
)


@dataclass
class ImageGenPromptParts:
    """
    Cấu trúc dữ liệu chứa toàn bộ thành phần prompt động và tĩnh để render từ template 11 mục.
    """

    # Các thành phần động thay đổi theo yêu cầu và thông số kỹ thuật
    user_prompt: str
    anatomical_description: str = DEFAULT_ANATOMICAL_DESCRIPTION
    color_count_description: str = DEFAULT_COLOR_COUNT_DESCRIPTION

    # Các thành phần tĩnh định hình cấu trúc Sprite Sheet 3x5 và màu sắc cố định
    static_task: str = STATIC_TASK
    static_reference_rules: str = STATIC_REFERENCE_RULES
    static_color_inheritance_rule: str = STATIC_COLOR_INHERITANCE_RULE
    static_color_design_rule: str = STATIC_COLOR_DESIGN_RULE
    static_layout_and_motion_rules: str = STATIC_LAYOUT_AND_MOTION_RULES
    static_consistency_rules: str = STATIC_CONSISTENCY_RULES
    static_output_rules: str = STATIC_OUTPUT_RULES
    static_background_rules: str = STATIC_BACKGROUND_RULES
    static_priority_rules: str = STATIC_PRIORITY_RULES


def _needs_translation_to_english(text: str) -> bool:
    """Kiểm tra chuỗi có chứa tiếng Việt có dấu để bảo đảm dữ liệu vào template luôn là tiếng Anh."""
    return bool(text and _VIETNAMESE_CHAR_PATTERN.search(text))


def _translate_to_english_if_needed(text: str) -> str:
    """Dịch văn bản sang tiếng Anh bằng TranslationService (có LRU Cache RAM) nếu còn tiếng Việt."""
    cleaned = text.strip()
    if not cleaned or not _needs_translation_to_english(cleaned):
        return cleaned
    return TranslationService.translate(cleaned, source_lang="vi", target_lang="en").strip() or cleaned


def _read_request_field(request: Any, field_name: str, default: Any = None) -> Any:
    """Đọc an toàn thuộc tính hoặc khóa từ điển từ đối tượng yêu cầu."""
    if isinstance(request, Mapping):
        return request.get(field_name, default)
    return getattr(request, field_name, default)


def _format_color_count_limit(color_count: int) -> str:
    """Biên dịch số lượng màu đo được thành ràng buộc giới hạn số màu (không truyền mã màu cụ thể)."""
    noun = "color" if color_count == 1 else "colors"
    return (
        f"- Use a shared color palette, limited to a maximum of {color_count} {noun} "
        "across the entire Sprite Sheet."
    )


def _parse_positive_color_count(value: Any) -> Optional[int]:
    """Kiểm tra giá trị số lượng màu là số nguyên dương hợp lệ."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    numeric = int(value)
    return numeric if numeric >= 1 else None


def _resolve_color_count_description(
    request: Any,
    decoded_img: Optional[Image.Image] = None,
) -> str:
    """
    Xác định ràng buộc giới hạn số lượng màu từ tham số đo được (không truyền mã màu HEX/RGB):
    1. Chuỗi mô tả truyền trực tiếp (nếu có).
    2. Tham số số nguyên `color_count` từ Tab Phân tích.
    3. Tự động đo tổng số màu trên Ảnh 1 bằng `SpriteService.analyze_colors` nếu chưa có sẵn.
    """
    explicit_desc = _read_request_field(request, "color_count_description")
    if isinstance(explicit_desc, str) and explicit_desc.strip():
        return _translate_to_english_if_needed(explicit_desc)

    explicit_count = _parse_positive_color_count(_read_request_field(request, "color_count"))
    if explicit_count is not None:
        return _format_color_count_limit(explicit_count)

    if decoded_img is not None:
        color_report = SpriteService.analyze_colors(decoded_img)
        palette_metrics = color_report.get("palette_metrics") if isinstance(color_report, Mapping) else None
        detected_count = _parse_positive_color_count(
            palette_metrics.get("total_colors") if isinstance(palette_metrics, Mapping) else None
        )
        # Chỉ ép giới hạn số lượng màu tự động khi ảnh tham chiếu có từ 2 màu trở lên
        if detected_count is not None and detected_count >= 2:
            return _format_color_count_limit(detected_count)

    return DEFAULT_COLOR_COUNT_DESCRIPTION


def _decode_image_from_base64(image_str: str) -> Optional[Image.Image]:
    """
    Giải mã chuỗi Base64 hoặc Data URL sang đối tượng Pillow Image phục vụ phân tích giải phẫu.
    Trả về None nếu chuỗi không hợp lệ để không làm gián đoạn xử lý kiểm tra lỗi của Provider.
    """
    if not image_str or not image_str.strip():
        return None
    encoded = image_str.split(",", 1)[1] if image_str.strip().startswith("data:") and "," in image_str else image_str
    try:
        raw_bytes = base64.b64decode("".join(encoded.split()), validate=True)
        with Image.open(io.BytesIO(raw_bytes)) as source:
            return ImageOps.exif_transpose(source).convert("RGBA")
    except (binascii.Error, ValueError, OSError, UnidentifiedImageError, Image.DecompressionBombError):
        return None


def _resolve_anatomical_description(
    request: Any,
    decoded_img: Optional[Image.Image] = None,
) -> str:
    """
    Kết nối luồng Image Analysis -> Raw Metrics -> Anatomical Mapping -> ANATOMICAL_DESCRIPTION.
    Ưu tiên chuỗi truyền trực tiếp (nếu có), sau đó đến số đo truyền sẵn hoặc chạy đo trực tiếp trên ảnh mẫu.
    """
    explicit_desc = _read_request_field(request, "anatomical_description")
    if isinstance(explicit_desc, str) and explicit_desc.strip():
        return _translate_to_english_if_needed(explicit_desc)

    explicit_metrics = (
        _read_request_field(request, "raw_anatomy_metrics")
        or _read_request_field(request, "anatomy_metrics")
        or _read_request_field(request, "metrics")
    )
    region_measurements = _read_request_field(request, "region_measurements")
    manual_region_measurements = _read_request_field(request, "manual_region_measurements")

    if explicit_metrics is not None:
        raw_metrics = extract_raw_anatomy_metrics(
            metrics=explicit_metrics,
            region_measurements=region_measurements,
            manual_region_measurements=manual_region_measurements,
        )
        return build_anatomical_description(raw_metrics)

    if decoded_img is not None:
        metrics, _, _ = AnatomyService.analyze_sprite(decoded_img, auto_remove_bg=True)
        auto_regions = (
            AnatomyService.measure_anatomy_regions(decoded_img, metrics, auto_remove_bg=True)
            if metrics is not None
            else region_measurements
        )
        raw_metrics = extract_raw_anatomy_metrics(
            metrics=metrics,
            region_measurements=auto_regions,
            manual_region_measurements=manual_region_measurements,
        )
        return build_anatomical_description(raw_metrics)

    if region_measurements is not None or manual_region_measurements is not None:
        raw_metrics = extract_raw_anatomy_metrics(
            metrics=None,
            region_measurements=region_measurements,
            manual_region_measurements=manual_region_measurements,
        )
        return build_anatomical_description(raw_metrics)

    return ""


def build_final_prompt(parts: ImageGenPromptParts) -> str:
    """
    Render câu prompt hoàn chỉnh từ template 11 mục và các thành phần trong ImageGenPromptParts.
    Nếu anatomical_description rỗng, tự động loại bỏ toàn bộ khối ANATOMICAL PROPORTIONS khỏi Final Prompt.

    @param {ImageGenPromptParts} parts Đối tượng chứa toàn bộ thành phần prompt động và tĩnh.
    @returns {str} Chuỗi prompt hoàn chỉnh sẵn sàng gửi sang Provider.
    """
    rendered = SPRITE_SHEET_DYNAMIC_TEMPLATE
    clean_anatomy = (parts.anatomical_description or "").strip()

    # Bỏ toàn bộ khối ANATOMICAL PROPORTIONS khi không có mô tả giải phẫu hợp lệ
    if not clean_anatomy:
        rendered = rendered.replace(f"\n\n{ANATOMICAL_PROPORTIONS_BLOCK}", "")

    placeholders: Dict[str, str] = {
        "[STATIC_TASK]": parts.static_task,
        "[USER_DESCRIPTION]": parts.user_prompt,
        "[STATIC_REFERENCE_RULES]": parts.static_reference_rules,
        "[ANATOMICAL_DESCRIPTION]": clean_anatomy,
        "[COLOR_COUNT_DESCRIPTION]": parts.color_count_description,
        "[STATIC_COLOR_INHERITANCE_RULE]": parts.static_color_inheritance_rule,
        "[STATIC_COLOR_DESIGN_RULE]": parts.static_color_design_rule,
        "[STATIC_LAYOUT_AND_MOTION_RULES]": parts.static_layout_and_motion_rules,
        "[STATIC_CONSISTENCY_RULES]": parts.static_consistency_rules,
        "[STATIC_OUTPUT_RULES]": parts.static_output_rules,
        "[STATIC_BACKGROUND_RULES]": parts.static_background_rules,
        "[STATIC_PRIORITY_RULES]": parts.static_priority_rules,
    }

    # Thay thế lần lượt từng placeholder để không bị lỗi nếu nội dung chứa dấu ngoặc nhọn
    for token, value in placeholders.items():
        rendered = rendered.replace(token, value)
    return rendered


def build_prompt_from_request(request: Any) -> str:
    """
    Pipeline xây dựng prompt hoàn chỉnh từ yêu cầu tạo ảnh:
    1. Lấy prompt người dùng (kèm style_preset nếu có).
    2. Bắt buộc đưa về tiếng Anh nếu đầu vào vẫn còn tiếng Việt (dùng cache LRU nếu đã dịch trước).
    3. Giải mã Ảnh 1 một lần (nếu có), nối ánh xạ giải phẫu và số lượng màu giới hạn đo được.
    4. Ghép toàn bộ vào template và trả về final prompt.

    @param {Any} request Yêu cầu tạo ảnh (ImageGenRequest hoặc dict tương thích).
    @returns {str} Final prompt hoàn chỉnh gửi sang Provider.
    """
    # 1. Lấy prompt người dùng và kết hợp style_preset nếu có
    raw_prompt = _read_request_field(request, "prompt", "")
    raw_style = _read_request_field(request, "style_preset")

    user_prompt = (raw_prompt or "").strip()
    if isinstance(raw_style, str) and raw_style.strip():
        user_prompt = f"{user_prompt}, Style: {raw_style.strip()}"

    # 2. Bảo đảm prompt đưa vào template luôn là tiếng Anh (0ms nếu Frontend đã gửi tiếng Anh)
    english_user_prompt = _translate_to_english_if_needed(user_prompt)

    # 3. Kết nối phân tích giải phẫu và giới hạn số lượng màu đo được (không truyền mã màu cụ thể)
    raw_image = _read_request_field(request, "image")
    decoded_img = _decode_image_from_base64(raw_image) if isinstance(raw_image, str) and raw_image.strip() else None
    try:
        anatomical_description = _resolve_anatomical_description(request, decoded_img=decoded_img)
        color_count_description = _resolve_color_count_description(request, decoded_img=decoded_img)
    finally:
        if decoded_img is not None:
            decoded_img.close()

    # 4. Đóng gói toàn bộ thành phần động + tĩnh vào dataclass và render template
    parts = ImageGenPromptParts(
        user_prompt=english_user_prompt,
        anatomical_description=anatomical_description,
        color_count_description=color_count_description,
    )

    # 5. Trả về final prompt
    return build_final_prompt(parts)
