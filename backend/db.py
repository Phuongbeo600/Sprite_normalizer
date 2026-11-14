# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống & Đường dẫn)
# ========================================================
# os: Đọc biến môi trường hệ thống từ file .env
import os
# pathlib: Định vị chính xác đường dẫn file cấu hình .env ở thư mục gốc
from pathlib import Path

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# dotenv: Nạp biến môi trường từ file .env vào os.environ
from dotenv import load_dotenv
# sqlalchemy: Tạo URL kết nối, quản lý engine MySQL và thực thi SQL an toàn
from sqlalchemy import URL, create_engine, text
# sessionmaker: Tạo phiên làm việc (Session) thực hiện truy vấn an toàn
from sqlalchemy.orm import sessionmaker

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

# Nạp file cấu hình .env từ thư mục gốc dự án
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

# Tạo địa chỉ URL kết nối CSDL MySQL với mã hóa utf8mb4 hỗ trợ tiếng Việt đầy đủ
database_url = URL.create(
    drivername="mysql+pymysql",
    username=os.getenv("SPRITE_DB_USER", "sprite_app"),
    password=os.getenv("SPRITE_DB_PASSWORD", ""),
    host=os.getenv("SPRITE_DB_HOST", "127.0.0.1"),
    port=int(os.getenv("SPRITE_DB_PORT", "3306")),
    database=os.getenv("SPRITE_DB_NAME", "sprite_normalizer"),
    query={"charset": "utf8mb4"},
)

engine = create_engine(database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)


def ensure_project_columns(conn_or_session):
    """
    Đảm bảo các cột lưu cấu hình API Key tồn tại trong bảng 'projects'.
    Tự động thêm cột nếu bảng đã tồn tại từ trước mà chưa có các cột này.

    @param conn_or_session Kết nối (Connection) hoặc phiên (Session) CSDL MySQL.
    """
    columns_to_ensure = [
        ("api_provider", "VARCHAR(50) DEFAULT 'gemini'"),
        ("gemini_api_key", "TEXT NULL"),
        ("openai_api_key", "TEXT NULL"),
        ("openai_base_url", "VARCHAR(255) DEFAULT 'https://api.openai.com/v1'"),
        ("ai_enabled", "BOOLEAN DEFAULT TRUE"),
        ("user_id", "INT NULL")
    ]
    for col_name, col_type in columns_to_ensure:
        try:
            conn_or_session.execute(text(f"ALTER TABLE projects ADD COLUMN {col_name} {col_type};"))
        except Exception:
            # Bỏ qua nếu cột đã tồn tại (lỗi trùng tên cột 1060 trong MySQL)
            pass


def ensure_preset_columns(conn_or_session):
    """
    Đảm bảo các cột mở rộng tồn tại trong bảng 'project_character_presets'.
    Bổ sung cột frame_actions_data lưu ma trận chi tiết 15 frames hoạt họa.

    @param conn_or_session Kết nối hoặc phiên làm việc CSDL MySQL.
    """
    try:
        conn_or_session.execute(text("ALTER TABLE project_character_presets ADD COLUMN frame_actions_data JSON NULL;"))
    except Exception:
        pass


def ensure_user_columns(conn_or_session):
    """
    Đảm bảo các cột thông tin cá nhân mở rộng tồn tại trong bảng 'users':
    - Họ, Tên đệm, Tên, Họ tên đầy đủ, và Ảnh đại diện (Avatar Base64/URL).

    @param conn_or_session Kết nối hoặc phiên làm việc CSDL MySQL.
    """
    user_cols = [
        ("last_name", "VARCHAR(50) NULL"),
        ("middle_name", "VARCHAR(50) NULL"),
        ("first_name", "VARCHAR(50) NULL"),
        ("full_name", "VARCHAR(150) NULL"),
        ("avatar_url", "LONGTEXT NULL")
    ]
    for col_name, col_type in user_cols:
        try:
            conn_or_session.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type};"))
        except Exception:
            pass


