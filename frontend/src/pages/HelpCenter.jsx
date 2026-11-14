// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState, useMemo, useRef } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon vector hiển thị danh mục, tìm kiếm, accordion và thông báo
import {
  Search,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ScanSearch,
  Image,
  Gamepad2,
  Users,
  BookOpen,
  HelpCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  Lightbulb,
  FileCode,
  FolderOpen,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Bot
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// HELP_GUIDE_CATEGORIES: Cấu trúc dữ liệu bài viết hướng dẫn đa hình
import { HELP_GUIDE_CATEGORIES } from '../constants/helpGuidesData';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark UI từ theme.css thông qua index.css

/**
 * Ánh xạ icon tương ứng với danh mục hướng dẫn.
 * 
 * @param {string} iconName Tên định danh icon.
 * @returns {React.ReactElement} Component icon Lucide.
 */
function renderCategoryIcon(iconName, size = 18) {
  switch (iconName) {
    case 'Sparkles': return <Sparkles size={size} />;
    case 'ScanSearch': return <ScanSearch size={size} />;
    case 'Image': return <Image size={size} />;
    case 'Gamepad2': return <Gamepad2 size={size} />;
    case 'Users': return <Users size={size} />;
    default: return <BookOpen size={size} />;
  }
}

/**
 * Component Khối Mã Nguồn Đa Hình (Polymorphic Code Block) có nút Sao chép.
 * 
 * @param {Object} props Thuộc tính component.
 * @param {string} props.code Nội dung đoạn mã.
 * @param {string} [props.language] Ngôn ngữ lập trình (gdscript, python, bash, sql).
 * @param {string} [props.title] Tiêu đề đoạn mã.
 * @returns {React.ReactElement} Giao diện khối mã nguồn.
 */
function PolymorphicCodeBlock({ code, language = 'text', title = '' }) {
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
 * Component Khối Câu Hỏi Thường Gặp (Polymorphic FAQ Accordion Block).
 * 
 * @param {Object} props Thuộc tính component.
 * @param {string} props.title Tiêu đề khối FAQ.
 * @param {Array<{q: string, a: string}>} props.items Danh sách câu hỏi và câu trả lời.
 * @returns {React.ReactElement} Giao diện khối FAQ.
 */
function PolymorphicFaqBlock({ title, items = [] }) {
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

/**
 * Trình dựng đa hình hiển thị khối nội dung bất kỳ (Polymorphic Block Renderer).
 * 
 * @param {Object} props Thuộc tính component.
 * @param {Object} props.block Khối dữ liệu đa hình ({ type: 'paragraph' | 'steps' | 'callout' | 'code' | 'faq' | 'table' }).
 * @returns {React.ReactElement|null} Phần tử hiển thị tương ứng.
 */
function PolymorphicBlockRenderer({ block }) {
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

    case 'callout': {
      const isTip = block.level === 'tip';
      const isWarn = block.level === 'warning';
      const bg = isWarn ? 'rgba(239, 68, 68, 0.1)' : isTip ? 'rgba(16, 185, 129, 0.1)' : 'rgba(56, 189, 248, 0.1)';
      const border = isWarn ? 'rgba(239, 68, 68, 0.35)' : isTip ? 'rgba(16, 185, 129, 0.35)' : 'rgba(56, 189, 248, 0.35)';
      const textColor = isWarn ? '#f87171' : isTip ? '#34d399' : '#38bdf8';
      const IconComp = isWarn ? AlertCircle : isTip ? Lightbulb : CheckCircle2;

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
            {block.title && (
              <h5 style={{ margin: '0 0 4px', fontSize: '0.875rem', color: textColor, fontWeight: 700 }}>
                {block.title}
              </h5>
            )}
            <div style={{ fontSize: '0.825rem', color: '#cbd5e1', lineHeight: 1.55 }}>
              {block.content}
            </div>
          </div>
        </div>
      );
    }

    case 'steps':
      return (
        <div style={{ margin: '18px 0' }}>
          {block.title && (
            <h4 style={{ margin: '0 0 12px', fontSize: '0.925rem', color: 'var(--text-white)' }}>
              {block.title}
            </h4>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {block.items.map((item, idx) => (
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

    case 'table':
      return (
        <div style={{ margin: '18px 0', overflowX: 'auto' }}>
          {block.title && (
            <h4 style={{ margin: '0 0 10px', fontSize: '0.925rem', color: 'var(--text-white)' }}>
              {block.title}
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
                {block.headers.map((h, i) => (
                  <th key={i} style={{ padding: '10px 14px', fontWeight: 600, color: '#e2e8f0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rIdx) => (
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

    case 'code':
      return (
        <PolymorphicCodeBlock
          code={block.code}
          language={block.language}
          title={block.title}
        />
      );

    case 'faq':
      return (
        <PolymorphicFaqBlock
          title={block.title}
          items={block.items}
        />
      );

    default:
      return null;
  }
}

/**
 * Trang Trung Tâm Hướng Dẫn (Help Center Screen).
 * Thiết kế chuẩn theo bố cục của CoReach.AI Help Center (Ảnh số 2):
 * - Thanh trên cùng: Logo, ô tìm kiếm toàn diện và nút "Quay lại Sprite AI".
 * - Cột trái (Browse guides): Danh mục hướng dẫn dạng danh sách mở rộng / thu gọn.
 * - Cột chính:
 *   + Khi chưa chọn bài: Hero Banner "How can we help?" + Lưới các thẻ khu vực hướng dẫn (Guide areas).
 *   + Khi đã chọn bài: Hiển thị chi tiết nội dung đa hình (Polymorphic Content Renderer) theo từng khối.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Function} props.onBack Hàm chuyển hướng quay lại giao diện dự án Sprite AI.
 * @returns {React.ReactElement} Giao diện trang trung tâm hướng dẫn.
 */
export default function HelpCenter({ onBack }) {
  // Tham chiếu vùng cuộn nội dung chính để cuộn lên đầu khi đổi bài
  const mainScrollRef = useRef(null);

  // Trạng thái bài viết đang được mở xem ({ categoryId, articleId }) | null
  const [selectedArticleInfo, setSelectedArticleInfo] = useState(null);

  // Trạng thái tìm kiếm
  const [searchQuery, setSearchQuery] = useState('');

  // Trạng thái accordion mở/đóng danh mục ở thanh bên trái
  const [expandedCategories, setExpandedCategories] = useState(() => {
    const init = {};
    HELP_GUIDE_CATEGORIES.forEach((c) => { init[c.id] = true; });
    return init;
  });

  // Trạng thái phản hồi hữu ích
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  /**
   * Đóng/mở một nhóm danh mục ở cột bên trái
   */
  const toggleCategoryExpand = (catId) => {
    setExpandedCategories((prev) => ({ ...prev, [catId]: !prev[catId] }));
  };

  /**
   * Tìm kiếm bài viết theo từ khóa
   */
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const results = [];
    HELP_GUIDE_CATEGORIES.forEach((cat) => {
      cat.articles.forEach((art) => {
        const matchTitle = art.title.toLowerCase().includes(q);
        const matchSummary = art.summary.toLowerCase().includes(q);
        const matchCat = cat.title.toLowerCase().includes(q);
        if (matchTitle || matchSummary || matchCat) {
          results.push({
            categoryId: cat.id,
            categoryTitle: cat.title,
            article: art
          });
        }
      });
    });
    return results;
  }, [searchQuery]);

  // Tìm bài viết hiện tại đang được chọn
  const activeArticle = useMemo(() => {
    if (!selectedArticleInfo) return null;
    const cat = HELP_GUIDE_CATEGORIES.find((c) => c.id === selectedArticleInfo.categoryId);
    if (!cat) return null;
    const art = cat.articles.find((a) => a.id === selectedArticleInfo.articleId);
    return { category: cat, article: art };
  }, [selectedArticleInfo]);

  /**
   * Mở một bài viết cụ thể và tự động cuộn lên đầu bài
   */
  const handleOpenArticle = (categoryId, articleId) => {
    setSelectedArticleInfo({ categoryId, articleId });
    setSearchQuery('');
    setFeedbackGiven(false);
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  /**
   * Quay lại màn hình tổng quan Hero + Guide Areas
   */
  const handleBackToOverview = () => {
    setSelectedArticleInfo(null);
    setSearchQuery('');
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div style={{
      height: '100vh',
      maxHeight: '100vh',
      width: '100vw',
      maxWidth: '100vw',
      overflow: 'hidden',
      background: 'linear-gradient(180deg, rgba(15, 11, 30, 0.98) 0%, rgba(9, 6, 20, 0.99) 100%)',
      color: 'var(--text-white)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* ======================================================== */}
      {/* 1. THANH ĐIỀU HƯỚNG TRÊN CÙNG (Top Navigation Bar) */}
      {/* ======================================================== */}
      <header style={{
        height: '64px',
        minHeight: '64px',
        maxHeight: '64px',
        flexShrink: 0,
        padding: '0 24px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        background: 'rgba(18, 13, 36, 0.95)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px',
        zIndex: 50
      }}>
        {/* Logo Sprite AI | Help Center */}
        <div
          onClick={handleBackToOverview}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #a855f7 0%, #6d28d9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(168, 85, 247, 0.35)'
          }}>
            <Bot size={18} color="#ffffff" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#ffffff' }}>
              Sprite AI
            </span>
            <span style={{ color: 'rgba(255, 255, 255, 0.25)', fontSize: '0.9rem' }}>|</span>
            <span style={{ color: '#38bdf8', fontWeight: 600, fontSize: '0.925rem' }}>
              Help Center
            </span>
          </div>
        </div>

        {/* Thanh Ô Tìm Kiếm Nhanh (Top Search Bar) */}
        <div style={{ flex: 1, maxWidth: '520px', position: 'relative' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '20px',
            padding: '6px 14px',
            gap: '8px'
          }}>
            <Search size={15} color="#94a3b8" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm tài liệu, khái niệm, phím tắt, thuật toán..."
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-white)',
                fontSize: '0.825rem',
                outline: 'none'
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: '2px 6px'
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Hộp Gợi Ý Kết Quả Tìm Kiếm Thả Xuống (Search Dropdown) */}
          {searchQuery.trim() && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              marginTop: '6px',
              background: '#1a1333',
              border: '1px solid rgba(168, 85, 247, 0.35)',
              borderRadius: '12px',
              boxShadow: '0 12px 30px rgba(0, 0, 0, 0.65)',
              maxHeight: '340px',
              overflowY: 'auto',
              zIndex: 100,
              padding: '8px'
            }}>
              {searchResults.length === 0 ? (
                <div style={{ padding: '12px 14px', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Không tìm thấy bài viết nào khớp với "{searchQuery}".
                </div>
              ) : (
                searchResults.map(({ categoryId, categoryTitle, article }) => (
                  <div
                    key={article.id}
                    onClick={() => handleOpenArticle(categoryId, article.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background 0.2s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ fontSize: '0.7rem', color: '#c084fc', fontWeight: 600, textTransform: 'uppercase' }}>
                      {categoryTitle}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#ffffff', marginTop: '2px' }}>
                      {article.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                      {article.summary}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Nút Quay Lại Sprite AI (Return to Sprite AI) */}
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            border: 'none',
            borderRadius: '8px',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.825rem',
            padding: '8px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
            transition: 'all 0.2s ease',
            flexShrink: 0
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <ArrowLeft size={15} />
          <span>Quay lại Sprite AI</span>
        </button>
      </header>

      {/* ======================================================== */}
      {/* 2. THÂN GIAO DIỆN CHIA 2 CỘT (Left Sidebar & Main Content) */}
      {/* ======================================================== */}
      <div style={{
        display: 'flex',
        flex: 1,
        height: 'calc(100vh - 64px)',
        overflow: 'hidden'
      }}>
        {/* CỘT TRÁI: DANH MỤC HƯỚNG DẪN (Browse Guides Sidebar) */}
        <aside style={{
          width: '280px',
          height: '100%',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(14, 10, 28, 0.65)',
          padding: '24px 16px 60px 16px',
          overflowY: 'auto',
          flexShrink: 0
        }}>
          <div style={{
            fontSize: '0.725rem',
            fontWeight: 700,
            color: '#94a3b8',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '16px',
            paddingLeft: '8px'
          }}>
            Danh mục hướng dẫn
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {HELP_GUIDE_CATEGORIES.map((cat) => {
              const isExpanded = Boolean(expandedCategories[cat.id]);

              return (
                <div key={cat.id} style={{ marginBottom: '6px' }}>
                  {/* Tiêu đề nhóm danh mục */}
                  <button
                    type="button"
                    onClick={() => toggleCategoryExpand(cat.id)}
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-white)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '8px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'background 0.2s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#c084fc' }}>
                        {renderCategoryIcon(cat.iconName, 15)}
                      </span>
                      <span>{cat.title}</span>
                    </div>
                    {isExpanded ? <ChevronDown size={14} color="#94a3b8" /> : <ChevronRight size={14} color="#94a3b8" />}
                  </button>

                  {/* Danh sách các bài viết bên trong danh mục */}
                  {isExpanded && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      marginLeft: '14px',
                      paddingLeft: '10px',
                      borderLeft: '1.5px solid rgba(255, 255, 255, 0.1)',
                      marginTop: '4px'
                    }}>
                      {cat.articles.map((art) => {
                        const isCurrent =
                          selectedArticleInfo?.categoryId === cat.id &&
                          selectedArticleInfo?.articleId === art.id;

                        return (
                          <button
                            key={art.id}
                            type="button"
                            onClick={() => handleOpenArticle(cat.id, art.id)}
                            style={{
                              width: '100%',
                              padding: '7px 10px',
                              borderRadius: '6px',
                              border: 'none',
                              background: isCurrent ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                              color: isCurrent ? '#c084fc' : '#94a3b8',
                              fontWeight: isCurrent ? 600 : 400,
                              fontSize: '0.8rem',
                              textAlign: 'left',
                              cursor: 'pointer',
                              lineHeight: 1.35,
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              if (!isCurrent) {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                                e.currentTarget.style.color = '#ffffff';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!isCurrent) {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#94a3b8';
                              }
                            }}
                          >
                            {art.title}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* CỘT PHẢI: VÙNG NỘI DUNG CHÍNH (Main Content Area - Có thanh cuộn đầy đủ) */}
        <main
          ref={mainScrollRef}
          style={{
            flex: 1,
            height: '100%',
            overflowY: 'auto',
            padding: '32px 40px 100px 40px',
            scrollBehavior: 'smooth'
          }}
        >
          {activeArticle ? (
            /* ======================================================== */
            /* CHẾ ĐỘ 1: XEM CHI TIẾT BÀI VIẾT (Article Detail View)    */
            /* ======================================================== */
            <div style={{ maxWidth: '820px', margin: '0 auto', paddingBottom: '60px' }}>
              {/* Breadcrumb Navigation */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                marginBottom: '18px'
              }}>
                <span
                  onClick={handleBackToOverview}
                  style={{ cursor: 'pointer', color: '#c084fc' }}
                >
                  Trung tâm hướng dẫn
                </span>
                <span>/</span>
                <span>{activeArticle.category.title}</span>
                <span>/</span>
                <span style={{ color: 'var(--text-white)', fontWeight: 500 }}>
                  {activeArticle.article.title}
                </span>
              </div>

              {/* Tiêu đề & Mô tả bài viết */}
              <h1 style={{
                fontSize: '1.85rem',
                fontWeight: 700,
                color: '#ffffff',
                margin: '0 0 10px',
                letterSpacing: '-0.01em'
              }}>
                {activeArticle.article.title}
              </h1>
              <p style={{
                fontSize: '0.95rem',
                color: '#94a3b8',
                margin: '0 0 24px',
                lineHeight: 1.5,
                borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                paddingBottom: '18px'
              }}>
                {activeArticle.article.summary}
              </p>

              {/* DỰNG NỘI DUNG ĐA HÌNH (Polymorphic Content Blocks) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {activeArticle.article.blocks?.map((block, idx) => (
                  <PolymorphicBlockRenderer key={idx} block={block} />
                ))}
              </div>

              {/* Đánh Giá Phản Hồi Bài Viết */}
              <div style={{
                marginTop: '40px',
                padding: '20px 24px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '14px'
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#ffffff' }}>
                    Bài viết này có giải đáp được thắc mắc của bạn không?
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                    Ý kiến đóng góp giúp chúng tôi không ngừng cải tiến hệ thống Sprite AI.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    disabled={feedbackGiven}
                    onClick={() => setFeedbackGiven(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      background: feedbackGiven ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: feedbackGiven ? '#34d399' : '#e2e8f0',
                      fontSize: '0.8rem',
                      cursor: feedbackGiven ? 'default' : 'pointer'
                    }}
                  >
                    <ThumbsUp size={14} />
                    <span>{feedbackGiven ? 'Cảm ơn bạn!' : 'Hữu ích'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={feedbackGiven}
                    onClick={() => setFeedbackGiven(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#e2e8f0',
                      fontSize: '0.8rem',
                      cursor: feedbackGiven ? 'default' : 'pointer'
                    }}
                  >
                    <ThumbsDown size={14} />
                    <span>Chưa rõ ràng</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* CHẾ ĐỘ 2: TỔNG QUAN HERO + KHU VỰC HƯỚNG DẪN (Ảnh số 2)  */
            /* ======================================================== */
            <div style={{ maxWidth: '1060px', margin: '0 auto', paddingBottom: '60px' }}>
              {/* HERO BANNER: "How can we help?" */}
              <div style={{
                borderRadius: '16px',
                padding: '38px 32px',
                textAlign: 'center',
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45)',
                marginBottom: '36px'
              }}>
                <span style={{
                  display: 'inline-block',
                  fontSize: '0.725rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#38bdf8',
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  marginBottom: '12px'
                }}>
                  HELP CENTER / TRUNG TÂM HƯỚNG DẪN
                </span>

                <h1 style={{
                  margin: '0 0 8px',
                  fontSize: '2.1rem',
                  fontWeight: 800,
                  color: '#ffffff'
                }}>
                  Làm thế nào để chúng tôi hỗ trợ bạn?
                </h1>

                <p style={{
                  margin: '0 auto 24px',
                  fontSize: '0.9rem',
                  color: 'var(--text-muted)',
                  maxWidth: '560px'
                }}>
                  Tài liệu hướng dẫn trực quan, chuẩn hóa từng thao tác từ bóc tách giải phẫu, sinh ảnh AI tới xuất hoạt họa Godot Engine 4.
                </p>

                {/* Ô tìm kiếm lớn ở giữa Hero */}
                <div style={{
                  maxWidth: '520px',
                  margin: '0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '30px',
                  padding: '4px 6px 4px 16px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                }}>
                  <Search size={17} color="#94a3b8" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm tài liệu, ma trận 15 frame, Bounding box..."
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      outline: 'none',
                      padding: '8px 12px'
                    }}
                  />
                  <button
                    type="button"
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: 'none',
                      color: '#ffffff',
                      padding: '8px 18px',
                      borderRadius: '20px',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Tìm kiếm
                  </button>
                </div>
              </div>

              {/* TIÊU ĐỀ: KHU VỰC HƯỚNG DẪN (Guide areas) */}
              <div style={{ marginBottom: '18px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 4px', color: '#ffffff' }}>
                  Khu vực hướng dẫn (Guide areas)
                </h2>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: 0 }}>
                  Chọn một chủ đề bên dưới để khám phá các bài viết hướng dẫn chuyên sâu.
                </p>
              </div>

              {/* LƯỚI THẺ 3 CỘT (Responsive Cards Grid) */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
                gap: '18px'
              }}>
                {HELP_GUIDE_CATEGORIES.map((cat) => {
                  const firstArticle = cat.articles[0];

                  return (
                    <div
                      key={cat.id}
                      onClick={() => handleOpenArticle(cat.id, firstArticle?.id)}
                      style={{
                        background: 'rgba(26, 18, 51, 0.55)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '12px',
                        padding: '20px 22px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.25s ease',
                        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.45)';
                        e.currentTarget.style.transform = 'translateY(-3px)';
                        e.currentTarget.style.background = 'rgba(35, 24, 70, 0.75)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.background = 'rgba(26, 18, 51, 0.55)';
                      }}
                    >
                      <div>
                        <div style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '10px',
                          background: 'rgba(168, 85, 247, 0.15)',
                          border: '1px solid rgba(168, 85, 247, 0.3)',
                          color: '#c084fc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '14px'
                        }}>
                          {renderCategoryIcon(cat.iconName, 20)}
                        </div>

                        <h3 style={{
                          margin: '0 0 6px',
                          fontSize: '1rem',
                          fontWeight: 700,
                          color: '#ffffff'
                        }}>
                          {cat.title}
                        </h3>

                        <p style={{
                          margin: 0,
                          fontSize: '0.8rem',
                          color: 'var(--text-dim)',
                          lineHeight: 1.5
                        }}>
                          {cat.description}
                        </p>
                      </div>

                      <div style={{
                        marginTop: '20px',
                        paddingTop: '12px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <span style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: 600 }}>
                          Khám phá hướng dẫn ➔
                        </span>
                        <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                          {cat.articles.length} bài viết
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
