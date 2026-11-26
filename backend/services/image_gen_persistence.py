# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Mã hóa, Biểu thức & Thời gian)
# ========================================================
# b64decode: Giải mã chuỗi Base64 của ảnh gốc và ảnh sau hậu xử lý sang bytes PNG
from base64 import b64decode
# logging: Ghi nhận cảnh báo khi lưu CSDL thất bại mà không làm mất ảnh AI
import logging
# re: Làm sạch tên tệp gợi nhớ từ câu mô tả prompt
import re
# time: Tạo hậu tố thời gian tránh trùng tên hiển thị giữa các lần sinh ảnh
import time
# typing: Định nghĩa kiểu dữ liệu đầu vào/ra tùy chọn
from typing import Any, Dict, List, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# Session: Kiểu phiên làm việc SQLAlchemy khi truyền từ bên gọi
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Database, Repositories & Schemas)
# ========================================================
# SessionLocal: Mở phiên kết nối MySQL ngắn hạn sau khi API AI đã trả kết quả
from backend.db import SessionLocal
# SpriteRepository: Lưu cặp ảnh gốc, ảnh hậu xử lý và danh sách frame con vào MySQL
from backend.repositories.sprite_repository import SpriteRepository
# Schemas: DTO yêu cầu và phản hồi tạo ảnh AI
from backend.schemas.image_gen import GeneratedImageItem, ImageGenRequest, ImageGenResponse

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & CẤU HÌNH (Logger)
# ========================================================
logger = logging.getLogger(__name__)


def _build_generated_sprite_name(prompt: str, index: int) -> str:
    """Tạo tên tệp PNG ngắn gọn, an toàn từ prompt và dấu thời gian hiện tại."""
    # Lấy tối đa 40 ký tự đầu hợp lệ để tên thẻ hiển thị gọn trong Kho Tài Nguyên
    cleaned = re.sub(r"[^\w\s-]", "", (prompt or "").strip(), flags=re.UNICODE)
    slug = re.sub(r"[-\s]+", "_", cleaned).strip("_")[:40] or "ai_sprite"
    stamp = int(time.time())
    return f"{slug}_{stamp}_{index}.png"


def _extract_processed_payload(item: GeneratedImageItem) -> tuple[Optional[bytes], List[Dict[str, Any]]]:
    """Tách ảnh sheet đã hậu xử lý và danh sách frame con (nếu hậu xử lý thành công)."""
    post = item.post_processing
    if not post or post.status != "success" or not post.frames:
        return None, []

    processed_bytes: Optional[bytes] = None
    if post.sheet_b64_data:
        processed_bytes = b64decode(post.sheet_b64_data, validate=True)

    frames_payload: List[Dict[str, Any]] = []
    for idx, frame in enumerate(post.frames, start=1):
        frames_payload.append({
            "index": idx,
            "name": frame.name,
            "bytes": b64decode(frame.b64_data, validate=True),
            "size": [frame.width, frame.height],
            "metadata": {
                "width": frame.width,
                "height": frame.height,
                "row": frame.row + 1,
                "col": frame.column + 1,
            },
        })
    return processed_bytes, frames_payload


def save_generated_images_to_project(
    request: ImageGenRequest,
    response: ImageGenResponse,
    db: Optional[Session] = None,
    repository: Optional[SpriteRepository] = None,
) -> ImageGenResponse:
    """
    Lưu ảnh gốc trả về từ API tạo ảnh AI cùng ảnh đã hậu xử lý và các frame con vào MySQL
    để hiển thị ngay trong Kho Tài Nguyên Dự Án (tab Kho Ảnh Sprite).

    @param request Yêu cầu sinh ảnh chứa project_id, prompt và kích thước chuẩn.
    @param response Phản hồi chứa danh sách ảnh gốc và kết quả hậu xử lý.
    @param db Phiên SQLAlchemy tùy chọn (dùng trong kiểm thử hoặc truyền sẵn).
    @param repository Kho lưu trữ SpriteRepository tùy chọn.
    @returns Phản hồi đã được cập nhật saved_sprite_id và saved_to_project cho từng ảnh.
    """
    if request.project_id is None or not response.images:
        return response

    repo = repository or SpriteRepository()
    owns_session = db is None
    session = db if db is not None else SessionLocal()

    try:
        for idx, item in enumerate(response.images, start=1):
            try:
                raw_bytes = b64decode(item.b64_data, validate=True)
                processed_bytes, frames_payload = _extract_processed_payload(item)
                post = item.post_processing
                metadata: Dict[str, Any] = {
                    "source": "ai_image_gen",
                    "provider_used": response.provider_used,
                    "model_used": response.model_used,
                    "prompt": request.prompt,
                    "aspect_ratio": item.aspect_ratio,
                    "native_size_wh": list(request.native_size_wh) if request.native_size_wh else None,
                    "post_processing_status": post.status if post else None,
                    "post_processing_message": post.message if post else None,
                    "rows": post.rows if post else 3,
                    "columns": post.columns if post else 5,
                }
                saved = repo.save_generated_sprite_pack(
                    db=session,
                    project_id=request.project_id,
                    name=_build_generated_sprite_name(request.prompt, idx),
                    raw_image_bytes=raw_bytes,
                    processed_image_bytes=processed_bytes,
                    frames=frames_payload,
                    folder_name="Tạo ảnh AI",
                    metadata=metadata,
                )
                item.saved_sprite_id = saved["sprite_id"]
                item.saved_to_project = True
            except Exception:
                # Không làm mất ảnh AI đã sinh thành công nếu ghi MySQL gặp sự cố
                logger.exception("Không thể lưu ảnh AI thứ %s vào dự án %s", idx, request.project_id)
                if hasattr(session, "rollback"):
                    session.rollback()
    finally:
        if owns_session and hasattr(session, "close"):
            session.close()

    return response
