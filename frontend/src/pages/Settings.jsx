import React, { useState } from 'react';
import { Save, Sliders, Cpu, Database } from 'lucide-react';

export default function Settings() {
  const [fastapiUrl, setFastapiUrl] = useState('http://127.0.0.1:8000');
  const [defaultSize, setDefaultSize] = useState('64x64');
  const [algorithmMode, setAlgorithmMode] = useState('numpy_pillow');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="page-container" style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '6px' }}>Cấu hình hệ thống & thuật toán</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Tùy chỉnh thông số mặc định cho quá trình chuẩn hóa Sprite và kết nối backend MVC/FastAPI.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Backend Endpoint */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <Database size={20} color="#6366f1" />
            <h3 style={{ fontSize: '1.05rem' }}>Kết nối Backend API</h3>
          </div>
          <div className="control-group">
            <label className="control-label">FastAPI Base URL</label>
            <input
              type="text"
              className="input-field"
              value={fastapiUrl}
              onChange={(e) => setFastapiUrl(e.target.value)}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Đường dẫn máy chủ API FastAPI (mặc định cổng 8000).
            </span>
          </div>
        </div>

        {/* Algorithm Settings */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <Cpu size={20} color="#6366f1" />
            <h3 style={{ fontSize: '1.05rem' }}>Tham số thuật toán Sprite Normalizer</h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="control-group">
              <label className="control-label">Độ phân giải mặc định</label>
              <select
                className="select-field"
                value={defaultSize}
                onChange={(e) => setDefaultSize(e.target.value)}
              >
                <option value="16x16">16 x 16 (Retro 8-bit)</option>
                <option value="32x32">32 x 32 (Standard 16-bit)</option>
                <option value="64x64">64 x 64 (HD Pixel Art)</option>
                <option value="128x128">128 x 128 (High Res)</option>
              </select>
            </div>

            <div className="control-group">
              <label className="control-label">Động cơ xử lý (Core Engine)</label>
              <select
                className="select-field"
                value={algorithmMode}
                onChange={(e) => setAlgorithmMode(e.target.value)}
              >
                <option value="numpy_pillow">Pillow + NumPy Vectorized</option>
                <option value="opencv">OpenCV (Bounding Box & Contour)</option>
                <option value="custom_mvc">Custom MVC Algorithm</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          {saved && (
            <span style={{ color: 'var(--success)', alignSelf: 'center', fontSize: '0.875rem' }}>
              ✓ Đã lưu cấu hình thành công!
            </span>
          )}
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={16} /> Lưu cấu hình
          </button>
        </div>
      </div>
    </div>
  );
}
