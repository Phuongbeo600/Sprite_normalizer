# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống, Bộ đệm & Nén tệp)
# ========================================================
# io: Xử lý bộ nhớ đệm nhị phân cho ảnh và gói ZIP
import io
# zipfile: Đóng gói toàn bộ tài nguyên Godot thành tệp ZIP
from zipfile import ZipFile

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# PIL (Pillow): Mở, ghép nối và lưu ảnh Sprite Sheet
from PIL import Image

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Core Normalizer & Editing)
# ========================================================
# slice_sheet: Cắt lưới thích ứng các frame đều nhau
from backend.core.sprite_editing import slice_sheet
# SpriteNormalizer: Bóc tách Bounding Box và đo đạc hộp va chạm
from backend.core.normalizer import SpriteNormalizer

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file backend)


class GodotExportService:
    """
    Dịch vụ đóng gói tài nguyên nhân vật xuất xưởng cho Godot Engine 4.x.
    
    Nhiệm vụ:
    1. Cắt và chuẩn hóa toàn bộ các frame theo ma trận lưới đồng bộ (Mặt, Nghiêng, Lưng).
    2. Ghép thành ảnh Sprite Sheet chuẩn `character_sheet.png`.
    3. Tự động sinh file tài nguyên `character_frames.tres` (SpriteFrames) đã cấu hình sẵn FPS và animation.
    4. Tự động sinh Scene `Player.tscn` (CharacterBody2D + CollisionShape2D ôm khít người).
    5. Tự động sinh mã nguồn điều khiển `player.gd` (di chuyển 8 hướng mượt mà).
    6. Đóng gói tất cả vào một tệp ZIP duy nhất để kéo thả vào Godot là chạy được ngay.
    """

    @classmethod
    def export_godot_package(
        cls,
        image: Image.Image,
        rows: int = 3,
        columns: int = 5,
        fps: float = 8.0,
        move_speed: float = 120.0,
        character_name: str = "Player",
        auto_anchor: bool = True
    ) -> bytes:
        """
        Đóng gói toàn bộ tài nguyên cho Godot 4 và trả về chuỗi byte của tệp ZIP.

        @param {Image.Image} image Ảnh sprite sheet gốc.
        @param {int} rows Số hàng của lưới (mặc định 3: Down, Side, Up).
        @param {int} columns Số cột của lưới (mặc định 5: 1 Idle + 4 Walk).
        @param {float} fps Tốc độ hoạt họa khung hình trên giây.
        @param {float} move_speed Tốc độ di chuyển của nhân vật (pixel/s).
        @param {str} character_name Tên định danh nhân vật và node gốc.
        @param {bool} auto_anchor Căn giữa ngang và neo chân chạm đáy.
        @returns {bytes} Dữ liệu nhị phân của tệp ZIP gói Godot 4.
        """
        # 1. Cắt các frame từ ảnh gốc
        raw_frames = list(slice_sheet(image, rows=rows, columns=columns, auto_anchor=auto_anchor))
        if not raw_frames:
            raise ValueError("Không cắt được frame nào từ ảnh cung cấp.")

        frame_w, frame_h = raw_frames[0].size

        # 2. Ghép các frame đã chuẩn hóa thành một tấm Sprite Sheet mới hoàn hảo
        sheet_w = frame_w * columns
        sheet_h = frame_h * rows
        combined_sheet = Image.new("RGBA", (sheet_w, sheet_h), (0, 0, 0, 0))

        for idx, f in enumerate(raw_frames):
            r = idx // columns
            c = idx % columns
            combined_sheet.paste(f, (c * frame_w, r * frame_h))

        sheet_buffer = io.BytesIO()
        combined_sheet.save(sheet_buffer, format="PNG")
        sheet_png_bytes = sheet_buffer.getvalue()

        # 3. Tính toán thông số hộp va chạm (CollisionShape2D)
        # Quét Bounding Box của frame đầu tiên để ước lượng tỷ lệ cơ thể
        normalizer = SpriteNormalizer(target_width=frame_w, target_height=frame_h)
        bbox = normalizer.get_bounding_box(raw_frames[0])
        if bbox:
            _, ymin, _, ymax = bbox
            char_actual_h = max(10, ymax - ymin)
            collision_radius = max(6.0, round((frame_w * 0.22), 1))
            collision_height = max(collision_radius * 2, round(char_actual_h * 0.65, 1))
        else:
            collision_radius = max(6.0, round(frame_w * 0.2, 1))
            collision_height = max(16.0, round(frame_h * 0.5, 1))

        # Điểm neo đáy: Sprite đặt tại y = -frame_h / 2 để chân tiếp xúc đúng gốc tọa độ (0, 0)
        sprite_pos_y = -round(frame_h / 2.0, 1)
        collision_pos_y = -round(collision_height / 2.0, 1)

        # 4. Sinh nội dung file tài nguyên Godot (TRES, TSCN, GD)
        tres_content = cls._generate_sprite_frames_tres(
            rows=rows,
            columns=columns,
            frame_w=frame_w,
            frame_h=frame_h,
            fps=fps
        )

        tscn_content = cls._generate_player_scene_tscn(
            character_name=character_name,
            sprite_pos_y=sprite_pos_y,
            collision_pos_y=collision_pos_y,
            collision_radius=collision_radius,
            collision_height=collision_height
        )

        gd_content = cls._generate_player_script_gd(move_speed=move_speed)

        readme_content = cls._generate_readme_text(
            character_name=character_name,
            frame_w=frame_w,
            frame_h=frame_h,
            rows=rows,
            columns=columns,
            fps=fps
        )

        # 5. Đóng gói vào tệp ZIP
        zip_buffer = io.BytesIO()
        with ZipFile(zip_buffer, "w") as zf:
            zf.writestr("character_sheet.png", sheet_png_bytes)
            zf.writestr("character_frames.tres", tres_content)
            zf.writestr(f"{character_name}.tscn", tscn_content)
            zf.writestr("player.gd", gd_content)
            zf.writestr("HUONG_DAN_SU_DUNG.txt", readme_content)

        return zip_buffer.getvalue()

    @staticmethod
    def _generate_sprite_frames_tres(
        rows: int,
        columns: int,
        frame_w: int,
        frame_h: int,
        fps: float
    ) -> str:
        """Sinh chuỗi văn bản tài nguyên SpriteFrames chuẩn của Godot 4."""
        total_frames = rows * columns
        load_steps = total_frames + 3

        lines = [
            f'[gd_resource type="SpriteFrames" load_steps={load_steps} format=3 uid="uid://char_frames_{frame_w}_{frame_h}"]',
            '',
            '[ext_resource type="Texture2D" path="res://character_sheet.png" id="1_sheet"]',
            ''
        ]

        # Khai báo từng AtlasTexture cho từng ô
        for idx in range(total_frames):
            r = idx // columns
            c = idx % columns
            x = c * frame_w
            y = r * frame_h
            lines.append(f'[sub_resource type="AtlasTexture" id="AtlasTexture_{idx}"]')
            lines.append('atlas = ExtResource("1_sheet")')
            lines.append(f'region = Rect2({x}, {y}, {frame_w}, {frame_h})')
            lines.append('')

        # Xây dựng danh sách animation
        # Hàng 0: Down (Mặt), Hàng 1: Side (Nghiêng), Hàng 2: Up (Lưng)
        lines.append('[resource]')
        lines.append('animations = [{')

        # Animation 1: idle_down
        lines.append('"frames": [{')
        lines.append('"duration": 1.0,')
        lines.append('"texture": SubResource("AtlasTexture_0")')
        lines.append('}],')
        lines.append('"loop": true,')
        lines.append('"name": &"idle_down",')
        lines.append(f'"speed": {fps}')
        lines.append('}, {')

        # Animation 2: walk_down
        walk_down_frames = []
        for c in range(1, columns):
            walk_down_frames.append('{\n"duration": 1.0,\n"texture": SubResource("AtlasTexture_' + str(c) + '")\n}')
        lines.append('"frames": [' + ", ".join(walk_down_frames) + '],')
        lines.append('"loop": true,')
        lines.append('"name": &"walk_down",')
        lines.append(f'"speed": {fps}')
        lines.append('}, {')

        # Animation 3: idle_side
        side_idle_idx = columns if rows > 1 else 0
        lines.append('"frames": [{')
        lines.append('"duration": 1.0,')
        lines.append(f'"texture": SubResource("AtlasTexture_{side_idle_idx}")')
        lines.append('}],')
        lines.append('"loop": true,')
        lines.append('"name": &"idle_side",')
        lines.append(f'"speed": {fps}')
        lines.append('}, {')

        # Animation 4: walk_side
        walk_side_frames = []
        start_side = columns if rows > 1 else 0
        for c in range(1, columns):
            walk_side_frames.append('{\n"duration": 1.0,\n"texture": SubResource("AtlasTexture_' + str(start_side + c) + '")\n}')
        lines.append('"frames": [' + ", ".join(walk_side_frames) + '],')
        lines.append('"loop": true,')
        lines.append('"name": &"walk_side",')
        lines.append(f'"speed": {fps}')
        lines.append('}, {')

        # Animation 5: idle_up
        up_idle_idx = columns * 2 if rows > 2 else 0
        lines.append('"frames": [{')
        lines.append('"duration": 1.0,')
        lines.append(f'"texture": SubResource("AtlasTexture_{up_idle_idx}")')
        lines.append('}],')
        lines.append('"loop": true,')
        lines.append('"name": &"idle_up",')
        lines.append(f'"speed": {fps}')
        lines.append('}, {')

        # Animation 6: walk_up
        walk_up_frames = []
        start_up = columns * 2 if rows > 2 else 0
        for c in range(1, columns):
            walk_up_frames.append('{\n"duration": 1.0,\n"texture": SubResource("AtlasTexture_' + str(start_up + c) + '")\n}')
        lines.append('"frames": [' + ", ".join(walk_up_frames) + '],')
        lines.append('"loop": true,')
        lines.append('"name": &"walk_up",')
        lines.append(f'"speed": {fps}')
        lines.append('}]')

        return "\n".join(lines)

    @staticmethod
    def _generate_player_scene_tscn(
        character_name: str,
        sprite_pos_y: float,
        collision_pos_y: float,
        collision_radius: float,
        collision_height: float
    ) -> str:
        """Sinh chuỗi văn bản Scene Godot 4 chuẩn (.tscn)."""
        return f"""[gd_scene load_steps=5 format=3 uid="uid://player_scene_{character_name.lower()}"]

[ext_resource type="Script" path="res://player.gd" id="1_script"]
[ext_resource type="SpriteFrames" path="res://character_frames.tres" id="2_frames"]

[sub_resource type="CapsuleShape2D" id="CapsuleShape2D_1"]
radius = {collision_radius}
height = {collision_height}

[node name="{character_name}" type="CharacterBody2D"]
script = ExtResource("1_script")

[node name="AnimatedSprite2D" type="AnimatedSprite2D" parent="."]
texture_filter = 1
position = Vector2(0, {sprite_pos_y})
sprite_frames = ExtResource("2_frames")
animation = &"idle_down"
autoplay = "idle_down"

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
position = Vector2(0, {collision_pos_y})
shape = SubResource("CapsuleShape2D_1")
"""

    @staticmethod
    def _generate_player_script_gd(move_speed: float) -> str:
        """Sinh mã nguồn GDScript 4 di chuyển 8 hướng mượt mà."""
        return f"""extends CharacterBody2D

# Tốc độ di chuyển của nhân vật (pixel/giây)
@export var speed: float = {move_speed}

# Tham chiếu tới node hoạt họa
@onready var sprite: AnimatedSprite2D = $AnimatedSprite2D

# Hướng mặt hiện tại: "down", "side", "up"
var facing_direction: String = "down"

func _physics_process(_delta: float) -> void:
	# Nhận diện tín hiệu điều khiển từ bàn phím (W-A-S-D hoặc các phím mũi tên)
	var input_vector := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	velocity = input_vector * speed
	move_and_slide()
	
	_update_animation(input_vector)

func _update_animation(direction: Vector2) -> void:
	if direction != Vector2.ZERO:
		if abs(direction.x) > abs(direction.y):
			facing_direction = "side"
			# Lật ảnh khi di chuyển sang trái
			sprite.flip_h = direction.x < 0
		elif direction.y > 0:
			facing_direction = "down"
			sprite.flip_h = false
		else:
			facing_direction = "up"
			sprite.flip_h = false
		
		sprite.play("walk_" + facing_direction)
	else:
		sprite.play("idle_" + facing_direction)
"""

    @staticmethod
    def _generate_readme_text(
        character_name: str,
        frame_w: int,
        frame_h: int,
        rows: int,
        columns: int,
        fps: float
    ) -> str:
        """Tạo tệp hướng dẫn sử dụng nhanh bằng tiếng Việt."""
        return f"""=======================================================
GÓI TÀI NGUYÊN NHÂN VẬT SPRITE CHO GODOT ENGINE 4.x
Xuất xưởng tự động từ Sprite Normalizer & AI Studio
=======================================================

1. THÔNG SỐ KỸ THUẬT:
- Tên nhân vật: {character_name}
- Kích thước mỗi frame: {frame_w} x {frame_h} px (Lưới {rows} hàng x {columns} cột)
- Tốc độ hoạt họa (FPS): {fps} frame/giây
- Điểm neo chân (Anchor): Đáy giữa (Bottom-Center, y = 0)
- Bộ lọc ảnh (Texture Filter): Nearest (Giữ nguyên chất Pixel Art 100%)

2. DANH SÁCH TỆP TRONG GÓI:
- character_sheet.png   : Ảnh Sprite Sheet đã chuẩn hóa kích thước và lề
- character_frames.tres : Tài nguyên SpriteFrames chứa 6 animation (idle & walk 3 hướng)
- {character_name}.tscn      : Scene hoàn chỉnh của nhân vật (CharacterBody2D + CollisionShape2D)
- player.gd             : Mã nguồn GDScript di chuyển 8 hướng mượt mà
- HUONG_DAN_SU_DUNG.txt : Tệp hướng dẫn này

3. CÁCH SỬ DỤNG TRONG GODOT 4:
Bước 1: Giải nén toàn bộ các tệp vào thư mục dự án Godot của bạn (ví dụ: res://characters/).
Bước 2: Trong cửa sổ FileSystem của Godot, nhấp đúp vào tệp "{character_name}.tscn".
Bước 3: Kéo tệp "{character_name}.tscn" thả vào màn chơi (World Scene) của bạn.
Bước 4: Bấm F5 hoặc F6 để chạy game. Điều khiển nhân vật bằng các phím W, A, S, D hoặc Mũi tên!
"""
