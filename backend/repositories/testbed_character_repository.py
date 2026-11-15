# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Kiểu)
# ========================================================
# typing: Định nghĩa các kiểu dữ liệu mảng, từ điển, tùy chọn
from typing import List, Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Thực thi các câu lệnh SQL an toàn và quản lý phiên Session
from sqlalchemy import text
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# BaseRepository: Lớp cơ sở trừu tượng cho các Repository
from .base import BaseRepository

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class TestbedCharacterRepository(BaseRepository):
    """
    Kho lưu trữ dữ liệu Nhân vật Thử nghiệm Testbed (Testbed Character Repository).
    Chuyên trách quản lý toàn bộ các thao tác CSDL MySQL đối với bảng 'testbed_characters':
    - Lấy danh sách nhân vật theo dự án (sắp xếp theo order_index).
    - Tạo mới, cập nhật thuộc tính hiển thị (tọa độ pos_x, scale, kích thước ô, fps).
    - Xóa nhân vật và tự động giải phóng các ô ảnh rời liên kết.
    """

    def get_all(self, db: Session) -> List[Dict[str, Any]]:
        """Lấy toàn bộ danh sách nhân vật testbed trong hệ thống."""
        sql = text("SELECT id, project_id, name, cell_width, cell_height, fps, scale_ratio, pos_x, order_index FROM testbed_characters ORDER BY id DESC;")
        return [dict(r) for r in db.execute(sql).mappings().all()]

    def get_by_id(self, db: Session, entity_id: int) -> Optional[Dict[str, Any]]:
        """Lấy chi tiết nhân vật testbed theo ID."""
        sql = text("SELECT id, project_id, name, cell_width, cell_height, fps, scale_ratio, pos_x, order_index FROM testbed_characters WHERE id = :id;")
        row = db.execute(sql, {"id": entity_id}).mappings().first()
        return dict(row) if row else None

    def create(self, db: Session, **kwargs) -> Dict[str, Any]:
        """Tạo nhân vật testbed mới thông qua tham số kwargs."""
        char_id = self.create_character(
            db=db,
            project_id=kwargs.get("project_id", 1),
            name=kwargs.get("name", "Player")
        )
        return {"id": char_id}

    def delete(self, db: Session, entity_id: int) -> bool:
        """Xóa nhân vật testbed theo ID."""
        sql = text("DELETE FROM testbed_characters WHERE id = :id;")
        res = db.execute(sql, {"id": entity_id})
        db.commit()
        return res.rowcount > 0

    def get_characters_by_project(self, db: Session, project_id: int) -> List[Dict[str, Any]]:
        """
        Lấy danh sách toàn bộ nhân vật thử nghiệm thuộc về một dự án.
        Sắp xếp theo thứ tự hiển thị đội hình order_index tăng dần.

        @param db: Phiên làm việc cơ sở dữ liệu
        @param project_id: Mã dự án
        @returns: Danh sách các bản ghi nhân vật
        """
        sql = text("""
            SELECT id, project_id, name, cell_width, cell_height, fps, scale_ratio, pos_x, order_index, created_at
            FROM testbed_characters
            WHERE project_id = :project_id
            ORDER BY order_index ASC, id ASC;
        """)
        rows = db.execute(sql, {"project_id": project_id}).mappings().all()
        return [dict(r) for r in rows]

    def create_character(
        self,
        db: Session,
        project_id: int,
        name: str,
        cell_width: int = 32,
        cell_height: int = 48,
        fps: int = 8,
        scale_ratio: float = 1.0,
        pos_x: int = 260,
        order_index: int = 0
    ) -> int:
        """
        Tạo mới một dòng nhân vật thử nghiệm trong bảng testbed_characters.

        @param db: Phiên làm việc cơ sở dữ liệu
        @param project_id: Mã dự án
        @param name: Tên định danh nhân vật
        @param cell_width: Chiều rộng một ô frame
        @param cell_height: Chiều cao một ô frame
        @param fps: Tốc độ khung hình trên giây
        @param scale_ratio: Tỷ lệ co giãn hiển thị
        @param pos_x: Tọa độ đứng trục X
        @param order_index: Thứ tự ưu tiên hiển thị
        @returns: ID của bản ghi nhân vật vừa tạo
        """
        sql = text("""
            INSERT INTO testbed_characters (project_id, name, cell_width, cell_height, fps, scale_ratio, pos_x, order_index)
            VALUES (:project_id, :name, :cell_width, :cell_height, :fps, :scale_ratio, :pos_x, :order_index);
        """)
        result = db.execute(sql, {
            "project_id": project_id,
            "name": name,
            "cell_width": cell_width,
            "cell_height": cell_height,
            "fps": fps,
            "scale_ratio": scale_ratio,
            "pos_x": pos_x,
            "order_index": order_index
        })
        db.commit()
        return result.lastrowid

    def update_character(
        self,
        db: Session,
        char_id: int,
        project_id: int,
        updates: Dict[str, Any]
    ) -> bool:
        """
        Cập nhật các thuộc tính linh hoạt của nhân vật (tên, scale, vị trí X, fps, thứ tự).

        @param db: Phiên làm việc cơ sở dữ liệu
        @param char_id: Mã nhân vật cần cập nhật
        @param project_id: Mã dự án
        @param updates: Từ điển chứa các trường cần sửa đổi
        @returns: True nếu cập nhật thành công ít nhất một bản ghi
        """
        allowed_fields = {"name", "cell_width", "cell_height", "fps", "scale_ratio", "pos_x", "order_index"}
        set_clauses = []
        params = {"id": char_id, "project_id": project_id}

        for k, v in updates.items():
            if k in allowed_fields and v is not None:
                set_clauses.append(f"{k} = :{k}")
                params[k] = v

        if not set_clauses:
            return False

        sql_str = f"""
            UPDATE testbed_characters
            SET {', '.join(set_clauses)}
            WHERE id = :id AND project_id = :project_id;
        """
        result = db.execute(text(sql_str), params)
        db.commit()
        return result.rowcount > 0

    def delete_character(self, db: Session, char_id: int, project_id: int) -> bool:
        """
        Xóa vĩnh viễn một nhân vật khỏi phòng thử nghiệm.
        Nhờ ON DELETE CASCADE, toàn bộ các ô ảnh rời trong testbed_character_frames sẽ tự động bị xóa sạch.

        @param db: Phiên làm việc cơ sở dữ liệu
        @param char_id: Mã nhân vật cần xóa
        @param project_id: Mã dự án
        @returns: True nếu xóa thành công ít nhất một nhân vật
        """
        sql = text("DELETE FROM testbed_characters WHERE id = :id AND project_id = :project_id;")
        result = db.execute(sql, {"id": char_id, "project_id": project_id})
        db.commit()
        return result.rowcount > 0
