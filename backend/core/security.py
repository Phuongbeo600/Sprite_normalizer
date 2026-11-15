# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Bảo mật, Thời gian & Kiểu dữ liệu)
# ========================================================
# os: Đọc biến môi trường cấu hình mã khóa bí mật JWT
import os
# hmac: So sánh chuỗi an toàn chống tấn công Timing Attack
import hmac
# datetime: Tính toán thời gian hết hạn của mã chứng thực JWT
from datetime import datetime, timedelta, timezone
# typing: Khai báo kiểu dữ liệu cho tham số và giá trị trả về
from typing import Dict, Any, Optional, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# bcrypt: Thư viện băm mật khẩu chuẩn công nghiệp (Bcrypt KDF)
import bcrypt
# jwt: Thư viện sinh và xác thực JSON Web Token (PyJWT) chuẩn OAuth2
import jwt

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Configs)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)

# Khóa bí mật ký JWT - ưu tiên đọc từ biến môi trường, fallback chuỗi 256-bit an toàn
SECRET_KEY: str = os.getenv(
    "JWT_SECRET_KEY", 
    "sprite_normalizer_secure_secret_key_uet_ai_2026_super_safe_token_256bits"
)
# Thuật toán ký mã hóa JWT chuẩn HS256 (HMAC với SHA-256)
ALGORITHM: str = "HS256"
# Thời gian sống mặc định của Access Token (24 giờ = 1440 phút)
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))


def hash_password(password: str) -> str:
    """
    Băm mật khẩu người dùng bằng thuật toán Bcrypt với muối ngẫu nhiên (Salt).
    
    @param password: Mật khẩu dạng văn bản thô (Plaintext).
    @returns: Chuỗi băm mật khẩu Bcrypt an toàn (bắt đầu bằng $2b$).
    """
    pwd_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pwd_bytes, salt).decode("utf-8")


def is_hashed_password(stored_password: str) -> bool:
    """
    Kiểm tra xem chuỗi mật khẩu trong CSDL đã được băm theo chuẩn Bcrypt hay chưa.
    
    @param stored_password: Chuỗi mật khẩu lấy từ cơ sở dữ liệu.
    @returns: True nếu chuỗi là dạng băm Bcrypt ($2a$ hoặc $2b$).
    """
    if not stored_password:
        return False
    return stored_password.startswith("$2a$") or stored_password.startswith("$2b$")


def verify_password(plain_password: str, stored_password: str) -> Tuple[bool, bool]:
    """
    Xác thực mật khẩu người dùng và phát hiện xem tài khoản có cần nâng cấp băm mật khẩu (Rehash) hay không.
    Hỗ trợ tương thích ngược mượt mà với tài khoản có mật khẩu dạng plaintext trong CSDL cũ.
    
    @param plain_password: Mật khẩu do người dùng nhập từ giao diện đăng nhập.
    @param stored_password: Mật khẩu đang lưu trữ trong cơ sở dữ liệu.
    @returns: Tuple gồm (is_valid: bool, needs_rehash: bool).
    """
    if not plain_password or not stored_password:
        return False, False

    # Trường hợp 1: Mật khẩu trong DB đã được băm an toàn bằng Bcrypt
    if is_hashed_password(stored_password):
        try:
            is_valid = bcrypt.checkpw(
                plain_password.encode("utf-8"), 
                stored_password.encode("utf-8")
            )
            return is_valid, False
        except Exception:
            return False, False

    # Trường hợp 2: Mật khẩu cũ lưu dạng Plaintext trong CSDL (cần tự động nâng cấp sang Bcrypt)
    is_valid = hmac.compare_digest(plain_password, stored_password)
    needs_rehash = is_valid  # Nếu mật khẩu thô khớp, cần tự động băm lại và cập nhật CSDL
    return is_valid, needs_rehash


def create_access_token(
    data: Dict[str, Any], 
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Khởi tạo mã JSON Web Token (JWT) có chữ ký số chứa thông tin tài khoản người dùng.
    
    @param data: Từ điển chứa các Claims nghiệp vụ (ví dụ: sub, username, role).
    @param expires_delta: Thời gian sống tùy chỉnh của token.
    @returns: Chuỗi mã truy cập JWT đã được ký số HS256.
    """
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": now
    })
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Giải mã và kiểm tra chữ ký số cùng hạn dùng của mã truy cập JWT.
    
    @param token: Chuỗi mã truy cập JWT.
    @returns: Từ điển chứa Claims của token nếu hợp lệ, ngược lại trả về None.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        return None
