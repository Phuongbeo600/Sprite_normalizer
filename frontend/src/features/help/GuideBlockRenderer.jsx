// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý giao diện và trạng thái)
// ========================================================
// React: Quản lý trạng thái sao chép và các mục FAQ.
import React, { useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Biểu tượng giao diện)
// ========================================================
// lucide-react: Biểu tượng sao chép, FAQ và ghi chú trong bài viết.
import { AlertCircle, Check, CheckCircle2, ChevronDown, ChevronRight, Copy, FileCode, Lightbulb } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Thành phần giao diện và dữ liệu)
// ========================================================
// Dữ liệu của khối nội dung được truyền từ bài viết.

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC
// ========================================================
// Các khối sử dụng định dạng nội tuyến của Help Center.

/**
 * Hiển thị mã nguồn và phản hồi khi người dùng sao chép.
 *
 * @param {Object} props Thuộc tính component.
 * @param {string} props.code Nội dung đoạn mã.
 * @param {string} [props.language] Ngôn ngữ lập trình (gdscript, python, bash, sql).
 * @param {string} [props.title] Tiêu đề đoạn mã.
 * @returns {React.ReactElement} Giao diện khối mã nguồn.
 */
function GuideCodeBlock({ code, language = 'text', title = '' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      margin: '18px 0',
      background: 'rgba(10, 8, 20, 0.85)',
      borderRadius: '10px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      overflow: 'hidden'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        background: 'rgba(255, 255, 255, 0.04)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        fontSize: '0.75rem',
        color: 'var(--text-muted)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FileCode size={14} color="#a855f7" />
          <span style={{ fontWeight: 600, color: 'var(--text-white)' }}>{title || language.toUpperCase()}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: copied ? '#34d399' : '#e2e8f0',
            padding: '3px 8px',
            borderRadius: '5px',
            fontSize: '0.725rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s ease'
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
        </button>
      </div>
      <pre style={{
        margin: 0,
        padding: '14px 16px',
        fontSize: '0.8rem',
        fontFamily: 'Consolas, monospace',
        color: '#e2e8f0',
        overflowX: 'auto',
        lineHeight: 1.5
      }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Hiển thị danh sách câu hỏi có thể mở và đóng độc lập.
 *
 * @param {Object} props Thuộc tính component.
 * @param {string} props.title Tiêu đề khối FAQ.
 * @param {Array<{q: string, a: string}>} props.items Danh sách câu hỏi và câu trả lời.
 * @returns {React.ReactElement} Giao diện khối FAQ.
 */
function GuideFaqBlock({ title, items = [] }) {
  const [openIndexes, setOpenIndexes] = useState({ 0: true });

  const toggleIndex = (idx) => {
    setOpenIndexes((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div style={{ margin: '20px 0' }}>
      {title && (
        <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', color: 'var(--text-white)' }}>
          {title}
        </h4>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((item, idx) => {
          const isOpen = Boolean(openIndexes[idx]);
          return (
            <div
              key={idx}
              style={{
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                overflow: 'hidden',
                transition: 'border-color 0.2s ease'
              }}
            >
              <button
                type="button"
                onClick={() => toggleIndex(idx)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-white)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}
              >
                <span>{item.q}</span>
                {isOpen ? <ChevronDown size={16} color="#a855f7" /> : <ChevronRight size={16} color="#94a3b8" />}
              </button>
              {isOpen && (
                <div style={{
                  padding: '0 16px 14px',
                  fontSize: '0.825rem',
                  color: 'var(--text-dim)',
                  lineHeight: 1.55,
                  borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                  paddingTop: '10px'
                }}>
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const INFO_CALLOUT = {
  bg: 'rgba(56, 189, 248, 0.1)',
  border: 'rgba(56, 189, 248, 0.35)',
  textColor: '#38bdf8',
  IconComp: CheckCircle2
};

const TIP_CALLOUT = {
  bg: 'rgba(16, 185, 129, 0.1)',
  border: 'rgba(16, 185, 129, 0.35)',
  textColor: '#34d399',
  IconComp: Lightbulb
};

const WARNING_CALLOUT = {
  bg: 'rgba(239, 68, 68, 0.1)',
  border: 'rgba(239, 68, 68, 0.35)',
  textColor: '#f87171',
  IconComp: AlertCircle
};

/**
 * Hiển thị ghi chú theo mức độ, với kiểu thông tin làm mặc định.
 *
 * @param {Object} props Thuộc tính của khối ghi chú.
 * @param {string} props.level Mức độ của ghi chú.
 * @param {string} [props.title] Tiêu đề ghi chú.
 * @param {string} props.content Nội dung ghi chú.
 * @returns {React.ReactElement} Giao diện khối ghi chú.
 */
function renderCallout({ level, title, content }) {
  const isTip = level === 'tip';
  const isWarning = level === 'warning';
  const appearance = isWarning ? WARNING_CALLOUT : isTip ? TIP_CALLOUT : INFO_CALLOUT;
  const { bg, border, textColor, IconComp } = appearance;

  return (
    <div style={{
      margin: '16px 0',
      padding: '14px 16px',
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: '10px',
      display: 'flex',
      gap: '12px',
      alignItems: 'flex-start'
    }}>
      <IconComp size={18} color={textColor} style={{ flexShrink: 0, marginTop: '2px' }} />
      <div>
        {title && (
          <h5 style={{ margin: '0 0 4px', fontSize: '0.875rem', color: textColor, fontWeight: 700 }}>
            {title}
          </h5>
        )}
        <div style={{ fontSize: '0.825rem', color: '#cbd5e1', lineHeight: 1.55 }}>
          {content}
        </div>
      </div>
    </div>
  );
}

/**
 * Hiển thị các bước thao tác theo thứ tự trong bài viết.
 *
 * @param {Object} props Thuộc tính của khối hướng dẫn.
 * @param {string} [props.title] Tiêu đề nhóm thao tác.
 * @param {Array<{step?: number, title: string, desc: string}>} props.items Các bước hướng dẫn.
 * @returns {React.ReactElement} Danh sách bước đã đánh số.
 */
function renderSteps({ title, items }) {
  return (
    <div style={{ margin: '18px 0' }}>
      {title && (
        <h4 style={{ margin: '0 0 12px', fontSize: '0.925rem', color: 'var(--text-white)' }}>
          {title}
        </h4>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.map((item, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
              padding: '10px 14px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '8px'
            }}
          >
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {item.step || idx + 1}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-white)' }}>
                {item.title}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '2px', lineHeight: 1.5 }}>
                {item.desc}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Hiển thị bảng dữ liệu trong bài viết.
 *
 * @param {Object} props Thuộc tính của bảng.
 * @param {string} [props.title] Tiêu đề bảng.
 * @param {string[]} props.headers Tiêu đề các cột.
 * @param {string[][]} props.rows Dữ liệu theo hàng.
 * @returns {React.ReactElement} Bảng hướng dẫn.
 */
function renderTable({ title, headers, rows }) {
  return (
    <div style={{ margin: '18px 0', overflowX: 'auto' }}>
      {title && (
        <h4 style={{ margin: '0 0 10px', fontSize: '0.925rem', color: 'var(--text-white)' }}>
          {title}
        </h4>
      )}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '0.8rem',
        textAlign: 'left',
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <thead>
          <tr style={{ background: 'rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: '10px 14px', fontWeight: 600, color: '#e2e8f0' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
              {row.map((cell, cIdx) => (
                <td key={cIdx} style={{ padding: '10px 14px', color: cIdx === 0 ? 'var(--text-white)' : 'var(--text-dim)' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Chọn cách hiển thị theo loại khối trong dữ liệu bài viết.
 *
 * @param {Object} props Thuộc tính của bộ dựng.
 * @param {Object} props.block Khối có loại paragraph, callout, steps, table, code hoặc faq.
 * @returns {React.ReactElement|null} Nội dung đã dựng hoặc giá trị rỗng nếu loại chưa được hỗ trợ.
 */
export default function GuideBlockRenderer({ block }) {
  if (!block) return null;

  switch (block.type) {
    case 'paragraph':
      return (
        <p style={{
          fontSize: '0.875rem',
          lineHeight: 1.65,
          color: '#cbd5e1',
          margin: '12px 0'
        }}>
          {block.content}
        </p>
      );

    case 'callout':
      return renderCallout(block);

    case 'steps':
      return renderSteps(block);

    case 'table':
      return renderTable(block);

    case 'code':
      return <GuideCodeBlock code={block.code} language={block.language} title={block.title} />;

    case 'faq':
      return <GuideFaqBlock title={block.title} items={block.items} />;

    default:
      return null;
  }
}
