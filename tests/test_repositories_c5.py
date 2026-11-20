# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử đơn vị & Giả lập)
# ========================================================
# sys, os: Định cấu hình đường dẫn nhập module cho kiểm thử
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
# unittest: Framework kiểm thử đơn vị tiêu chuẩn của Python
import unittest
# MagicMock: Đối tượng giả lập để kiểm tra ủy quyền (delegation)
from unittest.mock import MagicMock

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# sqlalchemy: Khởi tạo SQLite in-memory phục vụ kiểm thử dữ liệu độc lập
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Repositories & Serializers)
# ========================================================
# serializers: Các hàm chuyển đổi dữ liệu an toàn
from backend.repositories.serializers import (
    safe_json_loads,
    safe_json_dumps,
    deserialize_preset_record
)
# TestbedMapRepository: Quản lý bản đồ sàn đấu testbed
from backend.repositories.testbed_map_repository import TestbedMapRepository
# TestbedCharacterRepository: Quản lý nhân vật testbed
from backend.repositories.testbed_character_repository import TestbedCharacterRepository
# TestbedFrameRepository: Quản lý ô ảnh rời testbed
from backend.repositories.testbed_frame_repository import TestbedFrameRepository
# TestbedRepository: Facade tổng hợp phòng thử nghiệm
from backend.repositories.testbed_repository import TestbedRepository
# SpriteRepository: Quản lý ảnh sprite
from backend.repositories.sprite_repository import SpriteRepository
# UserRepository: Quản lý người dùng
from backend.repositories.user_repository import UserRepository

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file test backend)


class TestSerializers(unittest.TestCase):
    """
    Bộ kiểm thử đơn vị cho module serializers.py:
    - Kiểm tra safe_json_loads với dữ liệu hợp lệ, chuỗi rỗng, None, chuỗi lỗi, và kiểu dict có sẵn.
    - Kiểm tra safe_json_dumps với dict, chuỗi, None.
    - Kiểm tra deserialize_preset_record giải nén các cột JSON chính xác.
    """

    def test_safe_json_loads(self):
        """Kiểm tra tính an toàn khi phân tích chuỗi JSON sang cấu trúc dữ liệu Python."""
        # 1. Chuỗi JSON hợp lệ
        res = safe_json_loads('{"width": 32, "height": 48}')
        self.assertEqual(res, {"width": 32, "height": 48})

        # 2. Dữ liệu None
        self.assertIsNone(safe_json_loads(None))
        self.assertEqual(safe_json_loads(None, default={}), {})

        # 3. Chuỗi rỗng hoặc khoảng trắng
        self.assertIsNone(safe_json_loads(""))
        self.assertIsNone(safe_json_loads("   "))

        # 4. Đầu vào đã là dict hoặc list
        d = {"a": 1}
        self.assertIs(safe_json_loads(d), d)

        # 5. Chuỗi lỗi cú pháp (Malformed JSON)
        self.assertEqual(safe_json_loads("{invalid json}", default={}), {})

    def test_safe_json_dumps(self):
        """Kiểm tra tính an toàn khi chuyển đổi đối tượng sang chuỗi JSON."""
        # 1. Dict hợp lệ
        res = safe_json_dumps({"fps": 12})
        self.assertIn('"fps": 12', res)

        # 2. None
        self.assertIsNone(safe_json_dumps(None))

        # 3. Chuỗi rỗng
        self.assertIsNone(safe_json_dumps(""))

        # 4. Chuỗi có nội dung
        self.assertEqual(safe_json_dumps("test_string"), "test_string")

    def test_deserialize_preset_record(self):
        """Kiểm tra giải nén các trường JSON trong bản ghi preset."""
        record = {
            "id": 10,
            "name": "Hero Preset",
            "metrics_data": '{"cell_width": 32, "cell_height": 48}',
            "profile_data": '{"role": "warrior"}',
            "frame_actions_data": '{"idle": [0, 1]}'
        }
        deserialized = deserialize_preset_record(record)
        self.assertEqual(deserialized["id"], 10)
        self.assertEqual(deserialized["metrics_data"], {"cell_width": 32, "cell_height": 48})
        self.assertEqual(deserialized["profile_data"], {"role": "warrior"})
        self.assertEqual(deserialized["frame_actions_data"], {"idle": [0, 1]})

        # Kiểm tra với bản ghi rỗng / None
        self.assertIsNone(deserialize_preset_record(None))


