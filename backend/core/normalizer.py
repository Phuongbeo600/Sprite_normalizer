"""
Thuật toán chuẩn hóa Sprite (Port từ MVC cũ).

Cung cấp các tác vụ:
- Cắt biên trong suốt (Trim transparency / Bounding box)
- Căn chỉnh điểm neo (Anchor alignment: center, bottom-center, etc.)
- Chuẩn hóa kích thước khung hình (Uniform frame sizing / Padding)
- Tách và ghép sprite sheet
"""

from typing import Tuple, Optional
from PIL import Image
import numpy as np


class SpriteNormalizer:
    def __init__(self, target_width: int = 64, target_height: int = 64, anchor: str = "bottom_center"):
        self.target_width = target_width
        self.target_height = target_height
        self.anchor = anchor

    def get_bounding_box(self, image: Image.Image) -> Optional[Tuple[int, int, int, int]]:
        """
        Tìm bounding box của sprite loại trừ các pixel trong suốt (Alpha = 0).
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
        Cắt bỏ phần trong suốt thừa quanh sprite.
        """
        bbox = self.get_bounding_box(image)
        if bbox:
            return image.crop(bbox)
        return image

    def normalize_frame(
        self,
        frame: Image.Image,
        target_size: Optional[Tuple[int, int]] = None,
        anchor: Optional[str] = None
    ) -> Image.Image:
        """
        Chuẩn hóa kích thước 1 frame sprite theo target_size và điểm neo (anchor).
        """
        tw, th = target_size or (self.target_width, self.target_height)
        cur_anchor = anchor or self.anchor

        trimmed = self.trim(frame)
        fw, fh = trimmed.size

        # Giữ tỉ lệ hoặc fit vừa vào khung target
        scale = min(tw / fw, th / fh) if (fw > tw or fh > th) else 1.0
        if scale != 1.0:
            new_w = max(1, int(fw * scale))
            new_h = max(1, int(fh * scale))
            trimmed = trimmed.resize((new_w, new_h), Image.Resampling.NEAREST)
            fw, fh = trimmed.size

        canvas = Image.new("RGBA", (tw, th), (0, 0, 0, 0))

        # Tính toán tọa độ paste dựa theo anchor
        if cur_anchor == "bottom_center":
            pos_x = (tw - fw) // 2
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
