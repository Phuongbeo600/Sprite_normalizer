# 1. THƯ VIỆN NỀN TẢNG PYTHON
# Không cần thư viện nền tảng bổ sung.

# 2. THƯ VIỆN BÊN NGOÀI (Câu lệnh SQL)
from sqlalchemy import text

# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
# Chính sách dữ liệu mẫu được giữ nguyên để tương thích hiện trạng.

# 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
# Không có cấu hình bổ sung.


def seed_development_users(conn):
    """Khởi tạo tài khoản mẫu trên giao dịch bootstrap hiện có."""
    #  Khởi tạo tài khoản Admin mặc định (admin / mật khẩu: 1)
    conn.execute(text("""
        INSERT IGNORE INTO users (id, username, password, role, full_name)
        VALUES (1, 'admin', '1', 'admin', 'Quản trị viên tối cao');
    """))
    try:
        conn.execute(text("UPDATE users SET password = '1', role = 'admin' WHERE username = 'admin';"))
    except Exception:
        pass
    # Tạo tài khoản kiểm thử mẫu nếu bên trong mysql chưa có
    try:
        conn.execute(text("""
        INSERT IGNORE INTO users ( username, password, role, first_name, full_name)
VALUES ('origin@gmail.com', '123456', 'user', 'Origin', 'Tài khoản mẫu kiểm thử');
"""))
    except Exception:
        pass


def synchronize_development_login(db, repository, clean_user, clean_pass, user, verify_password, hash_password):
    """Giữ nguyên chính sách tự đồng bộ và commit/rollback của tài khoản mẫu."""
    # TỰ ĐỘNG ĐỒNG BỘ: Đảm bảo tài khoản kiểm thử Origin (123456) luôn đăng nhập thành công
    if clean_user.lower() == "origin@gmail.com" and clean_pass == "123456":
        stored_pwd = user.get("password") if user else ""
        is_valid_origin, _ = verify_password(clean_pass, stored_pwd) if stored_pwd else (False, False)
        if not user or not is_valid_origin:
            try:
                hashed_origin = hash_password(clean_pass)
                if not user:
                    db.execute(text("""
                        INSERT INTO users (id, username, password, role, first_name, full_name)
                        VALUES (2, 'origin@gmail.com', :pwd, 'user', 'Origin', 'Origin (Tài khoản mẫu kiểm thử)');
                    """), {"pwd": hashed_origin})
                else:
                    db.execute(text("UPDATE users SET password = :pwd, role = 'user' WHERE username = 'origin@gmail.com';"), {"pwd": hashed_origin})
                db.commit()
                user = repository.get_by_username(db, "origin@gmail.com")
            except Exception:
                db.rollback()

    # TỰ ĐỘNG ĐỒNG BỘ: Đảm bảo tài khoản Admin (admin / 1) luôn đăng nhập thành công
    if clean_user == "admin" and clean_pass == "1":
        stored_admin_pwd = user.get("password") if user else ""
        is_valid_admin, _ = verify_password(clean_pass, stored_admin_pwd) if stored_admin_pwd else (False, False)
        if not user or not is_valid_admin:
            try:
                hashed_admin = hash_password(clean_pass)
                if not user:
                    db.execute(text("""
                        INSERT INTO users (id, username, password, role, full_name)
                        VALUES (1, 'admin', :pwd, 'admin', 'Quản trị viên tối cao');
                    """), {"pwd": hashed_admin})
                else:
                    db.execute(text("UPDATE users SET password = :pwd, role = 'admin' WHERE username = 'admin';"), {"pwd": hashed_admin})
                db.commit()
                user = repository.get_by_username(db, "admin")
            except Exception:
                db.rollback()
    return user
