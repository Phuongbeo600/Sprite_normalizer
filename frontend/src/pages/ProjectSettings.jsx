// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState, useEffect } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon minh họa chìa khóa, kiểm tra thành công, cảnh báo, lưu, làm mới và công tắc nguồn
import {
  Key,
  CheckCircle2,
  AlertCircle,
  Save,
  RefreshCw,
  Sliders,
  ExternalLink,
  Eye,
  EyeOff,
  Bot,
  Power,
  Lock,
  Sparkles
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không có component nội bộ phụ thuộc)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa các lớp CSS từ theme.css

/**
 * Màn hình Cài đặt Cấu hình API của Dự án (Project API Configuration).
 * Quản lý chìa khóa API (Google Gemini / OpenAI ChatGPT) độc lập cho từng dự án:
 * - Bật / Tắt toàn bộ tính năng gọi API AI (Khi tắt: khóa tất cả nút AI trên toàn ứng dụng).
 * - Tự động kiểm tra trong CSDL MySQL xem dự án này đã có API Key chưa.
 * - Nếu đã có: Hiển thị trạng thái "Đã có API Key" (dạng masked an toàn) kèm nút "Thay đổi Key".
 * - Cho phép chuyển đổi nhà cung cấp và lưu key mới trực tiếp vào MySQL của dự án.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object} props.currentProject Dự án hiện tại đang mở (chứa id, name).
 * @param {Function} [props.onAiEnabledChange] Callback thông báo trạng thái bật/tắt AI lên ứng dụng.
 * @returns {React.ReactElement} Giao diện cài đặt API của dự án.
 */
