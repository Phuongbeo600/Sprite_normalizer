"""
========================================================
1. THƯ VIỆN NỀN TẢNG PYTHON (Quản lý tiến trình & hệ thống)
========================================================
"""
import os
import sys
import subprocess
import signal
import time

"""
========================================================
2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
========================================================
(Không sử dụng thư viện ngoài để đảm bảo chạy được ngay lập tức)
"""

"""
========================================================
3. HÀM ĐIỀU PHỐI TIẾN TRÌNH KHỞI CHẠY (Run Script)
========================================================
"""
def start_app():
    """
    Khởi chạy đồng thời cả Backend (FastAPI) và Frontend (Vite + React) chỉ với 1 câu lệnh.
    Tự động quản lý vòng đời và dừng cả 2 tiến trình khi người dùng nhấn Ctrl + C.
    """
    root_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(root_dir, "frontend")

    print("\n" + "=" * 60)
    print("🚀 ĐANG KHỞI ĐỘNG HỆ THỐNG SPRITE NORMALIZER...")
    print("=" * 60)

    # Kiểm tra cờ tham số dòng lệnh hoặc biến môi trường APP_ENV để phân tách chế độ chạy
    is_prod = "--prod" in sys.argv or os.getenv("APP_ENV", "").lower() in ("production", "prod")

    # 1. Khởi động Backend FastAPI trên cổng 8000
    if is_prod:
        workers = os.getenv("UVICORN_WORKERS") or os.getenv("WEB_CONCURRENCY") or "2"
        print(f"[1/2] 🐍 Khởi động Backend FastAPI ở chế độ PRODUCTION ({workers} Workers)...")
        backend_cmd = [
            sys.executable,
            "-m",
            "uvicorn",
            "backend.main:app",
            "--host",
            os.getenv("UVICORN_HOST", "0.0.0.0"),
            "--port",
            os.getenv("UVICORN_PORT", "8000"),
            "--workers",
            str(workers),
            "--limit-concurrency",
            os.getenv("UVICORN_LIMIT_CONCURRENCY", "100"),
            "--timeout-keep-alive",
            os.getenv("UVICORN_TIMEOUT_KEEP_ALIVE", "10"),
            "--timeout-graceful-shutdown",
            os.getenv("UVICORN_TIMEOUT_GRACEFUL_SHUTDOWN", "20"),
        ]
    else:
        print("[1/2] 🐍 Khởi động Backend FastAPI ở chế độ DEVELOPMENT (Auto-Reload)...")
        backend_cmd = [
            sys.executable,
            "-m",
            "uvicorn",
            "backend.main:app",
            "--reload",
            "--host",
            os.getenv("UVICORN_HOST", "127.0.0.1"),
            "--port",
            os.getenv("UVICORN_PORT", "8000"),
        ]

    backend_process = subprocess.Popen(
        backend_cmd,
        cwd=root_dir,
    )

    # 2. Khởi động Frontend React + Vite trên cổng 5173
    print("[2/2] ⚛️  Khởi động Frontend React + Vite (Port 5173)...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_cmd = [npm_cmd, "run", "dev"]
    frontend_process = subprocess.Popen(
        frontend_cmd,
        cwd=frontend_dir,
    )

    time.sleep(1.5)
    print("\n" + "=" * 60)
    print("✨ HỆ THỐNG ĐÃ SẴN SÀNG:")
    print("   🌐 Frontend Web:  http://localhost:5173")
    print("   🔌 Backend API:   http://127.0.0.1:8000")
    print("   📖 Swagger Docs:  http://127.0.0.1:8000/docs")
    print("   (Nhấn Ctrl + C để dừng cả 2 tiến trình)")
    print("=" * 60 + "\n")

    def handle_shutdown(signum=None, frame=None):
        print("\n\n🛑 Đang dừng toàn bộ hệ thống...")
        try:
            if backend_process.poll() is None:
                backend_process.terminate()
            if frontend_process.poll() is None:
                frontend_process.terminate()
        except Exception:
            pass
        print("✅ Đã dừng cả Backend và Frontend an toàn.")
        sys.exit(0)

    # Đăng ký bắt tín hiệu ngắt (Ctrl + C)
    signal.signal(signal.SIGINT, handle_shutdown)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, handle_shutdown)

    # Giữ tiến trình cha chạy để lắng nghe tín hiệu
    try:
        while True:
            # Kiểm tra nếu 1 trong 2 tiến trình bị dừng đột ngột
            if backend_process.poll() is not None:
                print("⚠️ Tiến trình Backend đã dừng.")
                handle_shutdown()
                break
            if frontend_process.poll() is not None:
                print("⚠️ Tiến trình Frontend đã dừng.")
                handle_shutdown()
                break
            time.sleep(1)
    except KeyboardInterrupt:
        handle_shutdown()


if __name__ == "__main__":
    start_app()
