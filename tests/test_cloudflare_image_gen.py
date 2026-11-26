"""Cloudflare provider contracts; requests are mocked, no API spend."""
import base64
import io
import os
import unittest
from unittest.mock import Mock, patch

import httpx
from PIL import Image

from backend.providers.image_gen.cloudflare_workers_ai_provider import CloudflareWorkersAiProvider
from backend.providers.image_gen import ImageGenProviderFactory
from backend.schemas.image_gen import ImageGenRequest
from backend.services.ai_credentials_service import AiCredentialsService
from backend.services.image_gen_service import ImageGenService

KLEIN = '@cf/black-forest-labs/flux-2-klein-4b'
SCHNELL = '@cf/black-forest-labs/flux-1-schnell'
ENV = {'IMAGE_GEN_PROVIDER': 'cloudflare', 'CLOUDFLARE_API_TOKEN': 'cf-secret',
       'CLOUDFLARE_ACCOUNT_ID': 'a' * 32, 'CLOUDFLARE_MODEL_ID': KLEIN}


def png_b64(size=(16, 16)):
    with Image.new('RGBA', size, (20, 40, 60, 255)) as image, io.BytesIO() as buffer:
        image.save(buffer, format='PNG')
        return base64.b64encode(buffer.getvalue()).decode('ascii')


