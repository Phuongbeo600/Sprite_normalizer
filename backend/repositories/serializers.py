"""
Module: backend.repositories.serializers
Mục đích: Cung cấp các tiện ích chuyển đổi và tuần tự hóa dữ liệu JSON, kiểu dữ liệu an toàn cho tầng Repository.
Ai gọi nó: Các Repository truy xuất CSDL MySQL (`character_preset_repository`, `sprite_repository`, `testbed_repository`).
Tại sao tồn tại: Loại bỏ Code Smell lặp mã (Duplicated Code) khi serialize/deserialize các cột JSON (metrics_data, profile_data, frame_actions_data, processing_metadata) giữa Python và CSDL.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & JSON)
# ========================================================
# json: Chuyển đổi qua lại giữa chuỗi JSON và kiểu dữ liệu Python
import json
# typing: Định nghĩa các kiểu dữ liệu từ điển, danh sách, tùy chọn, tổng quát
from typing import Any, Optional, Dict, List

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không có phụ thuộc bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


def safe_json_loads(value: Any, default: Any = None) -> Any:
    """
    Giải mã an toàn chuỗi JSON sang đối tượng Python (dict/list).
    Nếu giá trị đã là dict/list hoặc không thể parse, trả về giá trị hợp lý không gây crash.

    @param {Any} value Giá trị cần giải mã (chuỗi JSON hoặc dữ liệu gốc).
    @param {Any} default Giá trị mặc định trả về nếu giải mã thất bại và value là None.
    @returns {Any} Dữ liệu đã giải mã hoặc giá trị ban đầu.
    """
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        cleaned = value.strip()
        if not cleaned:
            return default
        try:
            return json.loads(cleaned)
        except Exception:
            return default if default is not None else value
    return value


def safe_json_dumps(
    value: Any,
    ensure_ascii: bool = False,
    default: Optional[str] = None
) -> Optional[str]:
    """
    Tuần tự hóa an toàn đối tượng Python (dict/list) sang chuỗi JSON lưu trữ CSDL.
    Nếu giá trị là None hoặc chuỗi rỗng thì trả về giá trị mặc định default (None).
    Nếu giá trị là chuỗi hợp lệ thì giữ nguyên chuỗi đó.

    @param {Any} value Giá trị cần mã hóa sang JSON.
    @param {bool} ensure_ascii Có ép mã hóa ASCII hay giữ nguyên Unicode UTF-8.
    @param {Optional[str]} default Giá trị mặc định trả về nếu đầu vào là None hoặc chuỗi rỗng.
    @returns {Optional[str]} Chuỗi JSON hoặc default nếu đầu vào là None/rỗng.
    """
    if value is None:
        return default
    if isinstance(value, str):
        cleaned = value.strip()
        return value if cleaned else default
    try:
        return json.dumps(value, ensure_ascii=ensure_ascii)
    except Exception:
        return str(value)


def deserialize_preset_record(
    record: Dict[str, Any],
    json_keys: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Tự động giải mã danh sách các cột JSON trong bản ghi preset nhân vật sang kiểu Python thuần.

    @param {Dict[str, Any]} record Bản ghi lấy từ CSDL MySQL mappings().
    @param {Optional[List[str]]} json_keys Danh sách tên các cột chứa dữ liệu JSON cần giải mã.
    @returns {Dict[str, Any]} Bản ghi với các cột chỉ định đã được giải mã JSON an toàn.
    """
    if not record:
        return record

    data = dict(record)
    target_keys = json_keys or ["metrics_data", "profile_data", "frame_actions_data"]
    for key in target_keys:
        if key in data:
            data[key] = safe_json_loads(data[key])
    return data