def init_db():
    """
    Khởi tạo và tự động cập nhật cấu trúc các bảng trong cơ sở dữ liệu MySQL:
    1. Bảng users: Quản lý tài khoản đăng nhập (Admin tối cao và Người dùng thường, Họ tên, Gmail, Avatar).
    2. Bảng projects: Mở rộng các cột lưu API Key, AI enabled và user_id sở hữu.
    3. Bảng project_character_presets: Lưu trữ lịch sử chỉ số giải phẫu pixel, prompt và ma trận 15 frame.
    """
    try:
        with engine.begin() as conn:
            # 1. Tạo bảng users lưu tài khoản và phân quyền
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(100) NOT NULL UNIQUE,
                    password VARCHAR(255) NOT NULL,
                    role VARCHAR(20) NOT NULL DEFAULT 'user',
                    last_name VARCHAR(50) NULL,
                    middle_name VARCHAR(50) NULL,
                    first_name VARCHAR(50) NULL,
                    full_name VARCHAR(150) NULL,
                    avatar_url LONGTEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """))

            # Tự động cập nhật cột nếu bảng users đã tạo từ trước
            ensure_user_columns(conn)

            # 2. Khởi tạo tài khoản Admin mặc định (admin / mật khẩu: 1)
            conn.execute(text("""
                INSERT IGNORE INTO users (id, username, password, role, full_name)
                VALUES (1, 'admin', '1', 'admin', 'Quản trị viên tối cao');
            """))
            try:
                conn.execute(text("UPDATE users SET password = '1', role = 'admin' WHERE username = 'admin';"))
            except Exception:
                pass

            # 2b. Khởi tạo / Đồng bộ tài khoản mẫu kiểm thử origin@gmail.com (id = 2 / mật khẩu: 123456)
            try:
                # Kiểm tra tài khoản có username 'origin@gmail.com'
                u_by_name = conn.execute(
                    text("SELECT id FROM users WHERE username = 'origin@gmail.com';")
                ).mappings().first()

                # Kiểm tra tài khoản có id = 2
                u_by_id2 = conn.execute(
                    text("SELECT id, username FROM users WHERE id = 2;")
                ).mappings().first()

                if u_by_name and u_by_name["id"] == 2:
                    # Trường hợp 1: origin@gmail.com đã đúng ở id = 2 -> Cập nhật mật khẩu 123456
                    conn.execute(text("""
                        UPDATE users 
                        SET password = '123456', 
                            role = 'user', 
                            first_name = 'Origin', 
                            full_name = 'Origin (Tài khoản mẫu kiểm thử)'
                        WHERE id = 2;
                    """))
                elif u_by_name and u_by_name["id"] != 2:
                    # Trường hợp 2: origin@gmail.com đang ở id khác -> giải phóng id = 2 nếu bị chiếm rồi chuyển về id = 2
                    old_id = u_by_name["id"]
                    if u_by_id2:
                        conn.execute(text("DELETE FROM users WHERE id = 2;"))
                    conn.execute(
                        text("""
                            UPDATE users 
                            SET id = 2, 
                                password = '123456', 
                                role = 'user', 
                                first_name = 'Origin', 
                                full_name = 'Origin (Tài khoản mẫu kiểm thử)'
                            WHERE id = :old_id;
                        """),
                        {"old_id": old_id}
                    )
                    try:
                        conn.execute(
                            text("UPDATE projects SET user_id = 2 WHERE user_id = :old_id;"),
                            {"old_id": old_id}
                        )
                    except Exception:
                        pass
                elif not u_by_name and u_by_id2:
                    # Trường hợp 3: Có id = 2 nhưng mang username khác -> Chuyển thành origin@gmail.com
                    conn.execute(text("""
                        UPDATE users 
                        SET username = 'origin@gmail.com', 
                            password = '123456', 
                            role = 'user', 
                            first_name = 'Origin', 
                            full_name = 'Origin (Tài khoản mẫu kiểm thử)'
                        WHERE id = 2;
                    """))
                else:
                    # Trường hợp 4: Chưa có cả hai -> Chèn mới id = 2
                    conn.execute(text("""
                        INSERT INTO users (id, username, password, role, first_name, full_name)
                        VALUES (2, 'origin@gmail.com', '123456', 'user', 'Origin', 'Origin (Tài khoản mẫu kiểm thử)');
                    """))
            except Exception:
                # Dự phòng an toàn: Luôn đảm bảo tài khoản origin@gmail.com có mật khẩu 123456
                try:
                    conn.execute(text("""
                        UPDATE users 
                        SET password = '123456', role = 'user' 
                        WHERE username = 'origin@gmail.com';
                    """))
                except Exception:
                    pass

            # 3. Tạo bảng projects nếu chưa tồn tại
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS projects (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    user_id INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    api_provider VARCHAR(50) DEFAULT 'gemini',
                    gemini_api_key TEXT NULL,
                    openai_api_key TEXT NULL,
                    openai_base_url VARCHAR(255) DEFAULT 'https://api.openai.com/v1',
                    ai_enabled BOOLEAN DEFAULT TRUE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """))

            # 4. Bổ sung các cột lưu API và user_id nếu bảng projects đã tồn tại từ các phiên bản cũ
            ensure_project_columns(conn)

            # 5. Gán các dự án cũ chưa có user_id cho tài khoản Admin (id = 1)
            try:
                conn.execute(text("UPDATE projects SET user_id = 1 WHERE user_id IS NULL;"))
            except Exception:
                pass

            # 5b. Đảm bảo dự án ID 2 thuộc sở hữu của tài khoản kiểm thử origin@gmail.com (user_id = 2)
            try:
                conn.execute(text("UPDATE projects SET user_id = 2 WHERE id = 2;"))
            except Exception:
                pass

            # 6. Tạo bảng project_character_presets liên kết với projects(id)
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS project_character_presets (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    project_id INT NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    sprite_name VARCHAR(255) NULL,
                    metrics_data JSON NULL,
                    profile_data JSON NULL,
                    frame_actions_data JSON NULL,
                    new_character_concept VARCHAR(255) NOT NULL,
                    outfit_and_colors TEXT NULL,
                    weapons_and_props TEXT NULL,
                    stature_rule VARCHAR(100) NULL,
                    target_direction VARCHAR(100) DEFAULT 'Front / Down view',
                    positive_prompt LONGTEXT NOT NULL,
                    negative_prompt LONGTEXT NOT NULL,
                    technical_notes TEXT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT fk_preset_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """))

            # 4. Tự động kiểm tra và thêm cột frame_actions_data nếu bảng preset đã tạo trước đó
            ensure_preset_columns(conn)
    except Exception as e:
        # Ghi log cảnh báo an toàn tránh lỗi Unicode trên console Windows
        try:
            print(f"[CẢNH BÁO CSDL]: Khởi tạo bảng MySQL: {e}")
        except Exception:
            pass


def get_db():
    """
    Cung cấp một phiên làm việc (Session) MySQL cho API và tự động đóng phiên khi yêu cầu kết thúc.
    
    @yields {Session} Phiên làm việc cơ sở dữ liệu.
    """
    with SessionLocal() as session:
        yield session


# Tự động đồng bộ và cập nhật bảng CSDL MySQL ngay khi module db được nạp
try:
    init_db()
except Exception:
    pass
