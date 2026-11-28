"""
Module: backend.services.offline_chat.rag.embedding_service
Mục đích: Giao tiếp mô hình BGE-M3 cục bộ qua AiRuntimeManager để tạo vector chuẩn hóa L2.
Ai gọi nó: `KnowledgeIndexer` (lúc cập nhật chỉ mục) và `DocumentRetriever` (lúc nhúng câu hỏi).
Tại sao tồn tại: Cô lập logic gọi endpoint /v1/embeddings và chuẩn hóa vector phục vụ Cosine Similarity.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Môi trường & Kiểu dữ liệu)
# ========================================================
import os
from typing import List

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# numpy: Lưu trữ ma trận float32 và chuẩn hóa L2 cho phép tính Cosine Similarity
import numpy as np
# requests: Gửi batch văn bản tới server BGE-M3 trên cổng 8082
import requests

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# AiRuntimeManager: Nạp lười BGE-M3 khi cần và bảo vệ slot trong suốt thời gian nhúng vector
from backend.services.ai_runtime_manager import AiRuntimeManager
from backend.services.local_ai_execution import check_cancelled

# ========================================================
# 4. CẤU HÌNH & HẰNG SỐ HỆ THỐNG (Embedding Constants)
# ========================================================
EMBEDDING_MODEL_ID = "bge-m3-q8_0"
EMBEDDING_BATCH_SIZE = int(os.getenv("OFFLINE_RAG_EMBED_BATCH_SIZE", "16"))
EMBEDDING_TIMEOUT_SECONDS = float(os.getenv("OFFLINE_RAG_EMBED_TIMEOUT", "120"))


def normalize_vectors(matrix: np.ndarray) -> np.ndarray:
    """Chuẩn hóa L2 từng hàng của ma trận vector để tích vô hướng chính là Cosine Similarity."""
    arr = np.asarray(matrix, dtype=np.float32)
    if arr.size == 0:
        return arr.reshape(0, 0) if arr.ndim < 2 else arr
    if arr.ndim == 1:
        arr = arr.reshape(1, -1)
    norms = np.linalg.norm(arr, axis=1, keepdims=True)
    safe_norms = np.where(norms > 1e-12, norms, 1.0)
    return (arr / safe_norms).astype(np.float32)


class EmbeddingService:
    """Dịch vụ chuyển đổi văn bản thành vector embedding đã chuẩn hóa L2 bằng BGE-M3."""

    MODEL_ID = EMBEDDING_MODEL_ID

    @classmethod
    def embed_texts(cls, texts: List[str]) -> np.ndarray:
        """
        Nhúng danh sách văn bản bằng BGE-M3 cục bộ và trả về ma trận float32 đã chuẩn hóa L2.

        @param {List[str]} texts Danh sách đoạn văn bản cần chuyển sang vector.
        @returns {np.ndarray} Ma trận vector kích thước (len(texts), dim), float32, L2-normalized.
        """
        clean_texts = [t.strip() if isinstance(t, str) and t.strip() else " " for t in texts]
        if not clean_texts:
            return np.zeros((0, 0), dtype=np.float32)

        all_rows: List[List[float]] = []
        batch_size = max(1, EMBEDDING_BATCH_SIZE)

        with AiRuntimeManager.use_slot("bge_m3_embedding") as base_url:
            endpoint = f"{base_url}/v1/embeddings"
            for start in range(0, len(clean_texts), batch_size):
                check_cancelled()
                batch = clean_texts[start : start + batch_size]
                resp = requests.post(
                    endpoint,
                    json={"model": cls.MODEL_ID, "input": batch},
                    timeout=(10.0, EMBEDDING_TIMEOUT_SECONDS),
                )
                try:
                    if resp.status_code != 200:
                        detail = (resp.text or "").strip()[:300]
                        raise RuntimeError(
                            f"Máy chủ BGE-M3 trả lỗi HTTP {resp.status_code}: {detail or 'Lỗi không xác định'}"
                        )
                    payload = resp.json()
                finally:
                    resp.close()
                check_cancelled()
                data = payload.get("data") or []
                if len(data) != len(batch):
                    raise RuntimeError(
                        f"Số vector BGE-M3 trả về ({len(data)}) không khớp số đoạn gửi lên ({len(batch)})."
                    )
                # Sắp xếp đúng theo trường index phòng trường hợp server trả lệch thứ tự
                sorted_items = sorted(data, key=lambda item: item.get("index", 0))
                for item in sorted_items:
                    vec = item.get("embedding")
                    if not isinstance(vec, list) or not vec:
                        raise RuntimeError("Dữ liệu vector từ BGE-M3 không hợp lệ hoặc rỗng.")
                    all_rows.append(vec)

        return normalize_vectors(np.asarray(all_rows, dtype=np.float32))

    @classmethod
    def embed_query(cls, query: str) -> np.ndarray:
        """Nhúng một câu truy vấn đơn lẻ thành vector 1D float32 chuẩn hóa L2."""
        matrix = cls.embed_texts([query])
        return matrix[0]
