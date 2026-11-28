# KIẾN TRÚC HỆ THỐNG SPRITE NORMALIZER & AI VISION STUDIO

> **Tài liệu kiến trúc hệ thống dành cho kỹ sư phát triển và chủ dự án.**  
> Mục tiêu: Giúp người đọc hiểu toàn bộ dự án, luồng dữ liệu, các điểm mở rộng và trạng thái kỹ thuật trong thời gian ngắn nhất.

---

## 1. DỰ ÁN NÀY LÀM GÌ? (TỔNG QUAN NGHIỆP VỤ)

**Sprite Normalizer** là hệ thống hỗ trợ chuẩn hóa đồ họa nhân vật game 2D (Pixel Art) và trợ lý sinh Prompt AI có kiểm soát hình học / màu sắc.

### Bài toán giải quyết
Khi tạo sprite hoạt họa hoặc biến thể nhân vật bằng AI (như Midjourney, Stable Diffusion, DALL-E), AI thường gặp các lỗi đặc trưng:
- **Lệch tỷ lệ giải phẫu:** Chiều cao nhân vật và tỷ lệ đầu/thân bị co giãn qua các frame.
- **Loạn bảng màu (Color Bleeding):** AI tự pha màu mượt (airbrush/gradient), làm mất chất pixel art cổ điển.
- **Mất tính nhất quán chuyển động:** Chân tay vung không đối xứng, không tạo được vòng lặp (Walk cycle loop).
- **Nhiễu nền:** Nền có đổ bóng sàn hoặc phong cảnh làm hỏng việc bóc tách sprite sheet.

### Giải pháp của hệ thống
Hệ thống sử dụng **Tầng Thuật Toán Toán Học & Hình Học (Offline Heuristics Engine - NumPy & Pillow)**:
- Tự động cắt hộp bao (Bounding Box), loại bỏ viền trong suốt và chuẩn hóa kích thước.
- Căn lề điểm neo chân (Anchor Alignment: Bottom-Center).
- Đo đạc chính xác 100% không dùng AI: Tổng số màu thực tế, Kỷ nguyên bảng màu (8-bit, 16-bit, 32-bit), Dải màu chủ đạo, Bậc đổ bóng Cel-shading, Kỹ thuật dịch sắc độ bóng (Hue-Shifting), Kiểu viền (Black outline / Selout), Độ bão hòa & Độ tương phản.
- Đo chiều cao pixel nhân vật, tỷ lệ đầu/thân và 11 thông số Point-to-Point.

---

## 2. SƠ ĐỒ CẤU TRÚC THƯ MỤC & TRÁCH NHIỆM

