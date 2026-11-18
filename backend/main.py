"""
Module: backend.main
Mục đích: Điểm khởi nhập (Entry Point) của máy chủ FastAPI backend.
Ai gọi nó: Máy chủ ASGI Uvicorn (hoặc lệnh khởi chạy `uvicorn backend.main:app`).
Tại sao tồn tại: Thiết lập cấu hình ứng dụng web, kích hoạt tự động cập nhật schema CSDL MySQL khi khởi động, mở chính sách CORS cho frontend React kết nối và gắn kết toàn bộ các API Router v1.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo hệ thống & Quản lý vòng đời)
# ========================================================
# asynccontextmanager: Trình quản lý ngữ cảnh bất đồng bộ hỗ trợ vòng đời ứng dụng FastAPI (Lifespan)
from contextlib import asynccontextmanager

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

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Quản lý vòng đời khởi động và tắt của ứng dụng FastAPI (Lifespan Context Manager).
    Khởi tạo và cập nhật cấu trúc cơ sở dữ liệu MySQL khi ứng dụng bắt đầu khởi chạy.
    """
    try:
        init_db()# Khởi tạo và cập nhật cấu trúc cơ sở dữ liệu MySQL khi ứng dụng bắt đầu khởi chạy.
    except Exception as err:
        print(f"[Lifespan] Cảnh báo khởi tạo CSDL: {err}")
    yield


app = FastAPI(
    title="Sprite Normalizer API",
    description="Backend FastAPI hỗ trợ chuẩn hóa Sprite cho Bài Tập Lớn Trí Tuệ Nhân Tạo (UET)",
    version="2.0.0",
    lifespan=lifespan
)

# Cấu hình CORS để frontend React kết nối thuận tiện
app.add_middleware(
    CORSMiddleware,#Cho phép backend và frontend dù hai cổng khác nhau, và chính sách bảo mật nhưng vẫn gửi endponit qua lại được cho nhau
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],# cho phép backend và frontend gửi endpoint qua lại với nhau
    allow_headers=["*"],#Nhãn dán
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
