# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa danh sách và kiểu tùy chọn
from typing import List, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# pydantic: Kiểm tra tính hợp lệ dữ liệu yêu cầu và phản hồi dịch thuật
from pydantic import BaseModel, Field

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class TranslationRequest(BaseModel):
    """Schema yêu cầu dịch văn bản đơn lẻ (EN ⇄ VI)."""
    text: str = Field(..., description="Văn bản cần dịch")
    source_lang: str = Field("en", description="Ngôn ngữ nguồn ('en' hoặc 'vi')")
    target_lang: str = Field("vi", description="Ngôn ngữ đích ('vi' hoặc 'en')")


class BatchTranslationRequest(BaseModel):
    """Schema yêu cầu dịch đồng loạt mảng văn bản (ví dụ: mảng 5 frame hoạt họa)."""
    texts: List[str] = Field(..., description="Danh sách các đoạn văn bản cần dịch")
    source_lang: str = Field("en", description="Ngôn ngữ nguồn ('en' hoặc 'vi')")
    target_lang: str = Field("vi", description="Ngôn ngữ đích ('vi' hoặc 'en')")


class TranslationResponse(BaseModel):
    """Schema phản hồi kết quả dịch đơn lẻ."""
    status: str = Field("success", description="Trạng thái thực thi")
    translated_text: str = Field(..., description="Văn bản sau khi đã dịch")
    source_lang: str = Field(..., description="Ngôn ngữ nguồn")
    target_lang: str = Field(..., description="Ngôn ngữ đích")


class BatchTranslationResponse(BaseModel):
    """Schema phản hồi kết quả dịch đồng loạt mảng văn bản."""
    status: str = Field("success", description="Trạng thái thực thi")
    translated_texts: List[str] = Field(default_factory=list, description="Danh sách các đoạn văn bản sau khi dịch")
    source_lang: str = Field(..., description="Ngôn ngữ nguồn")
    target_lang: str = Field(..., description="Ngôn ngữ đích")
