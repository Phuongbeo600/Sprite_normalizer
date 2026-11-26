"""Điều phối hậu xử lý sheet AI, giữ nguyên ảnh provider khi bất kỳ bước nào lỗi."""

# 1. THƯ VIỆN NỀN TẢNG PYTHON
import io
import logging
from base64 import b64decode, b64encode

# 2. THƯ VIỆN BÊN NGOÀI
from PIL import Image, ImageOps

# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
from backend.core.load_control import image_proc_concurrency, validate_sheet_grid_limits
from backend.core.processing.masking import BackgroundMaskExtractor, BackgroundSpec
from backend.core.processing.sprite_editing import recover_native_sprite
from backend.schemas.image_gen import GeneratedImageItem, ImagePostProcessingResult, ProcessedFrame
from backend.services.sprite_service import SpriteService

# 4. CẤU HÌNH
logger = logging.getLogger(__name__)


class ImagePostProcessingService:
    @staticmethod
    def _safe_analyze_background(native: Image.Image) -> BackgroundSpec | None:
        """Phân tích nền trên toàn sheet đã khôi phục lưới; trả về None nếu lỗi hoặc không chắc chắn."""
        try:
            return BackgroundMaskExtractor.analyze_background(native)
        except Exception:
            logger.exception('Phân tích nền giả thất bại; giữ nguyên nền gốc.')
            return None

    @staticmethod
    def _remove_frames_background(frames: list, bg_spec: BackgroundSpec | None) -> list:
        """Tách nền giả, khử viền halo và dọn chấm rác từng frame; giữ frame gốc nếu xử lý lỗi."""
        cleaned_frames = []
        for name, size, png in frames:
            try:
                with Image.open(io.BytesIO(png)) as frame_img:
                    if bg_spec is not None:
                        cleaned = BackgroundMaskExtractor.remove_background_with_spec(
                            frame_img, bg_spec, clean_specks=True
                        )
                    else:
                        cleaned = BackgroundMaskExtractor.clean_frame_specks(frame_img)
                    try:
                        cleaned_frames.append((name, size, SpriteService.encode_png(cleaned)))
                    finally:
                        if cleaned is not frame_img:
                            cleaned.close()
            except Exception:
                logger.exception('Tách nền frame %s thất bại; giữ nguyên frame gốc.', name)
                cleaned_frames.append((name, size, png))
        return cleaned_frames

    @staticmethod
    def _compose_processed_sheet(
        frame_pngs: list[bytes],
        rows: int,
        columns: int,
        frame_width: int,
        frame_height: int,
    ) -> str:
        """Ghép các khung hình đã chuẩn hóa thành một tấm Sprite Sheet PNG hoàn chỉnh dạng Base64."""
        canvas = Image.new('RGBA', (columns * frame_width, rows * frame_height), (0, 0, 0, 0))
        try:
            for index, png in enumerate(frame_pngs):
                row_idx = index // columns
                col_idx = index % columns
                with Image.open(io.BytesIO(png)) as tile:
                    canvas.paste(tile, (col_idx * frame_width, row_idx * frame_height))
            return b64encode(SpriteService.encode_png(canvas)).decode('ascii')
        finally:
            canvas.close()

    @staticmethod
    def _clean_sheet_before_slicing(
        oriented: Image.Image,
        native: Image.Image,
    ) -> tuple[Image.Image, Image.Image, BackgroundSpec | None]:
        """Tách nền giả trước khi cắt lưới để `trim_outer_padding` gọt đúng lề trống; trả (native_đích, sheet_đã_sạch, bg_spec)."""
        bg_spec = ImagePostProcessingService._safe_analyze_background(native)
        working_native = native

        # Nếu quá trình hạ lưới làm nhòe ô cờ mịn ở ảnh gốc, thử tách nền trên ảnh gốc rồi khôi phục lại lưới
        if bg_spec is None and native is not oriented:
            raw_spec = ImagePostProcessingService._safe_analyze_background(oriented)
            if raw_spec is not None:
                cleaned_oriented = BackgroundMaskExtractor.remove_background_with_spec(oriented, raw_spec)
                try:
                    rebuilt_native, _ = recover_native_sprite(cleaned_oriented)
                finally:
                    if cleaned_oriented is not oriented:
                        cleaned_oriented.close()
                if native is not oriented:
                    native.close()
                return rebuilt_native, rebuilt_native, raw_spec

        if bg_spec is None:
            return working_native, working_native, None

        cleaned_sheet = BackgroundMaskExtractor.remove_background_with_spec(working_native, bg_spec)
        return working_native, cleaned_sheet, bg_spec

    @staticmethod
    def process(image: GeneratedImageItem, native_size_wh: tuple[int, int] | None) -> ImagePostProcessingResult:
        """Đo lưới → phân tích & tách nền sheet → cắt 15 frame → làm sạch từng frame → ép kích thước → ghép sheet."""
        step = 'resolution'
        labels = {'resolution': 'kiểm tra độ phân giải thật', 'decode': 'đọc ảnh gốc',
                  'grid': 'đo lưới', 'slice': 'cắt sheet', 'resize': 'ép độ phân giải'}
        try:
            if native_size_wh is None:
                return ImagePostProcessingResult(status='skipped', failed_step=step,
                    message='AI đã tạo ảnh thành công. Chưa hậu xử lý: thiếu độ phân giải thật từ Tab Phân tích; giữ ảnh gốc.')
            width, height = native_size_wh
            validate_sheet_grid_limits(3, 5, width, height)
            if width < 1 or height < 1:
                raise ValueError('Độ phân giải thật phải gồm hai số pixel dương.')
            step = 'decode'
            raw = b64decode(image.b64_data, validate=True)
            with image_proc_concurrency, Image.open(io.BytesIO(raw)) as source, ImageOps.exif_transpose(source) as oriented:
                step = 'grid'
                native, _scale = recover_native_sprite(oriented)
                cleaned_sheet = native
                try:
                    # Phân tích và tách nền trước khi cắt để lề trống ngoài sheet được gọt chính xác
                    native, cleaned_sheet, bg_spec = ImagePostProcessingService._clean_sheet_before_slicing(
                        oriented, native
                    )
                    step = 'slice'
                    frames = list(SpriteService.sheet_frames(cleaned_sheet, 3, 5))
                    if len(frames) != 15:
                        raise ValueError(f'Sheet 3×5 cần đủ 15 frame, nhận được {len(frames)}.')
                    # Làm sạch bổ sung từng frame (phòng trường hợp sau cắt mới lộ mép nền hoặc hốc kín)
                    frames = ImagePostProcessingService._remove_frames_background(frames, bg_spec)
                    step = 'resize'
                    processed = []
                    frame_pngs = []
                    for index, (name, size, png) in enumerate(SpriteService.resize_frames(frames, width, height, keep_ratio=True)):
                        data = b64encode(png).decode('ascii')
                        frame_pngs.append(png)
                        processed.append(ProcessedFrame(id=f'{image.id}_{index + 1:03}', name=name,
                            b64_data=data, data_url=f'data:image/png;base64,{data}',
                            width=size[0], height=size[1], row=index // 5, column=index % 5,
                            aspect_ratio=f'{width}:{height}'))
                    if len(processed) != 15:
                        raise ValueError('Ép độ phân giải không trả đủ 15 frame.')
                    # Ghép 15 frame đã chuẩn hóa thành tấm Sprite Sheet sau hậu xử lý để lưu và hiển thị
                    sheet_b64 = ImagePostProcessingService._compose_processed_sheet(
                        frame_pngs, rows=3, columns=5, frame_width=width, frame_height=height
                    )
                    return ImagePostProcessingResult(
                        status='success',
                        message='Đã chuẩn hóa 15 frame.',
                        frames=processed,
                        sheet_b64_data=sheet_b64,
                        sheet_data_url=f'data:image/png;base64,{sheet_b64}',
                    )
                finally:
                    if cleaned_sheet is not native and cleaned_sheet is not oriented:
                        cleaned_sheet.close()
                    if native is not oriented:
                        native.close()
        except Exception as error:
            logger.exception('Image post-processing failed at %s', step)
            return ImagePostProcessingResult(status='error', failed_step=step,
                message=f'AI đã tạo ảnh thành công. Hậu xử lý lỗi tại bước {labels[step]}: {error}. Giữ ảnh gốc.')
