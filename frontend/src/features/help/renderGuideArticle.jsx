// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý giao diện và trạng thái)
// ========================================================
// React: Dựng giao diện đọc bài viết.
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Biểu tượng giao diện)
// ========================================================
// lucide-react: Biểu tượng của hai nút đánh giá bài viết.
import { ThumbsDown, ThumbsUp } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Thành phần giao diện và dữ liệu)
// ========================================================
// GuideBlockRenderer: Dựng các khối nội dung theo dữ liệu bài viết.
import GuideBlockRenderer from './GuideBlockRenderer';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC
// ========================================================
// Giao diện bài viết giữ định dạng nội tuyến của Help Center.

/**
 * Dựng nội dung bài viết ngay trong nhánh hiển thị của Help Center.
 * React có thể dùng lại các phần tử DOM cùng kiểu khi chuyển giữa bài viết và tổng quan.
 *
 * @param {Object} props Dữ liệu và thao tác của vùng đọc.
 * @param {string} props.categoryTitle Tên danh mục chứa bài viết.
 * @param {Object} props.article Bài viết có tiêu đề, mô tả và các khối nội dung.
 * @param {boolean} props.feedbackGiven Trạng thái đã nhận đánh giá.
 * @param {Function} props.onFeedback Hàm ghi nhận đánh giá.
 * @param {Function} props.onBackToOverview Hàm quay lại trang tổng quan.
 * @returns {React.ReactElement} Giao diện đọc bài viết.
 */
export default function renderGuideArticle({ categoryTitle, article, feedbackGiven, onFeedback, onBackToOverview }) {
  return (
    <div style={{ maxWidth: '820px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Đường dẫn điều hướng bài viết */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        marginBottom: '18px'
      }}>
        <span
          onClick={onBackToOverview}
          style={{ cursor: 'pointer', color: '#c084fc' }}
        >
          Trung tâm hướng dẫn
        </span>
        <span>/</span>
        <span>{categoryTitle}</span>
        <span>/</span>
        <span style={{ color: 'var(--text-white)', fontWeight: 500 }}>
          {article.title}
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
        {article.title}
      </h1>
      <p style={{
        fontSize: '0.95rem',
        color: '#94a3b8',
        margin: '0 0 24px',
        lineHeight: 1.5,
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        paddingBottom: '18px'
      }}>
        {article.summary}
      </p>

      {/* Dựng các khối nội dung của bài viết */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {article.blocks?.map((block, idx) => (
          <GuideBlockRenderer key={idx} block={block} />
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
            onClick={onFeedback}
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
            onClick={onFeedback}
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
  );
}
