// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState, useEffect } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon vector SVG siêu nhẹ hiển thị chìa khóa, mắt ẩn/hiện, kiểm tra, lưu và robot
import { Key, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, ExternalLink, Save, ShieldCheck, Bot, Sparkles, Globe } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark Navy / Indigo từ theme.css

/**
 * Màn hình Cài đặt Cấu hình Khóa API (Google Gemini & OpenAI ChatGPT).
 * Hỗ trợ đa nhà cung cấp AI:
 * - Google Gemini (Miễn phí)
 * - OpenAI ChatGPT (Trả phí - GPT-4o / GPT-4o-mini / Hỗ trợ Proxy)
 * 
 * @returns {React.ReactElement} Bảng điều khiển cấu hình API.
 */
export default function Settings() {
  // Lựa chọn nhà cung cấp AI: 'gemini' | 'openai'
  const [provider, setProvider] = useState('gemini');

  // Trạng thái Google Gemini
  const [geminiHasKey, setGeminiHasKey] = useState(false);
  const [geminiMaskedKey, setGeminiMaskedKey] = useState('');
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  // Trạng thái OpenAI ChatGPT
  const [openaiHasKey, setOpenaiHasKey] = useState(false);
  const [openaiMaskedKey, setOpenaiMaskedKey] = useState('');
  const [openaiKeyInput, setOpenaiKeyInput] = useState('');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('https://api.openai.com/v1');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);

  // Trạng thái xử lý thao tác
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  // Tải cấu hình hiện tại từ Backend
  useEffect(() => {
    fetchCurrentSettings();
  }, []);

  /**
   * Gọi API /api/settings để đọc cấu hình hiện tại.
   */
  const fetchCurrentSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        setProvider(data.provider || 'gemini');
        setGeminiHasKey(data.gemini_has_key);
        setGeminiMaskedKey(data.gemini_masked_key || '');
        setOpenaiHasKey(data.openai_has_key);
        setOpenaiMaskedKey(data.openai_masked_key || '');
        if (data.openai_base_url) {
          setOpenaiBaseUrl(data.openai_base_url);
        }
      }
    } catch {
      // Bỏ qua lỗi kết nối ban đầu
    } finally {
      setLoading(false);
    }
  };

  /**
   * Lưu cấu hình API Key và nhà cung cấp vào hệ thống.
   */
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const payload = {
      provider: provider,
      gemini_api_key: geminiKeyInput.trim() || null,
      openai_api_key: openaiKeyInput.trim() || null,
      openai_base_url: openaiBaseUrl.trim() || 'https://api.openai.com/v1',
    };

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.detail || 'Không thể lưu cấu hình.');
      }

      setGeminiMaskedKey(resData.gemini_masked_key);
      setOpenaiMaskedKey(resData.openai_masked_key);
      if (geminiKeyInput.trim()) {
        setGeminiHasKey(true);
        setGeminiKeyInput('');
      }
      if (openaiKeyInput.trim()) {
        setOpenaiHasKey(true);
        setOpenaiKeyInput('');
      }

      setFeedback({
        type: 'success',
        message: `✓ ${resData.message}`
      });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi lưu cấu hình.' });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Kiểm tra nhanh tính hợp lệ của API Key đang chọn.
   */
  const handleTestKey = async () => {
    const isGemini = provider === 'gemini';
    const keyToTest = isGemini ? geminiKeyInput.trim() : openaiKeyInput.trim();
    const currentHasKey = isGemini ? geminiHasKey : openaiHasKey;

    if (!keyToTest && !currentHasKey) {
      setFeedback({
        type: 'error',
        message: `Chưa có khóa API ${isGemini ? 'Google Gemini' : 'OpenAI ChatGPT'} để kiểm tra. Hãy nhập khóa trước.`
      });
      return;
    }

    setTesting(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/settings/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: provider,
          api_key: keyToTest || null,
          base_url: openaiBaseUrl.trim() || 'https://api.openai.com/v1'
        }),
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
    <div className="page-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '28px 24px' }}>
      {/* Tiêu đề trang */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.45rem', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Key size={24} color="#6366f1" />
          Cài đặt Khóa API (API Settings)
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.5' }}>
          Cấu hình và quản lý khóa API cho các tác vụ Trí tuệ Nhân tạo. Hỗ trợ cả <strong>Google Gemini (Miễn phí)</strong> lẫn <strong>OpenAI ChatGPT (Trả phí / Proxy)</strong>.
        </p>
      </div>

      {/* Thông báo phản hồi */}
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

      {/* 1. LỰA CHỌN NHÀ CUNG CẤP AI (AI PROVIDER SWITCHER) */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <label className="control-label" style={{ marginBottom: '12px', display: 'block' }}>
          Chọn Động Cơ Trí Tuệ Nhân Tạo (Active AI Engine)
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          {/* Option: Google Gemini */}
          <div
            onClick={() => setProvider('gemini')}
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${provider === 'gemini' ? '#6366f1' : 'var(--border)'}`,
              background: provider === 'gemini' ? 'rgba(99, 102, 241, 0.12)' : 'rgba(0,0,0,0.2)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}
          >
            <Sparkles size={22} color={provider === 'gemini' ? '#818cf8' : 'var(--text-secondary)'} />
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.95rem', color: provider === 'gemini' ? '#ffffff' : 'var(--text-secondary)' }}>
                Google Gemini
              </div>
              <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '2px', fontWeight: '500' }}>
                ✓ Miễn phí 100% (Google AI Studio)
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Mô hình Gemini 2.0 Flash Visual Grounding
              </div>
            </div>
          </div>

          {/* Option: OpenAI ChatGPT */}
          <div
            onClick={() => setProvider('openai')}
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              border: `2px solid ${provider === 'openai' ? '#10b981' : 'var(--border)'}`,
              background: provider === 'openai' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(0,0,0,0.2)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}
          >
            <Bot size={22} color={provider === 'openai' ? '#34d399' : 'var(--text-secondary)'} />
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.95rem', color: provider === 'openai' ? '#ffffff' : 'var(--text-secondary)' }}>
                OpenAI ChatGPT
              </div>
              <div style={{ fontSize: '0.75rem', color: '#60a5fa', marginTop: '2px', fontWeight: '500' }}>
                Key trả phí / Đại lý Proxy
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Mô hình GPT-4o / GPT-4o-mini Vision
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. KHỐI CẤU HÌNH CHI TIẾT TÙY THEO PROVIDER */}
      <div style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        backdropFilter: 'blur(10px)',
        marginBottom: '24px'
      }}>
        {/* ===================== CẤU HÌNH GOOGLE GEMINI ===================== */}
        {provider === 'gemini' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} color="#6366f1" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: '600' }}>Khóa Google Gemini API</h3>
              </div>
              <span style={{
                fontSize: '0.75rem',
                padding: '3px 10px',
                borderRadius: '9999px',
                fontWeight: '600',
                background: geminiHasKey ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                color: geminiHasKey ? '#10b981' : '#eab308',
                border: `1px solid ${geminiHasKey ? 'rgba(16, 185, 129, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`
              }}>
                {geminiHasKey ? '● Đã lưu key Gemini' : '○ Chưa có key'}
              </span>
            </div>

            {geminiHasKey && geminiMaskedKey && (
              <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 16px',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Khóa Google Gemini đã lưu (Đã mã hóa che giấu):
                  </div>
                  <code style={{ fontSize: '0.95rem', color: '#a5b4fc', letterSpacing: '0.05em' }}>
                    {geminiMaskedKey}
                  </code>
                </div>
              </div>
            )}

            <div className="control-group" style={{ marginBottom: '16px' }}>
              <label className="control-label" style={{ marginBottom: '6px', display: 'block' }}>
                {geminiHasKey ? 'Nhập Khóa Gemini mới (nếu muốn đổi)' : 'Nhập Khóa Google Gemini API (bắt đầu bằng AIzaSy...)'}
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  className="input-field"
                  placeholder="Dán Google Gemini API Key vào đây (AIzaSy...)"
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  style={{ width: '100%', paddingRight: '42px', fontFamily: 'monospace' }}
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                  title={showGeminiKey ? 'Ẩn' : 'Hiện'}
                >
                  {showGeminiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================== CẤU HÌNH OPENAI CHATGPT ===================== */}
        {provider === 'openai' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} color="#10b981" />
                <h3 style={{ fontSize: '1.05rem', fontWeight: '600' }}>Khóa OpenAI ChatGPT API</h3>
              </div>
              <span style={{
                fontSize: '0.75rem',
                padding: '3px 10px',
                borderRadius: '9999px',
                fontWeight: '600',
                background: openaiHasKey ? 'rgba(16, 185, 129, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                color: openaiHasKey ? '#10b981' : '#eab308',
                border: `1px solid ${openaiHasKey ? 'rgba(16, 185, 129, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`
              }}>
                {openaiHasKey ? '● Đã lưu key ChatGPT' : '○ Chưa có key'}
              </span>
            </div>

            {openaiHasKey && openaiMaskedKey && (
              <div style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 16px',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Khóa OpenAI ChatGPT đã lưu (Đã mã hóa che giấu):
                  </div>
                  <code style={{ fontSize: '0.95rem', color: '#6ee7b7', letterSpacing: '0.05em' }}>
                    {openaiMaskedKey}
                  </code>
                </div>
              </div>
            )}

            <div className="control-group" style={{ marginBottom: '16px' }}>
              <label className="control-label" style={{ marginBottom: '6px', display: 'block' }}>
                {openaiHasKey ? 'Nhập Khóa ChatGPT mới (nếu muốn đổi)' : 'Nhập Khóa OpenAI ChatGPT API'}
              </label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showOpenaiKey ? 'text' : 'password'}
                  className="input-field"
                  placeholder="Dán key ChatGPT vào đây (ví dụ: sk-... hoặc key_...)"
                  value={openaiKeyInput}
                  onChange={(e) => setOpenaiKeyInput(e.target.value)}
                  style={{ width: '100%', paddingRight: '42px', fontFamily: 'monospace' }}
                />
                <button
                  type="button"
                  onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                  title={showOpenaiKey ? 'Ẩn' : 'Hiện'}
                >
                  {showOpenaiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* OpenAI API Base URL (Dành cho Proxy hoặc tài khoản đại lý) */}
            <div className="control-group" style={{ marginBottom: '16px' }}>
              <label className="control-label" style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Globe size={14} />
                OpenAI Base URL (Tùy chọn dành cho Proxy / Cổng đại lý trung gian)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="https://api.openai.com/v1"
                value={openaiBaseUrl}
                onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                Nếu dùng key chính hãng OpenAI, để nguyên <code>https://api.openai.com/v1</code>. Nếu mua key qua đại lý API, điền URL cổng proxy do đại lý cung cấp.
              </span>
            </div>
          </div>
        )}

        {/* NÚT THAO TÁC: TEST KEY & LƯU CẤU HÌNH */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleTestKey}
            disabled={testing}
          >
            {testing ? <RefreshCw size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {testing ? 'Đang kiểm tra kết nối…' : `Kiểm tra kết nối (${provider.toUpperCase()})`}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveSettings}
            disabled={saving}
          >
            <Save size={15} />
            {saving ? 'Đang lưu…' : 'Lưu cấu hình API'}
          </button>
        </div>
      </div>

      {/* 3. HƯỚNG DẪN HỖ TRỢ NGƯỜI DÙNG */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.5)',
        border: '1px dashed var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
        fontSize: '0.85rem',
        lineHeight: '1.6',
        color: 'var(--text-secondary)'
      }}>
        {provider === 'gemini' ? (
          <div>
            <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
              💡 Cách lấy Google Gemini API Key hoàn toàn miễn phí:
            </div>
            <ol style={{ paddingLeft: '20px', margin: '0 0 10px 0' }}>
              <li>Truy cập vào <strong>Google AI Studio</strong> bằng tài khoản Gmail.</li>
              <li>Bấm nút <strong>"Create API key"</strong> và sao chép chuỗi key (dạng <code>AIzaSy...</code>).</li>
              <li>Dán vào ô trên và bấm <strong>"Lưu cấu hình API"</strong>.</li>
            </ol>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', textDecoration: 'none', fontWeight: '600' }}
            >
              <span>Mở Google AI Studio để lấy Key</span>
              <ExternalLink size={14} />
            </a>
          </div>
        ) : (
          <div>
            <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
              💡 Lưu ý quan trọng khi dùng khóa OpenAI ChatGPT:
            </div>
            <ul style={{ paddingLeft: '20px', margin: '0' }}>
              <li>Nếu là key chính hãng OpenAI, key sẽ bắt đầu bằng <code>sk-...</code> hoặc <code>sk-proj-...</code>.</li>
              <li>Nếu bạn mua key qua các trang đại lý trung gian (OneAPI, AiHub, v.v.), hãy chắc chắn điền đúng <strong>OpenAI Base URL</strong> mà trang web bán key cung cấp (ví dụ: <code>https://api.yourproxy.com/v1</code>).</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
