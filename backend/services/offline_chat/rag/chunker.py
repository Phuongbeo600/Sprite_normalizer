"""
Module: backend.services.offline_chat.rag.chunker
Mục đích: Tách tài liệu Markdown theo cấu trúc tiêu đề, đoạn văn và khối mã.
Ai gọi nó: `KnowledgeIndexer` khi lập chỉ mục kho tri thức `docs/knowledge/`.
Tại sao tồn tại: Bảo toàn ngữ cảnh tiêu đề và mạch ý của đoạn văn, không cắt vụn máy móc theo số từ.
"""

# ========================================================
# 1. THƯ VIỆN NỀN TẢNG PYTHON (Xử lý chuỗi, Hash & Cấu trúc)
# ========================================================
from dataclasses import dataclass
import hashlib
import os
import re
from typing import Any, Dict, List

# ========================================================
# 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
# ========================================================
# (Không phụ thuộc thư viện bên ngoài)

# ========================================================
# 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Internal modules)
# ========================================================
# (Không phụ thuộc các tầng khác)

# ========================================================
# 4. CẤU HÌNH & HẰNG SỐ HỆ THỐNG (Chunk Settings)
# ========================================================
DEFAULT_MAX_CHUNK_CHARS = int(os.getenv("OFFLINE_RAG_CHUNK_MAX_CHARS", "1200"))
DEFAULT_OVERLAP_CHARS = int(os.getenv("OFFLINE_RAG_CHUNK_OVERLAP_CHARS", "180"))
_HEADING_RE = re.compile(r"^(#{1,4})\s+(.+?)\s*$")
_FENCE_RE = re.compile(r"^\s*```")


@dataclass
class _MarkdownSection:
    """Một mục nội dung kèm đường dẫn tiêu đề cha-con trong tài liệu Markdown."""

    title: str
    body: str


def _parse_markdown_sections(markdown_text: str) -> List[_MarkdownSection]:
    """Tách văn bản Markdown thành các mục theo tiêu đề #..####, bỏ qua tiêu đề giả trong khối code."""
    lines = markdown_text.replace("\r\n", "\n").split("\n")
    heading_stack: List[tuple[int, str]] = []
    sections: List[_MarkdownSection] = []
    current_title = "Tổng quan"
    current_lines: List[str] = []
    in_code_fence = False

    def _flush() -> None:
        text_body = "\n".join(current_lines).strip()
        if text_body:
            sections.append(_MarkdownSection(title=current_title, body=text_body))

    for line in lines:
        if _FENCE_RE.match(line):
            in_code_fence = not in_code_fence
            current_lines.append(line)
            continue

        if not in_code_fence:
            match = _HEADING_RE.match(line)
            if match:
                _flush()
                current_lines = []
                level = len(match.group(1))
                heading_text = match.group(2).strip()
                while heading_stack and heading_stack[-1][0] >= level:
                    heading_stack.pop()
                heading_stack.append((level, heading_text))
                current_title = " > ".join(item[1] for item in heading_stack)
                continue

        current_lines.append(line)

    _flush()
    return sections


def _split_into_paragraphs(body: str) -> List[str]:
    """Tách thân mục thành các khối đoạn văn, giữ nguyên toàn bộ khối code fence không bị cắt đôi."""
    blocks: List[str] = []
    buf: List[str] = []
    in_fence = False

    for line in body.split("\n"):
        if _FENCE_RE.match(line):
            in_fence = not in_fence
            buf.append(line)
            continue
        if not in_fence and not line.strip():
            if buf:
                blocks.append("\n".join(buf).strip())
                buf = []
            continue
        buf.append(line)

    if buf:
        blocks.append("\n".join(buf).strip())
    return [block for block in blocks if block]


