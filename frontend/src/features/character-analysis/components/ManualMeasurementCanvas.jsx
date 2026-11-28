// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Canvas, ResizeObserver & Sự kiện chuột)
// ========================================================
import React, { useCallback, useEffect, useRef, useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)
// ========================================================

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Cấu hình 11 thông số)
// ========================================================
import { ALL_ANATOMY_METRICS, ANATOMY_METRIC_BY_KEY } from '../manualAnatomyConfig';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Đọc biến màu từ theme.css)
// ========================================================

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 24;
const HANDLE_HIT_RADIUS_PX = 11;
const SEGMENT_HIT_DIST_PX = 7;

/** Tính khoảng cách từ điểm P đến đoạn thẳng AB trên hệ tọa độ màn hình để chọn đoạn đo. */
function distPointToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const lenSq = vx * vx + vy * vy;
  if (lenSq <= 1e-6) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / lenSq));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

/** Ước lượng nhanh giá trị pixel khi đang kéo nháp để hiển thị trực tiếp cho người dùng. */
function estimateLivePixelDistance(kind, points) {
  if (!points || points.length < 2) return 0;
  if (kind === 'height_y') return Math.abs(points[1][1] - points[0][1]);
  if (kind === 'width_x') return Math.abs(points[1][0] - points[0][0]);
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    total += Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
  }
  return total;
}

/**
 * Ép tọa độ điểm đích vuông góc trục Ox (đo chiều cao) hoặc trục Oy (đo chiều rộng)
 * để chống run tay khi kéo; hỗ trợ giữ Shift để khóa ngang/dọc với các chi.
 */
function snapPointToAxis(anchorPt, targetPt, metricKind, { axisLockEnabled = true, shiftKey = false } = {}) {
  if (!anchorPt || !targetPt) return targetPt;
  if (axisLockEnabled && metricKind === 'height_y') {
    return [anchorPt[0], targetPt[1]];
  }
  if (axisLockEnabled && metricKind === 'width_x') {
    return [targetPt[0], anchorPt[1]];
  }
  if (shiftKey) {
    const dx = Math.abs(targetPt[0] - anchorPt[0]);
    const dy = Math.abs(targetPt[1] - anchorPt[1]);
    return dx >= dy ? [targetPt[0], anchorPt[1]] : [anchorPt[0], targetPt[1]];
  }
  return targetPt;
}

