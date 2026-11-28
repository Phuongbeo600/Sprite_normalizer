import io
import unittest
from base64 import b64encode, b64decode
from unittest.mock import patch
from PIL import Image
from backend.schemas.image_gen import GeneratedImageItem, ImageGenRequest, ImageGenResponse
from backend.services.image_gen_service import ImageGenService
from backend.services.image_post_processing_service import ImagePostProcessingService


class TestImagePostProcessing(unittest.TestCase):
    def setUp(self):
        logger = patch('backend.services.image_post_processing_service.logger')
        logger.start()
        self.addCleanup(logger.stop)

    def make_sheet(self):
        image = Image.new('RGBA', (50, 24))
        for index in range(15):
            x, y = (index % 5) * 10, (index // 5) * 8
            image.paste((index * 15, 80, 90, 255), (x, y, x + 10, y + 8))
        buffer = io.BytesIO()
        image.save(buffer, format='PNG')
        data = b64encode(buffer.getvalue()).decode('ascii')
        return GeneratedImageItem(id='sheet', b64_data=data, data_url=f'data:image/png;base64,{data}')

    def test_order_size_ratio_and_original(self):
        item = self.make_sheet()
        original = item.model_dump()
        result = ImagePostProcessingService.process(item, (20, 20))
        self.assertEqual(result.status, 'success')
        self.assertEqual(len(result.frames), 15)
        self.assertEqual(item.model_dump(), original)
        for index, frame in enumerate(result.frames):
            with Image.open(io.BytesIO(b64decode(frame.b64_data))) as image:
                self.assertEqual(image.size, (20, 20))
                self.assertEqual(image.getpixel((10, 10)), (index * 15, 80, 90, 255))
                self.assertEqual(image.getbbox(), (0, 4, 20, 20))
            self.assertEqual((frame.row, frame.column), (index // 5, index % 5))

    def test_missing_resolution_does_not_guess(self):
        result = ImagePostProcessingService.process(self.make_sheet(), None)
        self.assertEqual((result.status, result.failed_step, result.frames), ('skipped', 'resolution', []))

    def test_stage_failures_keep_no_partial_frames(self):
        for target, step in [('recover_native_sprite', 'grid'), ('SpriteService.sheet_frames', 'slice'),
                             ('SpriteService.resize_frames', 'resize')]:
            with self.subTest(step=step), patch('backend.services.image_post_processing_service.' + target, side_effect=ValueError('bad')):
                result = ImagePostProcessingService.process(self.make_sheet(), (20, 20))
                self.assertEqual((result.status, result.failed_step, result.frames), ('error', step, []))

    def test_incomplete_sheet_is_rejected_before_resize(self):
        with patch('backend.services.image_post_processing_service.SpriteService.sheet_frames', return_value=[]), patch('backend.services.image_post_processing_service.SpriteService.resize_frames') as resize:
            result = ImagePostProcessingService.process(self.make_sheet(), (20, 20))
        self.assertEqual(result.failed_step, 'slice')
        resize.assert_not_called()

    def test_bad_image_reports_decode_failure(self):
        item = self.make_sheet()
        item.b64_data = 'invalid'
        self.assertEqual(ImagePostProcessingService.process(item, (20, 20)).failed_step, 'decode')

    def test_generation_passes_analysis_resolution_and_retains_success_on_error(self):
        for size, expected in [([20, 20], 'success'), (None, 'skipped'), ([0, 20], 'error')]:
            with self.subTest(size=size):
                original = self.make_sheet()
                original_data = original.b64_data
                response = ImageGenResponse(provider_used='openai', model_used='test', images=[original])
                with patch('backend.services.image_gen_service.AiCredentialsService.resolve_image_configuration',
                           return_value={'api_key': 'test', 'provider': 'openai', 'base_url': None, 'model': 'test'}), \
                     patch('backend.services.image_gen_service.load_fixed_reference_image_2_b64', return_value=None), \
                     patch('backend.services.image_gen_service.build_prompt_from_request', return_value='prompt'), \
                     patch('backend.services.image_gen_service.ImageGenProviderFactory.get_provider') as factory:
                    factory.return_value.generate_images.return_value = response
                    result = ImageGenService.generate_images(ImageGenRequest(prompt='test', native_size_wh=size))
                self.assertEqual(result.status, 'success')
                self.assertEqual(result.images[0].b64_data, original_data)
                self.assertEqual(result.images[0].post_processing.status, expected)
                # Exercise the actual HTTP response serialization, including nested frame data.
                restored = ImageGenResponse.model_validate_json(result.model_dump_json())
                self.assertEqual(restored.images[0].post_processing.status, expected)

    def test_upscaled_sheet_uses_existing_grid_recovery(self):
        item = self.make_sheet()
        with Image.open(io.BytesIO(b64decode(item.b64_data))) as source:
            with source.resize((100, 48), Image.Resampling.NEAREST) as enlarged:
                buffer = io.BytesIO()
                enlarged.save(buffer, format='PNG')
                item.b64_data = b64encode(buffer.getvalue()).decode('ascii')
        result = ImagePostProcessingService.process(item, (20, 20))
        self.assertEqual(result.status, 'success')
        for index, frame in enumerate(result.frames):
            with Image.open(io.BytesIO(b64decode(frame.b64_data))) as image:
                self.assertEqual(image.getpixel((10, 10)), (index * 15, 80, 90, 255))

    def test_existing_batch_resize_preserves_its_pixels_after_extraction(self):
        from backend.services.sprite_service import SpriteService
        from backend.core.processing.sprite_editing import resize_sprite
        item = self.make_sheet()
        with Image.open(io.BytesIO(b64decode(item.b64_data))) as sheet:
            source_frames = list(SpriteService.sheet_frames(sheet, 3, 5))
            resized_frames = list(SpriteService.resized_sheet_frames(sheet, 3, 5, 7, 11))
        for original, resized in zip(source_frames, resized_frames):
            self.assertEqual(original[0], resized[0])
            with Image.open(io.BytesIO(original[2])) as source:
                with resize_sprite(source, 7, 11) as expected:
                    self.assertEqual(resized[2], SpriteService.encode_png(expected))
