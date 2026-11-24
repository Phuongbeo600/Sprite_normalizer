// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon minh họa bảo vệ ràng buộc, sao chép prompt, bảng màu, lưu và cảnh báo lỗi
import { ShieldCheck, ShieldAlert, Sparkles, Check, Wand2, Bookmark, Layers, Languages, Loader2, Undo2, Palette } from "lucide-react";

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// FrameActionMatrixEditor: Trình soạn thảo trực quan 15 frame hoạt họa chân tay đối nghịch
import FrameActionMatrixEditor from './FrameActionMatrixEditor';
// MasterColorSpecCard: Khung To Nhất hiển thị và chỉnh sửa bảng màu sắc cốt lõi
import MasterColorSpecCard from './MasterColorSpecCard';
// PromptOutputCard: Thẻ hiển thị câu prompt xuất bản kèm nút sao chép
import PromptOutputCard from './PromptOutputCard';
// translateBatch: Hàm gọi API dịch thuật offline không tốn API key
// PixelArtIcons: Biểu tượng hoa văn rune cổ và hình bóng lâu đài pixel
import { PixelCastleWatermark, PixelRune } from '../../../shared/ui/PixelArtIcons';
// promptDefaults: Hằng số Negative Prompt và các hàm biên dịch prompt

// Phiên dữ liệu và thao tác được quản lý trong hook của tính năng.
import { usePromptDraft } from './usePromptDraft';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// analysis-atelier.css: Hệ thống phong cách Dark Fantasy Atelier huyền bí & chuyên nghiệp
import '../analysis-atelier.css';

/**
 * Phân hệ 4: Ràng buộc Tính nhất quán & Phòng tạo Prompt AI (ConsistencyAnalysis & Prompt Studio).
 * Tích hợp Ma trận 15 Frame Hoạt Họa Pixel Art (3 Hướng × 5 Frame chuyển động chân tay đối nghịch).
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object|null} props.consistency Dữ liệu phân tích tính nhất quán (ConsistencyAnalysis).
 * @param {Object|null} props.negativeConstraints Dữ liệu ràng buộc phủ định (NegativeConstraints).
 * @param {Object} props.fullProfile Toàn bộ hồ sơ nhân vật phục vụ sinh prompt.
 * @param {Object|null} props.measuredGeometry Số đo hình học dùng khi kế thừa vóc dáng.
 * @param {Function} props.onGeneratePrompt Hàm gọi API sinh prompt từ profile.
 * @param {boolean} props.generatingPrompt Trạng thái đang gọi API sinh prompt.
 * @param {Object|null} props.generatedPromptResult Kết quả prompt đã sinh.
 * @param {Function} props.onSavePreset Hàm lưu preset vào CSDL MySQL của dự án.
 * @param {boolean} props.savingPreset Trạng thái đang lưu.
 * @param {string} props.saveSuccessMsg Thông báo lưu thành công.
 * @param {Object} props.initialConfig Cấu hình nạp lại từ thư viện hồ sơ đã lưu.
 * @param {Function} [props.onSendPromptToImageGen] Hàm điều hướng gửi câu prompt sang tab Tạo ảnh AI.
 * @returns {React.ReactElement} Giao diện hiển thị chi tiết theo phong cách Dark Fantasy Atelier.
 */
