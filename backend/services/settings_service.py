# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểu dữ liệu)
# ========================================================
# typing: Định nghĩa kiểu chuỗi tùy chọn
from typing import Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (AI Providers)
# ========================================================
# (Không phụ thuộc nội bộ sau khi bỏ luồng cài đặt API Key toàn cục cũ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class SettingsService:
    """
    Dịch vụ tiện ích cho cấu hình hệ thống.
    Giữ lại hàm che dấu API Key dùng chung cho `ImageGenService`.
    """

    @staticmethod
    def mask_api_key(key: Optional[str]) -> str:
        """
        Che dấu chuỗi khóa API bảo vệ hiển thị trên giao diện (ví dụ: AIza...89AB).

        @param {Optional[str]} key Chuỗi khóa API gốc.
        @returns {str} Chuỗi đã che dấu hoặc chuỗi rỗng.
        """
        if not key or len(key.strip()) < 8:
            return ""
        k = key.strip()
        return f"{k[:4]}...{k[-4:]}"
