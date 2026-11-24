# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu)
# ========================================================
# typing: Định nghĩa các kiểu từ điển và giá trị tùy chọn
from typing import Dict, Any, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# fastapi: Khởi tạo router, xử lý ngoại lệ HTTP, Dependency Injection và tham số truy vấn
from fastapi import APIRouter, HTTPException, Query, Depends
# sqlalchemy: Phiên làm việc cơ sở dữ liệu
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Services & Schemas)
# ========================================================
# get_db: Dependency cấp phiên MySQL
from backend.db import get_db
# get_current_user_optional, check_project_access: Kiểm soát quyền truy cập và bảo vệ API key dự án
from backend.core.dependencies import get_current_user_optional, check_project_access
# Schemas: DTO kiểm tra dữ liệu yêu cầu và phản hồi sinh ảnh
from backend.schemas.image_gen import ImageGenRequest, ImageGenResponse
# ImageGenService: Dịch vụ tích hợp tạo ảnh AI qua Gemini Imagen 3 hoặc OpenAI DALL-E 3
from backend.services.image_gen_service import ImageGenService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

image_gen_router = APIRouter(prefix="/image-gen", tags=["AI Image Generator"])


@image_gen_router.get("/status")
def get_image_gen_status(
    project_id: Optional[int] = Query(None, description="Mã dự án để kiểm tra khóa API"),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Kiểm tra trạng thái cấu hình nhà cung cấp và khóa API hiện hành (có kiểm tra quyền sở hữu nếu truyền project_id).
    Hàm này chỉ đọc cấu hình bộ nhớ/CSDL, hoàn toàn KHÔNG gọi ra ngoài nên tiêu tốn 0 token.
    """
    if project_id is not None:
        check_project_access(db, project_id, current_user)
    try:
        return ImageGenService.get_status(project_id=project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Không thể kiểm tra cấu hình tạo ảnh: {str(e)}")


@image_gen_router.post("/generate", response_model=ImageGenResponse)
def generate_image(
    request: ImageGenRequest,
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """
    Tạo ảnh nhân vật / sprite bằng mô hình AI (Google Imagen 3 hoặc OpenAI DALL-E 3).
    Sử dụng hàm đồng bộ (def) để FastAPI tự động chuyển giao tác vụ gọi mạng HTTP kéo dài
    vào Starlette ThreadPool, giải phóng hoàn toàn Event Loop cho các người dùng khác.
    RÀNG BUỘC BẢO MẬT: Nếu truyền project_id, bắt buộc phải kiểm tra quyền sở hữu dự án để tránh dùng chùa API key.
    """
    if request.project_id is not None:
        check_project_access(db, request.project_id, current_user)
    try:
        return ImageGenService.generate_images(request)
    except HTTPException:
        raise
    except ValueError as ve:
        # Lỗi người dùng (thiếu key, vi phạm chính sách prompt, tham số không hợp lệ)
        raise HTTPException(status_code=400, detail=str(ve))
    except RuntimeError as re:
        # Lỗi kết nối hoặc lỗi dịch vụ từ nhà cung cấp
        raise HTTPException(status_code=502, detail=str(re))
    except Exception as e:
        # Lỗi hệ thống bất ngờ
        raise HTTPException(status_code=500, detail=f"Lỗi không xác định khi tạo ảnh: {str(e)}")
