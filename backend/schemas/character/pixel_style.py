# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc, Liệt kê & Kiểu)
# ========================================================
# enum: Định nghĩa các kiểu liệt kê chuỗi chuẩn (String Enum) cho danh mục kiểm soát
from enum import Enum
# typing: Định nghĩa các kiểu danh sách, chuỗi, số nguyên và tùy chọn
from typing import List, Optional, Union

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Định nghĩa Schema kiểm tra tính hợp lệ dữ liệu và trình kiểm tra trường dữ liệu
from pydantic import BaseModel, Field, field_validator

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class PixelArtEra(str, Enum):
    """
    Phân loại kỷ nguyên và phong cách đồ họa Pixel Art kinh điển.
    Kế thừa str để tương thích tuần tự hóa JSON và OpenAI Structured Outputs.
    """
    RETRO_8BIT = "8-bit NES / Game Boy"
    CLASSIC_16BIT = "16-bit SNES / GBA Classic Pixel Art"
    ARCADE_32BIT = "32-bit Neo-Geo / Arcade"
    MODERN_INDIE = "Modern Indie Pixel Art"
    MINIMALIST = "Minimalist / Micro Pixel Art"


class OutlineStyle(str, Enum):
    """
    Quy chuẩn kỹ thuật đường viền nhân vật Pixel Art.
    """
    BLACK_OUTLINE = "Black Outline"
    SELECTIVE_OUTLINE = "Selective Outline (Selout)"
    COLORED_OUTLINE = "Colored Outline"
    NO_OUTLINE = "No Outline"
    SEMI_TRANSPARENT = "Semi-Transparent Outline"


class ShadingStyle(str, Enum):
    """
    Quy chuẩn phong cách đổ bóng mảng pixel.
    """
    CEL_SHADING = "Cel-shading"
    SOFT_RAMP = "Soft Ramp"
    FLAT = "Flat Shading"
    DITHERED = "Dithered Shading"
    PILLOW_SHADING = "Pillow Shading"


class DitheringStyle(str, Enum):
    """
    Kỹ thuật hòa trộn hạt pixel (Dithering) nếu có sử dụng.
    """
    NONE = "None"
    CHECKERBOARD = "Checkerboard Pattern"
    LINE_DITHER = "Line Dithering"
    CLUSTER_DITHER = "Cluster Dithering"
    RANDOM_NOISE = "Random Noise Dithering"


class PixelClusterStyle(str, Enum):
    """
    Đặc trưng cấu trúc tổ chức các cụm pixel (Pixel Clustering).
    """
    CHUNKY_CLUSTERS = "Chunky Readable Clusters"
    MICRO_CLUSTERS = "Micro Clusters"
    CONTINUOUS_STROKES = "Continuous Strokes"
    ISOLATED_PIXELS = "Isolated Pixels"


class DetailDensity(str, Enum):
    """
    Mức độ dày đặc của chi tiết đồ họa trên bề mặt sprite.
    """
    MINIMALIST = "Minimalist"
    MODERATE = "Moderate"
    HIGH_DENSITY = "High Density"


class PixelCleanliness(str, Enum):
    """
    Độ sắc nét và tính kỷ luật trong cách đặt hạt pixel.
    """
    VERY_CLEAN = "Very Clean (No Stray Pixels)"
    HAND_CRAFTED = "Hand-Crafted"
    NOISY = "Noisy / Raw"


class LightingDirection(str, Enum):
    """
    Hướng chiếu sáng chủ đạo trong phối cảnh sprite.
    """
    TOP_LEFT = "Top-Left (45 degrees)"
    TOP_RIGHT = "Top-Right (45 degrees)"
    TOP_DOWN = "Top-Down (90 degrees)"
    FRONTAL = "Frontal"
    AMBIENT = "Ambient / Multi-directional"


