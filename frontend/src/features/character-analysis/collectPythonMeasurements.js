// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý giao diện và trạng thái)
// ========================================================
// Không phụ thuộc vào React.

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI
// ========================================================
// Không dùng thư viện bên ngoài.

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Thành phần giao diện và dữ liệu)
// ========================================================
// Không dùng thành phần nội bộ.

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN VÀ MÀU SẮC
// ========================================================
// Không áp dụng cho tệp tiện ích.

/**
 * Chọn các số đo Python để gửi cùng ảnh tham chiếu đến backend hoặc AI Vision.
 *
 * @param {Object} data Bảng màu, báo cáo pixel và số đo của ảnh đang mở.
 * @returns {Object} Dữ liệu đo có nguồn rõ ràng và không chứa mô tả AI.
 */
export function collectPythonMeasurements({ palette, pixelReport, metrics, profileData }) {
  const report = {};
  if (palette?.total_colors > 0) {
    report.palette = {
      total_colors: palette.total_colors,
      dominant_hex: palette.top_hex_list,
      outline_style: palette.outline_style_detected,
      shading_steps_estimate: palette.shading_steps,
      hue_shift: palette.hue_shift_description,
      saturation: palette.average_saturation,
      contrast_ratio: palette.contrast_ratio,
    };
  }
  if (pixelReport) {
    report.pixel_grid = pixelReport.grid;
    report.outline = pixelReport.outline;
    report.detail = pixelReport.detail;
    report.clusters = pixelReport.clusters;
  }
  if (metrics) {
    report.automatic_geometry = {
      image_size_px: [metrics.canvas_width, metrics.canvas_height],
      character_height_px: metrics.anatomical_height ?? metrics.visible_height,
      character_width_px: metrics.visible_width,
      heads_tall: metrics.heads_tall,
      head_width_px: metrics.head_width ?? metrics.head_w,
      head_height_px: metrics.head_height ?? metrics.head_h,
      body_width_px: metrics.body_width ?? metrics.body_w,
      body_height_px: metrics.body_height ?? metrics.body_h,
      ground_y: metrics.ground_y,
    };
  }
  for (const [name, regions] of [
    ['automatic_regions', profileData.region_measurements],
    ['manual_regions', profileData.manual_region_measurements],
  ]) {
    const entries = Object.entries(regions?.measurements || {});
    if (entries.length) {
      report[name] = {
        image_size_px: regions.image_size_px,
        measurements: Object.fromEntries(
          entries.map(([part, measurement]) => [
            part,
            {
              type: measurement.polygon ? 'cross_section' : 'reference_segment',
              width_px: measurement.width_px,
            },
          ])
        ),
      };
    }
  }
  return report;
}
