# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Lớp trừu tượng)
# ========================================================
# abc: Định nghĩa lớp cơ sở trừu tượng (Abstract Base Class)
from abc import ABC, abstractmethod
# typing: Định nghĩa kiểu dữ liệu danh sách, tùy chọn
from typing import List, Optional, Any, Dict

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Phiên làm việc cơ sở dữ liệu
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class BaseRepository(ABC):
    """
    Interface cơ sở cho các Repository truy cập dữ liệu.
    Đảm bảo tính đa hình và trừu tượng hóa toàn bộ thao tác SQL khỏi Controller/Router.
    """

    @abstractmethod
    def get_all(self, db: Session) -> List[Dict[str, Any]]:
        """Lấy toàn bộ danh sách bản ghi."""
        pass

    @abstractmethod
    def get_by_id(self, db: Session, entity_id: int) -> Optional[Dict[str, Any]]:
        """Lấy chi tiết một bản ghi theo ID."""
        pass

    @abstractmethod
    def create(self, db: Session, **kwargs) -> Dict[str, Any]:
        """Tạo một bản ghi mới."""
        pass

    @abstractmethod
    def delete(self, db: Session, entity_id: int) -> bool:
        """Xóa một bản ghi theo ID."""
        pass