export default function ProjectSettings({ currentProject, onAiEnabledChange }) {
  // Trạng thái bật/tắt chức năng AI của toàn bộ dự án
  const [aiEnabled, setAiEnabled] = useState(true);

  // Lựa chọn nhà cung cấp AI: 'gemini' | 'openai'
  const [provider, setProvider] = useState('gemini');

  // Trạng thái Google Gemini của dự án này
  const [geminiHasKey, setGeminiHasKey] = useState(false);
  const [geminiMaskedKey, setGeminiMaskedKey] = useState('');
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [showGeminiInput, setShowGeminiInput] = useState(false);

  // Trạng thái OpenAI của dự án này
  const [openaiHasKey, setOpenaiHasKey] = useState(false);
  const [openaiMaskedKey, setOpenaiMaskedKey] = useState('');
  const [openaiKeyInput, setOpenaiKeyInput] = useState('');
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState('https://api.openai.com/v1');
  const [showOpenaiInput, setShowOpenaiInput] = useState(false);

  // Trạng thái hiển thị mật khẩu
  const [showPassword, setShowPassword] = useState(false);

  // Trạng thái tải và lưu
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingAi, setTogglingAi] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }

  // Tải cấu hình API của dự án từ MySQL khi mở trang
  useEffect(() => {
    if (currentProject?.id) {
      fetchProjectApiConfig();
    }
  }, [currentProject?.id]);

  /**
   * Gọi API GET /api/projects/{id}/api-config để đọc cấu hình từ CSDL MySQL.
   */
  const fetchProjectApiConfig = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/projects/${currentProject.id}/api-config`);
      if (!response.ok) {
        throw new Error('Không thể đọc cấu hình API của dự án.');
      }
      const resJson = await response.json();
      const data = resJson.data || {};

      const isEnabled = data.ai_enabled !== false;
      setAiEnabled(isEnabled);
      if (onAiEnabledChange) {
        onAiEnabledChange(isEnabled);
      }

      setProvider(data.api_provider || 'gemini');
      setGeminiHasKey(Boolean(data.gemini_has_key));
      setGeminiMaskedKey(data.gemini_masked_key || '');
      setOpenaiHasKey(Boolean(data.openai_has_key));
      setOpenaiMaskedKey(data.openai_masked_key || '');
      if (data.openai_base_url) {
        setOpenaiBaseUrl(data.openai_base_url);
      }

      // Nếu chưa có key thì tự động mở ô input
      setShowGeminiInput(!data.gemini_has_key);
      setShowOpenaiInput(!data.openai_has_key);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi kết nối máy chủ.' });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Xử lý công tắc Bật/Tắt chức năng AI:
   * Tự động lưu tức thì vào CSDL MySQL và cập nhật trạng thái toàn ứng dụng.
   * 
   * @param {boolean} nextState Trạng thái kích hoạt mới (true: bật, false: tắt).
   */
  const handleToggleAi = async (nextState) => {
    setTogglingAi(true);
    setAiEnabled(nextState);
    if (onAiEnabledChange) {
      onAiEnabledChange(nextState);
    }

    try {
      const payload = {
        api_provider: provider,
        openai_base_url: openaiBaseUrl.trim() || 'https://api.openai.com/v1',
        ai_enabled: nextState
      };

      const response = await fetch(`/api/projects/${currentProject.id}/api-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.detail || 'Không thể lưu trạng thái AI vào MySQL.');
      }

      setFeedback({
        type: 'success',
        message: nextState
          ? 'Đã BẬT chức năng AI thành công! Các nút gọi API AI trên toàn dự án đã sẵn sàng.'
          : 'Đã TẮT chức năng AI thành công! Toàn bộ nút gọi API AI trong dự án đã bị khóa an toàn.'
      });
    } catch (err) {
      // Hoàn tác nếu có lỗi
      setAiEnabled(!nextState);
      if (onAiEnabledChange) {
        onAiEnabledChange(!nextState);
      }
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi cập nhật trạng thái AI.' });
    } finally {
      setTogglingAi(false);
    }
  };

  /**
   * Lưu cấu hình API Key mới vào CSDL MySQL của dự án.
   */
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);

    const payload = {
      api_provider: provider,
      gemini_api_key: geminiKeyInput.trim() || undefined,
      openai_api_key: openaiKeyInput.trim() || undefined,
      openai_base_url: openaiBaseUrl.trim() || 'https://api.openai.com/v1',
      ai_enabled: aiEnabled
    };

    try {
      const response = await fetch(`/api/projects/${currentProject.id}/api-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || 'Không thể lưu cấu hình API vào MySQL.');
      }

      setFeedback({
        type: 'success',
        message: 'Đã lưu cấu hình API Key thành công vào cơ sở dữ liệu MySQL của dự án này!'
      });

      // Tải lại để cập nhật masked key
      setGeminiKeyInput('');
      setOpenaiKeyInput('');
      fetchProjectApiConfig();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi lưu cấu hình.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="studio-workspace-container" style={{ padding: '0 4px', maxWidth: '720px', margin: '0 auto' }}>
      {/* ========================================================
          1. THANH TIÊU ĐỀ CÀI ĐẶT DỰ ÁN
          ======================================================== */}
      <header className="studio-header-card">
        <div className="studio-title-group">
          <h1>
            <Sliders size={22} color="var(--accent-purple)" />
            Cài Đặt Cấu Hình API Cho Dự Án
          </h1>
          <p>
            Chìa khóa API dưới đây được lưu vĩnh viễn trong CSDL MySQL của riêng dự án: <strong>{currentProject?.name}</strong>.
          </p>
        </div>

        <button
          type="button"
          className="btn-secondary-studio"
          onClick={fetchProjectApiConfig}
          disabled={loading}
          style={{ minHeight: '34px', fontSize: '0.8rem', gap: '6px' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Làm mới
        </button>
      </header>

      {/* Thông báo kết quả thao tác */}
      {feedback && (
        <div
          className="analysis-result"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '16px',
            background: feedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
            borderColor: feedback.type === 'success' ? '#10b981' : '#ef4444',
            color: feedback.type === 'success' ? '#34d399' : '#f87171'
          }}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* ========================================================
          2. CÔNG TẮC BẬT / TẮT TOÀN BỘ TÍNH NĂNG AI CHO DỰ ÁN
          ======================================================== */}
      <section
        className="studio-metric-card"
        style={{
          padding: '20px 24px',
          borderRadius: '12px',
          marginBottom: '20px',
          border: `1px solid ${aiEnabled ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
          background: aiEnabled
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(19, 27, 46, 0.95) 100%)'
            : 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(19, 27, 46, 0.95) 100%)',
          transition: 'all 0.3s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 300px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: aiEnabled ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: aiEnabled ? '#10b981' : '#ef4444',
                flexShrink: 0
              }}
            >
              <Power size={22} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '0.975rem', color: 'var(--text-white)', fontWeight: 600 }}>
                  Công Tắc Kích Hoạt Tính Năng AI
                </h3>
                <span
                  style={{
                    fontSize: '0.725rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: 600,
                    background: aiEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: aiEnabled ? '#34d399' : '#f87171',
                    border: `1px solid ${aiEnabled ? '#10b981' : '#ef4444'}`
                  }}
                >
                  {aiEnabled ? '🟢 ĐANG BẬT AI' : '🔴 ĐÃ TẮT AI'}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                {aiEnabled
                  ? 'Toàn bộ các nút gọi API sinh ảnh AI và phân tích phong cách đang được kích hoạt và sẵn sàng sử dụng.'
                  : 'Toàn bộ nút gọi API AI trong dự án (Tạo ảnh AI, Cố vấn phong cách AI) đã bị khóa an toàn để tránh gọi API.'}
              </p>
            </div>
          </div>

          {/* Nút bấm chuyển trạng thái Toggle ON/OFF */}
          <button
            type="button"
            disabled={togglingAi || loading}
            onClick={() => handleToggleAi(!aiEnabled)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '24px',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: togglingAi ? 'wait' : 'pointer',
              border: `1px solid ${aiEnabled ? '#10b981' : '#6b7280'}`,
              transition: 'all 0.25s ease',
              background: aiEnabled ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '#374151',
              color: '#ffffff',
              boxShadow: aiEnabled ? '0 0 16px rgba(16, 185, 129, 0.35)' : 'none',
              flexShrink: 0
            }}
            title={aiEnabled ? 'Nhấn để tắt toàn bộ tính năng AI của dự án' : 'Nhấn để bật lại tính năng AI cho dự án'}
          >
            <Power size={16} className={togglingAi ? 'spin' : ''} />
            <span>{aiEnabled ? 'Đang Bật AI (Bấm để Tắt)' : 'Đang Tắt AI (Bấm để Bật)'}</span>
          </button>
        </div>

        {/* Thông báo chi tiết khi TẮT AI */}
        {!aiEnabled && (
          <div
            style={{
              marginTop: '14px',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
              fontSize: '0.775rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Lock size={15} flexShrink={0} />
            <span>
              <strong>Chế độ an toàn đang bật:</strong> Mọi nút bấm tạo ảnh AI, phân tích phong cách AI trong dự án này đã bị vô hiệu hóa. Bạn vẫn có thể điền và lưu chìa khóa API bên dưới, khi nào cần dùng chỉ cần bấm nút <strong>"Đang Tắt AI (Bấm để Bật)"</strong> ở trên.
            </span>
          </div>
        )}
      </section>

      {/* ========================================================
          3. FORM CẤU HÌNH API KEY CỦA DỰ ÁN
          ======================================================== */}
      <form onSubmit={handleSaveConfig} className="studio-metric-card" style={{ padding: '24px', borderRadius: '12px' }}>
        {/* Chọn nhà cung cấp AI */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.825rem', color: 'var(--text-white)', fontWeight: 600, marginBottom: '8px' }}>
            Nhà cung cấp AI mặc định cho dự án:
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: `1px solid ${provider === 'gemini' ? 'var(--accent-purple)' : 'var(--border-panel)'}`,
              background: provider === 'gemini' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(0, 0, 0, 0.2)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              color: 'var(--text-white)'
            }}>
              <input
                type="radio"
                name="provider"
                value="gemini"
                checked={provider === 'gemini'}
                onChange={() => setProvider('gemini')}
              />
              Google Gemini (Đề xuất - Miễn phí)
            </label>

            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '8px',
              border: `1px solid ${provider === 'openai' ? 'var(--accent-purple)' : 'var(--border-panel)'}`,
              background: provider === 'openai' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(0, 0, 0, 0.2)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              color: 'var(--text-white)'
            }}>
              <input
                type="radio"
                name="provider"
                value="openai"
                checked={provider === 'openai'}
                onChange={() => setProvider('openai')}
              />
              OpenAI
            </label>
          </div>
        </div>

        {/* Khối cấu hình Google Gemini */}
        {provider === 'gemini' && (
          <div className="profile-section-card" style={{ marginBottom: '20px' }}>
            <h4 style={{ color: 'var(--text-white)', fontSize: '0.9rem', marginBottom: '12px' }}>
              <Key size={16} color="var(--accent-purple)" />
              Google Gemini API Key
            </h4>

            {/* Trạng thái key hiện tại trong MySQL */}
            {geminiHasKey && !showGeminiInput ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '8px',
                marginBottom: '10px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.825rem', fontWeight: 600 }}>
                    <CheckCircle2 size={15} />
                    <span>Dự án này đã có API Key trong MySQL</span>
                  </div>
                  <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                    Khóa hiện tại: {geminiMaskedKey}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary-studio"
                  onClick={() => setShowGeminiInput(true)}
                  style={{ fontSize: '0.75rem', padding: '5px 10px', minHeight: '28px' }}
                >
                  Thay đổi Key
                </button>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  {geminiHasKey ? 'Nhập khóa API mới để thay thế khóa hiện tại:' : 'Nhập Google Gemini API Key cho dự án này:'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={geminiKeyInput}
                    placeholder="Dán mã khóa AIzaSy... vào đây"
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 12px',
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
                      cursor: 'pointer'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {geminiHasKey && (
                  <button
                    type="button"
                    onClick={() => { setShowGeminiInput(false); setGeminiKeyInput(''); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '6px', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Hủy thay đổi (Giữ nguyên khóa cũ)
                  </button>
                )}
              </div>
            )}
            <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
              Chưa có khóa? Lấy miễn phí tại{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-purple)' }}>
                Google AI Studio <ExternalLink size={11} style={{ display: 'inline' }} />
              </a>
            </p>
          </div>
        )}

        {/* Khối cấu hình OpenAI ChatGPT */}
        {provider === 'openai' && (
          <div className="profile-section-card" style={{ marginBottom: '20px' }}>
            <h4 style={{ color: 'var(--text-white)', fontSize: '0.9rem', marginBottom: '12px' }}>
              <Key size={16} color="var(--accent-purple)" />
              OpenAI API Key
            </h4>

            {openaiHasKey && !showOpenaiInput ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '8px',
                marginBottom: '10px'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '0.825rem', fontWeight: 600 }}>
                    <CheckCircle2 size={15} />
                    <span>Dự án này đã có OpenAI API Key trong MySQL</span>
                  </div>
                  <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                    Khóa hiện tại: {openaiMaskedKey}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-secondary-studio"
                  onClick={() => setShowOpenaiInput(true)}
                  style={{ fontSize: '0.75rem', padding: '5px 10px', minHeight: '28px' }}
                >
                  Thay đổi Key
                </button>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  {openaiHasKey ? 'Nhập khóa OpenAI mới để thay thế khóa hiện tại:' : 'Nhập OpenAI API Key cho dự án này:'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={openaiKeyInput}
                    placeholder="Dán mã khóa sk-... vào đây"
                    onChange={(e) => setOpenaiKeyInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 40px 10px 12px',
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
                      cursor: 'pointer'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {openaiHasKey && (
                  <button
                    type="button"
                    onClick={() => { setShowOpenaiInput(false); setOpenaiKeyInput(''); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '6px', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Hủy thay đổi (Giữ nguyên khóa cũ)
                  </button>
                )}
              </div>
            )}

            {/* Base URL Proxy nếu có */}
            <div style={{ marginTop: '14px' }}>
              <label style={{ display: 'block', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                OpenAI Base URL (Tùy chọn nếu dùng Proxy / Cloudflare):
              </label>
              <input
                type="text"
                value={openaiBaseUrl}
                placeholder="https://api.openai.com/v1"
                onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--border-panel)',
                  borderRadius: '6px',
                  color: 'var(--text-white)',
                  fontSize: '0.8rem'
                }}
              />
            </div>
          </div>
        )}

        {/* Nút lưu cấu hình */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="submit"
            className="btn-primary-studio"
            disabled={saving || loading}
            style={{ minHeight: '38px', padding: '8px 20px', fontSize: '0.85rem', fontWeight: 600 }}
          >
            <Save size={15} className={saving ? 'spin' : ''} />
            {saving ? 'Đang lưu vào MySQL…' : 'Lưu Cấu hình vào Dự án'}
          </button>
        </div>
      </form>
    </div>
  );
}
