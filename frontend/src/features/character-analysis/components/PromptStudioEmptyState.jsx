// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component)
// ========================================================
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon minh họa trạng thái khóa, thước đo, nạp ảnh và chuyển hướng
import {
  Wand2,
  Ruler,
  FolderOpen,
  ArrowRight,
  Lock,
  CheckCircle2,
  CircleDashed,
  ChevronRight
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Biểu tượng Pixel Art)
// ========================================================
// PixelArtIcons: Biểu tượng hiệp sĩ rêu phong, hoa văn rune cổ và lâu đài chìm
import {
  PixelKnightGround,
  PixelRune,
  PixelCastleWatermark
} from '../../../shared/ui/PixelArtIcons';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// analysis-atelier.css: Hệ thống phong cách Dark Fantasy Atelier huyền bí & chuyên nghiệp
import '../analysis-atelier.css';

/**
 * Màn hình trang trí Pixel Art cho trạng thái chờ của Phòng tạo Prompt 15-Frame.
 * Hiển thị khi người dùng mới vào dự án hoặc chưa hoàn thành đo đạc tại Tab 1.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {boolean} props.hasReference Đã nạp tệp ảnh sprite mẫu hay chưa.
 * @param {Function} props.onGoToMeasure Hàm điều hướng quay lại Tab 1 để đo đạc.
 * @returns {React.ReactElement} Giao diện trang trí Pixel Art sắc nét.
 */
export default function PromptStudioEmptyState({ hasReference, onGoToMeasure }) {
  return (
    <section className="atelier-prompt-studio-card atelier-prompt-empty-card" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Hoa văn Rune Pixel Art trang trí 2 góc trên của thẻ */}
      <PixelRune size={18} className="pixel-corner-rune pixel-corner-top-right" />
      <PixelRune size={18} className="pixel-corner-rune pixel-corner-top-left" />

      {/* Hình bóng lâu đài cổ pháo đài chìm hậu cảnh (Watermark chi phí 0 token) */}
      <PixelCastleWatermark
        width={260}
        height={130}
        style={{ position: 'absolute', bottom: '16px', right: '20px', opacity: 0.045, pointerEvents: 'none' }}
      />

      {/* Tiêu đề & Trạng thái chờ kích hoạt */}
      <div className="atelier-prompt-card-header">
        <div>
          <h4 className="atelier-prompt-card-title">
            <Wand2 size={20} color="#c084fc" />
            <span>Phòng Tạo Prompt 15-Frame (Ma Trận Hoạt Họa Pixel Art)</span>
          </h4>
          <p className="atelier-prompt-card-desc">
            Tự động biên dịch ma trận 15 frame hoạt họa chân tay đối nghịch từ số đo giải phẫu nhân vật mẫu.
          </p>
        </div>
        <div className="atelier-prompt-empty-lock-badge">
          <Lock size={13} />
          <span>Đang chờ dữ liệu đo đạc</span>
        </div>
      </div>

      {/* Tâm điểm trang trí: Hiệp sĩ cắm kiếm trên mỏm đất rêu phong phát sáng lơ lửng */}
      <div className="atelier-prompt-empty-stage">
        <div className="pixel-empty-icon-wrap" style={{ marginBottom: '16px' }}>
          <div className="pixel-empty-circle-aura" style={{ width: '130px', height: '130px' }} />
          <PixelKnightGround size={110} className="pixel-art-glow pixel-art-float" />
        </div>

        <h3 className="atelier-prompt-empty-title">
          Ma Trận 15 Frame Đang Chờ Kích Hoạt
        </h3>
        <p className="atelier-prompt-empty-desc">
          Để tạo câu prompt sinh hoạt họa 15 frame (3 hướng × 5 bước đi) chuẩn xác tỷ lệ đầu/thân và màu sắc,
          hệ thống cần số liệu thực tế đo được từ nhân vật mẫu của bạn tại <strong>Tab 1. Đo đạc Sprite (Python)</strong>.
        </p>

        {/* Lưới 3 bước quy trình trực quan phong cách Atelier */}
        <div className="atelier-prompt-steps-grid">
          {/* Bước 1: Nạp ảnh mẫu */}
          <div className={`atelier-prompt-step-box ${hasReference ? 'completed' : 'active'}`}>
            <div className="atelier-prompt-step-num">
              {hasReference ? <CheckCircle2 size={16} /> : '1'}
            </div>
            <div className="atelier-prompt-step-info">
              <span className="atelier-prompt-step-name">Bước 1: Nạp ảnh mẫu</span>
              <span className="atelier-prompt-step-status">
                {hasReference ? 'Đã nạp sprite mẫu' : 'Chưa có ảnh sprite'}
              </span>
            </div>
          </div>

          <div className="atelier-prompt-step-arrow">
            <ChevronRight size={16} />
          </div>

          {/* Bước 2: Đo đạc tại Tab 1 */}
          <div className={`atelier-prompt-step-box ${hasReference ? 'active' : ''}`}>
            <div className="atelier-prompt-step-num">
              <CircleDashed size={16} className={hasReference ? 'spin-slow' : ''} />
            </div>
            <div className="atelier-prompt-step-info">
              <span className="atelier-prompt-step-name">Bước 2: Đo đạc tại Tab 1</span>
              <span className="atelier-prompt-step-status">
                {hasReference ? 'Cần chạy bóc tách' : 'Đang chờ nạp ảnh'}
              </span>
            </div>
          </div>

          <div className="atelier-prompt-step-arrow">
            <ChevronRight size={16} />
          </div>

          {/* Bước 3: Mở khóa Prompt Studio */}
          <div className="atelier-prompt-step-box locked">
            <div className="atelier-prompt-step-num">
              <Lock size={15} />
            </div>
            <div className="atelier-prompt-step-info">
              <span className="atelier-prompt-step-name">Bước 3: Mở khóa Prompt</span>
              <span className="atelier-prompt-step-status">Tự động kích hoạt</span>
            </div>
          </div>
        </div>

        {/* Nút hành động dẫn lối người dùng sang Tab 1 */}
        <div style={{ marginTop: '10px' }}>
          <button
            type="button"
            className="atelier-btn-primary-action"
            style={{ width: 'auto', padding: '11px 26px', fontSize: '0.88rem', margin: '0 auto' }}
            onClick={onGoToMeasure}
          >
            {hasReference ? (
              <>
                <Ruler size={16} />
                <span>Chuyển sang Tab 1 để chạy đo đạc Sprite</span>
                <ArrowRight size={15} />
              </>
            ) : (
              <>
                <FolderOpen size={16} />
                <span>Chuyển sang Tab 1 để chọn ảnh sprite mẫu</span>
                <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}
