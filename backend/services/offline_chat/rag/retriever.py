"""
Module: backend.services.offline_chat.rag.retriever
Mục đích: Truy xuất các đoạn tài liệu liên quan nhất bằng NumPy Cosine Similarity, có lọc trùng lặp và ngữ cảnh nối tiếp.
Ai gọi nó: `OfflineRagService` trong mỗi lượt hỏi đáp của Chatbot Offline.
Tại sao tồn tại: Cô lập logic xử lý truy vấn nối tiếp, tính tương đồng vector và lọc Top-K chunk sạch cho LLM.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Cấu trúc, Chuỗi & Môi trường)
# ========================================================
from dataclasses import dataclass, field
import os
import re
from typing import Any, Dict, List, Optional, Sequence

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# numpy: Tính tích vô hướng giữa ma trận vector chuẩn hóa L2 và vector câu hỏi
import numpy as np

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Embedding & Indexer)
# ========================================================
from backend.services.offline_chat.rag.embedding_service import EmbeddingService

# ========================================================
# 4. CẤU HÌNH & HẰNG SỐ HỆ THỐNG (Retrieval Defaults)
# ========================================================
# Cấu hình khởi đầu Top-K (3-5 đoạn) và ngưỡng tương đồng có thể hiệu chỉnh qua biến môi trường.
# Lưu ý: Ngưỡng mặc định 0.42 chỉ là giá trị khởi tạo ban đầu, không mặc định là tối ưu tuyệt đối khi chưa đo thực tế.
DEFAULT_TOP_K = int(os.getenv("OFFLINE_RAG_TOP_K", "4"))
DEFAULT_SIMILARITY_THRESHOLD = float(os.getenv("OFFLINE_RAG_MIN_SCORE", "0.42"))

_FOLLOWUP_PATTERNS = re.compile(
    r"\b(nó|cái đó|phần đó|bước đó|vừa rồi|ở trên|như trên|thế còn|còn lại|"
    r"chi tiết hơn|cụ thể hơn|giải thích thêm|giải thích rõ|tại sao|vì sao|ví dụ|"
    r"tiếp theo|sau đó|it|that|this|those|more|details|explain)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class RetrievedChunk:
    """Một đoạn tài liệu được truy xuất kèm metadata và điểm tương đồng Cosine."""

    chunk_id: str
    doc_path: str
    title: str
    content: str
    score: float


@dataclass
class RetrievalResult:
    """Kết quả trọn vẹn của một lượt truy xuất kho tri thức."""

    status: str  # 'ok' | 'empty_kb' | 'no_relevant_docs'
    retrieval_query: str
    chunks: List[RetrievedChunk] = field(default_factory=list)


def build_retrieval_query(
    query: str,
    history: Optional[Sequence[Dict[str, str]]] = None,
) -> str:
    """
    Ghép ngữ cảnh câu hỏi trước đó khi câu hỏi hiện tại mang tính nối tiếp hoặc đại từ thay thế,
    tránh gọi thêm một lượt LLM riêng mà vẫn giữ đúng chủ đề truy xuất.
    """
    clean_query = (query or "").strip()
    if not clean_query or not history:
        return clean_query

    prior_user_turns = [
        (msg.get("content") or "").strip()
        for msg in history
        if (msg.get("role") or "").strip().lower() == "user" and (msg.get("content") or "").strip()
    ]
    if not prior_user_turns:
        return clean_query

    # Nếu lịch sử đã gồm cả câu hỏi hiện tại ở cuối, lùi lại lấy câu hỏi liền trước đó
    last_turn = prior_user_turns[-1]
    if last_turn == clean_query:
        prior_user_turns = prior_user_turns[:-1]
    if not prior_user_turns:
        return clean_query

    prev_question = prior_user_turns[-1]
    word_count = len(clean_query.split())
    is_followup = word_count <= 7 or bool(_FOLLOWUP_PATTERNS.search(clean_query))
    if not is_followup:
        return clean_query

    combined = f"{prev_question[:240]} — {clean_query}"
    return combined[:480]


def _token_set(text: str) -> set[str]:
    """Tách tập từ viết thường để phát hiện các chunk bị trùng nội dung hoặc chồng lấn quá cao."""
    return set(re.findall(r"[\w\u00C0-\u1EF9]+", text.lower()))


def _is_redundant_chunk(candidate_text: str, selected_chunks: List[RetrievedChunk]) -> bool:
    """Kiểm tra chunk ứng viên có trùng lặp phần lớn nội dung với các chunk đã chọn hay không."""
    cand_tokens = _token_set(candidate_text)
    if not cand_tokens:
        return True
    for existing in selected_chunks:
        exist_tokens = _token_set(existing.content)
        if not exist_tokens:
            continue
        overlap = len(cand_tokens & exist_tokens) / max(1, min(len(cand_tokens), len(exist_tokens)))
        if overlap >= 0.85:
            return True
    return False


class DocumentRetriever:
    """Truy xuất Top-K chunk phù hợp nhất từ chỉ mục vector đã chuẩn hóa L2."""

    @staticmethod
    def retrieve_from_vectors(
        query: str,
        vectors: np.ndarray,
        chunks: List[Dict[str, Any]],
        history: Optional[Sequence[Dict[str, str]]] = None,
        top_k: int = DEFAULT_TOP_K,
        similarity_threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
        query_vector: Optional[np.ndarray] = None,
    ) -> RetrievalResult:
        """
        Thực hiện quy trình truy xuất trên tập vector và metadata đã nạp sẵn.

        @param {str} query Câu hỏi mới nhất của người dùng.
        @param {np.ndarray} vectors Ma trận vector (N, dim) đã chuẩn hóa L2.
        @param {List[Dict[str, Any]]} chunks Metadata tương ứng với từng hàng của ma trận vector.
        @param {Optional[Sequence[Dict[str, str]]]} history Lịch sử hội thoại gần nhất phục vụ câu hỏi nối tiếp.
        @param {int} top_k Số lượng đoạn tối đa được chọn.
        @param {float} similarity_threshold Ngưỡng điểm tương đồng tối thiểu để đưa vào prompt.
        @param {Optional[np.ndarray]} query_vector Vector câu hỏi truyền sẵn (chủ yếu dùng khi kiểm thử).
        @returns {RetrievalResult} Trạng thái truy xuất và danh sách chunk xếp hạng giảm dần theo điểm.
        """
        retrieval_query = build_retrieval_query(query, history)
        if len(chunks) == 0 or vectors.size == 0:
            return RetrievalResult(status="empty_kb", retrieval_query=retrieval_query, chunks=[])

        q_vec = query_vector if query_vector is not None else EmbeddingService.embed_query(retrieval_query)
        q_vec = np.asarray(q_vec, dtype=np.float32).reshape(-1)
        if vectors.shape[1] != q_vec.shape[0]:
            raise ValueError(
                f"Kích thước vector truy vấn ({q_vec.shape[0]}) không khớp với chỉ mục ({vectors.shape[1]})."
            )

        # Cả vectors lẫn q_vec đã được chuẩn hóa L2 -> tích vô hướng chính là Cosine Similarity
        scores = vectors @ q_vec
        # Dùng mergesort trên -scores để giữ thứ tự ổn định khi có các đoạn đồng điểm
        ranked_indices = np.argsort(-scores, kind="mergesort")

        selected: List[RetrievedChunk] = []
        seen_ids: set[str] = set()
        safe_top_k = max(1, min(int(top_k), 10))
        min_score = float(similarity_threshold)

        for idx in ranked_indices:
            score = float(scores[int(idx)])
            if score < min_score:
                break
            meta = chunks[int(idx)]
            chunk_id = str(meta.get("chunk_id", ""))
            if chunk_id in seen_ids:
                continue
            content = str(meta.get("content", "")).strip()
            if not content or _is_redundant_chunk(content, selected):
                continue

            seen_ids.add(chunk_id)
            selected.append(
                RetrievedChunk(
                    chunk_id=chunk_id,
                    doc_path=str(meta.get("doc_path", "")),
                    title=str(meta.get("title", "")),
                    content=content,
                    score=round(score, 4),
                )
            )
            if len(selected) >= safe_top_k:
                break

        if not selected:
            return RetrievalResult(status="no_relevant_docs", retrieval_query=retrieval_query, chunks=[])

        return RetrievalResult(status="ok", retrieval_query=retrieval_query, chunks=selected)
