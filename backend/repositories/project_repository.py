# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Kiểu)
# ========================================================
# typing: Khai báo kiểu danh sách, từ điển, tùy chọn
from typing import List, Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Thực thi truy vấn SQL và quản lý phiên Session
from sqlalchemy import text
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# BaseRepository: Lớp cơ sở trừu tượng
from .base import BaseRepository

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class ProjectRepository(BaseRepository):
    """
    Kho lưu trữ dữ liệu Dự án (Project Repository).
    Đóng gói toàn bộ các thao tác truy vấn CSDL MySQL đối với bảng 'projects',
    giúp Router hoàn toàn tách biệt khỏi câu lệnh SQL.
    """

    def get_all(self, db: Session) -> List[Dict[str, Any]]:
        """
        Lấy toàn bộ danh sách dự án sắp xếp theo ID giảm dần (mới nhất trước).

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @returns {List[Dict[str, Any]]} Danh sách các dự án.
        """
        rows = db.execute(
            text("SELECT id, name, created_at FROM projects ORDER BY id DESC")
        ).mappings()
        return [dict(row) for row in rows]

    def get_by_id(self, db: Session, entity_id: int) -> Optional[Dict[str, Any]]:
        """
        Lấy thông tin chi tiết dự án theo ID.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {int} entity_id ID dự án cần lấy.
        @returns {Optional[Dict[str, Any]]} Bản ghi dự án hoặc None nếu không tồn tại.
        """
        row = db.execute(
            text("SELECT id, name, created_at FROM projects WHERE id = :id"),
            {"id": entity_id}
        ).mappings().first()
        return dict(row) if row else None

    def create(self, db: Session, **kwargs) -> Dict[str, Any]:
        """
        Thêm một dự án mới vào bảng projects.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {str} kwargs['name'] Tên của dự án mới.
        @returns {Dict[str, Any]} Bản ghi dự án vừa được tạo.
        """
        name = kwargs.get("name", "").strip()
        result = db.execute(
            text("INSERT INTO projects (name) VALUES (:name)"),
            {"name": name}
        )
        db.commit()
        new_id = int(result.lastrowid)
        return {"id": new_id, "name": name}

    def update(self, db: Session, entity_id: int, name: str) -> bool:
        """
        Cập nhật tên của một dự án theo ID.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {int} entity_id ID dự án.
        @param {str} name Tên mới của dự án.
        @returns {bool} True nếu cập nhật thành công, False nếu không tìm thấy ID.
        """
        result = db.execute(
            text("UPDATE projects SET name = :name WHERE id = :id"),
            {"id": entity_id, "name": name.strip()}
        )
        db.commit()
        return result.rowcount > 0

    def delete(self, db: Session, entity_id: int) -> bool:
        """
        Xóa một dự án theo ID.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {int} entity_id ID dự án cần xóa.
        @returns {bool} True nếu xóa thành công, False nếu không tìm thấy ID.
        """
        result = db.execute(
            text("DELETE FROM projects WHERE id = :id"),
            {"id": entity_id}
        )
        db.commit()
        return result.rowcount > 0
