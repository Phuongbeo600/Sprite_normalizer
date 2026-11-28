# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểm thử, Hệ thống & JSON)
# ========================================================
import json
import os
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from contextlib import ExitStack

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
import requests
from fastapi.testclient import TestClient

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (App, Service & Dependency)
# ========================================================
from backend.main import app
from backend.services.local_prompt_enhancer_service import LocalPromptEnhancerService
from backend.services.ai_runtime_manager import AiRuntimeManager, SLOT_SPECS, _SlotState

# ========================================================
# 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
# ========================================================
# (Không áp dụng cho file kiểm thử)


class TestLocalPromptEnhancerService(unittest.TestCase):
    """Kiểm thử vòng đời bật/tắt llama-server và phát luồng SSE của LocalPromptEnhancerService."""

    def setUp(self):
        self.stack = ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(patch.object(AiRuntimeManager, "_states", {k: _SlotState() for k in SLOT_SPECS}))
        self.stack.enter_context(patch.object(AiRuntimeManager, "_ensure_reaper_started"))
        self.stack.enter_context(patch.object(AiRuntimeManager, "get_memory_snapshot", return_value={"available_mb": 32000}))

    @patch("backend.services.local_prompt_enhancer_service.requests.get")
    def test_status_offline_khi_cong_8080_chua_mo(self, mock_get):
        mock_get.side_effect = requests.ConnectionError("Connection refused")
        status = LocalPromptEnhancerService.get_status()
        self.assertFalse(status["running"])
        self.assertFalse(status["ready"])
        self.assertFalse(status["managed_by_backend"])
        self.assertEqual(status["port"], 8080)

    @patch("pathlib.Path.is_file", return_value=False)
    @patch("backend.services.local_prompt_enhancer_service.requests.get")
    def test_start_bao_loi_khi_thieu_tep_chay_hoac_gguf(self, mock_get, _mock_is_file):
        mock_get.side_effect = requests.ConnectionError("offline")
        with self.assertRaises(FileNotFoundError):
            LocalPromptEnhancerService.start()

    @patch("backend.services.ai_runtime_manager.time.sleep", return_value=None)
    @patch("backend.services.ai_runtime_manager.subprocess.Popen")
    @patch("pathlib.Path.is_file", return_value=True)
    @patch("backend.services.local_prompt_enhancer_service.requests.get")
    def test_start_va_stop_quan_ly_tien_trinh_dung_vong_doi(
        self, mock_get, _mock_is_file, mock_popen, _mock_sleep
    ):
        running = [False]
        fake_proc = MagicMock()
        fake_proc.pid = 99999999
        fake_proc.poll.side_effect = lambda: None if running[0] else 0
        def spawn(*args, **kwargs):
            """Mô phỏng tiến trình bắt đầu sở hữu cổng HTTP."""
            running[0] = True
            return fake_proc
        def health(*args, **kwargs):
            """Cổng chỉ sẵn sàng trong thời gian tiến trình còn sống."""
            if not running[0]:
                raise requests.ConnectionError("offline")
            return MagicMock(status_code=200)
        def terminate():
            """Mô phỏng tiến trình giải phóng cổng khi dừng."""
            running[0] = False
        fake_proc.terminate.side_effect = terminate
        mock_get.side_effect = health
        mock_popen.side_effect = spawn

        started = LocalPromptEnhancerService.start()
        self.assertTrue(started["running"])
        self.assertTrue(started["ready"])
        self.assertTrue(started["managed_by_backend"])
        mock_popen.assert_called_once()

        # Đảm bảo nếu wait quá hạn khi tắt sẽ fallback sang kill()
        fake_proc.wait.side_effect = [subprocess.TimeoutExpired(cmd="llama", timeout=5.0), None]
        stopped = LocalPromptEnhancerService.stop()
        fake_proc.terminate.assert_called_once()
        fake_proc.kill.assert_called_once()
        self.assertFalse(stopped["running"])
        self.assertFalse(stopped["ready"])

    @patch("backend.services.local_prompt_enhancer_service.requests.post")
    @patch("backend.services.local_prompt_enhancer_service.requests.get")
    def test_stream_enhance_prompt_boc_tach_sse_va_dong_socket(self, mock_get, mock_post):
        mock_get.return_value = MagicMock(status_code=200)

        sse_lines = [
            'data: {"choices": [{"delta": {"content": "<ans"}}]}',
            'data: {"choices": [{"delta": {"content": "wer>\\nCharacter: Armored knight.\\n"}}]}',
            'data: {"choices": [{"delta": {"content": "Accessories: Steel longsword.</answer>"}}]}',
            "data: [DONE]",
        ]
        fake_resp = MagicMock(status_code=200)
        fake_resp.iter_lines.return_value = iter(sse_lines)
        mock_post.return_value = fake_resp

        gen = LocalPromptEnhancerService.stream_enhance_prompt(
            "Hiệp sĩ mặc giáp bạc", style_preset="16-bit SNES", auto_start=False
        )
        chunks = list(gen)
        self.assertEqual(
            "".join(chunks),
            "Character: Armored knight.\nAccessories: Steel longsword.",
        )
        fake_resp.close.assert_called_once()

        sent_json = mock_post.call_args.kwargs["json"]
        self.assertTrue(sent_json["stream"])
        self.assertEqual(sent_json["messages"][0]["role"], "system")
        self.assertIn("Character:", sent_json["messages"][0]["content"])
        self.assertEqual(sent_json["messages"][-1]["role"], "user")
        self.assertGreaterEqual(len(sent_json["messages"]), 4)
        self.assertLessEqual(sent_json["temperature"], 0.3)
        self.assertEqual(sent_json["max_tokens"], 140)
        self.assertIn("\nRules:", sent_json["stop"])
        self.assertIn("$", sent_json["stop"])

    @patch("backend.services.local_prompt_enhancer_service.requests.post")
    @patch("backend.services.local_prompt_enhancer_service.requests.get")
    def test_stream_chan_dong_rules_va_ky_tu_dollar_o_cuoi(self, mock_get, mock_post):
        """Đảm bảo dòng thừa (Rules:/Note: hoặc dòng thứ 5) và ký tự '$' bị lọc sạch khỏi SSE."""
        mock_get.return_value = MagicMock(status_code=200)
        sse_lines = [
            'data: {"choices": [{"delta": {"content": "Character: Female farmer.\\n"}}]}',
            'data: {"choices": [{"delta": {"content": "Physical Appearance: Sun face.\\n"}}]}',
            'data: {"choices": [{"delta": {"content": "Clothing: Brown linen tunic.\\n"}}]}',
            'data: {"choices": [{"delta": {"content": "Accessories: Straw hat.$\\nRu"}}]}',
            'data: {"choices": [{"delta": {"content": "les: None.$"}}]}',
            "data: [DONE]",
        ]
        fake_resp = MagicMock(status_code=200)
        fake_resp.iter_lines.return_value = iter(sse_lines)
        mock_post.return_value = fake_resp

        out = "".join(
            LocalPromptEnhancerService.stream_enhance_prompt("Cô nông dân", auto_start=False)
        )
        self.assertEqual(
            out,
            "Character: Female farmer.\n"
            "Physical Appearance: Sun face.\n"
            "Clothing: Brown linen tunic.\n"
            "Accessories: Straw hat.",
        )


