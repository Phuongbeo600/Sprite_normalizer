# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo router)
# ========================================================
# (Không có phụ thuộc nền tảng)

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# APIRouter: Bộ định tuyến chính của FastAPI để gom các sub-router
from fastapi import APIRouter

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (V1 Sub-routers)
# ========================================================
# projects_router: Phân hệ quản lý dự án CRUD MySQL (/api/projects)
from backend.api.v1.projects import projects_router
# sprites_router: Phân hệ chuẩn hóa và phân tích giải phẫu (/api/normalize, /api/analyze)
from backend.api.v1.sprites import sprites_router
# prompt_router: Phân hệ cố vấn prompt AI & toán học nghịch đảo (/api/prompt-advice)
from backend.api.v1.prompt import prompt_router
# settings_router: Phân hệ cấu hình hệ thống & API Key (/api/settings)
from backend.api.v1.settings import settings_router
# character_analysis_router: Phân hệ phân tích hồ sơ nhân vật tham chiếu theo Tab (/api/character-profile)
from backend.api.v1.character_analysis import character_analysis_router
# image_gen_router: Phân hệ tạo ảnh nhân vật / sprite bằng mô hình AI (/api/image-gen)
from backend.api.v1.image_gen import image_gen_router

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

api_router = APIRouter(prefix="/api")

# Gắn các sub-router phân hệ vào router chính
api_router.include_router(projects_router)
api_router.include_router(sprites_router)
api_router.include_router(prompt_router)
api_router.include_router(settings_router)
api_router.include_router(character_analysis_router)
api_router.include_router(image_gen_router)


@api_router.get("/health", tags=["Health Check"])
def health_check():
    """Kiểm tra trạng thái hoạt động của máy chủ backend."""
    return {"status": "ok", "message": "Sprite Normalizer Backend is running smoothly!"}
