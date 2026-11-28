// 1. THƯ VIỆN NỀN TẢNG REACT (Trạng thái sao chép và nguồn tài liệu)
import React, { useEffect, useState } from 'react';

// 2. THƯ VIỆN BÊN NGOÀI (Markdown và biểu tượng)
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, ChevronDown, Copy, FileText, Sparkles } from 'lucide-react';

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Không phụ thuộc API)

// 4. CẤU HÌNH (Markdown không thực thi HTML từ nội dung model)
import './offline-chat-messages.css';
const MARKDOWN_PLUGINS = [remarkGfm];

/**
 * Sao chép nội dung chính xác và báo trạng thái bằng nhãn truy cập được.
 * @param {Object} props Nội dung và nhãn nút sao chép.
 * @returns {React.ReactElement} Nút sao chép có xác nhận hoặc báo lỗi.
 */
function CopyButton({ text, label = 'Sao chép câu trả lời' }) {
  const [state, setState] = useState('');
  useEffect(() => setState(''), [text]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('Đã sao chép');
    } catch {
      setState('Không thể sao chép');
    }
  };
  return (
    <button type="button" className="atelier-offline-copy" onClick={copy} aria-label={state || label} title={state || label}>
      {state === 'Đã sao chép' ? <Check size={14} /> : <Copy size={14} />}
      <span aria-live="polite">{state}</span>
    </button>
  );
}

/**
 * Giữ khối code cuộn ngang bên trong hội thoại và có nút sao chép riêng.
 * @param {Object} props Phần tử code do trình Markdown tạo.
 * @returns {React.ReactElement} Khối code và thanh công cụ.
 */
function CodeBlock({ children }) {
  const code = React.Children.toArray(children)[0];
  const text = String(code?.props?.children || '').replace(/\n$/, '');
  const language = code?.props?.className?.replace('language-', '') || 'Code';
  return (
    <div className="atelier-offline-code">
      <div className="atelier-offline-code-bar"><span>{language}</span><CopyButton text={text} label="Sao chép mã" /></div>
      <pre>{children}</pre>
    </div>
  );
}

const MARKDOWN_COMPONENTS = {
  pre: CodeBlock,
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

/**
 * Hiển thị hội thoại, Markdown và nguồn RAG; không quản lý suy luận model.
 * @param {Object} props Danh sách tin nhắn và trạng thái đang trả lời.
 * @returns {React.ReactElement} Các lượt hội thoại theo thứ tự thời gian.
 */
export default function OfflineChatMessages({ messages, isStreaming }) {
  const [openSources, setOpenSources] = useState({});
  return messages.map((msg, index) => {
    const assistant = msg.role === 'assistant';
    const sources = Array.isArray(msg.sources) ? msg.sources : [];
    const pending = assistant && isStreaming && index === messages.length - 1;
    return (
      <article key={msg.id || `${msg.request_id || index}-${msg.role}`} className={`atelier-offline-msg-row ${assistant ? 'is-assistant' : 'is-user'}`} aria-label={assistant ? 'Trợ Lý AI' : 'Bạn'}>
        {assistant && <div className="atelier-offline-answer-label"><Sparkles size={14} /><span>Trợ Lý AI</span></div>}
        <div className="atelier-offline-msg-bubble">
          {assistant ? (msg.content ? <ReactMarkdown remarkPlugins={MARKDOWN_PLUGINS} components={MARKDOWN_COMPONENTS}>{msg.content}</ReactMarkdown> : pending ? <span className="atelier-offline-thinking" role="status">Đang xử lý<span>…</span></span> : '') : msg.content}
        </div>
        {assistant && (msg.status === 'cancelled' || msg.status === 'failed') && (
          <span className={`atelier-offline-msg-status is-${msg.status}`}>{msg.status === 'cancelled' ? 'Đã dừng giữa chừng' : 'Phản hồi bị gián đoạn'}</span>
        )}
        {assistant && (sources.length > 0 || (msg.content && !pending)) && (
          <div className="atelier-offline-answer-actions">
            {msg.content && !pending && <CopyButton text={msg.content} />}
            {sources.length > 0 && <button type="button" className="atelier-offline-sources-toggle" aria-expanded={Boolean(openSources[index])} onClick={() => setOpenSources((prev) => ({ ...prev, [index]: !prev[index] }))}>
              <FileText size={12} /><span>{sources.length} nguồn tham khảo</span><ChevronDown size={12} className={openSources[index] ? 'is-rotated' : ''} />
            </button>}
          </div>
        )}
        {assistant && openSources[index] && <div className="atelier-offline-sources" aria-label="Nguồn tài liệu tham khảo">{sources.map((source) => (
          <span className="atelier-offline-source-tag" key={source.chunk_id} title={source.doc_path}><FileText size={12} />{source.title || source.doc_path}</span>
        ))}</div>}
      </article>
    );
  });
}
