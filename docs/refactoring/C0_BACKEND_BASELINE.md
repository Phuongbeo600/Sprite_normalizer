# BÁO CÁO THIẾT LẬP BASELINE KIẾM ĐỊNH BACKEND (GIAI ĐOẠN C0)
**Dự án:** Sprite Normalizer & AI Studio  
**Giai đoạn:** C0 – Backend Refactoring Baseline  
**Thời điểm ghi nhận:** 2026-11-15  
**Mục tiêu:** Thiết lập thước đo đối chiếu (baseline) kỹ thuật toàn diện cho toàn bộ hệ thống backend FastAPI trước khi tiến hành các bước refactor chuyên sâu tiếp theo.

---

## 1. TÌNH TRẠNG GIT VÀ THAY ĐỔI HIỆN TẠI (GIT STATUS)

- **Nhánh hiện tại:** `main` (đồng bộ với remote `origin/main` tại commit `b6a9c50`).
- **Ghi nhận lịch sử commit:** Commit `b6a9c50` ("refactor: chuẩn hóa kiến trúc backend và sửa lỗi hiển thị kho tài nguyên, godot testbed") đã lưu trữ trọn vẹn Giai đoạn A & B và các bản vá lỗi giao diện liên quan.
- **Trạng thái thư mục làm việc (Working Tree):** Sạch (clean), sẵn sàng làm mốc cơ sở (baseline) vững chắc cho Giai đoạn C.

---

## 2. KIỂM KÊ MODULE, DEPENDENCIES & PUBLIC INTERFACES

### 2.1 Thư viện phụ thuộc (Dependencies - `requirements.txt`)
- **Web & API Framework:** `fastapi>=0.110.0`, `uvicorn[standard]>=0.28.0`, `python-multipart>=0.0.9`.
- **Xử lý dữ liệu & Ảnh:** `pillow>=10.2.0`, `numpy>=1.26.0`, `scipy>=1.11.4`.
- **Kiểm thực dữ liệu & CSDL:** `pydantic>=2.6.0`, `sqlalchemy>=2.0.0`, `pymysql>=1.1.0`.
- **Cấu hình & Mạng:** `python-dotenv>=1.0.0`, `requests>=2.31.0`.
- **Dịch thuật Offline:** `argostranslate>=1.9.0`.

### 2.2 Kiến trúc phân hệ Backend
- **`backend.api`:** Điểm phân phối 10 sub-router (`auth`, `users`, `projects`, `sprites`, `prompt`, `settings`, `character_analysis`, `image_gen`, `translation`, `testbed`).
- **`backend.core.processing`:** Các hàm biến đổi ảnh nhị phân thuần túy, cắt tỉa bounding box, chuẩn hóa anchor, render trực quan.
- **`backend.core.metrics`:** Thuật toán giải tích tìm hõm cổ, tỷ lệ đầu/thân, phân tích 6 tiêu chí màu sắc, phát hiện lưới pixel art.
- **`backend.services`:** Lớp điều phối nghiệp vụ kết hợp Core, AI Providers và Repositories.
- **`backend.repositories`:** Đóng gói toàn bộ câu lệnh SQL thao tác với MySQL (Data Access Object).
- **`backend.providers`:** Nhà cung cấp AI (Google Gemini, OpenAI) với `AiProviderFactory`.

### 2.3 Giao diện công khai (Public API Endpoints)
- **Tổng số Endpoints:** 44 endpoints (55 API Operations).
- **Danh mục phân nhóm chính:**
  - `Sprite Operations`: `/api/normalize`, `/api/resize`, `/api/slice-sheet`, `/api/analyze`, `/api/analyze-colors`, `/api/detect-resolution`, `/api/measure-regions`, `/api/export-godot`, `/api/sprites/*`.
  - `Character Profile Analysis`: `/api/character-profile/analyze-tab`, `/api/character-profile/generate-prompt`, `/api/character-profile/style-prompt`, `/api/character-profile/frame-matrix/*`, `/api/character-profile/vision-status`.
  - `AI Prompt Advisor`: `/api/prompt-advice`.
  - `AI Image Generator`: `/api/image-gen/generate`, `/api/image-gen/status`.
  - `Godot Testbed (MySQL Storage)`: `/api/testbed/characters/*`, `/api/testbed/map/*`.
  - `Quản lý Dự án & Preset`: `/api/projects/*`, `/api/projects/{id}/character-presets/*`.
  - `Xác thực & Người dùng`: `/api/auth/login`, `/api/auth/register`, `/api/auth/profile`, `/api/users/*`.
  - `Dịch thuật & Hệ thống`: `/api/translate/*`, `/api/settings/*`, `/api/health`, `/`.

