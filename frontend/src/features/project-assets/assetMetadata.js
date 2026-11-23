// 1. THƯ VIỆN NỀN TẢNG (Không sử dụng)

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Phép chuyển đổi dữ liệu độc lập)

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)

/** Khôi phục đúng hình dạng sheet đã lưu để chuyển sang Workspace. */
export function buildWorkspaceSheetPayload(sprite, frames) {
  let meta = sprite.processing_metadata;
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta); } catch {}
  }
  meta = meta || {};
  
  return {
    rows: meta.rows || 1,
    columns: meta.columns || 1,
    regularGridSize: meta.x_cuts && meta.y_cuts
      ? { width: meta.original_width, height: meta.original_height }
      : null,
    autoAnchor: Boolean(meta.auto_anchor),
    fps: meta.fps || 6,
    frames: frames.map((f) => ({
      name: f.frame_name || `frame_${f.frame_index}.png`,
      url: f.image_url,
      index: f.frame_index,
      id: f.id
    }))
  };
}
