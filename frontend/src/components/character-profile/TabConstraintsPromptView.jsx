// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon minh họa bảo vệ ràng buộc, sao chép prompt và cảnh báo lỗi
import { ShieldCheck, ShieldAlert, Sparkles, Copy, Check, Info } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không có component nội bộ phụ thuộc)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa các lớp CSS từ theme.css

/**
 * Phân hệ 4: Ràng buộc Tính nhất quán & Phòng tạo Prompt AI (ConsistencyAnalysis & Prompt Studio).
 * - Hiển thị các đặc điểm bất biến cần bảo tồn tuyệt đối.
 * - Hiển thị danh sách điều cấm kỵ (Negative Constraints): lỗi tạo hình, nhiễu pixel, trượt chân.
 * - Cung cấp biểu mẫu sinh Prompt AI (Midjourney / DALL-E / Stable Diffusion) kế thừa phong cách từ hồ sơ.
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object|null} props.consistency Dữ liệu phân tích tính nhất quán (ConsistencyAnalysis).
 * @param {Object|null} props.negativeConstraints Dữ liệu ràng buộc phủ định (NegativeConstraints).
 * @param {Object} props.fullProfile Toàn bộ hồ sơ nhân vật phục vụ sinh prompt.
 * @param {Function} props.onGeneratePrompt Hàm gọi API sinh prompt từ profile.
 * @param {boolean} props.generatingPrompt Trạng thái đang gọi API sinh prompt.
 * @param {Object|null} props.generatedPromptResult Kết quả prompt đã sinh.
 * @returns {React.ReactElement} Giao diện hiển thị chi tiết.
 */
