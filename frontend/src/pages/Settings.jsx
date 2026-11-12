// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon hiển thị cài đặt chung, thông tin ứng dụng, robot AI và khóa bảo vệ
import { Settings as SettingsIcon, Info, Bot, ShieldCheck, FolderGit2, Sparkles, ExternalLink } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// initialProjects: Lấy thông tin ứng dụng và cấu hình chung
import { APP_CONFIG } from '../constants/initialProjects';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark UI từ theme.css

/**
 * Màn hình Cài đặt Chung Toàn cục (Global Application Settings).
 * Theo yêu cầu thiết kế mới:
 * - ĐÃ GỠ BỎ TOÀN BỘ CÁC Ô NHẬP API KEY Ở MÀN HÌNH NÀY.
 * - Chìa khóa API hiện được phân bổ và lưu trữ độc lập theo từng Dự án trong CSDL MySQL.
 * - Trang này chịu trách nhiệm hiển thị thông tin phiên bản, trạng thái hệ thống và hướng dẫn sử dụng.
 * 
 * @returns {React.ReactElement} Giao diện cài đặt chung của ứng dụng.
 */
export default function Settings() {
  return (
    <div className="studio-workspace-container" style={{ padding: '0 4px', maxWidth: '720px', margin: '0 auto' }}>
      {/* ========================================================
          1. THANH TIÊU ĐỀ CÀI ĐẶT CHUNG
          ======================================================== */}
      <header className="studio-header-card">
        <div className="studio-title-group">
          <h1>
            <SettingsIcon size={22} color="var(--accent-purple)" />
            Cài Đặt Hệ Thống &amp; Thông Tin Ứng Dụng
          </h1>
          <p>
            Quản trị thông tin phần mềm Sprite Normalizer &amp; AI Studio.
          </p>
        </div>
      </header>

      {/* ========================================================
          2. THÔNG BÁO CHUYỂN ĐỔI QUẢN LÝ API KEY THEO DỰ ÁN
          ======================================================== */}
      <div
        className="profile-section-card"
        style={{
          borderLeft: '3px solid var(--accent-purple)',
          background: 'rgba(139, 92, 246, 0.08)',
          marginBottom: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
          <Info size={20} color="var(--accent-purple)" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ color: 'var(--text-white)', margin: '0 0 4px', fontSize: '0.9rem' }}>
              Quản lý Chìa khóa API đã được chuyển vào từng Dự án
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 8px', lineHeight: '1.5' }}>
              Chọn Gemini hoặc OpenAI và cấu hình khóa trong cài đặt từng dự án.
            </p>
            <p style={{ color: 'var(--text-highlight)', fontSize: '0.8rem', margin: 0, fontWeight: 500 }}>
              👉 <strong>Cách cấu hình API Key:</strong> Mở một dự án trong danh sách ➔ Chọn mục <strong>"Cài đặt dự án"</strong> trên thanh điều hướng bên trái để kiểm tra hoặc nhập key riêng cho dự án đó.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================
          3. THÔNG TIN PHIÊN BẢN & CÔNG NGHỆ ỨNG DỤNG
          ======================================================== */}
      <div className="studio-metric-card" style={{ padding: '20px', borderRadius: '12px', marginBottom: '16px' }}>
        <h4 style={{ color: 'var(--text-white)', fontSize: '0.9rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Bot size={16} color="var(--accent-purple)" />
          Thông tin Nền tảng
        </h4>

        <div className="profile-field-grid">
          <div className="profile-field-item">
            <strong>Tên ứng dụng</strong>
            <span>Sprite Normalizer AI Studio</span>
          </div>

          <div className="profile-field-item">
            <strong>Phiên bản phần mềm</strong>
            <span>v2.0.0 (Bản nâng cấp Kiến trúc MySQL)</span>
          </div>

          <div className="profile-field-item">
            <strong>Công nghệ Frontend</strong>
            <span>React 18 + Vite (Modern Dark Creative Studio)</span>
          </div>

          <div className="profile-field-item">
            <strong>Công nghệ Backend</strong>
            <span>FastAPI + OpenCV + NumPy + SQLAlchemy + Pydantic v2</span>
          </div>

          <div className="profile-field-item">
            <strong>Cơ sở dữ liệu</strong>
            <span>MySQL (Hỗ trợ Multi-Project &amp; Preset DNA)</span>
          </div>

          <div className="profile-field-item">
            <strong>Bài tập lớn</strong>
            <span>Trí Tuệ Nhân Tạo - Đại học Công Nghệ (UET)</span>
          </div>
        </div>
      </div>

      {/* ========================================================
          4. TÀI LIỆU HƯỚNG DẪN LẤY API KEY
          ======================================================== */}
      <div className="studio-metric-card" style={{ padding: '20px', borderRadius: '12px' }}>
        <h4 style={{ color: 'var(--text-white)', fontSize: '0.9rem', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={16} color="var(--accent-purple)" />
          Hướng dẫn lấy Khóa API Miễn phí
        </h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: '0 0 10px' }}>
          Hệ thống đề xuất sử dụng <strong>Google Gemini 1.5 Flash / Pro</strong> vì hoàn toàn miễn phí, hỗ trợ phân tích thị giác AI Vision cực kỳ chuẩn xác cho ảnh Pixel Art:
        </p>
        <a
          href="https://aistudio.google.com/app/apikey"
          target="_blank"
          rel="noreferrer"
          className="btn-secondary-studio"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '8px 14px' }}
        >
          <ExternalLink size={14} />
          Truy cập Google AI Studio để lấy Key miễn phí
        </a>
      </div>
    </div>
  );
}
