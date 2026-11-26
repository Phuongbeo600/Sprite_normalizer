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
# logging: Ghi nhận nhật ký khởi động, tắt tiến trình và lỗi kết nối
import logging
# os: Đọc biến môi trường cấu hình host/cổng tùy biến
import os
# subprocess: Khởi chạy và tắt tiến trình llama-server.exe cục bộ
import subprocess
# sys: Kiểm tra hệ điều hành Windows để ẩn cửa sổ console phụ
import sys
# threading: Khóa đồng bộ hóa tránh mở trùng nhiều tiến trình ăn tràn RAM
import threading
# time: Đếm thời gian chờ mô hình nạp vào RAM qua endpoint /health
import time
# Path: Xác định đường dẫn tuyệt đối tới tệp thực thi và tệp mô hình GGUF
from pathlib import Path
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

# ========================================================
# 4. CẤU HÌNH & HẰNG SỐ HỆ THỐNG (Config & Constants)
# ========================================================
# Thư mục gốc của dự án Sprite_normalizer
PROJECT_ROOT = Path(__file__).resolve().parents[2]
# Đường dẫn tệp thực thi llama-server và tệp trọng số lượng tử hóa GGUF
LLAMA_SERVER_EXE = PROJECT_ROOT / "tools" / "llama-cpp" / "llama-server.exe"
GGUF_MODEL_PATH = PROJECT_ROOT / "localPromtTess" / "promptenhancer-7b-Q4_K_M.gguf"

LOCAL_AI_HOST = os.getenv("LOCAL_PROMPT_ENHANCER_HOST", "127.0.0.1").strip() or "127.0.0.1"
LOCAL_AI_PORT = int(os.getenv("LOCAL_PROMPT_ENHANCER_PORT", "8080"))
LOCAL_AI_BASE_URL = f"http://{LOCAL_AI_HOST}:{LOCAL_AI_PORT}"
LOCAL_MODEL_DISPLAY_NAME = "Hunyuan PromptEnhancer 7B (Q4_K_M)"

# Ngưỡng thời gian chờ nạp mô hình 4.3 GB vào RAM và thời gian chờ luồng sinh văn bản
START_TIMEOUT_SECONDS = float(os.getenv("LOCAL_PROMPT_ENHANCER_START_TIMEOUT", "60"))
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

logger = logging.getLogger(__name__)


