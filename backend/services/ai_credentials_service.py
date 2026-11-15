"""
Module: backend.services.ai_credentials_service
Mục đích: Dịch vụ hợp nhất phân giải thông tin xác thực AI (API Key, Provider, Base URL) và kiểm tra cờ AI của dự án.
Ai gọi nó: `CharacterAnalysisService`, `ImageGenService`, router `character_analysis`, `project_service`.
Tại sao tồn tại: Giải quyết dứt điểm Code Smell SM-05 (DRY Violation) - loại bỏ việc lặp lại 4 lần logic bóc tách thông tin xác thực và 5 lần kiểm tra trạng thái cờ `ai_enabled` của dự án.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống, Logging & Kiểu)
# ========================================================
# logging: Ghi nhận nhật ký cảnh báo lỗi kết nối CSDL
import logging
# os: Đọc biến môi trường hệ thống
import os
# typing: Khai báo kiểu bộ giá trị, tùy chọn, từ điển
from typing import Optional, Tuple, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Phiên làm việc cơ sở dữ liệu
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Database & Services)
# ========================================================
# SessionLocal: Tạo phiên làm việc CSDL MySQL khi không có session truyền vào
from backend.db import SessionLocal
# ProjectService: Dịch vụ dự án hỗ trợ đọc cấu hình API Key từ CSDL
from backend.services.project_service import ProjectService

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class AiCredentialsService:
    """
    Dịch vụ Hợp Nhất Phân Giải Thông Tin Xác Thực AI (AI Credentials & Status Resolver).
    
    Quy tắc nghiệp vụ chuẩn hóa:
    1. Thứ tự ưu tiên thông tin xác thực:
       - Mức 1: Khóa API, Provider hoặc Base URL truyền trực tiếp từ Client.
       - Mức 2: Cấu hình lưu trữ trong CSDL MySQL của Dự án (nếu có `project_id`).
       - Mức 3: Biến môi trường hệ thống toàn cục (`.env` / `os.getenv`).
    2. Trạng thái `ai_enabled`:
       - Mặc định là `True`.
       - Nếu có `project_id`, tra cứu CSDL MySQL; nếu cờ `ai_enabled` là `False` thì trả về `False`.
    """

    @classmethod
    def resolve_credentials(
        cls,
        project_id: Optional[int] = None,
        api_key: Optional[str] = None,
        provider: Optional[str] = None,
        base_url: Optional[str] = None,
        db: Optional[Session] = None,
        project_service: Optional[ProjectService] = None,
    ) -> Tuple[Optional[str], str, Optional[str]]:
        """
        Xác định thông tin xác thực hiệu lực (API Key, Provider, Base URL) theo đúng thứ tự ưu tiên nghiệp vụ.

        @param {Optional[int]} project_id Mã dự án (nếu có).
        @param {Optional[str]} api_key Khóa API truyền trực tiếp.
        @param {Optional[str]} provider Nhà cung cấp AI truyền trực tiếp.
        @param {Optional[str]} base_url Địa chỉ máy chủ proxy truyền trực tiếp.
        @param {Optional[Session]} db Phiên CSDL tùy chọn.
        @param {Optional[ProjectService]} project_service Đối tượng ProjectService tùy chọn.
        @returns {Tuple[Optional[str], str, Optional[str]]} (api_key, provider, base_url).
        """
        eff_key = api_key
        eff_prov = provider
        eff_base = base_url

        # 1. Tra cứu CSDL dự án nếu thiếu key và có project_id
        if not eff_key and project_id:
            try:
                service = project_service or ProjectService()
                if db is not None:
                    eff_key, eff_prov, eff_base = service.resolve_project_credentials(
                        db=db,
                        project_id=project_id,
                        api_key=api_key,
                        provider=provider,
                        base_url=base_url,
                    )
                else:
                    with SessionLocal() as session:
                        eff_key, eff_prov, eff_base = service.resolve_project_credentials(
                            db=session,
                            project_id=project_id,
                            api_key=api_key,
                            provider=provider,
                            base_url=base_url,
                        )
            except Exception as exc:
                logging.warning(f"Không thể đọc cấu hình API Key từ CSDL dự án {project_id}: {exc}")

        # 2. Tra cứu biến môi trường hệ thống (.env) nếu vẫn chưa có
        clean_provider = (eff_prov or os.getenv("AI_PROVIDER", "gemini")).lower().strip()
        clean_base = eff_base or os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

        if not eff_key:
            env_var = "OPENAI_API_KEY" if clean_provider == "openai" else "GEMINI_API_KEY"
            eff_key = os.getenv(env_var)

        return eff_key, clean_provider, clean_base

    @classmethod
    def is_ai_enabled(
        cls,
        project_id: Optional[int],
        db: Optional[Session] = None,
        project_service: Optional[ProjectService] = None,
    ) -> bool:
        """
        Kiểm tra cờ kích hoạt AI của một dự án (mặc định True nếu không cấu hình hoặc không có project_id).

        @param {Optional[int]} project_id Mã dự án.
        @param {Optional[Session]} db Phiên CSDL tùy chọn.
        @param {Optional[ProjectService]} project_service Đối tượng ProjectService tùy chọn.
        @returns {bool} True nếu tính năng AI đang được bật, ngược lại False.
        """
        if not project_id:
            return True

        try:
            service = project_service or ProjectService()
            if db is not None:
                cfg = service.get_api_config(db, project_id)
            else:
                with SessionLocal() as session:
                    cfg = service.get_api_config(session, project_id)

            if cfg and cfg.get("ai_enabled") is False:
                return False
        except Exception:
            pass

        return True
