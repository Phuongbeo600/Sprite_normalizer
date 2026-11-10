// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState, useEffect, useMemo } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon minh họa bảo vệ ràng buộc, sao chép prompt, bảng màu, lưu và cảnh báo lỗi
import { ShieldCheck, ShieldAlert, Sparkles, Copy, Check, Info, Sliders, Wand2, Bookmark, Save, Layers, Palette } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// FrameActionMatrixEditor: Trình soạn thảo trực quan 15 frame hoạt họa chân tay đối nghịch
import FrameActionMatrixEditor from './FrameActionMatrixEditor';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa các lớp CSS từ theme.css


/**
 * Khởi tạo ma trận 15 frame hoạt họa mặc định từ dữ liệu phân tích 7 Schemas.
 * 
 * @param {Object} profile Toàn bộ hồ sơ nhân vật (fullProfile).
 * @returns {Object} Ma trận 15 frame gồm 3 hướng (down, side, up).
 */
function createDefaultFrameActionsFromProfile(profile) {
  const anatomy = profile?.anatomy || profile?.global_analysis?.anatomy || {};
  const height = anatomy.anatomical_height || 48;
  const headRatio = anatomy.head_to_body_ratio || '1:4.0';
  const anim = profile?.animations?.walk_profile || profile?.animation_analysis?.walk_profile || {};
  const bobbing = anim.vertical_bobbing_pixels || '1px';
  const secondary = anim.secondary_motion || 'subtle cloth and hair momentum sway';

  return {
    down: {
      idle: {
        frame_index: 0,
        label: 'Frame 0: Đứng yên nhìn thẳng (Idle)',
        type: 'static',
        action_prompt: `Front view, static idle stand: perfectly balanced upright posture (${height}px height, ${headRatio} ratio), both feet flat shoulder-width, hands and weapons rested naturally at sides, eyes facing viewer, zero movement.`
      },
      frame_1: {
        frame_index: 1,
        label: 'Frame 1: Chân trái bước + Tay phải vung',
        type: 'dynamic',
        action_prompt: 'Front view walk stride 1: left foot strides firmly forward toward viewer, right leg pushes back; right arm swings forward across chest, left arm swings backward behind hip; natural contrapposto balance.'
      },
      frame_2: {
        frame_index: 2,
        label: 'Frame 2: Chân thu giữa + Tay hạ sườn (Nhún 1px)',
        type: 'dynamic',
        action_prompt: `Front view walk passing pose: feet cross closely under body; both arms drop naturally beside torso; slight vertical bobbing (torso lowers by ${bobbing}); ${secondary}.`
      },
      frame_3: {
        frame_index: 3,
        label: 'Frame 3: Chân phải bước + Tay trái vung (Đổi bên)',
        type: 'dynamic',
        action_prompt: 'Front view walk stride 2: right foot strides firmly forward toward viewer, left leg pushes back; left arm swings forward across chest, right arm swings backward behind hip; opposite limb balance.'
      },
      frame_4: {
        frame_index: 4,
        label: 'Frame 4: Chân thu giữa + Khép vòng lặp',
        type: 'dynamic',
        action_prompt: 'Front view walk passing pose: right foot plants, left foot lifts preparing forward stride; arms return to neutral hip level; body elevates back to baseline height; seamless animation loop.'
      }
    },
    side: {
      idle: {
        frame_index: 0,
        label: 'Frame 0: Đứng yên nhìn ngang (Idle)',
        type: 'static',
        action_prompt: `Strict right profile view (90 degrees), static idle stand: spine straight (${height}px height), feet slightly staggered for 2D depth, weapon held at ready, far arm and leg partially occluded, zero movement.`
      },
      frame_1: {
        frame_index: 1,
        label: 'Frame 1: Sải chân trái + Đánh tay tối đa',
        type: 'dynamic',
        action_prompt: 'Right profile walk stride 1: left leg extends fully forward, right leg trails backward; right arm swings fully forward at chest height, left arm swings backward; dynamic full stride silhouette.'
      },
      frame_2: {
        frame_index: 2,
        label: 'Frame 2: Hai chân chéo + Tay lướt thân (Nhún 1px)',
        type: 'dynamic',
        action_prompt: `Right profile walk passing pose: front leg flat on ground, back leg bends crossing past front leg; both arms swing vertically brushing past hips; torso lowers by ${bobbing}; ${secondary}.`
      },
      frame_3: {
        frame_index: 3,
        label: 'Frame 3: Sải chân phải + Đổi chiều tay tối đa',
        type: 'dynamic',
        action_prompt: 'Right profile walk stride 2: right leg extends fully forward, left leg trails backward; left arm swings fully forward at chest height, right arm swings backward; mirror opposite stride silhouette.'
      },
      frame_4: {
        frame_index: 4,
        label: 'Frame 4: Hai chân chéo + Khép vòng lặp',
        type: 'dynamic',
        action_prompt: 'Right profile walk passing pose: back leg swings forward to cross midline; arms swing vertically past hips; body rises back to baseline height; ready to loop smoothly.'
      }
    },
    up: {
      idle: {
        frame_index: 0,
        label: 'Frame 0: Đứng yên quay lưng (Idle)',
        type: 'static',
        action_prompt: `Direct back view (180 degrees), static idle stand: spine straight (${height}px height), shoulders square, face completely occluded, showing back of head, rear torso, backpack/sheath and shoe soles, zero movement.`
      },
      frame_1: {
        frame_index: 1,
        label: 'Frame 1: Gót trái bước lên + Tay phải vung',
        type: 'dynamic',
        action_prompt: 'Back view walk stride 1: left leg strides upward showing shoe sole and heel, right leg trailing back; right arm swings forward partially occluded by shoulder, left forearm swings visibly backward; clear back silhouette.'
      },
      frame_2: {
        frame_index: 2,
        label: 'Frame 2: Chân thu giữa + Tay hạ sườn (Nhún 1px)',
        type: 'dynamic',
        action_prompt: `Back view walk passing pose: left foot plants, right knee bends lifting upward past left leg; both arms hang neutrally at belt level; torso lowers by ${bobbing}; ${secondary}.`
      },
      frame_3: {
        frame_index: 3,
        label: 'Frame 3: Gót phải bước lên + Tay trái vung (Đổi bên)',
        type: 'dynamic',
        action_prompt: 'Back view walk stride 2: right foot strides upward showing shoe sole and heel, left leg trailing back; left arm swings forward partially occluded by shoulder, right forearm swings visibly backward.'
      },
      frame_4: {
        frame_index: 4,
        label: 'Frame 4: Chân thu giữa + Khép vòng lặp',
        type: 'dynamic',
        action_prompt: 'Back view walk passing pose: right foot plants, left foot lifts forward; arms return to belt level; torso returns to baseline height; seamless loop.'
      }
    }
  };
}

