// 1. THƯ VIỆN NỀN TẢNG (Không sử dụng)

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Phép chuyển đổi dữ liệu độc lập)

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)

/** Chiếu số đo và phong cách theo từng lựa chọn kế thừa. */
export function buildPromptProfile({ measuredGeometry, keepsScale, fullProfile, pixelStyle, keepsStyle }) {
  const headCount = measuredGeometry?.heads_tall;
  const anatomicalHeight = measuredGeometry?.anatomical_height || measuredGeometry?.visible_height || measuredGeometry?.character_height_px;
  const headH = measuredGeometry?.head_height ?? measuredGeometry?.head_height_px ?? measuredGeometry?.head_h;
  const headW = measuredGeometry?.head_width ?? measuredGeometry?.head_width_px ?? measuredGeometry?.head_w;
  const bodyH = measuredGeometry?.body_height ?? measuredGeometry?.body_height_px ?? measuredGeometry?.body_h;
  const headToBodyW = measuredGeometry?.head_to_body_width_ratio;
  const styleCat = measuredGeometry?.style_category;

  const anatomyBase = fullProfile?.anatomy || fullProfile?.global_analysis?.anatomy || {};

  return {
    anatomy: keepsScale ? {
      ...anatomyBase,
      head_to_body_ratio: headCount > 0 ? `1:${headCount}` : (anatomyBase.head_to_body_ratio || '1:4.0'),
      anatomical_height: anatomicalHeight || anatomyBase.anatomical_height || 48,
      heads_tall: headCount || (anatomyBase.head_to_body_ratio ? parseFloat(anatomyBase.head_to_body_ratio.split(':')[1]) : null),
      head_height: headH || anatomyBase.head_height,
      head_width: headW || anatomyBase.head_width,
      body_height: bodyH || anatomyBase.body_height,
      head_to_body_width_ratio: headToBodyW || anatomyBase.head_to_body_width_ratio,
      style_category: styleCat || anatomyBase.style_category,
    } : anatomyBase,
    pixel_style: keepsStyle ? pixelStyle || {} : {},
    metrics: keepsScale && measuredGeometry ? measuredGeometry : undefined,
  };
}
