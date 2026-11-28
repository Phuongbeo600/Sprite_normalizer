# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Mã hóa, Bộ đệm, Đường dẫn & Kiểu)
# ========================================================
# base64: Mã hóa dữ liệu nhị phân PNG sang chuỗi Base64 gửi tới AI Provider
import base64
# io: Bộ đệm đọc và xuất ảnh PNG trong bộ nhớ RAM
import io
# pathlib: Thao tác an toàn với đường dẫn thư mục chứa ảnh tham chiếu cố định
from pathlib import Path
# typing: Khai báo gợi ý kiểu tùy chọn và tập hợp tên tệp
from typing import Optional, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# Pillow: Đọc, xoay đúng hướng EXIF và chuẩn hóa ảnh tham chiếu sang định dạng PNG RGBA
from PIL import Image, ImageOps, UnidentifiedImageError

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không phụ thuộc module nội bộ để tránh vòng lặp import)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & CẤU HÌNH (Stylesheets / Config)
# ========================================================
# (Không áp dụng cho module service backend)


# Thư mục mặc định để người dùng đặt Ảnh tham chiếu số 2 cố định (Layout & Pose 3x5)
FIXED_REFERENCE_IMAGE_2_DIR = (
    Path(__file__).resolve().parent.parent / "assets" / "reference_image_2"
)

# Các phần mở rộng ảnh hợp lệ được hệ thống tự động nhận diện
SUPPORTED_REFERENCE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}

# Danh sách tên gốc ưu tiên nếu người dùng đặt nhiều tệp trong thư mục
PREFERRED_REFERENCE_STEMS: Tuple[str, ...] = (
    "reference_2",
    "image_2",
    "pose_layout",
    "layout",
)


def find_fixed_reference_image_2_path(assets_dir: Optional[Path] = None) -> Optional[Path]:
    """
    Tìm tệp Ảnh tham chiếu số 2 cố định trong thư mục quy định.

    @param {Optional[Path]} assets_dir Đường dẫn thư mục tùy chọn (mặc định dùng FIXED_REFERENCE_IMAGE_2_DIR).
    @returns {Optional[Path]} Đường dẫn tới tệp ảnh hợp lệ hoặc None nếu thư mục trống/chưa có ảnh.
    """
    target_dir = Path(assets_dir) if assets_dir is not None else FIXED_REFERENCE_IMAGE_2_DIR
    if not target_dir.exists() or not target_dir.is_dir():
        return None

    # Lọc toàn bộ tệp ảnh hợp lệ và sắp xếp cố định theo tên để kết quả luôn nhất quán
    candidates = sorted(
        (
            item
            for item in target_dir.iterdir()
            if item.is_file() and item.suffix.lower() in SUPPORTED_REFERENCE_EXTENSIONS
        ),
        key=lambda item: item.name.lower(),
    )
    if not candidates:
        return None

    # Ưu tiên tên tệp chuẩn nếu trong thư mục có nhiều ảnh
    for stem in PREFERRED_REFERENCE_STEMS:
        for item in candidates:
            if item.stem.lower() == stem:
                return item

    return candidates[0]


def load_fixed_reference_image_2_b64(assets_dir: Optional[Path] = None) -> Optional[str]:
    """
    Đọc Ảnh tham chiếu số 2 cố định từ đĩa, chuẩn hóa sang PNG RGBA và đóng gói thành chuỗi Base64.

    @param {Optional[Path]} assets_dir Đường dẫn thư mục tùy chọn chứa Ảnh tham chiếu số 2.
    @returns {Optional[str]} Chuỗi Base64 PNG thuần sẵn sàng gửi API Provider, hoặc None nếu chưa có ảnh.
    """
    image_path = find_fixed_reference_image_2_path(assets_dir)
    if image_path is None:
        return None

    try:
        with Image.open(image_path) as source, io.BytesIO() as buffer:
            normalized = ImageOps.exif_transpose(source).convert("RGBA")
            normalized.save(buffer, format="PNG")
            return base64.b64encode(buffer.getvalue()).decode("ascii")
    except (OSError, UnidentifiedImageError, Image.DecompressionBombError, ValueError) as exc:
        raise ValueError(
            f"Ảnh tham chiếu số 2 '{image_path.name}' trong '{image_path.parent}' "
            "bị lỗi hoặc không đúng định dạng ảnh PNG/JPEG/WebP."
        ) from exc
