# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Xử lý JSON)
# ========================================================
# json: Chuyển đổi từ điển dữ liệu sang chuỗi JSON lưu trữ trong MySQL
import json
# typing: Khai báo kiểu danh sách, từ điển, tùy chọn
from typing import List, Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Thực thi truy vấn SQL văn bản an toàn và quản lý phiên Session
from sqlalchemy import text
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# BaseRepository: Lớp cơ sở trừu tượng cho các kho lưu trữ
from .base import BaseRepository

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
        rows = db.execute(
            text("""
                SELECT id, project_id, name, sprite_name, new_character_concept,
                       target_direction, stature_rule, metrics_data, created_at
                FROM project_character_presets
                ORDER BY id DESC
            """)
        ).mappings()

        results = []
        for r in rows:
            item = dict(r)
            # Giải mã JSON metrics_data nếu được lưu dưới dạng chuỗi
            if isinstance(item.get("metrics_data"), str):
                try:
                    item["metrics_data"] = json.loads(item["metrics_data"])
                except Exception:
                    pass
            results.append(item)
        return results

    def get_all_by_project(self, db: Session, project_id: int) -> List[Dict[str, Any]]:
        """
        Lấy danh sách các bản phân tích & prompt đã lưu của một dự án, sắp xếp mới nhất lên đầu.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {int} project_id Mã định danh dự án.
        @returns {List[Dict[str, Any]]} Danh sách tóm tắt các bản ghi đã lưu.
        """
        rows = db.execute(
            text("""
                SELECT id, project_id, name, sprite_name, new_character_concept,
                       target_direction, stature_rule, metrics_data, created_at
                FROM project_character_presets
                WHERE project_id = :project_id
                ORDER BY id DESC
            """),
            {"project_id": project_id}
        ).mappings()

        results = []
        for r in rows:
            item = dict(r)
            # Giải mã JSON metrics_data nếu được lưu dưới dạng chuỗi
            if isinstance(item.get("metrics_data"), str):
                try:
                    item["metrics_data"] = json.loads(item["metrics_data"])
                except Exception:
                    pass
            results.append(item)
        return results

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
                       new_character_concept, outfit_and_colors, weapons_and_props,
                       stature_rule, target_direction, positive_prompt, negative_prompt,
                       technical_notes, created_at
                FROM project_character_presets
                WHERE id = :preset_id AND project_id = :project_id
            """
            params = {"preset_id": entity_id, "project_id": project_id}
        else:
            sql = """
                SELECT id, project_id, name, sprite_name, metrics_data, profile_data,
                       new_character_concept, outfit_and_colors, weapons_and_props,
                       stature_rule, target_direction, positive_prompt, negative_prompt,
                       technical_notes, created_at
                FROM project_character_presets
                WHERE id = :preset_id
            """
            params = {"preset_id": entity_id}

        row = db.execute(text(sql), params).mappings().first()

        if not row:
            return None

        data = dict(row)
        # Chuyển đổi JSON sang Python Dict nếu cần
        for key in ["metrics_data", "profile_data"]:
            if isinstance(data.get(key), str):
                try:
                    data[key] = json.loads(data[key])
                except Exception:
                    pass
        return data

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
        metrics_data = kwargs.get("metrics_data")
        profile_data = kwargs.get("profile_data")
        new_concept = kwargs.get("new_character_concept", "").strip()
        outfit = kwargs.get("outfit_and_colors")
        weapons = kwargs.get("weapons_and_props")
        stature = kwargs.get("stature_rule")
        direction = kwargs.get("target_direction", "Front / Down view")
        positive = kwargs.get("positive_prompt", "").strip()
        negative = kwargs.get("negative_prompt", "").strip()
        notes = kwargs.get("technical_notes")

        # Tuần tự hóa JSON nếu là dict
        metrics_json = json.dumps(metrics_data, ensure_ascii=False) if metrics_data and not isinstance(metrics_data, str) else metrics_data
        profile_json = json.dumps(profile_data, ensure_ascii=False) if profile_data and not isinstance(profile_data, str) else profile_data

        result = db.execute(
            text("""
                INSERT INTO project_character_presets (
                    project_id, name, sprite_name, metrics_data, profile_data,
                    new_character_concept, outfit_and_colors, weapons_and_props,
                    stature_rule, target_direction, positive_prompt, negative_prompt,
                    technical_notes
                ) VALUES (
                    :project_id, :name, :sprite_name, :metrics_data, :profile_data,
                    :new_character_concept, :outfit_and_colors, :weapons_and_props,
                    :stature_rule, :target_direction, :positive_prompt, :negative_prompt,
                    :technical_notes
                )
            """),
            {
                "project_id": project_id,
                "name": name,
                "sprite_name": sprite_name,
                "metrics_data": metrics_json,
                "profile_data": profile_json,
                "new_character_concept": new_concept,
                "outfit_and_colors": outfit,
                "weapons_and_props": weapons,
                "stature_rule": stature,
                "target_direction": direction,
                "positive_prompt": positive,
                "negative_prompt": negative,
                "technical_notes": notes,
            }
        )
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