/**
 * Biên dịch câu Prompt 3 Tầng hoàn chỉnh thời gian thực trên giao diện người dùng.
 * 
 * @param {Object} actions Ma trận 15 frame hoạt họa.
 * @param {string} charConcept Ý tưởng nhân vật mới.
 * @param {string} outfit Trang phục và màu sắc.
 * @param {string} props Vũ khí và phụ kiện.
 * @param {Object} profile Dữ liệu phân tích từ 7 Schemas.
 * @returns {string} Chuỗi câu prompt tiếng Anh chuẩn 3 tầng.
 */
function compileLivePrompt(actions, charConcept, outfit, props, profile, customMasterColorPrompt) {
  const anatomy = profile?.anatomy || profile?.global_analysis?.anatomy || {};
  const pixelStyle = profile?.pixel_style || profile?.global_analysis?.pixel_style || {};
  const height = anatomy.anatomical_height || 48;
  const headRatio = anatomy.head_to_body_ratio || '1:4.0';
  const era = pixelStyle.pixel_art_era || '16-bit SNES';
  const outline = pixelStyle.outline_style || 'crisp dark pixel contour';
  const shading = pixelStyle.shading_style || '2-tone cell shading';
  const lighting = pixelStyle.lighting_direction || 'consistent top-left lighting';

  const conceptText = charConcept.trim() || 'game character';
  const outfitText = outfit.trim() ? `, wearing ${outfit.trim()}` : '';
  const propsText = props.trim() ? `, equipped with ${props.trim()}` : '';

  const down = actions?.down || {};
  const side = actions?.side || {};
  const up = actions?.up || {};

  // Trích xuất thông số hệ màu sắc đo được từ ảnh mẫu (Palette Metrics)
  const palette = profile?.palette_metrics || profile?.global_analysis?.palette_metrics;
  const fallbackColorPrompt = palette?.master_color_prompt?.trim() || (
    palette ? (
      `MASTER COLOR & GRAPHIC PALETTE SPECIFICATIONS (STRICTLY HARMONIZED WITH REFERENCE ASSET):\n` +
      `- Color Budget: Strictly indexed ${palette.total_colors || 24}-color palette (${palette.palette_era || era}), primary palette anchors: [${palette.top_hex_list?.slice(0, 8).join(', ') || ''}].\n` +
      `- Shading Architecture: ${palette.shading_style_detected || shading} per surface (${palette.shading_steps || 2} distinct tone levels), strictly zero smooth airbrushing or blurry gradients.\n` +
      `- Hue-Shifting Rule: ${palette.hue_shift_description || 'Straight shading'}.\n` +
      `- Outline Grammar: ${palette.outline_style_detected || outline}, strictly 1-pixel crisp pixel contour without orphan noise.\n` +
      `- Palette Saturation & Contrast: ${palette.saturation_type || 'Standard'}, ${palette.contrast_type || 'High'} curve (${palette.contrast_ratio || 4.5}:1 ratio).\n` +
      `- Background: Isolated on pure transparent background (PNG alpha channel), zero drop shadows on floor.`
    ) : null
  );

  const activeColorPrompt = customMasterColorPrompt?.trim() || fallbackColorPrompt;

  const sections = [];

  // KHUNG TO NHẤT: Quy chuẩn hệ màu sắc và đồ họa Pixel Art
  if (activeColorPrompt) {
    sections.push(activeColorPrompt);
  }

  // TẦNG 1: Danh tính, giải phẫu học và quy chuẩn phong cách
  sections.push(
    `Masterpiece authentic ${era} pixel art sprite sheet of a ${conceptText}${outfitText}${propsText}.\n` +
    `Strict anatomy constraints: exactly ${height} pixels character height, strict ${headRatio} head-to-body proportion.\n` +
    `Rendering specifications: ${outline}, ${shading}, ${lighting}, transparent background, isolated on pure solid transparent background (PNG alpha channel), clean cut-out sprite sheet without background elements or floor shadows.`
  );

  // TẦNG 2: Bố cục lưới ma trận Sprite Sheet 3x5 (15 frames)
  sections.push(
    'SPRITE SHEET GRID LAYOUT (3 Rows x 5 Columns, total 15 frames):\n' +
    '- Row 1: Down / Front facing view (Frame 0: Idle, Frames 1-4: Walk cycle)\n' +
    '- Row 2: Side / Right profile view (Frame 0: Idle, Frames 1-4: Walk cycle)\n' +
    '- Row 3: Up / Back facing view (Frame 0: Idle, Frames 1-4: Walk cycle)\n' +
    'Absolute cross-frame consistency: identical character proportions, clothing details, and color palette across all 15 frames.'
  );

  // TẦNG 3: Ma trận 15 frame hoạt họa chi tiết chuyển động chân tay đối nghịch
  sections.push(
    'DETAILED 15-FRAME ACTION MATRIX:\n' +
    '[ROW 1 - DOWN / FRONT VIEW]:\n' +
    `  - Col 0 (Idle): ${down.idle?.action_prompt || ''}\n` +
    `  - Col 1 (Walk 1): ${down.frame_1?.action_prompt || ''}\n` +
    `  - Col 2 (Walk 2): ${down.frame_2?.action_prompt || ''}\n` +
    `  - Col 3 (Walk 3): ${down.frame_3?.action_prompt || ''}\n` +
    `  - Col 4 (Walk 4): ${down.frame_4?.action_prompt || ''}\n\n` +
    '[ROW 2 - SIDE / RIGHT PROFILE VIEW]:\n' +
    `  - Col 0 (Idle): ${side.idle?.action_prompt || ''}\n` +
    `  - Col 1 (Walk 1): ${side.frame_1?.action_prompt || ''}\n` +
    `  - Col 2 (Walk 2): ${side.frame_2?.action_prompt || ''}\n` +
    `  - Col 3 (Walk 3): ${side.frame_3?.action_prompt || ''}\n` +
    `  - Col 4 (Walk 4): ${side.frame_4?.action_prompt || ''}\n\n` +
    '[ROW 3 - UP / BACK VIEW]:\n' +
    `  - Col 0 (Idle): ${up.idle?.action_prompt || ''}\n` +
    `  - Col 1 (Walk 1): ${up.frame_1?.action_prompt || ''}\n` +
    `  - Col 2 (Walk 2): ${up.frame_2?.action_prompt || ''}\n` +
    `  - Col 3 (Walk 3): ${up.frame_3?.action_prompt || ''}\n` +
    `  - Col 4 (Walk 4): ${up.frame_4?.action_prompt || ''}`
  );

  return sections.join('\n\n');
}

