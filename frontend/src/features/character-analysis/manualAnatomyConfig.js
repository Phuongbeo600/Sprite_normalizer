// ========================================================
// 1. THƯ VIỆN NỀN TẢNG (Không phụ thuộc React)
// ========================================================

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)
// ========================================================

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Không phụ thuộc)
// ========================================================

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Biến màu trong theme.css)
// ========================================================

/**
 * Danh sách 6 nhóm bộ phận và 11 thông số đo giải phẫu thủ công (Point-to-Point).
 * Mỗi thông số gắn với biến Backend, phương pháp tính và biến màu CSS trong theme.css.
 */
export const ANATOMY_GROUPS = [
  {
    id: 'whole_body',
    label: 'Toàn thân',
    colorVar: '--measure-yellow',
    colorName: 'Vàng',
    metrics: [
      {
        key: 'body_height',
        label: 'Chiều cao toàn thân',
        kind: 'height_y',
        kindLabel: 'Trục Y',
        colorVar: '--measure-yellow',
        supportsPolyline: false,
        guideText: 'Kéo dọc từ đỉnh cao nhất của đầu/mũ xuống điểm chạm đất thấp nhất của chân.',
      },
    ],
  },
  {
    id: 'head',
    label: 'Đầu',
    colorVar: '--measure-red',
    colorName: 'Đỏ',
    metrics: [
      {
        key: 'head_height',
        label: 'Chiều cao đầu',
        kind: 'height_y',
        kindLabel: 'Trục Y',
        colorVar: '--measure-red',
        supportsPolyline: false,
        guideText: 'Kéo dọc từ đỉnh đầu (không tính chỏm mũ quá cao) xuống cằm/cổ.',
      },
      {
        key: 'head_width',
        label: 'Chiều rộng đầu',
        kind: 'width_x',
        kindLabel: 'Trục X',
        colorVar: '--measure-red',
        supportsPolyline: false,
        guideText: 'Kéo ngang qua hai mép rộng nhất của phần đầu/khuôn mặt.',
      },
    ],
  },
  {
    id: 'torso',
    label: 'Thân',
    colorVar: '--measure-orange',
    colorName: 'Cam',
    metrics: [
      {
        key: 'torso_height',
        label: 'Chiều cao thân',
        kind: 'height_y',
        kindLabel: 'Trục Y',
        colorVar: '--measure-orange',
        supportsPolyline: false,
        guideText: 'Kéo dọc từ chân cổ/ngang vai xuống đường ngang hông hoặc đáy thân áo.',
      },
      {
        key: 'torso_width',
        label: 'Chiều rộng thân',
        kind: 'width_x',
        kindLabel: 'Trục X',
        colorVar: '--measure-orange',
        supportsPolyline: false,
        guideText: 'Kéo ngang qua phần thân giữa (không gộp hai cánh tay hai bên).',
      },
    ],
  },
  {
    id: 'shoulders_hips',
    label: 'Vai & Hông',
    colorVar: '--measure-green',
    colorName: 'Xanh lá',
    metrics: [
      {
        key: 'shoulder_width',
        label: 'Chiều rộng vai',
        kind: 'width_x',
        kindLabel: 'Trục X',
        colorVar: '--measure-green',
        supportsPolyline: false,
        guideText: 'Kéo ngang từ mép khớp vai trái sang mép khớp vai phải.',
      },
      {
        key: 'hip_width',
        label: 'Chiều rộng hông',
        kind: 'width_x',
        kindLabel: 'Trục X',
        colorVar: '--measure-green',
        supportsPolyline: false,
        guideText: 'Kéo ngang qua hai mép hông/chậu ở phần tiếp nối giữa thân và chân.',
      },
    ],
  },
  {
    id: 'arms',
    label: 'Tay',
    colorVar: '--measure-blue',
    colorName: 'Xanh dương',
    metrics: [
      {
        key: 'arm_length',
        label: 'Chiều dài tay',
        kind: 'polyline_euclidean',
        kindLabel: 'Euclidean / Khớp',
        colorVar: '--measure-blue',
        supportsPolyline: true,
        guideText: 'Kéo từ vai đến cổ tay (hoặc bật "Đo qua khớp" nếu tay đang gập: Vai → Khuỷu → Cổ tay).',
      },
      {
        key: 'arm_width',
        label: 'Độ dày tay',
        kind: 'perpendicular_width',
        kindLabel: 'Vuông góc trục',
        colorVar: '--measure-blue',
        supportsPolyline: false,
        guideText: 'Kéo qua hai mép biên ngang thân cánh tay (Python tự chiếu vuông góc trục tay).',
      },
    ],
  },
  {
    id: 'legs',
    label: 'Chân',
    colorVar: '--measure-purple',
    colorName: 'Tím',
    metrics: [
      {
        key: 'leg_length',
        label: 'Chiều dài chân',
        kind: 'polyline_euclidean',
        kindLabel: 'Euclidean / Khớp',
        colorVar: '--measure-purple',
        supportsPolyline: true,
        guideText: 'Kéo từ khớp hông/đáy thân xuống bàn chân (hoặc bật "Đo qua khớp" nếu chân gập).',
      },
      {
        key: 'leg_width',
        label: 'Độ dày chân',
        kind: 'perpendicular_width',
        kindLabel: 'Vuông góc trục',
        colorVar: '--measure-purple',
        supportsPolyline: false,
        guideText: 'Kéo qua hai mép biên ngang đùi hoặc bắp chân (Python tự chiếu vuông góc trục chân).',
      },
    ],
  },
];

/** Danh sách phẳng 11 thông số theo đúng thứ tự chuẩn 1..11. */
export const ALL_ANATOMY_METRICS = ANATOMY_GROUPS.flatMap((group) =>
  group.metrics.map((metric) => ({ ...metric, groupId: group.id, groupLabel: group.label }))
);

/** Tra cứu nhanh metadata của một thông số theo khóa Backend. */
export const ANATOMY_METRIC_BY_KEY = Object.fromEntries(
  ALL_ANATOMY_METRICS.map((metric) => [metric.key, metric])
);
