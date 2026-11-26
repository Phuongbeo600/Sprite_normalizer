// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT
// ========================================================
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)
// ========================================================

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Cấu hình 11 thông số)
// ========================================================
import { ANATOMY_METRIC_BY_KEY } from '../manualAnatomyConfig';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Sử dụng biến CSS theme.css)
// ========================================================

/** Tọa độ minh họa tương đối trên hình nhân vật chuẩn SVG viewBox 0 0 140 190. */
const GUIDE_SHAPES = {
  body_height: { points: [[18, 16], [18, 174]], colorVar: '--measure-yellow', hint: 'Đỉnh → Gót' },
  head_height: { points: [[96, 16], [96, 52]], colorVar: '--measure-red', hint: 'Đỉnh → Cằm' },
  head_width: { points: [[52, 34], [88, 34]], colorVar: '--measure-red', hint: 'Mép đầu' },
  torso_height: { points: [[98, 56], [98, 112]], colorVar: '--measure-orange', hint: 'Cổ → Hông' },
  torso_width: { points: [[51, 82], [89, 82]], colorVar: '--measure-orange', hint: 'Thân giữa' },
  shoulder_width: { points: [[42, 60], [98, 60]], colorVar: '--measure-green', hint: 'Vai trái → phải' },
  hip_width: { points: [[49, 110], [91, 110]], colorVar: '--measure-green', hint: 'Hông trái → phải' },
  arm_length: { points: [[42, 62], [30, 88], [26, 112]], colorVar: '--measure-blue', hint: 'Vai → Khuỷu → Tay' },
  arm_width: { points: [[24, 83], [36, 89]], colorVar: '--measure-blue', hint: 'Bề dày tay' },
  leg_length: { points: [[57, 112], [53, 143], [51, 172]], colorVar: '--measure-purple', hint: 'Hông → Gối → Chân' },
  leg_width: { points: [[46, 141], [60, 141]], colorVar: '--measure-purple', hint: 'Bề dày chân' },
};

/**
 * Hình minh họa SVG hướng dẫn vị trí đặt điểm đo cho từng thông số giải phẫu.
 *
 * @param {Object} props Thông số đang được chọn trên bảng điều khiển.
 * @param {string} props.activeMetric Khóa thông số hiện tại (vd: 'body_height').
 * @returns {React.ReactElement} Khối hướng dẫn trực quan theo thông số đang chọn.
 */
export default function AnatomyGuideIllustration({ activeMetric }) {
  const metricMeta = ANATOMY_METRIC_BY_KEY[activeMetric] || ANATOMY_METRIC_BY_KEY.body_height;
  const activeGuide = GUIDE_SHAPES[metricMeta.key] || GUIDE_SHAPES.body_height;
  const activeColor = `var(${activeGuide.colorVar})`;

  const toPolylinePoints = (pts) => pts.map(([x, y]) => `${x},${y}`).join(' ');

  return (
    <div className="manual-guide-card" aria-label="Hướng dẫn vị trí đo giải phẫu">
      <div className="manual-guide-visual">
        <svg viewBox="0 0 140 190" className="manual-guide-svg" role="img" aria-label={`Minh họa đo ${metricMeta.label}`}>
          {/* Đường mặt đất tham chiếu */}
          <line x1="12" y1="174" x2="128" y2="174" className="manual-guide-ground" />

          {/* Hình bóng nhân vật hai chân chuẩn */}
          <g className="manual-guide-silhouette">
            {/* Đầu */}
            <circle cx="70" cy="34" r="18" />
            {/* Cổ */}
            <rect x="64" y="51" width="12" height="7" rx="2" />
            {/* Thân */}
            <path d="M44 58 L96 58 L90 112 L50 112 Z" />
            {/* Tay trái (gập nhẹ để minh họa đo qua khớp) */}
            <path d="M44 60 L35 64 L25 89 L21 112 L31 114 L36 92 L45 72 Z" />
            {/* Tay phải */}
            <path d="M96 60 L105 64 L112 90 L114 113 L104 114 L101 92 L95 72 Z" />
            {/* Chân trái */}
            <path d="M51 112 L67 112 L61 144 L58 174 L46 174 L48 143 Z" />
            {/* Chân phải */}
            <path d="M73 112 L89 112 L92 143 L94 174 L82 174 L79 144 Z" />
          </g>

          {/* Đường mờ gợi ý các bộ phận khác */}
          {Object.entries(GUIDE_SHAPES).map(([key, shape]) => {
            if (key === metricMeta.key) return null;
            return (
              <polyline
                key={key}
                points={toPolylinePoints(shape.points)}
                fill="none"
                stroke={`var(${shape.colorVar})`}
                strokeWidth="1.5"
                strokeDasharray="3 3"
                opacity="0.22"
              />
            );
          })}

          {/* Đường đo nổi bật cho thông số đang chọn */}
          <polyline
            points={toPolylinePoints(activeGuide.points)}
            fill="none"
            stroke={activeColor}
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {activeGuide.points.map(([x, y], index) => (
            <g key={index}>
              <circle cx={x} cy={y} r="4.5" fill={activeColor} />
              <circle cx={x} cy={y} r="2" fill="var(--atl-text-pure)" />
            </g>
          ))}
        </svg>
      </div>

      <div className="manual-guide-info">
        <div className="manual-guide-badge-row">
          <span className="manual-color-dot" style={{ backgroundColor: activeColor }} />
          <strong>{metricMeta.label}</strong>
        </div>
        <span className="manual-guide-kind">
          {metricMeta.kindLabel} • {activeGuide.hint}
        </span>
        <p className="manual-guide-desc">{metricMeta.guideText}</p>
      </div>
    </div>
  );
}
