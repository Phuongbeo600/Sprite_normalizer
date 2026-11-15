# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON
# ========================================================
# json: Chuyển số đo Python thành văn bản có cấu trúc.
import json
# typing: Kiểu tên nhà cung cấp được hỗ trợ.
from typing import Literal, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI
# ========================================================
# Pillow: Kiểu ảnh sprite nhận từ API.
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
# ========================================================
# AiProviderFactory: Lấy nhà cung cấp AI đã được cấu hình.
from backend.providers.factory import AiProviderFactory
# ReferenceStylePrompt: Kiểm tra đoạn phong cách và các quan sát trả về.
from backend.schemas.character.ai_analysis import ReferenceStylePrompt

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC
# ========================================================
# Không áp dụng cho backend.


STYLE_PROMPT_TEMPLATE = """Bạn là họa sĩ pixel art phụ trách giữ phong cách hình ảnh nhất quán cho một game 2D. Hãy xem sprite tham chiếu đính kèm và viết chỉ dẫn cho một AI tạo ảnh để vẽ một nhân vật mới thuộc cùng bộ asset.

App đã phân tích sprite bằng Python. Các số đo có sẵn là:
{python_metrics_json}

Dùng các số đo này làm bối cảnh. Tập trung tìm những đặc điểm trong cách vẽ mà các con số chưa diễn tả. Ví dụ, nếu Python đã đo kiểu và độ dày viền, phần bạn cần bổ sung là viền đậm được đặt ở cạnh nào, đoạn nào dùng viền sáng hơn, và đường nét bên trong được dùng để tách những khối nào.

Hãy tự chọn những quan sát hữu ích nhất từ ảnh. Các hướng dưới đây là gợi ý để quan sát:

- Góc nhìn và hình khối: Những mặt nào của đầu, thân và bàn chân nhìn thấy được? Họa sĩ thể hiện chiều sâu bằng cách cho các khối chồng lên nhau ra sao?
- Ánh sáng và bóng: Mảng sáng nằm ở đâu? Bóng tập trung dưới phần nhô ra, tại chỗ hai khối chạm nhau hay dọc theo mặt khuất sáng? Rìa bóng sắc hay chuyển qua nhiều mảng nhỏ?
- Viền và nét bên trong: Vị trí nào dùng viền đậm, viền gần màu thân hoặc bỏ viền? Nét bên trong dùng để tách lớp, gợi nếp gấp hay nhấn một chi tiết?
- Cách phân bố chi tiết: Ở kích thước sprite gốc, vùng nào được nhấn bằng các cụm pixel tương phản? Vùng nào được giữ thành mảng lớn để nhân vật dễ đọc?

Chuyển mỗi quan sát được chọn thành một hành động vẽ cụ thể. Chẳng hạn, thay vì ghi “viền chọn lọc”, hãy viết “đặt nét tối ở nơi hai khối chồng lên nhau và dùng viền gần màu thân ở mép sáng”, nếu ảnh thực sự cho thấy cách xử lý đó.

Chỉ kế thừa cách vẽ. Giới tính, khuôn mặt, màu cụ thể, trang phục và đạo cụ do mô tả nhân vật mới quyết định. Nếu một chỉ dẫn phụ thuộc vào chi tiết mà nhân vật mới có thể không có, hãy viết thành câu có điều kiện. Ví dụ: “Nếu lộ mặt, tập trung tương phản quanh mắt và giữ vùng má thành mảng đơn giản.”

Chỉ kết luận từ những gì nhìn thấy trên ảnh. Với một sprite đứng yên, hãy mô tả góc nhìn và tư thế quan sát được. Bỏ qua các góc khuất, chuyển động và hướng sáng mà ảnh chưa cho thấy rõ. Giữ các ước lượng của Python ở vai trò tham khảo.

Trả về đúng một đối tượng JSON:
{
  "style_prompt": "Một đoạn tiếng Anh gồm tối đa 4 câu chỉ dẫn vẽ. Đoạn này phải tự hiểu được khi ghép vào prompt tạo nhân vật mới.",
  "observations": [
    "Các dấu hiệu ngắn bằng tiếng Việt, nêu vị trí cụ thể trên ảnh để người dùng đối chiếu."
  ]
}

Viết ít câu hơn nếu chỉ tìm được ít đặc điểm đáng giữ. Ưu tiên mỗi câu đưa ra một quyết định vẽ cụ thể. Dùng observations để giải thích căn cứ; phần đó sẽ hiển thị trong Hồ sơ mẫu."""


def generate_style_prompt(
    image: Image.Image, python_metrics: dict, api_key: str,
    provider: Literal["gemini", "openai"], base_url: Optional[str] = None,
) -> ReferenceStylePrompt:
    """Gửi ảnh và số đo đến nhà cung cấp đã chọn rồi kiểm tra kết quả."""
    prompt = STYLE_PROMPT_TEMPLATE.replace(
        "{python_metrics_json}", json.dumps(python_metrics, ensure_ascii=False, indent=2),
    )
    ai_provider = AiProviderFactory.get_provider(provider)
    response = ai_provider.analyze_vision(image, api_key, prompt, base_url=base_url)
    return ReferenceStylePrompt.model_validate({**response, "provider": provider})
