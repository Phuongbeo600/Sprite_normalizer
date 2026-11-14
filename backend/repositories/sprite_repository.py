# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Kiểu)
# ========================================================
# json: Chuyển đổi từ điển sang chuỗi JSON cho cột metadata
import json
# typing: Định nghĩa các kiểu danh sách, từ điển, tùy chọn
from typing import List, Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Thực thi câu lệnh SQL và quản lý phiên Session
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


class SpriteRepository(BaseRepository):
    """
    Kho lưu trữ dữ liệu Ảnh Sprite (Sprite Repository).
    Đóng gói toàn bộ các thao tác truy vấn CSDL MySQL đối với:
    - Bảng 'project_sprites': Lưu ảnh gốc thô và ảnh đã tối ưu chuẩn hóa.
    - Bảng 'sprite_frames': Lưu các khung hình cắt rời từ tấm sprite.
    """

    def get_all(self, db: Session) -> List[Dict[str, Any]]:
        """Lấy toàn bộ danh sách sprite trong hệ thống."""
        sql = text("SELECT id, project_id, name, status, created_at FROM project_sprites ORDER BY id DESC;")
        return [dict(r) for r in db.execute(sql).mappings().all()]

    def get_by_id(self, db: Session, entity_id: int) -> Optional[Dict[str, Any]]:
        """Lấy chi tiết sprite theo ID."""
        sql = text("SELECT id, project_id, name, status, processing_metadata FROM project_sprites WHERE id = :id;")
        row = db.execute(sql, {"id": entity_id}).mappings().first()
        return dict(row) if row else None

    def create(self, db: Session, **kwargs) -> Dict[str, Any]:
        """Tạo bản ghi sprite mới."""
        sprite_id = self.save_raw_sprite(
            db=db,
            project_id=kwargs.get("project_id", 1),
            name=kwargs.get("name", "sprite"),
            raw_image_bytes=kwargs.get("raw_image_bytes", b""),
            metadata=kwargs.get("metadata")
        )
        return {"id": sprite_id}

    def delete(self, db: Session, entity_id: int) -> bool:
        """Xóa sprite theo ID."""
        sql = text("DELETE FROM project_sprites WHERE id = :id;")
        res = db.execute(sql, {"id": entity_id})
        db.commit()
        return res.rowcount > 0

    def save_raw_sprite(
        self,
        db: Session,
        project_id: int,
        name: str,
        raw_image_bytes: bytes,
        metadata: Optional[Dict[str, Any]] = None
    ) -> int:
        """
        Lưu ảnh gốc thô ban đầu lúc mới tải vào (chưa qua xử lý) vào project_sprites.
        """
        sql = text("""
            INSERT INTO project_sprites (project_id, name, raw_image_data, processing_metadata, status)
            VALUES (:project_id, :name, :raw_image_data, :processing_metadata, 'raw');
        """)
        meta_json = json.dumps(metadata) if metadata else None
        result = db.execute(sql, {
            "project_id": project_id,
            "name": name,
            "raw_image_data": raw_image_bytes,
            "processing_metadata": meta_json
        })
        db.commit()
        return result.lastrowid

    def update_processed_sprite(
        self,
        db: Session,
        sprite_id: int,
        project_id: int,
        processed_image_bytes: bytes,
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        Lưu hoặc cập nhật ảnh sau khi đã qua xử lý/chuẩn hóa/tối ưu vào project_sprites.
        """
        sql = text("""
            UPDATE project_sprites
            SET processed_image_data = :processed_image_data,
                processing_metadata = :processing_metadata,
                status = 'processed',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :id AND project_id = :project_id;
        """)
        meta_json = json.dumps(metadata) if metadata else None
        result = db.execute(sql, {
            "id": sprite_id,
            "project_id": project_id,
            "processed_image_data": processed_image_bytes,
            "processing_metadata": meta_json
        })
        db.commit()
        return result.rowcount > 0

    def get_sprites_by_project(self, db: Session, project_id: int) -> List[Dict[str, Any]]:
        """
        Lấy danh sách các tấm ảnh sprite của dự án (kèm thông tin trạng thái và kích thước byte).
        """
        sql = text("""
            SELECT 
                id, 
                project_id, 
                name, 
                status, 
                processing_metadata, 
                created_at, 
                updated_at,
                (raw_image_data IS NOT NULL) AS has_raw,
                (processed_image_data IS NOT NULL) AS has_processed,
                OCTET_LENGTH(raw_image_data) AS raw_bytes,
                OCTET_LENGTH(processed_image_data) AS processed_bytes
            FROM project_sprites
            WHERE project_id = :project_id
            ORDER BY id DESC;
        """)
        rows = db.execute(sql, {"project_id": project_id}).mappings().all()
        return [dict(r) for r in rows]

    def get_sprite_by_id(self, db: Session, sprite_id: int, project_id: int) -> Optional[Dict[str, Any]]:
        """
        Lấy đầy đủ thông tin một tấm sprite bao gồm cả dữ liệu ảnh nhị phân.
        """
        sql = text("""
            SELECT id, project_id, name, raw_image_data, processed_image_data, processing_metadata, status
            FROM project_sprites
            WHERE id = :id AND project_id = :project_id;
        """)
        row = db.execute(sql, {"id": sprite_id, "project_id": project_id}).mappings().first()
        return dict(row) if row else None

    def delete_sprite(self, db: Session, sprite_id: int, project_id: int) -> bool:
        """
        Xóa vĩnh viễn tấm ảnh sprite khỏi CSDL (Tự động xóa các khung cắt rời trong sprite_frames nhờ ON DELETE CASCADE).
        """
        sql = text("DELETE FROM project_sprites WHERE id = :id AND project_id = :project_id;")
        result = db.execute(sql, {"id": sprite_id, "project_id": project_id})
        db.commit()
        return result.rowcount > 0

    def save_frame(
        self,
        db: Session,
        sprite_id: int,
        project_id: int,
        frame_index: int,
        frame_image_bytes: bytes,
        bounding_box: Optional[Dict[str, Any]] = None,
        direction: Optional[str] = None
    ) -> int:
        """
        Lưu một khung hình đã cắt rời từ tấm sprite vào sprite_frames.
        """
        sql = text("""
            INSERT INTO sprite_frames (sprite_id, project_id, frame_index, frame_image_data, bounding_box, direction)
            VALUES (:sprite_id, :project_id, :frame_index, :frame_image_data, :bounding_box, :direction);
        """)
        bbox_json = json.dumps(bounding_box) if bounding_box else None
        result = db.execute(sql, {
            "sprite_id": sprite_id,
            "project_id": project_id,
            "frame_index": frame_index,
            "frame_image_data": frame_image_bytes,
            "bounding_box": bbox_json,
            "direction": direction
        })
        db.commit()
        return result.lastrowid

    def get_frames_by_sprite(self, db: Session, sprite_id: int, project_id: int) -> List[Dict[str, Any]]:
        """
        Lấy danh sách các khung hình đã cắt rời của một tấm sprite.
        """
        sql = text("""
            SELECT id, sprite_id, project_id, frame_index, frame_image_data, bounding_box, direction, created_at
            FROM sprite_frames
            WHERE sprite_id = :sprite_id AND project_id = :project_id
            ORDER BY frame_index ASC;
        """)
        rows = db.execute(sql, {"sprite_id": sprite_id, "project_id": project_id}).mappings().all()
        return [dict(r) for r in rows]
