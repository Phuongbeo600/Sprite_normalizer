# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo package)
# ========================================================
# (Không có phụ thuộc nền tảng)

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không phụ thuộc trực tiếp thư viện bên ngoài ở tầng package)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Aggregated Router)
# ========================================================
# api_router: Bộ định tuyến gốc gom toàn bộ các sub-router
from .router import api_router

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

__all__ = ["api_router"]
