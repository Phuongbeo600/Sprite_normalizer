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
from contextlib import contextmanager, nullcontext
from dataclasses import dataclass
# logging: Ghi nhận nhật ký khởi động, tắt tiến trình và lỗi kết nối
import logging
import os
# subprocess: Khởi chạy và tắt tiến trình llama-server.exe cục bộ
import subprocess
# sys: Kiểm tra hệ điều hành Windows để ẩn cửa sổ console phụ
import sys
# threading: Khóa đồng bộ hóa tránh mở trùng nhiều tiến trình ăn tràn RAM
import threading
# time: Đếm thời gian chờ mô hình nạp vào RAM qua endpoint /health
import time
from typing import Any, Dict, Iterator, Optional

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
from backend.services.local_ai_config import LLAMA_SERVER_EXE, SLOT_SPECS, RuntimeSlotSpec
# InferenceQueue: Hàng đợi CPU có hủy, độc lập với logic nghiệp vụ.
from backend.services.local_ai_execution import InferenceQueue, check_cancelled, inference_cancel_event

# ========================================================
# 4. CẤU HÌNH & HẰNG SỐ HỆ THỐNG (Runtime Slot Specs)
# ========================================================
logger = logging.getLogger(__name__)

# Ngưỡng RAM trống an toàn tối thiểu sau khi nạp thêm mô hình (MB)
MIN_FREE_RAM_MB = int(os.getenv("LOCAL_AI_MIN_FREE_RAM_MB", "4096"))
IDLE_SWEEP_INTERVAL_SECONDS = 15.0


@dataclass
class _SlotState:
    """Trạng thái runtime nội bộ của một slot đang được quản lý."""

    process: Optional[subprocess.Popen] = None
    active_requests: int = 0
    last_used_at: float = 0.0
    last_error: str = ""
    starting: bool = False
    failed_requests: int = 0