def _split_oversized_block(block: str, max_chars: int) -> List[str]:
    """Chia khối văn bản quá lớn theo câu hoặc dòng để không vượt ngưỡng kích thước chunk."""
    if len(block) <= max_chars:
        return [block]

    sentences = re.split(r"(?<=[.!?])\s+|\n", block)
    parts: List[str] = []
    current = ""
    for piece in sentences:
        clean = piece.strip()
        if not clean:
            continue
        candidate = f"{current} {clean}".strip() if current else clean
        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                parts.append(current)
            if len(clean) <= max_chars:
                current = clean
            else:
                # Dự phòng cho dòng liên tục cực dài không dấu ngắt
                for start in range(0, len(clean), max_chars):
                    parts.append(clean[start : start + max_chars])
                current = ""
    if current:
        parts.append(current)
    return parts


def _pack_blocks_with_overlap(
    blocks: List[str],
    max_chars: int,
    overlap_chars: int,
) -> List[str]:
    """Gom các đoạn văn vào từng chunk vừa ngưỡng max_chars và giữ lại đoạn gối đầu hợp lý."""
    expanded: List[str] = []
    for block in blocks:
        expanded.extend(_split_oversized_block(block, max_chars))

    chunks: List[str] = []
    current_blocks: List[str] = []
    current_len = 0

    for block in expanded:
        added_len = len(block) + (2 if current_blocks else 0)
        if current_blocks and current_len + added_len > max_chars:
            chunks.append("\n\n".join(current_blocks))
            # Giữ phần cuối của chunk trước làm ngữ cảnh gối đầu cho chunk kế tiếp
            overlap_blocks: List[str] = []
            overlap_len = 0
            if overlap_chars > 0:
                for prev in reversed(current_blocks):
                    next_len = overlap_len + len(prev) + (2 if overlap_blocks else 0)
                    if next_len > overlap_chars and overlap_blocks:
                        break
                    if len(prev) <= overlap_chars:
                        overlap_blocks.insert(0, prev)
                        overlap_len = next_len
                    else:
                        overlap_blocks.insert(0, prev[-overlap_chars:].lstrip())
                        break
            current_blocks = overlap_blocks
            current_len = sum(len(item) for item in current_blocks) + max(0, (len(current_blocks) - 1) * 2)

        current_blocks.append(block)
        current_len += len(block) + (2 if len(current_blocks) > 1 else 0)

    if current_blocks:
        chunks.append("\n\n".join(current_blocks))
    return chunks


def chunk_markdown_document(
    doc_path: str,
    markdown_text: str,
    doc_hash: str,
    max_chars: int = DEFAULT_MAX_CHUNK_CHARS,
    overlap_chars: int = DEFAULT_OVERLAP_CHARS,
) -> List[Dict[str, Any]]:
    """
    Chuyển một tài liệu Markdown thành danh sách chunk kèm metadata chuẩn hóa.

    @param {str} doc_path Đường dẫn tương đối chuẩn POSIX của tài liệu.
    @param {str} markdown_text Nội dung văn bản Markdown.
    @param {str} doc_hash Mã băm SHA-256 của tài liệu gốc.
    @param {int} max_chars Ngưỡng ký tự tối đa cho mỗi chunk (mặc định 1200).
    @param {int} overlap_chars Ngưỡng ký tự gối đầu giữa hai chunk kề nhau cùng mục (mặc định 180).
    @returns {List[Dict[str, Any]]} Danh sách chunk gồm chunk_id, doc_path, title, doc_hash, content.
    """
    safe_max = max(200, int(max_chars))
    safe_overlap = max(0, min(int(overlap_chars), safe_max // 2))
    sections = _parse_markdown_sections(markdown_text or "")

    results: List[Dict[str, Any]] = []
    chunk_index = 0
    for section in sections:
        blocks = _split_into_paragraphs(section.body)
        if not blocks:
            continue
        packed = _pack_blocks_with_overlap(blocks, safe_max, safe_overlap)
        for text_chunk in packed:
            full_text = f"[{section.title}]\n{text_chunk}"
            raw_key = f"{doc_path}::{chunk_index}::{section.title}"
            chunk_id = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()[:16]
            results.append({
                "chunk_id": chunk_id,
                "doc_path": doc_path,
                "title": section.title,
                "doc_hash": doc_hash,
                "content": full_text,
            })
            chunk_index += 1
    return results
