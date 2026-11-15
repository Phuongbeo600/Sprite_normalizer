# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Kiểu)
# ========================================================
# typing: Khai báo kiểu trả về Tuple
from typing import Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# numpy: Thao tác ma trận kênh pixel RGBA để tách nền nhanh chóng
import numpy as np
# PIL (Pillow): Mở và chuyển đổi chế độ màu của hình ảnh
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class BackgroundMaskExtractor:
    """
    Bộ bóc tách mặt nạ điểm ảnh (Alpha Mask Extractor).
    - Tự động phát hiện ảnh có kênh Alpha trong suốt hay ảnh nền đặc (do AI Midjourney/DALL-E sinh ra).
    - Khử màu nền đơn sắc dựa trên thuật toán khoảng cách màu Euclidean lấy mẫu từ 4 góc ảnh.
    """

    @staticmethod
    def extract_mask(
        image: Image.Image,
        auto_remove_solid_bg: bool = True,
        bg_tolerance: int = 25
    ) -> Tuple[np.ndarray, Image.Image]:
        """
        Trích xuất mặt nạ boolean (True: pixel nhân vật, False: pixel nền) và ảnh RGBA đã làm sạch.

        @param {Image.Image} image Ảnh sprite gốc.
        @param {bool} auto_remove_solid_bg Tự động xóa nền màu đơn sắc nếu không có alpha.
        @param {int} bg_tolerance Ngưỡng sai số màu khi khử nền.
        @returns {Tuple[np.ndarray, Image.Image]} Mask nhị phân và ảnh RGBA đã xử lý alpha.
        """
        img_rgba = image.convert("RGBA")
        arr = np.array(img_rgba)
        alpha = arr[:, :, 3]

        # Kiểm tra xem ảnh đã có sẵn kênh alpha trong suốt thực sự hay không
        has_transparency = np.any(alpha < 240)
        if has_transparency:
            mask = alpha > 25
            return mask, img_rgba

        # Nếu không có alpha (thường là ảnh nền đặc do AI sinh ra)
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

            # Cập nhật lại kênh alpha trong suốt cho ảnh
            new_alpha = np.where(mask, 255, 0).astype(np.uint8)
            arr[:, :, 3] = new_alpha
            processed_img = Image.fromarray(arr, "RGBA")
            return mask, processed_img

        return (alpha > 0), img_rgba
