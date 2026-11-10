"""
Module: backend.services.project_service
Mục đích: Dịch vụ nghiệp vụ quản lý dự án (Project Service).
Ai gọi nó: API router `backend.api.v1.projects` và `backend.api.v1.character_analysis`.
Tại sao tồn tại: Đóng vai trò lớp trung gian độc lập kiểm tra tính hợp lệ dữ liệu, giải quyết thông tin xác thực API Key từ MySQL, và quản lý các bản ghi cấu hình Preset nhân vật.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc & Kiểu dữ liệu)
# ========================================================
# typing: Khai báo kiểu danh sách, từ điển, tùy chọn, bộ giá trị
from typing import List, Optional, Dict, Any, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Phiên làm việc cơ sở dữ liệu
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Repositories & Schemas)
# ========================================================
# ProjectRepository: Tầng truy cập dữ liệu bảng projects
from backend.repositories.project_repository import ProjectRepository
# CharacterPresetRepository: Tầng truy cập dữ liệu bảng project_character_presets
from backend.repositories.character_preset_repository import CharacterPresetRepository

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class ProjectService:
    """
    Dịch vụ nghiệp vụ Quản lý Dự án (Project Service).
    Đóng vai trò trung gian giữa Router và Repository:
    - Quản lý thông tin dự án (CRUD).
    - Quản lý cấu hình API Key độc lập theo từng dự án.
    - Quản lý lịch sử bản phân tích và Prompt nhân vật (Presets).
    """

    def __init__(
        self,
        repository: Optional[ProjectRepository] = None,
        preset_repository: Optional[CharacterPresetRepository] = None
    ):
        """Khởi tạo ProjectService với Dependency Injection."""
        self.repository = repository or ProjectRepository()
        self.preset_repository = preset_repository or CharacterPresetRepository()

    def get_all_projects(self, db: Session) -> List[Dict[str, Any]]:
        """Lấy toàn bộ danh sách dự án."""
        return self.repository.get_all(db)

    def get_project_by_id(self, db: Session, project_id: int) -> Optional[Dict[str, Any]]:
        """Lấy thông tin chi tiết của một dự án."""
        return self.repository.get_by_id(db, project_id)

    def create_project(self, db: Session, name: str) -> Dict[str, Any]:
        """Tạo một dự án mới kèm kiểm tra tính hợp lệ dữ liệu."""
        clean_name = name.strip()
        if not clean_name:
            raise ValueError("Tên dự án không được để trống.")
        if len(clean_name) > 255:
            raise ValueError("Tên dự án không được vượt quá 255 ký tự.")
        return self.repository.create(db, name=clean_name)

    def update_project(self, db: Session, project_id: int, name: str) -> bool:
        """Cập nhật tên dự án."""
        clean_name = name.strip()
        if not clean_name:
            raise ValueError("Tên dự án không được để trống.")
        return self.repository.update(db, project_id, clean_name)

    def delete_project(self, db: Session, project_id: int) -> bool:
        """Xóa dự án khỏi cơ sở dữ liệu."""
        return self.repository.delete(db, project_id)

    # ========================================================
    # NGHIỆP VỤ CẤU HÌNH API KEY THEO TỪNG DỰ ÁN
    # ========================================================
    def get_api_config(self, db: Session, project_id: int) -> Dict[str, Any]:
        """Lấy thông tin cấu hình API Key của một dự án."""
        config = self.repository.get_api_config(db, project_id)
        if not config:
            raise ValueError(f"Không tìm thấy dự án với ID = {project_id}")
        return config

    def resolve_project_credentials(
        self,
        db: Session,
        project_id: Optional[int],
        api_key: Optional[str] = None,
        provider: Optional[str] = None,
        base_url: Optional[str] = None
    ) -> Tuple[Optional[str], str, Optional[str]]:
        """
        Xác định thông tin xác thực API hiệu lực (API Key, Provider, Base URL).
        Ưu tiên thông tin truyền trực tiếp từ client; nếu thiếu và có project_id sẽ tra cứu từ CSDL dự án.
        """
        eff_key = api_key
        eff_prov = provider
        eff_base = base_url

        if not eff_key and project_id:
            cfg = self.repository.get_api_config(db, project_id)
            if cfg:
                eff_prov = eff_prov or cfg.get("api_provider")
                if eff_prov == "openai":
                    eff_key = cfg.get("_openai_raw_key")
                else:
                    eff_key = cfg.get("_gemini_raw_key")
                eff_base = eff_base or cfg.get("openai_base_url")

        return eff_key, eff_prov or "gemini", eff_base

    def update_api_config(
        self,
        db: Session,
        project_id: int,
        api_provider: str = "gemini",
        gemini_api_key: Optional[str] = None,
        openai_api_key: Optional[str] = None,
        openai_base_url: Optional[str] = None
    ) -> bool:
        """Cập nhật cấu hình API Key của dự án trong MySQL."""
        project = self.repository.get_by_id(db, project_id)
        if not project:
            raise ValueError(f"Không tìm thấy dự án với ID = {project_id}")

        return self.repository.update_api_config(
            db=db,
            project_id=project_id,
            api_provider=api_provider,
            gemini_api_key=gemini_api_key,
            openai_api_key=openai_api_key,
            openai_base_url=openai_base_url
        )

    # ========================================================
    # NGHIỆP VỤ LƯU TRỮ BẢN PHÂN TÍCH & PROMPT (PRESETS)
    # ========================================================
    def get_character_presets(self, db: Session, project_id: int) -> List[Dict[str, Any]]:
        """Lấy danh sách các bản phân tích & prompt đã lưu của dự án."""
        project = self.repository.get_by_id(db, project_id)
        if not project:
            raise ValueError(f"Không tìm thấy dự án với ID = {project_id}")
        return self.preset_repository.get_all_by_project(db, project_id)

    def get_character_preset_by_id(self, db: Session, preset_id: int, project_id: int) -> Optional[Dict[str, Any]]:
        """Lấy chi tiết một bản ghi phân tích & prompt."""
        return self.preset_repository.get_by_id(db, preset_id, project_id)

    def create_character_preset(self, db: Session, project_id: int, **kwargs) -> Dict[str, Any]:
        """Lưu một bản phân tích & prompt mới vào dự án."""
        project = self.repository.get_by_id(db, project_id)
        if not project:
            raise ValueError(f"Không tìm thấy dự án với ID = {project_id}")
        return self.preset_repository.create(db, project_id=project_id, **kwargs)

    def delete_character_preset(self, db: Session, preset_id: int, project_id: int) -> bool:
        """Xóa một bản ghi phân tích & prompt khỏi dự án."""
        return self.preset_repository.delete(db, preset_id, project_id)