/**
 * Phân hệ 4: Ràng buộc Tính nhất quán & Phòng tạo Prompt AI (ConsistencyAnalysis & Prompt Studio).
 * Tích hợp Ma trận 15 Frame Hoạt Họa Pixel Art (3 Hướng × 5 Frame chuyển động chân tay đối nghịch).
 * 
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object|null} props.consistency Dữ liệu phân tích tính nhất quán (ConsistencyAnalysis).
 * @param {Object|null} props.negativeConstraints Dữ liệu ràng buộc phủ định (NegativeConstraints).
 * @param {Object} props.fullProfile Toàn bộ hồ sơ nhân vật phục vụ sinh prompt.
 * @param {Function} props.onGeneratePrompt Hàm gọi API sinh prompt từ profile.
 * @param {boolean} props.generatingPrompt Trạng thái đang gọi API sinh prompt.
 * @param {Object|null} props.generatedPromptResult Kết quả prompt đã sinh.
 * @param {Function} props.onSavePreset Hàm lưu preset vào CSDL MySQL của dự án.
 * @param {boolean} props.savingPreset Trạng thái đang lưu.
 * @param {string} props.saveSuccessMsg Thông báo lưu thành công.
 * @param {Object} props.initialConfig Cấu hình nạp lại từ thư viện hồ sơ đã lưu.
 * @returns {React.ReactElement} Giao diện hiển thị chi tiết.
 */
