"""Kiểm chứng vòng đời, ngân sách RAM và hủy tác vụ AI Local."""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Đồng bộ và kiểm thử)
# ========================================================
import threading
import time
import unittest
import json
from dataclasses import replace
from contextlib import ExitStack
from unittest.mock import MagicMock, patch

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Tác vụ bất đồng bộ)
# ========================================================
import anyio

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Quản lý tài nguyên)
# ========================================================
from backend.services.ai_runtime_manager import AiRuntimeManager as Manager, SLOT_SPECS, _SlotState

# ========================================================
# 4. CẤU HÌNH & HẰNG SỐ KIỂM THỬ
# ========================================================
# Chỉ giả lập HTTP và tiến trình ngoài, giữ nguyên điều phối thực tế.


class TestLocalAiResources(unittest.TestCase):
    """Bảo vệ các ranh giới tải, sử dụng và giải phóng model."""

    def setUp(self):
        """Cách ly trạng thái manager, không khởi động model thật."""
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.object(Manager, "_states", {k: _SlotState() for k in SLOT_SPECS}))
        self.stack.enter_context(patch.object(Manager, "_ensure_reaper_started"))

    def test_hunyuan_idle_timeout_and_busy_protection(self):
        """Hunyuan rảnh được thu hồi sau 300s nhưng model bận phải còn sống."""
        state = Manager._states["hunyuan_enhancer"]
        proc = state.process = MagicMock()
        proc.poll.return_value = None
        state.last_used_at = 1
        state.active_requests = 1
        self.assertEqual(Manager.reap_idle_slots(now=302), [])
        state.active_requests = 0
        self.assertEqual(Manager.reap_idle_slots(now=300), [])
        self.assertEqual(Manager.reap_idle_slots(now=302), ["hunyuan_enhancer"])
        self.assertIsNone(state.process)

    def test_queue_waits_before_loading_and_cancelled_waiter_never_loads(self):
        """Yêu cầu chờ không được nạp model; hủy phải thoát hàng đợi."""
        from backend.services.local_ai_execution import InferenceQueue
        queue = InferenceQueue(1)
        cancelled = threading.Event()
        entered = threading.Event()
        finished = threading.Event()
        loaded = []

        def waiter():
            """Mượn slot thật qua hàng đợi đang bị chiếm."""
            entered.set()
            try:
                with Manager.use_slot("qwen_chat", cancel_event=cancelled):
                    loaded.append("inference")
            except InterruptedError:
                pass
            finally:
                finished.set()

        with patch.object(Manager, "_inference_gate", queue), patch.object(
            Manager, "ensure_started", side_effect=lambda *a, **k: loaded.append("load")
        ):
            with queue.use():
                worker = threading.Thread(target=waiter)
                worker.start()
                self.assertTrue(entered.wait(1))
                cancelled.set()
                self.assertTrue(finished.wait(1))
                self.assertEqual(loaded, [])
            worker.join(1)
            with Manager.use_slot("qwen_chat"):
                self.assertEqual(Manager._states["qwen_chat"].active_requests, 1)
                with self.assertRaises(RuntimeError):
                    Manager.stop_slot("qwen_chat")
            self.assertEqual(Manager._states["qwen_chat"].active_requests, 0)

    def test_ram_eviction_is_lru_and_rechecks_available_memory(self):
        """Không cộng RSS giả định; chỉ nạp khi RAM thực sự đủ sau thu hồi."""
        for key, used in [("hunyuan_enhancer", 10), ("qwen_chat", 20)]:
            state = Manager._states[key]
            state.process = MagicMock()
            state.process.poll.return_value = None
            state.last_used_at = used
        order = []
        def terminate(state):
            """Mô phỏng tiến trình thoát và ghi nhận thứ tự thu hồi."""
            order.append(state.last_used_at)
            state.process = None
        with patch.object(Manager, "get_memory_snapshot", side_effect=[
            {"available_mb": 100}, {"available_mb": 200}, {"available_mb": 7000}
        ]), patch.object(Manager, "_terminate_state_locked", side_effect=terminate):
            Manager._evict_idle_slots_for_ram_locked("bge_m3_embedding", 6000)
        self.assertEqual(order, [10, 20])

    def test_failed_start_cleans_up_its_process(self):
        """Lỗi health sau Popen không được để lại tiến trình giữ RAM."""
        proc = MagicMock()
        proc.poll.return_value = None
        with patch.object(Manager, "_probe_health", side_effect=["offline", RuntimeError("health failed")]), patch(
            "pathlib.Path.is_file", return_value=True
        ), patch.object(Manager, "get_memory_snapshot", return_value={"available_mb": 32000}), patch(
            "backend.services.ai_runtime_manager.subprocess.Popen", return_value=proc
        ):
            with self.assertRaisesRegex(RuntimeError, "health failed"):
                Manager.ensure_started("qwen_chat")
        self.assertIsNone(Manager._states["qwen_chat"].process)
        proc.terminate.assert_called_once()

    def test_start_timeout_and_cancellation_only_clean_owned_process(self):
        """Timeout/hủy dọn tiến trình mới; không dừng server bên ngoài."""
        for external, cancel in [(False, False), (False, True), (True, True)]:
            with self.subTest(external=external, cancel=cancel):
                state = Manager._states["qwen_chat"] = _SlotState()
                proc = MagicMock(pid=99999999)
                proc.poll.return_value = None
                event = threading.Event()
                spec = replace(SLOT_SPECS["qwen_chat"], start_timeout_seconds=0.02)
                def health(*args, **kwargs):
                    """Mô phỏng server đang nạp và tín hiệu hủy sau lần thăm dò đầu."""
                    if cancel:
                        event.set()
                    return "loading" if external else "offline"
                with patch.dict(SLOT_SPECS, qwen_chat=spec), patch.object(
                    Manager, "_probe_health", side_effect=health
                ), patch("pathlib.Path.is_file", return_value=True), patch.object(
                    Manager, "get_memory_snapshot", return_value={"available_mb": 32000}
                ), patch("backend.services.ai_runtime_manager.subprocess.Popen", return_value=proc):
                    expected = InterruptedError if cancel else TimeoutError
                    with self.assertRaises(expected):
                        Manager.ensure_started("qwen_chat", cancel_event=event)
                self.assertIsNone(state.process)
                if external or cancel:
                    # Tín hiệu hủy được kiểm tra trước Popen nên không tạo tiến trình dư.
                    proc.terminate.assert_not_called()
                else:
                    proc.terminate.assert_called_once()

    def test_concurrent_starts_do_not_duplicate_process(self):
        """Hai lời gọi start đồng thời chỉ tạo một tiến trình model."""
        proc = MagicMock(pid=99999999)
        proc.poll.return_value = None
        spawned = threading.Event()
        release = threading.Event()
        errors = []
        def spawn(*args, **kwargs):
            """Giữ lượt tải đầu để lượt thứ hai phải chờ."""
            spawned.set()
            return proc
        def probe(*args, **kwargs):
            """Chỉ trả sẵn sàng sau khi tiến trình được cho phép nạp xong."""
            if not spawned.is_set():
                return "offline"
            release.wait(1)
            return "ready"
        def start():
            """Thu lỗi ở worker để không bỏ sót lỗi đồng bộ."""
            try:
                Manager.ensure_started("qwen_chat")
            except BaseException as exc:
                errors.append(exc)
        with patch.object(Manager, "_probe_health", side_effect=probe), patch(
            "pathlib.Path.is_file", return_value=True
        ), patch.object(Manager, "get_memory_snapshot", return_value={"available_mb": 32000}), patch(
            "backend.services.ai_runtime_manager.subprocess.Popen", side_effect=spawn
        ) as popen:
            threads = [threading.Thread(target=start) for _ in range(2)]
            for thread in threads:
                thread.start()
            self.assertTrue(spawned.wait(1))
            release.set()
            for thread in threads:
                thread.join(2)
                self.assertFalse(thread.is_alive())
            self.assertEqual(errors, [])
            popen.assert_called_once()

    def test_cancel_during_loading_stops_new_process(self):
        """Hủy sau Popen phải dừng tiến trình mới trước khi trả lượt tải."""
        event = threading.Event()
        proc = MagicMock(pid=99999999)
        proc.poll.return_value = None
        probes = []
        def health(*args, **kwargs):
            """Chỉ gửi hủy sau khi vòng chờ model bắt đầu."""
            probes.append(True)
            if len(probes) == 1:
                return "offline"
            event.set()
            return "loading"
        with patch.object(Manager, "_probe_health", side_effect=health), patch(
            "pathlib.Path.is_file", return_value=True
        ), patch.object(Manager, "get_memory_snapshot", return_value={"available_mb": 32000}), patch(
            "backend.services.ai_runtime_manager.subprocess.Popen", return_value=proc
        ):
            with self.assertRaises(InterruptedError):
                Manager.ensure_started("qwen_chat", cancel_event=event)
        proc.terminate.assert_called_once()
        self.assertIsNone(Manager._states["qwen_chat"].process)

    def test_insufficient_ram_never_spawns_or_evicts_busy_model(self):
        """Thiếu RAM không được nạp thêm hoặc dừng model đang xử lý."""
        busy = Manager._states["hunyuan_enhancer"]
        busy.process = MagicMock()
        busy.process.poll.return_value = None
        busy.active_requests = 1
        with patch.object(Manager, "_probe_health", return_value="offline"), patch(
            "pathlib.Path.is_file", return_value=True
        ), patch.object(Manager, "get_memory_snapshot", return_value={"available_mb": 100}), patch(
            "backend.services.ai_runtime_manager.subprocess.Popen"
        ) as popen:
            with self.assertRaises(MemoryError):
                Manager.ensure_started("qwen_chat")
        popen.assert_not_called()
        busy.process.terminate.assert_not_called()

    def test_stream_close_holds_cpu_until_http_finishes(self):
        """Hủy stream không được nhả model/CPU khi server còn đang sinh."""
        from backend.services.local_prompt_enhancer_service import LocalPromptEnhancerService
        from backend.services.offline_chat.offline_chat_service import OfflineChatService
        for slot, build in [
            ("hunyuan_enhancer", lambda: LocalPromptEnhancerService.stream_enhance_prompt("Robot")),
            ("qwen_chat", lambda: OfflineChatService.stream_llm_answer([{"role": "user", "content": "Robot"}])),
        ]:
            with self.subTest(slot=slot):
                draining, release, closed = threading.Event(), threading.Event(), threading.Event()
                def lines(**kwargs):
                    """Server chỉ hoàn tất sau khi ca kiểm thử cho phép."""
                    yield 'data: ' + json.dumps({"choices": [{"delta": {"content": "Character: A small blue robot with silver hands."}}]})
                    draining.set()
                    release.wait(2)
                    yield "data: [DONE]"
                response = MagicMock(status_code=200)
                response.iter_lines.side_effect = lines
                response.close.side_effect = closed.set
                with patch.object(Manager, "_probe_health", return_value="ready"), patch(
                    "requests.post", return_value=response
                ):
                    iterator = build()
                    self.assertTrue(next(iterator))
                    worker = threading.Thread(target=iterator.close)
                    worker.start()
                    try:
                        self.assertTrue(draining.wait(1))
                        self.assertEqual(Manager._states[slot].active_requests, 1)
                        self.assertFalse(closed.is_set())
                        with self.assertRaises(RuntimeError):
                            Manager.stop_slot(slot)
                    finally:
                        release.set()
                        worker.join(2)
                    self.assertFalse(worker.is_alive())
                    self.assertTrue(closed.is_set())
                    self.assertEqual(Manager._states[slot].active_requests, 0)

    def test_http_failure_waits_for_owned_process_before_releasing_cpu(self):
        """HTTP timeout không được nhả lượt trước khi tiến trình không chắc trạng thái đã thoát."""
        proc = MagicMock(pid=99999999)
        proc.poll.return_value = None
        state = Manager._states["qwen_chat"]
        state.process = proc
        waiting, release = threading.Event(), threading.Event()
        def wait(**kwargs):
            """Giữ tiến trình ở giai đoạn dừng để quan sát quyền sở hữu lượt CPU."""
            waiting.set()
            release.wait(2)
        proc.wait.side_effect = wait
        errors = []
        def fail():
            """Mô phỏng service mất kết nối khi server vẫn đang xử lý."""
            try:
                with Manager.use_slot("qwen_chat"):
                    raise RuntimeError("HTTP timeout")
            except RuntimeError as exc:
                errors.append(str(exc))
        with patch.object(Manager, "ensure_started"), patch(
            "requests.get", return_value=MagicMock(status_code=200, json=lambda: [{"is_processing": True}])
        ):
            worker = threading.Thread(target=fail)
            worker.start()
            try:
                self.assertTrue(waiting.wait(0.5))
                self.assertEqual(state.active_requests, 1)
            finally:
                release.set()
                worker.join(2)
        self.assertFalse(worker.is_alive())
        self.assertEqual(errors, ["HTTP timeout"])
        self.assertIsNone(state.process)
        self.assertEqual(state.active_requests, 0)

    def test_embedding_http_error_preserves_detail_and_closes_response(self):
        """Lỗi BGE dạng văn bản vẫn giữ HTTP/detail và không rò response."""
        from backend.services.offline_chat.rag.embedding_service import EmbeddingService
        response = MagicMock(status_code=500, text="model unavailable")
        response.json.side_effect = ValueError("not JSON")
        with patch.object(Manager, "_probe_health", return_value="ready"), patch(
            "requests.post", return_value=response
        ):
            with self.assertRaisesRegex(RuntimeError, "HTTP 500: model unavailable"):
                EmbeddingService.embed_query("query")
        response.close.assert_called_once()

    def test_parallel_failures_recover_without_killing_valid_work(self):
        """Một lượt lỗi không được giết lượt hợp lệ; nhiều lượt lỗi không chờ nhau vô hạn."""
        from backend.services.local_ai_execution import InferenceQueue
        for both_fail in [False, True]:
            with self.subTest(both_fail=both_fail):
                state = Manager._states["qwen_chat"] = _SlotState()
                proc = state.process = MagicMock(pid=99999999)
                proc.poll.return_value = None
                barrier = threading.Barrier(2)
                first_failed, valid_done = threading.Event(), threading.Event()
                errors = []
                def run(index):
                    """Đồng bộ hai tác vụ trước khi mô phỏng lỗi HTTP."""
                    try:
                        with Manager.use_slot("qwen_chat"):
                            barrier.wait(1)
                            if index == 0:
                                first_failed.set()
                                raise RuntimeError("failed")
                            first_failed.wait(1)
                            if both_fail:
                                raise RuntimeError("failed")
                            time.sleep(0.05)
                            proc.terminate.assert_not_called()
                            valid_done.set()
                    except RuntimeError:
                        pass
                    except BaseException as exc:
                        errors.append(exc)
                busy = MagicMock(status_code=200)
                busy.json.return_value = [{"is_processing": True}]
                busy.__enter__.return_value = busy
                with patch.object(Manager, "_inference_gate", InferenceQueue(2)), patch.object(
                    Manager, "ensure_started"
                ), patch("requests.get", return_value=busy):
                    threads = [threading.Thread(target=run, args=(index,)) for index in [0, 1]]
                    for thread in threads:
                        thread.start()
                    for thread in threads:
                        thread.join(2)
                        self.assertFalse(thread.is_alive())
                self.assertEqual(errors, [])
                self.assertEqual(valid_done.is_set(), not both_fail)
                self.assertIsNone(state.process)
                self.assertEqual(state.active_requests, 0)
                self.assertEqual(state.failed_requests, 0)
                proc.terminate.assert_called_once()

    def test_explicit_start_cannot_replace_recovering_process(self):
        """Nút start không được tạo tiến trình mới trong lúc lượt cũ đang dọn lỗi."""
        Manager._states["qwen_chat"].failed_requests = 1
        with patch("backend.services.ai_runtime_manager.subprocess.Popen") as popen:
            with self.assertRaisesRegex(RuntimeError, "đang được dọn"):
                Manager.ensure_started("qwen_chat")
        popen.assert_not_called()

    def test_cancelled_async_step_waits_for_worker_to_finish(self):
        """Hủy coroutine không được trả quyền suy luận khi worker vẫn đang chạy."""
        from backend.services.local_ai_execution import inference_cancel_event
        from backend.api.local_ai_stream import run_local_ai_step
        started = threading.Event()
        finished = threading.Event()
        async_done = threading.Event()
        cancelled = threading.Event()

        def work():
            """Mô phỏng HTTP cần thời gian kết thúc sau tín hiệu hủy."""
            started.set()
            cancelled.wait(2)
            time.sleep(0.05)
            finished.set()

        async def scenario():
            """Hủy nhóm tác vụ rồi xác nhận worker đã được thu hồi."""
            token = inference_cancel_event.set(cancelled)
            try:
                async with anyio.create_task_group() as group:
                    async def caller():
                        """Đánh dấu khi lời gọi bất đồng bộ thực sự thoát."""
                        try:
                            await run_local_ai_step(work)
                        finally:
                            self.assertTrue(finished.is_set())
                            async_done.set()
                    group.start_soon(caller)
                    while not started.is_set():
                        await anyio.sleep(0.005)
                    group.cancel_scope.cancel()
            finally:
                inference_cancel_event.reset(token)
        anyio.run(scenario)
        self.assertTrue(async_done.is_set())

    def test_send_disconnect_closes_stream_in_same_context(self):
        """Lỗi send giữa hai yield vẫn phải đóng generator và khôi phục ngữ cảnh."""
        from backend.api.local_ai_stream import LocalAiStreamingResponse, local_ai_stream
        from backend.services.local_ai_execution import inference_cancel_event
        closed = []
        @local_ai_stream
        async def body():
            """Mô phỏng stream đang giữ tài nguyên tại thời điểm send lỗi."""
            try:
                yield "token"
            finally:
                closed.append(True)
        async def scenario():
            """Ngắt kênh gửi sau khi generator đã phát nội dung đầu tiên."""
            async def send(message):
                """Giả lập lỗi truyền dữ liệu đến trình duyệt."""
                if message["type"] == "http.response.body":
                    raise OSError("disconnected")
            with self.assertRaises(OSError):
                await LocalAiStreamingResponse(body()).stream_response(send)
            self.assertEqual(closed, [True])
            self.assertIsNone(inference_cancel_event.get())
        anyio.run(scenario)

    def test_cancelled_chat_finalizes_after_closing_worker(self):
        """Hủy coroutine phải lưu trạng thái cancelled sau khi worker đóng xong."""
        from backend.api.v1.offline_chat_stream import build_offline_chat_sse_response
        from backend.services.offline_chat.offline_chat_service import OfflineChatService
        service = MagicMock()
        service.detect_chitchat_reply.return_value = None
        service.prepare_rag_context.return_value = MagicMock(status="ok", chunks=[])
        service.build_prompt_messages.return_value = ([], [])
        entered, closed = threading.Event(), threading.Event()
        def tokens():
            """Giữ worker đọc token đủ lâu để nhận hủy từ coroutine."""
            try:
                entered.set()
                time.sleep(0.05)
                yield "token"
            finally:
                closed.set()
        service.stream_llm_answer.side_effect = lambda messages: tokens()
        async def scenario():
            """Hủy nhóm trong lúc next() đang chạy ở thread khác."""
            response = build_offline_chat_sse_response(service, MagicMock(), None, 1, "query", {
                "session": {"id": 1}, "assistant_message_id": 2, "history": []
            }, None, None)
            async with anyio.create_task_group() as group:
                async def consume():
                    """Tiêu thụ stream như một kết nối SSE bình thường."""
                    async for _ in response.body_iterator:
                        pass
                group.start_soon(consume)
                while not entered.is_set():
                    await anyio.sleep(0.005)
                group.cancel_scope.cancel()
        with patch.object(Manager, "get_slot_status", return_value={"ready": True}), patch(
            "backend.api.v1.offline_chat_stream.ai_chat_concurrency.release"
        ):
            anyio.run(scenario)
        self.assertTrue(closed.is_set())
        service.finalize_conversation_turn.assert_called_once()
        self.assertEqual(service.finalize_conversation_turn.call_args.kwargs["status"], "cancelled")


if __name__ == "__main__":
    unittest.main()
