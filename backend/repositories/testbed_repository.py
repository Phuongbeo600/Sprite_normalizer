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


class TestbedRepository(BaseRepository):
    """
    Kho lưu trữ dữ liệu Phòng thử nghiệm Godot Testbed (Testbed Repository).
    Đóng gói toàn bộ các thao tác truy vấn CSDL MySQL đối với:
    - Bảng 'testbed_maps': Quản lý bản đồ nền và độ cao sàn ground_y.
    - Bảng 'testbed_characters': Quản lý nhân vật trên sàn diễn testbed.
    - Bảng 'testbed_character_frames': Quản lý dữ liệu ảnh thật của từng ô trong 15 ô.
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
        """Tạo nhân vật testbed mới."""
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

    # ========================================================
    # PHẦN 1: QUẢN LÝ BẢN ĐỒ NỀN / SÀN GAME (testbed_maps)
    # ========================================================

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
        """
        sql = text("DELETE FROM testbed_maps WHERE project_id = :project_id;")
        result = db.execute(sql, {"project_id": project_id})
        db.commit()
        return result.rowcount > 0

    # ========================================================
    # PHẦN 2: QUẢN LÝ NHÂN VẬT THỬ NGHIỆM (testbed_characters)
    # ========================================================

    def get_characters_by_project(self, db: Session, project_id: int) -> List[Dict[str, Any]]:
        """
        Lấy danh sách toàn bộ nhân vật thử nghiệm thuộc về một dự án.
        Sắp xếp theo thứ tự hiển thị đội hình order_index tăng dần.
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
        """
        sql = text("DELETE FROM testbed_characters WHERE id = :id AND project_id = :project_id;")
        result = db.execute(sql, {"id": char_id, "project_id": project_id})
        db.commit()
        return result.rowcount > 0

    # ========================================================
    # PHẦN 3: QUẢN LÝ TỪNG Ô ẢNH RỜI (testbed_character_frames)
    # ========================================================

    def get_character_slots(self, db: Session, character_id: int) -> List[Dict[str, Any]]:
        """
        Lấy toàn bộ các ô ảnh rời của một nhân vật.
        """
        sql = text("""
            SELECT id, character_id, project_id, slot_key, frame_image_data, direction, frame_index, duration_ms
            FROM testbed_character_frames
            WHERE character_id = :character_id;
        """)
        rows = db.execute(sql, {"character_id": character_id}).mappings().all()
        return [dict(r) for r in rows]

    def save_or_update_slot(
        self,
        db: Session,
        character_id: int,
        project_id: int,
        slot_key: str,
        frame_image_bytes: bytes,
        direction: str = "down",
        frame_index: int = 0,
        duration_ms: int = 125
    ) -> bool:
        """
        Lưu hoặc cập nhật ảnh của đúng một ô cụ thể (VD: 'down_1').
        Sử dụng cơ chế ON DUPLICATE KEY UPDATE để ghi đè tức thì nếu ô đó đã có ảnh.
        """
        sql = text("""
            INSERT INTO testbed_character_frames (
                character_id, project_id, slot_key, frame_image_data, direction, frame_index, duration_ms
            ) VALUES (
                :character_id, :project_id, :slot_key, :frame_image_data, :direction, :frame_index, :duration_ms
            )
            ON DUPLICATE KEY UPDATE
                frame_image_data = VALUES(frame_image_data),
                direction = VALUES(direction),
                frame_index = VALUES(frame_index),
                duration_ms = VALUES(duration_ms),
                updated_at = CURRENT_TIMESTAMP;
        """)
        db.execute(sql, {
            "character_id": character_id,
            "project_id": project_id,
            "slot_key": slot_key,
            "frame_image_data": frame_image_bytes,
            "direction": direction,
            "frame_index": frame_index,
            "duration_ms": duration_ms
        })
        db.commit()
        return True
