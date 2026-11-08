// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState, useEffect } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon vector SVG siêu nhẹ hiển thị chìa khóa, mắt ẩn/hiện, kiểm tra và lưu
import { Key, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Save, ShieldCheck } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark Navy / Indigo từ theme.css

/**
 * Màn hình Cài đặt Cấu hình Khóa API (Google Gemini API).
 * Tập trung duy nhất vào các thông số API:
 * - Hiển thị khóa đã được che giấu (masking) bảo mật.
 * - Cho phép nhập, thay đổi và lưu khóa API mới vào file .env an toàn.
 * - Kiểm tra kết nối trực tiếp tới Google AI Studio.
 * 
 * @returns {React.ReactElement} Bảng điều khiển cấu hình API.
 */
export default function Settings() {
  // Trạng thái cấu hình từ máy chủ
  const [hasKey, setHasKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);

  // Trạng thái thao tác kiểm tra & lưu
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  // Tải trạng thái API Key hiện tại từ Backend
  useEffect(() => {
    fetchCurrentSettings();
  }, []);

  /**
   * Gọi API /api/settings để đọc trạng thái khóa API hiện có.
   */
  const fetchCurrentSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setHasKey(data.has_key);
        setMaskedKey(data.masked_key || '');
      }
    } catch {
      // Bỏ qua lỗi kết nối ban đầu
    } finally {
      setLoading(false);
    }
  };

  /**
   * Lưu Google Gemini API Key mới vào hệ thống.
   */
  const handleSaveKey = async (e) => {
    e.preventDefault();
    const keyToSave = apiKeyInput.trim();
    if (!keyToSave) {
      setFeedback({ type: 'error', message: 'Vui lòng nhập khóa API trước khi lưu.' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: keyToSave }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.detail || 'Không thể lưu khóa API.');
      }

      setHasKey(true);
      setMaskedKey(resData.masked_key);
      setApiKeyInput('');
      setFeedback({ type: 'success', message: '✓ Đã lưu và kích hoạt Google Gemini API Key thành công!' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi lưu cấu hình.' });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Gửi request kiểm tra nhanh tính hợp lệ của API Key.
   */
  const handleTestKey = async () => {
    const keyToTest = apiKeyInput.trim();
    if (!keyToTest && !hasKey) {
      setFeedback({ type: 'error', message: 'Chưa có khóa API để kiểm tra. Hãy nhập khóa trước.' });
      return;
    }

    setTesting(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/settings/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: keyToTest || null }),
      });

      const resData = await response.json();
      if (resData.status === 'success') {
        setFeedback({ type: 'success', message: `✓ ${resData.message}` });
      } else {
        setFeedback({ type: 'error', message: `⚠️ ${resData.message}` });
      }
    } catch (err) {
      setFeedback({ type: 'error', message: 'Không thể kết nối máy chủ để kiểm tra API Key.' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="page-container" style={{ maxWidth: '780px', margin: '0 auto', padding: '28px 24px' }}>
      {/* Tiêu đề trang */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1.45rem', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Key size={24} color="#6366f1" />
          Cài đặt Khóa API (API Settings)
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
          Cấu hình và bảo mật khóa Google Gemini API để kích hoạt các tính năng Trí tuệ Nhân tạo (AI Vision và Cố vấn Prompt).
        </p>
      </div>

      {/* Thông báo phản hồi trạng thái */}
      {feedback && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          marginBottom: '20px',
          fontSize: '0.875rem',
          backgroundColor: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${feedback.type === 'success' ? '#10b981' : '#ef4444'}`,
          color: feedback.type === 'success' ? '#10b981' : '#f87171',
        }}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Thẻ Cấu hình chính của API Key */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        backdropFilter: 'blur(10px)',
        marginBottom: '24px'
      }}>
        {/* Tiêu đề thẻ & Badge trạng thái */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={20} color="#6366f1" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: '600' }}>Google Gemini API Key</h3>
          </div>
          <span style={{
            fontSize: '0.75rem',
            padding: '3px 10px',
            borderRadius: '9999px',
            fontWeight: '600',
            background: hasKey ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 179, 8, 0.2)',
            color: hasKey ? '#10b981' : '#eab308',
            border: `1px solid ${hasKey ? 'rgba(16, 185, 129, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`
          }}>
            {hasKey ? '● Đã cấu hình (Active)' : '○ Chưa cấu hình'}
          </span>
        </div>

        {/* Khóa đã lưu (được Masking che giấu an toàn) */}
        {hasKey && maskedKey && (
          <div style={{
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px 16px',
            marginBottom: '18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Khóa API hiện tại (Đã mã hóa che giấu bảo mật):
              </div>
              <code style={{ fontSize: '0.95rem', color: '#a5b4fc', letterSpacing: '0.05em' }}>
                {maskedKey}
              </code>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
              onClick={handleTestKey}
              disabled={testing}
            >
              {testing ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              {testing ? 'Đang kiểm tra…' : 'Test Key'}
            </button>
          </div>
        )}

        {/* Form nhập hoặc cập nhật khóa mới */}
        <form onSubmit={handleSaveKey}>
          <div className="control-group" style={{ marginBottom: '18px' }}>
            <label className="control-label" style={{ marginBottom: '6px', display: 'block' }}>
              {hasKey ? 'Thay đổi sang Khóa API mới' : 'Nhập Khóa API'}
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showKey ? 'text' : 'password'}
                className="input-field"
                placeholder="Dán API Key vào đây (ví dụ: AIzaSy...)"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                style={{ width: '100%', paddingRight: '42px', fontFamily: 'monospace' }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title={showKey ? 'Ẩn khóa' : 'Hiện khóa'}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px', display: 'block' }}>
              Khóa API sẽ được lưu trữ an toàn trong file <code>.env</code> ở máy chủ và tự động kích hoạt ngay lập tức.
            </span>
          </div>

          {/* Các nút bấm hành động */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTestKey}
              disabled={testing || (!apiKeyInput.trim() && !hasKey)}
            >
              {testing ? <RefreshCw size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              {testing ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !apiKeyInput.trim()}
            >
              <Save size={15} />
              {saving ? 'Đang lưu…' : 'Lưu cấu hình API'}
            </button>
          </div>
        </form>
      </div>

      {/* Hướng dẫn nhanh cách lấy API Key miễn phí */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.5)',
        border: '1px dashed var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        fontSize: '0.85rem',
        lineHeight: '1.6',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          💡 Làm sao để lấy Google Gemini API Key miễn phí?
        </div>
        <ol style={{ paddingLeft: '20px', margin: '0 0 12px 0' }}>
          <li>Truy cập vào <strong>Google AI Studio</strong> bằng tài khoản Google cá nhân.</li>
          <li>Bấm vào nút <strong>"Get API key"</strong> ở góc trên bên trái màn hình.</li>
          <li>Chọn <strong>"Create API key"</strong>, sao chép chuỗi khóa và dán vào ô trên rồi bấm <strong>"Lưu cấu hình API"</strong>.</li>
        </ol>
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--accent)',
            textDecoration: 'none',
            fontWeight: '600'
          }}
        >
          <span>Mở Google AI Studio để lấy Key</span>
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}
