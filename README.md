# Sprite Normalizer

Công cụ xử lý và chuẩn hóa Sprite cho Game & Bài Tập Lớn AI (UET).

## 🚀 1. Khởi chạy toàn bộ hệ thống (1 câu lệnh)

Từ thư mục gốc dự án, bạn chỉ cần chạy **MỘT** trong các lệnh sau:

### Cách 1: Bằng Python (Khuyên dùng)
```bash
python run.py
```

### Cách 2: Bằng file chạy nhanh Windows (1-click)
```bash
.\run.bat
```
*(hoặc nhấp đúp chuột vào file `run.bat`)*

### Cách 3: Bằng npm
```bash
npm run dev
```

> Hệ thống sẽ tự động khởi động đồng thời cả:
> - **Frontend (React + Vite):** [http://localhost:5173](http://localhost:5173)
> - **Backend (FastAPI):** [http://127.0.0.1:8000](http://127.0.0.1:8000)
> - **Swagger API Docs:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
>
> *(Nhấn `Ctrl + C` trên terminal để tắt đồng thời cả 2 server)*

---

## 2. Cấu trúc thư mục
- `frontend/`: Giao diện React (Vite)
  - `src/components/`: Sidebar, Header, ProjectCard, PixelArtIcons, FantasyBackground
  - `src/pages/`: Projects (danh sách), Workspace (chuẩn hóa sprite), Settings (cài đặt)
- `backend/`: Máy chủ xử lý Python
  - `core/`: Chứa thuật toán chuẩn hóa sprite (từ MVC cũ)
  - `api/`: Các API endpoint giao tiếp với frontend
