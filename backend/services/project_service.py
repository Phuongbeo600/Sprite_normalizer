# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc & Kiểu dữ liệu)
# ========================================================
# typing: Khai báo kiểu danh sách, từ điển, tùy chọn
from typing import List, Optional, Dict, Any

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

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class ProjectService:
    """
    Dịch vụ nghiệp vụ Quản lý Dự án (Project Service).
    Đóng vai trò trung gian giữa Router và Repository.
    """

    def __init__(self, repository: Optional[ProjectRepository] = None):
        """Khởi tạo ProjectService với Dependency Injection."""
        self.repository = repository or ProjectRepository()

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
