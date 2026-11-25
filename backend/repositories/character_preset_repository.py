"""
Module: backend.repositories.character_preset_repository
Mục đích: Kho lưu trữ bản ghi phân tích chỉ số và prompt nhân vật mẫu (Character Presets).
Ai gọi nó: `ProjectService` khi lưu hoặc đọc các bản phân tích nhân vật theo từng dự án.
Tại sao tồn tại: Đóng gói toàn bộ các thao tác CSDL MySQL đối với bảng 'project_character_presets', đảm bảo tính toàn vẹn dữ liệu theo từng project_id.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Kiểu)
# ========================================================
# typing: Khai báo kiểu danh sách, từ điển, tùy chọn
from typing import List, Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Thực thi truy vấn SQL văn bản an toàn và quản lý phiên Session
from sqlalchemy import text
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Base & Serializers)
# ========================================================
# BaseRepository: Lớp cơ sở trừu tượng cho các kho lưu trữ
from .base import BaseRepository
# safe_json_dumps, deserialize_preset_record: Tiện ích tuần tự hóa JSON an toàn
from .serializers import safe_json_dumps, deserialize_preset_record
# ensure_preset_columns: Tự động bổ sung cột frame_actions_data nếu thiếu
from backend.db import ensure_preset_columns

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class CharacterPresetRepository(BaseRepository):
    """
    Kho lưu trữ Bản Phân Tích & Prompt Nhân Vật (Character Preset Repository).
    Đóng gói toàn bộ các thao tác truy vấn CSDL MySQL đối với bảng 'project_character_presets',
    bảo đảm dữ liệu luôn thuộc về đúng một dự án (project_id) xác định.
    """

    def get_all(self, db: Session) -> List[Dict[str, Any]]:
        """
        Lấy toàn bộ danh sách các bản phân tích & prompt từ tất cả các dự án.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @returns {List[Dict[str, Any]]} Danh sách tóm tắt tất cả các bản ghi.
        """
        sql = text("""
            SELECT id, project_id, name, sprite_name, new_character_concept,
                   target_direction, stature_rule, metrics_data, reference_image, created_at
            FROM project_character_presets
            ORDER BY id DESC
        """)
        try:
            rows = db.execute(sql).mappings()
        except Exception:
            # Bổ sung cột còn thiếu để danh sách hồ sơ cũ vẫn đọc được.
            db.rollback()
            ensure_preset_columns(db)
            db.commit()
            rows = db.execute(sql).mappings()
        return [deserialize_preset_record(dict(r), json_keys=["metrics_data"]) for r in rows]

    def get_all_by_project(self, db: Session, project_id: int) -> List[Dict[str, Any]]:
        """
        Lấy danh sách các bản phân tích & prompt đã lưu của một dự án, sắp xếp mới nhất lên đầu.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {int} project_id Mã định danh dự án.
        @returns {List[Dict[str, Any]]} Danh sách tóm tắt các bản ghi đã lưu.
        """
        sql = text("""
            SELECT id, project_id, name, sprite_name, new_character_concept,
                   target_direction, stature_rule, metrics_data, reference_image, created_at
            FROM project_character_presets
            WHERE project_id = :project_id
            ORDER BY id DESC
        """)
        try:
            rows = db.execute(sql, {"project_id": project_id}).mappings()
        except Exception:
            # Bổ sung cột còn thiếu trước khi đọc ảnh thu nhỏ theo dự án.
            db.rollback()
            ensure_preset_columns(db)
            db.commit()
            rows = db.execute(sql, {"project_id": project_id}).mappings()
        return [deserialize_preset_record(dict(r), json_keys=["metrics_data"]) for r in rows]

    def get_by_id(self, db: Session, entity_id: int, project_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """
        Lấy thông tin chi tiết đầy đủ của một bản ghi theo ID và (tùy chọn) project_id.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {int} entity_id Mã bản ghi preset.
        @param {Optional[int]} project_id Mã dự án sở hữu bản ghi (tùy chọn).
        @returns {Optional[Dict[str, Any]]} Bản ghi chi tiết hoặc None nếu không tồn tại.
        """
        if project_id is not None:
            sql = """
                SELECT id, project_id, name, sprite_name, metrics_data, profile_data,
                       frame_actions_data, new_character_concept, outfit_and_colors, weapons_and_props,
                       stature_rule, target_direction, positive_prompt, negative_prompt,
                       technical_notes, reference_image, created_at
                FROM project_character_presets
                WHERE id = :preset_id AND project_id = :project_id
            """
            params = {"preset_id": entity_id, "project_id": project_id}
        else:
            sql = """
                SELECT id, project_id, name, sprite_name, metrics_data, profile_data,
                       frame_actions_data, new_character_concept, outfit_and_colors, weapons_and_props,
                       stature_rule, target_direction, positive_prompt, negative_prompt,
                       technical_notes, reference_image, created_at
                FROM project_character_presets
                WHERE id = :preset_id
            """
            params = {"preset_id": entity_id}

        try:
            row = db.execute(text(sql), params).mappings().first()
        except Exception:
            # Cơ chế tự phục hồi: bổ sung cột nếu bảng MySQL bị thiếu cột
            db.rollback()
            ensure_preset_columns(db)
            db.commit()
            row = db.execute(text(sql), params).mappings().first()

        if not row:
            return None

        return deserialize_preset_record(dict(row))

    def create(self, db: Session, **kwargs) -> Dict[str, Any]:
        """
        Tạo và lưu một bản phân tích chỉ số & prompt mới vào CSDL MySQL.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {dict} kwargs Dữ liệu bản ghi cần lưu.
        @returns {Dict[str, Any]} Bản ghi vừa tạo kèm ID tự tăng.
        """
        project_id = kwargs.get("project_id")
        name = kwargs.get("name", "Bản phân tích nhân vật").strip()
        sprite_name = kwargs.get("sprite_name")
        new_concept = kwargs.get("new_character_concept", "").strip()
        outfit = kwargs.get("outfit_and_colors")
        weapons = kwargs.get("weapons_and_props")
        stature = kwargs.get("stature_rule")
        direction = kwargs.get("target_direction", "Front / Down view")
        positive = kwargs.get("positive_prompt", "").strip()
        negative = kwargs.get("negative_prompt", "").strip()
        notes = kwargs.get("technical_notes")

        # Tuần tự hóa JSON an toàn thông qua serializers helper
        metrics_json = safe_json_dumps(kwargs.get("metrics_data"))
        profile_json = safe_json_dumps(kwargs.get("profile_data"))
        frame_actions_json = safe_json_dumps(kwargs.get("frame_actions_data"))

        sql_insert = """
            INSERT INTO project_character_presets (
                project_id, name, sprite_name, metrics_data, profile_data,
                frame_actions_data, new_character_concept, outfit_and_colors, weapons_and_props,
                stature_rule, target_direction, positive_prompt, negative_prompt,
                technical_notes, reference_image
            ) VALUES (
                :project_id, :name, :sprite_name, :metrics_data, :profile_data,
                :frame_actions_data, :new_character_concept, :outfit_and_colors, :weapons_and_props,
                :stature_rule, :target_direction, :positive_prompt, :negative_prompt,
                :technical_notes, :reference_image
            )
        """
        insert_params = {
            "project_id": project_id,
            "name": name,
            "sprite_name": sprite_name,
            "metrics_data": metrics_json,
            "profile_data": profile_json,
            "frame_actions_data": frame_actions_json,
            "new_character_concept": new_concept,
            "outfit_and_colors": outfit,
            "weapons_and_props": weapons,
            "stature_rule": stature,
            "target_direction": direction,
            "positive_prompt": positive,
            "negative_prompt": negative,
            "technical_notes": notes,
            "reference_image": kwargs.get("reference_image"),
        }

        try:
            result = db.execute(text(sql_insert), insert_params)
            db.commit()
        except Exception:
            # Tự phục hồi: bổ sung cột nếu bảng chưa có cột frame_actions_data
            db.rollback()
            ensure_preset_columns(db)
            db.commit()
            result = db.execute(text(sql_insert), insert_params)
            db.commit()

        return {"id": int(result.lastrowid), "project_id": project_id, "name": name}

    def delete(self, db: Session, entity_id: int, project_id: Optional[int] = None) -> bool:
        """
        Xóa một bản ghi preset theo ID và project_id.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {int} entity_id ID bản ghi preset.
        @param {Optional[int]} project_id ID dự án sở hữu.
        @returns {bool} True nếu xóa thành công, False nếu không tìm thấy.
        """
        if project_id:
            result = db.execute(
                text("DELETE FROM project_character_presets WHERE id = :id AND project_id = :project_id"),
                {"id": entity_id, "project_id": project_id}
            )
        else:
            result = db.execute(
                text("DELETE FROM project_character_presets WHERE id = :id"),
                {"id": entity_id}
            )
        db.commit()
        return result.rowcount > 0
