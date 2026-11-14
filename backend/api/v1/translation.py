# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Khởi tạo router & xử lý ngoại lệ)
# ========================================================
# (Không có phụ thuộc nền tảng)

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# APIRouter, HTTPException: Định nghĩa các tuyến API và xử lý phản hồi HTTP
from fastapi import APIRouter, HTTPException

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Schemas & Services)
# ========================================================
# Schemas: Cấu trúc dữ liệu yêu cầu và phản hồi cho dịch thuật
from backend.schemas.translation import (
    TranslationRequest,
    BatchTranslationRequest,
    TranslationResponse,
    BatchTranslationResponse,
)
# TranslationService: Dịch vụ dịch thuật offline bằng mô hình nơ-ron CTranslate2
from backend.services.translation_service import TranslationService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


translation_router = APIRouter(prefix="/translate", tags=["Translation (Offline AI)"])


@translation_router.post("", response_model=TranslationResponse)
def translate_text(req: TranslationRequest):
    """
    Dịch một đoạn văn bản đơn lẻ (EN ⇄ VI) hoàn toàn offline trên máy cục bộ.
    Phục vụ chuyển đổi câu Prompt giữa tiếng Anh và tiếng Việt cho người dùng dễ hiểu.
    
    @param req: Yêu cầu gồm text, ngôn ngữ nguồn và ngôn ngữ đích
    @returns: Kết quả dịch thuật kèm trạng thái
    """
    try:
        translated = TranslationService.translate(
            text=req.text,
            source_lang=req.source_lang,
            target_lang=req.target_lang
        )
        return TranslationResponse(
            status="success",
            translated_text=translated,
            source_lang=req.source_lang,
            target_lang=req.target_lang
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi dịch thuật offline: {str(exc)}")


@translation_router.post("/batch", response_model=BatchTranslationResponse)
def translate_batch(req: BatchTranslationRequest):
    """
    Dịch đồng loạt danh sách các đoạn văn bản (ví dụ: mảng 5 frame hoạt họa cùng một lúc).
    
    @param req: Yêu cầu gồm danh sách texts, ngôn ngữ nguồn và ngôn ngữ đích
    @returns: Mảng kết quả dịch tương ứng
    """
    try:
        results = TranslationService.translate_batch(
            texts=req.texts,
            source_lang=req.source_lang,
            target_lang=req.target_lang
        )
        return BatchTranslationResponse(
            status="success",
            translated_texts=results,
            source_lang=req.source_lang,
            target_lang=req.target_lang
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi dịch đồng loạt offline: {str(exc)}")
