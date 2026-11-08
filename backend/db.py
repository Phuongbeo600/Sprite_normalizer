# ========================================================
# 1. THƯ VIỆN CHUẨN PYTHON
# ========================================================
# os đọc cấu hình kết nối từ biến môi trường.
import os

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI
# ========================================================
# URL tạo địa chỉ kết nối và create_engine quản lý các kết nối MySQL.
from sqlalchemy import URL, create_engine

# sessionmaker tạo phiên làm việc để thực hiện truy vấn.
from sqlalchemy.orm import sessionmaker


database_url = URL.create(
    drivername="mysql+pymysql",
    username=os.getenv("SPRITE_DB_USER", "sprite_app"),
    password=os.environ["SPRITE_DB_PASSWORD"],
    host=os.getenv("SPRITE_DB_HOST", "127.0.0.1"),
    port=int(os.getenv("SPRITE_DB_PORT", "3306")),
    database=os.getenv("SPRITE_DB_NAME", "sprite_normalizer"),
    query={"charset": "utf8mb4"},
)

engine = create_engine(database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine)


def get_db():
    """Cấp một phiên MySQL cho API và tự đóng phiên khi yêu cầu kết thúc."""
    with SessionLocal() as session:
        yield session