export default function TabConstraintsPromptView({
  consistency,
  negativeConstraints,
  fullProfile,
  onGeneratePrompt,
  generatingPrompt,
  generatedPromptResult
}) {
  // Trạng thái nhập ý tưởng nhân vật mới và hướng mục tiêu
  const [concept, setConcept] = useState('Chiến binh Pixel Art cầm khiên phong trần');
  const [targetDir, setTargetDir] = useState('Front / Down view');

  // Trạng thái sao chép prompt
  const [copiedPos, setCopiedPos] = useState(false);
  const [copiedNeg, setCopiedNeg] = useState(false);

  /**
   * Sao chép đoạn văn bản vào bộ nhớ tạm Clipboard.
   * 
   * @param {string} text Nội dung cần chép.
   * @param {string} type 'positive' hoặc 'negative'.
   */
  const handleCopy = (text, type) => {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* ========================================================
          1. PHÒNG TẠO PROMPT AI TỪ HỒ SƠ (PROMPT STUDIO)
          ======================================================== */}
      <section className="profile-section-card" style={{ borderColor: 'var(--accent-purple-glow)' }}>
        <h4 style={{ color: 'var(--text-white)' }}>
          <Sparkles size={16} color="var(--accent-purple)" />
          Phòng tạo Prompt AI Tối ưu (Dựa trên Hồ sơ nhân vật tham chiếu)
        </h4>

        <div className="analysis-fields">
          <label>
            Ý tưởng nhân vật mới:
            <input
              type="text"
              value={concept}
              placeholder="VD: Nữ cung thủ tóc bạc mặc áo choàng xanh ngọc..."
              onChange={(e) => setConcept(e.target.value)}
            />
          </label>

          <label>
            Góc nhìn mục tiêu:
            <select value={targetDir} onChange={(e) => setTargetDir(e.target.value)}>
              <option value="Front / Down view">Down - Nhìn từ trước (Front View)</option>
              <option value="Side Profile view">Side - Nhìn ngang (Side View)</option>
              <option value="Back / Up view">Up - Nhìn từ sau (Back View)</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          className="analysis-generate"
          disabled={generatingPrompt || !fullProfile}
          onClick={() => onGeneratePrompt(concept, targetDir)}
          style={{ marginTop: '4px' }}
        >
          <Sparkles size={16} />
          {generatingPrompt ? 'Đang tổng hợp Prompt từ hồ sơ…' : 'Sinh Prompt AI Đồng Bộ Tỷ Lệ & Phong Cách'}
        </button>

        {/* Kết quả Prompt đã sinh */}
        {generatedPromptResult && (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Positive Prompt */}
            <div>
              <div className="analysis-output-title">
                <h3 style={{ fontSize: '0.85rem', color: '#10b981' }}>Positive Prompt (Cho Midjourney / DALL-E)</h3>
                <button
                  type="button"
                  onClick={() => handleCopy(generatedPromptResult.positive_prompt, 'positive')}
                  style={{ minHeight: '30px', padding: '4px 8px', fontSize: '0.75rem' }}
                >
                  {copiedPos ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                  {copiedPos ? 'Đã chép!' : 'Sao chép'}
                </button>
              </div>
              <textarea
                rows={5}
                readOnly
                value={generatedPromptResult.positive_prompt}
                style={{ fontSize: '0.8rem', lineHeight: '1.4' }}
              />
            </div>

            {/* Negative Prompt */}
            <div>
              <div className="analysis-output-title">
                <h3 style={{ fontSize: '0.85rem', color: '#ef4444' }}>Negative Prompt (Chống lỗi giải phẫu & vỡ nét)</h3>
                <button
                  type="button"
                  onClick={() => handleCopy(generatedPromptResult.negative_prompt, 'negative')}
                  style={{ minHeight: '30px', padding: '4px 8px', fontSize: '0.75rem' }}
                >
                  {copiedNeg ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                  {copiedNeg ? 'Đã chép!' : 'Sao chép'}
                </button>
              </div>
              <textarea
                rows={3}
                readOnly
                value={generatedPromptResult.negative_prompt}
                style={{ fontSize: '0.8rem', lineHeight: '1.4' }}
              />
            </div>

            {/* Ghi chú kỹ thuật */}
            {generatedPromptResult.technical_notes && (
              <div style={{
                fontSize: '0.775rem',
                padding: '8px 10px',
                background: 'rgba(99, 102, 241, 0.08)',
                borderLeft: '3px solid var(--accent-purple)',
                borderRadius: '4px',
                color: 'var(--text-highlight)',
                lineHeight: '1.4'
              }}>
                <Info size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                <strong>Ghi chú kỹ thuật: </strong>
                {generatedPromptResult.technical_notes}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ========================================================
          2. RÀNG BUỘC BẤT BIẾN CẦN BẢO TỒN (PRESERVATION REQUIREMENTS)
          ======================================================== */}
      {consistency && (
        <section className="profile-section-card">
          <h4>
            <ShieldCheck size={16} color="#10b981" />
            Đặc điểm Bất biến & Yêu cầu Bảo tồn (Preservation Requirements)
          </h4>

          {consistency.invariant_features && consistency.invariant_features.length > 0 && (
            <div>
              <strong style={{ fontSize: '0.725rem', color: '#10b981', textTransform: 'uppercase' }}>
                Đặc điểm giữ nguyên giữa các frame (Invariants):
              </strong>
              <div className="profile-tag-list" style={{ marginTop: '4px' }}>
                {consistency.invariant_features.map((feat, idx) => (
                  <span key={idx} className="profile-tag success">✓ {feat}</span>
                ))}
              </div>
            </div>
          )}

          {consistency.preservation_requirements && consistency.preservation_requirements.length > 0 && (
            <div style={{ marginTop: '6px' }}>
              <strong style={{ fontSize: '0.725rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Yêu cầu bảo toàn khi tạo nhân vật mới:
              </strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: '18px', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                {consistency.preservation_requirements.map((req, idx) => (
                  <li key={idx} style={{ marginBottom: '2px' }}>{req}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ========================================================
          3. RÀNG BUỘC PHỦ ĐỊNH CẤM KỴ (NEGATIVE CONSTRAINTS)
          ======================================================== */}
      {negativeConstraints && (
        <section className="profile-section-card">
          <h4>
            <ShieldAlert size={16} color="#ef4444" />
            Những điều cấm kỵ & Lỗi cần tránh (Negative Constraints)
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {negativeConstraints.forbidden_design_changes && negativeConstraints.forbidden_design_changes.length > 0 && (
              <div>
                <strong style={{ fontSize: '0.725rem', color: '#ef4444', textTransform: 'uppercase' }}>
                  Biến dạng thiết kế bị cấm:
                </strong>
                <div className="profile-tag-list" style={{ marginTop: '4px' }}>
                  {negativeConstraints.forbidden_design_changes.map((c, idx) => (
                    <span key={idx} className="profile-tag warning">⛔ {c}</span>
                  ))}
                </div>
              </div>
            )}

            {negativeConstraints.visual_defects_to_avoid && negativeConstraints.visual_defects_to_avoid.length > 0 && (
              <div>
                <strong style={{ fontSize: '0.725rem', color: '#ef4444', textTransform: 'uppercase' }}>
                  Lỗi đồ họa pixel cần tránh:
                </strong>
                <div className="profile-tag-list" style={{ marginTop: '4px' }}>
                  {negativeConstraints.visual_defects_to_avoid.map((d, idx) => (
                    <span key={idx} className="profile-tag warning">⚠️ {d}</span>
                  ))}
                </div>
              </div>
            )}

            {negativeConstraints.animation_defects_to_avoid && negativeConstraints.animation_defects_to_avoid.length > 0 && (
              <div>
                <strong style={{ fontSize: '0.725rem', color: '#ef4444', textTransform: 'uppercase' }}>
                  Lỗi chuyển động cần tránh:
                </strong>
                <div className="profile-tag-list" style={{ marginTop: '4px' }}>
                  {negativeConstraints.animation_defects_to_avoid.map((a, idx) => (
                    <span key={idx} className="profile-tag warning">🏃 {a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
