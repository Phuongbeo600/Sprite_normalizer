"""
Module: backend.services.offline_chat.rag.indexer
Mục đích: Quản lý chỉ mục vector NPZ + JSON cho kho tri thức Markdown, hỗ trợ cập nhật tăng dần theo SHA-256.
Ai gọi nó: `OfflineRagService`, `DocumentRetriever`, và API `/api/offline-chat/knowledge/reindex`.
Tại sao tồn tại: Tránh nhúng lại toàn bộ tài liệu khi truy vấn; phát hiện đúng file thêm/sửa/xóa để đồng bộ index.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Tệp, Hash, JSON & Khóa luồng)
# ========================================================
import hashlib
import json
import os
from pathlib import Path
import threading
from typing import Any, Dict, List, Optional, Tuple

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# numpy: Đọc và lưu ma trận vector định dạng .npz nhỏ gọn
import numpy as np

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Chunker & Embedding)
# ========================================================
from backend.services.local_prompt_enhancer_service import PROJECT_ROOT
from backend.services.offline_chat.rag.chunker import (
    DEFAULT_MAX_CHUNK_CHARS,
    DEFAULT_OVERLAP_CHARS,
    chunk_markdown_document,
)
from backend.services.offline_chat.rag.embedding_service import EmbeddingService

# ========================================================
# 4. CẤU HÌNH & HẰNG SỐ HỆ THỐNG (Knowledge & Index Paths)
# ========================================================
INDEX_SCHEMA_VERSION = 1
DEFAULT_KNOWLEDGE_DIR = PROJECT_ROOT / "docs" / "knowledge"
DEFAULT_INDEX_DIR = PROJECT_ROOT / "data" / "offline_rag_index"


def _resolve_knowledge_dir(knowledge_dir: Optional[Path] = None) -> Path:
    if knowledge_dir is not None:
        return Path(knowledge_dir)
    env_dir = os.getenv("OFFLINE_RAG_KNOWLEDGE_DIR", "").strip()
    return Path(env_dir) if env_dir else DEFAULT_KNOWLEDGE_DIR


def _resolve_index_dir(index_dir: Optional[Path] = None) -> Path:
    if index_dir is not None:
        return Path(index_dir)
    env_dir = os.getenv("OFFLINE_RAG_INDEX_DIR", "").strip()
    return Path(env_dir) if env_dir else DEFAULT_INDEX_DIR


class KnowledgeIndexer:
    """
    Quản lý vòng đời chỉ mục vector (NPZ + JSON) cho tài liệu Markdown trong `docs/knowledge/`.
    - Lưu hash SHA-256 từng tài liệu để chỉ embed phần mới thêm hoặc chỉnh sửa.
    - Kiểm tra tính tương thích giữa chỉ mục đã lưu và model Embedding / tham số chunk hiện tại.
    """

    _sync_lock = threading.RLock()

    def __init__(
        self,
        knowledge_dir: Optional[Path] = None,
        index_dir: Optional[Path] = None,
        max_chunk_chars: int = DEFAULT_MAX_CHUNK_CHARS,
        overlap_chars: int = DEFAULT_OVERLAP_CHARS,
    ) -> None:
        self.knowledge_dir = _resolve_knowledge_dir(knowledge_dir)
        self.index_dir = _resolve_index_dir(index_dir)
        self.max_chunk_chars = int(max_chunk_chars)
        self.overlap_chars = int(overlap_chars)
        self.vectors_path = self.index_dir / "vectors.npz"
        self.metadata_path = self.index_dir / "metadata.json"

    def scan_markdown_files(self) -> Dict[str, Tuple[str, str]]:
        """Quét tất cả tệp .md trong thư mục tri thức, trả về map {rel_path: (sha256, text)}."""
        if not self.knowledge_dir.is_dir():
            return {}
        docs: Dict[str, Tuple[str, str]] = {}
        for path in sorted(self.knowledge_dir.rglob("*.md")):
            if not path.is_file():
                continue
            rel = path.relative_to(self.knowledge_dir).as_posix()
            raw_bytes = path.read_bytes()
            doc_hash = hashlib.sha256(raw_bytes).hexdigest()
            text = raw_bytes.decode("utf-8", errors="replace")
            docs[rel] = (doc_hash, text)
        return docs

    def _is_metadata_compatible(self, meta: Dict[str, Any], vector_count: int) -> bool:
        """Kiểm tra metadata đã lưu có khớp model embedding, tham số chunk và số hàng vector không."""
        chunks = meta.get("chunks")
        if not isinstance(chunks, list):
            return False
        if len(chunks) != vector_count:
            return False
        if meta.get("schema_version") != INDEX_SCHEMA_VERSION:
            return False
        if meta.get("embedding_model_id") != EmbeddingService.MODEL_ID:
            return False
        if meta.get("chunk_max_chars") != self.max_chunk_chars:
            return False
        if meta.get("chunk_overlap_chars") != self.overlap_chars:
            return False
        return True

    def load_index(self) -> Tuple[np.ndarray, List[Dict[str, Any]], Dict[str, Any]]:
        """
        Đọc chỉ mục NPZ + JSON hiện có trên đĩa (không gọi Embedding model).

        @returns {Tuple} (ma_trận_vector, danh_sách_chunks, metadata_tổng).
        """
        if not self.metadata_path.is_file() or not self.vectors_path.is_file():
            return np.zeros((0, 0), dtype=np.float32), [], {}

        try:
            meta = json.loads(self.metadata_path.read_text(encoding="utf-8"))
            with np.load(self.vectors_path, allow_pickle=False) as npz_data:
                vectors = np.asarray(npz_data["embeddings"], dtype=np.float32)
        except Exception:
            return np.zeros((0, 0), dtype=np.float32), [], {}

        if vectors.ndim != 2:
            vectors = np.zeros((0, 0), dtype=np.float32) if vectors.size == 0 else vectors.reshape(len(vectors), -1)

        if not self._is_metadata_compatible(meta, int(vectors.shape[0])):
            return np.zeros((0, 0), dtype=np.float32), [], {"incompatible": True, **meta}

        return vectors, meta["chunks"], meta

    def _save_index(
        self,
        vectors: np.ndarray,
        chunks: List[Dict[str, Any]],
        doc_hashes: Dict[str, str],
    ) -> None:
        """Ghi nguyên tử cặp tệp vectors.npz và metadata.json xuống đĩa."""
        self.index_dir.mkdir(parents=True, exist_ok=True)
        arr = np.asarray(vectors, dtype=np.float32)
        if arr.size == 0:
            arr = np.zeros((0, 0), dtype=np.float32)

        tmp_vec = self.index_dir / "vectors.tmp.npz"
        tmp_meta = self.index_dir / "metadata.tmp.json"
        np.savez_compressed(tmp_vec, embeddings=arr)
        meta_payload = {
            "schema_version": INDEX_SCHEMA_VERSION,
            "embedding_model_id": EmbeddingService.MODEL_ID,
            "embedding_dim": int(arr.shape[1]) if arr.ndim == 2 and arr.shape[0] > 0 else 0,
            "chunk_max_chars": self.max_chunk_chars,
            "chunk_overlap_chars": self.overlap_chars,
            "docs": doc_hashes,
            "chunks": chunks,
        }
        tmp_meta.write_text(json.dumps(meta_payload, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp_vec, self.vectors_path)
        os.replace(tmp_meta, self.metadata_path)

    def get_status(self) -> Dict[str, Any]:
        """Kiểm tra nhanh tình trạng kho tri thức và mức độ đồng bộ của chỉ mục hiện tại."""
        current_docs = self.scan_markdown_files()
        vectors, chunks, meta = self.load_index()
        has_index = self.metadata_path.is_file() and self.vectors_path.is_file()
        compatible = not bool(meta.get("incompatible")) if has_index else False
        old_hashes: Dict[str, str] = meta.get("docs", {}) if compatible else {}
        cur_hashes = {path: info[0] for path, info in current_docs.items()}

        needs_sync = (not has_index) or (not compatible) or (old_hashes != cur_hashes)
        return {
            "knowledge_dir": str(self.knowledge_dir),
            "doc_count": len(current_docs),
            "chunk_count": len(chunks) if compatible else 0,
            "embedding_dim": int(vectors.shape[1]) if compatible and vectors.ndim == 2 and vectors.shape[0] > 0 else 0,
            "index_exists": has_index,
            "index_compatible": compatible,
            "needs_sync": needs_sync,
            "embedding_model_id": EmbeddingService.MODEL_ID,
        }

    def sync_index(self, force_rebuild: bool = False) -> Dict[str, Any]:
        """
        Đồng bộ chỉ mục tăng dần: giữ nguyên vector của tài liệu không đổi, xóa tài liệu cũ,
        và chỉ nhúng lại những tài liệu mới thêm hoặc bị sửa nội dung.
        """
        with self._sync_lock:
            current_docs = self.scan_markdown_files()
            cur_hashes = {path: info[0] for path, info in current_docs.items()}

            if not current_docs:
                self._save_index(np.zeros((0, 0), dtype=np.float32), [], {})
                return {
                    "status": "empty",
                    "doc_count": 0,
                    "chunk_count": 0,
                    "added": 0,
                    "updated": 0,
                    "removed": 0,
                    "reused": 0,
                }

            old_vectors, old_chunks, old_meta = self.load_index()
            can_reuse = (
                not force_rebuild
                and bool(old_meta)
                and not old_meta.get("incompatible")
                and old_vectors.ndim == 2
                and len(old_chunks) == old_vectors.shape[0]
            )
            old_hashes: Dict[str, str] = old_meta.get("docs", {}) if can_reuse else {}

            # Gom vị trí chunk cũ theo từng doc_path để tái sử dụng nguyên vector
            old_by_doc: Dict[str, List[Tuple[Dict[str, Any], np.ndarray]]] = {}
            if can_reuse:
                for idx, chunk in enumerate(old_chunks):
                    old_by_doc.setdefault(chunk["doc_path"], []).append((chunk, old_vectors[idx]))

            added = 0
            updated = 0
            reused = 0
            removed = len(set(old_hashes.keys()) - set(cur_hashes.keys()))

            docs_to_embed: List[Tuple[str, List[Dict[str, Any]]]] = []
            reused_chunks_by_doc: Dict[str, List[Tuple[Dict[str, Any], np.ndarray]]] = {}

            for rel_path, (doc_hash, text) in current_docs.items():
                if can_reuse and old_hashes.get(rel_path) == doc_hash and rel_path in old_by_doc:
                    reused_chunks_by_doc[rel_path] = old_by_doc[rel_path]
                    reused += 1
                    continue

                if rel_path in old_hashes:
                    updated += 1
                else:
                    added += 1

                new_chunks = chunk_markdown_document(
                    doc_path=rel_path,
                    markdown_text=text,
                    doc_hash=doc_hash,
                    max_chars=self.max_chunk_chars,
                    overlap_chars=self.overlap_chars,
                )
                if new_chunks:
                    docs_to_embed.append((rel_path, new_chunks))

            # Nếu không có tài liệu nào thay đổi hoặc bị xóa và index đã tương thích -> thoát sớm
            if added == 0 and updated == 0 and removed == 0 and can_reuse:
                return {
                    "status": "up_to_date",
                    "doc_count": len(current_docs),
                    "chunk_count": len(old_chunks),
                    "added": 0,
                    "updated": 0,
                    "removed": 0,
                    "reused": reused,
                }

            newly_embedded_by_doc: Dict[str, List[Tuple[Dict[str, Any], np.ndarray]]] = {}
            if docs_to_embed:
                flat_chunks: List[Dict[str, Any]] = []
                offsets: List[Tuple[str, int, int]] = []
                for rel_path, doc_chunks in docs_to_embed:
                    start = len(flat_chunks)
                    flat_chunks.extend(doc_chunks)
                    offsets.append((rel_path, start, len(flat_chunks)))

                new_matrix = EmbeddingService.embed_texts([c["content"] for c in flat_chunks])
                for rel_path, start, end in offsets:
                    newly_embedded_by_doc[rel_path] = [
                        (flat_chunks[pos], new_matrix[pos]) for pos in range(start, end)
                    ]

            final_chunks: List[Dict[str, Any]] = []
            final_vecs: List[np.ndarray] = []
            for rel_path in current_docs:
                entries = reused_chunks_by_doc.get(rel_path) or newly_embedded_by_doc.get(rel_path) or []
                for chunk_meta, vec in entries:
                    final_chunks.append(chunk_meta)
                    final_vecs.append(vec)

            final_matrix = np.vstack(final_vecs).astype(np.float32) if final_vecs else np.zeros((0, 0), dtype=np.float32)
            self._save_index(final_matrix, final_chunks, cur_hashes)

            return {
                "status": "synced",
                "doc_count": len(current_docs),
                "chunk_count": len(final_chunks),
                "added": added,
                "updated": updated,
                "removed": removed,
                "reused": reused,
            }
