// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT
// ========================================================
// React tạo các phần tử trong cây giao diện.
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI
// ========================================================
// lucide-react cung cấp biểu tượng cho các nút thao tác.
import { Play, Pause } from "lucide-react";

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// ========================================================
// getAuthHeaders: Đính kèm JWT Bearer Token khi tải danh sách frame thuộc dự án có chủ sở hữu.
import { getAuthHeaders } from '../../shared/api/authHeaders.js';
import ProtectedAssetImage from './ProtectedAssetImage';


// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC
// ========================================================

/**
 * Component hiển thị danh sách các frame con cắt rời kèm phát thử hoạt họa mini.
 */
export default function SpriteFramesViewer({ spriteId, frameCount }) {
  const [frames, setFrames] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [activeFrameIdx, setActiveFrameIdx] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);

  React.useEffect(() => {
    let cancel = false;
    fetch(`/api/sprites/${spriteId}/frames`, { headers: getAuthHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancel && data && data.frames) {
          setFrames(data.frames);
        }
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => { cancel = true; };
  }, [spriteId]);

  React.useEffect(() => {
    if (!isPlaying || frames.length === 0) return;
    const interval = setInterval(() => {
      setActiveFrameIdx((prev) => (prev + 1) % frames.length);
    }, 1000 / 6);
    return () => clearInterval(interval);
  }, [isPlaying, frames]);

  if (loading) {
    return <div style={{ fontSize: '0.8rem', color: '#a39bc2', padding: '10px 0' }}>Đang nạp danh sách frame con…</div>;
  }

  if (frames.length === 0) return null;

  return (
    <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <strong style={{ fontSize: '0.82rem', color: '#c084fc', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>🎞️ Khung hình hoạt họa ({frames.length} frame):</span>
        </strong>
        <button
          type="button"
          className="atelier-assets-btn-sub"
          onClick={() => setIsPlaying(!isPlaying)}
          style={{ padding: '4px 10px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          {isPlaying ? <Pause size={12} /> : <Play size={12} />}
          <span>{isPlaying ? 'Tạm dừng' : 'Phát thử mini'}</span>
        </button>
      </div>

      {isPlaying && frames[activeFrameIdx] && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#07050e',
          borderRadius: '8px',
          padding: '8px',
          marginBottom: '10px',
          border: '1px solid #7c3aed'
        }}>
          <ProtectedAssetImage
            src={frames[activeFrameIdx].image_url}
            alt={frames[activeFrameIdx].frame_name}
            style={{ maxHeight: '90px', imageRendering: 'pixelated' }}
          />
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(46px, 1fr))',
        gap: '6px',
        maxHeight: '120px',
        overflowY: 'auto',
        padding: '4px',
        backgroundColor: 'rgba(0,0,0,0.25)',
        borderRadius: '6px'
      }}>
        {frames.map((f, idx) => (
          <div
            key={f.id}
            title={`${f.frame_name} (#${f.frame_index})`}
            onClick={() => setActiveFrameIdx(idx)}
            style={{
              cursor: 'pointer',
              border: idx === activeFrameIdx ? '1px solid #c084fc' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: '4px',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#07050e'
            }}
          >
            <ProtectedAssetImage
              src={f.image_url}
              alt={f.frame_name}
              style={{ maxWidth: '38px', maxHeight: '38px', objectFit: 'contain', imageRendering: 'pixelated' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
