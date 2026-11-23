// 1. THƯ VIỆN NỀN TẢNG (Quản lý phiên làm việc React)
import { useState, useEffect, useMemo } from "react";

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Dữ liệu và yêu cầu của tính năng)
import { translateBatch } from '../translationApi';
import { buildPromptProfile } from '../promptProfile';
import { buildNegativePrompt, createDefaultFrameActionsFromProfile, compileLivePrompt } from '../promptCompiler';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)

/** Sở hữu trạng thái và thao tác của phiên; giữ nguyên thứ tự hiệu ứng hiện tại. */
export function usePromptDraft({ initialConfig, fullProfile, measuredGeometry }) {
  // Trạng thái các trường thông tin của NHÂN VẬT MỚI (Tự do sáng tạo)
  const [concept, setConcept] = useState(initialConfig?.new_character_concept || 'Nữ pháp sư bóng đêm bí ẩn');
  const [outfitAndColors, setOutfitAndColors] = useState(initialConfig?.outfit_and_colors || 'Áo choàng nhung tím đen viền chỉ vàng kim');
  const [weaponsAndProps, setWeaponsAndProps] = useState(initialConfig?.weapons_and_props || 'Tay phải cầm trượng phép đính ngọc xanh');
  const [statureRule, setStatureRule] = useState(initialConfig?.stature_rule || 'Bằng nhân vật gốc (Tỷ lệ chuẩn)');
  const [targetDir, setTargetDir] = useState(initialConfig?.target_direction || 'Sprite Sheet 3x5 (15 frames)');

  // Lưu trữ bản tiếng Việt gốc để người dùng có thể hoàn tác lại
  const [vietnameseBackup, setVietnameseBackup] = useState(null);
  // Trạng thái đang dịch mô tả tiếng Việt sang tiếng Anh
  const [translatingInputs, setTranslatingInputs] = useState(false);

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

  // Chỉ đặt lại khung frame khi các dữ liệu tạo khung thay đổi.
  const frameWalk = fullProfile?.animations?.walk_profile || fullProfile?.animation_analysis?.walk_profile;
  useEffect(() => {
    if (!initialConfig?.frame_actions_data) {
      setFrameActions(createDefaultFrameActionsFromProfile({
        animations: { walk_profile: frameWalk },
      }));
    }
  }, [frameWalk, initialConfig?.frame_actions_data]);

  // Các tùy chọn kế thừa quy chuẩn kỹ thuật từ nhân vật cũ
  const [inheritScale, setInheritScale] = useState(true);
  const [inheritStyle, setInheritStyle] = useState(true);

  const [reusePalette, setReusePalette] = useState(false);
  const palette = fullProfile?.palette_metrics || fullProfile?.global_analysis?.palette_metrics;
  const pixelStyle = fullProfile?.pixel_style || fullProfile?.global_analysis?.pixel_style;
  const referenceStyle = fullProfile?.reference_style;
  const stylePrompt = referenceStyle?.style_prompt?.trim();
  const regionNotes = fullProfile?.manual_region_measurements?.prompt_notes || fullProfile?.region_measurements?.prompt_notes;
  const hasPalette = palette?.total_colors > 0;
  const hasGeometry = Boolean(measuredGeometry?.heads_tall || regionNotes);
  const hasStyle = Boolean(hasPalette || pixelStyle || stylePrompt);
  const keepsStyle = inheritStyle && hasStyle;
  const keepsScale = inheritScale && hasGeometry;
  const keepsPalette = reusePalette && hasPalette && Boolean(palette?.top_hex_list?.length);

  // Chỉ chèn mã HEX mẫu khi người dùng chủ động chọn dùng lại bảng màu.
  const defaultMasterColorPrompt = useMemo(() => {
    if (!hasPalette || (!keepsStyle && !keepsPalette)) return '';
    const colors = keepsPalette ? ` Use reference palette anchors [${palette.top_hex_list.slice(0, 8).join(', ')}].` : '';
    const budget = `- Color Budget: Use up to ${palette.total_colors} colors.${colors}`;
    const styleLines = keepsStyle
      ? (palette.master_color_prompt || '').split('\n').filter((line) =>
          line.startsWith('- ') && !line.startsWith('- Color Budget:') && !line.startsWith('- Shading Architecture:'),
        )
      : [];
    if (keepsStyle && palette.outline_style_detected && !styleLines.some((line) => line.startsWith('- Outline Grammar:'))) {
      styleLines.push(`- Outline Grammar: ${palette.outline_style_detected}.`);
    }
    return ['REFERENCE PIXEL ART SPECIFICATIONS:', budget, ...styleLines].join('\n');
  }, [palette, hasPalette, keepsStyle, keepsPalette]);

  const [masterColorPrompt, setMasterColorPrompt] = useState(defaultMasterColorPrompt);
  useEffect(() => {
    setMasterColorPrompt(defaultMasterColorPrompt);
  }, [defaultMasterColorPrompt]);

  const promptProfile = useMemo(() => buildPromptProfile({ measuredGeometry, keepsScale, fullProfile, pixelStyle, keepsStyle }),
    [measuredGeometry, keepsScale, fullProfile, pixelStyle, keepsStyle]);

  const currentHeadsTall = useMemo(() => {
    if (measuredGeometry?.heads_tall) return Number(measuredGeometry.heads_tall);
    const ratioStr = fullProfile?.anatomy?.head_to_body_ratio || fullProfile?.global_analysis?.anatomy?.head_to_body_ratio;
    if (typeof ratioStr === 'string' && ratioStr.includes(':')) {
      const parsed = parseFloat(ratioStr.split(':')[1]);
      if (!isNaN(parsed)) return parsed;
    }
    return null;
  }, [measuredGeometry, fullProfile]);

  const liveNegativePrompt = useMemo(() => {
    return buildNegativePrompt(
      keepsScale ? currentHeadsTall : null,
      fullProfile,
      keepsScale,
      keepsStyle
    );
  }, [keepsScale, currentHeadsTall, fullProfile, keepsStyle]);

  const appliedReference = [
    hasPalette && (keepsStyle || keepsPalette) && `tối đa ${palette.total_colors} màu`,
    keepsPalette && `${Math.min(8, palette.top_hex_list.length)} màu chủ đạo của mẫu`,
    keepsStyle && hasPalette && palette.outline_style_detected && 'kiểu viền đã đo',
    keepsStyle && pixelStyle?.lighting_direction && 'hướng sáng từ hồ sơ',
    keepsStyle && stylePrompt && `chỉ dẫn vẽ ${referenceStyle?.provider === 'openai' ? 'OpenAI' : 'Gemini'}`,
    keepsScale && measuredGeometry?.heads_tall && `dáng cao ${measuredGeometry.heads_tall} đầu`,
    keepsScale && regionNotes && 'số đo từng vùng',
  ].filter(Boolean);

  /**
   * Cập nhật nội dung mô tả của một Frame cụ thể trong ma trận 15 frames.
   * 
   * @param {string} direction Hướng nhìn (down, side, up).
   * @param {string} frameKey Tên khóa frame (frame_0, frame_1,...).
   * @param {string} newActionPrompt Nội dung mô tả hành động mới.
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
   * 
   * @param {string} direction Hướng nhìn cần hoàn tác.
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
   * Dịch đồng loạt 3 trường mô tả (concept, outfit, weapons) từ Tiếng Việt sang Tiếng Anh.
   */
  const handleTranslateInputsToEnglish = async () => {
    const textsToTranslate = [concept, outfitAndColors, weaponsAndProps];
    if (!textsToTranslate.some((t) => t && t.trim())) return;

    // Lưu lại bản tiếng Việt hiện tại trước khi dịch để hỗ trợ hoàn tác
    setVietnameseBackup({
      concept,
      outfitAndColors,
      weaponsAndProps
    });
    setTranslatingInputs(true);

    try {
      const results = await translateBatch(textsToTranslate, 'vi', 'en');
      if (results[0]) setConcept(results[0]);
      if (results[1]) setOutfitAndColors(results[1]);
      if (results[2]) setWeaponsAndProps(results[2]);
    } catch (err) {
      console.error('[TabConstraintsPromptView] Lỗi dịch mô tả sang tiếng Anh:', err);
    } finally {
      setTranslatingInputs(false);
    }
  };

  /**
   * Khôi phục lại bản Tiếng Việt đã nhập trước đó.
   */
  const handleRestoreVietnameseInputs = () => {
    if (!vietnameseBackup) return;
    setConcept(vietnameseBackup.concept);
    setOutfitAndColors(vietnameseBackup.outfitAndColors);
    setWeaponsAndProps(vietnameseBackup.weaponsAndProps);
    setVietnameseBackup(null);
  };

  /**
   * Biên dịch câu Prompt thời gian thực (Live Preview) dựa trên các giá trị hiện tại.
   */
  const livePositivePrompt = useMemo(() => {
    return compileLivePrompt(
      frameActions, concept, outfitAndColors, weaponsAndProps, promptProfile,
      keepsStyle || keepsPalette ? masterColorPrompt : '',
      keepsScale ? regionNotes : '',
      keepsStyle ? stylePrompt : '',
    );
  }, [frameActions, concept, outfitAndColors, weaponsAndProps, promptProfile, keepsStyle, keepsPalette, masterColorPrompt, keepsScale, regionNotes, stylePrompt]);

  return { concept, setConcept, outfitAndColors, setOutfitAndColors, weaponsAndProps, setWeaponsAndProps, statureRule, setStatureRule, targetDir, vietnameseBackup, translatingInputs, frameActions, setInheritScale, setInheritStyle, setReusePalette, palette, referenceStyle, stylePrompt, hasPalette, hasGeometry, hasStyle, keepsStyle, keepsScale, keepsPalette, defaultMasterColorPrompt, masterColorPrompt, setMasterColorPrompt, liveNegativePrompt, appliedReference, handleChangeFrame, handleResetDirection, handleTranslateInputsToEnglish, handleRestoreVietnameseInputs, livePositivePrompt };
}
