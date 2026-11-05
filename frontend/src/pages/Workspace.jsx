import React, { useState } from 'react';
import { Upload, Play, Download, RefreshCw, ZoomIn } from 'lucide-react';

export default function Workspace({ currentProject }) {
  const [targetWidth, setTargetWidth] = useState(64);
  const [targetHeight, setTargetHeight] = useState(64);
  const [anchor, setAnchor] = useState('bottom_center');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewOriginal, setPreviewOriginal] = useState(null);
  const [previewNormalized, setPreviewNormalized] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewOriginal(URL.createObjectURL(file));
      setPreviewNormalized(null);
    }
  };

  const handleNormalize = async () => {
    if (!selectedFile) {
      alert('Vui lòng chọn hoặc tải lên một ảnh sprite trước!');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('target_width', targetWidth);
    formData.append('target_height', targetHeight);
    formData.append('anchor', anchor);

    try {
      const response = await fetch('/api/normalize', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Không thể xử lý sprite qua API');
      }

      const blob = await response.blob();
      setPreviewNormalized(URL.createObjectURL(blob));
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối tới backend FastAPI (/api/normalize). Hãy chắc chắn backend đã được khởi động.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ padding: '20px 24px', height: 'calc(100vh - 64px)' }}>
      <div className="workspace-layout">
        {/* Canvas Display Viewport */}
        <div className="workspace-canvas-panel">
          <div className="canvas-header">
            <div>
              <strong>{currentProject ? currentProject.name : 'Workspace Trực Quan'}</strong>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Target: {targetWidth}x{targetHeight}px | Anchor: {anchor}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {previewNormalized && (
                <a
                  href={previewNormalized}
                  download="normalized_sprite.png"
                  className="btn btn-secondary"
                  style={{ textDecoration: 'none' }}
                >
                  <Download size={15} /> Tải ảnh
                </a>
              )}
            </div>
          </div>

          <div className="canvas-viewport">
            {!previewOriginal && !previewNormalized ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                <Upload size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
                <p>Kéo thả ảnh Sprite vào đây hoặc chọn từ bảng điều khiển bên phải</p>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
                {previewOriginal && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', marginBottom: '8px', color: 'var(--text-secondary)' }}>
                      ẢNH GỐC
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <img
                        src={previewOriginal}
                        alt="Original"
                        style={{ maxWidth: '160px', maxHeight: '160px', objectFit: 'contain', imageRendering: 'pixelated' }}
                      />
                    </div>
                  </div>
                )}

                {previewNormalized && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', marginBottom: '8px', color: '#10b981', fontWeight: 600 }}>
                      KẾT QUẢ CHUẨN HÓA (CORE MVC)
                    </div>
                    <div style={{ padding: '12px', background: 'rgba(0,0,0,0.4)', borderRadius: '8px', border: '1px solid #10b981' }}>
                      <img
                        src={previewNormalized}
                        alt="Normalized"
                        style={{ width: `${targetWidth * 2}px`, height: `${targetHeight * 2}px`, objectFit: 'contain', imageRendering: 'pixelated' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Controller Form */}
        <div className="workspace-control-panel">
          <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
            Thông số chuẩn hóa
          </h3>

          <div className="control-group">
            <label className="control-label">Tải lên Sprite</label>
            <input
              type="file"
              accept="image/png, image/jpeg, image/webp"
              onChange={handleFileChange}
              className="input-field"
              style={{ cursor: 'pointer' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="control-group">
              <label className="control-label">Chiều rộng (W)</label>
              <input
                type="number"
                value={targetWidth}
                onChange={(e) => setTargetWidth(Number(e.target.value))}
                className="input-field"
                min={16}
                max={512}
                step={8}
              />
            </div>
            <div className="control-group">
              <label className="control-label">Chiều cao (H)</label>
              <input
                type="number"
                value={targetHeight}
                onChange={(e) => setTargetHeight(Number(e.target.value))}
                className="input-field"
                min={16}
                max={512}
                step={8}
              />
            </div>
          </div>

          <div className="control-group">
            <label className="control-label">Điểm neo (Anchor Point)</label>
            <select
              className="select-field"
              value={anchor}
              onChange={(e) => setAnchor(e.target.value)}
            >
              <option value="bottom_center">Dưới - Giữa (Bottom Center)</option>
              <option value="center">Chính giữa (Center)</option>
              <option value="top_left">Góc trên - Trái (Top Left)</option>
            </select>
          </div>

          <div className="control-group">
            <label className="control-label">Tùy chọn xử lý</label>
            <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked /> Tự động cắt viền alpha (Auto Trim)
            </label>
            <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input type="checkbox" defaultChecked /> Giữ nguyên tỉ lệ góc (Keep Aspect Ratio)
            </label>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 'auto', padding: '12px' }}
            onClick={handleNormalize}
            disabled={loading}
          >
            {loading ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
            {loading ? 'Đang chạy thuật toán...' : 'Chạy chuẩn hóa (Execute Core)'}
          </button>
        </div>
      </div>
    </div>
  );
}
