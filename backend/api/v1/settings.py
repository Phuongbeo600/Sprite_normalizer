# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc & Kiểu dữ liệu)
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
# Schemas: DTO kiểm tra dữ liệu cấu hình
from backend.schemas.settings import SettingsResponse, SettingsUpdateRequest, TestApiKeyRequest
# SettingsService: Dịch vụ cấu hình hệ thống
from backend.services.settings_service import SettingsService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

settings_router = APIRouter(prefix="/settings", tags=["Cấu hình Hệ thống"])


@settings_router.get("", response_model=SettingsResponse)
async def get_settings():
    """Lấy thông tin cấu hình hiện tại và các API key đã được che dấu."""
    try:
        return SettingsService.get_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Không thể đọc cấu hình: {str(e)}")


@settings_router.post("")
async def save_settings(request: SettingsUpdateRequest):
    """Lưu và kích hoạt cấu hình nhà cung cấp AI & API key vào .env."""
    try:
        return SettingsService.save_settings(
            provider=request.provider,
            gemini_api_key=request.gemini_api_key,
            openai_api_key=request.openai_api_key,
            openai_base_url=request.openai_base_url
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Không thể lưu cấu hình: {str(e)}")


@settings_router.post("/test-key")
async def test_api_key(request: TestApiKeyRequest):
    """
    Kiểm tra nhanh kết nối tới Google Gemini hoặc OpenAI ChatGPT
    thông qua tính Đa hình của AI Provider Factory.
    """
    result = SettingsService.test_api_key(
        provider=request.provider,
        api_key=request.api_key,
        base_url=request.base_url
    )
    if result["status"] == "error":
        return result
    return result