```text
Sprite_normalizer/
├── .agents/                        # Quản lý Agent Skills của Antigravity IDE (Taste Skill)
│   └── skills/
│       └── design-taste-frontend/  # Skill thiết kế giao diện chuẩn Dark Fantasy Atelier
│
├── backend/                        # Mã nguồn máy chủ Backend (FastAPI, Python)
│   ├── providers/                  # Tầng tích hợp AI Vision bên ngoài (Gemini, OpenAI qua Factory)
│   │   ├── base.py                 # Abstract Base Class BaseAiProvider (Hợp đồng giao tiếp AI)
│   │   ├── factory.py              # AiProviderFactory khởi tạo nhà cung cấp AI theo tên gọi
│   │   ├── gemini_provider.py      # Triển khai Gemini Vision API (Google Generative AI)
│   │   └── openai_provider.py      # Triển khai OpenAI Vision API (GPT-4o, Custom Proxy)
│   ├── api/                        # Tầng điều khiển HTTP Router (FastAPI Controllers)
│   │   ├── router.py               # Gom các sub-router v1 vào api_router
│   │   └── v1/                     # Các endpoint phiên bản 1
│   │       ├── auth.py             # API xác thực người dùng và đăng nhập/đăng ký
│   │       ├── image_gen.py        # API tạo ảnh sprite bằng AI và gợi ý prompt
│   │       ├── offline_chat.py     # API Chatbot RAG Offline và lịch sử hội thoại
│   │       ├── projects.py         # API quản lý dự án, cấu hình API Key & Presets
│   │       ├── sprites.py          # API chuẩn hóa ảnh sprite, đo màu, đo giải phẫu và cắt lưới
│   │       ├── testbed.py          # API phòng thử nghiệm Godot Testbed
│   │       ├── translation.py      # API dịch thuật prompt offline
│   │       └── users.py            # API quản lý thông tin người dùng
│   ├── core/                       # Tầng thuật toán lõi độc lập framework (Pure Logic)
│   │   ├── processing/             # Phân hệ xử lý & hình học Sprite
│   │   │   ├── normalizer.py       # Thuật toán cắt viền trong suốt và căn neo đáy sprite
│   │   │   ├── masking.py          # Bóc tách Alpha mask và Bounding Box
│   │   │   ├── sprite_editing.py   # Thuật toán cắt lưới Sprite Sheet thích ứng
│   │   │   ├── inverse_scaling.py  # Động cơ ước tính độ phân giải pixel gốc
│   │   │   └── visual_renderer.py  # Render đường lưới gióng và overlay trực quan
│   │   └── metrics/                # Phân hệ trắc lượng & phân tích nghệ thuật
│   │       ├── palette_analyzer.py # Phân tích 6 tiêu chí màu sắc Pixel Art (NumPy, HSV)
│   │       ├── character_metrics.py# Thuật toán đo chiều cao và tỷ lệ đầu/thân
│   │       ├── pixel_art_metrics.py# Đo viền outline và độ tương phản đồ họa
│   │       ├── heuristic_analyzer.py # Phân tích phong cách nghệ thuật pixel art
│   │       ├── region_measure.py   # Đo đa giác & đoạn thẳng giải phẫu học
│   │       └── sprite_prompt.py    # Mẫu quy chuẩn phong cách đồ họa điểm ảnh
│   ├── db.py                       # Quản lý kết nối CSDL MySQL, SessionLocal và tự phục hồi schema
│   ├── repositories/               # Tầng thao tác CSDL (Data Access Layer)
│   │   ├── base.py                 # Abstract Base Class BaseRepository
│   │   ├── character_preset_repository.py # CRUD bảng project_character_presets
│   │   ├── project_repository.py   # CRUD bảng projects & giải mã cấu hình API Key
│   │   ├── testbed_repository.py   # Quản lý dữ liệu nhân vật kiểm thử
│   │   ├── sprite_repository.py    # Quản lý lưu trữ sprite gốc và tối ưu
│   │   └── user_repository.py      # CRUD bảng users và tài khoản người dùng
│   ├── schemas/                    # Tầng định nghĩa kiểu dữ liệu và Schemas Pydantic
│   │   ├── character/              # Schemas phân tích màu sắc nhân vật
│   │   │   └── palette.py          # Schema kết quả phân tích 6 tiêu chí màu sắc
│   │   ├── project.py              # Schema API cho Project & Cấu hình API Key
│   │   ├── testbed.py              # Schema phòng thử nghiệm Godot Testbed
│   │   ├── image_gen.py            # Schema yêu cầu tạo ảnh AI
│   │   ├── offline_chat.py         # Schema Chatbot RAG Offline và lịch sử hội thoại
│   │   └── translation.py          # Schema dịch thuật prompt đa ngôn ngữ
│   ├── services/                   # Tầng nghiệp vụ điều phối (Business Services)
│   │   ├── character/              # Phân hệ phân tích giải phẫu
│   │   │   └── anatomy_service.py  # Phân tích giải phẫu học & tạo ảnh trực quan
│   │   ├── offline_chat/           # Phân hệ Chatbot RAG Offline độc lập
│   │   ├── testbed/                # Phân hệ Phòng thử nghiệm Godot
│   │   │   ├── testbed_service.py            # Quản lý sân diễn Godot & bản đồ nền
│   │   │   └── godot_export_service.py       # Đóng gói và xuất file ZIP cho Godot 4
│   │   ├── project_service.py      # Nghiệp vụ quản lý dự án & presets
│   │   ├── sprite_service.py       # Chuẩn hóa ảnh và đóng gói lưới Sprite Sheet
│   │   ├── user_service.py         # Quản lý người dùng, hồ sơ và phân quyền
│   │   ├── image_gen_service.py    # Nghiệp vụ sinh ảnh nhân vật qua AI
│   │   ├── settings_service.py     # Tiện ích che dấu API Key hiển thị
│   │   └── translation_service.py  # Dịch thuật mô tả sang tiếng Anh bằng ArgosTranslate
│   └── main.py                     # Entry point khởi chạy ứng dụng FastAPI (Uvicorn)
│
├── frontend/                       # Giao diện người dùng Web (React + Vite)
│   ├── src/
│   │   ├── app/                    # Khung ứng dụng, Sidebar và điều hướng tab
│   │   ├── features/               # Các phân hệ tính năng hiện hành
│   │   ├── shared/                 # API helper, UI primitives dùng chung
│   │   ├── constants/              # Dữ liệu hằng số tách biệt giao diện
│   │   ├── styles/                 # Biến CSS toàn cục (theme.css, project-layout.css)
│   │   └── index.css               # Stylesheet nền tảng của toàn ứng dụng
│   └── package.json                # Cấu hình gói và thư viện Frontend
│
├── tests/                          # Tầng kiểm thử tự động (Unit Tests)
│   ├── test_character_profile_service.py # Test phân tích sprite & đo thủ công 11 thông số
│   ├── test_core_characterization.py # Test khóa hành vi thuật toán cắt viền & giải phẫu
│   ├── test_palette_analyzer.py    # Test đo 6 tiêu chuẩn màu sắc (NumPy)
│   ├── test_project_presets_and_api_config.py # Test nghiệp vụ dự án & phân tầng dữ liệu
│   └── test_sprite_workspace.py    # Test cắt lưới Sprite Sheet thích ứng & ZIP
│
├── docs/                           # Tài liệu kỹ thuật
│   └── ARCHITECTURE.md             # Bản vẽ kiến trúc toàn diện (File này)
│
├── .env.example                    # Mẫu cấu hình biến môi trường kết nối MySQL và AI
├── .gitignore                      # Quy tắc loại trừ secrets, build và cache của Git
├── GEMINI.md                       # Bản quy chuẩn lập trình bắt buộc (100% chú thích tiếng Việt)
├── package.json                    # (Tùy chọn) Điều phối script cho Workspace nếu cấu hình
├── README.md                       # Tài liệu hướng dẫn dự án
├── run.bat                         # Tiện ích khởi chạy 1-click trên hệ điều hành Windows
├── run.py                          # Script Python điều phối song song Backend & Frontend
└── skills-lock.json                # Khóa phiên bản và mã băm toàn vẹn của Agent Skills
```

