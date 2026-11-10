// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState, useEffect } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon minh họa hồ sơ đã lưu, sao chép prompt, xem chi tiết, tải lại và xóa
import {
  Bookmark,
  Sparkles,
  Eye,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  FolderOpen,
  ArrowRight,
  Ruler,
  X,
  Clock,
  Layers
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
 * Màn hình Thư viện Hồ sơ đã lưu của Dự án (Project Saved Presets Library).
 * Hiển thị danh sách các bản phân tích chỉ số giải phẫu hình học và Prompt AI
 * được lưu trữ vĩnh viễn trong cơ sở dữ liệu MySQL theo đúng project_id của dự án.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object} props.currentProject Dự án hiện tại đang mở (chứa id, name).
 * @param {Function} props.onLoadPresetToStudio Hàm nạp ngược dữ liệu preset vào Studio để làm việc tiếp.
 * @returns {React.ReactElement} Giao diện danh sách hồ sơ đã lưu.
 */
export default function ProjectSavedPresets({ currentProject, onLoadPresetToStudio }) {
  // Danh sách các bản ghi preset đọc từ MySQL
  const [presets, setPresets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Trạng thái mở Modal xem chi tiết
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [copiedPos, setCopiedPos] = useState(false);
  const [copiedNeg, setCopiedNeg] = useState(false);

  // Tải danh sách hồ sơ khi dự án thay đổi
  useEffect(() => {
    if (currentProject?.id) {
      fetchPresets();
    }
  }, [currentProject?.id]);

  /**
   * Gọi API GET /api/projects/{id}/character-presets để lấy danh sách từ MySQL.
   */
  const fetchPresets = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/projects/${currentProject.id}/character-presets`);
      if (!response.ok) {
        throw new Error('Không thể tải danh sách hồ sơ đã lưu.');
      }
      const resJson = await response.json();
      setPresets(resJson.data || []);
    } catch (err) {
      setError(err.message || 'Lỗi kết nối máy chủ khi đọc hồ sơ đã lưu.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Xóa một bản ghi preset khỏi MySQL.
   * 
   * @param {number} presetId ID bản ghi cần xóa.
   * @param {string} presetName Tên bản ghi.
   */
  const handleDeletePreset = async (presetId, presetName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bản ghi "${presetName}" không?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${currentProject.id}/character-presets/${presetId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Không thể xóa bản ghi khỏi cơ sở dữ liệu.');
      }
      // Cập nhật lại danh sách trên giao diện
      setPresets((prev) => prev.filter((p) => p.id !== presetId));
      if (selectedPreset?.id === presetId) {
        setSelectedPreset(null);
      }
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa bản ghi.');
    }
  };

  /**
   * Xem chi tiết một bản ghi bằng cách gọi API lấy dữ liệu đầy đủ.
   * 
   * @param {number} presetId ID bản ghi cần xem.
   */
  const handleOpenDetail = async (presetId) => {
    try {
      const response = await fetch(`/api/projects/${currentProject.id}/character-presets/${presetId}`);
      if (!response.ok) {
        throw new Error('Không thể tải thông tin chi tiết hồ sơ.');
      }
      const resJson = await response.json();
      setSelectedPreset(resJson.data);
    } catch (err) {
      alert(err.message || 'Lỗi đọc chi tiết.');
    }
  };

  /**
   * Sao chép đoạn văn bản prompt vào clipboard.
   * 
   * @param {string} text Nội dung cần chép.
   * @param {string} type 'positive' hoặc 'negative'.
   */
  const handleCopyText = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'positive') {
      setCopiedPos(true);
      setTimeout(() => setCopiedPos(false), 2000);
    } else {
      setCopiedNeg(true);
      setTimeout(() => setCopiedNeg(false), 2000);
    }
  };

  return (
    <div className="studio-workspace-container" style={{ padding: '0 4px' }}>
      {/* ========================================================
          1. THANH TIÊU ĐỀ THƯ VIỆN HỒ SƠ ĐÃ LƯU
          ======================================================== */}
      <header className="studio-header-card">
        <div className="studio-title-group">
          <h1>
            <Bookmark size={22} color="var(--accent-purple)" />
            Hồ Sơ Đã Lưu Của Dự Án
          </h1>
          <p>
            Danh sách các bản phân tích số đo pixel và Prompt AI thuộc dự án: <strong>{currentProject?.name}</strong>.
          </p>
        </div>

        <button
          type="button"
          className="btn-secondary-studio"
          onClick={fetchPresets}
          disabled={loading}
          style={{ minHeight: '34px', fontSize: '0.8rem', gap: '6px' }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Làm mới
        </button>
      </header>

      {/* Thông báo lỗi nếu có */}
      {error && (
        <div className="analysis-result" style={{ color: '#ef4444', marginBottom: '12px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* ========================================================
          2. DANH SÁCH CÁC THẺ PRESET
          ======================================================== */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-dim)' }}>
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
          <span>Đang tải danh sách hồ sơ từ MySQL…</span>
        </div>
      ) : presets.length === 0 ? (
        <div className="studio-viewport-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Bookmark size={40} color="var(--accent-purple)" style={{ opacity: 0.6, margin: '0 auto 12px' }} />
          <h3 style={{ color: 'var(--text-white)', margin: '0 0 6px' }}>Dự án này chưa có hồ sơ nào được lưu</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', maxWidth: '480px', margin: '0 auto 16px' }}>
            Hãy sang mục <strong>"Phân tích &amp; Prompt"</strong>, nạp sprite mẫu, tạo ý tưởng nhân vật mới và bấm <strong>"Lưu vào Dự án"</strong> để quản lý thư viện tại đây.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '14px',
          marginTop: '6px'
        }}>
          {presets.map((preset) => {
            const metrics = preset.metrics_data || {};
            const height = metrics.anatomical_height || metrics.visible_height;
            const heads = metrics.heads_tall;

            return (
              <div
                key={preset.id}
                className="studio-metric-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid var(--border-panel)',
                  background: 'var(--bg-card)',
                  transition: 'border-color 0.2s ease, transform 0.2s ease'
                }}
              >
                <div>
                  {/* Tiêu đề & Ngày lưu */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h3 style={{ fontSize: '0.95rem', color: 'var(--text-white)', margin: 0, fontWeight: 600 }}>
                      {preset.name}
                    </h3>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={11} />
                      {new Date(preset.created_at).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  {/* Ý tưởng nhân vật mới */}
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent-purple)', fontWeight: 500, marginBottom: '10px' }}>
                    🪄 Concept: {preset.new_character_concept}
                  </div>

                  {/* Các thẻ Tag chỉ số đo lường hình học */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    {height && (
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: 'rgba(16, 185, 129, 0.12)',
                        color: '#34d399',
                        border: '1px solid rgba(16, 185, 129, 0.25)'
                      }}>
                        📏 {height}px
                      </span>
                    )}
                    {heads && (
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: 'rgba(99, 102, 241, 0.12)',
                        color: '#a5b4fc',
                        border: '1px solid rgba(99, 102, 241, 0.25)'
                      }}>
                        👤 {typeof heads === 'number' ? heads.toFixed(1) : heads} đầu
                      </span>
                    )}
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      background: 'rgba(236, 72, 153, 0.12)',
                      color: '#f472b6',
                      border: '1px solid rgba(236, 72, 153, 0.25)'
                    }}>
                      🧭 {preset.target_direction || 'Front View'}
                    </span>
                  </div>
                </div>

                {/* Các nút tác vụ cho từng Card */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '12px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)'
                }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {/* Nút xem chi tiết */}
                    <button
                      type="button"
                      className="btn-secondary-studio"
                      onClick={() => handleOpenDetail(preset.id)}
                      style={{ fontSize: '0.75rem', padding: '5px 9px', minHeight: '28px' }}
                      title="Xem toàn bộ chỉ số và prompt"
                    >
                      <Eye size={13} />
                      Chi tiết
                    </button>

                    {/* Nút tải lại vào Studio */}
                    {onLoadPresetToStudio && (
                      <button
                        type="button"
                        className="btn-secondary-studio"
                        onClick={async () => {
                          // Tải chi tiết đầy đủ trước khi nạp vào studio
                          const res = await fetch(`/api/projects/${currentProject.id}/character-presets/${preset.id}`);
                          if (res.ok) {
                            const json = await res.json();
                            onLoadPresetToStudio(json.data);
                          }
                        }}
                        style={{
                          fontSize: '0.75rem',
                          padding: '5px 9px',
                          minHeight: '28px',
                          color: 'var(--accent-purple)',
                          borderColor: 'var(--accent-purple-glow)'
                        }}
                        title="Đổ toàn bộ số đo và prompt này vào màn hình Studio"
                      >
                        <ArrowRight size={13} />
                        Mở Studio
                      </button>
                    )}
                  </div>

                  {/* Nút xóa bản ghi */}
                  <button
                    type="button"
                    onClick={() => handleDeletePreset(preset.id, preset.name)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-dim)',
                      cursor: 'pointer',
                      padding: '6px',
                      borderRadius: '4px',
                      transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)'; }}
                    title="Xóa bản ghi này khỏi MySQL"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================
          3. MODAL XEM CHI TIẾT TOÀN BỘ SỐ ĐO & PROMPT
          ======================================================== */}
      {selectedPreset && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card-solid, #131722)',
            border: '1px solid var(--accent-purple-glow)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '680px',
            maxHeight: '85vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)'
          }}>
            {/* Header Modal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', color: 'var(--text-white)', margin: '0 0 4px', fontWeight: 600 }}>
                  {selectedPreset.name}
                </h2>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Đã lưu lúc: {new Date(selectedPreset.created_at).toLocaleString('vi-VN')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreset(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Thông tin Cấu hình Nhân vật mới */}
            <div className="profile-section-card" style={{ marginBottom: '12px' }}>
              <h4 style={{ color: 'var(--text-white)', fontSize: '0.85rem' }}>
                <Sparkles size={15} color="var(--accent-purple)" />
                Cấu hình Nhân vật Mới
              </h4>
              <div className="profile-field-grid">
                <div className="profile-field-item">
                  <strong>Ý tưởng cốt lõi</strong>
                  <span>{selectedPreset.new_character_concept}</span>
                </div>
                <div className="profile-field-item">
                  <strong>Góc nhìn mục tiêu</strong>
                  <span>{selectedPreset.target_direction}</span>
                </div>
                {selectedPreset.frame_actions_data && (
                  <div className="profile-field-item">
                    <strong>Đặc tả chuyển động</strong>
                    <span style={{ color: '#a78bfa', fontWeight: 600 }}>Ma trận 15 Frame (Lưới 3x5 đầy đủ Chân &amp; Tay)</span>
                  </div>
                )}
                {selectedPreset.outfit_and_colors && (
                  <div className="profile-field-item">
                    <strong>Trang phục &amp; Màu sắc</strong>
                    <span>{selectedPreset.outfit_and_colors}</span>
                  </div>
                )}
                {selectedPreset.weapons_and_props && (
                  <div className="profile-field-item">
                    <strong>Vũ khí &amp; Đạo cụ</strong>
                    <span>{selectedPreset.weapons_and_props}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bảng Chỉ số Đo lường Hình học (Metrics) */}
            {selectedPreset.metrics_data && (
              <div className="profile-section-card" style={{ marginBottom: '12px' }}>
                <h4 style={{ color: 'var(--text-white)', fontSize: '0.85rem' }}>
                  <Ruler size={15} color="var(--accent-purple)" />
                  Chỉ số Hình học Pixel đã đo
                </h4>
                <div className="studio-metric-grid">
                  <div className="studio-metric-cell">
                    <span className="metric-label">Chiều cao sinh học</span>
                    <span className="metric-val">{selectedPreset.metrics_data.anatomical_height || selectedPreset.metrics_data.visible_height} px</span>
                  </div>
                  <div className="studio-metric-cell">
                    <span className="metric-label">Tỷ lệ dáng</span>
                    <span className="metric-val">1:{typeof selectedPreset.metrics_data.heads_tall === 'number' ? selectedPreset.metrics_data.heads_tall.toFixed(1) : selectedPreset.metrics_data.heads_tall} đầu</span>
                  </div>
                  <div className="studio-metric-cell">
                    <span className="metric-label">Kích thước đầu</span>
                    <span className="metric-val">{selectedPreset.metrics_data.head_w} × {selectedPreset.metrics_data.head_h} px</span>
                  </div>
                  <div className="studio-metric-cell">
                    <span className="metric-label">Kích thước thân</span>
                    <span className="metric-val">{selectedPreset.metrics_data.body_w} × {selectedPreset.metrics_data.body_h} px</span>
                  </div>
                </div>
              </div>
            )}

            {/* Positive Prompt */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '0.8rem', color: '#10b981' }}>Positive Prompt (Câu lệnh tạo ảnh)</strong>
                <button
                  type="button"
                  className="btn-secondary-studio"
                  onClick={() => handleCopyText(selectedPreset.positive_prompt, 'positive')}
                  style={{ fontSize: '0.725rem', padding: '4px 8px', minHeight: '26px' }}
                >
                  {copiedPos ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  {copiedPos ? 'Đã chép' : 'Sao chép'}
                </button>
              </div>
              <textarea
                readOnly
                value={selectedPreset.positive_prompt}
                rows={4}
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid var(--border-panel)',
                  borderRadius: '6px',
                  color: 'var(--text-white)',
                  padding: '8px 10px',
                  fontSize: '0.8rem',
                  lineHeight: '1.4',
                  resize: 'none'
                }}
              />
            </div>

            {/* Negative Prompt */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '0.8rem', color: '#ef4444' }}>Negative Prompt (Bộ lọc loại bỏ lỗi)</strong>
                <button
                  type="button"
                  className="btn-secondary-studio"
                  onClick={() => handleCopyText(selectedPreset.negative_prompt, 'negative')}
                  style={{ fontSize: '0.725rem', padding: '4px 8px', minHeight: '26px' }}
                >
                  {copiedNeg ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  {copiedNeg ? 'Đã chép' : 'Sao chép'}
                </button>
              </div>
              <textarea
                readOnly
                value={selectedPreset.negative_prompt}
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid var(--border-panel)',
                  borderRadius: '6px',
                  color: 'var(--text-muted)',
                  padding: '8px 10px',
                  fontSize: '0.8rem',
                  lineHeight: '1.4',
                  resize: 'none'
                }}
              />
            </div>

            {/* Footer Modal */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {onLoadPresetToStudio && (
                <button
                  type="button"
                  className="btn-primary-studio"
                  onClick={() => {
                    onLoadPresetToStudio(selectedPreset);
                    setSelectedPreset(null);
                  }}
                  style={{ minHeight: '34px', fontSize: '0.8rem', padding: '6px 14px' }}
                >
                  <ArrowRight size={14} />
                  Mở lại trong Studio
                </button>
              )}
              <button
                type="button"
                className="btn-secondary-studio"
                onClick={() => setSelectedPreset(null)}
                style={{ minHeight: '34px', fontSize: '0.8rem' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
