"""
Module: backend.services.ai_credentials_service
Mục đích: Dịch vụ hợp nhất phân giải thông tin xác thực AI (API Key, Provider, Base URL) và kiểm tra cờ AI của dự án.
Ai gọi nó: `ImageGenService`, `project_service`.
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
from typing import Optional, Tuple

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

    @staticmethod
    def _scope_value(scope: str, name: str) -> Optional[str]:
        """Đọc giá trị không rỗng của nghiệp vụ chat hoặc analysis từ môi trường."""
        if scope not in {"chat", "analysis"}:
            return None
        return os.getenv(f"{scope.upper()}_{name}", "").strip() or None

    @classmethod
    def resolve_credentials(
        cls,
        project_id: Optional[int] = None,
        api_key: Optional[str] = None,
        provider: Optional[str] = None,
        base_url: Optional[str] = None,
        db: Optional[Session] = None,
        project_service: Optional[ProjectService] = None,
        scope: str = "general",
    ) -> Tuple[Optional[str], str, Optional[str]]:
        """
        Xác định thông tin xác thực hiệu lực (API Key, Provider, Base URL) theo đúng thứ tự ưu tiên nghiệp vụ.

        @param {Optional[int]} project_id Mã dự án (nếu có).
        @param {Optional[str]} api_key Khóa API truyền trực tiếp.
        @param {Optional[str]} provider Nhà cung cấp AI truyền trực tiếp.
        @param {Optional[str]} base_url Địa chỉ máy chủ proxy truyền trực tiếp.
        @param {Optional[Session]} db Phiên CSDL tùy chọn.
        @param {Optional[ProjectService]} project_service Đối tượng ProjectService tùy chọn.
        @param {str} scope Nghiệp vụ chat, analysis hoặc general để chọn cấu hình môi trường riêng.
        @returns {Tuple[Optional[str], str, Optional[str]]} (api_key, provider, base_url).
        """
        if scope == "image_gen":
            config = cls.resolve_image_configuration(project_id, api_key, provider, base_url, db=db, project_service=project_service)
            return config["api_key"], config["provider"], config["base_url"]

        # Cấu hình nghiệp vụ được ưu tiên trước CSDL; tham số trực tiếp vẫn đứng đầu.
        scoped_provider = cls._scope_value(scope, "AI_PROVIDER")
        use_scope = not provider or not scoped_provider or provider.strip().lower() == scoped_provider.lower()
        eff_key = api_key or (cls._scope_value(scope, "API_KEY") if use_scope else None)
        eff_prov = provider or scoped_provider
        eff_base = base_url or (cls._scope_value(scope, "BASE_URL") if use_scope else None)

        # 1. Tra cứu CSDL dự án nếu thiếu key và có project_id
        if not eff_key and project_id:
            try:
                service = project_service or ProjectService()
                if db is not None:
                    eff_key, eff_prov, eff_base = service.resolve_project_credentials(
                        db=db,
                        project_id=project_id,
                        api_key=eff_key,
                        provider=eff_prov,
                        base_url=eff_base,
                    )
                else:
                    with SessionLocal() as session:
                        eff_key, eff_prov, eff_base = service.resolve_project_credentials(
                            db=session,
                            project_id=project_id,
                            api_key=eff_key,
                            provider=eff_prov,
                            base_url=eff_base,
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
        scope: str = "general",
    ) -> bool:
        """
        Kiểm tra cờ kích hoạt AI của một dự án (mặc định True nếu không cấu hình hoặc không có project_id).

        @param {Optional[int]} project_id Mã dự án.
        @param {Optional[Session]} db Phiên CSDL tùy chọn.
        @param {Optional[ProjectService]} project_service Đối tượng ProjectService tùy chọn.
        @param {str} scope Nghiệp vụ được phép dùng khóa máy chủ để vượt cờ AI của dự án.
        @returns {bool} True nếu tính năng AI đang được bật, ngược lại False.
        """
        # Khóa máy chủ cho nghiệp vụ hiện tại cho phép dùng AI dù cờ dự án đang tắt.
        env_keys = [cls._scope_value(scope, "API_KEY")]
        fallback_provider = (cls._scope_value(scope, "AI_PROVIDER") or os.getenv("AI_PROVIDER", "gemini")).strip().lower()
        env_keys.append(os.getenv("OPENAI_API_KEY" if fallback_provider == "openai" else "GEMINI_API_KEY", ""))
        if scope != "image_gen" and any(key and key.strip() and not any(marker in key.lower() for marker in (
            "your-", "your_", "cua_ban", "của_bạn", "placeholder",
        )) for key in env_keys):
            return True
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

    @classmethod
    def resolve_model(
        cls,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        project_id: Optional[int] = None,
        model_type: str = "vision",
        db: Optional[Session] = None,
        project_service: Optional[ProjectService] = None,
        scope: str = "general",
    ) -> Optional[str]:
        """
        Xác định tên mô hình hiệu dụng theo thứ tự ưu tiên:
        1. Model truyền trực tiếp từ Client.
        2. Model lưu trong CSDL của Dự án (vision_model, image_gen_model, chat_model).
        3. Biến môi trường hệ thống (GEMINI_MODEL hoặc OPENAI_MODEL).

        @param {Optional[str]} provider Nhà cung cấp AI ('gemini' hoặc 'openai').
        @param {Optional[str]} model Tên mô hình truyền trực tiếp (nếu có).
        @param {Optional[int]} project_id Mã dự án (nếu có).
        @param {str} model_type Loại mô hình: 'vision', 'image_gen' hoặc 'chat'.
        @param {Optional[Session]} db Phiên CSDL tùy chọn.
        @param {Optional[ProjectService]} project_service Đối tượng ProjectService tùy chọn.
        @param {str} scope Nghiệp vụ chat, analysis hoặc general để chọn mô hình riêng.
        @returns {Optional[str]} Tên mô hình hiệu dụng hoặc None nếu để mặc định theo Provider.
        """
        # 1. Ưu tiên model truyền trực tiếp
        if model and model.strip():
            return model.strip()

        if scope == "image_gen":
            try:
                return cls.resolve_image_configuration(project_id, provider=provider, db=db, project_service=project_service)["model"]
            except Exception as exc:
                # Model là tùy chọn: khi không đọc được CSDL, giữ mặc định của provider.
                logging.warning("Không thể đọc mô hình tạo ảnh của dự án: %s", type(exc).__name__)
                return None

        # Mô hình nghiệp vụ đi cùng khóa và địa chỉ nghiệp vụ, trước cấu hình dự án.
        scoped_provider = cls._scope_value(scope, "AI_PROVIDER")
        scoped_model = cls._scope_value(scope, "MODEL")
        if scoped_model and (not provider or not scoped_provider or provider.strip().lower() == scoped_provider.lower()):
            return scoped_model

        # 2. Ưu tiên model cấu hình trong CSDL dự án
        if project_id:
            try:
                service = project_service or ProjectService()
                cfg = None
                if db is not None:
                    cfg = service.get_api_config(db, project_id)
                else:
                    with SessionLocal() as session:
                        cfg = service.get_api_config(session, project_id)

                if cfg:
                    key_map = {
                        "vision": "vision_model",
                        "image_gen": "image_gen_model",
                        "chat": "chat_model"
                    }
                    col_key = key_map.get(model_type, "vision_model")
                    saved_model = cfg.get(col_key)
                    if saved_model and saved_model.strip():
                        return saved_model.strip()
            except Exception:
                pass

        # 3. Biến môi trường hệ thống
        clean_provider = (provider or os.getenv("AI_PROVIDER", "gemini")).lower().strip()
        env_var = "OPENAI_MODEL" if clean_provider == "openai" else "GEMINI_MODEL"
        env_model = os.getenv(env_var)
        return env_model.strip() if env_model and env_model.strip() else None

    @classmethod
    def resolve_image_configuration(
        cls, project_id=None, api_key=None, provider=None, base_url=None, model=None,
        db=None, project_service=None,
    ) -> dict:
        """Phân giải tạo ảnh: tham số trực tiếp, key dự án, rồi mặc định hệ thống.

        @param project_id Mã dự án cần đọc cấu hình riêng.
        @param api_key, provider, base_url, model Các giá trị ghi đè trực tiếp.
        @param db, project_service Phiên CSDL và dịch vụ dự án tùy chọn.
        @returns Bộ cấu hình nội bộ có khóa bí mật, mô hình và nguồn cấu hình.
        """
        config = {}
        if project_id:
            service = project_service or ProjectService()
            if db is not None:
                config = service.get_api_config(db, project_id) or {}
            else:
                with SessionLocal() as session:
                    config = service.get_api_config(session, project_id) or {}

        # Chỉ key đã lưu của provider đang chọn mới được coi là cấu hình riêng.
        system_provider = (os.getenv("IMAGE_GEN_PROVIDER") or os.getenv("AI_PROVIDER", "gemini")).strip().lower()
        project_provider = (provider or config.get("api_provider") or system_provider).strip().lower()
        project_key = (config.get(f"_{project_provider}_raw_key") or "").strip()
        source = "request" if api_key and api_key.strip() else "project" if project_key else "system"
        effective_provider = (provider or (project_provider if project_key else system_provider)).strip().lower()
        matches_system = effective_provider == system_provider
        legacy_key = {"openai": "OPENAI_API_KEY", "cloudflare": "CLOUDFLARE_API_TOKEN"}.get(effective_provider, "GEMINI_API_KEY")
        system_key = (os.getenv("IMAGE_GEN_API_KEY", "").strip() if matches_system else "") or os.getenv(legacy_key, "").strip()
        if effective_provider == "cloudflare":
            # Token riêng không bị thay bằng IMAGE_GEN_API_KEY cũ của OpenAI/Gemini.
            system_key = os.getenv("CLOUDFLARE_API_TOKEN", "").strip()
        key = (api_key or "").strip() or project_key or system_key

        # Không ghép key dự án với địa chỉ hay model của một provider hệ thống khác.
        if source in {"request", "project"}:
            resolved_base = base_url or (config.get("openai_base_url") if project_key else None)
            resolved_model = model or (config.get("image_gen_model") if project_key else None)
        else:
            resolved_base = base_url or (os.getenv("IMAGE_GEN_BASE_URL") if matches_system else None)
            resolved_model = model or (os.getenv("IMAGE_GEN_MODEL") if matches_system else None)
        if effective_provider == "openai" and not resolved_base:
            resolved_base = os.getenv("OPENAI_BASE_URL") if source == "system" else None
            resolved_base = resolved_base or "https://api.openai.com/v1"
        if effective_provider == "cloudflare":
            resolved_model = model or os.getenv("CLOUDFLARE_MODEL_ID", "").strip() or resolved_model
            resolved_base = None  # REST endpoint Cloudflare được adapter xây dựng từ Account ID.
        clean_model = resolved_model.strip() if resolved_model and resolved_model.strip() else None
        # Không đưa khóa nhập nhầm vào model xuống giao diện hoặc thông báo lỗi.
        if clean_model and (clean_model.startswith(("sk-", "AIza")) or clean_model == key):
            raise ValueError(
                "Cấu hình model tạo ảnh không hợp lệ: IMAGE_GEN_MODEL phải là tên model, không phải API key. "
                "Hãy nhập API key vào IMAGE_GEN_API_KEY."
            )
        if effective_provider == "gemini" and key and key.startswith("sk-"):
            raise ValueError(
                "IMAGE_GEN_PROVIDER đang là gemini nhưng key có dạng OpenAI. "
                "Nếu dùng OpenAI hoặc dịch vụ tương thích, hãy đặt IMAGE_GEN_PROVIDER=openai "
                "và IMAGE_GEN_BASE_URL theo dịch vụ của bạn."
            )
        return {
            "api_key": key or None, "provider": effective_provider,
            "base_url": resolved_base.strip() if resolved_base else None,
            "model": clean_model,
            "config_source": source if key else "missing",
            "ready": bool(key) and (effective_provider != "cloudflare" or bool(
                os.getenv("CLOUDFLARE_ACCOUNT_ID", "").strip() and clean_model)),
        }
