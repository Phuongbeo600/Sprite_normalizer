"""
Module: backend.repositories.project_repository
Mục đích: Kho lưu trữ dữ liệu Dự án (Project Repository).
Ai gọi nó: `ProjectService`, `UserRepository`.
Tại sao tồn tại: Đóng gói toàn bộ các thao tác truy vấn CSDL MySQL đối với bảng 'projects', giúp tầng nghiệp vụ và Router hoàn toàn tách biệt khỏi câu lệnh SQL.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Kiểu)
# ========================================================
# typing: Khai báo kiểu danh sách, từ điển, tùy chọn, bộ giá trị
from typing import List, Optional, Dict, Any, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Thực thi truy vấn SQL và quản lý phiên Session
from sqlalchemy import text
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Base & Database Migrations)
# ========================================================
# BaseRepository: Lớp cơ sở trừu tượng
from .base import BaseRepository
# ensure_project_columns: Tự động bổ sung cột cấu hình API nếu bảng projects bị thiếu
from backend.db import ensure_project_columns

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


def _mask_key(key: Optional[str]) -> str:
    """
    Tạo chuỗi che giấu chìa khóa API an toàn (Masked Key).

    @param {Optional[str]} key Chuỗi khóa API gốc.
    @returns {str} Chuỗi khóa đã che dấu hoặc chuỗi rỗng.
    """
    if not key or len(key) < 8:
        return ""
    return key[:6] + "..." + key[-4:]


def _format_api_config_record(data: Dict[str, Any], project_id: int) -> Dict[str, Any]:
    """
    Định dạng dữ liệu cấu hình API của dự án từ bản ghi CSDL.

    @param {Dict[str, Any]} data Dữ liệu dòng CSDL dạng từ điển.
    @param {int} project_id ID của dự án.
    @returns {Dict[str, Any]} Cấu hình API hoàn chỉnh kèm các trường che dấu và trường thô.
    """
    gemini_key = data.get("gemini_api_key") or ""
    openai_key = data.get("openai_api_key") or ""

    return {
        "project_id": project_id,
        "project_name": data.get("name"),
        "api_provider": data.get("api_provider") or "gemini",
        "gemini_has_key": bool(gemini_key),
        "gemini_masked_key": _mask_key(gemini_key),
        "openai_has_key": bool(openai_key),
        "openai_masked_key": _mask_key(openai_key),
        "openai_base_url": data.get("openai_base_url") or "https://api.openai.com/v1",
        "ai_enabled": bool(data.get("ai_enabled") if data.get("ai_enabled") is not None else True),
        # Trả về key thực tế cho tầng backend gọi AI
        "_gemini_raw_key": gemini_key,
        "_openai_raw_key": openai_key,
    }


def _cleanup_dependent_project_data(db: Session, project_id: int) -> None:
    """
    Dọn dẹp an toàn toàn bộ dữ liệu phụ thuộc của dự án ở các bảng con tránh lỗi khóa ngoại (Foreign Key).

    @param {Session} db Phiên làm việc cơ sở dữ liệu.
    @param {int} project_id ID dự án cần dọn dẹp.
    """
    # 1. Xóa các frame cắt rời trong sprite_frames
    try:
        db.execute(text("""
            DELETE sf FROM sprite_frames sf
            INNER JOIN project_sprites ps ON sf.sprite_id = ps.id
            WHERE ps.project_id = :id
        """), {"id": project_id})
    except Exception:
        pass

    # 2. Xóa các tấm ảnh sprite trong project_sprites
    try:
        db.execute(text("DELETE FROM project_sprites WHERE project_id = :id"), {"id": project_id})
    except Exception:
        pass

    # 3. Xóa các ô frame nhân vật trong testbed_character_frames
    try:
        db.execute(text("""
            DELETE tcf FROM testbed_character_frames tcf
            INNER JOIN testbed_characters tc ON tcf.character_id = tc.id
            WHERE tc.project_id = :id
        """), {"id": project_id})
    except Exception:
        pass

    # 4. Xóa đội hình nhân vật trong testbed_characters
    try:
        db.execute(text("DELETE FROM testbed_characters WHERE project_id = :id"), {"id": project_id})
    except Exception:
        pass

    # 5. Xóa bản đồ nền trong testbed_maps
    try:
        db.execute(text("DELETE FROM testbed_maps WHERE project_id = :id"), {"id": project_id})
    except Exception:
        pass

    # 6. Xóa các bản lưu phân tích & prompt trong project_character_presets
    try:
        db.execute(text("DELETE FROM project_character_presets WHERE project_id = :id"), {"id": project_id})
    except Exception:
        pass


def _build_api_config_update(
    project_id: int,
    api_provider: str = "gemini",
    gemini_api_key: Optional[str] = None,
    openai_api_key: Optional[str] = None,
    openai_base_url: Optional[str] = None,
    ai_enabled: Optional[bool] = None,
) -> Tuple[str, Dict[str, Any]]:
    """
    Xây dựng câu truy vấn UPDATE động và tham số cho cấu hình API của dự án.

    @returns {Tuple[str, Dict[str, Any]]} (Câu lệnh SQL, Từ điển tham số).
    """
    updates = ["api_provider = :api_provider"]
    params: Dict[str, Any] = {
        "id": project_id,
        "api_provider": api_provider or "gemini",
    }

    if gemini_api_key is not None:
        updates.append("gemini_api_key = :gemini_api_key")
        params["gemini_api_key"] = gemini_api_key.strip() if gemini_api_key.strip() else None

    if openai_api_key is not None:
        updates.append("openai_api_key = :openai_api_key")
        params["openai_api_key"] = openai_api_key.strip() if openai_api_key.strip() else None

    if openai_base_url is not None:
        updates.append("openai_base_url = :openai_base_url")
        params["openai_base_url"] = openai_base_url.strip() or "https://api.openai.com/v1"

    if ai_enabled is not None:
        updates.append("ai_enabled = :ai_enabled")
        params["ai_enabled"] = bool(ai_enabled)

    query_str = f"UPDATE projects SET {', '.join(updates)} WHERE id = :id"
    return query_str, params


class ProjectRepository(BaseRepository):
    """
    Kho lưu trữ dữ liệu Dự án (Project Repository).
    Đóng gói toàn bộ các thao tác truy vấn CSDL MySQL đối với bảng 'projects',
    giúp Router hoàn toàn tách biệt khỏi câu lệnh SQL.
    """

    def get_all(self, db: Session, user_id: Optional[int] = None, role: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Lấy danh sách dự án sắp xếp theo ID giảm dần (mới nhất trước):
        - Nếu là Admin (role = 'admin') hoặc không lọc user: Lấy tất cả dự án.
        - Nếu là User thường: Chỉ lấy các dự án thuộc quyền sở hữu của user_id đó.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {Optional[int]} user_id ID người dùng để lọc (nếu là user thường).
        @param {Optional[str]} role Vai trò ('admin' hoặc 'user').
        @returns {List[Dict[str, Any]]} Danh sách các dự án.
        """
        if role == "admin" or not user_id:
            rows = db.execute(
                text("SELECT id, name, user_id, created_at FROM projects ORDER BY id DESC")
            ).mappings()
        else:
            rows = db.execute(
                text("SELECT id, name, user_id, created_at FROM projects WHERE user_id = :user_id ORDER BY id DESC"),
                {"user_id": user_id}
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
            text("SELECT id, name, user_id, created_at FROM projects WHERE id = :id"),
            {"id": entity_id}
        ).mappings().first()
        return dict(row) if row else None

    def create(self, db: Session, **kwargs) -> Dict[str, Any]:
        """
        Thêm một dự án mới vào bảng projects có gắn kèm user_id sở hữu.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {str} kwargs['name'] Tên của dự án mới.
        @param {Optional[int]} kwargs['user_id'] ID người tạo dự án.
        @returns {Dict[str, Any]} Bản ghi dự án vừa được tạo.
        """
        name = kwargs.get("name", "").strip()
        user_id = kwargs.get("user_id")

        if user_id:
            result = db.execute(
                text("INSERT INTO projects (name, user_id) VALUES (:name, :user_id)"),
                {"name": name, "user_id": user_id}
            )
        else:
            result = db.execute(
                text("INSERT INTO projects (name) VALUES (:name)"),
                {"name": name}
            )
        db.commit()
        new_id = int(result.lastrowid)
        return {"id": new_id, "name": name, "user_id": user_id}

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
        Xóa một dự án theo ID và dọn dẹp sạch sẽ toàn bộ dữ liệu phụ thuộc trong MySQL.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {int} entity_id ID dự án cần xóa.
        @returns {bool} True nếu xóa thành công, False nếu không tìm thấy ID.
        """
        try:
            # 1. Dọn dẹp an toàn các bảng phụ thuộc tránh lỗi khóa ngoại
            _cleanup_dependent_project_data(db, entity_id)

            # 2. Xóa dự án chính
            result = db.execute(
                text("DELETE FROM projects WHERE id = :id"),
                {"id": entity_id}
            )
            db.commit()
            return result.rowcount > 0
        except Exception:
            db.rollback()
            # Thử xóa trực tiếp nếu có cấu hình ON DELETE CASCADE
            result = db.execute(
                text("DELETE FROM projects WHERE id = :id"),
                {"id": entity_id}
            )
            db.commit()
            return result.rowcount > 0

    def get_api_config(self, db: Session, project_id: int) -> Optional[Dict[str, Any]]:
        """
        Lấy cấu hình chìa khóa API riêng của một dự án từ CSDL MySQL.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {int} project_id ID dự án.
        @returns {Optional[Dict[str, Any]]} Cấu hình API của dự án.
        """
        sql = text("""
            SELECT id, name, api_provider, gemini_api_key, openai_api_key, openai_base_url, ai_enabled
            FROM projects WHERE id = :id
        """)
        try:
            row = db.execute(sql, {"id": project_id}).mappings().first()
        except Exception:
            # Tự động khắc phục nếu cột chưa được tạo trong CSDL MySQL
            db.rollback()
            ensure_project_columns(db)
            db.commit()
            row = db.execute(sql, {"id": project_id}).mappings().first()

        if not row:
            return None

        return _format_api_config_record(dict(row), project_id)

    def update_api_config(
        self,
        db: Session,
        project_id: int,
        api_provider: str = "gemini",
        gemini_api_key: Optional[str] = None,
        openai_api_key: Optional[str] = None,
        openai_base_url: Optional[str] = None,
        ai_enabled: Optional[bool] = None
    ) -> bool:
        """
        Cập nhật cấu hình API Key và trạng thái kích hoạt AI cho dự án trong MySQL.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {int} project_id ID dự án.
        @param {str} api_provider Nhà cung cấp ('gemini' | 'openai').
        @param {Optional[str]} gemini_api_key Khóa Google Gemini mới nếu có.
        @param {Optional[str]} openai_api_key Khóa OpenAI mới nếu có.
        @param {Optional[str]} openai_base_url Địa chỉ proxy nếu có.
        @param {Optional[bool]} ai_enabled Trạng thái bật/tắt toàn bộ AI trong dự án.
        @returns {bool} True nếu cập nhật thành công.
        """
        query_str, params = _build_api_config_update(
            project_id=project_id,
            api_provider=api_provider,
            gemini_api_key=gemini_api_key,
            openai_api_key=openai_api_key,
            openai_base_url=openai_base_url,
            ai_enabled=ai_enabled,
        )

        try:
            result = db.execute(text(query_str), params)
            db.commit()
            return result.rowcount > 0
        except Exception:
            # Tự phục hồi: nếu thiếu cột trong MySQL, tự động tạo cột rồi thử lại
            db.rollback()
            ensure_project_columns(db)
            db.commit()
            result = db.execute(text(query_str), params)
            db.commit()
            return result.rowcount > 0
