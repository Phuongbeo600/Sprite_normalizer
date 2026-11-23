// 1. THƯ VIỆN NỀN TẢNG (Không sử dụng)

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Phép chuyển đổi dữ liệu độc lập)

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)

/** Dựng bản ghi hồ sơ, giữ nguyên thứ tự ưu tiên dữ liệu hiện tại và bản đã nạp. */
export function buildPresetPayload({ newCharData, reference, metrics, profileData, generatedProfilePrompt }) {
  const posPrompt = newCharData.positive_prompt || generatedProfilePrompt?.positive_prompt;
  const negPrompt = newCharData.negative_prompt || generatedProfilePrompt?.negative_prompt;
  return {
      name: newCharData.name || `${newCharData.new_character_concept} (Bản lưu Studio)`,
      sprite_name: reference?.name || 'sprite_sample.png',
      metrics_data: metrics,
      profile_data: profileData,
      frame_actions_data: newCharData.frame_actions_data || profileData?.frame_actions_data || null,
      new_character_concept: newCharData.new_character_concept,
      outfit_and_colors: newCharData.outfit_and_colors,
      weapons_and_props: newCharData.weapons_and_props,
      stature_rule: newCharData.stature_rule,
      target_direction: newCharData.target_direction,
      positive_prompt: posPrompt,
      negative_prompt: negPrompt || '',
      technical_notes: generatedProfilePrompt?.technical_notes || 'Bản lưu ma trận 15 frame Sprite Sheet 3x5',
    };
}
