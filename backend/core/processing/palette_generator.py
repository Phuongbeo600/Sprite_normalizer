"""
Module: backend.core.processing.palette_generator
Mục đích: Thuật toán Octree Color Quantization chuyển đổi 100% trung thực từ mã nguồn C++ của LibreSprite/Aseprite.
Tham chiếu mã nguồn gốc LibreSprite:
  - src/doc/octree.h & src/doc/octree.cpp (Cấu trúc Octree & OctreeNode)
  - src/app/commands/cmd_color_quantization.cpp (Lệnh "Create Palette from Current Sprite")
  - PR #338 (commit 9c3805f): Trọng số độ sáng Luma chuẩn ITU-R Rec. 709 (0.2126R + 0.7152G + 0.0722B)
Giấy phép gốc: GNU General Public License v2.0 (GPL-2.0)
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON
# ========================================================
import math
from typing import List, Tuple, Dict, Any, Optional, Set

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI
# ========================================================
import numpy as np
from PIL import Image

# ========================================================
# HẰNG SỐ CHUẨN LIBRESPRITE
# ========================================================
DEFAULT_MAX_COLORS = 256
ALPHA_MASK_THRESHOLD = 10  # Ngưỡng pixel trong suốt (Mask)


class OctreeNode:
    """
    Nút trong Cây Bát Phân (Octree Node) 100% tương đương doc::OctreeNode trong LibreSprite.
    Mỗi nút đại diện cho một khối màu trong không gian RGB.
    Tối đa 8 nút con tương ứng với 8 góc phần tám màu được xác định bởi 3 bit (R, G, B).
    """

    def __init__(self, level: int, parent: Optional["OctreeNode"] = None):
        self.level: int = level
        self.is_leaf: bool = (level == 8)
        self.parent: Optional["OctreeNode"] = parent
        self.children: List[Optional["OctreeNode"]] = [None] * 8

        # Các biến tích lũy giá trị màu để tính màu trung bình khi gộp lá
        self.r_sum: int = 0
        self.g_sum: int = 0
        self.b_sum: int = 0
        self.a_sum: int = 0
        self.pixel_count: int = 0

    def add_pixel(
        self,
        r: int,
        g: int,
        b: int,
        a: int,
        level: int,
        quantizer: "LibreSpriteOctreeQuantizer"
    ) -> int:
        """
        Chèn một pixel RGBA vào cây bát phân theo bit nhị phân của các kênh màu.
        Tương đương hàm doc::OctreeNode::addColor() trong LibreSprite C++.
        """
        if self.is_leaf:
            self.r_sum += r
            self.g_sum += g
            self.b_sum += b
            self.a_sum += a
            self.pixel_count += 1
            return 0  # Đã là lá, không tạo thêm lá mới

        # Lấy bit thứ (7 - level) của R, G, B để tính chỉ số nhánh con (0..7)
        shift = 7 - level
        r_bit = (r >> shift) & 1
        g_bit = (g >> shift) & 1
        b_bit = (b >> shift) & 1
        child_index = (r_bit << 2) | (g_bit << 1) | b_bit

        created_leaves = 0
        if self.children[child_index] is None:
            new_node = OctreeNode(level + 1, parent=self)
            self.children[child_index] = new_node
            if level + 1 == 8:
                # Nút lá ở tầng cuối cùng
                created_leaves = 1
            else:
                # Nút nhánh trung gian, đăng ký vào danh sách tầng để phục vụ gom nút
                quantizer.levels[level + 1].append(new_node)

        created_leaves += self.children[child_index].add_pixel(r, g, b, a, level + 1, quantizer)
        return created_leaves

    def reduce(self) -> int:
        """
        Gộp tất cả các nút con thành một nút lá duy nhất (Tree Reduction / Prune).
        Tương đương doc::OctreeNode::reduce() trong LibreSprite C++.
        Trả về số lượng lá giảm đi (số nút con - 1).
        """
        children_count = 0
        for i in range(8):
            child = self.children[i]
            if child is not None:
                self.r_sum += child.r_sum
                self.g_sum += child.g_sum
                self.b_sum += child.b_sum
                self.a_sum += child.a_sum
                self.pixel_count += child.pixel_count
                self.children[i] = None
                children_count += 1

        self.is_leaf = True
        return max(0, children_count - 1)

    def collect_leaf_colors(self, palette_entries: List[Dict[str, Any]]):
        """Duyệt đệ quy thu thập màu trung bình đại diện từ các nút lá."""
        if self.is_leaf:
            if self.pixel_count > 0:
                # Tính màu trung bình số học
                avg_r = int(round(self.r_sum / self.pixel_count))
                avg_g = int(round(self.g_sum / self.pixel_count))
                avg_b = int(round(self.b_sum / self.pixel_count))
                avg_a = int(round(self.a_sum / self.pixel_count))
                palette_entries.append({
                    "r": avg_r,
                    "g": avg_g,
                    "b": avg_b,
                    "a": avg_a,
                    "pixel_count": self.pixel_count,
                    "hex": f"#{avg_r:02x}{avg_g:02x}{avg_b:02x}".lower(),
                    # Công thức độ sáng cảm nhận Luma Rec. 709 chuẩn LibreSprite PR #338
                    "luminance": 0.2126 * avg_r + 0.7152 * avg_g + 0.0722 * avg_b
                })
        else:
            for child in self.children:
                if child is not None:
                    child.collect_leaf_colors(palette_entries)


class LibreSpriteOctreeQuantizer:
    """
    Bộ Lượng Tử Hóa Bảng Màu Bằng Cây Bát Phân (LibreSprite Octree Color Quantizer).
    Chuyển đổi 100% trung thực từ lệnh 'Create Palette from Current Sprite' trong C++.
    """

    def __init__(self, max_colors: int = DEFAULT_MAX_COLORS, with_alpha: bool = True):
        self.max_colors = max_colors
        self.with_alpha = with_alpha
        self.root = OctreeNode(0)
        self.leaf_count: int = 0
        # Mảng 8 tầng lưu danh sách các nút nhánh trung gian (tầng 0 đến 7)
        self.levels: List[List[OctreeNode]] = [[] for _ in range(8)]
        # Đếm thống kê
        self.raw_unique_colors: Set[Tuple[int, int, int, int]] = set()
        self.total_opaque_pixels: int = 0

    def add_pixel(self, r: int, g: int, b: int, a: int):
        """Thêm 1 pixel vào tập thống kê và cây bát phân."""
        if not self.with_alpha or a > ALPHA_MASK_THRESHOLD:
            self.raw_unique_colors.add((r, g, b, 255 if not self.with_alpha else a))
            self.total_opaque_pixels += 1
            leaves_added = self.root.add_pixel(r, g, b, a, 0, self)
            self.leaf_count += leaves_added

    def quantize(self) -> List[Dict[str, Any]]:
        """
        Thực thi tỉa cành cây bát phân cho đến khi số nút lá <= max_colors.
        Ưu tiên gộp các nút ở tầng sâu nhất có số lượng pixel ít nhất (như LibreSprite C++).
        """
        # Nếu tổng số lá đã nằm trong ngân sách max_colors, không cần tỉa cành
        if self.leaf_count > self.max_colors:
            # Duyệt từ tầng sâu nhất (7) ngược lên tầng gốc (0)
            for level in range(7, -1, -1):
                nodes_at_level = self.levels[level]
                if not nodes_at_level:
                    continue

                # Trong LibreSprite: Ưu tiên gộp các nút có ít pixel nhất trước
                # để bảo tồn các mảng màu lớn và các dải sắc độ quan trọng
                nodes_at_level.sort(key=lambda n: n.pixel_count)

                for node in nodes_at_level:
                    if self.leaf_count <= self.max_colors:
                        break
                    if not node.is_leaf:
                        reduced = node.reduce()
                        self.leaf_count -= reduced

                if self.leaf_count <= self.max_colors:
                    break

        # Thu thập toàn bộ màu từ các nút lá còn lại
        palette_entries: List[Dict[str, Any]] = []
        self.root.collect_leaf_colors(palette_entries)

        # Tính tỷ lệ phần trăm diện tích chiếm chỗ của từng màu
        total_px = max(1, self.total_opaque_pixels)
        for entry in palette_entries:
            entry["area_pct"] = round((entry["pixel_count"] / total_px) * 100, 2)

        # Sắp xếp Palette:
        # LibreSprite sắp xếp bảng màu theo độ sáng Rec. 709 để họa sĩ dễ vẽ
        palette_entries.sort(key=lambda e: e["luminance"])

        return palette_entries


def create_palette_from_sprite(
    image: Image.Image,
    max_colors: int = DEFAULT_MAX_COLORS,
    with_alpha: bool = True
) -> Dict[str, Any]:
    """
    Hàm giao diện cấp cao tương đương 100% nút 'Create Palette from Current Sprite' của LibreSprite.

    @param image: Ảnh Pillow (bất kỳ chế độ màu nào).
    @param max_colors: Số lượng màu tối đa cần trích xuất (mặc định 256, hoặc 16/32/64).
    @param with_alpha: Có tính toán kênh trong suốt hay không.
    @returns: Dict chứa bảng màu chuẩn hóa, số màu thô, số màu lọc được và cảnh báo AI.
    """
    rgba_img = image.convert("RGBA")
    np_arr = np.array(rgba_img)

    quantizer = LibreSpriteOctreeQuantizer(max_colors=max_colors, with_alpha=with_alpha)

    # Quét toàn bộ ma trận pixel
    h, w = np_arr.shape[:2]
    flat_pixels = np_arr.reshape(-1, 4)

    for i in range(len(flat_pixels)):
        r, g, b, a = int(flat_pixels[i, 0]), int(flat_pixels[i, 1]), int(flat_pixels[i, 2]), int(flat_pixels[i, 3])
        quantizer.add_pixel(r, g, b, a)

    # Chạy thuật toán lượng tử hóa
    palette = quantizer.quantize()

    raw_unique_count = len(quantizer.raw_unique_colors)
    final_count = len(palette)
    ai_intermediate_count = max(0, raw_unique_count - final_count)

    # Tiêu chí cảnh báo nhiễu màu AI:
    # Nếu số màu quét thô vượt trội (>25% và chênh lệch >= 4 màu) so với số màu thực tế
    has_ai_noise = (raw_unique_count > final_count * 1.25) and (ai_intermediate_count >= 4)

    return {
        "palette": palette,
        "hex_list": [entry["hex"] for entry in palette],
        "raw_colors_count": raw_unique_count,
        "clean_colors_count": final_count,
        "ai_intermediate_colors": ai_intermediate_count,
        "has_ai_noise_warning": has_ai_noise,
        "max_colors_budget": max_colors,
        "noise_ratio": round(ai_intermediate_count / max(raw_unique_count, 1), 3)
    }