class AiRuntimeManager:
    """
    Bộ điều phối tài nguyên và tiến trình AI Local dùng chung cho hệ thống RAG Offline.
    - Hỗ trợ Lazy Loading, Idle Timeout, theo dõi RAM thực tế (psutil), khóa chống trùng tiến trình,
      bảo vệ request đang chạy và Graceful Shutdown khi Backend dừng.
    """

    _lock = threading.RLock()
    _inference_gate = InferenceQueue(int(os.getenv("LOCAL_AI_MAX_PARALLEL_INFERENCES", "1")))
    _startup_gate = InferenceQueue(1)
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
        if proc is None or proc.poll() is not None:
            state.process = None
            state.starting = False
            return False
        proc.terminate()
        try:
            proc.wait(timeout=5.0)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=3.0)
        state.process = None
        state.starting = False
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
    def ensure_started(cls, slot_id: str, cancel_event=None, inference_reserved: bool = False) -> Dict[str, Any]:
        """Nạp lười một model, tuần tự hóa khởi động để không dùng trùng ngân sách RAM.

        @param slot_id Mã model trong cấu hình dùng chung.
        @param cancel_event Tín hiệu hủy khi đang chờ hoặc đang nạp.
        @param inference_reserved Lượt CPU đã được use_slot giữ, tránh mượn lồng gây deadlock.
        @returns Trạng thái runtime sau khi model sẵn sàng.
        """
        spec = cls._get_slot_spec(slot_id)
        gate = nullcontext() if inference_reserved else cls._inference_gate.use(cancel_event)
        with gate:
            with cls._startup_gate.use(cancel_event, timeout=spec.start_timeout_seconds):
                check_cancelled(cancel_event)
                return cls._start_slot(spec, cancel_event)

    @classmethod
    def _start_slot(cls, spec: RuntimeSlotSpec, cancel_event=None) -> Dict[str, Any]:
        """Tạo tối đa một tiến trình và chỉ dọn tiến trình do lượt này tạo."""
        created = None
        with cls._lock:
            state = cls._states[spec.slot_id]
            if state.failed_requests:
                raise RuntimeError("Model AI Local đang được dọn sau lỗi HTTP. Vui lòng thử lại.")
            probe = cls._probe_health(spec)
            if probe == "ready":
                state.last_used_at = time.monotonic()
                state.last_error = ""
                return cls.get_slot_status(spec.slot_id)
            try:
                if not cls._is_process_alive(state) and probe == "offline":
                    if not LLAMA_SERVER_EXE.is_file():
                        raise FileNotFoundError(f"Không tìm thấy tệp thực thi AI Local tại: {LLAMA_SERVER_EXE}")
                    if not spec.model_path.is_file():
                        raise FileNotFoundError(f"Không tìm thấy tệp mô hình GGUF tại: {spec.model_path}")
                    cls._evict_idle_slots_for_ram_locked(spec.slot_id, cls._required_ram_mb(spec))
                    check_cancelled(cancel_event)
                    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0
                    state.process = created = subprocess.Popen(
                        cls._build_launch_command(spec), cwd=str(LLAMA_SERVER_EXE.parent),
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=creationflags,
                    )
                    cls._ensure_reaper_started()
                state.starting = True
            except BaseException as exc:
                if created is not None and state.process is created:
                    cls._terminate_state_locked(state)
                state.last_error = str(exc)
                raise
        # Chờ /health sẵn sàng ngoài lock để không chặn kiểm tra trạng thái các slot khác
        try:
            cls._wait_until_ready(spec, state.process, cancel_event)
            with cls._lock:
                state.last_used_at = time.monotonic()
                state.last_error = ""
                state.starting = False
                return cls.get_slot_status(spec.slot_id)
        except BaseException as exc:
            with cls._lock:
                if created is not None and state.process is created:
                    cls._terminate_state_locked(state)
                state.last_error = str(exc)
                state.starting = False
            raise

    @classmethod
    def _required_ram_mb(cls, spec: RuntimeSlotSpec) -> int:
        """Dự toán theo trọng số, context và cấu hình; dùng RAM khả dụng để quyết định nạp."""
        model_mb = spec.model_path.stat().st_size / (1024 * 1024)
        baseline_context = 8192 if spec.slot_id == "bge_m3_embedding" else 4096
        estimate = max(model_mb, spec.estimated_ram_mb * max(1, spec.context_size / baseline_context))
        return int(estimate + MIN_FREE_RAM_MB)

    @classmethod
    def _wait_until_ready(cls, spec, process, cancel_event=None) -> None:
        """Chờ model sẵn sàng với thời hạn và tín hiệu hủy hữu hạn."""
        deadline = time.monotonic() + spec.start_timeout_seconds
        while time.monotonic() < deadline:
            check_cancelled(cancel_event)
            if process is not None and process.poll() is not None:
                raise RuntimeError(f"{spec.display_name} thoát khi khởi động (mã {process.returncode}).")
            if cls._probe_health(spec, timeout=1.0) == "ready":
                check_cancelled(cancel_event)
                return
            event = cancel_event if cancel_event is not None else inference_cancel_event.get()
            if event is not None:
                event.wait(0.35)
            else:
                time.sleep(0.35)
        raise TimeoutError(f"Quá thời gian chờ ({spec.start_timeout_seconds:g}s) để nạp {spec.display_name}.")

    @classmethod
    def stop_slot(cls, slot_id: str, force: bool = False) -> Dict[str, Any]:
        """Giải phóng slot khỏi RAM; từ chối nếu đang phục vụ request (trừ khi force=True)."""
        spec = cls._get_slot_spec(slot_id)
        with cls._lock:
            state = cls._states[slot_id]
            if (state.active_requests > 0 or state.starting) and not force:
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
    def use_slot(cls, slot_id: str, serialize_inference: bool = True, cancel_event=None,
                 auto_start: bool = True) -> Iterator[str]:
        """Mượn model sau khi đến lượt CPU và bảo vệ model đến hết tác vụ.

        @param slot_id Mã model cần sử dụng.
        @param serialize_inference Giữ tương thích; mọi tác vụ đều tuân theo ngân sách CPU chung.
        @param cancel_event Tín hiệu hủy khi chờ hoặc nạp model.
        @param auto_start Cho phép nạp model chưa chạy; giữ hành vi bật/tắt hiện có.
        @returns URL nội bộ của model được bảo vệ khỏi thu hồi.
        """
        cls._get_slot_spec(slot_id)
        with cls._inference_gate.use(cancel_event):
            check_cancelled(cancel_event)
            with cls._lock:
                state = cls._states[slot_id]
                if state.failed_requests:
                    raise RuntimeError("Model AI Local đang được dọn sau lỗi HTTP. Vui lòng thử lại.")
                state.active_requests += 1
                state.last_used_at = time.monotonic()
            try:
                if not auto_start and not cls.get_slot_status(slot_id)["ready"]:
                    raise RuntimeError("AI Local đang tắt. Vui lòng bật model trước.")
                cls.ensure_started(slot_id, cancel_event=cancel_event, inference_reserved=True)
                check_cancelled(cancel_event)
                try:
                    yield cls.get_base_url(slot_id)
                except BaseException:
                    cls._recover_failed_request(slot_id)
                    raise
            finally:
                with cls._lock:
                    state.active_requests -= 1
                    state.last_used_at = time.monotonic()

    @classmethod
    def _recover_failed_request(cls, slot_id: str) -> None:
        """Chờ server rảnh hoặc dừng tiến trình sở hữu khi không còn tác vụ hợp lệ.

        @param slot_id Slot có HTTP lỗi hoặc generator bị đóng giữa chừng.
        @returns None sau khi không còn suy luận không xác định trên tiến trình quản lý.
        """
        with cls._lock:
            state = cls._states[slot_id]
            state.failed_requests += 1
        try:
            while True:
                with cls._lock:
                    if not cls._is_process_alive(state):
                        return
                try:
                    with requests.get(f"{cls.get_base_url(slot_id)}/slots", timeout=1.0) as response:
                        slots = response.json() if response.status_code == 200 else None
                    if isinstance(slots, list) and slots and all(
                        isinstance(slot, dict) and slot.get("is_processing") is False for slot in slots
                    ):
                        return
                except (requests.RequestException, ValueError):
                    pass
                with cls._lock:
                    # Không dừng model nếu vẫn còn request hợp lệ khi mở chạy song song.
                    if state.active_requests == state.failed_requests:
                        cls._terminate_state_locked(state)
                        return
                time.sleep(0.05)
        finally:
            with cls._lock:
                state.failed_requests -= 1

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
        return {
            "memory": cls.get_memory_snapshot(),
            "slots": {
                "qwen_chat": cls.get_slot_status("qwen_chat"),
                "bge_m3_embedding": cls.get_slot_status("bge_m3_embedding"),
                "hunyuan_enhancer": cls.get_hunyuan_status(),
            },
        }

    @classmethod
    def get_hunyuan_status(cls) -> Dict[str, Any]:
        """Ánh xạ trạng thái Hunyuan sang hợp đồng API bật/tắt hiện có."""
        status = cls.get_slot_status("hunyuan_enhancer")
        with cls._lock:
            managed = cls._is_process_alive(cls._states["hunyuan_enhancer"])
        return {
            "running": status["running"], "ready": status["ready"],
            "managed_by_backend": managed, "port": status["port"],
            "model_name": status["model_name"], "message": status["message"],
        }
