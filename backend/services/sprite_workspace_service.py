# 1. THƯ VIỆN NỀN TẢNG PYTHON (Bộ đệm và mã hóa)
import hashlib
import io
import json
from base64 import b64encode

# 2. THƯ VIỆN BÊN NGOÀI (Đọc và ghép ảnh)
from PIL import Image, ImageOps

# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Xử lý và lưu sprite)
from backend.services.sprite_service import SpriteService
from backend.core.processing.sprite_editing import resize_sprite as resize_image

# 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
# Không áp dụng cho dịch vụ backend.


class SpriteWorkspaceService:
    """Điều phối dữ liệu ảnh và kho lưu trữ độc lập với HTTP."""

    def __init__(self, repository):
        """Nhận kho lưu trữ từ ứng dụng để giữ quyền sở hữu phiên bên gọi."""
        self.repository = repository

    def save_raw(self, db, raw_bytes, filename, name, project_id):
        """Xử lý dữ liệu và trả kết quả theo hợp đồng workspace hiện tại."""
        sprite_name = name or filename or "sprite_raw"
        file_hash = hashlib.sha256(raw_bytes).hexdigest() if raw_bytes else None

        # Kiểm tra chống trùng lặp theo mã băm SHA-256
        existing = self.repository.get_by_hash(db, project_id, file_hash) if file_hash else None
        if existing:
            return {
                "status": "success",
                "id": existing["id"],
                "name": existing["name"],
                "file_hash": file_hash,
                "is_duplicate": True,
                "message": f"Ảnh này đã tồn tại trong dự án (Mã: {existing['id']}), hệ thống tự động tái sử dụng và chặn lưu trùng lặp."
            }

        sprite_id = self.repository.save_raw_sprite(
            db=db,
            project_id=project_id,
            name=sprite_name,
            raw_image_bytes=raw_bytes,
            metadata={"filename": filename, "size_bytes": len(raw_bytes), "file_hash": file_hash}
        )
        return {
            "status": "success",
            "id": sprite_id,
            "name": sprite_name,
            "file_hash": file_hash,
            "is_duplicate": False,
            "message": "Đã lưu ảnh gốc vào MySQL thành công!"
        }

    def save_processed(self, db, proc_bytes, filename, sprite_id, project_id):
        """Xử lý dữ liệu và trả kết quả theo hợp đồng workspace hiện tại."""
        success = self.repository.update_processed_sprite(
            db=db,
            sprite_id=sprite_id,
            project_id=project_id,
            processed_image_bytes=proc_bytes,
            metadata={"filename": filename, "size_bytes": len(proc_bytes)}
        )
        return {"status": "success" if success else "failed", "id": sprite_id, "message": "Đã lưu ảnh tối ưu vào MySQL thành công!"}

    def save_sliced_pack(self, db, raw_bytes, filename, project_id, rows, columns, folder_name, auto_anchor, fps, target_width, target_height, x_cuts, y_cuts):
        """Xử lý dữ liệu và trả kết quả theo hợp đồng workspace hiện tại."""
        sheet_name = filename or f"sheet_{rows}x{columns}.png"

        # Mở ảnh bằng Pillow và tự động cắt thành các ô frame
        image = Image.open(io.BytesIO(raw_bytes))
        image = ImageOps.exif_transpose(image)

        is_batch_resized = bool(target_width and target_height and target_width > 0 and target_height > 0)

        frames_list = []

        for idx, (frame_name, frame_size, png_bytes) in enumerate(
            SpriteService.sheet_frames(image, rows=rows, columns=columns, auto_anchor=auto_anchor,
                                       x_cuts=x_cuts, y_cuts=y_cuts),
            start=1
        ):
            if is_batch_resized:
                frame_img = Image.open(io.BytesIO(png_bytes))
                resized = resize_image(frame_img, width=target_width, height=target_height)
                buf = io.BytesIO()
                resized.save(buf, format="PNG")
                final_png_bytes = buf.getvalue()
                final_size = [target_width, target_height]
            else:
                final_png_bytes = png_bytes
                final_size = list(frame_size)

            frames_list.append({
                "index": idx,
                "name": frame_name,
                "bytes": final_png_bytes,
                "size": final_size,
                "metadata": {
                    "width": final_size[0],
                    "height": final_size[1],
                    "row": (idx - 1) // columns + 1,
                    "col": (idx - 1) % columns + 1
                }
            })

        # Lưới thủ công có ô khác nhau nên metadata phải dùng canvas đã đệm thực tế.
        frame_width = target_width if is_batch_resized else (frames_list[0]["size"][0] if x_cuts is not None else image.width // columns)
        frame_height = target_height if is_batch_resized else (frames_list[0]["size"][1] if y_cuts is not None else image.height // rows)

        # Nếu có ép kích thước: Tự động ghép 15 frame nhỏ thành một tấm Sprite Sheet mới hoàn chỉnh
        # Lưới thủ công cũng ghép lại các PNG đã đệm để thư viện tải lại và xuất Godot theo lưới đều.
        if (is_batch_resized or x_cuts is not None) and frames_list:
            new_sheet_w = columns * frame_width
            new_sheet_h = rows * frame_height
            new_sheet_img = Image.new("RGBA", (new_sheet_w, new_sheet_h), (0, 0, 0, 0))

            for f_idx, frame in enumerate(frames_list):
                col_i = f_idx % columns
                row_i = f_idx // columns
                with Image.open(io.BytesIO(frame["bytes"])) as rf_img:
                    new_sheet_img.paste(rf_img, (col_i * frame_width, row_i * frame_height))

            s_buf = io.BytesIO()
            new_sheet_img.save(s_buf, format="PNG")
            final_sheet_bytes = s_buf.getvalue()
            if is_batch_resized:
                name_stem = sheet_name.rsplit(".", 1)[0]
                sheet_name = f"{name_stem}_{target_width}x{target_height}.png"
        else:
            final_sheet_bytes = raw_bytes

        metadata = {
            "rows": rows,
            "columns": columns,
            "auto_anchor": auto_anchor,
            "fps": fps,
            "original_width": image.width,
            "original_height": image.height,
            "frame_width": frame_width,
            "frame_height": frame_height,
            "is_batch_resized": is_batch_resized,
            "frame_count": len(frames_list),
            "filename": sheet_name
        }
        if x_cuts is not None:
            metadata.update({
                "x_cuts": x_cuts, "y_cuts": y_cuts,
                "source_width": image.width, "source_height": image.height,
                "original_width": new_sheet_w, "original_height": new_sheet_h,
            })

        result = self.repository.save_sliced_pack(
            db=db,
            project_id=project_id,
            folder_name=folder_name.strip() or "Mặc định",
            sheet_name=sheet_name,
            sheet_bytes=final_sheet_bytes,
            frames=frames_list,
            metadata=metadata
        )

        return {
            "status": "success",
            "sprite_id": result["sprite_id"],
            "folder_name": result["folder_name"],
            "sheet_name": result["sheet_name"],
            "frame_count": result["frame_count"],
            "is_batch_resized": is_batch_resized,
            "frame_width": frame_width,
            "frame_height": frame_height,
            "message": f"Đã lưu thành công bộ {result['frame_count']} frame ({'đã ép ' + str(target_width) + '×' + str(target_height) + 'px' if is_batch_resized else 'gốc'}) vào thư mục '{result['folder_name']}'!"
        }

    def get_frames(self, db, sprite_id):
        """Bổ sung URL và đọc metadata cho danh sách frame đã lưu."""
        frames = self.repository.get_sprite_frames(db, sprite_id)
        # Bổ sung URL tải ảnh cho từng frame
        for f in frames:
            f["image_url"] = f"/api/sprites/frames/{f['id']}/image"
            if isinstance(f.get("metadata"), str):
                try:
                    f["metadata"] = json.loads(f["metadata"])
                except Exception:
                    pass
        return {"status": "success", "sprite_id": sprite_id, "frames": frames}
