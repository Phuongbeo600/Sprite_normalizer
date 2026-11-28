// 1. THƯ VIỆN NỀN TẢNG REACT (Chiều cao ô nhập)
import React, { useEffect, useRef } from 'react';

// 2. THƯ VIỆN BÊN NGOÀI (Biểu tượng gửi và dừng)
import { ArrowUp, Square } from 'lucide-react';

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Callback được cấp bởi hook hội thoại)

// 4. ĐỊNH DẠNG GIAO DIỆN (Dùng CSS chung của widget)

/**
 * Ô nhập tự tăng chiều cao; Enter gửi, Shift+Enter xuống dòng, giữ đúng bộ gõ tiếng Việt.
 * @param {Object} props Nội dung, trạng thái stream và callback gửi/dừng.
 * @returns {React.ReactElement} Vùng soạn câu hỏi cố định dưới hội thoại.
 */
export default function OfflineChatComposer({ value, onChange, onSend, onStop, isStreaming, isOpen, isExpanded }) {
  const inputRef = useRef(null);
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }, [value, isOpen, isExpanded]);
  useEffect(() => {
    if (isOpen && !isStreaming) inputRef.current?.focus();
  }, [isOpen, isStreaming]);
  return (
    <div className="atelier-offline-composer-wrap">
      <div className="atelier-offline-composer">
        <textarea ref={inputRef} rows={1} value={value} onChange={(event) => onChange(event.target.value)} aria-label="Câu hỏi cho Trợ Lý AI" placeholder="Hỏi về sprite, chuyển động, Godot…" disabled={isStreaming}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
              event.preventDefault();
              onSend();
            }
          }} />
        <button type="button" className={`atelier-offline-send ${isStreaming ? 'is-stop' : ''}`} onClick={isStreaming ? onStop : onSend} disabled={!isStreaming && !value.trim()} aria-label={isStreaming ? 'Dừng sinh câu trả lời' : 'Gửi câu hỏi'} title={isStreaming ? 'Dừng sinh câu trả lời' : 'Gửi câu hỏi'}>
          {isStreaming ? <Square size={16} fill="currentColor" /> : <ArrowUp size={20} />}
        </button>
      </div>
      <p className="atelier-offline-composer-note">AI có thể trả lời chưa chính xác. Hãy đối chiếu nguồn tài liệu.</p>
    </div>
  );
}