/** Vẽ các tia gióng mờ xuyên qua vùng ảnh để căn mép chiều cao / chiều rộng chuẩn từng pixel. */
function drawAxisAlignmentGuides(ctx, imgRect, screenPoints, guideAxis, color) {
  if (!guideAxis || !screenPoints || screenPoints.length === 0) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  for (const [sx, sy] of screenPoints) {
    ctx.beginPath();
    if (guideAxis === 'horizontal') {
      ctx.moveTo(imgRect.x, sy + 0.5);
      ctx.lineTo(imgRect.x + imgRect.w, sy + 0.5);
    } else {
      ctx.moveTo(sx + 0.5, imgRect.y);
      ctx.lineTo(sx + 0.5, imgRect.y + imgRect.h);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Vùng canvas tương tác đo đoạn thẳng Point-to-Point hỗ trợ zoom, di chuyển ảnh,
 * kéo chỉnh đầu mút, di chuyển cả đoạn đo và vẽ đa đoạn qua khớp.
 *
 * @param {Object} props Thuộc tính điều khiển canvas và các điểm đo trên ảnh gốc.
 * @returns {React.ReactElement} Khung canvas tương tác toàn phần.
 */
export default function ManualMeasurementCanvas({
  image,
  measurements,
  activeMetric,
  hiddenMetrics,
  showOnlyActive,
  panMode,
  axisLockEnabled = true,
  polylineMode,
  draftPoints,
  zoom,
  onZoomChange,
  fitSignal,
  busy,
  onSelectMetric,
  onCommitPoints,
  onAddDraftPoint,
  onFinishPolyline,
  onDeleteActive,
  onUndoDraftPoint,
  onCancelDraft,
}) {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);

  const [viewportSize, setViewportSize] = useState({ width: 640, height: 480 });
  const [pan, setPan] = useState({ x: 32, y: 24 });
  const [spacePressed, setSpacePressed] = useState(false);
  const [shiftPressed, setShiftPressed] = useState(false);
  const [hoverPos, setHoverPos] = useState(null);
  const [hoverTarget, setHoverTarget] = useState(null);
  const [interaction, setInteraction] = useState(null);

  // Theo dõi kích thước khung chứa để luôn giữ canvas sắc nét theo DPI màn hình
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return undefined;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect && rect.width > 0 && rect.height > 0) {
        setViewportSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Căn giữa ảnh vừa khung nhìn khi vừa mở hoặc bấm nút Fit
  const fitImageToStage = useCallback(() => {
    if (!image || !viewportSize.width || !viewportSize.height) return;
    const padding = 56;
    const availW = Math.max(120, viewportSize.width - padding * 2);
    const availH = Math.max(120, viewportSize.height - padding * 2);
    const fitZoom = Math.max(MIN_ZOOM, Math.min(12, Math.min(availW / image.width, availH / image.height)));
    const snappedZoom = fitZoom >= 1 ? Math.max(1, Math.floor(fitZoom * 2) / 2) : Number(fitZoom.toFixed(2));
    onZoomChange(snappedZoom);
    setPan({
      x: Math.round((viewportSize.width - image.width * snappedZoom) / 2),
      y: Math.round((viewportSize.height - image.height * snappedZoom) / 2),
    });
  }, [image, viewportSize.width, viewportSize.height, onZoomChange]);

  useEffect(() => {
    fitImageToStage();
  }, [image, fitSignal]);

  // Hỗ trợ giữ phím Space để di chuyển ảnh tạm thời và Shift để khóa ngang/dọc cho chi
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code === 'Space' && !event.repeat && document.activeElement?.tagName !== 'INPUT') {
        setSpacePressed(true);
      }
      if (event.key === 'Shift') setShiftPressed(true);
    };
    const onKeyUp = (event) => {
      if (event.code === 'Space') setSpacePressed(false);
      if (event.key === 'Shift') setShiftPressed(false);
    };
    const onBlur = () => {
      setSpacePressed(false);
      setShiftPressed(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  /** Chuyển đổi tọa độ chuột trên canvas sang tọa độ pixel trên ảnh gốc (không dùng tọa độ zoom để tính). */
  const pointerToImagePoint = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const ix = Math.max(0, Math.min(image.width, Math.round((sx - pan.x) / zoom)));
    const iy = Math.max(0, Math.min(image.height, Math.round((sy - pan.y) / zoom)));
    return { screen: [sx, sy], image: [ix, iy] };
  };

  /** Danh sách các thông số đang hiển thị trên canvas (tôn trọng ẩn/hiện từng đường). */
  const visibleMetrics = ALL_ANATOMY_METRICS.filter((meta) => {
    const entry = measurements?.[meta.key];
    if (!entry || entry.occluded || !entry.points || entry.points.length < 2) return false;
    if (showOnlyActive && meta.key !== activeMetric) return false;
    return !hiddenMetrics?.[meta.key];
  });

  /** Kiểm tra con trỏ có đang chạm vào đầu mút hoặc thân đoạn đo nào không. */
  const hitTestMeasurement = (screenX, screenY) => {
    // Ưu tiên kiểm tra đầu mút trước (từ thông số đang chọn trước rồi đến các thông số khác)
    const ordered = [
      ...visibleMetrics.filter((m) => m.key === activeMetric),
      ...visibleMetrics.filter((m) => m.key !== activeMetric).reverse(),
    ];
    for (const meta of ordered) {
      const pts = measurements[meta.key].points;
      for (let i = 0; i < pts.length; i += 1) {
        const hx = pan.x + pts[i][0] * zoom;
        const hy = pan.y + pts[i][1] * zoom;
        if (Math.hypot(screenX - hx, screenY - hy) <= HANDLE_HIT_RADIUS_PX) {
          return { type: 'endpoint', metric: meta.key, index: i };
        }
      }
    }
    for (const meta of ordered) {
      const pts = measurements[meta.key].points;
      for (let i = 0; i < pts.length - 1; i += 1) {
        const ax = pan.x + pts[i][0] * zoom;
        const ay = pan.y + pts[i][1] * zoom;
        const bx = pan.x + pts[i + 1][0] * zoom;
        const by = pan.y + pts[i + 1][1] * zoom;
        if (distPointToSegment(screenX, screenY, ax, ay, bx, by) <= SEGMENT_HIT_DIST_PX) {
          return { type: 'segment', metric: meta.key };
        }
      }
    }
    return null;
  };

  // Vẽ lại toàn bộ sprite, lưới pixel và các đường đo vector sắc nét
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(viewportSize.width * dpr));
    canvas.height = Math.max(1, Math.round(viewportSize.height * dpr));

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewportSize.width, viewportSize.height);

    const styles = getComputedStyle(canvas);
    const resolveColor = (colorVar) => styles.getPropertyValue(colorVar).trim() || '#facc15';

    // Vẽ ô caro nền phía sau vùng ảnh sprite gốc
    const imgW = image.width * zoom;
    const imgH = image.height * zoom;
    ctx.save();
    ctx.beginPath();
    ctx.rect(pan.x, pan.y, imgW, imgH);
    ctx.clip();
    const tile = 12;
    for (let y = Math.floor(pan.y / tile) * tile; y < pan.y + imgH; y += tile) {
      for (let x = Math.floor(pan.x / tile) * tile; x < pan.x + imgW; x += tile) {
        const even = ((Math.floor(x / tile) + Math.floor(y / tile)) & 1) === 0;
        ctx.fillStyle = even ? '#141a2e' : '#0d1222';
        ctx.fillRect(x, y, tile, tile);
      }
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, pan.x, pan.y, imgW, imgH);
    ctx.restore();

    // Viền bao ảnh gốc
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(pan.x + 0.5, pan.y + 0.5, imgW, imgH);

    // Hàm vẽ 1 đường đo hoàn chỉnh hoặc đang chỉnh sửa
    const drawOverlayMetric = (meta, pts, valuePx, { isDraft = false, isHighlighted = false } = {}) => {
      if (!pts || pts.length < 1) return;
      const color = resolveColor(meta.colorVar);
      const screenPts = pts.map(([x, y]) => [pan.x + x * zoom, pan.y + y * zoom]);

      if (screenPts.length >= 2) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (isDraft) ctx.setLineDash([6, 4]);

        // Viền tối tạo tương phản trên mọi nền pixel art
        ctx.beginPath();
        screenPts.forEach(([sx, sy], idx) => (idx === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy)));
        ctx.strokeStyle = 'rgba(6, 4, 12, 0.88)';
        ctx.lineWidth = (isHighlighted ? 5 : 4);
        ctx.stroke();

        // Đường màu chính theo nhóm bộ phận
        ctx.strokeStyle = color;
        ctx.lineWidth = (isHighlighted ? 2.6 : 2);
        ctx.stroke();
        ctx.restore();
      }

      // Vẽ hai đầu mút và các điểm khớp nối
      screenPts.forEach(([sx, sy], idx) => {
        const isHoveredHandle =
          hoverTarget?.type === 'endpoint' &&
          hoverTarget?.metric === meta.key &&
          hoverTarget?.index === idx;
        const radius = isHoveredHandle ? 6 : isHighlighted ? 5 : 4.2;
        ctx.beginPath();
        ctx.arc(sx, sy, radius + 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6, 4, 12, 0.9)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      });

      // Vẽ nhãn tên thông số + giá trị pixel
      if (screenPts.length >= 2 && valuePx !== null && valuePx !== undefined) {
        const midIdx = Math.floor((screenPts.length - 1) / 2);
        const [ax, ay] = screenPts[midIdx];
        const [bx, by] = screenPts[midIdx + 1];
        const lx = (ax + bx) / 2;
        const ly = (ay + by) / 2 - 12;
        const text = `${meta.label}: ${Number(valuePx).toFixed(1).replace(/\.0$/, '')} px`;

        ctx.save();
        ctx.font = '600 11px "Plus Jakarta Sans", system-ui, sans-serif';
        const textW = ctx.measureText(text).width;
        const pillW = textW + 14;
        const pillH = 20;
        const px = Math.max(6, Math.min(viewportSize.width - pillW - 6, lx - pillW / 2));
        const py = Math.max(6, Math.min(viewportSize.height - pillH - 6, ly - pillH / 2));

        ctx.fillStyle = 'rgba(10, 8, 22, 0.88)';
        ctx.strokeStyle = color;
        ctx.lineWidth = isHighlighted ? 1.5 : 1;
        ctx.beginPath();
        ctx.roundRect(px, py, pillW, pillH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, px + 7, py + pillH / 2 + 0.5);
        ctx.restore();
      }
    };

    // Vẽ tất cả đường đo đã lưu (trừ đường đang bị kéo chỉnh tạm)
    visibleMetrics.forEach((meta) => {
      if (interaction?.metric === meta.key && (interaction.type === 'edit-endpoint' || interaction.type === 'move-segment')) {
        return;
      }
      const entry = measurements[meta.key];
      drawOverlayMetric(meta, entry.points, entry.value_px, {
        isHighlighted: meta.key === activeMetric,
      });
    });

    // Vẽ đường đang kéo chỉnh đầu mút hoặc đang di chuyển
    const imgRect = { x: pan.x, y: pan.y, w: imgW, h: imgH };
    const toScreen = ([x, y]) => [pan.x + x * zoom, pan.y + y * zoom];

    if (interaction?.type === 'edit-endpoint' || interaction?.type === 'move-segment') {
      const meta = ANATOMY_METRIC_BY_KEY[interaction.metric];
      const liveVal = estimateLivePixelDistance(meta.kind, interaction.points);
      if (axisLockEnabled && (meta.kind === 'height_y' || meta.kind === 'width_x')) {
        const guideAxis = meta.kind === 'height_y' ? 'horizontal' : 'vertical';
        drawAxisAlignmentGuides(ctx, imgRect, interaction.points.map(toScreen), guideAxis, resolveColor(meta.colorVar));
      }
      drawOverlayMetric(meta, interaction.points, liveVal, { isDraft: true, isHighlighted: true });
    }

    // Vẽ đoạn thẳng đang kéo mới hoặc chuỗi điểm nối tiếp qua khớp
    if (interaction?.type === 'create-segment') {
      const meta = ANATOMY_METRIC_BY_KEY[interaction.metric];
      const pts = [interaction.start, interaction.end];
      if (axisLockEnabled && (meta.kind === 'height_y' || meta.kind === 'width_x')) {
        const guideAxis = meta.kind === 'height_y' ? 'horizontal' : 'vertical';
        drawAxisAlignmentGuides(ctx, imgRect, pts.map(toScreen), guideAxis, resolveColor(meta.colorVar));
      }
      drawOverlayMetric(meta, pts, estimateLivePixelDistance(meta.kind, pts), { isDraft: true, isHighlighted: true });
    } else if (polylineMode && draftPoints.length > 0) {
      const meta = ANATOMY_METRIC_BY_KEY[activeMetric];
      const snappedHover =
        hoverPos && shiftPressed
          ? snapPointToAxis(draftPoints[draftPoints.length - 1], hoverPos, meta.kind, { axisLockEnabled: false, shiftKey: true })
          : hoverPos;
      const previewPts = snappedHover ? [...draftPoints, snappedHover] : draftPoints;
      drawOverlayMetric(meta, previewPts, estimateLivePixelDistance(meta.kind, previewPts), {
        isDraft: true,
        isHighlighted: true,
      });
    } else if (!interaction && hoverPos && !panMode && !spacePressed && !polylineMode && axisLockEnabled) {
      // Vẽ tia gióng mờ theo con trỏ khi chuẩn bị đặt điểm đo chiều cao / chiều rộng
      const activeMeta = ANATOMY_METRIC_BY_KEY[activeMetric];
      if (activeMeta && (activeMeta.kind === 'height_y' || activeMeta.kind === 'width_x')) {
        const guideAxis = activeMeta.kind === 'height_y' ? 'horizontal' : 'vertical';
        drawAxisAlignmentGuides(ctx, imgRect, [toScreen(hoverPos)], guideAxis, resolveColor(activeMeta.colorVar));
      }
    }
  }, [
    image,
    viewportSize,
    pan,
    zoom,
    visibleMetrics,
    measurements,
    activeMetric,
    hoverTarget,
    interaction,
    panMode,
    spacePressed,
    shiftPressed,
    axisLockEnabled,
    polylineMode,
    draftPoints,
    hoverPos,
  ]);

  const handleWheel = (event) => {
    if (!image) return;
    event.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? 1.2 : 1 / 1.2;
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number((zoom * factor).toFixed(2))));
    if (nextZoom === zoom) return;

    const imgX = (sx - pan.x) / zoom;
    const imgY = (sy - pan.y) / zoom;
    onZoomChange(nextZoom);
    setPan({
      x: Math.round(sx - imgX * nextZoom),
      y: Math.round(sy - imgY * nextZoom),
    });
  };

  const handlePointerDown = (event) => {
    if (!image || busy) return;
    event.currentTarget.focus();

    // Kéo di chuyển ảnh bằng chuột giữa, Space + chuột trái hoặc khi bật công cụ Di chuyển
    if (event.button === 1 || panMode || spacePressed) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setInteraction({
        type: 'pan',
        startScreen: [event.clientX, event.clientY],
        startPan: { ...pan },
      });
      return;
    }

    if (event.button !== 0) return;
    const { screen, image: imgPt } = pointerToImagePoint(event.clientX, event.clientY);

    // Trong chế độ đo nhiều đoạn nối tiếp qua khớp cho tay/chân
    if (polylineMode) {
      const meta = ANATOMY_METRIC_BY_KEY[activeMetric];
      const nextPt =
        draftPoints.length > 0 && event.shiftKey
          ? snapPointToAxis(draftPoints[draftPoints.length - 1], imgPt, meta?.kind, { axisLockEnabled: false, shiftKey: true })
          : imgPt;
      onAddDraftPoint(nextPt);
      return;
    }

    // Kiểm tra kéo chỉnh đầu mút hoặc di chuyển đường đo có sẵn
    const hit = hitTestMeasurement(screen[0], screen[1]);
    if (hit) {
      onSelectMetric(hit.metric);
      event.currentTarget.setPointerCapture(event.pointerId);
      const basePoints = measurements[hit.metric].points.map((p) => [...p]);
      if (hit.type === 'endpoint') {
        setInteraction({
          type: 'edit-endpoint',
          metric: hit.metric,
          index: hit.index,
          points: basePoints,
        });
      } else {
        setInteraction({
          type: 'move-segment',
          metric: hit.metric,
          anchorImage: imgPt,
          originPoints: basePoints,
          points: basePoints,
        });
      }
      return;
    }

    // Kéo tạo đoạn đo mới cho thông số đang chọn
    event.currentTarget.setPointerCapture(event.pointerId);
    setInteraction({
      type: 'create-segment',
      metric: activeMetric,
      start: imgPt,
      end: imgPt,
    });
  };

  const handlePointerMove = (event) => {
    if (!image) return;
    if (interaction?.type === 'pan') {
      setPan({
        x: interaction.startPan.x + (event.clientX - interaction.startScreen[0]),
        y: interaction.startPan.y + (event.clientY - interaction.startScreen[1]),
      });
      return;
    }

    const { screen, image: imgPt } = pointerToImagePoint(event.clientX, event.clientY);
    setHoverPos(imgPt);

    if (!interaction) {
      if (!panMode && !spacePressed && !polylineMode) {
        setHoverTarget(hitTestMeasurement(screen[0], screen[1]));
      } else {
        setHoverTarget(null);
      }
      return;
    }

    if (interaction.type === 'create-segment') {
      const meta = ANATOMY_METRIC_BY_KEY[interaction.metric];
      const snappedEnd = snapPointToAxis(interaction.start, imgPt, meta?.kind, {
        axisLockEnabled,
        shiftKey: event.shiftKey,
      });
      setInteraction({ ...interaction, end: snappedEnd });
    } else if (interaction.type === 'edit-endpoint') {
      const meta = ANATOMY_METRIC_BY_KEY[interaction.metric];
      let nextPt = imgPt;
      if (interaction.points.length === 2) {
        const anchorPt = interaction.points[interaction.index === 0 ? 1 : 0];
        nextPt = snapPointToAxis(anchorPt, imgPt, meta?.kind, {
          axisLockEnabled,
          shiftKey: event.shiftKey,
        });
      } else if (event.shiftKey && interaction.points.length > 2) {
        const anchorPt = interaction.index > 0 ? interaction.points[interaction.index - 1] : interaction.points[1];
        nextPt = snapPointToAxis(anchorPt, imgPt, meta?.kind, { axisLockEnabled: false, shiftKey: true });
      }
      const next = interaction.points.map((p, idx) => (idx === interaction.index ? nextPt : p));
      setInteraction({ ...interaction, points: next });
    } else if (interaction.type === 'move-segment') {
      const rawDx = imgPt[0] - interaction.anchorImage[0];
      const rawDy = imgPt[1] - interaction.anchorImage[1];
      const xs = interaction.originPoints.map((p) => p[0]);
      const ys = interaction.originPoints.map((p) => p[1]);
      const clampedDx = Math.max(-Math.min(...xs), Math.min(image.width - Math.max(...xs), rawDx));
      const clampedDy = Math.max(-Math.min(...ys), Math.min(image.height - Math.max(...ys), rawDy));
      const next = interaction.originPoints.map(([px, py]) => [px + clampedDx, py + clampedDy]);
      setInteraction({ ...interaction, points: next });
    }
  };

  const handlePointerUp = (event) => {
    if (!interaction) return;
    if (interaction.type === 'pan') {
      setInteraction(null);
      return;
    }
    const { image: imgPt } = pointerToImagePoint(event.clientX, event.clientY);
    const current = interaction;
    setInteraction(null);

    if (current.type === 'create-segment') {
      const meta = ANATOMY_METRIC_BY_KEY[current.metric];
      const snappedEnd = snapPointToAxis(current.start, imgPt, meta?.kind, {
        axisLockEnabled,
        shiftKey: event.shiftKey,
      });
      const pts = [current.start, snappedEnd];
      if (pts[0][0] === pts[1][0] && pts[0][1] === pts[1][1]) return;
      onCommitPoints(current.metric, pts);
    } else if (current.type === 'edit-endpoint' || current.type === 'move-segment') {
      onCommitPoints(current.metric, current.points);
    }
  };

  const handleKeyDown = (event) => {
    if (busy) return;
    if (event.key === 'Enter' && polylineMode && draftPoints.length >= 2) {
      event.preventDefault();
      onFinishPolyline();
    } else if (event.key === 'Escape' && polylineMode && draftPoints.length > 0) {
      event.preventDefault();
      onCancelDraft();
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      if (polylineMode && draftPoints.length > 0) onUndoDraftPoint();
      else onDeleteActive();
    } else if (event.key === 'Delete') {
      event.preventDefault();
      onDeleteActive();
    }
  };

  const cursorStyle =
    interaction?.type === 'pan' || panMode || spacePressed
      ? 'grab'
      : hoverTarget?.type === 'endpoint'
        ? 'pointer'
        : hoverTarget?.type === 'segment'
          ? 'move'
          : 'crosshair';

  return (
    <div ref={stageRef} className="manual-canvas-stage">
      <canvas
        ref={canvasRef}
        className="manual-canvas-surface"
        style={{ cursor: cursorStyle }}
        tabIndex={0}
        aria-label="Vùng vẽ và chỉnh sửa đoạn thẳng đo giải phẫu trên ảnh gốc"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => setInteraction(null)}
        onDoubleClick={() => {
          if (polylineMode && draftPoints.length >= 2) onFinishPolyline();
        }}
        onKeyDown={handleKeyDown}
      />

      {image && (
        <div className="manual-canvas-hud" aria-live="polite">
          <span>Ảnh gốc: {image.width} × {image.height} px</span>
          <span>•</span>
          <span>Tọa độ: {hoverPos ? `(${hoverPos[0]}, ${hoverPos[1]})` : '—'}</span>
          <span>•</span>
          <span>Thu phóng: {zoom}×</span>
        </div>
      )}
    </div>
  );
}
