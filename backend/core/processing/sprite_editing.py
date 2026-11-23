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
from backend.core.metrics.pixel_art_metrics import detect_pixel_grid, restore_native

# 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC
# Không áp dụng cho backend.

# Tổng pixel của toàn bộ frame thủ công sau đệm: tối đa 128 MiB RGBA thô,
# chưa tính chi phí bộ nhớ ảnh nguồn, bản ghép và thư viện xử lý.
MAX_MANUAL_GRID_PIXELS = 32 * 1024 * 1024


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


def _validate_manual_cuts(cuts: list[int], count: int, extent: int, axis: str) -> None:
    """Kiểm tra biên cắt nguyên, tăng nghiêm ngặt và nằm trong ảnh gốc.

    @param cuts Danh sách biên của một trục.
    @param count Số ô trên trục.
    @param extent Kích thước ảnh trên trục.
    @param axis Tên trục dùng trong thông báo lỗi.
    @returns None khi dữ liệu hợp lệ.
    """
    if not isinstance(cuts, list) or len(cuts) != count + 1:
        raise ValueError(f"Biên {axis} phải là danh sách gồm {count + 1} tọa độ.")
    if any(type(value) is not int for value in cuts):
        raise ValueError(f"Tọa độ biên {axis} phải là số nguyên, không chấp nhận boolean.")
    if cuts[0] < 0 or cuts[-1] > extent or any(left >= right for left, right in zip(cuts, cuts[1:])):
        raise ValueError(f"Biên {axis} phải tăng nghiêm ngặt trong đoạn từ 0 đến {extent}.")


def slice_sheet(
    image: Image.Image,
    rows: int,
    columns: int,
    auto_anchor: bool = False,
    trim_outer_padding: bool = True,
    alpha_threshold: int = 20,
    x_cuts: list[int] | None = None,
    y_cuts: list[int] | None = None,
) -> Iterator[Image.Image]:
    """
    Cắt lưới Sprite Sheet tổng quát thành các frame đều nhau:
    - Hỗ trợ trim_outer_padding (Content-Aware): Tự động phát hiện và gọt bỏ khoảng lề trống thừa xung quanh
      (đặc biệt hiệu quả với ảnh AI sinh ra có lề rộng 2 bên) trước khi chia lưới.
    - Thuật toán căn giữa lưới (Center Margin): tự động cân bằng phần dư pixel sang 2 bên mép viền.
    - Hoạt động với mọi kích thước ảnh, không ép buộc phải chia hết chẵn.
    - Hỗ trợ auto_anchor: tự động căn giữa ngang và neo chân sát đáy cho từng frame.
    @param x_cuts Biên cột theo pixel ảnh gốc đã chuẩn hóa EXIF, gồm cả hai mép ngoài.
    @param y_cuts Biên hàng theo pixel ảnh gốc đã chuẩn hóa EXIF, gồm cả hai mép ngoài.
    @returns Các frame theo thứ tự hàng, đệm về cùng kích thước khi cắt thủ công.
    """
    if rows < 1 or columns < 1 or rows * columns > 256:
        raise ValueError("Lưới cắt phải có từ 1 đến 256 frame.")

    # SpriteNormalizer: Dùng để phát hiện vùng nội dung thực và chuẩn hóa frame
    from .normalizer import SpriteNormalizer
    normalizer = SpriteNormalizer(anchor="bottom_center")

    source_image = image.convert("RGBA")

    if x_cuts is not None or y_cuts is not None:
        if x_cuts is None or y_cuts is None:
            raise ValueError("Lưới thủ công phải cung cấp đủ biên cột và biên hàng.")
        _validate_manual_cuts(x_cuts, columns, source_image.width, "X")
        _validate_manual_cuts(y_cuts, rows, source_image.height, "Y")
        width = max(right - left for left, right in zip(x_cuts, x_cuts[1:]))
        height = max(bottom - top for top, bottom in zip(y_cuts, y_cuts[1:]))
        if width * height * rows * columns > MAX_MANUAL_GRID_PIXELS:
            raise ValueError(f"Tổng số pixel của các khung thủ công sau đệm vượt giới hạn {MAX_MANUAL_GRID_PIXELS} pixel.")
        # Cắt trực tiếp trên ảnh gốc, bỏ qua gọt lề để bảo toàn hệ tọa độ đã kéo.
        for top, bottom in zip(y_cuts, y_cuts[1:]):
            for left, right in zip(x_cuts, x_cuts[1:]):
                cell = source_image.crop((left, top, right, bottom))
                canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
                if auto_anchor:
                    bbox = normalizer.get_bounding_box(cell, alpha_threshold=alpha_threshold)
                    if not bbox:
                        yield canvas
                        continue
                    # Nội dung luôn vừa canvas lớn nhất nên chỉ cắt và neo, không cần thu phóng.
                    cell = cell.crop(bbox)
                # Dán không dùng mặt nạ để giữ nguyên RGB và alpha của từng pixel.
                canvas.paste(cell, ((width - cell.width) // 2, height - cell.height))
                yield canvas
        return

    # Tự động gọt bỏ lề trống thừa (Content-Aware Padding Trim) khi phát hiện lề trống lớn bất thường
    if trim_outer_padding:
        bbox = normalizer.get_bounding_box(source_image, alpha_threshold=alpha_threshold)
        if bbox:
            xmin, ymin, xmax, ymax = bbox
            cell_w_nominal = source_image.width / columns
            left_m = xmin
            right_m = source_image.width - xmax

            # Chỉ gọt khi phát hiện lề thừa hai bên đáng kể (lớn hơn 30% bề rộng một ô danh định hoặc lề trái > 50% ô)
            if (left_m >= cell_w_nominal * 0.3 and right_m >= cell_w_nominal * 0.3) or (left_m > cell_w_nominal * 0.5):
                source_image = source_image.crop((xmin, ymin, xmax, ymax))

    # Kích thước chuẩn của từng ô frame sau khi đã xử lý lề
    width = source_image.width // columns
    height = source_image.height // rows
    if width < 1 or height < 1:
        raise ValueError("Kích thước ảnh quá nhỏ so với số hàng hoặc số cột yêu cầu.")

    # Tính lề đệm đối xứng để đưa lưới cắt vào chính giữa ảnh, bỏ phần pixel lẻ ở rìa
    margin_x = (source_image.width % columns) // 2
    margin_y = (source_image.height % rows) // 2

    frame_normalizer = None
    if auto_anchor:
        frame_normalizer = SpriteNormalizer(target_width=width, target_height=height, anchor="bottom_center")

    for row in range(rows):
        for column in range(columns):
            left = margin_x + column * width
            top = margin_y + row * height
            cell = source_image.crop((left, top, left + width, top + height))
            if auto_anchor and frame_normalizer is not None:
                cell = frame_normalizer.normalize_frame(cell, alpha_threshold=alpha_threshold)
            yield cell
