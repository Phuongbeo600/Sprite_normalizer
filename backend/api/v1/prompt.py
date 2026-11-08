# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu)
# ========================================================
# typing: Định nghĩa các kiểu từ điển
from typing import Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# fastapi: Khởi tạo router và xử lý ngoại lệ HTTP
from fastapi import APIRouter, HTTPException

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services & Schemas)
# ========================================================
# PromptAdviceRequest: DTO dữ liệu yêu cầu
from backend.schemas.prompt import PromptAdviceRequest
# PromptService: Dịch vụ cố vấn prompt và toán học nghịch đảo
from backend.services.prompt_service import PromptService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

prompt_router = APIRouter(tags=["AI Prompt Advisor"])


@prompt_router.post("/prompt-advice")
async def generate_prompt_advice(request: PromptAdviceRequest):
    """
    Cố vấn Prompt AI & Động cơ toán học nghịch đảo:
    - Tính toán kích thước đầu và chiều cao cần sinh trên khung AI 1024x1024 để khớp với sprite mẫu.
    - Sinh Positive Prompt và Negative Prompt tối ưu cho Midjourney / DALL-E / Stable Diffusion.
    """
    try:
        data = PromptService.generate_prompt_advice(request)
        return {
            "status": "success",
            "message": data.get("api_status", "Sinh Prompt thành công!"),
            "data": data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi sinh Prompt cố vấn: {str(e)}")
