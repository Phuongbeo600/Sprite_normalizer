# ========================================================
# 1. THƯ VIỆN CHUẨN PYTHON
# ========================================================
# os đọc cấu hình kết nối từ biến môi trường.
import os
# Path dùng để định vị chính xác đường dẫn file .env ở thư mục gốc.
from pathlib import Path

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# dotenv nạp biến môi trường từ file .env vào os.environ.
from dotenv import load_dotenv
# URL tạo địa chỉ kết nối và create_engine quản lý các kết nối MySQL.
from sqlalchemy import URL, create_engine
# sessionmaker tạo phiên làm việc để thực hiện truy vấn.
from sqlalchemy.orm import sessionmaker

# Nạp file .env từ thư mục gốc dự án
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

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


def get_db():
    """
    Cấp một phiên MySQL cho API và tự động đóng phiên khi yêu cầu kết thúc.
    
    @yields {Session} Phiên làm việc với cơ sở dữ liệu MySQL.
    """
    with SessionLocal() as session:
        yield session