---

## 3. KẾT QUẢ KIỂM THỬ KHẢ DỤNG (TEST EXECUTION SUITE)

Lệnh thực thi: `$env:PYTHONPATH='.'; python -m unittest discover tests`

- **Tổng số test cases:** 37
- **Kết quả:** **37 / 37 PASS (100% thành công)**
- **Thời gian thực thi:** 0.382 giây
- **Chi tiết từng phân hệ kiểm thử:**
  - `test_character_profile_service.py` (10 tests): Kiểm tra phân tích hồ sơ nhân vật đa tab, mock AI vision provider, bóc tách prompt phong cách.
  - `test_character_schemas.py` (9 tests): Kiểm tra kiểm thực dữ liệu Pydantic schemas (Global, Directions, Animations, Reference, Constraints).
  - `test_core_characterization.py` (3 tests): Khóa hành vi bounding box, cắt viền trong suốt, căn điểm neo `bottom_center` và thuật toán giải phẫu đo tỷ lệ đầu/cổ.
  - `test_palette_analyzer.py` (3 tests): Khóa hành vi 6 tiêu chí hệ màu sắc, nhận diện cel-shading, hue-shifting, độ bão hòa và tương phản.
  - `test_project_presets_and_api_config.py` (3 tests): Kiểm tra lưu trữ CSDL SQLite in-memory cho cấu hình API Key và hồ sơ nhân vật.
  - `test_prompt_builder_service.py` (3 tests): Kiểm tra trình biên dịch prompt ma trận 15 frame hoạt họa.
  - `test_sprite_workspace.py` (6 tests): Kiểm tra các API cắt sheet, chuẩn hóa và xử lý ảnh đơn trong workspace.

---

## 4. KHỞI ĐỘNG FASTAPI VÀ KHÓA HỢP ĐỒNG SCHEMA (OPENAPI)

- **Trạng thái khởi động FastAPI:** Khởi tạo an toàn trong bộ nhớ không phát sinh ngoại lệ runtime (`Startup Event OK`).
- **Mã băm toàn vẹn OpenAPI Schema (SHA-256):**
  ```text
  a1d8edf156bd0f79d31ac3dc48795b5b8b61ff5d9f6a91d077fb6671d16d321d
  ```
  *(Mã băm khớp 100% từng byte so với trạng thái trước khi refactor, bảo đảm không xảy ra trôi dạt hợp đồng API contract).*

---

## 5. DỮ LIỆU ĐẦU RA THUẬT TOÁN TRÊN MẪU KIỂM ĐỊNH (FIXTURES BASELINE)

Thử nghiệm trên mẫu sprite pixel nhân tạo kích thước 32x48 pixel với nhân vật cố định ở trung tâm:

### 5.1 Thuật toán Chuẩn hóa & Hộp bao (`SpriteNormalizer`)
- **Bounding Box `(xmin, ymin, xmax, ymax)`:** `(10, 10, 23, 39)`
- **Kích thước sau khi cắt viền trong suốt (Trimmed Size):** `13 x 29 px`
- **Kích thước sau chuẩn hóa (Target 64x64, Anchor `bottom_center`):** `64 x 64 px`
- **Tọa độ tiếp đất:** Điểm chạm đáy chân `(X=32, Y=63)` có giá trị Alpha > 0.

### 5.2 Thuật toán Giải tích Giải phẫu (`HeuristicAnalyzer`)
- **Kích thước nhìn thấy được (Visible Dimension):** `13 x 29 px`
- **Phạm vi tọa độ trục Y nhìn thấy:** `[10, 38]`
- **Tọa độ đỉnh đầu (`head_y_min`):** `10`
- **Tọa độ hõm cổ phát hiện được (`neck_y`):** `18`
- **Tỷ lệ chiều cao theo đầu (`heads_tall`):** `3.220` (chuẩn Chibi / Retro RPG).

