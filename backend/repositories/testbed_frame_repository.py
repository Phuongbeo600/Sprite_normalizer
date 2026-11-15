# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc dữ liệu & Kiểu)
# ========================================================
# typing: Định nghĩa các kiểu dữ liệu mảng, từ điển, tùy chọn
from typing import List, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Thực thi các câu lệnh SQL an toàn và quản lý phiên Session
from sqlalchemy import text
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không có phụ thuộc nội bộ)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class TestbedFrameRepository:
    """
    Kho lưu trữ dữ liệu Khung hình Ô ảnh rời Testbed (Testbed Frame Repository).
    Chuyên trách quản lý toàn bộ các thao tác CSDL MySQL đối với bảng 'testbed_character_frames':
    - Lấy danh sách toàn bộ các ô ảnh rời của một nhân vật trong 15 ô.
    - Lưu hoặc cập nhật ảnh từng ô (sử dụng ON DUPLICATE KEY UPDATE).
    """

    def get_character_slots(self, db: Session, character_id: int) -> List[Dict[str, Any]]:
        """
        Lấy toàn bộ các ô ảnh rời của một nhân vật.

        @param db: Phiên làm việc cơ sở dữ liệu
        @param character_id: Mã nhân vật testbed
        @returns: Danh sách các ô ảnh rời kèm hướng và thời gian hiển thị duration_ms
        """
        sql = text("""
            SELECT id, character_id, project_id, slot_key, frame_image_data, direction, frame_index, duration_ms
            FROM testbed_character_frames
            WHERE character_id = :character_id;
        """)
        rows = db.execute(sql, {"character_id": character_id}).mappings().all()
        return [dict(r) for r in rows]

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
        """
        Lưu hoặc cập nhật ảnh của đúng một ô cụ thể (VD: 'down_1').
        Sử dụng cơ chế ON DUPLICATE KEY UPDATE để ghi đè tức thì nếu ô đó đã có ảnh.

        @param db: Phiên làm việc cơ sở dữ liệu
        @param character_id: Mã nhân vật
        @param project_id: Mã dự án
        @param slot_key: Khóa ô (ví dụ 'down_0', 'down_1')
        @param frame_image_bytes: Dữ liệu nhị phân ảnh khung hình
        @param direction: Hướng chuyển động ('down', 'left', 'right', 'up')
        @param frame_index: Chỉ số frame (0, 1, 2)
        @param duration_ms: Thời lượng hiển thị frame tính bằng mili-giây
        @returns: True nếu thực thi thành công
        """
        sql = text("""
            INSERT INTO testbed_character_frames (
                character_id, project_id, slot_key, frame_image_data, direction, frame_index, duration_ms
            ) VALUES (
                :character_id, :project_id, :slot_key, :frame_image_data, :direction, :frame_index, :duration_ms
            )
            ON DUPLICATE KEY UPDATE
                frame_image_data = VALUES(frame_image_data),
                direction = VALUES(direction),
                frame_index = VALUES(frame_index),
                duration_ms = VALUES(duration_ms),
                updated_at = CURRENT_TIMESTAMP;
        """)
        db.execute(sql, {
            "character_id": character_id,
            "project_id": project_id,
            "slot_key": slot_key,
            "frame_image_data": frame_image_bytes,
            "direction": direction,
            "frame_index": frame_index,
            "duration_ms": duration_ms
        })
        db.commit()
        return True
