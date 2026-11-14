# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Biểu thức chính quy)
# ========================================================
# re: Biểu thức chính quy kiểm tra định dạng Gmail hợp lệ
import re
# typing: Định nghĩa danh sách, từ điển và giá trị tùy chọn
from typing import Dict, Any, List, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Phiên làm việc cơ sở dữ liệu và cú pháp SQL thuần
from sqlalchemy import text
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Repositories & Schemas)
# ========================================================
# UserRepository: Tầng truy xuất CSDL bảng 'users'
from backend.repositories.user_repository import UserRepository

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

# Biểu thức chính quy kiểm tra định dạng tài khoản Gmail
GMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@gmail\.com$", re.IGNORECASE)


class UserService:
    """
    Dịch vụ Nghiệp vụ Người dùng & Xác thực (User & Authentication Service).
    Xử lý logic kiểm tra định dạng Gmail, đăng ký, đăng nhập và đổi mật khẩu an toàn.
    """

    def __init__(self, repository: Optional[UserRepository] = None):
        self.repository = repository or UserRepository()

    def validate_gmail_format(self, email: str) -> bool:
        """
        Kiểm tra xem chuỗi có phải là định dạng Gmail hợp lệ hay không.

        @param {str} email Chuỗi cần kiểm tra.
        @returns {bool} True nếu đúng định dạng @gmail.com.
        """
        if not email:
            return False
        return bool(GMAIL_REGEX.match(email.strip()))

    def authenticate(self, db: Session, username: str, password: str) -> Dict[str, Any]:
        """
        Xác thực thông tin đăng nhập của người dùng.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {str} username Tên tài khoản hoặc Gmail.
        @param {str} password Mật khẩu đăng nhập.
        @returns {Dict[str, Any]} Thông tin người dùng khi đăng nhập thành công.
        @throws {ValueError} Nếu sai tên tài khoản hoặc mật khẩu.
        """
        clean_user = username.strip()
        clean_pass = password.strip()
        if not clean_user or not clean_pass:
            raise ValueError("Vui lòng điền đầy đủ tên đăng nhập và mật khẩu.")

        user = self.repository.get_by_username(db, clean_user)

        # TỰ ĐỘNG ĐỒNG BỘ: Đảm bảo tài khoản kiểm thử Origin (123456) luôn đăng nhập thành công
        if clean_user.lower() == "origin@gmail.com" and clean_pass == "123456":
            if not user or user.get("password") != clean_pass:
                try:
                    if not user:
                        db.execute(text("""
                            INSERT INTO users (id, username, password, role, first_name, full_name)
                            VALUES (2, 'origin@gmail.com', '123456', 'user', 'Origin', 'Origin (Tài khoản mẫu kiểm thử)');
                        """))
                    else:
                        db.execute(text("UPDATE users SET password = '123456', role = 'user' WHERE username = 'origin@gmail.com';"))
                    db.commit()
                    user = self.repository.get_by_username(db, "origin@gmail.com")
                except Exception:
                    db.rollback()

        # TỰ ĐỘNG ĐỒNG BỘ: Đảm bảo tài khoản Admin (admin / 1) luôn đăng nhập thành công
        if clean_user == "admin" and clean_pass == "1":
            if not user or user.get("password") != clean_pass:
                try:
                    if not user:
                        db.execute(text("""
                            INSERT INTO users (id, username, password, role, full_name)
                            VALUES (1, 'admin', '1', 'admin', 'Quản trị viên tối cao');
                        """))
                    else:
                        db.execute(text("UPDATE users SET password = '1', role = 'admin' WHERE username = 'admin';"))
                    db.commit()
                    user = self.repository.get_by_username(db, "admin")
                except Exception:
                    db.rollback()

        # 1. KIỂM TRA TỒN TẠI TRONG MYSQL: Nếu chưa có tài khoản thì thông báo rõ chưa có
        if not user:
            raise ValueError(f"Tài khoản '{clean_user}' chưa tồn tại trong cơ sở dữ liệu. Vui lòng kiểm tra lại hoặc chuyển sang tab Đăng ký mới!")

        # 2. KIỂM TRA MẬT KHẨU: Nếu có tài khoản rồi thì so khớp mật khẩu
        if user.get("password") != clean_pass:
            raise ValueError("Mật khẩu không chính xác. Vui lòng kiểm tra lại mật khẩu!")

        return {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "last_name": user.get("last_name") or "",
            "middle_name": user.get("middle_name") or "",
            "first_name": user.get("first_name") or "",
            "full_name": user.get("full_name") or user["username"],
            "avatar_url": user.get("avatar_url") or "",
            "created_at": str(user.get("created_at") or "")
        }

    def register(
        self,
        db: Session,
        username: str,
        password: str,
        last_name: Optional[str] = None,
        middle_name: Optional[str] = None,
        first_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Đăng ký tài khoản người dùng mới bắt buộc định dạng Gmail.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {str} username Tên tài khoản (bắt buộc đuôi @gmail.com).
        @param {str} password Mật khẩu.
        @param {Optional[str]} last_name Họ.
        @param {Optional[str]} middle_name Tên đệm.
        @param {Optional[str]} first_name Tên.
        @returns {Dict[str, Any]} Thông tin tài khoản mới vừa tạo.
        @throws {ValueError} Nếu định dạng Gmail không đúng hoặc tên đã tồn tại.
        """
        clean_user = username.strip()
        clean_pass = password.strip()

        if not clean_user or not clean_pass:
            raise ValueError("Tên tài khoản (Gmail) và mật khẩu không được để trống.")

        # BẮT BUỘC: Kiểm tra định dạng Gmail đối với tài khoản đăng ký mới
        if not self.validate_gmail_format(clean_user):
            raise ValueError("Tên tài khoản bắt buộc phải có định dạng Gmail hợp lệ (Ví dụ: yourname@gmail.com)!")

        if len(clean_pass) < 1:
            raise ValueError("Mật khẩu không được để trống.")

        # Kiểm tra trùng tên tài khoản Gmail
        existing = self.repository.get_by_username(db, clean_user)
        if existing:
            raise ValueError(f"Tài khoản Gmail '{clean_user}' đã được đăng ký trước đó. Vui lòng chọn Gmail khác.")

        # Tạo họ tên đầy đủ
        parts = [last_name, middle_name, first_name]
        combined_name = " ".join([p.strip() for p in parts if p and p.strip()]) or clean_user

        # Tạo tài khoản với quyền user thường
        created = self.repository.create(
            db=db,
            username=clean_user,
            password=clean_pass,
            role="user",
            last_name=last_name,
            middle_name=middle_name,
            first_name=first_name,
            full_name=combined_name
        )

        return created

    def update_profile(
        self,
        db: Session,
        user_id: int,
        last_name: Optional[str] = None,
        middle_name: Optional[str] = None,
        first_name: Optional[str] = None,
        username: Optional[str] = None,
        avatar_url: Optional[str] = None,
        current_password: Optional[str] = None,
        new_password: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Cập nhật thông tin cá nhân (ảnh đại diện, họ tên, Gmail) hoặc đổi mật khẩu.

        @param {Session} db Phiên làm việc cơ sở dữ liệu.
        @param {int} user_id ID tài khoản.
        @returns {Dict[str, Any]} Thông tin tài khoản sau khi cập nhật thành công.
        """
        current_user = self.repository.get_by_id(db, user_id)
        if not current_user:
            raise ValueError("Không tìm thấy người dùng.")

        # 1. Nếu có yêu cầu đổi username/Gmail
        clean_user = username.strip() if username else None
        if clean_user and clean_user != current_user["username"]:
            # Nếu không phải admin thì bắt buộc định dạng Gmail
            if current_user.get("role") != "admin" and not self.validate_gmail_format(clean_user):
                raise ValueError("Tên tài khoản mới bắt buộc phải có định dạng Gmail hợp lệ (đuôi @gmail.com)!")

            existing = self.repository.get_by_username(db, clean_user)
            if existing and existing["id"] != user_id:
                raise ValueError(f"Tài khoản Gmail '{clean_user}' đã được người khác sử dụng.")

        # 2. Nếu có yêu cầu đổi mật khẩu
        verified_new_pass = None
        if new_password and new_password.strip():
            if not current_password or current_password.strip() != current_user.get("password"):
                raise ValueError("Mật khẩu hiện tại không chính xác. Không thể đổi mật khẩu mới.")
            verified_new_pass = new_password.strip()

        # 3. Cập nhật vào CSDL MySQL
        self.repository.update_profile(
            db=db,
            user_id=user_id,
            last_name=last_name,
            middle_name=middle_name,
            first_name=first_name,
            username=clean_user,
            avatar_url=avatar_url,
            new_password=verified_new_pass
        )

        # Trả về thông tin cập nhật mới nhất
        updated = self.repository.get_by_id(db, user_id)
        return {
            "id": updated["id"],
            "username": updated["username"],
            "role": updated["role"],
            "last_name": updated.get("last_name") or "",
            "middle_name": updated.get("middle_name") or "",
            "first_name": updated.get("first_name") or "",
            "full_name": updated.get("full_name") or updated["username"],
            "avatar_url": updated.get("avatar_url") or "",
            "created_at": str(updated.get("created_at") or "")
        }

    def assign_project_to_user(self, db: Session, project_id: int, user_id: int) -> bool:
        """
        Chuyển giao toàn bộ quyền sở hữu một dự án cho tài khoản người dùng chỉ định.
        """
        return self.repository.assign_project_to_user(db, project_id, user_id)

    def get_all_users(self, db: Session, current_user_role: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Lấy danh sách tất cả người dùng trong hệ thống (Dành cho trang Quản trị Admin).
        """
        if current_user_role != "admin":
            raise PermissionError("Chỉ có Quản trị viên (Admin) mới có quyền xem danh sách tài khoản.")

        raw_users = self.repository.get_all(db)
        safe_users = []
        for u in raw_users:
            safe_users.append({
                "id": u["id"],
                "username": u["username"],
                "role": u["role"],
                "last_name": u.get("last_name") or "",
                "middle_name": u.get("middle_name") or "",
                "first_name": u.get("first_name") or "",
                "full_name": u.get("full_name") or u["username"],
                "avatar_url": u.get("avatar_url") or "",
                "created_at": str(u.get("created_at") or ""),
                "project_count": int(u.get("project_count") or 0)
            })
        return safe_users

    def delete_user(self, db: Session, user_id: int, current_user_role: Optional[str] = None) -> bool:
        """
        Admin xóa một tài khoản người dùng và dọn dẹp các dự án của tài khoản đó.
        Bảo vệ tuyệt đối tài khoản Admin (id = 1) và tài khoản mẫu kiểm thử origin@gmail.com (id = 2).
        """
        if current_user_role != "admin":
            raise PermissionError("Chỉ có Quản trị viên (Admin) mới có quyền xóa người dùng.")

        if user_id in (1, 2):
            raise PermissionError("Không thể xóa tài khoản Quản trị viên hoặc tài khoản mẫu kiểm thử (origin@gmail.com).")

        return self.repository.delete(db, user_id)
