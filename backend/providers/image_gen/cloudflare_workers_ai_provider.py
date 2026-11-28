"""Cloudflare Workers AI adapter: JSON FLUX.1 and multipart FLUX.2.

Official schemas and reference image limits:
https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/
https://developers.cloudflare.com/changelog/product/workers-ai/2/
"""

# 1. THƯ VIỆN NỀN TẢNG PYTHON
import base64
import binascii
import io
import os
import re
import time
from uuid import uuid4
from typing import Optional

# 2. THƯ VIỆN BÊN NGOÀI
from PIL import Image, ImageOps

# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
from .base import BaseImageGenProvider, ImageGenUpstreamError
from backend.schemas.image_gen import GeneratedImageItem, ImageGenResponse

# 4. CẤU HÌNH
# Model IDs describe supported wire protocols, not a business-layer default.
MULTIPART_MODELS = {'@cf/black-forest-labs/flux-2-klein-4b'}
JSON_MODELS = {'@cf/black-forest-labs/flux-1-schnell'}
SIZES = {'1:1': (1024, 1024), '3:4': (768, 1024), '4:3': (1024, 768),
         '16:9': (1024, 576), '9:16': (576, 1024)}


class CloudflareWorkersAiProvider(BaseImageGenProvider):
    """Gọi đúng một provider, không thử lại hay chuyển sang provider khác."""

    def generate_images(
        self, api_key: str, prompt: str, negative_prompt: Optional[str] = None,
        aspect_ratio: str = '1:1', number_of_images: int = 1,
        base_url: Optional[str] = None, model: Optional[str] = None,
        image: Optional[str] = None, reference_image_2: Optional[str] = None,
    ) -> ImageGenResponse:
        deadline = time.monotonic() + self.NETWORK_BUDGET_SECONDS
        account = os.getenv('CLOUDFLARE_ACCOUNT_ID', '').strip()
        selected_model = (model or os.getenv('CLOUDFLARE_MODEL_ID', '')).strip()
        if not api_key or not api_key.strip():
            raise ValueError('Chưa cấu hình CLOUDFLARE_API_TOKEN.')
        if not re.fullmatch(r'[a-fA-F0-9]{32}', account):
            raise ValueError('CLOUDFLARE_ACCOUNT_ID phải là Account ID gồm 32 ký tự hexadecimal.')
        if not selected_model:
            raise ValueError('Chưa cấu hình CLOUDFLARE_MODEL_ID hoặc IMAGE_GEN_MODEL.')
        if selected_model not in MULTIPART_MODELS | JSON_MODELS:
            raise ValueError('Cloudflare Model ID chưa có bộ ánh xạ đầu vào được hỗ trợ; '
                             'chọn FLUX.2 klein-4b hoặc FLUX.1 schnell theo tài liệu cấu hình.')
        if aspect_ratio not in SIZES:
            raise ValueError('Cloudflare không hỗ trợ tỉ lệ khung hình đã chọn.')
        if type(number_of_images) is not int or not 1 <= number_of_images <= 4:
            raise ValueError('Số ảnh Cloudflare phải từ 1 đến 4.')
        if not prompt or not prompt.strip():
            raise ValueError('Prompt Cloudflare không được trống.')

        references = [ref for ref in (image, reference_image_2) if ref and ref.strip()]
        multipart = selected_model in MULTIPART_MODELS
        if references and not multipart:
            raise ValueError('Cloudflare FLUX.1 schnell không hỗ trợ ảnh tham chiếu '
                             '(bao gồm ảnh bố cục cố định). Chọn FLUX.2 klein-4b; không bỏ qua ảnh đầu vào.')
        # FLUX has no separate negative_prompt field; retain constraints as text.
        final_prompt = prompt
        if negative_prompt:
            final_prompt += f'\n\n[NEGATIVE CONSTRAINTS / DO NOT INCLUDE]: {negative_prompt}'
        if not multipart and len(final_prompt) > 2048:
            raise ValueError('Cloudflare FLUX.1 schnell giới hạn prompt 2048 ký tự; không tự cắt prompt.')

        reference_files = []
        resized_count = 0
        for index, reference in enumerate(references):
            png, resized = self._reference_png(reference)
            reference_files.append((f'input_image_{index}', (f'reference_{index + 1}.png', png, 'image/png')))
            resized_count += int(resized)

        url = f'https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{selected_model}'
        headers = {'Authorization': f'Bearer {api_key.strip()}'}
        items = []
        for _ in range(number_of_images):
            if multipart:
                width, height = SIZES[aspect_ratio]
                fields = [('prompt', (None, final_prompt)), ('width', (None, str(width))),
                          ('height', (None, str(height))), *reference_files]
                # files forces multipart even for text-only input; requests sets boundary.
                response = self._request('POST', url, headers=headers, files=fields, deadline=deadline, label=f'cloudflare / {selected_model}')
            else:
                if aspect_ratio != '1:1':
                    raise ValueError('Cloudflare FLUX.1 schnell không có tham số tỉ lệ; chỉ hỗ trợ 1:1.')
                response = self._request('POST', url, headers=headers, json={'prompt': final_prompt}, deadline=deadline, label=f'cloudflare / {selected_model}')

            if response.status_code != 200:
                status = response.status_code
                if status in (400, 404, 422):
                    raise ValueError(f'Cloudflare HTTP {status}: model hoặc dữ liệu đầu vào không hợp lệ.')
                # Do not echo upstream bodies or request exceptions containing credentials.
                raise RuntimeError(f'Cloudflare Workers AI HTTP {status}; không chuyển provider.')
            try:
                payload = self._json(response, f'cloudflare / {selected_model}')
                if not isinstance(payload, dict) or payload.get('success') is not True:
                    raise ValueError('Cloudflare không xác nhận thành công.')
                encoded = payload['result']['image']
                mime = self.validate_image(encoded)
            except (KeyError, TypeError, ValueError, binascii.Error, OSError, Image.DecompressionBombError) as exc:
                raise ImageGenUpstreamError('Cloudflare phản hồi nhưng không có ảnh Base64 hợp lệ.') from exc
            items.append(GeneratedImageItem(id=f'cf_{uuid4().hex}', b64_data=encoded, mime_type=mime,
                data_url=f'data:{mime};base64,{encoded}', aspect_ratio=aspect_ratio))

        message = f'Đã tạo {len(items)} ảnh bằng Cloudflare Workers AI.'
        if resized_count:
            message += f' Đã thu {resized_count} ảnh tham chiếu vào khung tối đa 511×511, giữ tỷ lệ và toàn bộ nội dung.'
        return ImageGenResponse(provider_used='cloudflare', model_used=selected_model, images=items, message=message)

    @staticmethod
    def _reference_png(reference: str) -> tuple[bytes, bool]:
        """Đóng gói PNG, giữ toàn ảnh; đáp ứng giới hạn tham chiếu nhỏ hơn 512×512."""
        encoded = reference.split(',', 1)[1] if reference.startswith('data:') and ',' in reference else reference
        try:
            raw = base64.b64decode(''.join(encoded.split()), validate=True)
            with Image.open(io.BytesIO(raw)) as source, ImageOps.exif_transpose(source) as oriented:
                with oriented.convert('RGBA') as rgba, io.BytesIO() as buffer:
                    resized = rgba.width > 511 or rgba.height > 511
                    if resized:
                        rgba.thumbnail((511, 511), Image.Resampling.NEAREST)
                    rgba.save(buffer, format='PNG')
                    return buffer.getvalue(), resized
        except (ValueError, binascii.Error, OSError, Image.DecompressionBombError) as exc:
            raise ValueError('Cloudflare: ảnh tham chiếu không hợp lệ; cần ảnh PNG, JPEG hoặc WebP đọc được.') from exc
