// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState, useRef } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon hiển thị máy ảnh, người dùng, ổ khóa, đóng modal, mắt và thông báo
import {
  Camera,
  User,
  Mail,
  Lock,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
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
 * Biểu thức chính quy kiểm tra định dạng Gmail.
 */
const GMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@gmail\.com$/i;

/**
 * Modal Cài Đặt Hồ Sơ Cá Nhân (User Profile Settings Modal).
 * Mở ra khi người dùng nhấp chuột vào Ảnh đại diện ở góc dưới Sidebar:
 * - Thay đổi ảnh đại diện (Avatar Base64) trực tiếp từ máy tính.
 * - Sửa Họ, Tên đệm, Tên và Tên tài khoản định dạng Gmail.
 * - Đổi mật khẩu an toàn (xác thực mật khẩu cũ).
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object} props.currentUser Thông tin tài khoản người dùng đang đăng nhập.
 * @param {Function} props.onClose Hàm đóng modal hồ sơ.
 * @param {Function} props.onProfileUpdated Hàm cập nhật lại state người dùng khi lưu thành công.
 * @returns {React.ReactElement} Giao diện modal chỉnh sửa hồ sơ.
 */
export default function ProfileModal({ currentUser, onClose, onProfileUpdated }) {
  const fileInputRef = useRef(null);

  // Trạng thái ảnh đại diện
  const [avatarPreview, setAvatarPreview] = useState(currentUser?.avatar_url || '');

  // Thông tin cá nhân
  const [lastName, setLastName] = useState(currentUser?.last_name || '');
  const [middleName, setMiddleName] = useState(currentUser?.middle_name || '');
  const [firstName, setFirstName] = useState(currentUser?.first_name || '');
  const [username, setUsername] = useState(currentUser?.username || '');

  // Trạng thái đổi mật khẩu
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Trạng thái kiểm tra lỗi Gmail
  const [gmailError, setGmailError] = useState('');

  // Trạng thái lưu
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  /**
   * Kiểm tra định dạng Gmail khi người dùng sửa username
   */
  const handleUsernameChange = (val) => {
    setUsername(val);
    if (currentUser?.role !== 'admin' && val.trim() && !GMAIL_REGEX.test(val.trim())) {
      setGmailError('Tên tài khoản mới bắt buộc phải có đuôi @gmail.com hợp lệ!');
    } else {
      setGmailError('');
    }
  };

  /**
   * Xử lý chọn tệp ảnh đại diện từ máy tính và chuyển sang Base64
   */
  const handleAvatarFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', message: 'Vui lòng chọn tệp định dạng hình ảnh (PNG, JPG, SVG, WebP).' });
      return;
    }

    // Giới hạn kích thước ảnh đại diện tối đa 4MB
    if (file.size > 4 * 1024 * 1024) {
      setFeedback({ type: 'error', message: 'Kích thước ảnh đại diện không được vượt quá 4MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatarPreview(event.target.result);
      setFeedback({ type: 'success', message: 'Đã tải ảnh đại diện! Hãy nhấn "Lưu thay đổi" để hoàn tất.' });
    };
    reader.readAsDataURL(file);
  };

  /**
   * Lưu các thay đổi hồ sơ vào CSDL MySQL
   */
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const cleanUser = username.trim();
    if (currentUser?.role !== 'admin' && !GMAIL_REGEX.test(cleanUser)) {
      setFeedback({ type: 'error', message: 'Tên tài khoản bắt buộc phải có định dạng Gmail (@gmail.com)!' });
      setSaving(false);
      return;
    }

    if (newPassword.trim()) {
      if (!currentPassword.trim()) {
        setFeedback({ type: 'error', message: 'Vui lòng nhập mật khẩu hiện tại để xác nhận đổi mật khẩu mới.' });
        setSaving(false);
        return;
      }
      if (newPassword.trim() !== confirmPassword.trim()) {
        setFeedback({ type: 'error', message: 'Mật khẩu mới và mật khẩu xác nhận không khớp nhau.' });
        setSaving(false);
        return;
      }
    }

    const payload = {
      user_id: currentUser.id,
      last_name: lastName.trim() || undefined,
      middle_name: middleName.trim() || undefined,
      first_name: firstName.trim() || undefined,
      username: cleanUser || undefined,
      avatar_url: avatarPreview || undefined,
      current_password: currentPassword.trim() || undefined,
      new_password: newPassword.trim() || undefined
    };

    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resJson = await response.json();
      if (!response.ok) {
        throw new Error(resJson.detail || 'Không thể cập nhật hồ sơ cá nhân.');
      }

      setFeedback({ type: 'success', message: 'Đã cập nhật hồ sơ cá nhân thành công vào MySQL!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      if (onProfileUpdated && resJson.data) {
        onProfileUpdated(resJson.data);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi lưu hồ sơ.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="atelier-auth-overlay" onClick={onClose}>
      <div className="atelier-profile-box" onClick={(e) => e.stopPropagation()}>
        {/* Nút Đóng Modal (X) */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            right: '18px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: 'var(--text-muted)',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'; }}
        >
          <X size={18} />
        </button>

        {/* 1. Tiêu Đề Modal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <User size={22} color="var(--accent-purple)" />
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
            Hồ Sơ &amp; Cài Đặt Tài Khoản
          </h2>
        </div>

        {/* 2. Thông Báo Phản Hồi */}
        {feedback && (
          <div style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            border: `1px solid ${feedback.type === 'success' ? '#10b981' : '#ef4444'}`,
            color: feedback.type === 'success' ? '#34d399' : '#f87171',
            fontSize: '0.8rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px'
          }}>
            {feedback.type === 'success' ? <CheckCircle2 size={16} flexShrink={0} /> : <AlertCircle size={16} flexShrink={0} />}
            <span>{feedback.message}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile}>
          {/* 3. KHỐI CHỈNH SỬA ẢNH ĐẠI DIỆN (AVATAR) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            padding: '16px',
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border-panel)',
            borderRadius: '12px',
            marginBottom: '18px'
          }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                overflow: 'hidden',
                background: currentUser?.role === 'admin'
                  ? 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)'
                  : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid var(--accent-purple)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '1.4rem'
              }}>
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  currentUser?.role === 'admin' ? 'AD' : (currentUser?.username?.slice(0, 2)?.toUpperCase() || 'US')
                )}
              </div>

              {/* Nút bấm chọn ảnh nhanh */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Thay đổi ảnh đại diện từ máy tính"
                style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'var(--accent-purple)',
                  border: '2px solid #0d091c',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                }}
              >
                <Camera size={13} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileChange}
                style={{ display: 'none' }}
              />
            </div>

            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-white)' }}>
                {currentUser?.full_name || currentUser?.username}
              </div>
              <div style={{ fontSize: '0.75rem', color: currentUser?.role === 'admin' ? '#c084fc' : '#38bdf8', marginTop: '2px' }}>
                {currentUser?.role === 'admin' ? '🛡️ Quản trị viên tối cao (Admin)' : '🎮 Người dùng thường (User)'}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--accent-purple)',
                  fontSize: '0.75rem',
                  padding: 0,
                  marginTop: '6px',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Tải ảnh mới từ máy tính (.PNG, .JPG)
              </button>
            </div>
          </div>

          {/* 4. KHỐI THÔNG TIN HỌ TÊN VÀ GMAIL */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-white)', fontWeight: 600, marginBottom: '8px' }}>
              Họ và tên của bạn:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '0.725rem', color: 'var(--text-dim)', display: 'block', marginBottom: '3px' }}>Họ</span>
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
                <span style={{ fontSize: '0.725rem', color: 'var(--text-dim)', display: 'block', marginBottom: '3px' }}>Tên đệm</span>
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
                <span style={{ fontSize: '0.725rem', color: 'var(--text-dim)', display: 'block', marginBottom: '3px' }}>Tên</span>
                <input
                  type="text"
                  value={firstName}
                  placeholder="Ví dụ: Phương"
                  onChange={(e) => setFirstName(e.target.value)}
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
          </div>

          {/* Ô Nhập Tên tài khoản / Gmail */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-white)', fontWeight: 600, marginBottom: '6px' }}>
              Tên tài khoản (Gmail đăng nhập):
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }}>
                <Mail size={16} />
              </div>
              <input
                type="text"
                value={username}
                placeholder="yourname@gmail.com"
                onChange={(e) => handleUsernameChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: `1px solid ${gmailError ? '#ef4444' : 'var(--border-panel)'}`,
                  borderRadius: '8px',
                  color: 'var(--text-white)',
                  fontSize: '0.85rem'
                }}
              />
            </div>
            {gmailError && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#f87171', fontSize: '0.725rem', marginTop: '4px' }}>
                <BadgeAlert size={12} />
                <span>{gmailError}</span>
              </div>
            )}
          </div>

          {/* 5. KHỐI ĐỔI MẬT KHẨU AN TOÀN */}
          <div style={{
            padding: '14px',
            background: 'rgba(0, 0, 0, 0.2)',
            border: '1px solid var(--border-panel)',
            borderRadius: '10px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-white)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={15} color="var(--accent-purple)" />
                Đổi mật khẩu tài khoản (Để trống nếu không đổi):
              </span>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0 }}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={currentPassword}
                placeholder="Nhập mật khẩu hiện tại..."
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-panel)',
                  borderRadius: '6px',
                  color: 'var(--text-white)',
                  fontSize: '0.8rem'
                }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  placeholder="Mật khẩu mới..."
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-panel)',
                    borderRadius: '6px',
                    color: 'var(--text-white)',
                    fontSize: '0.8rem'
                  }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  placeholder="Xác nhận mật khẩu..."
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid var(--border-panel)',
                    borderRadius: '6px',
                    color: 'var(--text-white)',
                    fontSize: '0.8rem'
                  }}
                />
              </div>
            </div>
          </div>

          {/* 6. NÚT LƯU THAY ĐỔI VÀ NÚT ĐÓNG */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: '1px solid var(--border-panel)',
                borderRadius: '8px',
                color: 'var(--text-muted)',
                fontSize: '0.825rem',
                cursor: 'pointer'
              }}
            >
              Hủy bỏ
            </button>

            <button
              type="submit"
              disabled={saving || Boolean(gmailError)}
              style={{
                padding: '8px 20px',
                background: (saving || Boolean(gmailError)) ? '#4b5563' : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: (saving || Boolean(gmailError)) ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.35)'
              }}
            >
              <Save size={15} className={saving ? 'spin' : ''} />
              <span>{saving ? 'Đang lưu vào MySQL…' : 'Lưu Thay Đổi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
