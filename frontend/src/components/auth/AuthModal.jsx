// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon hiển thị tài khoản, mật khẩu, ổ khóa, mắt ẩn hiện, email và tia sáng
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
  UserPlus,
  LogIn,
  AlertCircle,
  CheckCircle2,
  Bot,
  Mail,
  BadgeAlert
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không có component con phụ thuộc)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark Fantasy Atelier từ auth-atelier.css
import '../../styles/auth-atelier.css';

/**
 * Biểu thức chính quy kiểm tra định dạng tài khoản bắt buộc là Gmail.
 */
const GMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@gmail\.com$/i;

/**
 * Màn hình Đăng nhập & Đăng ký tài khoản (Authentication Screen).
 * Cung cấp xác thực tài khoản kết nối trực tiếp với MySQL:
 * - Hỗ trợ tài khoản Quản trị viên (Admin): admin / 1
 * - Hỗ trợ Đăng ký với Họ, Tên đệm, Tên và Tên tài khoản bắt buộc định dạng Gmail.
 * - Tự động liên kết dữ liệu dự án mẫu cho tài khoản người dùng mới.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Function} props.onLoginSuccess Hàm gọi khi người dùng đăng nhập thành công.
 * @returns {React.ReactElement} Giao diện màn hình đăng nhập / đăng ký.
 */