---

## 3. CÁC ĐIỂM ĐA HÌNH & HƯỚNG DẪN MỞ RỘNG (EXTENSION POINTS)

Hệ thống được thiết kế theo nguyên tắc **Mở rộng/Đóng kín (OCP)** và **Đảo ngược phụ thuộc (DIP)** tại các vị trí sau:

### 4.1. Thêm một nhà cung cấp AI mới (AI Provider)
Tất cả các AI Vision Provider đều kế thừa lớp trừu tượng `BaseAiProvider` trong `backend/providers/base.py`.

**Các bước thực hiện:**
1. Tạo file mới `backend/providers/claude_provider.py` (ví dụ tích hợp Anthropic Claude 3.5 Sonnet):
   ```python
   # Kế thừa BaseAiProvider
   from backend.providers.base import BaseAiProvider
   
   class ClaudeProvider(BaseAiProvider):
       DEFAULT_MODEL = "claude-3-5-sonnet-20241022"

       def test_connection(self, api_key: str, base_url: Optional[str] = None) -> Tuple[bool, str]:
           # Kiểm tra kết nối tới Claude API
           ...

       def analyze_vision(self, image: Image.Image, api_key: str, prompt: str, base_url: Optional[str] = None) -> Dict[str, Any]:
           # Gửi ảnh kèm prompt và bóc tách kết quả JSON
           ...
           return parsed_json_dict
   ```
2. Đăng ký vào Factory Pattern trong `backend/providers/factory.py` (`AiProviderFactory`):
   ```python
   AiProviderFactory.register("claude", ClaudeProvider)
   ```
3. Cập nhật giao diện chọn Provider trong `frontend/src/features/settings/ProjectSettings.jsx`.

