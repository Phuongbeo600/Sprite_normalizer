"""
Module: backend.main
Mục đích: Điểm khởi nhập (Entry Point) của máy chủ FastAPI backend.
Ai gọi nó: Máy chủ ASGI Uvicorn (hoặc lệnh khởi chạy `uvicorn backend.main:app`).
Tại sao tồn tại: Thiết lập cấu hình ứng dụng web, kích hoạt tự động cập nhật schema CSDL MySQL khi khởi động, mở chính sách CORS cho frontend React kết nối và gắn kết toàn bộ các API Router v1.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo hệ thống & Quản lý vòng đời)
# ========================================================
# os: Đọc biến môi trường hệ thống xác định chế độ chạy (Development / Production)
import os
# sys: Quản lý đối số dòng lệnh và thông tin hệ điều hành
import sys
# asynccontextmanager: Trình quản lý ngữ cảnh bất đồng bộ hỗ trợ vòng đời ứng dụng FastAPI (Lifespan)
from contextlib import asynccontextmanager
from pathlib import Path

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# fastapi: Framework web API hiệu năng cao
from fastapi import FastAPI
# CORSMiddleware: Cấu hình cho phép kết nối chéo nguồn giữa React và FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (API Routers & CSDL)
# ========================================================
# api_router: Bộ định tuyến chính gom các sub-router v1
from backend.api import api_router
# init_db: Hàm tự động khởi tạo và cập nhật bảng CSDL MySQL
from backend.db import SessionLocal, init_db
# OfflineChatRepository: Khôi phục các tin nhắn kẹt trạng thái `generating` sau khi khởi động lại server
from backend.repositories.offline_chat_repository import OfflineChatRepository
# LocalPromptEnhancerService: Tự động dọn dẹp tiến trình llama-server cục bộ khi tắt máy chủ
# AiRuntimeManager: Giải phóng an toàn các mô hình RAG Offline (Qwen3.5-4B, BGE-M3) khi tắt máy chủ
# Manager hiện quản lý cả Hunyuan, chỉ cần một lần dọn toàn bộ tiến trình.
from backend.services.ai_runtime_manager import AiRuntimeManager

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Quản lý vòng đời khởi động và tắt của ứng dụng FastAPI (Lifespan Context Manager).
    Khởi tạo và cập nhật cấu trúc cơ sở dữ liệu MySQL khi ứng dụng bắt đầu khởi chạy,
    đồng thời dọn dẹp tiến trình AI Local (nếu đang bật) khi tắt máy chủ.
    """
    try:
        init_db()# Khởi tạo và cập nhật cấu trúc cơ sở dữ liệu MySQL khi ứng dụng bắt đầu khởi chạy.
        db = SessionLocal()
        try:
            OfflineChatRepository().recover_orphan_generating_messages(db)
        finally:
            db.close()
    except Exception as err:
        print(f"[Lifespan] Cảnh báo khởi tạo CSDL: {err}")
    try:
        yield
    finally:
        try:
            AiRuntimeManager.shutdown_all()
        except Exception as err:
            print(f"[Lifespan] Cảnh báo dọn dẹp AI Runtime Manager: {err}")


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


@app.get("/health", tags=["Root"])
async def root():
    """Điểm kết nối kiểm tra gốc của máy chủ."""
    return {
        "message": "Sprite Normalizer API is running",
        "docs": "/docs",
        "version": "2.0.0"
    }


# Phục vụ bản dựng React sau các tuyến API khi chạy trong container.
frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if (frontend_dist / "index.html").is_file():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
else:
    app.add_api_route("/", root, methods=["GET"], include_in_schema=False)


def get_uvicorn_config() -> dict:
    """
    Xác định bộ thông số cấu hình tối ưu cho máy chủ ASGI Uvicorn:
    - Phân tách rõ ràng giữa môi trường Development (Đơn tiến trình, reload=True)
      và Production (Đa tiến trình Multi-Worker, reload=False, kiểm soát kết nối).
    - Hỗ trợ cấu hình số lượng Worker linh hoạt thông qua biến môi trường UVICORN_WORKERS hoặc WEB_CONCURRENCY.
    - Tích hợp các tham số bảo vệ chống cạn kiệt tài nguyên: limit_concurrency, timeout_keep_alive, timeout_graceful_shutdown.
    
    @returns {dict} Từ điển chứa các đối số truyền vào uvicorn.run().
    """
    app_env = os.getenv("APP_ENV", "development").lower().strip()
    is_prod = app_env in ("production", "prod")

    # Cấu hình địa chỉ mạng và cổng lắng nghe
    host = os.getenv("UVICORN_HOST", "0.0.0.0" if is_prod else "127.0.0.1")
    port = int(os.getenv("UVICORN_PORT", "8000"))

    if is_prod:
        # Số Worker tối ưu: Mặc định 2 workers (đảm bảo an toàn RAM khi nạp mô hình dịch thuật và trần kết nối MySQL)
        workers_env = os.getenv("UVICORN_WORKERS") or os.getenv("WEB_CONCURRENCY")
        workers = int(workers_env) if workers_env else 2

        # Các thông số bảo vệ quá tải và kết nối bền vững
        limit_concurrency = int(os.getenv("UVICORN_LIMIT_CONCURRENCY", "100"))
        timeout_keep_alive = int(os.getenv("UVICORN_TIMEOUT_KEEP_ALIVE", "10"))
        timeout_graceful_shutdown = int(os.getenv("UVICORN_TIMEOUT_GRACEFUL_SHUTDOWN", "20"))

        return {
            "app": "backend.main:app",
            "host": host,
            "port": port,
            "workers": workers,
            "reload": False,
            "limit_concurrency": limit_concurrency,
            "timeout_keep_alive": timeout_keep_alive,
            "timeout_graceful_shutdown": timeout_graceful_shutdown,
        }
    else:
        # Môi trường Development: Đơn Worker và tự động tải lại mã nguồn khi chỉnh sửa
        return {
            "app": "backend.main:app",
            "host": host,
            "port": port,
            "workers": 1,
            "reload": True,
        }


if __name__ == "__main__":
    import uvicorn
    cfg = get_uvicorn_config()
    mode_name = "Production (Multi-Worker)" if not cfg.get("reload") else "Development (Auto-Reload)"
    print(f"\n[Uvicorn Boot] Chế độ vận hành: {mode_name}")
    print(f"[Uvicorn Boot] Địa chỉ: {cfg['host']}:{cfg['port']} | Workers: {cfg.get('workers', 1)}\n")
    uvicorn.run(**cfg)
