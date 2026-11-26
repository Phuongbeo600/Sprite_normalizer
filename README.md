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
  - `core/`: Chứa các thuật toán Python xử lý sprite, gồm chuẩn hóa khung hình, đo kích thước và phân tích màu sắc.
  - `api/`: Các API endpoint giao tiếp với frontend

### Gọi thuật toán từ backend

Chạy `python -m pip install -r backend/requirements.txt` từ thư mục gốc để cài các thư viện xử lý ảnh.

| Mô-đun trong `backend/core/` | Hàm và dữ liệu đầu vào |
| --- | --- |
| `region_measure.py` | `measure_region(image, part, polygon, axis=None)` đo bề rộng trên ảnh RGBA từ các đỉnh đa giác nguyên. Với tay hoặc chân, có thể truyền hai điểm xác định hướng chi. Kết quả có `width` và các lát cắt. |
| `sprite_prompt.py` | `build_sprite_prompt(data, description="")` tạo prompt từ dữ liệu JSON số đo đã đọc, gồm `image_size_px` và `measurements`. |
| `pixel_art_metrics.py` | `analyze_sprite(image)` nhận ảnh Pillow và trả về báo cáo lưới pixel, bảng màu, viền, đổ bóng và cụm pixel. `compare_styles(ref, cand)` nhận hai báo cáo phân tích thành công và trả về điểm so sánh. |

## Cấu hình Cloudflare Workers AI cho tạo ảnh

Đổi các biến trong `.env`, sau đó khởi động lại Backend:

```dotenv
IMAGE_GEN_PROVIDER=cloudflare
CLOUDFLARE_API_TOKEN=your_workers_ai_token
CLOUDFLARE_ACCOUNT_ID=your_32_character_account_id
CLOUDFLARE_MODEL_ID=@cf/black-forest-labs/flux-2-klein-4b
```

Token cần quyền **Workers AI: Edit** trên Account tương ứng. Không đưa token vào Model ID.
Khi chọn Cloudflare, dùng `CLOUDFLARE_API_TOKEN`; không lấy `IMAGE_GEN_API_KEY` còn lưu của provider khác.
`CLOUDFLARE_MODEL_ID` được ưu tiên hơn `IMAGE_GEN_MODEL`; biến model chung vẫn dùng được khi biến riêng để trống.
`IMAGE_GEN_BASE_URL` không dùng cho Cloudflare: adapter gọi trực tiếp Workers AI REST API theo Account ID.

Provider giữ thứ tự ưu tiên cấu hình hiện có: ghi đè trong request → key riêng của dự án → mặc định hệ thống.
Nếu dự án đang có key riêng OpenAI/Gemini được chọn, cấu hình đó vẫn có hiệu lực; để thử Cloudflare,
dùng dự án chưa có key riêng, bỏ key riêng đang chọn, hoặc truyền `provider: "cloudflare"` trong request Backend.

Hai model đã có ánh xạ giao thức trong adapter:

| Model ID | Ảnh tham chiếu | Giao thức |
| --- | --- | --- |
| `@cf/black-forest-labs/flux-2-klein-4b` | Có, gửi cả ảnh nhân vật và ảnh bố cục | Multipart |
| `@cf/black-forest-labs/flux-1-schnell` | Không; báo lỗi rõ nếu nhận ảnh | JSON |

Đổi `CLOUDFLARE_MODEL_ID` để chọn model; request `model` có thể ghi đè.
Model chưa có ánh xạ bị từ chối, không tự đoán giao thức hoặc bỏ ảnh đầu vào.
FLUX.1 schnell giới hạn prompt 2048 ký tự và chỉ dùng tỉ lệ 1:1 trong adapter.
Pipeline hiện luôn đính kèm ảnh bố cục, vì vậy chọn **FLUX.2 klein-4b** cho luồng Tạo ảnh AI hiện tại.

Cloudflare yêu cầu ảnh tham chiếu nhỏ hơn 512×512. Adapter giữ toàn bộ ảnh, thu vừa tối đa 511×511
bằng Nearest Neighbor và giữ tỷ lệ, không cắt ảnh. Phản hồi `message` thông báo số ảnh đã thu.
Ảnh lỗi/không đọc được bị từ chối trước khi gọi API. Đầu ra giữ đúng cấu trúc
`ImageGenResponse` / `GeneratedImageItem`, Base64, MIME thật và Data URL;
pipeline prompt, hậu xử lý và Frontend vẫn dùng luồng cũ.

Workers Free có hạn mức chung 10.000 Neurons/ngày, đặt lại lúc 00:00 UTC (07:00 giờ Việt Nam).
Hai model trên dùng hạn mức này; không phải số ảnh miễn phí cố định.
Trên Workers Paid, phần vượt mức có thể bị tính phí theo chính sách tài khoản Cloudflare.
Adapter không tự nâng gói, không thử lại và không chuyển sang OpenAI/Gemini khi API lỗi hoặc hết hạn mức.

Để quay lại OpenAI hoặc Gemini, đặt `IMAGE_GEN_PROVIDER=openai` hoặc `IMAGE_GEN_PROVIDER=gemini`,
đồng thời cấu hình `IMAGE_GEN_API_KEY`, `IMAGE_GEN_MODEL` tương ứng
(và `IMAGE_GEN_BASE_URL` nếu dùng API tương thích OpenAI), rồi khởi động lại Backend.
Các biến `CLOUDFLARE_*` không tham gia phân giải hai provider này.

Tài liệu chính thức đã đối chiếu ngày 26/11/2026:

- [FLUX.2 klein-4b](https://developers.cloudflare.com/workers-ai/models/flux-2-klein-4b/)
- [Multipart và giới hạn ảnh tham chiếu](https://developers.cloudflare.com/changelog/product/workers-ai/2/)
- [FLUX.1 schnell](https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/)
- [Hạn mức miễn phí và giá](https://developers.cloudflare.com/workers-ai/platform/pricing/)

Kiểm thử adapter không gọi API thật: `python -m unittest discover -s tests -p test_cloudflare_image_gen.py`.
