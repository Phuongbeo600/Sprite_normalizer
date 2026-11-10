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
        ("openai_base_url", "VARCHAR(255) DEFAULT 'https://api.openai.com/v1'")
    ]
    for col_name, col_type in columns_to_ensure:
        try:
            conn_or_session.execute(text(f"ALTER TABLE projects ADD COLUMN {col_name} {col_type};"))
        except Exception:
            # Bỏ qua nếu cột đã tồn tại (lỗi trùng tên cột 1060 trong MySQL)
            pass


def init_db():
    """
    Khởi tạo và tự động cập nhật cấu trúc các bảng trong cơ sở dữ liệu MySQL:
    1. Bảng projects: Mở rộng các cột lưu API Key và cấu hình AI độc lập cho từng dự án.
    2. Bảng project_character_presets: Lưu trữ lịch sử chỉ số giải phẫu pixel và prompt theo từng dự án.
    """
    try:
        with engine.begin() as conn:
            # 1. Tạo bảng projects nếu chưa tồn tại
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS projects (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    api_provider VARCHAR(50) DEFAULT 'gemini',
                    gemini_api_key TEXT NULL,
                    openai_api_key TEXT NULL,
                    openai_base_url VARCHAR(255) DEFAULT 'https://api.openai.com/v1'
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            """))

            # 2. Bổ sung các cột lưu API nếu bảng projects đã tồn tại từ các phiên bản cũ
            ensure_project_columns(conn)

            # 3. Tạo bảng project_character_presets liên kết với projects(id)
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS project_character_presets (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    project_id INT NOT NULL,
                    name VARCHAR(255) NOT NULL,
                    sprite_name VARCHAR(255) NULL,
                    metrics_data JSON NULL,
                    profile_data JSON NULL,
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
