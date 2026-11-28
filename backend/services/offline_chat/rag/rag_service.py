"""
Module: backend.services.offline_chat.rag.rag_service
Mục đích: Điều phối đồng bộ tăng dần chỉ mục tri thức và truy xuất ngữ cảnh cho Chatbot Offline.
Ai gọi nó: `OfflineChatService` và các endpoint quản trị tri thức `/api/offline-chat/knowledge/*`.
Tại sao tồn tại: Cung cấp một mặt tiền (Facade) gọn gàng giữa luồng Chat và hai thành phần Indexer + Retriever.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Kiểu dữ liệu)
# ========================================================
from typing import Any, Dict, Optional, Sequence

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không sử dụng)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Indexer & Retriever)
# ========================================================
from backend.services.offline_chat.rag.indexer import KnowledgeIndexer
from backend.services.offline_chat.rag.retriever import (
    DEFAULT_SIMILARITY_THRESHOLD,
    DEFAULT_TOP_K,
    DocumentRetriever,
    RetrievalResult,
)

# ========================================================
# 4. CẤU HÌNH & HẰNG SỐ HỆ THỐNG
# ========================================================
# (Không áp dụng)


class OfflineRagService:
    """Điều phối trạng thái kho tri thức, đồng bộ index tăng dần và truy xuất đoạn văn bản liên quan."""

    def __init__(self, indexer: Optional[KnowledgeIndexer] = None) -> None:
        self.indexer = indexer or KnowledgeIndexer()

    def get_knowledge_status(self) -> Dict[str, Any]:
        """Trả về thống kê hiện tại của kho tài liệu và chỉ mục vector."""
        return self.indexer.get_status()

    def reindex_knowledge(self, force_rebuild: bool = False) -> Dict[str, Any]:
        """Cập nhật tăng dần (hoặc xây dựng lại toàn bộ) chỉ mục vector từ `docs/knowledge/`."""
        return self.indexer.sync_index(force_rebuild=force_rebuild)

    def retrieve_context(
        self,
        query: str,
        history: Optional[Sequence[Dict[str, str]]] = None,
        top_k: int = DEFAULT_TOP_K,
        similarity_threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
    ) -> RetrievalResult:
        """
        Truy xuất Top-K đoạn tài liệu phù hợp; chỉ đồng bộ tăng dần nếu phát hiện tài liệu có thay đổi.
        Không bao giờ re-embed toàn bộ kho tài liệu ở mỗi lượt hỏi.
        """
        status = self.indexer.get_status()
        if status["doc_count"] == 0:
            return RetrievalResult(status="empty_kb", retrieval_query=(query or "").strip(), chunks=[])

        if status["needs_sync"]:
            sync_res = self.indexer.sync_index(force_rebuild=False)
            if sync_res.get("chunk_count", 0) == 0:
                return RetrievalResult(status="empty_kb", retrieval_query=(query or "").strip(), chunks=[])

        vectors, chunks, _ = self.indexer.load_index()
        return DocumentRetriever.retrieve_from_vectors(
            query=query,
            vectors=vectors,
            chunks=chunks,
            history=history,
            top_k=top_k,
            similarity_threshold=similarity_threshold,
        )
