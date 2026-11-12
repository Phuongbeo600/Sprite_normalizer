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
Hệ thống kết hợp **2 tầng xử lý**:
1. **Tầng Thuật Toán Toán Học & Hình Học (Offline Heuristics Engine - NumPy & Pillow):**
   - Tự động cắt hộp bao (Bounding Box), loại bỏ viền trong suốt.(phế)
   - Căn lề điểm neo chân (Anchor Alignment: Bottom-Center).
   - Đo đạc chính xác 100% không dùng AI: Tổng số màu thực tế, Kỷ nguyên bảng màu (8-bit, 16-bit, 32-bit), Dải màu chủ đạo, Bậc đổ bóng Cel-shading, Kỹ thuật dịch sắc độ bóng (Hue-Shifting), Kiểu viền (Black outline / Selout), Độ bão hòa & Độ tương phản.
   - Đo chiều cao pixel nhân vật và tỷ lệ đầu/thân.
2. **Tầng Thị Giác Máy Tính AI (AI Vision Engine - Gemini / OpenAI):**
   - Ép AI phân tích nhân vật theo 7 cấu trúc Schema Pydantic nghiêm ngặt: Nhận diện, Giải phẫu học, Phong cách Pixel, Hướng nhìn (Down, Side, Up), Hoạt họa (Idle, Walk), Ràng buộc bảo tồn và Ràng buộc cấm kỵ.
   - Biên dịch thành **Ma trận 15 Frame hoạt họa 3 Tầng** (Sprite Sheet 3x5: 3 Hướng × 5 Frames với chuyển động chân tay đối nghịch), ép AI tuân thủ tuyệt đối khung màu sắc và số đo của nhân vật gốc.

---

## 2. SƠ ĐỒ CẤU TRÚC THƯ MỤC & TRÁCH NHIỆM

