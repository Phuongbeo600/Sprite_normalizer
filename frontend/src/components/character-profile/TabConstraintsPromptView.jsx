// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon minh họa bảo vệ ràng buộc, sao chép prompt và cảnh báo lỗi
import { ShieldCheck, ShieldAlert, Sparkles, Copy, Check, Info, Sliders, Wand2 } from 'lucide-react';

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
 * - Cung cấp biểu mẫu tạo nhân vật MỚI tự do theo ý người dùng (không bị gán cứng vào hiệp sĩ cũ).
 * - Cho phép nhập trang phục, dải màu, vũ khí, vóc dáng riêng của nhân vật mới.
 * - Kế thừa quy chuẩn kỹ thuật (kích thước khung game, nét vẽ, số mức bóng) từ nhân vật tham chiếu.
 * - Hiển thị các ràng buộc bất biến và danh sách điều cấm kỵ (Negative Constraints).
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
  // Trạng thái các trường thông tin của NHÂN VẬT MỚI (Tự do sáng tạo)
  const [concept, setConcept] = useState('Nữ pháp sư bóng đêm bí ẩn');
  const [outfitAndColors, setOutfitAndColors] = useState('Áo choàng nhung tím đen viền chỉ vàng kim');
  const [weaponsAndProps, setWeaponsAndProps] = useState('Tay phải cầm trượng phép đính ngọc xanh');
  const [statureRule, setStatureRule] = useState('Bằng nhân vật gốc (Tỷ lệ chuẩn)');
  const [targetDir, setTargetDir] = useState('Front / Down view');

  // Các tùy chọn kế thừa quy chuẩn kỹ thuật từ nhân vật cũ
  const [inheritScale, setInheritScale] = useState(true);
  const [inheritStyle, setInheritStyle] = useState(true);

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

  /**
   * Kích hoạt sinh Prompt cho nhân vật mới với các tùy chỉnh riêng biệt.
   */
  const handleSubmitGenerate = () => {
    onGeneratePrompt({
      core_concept: concept,
      outfit_and_colors: outfitAndColors,
      weapons_and_props: weaponsAndProps,
      stature_rule: statureRule,
      target_direction: targetDir,
      inherit_scale: inheritScale,
      inherit_style: inheritStyle,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* ========================================================
          1. PHÒNG TẠO PROMPT AI CHO NHÂN VẬT MỚI (PROMPT STUDIO)
          ======================================================== */}
      <section className="profile-section-card" style={{ borderColor: 'var(--accent-purple-glow)' }}>
        <h4 style={{ color: 'var(--text-white)' }}>
          <Wand2 size={16} color="var(--accent-purple)" />
          Tạo Prompt cho Nhân vật Mới (Không bị gán cứng vào nhân vật cũ)
        </h4>
        <p style={{ margin: '0 0 6px', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
          Nhập tự do yêu cầu của nhân vật mới (Pháp sư, Slime, Ninja...). Hệ thống sẽ tự động ghép phong cách pixel và tỷ lệ kích thước game từ nhân vật mẫu vào nhân vật này.
        </p>

        <div className="analysis-fields">
          <label>
            Ý tưởng cốt lõi (Concept):
            <input
              type="text"
              value={concept}
              placeholder="VD: Nữ pháp sư bóng đêm, Slime độc xanh, Ninja áo đen..."
              onChange={(e) => setConcept(e.target.value)}
            />
          </label>

          <label>
            Trang phục & Dải màu riêng:
            <input
              type="text"
              value={outfitAndColors}
              placeholder="VD: Áo choàng tím đen viền vàng, Giáp da sờn rách..."
              onChange={(e) => setOutfitAndColors(e.target.value)}
            />
          </label>

          <label>
            Vũ khí & Đạo cụ riêng:
            <input
              type="text"
              value={weaponsAndProps}
              placeholder="VD: Cầm trượng phép đính ngọc, Song kiếm, hoặc Tay không..."
              onChange={(e) => setWeaponsAndProps(e.target.value)}
            />
          </label>

          <label>
            Vóc dáng nhân vật mới:
            <select value={statureRule} onChange={(e) => setStatureRule(e.target.value)}>
              <option value="Bằng nhân vật gốc (Tỷ lệ chuẩn)">Bằng nhân vật mẫu (Tỷ lệ chuẩn như cũ)</option>
              <option value="To hơn nhân vật gốc (Chibi hơn)">Lớn hơn nhân vật mẫu (Chibi đầu to hơn)</option>
              <option value="Nhỏ hơn nhân vật gốc (Dáng cao hơn)">Nhỏ hơn nhân vật mẫu (Dáng cao thanh mảnh)</option>
              <option value="Rộng hơn nhân vật gốc (Cơ bắp)">Rộng hơn nhân vật mẫu (Cơ bắp / Đậm người)</option>
              <option value="Hẹp hơn nhân vật gốc (Thon gọn)">Hẹp hơn nhân vật mẫu (Thon gọn / Nhẹ nhàng)</option>
            </select>
          </label>

          <label>
            Góc nhìn mục tiêu:
            <select value={targetDir} onChange={(e) => setTargetDir(e.target.value)}>
              <option value="Front / Down view">Down - Nhìn từ trước (Front View)</option>
              <option value="Side Profile view">Side - Nhìn ngang (Side View 90°)</option>
              <option value="Back / Up view">Up - Nhìn từ sau lưng (Back View)</option>
            </select>
          </label>

          {/* Các công tắc kế thừa kỹ thuật */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', padding: '6px 0', fontSize: '0.8rem' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={inheritScale}
                onChange={(e) => setInheritScale(e.target.checked)}
              />
              <span>🔒 <strong>Khóa tỷ lệ game</strong> (Vào game không to không bé)</span>
            </label>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={inheritStyle}
                onChange={(e) => setInheritStyle(e.target.checked)}
              />
              <span>🎨 <strong>Đồng bộ nét vẽ pixel</strong> (Viền & Đổ bóng như cũ)</span>
            </label>
          </div>
        </div>

        <button
          type="button"
          className="btn-primary-studio"
          disabled={generatingPrompt || !fullProfile}
          onClick={handleSubmitGenerate}
          style={{ width: '100%', marginTop: '10px', minHeight: '42px', fontSize: '0.9rem' }}
        >
          <Sparkles size={17} />
          {generatingPrompt ? 'Đang tổng hợp Prompt cho nhân vật mới…' : 'Sinh Prompt AI Tối Ưu Cho Nhân Vật Mới'}
        </button>

        {/* Kết quả Prompt đã sinh */}
        {generatedPromptResult && (
          <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Positive Prompt */}
            <div className="studio-prompt-output-card">
              <div className="studio-prompt-output-header">
                <h4 style={{ color: '#10b981' }}>
                  <Sparkles size={14} color="#10b981" />
                  Positive Prompt (Midjourney v6 / SDXL / DALL-E)
                </h4>
                <button
                  type="button"
                  className="btn-ghost-studio"
                  onClick={() => handleCopy(generatedPromptResult.positive_prompt, 'positive')}
                  style={{ color: copiedPos ? '#10b981' : 'var(--text-muted)' }}
                >
                  {copiedPos ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                  {copiedPos ? 'Đã chép!' : 'Sao chép'}
                </button>
              </div>
              <textarea
                className="studio-prompt-textarea"
                rows={5}
                readOnly
                value={generatedPromptResult.positive_prompt}
              />
            </div>

            {/* Negative Prompt */}
            <div className="studio-prompt-output-card">
              <div className="studio-prompt-output-header">
                <h4 style={{ color: '#ef4444' }}>
                  <ShieldAlert size={14} color="#ef4444" />
                  Negative Prompt (Khử nhiễu & Chống lỗi pixel)
                </h4>
                <button
                  type="button"
                  className="btn-ghost-studio"
                  onClick={() => handleCopy(generatedPromptResult.negative_prompt, 'negative')}
                  style={{ color: copiedNeg ? '#10b981' : 'var(--text-muted)' }}
                >
                  {copiedNeg ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                  {copiedNeg ? 'Đã chép!' : 'Sao chép'}
                </button>
              </div>
              <textarea
                className="studio-prompt-textarea"
                rows={3}
                readOnly
                value={generatedPromptResult.negative_prompt}
              />
            </div>

            {/* Ghi chú kỹ thuật */}
            {generatedPromptResult.technical_notes && (
              <div style={{
                fontSize: '0.775rem',
                padding: '10px 12px',
                background: 'rgba(99, 102, 241, 0.08)',
                borderLeft: '3px solid var(--accent-purple)',
                borderRadius: '6px',
                color: 'var(--text-highlight)',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap'
              }}>
                <Info size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />
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
