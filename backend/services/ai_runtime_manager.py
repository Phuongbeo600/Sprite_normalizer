"""
Module: backend.services.ai_runtime_manager
Mục đích: Điều phối vòng đời và tài nguyên (RAM, tiến trình, idle timeout) cho các mô hình AI Local.
Ai gọi nó: `EmbeddingService`, `OfflineChatService`, endpoint `/api/offline-chat/*`, và `backend.main` khi tắt server.
Tại sao tồn tại: Tải lười (lazy load) Qwen3.5-4B (8081) và BGE-M3 (8082) khi cần, chống khởi động trùng,
               bảo vệ slot đang xử lý yêu cầu, tự giải phóng khi rảnh quá lâu hoặc thiếu RAM.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Hệ thống, Tiến trình & Đồng bộ)
# ========================================================
from contextlib import contextmanager
from dataclasses import dataclass
import logging
import os
from pathlib import Path
import subprocess
import sys
import threading
import time
from typing import Any, Dict, Iterator, Optional, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# psutil: Đo dung lượng RAM khả dụng của máy và mức RSS của tiến trình llama-server
import psutil
# requests: Thăm dò endpoint /health trên các cổng AI Local
import requests

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# LocalPromptEnhancerService: Đọc trạng thái tham khảo của Hunyuan 7B (cổng 8080), không can thiệp hành vi
from backend.services.local_prompt_enhancer_service import (
    LLAMA_SERVER_EXE,
    LocalPromptEnhancerService,
    PROJECT_ROOT,
)

# ========================================================
# 4. CẤU HÌNH & HẰNG SỐ HỆ THỐNG (Runtime Slot Specs)
# ========================================================
logger = logging.getLogger(__name__)

# Ngưỡng RAM trống an toàn tối thiểu sau khi nạp thêm mô hình (MB)
MIN_FREE_RAM_MB = int(os.getenv("LOCAL_AI_MIN_FREE_RAM_MB", "1024"))
START_TIMEOUT_SECONDS = float(os.getenv("OFFLINE_AI_START_TIMEOUT", "60"))
IDLE_SWEEP_INTERVAL_SECONDS = 15.0


@dataclass(frozen=True)
class RuntimeSlotSpec:
    """Đặc tả cấu hình khởi chạy và ước lượng tài nguyên cho một slot llama-server cục bộ."""

    slot_id: str
    display_name: str
    model_path: Path
    host: str
    port: int
    context_size: int
    ngl: int
    estimated_ram_mb: int
    idle_timeout_seconds: float
    extra_args: Tuple[str, ...] = ()
    reasoning_off: bool = False
    use_jinja: bool = False


@dataclass
class _SlotState:
    """Trạng thái runtime nội bộ của một slot đang được quản lý."""

    process: Optional[subprocess.Popen] = None
    active_requests: int = 0
    last_used_at: float = 0.0
    last_error: str = ""
    starting: bool = False


SLOT_SPECS: Dict[str, RuntimeSlotSpec] = {
    "qwen_chat": RuntimeSlotSpec(
        slot_id="qwen_chat",
        display_name="Qwen3.5-4B (Q4_K_M)",
        model_path=PROJECT_ROOT / "models" / "rag_chatbot" / "llm" / "Qwen3.5-4B-Q4_K_M.gguf",
        host=os.getenv("OFFLINE_CHAT_AI_HOST", "127.0.0.1").strip() or "127.0.0.1",
        port=int(os.getenv("OFFLINE_CHAT_AI_PORT", "8081")),
        context_size=int(os.getenv("OFFLINE_CHAT_CTX", "4096")),
        ngl=int(os.getenv("OFFLINE_CHAT_NGL", "0")),
        estimated_ram_mb=3400,
        idle_timeout_seconds=float(os.getenv("OFFLINE_CHAT_IDLE_TIMEOUT", "600")),
        reasoning_off=True,
        use_jinja=True,
    ),
    "bge_m3_embedding": RuntimeSlotSpec(
        slot_id="bge_m3_embedding",
        display_name="BGE-M3 Embedding (Q8_0)",
        model_path=PROJECT_ROOT / "models" / "rag_chatbot" / "embedding" / "bge-m3-q8_0.gguf",
        host=os.getenv("OFFLINE_EMBED_AI_HOST", "127.0.0.1").strip() or "127.0.0.1",
        port=int(os.getenv("OFFLINE_EMBED_AI_PORT", "8082")),
        context_size=int(os.getenv("OFFLINE_EMBED_CTX", "8192")),
        ngl=int(os.getenv("OFFLINE_EMBED_NGL", "0")),
        estimated_ram_mb=950,
        idle_timeout_seconds=float(os.getenv("OFFLINE_EMBED_IDLE_TIMEOUT", "180")),
        extra_args=("--embeddings", "--pooling", "cls"),
    ),
}


class AiRuntimeManager:
    """
    Bộ điều phối tài nguyên và tiến trình AI Local dùng chung cho hệ thống RAG Offline.
    - Hỗ trợ Lazy Loading, Idle Timeout, theo dõi RAM thực tế (psutil), khóa chống trùng tiến trình,
      bảo vệ request đang chạy và Graceful Shutdown khi Backend dừng.
    """

    _lock = threading.RLock()
    _inference_gate = threading.Semaphore(1)
    _states: Dict[str, _SlotState] = {slot_id: _SlotState() for slot_id in SLOT_SPECS}
    _reaper_stop_event = threading.Event()
    _reaper_thread: Optional[threading.Thread] = None

    @staticmethod
    def get_memory_snapshot() -> Dict[str, Any]:
        """Đọc thông số RAM hệ thống hiện tại tính theo MB."""
        vm = psutil.virtual_memory()
        return {
            "total_mb": round(vm.total / (1024 * 1024), 1),
            "available_mb": round(vm.available / (1024 * 1024), 1),
            "used_percent": round(float(vm.percent), 1),
        }

    @classmethod
    def _get_slot_spec(cls, slot_id: str) -> RuntimeSlotSpec:
        """Lấy cấu hình đặc tả hợp lệ của slot hoặc ném KeyError rõ nghĩa."""
        if slot_id not in SLOT_SPECS:
            raise ValueError(f"Không tìm thấy cấu hình slot AI Local: {slot_id}")
        return SLOT_SPECS[slot_id]

    @classmethod
    def get_base_url(cls, slot_id: str) -> str:
        """Trả về địa chỉ HTTP cơ sở của một slot mô hình."""
        spec = cls._get_slot_spec(slot_id)
        return f"http://{spec.host}:{spec.port}"

    @classmethod
    def _probe_health(cls, spec: RuntimeSlotSpec, timeout: float = 1.0) -> str:
        """Thăm dò trạng thái /health của llama-server tại cổng của slot."""
        try:
            resp = requests.get(f"http://{spec.host}:{spec.port}/health", timeout=timeout)
            if resp.status_code == 200:
                return "ready"
            if resp.status_code == 503:
                return "loading"
            return "offline"
        except requests.RequestException:
            return "offline"

    @classmethod
    def _is_process_alive(cls, state: _SlotState) -> bool:
        """Kiểm tra tiến trình con do manager khởi tạo còn hoạt động hay đã thoát."""
        if state.process is None:
            return False
        if state.process.poll() is not None:
            state.process = None
            return False
        return True

    @classmethod
    def _process_rss_mb(cls, state: _SlotState) -> Optional[float]:
        """Đo lượng RAM vật lý (RSS) thực tế của tiến trình slot nếu đang chạy."""
        if not cls._is_process_alive(state):
            return None
        try:
            rss = psutil.Process(state.process.pid).memory_info().rss
            return round(rss / (1024 * 1024), 1)
        except (psutil.NoSuchProcess, psutil.AccessDenied, OSError):
            return None

    @classmethod
    def _ensure_reaper_started(cls) -> None:
        """Khởi tạo luồng nền quét giải phóng các model nhàn rỗi quá ngưỡng idle_timeout."""
        if cls._reaper_thread is not None and cls._reaper_thread.is_alive():
            return
        cls._reaper_stop_event.clear()
        cls._reaper_thread = threading.Thread(
            target=cls._idle_reaper_loop,
            name="ai-runtime-idle-reaper",
            daemon=True,
        )
        cls._reaper_thread.start()

    @classmethod
    def _idle_reaper_loop(cls) -> None:
        """Định kỳ kiểm tra và giải phóng các slot rảnh không còn phục vụ request."""
        while not cls._reaper_stop_event.wait(IDLE_SWEEP_INTERVAL_SECONDS):
            try:
                cls.reap_idle_slots()
            except Exception:
                logger.exception("[AiRuntime] Lỗi trong vòng quét giải phóng idle timeout.")

    @classmethod
    def reap_idle_slots(cls, now: Optional[float] = None) -> list[str]:
        """Giải phóng các slot đang nhàn rỗi vượt quá thời gian idle_timeout_seconds."""
        current = time.monotonic() if now is None else now
        stopped_slots: list[str] = []
        with cls._lock:
            for slot_id, spec in SLOT_SPECS.items():
                state = cls._states[slot_id]
                if not cls._is_process_alive(state):
                    continue
                if state.active_requests > 0 or state.starting:
                    continue
                if state.last_used_at > 0 and (current - state.last_used_at) >= spec.idle_timeout_seconds:
                    logger.info("[AiRuntime] Tự động giải phóng slot %s do không sử dụng quá %.0fs.", slot_id, spec.idle_timeout_seconds)
                    cls._terminate_state_locked(state)
                    stopped_slots.append(slot_id)
        return stopped_slots

    @classmethod
    def _terminate_state_locked(cls, state: _SlotState) -> bool:
        """Kết thúc an toàn tiến trình của một slot (phải được gọi khi đang giữ _lock)."""
        proc = state.process
        state.process = None
        state.starting = False
        if proc is None or proc.poll() is not None:
            return False
        proc.terminate()
        try:
            proc.wait(timeout=5.0)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=3.0)
        return True

    @classmethod
    def _evict_idle_slots_for_ram_locked(cls, target_slot_id: str, required_mb: int) -> None:
        """Nếu RAM trống chưa đủ ngưỡng an toàn, lần lượt giải phóng các slot nhàn rỗi khác."""
        mem = cls.get_memory_snapshot()
        if mem["available_mb"] >= required_mb:
            return

        # Ưu tiên giải phóng slot nhàn rỗi lâu nhất trước
        candidates = []
        for slot_id, state in cls._states.items():
            if slot_id == target_slot_id:
                continue
            if cls._is_process_alive(state) and state.active_requests == 0 and not state.starting:
                candidates.append((state.last_used_at, slot_id, state))
        candidates.sort(key=lambda item: item[0])

        for _, other_id, other_state in candidates:
            logger.info("[AiRuntime] RAM trống (%.0f MB) thấp; giải phóng slot rảnh %s.", mem["available_mb"], other_id)
            cls._terminate_state_locked(other_state)
            mem = cls.get_memory_snapshot()
            if mem["available_mb"] >= required_mb:
                return

        if mem["available_mb"] < required_mb:
            spec = SLOT_SPECS[target_slot_id]
            raise MemoryError(
                f"Không đủ RAM trống để nạp {spec.display_name}: cần khoảng {required_mb} MB "
                f"(gồm {MIN_FREE_RAM_MB} MB dự phòng), hiện chỉ còn {mem['available_mb']:.0f} MB khả dụng."
            )

    @classmethod
    def _build_launch_command(cls, spec: RuntimeSlotSpec) -> list[str]:
        """Tạo danh sách tham số dòng lệnh khởi chạy llama-server cho slot tương ứng."""
        cmd = [str(LLAMA_SERVER_EXE), "-m", str(spec.model_path)]
        if spec.use_jinja:
            cmd.append("--jinja")
        if spec.reasoning_off:
            cmd.extend(["--reasoning", "off"])
        cmd.extend([
            "-ngl", str(spec.ngl),
            "-c", str(spec.context_size),
            "--host", spec.host,
            "--port", str(spec.port),
            *spec.extra_args,
        ])
        return cmd

    @classmethod
    def ensure_started(cls, slot_id: str) -> Dict[str, Any]:
        """
        Khởi động lười (lazy load) slot mô hình theo yêu cầu; không khởi tạo trùng tiến trình.

        @param {str} slot_id Mã slot ('qwen_chat' hoặc 'bge_m3_embedding').
        @returns {Dict[str, Any]} Trạng thái sẵn sàng của slot vừa nạp.
        """
        spec = cls._get_slot_spec(slot_id)
        with cls._lock:
            state = cls._states[slot_id]
            probe = cls._probe_health(spec)
            if probe == "ready":
                state.last_used_at = time.monotonic()
                state.last_error = ""
                return cls.get_slot_status(slot_id)

            if not cls._is_process_alive(state) and probe == "offline":
                if not LLAMA_SERVER_EXE.is_file():
                    msg = f"Không tìm thấy tệp thực thi AI Local tại: {LLAMA_SERVER_EXE}"
                    state.last_error = msg
                    raise FileNotFoundError(msg)
                if not spec.model_path.is_file():
                    msg = f"Không tìm thấy tệp mô hình GGUF tại: {spec.model_path}"
                    state.last_error = msg
                    raise FileNotFoundError(msg)

                cls._evict_idle_slots_for_ram_locked(slot_id, spec.estimated_ram_mb + MIN_FREE_RAM_MB)
                cmd = cls._build_launch_command(spec)
                creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0
                logger.info("[AiRuntime] Khởi chạy %s trên %s:%s", spec.display_name, spec.host, spec.port)
                state.starting = True
                state.last_error = ""
                try:
                    state.process = subprocess.Popen(
                        cmd,
                        cwd=str(LLAMA_SERVER_EXE.parent),
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        creationflags=creationflags,
                    )
                except Exception as exc:
                    state.starting = False
                    state.last_error = str(exc)
                    raise
                cls._ensure_reaper_started()

            proc_ref = state.process

        # Chờ /health sẵn sàng ngoài lock để không chặn kiểm tra trạng thái các slot khác
        deadline = time.monotonic() + START_TIMEOUT_SECONDS
        try:
            while time.monotonic() < deadline:
                if proc_ref is not None and proc_ref.poll() is not None:
                    exit_code = proc_ref.returncode
                    with cls._lock:
                        state.process = None
                        state.starting = False
                        state.last_error = f"{spec.display_name} thoát bất ngờ khi khởi động (mã {exit_code})."
                    raise RuntimeError(state.last_error)

                if cls._probe_health(spec, timeout=1.0) == "ready":
                    with cls._lock:
                        state.starting = False
                        state.last_used_at = time.monotonic()
                        state.last_error = ""
                    logger.info("[AiRuntime] %s đã sẵn sàng tại cổng %s.", spec.display_name, spec.port)
                    return cls.get_slot_status(slot_id)
                time.sleep(0.35)

            with cls._lock:
                cls._terminate_state_locked(state)
                state.last_error = f"Quá thời gian chờ ({int(START_TIMEOUT_SECONDS)}s) để nạp {spec.display_name}."
            raise TimeoutError(state.last_error)
        except Exception:
            with cls._lock:
                state.starting = False
            raise

    @classmethod
    def stop_slot(cls, slot_id: str, force: bool = False) -> Dict[str, Any]:
        """Giải phóng slot khỏi RAM; từ chối nếu đang phục vụ request (trừ khi force=True)."""
        spec = cls._get_slot_spec(slot_id)
        with cls._lock:
            state = cls._states[slot_id]
            if state.active_requests > 0 and not force:
                raise RuntimeError(f"Không thể tắt {spec.display_name} khi đang xử lý yêu cầu.")
            cls._terminate_state_locked(state)
            return cls.get_slot_status(slot_id)

    @classmethod
    def shutdown_all(cls) -> None:
        """Dừng luồng nền và giải phóng toàn bộ slot AI Local đang chạy khi tắt Backend."""
        cls._reaper_stop_event.set()
        with cls._lock:
            for slot_id, state in cls._states.items():
                if cls._is_process_alive(state):
                    logger.info("[AiRuntime] Giải phóng slot %s khi tắt hệ thống.", slot_id)
                    cls._terminate_state_locked(state)

    @classmethod
    @contextmanager
    def use_slot(cls, slot_id: str, serialize_inference: bool = True) -> Iterator[str]:
        """
        Mượn một slot để xử lý tác vụ RAG/Chat:
        - Lazy-load nếu chưa chạy.
        - Giữ active_requests > 0 để không bị idle reaper hoặc RAM eviction tắt ngang.
        - Tuỳ chọn xếp hàng tuần tự qua _inference_gate để tránh tranh chấp băng thông CPU/RAM.
        """
        cls.ensure_started(slot_id)
        with cls._lock:
            state = cls._states[slot_id]
            state.active_requests += 1
            state.last_used_at = time.monotonic()

        acquired_gate = False
        try:
            if serialize_inference:
                acquired_gate = cls._inference_gate.acquire(timeout=180.0)
                if not acquired_gate:
                    raise TimeoutError("Hết thời gian chờ lượt xử lý AI Local trên CPU.")
            yield cls.get_base_url(slot_id)
        finally:
            if acquired_gate:
                cls._inference_gate.release()
            with cls._lock:
                state = cls._states[slot_id]
                state.active_requests = max(0, state.active_requests - 1)
                state.last_used_at = time.monotonic()

    @classmethod
    def get_slot_status(cls, slot_id: str) -> Dict[str, Any]:
        """Lấy thông tin trạng thái chuẩn hóa của một slot ('unloaded' | 'loading' | 'ready' | 'error')."""
        spec = cls._get_slot_spec(slot_id)
        with cls._lock:
            state = cls._states[slot_id]
            managed_alive = cls._is_process_alive(state)
            probe = cls._probe_health(spec, timeout=0.6)
            rss_mb = cls._process_rss_mb(state) if managed_alive else None

            if probe == "ready":
                status_code = "ready"
                msg = f"{spec.display_name} đã sẵn sàng trên cổng {spec.port}."
            elif probe == "loading" or state.starting or managed_alive:
                status_code = "loading"
                msg = f"Đang nạp {spec.display_name} vào RAM..."
            elif state.last_error:
                status_code = "error"
                msg = state.last_error
            else:
                status_code = "unloaded"
                msg = f"{spec.display_name} chưa khởi động (tiết kiệm RAM)."

            return {
                "slot_id": spec.slot_id,
                "model_name": spec.display_name,
                "model_exists": spec.model_path.is_file(),
                "port": spec.port,
                "status": status_code,
                "running": probe in ("ready", "loading") or managed_alive,
                "ready": probe == "ready",
                "active_requests": state.active_requests,
                "rss_mb": rss_mb,
                "message": msg,
            }

    @classmethod
    def get_all_status(cls) -> Dict[str, Any]:
        """Tổng hợp trạng thái các slot RAG (8081, 8082), Hunyuan tham khảo (8080) và RAM khả dụng."""
        try:
            hunyuan = LocalPromptEnhancerService.get_status()
        except Exception as exc:
            hunyuan = {"running": False, "ready": False, "port": 8080, "message": str(exc)}

        return {
            "memory": cls.get_memory_snapshot(),
            "slots": {
                "qwen_chat": cls.get_slot_status("qwen_chat"),
                "bge_m3_embedding": cls.get_slot_status("bge_m3_embedding"),
                "hunyuan_enhancer": hunyuan,
            },
        }