```text
Sprite_normalizer/
├── backend/                        # Mã nguồn máy chủ Backend (FastAPI, Python)
│   ├── ai/                         # Tầng tích hợp AI Vision bên ngoài (Gemini, OpenAI)
│   │   ├── base.py                 # Abstract Base Class BaseAIProvider (Hợp đồng giao tiếp AI)
│   │   ├── gemini_provider.py      # Triển khai Gemini Vision API (Google Generative AI)
│   │   └── openai_provider.py      # Triển khai OpenAI Vision API (GPT-4o, Custom Proxy)
│   ├── api/                        # Tầng điều khiển HTTP Router (FastAPI Controllers)
│   │   ├── api.py                  # Gom các sub-router v1 vào api_router
│   │   └── v1/                     # Các endpoint phiên bản 1
│   │       ├── character_analysis.py # API phân tích hồ sơ nhân vật & sinh prompt
│   │       ├── projects.py         # API quản lý dự án, cấu hình API Key & Presets
│   │       └── sprites.py          # API chuẩn hóa ảnh sprite (trim, bbox, anchor)
│   ├── core/                       # Tầng thuật toán lõi độc lập framework (Pure Logic)
│   │   ├── heuristic_analyzer.py   # Thuật toán đo chiều cao và tỷ lệ đầu/thân (NumPy)
│   │   ├── palette_analyzer.py     # Thuật toán phân tích 6 tiêu chí màu sắc Pixel Art (NumPy, HSV)
│   │   └── sprite_normalizer.py    # Thuật toán cắt viền trong suốt và căn neo đáy sprite
│   ├── db/                         # Tầng kết nối cơ sở dữ liệu MySQL
│   │   ├── connection.py           # Quản lý Engine SQLAlchemy và SessionLocal
│   │   ├── init_db.py              # Script tự động khởi tạo và cập nhật schema bảng MySQL
│   │   └── models.py               # ORM Models (Project, ProjectCharacterPreset)
│   ├── repositories/               # Tầng thao tác CSDL (Data Access Layer)
│   │   ├── character_preset_repository.py # CRUD bảng project_character_presets
│   │   └── project_repository.py   # CRUD bảng projects & giải mã cấu hình API Key
│   ├── schemas/                    # Tầng định nghĩa kiểu dữ liệu và Schemas Pydantic
│   │   ├── character/              # Các schemas phân tích nhân vật chi tiết (7 Schemas)
│   │   │   ├── animation.py        # Schema động học hoạt họa (Walk cycle, Bobbing)
│   │   │   ├── anatomy.py          # Schema cấu trúc giải phẫu học cơ thể
│   │   │   ├── consistency.py      # Schema ràng buộc bất biến & phủ định
│   │   │   ├── direction.py        # Schema 3 góc nhìn (Down, Side, Up)
│   │   │   ├── enums.py            # Từ vựng kiểm soát phân loại (Controlled Vocabulary)
│   │   │   ├── identity.py         # Schema nhận diện danh tính nhân vật
│   │   │   ├── palette.py          # Schema kết quả phân tích 6 tiêu chí màu sắc
│   │   │   └── pixel_style.py      # Schema phong cách đồ họa pixel art
│   │   ├── project.py              # Schema API cho Project & Cấu hình API Key
│   │   └── prompt.py               # Schema yêu cầu sinh Prompt từ hồ sơ
│   ├── services/                   # Tầng nghiệp vụ điều phối (Business Services)
│   │   ├── character_analysis_service.py # Điều phối phân tích offline + online AI
│   │   ├── project_service.py      # Nghiệp vụ quản lý dự án & giải quyết API credentials
│   │   └── prompt_builder_service.py # Xây dựng ma trận 15 frame và biên dịch prompt 3 tầng
│   └── main.py                     # Entry point khởi chạy ứng dụng FastAPI (Uvicorn)
│
├── frontend/                       # Giao diện người dùng Web (React + Vite)
│   ├── src/
│   │   ├── components/             # Các thành phần giao diện React
│   │   │   ├── character-profile/  # Phân hệ Hồ sơ nhân vật AI & Ma trận Frame
│   │   │   │   ├── FrameActionMatrixEditor.jsx # Bộ chỉnh sửa 15 frame hoạt họa
│   │   │   │   ├── MasterColorSpecCard.jsx     # Khung quy định màu sắc & đồ họa cốt lõi
│   │   │   │   ├── PaletteMetricsSection.jsx   # Khối hiển thị 6 chỉ số màu sắc NumPy
│   │   │   │   ├── PromptOutputCard.jsx        # Thẻ hiển thị và sao chép Prompt
│   │   │   │   ├── TabAnimationView.jsx        # Tab hiển thị động học chuyển động
│   │   │   │   ├── TabConstraintsPromptView.jsx# Tab phòng tạo Prompt & Ràng buộc
│   │   │   │   ├── TabDirectionView.jsx        # Tab hiển thị 3 hướng nhìn
│   │   │   │   └── TabGlobalView.jsx           # Tab hiển thị phong cách & bảng màu
│   │   │   ├── projects/           # Thành phần quản lý danh sách & cấu hình dự án
│   │   │   └── Header.jsx          # Thanh điều hướng trên cùng
│   │   ├── constants/              # Dữ liệu hằng số tách biệt giao diện
│   │   │   ├── initialProjects.js  # Danh sách dự án ban đầu mẫu
│   │   │   └── promptDefaults.js   # Chuỗi Negative Prompt & Logic biên dịch 15 frames
│   │   ├── services/               # Tầng giao tiếp API Backend (fetch/axios)
│   │   │   ├── api.js              # Gọi API chuẩn hóa sprite
│   │   │   ├── characterAnalysisApi.js # Gọi API phân tích hồ sơ & sinh prompt
│   │   │   └── projectApi.js       # Gọi API quản lý dự án & cấu hình key
│   │   ├── styles/                 # Định dạng màu sắc & giao diện
│   │   │   ├── theme.css           # Bảng biến CSS toàn cục (Dark mode gaming)
│   │   │   └── character-profile.css # Giao diện chuyên biệt cho hồ sơ nhân vật
│   │   ├── App.jsx                 # Component trung tâm quản lý trạng thái điều hướng
│   │   └── main.jsx                # Entry point gắn React vào DOM
│   └── package.json                # Cấu hình gói và thư viện Frontend
│
├── tests/                          # Tầng kiểm thử tự động (Unit Tests)
│   ├── test_core_characterization.py # Test khóa hành vi thuật toán cắt viền & giải phẫu
│   ├── test_heuristic_analyzer.py  # Test đo chiều cao và tỷ lệ cơ thể
│   ├── test_palette_analyzer.py    # Test đo 6 tiêu chuẩn màu sắc (NumPy)
│   ├── test_project_service.py     # Test nghiệp vụ dự án & phân tầng dữ liệu
│   ├── test_prompt_builder.py      # Test ma trận 15 frame & biên dịch prompt
│   └── test_sprite_normalizer.py   # Test cắt hộp bao Bounding Box & neo đáy
│
└── docs/                           # Tài liệu kỹ thuật
    └── ARCHITECTURE.md             # Bản vẽ kiến trúc toàn diện (File này)
```

