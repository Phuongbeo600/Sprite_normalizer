"""Timeout, malformed response and HTTP error mapping without external requests."""
import io
import base64
import unittest
from unittest.mock import Mock, patch
import httpx
from PIL import Image
from fastapi import HTTPException
from backend.providers.image_gen import OpenAiDalleProvider, GeminiImagenProvider
from backend.providers.image_gen.base import ImageGenRequestError, ImageGenUpstreamError
from backend.api.v1.image_gen import generate_image
from backend.schemas.image_gen import ImageGenRequest, ImageGenResponse, GeneratedImageItem
from backend.services.image_gen_service import ImageGenService


class TestImageGenerationErrors(unittest.TestCase):
    def test_provider_network_failures_are_typed_and_have_finite_timeouts(self):
        for provider in (OpenAiDalleProvider(), GeminiImagenProvider()):
            for error, status in [(httpx.ReadTimeout('secret'), 504), (httpx.ConnectError('secret'), 502)]:
                with self.subTest(provider=type(provider).__name__, status=status), patch('backend.providers.image_gen.base._post', side_effect=error) as post:
                    with self.assertRaises(ImageGenUpstreamError) as caught:
                        provider.generate_images(api_key='secret', prompt='sprite', model='configured')
                    self.assertEqual(caught.exception.status_code, status)
                    self.assertNotIn('secret', str(caught.exception))
                    timeout = post.call_args.kwargs['timeout']
                    self.assertTrue(all(0 < t <= 60 for t in timeout))
                    post.assert_called_once()

    def test_all_json_paths_reject_invalid_shapes(self):
        for provider in (OpenAiDalleProvider(), GeminiImagenProvider()):
            for payload in ([], {'data': [None]}, {'predictions': [None]}):
                response = Mock(status_code=200, text='')
                response.json.return_value = payload
                with self.subTest(provider=type(provider).__name__, payload=payload), patch('backend.providers.image_gen.base._post', return_value=response):
                    with self.assertRaises((ImageGenUpstreamError, RuntimeError)):
                        provider.generate_images(api_key='secret', prompt='sprite', model='configured')

    def test_gemini_generate_content_quota_is_not_hidden_by_predict_fallback(self):
        missing = Mock(status_code=404, text='not found')
        quota = Mock(status_code=429, text='quota')
        with patch('backend.providers.image_gen.base._post', side_effect=[missing, quota]):
            with self.assertRaises(ImageGenRequestError) as caught:
                GeminiImagenProvider().generate_images(api_key='secret', prompt='sprite', model='configured')
        self.assertEqual(caught.exception.status_code, 429)

    def test_route_maps_typed_errors_and_releases_concurrency_slot(self):
        from backend.core.load_control import ai_gen_concurrency
        for error in (ImageGenUpstreamError('timeout', 504), ImageGenUpstreamError('network', 502), ImageGenRequestError('quota', 429)):
            before = ai_gen_concurrency.active_count
            with patch.object(ImageGenService, 'generate_images', side_effect=error):
                with self.assertRaises(HTTPException) as caught:
                    generate_image(ImageGenRequest(prompt='sprite'), current_user=None, db=None)
            self.assertEqual(caught.exception.status_code, error.status_code)
            self.assertEqual(ai_gen_concurrency.active_count, before)

    def test_service_rejects_fake_image_before_post_processing(self):
        item = GeneratedImageItem(id='bad', b64_data='aW1hZ2U=', data_url='data:image/png;base64,aW1hZ2U=')
        response = ImageGenResponse(provider_used='openai', model_used='configured', images=[item])
        with patch('backend.services.image_gen_service.AiCredentialsService.resolve_image_configuration', return_value={
            'api_key': 'secret', 'provider': 'openai', 'base_url': None, 'model': 'configured'}), \
             patch('backend.services.image_gen_service.load_fixed_reference_image_2_b64', return_value=None), \
             patch('backend.services.image_gen_service.build_prompt_from_request', return_value='prompt'), \
             patch('backend.services.image_gen_service.ImageGenProviderFactory.get_provider') as factory, \
             patch('backend.services.image_gen_service.ImagePostProcessingService.process') as process:
            factory.return_value.generate_images.return_value = response
            with self.assertRaises(ImageGenUpstreamError):
                ImageGenService.generate_images(ImageGenRequest(prompt='sprite'))
            process.assert_not_called()

    def test_fallback_does_not_reset_network_budget(self):
        failed = Mock(status_code=500, text='server error')
        with patch('backend.providers.image_gen.base._post', return_value=failed) as post, \
             patch('backend.providers.image_gen.base.time.monotonic', side_effect=[0, 0, 70, 121]):
            with self.assertRaises(ImageGenUpstreamError) as caught:
                GeminiImagenProvider().generate_images(api_key='secret', prompt='sprite')
        self.assertEqual(caught.exception.status_code, 504)
        post.assert_called_once()

    def test_missing_model_in_status_resolves_provider_default(self):
        config = {'api_key': 'secret', 'provider': 'openai', 'base_url': None, 'model': None, 'config_source': 'system'}
        with patch('backend.services.image_gen_service.AiCredentialsService.resolve_image_configuration', return_value=config):
            self.assertEqual(ImageGenService.get_status()['model'], OpenAiDalleProvider.DEFAULT_MODEL)

    def test_real_transport_cancels_trickling_response_and_releases_slot(self):
        import threading
        import time
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
        from backend.providers.image_gen.base import BaseImageGenProvider
        from backend.core.load_control import ai_gen_concurrency

        connected = threading.Event()
        class SlowHandler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass
            def do_GET(self):
                connected.set()
                self.send_response(200)
                self.send_header('Content-Length', '200')
                self.end_headers()
                try:
                    for _ in range(200):
                        self.wfile.write(b'x')
                        self.wfile.flush()
                        time.sleep(0.03)
                except OSError:
                    pass
        server = ThreadingHTTPServer(('127.0.0.1', 0), SlowHandler)
        server_thread = threading.Thread(target=server.serve_forever, daemon=True)
        server_thread.start()
        before = ai_gen_concurrency.active_count
        started = time.monotonic()
        try:
            with self.assertRaises(ImageGenUpstreamError) as caught:
                with ai_gen_concurrency:
                    BaseImageGenProvider._request('GET', f'http://127.0.0.1:{server.server_port}/',
                        deadline=started + 0.8, label='local test')
            elapsed = time.monotonic() - started
            self.assertTrue(connected.is_set(), 'Test must reach the actual streaming server')
            self.assertEqual(caught.exception.status_code, 504)
            self.assertLess(elapsed, 2.0, 'Read inactivity must not extend the overall deadline')
            self.assertEqual(ai_gen_concurrency.active_count, before)
        finally:
            server.shutdown()
            server.server_close()
            server_thread.join(timeout=2)

    def test_real_transport_preserves_multipart_fields_and_reference_bytes(self):
        import threading
        import time
        from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
        from backend.providers.image_gen.base import BaseImageGenProvider
        received = []
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass
            def do_POST(self):
                received.append((self.headers.get('Content-Type'), self.rfile.read(int(self.headers['Content-Length']))))
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'{"success":true}')
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            response = BaseImageGenProvider._request('POST', f'http://127.0.0.1:{server.server_port}/',
                files=[('prompt', (None, 'knight')), ('input_image_0', ('reference.png', b'original-reference', 'image/png'))],
                deadline=time.monotonic() + 5, label='local test')
            self.assertTrue(response.json()['success'])
            self.assertIn('multipart/form-data; boundary=', received[0][0])
            self.assertIn(b'name="prompt"', received[0][1])
            self.assertIn(b'original-reference', received[0][1])
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

    def test_slow_dns_does_not_hold_request_after_deadline(self):
        import socket
        import threading
        import time
        from backend.providers.image_gen.base import BaseImageGenProvider
        completed = threading.Event()
        def slow_dns(*args, **kwargs):
            try:
                time.sleep(1.2)
                raise socket.gaierror('test DNS unavailable')
            finally:
                completed.set()
        try:
            with patch('socket.getaddrinfo', side_effect=slow_dns) as dns:
                started = time.monotonic()
                with self.assertRaises(ImageGenUpstreamError) as caught:
                    BaseImageGenProvider._request('GET', 'http://localhost:9/',
                        deadline=started + 0.3, label='local DNS test')
                self.assertTrue(dns.called)
                self.assertEqual(caught.exception.status_code, 504)
                self.assertLess(time.monotonic() - started, 0.9)
        finally:
            completed.wait(timeout=2)
