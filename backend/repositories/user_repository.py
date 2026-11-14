# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Kiểu)
# ========================================================
# typing: Khai báo kiểu dữ liệu danh sách, từ điển, tùy chọn
from typing import Dict, Any, List, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Xử lý câu lệnh SQL thuần bảo mật và phiên làm việc
from sqlalchemy import text
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Repositories)
# ========================================================
# ProjectRepository: Tái sử dụng hàm dọn dẹp và xóa dự án
from backend.repositories.project_repository import ProjectRepository

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class UserRepository:
    """
    Kho lưu trữ dữ liệu Người dùng (User Repository).
    Quản lý các thao tác truy vấn CSDL MySQL đối với bảng 'users'.
    """

    def __init__(self):
        self.project_repo = ProjectRepository()

    def get_by_id(self, db: Session, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Tìm kiếm tài khoản người dùng theo ID đầy đủ thông tin cá nhân.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {int} user_id Mã định danh tài khoản.
        @returns {Optional[Dict[str, Any]]} Thông tin người dùng hoặc None.
        """
        sql = text("""
            SELECT id, username, password, role, last_name, middle_name, first_name, full_name, avatar_url, created_at 
            FROM users WHERE id = :id;
        """)
        row = db.execute(sql, {"id": user_id}).mappings().first()
        return dict(row) if row else None

    def get_by_username(self, db: Session, username: str) -> Optional[Dict[str, Any]]:
        """
        Tìm kiếm tài khoản người dùng theo Tên đăng nhập / Gmail (Username).

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {str} username Tên tài khoản hoặc địa chỉ Gmail.
        @returns {Optional[Dict[str, Any]]} Thông tin người dùng hoặc None.
        """
        sql = text("""
            SELECT id, username, password, role, last_name, middle_name, first_name, full_name, avatar_url, created_at 
            FROM users WHERE username = :username;
        """)
        row = db.execute(sql, {"username": username.strip()}).mappings().first()
        return dict(row) if row else None

    def get_all(self, db: Session) -> List[Dict[str, Any]]:
        """
        Lấy toàn bộ danh sách tài khoản trong MySQL kèm số lượng dự án đang sở hữu.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @returns {List[Dict[str, Any]]} Danh sách người dùng.
        """
        sql = text("""
            SELECT 
                u.id, 
                u.username, 
                u.role, 
                u.last_name,
                u.middle_name,
                u.first_name,
                u.full_name,
                u.avatar_url,
                u.created_at,
                COUNT(p.id) AS project_count
            FROM users u
            LEFT JOIN projects p ON p.user_id = u.id
            GROUP BY u.id, u.username, u.role, u.last_name, u.middle_name, u.first_name, u.full_name, u.avatar_url, u.created_at
            ORDER BY u.id ASC;
        """)
        rows = db.execute(sql).mappings().all()
        return [dict(r) for r in rows]

    def create(
        self,
        db: Session,
        username: str,
        password: str,
        role: str = "user",
        last_name: Optional[str] = None,
        middle_name: Optional[str] = None,
        first_name: Optional[str] = None,
        full_name: Optional[str] = None,
        avatar_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Tạo mới một tài khoản người dùng có đầy đủ Họ, Tên đệm, Tên và Gmail trong CSDL MySQL.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {str} username Tên đăng nhập (định dạng Gmail).
        @param {str} password Mật khẩu.
        @param {str} role Vai trò ('admin' hoặc 'user').
        @param {Optional[str]} last_name Họ của người dùng.
        @param {Optional[str]} middle_name Tên đệm.
        @param {Optional[str]} first_name Tên chính.
        @param {Optional[str]} full_name Họ và tên hoàn chỉnh.
        @param {Optional[str]} avatar_url Ảnh đại diện Base64 nếu có.
        @returns {Dict[str, Any]} Bản ghi người dùng vừa được tạo.
        """
        clean_user = username.strip()
        clean_pass = password.strip()

        # Tự động ghép họ tên nếu chưa có
        if not full_name:
            parts = [last_name, middle_name, first_name]
            full_name = " ".join([p.strip() for p in parts if p and p.strip()]) or clean_user

        sql = text("""
            INSERT INTO users (username, password, role, last_name, middle_name, first_name, full_name, avatar_url)
            VALUES (:username, :password, :role, :last_name, :middle_name, :first_name, :full_name, :avatar_url);
        """)
        res = db.execute(sql, {
            "username": clean_user,
            "password": clean_pass,
            "role": role or "user",
            "last_name": last_name.strip() if last_name else None,
            "middle_name": middle_name.strip() if middle_name else None,
            "first_name": first_name.strip() if first_name else None,
            "full_name": full_name.strip() if full_name else clean_user,
            "avatar_url": avatar_url
        })
        db.commit()
        new_id = int(res.lastrowid)
        return {
            "id": new_id,
            "username": clean_user,
            "role": role or "user",
            "last_name": last_name,
            "middle_name": middle_name,
            "first_name": first_name,
            "full_name": full_name,
            "avatar_url": avatar_url
        }

    def update_profile(
        self,
        db: Session,
        user_id: int,
        last_name: Optional[str] = None,
        middle_name: Optional[str] = None,
        first_name: Optional[str] = None,
        username: Optional[str] = None,
        avatar_url: Optional[str] = None,
        new_password: Optional[str] = None
    ) -> bool:
        """
        Cập nhật thông tin hồ sơ cá nhân của người dùng trong MySQL.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {int} user_id ID tài khoản cần sửa.
        @param {Optional[str]} last_name Họ mới.
        @param {Optional[str]} middle_name Tên đệm mới.
        @param {Optional[str]} first_name Tên mới.
        @param {Optional[str]} username Tên tài khoản / Gmail mới.
        @param {Optional[str]} avatar_url Ảnh đại diện mới (Base64).
        @param {Optional[str]} new_password Mật khẩu mới nếu muốn đổi.
        @returns {bool} True nếu cập nhật thành công.
        """
        updates = []
        params = {"id": user_id}

        if last_name is not None:
            updates.append("last_name = :last_name")
            params["last_name"] = last_name.strip()

        if middle_name is not None:
            updates.append("middle_name = :middle_name")
            params["middle_name"] = middle_name.strip()

        if first_name is not None:
            updates.append("first_name = :first_name")
            params["first_name"] = first_name.strip()

        # Tự động cập nhật lại full_name nếu có sửa đổi họ tên
        if last_name is not None or middle_name is not None or first_name is not None:
            # Lấy thông tin hiện tại để ghép hoàn chỉnh
            current = self.get_by_id(db, user_id)
            c_last = last_name if last_name is not None else current.get("last_name")
            c_mid = middle_name if middle_name is not None else current.get("middle_name")
            c_first = first_name if first_name is not None else current.get("first_name")
            combined = " ".join([p.strip() for p in [c_last, c_mid, c_first] if p and p.strip()])
            updates.append("full_name = :full_name")
            params["full_name"] = combined or (username or current.get("username"))

        if username is not None and username.strip():
            updates.append("username = :username")
            params["username"] = username.strip()

        if avatar_url is not None:
            updates.append("avatar_url = :avatar_url")
            params["avatar_url"] = avatar_url

        if new_password is not None and new_password.strip():
            updates.append("password = :password")
            params["password"] = new_password.strip()

        if not updates:
            return True

        sql = f"UPDATE users SET {', '.join(updates)} WHERE id = :id;"
        res = db.execute(text(sql), params)
        db.commit()
        return res.rowcount > 0

    def assign_project_to_user(self, db: Session, project_id: int, user_id: int) -> bool:
        """
        Gán quyền sở hữu một dự án (như dự án mẫu ID = 2) sang cho một tài khoản cụ thể.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {int} project_id ID dự án cần chuyển giao.
        @param {int} user_id ID người nhận dự án.
        @returns {bool} True nếu gán thành công.
        """
        sql = text("UPDATE projects SET user_id = :user_id WHERE id = :project_id;")
        res = db.execute(sql, {"user_id": user_id, "project_id": project_id})
        db.commit()
        return res.rowcount > 0

    def delete(self, db: Session, user_id: int) -> bool:
        """
        Xóa một tài khoản người dùng và dọn dẹp sạch sẽ toàn bộ dự án thuộc quyền sở hữu:
        - Tuyệt đối không cho phép xóa tài khoản Admin tối cao (id = 1 hoặc role = 'admin').
        - Tuyệt đối không cho phép xóa tài khoản mẫu kiểm thử origin@gmail.com (id = 2).

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {int} user_id ID người dùng cần xóa.
        @returns {bool} True nếu xóa thành công, False nếu không tìm thấy hoặc là Admin / tài khoản kiểm thử.
        """
        target = self.get_by_id(db, user_id)
        if not target:
            return False

        if target.get("role") == "admin" or user_id == 1:
            raise ValueError("Không thể xóa tài khoản Quản trị viên (Admin) tối cao!")

        if user_id == 2 or target.get("username") == "origin@gmail.com":
            raise ValueError("Không thể xóa tài khoản mẫu kiểm thử (origin@gmail.com)!")

        try:
            # 1. Tìm tất cả các dự án thuộc quyền sở hữu của user này
            proj_rows = db.execute(
                text("SELECT id FROM projects WHERE user_id = :user_id;"),
                {"user_id": user_id}
            ).mappings().all()

            # 2. Xóa sạch các dự án và toàn bộ dữ liệu phụ thuộc (sprites, frames, testbed...)
            for row in proj_rows:
                self.project_repo.delete(db, int(row["id"]))

            # 3. Cuối cùng xóa bản ghi tài khoản khỏi bảng users
            res = db.execute(text("DELETE FROM users WHERE id = :id;"), {"id": user_id})
            db.commit()
            return res.rowcount > 0
        except Exception:
            db.rollback()
            raise