export default function TabConstraintsPromptView({
  consistency,
  negativeConstraints,
  fullProfile,
  measuredGeometry,
  onSavePreset,
  savingPreset,
  saveSuccessMsg,
  initialConfig,
  onSendPromptToImageGen,
  referenceFile = null
}) {
  const {
    concept, setConcept, outfitAndColors, setOutfitAndColors, weaponsAndProps, setWeaponsAndProps, statureRule, setStatureRule, targetDir, vietnameseBackup, translatingInputs, frameActions, setInheritScale, setInheritStyle, setReusePalette, palette, referenceStyle, stylePrompt, hasPalette, hasGeometry, hasStyle, keepsStyle, keepsScale, keepsPalette, defaultMasterColorPrompt, masterColorPrompt, setMasterColorPrompt, liveNegativePrompt, appliedReference, handleChangeFrame, handleResetDirection, handleTranslateInputsToEnglish, handleRestoreVietnameseInputs, livePositivePrompt
  } = usePromptDraft({ initialConfig, fullProfile, measuredGeometry });

  return (
    <div className="atelier-prompt-studio-root">
      {/* ========================================================
          1. PHÒNG TẠO PROMPT AI CHO NHÂN VẬT MỚI (PROMPT STUDIO)
          ======================================================== */}
      <section className="atelier-prompt-studio-card" style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Dấu ấn Pixel Art: Ký tự Rune ma thuật góc card & Hình bóng lâu đài chìm hậu cảnh */}
        <PixelRune size={18} className="pixel-corner-rune pixel-corner-top-right" />
        <PixelCastleWatermark width={220} height={110} style={{ position: 'absolute', bottom: '12px', right: '16px', opacity: 0.045, pointerEvents: 'none' }} />

        {/* Tiêu đề & mô tả phân hệ tạo prompt */}
        <div className="atelier-prompt-card-header">
          <div>
            <h4 className="atelier-prompt-card-title">
              <Wand2 size={20} color="#c084fc" />
              <span>Bộ Tạo Prompt Sprite Sheet 3x5 (Ma Trận 15 Frame Hoạt Họa)</span>
            </h4>
            <p className="atelier-prompt-card-desc">
              Mô tả nhân vật mới và chọn các đặc điểm muốn dùng từ sprite mẫu. Hệ thống tự động ráp prompt chuẩn xác từ dữ liệu phân tích.
            </p>
          </div>
        </div>

        {/* Lưới các trường nhập liệu nhân vật mới */}
        <div className="atelier-prompt-fields-grid">
          <div className="atelier-prompt-field">
            <label className="atelier-prompt-field-label">
              Bạn muốn vẽ nhân vật gì?
            </label>
            <input
              type="text"
              className="atelier-prompt-input"
              value={concept}
              placeholder="VD: Nữ pháp sư bóng đêm, Ninja áo đen, Slime độc..."
              onChange={(e) => setConcept(e.target.value)}
            />
          </div>

          <div className="atelier-prompt-field">
            <label className="atelier-prompt-field-label">
              Trang phục & Dải màu riêng:
            </label>
            <input
              type="text"
              className="atelier-prompt-input"
              value={outfitAndColors}
              placeholder="VD: Áo choàng nhung tím đen viền chỉ vàng kim, Giáp da sờn rách..."
              onChange={(e) => setOutfitAndColors(e.target.value)}
            />
          </div>

          <div className="atelier-prompt-field">
            <label className="atelier-prompt-field-label">
              Vũ khí & Đạo cụ riêng:
            </label>
            <input
              type="text"
              className="atelier-prompt-input"
              value={weaponsAndProps}
              placeholder="VD: Tay phải cầm trượng phép đính ngọc, Song kiếm, hoặc Tay không..."
              onChange={(e) => setWeaponsAndProps(e.target.value)}
            />
          </div>

          <div className="atelier-prompt-field">
            <label className="atelier-prompt-field-label">
              Vóc dáng nhân vật mới:
            </label>
            <select
              className="atelier-prompt-select"
              value={statureRule}
              onChange={(e) => setStatureRule(e.target.value)}
            >
              <option value="Bằng nhân vật gốc (Tỷ lệ chuẩn)">Bằng nhân vật mẫu (Tỷ lệ chuẩn như cũ)</option>
              <option value="To hơn nhân vật gốc (Chibi hơn)">Lớn hơn nhân vật mẫu (Chibi đầu to hơn)</option>
              <option value="Nhỏ hơn nhân vật gốc (Dáng cao hơn)">Nhỏ hơn nhân vật mẫu (Dáng cao thanh mảnh)</option>
              <option value="Rộng hơn nhân vật gốc (Cơ bắp)">Rộng hơn nhân vật mẫu (Cơ bắp / Đậm người)</option>
              <option value="Hẹp hơn nhân vật gốc (Thon gọn)">Hẹp hơn nhân vật mẫu (Thon gọn / Nhẹ nhàng)</option>
            </select>
          </div>

          {/* Nút dịch đồng bộ các ô mô tả tiếng Việt sang tiếng Anh */}
          <div className="atelier-prompt-translate-row">
            <button
              type="button"
              className="atelier-prompt-btn-translate"
              onClick={handleTranslateInputsToEnglish}
              disabled={translatingInputs}
              title="Dịch 3 ô mô tả tiếng Việt sang tiếng Anh bằng AI offline để câu Prompt hoàn toàn đồng nhất tiếng Anh"
            >
              {translatingInputs ? (
                <Loader2 size={13} className="spin" />
              ) : (
                <Languages size={13} />
              )}
              <span>{translatingInputs ? 'Đang dịch sang English…' : 'Dịch mô tả sang English (Đồng nhất Prompt)'}</span>
            </button>

            {vietnameseBackup && (
              <button
                type="button"
                className="atelier-matrix-dir-btn"
                onClick={handleRestoreVietnameseInputs}
                title="Khôi phục lại nội dung tiếng Việt ban đầu"
                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
              >
                <Undo2 size={13} />
                <span>Hoàn tác Tiếng Việt</span>
              </button>
            )}

            <span style={{ fontSize: '0.72rem', color: 'var(--atl-text-muted, #7c7299)' }}>
              (Mô hình AI Offline cục bộ · 0 token · Không cần mạng/API key)
            </span>
          </div>

          {/* Các công tắc kế thừa kỹ thuật từ mẫu gốc */}
          <div className="atelier-prompt-checkbox-row">
            <label className={`atelier-prompt-check-pill ${keepsScale ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={keepsScale}
                disabled={!hasGeometry}
                onChange={(e) => setInheritScale(e.target.checked)}
              />
              <span>Cùng vóc dáng mẫu</span>
            </label>

            <label className={`atelier-prompt-check-pill ${keepsStyle ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={keepsStyle}
                disabled={!hasStyle}
                onChange={(e) => setInheritStyle(e.target.checked)}
              />
              <span>Cùng nét vẽ & đổ bóng</span>
            </label>

            <label className={`atelier-prompt-check-pill ${keepsPalette ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={keepsPalette}
                disabled={!hasPalette || !palette.top_hex_list?.length}
                onChange={(event) => setReusePalette(event.target.checked)}
              />
              <span>Dùng lại bảng màu gốc</span>
            </label>
          </div>
        </div>

        {/* Khung tóm tắt thông tin kế thừa từ mẫu và mô tả tự do */}
        <div className="atelier-prompt-summary-box">
          <div>
            <strong>Đang dùng từ mẫu:</strong>{' '}
            {appliedReference.length ? appliedReference.join(' · ') : 'Chưa dùng dữ liệu từ sprite mẫu.'}
          </div>
          <div>
            <strong>Theo mô tả của bạn:</strong>{' '}
            {[concept, outfitAndColors, weaponsAndProps].filter((value) => value?.trim()).join(' · ') || 'Chưa có mô tả.'}
          </div>
        </div>

        {/* Khung xem chỉ dẫn vẽ từ hồ sơ mẫu */}
        {stylePrompt && (
          <details className="atelier-details-card">
            <summary className="atelier-details-summary">
              <Sparkles size={14} color="#c084fc" />
              <span>Chỉ dẫn vẽ từ Hồ sơ mẫu ({referenceStyle?.provider === 'openai' ? 'OpenAI Vision' : 'Gemini Vision'})</span>
            </summary>
            <div style={{ marginTop: '10px', fontSize: '0.8rem', color: '#e2e8f0', lineHeight: 1.5 }}>
              <p style={{ margin: '0 0 8px', fontStyle: 'italic', color: '#c084fc' }}>{stylePrompt}</p>
              {referenceStyle.observations?.length > 0 && (
                <ul style={{ margin: 0, paddingLeft: '18px', color: 'var(--atl-text-secondary, #a39bc2)' }}>
                  {referenceStyle.observations.map((item, index) => (
                    <li key={index} style={{ marginBottom: '3px' }}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        )}

        {/* Khung đặc tả màu sắc cốt lõi (Master Color Spec) */}
        {(keepsStyle || keepsPalette) && defaultMasterColorPrompt && (
          <details className="atelier-details-card">
            <summary className="atelier-details-summary">
              <Palette size={14} color="#c084fc" />
              <span>Chi tiết đặc tả bảng màu trong câu Prompt</span>
            </summary>
            <MasterColorSpecCard
              masterColorPrompt={masterColorPrompt}
              setMasterColorPrompt={setMasterColorPrompt}
              defaultMasterColorPrompt={defaultMasterColorPrompt}
              topHexList={keepsPalette ? palette.top_hex_list : undefined}
            />
          </details>
        )}

        {/* Tiêu đề Ma trận 15 Frame hoạt họa */}
        <div style={{ marginTop: '18px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} color="#38bdf8" />
          <h4 style={{ margin: 0, color: '#ffffff', fontSize: '0.94rem', fontWeight: 700 }}>
            KHUNG DƯỚI: Ma Trận 15 Frame Hoạt Họa (Tuân Thủ Theo Bảng Màu Trên)
          </h4>
        </div>

        {/* Trình soạn thảo Ma trận 15 Frame Hoạt Họa */}
        <FrameActionMatrixEditor
          frameActions={frameActions}
          onChangeFrame={handleChangeFrame}
          onResetDirection={handleResetDirection}
        />

        {/* ========================================================
            3. HIỂN THỊ KẾT QUẢ PROMPT HOÀN CHỈNH (LIVE PREVIEW)
            ======================================================== */}
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Positive Prompt 3 Tầng */}
          <PromptOutputCard
            title="Positive Prompt 3 Tầng (Tự động cập nhật thời gian thực từ 15 Frame)"
            icon={<Sparkles size={15} color="#34d399" />}
            titleColor="#34d399"
            text={livePositivePrompt}
            rows={8}
          />

          {/* Negative Prompt Khử nhiễu & Chống biến dạng */}
          <PromptOutputCard
            title="Negative Prompt (Khử nhiễu, chống biến dạng lưới & bảo tồn pixel)"
            icon={<ShieldAlert size={15} color="#f87171" />}
            titleColor="#f87171"
            text={liveNegativePrompt}
            rows={3}
          />

          {/* Thanh tác vụ: Gửi sang Tạo ảnh AI & Lưu vào CSDL MySQL */}
          {onSavePreset && (
            <div className="atelier-prompt-action-bar">
              <div style={{ fontSize: '0.8rem', color: 'var(--atl-text-secondary, #a39bc2)' }}>
                {saveSuccessMsg ? (
                  <span style={{ color: '#34d399', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Check size={14} /> {saveSuccessMsg}
                  </span>
                ) : (
                  <span>Lưu toàn bộ ma trận 15 frame và câu Prompt này vào Hồ sơ Dự án trong MySQL.</span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {onSendPromptToImageGen && (
                  <button
                    type="button"
                    className="atelier-btn-amber-send"
                    onClick={() => onSendPromptToImageGen(livePositivePrompt, liveNegativePrompt, referenceFile)}
                    title="Gửi câu Prompt kèm trọn bộ Lệnh cấm và ảnh mẫu tham chiếu sang mục Tạo ảnh AI để sinh ảnh trực tiếp"
                  >
                    <Sparkles size={14} color="#facc15" />
                    <span>Gửi sang Tạo ảnh AI</span>
                  </button>
                )}

                <button
                  type="button"
                  className="atelier-btn-purple-save"
                  disabled={savingPreset}
                  onClick={() => onSavePreset({
                    name: `${concept} (Lưới 3x5 - 15 Frames)`,
                    new_character_concept: concept,
                    outfit_and_colors: outfitAndColors,
                    weapons_and_props: weaponsAndProps,
                    stature_rule: statureRule,
                    target_direction: targetDir,
                    frame_actions_data: frameActions,
                    positive_prompt: livePositivePrompt,
                    negative_prompt: liveNegativePrompt
                  })}
                >
                  <Bookmark size={14} className={savingPreset ? 'spin' : ''} />
                  <span>{savingPreset ? 'Đang lưu vào MySQL…' : 'Lưu vào Dự án'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ========================================================
          4. RÀNG BUỘC BẤT BIẾN CẦN BẢO TỒN (PRESERVATION REQUIREMENTS)
          ======================================================== */}
      {consistency && (
        <section className="atelier-constraint-card">
          <h4 className="atelier-constraint-title">
            <ShieldCheck size={18} color="#34d399" />
            <span>Đặc điểm Bất biến & Yêu cầu Bảo tồn (Preservation Requirements)</span>
          </h4>

          {consistency.invariant_features && consistency.invariant_features.length > 0 && (
            <div>
              <strong style={{ fontSize: '0.75rem', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Đặc điểm giữ nguyên giữa các frame (Invariants):
              </strong>
              <div className="atelier-constraint-tag-list">
                {consistency.invariant_features.map((feat, idx) => (
                  <span key={idx} className="atelier-constraint-chip success">✓ {feat}</span>
                ))}
              </div>
            </div>
          )}

          {consistency.preservation_requirements && consistency.preservation_requirements.length > 0 && (
            <div style={{ marginTop: '4px' }}>
              <strong style={{ fontSize: '0.75rem', color: 'var(--atl-text-muted, #7c7299)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Yêu cầu bảo toàn khi tạo nhân vật mới:
              </strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: '20px', fontSize: '0.8rem', color: 'var(--atl-text-secondary, #a39bc2)', lineHeight: 1.5 }}>
                {consistency.preservation_requirements.map((req, idx) => (
                  <li key={idx} style={{ marginBottom: '3px' }}>{req}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ========================================================
          5. RÀNG BUỘC PHỦ ĐỊNH CẤM KỴ (NEGATIVE CONSTRAINTS)
          ======================================================== */}
      {negativeConstraints && (
        <section className="atelier-constraint-card">
          <h4 className="atelier-constraint-title">
            <ShieldAlert size={18} color="#f87171" />
            <span>Những điều cấm kỵ & Lỗi cần tránh (Negative Constraints)</span>
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {negativeConstraints.forbidden_design_changes && negativeConstraints.forbidden_design_changes.length > 0 && (
              <div>
                <strong style={{ fontSize: '0.75rem', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Biến dạng thiết kế bị cấm:
                </strong>
                <div className="atelier-constraint-tag-list">
                  {negativeConstraints.forbidden_design_changes.map((c, idx) => (
                    <span key={idx} className="atelier-constraint-chip warning">⛔ {c}</span>
                  ))}
                </div>
              </div>
            )}

            {negativeConstraints.visual_defects_to_avoid && negativeConstraints.visual_defects_to_avoid.length > 0 && (
              <div>
                <strong style={{ fontSize: '0.75rem', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Lỗi đồ họa pixel cần tránh:
                </strong>
                <div className="atelier-constraint-tag-list">
                  {negativeConstraints.visual_defects_to_avoid.map((d, idx) => (
                    <span key={idx} className="atelier-constraint-chip warning">⚠️ {d}</span>
                  ))}
                </div>
              </div>
            )}

            {negativeConstraints.animation_defects_to_avoid && negativeConstraints.animation_defects_to_avoid.length > 0 && (
              <div>
                <strong style={{ fontSize: '0.75rem', color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Lỗi chuyển động cần tránh:
                </strong>
                <div className="atelier-constraint-tag-list">
                  {negativeConstraints.animation_defects_to_avoid.map((a, idx) => (
                    <span key={idx} className="atelier-constraint-chip warning">🏃 {a}</span>
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