class LocalPromptEnhancerService:
    """
    Dịch vụ điều phối vòng đời máy chủ AI Local (llama-server.exe) trên cổng 8080
    và phát luồng gợi ý nâng cao mô tả nhân vật theo thời gian thực.
    """

    _lock = threading.RLock()
    _process: Optional[subprocess.Popen] = None

    @classmethod
    def _is_managed_process_alive(cls) -> bool:
        """Kiểm tra tiến trình llama-server do Backend khởi tạo có còn đang chạy không."""
        if cls._process is None:
            return False
        if cls._process.poll() is not None:
            cls._process = None
            return False
        return True

    @classmethod
    def _probe_server_state(cls, timeout: float = 1.2) -> str:
        """
        Thăm dò trạng thái endpoint /health của llama-server trên cổng 8080.

        @param {float} timeout Thời gian chờ tối đa cho một lần hỏi sức khỏe.
        @returns {str} 'ready' (sẵn sàng), 'loading' (đang nạp model), hoặc 'offline' (không chạy).
        """
        try:
            resp = requests.get(f"{LOCAL_AI_BASE_URL}/health", timeout=timeout)
            if resp.status_code == 200:
                return "ready"
            if resp.status_code == 503:
                return "loading"
            return "offline"
        except requests.RequestException:
            return "offline"

    @classmethod
    def get_status(cls) -> Dict[str, Any]:
        """
        Lấy trạng thái hiện tại của AI Local (đã bật/đang nạp/đã tắt) để đồng bộ lên UI.

        @returns {Dict[str, Any]} Từ điển khớp LocalEnhancerStatusResponse.
        """
        with cls._lock:
            managed_alive = cls._is_managed_process_alive()
            probe = cls._probe_server_state()

            if probe == "ready":
                msg = (
                    f"AI Local đang sẵn sàng trên cổng {LOCAL_AI_PORT}."
                    if managed_alive
                    else f"Đang kết nối tới AI Local bật sẵn trên cổng {LOCAL_AI_PORT}."
                )
                return {
                    "running": True,
                    "ready": True,
                    "managed_by_backend": managed_alive,
                    "port": LOCAL_AI_PORT,
                    "model_name": LOCAL_MODEL_DISPLAY_NAME,
                    "message": msg,
                }

            if probe == "loading" or managed_alive:
                return {
                    "running": True,
                    "ready": False,
                    "managed_by_backend": managed_alive,
                    "port": LOCAL_AI_PORT,
                    "model_name": LOCAL_MODEL_DISPLAY_NAME,
                    "message": "AI Local đang nạp mô hình 4.3 GB vào RAM, vui lòng chờ...",
                }

            return {
                "running": False,
                "ready": False,
                "managed_by_backend": False,
                "port": LOCAL_AI_PORT,
                "model_name": LOCAL_MODEL_DISPLAY_NAME,
                "message": "AI Local đang tắt (tiết kiệm RAM).",
            }

    @classmethod
    def start(cls) -> Dict[str, Any]:
        """
        Khởi chạy tiến trình llama-server.exe (nếu cổng 8080 chưa bật) và chờ tới khi nạp xong model.

        @returns {Dict[str, Any]} Trạng thái sẵn sàng của AI Local.
        @raises {FileNotFoundError} Khi thiếu tệp llama-server.exe hoặc tệp .gguf.
        @raises {RuntimeError} Khi tiến trình thoát lỗi trong lúc nạp mô hình.
        @raises {TimeoutError} Khi quá thời gian chờ nạp mô hình vào RAM.
        """
        with cls._lock:
            probe = cls._probe_server_state()
            if probe == "ready":
                return cls.get_status()

            if not cls._is_managed_process_alive() and probe == "offline":
                if not LLAMA_SERVER_EXE.is_file():
                    raise FileNotFoundError(
                        f"Không tìm thấy tệp chạy AI Local tại: {LLAMA_SERVER_EXE}"
                    )
                if not GGUF_MODEL_PATH.is_file():
                    raise FileNotFoundError(
                        f"Không tìm thấy tệp mô hình GGUF tại: {GGUF_MODEL_PATH}"
                    )

                cmd = [
                    str(LLAMA_SERVER_EXE),
                    "-m", str(GGUF_MODEL_PATH),
                    "--jinja",
                    "--reasoning", "off",
                    "-ngl", "0",
                    "-c", "4096",
                    "--host", LOCAL_AI_HOST,
                    "--port", str(LOCAL_AI_PORT),
                ]
                creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0
                logger.info(f"[LocalAI] Khởi chạy llama-server trên {LOCAL_AI_BASE_URL}")
                cls._process = subprocess.Popen(
                    cmd,
                    cwd=str(LLAMA_SERVER_EXE.parent),
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    creationflags=creationflags,
                )

            deadline = time.monotonic() + START_TIMEOUT_SECONDS
            while time.monotonic() < deadline:
                if cls._process is not None and cls._process.poll() is not None:
                    exit_code = cls._process.returncode
                    cls._process = None
                    raise RuntimeError(
                        f"Máy chủ AI Local thoát bất ngờ khi nạp mô hình (mã thoát {exit_code})."
                    )
                if cls._probe_server_state(timeout=1.0) == "ready":
                    logger.info(f"[LocalAI] Mô hình đã nạp xong và sẵn sàng tại cổng {LOCAL_AI_PORT}.")
                    return cls.get_status()
                time.sleep(0.4)

            raise TimeoutError(
                f"Quá thời gian chờ ({int(START_TIMEOUT_SECONDS)}s) để AI Local nạp mô hình vào RAM."
            )

    @classmethod
    def stop(cls) -> Dict[str, Any]:
        """
        Tắt tiến trình llama-server.exe do Backend quản lý để giải phóng ngay RAM hệ thống.

        @returns {Dict[str, Any]} Trạng thái sau khi dừng tiến trình.
        """
        with cls._lock:
            stopped_managed = False
            if cls._process is not None:
                proc = cls._process
                cls._process = None
                if proc.poll() is None:
                    logger.info("[LocalAI] Đang tắt tiến trình llama-server để giải phóng RAM...")
                    proc.terminate()
                    try:
                        proc.wait(timeout=5.0)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                        proc.wait(timeout=3.0)
                    stopped_managed = True

            status = cls.get_status()
            if stopped_managed and not status["running"]:
                status["message"] = "Đã tắt AI Local và giải phóng RAM."
            elif status["running"] and not status["managed_by_backend"]:
                status["message"] = (
                    f"Cổng {LOCAL_AI_PORT} đang được mở bởi tiến trình bên ngoài (vd cửa sổ .bat); "
                    "hãy đóng cửa sổ đó để tắt hẳn."
                )
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

        if cls._probe_server_state() != "ready":
            if auto_start:
                cls.start()
            else:
                raise RuntimeError(
                    f"AI Local trên cổng {LOCAL_AI_PORT} đang tắt. Vui lòng bật công tắc AI Local trước."
                )

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

        try:
            resp = requests.post(
                f"{LOCAL_AI_BASE_URL}/v1/chat/completions",
                json=payload,
                stream=True,
                timeout=(10.0, STREAM_TIMEOUT_SECONDS),
            )
        except requests.RequestException as exc:
            raise RuntimeError(f"Không thể kết nối tới AI Local trên cổng {LOCAL_AI_PORT}: {exc}") from exc

        if resp.status_code != 200:
            detail = (resp.text or "").strip()[:300]
            resp.close()
            raise RuntimeError(f"AI Local phản hồi HTTP {resp.status_code}: {detail or 'Lỗi không xác định'}")

        def _raw_chunk_generator() -> Generator[str, None, None]:
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

        def _chunk_generator() -> Generator[str, None, None]:
            """Bọc bộ lọc thẻ thừa quanh luồng thô và luôn đóng socket HTTP ở finally."""
            try:
                yield from cls._clean_stream_chunks(_raw_chunk_generator())
            finally:
                resp.close()

        return _chunk_generator()
