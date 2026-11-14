"""Thay đổi độ phân giải và cắt sprite sheet theo lưới đều."""

# 1. THƯ VIỆN NỀN TẢNG PYTHON
# Iterator: Duyệt từng frame theo thứ tự hàng.
from collections.abc import Iterator

# 2. THƯ VIỆN BÊN NGOÀI
# Pillow: Lấy mẫu pixel và cắt từng ô.
from PIL import Image
# NumPy: Đọc dữ liệu RGBA để dò lưới pixel.
import numpy as np

# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
# Thuật toán dùng chung với phân tích màu để dò và khôi phục lưới.
from backend.core.pixel_art_metrics import detect_pixel_grid, restore_native

# 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC
# Không áp dụng cho backend.


def recover_native_sprite(image: Image.Image) -> tuple[Image.Image, float]:
    """Khôi phục mỗi ô của lưới đã nhận diện về một pixel."""
    source = image.convert("RGBA")
    rgba = np.asarray(source)
    grid = detect_pixel_grid(rgba, min_edges_per_axis=3)
    if grid.period == 1:
        return image, 1.0

    # Khi lưới gần hệ số nguyên, kiểm tra xem ảnh có phải bản phóng pixel chính xác.
    factor = round(grid.period)
    if not (image.width % factor or image.height % factor):
        size = (image.width // factor, image.height // factor)
        candidate = source.resize(size, Image.Resampling.NEAREST)
        if candidate.resize(image.size, Image.Resampling.NEAREST).tobytes() == source.tobytes():
            return candidate, float(factor)

    return Image.fromarray(restore_native(rgba, grid)), grid.period


def resize_sprite(image: Image.Image, width: int, height: int) -> Image.Image:
    """Thu nhỏ hoặc điều chỉnh kích thước ảnh RGBA theo số pixel yêu cầu (Nearest Neighbor)."""
    if width < 1 or height < 1:
        raise ValueError("Kích thước mới phải lớn hơn hoặc bằng 1 pixel.")
    return image.convert("RGBA").resize((width, height), Image.Resampling.NEAREST)


def slice_sheet(
    image: Image.Image,
    rows: int,
    columns: int,
    auto_anchor: bool = False
) -> Iterator[Image.Image]:
    """
    Cắt lưới Sprite Sheet tổng quát thành các frame đều nhau:
    - Thuật toán căn giữa lưới (Center Margin): tự động cân bằng phần dư pixel sang 2 bên mép viền.
    - Hoạt động với mọi kích thước ảnh, không ép buộc phải chia hết chẵn.
    - Hỗ trợ auto_anchor: tự động căn giữa ngang và neo chân sát đáy cho từng frame.
    """
    if rows < 1 or columns < 1 or rows * columns > 256:
        raise ValueError("Lưới cắt phải có từ 1 đến 256 frame.")

    # Kích thước chuẩn của từng ô frame
    width = image.width // columns
    height = image.height // rows
    if width < 1 or height < 1:
        raise ValueError("Kích thước ảnh quá nhỏ so với số hàng hoặc số cột yêu cầu.")

    # Tính lề đệm đối xứng để đưa lưới cắt vào chính giữa ảnh, bỏ phần pixel lẻ ở rìa
    margin_x = (image.width % columns) // 2
    margin_y = (image.height % rows) // 2

    rgba = image.convert("RGBA")
    normalizer = None
    if auto_anchor:
        # SpriteNormalizer: Chuẩn hóa căn giữa và neo đáy chân
        from backend.core.normalizer import SpriteNormalizer
        normalizer = SpriteNormalizer(target_width=width, target_height=height, anchor="bottom_center")

    for row in range(rows):
        for column in range(columns):
            left = margin_x + column * width
            top = margin_y + row * height
            cell = rgba.crop((left, top, left + width, top + height))
            if auto_anchor and normalizer is not None:
                cell = normalizer.normalize_frame(cell)
            yield cell