class TestLocalPromptEnhancerApi(unittest.TestCase):
    """Kiểm thử API Router /api/image-gen/local-enhancer/* và /enhance-prompt/stream."""

    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    @patch("backend.api.v1.image_gen.LocalPromptEnhancerService.get_status")
    def test_api_status_va_start_stop(self, mock_status):
        mock_status.return_value = {
            "running": False,
            "ready": False,
            "managed_by_backend": False,
            "port": 8080,
            "model_name": "Hunyuan PromptEnhancer 7B (Q4_K_M)",
            "message": "AI Local đang tắt",
        }
        res = self.client.get("/api/image-gen/local-enhancer/status")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.json()["running"])

    @patch("backend.api.v1.image_gen.LocalPromptEnhancerService.stream_enhance_prompt")
    @patch("backend.api.v1.image_gen.LocalPromptEnhancerService.start")
    @patch("backend.api.v1.image_gen.LocalPromptEnhancerService.get_status")
    def test_api_stream_tu_bat_va_phat_luong_sse(self, mock_status, mock_start, mock_stream):
        mock_status.return_value = {"running": False, "ready": False}
        mock_start.return_value = {"running": True, "ready": True}
        mock_stream.return_value = iter(["Dark ", "knight"])

        with self.client.stream(
            "POST",
            "/api/image-gen/enhance-prompt/stream",
            json={"prompt": "Hiệp sĩ bóng đêm", "auto_start": True},
        ) as resp:
            self.assertEqual(resp.status_code, 200)
            body = "".join(resp.iter_text())

        mock_start.assert_not_called()
        self.assertTrue(mock_stream.call_args.args[2])
        self.assertIn('"status": "loading_model"', body)
        self.assertIn('"status": "streaming"', body)
        self.assertIn('"text": "Dark "', body)
        self.assertIn('"text": "knight"', body)
        self.assertIn("data: [DONE]", body)


if __name__ == "__main__":
    unittest.main()
