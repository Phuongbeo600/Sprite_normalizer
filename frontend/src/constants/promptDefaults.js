// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
// (Không phụ thuộc React, file thuần JavaScript)

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// (Không sử dụng thư viện ngoài)

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không phụ thuộc nội bộ)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// (Không áp dụng cho file hằng số)

/**
 * Chuỗi câu Prompt Phủ Định (Negative Prompt) chuẩn mực cho Pixel Art:
 * Chống lỗi vẽ nền cảnh phức tạp, chống bóng đổ sàn, chống đổ bóng mềm 3D và biến dạng giải phẫu.
 */
export const DEFAULT_NEGATIVE_PROMPT = (
  "background scenery, complex background, gradient background, floor texture, tiles, shadow on floor, " +
  "environment, landscape, horizon line, ground dirt, watermark, noisy background, solid colored background walls, " +
  "blurry, 3D render, smooth vector graphics, photorealistic, anti-aliased edges, " +
  "deformed anatomy, mismatched frame heights, inconsistent clothing colors between frames, " +
  "missing limbs, extra limbs, disjointed pixel clusters, " +
  "frame height flickering, head scaling distortion, irregular grid spacing."
);

/**
 * Khởi tạo ma trận 15 frame hoạt họa mặc định từ dữ liệu phân tích 7 Schemas.
 * 
 * @param {Object} profile Toàn bộ hồ sơ nhân vật (fullProfile).
 * @returns {Object} Ma trận 15 frame gồm 3 hướng (down, side, up).
 */
export function createDefaultFrameActionsFromProfile(profile) {
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
 * @param {string} customMasterColorPrompt Khung đặc tả màu sắc do người dùng chỉnh sửa.
 * @returns {string} Chuỗi câu prompt tiếng Anh chuẩn 3 tầng.
 */
export function compileLivePrompt(actions, charConcept, outfit, props, profile, customMasterColorPrompt) {
  const anatomy = profile?.anatomy || profile?.global_analysis?.anatomy || {};
  const pixelStyle = profile?.pixel_style || profile?.global_analysis?.pixel_style || {};
  const height = anatomy.anatomical_height || 48;
  const headRatio = anatomy.head_to_body_ratio || '1:4.0';
  const era = pixelStyle.pixel_art_era || '16-bit SNES';
  const outline = pixelStyle.outline_style || 'crisp dark pixel contour';
  const shading = pixelStyle.shading_style || '2-tone cell shading';
  const lighting = pixelStyle.lighting_direction || 'consistent top-left lighting';

  const conceptStr = charConcept?.trim() || 'game character';
  const outfitStr = outfit?.trim() ? `, wearing ${outfit.trim()}` : '';
  const propsStr = props?.trim() ? `, equipped with ${props.trim()}` : '';

  const act = actions || createDefaultFrameActionsFromProfile(profile);
  const down = act.down || {};
  const side = act.side || {};
  const up = act.up || {};

  const promptParts = [];

  // TẦNG 0: MASTER COLOR SPECIFICATIONS
  const colorSpec = customMasterColorPrompt?.trim();
  if (colorSpec) {
    promptParts.push(colorSpec);
  }

  // TẦNG 1: IDENTITY & STYLE MATRIX
  promptParts.push(
    `Masterpiece authentic ${era} pixel art sprite sheet of a ${conceptStr}${outfitStr}${propsStr}.\n` +
    `Strict anatomy constraints: exactly ${height} pixels character height, strict ${headRatio} head-to-body proportion.\n` +
    `Rendering specifications: ${outline}, ${shading}, ${lighting}, transparent background, isolated on pure solid transparent background (PNG alpha channel), clean cut-out sprite sheet without background elements or floor shadows.`
  );

  // TẦNG 2: GRID LAYOUT & SPECIFICATIONS (3x5)
  promptParts.push(
    "SPRITE SHEET GRID LAYOUT (3 Rows x 5 Columns, total 15 frames):\n" +
    "- Row 1: Down / Front facing view (Frame 0: Idle, Frames 1-4: Walk cycle)\n" +
    "- Row 2: Side / Right profile view (Frame 0: Idle, Frames 1-4: Walk cycle)\n" +
    "- Row 3: Up / Back facing view (Frame 0: Idle, Frames 1-4: Walk cycle)\n" +
    "Absolute cross-frame consistency: identical character proportions, clothing details, and color palette across all 15 frames."
  );

  // TẦNG 3: FRAME-BY-FRAME ACTION MATRIX
  const frameMatrix = [
    "DETAILED 15-FRAME ACTION MATRIX:",
    "[ROW 1 - DOWN / FRONT VIEW]:",
    `  - Col 0 (Idle): ${down.idle?.action_prompt || ''}`,
    `  - Col 1 (Walk 1): ${down.frame_1?.action_prompt || ''}`,
    `  - Col 2 (Walk 2): ${down.frame_2?.action_prompt || ''}`,
    `  - Col 3 (Walk 3): ${down.frame_3?.action_prompt || ''}`,
    `  - Col 4 (Walk 4): ${down.frame_4?.action_prompt || ''}`,
    "",
    "[ROW 2 - SIDE / RIGHT PROFILE VIEW]:",
    `  - Col 0 (Idle): ${side.idle?.action_prompt || ''}`,
    `  - Col 1 (Walk 1): ${side.frame_1?.action_prompt || ''}`,
    `  - Col 2 (Walk 2): ${side.frame_2?.action_prompt || ''}`,
    `  - Col 3 (Walk 3): ${side.frame_3?.action_prompt || ''}`,
    `  - Col 4 (Walk 4): ${side.frame_4?.action_prompt || ''}`,
    "",
    "[ROW 3 - UP / BACK VIEW]:",
    `  - Col 0 (Idle): ${up.idle?.action_prompt || ''}`,
    `  - Col 1 (Walk 1): ${up.frame_1?.action_prompt || ''}`,
    `  - Col 2 (Walk 2): ${up.frame_2?.action_prompt || ''}`,
    `  - Col 3 (Walk 3): ${up.frame_3?.action_prompt || ''}`,
    `  - Col 4 (Walk 4): ${up.frame_4?.action_prompt || ''}`
  ];
  promptParts.push(frameMatrix.join("\n"));

  return promptParts.join("\n\n");
}
