// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý giao diện và trạng thái)
// ========================================================
// React: Quản lý điều hướng nội bộ, tìm kiếm và tham chiếu vùng cuộn.
import React, { useState, useMemo, useRef } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Biểu tượng giao diện)
// ========================================================
// lucide-react: Biểu tượng cho điều hướng danh mục và tìm kiếm.
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
  ArrowLeft,
  Bot
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Thành phần giao diện và dữ liệu)
// ========================================================
// HELP_GUIDE_CATEGORIES: Cấu trúc dữ liệu bài viết hướng dẫn đa hình
import { HELP_GUIDE_CATEGORIES } from '../../constants/helpGuidesData';
// renderGuideArticle: Dựng nội dung và các thao tác trong vùng đọc.
import renderGuideArticle from './renderGuideArticle';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC
// ========================================================
// Giao diện sử dụng định dạng nội tuyến của Help Center.

/**
 * Ánh xạ icon tương ứng với danh mục hướng dẫn.
 * 
 * @param {string} iconName Tên định danh icon.
 * @param {number} [size] Kích thước biểu tượng theo pixel.
 * @returns {React.ReactElement} Biểu tượng Lucide tương ứng.
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
 * Tìm bài viết theo tiêu đề, mô tả hoặc tên danh mục trong thứ tự hiển thị.
 *
 * @param {string} query Từ khóa người dùng nhập.
 * @returns {Array<{categoryId: string, categoryTitle: string, article: Object}>} Kết quả tra cứu.
 */
function searchGuideArticles(query) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return [];

  const results = [];
  for (const category of HELP_GUIDE_CATEGORIES) {
    for (const article of category.articles) {
      const matchesTitle = article.title.toLowerCase().includes(keyword);
      const matchesSummary = article.summary.toLowerCase().includes(keyword);
      const matchesCategory = category.title.toLowerCase().includes(keyword);
      if (matchesTitle || matchesSummary || matchesCategory) {
        results.push({ categoryId: category.id, categoryTitle: category.title, article });
      }
    }
  }
  return results;
}

