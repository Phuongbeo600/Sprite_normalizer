"""
Module: backend.services.local_prompt_enhancer_service
Mục đích: Quản lý vòng đời máy chủ AI Local (llama-server.exe + Hunyuan PromptEnhancer 7B)
         và phát luồng gợi ý nâng cao mô tả nhân vật qua giao thức tương thích OpenAI SSE.
Ai gọi nó: `backend.api.v1.image_gen` và hook dọn dẹp khi tắt ứng dụng trong `backend.main`.
Tại sao tồn tại: Cho phép người dùng bật/tắt mô hình 4.3 GB ngay trên giao diện web để tiết kiệm RAM,
               đồng thời gò đầu ra chỉ mô tả ngoại hình nhân vật nhằm không phá vỡ Master Prompt Template.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống, Tiến trình, Đường dẫn & Luồng)
# ========================================================
# json: Giải mã từng mảnh dữ liệu JSON từ luồng SSE của llama-server
import json
# os: Đọc biến môi trường cấu hình host/cổng tùy biến
import os
# typing: Khai báo kiểu trả về cho Generator và từ điển trạng thái
from typing import Any, Dict, Generator, Optional

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# requests: Giao tiếp HTTP REST và đọc luồng SSE với llama-server trên cổng 8080
import requests

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không phụ thuộc router, CSDL hay tầng core toán học)
# LocalPromptEnhancerService: Đọc trạng thái tham khảo của Hunyuan 7B (cổng 8080), không can thiệp hành vi
# AiRuntimeManager hiện sở hữu toàn bộ tiến trình; service chỉ ánh xạ trạng thái và xử lý prompt.
from backend.services.ai_runtime_manager import AiRuntimeManager
from backend.services.local_ai_config import (
    PROJECT_ROOT, LLAMA_SERVER_EXE, GGUF_MODEL_PATH, LOCAL_AI_HOST,
    LOCAL_AI_PORT, LOCAL_AI_BASE_URL, LOCAL_MODEL_DISPLAY_NAME,
)
from backend.services.local_ai_execution import check_cancelled

# ========================================================
# 4. CẤU HÌNH & HẰNG SỐ HỆ THỐNG (Config & Constants)
# ========================================================
# Thư mục gốc của dự án Sprite_normalizer
# Đường dẫn tệp thực thi llama-server và tệp trọng số lượng tử hóa GGUF
# Ngưỡng thời gian chờ nạp mô hình 4.3 GB vào RAM và thời gian chờ luồng sinh văn bản
STREAM_TIMEOUT_SECONDS = float(os.getenv("LOCAL_PROMPT_ENHANCER_STREAM_TIMEOUT", "120"))

# Lời nhắc hệ thống ép định dạng 4 dòng ngắn gọn (Character / Physical Appearance / Clothing / Accessories),
# viết dạng văn xuôi không dùng nhãn "Rules:" để tránh model in nhầm thành dòng thứ 5.
SYSTEM_ENHANCE_PROMPT = (
    "You convert a rough character idea into a concise 4-line English character sheet for a 2D pixel art sprite. "
    "Write strictly in English only (never output Chinese or Vietnamese characters), keep each line concise (4 to 14 words), "
    "and describe ONLY the character's design with no background, scenery, floor shadows, camera, lighting, poses, sprite grid, "
    "markdown, XML tags, or extra fields.\n"
    "Output EXACTLY these 4 lines and stop immediately after Accessories:\n"
    "Character: <short role or archetype>.\n"
    "Physical Appearance: <hair, eyes, face, build details>.\n"
    "Clothing: <armor, outfit, materials, main colors>.\n"
    "Accessories: <held items with left/right hand if relevant, headgear, jewelry, or None>."
)

# Cặp ví dụ mẫu (Few-shot) giúp Hunyuan PromptEnhancer 7B bám chặt cấu trúc 4 dòng ngắn gọn
FEW_SHOT_EXAMPLES = (
    {
        "role": "user",
        "content": "Character concept: Cô công chúa trẻ tóc nâu dài mắt to mặc váy hồng",
    },
    {
        "role": "assistant",
        "content": (
            "Character: Young princess.\n"
            "Physical Appearance: Long wavy brown hair, large eyes.\n"
            "Clothing: Pink layered gown, white puff sleeves, dark blue bodice.\n"
            "Accessories: Silver tiara with a blue gem."
        ),
    },
    {
        "role": "user",
        "content": "Character concept: Hiệp sĩ mặc giáp bạc, áo choàng đỏ, cầm kiếm tay phải",
    },
    {
        "role": "assistant",
        "content": (
            "Character: Armored knight.\n"
            "Physical Appearance: Lean athletic build, stern face under visor.\n"
            "Clothing: Silver steel plate armor, tattered crimson cape, dark leather boots.\n"
            "Accessories: Visored steel helmet, steel longsword in right hand."
        ),
    },
)

# Các thẻ nội bộ của Hunyuan PromptEnhancer và nhãn dòng thừa cần loại bỏ khỏi luồng SSE
_STRIP_STREAM_TAGS = ("<answer>", "</answer>", "<think>", "</think>")
_FORBIDDEN_LINE_PREFIXES = ("rules:", "note:")
_MAX_STRUCTURED_LINES = 4

class LocalPromptEnhancerService:
    """
    Dịch vụ điều phối vòng đời máy chủ AI Local (llama-server.exe) trên cổng 8080
    và phát luồng gợi ý nâng cao mô tả nhân vật theo thời gian thực.
    """

    @classmethod
    def get_status(cls) -> Dict[str, Any]:
        """Trả trạng thái Hunyuan theo hợp đồng API hiện có."""
        return AiRuntimeManager.get_hunyuan_status()

    @classmethod
    def start(cls) -> Dict[str, Any]:
        """Ủy quyền tải model cho bộ quản lý vòng đời dùng chung."""
        AiRuntimeManager.ensure_started("hunyuan_enhancer")
        return cls.get_status()

    @classmethod
    def stop(cls) -> Dict[str, Any]:
        """Giải phóng Hunyuan nếu không còn yêu cầu sử dụng model."""
        AiRuntimeManager.stop_slot("hunyuan_enhancer")
        status = cls.get_status()
        if status["running"] and not status["managed_by_backend"]:
            status["message"] = f"Cổng {LOCAL_AI_PORT} đang được mở bởi tiến trình bên ngoài; hãy đóng tiến trình đó để tắt hẳn."
        return status

    @classmethod
    def _build_user_message(cls, prompt: str, style_preset: Optional[str] = None) -> str:
        """Đóng gói yêu cầu đầu vào cho Hunyuan PromptEnhancer theo đúng định dạng gọn nhẹ."""
        clean_prompt = prompt.strip()
        if style_preset and style_preset.strip():
            return (
                f"Character concept: {clean_prompt}\n"
                f"Style context (use only to guide outfit/material details, do not repeat technical tags): "
                f"{style_preset.strip()}"
            )
        return f"Character concept: {clean_prompt}"

    @staticmethod
    def _trailing_tag_prefix_len(text: str) -> int:
        """Tìm độ dài phần đầu của thẻ XML đang bị cắt dở ở cuối bộ đệm stream."""
        max_len = 0
        for tag in _STRIP_STREAM_TAGS:
            limit = min(len(text), len(tag) - 1)
            for size in range(1, limit + 1):
                if text.endswith(tag[:size]) and size > max_len:
                    max_len = size
        return max_len

    @staticmethod
    def _strip_tags_and_eos_char(text: str) -> str:
        """Loại bỏ thẻ nội bộ (<answer>/<think>) và ký tự '$' (lỗi eos_token_id=3 trong GGUF)."""
        cleaned = text
        for tag in _STRIP_STREAM_TAGS:
            cleaned = cleaned.replace(tag, "")
        return cleaned.replace("$", "")

    @classmethod
    def _clean_stream_chunks(cls, raw_chunks: Generator[str, None, None]) -> Generator[str, None, None]:
        """Loại bỏ thẻ thừa, ký tự '$', chặn dòng thứ 5 và nhãn thừa (Rules:/Note:) khi stream SSE."""
        pending = ""
        started = False
        line_count = 0
        awaiting_prefix = False
        pending_newline = False
        max_prefix_len = max(len(prefix) for prefix in _FORBIDDEN_LINE_PREFIXES)

        for chunk in raw_chunks:
            pending = cls._strip_tags_and_eos_char(pending + chunk)
            safe_len = len(pending) - cls._trailing_tag_prefix_len(pending)
            if safe_len <= 0:
                continue
            safe_part, pending = pending[:safe_len], pending[safe_len:]

            if not started:
                safe_part = safe_part.lstrip("\r\n ")
                if not safe_part:
                    continue
                started, line_count, awaiting_prefix = True, 1, True

            while safe_part:
                if awaiting_prefix:
                    lower = safe_part.lstrip(" ").lower()
                    if any(lower.startswith(prefix) for prefix in _FORBIDDEN_LINE_PREFIXES):
                        return
                    if "\n" not in lower and len(lower) < max_prefix_len and any(
                        prefix.startswith(lower) for prefix in _FORBIDDEN_LINE_PREFIXES
                    ):
                        pending = safe_part + pending
                        break
                    if pending_newline:
                        yield "\n"
                        pending_newline = False
                    awaiting_prefix = False

                nl_idx = safe_part.find("\n")
                if nl_idx == -1:
                    yield safe_part
                    break
                if nl_idx > 0:
                    yield safe_part[:nl_idx]
                if line_count >= _MAX_STRUCTURED_LINES:
                    return
                line_count += 1
                pending_newline, awaiting_prefix = True, True
                safe_part = safe_part[nl_idx + 1:]

        tail = cls._strip_tags_and_eos_char(pending).rstrip()
        if not tail or (not started and not tail.lstrip("\r\n ")):
            return
        if awaiting_prefix and any(tail.lstrip(" ").lower().startswith(p) for p in _FORBIDDEN_LINE_PREFIXES):
            return
        if line_count >= _MAX_STRUCTURED_LINES and "\n" in tail:
            tail = tail.split("\n", 1)[0].rstrip()
        if tail:
            if pending_newline:
                yield "\n"
            yield tail

    @classmethod
    def stream_enhance_prompt(
        cls,
        prompt: str,
        style_preset: Optional[str] = None,
        auto_start: bool = True,
    ) -> Generator[str, None, None]:
        """
        Mở luồng SSE tới máy chủ AI Local cổng 8080 và phát từng mảnh văn bản gợi ý theo mẫu 4 dòng.
        Đảm bảo đóng socket ngay khi Generator bị đóng (client bấm Dừng hoặc hủy kết nối).

        @param {str} prompt Mô tả thô của người dùng.
        @param {Optional[str]} style_preset Phong cách tham chiếu tùy chọn.
        @param {bool} auto_start Tự động bật AI Local nếu cổng 8080 đang tắt.
        @returns {Generator[str, None, None]} Luồng từng mảnh chữ sạch (đã bỏ thẻ nội bộ).
        """
        clean_prompt = (prompt or "").strip()
        if not clean_prompt:
            raise ValueError("Vui lòng nhập mô tả nhân vật trước khi nhờ AI Local gợi ý.")

        payload = {
            "model": "promptenhancer-7b",
            "messages": [
                {"role": "system", "content": SYSTEM_ENHANCE_PROMPT},
                *FEW_SHOT_EXAMPLES,
                {"role": "user", "content": cls._build_user_message(clean_prompt, style_preset)},
            ],
            "temperature": 0.15,
            "top_p": 0.85,
            "max_tokens": 140,
            "stop": ["</answer>", "\nRules:", "\nNote:", "\n\n", "$"],
            "stream": True,
        }

        def _chunk_generator() -> Generator[str, None, None]:
            """Giữ lượt CPU và model đến khi HTTP đã hoàn thành và socket đóng."""
            with AiRuntimeManager.use_slot("hunyuan_enhancer", auto_start=auto_start) as base_url:
                check_cancelled()
                try:
                    resp = requests.post(
                        f"{base_url}/v1/chat/completions", json=payload,
                        stream=True, timeout=(10.0, STREAM_TIMEOUT_SECONDS),
                    )
                except requests.RequestException as exc:
                    raise RuntimeError(f"Không thể kết nối tới AI Local trên cổng {LOCAL_AI_PORT}: {exc}") from exc
                raw = None
                try:
                    if resp.status_code != 200:
                        detail = (resp.text or "").strip()[:300]
                        raise RuntimeError(f"AI Local phản hồi HTTP {resp.status_code}: {detail or 'Lỗi không xác định'}")
                    raw = _raw_chunk_generator(resp)
                    for text in cls._clean_stream_chunks(raw):
                        check_cancelled()
                        yield text
                finally:
                    try:
                        # Bộ lọc có thể dừng sớm; chờ server kết thúc trước khi trả lượt CPU.
                        if raw is not None:
                            for _ in raw:
                                pass
                    finally:
                        resp.close()

        def _raw_chunk_generator(resp) -> Generator[str, None, None]:
            """Đọc từng dòng SSE thô từ llama-server và giải phóng socket khi kết thúc."""
            for raw_line in resp.iter_lines(decode_unicode=True):
                if not raw_line:
                    continue
                line = raw_line.strip()
                if not line.startswith("data:"):
                    continue
                data_str = line[5:].strip()
                if data_str == "[DONE]":
                    break
                try:
                    parsed = json.loads(data_str)
                except json.JSONDecodeError:
                    continue
                choices = parsed.get("choices") or []
                if not choices:
                    continue
                delta = choices[0].get("delta") or {}
                content = delta.get("content")
                if content:
                    yield content

        return _chunk_generator()