class TestTestbedRepositories(unittest.TestCase):
    """
    Bộ kiểm thử đơn vị cho tầng Repository của phòng thử nghiệm (Testbed):
    - TestbedMapRepository: Quản lý bản đồ sàn.
    - TestbedCharacterRepository: Quản lý nhân vật.
    - TestbedFrameRepository: Quản lý khung hình rời.
    - TestbedRepository: Composite Facade kết hợp cả 3.
    """

    def setUp(self):
        """Khởi tạo SQLite in-memory và tạo các bảng giả lập."""
        self.engine = create_engine("sqlite:///:memory:")
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        # Tạo bảng testbed_maps
        self.db.execute(text("""
            CREATE TABLE testbed_maps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name VARCHAR(255) NOT NULL,
                map_image_data BLOB,
                ground_y INTEGER DEFAULT 540,
                show_ground_line BOOLEAN DEFAULT 1,
                is_active BOOLEAN DEFAULT 1
            )
        """))

        # Tạo bảng testbed_characters
        self.db.execute(text("""
            CREATE TABLE testbed_characters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name VARCHAR(255) NOT NULL,
                cell_width INTEGER DEFAULT 32,
                cell_height INTEGER DEFAULT 48,
                fps INTEGER DEFAULT 8,
                scale_ratio REAL DEFAULT 1.0,
                pos_x INTEGER DEFAULT 260,
                order_index INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

        # Tạo bảng testbed_character_frames
        self.db.execute(text("""
            CREATE TABLE testbed_character_frames (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character_id INTEGER NOT NULL,
                project_id INTEGER NOT NULL,
                slot_key VARCHAR(50) NOT NULL,
                frame_image_data BLOB,
                direction VARCHAR(20) DEFAULT 'down',
                frame_index INTEGER DEFAULT 0,
                duration_ms INTEGER DEFAULT 125,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        self.db.commit()

        self.map_repo = TestbedMapRepository()
        self.char_repo = TestbedCharacterRepository()
        self.frame_repo = TestbedFrameRepository()
        self.facade_repo = TestbedRepository(
            map_repo=self.map_repo,
            character_repo=self.char_repo,
            frame_repo=self.frame_repo
        )

    def tearDown(self):
        """Đóng phiên làm việc cơ sở dữ liệu."""
        self.db.close()
        self.engine.dispose()

    def test_map_repository_crud(self):
        """Kiểm tra các thao tác CRUD trên TestbedMapRepository."""
        # 1. Tạo bản đồ thứ nhất
        map_id_1 = self.map_repo.save_map(
            db=self.db,
            project_id=1,
            name="Rừng rậm 1",
            map_image_bytes=b"map_image_bytes_1",
            ground_y=500,
            show_ground_line=True
        )
        self.assertGreater(map_id_1, 0)

        # Kiểm tra đọc active map
        active_map = self.map_repo.get_active_map(self.db, project_id=1)
        self.assertIsNotNone(active_map)
        self.assertEqual(active_map["name"], "Rừng rậm 1")
        self.assertEqual(active_map["ground_y"], 500)

        # 2. Tạo bản đồ thứ hai -> bản đồ thứ nhất tự động bị hủy active
        map_id_2 = self.map_repo.save_map(
            db=self.db,
            project_id=1,
            name="Rừng rậm 2",
            map_image_bytes=b"map_image_bytes_2",
            ground_y=550,
            show_ground_line=False
        )
        active_map_2 = self.map_repo.get_active_map(self.db, project_id=1)
        self.assertEqual(active_map_2["id"], map_id_2)
        self.assertEqual(active_map_2["name"], "Rừng rậm 2")

        # 3. Cập nhật ground_y
        updated = self.map_repo.update_ground_y(self.db, project_id=1, ground_y=580)
        self.assertTrue(updated)
        active_map_updated = self.map_repo.get_active_map(self.db, project_id=1)
        self.assertEqual(active_map_updated["ground_y"], 580)

        # 4. Xóa bản đồ
        deleted = self.map_repo.delete_map(self.db, project_id=1)
        self.assertTrue(deleted)
        self.assertIsNone(self.map_repo.get_active_map(self.db, project_id=1))

    def test_character_repository_crud(self):
        """Kiểm tra các thao tác CRUD trên TestbedCharacterRepository."""
        # 1. Tạo nhân vật
        char_id = self.char_repo.create_character(
            db=self.db,
            project_id=1,
            name="Chiến binh",
            cell_width=48,
            cell_height=64,
            fps=12,
            scale_ratio=1.5,
            pos_x=300,
            order_index=1
        )
        self.assertGreater(char_id, 0)

        # 2. Đọc danh sách theo project
        chars = self.char_repo.get_characters_by_project(self.db, project_id=1)
        self.assertEqual(len(chars), 1)
        self.assertEqual(chars[0]["name"], "Chiến binh")
        self.assertEqual(chars[0]["cell_width"], 48)

        # 3. Đọc chi tiết theo ID
        char = self.char_repo.get_by_id(self.db, char_id)
        self.assertIsNotNone(char)
        self.assertEqual(char["name"], "Chiến binh")

        # 4. Cập nhật nhân vật
        success = self.char_repo.update_character(
            db=self.db,
            char_id=char_id,
            project_id=1,
            updates={"name": "Đại Hiệp", "pos_x": 350, "scale_ratio": 2.0}
        )
        self.assertTrue(success)
        updated_char = self.char_repo.get_by_id(self.db, char_id)
        self.assertEqual(updated_char["name"], "Đại Hiệp")
        self.assertEqual(updated_char["pos_x"], 350)
        self.assertEqual(updated_char["scale_ratio"], 2.0)

        # 5. Xóa nhân vật
        deleted = self.char_repo.delete_character(self.db, char_id=char_id, project_id=1)
        self.assertTrue(deleted)
        self.assertEqual(len(self.char_repo.get_characters_by_project(self.db, project_id=1)), 0)

    def test_facade_delegation(self):
        """Kiểm tra TestbedRepository ủy quyền đầy đủ và chính xác sang các sub-repositories."""
        mock_map = MagicMock()
        mock_char = MagicMock()
        mock_frame = MagicMock()

        facade = TestbedRepository(
            map_repo=mock_map,
            character_repo=mock_char,
            frame_repo=mock_frame
        )

        mock_db = MagicMock()

        # Kiểm tra ủy quyền map
        facade.get_active_map(mock_db, project_id=1)
        mock_map.get_active_map.assert_called_once_with(mock_db, 1)

        facade.save_map(mock_db, 1, "Map 1", b"bytes", 540, True)
        mock_map.save_map.assert_called_once_with(
            db=mock_db,
            project_id=1,
            name="Map 1",
            map_image_bytes=b"bytes",
            ground_y=540,
            show_ground_line=True
        )

        facade.update_ground_y(mock_db, 1, 600)
        mock_map.update_ground_y.assert_called_once_with(mock_db, 1, 600)

        facade.delete_map(mock_db, 1)
        mock_map.delete_map.assert_called_once_with(mock_db, 1)

        # Kiểm tra ủy quyền character
        facade.get_characters_by_project(mock_db, 1)
        mock_char.get_characters_by_project.assert_called_once_with(mock_db, 1)

        facade.create_character(mock_db, 1, "Player", 32, 48, 8, 1.0, 260, 0)
        mock_char.create_character.assert_called_once()

        facade.update_character(mock_db, 5, 1, {"name": "Test"})
        mock_char.update_character.assert_called_once_with(
            db=mock_db,
            char_id=5,
            project_id=1,
            updates={"name": "Test"}
        )

        facade.delete_character(mock_db, 5, 1)
        mock_char.delete_character.assert_called_once_with(
            db=mock_db,
            char_id=5,
            project_id=1
        )

        # Kiểm tra ủy quyền frame
        facade.get_character_slots(mock_db, 10)
        mock_frame.get_character_slots.assert_called_once_with(mock_db, 10)

        facade.save_or_update_slot(mock_db, 10, 1, "down_0", b"frame_bytes")
        mock_frame.save_or_update_slot.assert_called_once_with(
            db=mock_db,
            character_id=10,
            project_id=1,
            slot_key="down_0",
            frame_image_bytes=b"frame_bytes",
            direction="down",
            frame_index=0,
            duration_ms=125
        )

    def test_frame_repository_queries(self):
        """Kiểm tra truy vấn khung hình ô rời trên TestbedFrameRepository."""
        # Chèn bản ghi frame mẫu vào SQLite
        self.db.execute(text("""
            INSERT INTO testbed_character_frames (
                character_id, project_id, slot_key, frame_image_data, direction, frame_index, duration_ms
            ) VALUES (1, 1, 'down_0', :data, 'down', 0, 120);
        """), {"data": b"sample_frame_data"})
        self.db.commit()

        slots = self.frame_repo.get_character_slots(self.db, character_id=1)
        self.assertEqual(len(slots), 1)
        self.assertEqual(slots[0]["slot_key"], "down_0")
        self.assertEqual(slots[0]["direction"], "down")
        self.assertEqual(slots[0]["duration_ms"], 120)


class TestUserRepository(unittest.TestCase):
    """
    Bộ kiểm thử đơn vị cho UserRepository:
    - Kiểm tra tạo người dùng, tự động ghép họ tên.
    - Kiểm tra truy vấn theo ID và Username.
    - Kiểm tra cập nhật thông tin cá nhân (update_profile).
    - Kiểm tra cơ chế bảo vệ không cho phép xóa Admin hoặc tài khoản mẫu (Guard Clauses).
    """

    def setUp(self):
        """Khởi tạo SQLite in-memory và tạo bảng users & projects giả lập."""
        self.engine = create_engine("sqlite:///:memory:")
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        self.db.execute(text("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(50) DEFAULT 'user',
                last_name VARCHAR(100) NULL,
                middle_name VARCHAR(100) NULL,
                first_name VARCHAR(100) NULL,
                full_name VARCHAR(255) NULL,
                avatar_url TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))

        self.db.execute(text("""
            CREATE TABLE projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(255) NOT NULL,
                user_id INTEGER NULL
            )
        """))
        self.db.commit()
        self.user_repo = UserRepository()

    def tearDown(self):
        """Đóng phiên làm việc cơ sở dữ liệu."""
        self.db.close()
        self.engine.dispose()

    def test_create_and_get_user(self):
        """Kiểm tra tạo người dùng mới và tự động ghép họ và tên."""
        user = self.user_repo.create(
            db=self.db,
            username="player1@gmail.com",
            password="secret_password",
            role="user",
            last_name="Nguyễn",
            middle_name="Văn",
            first_name="An"
        )
        self.assertGreater(user["id"], 0)
        self.assertEqual(user["full_name"], "Nguyễn Văn An")

        # Đọc theo ID
        fetched = self.user_repo.get_by_id(self.db, user["id"])
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["username"], "player1@gmail.com")

        # Đọc theo username
        by_name = self.user_repo.get_by_username(self.db, "player1@gmail.com")
        self.assertIsNotNone(by_name)
        self.assertEqual(by_name["id"], user["id"])

    def test_update_profile(self):
        """Kiểm tra cập nhật thông tin họ tên, mật khẩu và ảnh đại diện."""
        user = self.user_repo.create(
            db=self.db,
            username="player2@gmail.com",
            password="pass",
            last_name="Trần",
            first_name="Bình"
        )
        user_id = user["id"]

        # Cập nhật họ tên mới
        updated = self.user_repo.update_profile(
            db=self.db,
            user_id=user_id,
            first_name="Cường",
            new_password="new_secret_pass"
        )
        self.assertTrue(updated)

        fetched = self.user_repo.get_by_id(self.db, user_id)
        self.assertEqual(fetched["first_name"], "Cường")
        self.assertEqual(fetched["password"], "new_secret_pass")
        self.assertEqual(fetched["full_name"], "Trần Cường")

    def test_delete_user_guard_clauses(self):
        """Kiểm tra các chốt chặn bảo vệ không thể xóa tài khoản Admin hoặc test user."""
        # 1. Tạo tài khoản Admin (id=1 hoặc role='admin')
        admin = self.user_repo.create(
            db=self.db,
            username="admin@system.local",
            password="admin_pass",
            role="admin"
        )
        self.assertEqual(admin["id"], 1)
        with self.assertRaises(ValueError) as ctx:
            self.user_repo.delete(self.db, admin["id"])
        self.assertIn("Không thể xóa tài khoản Quản trị viên", str(ctx.exception))

        # 2. Tạo tài khoản mẫu id=2 (chặn không cho xóa theo quy tắc hệ thống)
        test_origin = self.user_repo.create(
            db=self.db,
            username="origin@gmail.com",
            password="pass",
            role="user"
        )
        self.assertEqual(test_origin["id"], 2)
        with self.assertRaises(ValueError) as ctx2:
            self.user_repo.delete(self.db, test_origin["id"])
        self.assertIn("Không thể xóa tài khoản mẫu kiểm thử", str(ctx2.exception))

        # 3. Tạo tài khoản người dùng bình thường (id=3) và xóa thành công
        normal = self.user_repo.create(
            db=self.db,
            username="normal@gmail.com",
            password="pass",
            role="user"
        )
        self.assertEqual(normal["id"], 3)
        deleted = self.user_repo.delete(self.db, normal["id"])
        self.assertTrue(deleted)
        self.assertIsNone(self.user_repo.get_by_id(self.db, normal["id"]))


class TestSpriteRepository(unittest.TestCase):
    """
    Bộ kiểm thử đơn vị cho SpriteRepository:
    - Kiểm tra lưu trữ sprite thô và cập nhật sprite đã chuẩn hóa cùng metadata an toàn.
    """

    def setUp(self):
        """Khởi tạo bảng project_sprites trên SQLite in-memory."""
        self.engine = create_engine("sqlite:///:memory:")
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

        self.db.execute(text("""
            CREATE TABLE project_sprites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name VARCHAR(255) NOT NULL,
                file_hash VARCHAR(64),
                folder_name VARCHAR(150) DEFAULT 'Mặc định',
                is_sheet BOOLEAN DEFAULT 1,
                raw_image_data BLOB,
                processed_image_data BLOB,
                processing_metadata TEXT,
                status VARCHAR(50) DEFAULT 'raw',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        self.db.execute(text("""
            CREATE TABLE sprite_frames (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sprite_id INTEGER NOT NULL,
                project_id INTEGER NOT NULL,
                frame_index INTEGER NOT NULL,
                frame_name VARCHAR(255),
                frame_image_data BLOB NOT NULL,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        self.db.commit()
        self.sprite_repo = SpriteRepository()

    def tearDown(self):
        """Đóng phiên làm việc cơ sở dữ liệu."""
        self.db.close()
        self.engine.dispose()

    def test_save_and_update_sprite(self):
        """Kiểm tra lưu sprite gốc và cập nhật sprite đã qua xử lý với metadata."""
        # 1. Lưu sprite gốc
        meta = {"original_width": 128, "original_height": 192}
        sprite_id = self.sprite_repo.save_raw_sprite(
            db=self.db,
            project_id=1,
            name="character_sheet",
            raw_image_bytes=b"raw_bytes",
            metadata=meta
        )
        self.assertGreater(sprite_id, 0)

        # 2. Đọc lại sprite
        saved = self.sprite_repo.get_by_id(self.db, sprite_id)
        self.assertIsNotNone(saved)
        self.assertEqual(saved["name"], "character_sheet")
        self.assertEqual(saved["status"], "raw")
        self.assertIn('"original_width": 128', saved["processing_metadata"])

        # 3. Cập nhật sprite đã xử lý
        processed_meta = {"normalized_width": 128, "padding": 4}
        updated = self.sprite_repo.update_processed_sprite(
            db=self.db,
            sprite_id=sprite_id,
            project_id=1,
            processed_image_bytes=b"processed_bytes",
            metadata=processed_meta
        )
        self.assertTrue(updated)

        # Kiểm tra chi tiết đầy đủ
        full_sprite = self.sprite_repo.get_sprite_by_id(self.db, sprite_id, project_id=1)
        self.assertEqual(full_sprite["status"], "processed")
        self.assertEqual(full_sprite["processed_image_data"], b"processed_bytes")
        self.assertIn('"normalized_width": 128', full_sprite["processing_metadata"])

        # 4. Xóa sprite
        deleted = self.sprite_repo.delete_sprite(self.db, sprite_id, project_id=1)
        self.assertTrue(deleted)
        self.assertIsNone(self.sprite_repo.get_by_id(self.db, sprite_id))

    def test_save_raw_sprite_deduplication(self):
        """Kiểm tra cơ chế băm SHA-256 ngăn chặn lưu trùng lặp ảnh trong cùng một dự án."""
        img_bytes = b"sample_pixel_art_sprite_bytes_123"

        # Lưu lần 1
        id_1 = self.sprite_repo.save_raw_sprite(
            db=self.db,
            project_id=1,
            name="hero_walk_1.png",
            raw_image_bytes=img_bytes
        )
        self.assertGreater(id_1, 0)

        # Lưu lần 2 với cùng nội dung bytes trong cùng project_id
        id_2 = self.sprite_repo.save_raw_sprite(
            db=self.db,
            project_id=1,
            name="hero_walk_duplicate.png",
            raw_image_bytes=img_bytes
        )
        # Phải trả về cùng id_1, không tạo thêm bản ghi mới
        self.assertEqual(id_1, id_2)

        # Kiểm tra tổng số bản ghi trong project_id = 1 chỉ duy nhất là 1
        sprites = self.sprite_repo.get_sprites_by_project(self.db, project_id=1)
        self.assertEqual(len(sprites), 1)
        self.assertIsNotNone(sprites[0].get("file_hash"))

    def test_save_sliced_pack_and_frames(self):
        """Kiểm tra lưu trọn gói Sprite Sheet kèm toàn bộ các frame cắt rời vào thư mục."""
        sheet_bytes = b"sheet_binary_data_abc"
        frames = [
            {"index": 1, "name": "frame_001.png", "bytes": b"f1_bytes", "size": [32, 32]},
            {"index": 2, "name": "frame_002.png", "bytes": b"f2_bytes", "size": [32, 32]},
            {"index": 3, "name": "frame_003.png", "bytes": b"f3_bytes", "size": [32, 32]},
        ]
        res = self.sprite_repo.save_sliced_pack(
            db=self.db,
            project_id=1,
            folder_name="Mage_Purple_15f",
            sheet_name="mage_sheet.png",
            sheet_bytes=sheet_bytes,
            frames=frames,
            metadata={"rows": 1, "columns": 3, "fps": 6}
        )
        self.assertGreater(res["sprite_id"], 0)
        self.assertEqual(res["folder_name"], "Mage_Purple_15f")
        self.assertEqual(res["frame_count"], 3)

        # Kiểm tra lấy danh sách frame
        saved_frames = self.sprite_repo.get_sprite_frames(self.db, res["sprite_id"])
        self.assertEqual(len(saved_frames), 3)
        self.assertEqual(saved_frames[0]["frame_name"], "frame_001.png")

        # Kiểm tra lấy dữ liệu ảnh của frame
        img_data = self.sprite_repo.get_frame_image(self.db, saved_frames[0]["id"])
        self.assertEqual(img_data, b"f1_bytes")

        # Kiểm tra get_sprites_by_project có frame_count = 3
        sprites = self.sprite_repo.get_sprites_by_project(self.db, project_id=1)
        sheet_record = next((s for s in sprites if s["id"] == res["sprite_id"]), None)
        self.assertIsNotNone(sheet_record)
        self.assertEqual(sheet_record["frame_count"], 3)
        self.assertEqual(sheet_record["folder_name"], "Mage_Purple_15f")


if __name__ == "__main__":
    unittest.main()
