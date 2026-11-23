# 1. THƯ VIỆN NỀN TẢNG PYTHON (Luồng hội thoại)
# Không cần thư viện nền tảng bổ sung.

# 2. THƯ VIỆN BÊN NGOÀI
# Dịch vụ không phụ thuộc HTTP.

# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Thông tin xác thực và nhà cung cấp)
from backend.services.ai_credentials_service import AiCredentialsService
from backend.providers.factory import AiProviderFactory

# 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
# Chỉ dẫn hội thoại dùng chung cho các nhà cung cấp.
SYSTEM_ASSISTANT_PROMPT = """
Bạn là Trợ lý AI thông minh tích hợp bên trong Sprite Normalizer & AI Studio.
Nhiệm vụ trọng tâm của bạn:
1. Hướng dẫn người dùng chuẩn hóa sprite 2D, giải phẫu học pixel art, nhận diện hõm cổ (neck_y), căn lề đáy giữa (bottom-center anchor).
2. Hỗ trợ xây dựng prompt tạo ảnh nhân vật game, ma trận sinh chu kỳ bước đi (Walk Cycle 3x5 gồm 15 frame).
3. Hướng dẫn xuất và cấu hình tài nguyên tương thích trực tiếp với Godot Engine 4 (.zip / SpriteFrames / CharacterBody2D).
4. Giải thích các thông số kỹ thuật (độ bão hòa màu HSV, tỷ lệ tương phản, kích thước bounding box).
Nguyên tắc giao tiếp: Trả lời ngắn gọn, chuẩn xác, thân thiện, mang tính hỗ trợ cao và 100% bằng Tiếng Việt.
""".strip()



class ChatConfigurationError(ValueError):
    """Lỗi cấu hình có mã để adapter HTTP ánh xạ phản hồi hiện hành."""

    def __init__(self, status_code, detail):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


class ChatService:
    """Chuẩn bị nhà cung cấp và phát nội dung hội thoại độc lập với SSE."""

    @staticmethod
    def prepare_stream(request, db):
        """Xác thực cấu hình trước khi mở luồng, trả bộ lặp nội dung trì hoãn."""
        # 1. Kiểm tra trạng thái cờ bật/tắt AI của dự án
        if not AiCredentialsService.is_ai_enabled(project_id=request.project_id, db=db):
            raise ChatConfigurationError(
                status_code=403,
                detail="Tính năng AI đang bị tắt trong dự án này. Vui lòng bật lại trong Cài đặt dự án."
            )
    
        # 2. Phân giải thông tin xác thực AI qua dịch vụ hợp nhất 3 cấp (Client -> Project DB -> .env)
        resolved_key, provider_name, resolved_base_url = AiCredentialsService.resolve_credentials(
            project_id=request.project_id,
            api_key=request.api_key,
            provider=request.provider,
            base_url=request.base_url,
            db=db
        )
    
        # Nếu dùng máy chủ nội bộ (Ollama Local) thì không bắt buộc phải có API key thật
        is_local_provider = resolved_base_url and ("localhost" in resolved_base_url or "127.0.0.1" in resolved_base_url)
        if not resolved_key and not is_local_provider:
            raise ChatConfigurationError(
                status_code=400,
                detail="Chưa cấu hình API Key. Vui lòng nhập khóa API hoặc cấu hình trong Cài đặt dự án."
            )
    
        effective_key = resolved_key or "local-key"
    
        # Lấy đối tượng Provider tương ứng thông qua Factory (Đa hình)
        try:
            provider = AiProviderFactory.get_provider(provider_name)
        except Exception as e:
            raise ChatConfigurationError(
                status_code=400,
                detail=f"Không tìm thấy nhà cung cấp AI '{provider_name}': {str(e)}"
            )

        def chunks():
            """Chỉ chuyển đổi lịch sử khi luồng bắt đầu được tiêu thụ."""
            raw_messages = [msg.model_dump() for msg in request.messages]
            # Kích hoạt luồng phát sinh từ từ mô hình AI
            yield from provider.stream_chat(
                messages=raw_messages, api_key=effective_key, base_url=resolved_base_url,
                system_instruction=SYSTEM_ASSISTANT_PROMPT,
            )
        return chunks()
