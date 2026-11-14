// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ biểu tượng hiển thị cài đặt chung, thông tin ứng dụng, robot AI và khóa bảo vệ
import {
  Settings as SettingsIcon,
  Info,
  Bot,
  ShieldCheck,
  FolderGit2,
  Sparkles,
  ExternalLink
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// initialProjects: Lấy thông tin ứng dụng và cấu hình chung
import { APP_CONFIG } from '../constants/initialProjects';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark Fantasy Atelier từ settings-atelier.css
import '../styles/settings-atelier.css';

/**
 * Màn hình Cài đặt Chung Toàn cục (Global Application Settings) — Dark Fantasy Atelier Edition.
 * Theo yêu cầu thiết kế mới:
 * - ĐÃ GỠ BỎ TOÀN BỘ CÁC Ô NHẬP API KEY Ở MÀN HÌNH NÀY.
 * - Chìa khóa API hiện được phân bổ và lưu trữ độc lập theo từng Dự án trong CSDL MySQL.
 * - Trang này chịu trách nhiệm hiển thị thông tin phiên bản, trạng thái hệ thống và hướng dẫn sử dụng.
 * 
 * @returns {React.ReactElement} Giao diện cài đặt chung của ứng dụng.
 */
export default function Settings() {
  return (
    <div className="atelier-settings-root">
      {/* ========================================================
          1. THANH TIÊU ĐỀ CÀI ĐẶT CHUNG
          ======================================================== */}
      <div className="atelier-settings-header">
        <div className="atelier-settings-header-title">
          <h2 className="atelier-settings-title-heading">
            <SettingsIcon size={22} color="#c084fc" />
            <span>Cài Đặt Hệ Thống &amp; Thông Tin Ứng Dụng</span>
          </h2>
          <p className="atelier-settings-title-subtext">
            Quản trị thông tin kiến trúc nền tảng Sprite Normalizer &amp; AI Studio.
          </p>
        </div>
      </div>

      {/* ========================================================
          2. THÔNG BÁO CHUYỂN ĐỔI QUẢN LÝ API KEY THEO DỰ ÁN
          ======================================================== */}
      <div
        className="atelier-settings-card"
        style={{
          borderLeft: '4px solid #c084fc',
          background: 'rgba(147, 51, 234, 0.08)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <Info size={22} color="#c084fc" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <h4 style={{ color: '#ffffff', margin: '0 0 6px', fontSize: '0.94rem', fontWeight: 700 }}>
              Quản lý Chìa khóa API đã được chuyển vào từng Dự án độc lập
            </h4>
            <p style={{ color: 'var(--atl-text-secondary)', fontSize: '0.825rem', margin: '0 0 10px', lineHeight: '1.5' }}>
              Mỗi dự án game đều có thể sử dụng API Key riêng (Google Gemini hoặc OpenAI) được lưu tách biệt trong MySQL.
            </p>
            <p style={{ color: '#d8b4fe', fontSize: '0.825rem', margin: 0, fontWeight: 600 }}>
              👉 <strong>Cách cấu hình API Key:</strong> Mở một dự án trong danh sách ➔ Chọn mục <strong>"Cài đặt dự án"</strong> trên thanh điều hướng bên trái để kiểm tra hoặc nhập key riêng cho dự án đó.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================
          3. THÔNG TIN PHIÊN BẢN & CÔNG NGHỆ ỨNG DỤNG
          ======================================================== */}
      <div className="atelier-settings-card">
        <h4 className="atelier-settings-card-title">
          <Bot size={18} color="#c084fc" />
          <span>Thông Tin Nền Tảng Kỹ Thuật</span>
        </h4>

        <div className="atelier-settings-info-grid">
          <div className="atelier-settings-info-item">
            <strong>Tên Ứng Dụng</strong>
            <span>Sprite Normalizer AI Studio</span>
          </div>

          <div className="atelier-settings-info-item">
            <strong>Phiên Bản Phần Mềm</strong>
            <span>v2.0.0 (Bản nâng cấp Kiến trúc MySQL &amp; Atelier UI)</span>
          </div>

          <div className="atelier-settings-info-item">
            <strong>Công Nghệ Frontend</strong>
            <span>React 18 + Vite (Dark Fantasy Atelier 70/30)</span>
          </div>

          <div className="atelier-settings-info-item">
            <strong>Công Nghệ Backend</strong>
            <span>FastAPI + OpenCV + NumPy + SQLAlchemy + Pydantic v2</span>
          </div>

          <div className="atelier-settings-info-item">
            <strong>Cơ Sở Dữ Liệu</strong>
            <span>MySQL 8.0 (Multi-Project, Character Vault, Asset Sync)</span>
          </div>

          <div className="atelier-settings-info-item">
            <strong>Đồ Án Môn Học</strong>
            <span>Trí Tuệ Nhân Tạo - Đại học Công Nghệ (UET - VNU)</span>
          </div>
        </div>
      </div>

      {/* ========================================================
          4. TÀI LIỆU HƯỚNG DẪN LẤY API KEY
          ======================================================== */}
      <div className="atelier-settings-card">
        <h4 className="atelier-settings-card-title">
          <Sparkles size={18} color="#f59e0b" />
          <span>Hướng Dẫn Lấy Khóa API Miễn Phí</span>
        </h4>
        <p style={{ fontSize: '0.825rem', color: 'var(--atl-text-secondary)', lineHeight: '1.55', margin: 0 }}>
          Hệ thống đề xuất sử dụng <strong>Google Gemini 1.5 Flash / Pro</strong> vì hoàn toàn miễn phí, hỗ trợ phân tích thị giác AI Vision cực kỳ chuẩn xác cho ảnh Pixel Art:
        </p>
        <div>
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noreferrer"
            className="atelier-assets-btn-sub primary-link"
            style={{ display: 'inline-flex', padding: '9px 16px', fontSize: '0.825rem' }}
          >
            <ExternalLink size={14} />
            <span>Truy cập Google AI Studio để lấy Key miễn phí ➔</span>
          </a>
        </div>
      </div>
    </div>
  );
}