/**
 * Điều phối tìm kiếm, chọn bài viết và điều hướng trong Trung tâm Hướng dẫn.
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

  const searchResults = useMemo(() => searchGuideArticles(searchQuery), [searchQuery]);

  // Tìm bài viết hiện tại đang được chọn
  const activeArticle = useMemo(() => {
    if (!selectedArticleInfo) return null;
    const cat = HELP_GUIDE_CATEGORIES.find((c) => c.id === selectedArticleInfo.categoryId);
    if (!cat) return null;
    const art = cat.articles.find((a) => a.id === selectedArticleInfo.articleId);
    return { category: cat, article: art };
  }, [selectedArticleInfo]);

  /**
   * Cuộn vùng đọc lên đầu khi mở bài hoặc quay lại tổng quan.
   * @returns {void}
   */
  const scrollToTop = () => {
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Ghi nhận phản hồi cho bài đang đọc.
   * @returns {void}
   */
  const handleArticleFeedback = () => {
    setFeedbackGiven(true);
  };

  /**
   * Mở bài viết và cuộn lên đầu vùng đọc.
   * @param {string} categoryId Mã danh mục.
   * @param {string} [articleId] Mã bài viết.
   * @returns {void}
   */
  const handleOpenArticle = (categoryId, articleId) => {
    setSelectedArticleInfo({ categoryId, articleId });
    setSearchQuery('');
    setFeedbackGiven(false);
    scrollToTop();
  };

  /**
   * Mở kết quả đầu tiên khi người dùng gửi biểu mẫu tìm kiếm.
   *
   * @param {React.FormEvent<HTMLFormElement>} event Sự kiện gửi biểu mẫu.
   * @returns {void}
   */
  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const firstResult = searchResults[0];
    if (!firstResult) return;
    handleOpenArticle(firstResult.categoryId, firstResult.article.id);
  };

  /**
   * Quay lại màn hình tổng quan.
   * @returns {void}
   */
  const handleBackToOverview = () => {
    setSelectedArticleInfo(null);
    setSearchQuery('');
    scrollToTop();
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
      {/* 1. THANH ĐIỀU HƯỚNG TRÊN CÙNG */}
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
        {/* Biểu tượng Sprite AI và tên Trung tâm Hướng dẫn */}
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

        {/* Nút Quay Lại Xưởng Sáng Tạo */}
        <button
          type="button"
          onClick={onBack}
          style={{
            background: 'linear-gradient(135deg, #9333ea 0%, #6366f1 100%)',
            border: '1px solid rgba(192, 132, 252, 0.45)',
            borderRadius: '9px',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '0.825rem',
            padding: '8px 18px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            boxShadow: '0 4px 16px rgba(147, 51, 234, 0.35)',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            flexShrink: 0
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(168, 85, 247, 0.55)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(147, 51, 234, 0.35)';
          }}
        >
          <ArrowLeft size={15} />
          <span>Trở về Xưởng Sáng Tạo</span>
        </button>
      </header>

      {/* ======================================================== */}
      {/* 2. THÂN GIAO DIỆN CHIA 2 CỘT */}
      {/* ======================================================== */}
      <div style={{
        display: 'flex',
        flex: 1,
        height: 'calc(100vh - 64px)',
        overflow: 'hidden'
      }}>
        {/* CỘT TRÁI: DANH MỤC HƯỚNG DẪN */}
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

        {/* CỘT PHẢI: VÙNG NỘI DUNG CHÍNH */}
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
            renderGuideArticle({
              categoryTitle: activeArticle.category.title,
              article: activeArticle.article,
              feedbackGiven,
              onFeedback: handleArticleFeedback,
              onBackToOverview: handleBackToOverview
            })
          ) : (
            /* ======================================================== */
            /* Trang tổng quan và các khu vực hướng dẫn  */
            /* ======================================================== */
            <div style={{ maxWidth: '1060px', margin: '0 auto', paddingBottom: '60px' }}>
              {/* Phần giới thiệu */}
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
                  color: '#c084fc',
                  background: 'rgba(147, 51, 234, 0.16)',
                  border: '1px solid rgba(192, 132, 252, 0.35)',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  marginBottom: '14px'
                }}>
                  BÍ THƯ SÁNG TẠO · CẨM NANG HƯỚNG DẪN
                </span>

                <h1 style={{
                  margin: '0 0 10px',
                  fontSize: '2.1rem',
                  fontWeight: 800,
                  color: '#ffffff'
                }}>
                  Bạn Cần Tra Cứu Bí Quyết Sáng Tạo Nào?
                </h1>

                <p style={{
                  margin: '0 auto 24px',
                  fontSize: '0.9rem',
                  color: 'var(--text-muted)',
                  maxWidth: '560px'
                }}>
                  Tài liệu hướng dẫn trực quan, chuẩn hóa từng thao tác từ bóc tách giải phẫu, sinh ảnh AI tới xuất hoạt họa Godot Engine 4.
                </p>

                {/* Ô tìm kiếm ở giữa phần giới thiệu */}
                <div style={{ maxWidth: '560px', margin: '0 auto', position: 'relative' }}>
                  <form
                    onSubmit={handleSearchSubmit}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: 'rgba(0, 0, 0, 0.45)',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      borderRadius: '30px',
                      padding: '4px 6px 4px 16px',
                      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
                      transition: 'border-color 0.2s ease'
                    }}
                  >
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
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          padding: '4px 8px',
                          marginRight: '4px'
                        }}
                        title="Xóa tìm kiếm"
                      >
                        ✕
                      </button>
                    )}
                    <button
                      type="submit"
                      style={{
                        background: 'linear-gradient(135deg, #9333ea 0%, #6366f1 100%)',
                        border: '1px solid rgba(192, 132, 252, 0.4)',
                        color: '#ffffff',
                        padding: '8px 20px',
                        borderRadius: '20px',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        boxShadow: '0 3px 12px rgba(147, 51, 234, 0.4)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      Tìm kiếm
                    </button>
                  </form>

                  {/* Danh sách gợi ý bên dưới ô tìm kiếm */}
                  {searchQuery.trim() && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '8px',
                      background: 'rgba(26, 19, 51, 0.98)',
                      border: '1px solid rgba(168, 85, 247, 0.45)',
                      borderRadius: '14px',
                      boxShadow: '0 16px 40px rgba(0, 0, 0, 0.75)',
                      maxHeight: '340px',
                      overflowY: 'auto',
                      zIndex: 100,
                      padding: '8px',
                      textAlign: 'left'
                    }}>
                      {searchResults.length === 0 ? (
                        <div style={{ padding: '14px', fontSize: '0.825rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                          Không tìm thấy tài liệu hướng dẫn nào khớp với "{searchQuery}".
                        </div>
                      ) : (
                        searchResults.map(({ categoryId, categoryTitle, article }) => (
                          <div
                            key={article.id}
                            onClick={() => handleOpenArticle(categoryId, article.id)}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                              transition: 'background 0.2s ease'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div style={{ fontSize: '0.675rem', color: '#c084fc', fontWeight: 600, textTransform: 'uppercase' }}>
                              {categoryTitle}
                            </div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#ffffff', marginTop: '2px' }}>
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
              </div>

              {/* Tiêu đề khu vực hướng dẫn */}
              <div style={{ marginBottom: '18px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 4px', color: '#ffffff' }}>
                  Khu vực hướng dẫn (Guide areas)
                </h2>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: 0 }}>
                  Chọn một chủ đề bên dưới để khám phá các bài viết hướng dẫn chuyên sâu.
                </p>
              </div>

              {/* Lưới danh mục tự điều chỉnh số cột */}
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
