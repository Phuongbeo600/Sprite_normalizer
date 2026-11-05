# Sprite Normalizer

Hệ thống xử lý và chuẩn hóa kích thước/điểm neo (anchor) cho Sprite Sheet và Animation Frames phục vụ Game Development & Bài Tập Lớn Trí Tuệ Nhân Tạo (UET).

## 📁 Cấu trúc thư mục dự án

```text
frontend/                 # Giao diện người dùng (React + Vite)
├── src/
│   ├── components/
│   │   ├── Sidebar.jsx   # Menu điều hướng chính
│   │   ├── ProjectCard.jsx # Thẻ hiển thị thông tin dự án sprite
│   │   └── Header.jsx    # Thanh tiêu đề trên cùng
│   ├── pages/
│   │   ├── Projects.jsx  # Trang danh sách quản lý dự án
│   │   ├── Workspace.jsx # Không gian làm việc, xem trước & chuẩn hóa sprite
│   │   └── Settings.jsx  # Cài đặt cấu hình thuật toán & hệ thống
│   ├── App.jsx           # Component gốc kết nối bố cục
│   └── index.css         # Toàn bộ CSS & giao diện hiện đại
└── package.json

backend/                  # Máy chủ API (Python + FastAPI)
├── api/                  # Các router / endpoint FastAPI
├── core/                 # Thuật toán cốt lõi (chuyển giao từ mô hình MVC cũ)
└── main.py               # Điểm khởi chạy FastAPI & cấu hình CORS

README.md
```

---

## 🚀 Hướng dẫn cài đặt & Khởi chạy

### 1. Khởi động Backend (FastAPI)

Yêu cầu: **Python 3.10+**

```bash
# Di chuyển tới thư mục gốc hoặc backend
# Cài đặt các thư viện cần thiết
pip install -r backend/requirements.txt

# Khởi chạy máy chủ FastAPI (Reload khi sửa code)
python -m uvicorn backend.main:app --reload --port 8000
```

- API Base URL: `http://127.0.0.1:8000`
- Swagger UI tài liệu API: `http://127.0.0.1:8000/docs`

---

### 2. Khởi động Frontend (React + Vite)

Yêu cầu: **Node.js 18+**

```bash
# Di chuyển vào thư mục frontend
cd frontend

# Cài đặt dependencies
npm install

# Khởi chạy môi trường phát triển (Dev Server)
npm run dev
```

- Giao diện web chạy tại: `http://localhost:5173`
- Vite đã được cấu hình Proxy tự động chuyển các request `/api` sang backend `http://127.0.0.1:8000`.

---

## 💡 Hướng dẫn tích hợp thuật toán từ MVC cũ

Thư mục `backend/core/` được thiết kế chuyên biệt để chứa toàn bộ logic xử lý hình ảnh và thuật toán từ dự án MVC trước đây:
- File `backend/core/normalizer.py`: Chứa class `SpriteNormalizer` thực hiện tự động tìm kiếm Bounding Box loại bỏ vùng alpha/trong suốt, scale tỷ lệ pixel art theo thuật toán Nearest Neighbor, và căn lề theo các điểm neo (`bottom_center`, `center`, `top_left`).
- Bạn có thể dễ dàng chuyển các hàm xử lý từ Controller/Model của dự án MVC cũ vào đây.
