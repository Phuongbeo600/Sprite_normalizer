"""Cấu hình dùng chung cho vòng đời các model AI Local."""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu hình và đường dẫn)
# ========================================================
from dataclasses import dataclass
import os
# Path: Xác định đường dẫn tuyệt đối tới tệp thực thi và tệp mô hình GGUF
from pathlib import Path
from typing import Dict, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI
# ========================================================
# Không cần thư viện bên ngoài để đọc cấu hình model.

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
# ========================================================
# Tách cấu hình khỏi service để manager không phụ thuộc logic prompt.

# ========================================================
# 4. CẤU HÌNH & HẰNG SỐ HỆ THỐNG
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
    start_timeout_seconds: float = 60.0


SLOT_SPECS: Dict[str, RuntimeSlotSpec] = {
    "hunyuan_enhancer": RuntimeSlotSpec(
        slot_id="hunyuan_enhancer",
        display_name=LOCAL_MODEL_DISPLAY_NAME,
        model_path=GGUF_MODEL_PATH,
        host=LOCAL_AI_HOST,
        port=LOCAL_AI_PORT,
        context_size=4096,
        ngl=0,
        estimated_ram_mb=int(os.getenv("LOCAL_PROMPT_ENHANCER_RAM_MB", "8704")),
        idle_timeout_seconds=float(os.getenv("LOCAL_PROMPT_ENHANCER_IDLE_TIMEOUT", "300")),
        reasoning_off=True,
        use_jinja=True,
        start_timeout_seconds=float(os.getenv("LOCAL_PROMPT_ENHANCER_START_TIMEOUT", "60")),
    ),
    "qwen_chat": RuntimeSlotSpec(
        slot_id="qwen_chat",
        display_name="Qwen3.5-4B (Q4_K_M)",
        model_path=PROJECT_ROOT / "models" / "rag_chatbot" / "llm" / "Qwen3.5-4B-Q4_K_M.gguf",
        host=os.getenv("OFFLINE_CHAT_AI_HOST", "127.0.0.1").strip() or "127.0.0.1",
        port=int(os.getenv("OFFLINE_CHAT_AI_PORT", "8081")),
        context_size=int(os.getenv("OFFLINE_CHAT_CTX", "4096")),
        ngl=int(os.getenv("OFFLINE_CHAT_NGL", "0")),
        estimated_ram_mb=int(os.getenv("OFFLINE_CHAT_RAM_MB", "5120")),
        idle_timeout_seconds=float(os.getenv("OFFLINE_CHAT_IDLE_TIMEOUT", "600")),
        start_timeout_seconds=float(os.getenv("OFFLINE_AI_START_TIMEOUT", "60")),
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
        estimated_ram_mb=int(os.getenv("OFFLINE_EMBED_RAM_MB", "1536")),
        idle_timeout_seconds=float(os.getenv("OFFLINE_EMBED_IDLE_TIMEOUT", "180")),
        extra_args=("--embeddings", "--pooling", "cls"),
        start_timeout_seconds=float(os.getenv("OFFLINE_AI_START_TIMEOUT", "60")),
    ),
}