### 5.3 Thuật toán Phân tích Hệ màu (`HeuristicPaletteAnalyzer`)
- **Tổng số lượng màu thực tế (`total_colors`):** `3`
- **Số lượng màu chủ đạo (`dominant_colors`):** `3`
- **Phong cách đổ bóng nhận diện:** `2-Tone Cel-Shading` (2 bậc bóng).
- **Quy chuẩn đường viền:** `Colored Outline` (Viền có màu).
- **Kỹ thuật dịch chuyển sắc độ bóng (`hue_shifting`):** `True`.
- **Tỷ số tương phản ánh sáng (`contrast_ratio`):** `2.20`.

### 5.4 Thuật toán Bóc tách Khung hình (`SpriteService.sheet_frames`)
- Mẫu tấm ảnh Sprite Sheet 80x48 pixel chia thành 3 hàng x 5 cột:
  - Sinh chính xác **15 khung hình đơn** liên tiếp (`frame_001.png` đến `frame_015.png`).
  - Kích thước mỗi khung hình chuẩn xác: **`16 x 16 px`**.

### 5.5 Động cơ Cố vấn Prompt AI (`PromptService.generate_prompt_advice`)
- **Positive Prompt Output:**
  ```text
  Create a single full-body pixel knight warrior sprite, centered and facing forward, in clean chunky pixel art style...
  ```
- **Negative Prompt Output:**
  ```text
  photorealistic, 3D, vector art, smooth gradients, antialiasing, blur, soft edges, painterly rendering...
  ```

---

## 6. XÁC ĐỊNH CÁC CHỨC NĂNG CÓ RỦI RO HỒI QUY CAO (HIGH-REGRESSION RISKS)

1. **R-01: Tọa độ Bounding Box & Căn lề Điểm neo (Anchor Alignment):**
   - *Rủi ro:* Bất kỳ sai lệch $\pm 1$ pixel nào trong thuật toán `masking.py` và `normalizer.py` sẽ làm lệch trọng tâm nhân vật, phá vỡ hitbox trong engine game (Godot / Unity).
2. **R-02: Thuật toán nhận diện hõm cổ & Tỷ lệ giải phẫu (`HeuristicAnalyzer`):**
   - *Rủi ro:* Thuật toán dựa trên đạo hàm quét ngang bề rộng sprite để tìm điểm thắt cổ. Các sprite có trang phục áo choàng, cánh hoặc tóc xõa dài dễ bị nhận diện sai vị trí cổ nếu logic quét bị thay đổi.
3. **R-03: Xử lý dữ liệu nhị phân ảnh BLOB (`MEDIUMBLOB` MySQL):**
   - *Rủi ro:* Các cột `raw_image_data`, `processed_image_data`, `map_image_data` lưu trữ byte ảnh PNG trực tiếp. Việc chuyển đổi qua lại giữa `bytes`, `base64` và `PIL.Image` cần bảo toàn đúng định dạng không nén mất mát.
4. **R-04: Cấu trúc JSON lồng nhau trong CSDL MySQL:**
   - *Rủi ro:* Các cột `metrics_data`, `profile_data`, `frame_actions_data`, `slots_data` lưu trữ JSON phức tạp. Pydantic models cần bảo đảm tính tương thích khi serialize/deserialize.

---

## 7. CÁC KIỂM THỬ KHÔNG THỂ THỰC HIỆN TRONG MÔI TRƯỜNG CÔ LẬP

1. **T-01: Gọi API trực tiếp đến AI Provider bên ngoài (Google Gemini API & OpenAI DALL-E):**
   - *Lý do:* Kiểm thử tự động không thể dựa vào API Key thật do rủi ro cạn hạn ngạch (quota limit), chi phí phát sinh và yêu cầu kết nối mạng quốc tế. Các kiểm thử hiện tại sử dụng cơ chế giả lập (`unittest.mock.patch`).
2. **T-02: Kết nối CSDL MySQL độc lập ngoài môi trường máy chủ:**
   - *Lý do:* Hệ thống đang kết nối trực tiếp đến MySQL cục bộ (`127.0.0.1:3306`). Khi chạy trên các môi trường CI/CD không có dịch vụ MySQL dựng sẵn, các kiểm thử repository phụ thuộc vào SQLite in-memory giả lập.
3. **T-03: Kiểm thử tương tác đồ họa trong Godot Engine 4 Binary:**
   - *Lý do:* Quá trình xuất file ZIP Godot (`godot_export_service.py`) đã được kiểm tra cấu trúc thư mục và file `.tscn`/`.tres`, nhưng việc mở ứng dụng Godot để chạy game thực tế cần cài đặt Godot Engine trên hệ điều hành và có màn hình hiển thị GUI.
