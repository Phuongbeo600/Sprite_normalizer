// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
// Không có phụ thuộc React.

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Các gói cài đặt thêm)
// ========================================================
// lucide-react cung cấp biểu tượng phát và tạm dừng hoạt họa.
import { Pause, Play } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Component và dữ liệu)
// ========================================================
// Không có phụ thuộc nội bộ.

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Tệp kiểu giao diện)
// ========================================================
// Dùng kiểu giao diện chung được nạp bởi Workspace.

const FPS_OPTIONS = [3, 4, 6, 8, 12];

/**
 * Hiển thị các khung hình đã cắt cùng bộ điều khiển phát thử.
 *
 * @param {Object} props Thuộc tính của dải khung hình.
 * @param {Object} props.sheet Kết quả cắt gồm các khung hình, số hàng và số cột.
 * @param {number|null} props.frameIndex Vị trí khung hình đang xem.
 * @param {boolean} props.playing Trạng thái phát thử.
 * @param {number} props.fps Số khung hình mỗi giây.
 * @param {string} props.busy Thông báo thao tác đang chạy, hoặc chuỗi rỗng.
 * @param {Function} props.onTogglePlayback Hàm chuyển giữa phát và tạm dừng.
 * @param {Function} props.onFpsChange Hàm cập nhật tốc độ phát.
 * @param {Function} props.onSelectFrame Hàm chọn khung hình theo vị trí.
 * @returns {React.ReactElement} Dải khung hình của sprite sheet.
 */
export default function WorkspaceTimeline({
  sheet,
  frameIndex,
  playing,
  fps,
  busy,
  onTogglePlayback,
  onFpsChange,
  onSelectFrame,
}) {
  return (
    <section className="atelier-ws-timeline" aria-label="Các frame hoạt họa đã cắt">
      <div className="atelier-timeline-bar">
        <div className="atelier-timeline-controls">
          <button
            className="atelier-btn-play"
            type="button"
            disabled={sheet.frames.length < 2 || Boolean(busy)}
            onClick={onTogglePlayback}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
            <span>{playing ? 'Tạm dừng' : 'Phát thử'}</span>
          </button>

          <div className="atelier-fps-selector">
            <span>Tốc độ:</span>
            <select
              value={fps}
              onChange={(event) => onFpsChange(Number(event.target.value))}
            >
              {FPS_OPTIONS.map((rate) => (
                <option key={rate} value={rate}>
                  {rate} FPS
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ fontSize: '0.78rem', color: '#c084fc', fontWeight: 600 }}>
          {sheet.frames.length} frame · lưới {sheet.rows} × {sheet.columns}
        </div>
      </div>

      <div className="atelier-timeline-reel">
        {sheet.frames.map((item, index) => (
          <button
            className={`atelier-frame-thumb-btn ${frameIndex === index ? 'active' : ''}`}
            type="button"
            key={item.name}
            aria-pressed={frameIndex === index}
            aria-label={`Frame ${index + 1}`}
            onClick={() => onSelectFrame(index)}
          >
            <img src={item.url} alt="" loading="lazy" />
            <span>#{index + 1}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
