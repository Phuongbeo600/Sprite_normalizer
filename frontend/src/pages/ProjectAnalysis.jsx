// 1. THƯ VIỆN NỀN TẢNG REACT
// React dựng biểu mẫu và giải phóng đường dẫn ảnh xem trước khi cần.
import React, { useEffect, useState } from 'react';

// 2. THƯ VIỆN BÊN NGOÀI
// Các biểu tượng dùng cho thao tác chọn ảnh và phân tích.
import { FolderOpen, ScanSearch, Sparkles } from 'lucide-react';

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN

// 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC
// Kiểu trình bày dùng chung được nạp từ điểm khởi động ứng dụng.

/**
 * Hiển thị ảnh tham chiếu, thông số và các vùng kết quả prompt.
 * @returns {React.ReactElement} Màn hình phân tích của dự án đang mở.
 */
export default function ProjectAnalysis() {
  const [reference, setReference] = useState(null);

  useEffect(() => {
    if (!reference) return;
    return () => URL.revokeObjectURL(reference.url);
  }, [reference]);

  /**
   * Tạo đường dẫn xem trước cho ảnh tham chiếu vừa chọn.
   * @param {React.ChangeEvent<HTMLInputElement>} event Sự kiện chọn tệp ảnh.
   * @returns {void} Cập nhật tên và đường dẫn ảnh xem trước.
   */
  const handleReferenceChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setReference({ name: file.name, url: URL.createObjectURL(file) });
    }
    event.target.value = '';
  };

  return (
    <div className="analysis-layout">
      <section className="analysis-panel" aria-labelledby="reference-title">
        <h2 id="reference-title">Bước 1. Nhân vật tham chiếu</h2>
        <div className="analysis-actions">
          <label className="analysis-file">
            <FolderOpen size={17} aria-hidden="true" />
            Chọn sprite mẫu
            <input type="file" accept="image/*" onChange={handleReferenceChange} />
          </label>
          <button type="button" disabled><ScanSearch size={17} /> Quét giải phẫu</button>
        </div>

        <figure className="analysis-preview">
          {reference
            ? <img src={reference.url} alt={reference.name} />
            : <span>Ảnh tham chiếu sẽ hiện ở đây</span>}
        </figure>

        <div className="analysis-options">
          <label><input type="checkbox" disabled /> Vẽ lớp phủ đo lường</label>
          <label><input type="checkbox" disabled /> Dùng Gemini Vision</label>
          <button type="button" disabled>Quét lại</button>
        </div>
        <h3>Kết quả đo lường giải phẫu</h3>
        <p className="analysis-result">
          {reference ? `Đã chọn ${reference.name}. Đang chờ tích hợp phân tích.` : 'Chọn ảnh nhân vật mẫu để xem trước.'}
        </p>
      </section>

      <section className="analysis-panel" aria-labelledby="prompt-title">
        <h2 id="prompt-title">Bước 2. Yêu cầu và tạo prompt</h2>
        <div className="analysis-fields">
          <label>Đầu nhân vật mới
            <select defaultValue="same">
              <option value="same">Bằng nhân vật mẫu</option>
              <option value="larger">Lớn hơn nhân vật mẫu</option>
              <option value="smaller">Nhỏ hơn nhân vật mẫu</option>
            </select>
          </label>
          <label>Chiều rộng thân
            <select defaultValue="same">
              <option value="same">Bằng nhân vật mẫu</option>
              <option value="wider">Rộng hơn nhân vật mẫu</option>
              <option value="narrower">Hẹp hơn nhân vật mẫu</option>
            </select>
          </label>
          <label>Chiều cao thân
            <select defaultValue="same">
              <option value="same">Bằng nhân vật mẫu</option>
              <option value="taller">Cao hơn nhân vật mẫu</option>
              <option value="shorter">Thấp hơn nhân vật mẫu</option>
            </select>
          </label>
          <label>Ý tưởng nhân vật
            <input type="text" placeholder="Nhập ý tưởng nhân vật" />
          </label>
        </div>
        <button type="button" className="analysis-generate" disabled>
          <Sparkles size={18} /> Phân tích tỉ lệ và tạo prompt
        </button>
        <p className="analysis-result">Chưa có phân tích phong cách hoặc kế hoạch tỉ lệ.</p>
        <div className="analysis-output-title">
          <h3 id="positive-prompt-title">Positive Prompt</h3>
          <button type="button" disabled>Sao chép</button>
        </div>
        <textarea aria-labelledby="positive-prompt-title" rows={8} readOnly placeholder="Chưa có prompt" />
        <div className="analysis-output-title">
          <h3 id="negative-prompt-title">Negative Prompt</h3>
          <button type="button" disabled>Sao chép</button>
        </div>
        <textarea aria-labelledby="negative-prompt-title" rows={3} readOnly placeholder="Chưa có prompt" />
      </section>
    </div>
  );
}