### 4.2. Thêm một tiêu chí đo lường màu sắc hoặc hình học mới
1. Mở `backend/core/palette_analyzer.py` hoặc `heuristic_analyzer.py`.
2. Viết thêm hàm trợ lý chuyên biệt (Private helper):
   ```python
   def _detect_dithering_pattern(self, np_arr: np.ndarray) -> str:
       # Thuật toán toán học đo cụm checkerboard
       ...
   ```
3. Cập nhật Schema Pydantic tương ứng trong `backend/schemas/character/palette.py`.
4. Gọi trong hàm điều phối `analyze_palette()`.

---

## 5. BIẾN MÔI TRƯỜNG, CÁCH CHẠY VÀ KIỂM THỬ

### 5.1. Cấu hình biến môi trường (`.env`)
Tạo file `.env` tại thư mục gốc của dự án:
```env
# Cấu hình kết nối MySQL
DATABASE_URL=mysql+pymysql://root:password@localhost:3306/sprite_normalizer?charset=utf8mb4

# API Key mặc định hệ thống (Có thể cấu hình riêng theo từng dự án trên giao diện)
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
```

### 5.2. Khởi chạy Backend (FastAPI + Uvicorn)
```powershell
# Kích hoạt môi trường ảo Python (nếu có)
# Chạy máy chủ tại cổng 8000
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### 5.3. Khởi chạy Frontend (React + Vite)
```powershell
cd frontend
npm install
npm run dev
# Mở trình duyệt tại http://localhost:5173
```

### 5.4. Chạy toàn bộ kiểm thử tự động (Unit Tests)
```powershell
python -m unittest discover tests
```
*Hiện có 26 tests bảo vệ 100% các thuật toán đo đạc, chuẩn hóa sprite và dịch vụ biên dịch prompt.*

### 5.5. Kiểm tra build ứng dụng
```powershell
npm --prefix frontend run build
```

---

## 6. DANH SÁCH BUG TỒN ĐỌNG & NỢ KỸ THUẬT (TECHNICAL DEBT)

> [!WARNING]
> Theo quy tắc Refactor bất biến (Không thay đổi hành vi nghiệp vụ hiện có), 3 vấn đề logic dưới đây đã được ghi nhận vào danh sách lỗi cần xử lý ở đợt nâng cấp thuật toán tiếp theo:

1. **Bug 1: Độ bão hòa trung bình (Average Saturation) chưa tính theo diện tích chiếm dụng:**
   - *Hiện trạng:* `_calculate_saturation_and_contrast` trong `backend/core/palette_analyzer.py` đang tính trung bình cộng thô của các màu độc nhất, không nhân với số lượng pixel (`percentage`) của màu đó trên sprite.
   - *Hệ quả:* Một pixel nhiễu có độ bão hòa cao cũng kéo lệch chỉ số bão hòa của cả nhân vật.

2. **Bug 2: Tỷ lệ tương phản (Contrast Ratio) luôn bị đánh giá là High Contrast:**
   - *Hiện trạng:* Thuật toán lấy `lum_max` và `lum_min` trên toàn bộ sprite. Vì hầu hết Sprite Pixel Art đều có viền đen (`lum_min ≈ 0`), tỷ lệ tương phản luôn đạt mức tối đa (> 6.5:1).
   - *Đề xuất khắc phục:* Nên đo tương phản giữa màu Base chính và màu Shadow lân cận thay vì đo cực trị toàn bức ảnh.

3. **Bug 3: Giả định 1 pixel ảnh = 1 pixel art (Thiếu tính năng phát hiện Pixel Scale Factor):**
   - *Hiện trạng:* Hệ thống giả định ảnh đưa vào là Native Pixel Art (tỷ lệ 1:1). Nếu người dùng tải ảnh sprite đã bị phóng đại (upscale 2x, 3x, 4x bằng Nearest-Neighbor), số đếm pixel chiều cao và đường viền sẽ bị nhân gấp bấy nhiêu lần.
   - *Đề xuất khắc phục:* Bổ sung thuật toán tự động nhận diện kích thước ô pixel tối thiểu (Greatest Common Divisor của các cụm pixel) trước khi tính toán.
