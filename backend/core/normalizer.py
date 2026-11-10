"""
Module: backend.core.normalizer
Mục đích: Thuật toán chuẩn hóa ảnh Sprite (SpriteNormalizer).
Ai gọi nó: API router `backend.api.v1.sprites` và các bài kiểm thử `tests.test_sprite_normalizer`.
Tại sao tồn tại: Xử lý tiền xử lý hình ảnh sprite: tự động phát hiện hộp bao tối thiểu (Bounding Box) bỏ viền trong suốt, căn chỉnh điểm neo chân đáy giữa (Bottom-Center Anchor) và đệm viền an toàn, đảm bảo mọi frame sprite có cùng chuẩn hệ quy chiếu hình học.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Kiểu)
# ========================================================
# typing: Định nghĩa kiểu dữ liệu tuple, danh sách và tùy chọn giá trị
from typing import Tuple, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# PIL (Pillow): Mở, resize, crop và dán khung hình sprite
from PIL import Image
# numpy: Thao tác ma trận kênh alpha để quét bounding box và điểm neo
import numpy as np

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class SpriteNormalizer:
    """
    Thuật toán chuẩn hóa Sprite Pixel Art:
    - Cắt tỉa vùng trong suốt thừa (Trim Transparency).
    - Căn chỉnh điểm neo linh hoạt (Bottom-Center, Center, Top-Left).
    - Hỗ trợ căn chỉnh theo mốc chân tiếp đất sinh học (Ground Y) do AI phát hiện,
      tránh tình trạng nhân vật bị lơ lửng do bóng đổ sàn (Shadow).
    - Chuẩn hóa kích thước khung hình đồng bộ (Uniform Frame Sizing / Canvas Padding).
    """

    def __init__(self, target_width: int = 64, target_height: int = 64, anchor: str = "bottom_center"):
        """
        Khởi tạo bộ chuẩn hóa Sprite.

        @param {int} target_width Chiều rộng khung hình mục tiêu.
        @param {int} target_height Chiều cao khung hình mục tiêu.
        @param {str} anchor Điểm neo căn chỉnh ("bottom_center", "center", "top_left").
        """
        self.target_width = target_width
        self.target_height = target_height
        self.anchor = anchor

    def get_bounding_box(self, image: Image.Image) -> Optional[Tuple[int, int, int, int]]:
        """
        Tìm hộp bao (Bounding Box) nhỏ nhất của sprite, loại trừ các pixel trong suốt (Alpha = 0).

        @param {Image.Image} image Ảnh sprite gốc.
        @returns {Optional[Tuple[int, int, int, int]]} Tọa độ (xmin, ymin, xmax, ymax) hoặc None nếu ảnh rỗng.
        """
        if image.mode != "RGBA":
            image = image.convert("RGBA")
        
        np_img = np.array(image)
        alpha = np_img[:, :, 3]
        non_empty = np.where(alpha > 0)
        
        if len(non_empty[0]) == 0 or len(non_empty[1]) == 0:
            return None
        
        ymin, ymax = int(np.min(non_empty[0])), int(np.max(non_empty[0]))
        xmin, xmax = int(np.min(non_empty[1])), int(np.max(non_empty[1]))
        return (xmin, ymin, xmax + 1, ymax + 1)

    def trim(self, image: Image.Image) -> Image.Image:
        """
        Cắt bỏ phần trong suốt thừa bao quanh sprite để lấy vùng nhân vật thực tế.

        @param {Image.Image} image Ảnh sprite gốc.
        @returns {Image.Image} Ảnh đã được cắt sát viền.
        """
        bbox = self.get_bounding_box(image)
        if bbox:
            return image.crop(bbox)
        return image

    def normalize_frame(
        self,
        frame: Image.Image,
        target_size: Optional[Tuple[int, int]] = None,
        anchor: Optional[str] = None,
        ground_y: Optional[int] = None
    ) -> Image.Image:
        """
        Chuẩn hóa kích thước 1 frame sprite theo target_size và điểm neo (anchor).
        Hỗ trợ căn chân tiếp xúc mặt đất dựa theo ground_y (loại bỏ độ dời do bóng đổ).

        @param {Image.Image} frame Ảnh khung hình sprite cần chuẩn hóa.
        @param {Optional[Tuple[int, int]]} target_size Kích thước canvas mục tiêu (width, height).
        @param {Optional[str]} anchor Điểm neo ("bottom_center", "center", "top_left").
        @param {Optional[int]} ground_y Tọa độ Y chân tiếp đất trên ảnh gốc (nếu có từ AI).
        @returns {Image.Image} Ảnh canvas mới đã căn chỉnh chuẩn xác.
        """
        tw, th = target_size or (self.target_width, self.target_height)
        cur_anchor = anchor or self.anchor

        bbox = self.get_bounding_box(frame)
        if not bbox:
            return Image.new("RGBA", (tw, th), (0, 0, 0, 0))

        xmin, ymin, xmax, ymax = bbox
        trimmed = frame.crop(bbox)
        fw, fh = trimmed.size

        # Tính tỷ lệ thu phóng vừa vặn khung hình canvas mục tiêu
        scale = min(tw / fw, th / fh) if (fw > tw or fh > th) else 1.0
        if scale != 1.0:
            new_w = max(1, int(round(fw * scale)))
            new_h = max(1, int(round(fh * scale)))
            trimmed = trimmed.resize((new_w, new_h), Image.Resampling.NEAREST)
            fw, fh = trimmed.size

        canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))

        # Tính toán tọa độ dán ảnh dựa theo điểm neo (Anchor)
        if cur_anchor == "bottom_center":
            pos_x = (tw - fw) // 2
            if ground_y is not None:
                # Căn chân chạm đất sinh học sát đáy canvas (loại bỏ độ lơ lửng của bóng)
                feet_rel_y = (ground_y - ymin) * scale
                pos_y = int(round(th - 1 - feet_rel_y))
            else:
                pos_y = th - fh
        elif cur_anchor == "center":
            pos_x = (tw - fw) // 2
            pos_y = (th - fh) // 2
        elif cur_anchor == "top_left":
            pos_x = 0
            pos_y = 0
        else:
            pos_x = (tw - fw) // 2
            pos_y = (th - fh) // 2

        canvas.paste(trimmed, (pos_x, pos_y), trimmed)
        return canvas