class PixelStyleAnalysis(BaseModel):
    """
    Phân tích phong cách mỹ thuật Pixel Art (Pixel Style Analysis).
    Mô tả định tính về mặt thẩm mỹ pixel, kỹ thuật viền (outlines), cách thức phân mảng sáng tối (shading),
    cụm hạt pixel (pixel clustering) và hướng nguồn sáng chủ đạo.
    
    LƯU Ý THIẾT KẾ:
    Không yêu cầu AI tự đếm chính xác số màu trong palette, đo bề dày viền theo pixel hay trích xuất mã màu HEX.
    Những thông số định lượng này do các thuật toán xử lý ảnh Python thực hiện độc lập.
    """

    art_style: Union[PixelArtEra, str] = Field(
        default=PixelArtEra.CLASSIC_16BIT,
        description="Mô tả phong cách mỹ thuật tổng thể (ví dụ: Retro 8-bit NES, 16-bit SNES/GBA JRPG cổ điển, 32-bit Arcade Neo-Geo, Hiện đại/Modern indie pixel art)"
    )

    outline_style: Union[OutlineStyle, str] = Field(
        default=OutlineStyle.SELECTIVE_OUTLINE,
        description="Đặc điểm của đường viền bao quanh nhân vật: Black Outline, Selective Outline (Selout), Colored Outline, No Outline, Semi-Transparent Outline"
    )

    shading_style: Union[ShadingStyle, str] = Field(
        default=ShadingStyle.CEL_SHADING,
        description="Phong cách đổ bóng chủ đạo: Cel-shading, Soft Ramp, Flat Shading, Dithered Shading, Pillow Shading"
    )

    shading_levels: Optional[int] = Field(
        default=None,
        description="Số lượng mức độ sáng/tối đổ bóng ước lượng trên mỗi dải màu chính (ví dụ: 2-tone gồm sáng và tối, 3-tone gồm highlight-mid-shadow), hoặc None nếu không xác định được rõ ràng"
    )

    dithering_style: Optional[Union[DitheringStyle, str]] = Field(
        default=None,
        description="Đặc điểm kỹ thuật hòa trộn hạt (Dithering) nếu có: None, Checkerboard Pattern, Line Dithering, Cluster Dithering hoặc null"
    )

    pixel_cluster_style: Union[PixelClusterStyle, str] = Field(
        default=PixelClusterStyle.CHUNKY_CLUSTERS,
        description="Đặc trưng cách thức tổ chức các cụm pixel (Pixel Clustering): Chunky Readable Clusters, Micro Clusters, Continuous Strokes"
    )

    detail_density: Union[DetailDensity, str] = Field(
        default=DetailDensity.MODERATE,
        description="Mức độ dày đặc của các chi tiết nhỏ: Minimalist, Moderate, High Density"
    )

    pixel_cleanliness: Union[PixelCleanliness, str] = Field(
        default=PixelCleanliness.VERY_CLEAN,
        description="Độ sắc nét và tính kỷ luật trong cách đặt hạt pixel: Very Clean (No Stray Pixels), Hand-Crafted, Noisy / Raw"
    )

    lighting_direction: Optional[Union[LightingDirection, str]] = Field(
        default=None,
        description="Hướng chiếu sáng chính: Top-Left (45 degrees), Top-Right (45 degrees), Top-Down (90 degrees), Frontal, Ambient hoặc null"
    )

    visual_artifacts: List[str] = Field(
        default_factory=list,
        description="Các lỗi hoặc dấu hiệu bất thường quan sát thấy trong cấu trúc pixel art (ví dụ: Stray pixel, Double outline, Jaggies, Nhòe JPG)"
    )

    # ========================================================
    # BỘ CHUẨN HÓA DỮ LIỆU TỰ ĐỘNG (Field Validators)
    # ========================================================
    @field_validator("outline_style", mode="before")
    @classmethod
    def normalize_outline_style(cls, v):
        """Tự động ánh xạ chuỗi tự do sang Enum OutlineStyle chuẩn nếu khớp từ khóa."""
        if isinstance(v, str):
            clean = v.lower()
            if "selout" in clean or "selective" in clean:
                return OutlineStyle.SELECTIVE_OUTLINE
            if "black" in clean:
                return OutlineStyle.BLACK_OUTLINE
            if "color" in clean:
                return OutlineStyle.COLORED_OUTLINE
            if "no outline" in clean or clean == "none":
                return OutlineStyle.NO_OUTLINE
            if "semi" in clean or "transparen" in clean:
                return OutlineStyle.SEMI_TRANSPARENT
        return v

    @field_validator("shading_style", mode="before")
    @classmethod
    def normalize_shading_style(cls, v):
        """Tự động ánh xạ chuỗi tự do sang Enum ShadingStyle chuẩn nếu khớp từ khóa."""
        if isinstance(v, str):
            clean = v.lower()
            if "cel" in clean:
                return ShadingStyle.CEL_SHADING
            if "soft" in clean or "ramp" in clean:
                return ShadingStyle.SOFT_RAMP
            if "flat" in clean:
                return ShadingStyle.FLAT
            if "dither" in clean:
                return ShadingStyle.DITHERED
            if "pillow" in clean:
                return ShadingStyle.PILLOW_SHADING
        return v

    @field_validator("lighting_direction", mode="before")
    @classmethod
    def normalize_lighting(cls, v):
        """Tự động ánh xạ chuỗi hướng sáng sang Enum LightingDirection chuẩn."""
        if isinstance(v, str):
            clean = v.lower()
            if "top-left" in clean or "top left" in clean:
                return LightingDirection.TOP_LEFT
            if "top-right" in clean or "top right" in clean:
                return LightingDirection.TOP_RIGHT
            if "top-down" in clean or "top down" in clean:
                return LightingDirection.TOP_DOWN
            if "front" in clean:
                return LightingDirection.FRONTAL
            if "ambient" in clean:
                return LightingDirection.AMBIENT
        return v