class TestCloudflareProvider(unittest.TestCase):
    def setUp(self):
        self.env_patch = patch.dict(os.environ, ENV, clear=True)
        self.env_patch.start()
        self.addCleanup(self.env_patch.stop)
        self.post_patch = patch('backend.providers.image_gen.base._post')
        self.post = self.post_patch.start()
        self.addCleanup(self.post_patch.stop)
        self.post.return_value = Mock(status_code=200)
        self.post.return_value.json.return_value = {'success': True, 'result': {'image': png_b64()}}
        self.provider = ImageGenProviderFactory.get_provider('cloudflare')

    def test_factory_and_environment_configuration(self):
        self.assertIsInstance(self.provider, CloudflareWorkersAiProvider)
        config = AiCredentialsService.resolve_image_configuration()
        self.assertEqual((config['provider'], config['api_key'], config['model']), ('cloudflare', 'cf-secret', KLEIN))
        self.assertTrue(ImageGenService.get_status()['ready'])

    def test_missing_token_never_borrows_gemini_key(self):
        os.environ.pop('CLOUDFLARE_API_TOKEN')
        os.environ['GEMINI_API_KEY'] = 'unrelated'
        os.environ['IMAGE_GEN_API_KEY'] = 'old-openai-key'
        self.assertIsNone(AiCredentialsService.resolve_image_configuration()['api_key'])

    def test_missing_account_or_model_is_not_ready(self):
        for field in ('CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_MODEL_ID'):
            with self.subTest(field=field), patch.dict(os.environ, {field: ''}):
                self.assertFalse(ImageGenService.get_status()['ready'])

    def test_klein_multipart_transmits_both_references_in_order(self):
        ref = png_b64()
        response = self.provider.generate_images(api_key='cf-secret', prompt='sprite', model=KLEIN,
            image=ref, reference_image_2=ref, aspect_ratio='3:4')
        args, kwargs = self.post.call_args
        self.assertEqual(args[0], f'https://api.cloudflare.com/client/v4/accounts/{"a" * 32}/ai/run/{KLEIN}')
        self.assertEqual(kwargs['headers'], {'Authorization': 'Bearer cf-secret'})
        fields = dict(kwargs['files'])
        self.assertEqual(fields['prompt'], (None, 'sprite'))
        self.assertEqual(fields['input_image_0'][1], base64.b64decode(ref))
        self.assertEqual(fields['input_image_1'][1], base64.b64decode(ref))
        self.assertEqual((fields['width'][1], fields['height'][1]), ('768', '1024'))
        self.assertEqual(response.provider_used, 'cloudflare')
        self.assertEqual(response.model_used, KLEIN)
        self.assertEqual(response.images[0].mime_type, 'image/png')
        self.assertTrue(response.images[0].data_url.startswith('data:image/png;base64,'))

    def test_klein_text_only_still_uses_multipart(self):
        self.provider.generate_images(api_key='cf-secret', prompt='sprite', model=KLEIN)
        self.assertIn('files', self.post.call_args.kwargs)
        self.assertNotIn('json', self.post.call_args.kwargs)

    def test_schnell_rejects_each_reference_before_network(self):
        for references in ({'image': png_b64()}, {'reference_image_2': png_b64()}):
            with self.subTest(references=references), self.assertRaisesRegex(ValueError, 'tham chiếu'):
                self.provider.generate_images(api_key='cf-secret', prompt='sprite', model=SCHNELL, **references)
        self.post.assert_not_called()

    def test_schnell_json_and_jpeg_output(self):
        with Image.new('RGB', (16, 16)) as image, io.BytesIO() as buffer:
            image.save(buffer, format='JPEG')
            self.post.return_value.json.return_value['result']['image'] = base64.b64encode(buffer.getvalue()).decode('ascii')
        result = self.provider.generate_images(api_key='cf-secret', prompt='sprite', model=SCHNELL)
        self.assertEqual(self.post.call_args.kwargs['json'], {'prompt': 'sprite'})
        self.assertEqual(result.images[0].mime_type, 'image/jpeg')

    def test_rejects_invalid_reference_and_unknown_model_before_network(self):
        for kwargs in ({'image': 'invalid'}, {'model': '@cf/unknown'}):
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                self.provider.generate_images(api_key='cf-secret', prompt='sprite', **kwargs)
        self.post.assert_not_called()

    def test_oversized_references_fit_without_cropping_and_are_reported(self):
        result = self.provider.generate_images(api_key='cf-secret', prompt='sprite', image=png_b64((1022, 1022)))
        raw = dict(self.post.call_args.kwargs['files'])['input_image_0'][1]
        with Image.open(io.BytesIO(raw)) as image:
            self.assertEqual(image.size, (511, 511))
            self.assertEqual(image.getpixel((0, 0)), (20, 40, 60, 255))
        self.assertIn('511', result.message)

    def test_multiple_images_use_individual_requests_and_unique_ids(self):
        result = self.provider.generate_images(api_key='cf-secret', prompt='sprite', number_of_images=2)
        self.assertEqual(self.post.call_count, 2)
        self.assertEqual(len({image.id for image in result.images}), 2)

    def test_http_and_quota_errors_never_fallback_or_retry(self):
        for status in (400, 401, 403, 429, 500):
            with self.subTest(status=status):
                self.post.reset_mock()
                self.post.return_value.status_code = status
                with patch('backend.providers.image_gen.OpenAiDalleProvider.generate_images') as openai, \
                     patch('backend.providers.image_gen.GeminiImagenProvider.generate_images') as gemini:
                    with self.assertRaises((ValueError, RuntimeError)) as error:
                        self.provider.generate_images(api_key='cf-secret', prompt='sprite')
                    self.assertIn(str(status), str(error.exception))
                    self.assertNotIn('cf-secret', str(error.exception))
                    self.post.assert_called_once()
                    openai.assert_not_called()
                    gemini.assert_not_called()

    def test_timeout_and_invalid_output_fail_cleanly(self):
        self.post.side_effect = httpx.ReadTimeout('cf-secret')
        with self.assertRaises(RuntimeError) as error:
            self.provider.generate_images(api_key='cf-secret', prompt='sprite')
        self.assertNotIn('cf-secret', str(error.exception))
        self.post.side_effect = None
        for payload in ({'success': False}, {'result': {}}, {'result': {'image': 'invalid'}}, []):
            self.post.return_value.json.return_value = payload
            with self.subTest(payload=payload), self.assertRaises(RuntimeError):
                self.provider.generate_images(api_key='cf-secret', prompt='sprite')

    def test_service_preserves_prompt_references_and_post_processing(self):
        ref = png_b64()
        with patch('backend.services.image_gen_service.build_prompt_from_request', return_value='full prompt') as build, \
             patch('backend.services.image_gen_service.load_fixed_reference_image_2_b64', return_value=ref), \
             patch('backend.services.image_gen_service.ImagePostProcessingService.process') as process:
            process.return_value = None
            response = ImageGenService.generate_images(ImageGenRequest(prompt='test', image=ref, native_size_wh=[16, 16]))
        build.assert_called_once()
        process.assert_called_once_with(response.images[0], (16, 16))
        self.assertEqual(dict(self.post.call_args.kwargs['files'])['prompt'][1], 'full prompt')

    def test_cloudflare_environment_does_not_change_openai_and_gemini(self):
        for provider in ('openai', 'gemini'):
            with self.subTest(provider=provider), patch.dict(os.environ, {
                'IMAGE_GEN_PROVIDER': provider, 'IMAGE_GEN_API_KEY': 'selected-key', 'IMAGE_GEN_MODEL': 'selected-model',
            }):
                config = AiCredentialsService.resolve_image_configuration()
                self.assertEqual((config['provider'], config['api_key'], config['model']),
                                 (provider, 'selected-key', 'selected-model'))

    def test_request_model_and_provider_override_environment(self):
        config = AiCredentialsService.resolve_image_configuration(provider='cloudflare', model=SCHNELL)
        self.assertEqual(config['model'], SCHNELL)
        config = AiCredentialsService.resolve_image_configuration(provider='openai', api_key='direct', model='direct-model')
        self.assertEqual((config['provider'], config['api_key'], config['model']), ('openai', 'direct', 'direct-model'))

    def test_generic_model_variable_is_supported_when_cloudflare_model_unset(self):
        with patch.dict(os.environ, {'CLOUDFLARE_MODEL_ID': '', 'IMAGE_GEN_MODEL': SCHNELL}):
            self.assertEqual(AiCredentialsService.resolve_image_configuration()['model'], SCHNELL)

    def test_existing_layout_reference_is_transmitted_within_cloudflare_limit(self):
        from backend.services.reference_image_assets import load_fixed_reference_image_2_b64
        ref = load_fixed_reference_image_2_b64()
        self.assertTrue(ref)
        result = self.provider.generate_images(api_key='cf-secret', prompt='sprite', reference_image_2=ref)
        raw = dict(self.post.call_args.kwargs['files'])['input_image_0'][1]
        with Image.open(io.BytesIO(raw)) as sent:
            self.assertLess(sent.width, 512)
            self.assertLess(sent.height, 512)
        self.assertIn('511', result.message)
