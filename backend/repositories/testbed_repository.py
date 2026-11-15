# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Kiểu)
# ========================================================
# typing: Định nghĩa các kiểu dữ liệu mảng, từ điển, tùy chọn
from typing import List, Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Thực thi các câu lệnh SQL an toàn và quản lý phiên Session
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# BaseRepository: Lớp cơ sở trừu tượng cho các Repository
from .base import BaseRepository
# TestbedMapRepository: Kho dữ liệu chuyên trách bảng testbed_maps
from .testbed_map_repository import TestbedMapRepository
# TestbedCharacterRepository: Kho dữ liệu chuyên trách bảng testbed_characters
from .testbed_character_repository import TestbedCharacterRepository
# TestbedFrameRepository: Kho dữ liệu chuyên trách bảng testbed_character_frames
from .testbed_frame_repository import TestbedFrameRepository

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class TestbedRepository(BaseRepository):
    """
    Kho lưu trữ dữ liệu Phòng thử nghiệm Godot Testbed (Composite Facade Repository).
    Đóng vai trò là đầu mối tập trung (Facade), kết hợp 3 repository chuyên biệt:
    - TestbedMapRepository: Quản lý bản đồ nền và độ cao sàn ground_y.
    - TestbedCharacterRepository: Quản lý nhân vật trên sàn diễn testbed.
    - TestbedFrameRepository: Quản lý dữ liệu ảnh thật của từng ô trong 15 ô.

    Giúp duy trì tính tương thích 100% với các Service hiện hữu mà vẫn đảm bảo
    nguyên tắc trách nhiệm đơn lẻ (Single Responsibility Principle) ở từng bảng dữ liệu.
    """

    def __init__(
        self,
        map_repo: Optional[TestbedMapRepository] = None,
        character_repo: Optional[TestbedCharacterRepository] = None,
        frame_repo: Optional[TestbedFrameRepository] = None
    ):
        """
        Khởi tạo TestbedRepository kèm cơ chế Dependency Injection cho các sub-repositories.
        """
        self.map_repo = map_repo or TestbedMapRepository()
        self.character_repo = character_repo or TestbedCharacterRepository()
        self.frame_repo = frame_repo or TestbedFrameRepository()

    # ========================================================
    # TRIỂN KHAI CÁC PHƯƠNG THỨC TỪ BaseRepository
    # ========================================================

    def get_all(self, db: Session) -> List[Dict[str, Any]]:
        """Lấy toàn bộ danh sách nhân vật testbed trong hệ thống."""
        return self.character_repo.get_all(db)

    def get_by_id(self, db: Session, entity_id: int) -> Optional[Dict[str, Any]]:
        """Lấy chi tiết nhân vật testbed theo ID."""
        return self.character_repo.get_by_id(db, entity_id)

    def create(self, db: Session, **kwargs) -> Dict[str, Any]:
        """Tạo nhân vật testbed mới."""
        return self.character_repo.create(db, **kwargs)

    def delete(self, db: Session, entity_id: int) -> bool:
        """Xóa nhân vật testbed theo ID."""
        return self.character_repo.delete(db, entity_id)

    # ========================================================
    # PHẦN 1: ỦY QUYỀN QUẢN LÝ BẢN ĐỒ NỀN / SÀN GAME (testbed_maps)
    # ========================================================

    def get_active_map(self, db: Session, project_id: int) -> Optional[Dict[str, Any]]:
        """Lấy thông tin bản đồ nền đang kích hoạt của một dự án."""
        return self.map_repo.get_active_map(db, project_id)

    def save_map(
        self,
        db: Session,
        project_id: int,
        name: str,
        map_image_bytes: bytes,
        ground_y: int = 540,
        show_ground_line: bool = True
    ) -> int:
        """Lưu hoặc thay thế bản đồ nền mới cho dự án."""
        return self.map_repo.save_map(
            db=db,
            project_id=project_id,
            name=name,
            map_image_bytes=map_image_bytes,
            ground_y=ground_y,
            show_ground_line=show_ground_line
        )

    def update_ground_y(self, db: Session, project_id: int, ground_y: int) -> bool:
        """Cập nhật riêng độ cao sàn mặt đất ground_y của dự án."""
        return self.map_repo.update_ground_y(db, project_id, ground_y)

    def delete_map(self, db: Session, project_id: int) -> bool:
        """Xóa bản đồ nền của dự án khỏi cơ sở dữ liệu."""
        return self.map_repo.delete_map(db, project_id)

    # ========================================================
    # PHẦN 2: ỦY QUYỀN QUẢN LÝ NHÂN VẬT THỬ NGHIỆM (testbed_characters)
    # ========================================================

    def get_characters_by_project(self, db: Session, project_id: int) -> List[Dict[str, Any]]:
        """Lấy danh sách toàn bộ nhân vật thử nghiệm thuộc về một dự án."""
        return self.character_repo.get_characters_by_project(db, project_id)

    def create_character(
        self,
        db: Session,
        project_id: int,
        name: str,
        cell_width: int = 32,
        cell_height: int = 48,
        fps: int = 8,
        scale_ratio: float = 1.0,
        pos_x: int = 260,
        order_index: int = 0
    ) -> int:
        """Tạo mới một dòng nhân vật thử nghiệm trong bảng testbed_characters."""
        return self.character_repo.create_character(
            db=db,
            project_id=project_id,
            name=name,
            cell_width=cell_width,
            cell_height=cell_height,
            fps=fps,
            scale_ratio=scale_ratio,
            pos_x=pos_x,
            order_index=order_index
        )

    def update_character(
        self,
        db: Session,
        char_id: int,
        project_id: int,
        updates: Dict[str, Any]
    ) -> bool:
        """Cập nhật các thuộc tính linh hoạt của nhân vật."""
        return self.character_repo.update_character(
            db=db,
            char_id=char_id,
            project_id=project_id,
            updates=updates
        )

    def delete_character(self, db: Session, char_id: int, project_id: int) -> bool:
        """Xóa vĩnh viễn một nhân vật khỏi phòng thử nghiệm."""
        return self.character_repo.delete_character(
            db=db,
            char_id=char_id,
            project_id=project_id
        )

    # ========================================================
    # PHẦN 3: ỦY QUYỀN QUẢN LÝ TỪNG Ô ẢNH RỜI (testbed_character_frames)
    # ========================================================

    def get_character_slots(self, db: Session, character_id: int) -> List[Dict[str, Any]]:
        """Lấy toàn bộ các ô ảnh rời của một nhân vật."""
        return self.frame_repo.get_character_slots(db, character_id)

    def save_or_update_slot(
        self,
        db: Session,
        character_id: int,
        project_id: int,
        slot_key: str,
        frame_image_bytes: bytes,
        direction: str = "down",
        frame_index: int = 0,
        duration_ms: int = 125
    ) -> bool:
        """Lưu hoặc cập nhật ảnh của đúng một ô cụ thể."""
        return self.frame_repo.save_or_update_slot(
            db=db,
            character_id=character_id,
            project_id=project_id,
            slot_key=slot_key,
            frame_image_bytes=frame_image_bytes,
            direction=direction,
            frame_index=frame_index,
            duration_ms=duration_ms
        )
