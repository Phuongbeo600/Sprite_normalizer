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
from sqlalchemy import URL, create_engine
# sessionmaker: Tạo phiên làm việc (Session) thực hiện truy vấn an toàn
from sqlalchemy.orm import sessionmaker

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# db_schema: Sở hữu lược đồ và giữ các hàm di chuyển cột được tái xuất.
from backend.db_schema import (
    bootstrap_schema, ensure_project_columns, ensure_preset_columns, ensure_user_columns,
    ensure_sprite_columns, ensure_sprite_frame_columns,
)

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
    username=os.getenv("SPRITE_DB_USER", "sprite_app"),#Lấy ten tài khoản từ env, nếu không có mặc định để sprite_app
    password=os.getenv("SPRITE_DB_PASSWORD", ""),
    host=os.getenv("SPRITE_DB_HOST", "127.0.0.1"),
    port=int(os.getenv("SPRITE_DB_PORT", "3306")),
    database=os.getenv("SPRITE_DB_NAME", "sprite_normalizer"),
    query={"charset": "utf8mb4"},# Dùng bảng mã tiếng việt
)

engine = create_engine(database_url, pool_pre_ping=True)# Tạo engine kết nối CSDL với code python, pool_pre_ping là nếu không dùng Myspl sẽ tự động đóng
SessionLocal = sessionmaker(bind=engine)# Đối tượng , phiển dùng riêng cho từng chức năng



def init_db():
    """
    Khởi tạo và tự động cập nhật cấu trúc các bảng trong cơ sở dữ liệu MySQL:
    1. Bảng users: Quản lý tài khoản đăng nhập (Admin tối cao và Người dùng thường, Họ tên, Gmail, Avatar).
    2. Bảng projects: Mở rộng các cột lưu API Key, AI enabled và user_id sở hữu.
    3. Bảng project_character_presets: Lưu trữ lịch sử chỉ số giải phẫu pixel, prompt và ma trận 15 frame.
    4. Bảng project_sprites: Lưu trữ kho ảnh sprite gốc và đã chuẩn hóa, băm SHA-256 chống trùng.
    """
    try:
        with engine.begin() as conn:
            bootstrap_schema(conn)
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



