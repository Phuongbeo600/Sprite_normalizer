# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Kiểu)
# ========================================================
# typing: Định nghĩa các kiểu dữ liệu từ điển, tùy chọn
from typing import Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Thực thi các câu lệnh SQL an toàn và quản lý phiên Session
from sqlalchemy import text
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class TestbedMapRepository:
    """
    Kho lưu trữ dữ liệu Bản đồ Sàn đấu Testbed (Testbed Map Repository).
    Chuyên trách quản lý toàn bộ các thao tác CSDL MySQL đối với bảng 'testbed_maps':
    - Lấy bản đồ nền đang kích hoạt.
    - Lưu bản đồ nền mới và tự động hủy kích hoạt bản đồ cũ.
    - Cập nhật độ cao sàn mặt đất ground_y.
    - Xóa bản đồ nền của dự án.
    """

    def get_active_map(self, db: Session, project_id: int) -> Optional[Dict[str, Any]]:
        """
        Lấy thông tin bản đồ nền đang kích hoạt của một dự án.

        @param db: Phiên làm việc cơ sở dữ liệu
        @param project_id: Mã dự án
        @returns: Bản ghi bản đồ nền hoặc None nếu chưa có map
        """
        sql = text("""
            SELECT id, project_id, name, map_image_data, ground_y, show_ground_line, is_active
            FROM testbed_maps
            WHERE project_id = :project_id AND is_active = TRUE
            ORDER BY id DESC LIMIT 1;
        """)
        row = db.execute(sql, {"project_id": project_id}).mappings().first()
        return dict(row) if row else None

    def save_map(
        self,
        db: Session,
        project_id: int,
        name: str,
        map_image_bytes: bytes,
        ground_y: int = 540,
        show_ground_line: bool = True
    ) -> int:
        """
        Lưu hoặc thay thế bản đồ nền mới cho dự án.
        Tự động chuyển các map cũ thành không kích hoạt để chỉ giữ 1 map hiện hành.

        @param db: Phiên làm việc cơ sở dữ liệu
        @param project_id: Mã dự án
        @param name: Tên bản đồ nền
        @param map_image_bytes: Dữ liệu nhị phân ảnh thật của map (MEDIUMBLOB)
        @param ground_y: Tọa độ trục Y mặt đất (mặc định 540px)
        @param show_ground_line: Trạng thái hiển thị vạch kẻ sàn
        @returns: ID của bản đồ vừa tạo trong CSDL
        """
        # Hủy kích hoạt map cũ của dự án này
        db.execute(
            text("UPDATE testbed_maps SET is_active = FALSE WHERE project_id = :project_id;"),
            {"project_id": project_id}
        )

        # Chèn bản đồ mới
        insert_sql = text("""
            INSERT INTO testbed_maps (project_id, name, map_image_data, ground_y, show_ground_line, is_active)
            VALUES (:project_id, :name, :map_image_data, :ground_y, :show_ground_line, TRUE);
        """)
        result = db.execute(insert_sql, {
            "project_id": project_id,
            "name": name,
            "map_image_data": map_image_bytes,
            "ground_y": ground_y,
            "show_ground_line": show_ground_line
        })
        db.commit()
        return result.lastrowid

    def update_ground_y(self, db: Session, project_id: int, ground_y: int) -> bool:
        """
        Cập nhật riêng độ cao sàn mặt đất ground_y của dự án.

        @param db: Phiên làm việc cơ sở dữ liệu
        @param project_id: Mã dự án
        @param ground_y: Tọa độ Y mặt sàn mới
        @returns: True nếu cập nhật thành công ít nhất một bản ghi
        """
        sql = text("""
            UPDATE testbed_maps
            SET ground_y = :ground_y
            WHERE project_id = :project_id AND is_active = TRUE;
        """)
        result = db.execute(sql, {"project_id": project_id, "ground_y": ground_y})
        db.commit()
        return result.rowcount > 0

    def delete_map(self, db: Session, project_id: int) -> bool:
        """
        Xóa bản đồ nền của dự án khỏi cơ sở dữ liệu.

        @param db: Phiên làm việc cơ sở dữ liệu
        @param project_id: Mã dự án
        @returns: True nếu xóa thành công ít nhất một bản đồ
        """
        sql = text("DELETE FROM testbed_maps WHERE project_id = :project_id;")
        result = db.execute(sql, {"project_id": project_id})
        db.commit()
        return result.rowcount > 0
