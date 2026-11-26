# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Kiểu)
# ========================================================
# hashlib: Băm dữ liệu SHA-256 để định danh duy nhất và chống trùng lặp ảnh
import hashlib
# typing: Định nghĩa các kiểu danh sách, từ điển, tùy chọn
from typing import List, Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Thực thi câu lệnh SQL, bắt ngoại lệ toàn vẹn và quản lý phiên Session
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# BaseRepository: Lớp cơ sở trừu tượng
from .base import BaseRepository
# safe_json_dumps: Chuyển đổi an toàn đối tượng/từ điển sang chuỗi JSON
from .serializers import safe_json_dumps

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

    def get_by_hash(self, db: Session, project_id: int, file_hash: str) -> Optional[Dict[str, Any]]:
        """
        Kiểm tra xem ảnh có mã băm SHA-256 tương ứng đã tồn tại trong dự án hay chưa.

        @param db Phiên làm việc cơ sở dữ liệu MySQL.
        @param project_id Mã định danh dự án.
        @param file_hash Chuỗi băm SHA-256 (64 ký tự hex).
        @returns {Optional[Dict[str, Any]]} Bản ghi sprite nếu tồn tại, ngược lại trả về None.
        """
        sql = text("""
            SELECT id, project_id, name, file_hash, status, processing_metadata
            FROM project_sprites
            WHERE project_id = :project_id AND file_hash = :file_hash
            LIMIT 1;
        """)
        row = db.execute(sql, {"project_id": project_id, "file_hash": file_hash}).mappings().first()
        return dict(row) if row else None

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
        Tự động tính mã băm SHA-256 để ngăn chặn lưu trùng lặp dữ liệu ảnh trong cùng một dự án.
        """
        file_hash = hashlib.sha256(raw_image_bytes).hexdigest() if raw_image_bytes else None

        # Kiểm tra chống trùng lặp: Nếu mã băm đã tồn tại trong dự án, tái sử dụng bản ghi cũ
        if file_hash:
            existing = self.get_by_hash(db, project_id, file_hash)
            if existing:
                return existing["id"]

        sql = text("""
            INSERT INTO project_sprites (project_id, name, file_hash, raw_image_data, processing_metadata, status)
            VALUES (:project_id, :name, :file_hash, :raw_image_data, :processing_metadata, 'raw');
        """)
        meta_dict = dict(metadata or {})
        if file_hash and "file_hash" not in meta_dict:
            meta_dict["file_hash"] = file_hash
        meta_json = safe_json_dumps(meta_dict)
        try:
            result = db.execute(sql, {
                "project_id": project_id,
                "name": name,
                "file_hash": file_hash,
                "raw_image_data": raw_image_bytes,
                "processing_metadata": meta_json
            })
            db.commit()
            return result.lastrowid
        except IntegrityError:
            # Xử lý Race Condition: Khi 2 request cùng upload ảnh trùng mã hash đồng thời
            db.rollback()
            existing = self.get_by_hash(db, project_id, file_hash) if file_hash else None
            if existing:
                return existing["id"]
            raise

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
        meta_json = safe_json_dumps(metadata)
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
        Lấy danh sách các tấm ảnh sprite của dự án (kèm thông tin trạng thái, thư mục và số lượng frame con).
        """
        sql = text("""
            SELECT 
                id, 
                project_id, 
                name, 
                file_hash,
                folder_name,
                is_sheet,
                status, 
                processing_metadata, 
                created_at, 
                updated_at,
                (raw_image_data IS NOT NULL) AS has_raw,
                (processed_image_data IS NOT NULL) AS has_processed,
                OCTET_LENGTH(raw_image_data) AS raw_bytes,
                OCTET_LENGTH(processed_image_data) AS processed_bytes,
                (SELECT COUNT(*) FROM sprite_frames WHERE sprite_id = project_sprites.id) AS frame_count
            FROM project_sprites
            WHERE project_id = :project_id
            ORDER BY id DESC;
        """)
        rows = db.execute(sql, {"project_id": project_id}).mappings().all()
        return [dict(r) for r in rows]

    def _replace_sprite_frames(
        self,
        db: Session,
        sprite_id: int,
        project_id: int,
        frames: List[Dict[str, Any]],
    ) -> None:
        """Thay thế toàn bộ danh sách khung hình cắt rời của một tấm sprite trong transaction hiện tại."""
        # Xóa các frame cũ nếu có của sprite này trước khi nạp mới (đảm bảo tính toàn vẹn)
        db.execute(text("DELETE FROM sprite_frames WHERE sprite_id = :sprite_id;"), {"sprite_id": sprite_id})
        if not frames:
            return

        insert_frame_sql = text("""
            INSERT INTO sprite_frames (sprite_id, project_id, frame_index, frame_name, frame_image_data, metadata)
            VALUES (:sprite_id, :project_id, :frame_index, :frame_name, :frame_image_data, :metadata);
        """)
        for item in frames:
            f_meta = safe_json_dumps(item.get("metadata") or {"size": item.get("size")})
            db.execute(insert_frame_sql, {
                "sprite_id": sprite_id,
                "project_id": project_id,
                "frame_index": item.get("index", 1),
                "frame_name": item.get("name", f"frame_{item.get('index', 1):03}.png"),
                "frame_image_data": item.get("bytes", b""),
                "metadata": f_meta,
            })

    def save_sliced_pack(
        self,
        db: Session,
        project_id: int,
        folder_name: str,
        sheet_name: str,
        sheet_bytes: bytes,
        frames: List[Dict[str, Any]],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Lưu toàn bộ gói Sprite Sheet gồm:
        1. Tấm ảnh Sheet gốc vào bảng 'project_sprites' với folder_name và file_hash SHA-256.
        2. Toàn bộ danh sách các khung hình cắt rời vào bảng 'sprite_frames' trong một transaction nguyên tử.

        @param db Phiên làm việc cơ sở dữ liệu.
        @param project_id Mã định danh dự án.
        @param folder_name Tên thư mục gom nhóm (ví dụ: 'Pháp sư tím - 15 frame').
        @param sheet_name Tên tệp sheet gốc.
        @param sheet_bytes Dữ liệu byte nhị phân của sheet gốc.
        @param frames Danh sách từ điển [{'index': 1, 'name': 'frame_001.png', 'bytes': b'...', 'size': (w, h)}].
        @param metadata Thông số bóc tách (rows, columns, auto_anchor, fps,...).
        @returns {Dict[str, Any]} Thông tin tóm tắt kết quả lưu (sprite_id, folder_name, frame_count).
        """
        file_hash = hashlib.sha256(sheet_bytes).hexdigest() if sheet_bytes else None

        # Kiểm tra xem Sheet đã tồn tại trong dự án chưa
        existing = self.get_by_hash(db, project_id, file_hash) if file_hash else None
        if existing:
            sprite_id = existing["id"]
            # Cập nhật lại folder_name và trạng thái nếu cần
            update_sql = text("""
                UPDATE project_sprites 
                SET folder_name = :folder_name, name = :name, is_sheet = 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = :id;
            """)
            db.execute(update_sql, {"folder_name": folder_name, "name": sheet_name, "id": sprite_id})
        else:
            insert_sheet_sql = text("""
                INSERT INTO project_sprites (project_id, name, file_hash, folder_name, is_sheet, raw_image_data, processing_metadata, status)
                VALUES (:project_id, :name, :file_hash, :folder_name, 1, :raw_image_data, :processing_metadata, 'sliced_pack');
            """)
            meta_dict = dict(metadata or {})
            if file_hash:
                meta_dict["file_hash"] = file_hash
            meta_dict["frame_count"] = len(frames)
            meta_json = safe_json_dumps(meta_dict)
            try:
                res = db.execute(insert_sheet_sql, {
                    "project_id": project_id,
                    "name": sheet_name,
                    "file_hash": file_hash,
                    "folder_name": folder_name,
                    "raw_image_data": sheet_bytes,
                    "processing_metadata": meta_json
                })
                sprite_id = res.lastrowid
            except IntegrityError:
                # Xử lý Race Condition khi 2 request cùng upload sheet trùng hash đồng thời
                db.rollback()
                existing = self.get_by_hash(db, project_id, file_hash) if file_hash else None
                if existing:
                    sprite_id = existing["id"]
                else:
                    raise

        try:
            self._replace_sprite_frames(db, sprite_id, project_id, frames)
            db.commit()
        except Exception:
            db.rollback()
            raise
        return {
            "sprite_id": sprite_id,
            "folder_name": folder_name,
            "sheet_name": sheet_name,
            "frame_count": len(frames),
            "is_duplicate_sheet": bool(existing)
        }

    def save_generated_sprite_pack(
        self,
        db: Session,
        project_id: int,
        name: str,
        raw_image_bytes: bytes,
        processed_image_bytes: Optional[bytes] = None,
        frames: Optional[List[Dict[str, Any]]] = None,
        folder_name: str = "Tạo ảnh AI",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Lưu đồng thời ảnh gốc trả về từ API tạo ảnh AI, ảnh Sprite Sheet sau hậu xử lý
        (nếu có) và danh sách các frame đã chuẩn hóa vào MySQL trong một transaction nguyên tử.

        @param db Phiên làm việc cơ sở dữ liệu.
        @param project_id Mã định danh dự án.
        @param name Tên tệp hiển thị trong Kho Tài Nguyên Dự Án.
        @param raw_image_bytes Dữ liệu PNG gốc nhận từ API AI.
        @param processed_image_bytes Dữ liệu PNG Sprite Sheet đã ghép sau hậu xử lý (hoặc None).
        @param frames Danh sách các khung hình con đã cắt & ép kích thước (nếu có).
        @param folder_name Tên thư mục gom nhóm trong Kho Tài Nguyên.
        @param metadata Thông tin ngữ cảnh (provider, model, prompt, kích thước, trạng thái hậu xử lý).
        @returns {Dict[str, Any]} Thông tin bản ghi vừa lưu (sprite_id, has_processed, frame_count).
        """
        frame_items = list(frames or [])
        is_sheet = 1 if (frame_items or processed_image_bytes is not None) else 0
        status = "processed" if processed_image_bytes is not None else "raw"
        file_hash = hashlib.sha256(raw_image_bytes).hexdigest() if raw_image_bytes else None

        meta_dict = dict(metadata or {})
        if file_hash:
            meta_dict["file_hash"] = file_hash
        meta_dict["frame_count"] = len(frame_items)
        meta_json = safe_json_dumps(meta_dict)

        existing = self.get_by_hash(db, project_id, file_hash) if file_hash else None
        if existing:
            sprite_id = existing["id"]
            if processed_image_bytes is not None:
                update_sql = text("""
                    UPDATE project_sprites
                    SET folder_name = :folder_name,
                        is_sheet = :is_sheet,
                        processed_image_data = :processed_image_data,
                        processing_metadata = :processing_metadata,
                        status = 'processed',
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = :id AND project_id = :project_id;
                """)
                db.execute(update_sql, {
                    "id": sprite_id,
                    "project_id": project_id,
                    "folder_name": folder_name,
                    "is_sheet": is_sheet,
                    "processed_image_data": processed_image_bytes,
                    "processing_metadata": meta_json,
                })
        else:
            insert_sql = text("""
                INSERT INTO project_sprites (
                    project_id, name, file_hash, folder_name, is_sheet,
                    raw_image_data, processed_image_data, processing_metadata, status
                )
                VALUES (
                    :project_id, :name, :file_hash, :folder_name, :is_sheet,
                    :raw_image_data, :processed_image_data, :processing_metadata, :status
                );
            """)
            try:
                res = db.execute(insert_sql, {
                    "project_id": project_id,
                    "name": name,
                    "file_hash": file_hash,
                    "folder_name": folder_name,
                    "is_sheet": is_sheet,
                    "raw_image_data": raw_image_bytes,
                    "processed_image_data": processed_image_bytes,
                    "processing_metadata": meta_json,
                    "status": status,
                })
                sprite_id = res.lastrowid
            except IntegrityError:
                db.rollback()
                existing = self.get_by_hash(db, project_id, file_hash) if file_hash else None
                if existing:
                    sprite_id = existing["id"]
                else:
                    raise

        try:
            if frame_items:
                self._replace_sprite_frames(db, sprite_id, project_id, frame_items)
            db.commit()
        except Exception:
            db.rollback()
            raise

        return {
            "sprite_id": sprite_id,
            "folder_name": folder_name,
            "has_processed": processed_image_bytes is not None,
            "frame_count": len(frame_items),
        }

    def get_sprite_frames(self, db: Session, sprite_id: int) -> List[Dict[str, Any]]:
        """Lấy danh sách các frame cắt rời của một Sprite Sheet (kèm kích thước byte)."""
        sql = text("""
            SELECT id, sprite_id, frame_index, frame_name, metadata, created_at,
                   OCTET_LENGTH(frame_image_data) AS byte_size
            FROM sprite_frames
            WHERE sprite_id = :sprite_id
            ORDER BY frame_index ASC;
        """)
        rows = db.execute(sql, {"sprite_id": sprite_id}).mappings().all()
        return [dict(r) for r in rows]

    def get_frame_image(self, db: Session, frame_id: int) -> Optional[bytes]:
        """Lấy dữ liệu byte ảnh nhị phân của một frame cụ thể."""
        sql = text("SELECT frame_image_data FROM sprite_frames WHERE id = :id LIMIT 1;")
        row = db.execute(sql, {"id": frame_id}).first()
        return row[0] if row else None

    def get_sprite_by_id(self, db: Session, sprite_id: int, project_id: int) -> Optional[Dict[str, Any]]:
        """
        Lấy đầy đủ thông tin một tấm sprite bao gồm cả dữ liệu ảnh nhị phân.
        """
        sql = text("""
            SELECT id, project_id, name, file_hash, raw_image_data, processed_image_data, processing_metadata, status
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