export default function AuthModal({ onLoginSuccess }) {
  // Chế độ hiện tại: 'login' (Đăng nhập) | 'register' (Đăng ký)
  const [mode, setMode] = useState('login');

  // Thông tin họ tên khi đăng ký
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [firstName, setFirstName] = useState('');

  // Tên tài khoản (khi đăng ký bắt buộc là Gmail) & Mật khẩu
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Trạng thái kiểm tra lỗi Gmail
  const [gmailError, setGmailError] = useState('');

  // Trạng thái hiển thị mật khẩu
  const [showPassword, setShowPassword] = useState(false);

  // Trạng thái xử lý và thông báo
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  /**
   * Kiểm tra định dạng Gmail thời gian thực khi người dùng gõ
   */
  const handleUsernameChange = (val) => {
    setUsername(val);
    if (mode === 'register') {
      if (val.trim() && !GMAIL_REGEX.test(val.trim())) {
        setGmailError('Tên tài khoản bắt buộc phải có đuôi @gmail.com hợp lệ!');
      } else {
        setGmailError('');
      }
    }
  };

  /**
   * Xử lý gửi form Đăng nhập
   */
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setErrorMsg('Vui lòng điền đầy đủ Tên đăng nhập và Mật khẩu.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password: cleanPass })
      });

      const resJson = await response.json();
      if (!response.ok) {
        throw new Error(resJson.detail || 'Đăng nhập không thành công.');
      }

      setSuccessMsg('Đăng nhập thành công! Đang chuyển vào hệ thống...');
      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess(resJson.data);
        }
      }, 500);
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Xử lý gửi form Đăng ký tài khoản mới
   */
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanUser = username.trim();
    const cleanPass = password.trim();
    const cleanConfirm = confirmPassword.trim();
    const cleanLast = lastName.trim();
    const cleanMid = middleName.trim();
    const cleanFirst = firstName.trim();

    if (!cleanFirst) {
      setErrorMsg('Vui lòng nhập Tên của bạn.');
      return;
    }

    if (!cleanUser) {
      setErrorMsg('Vui lòng nhập Tên tài khoản định dạng Gmail.');
      return;
    }

    // Kiểm tra định dạng Gmail bắt buộc
    if (!GMAIL_REGEX.test(cleanUser)) {
      setGmailError('Tên tài khoản không đúng định dạng Gmail!');
      setErrorMsg('Tên tài khoản bắt buộc phải có định dạng Gmail hợp lệ (Ví dụ: yourname@gmail.com). Vui lòng nhập lại!');
      return;
    }

    if (!cleanPass) {
      setErrorMsg('Vui lòng nhập mật khẩu.');
      return;
    }

    if (cleanPass !== cleanConfirm) {
      setErrorMsg('Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          password: cleanPass,
          last_name: cleanLast,
          middle_name: cleanMid,
          first_name: cleanFirst
        })
      });

      const resJson = await response.json();
      if (!response.ok) {
        throw new Error(resJson.detail || 'Không thể đăng ký tài khoản.');
      }

      setSuccessMsg('Đăng ký thành công! Đang tự động đăng nhập vào hệ thống...');
      
      // Tự động đăng nhập luôn sau khi đăng ký
      setTimeout(async () => {
        try {
          const loginResp = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: cleanUser, password: cleanPass })
          });
          const loginJson = await loginResp.json();
          if (loginResp.ok && loginJson.data) {
            if (onLoginSuccess) onLoginSuccess(loginJson.data);
          } else {
            setMode('login');
          }
        } catch {
          setMode('login');
        }
      }, 700);
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi đăng ký tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Điền nhanh thông tin tài khoản Admin mẫu
   */
  const handleFillAdmin = () => {
    setUsername('admin');
    setPassword('1');
    setErrorMsg('');
    setGmailError('');
  };

  /**
   * Điền nhanh thông tin tài khoản kiểm thử Origin (ID = 2)
   */
  const handleFillOrigin = () => {
    setUsername('origin@gmail.com');
    setPassword('123456');
    setErrorMsg('');
    setGmailError('');
  };

  return (
    <div className="atelier-auth-overlay">
      <div
        className="atelier-auth-box"
        style={{
          maxWidth: mode === 'register' ? '500px' : '440px'
        }}
      >
        {/* 1. Header Logo & Tiêu Đề */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{
            width: '52px',
            height: '52px',
            margin: '0 auto 10px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #7e22ce 0%, #9333ea 50%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(147, 51, 234, 0.45)'
          }}>
            <Bot size={28} color="#ffffff" />
          </div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#ffffff' }}>
            Sprite AI Studio
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: '0.8rem', color: 'var(--atl-text-secondary)' }}>
            Hệ thống Chuẩn Hóa &amp; Hoạt Họa Pixel Game
          </p>
        </div>

        {/* 2. Thanh Chuyển Tab Đăng Nhập / Đăng Ký */}
        <div className="atelier-auth-tabs">
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); setGmailError(''); }}
            className={`atelier-auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
          >
            <LogIn size={15} />
            <span>Đăng nhập</span>
          </button>

          <button
            type="button"
            onClick={() => { setMode('register'); setErrorMsg(''); setSuccessMsg(''); setGmailError(''); }}
            className={`atelier-auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
          >
            <UserPlus size={15} />
            <span>Đăng ký mới</span>
          </button>
        </div>

        {/* 3. Thông Báo Lỗi / Thành Công */}
        {errorMsg && (
          <div style={{
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            color: '#f87171',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '14px'
          }}>
            <AlertCircle size={16} flexShrink={0} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            color: '#34d399',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '14px'
          }}>
            <CheckCircle2 size={16} flexShrink={0} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 4. Form Nhập Liệu */}
        <form onSubmit={mode === 'login' ? handleLoginSubmit : handleRegisterSubmit}>
          {/* CÁC Ô NHẬP HỌ, TÊN ĐỆM, TÊN (Chỉ hiện khi Đăng ký) */}
          {mode === 'register' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                  Họ:
                </label>
                <input
                  type="text"
                  value={lastName}
                  placeholder="Ví dụ: Nguyễn"
                  onChange={(e) => setLastName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-panel)',
                    borderRadius: '8px',
                    color: 'var(--text-white)',
                    fontSize: '0.825rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                  Tên đệm:
                </label>
                <input
                  type="text"
                  value={middleName}
                  placeholder="Ví dụ: Văn"
                  onChange={(e) => setMiddleName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-panel)',
                    borderRadius: '8px',
                    color: 'var(--text-white)',
                    fontSize: '0.825rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                  Tên (*):
                </label>
                <input
                  type="text"
                  value={firstName}
                  placeholder="Ví dụ: Phương"
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-panel)',
                    borderRadius: '8px',
                    color: 'var(--text-white)',
                    fontSize: '0.825rem'
                  }}
                />
              </div>
            </div>
          )}

          {/* Ô Nhập Tên Tài Khoản (Đăng nhập: username hoặc Gmail; Đăng ký: BẮT BUỘC ĐỊNH DẠNG GMAIL) */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
              {mode === 'register' ? 'Tên tài khoản (Bắt buộc đuôi @gmail.com):' : 'Tên tài khoản hoặc Gmail:'}
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}>
                {mode === 'register' ? <Mail size={16} color="#38bdf8" /> : <User size={16} />}
              </div>
              <input
                type="text"
                value={username}
                placeholder={mode === 'register' ? 'yourname@gmail.com' : 'Nhập tài khoản hoặc yourname@gmail.com'}
                onChange={(e) => handleUsernameChange(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: `1px solid ${gmailError ? '#ef4444' : 'var(--border-panel)'}`,
                  borderRadius: '8px',
                  color: 'var(--text-white)',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            {/* Cảnh báo lỗi định dạng Gmail khi đăng ký */}
            {mode === 'register' && gmailError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#f87171', fontSize: '0.725rem', marginTop: '4px' }}>
                <BadgeAlert size={12} />
                <span>{gmailError}</span>
              </div>
            )}
          </div>

          {/* Ô Nhập Mật Khẩu */}
          <div style={{ marginBottom: mode === 'register' ? '12px' : '18px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
              Mật khẩu:
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}>
                <Lock size={16} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                placeholder="Nhập mật khẩu..."
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '10px 38px 10px 36px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-panel)',
                  borderRadius: '8px',
                  color: 'var(--text-white)',
                  fontSize: '0.85rem'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-dim)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Ô Xác Nhận Mật Khẩu (Chỉ hiện khi Đăng ký) */}
          {mode === 'register' && (
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
                Xác nhận lại mật khẩu:
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}>
                  <Lock size={16} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  placeholder="Nhập lại mật khẩu ở trên..."
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-panel)',
                    borderRadius: '8px',
                    color: 'var(--text-white)',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
            </div>
          )}

          {/* Nút Bấm Thực Hiện Chính */}
          <button
            type="submit"
            disabled={loading || (mode === 'register' && Boolean(gmailError))}
            style={{
              width: '100%',
              padding: '11px 16px',
              borderRadius: '8px',
              border: 'none',
              background: (mode === 'register' && Boolean(gmailError)) ? '#4b5563' : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.875rem',
              cursor: (loading || (mode === 'register' && Boolean(gmailError))) ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            {loading ? (
              <span>Đang xử lý thông tin...</span>
            ) : mode === 'login' ? (
              <>
                <LogIn size={16} />
                <span>Đăng nhập vào Hệ Thống</span>
              </>
            ) : (
              <>
                <UserPlus size={16} />
                <span>Tạo Tài Khoản Mới</span>
              </>
            )}
          </button>
        </form>

        {/* 5. Gợi Ý Tài Khoản Mẫu (Phục vụ chấm bài / Test nhanh) */}
        {mode === 'login' && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Tài khoản kiểm thử Origin */}
            <div style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px dashed rgba(16, 185, 129, 0.35)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px'
            }}>
              <div>
                <span style={{ color: '#34d399', fontWeight: 600 }}>Tài khoản kiểm thử (Origin):</span>
                <div style={{ marginTop: '2px', fontFamily: 'monospace' }}>
                  User: <strong>origin@gmail.com</strong> | Pass: <strong>123456</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={handleFillOrigin}
                style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#a7f3d0',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.725rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Điền nhanh
              </button>
            </div>

            {/* Tài khoản Admin tối cao */}
            <div style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'rgba(139, 92, 246, 0.08)',
              border: '1px dashed rgba(168, 85, 247, 0.35)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px'
            }}>
              <div>
                <span style={{ color: '#c084fc', fontWeight: 600 }}>Tài khoản Quản trị viên (Admin):</span>
                <div style={{ marginTop: '2px', fontFamily: 'monospace' }}>
                  User: <strong>admin</strong> | Pass: <strong>1</strong>
                </div>
              </div>
              <button
                type="button"
                onClick={handleFillAdmin}
                style={{
                  background: 'rgba(139, 92, 246, 0.2)',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  color: '#e9d5ff',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '0.725rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Điền nhanh
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