export default function TabConstraintsPromptView({
  consistency,
  negativeConstraints,
  fullProfile,
  onGeneratePrompt,
  generatingPrompt,
  generatedPromptResult,
  onSavePreset,
  savingPreset,
  saveSuccessMsg,
  initialConfig
}) {
  // Trạng thái các trường thông tin của NHÂN VẬT MỚI (Tự do sáng tạo)
  const [concept, setConcept] = useState(initialConfig?.new_character_concept || 'Nữ pháp sư bóng đêm bí ẩn');
  const [outfitAndColors, setOutfitAndColors] = useState(initialConfig?.outfit_and_colors || 'Áo choàng nhung tím đen viền chỉ vàng kim');
  const [weaponsAndProps, setWeaponsAndProps] = useState(initialConfig?.weapons_and_props || 'Tay phải cầm trượng phép đính ngọc xanh');
  const [statureRule, setStatureRule] = useState(initialConfig?.stature_rule || 'Bằng nhân vật gốc (Tỷ lệ chuẩn)');
  const [targetDir, setTargetDir] = useState(initialConfig?.target_direction || 'Sprite Sheet 3x5 (15 frames)');

  // Trạng thái Ma trận 15 Frame Hoạt Họa (3 Hướng × 5 Frames)
  const [frameActions, setFrameActions] = useState(() => {
    if (initialConfig?.frame_actions_data && typeof initialConfig.frame_actions_data === 'object') {
      return initialConfig.frame_actions_data;
    }
    return createDefaultFrameActionsFromProfile(fullProfile);
  });

  // Cập nhật khi có initialConfig mới truyền vào từ bên ngoài (Tải lại từ thư viện)
  useEffect(() => {
    if (initialConfig) {
      if (initialConfig.new_character_concept) setConcept(initialConfig.new_character_concept);
      if (initialConfig.outfit_and_colors) setOutfitAndColors(initialConfig.outfit_and_colors);
      if (initialConfig.weapons_and_props) setWeaponsAndProps(initialConfig.weapons_and_props);
      if (initialConfig.stature_rule) setStatureRule(initialConfig.stature_rule);
      if (initialConfig.target_direction) setTargetDir(initialConfig.target_direction);
      if (initialConfig.frame_actions_data && typeof initialConfig.frame_actions_data === 'object') {
        setFrameActions(initialConfig.frame_actions_data);
      }
    }
  }, [initialConfig]);

  // Cập nhật lại khung frame khi fullProfile thay đổi (lần đầu quét AI xong)
  useEffect(() => {
    if (fullProfile && !initialConfig?.frame_actions_data) {
      setFrameActions(createDefaultFrameActionsFromProfile(fullProfile));
    }
  }, [fullProfile]);

  // Các tùy chọn kế thừa quy chuẩn kỹ thuật từ nhân vật cũ
  const [inheritScale, setInheritScale] = useState(true);
  const [inheritStyle, setInheritStyle] = useState(true);

  // Trạng thái sao chép prompt
  const [copiedPos, setCopiedPos] = useState(false);
  const [copiedNeg, setCopiedNeg] = useState(false);
  const [copiedColor, setCopiedColor] = useState(false);

  // Trích xuất hoặc khởi tạo Master Color Prompt từ Palette
  const defaultMasterColorPrompt = useMemo(() => {
    const palette = fullProfile?.palette_metrics || fullProfile?.global_analysis?.palette_metrics;
    if (palette?.master_color_prompt) {
      return palette.master_color_prompt.trim();
    }
    const era = fullProfile?.pixel_style?.pixel_art_era || fullProfile?.global_analysis?.pixel_style?.pixel_art_era || '16-bit SNES';
    return (
      "MASTER COLOR & GRAPHIC PALETTE SPECIFICATIONS (STRICTLY HARMONIZED WITH REFERENCE ASSET):\n" +
      `- Color Budget: Strictly indexed 24-color palette (${era} Classic), primary palette anchors: [#8b5cf6, #3b82f6, #10b981].\n` +
      "- Shading Architecture: 2-Tone Cel-Shading per surface (2 distinct tone levels), strictly zero smooth airbrushing or blurry gradients.\n" +
      "- Hue-Shifting Rule: Active Hue-Shifting detected (cool shadow tones, warm highlights).\n" +
      "- Outline Grammar: Selective Dark Outline (Selout), strictly 1-pixel crisp pixel contour without orphan noise.\n" +
      "- Palette Saturation & Contrast: Vibrant Retro Pixel Saturation, High Contrast curve (6.5:1 ratio).\n" +
      "- Background: Isolated on pure transparent background (PNG alpha channel), zero drop shadows on floor."
    );
  }, [fullProfile]);

  const [masterColorPrompt, setMasterColorPrompt] = useState(defaultMasterColorPrompt);

  useEffect(() => {
    if (defaultMasterColorPrompt) {
      setMasterColorPrompt(defaultMasterColorPrompt);
    }
  }, [defaultMasterColorPrompt]);

  /**
   * Cập nhật nội dung mô tả của một Frame cụ thể trong ma trận 15 frames.
   */
  const handleChangeFrame = (direction, frameKey, newActionPrompt) => {
    setFrameActions((prev) => ({
      ...prev,
      [direction]: {
        ...prev[direction],
        [frameKey]: {
          ...prev[direction]?.[frameKey],
          action_prompt: newActionPrompt
        }
      }
    }));
  };

  /**
   * Khôi phục 5 frame của một hướng về giá trị mặc định được tiêm từ Schemas.
   */
  const handleResetDirection = (direction) => {
    const defaults = createDefaultFrameActionsFromProfile(fullProfile);
    if (defaults[direction]) {
      setFrameActions((prev) => ({
        ...prev,
        [direction]: defaults[direction]
      }));
    }
  };

  /**
   * Biên dịch câu Prompt thời gian thực (Live Preview) dựa trên các giá trị hiện tại.
   */
  const livePositivePrompt = useMemo(() => {
    return compileLivePrompt(frameActions, concept, outfitAndColors, weaponsAndProps, fullProfile, masterColorPrompt);
  }, [frameActions, concept, outfitAndColors, weaponsAndProps, fullProfile, masterColorPrompt]);

  const defaultNegativePrompt = (
    "background scenery, complex background, gradient background, floor texture, tiles, shadow on floor, " +
    "environment, landscape, horizon line, ground dirt, watermark, noisy background, solid colored background walls, " +
    "blurry, 3D render, smooth vector graphics, photorealistic, anti-aliased edges, " +
    "deformed anatomy, mismatched frame heights, inconsistent clothing colors between frames, " +
    "missing limbs, extra limbs, disjointed pixel clusters, " +
    "frame height flickering, head scaling distortion, irregular grid spacing."
  );

  /**
   * Sao chép đoạn văn bản vào bộ nhớ tạm Clipboard.
   */
  const handleCopy = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'positive') {
      setCopiedPos(true);
      setTimeout(() => setCopiedPos(false), 2000);
    } else if (type === 'color') {
      setCopiedColor(true);
      setTimeout(() => setCopiedColor(false), 2000);
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
      frame_actions: frameActions,
      compiled_positive_prompt: livePositivePrompt,
      compiled_negative_prompt: defaultNegativePrompt
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
          Bộ Tạo Prompt Sprite Sheet 3x5 (Ma Trận 15 Frame Hoạt Họa)
        </h4>
        <p style={{ margin: '0 0 8px', fontSize: '0.775rem', color: 'var(--text-muted)' }}>
          Tự do tạo nhân vật mới theo phong cách pixel và tỷ lệ kích thước của Sprite mẫu. Toàn bộ thông số từ 7 Schemas (độ nhún trọng tâm, hướng sáng, viền) được tự động tiêm vào 15 Frame của 3 hướng.
        </p>

        <div className="analysis-fields">
          <label>
            Ý tưởng cốt lõi (Concept):
            <input
              type="text"
              value={concept}
              placeholder="VD: Nữ pháp sư bóng đêm, Ninja áo đen, Slime độc..."
              onChange={(e) => setConcept(e.target.value)}
            />
          </label>

          <label>
            Trang phục & Dải màu riêng:
            <input
              type="text"
              value={outfitAndColors}
              placeholder="VD: Áo choàng nhung tím đen viền chỉ vàng, Giáp da sờn rách..."
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

          {/* Các công tắc kế thừa kỹ thuật */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', padding: '6px 0', fontSize: '0.8rem' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={inheritScale}
                onChange={(e) => setInheritScale(e.target.checked)}
              />
              <span>🔒 <strong>Khóa tỷ lệ game</strong> (Giữ chiều cao và tỷ lệ đầu/thân từ Schema)</span>
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

        {/* ========================================================
            KHUNG TO NHẤT (TẦNG 0): BẢNG QUY ĐỊNH MÀU SẮC & ĐỒ HỌA CHUNG (MASTER COLOR SPECIFICATIONS)
            ======================================================== */}
        <div style={{
          marginTop: '16px',
          padding: '14px',
          background: 'rgba(139, 92, 246, 0.05)',
          border: '1px solid var(--accent-purple)',
          borderRadius: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
            <h4 style={{ margin: 0, color: 'var(--text-white)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
              <Palette size={16} color="var(--accent-purple)" />
              KHUNG TO NHẤT: Bảng Quy Định Màu Sắc & Đồ Họa Cốt Lõi (Master Color Specifications)
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn-ghost-studio"
                onClick={() => setMasterColorPrompt(defaultMasterColorPrompt)}
                style={{ fontSize: '0.725rem' }}
                title="Khôi phục câu prompt màu mặc định đo từ ảnh mẫu"
              >
                Khôi phục mặc định
              </button>
              <button
                type="button"
                className="btn-ghost-studio"
                onClick={() => handleCopy(masterColorPrompt, 'color')}
                style={{ color: copiedColor ? '#10b981' : 'var(--text-highlight)', fontSize: '0.725rem' }}
              >
                {copiedColor ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                {copiedColor ? 'Đã chép!' : 'Sao chép khung màu'}
              </button>
            </div>
          </div>

          <p style={{ margin: '0 0 8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Khung to nhất này đặt ở đầu câu Prompt để AI ép buộc toàn bộ 15 Frame hoạt họa bên dưới tuân thủ nghiêm ngặt cùng bảng màu, số màu và phong cách đổ bóng của nhân vật mẫu.
          </p>

          {/* Dải Swatches màu nếu có dữ liệu đo được */}
          {fullProfile?.palette_metrics?.top_hex_list && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600 }}>MÀU CHỦ ĐẠO:</span>
              {fullProfile.palette_metrics.top_hex_list.slice(0, 10).map((hex, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    fontSize: '0.7rem',
                    fontFamily: 'monospace'
                  }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: hex, display: 'inline-block' }} />
                  {hex}
                </span>
              ))}
            </div>
          )}

          <textarea
            className="studio-prompt-textarea"
            rows={5}
            value={masterColorPrompt}
            onChange={(e) => setMasterColorPrompt(e.target.value)}
            style={{ borderRadius: '6px', border: '1px solid var(--border-card)', background: '#0a0f1d' }}
          />
        </div>

        {/* ========================================================
            KHUNG DƯỚI: MA TRẬN 15 FRAME HOẠT HỌA (TUÂN THỦ THEO BẢNG MÀU TRÊN)
            ======================================================== */}
        <div style={{ marginTop: '16px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={16} color="#38bdf8" />
          <h4 style={{ margin: 0, color: 'var(--text-white)', fontSize: '0.9rem' }}>
            KHUNG DƯỚI: Ma Trận 15 Frame Hoạt Họa (Tuân Thủ Theo Bảng Màu Trên)
          </h4>
        </div>

        {/* 2. BỘ ĐIỀU KHIỂN MA TRẬN 15 FRAME HOẠT HỌA (3 HƯỚNG × 5 FRAMES) */}
        <FrameActionMatrixEditor
          frameActions={frameActions}
          onChangeFrame={handleChangeFrame}
          onResetDirection={handleResetDirection}
        />

        {/* ========================================================
            3. HIỂN THỊ KẾT QUẢ PROMPT HOÀN CHỈNH (LIVE PREVIEW)
            ======================================================== */}
        <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Positive Prompt */}
          <div className="studio-prompt-output-card">
            <div className="studio-prompt-output-header">
              <h4 style={{ color: '#10b981' }}>
                <Sparkles size={14} color="#10b981" />
                Positive Prompt 3 Tầng (Tự động cập nhật thời gian thực từ 15 Frame)
              </h4>
              <button
                type="button"
                className="btn-ghost-studio"
                onClick={() => handleCopy(livePositivePrompt, 'positive')}
                style={{ color: copiedPos ? '#10b981' : 'var(--text-muted)' }}
              >
                {copiedPos ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                {copiedPos ? 'Đã chép!' : 'Sao chép'}
              </button>
            </div>
            <textarea
              className="studio-prompt-textarea"
              rows={8}
              readOnly
              value={livePositivePrompt}
            />
          </div>

          {/* Negative Prompt */}
          <div className="studio-prompt-output-card">
            <div className="studio-prompt-output-header">
              <h4 style={{ color: '#ef4444' }}>
                <ShieldAlert size={14} color="#ef4444" />
                Negative Prompt (Khử nhiễu, chống biến dạng lưới & bảo tồn pixel)
              </h4>
              <button
                type="button"
                className="btn-ghost-studio"
                onClick={() => handleCopy(defaultNegativePrompt, 'negative')}
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
              value={defaultNegativePrompt}
            />
          </div>

          {/* Thanh tác vụ: Nút Lưu bản ghi vào MySQL của Dự án */}
          {onSavePreset && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              background: 'rgba(139, 92, 246, 0.08)',
              border: '1px solid var(--accent-purple-glow)',
              borderRadius: '8px',
              marginTop: '4px'
            }}>
              <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                {saveSuccessMsg ? (
                  <span style={{ color: '#10b981', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Check size={14} /> {saveSuccessMsg}
                  </span>
                ) : (
                  <span>Lưu toàn bộ ma trận 15 frame và câu Prompt này vào Hồ sơ Dự án trong MySQL.</span>
                )}
              </div>

              <button
                type="button"
                className="btn-primary-studio"
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
                  negative_prompt: defaultNegativePrompt
                })}
                style={{ minHeight: '34px', fontSize: '0.8rem', padding: '6px 16px', gap: '6px', whiteSpace: 'nowrap' }}
              >
                <Bookmark size={14} className={savingPreset ? 'spin' : ''} />
                {savingPreset ? 'Đang lưu vào MySQL…' : 'Lưu vào Dự án'}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ========================================================
          4. RÀNG BUỘC BẤT BIẾN CẦN BẢO TỒN (PRESERVATION REQUIREMENTS)
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
          5. RÀNG BUỘC PHỦ ĐỊNH CẤM KỴ (NEGATIVE CONSTRAINTS)
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
