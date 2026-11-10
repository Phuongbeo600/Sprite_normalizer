# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo hệ thống)
# ========================================================
# (Không có phụ thuộc nền tảng)

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# fastapi: Framework web API hiệu năng cao
from fastapi import FastAPI
# CORSMiddleware: Cấu hình cho phép kết nối chéo nguồn giữa React và FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (API Routers & CSDL)
# ========================================================
# api_router: Bộ định tuyến chính gom các sub-router v1
from backend.api import api_router
# init_db: Hàm tự động khởi tạo và cập nhật bảng CSDL MySQL
from backend.db import init_db

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

app = FastAPI(
    title="Sprite Normalizer API",
    description="Backend FastAPI hỗ trợ chuẩn hóa Sprite cho Bài Tập Lớn Trí Tuệ Nhân Tạo (UET)",
    version="2.0.0"
)

# Tự động cập nhật bảng CSDL MySQL khi máy chủ khởi động
@app.on_event("startup")
def on_startup():
    """Khởi động và cập nhật cấu trúc cơ sở dữ liệu."""
    init_db()

# Cấu hình CORS để frontend React kết nối thuận tiện
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký các router từ api/
app.include_router(api_router)


@app.get("/", tags=["Root"])
async def root():
    """Điểm kết nối kiểm tra gốc của máy chủ."""
    return {
        "message": "Sprite Normalizer API is running",
        "docs": "/docs",
        "version": "2.0.0"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
