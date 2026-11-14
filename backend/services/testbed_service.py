# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Mã hóa Base64 & Kiểu dữ liệu)
# ========================================================
# base64: Chuyển đổi qua lại giữa mảng byte nhị phân (MEDIUMBLOB) và chuỗi Data URL Base64
import base64
# typing: Khai báo kiểu danh sách, từ điển, tùy chọn
from typing import List, Optional, Dict, Any

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Phiên làm việc cơ sở dữ liệu Session
from sqlalchemy.orm import Session

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Repositories & Schemas)
# ========================================================
# TestbedRepository: Tầng truy vấn trực tiếp CSDL MySQL cho testbed
from backend.repositories.testbed_repository import TestbedRepository
# Schemas: Cấu trúc dữ liệu yêu cầu & phản hồi
from backend.schemas.testbed import (
    TestbedMapSaveRequest,
    TestbedCharacterSaveRequest,
    TestbedCharacterUpdateRequest,
    TestbedSlotUpdateRequest
)

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class TestbedService:
    """
    Dịch vụ nghiệp vụ Phòng thử nghiệm Godot Testbed (Testbed Service).
    Đóng vai trò trung gian xử lý chuyển đổi nhị phân ảnh thật BLOB ⇄ Base64 Data URL,
    quản lý nhân vật, cập nhật từng ô frame rời và bản đồ nền theo từng dự án.
    """

    def __init__(self, repository: Optional[TestbedRepository] = None):
        self.repo = repository or TestbedRepository()

    @staticmethod
    def _base64_to_bytes(base64_str: str) -> bytes:
        """
        Chuyển chuỗi Data URL (data:image/png;base64,...) sang mảng byte nhị phân để lưu vào MEDIUMBLOB.
        """
        if not base64_str:
            return b""
        if "," in base64_str:
            base64_str = base64_str.split(",", 1)[1]
        return base64.b64decode(base64_str)

    @staticmethod
    def _bytes_to_data_url(raw_bytes: bytes, mime_type: str = "image/png") -> str:
        """
        Chuyển mảng byte nhị phân MEDIUMBLOB từ CSDL sang chuỗi Data URL để trình duyệt hiển thị ngay lập tức.
        """
        if not raw_bytes:
            return ""
        encoded = base64.b64encode(raw_bytes).decode("utf-8")
        return f"data:{mime_type};base64,{encoded}"

    # ========================================================
    # 1. NGHIỆP VỤ BẢN ĐỒ NỀN / SÀN GAME
    # ========================================================

    def get_map(self, db: Session, project_id: int) -> Optional[Dict[str, Any]]:
        """
        Lấy thông tin và ảnh thật của bản đồ nền đang kích hoạt của dự án.
        """
        row = self.repo.get_active_map(db, project_id)
        if not row:
            return None
        return {
            "id": row["id"],
            "project_id": row["project_id"],
            "name": row["name"],
            "map_image_base64": self._bytes_to_data_url(row["map_image_data"]),
            "ground_y": row["ground_y"],
            "show_ground_line": bool(row["show_ground_line"]),
            "is_active": bool(row["is_active"])
        }

    def save_map(self, db: Session, req: TestbedMapSaveRequest) -> Dict[str, Any]:
        """
        Lưu ảnh bản đồ nền thật và độ cao mặt đất vào bảng testbed_maps.
        """
        map_bytes = self._base64_to_bytes(req.map_image_base64)
        map_id = self.repo.save_map(
            db=db,
            project_id=req.project_id,
            name=req.name or "Bản đồ nền mặc định",
            map_image_bytes=map_bytes,
            ground_y=req.ground_y,
            show_ground_line=req.show_ground_line
        )
        return {
            "status": "success",
            "id": map_id,
            "project_id": req.project_id,
            "message": "Đã lưu bản đồ nền vào MySQL thành công!"
        }

    def update_ground_y(self, db: Session, project_id: int, ground_y: int) -> bool:
        """
        Cập nhật riêng độ cao sàn mặt đất ground_y.
        """
        return self.repo.update_ground_y(db, project_id, ground_y)

    def delete_map(self, db: Session, project_id: int) -> bool:
        """
        Xóa bản đồ nền của dự án khỏi MySQL.
        """
        return self.repo.delete_map(db, project_id)

    # ========================================================
    # 2. NGHIỆP VỤ NHÂN VẬT & 15 Ô ẢNH RỜI
    # ========================================================

    def get_characters(self, db: Session, project_id: int) -> List[Dict[str, Any]]:
        """
        Lấy danh sách tất cả nhân vật của dự án kèm toàn bộ 15 ô ảnh rời đã được nạp từ MySQL.
        """
        chars = self.repo.get_characters_by_project(db, project_id)
        result = []

        for ch in chars:
            char_id = ch["id"]
            # Nạp toàn bộ các ô ảnh rời của nhân vật này
            slots_rows = self.repo.get_character_slots(db, char_id)
            slots_data = {}
            for s in slots_rows:
                slot_key = s["slot_key"]
                slots_data[slot_key] = self._bytes_to_data_url(s["frame_image_data"])

            result.append({
                "id": char_id,
                "project_id": ch["project_id"],
                "name": ch["name"],
                "cell_width": ch["cell_width"],
                "cell_height": ch["cell_height"],
                "fps": ch["fps"],
                "scale_ratio": ch["scale_ratio"],
                "pos_x": ch["pos_x"],
                "order_index": ch["order_index"],
                "slots_data": slots_data
            })

        return result

    def save_character(self, db: Session, req: TestbedCharacterSaveRequest) -> Dict[str, Any]:
        """
        Tạo mới hoặc cập nhật một nhân vật và lưu toàn bộ các ô ảnh rời vào MySQL.
        """
        char_id = req.id

        if char_id:
            # Cập nhật nhân vật đã có
            self.repo.update_character(db, char_id, req.project_id, {
                "name": req.name,
                "cell_width": req.cell_width,
                "cell_height": req.cell_height,
                "fps": req.fps,
                "scale_ratio": req.scale_ratio,
                "pos_x": req.pos_x,
                "order_index": req.order_index
            })
        else:
            # Tạo mới nhân vật
            char_id = self.repo.create_character(
                db=db,
                project_id=req.project_id,
                name=req.name,
                cell_width=req.cell_width,
                cell_height=req.cell_height,
                fps=req.fps,
                scale_ratio=req.scale_ratio,
                pos_x=req.pos_x,
                order_index=req.order_index
            )

        # Lưu đồng loạt các ô ảnh rời nếu có
        if req.slots_data:
            for slot_key, data_url in req.slots_data.items():
                if data_url and not data_url.startswith("blob:") and len(data_url) > 20:
                    frame_bytes = self._base64_to_bytes(data_url)
                    # Xác định hướng và số thứ tự từ mã ô (VD: down_0 -> hướng down, frame 0)
                    parts = slot_key.split("_")
                    direction = parts[0] if len(parts) > 0 else "down"
                    try:
                        frame_idx = int(parts[1]) if len(parts) > 1 else 0
                    except ValueError:
                        frame_idx = 0

                    self.repo.save_or_update_slot(
                        db=db,
                        character_id=char_id,
                        project_id=req.project_id,
                        slot_key=slot_key,
                        frame_image_bytes=frame_bytes,
                        direction=direction,
                        frame_index=frame_idx
                    )

        return {
            "status": "success",
            "id": char_id,
            "project_id": req.project_id,
            "message": "Đã lưu nhân vật và các ô ảnh rời vào MySQL thành công!"
        }

    def update_character(
        self,
        db: Session,
        char_id: int,
        project_id: int,
        req: TestbedCharacterUpdateRequest
    ) -> bool:
        """
        Cập nhật nhanh thông số (tên, scale, vị trí X trên sàn, FPS).
        """
        updates = req.dict(exclude_unset=True)
        return self.repo.update_character(db, char_id, project_id, updates)

    def update_single_slot(
        self,
        db: Session,
        char_id: int,
        req: TestbedSlotUpdateRequest
    ) -> bool:
        """
        Cập nhật ảnh của riêng một ô trong 15 ô (VD: 'down_1').
        """
        frame_bytes = self._base64_to_bytes(req.frame_image_base64)
        parts = req.slot_key.split("_")
        direction = parts[0] if len(parts) > 0 else "down"
        try:
            frame_idx = int(parts[1]) if len(parts) > 1 else 0
        except ValueError:
            frame_idx = 0

        return self.repo.save_or_update_slot(
            db=db,
            character_id=char_id,
            project_id=req.project_id,
            slot_key=req.slot_key,
            frame_image_bytes=frame_bytes,
            direction=direction,
            frame_index=frame_idx
        )

    def delete_character(self, db: Session, char_id: int, project_id: int) -> bool:
        """
        Xóa nhân vật khỏi phòng thử nghiệm. Tự động xóa sạch 15 ô con nhờ ON DELETE CASCADE.
        """
        return self.repo.delete_character(db, char_id, project_id)