---

## 3. LUỒNG CHẠY CHÍNH TỪ ĐẦU TỚI CUỐI

### Sơ đồ tuần tự xử lý phân tích và sinh nhân vật mới:

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng (Artist/Dev)
    participant FE as Frontend React (Vite)
    participant Router as API Router (FastAPI)
    participant Srv as CharacterAnalysisService
    participant PSrv as ProjectService
    participant Core as Core Heuristics (NumPy)
    participant AI as AI Vision Provider (Gemini/OpenAI)
    participant DB as MySQL Database

    User->>FE: Tải ảnh Sprite mẫu lên & chọn Dự án
    FE->>Router: POST /character-profile/analyze-tab (ảnh RGBA + project_id)
    
    Router->>PSrv: resolve_project_credentials(project_id)
    PSrv->>DB: Đọc cấu hình API Key lưu trong CSDL
    DB-->>PSrv: Trả về API Key & Provider đã giải mã
    PSrv-->>Router: eff_key, eff_provider, eff_base_url
    
    Router->>Srv: analyze_character_tab(...)
    
    Note over Srv,Core: TẦNG 1: PHÂN TÍCH OFFLINE (Toán học 100%, không tốn token)
    Srv->>Core: HeuristicPaletteAnalyzer.analyze_palette(image)
    Core-->>Srv: Trả về PaletteMetrics (6 tiêu chí màu sắc)
    Srv->>Core: HeuristicAnalyzer.analyze_sprite_anatomy(image)
    Core-->>Srv: Trả về AnatomyMetrics (chiều cao, tỷ lệ đầu/thân)
    
    Note over Srv,AI: TẦNG 2: PHÂN TÍCH ONLINE BẰNG AI VISION
    Srv->>AI: Gửi ảnh + System Prompt ép cấu trúc theo 7 Schemas
    AI-->>Srv: Trả về JSON có cấu trúc (Global, Direction, Animation...)
    
    Srv->>Srv: Gộp PaletteMetrics vào hồ sơ kết quả (AIAnalysis)
    Srv-->>Router: Trả về Full Profile (JSON)
    Router-->>FE: Hiển thị lên 4 Tab giao diện
    
    Note over FE,User: TẦNG 3: SOẠN THẢO MA TRẬN 15 FRAME & XUẤT PROMPT
    FE->>FE: Tự động điền Palette, Kích thước vào 15 Frame (3 hướng x 5 frame)
    User->>FE: Nhập ý tưởng nhân vật mới (Concept, Trang phục, Vũ khí)
    FE->>FE: Live Preview biên dịch Positive Prompt 3 Tầng & Negative Prompt
    User->>FE: Bấm "Lưu vào Dự án"
    FE->>Router: POST /projects/{id}/character-presets
    Router->>DB: Lưu preset vào bảng project_character_presets
    DB-->>FE: Thông báo lưu thành công!
```

---

## 4. CÁC ĐIỂM ĐA HÌNH & HƯỚNG DẪN MỞ RỘNG (EXTENSION POINTS)

Hệ thống được thiết kế theo nguyên tắc **Mở rộng/Đóng kín (OCP)** và **Đảo ngược phụ thuộc (DIP)** tại các vị trí sau:

### 4.1. Thêm một nhà cung cấp AI mới (AI Provider)
Tất cả các AI Vision Provider đều kế thừa lớp trừu tượng `BaseAIProvider` trong `backend/ai/base.py`.

**Các bước thực hiện:**
1. Tạo file mới `backend/ai/claude_provider.py` (ví dụ tích hợp Anthropic Claude 3.5 Sonnet):
   ```python
   # Kế thừa BaseAIProvider
   from backend.ai.base import BaseAIProvider
   
   class ClaudeVisionProvider(BaseAIProvider):
       def __init__(self, api_key: str, **kwargs):
           self.api_key = api_key

       def analyze_image(self, image_bytes: bytes, prompt: str, schema_class=None) -> dict:
           # Gọi API Claude gửi ảnh kèm prompt và bóc tách JSON
           ...
           return parsed_json_dict
   ```
2. Đăng ký vào Factory Method trong `backend/services/character_analysis_service.py` (`_resolve_ai_provider`):
   ```python
   if provider_name == "claude":
       return ClaudeVisionProvider(api_key=api_key)
   ```
3. Cập nhật giao diện chọn Provider trong `frontend/src/components/projects/ProjectConfigModal.jsx`.

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
