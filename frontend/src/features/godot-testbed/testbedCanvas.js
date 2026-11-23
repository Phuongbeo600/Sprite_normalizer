// 1. THƯ VIỆN NỀN TẢNG JAVASCRIPT
// Không cần thư viện nền tảng bổ sung.

// 2. THƯ VIỆN BÊN NGOÀI
// Không dùng thư viện bên ngoài.

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Không có phụ thuộc nội bộ.

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Các tham số được truyền từ phòng thử nghiệm.

// Vẽ phông nền mặc định
const drawDefaultNightCliffMap = (ctx, w, h, groundY) => {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
  skyGrad.addColorStop(0, '#040714');
  skyGrad.addColorStop(0.45, '#0b132b');
  skyGrad.addColorStop(0.75, '#1c2541');
  skyGrad.addColorStop(1, '#0a1128');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);

  const moonX = w * 0.72;
  const moonY = h * 0.22;
  const moonRadius = 46;

  const moonGlow = ctx.createRadialGradient(moonX, moonY, 10, moonX, moonY, 180);
  moonGlow.addColorStop(0, 'rgba(219, 234, 254, 0.45)');
  moonGlow.addColorStop(0.4, 'rgba(147, 197, 253, 0.15)');
  moonGlow.addColorStop(1, 'rgba(147, 197, 253, 0)');
  ctx.fillStyle = moonGlow;
  ctx.beginPath();
  ctx.arc(moonX, moonY, 180, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  const stars = [
    [120, 80, 2], [180, 140, 1.5], [290, 70, 2.5], [410, 110, 1.5],
    [520, 60, 2], [640, 130, 2], [790, 75, 1.5], [920, 120, 2.5],
    [1040, 85, 2], [1160, 130, 1.5], [210, 190, 1.5], [350, 220, 2],
    [850, 210, 1.5], [1080, 230, 2]
  ];
  for (const [sx, sy, sr] of stars) {
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#0d1b2a';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.65);
  ctx.lineTo(w * 0.18, h * 0.52);
  ctx.lineTo(w * 0.38, h * 0.62);
  ctx.lineTo(w * 0.55, h * 0.48);
  ctx.lineTo(w * 0.78, h * 0.58);
  ctx.lineTo(w * 0.92, h * 0.50);
  ctx.lineTo(w, h * 0.60);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  const cliffY = groundY;
  const cliffGrad = ctx.createLinearGradient(0, cliffY, 0, h);
  cliffGrad.addColorStop(0, '#1b4332');
  cliffGrad.addColorStop(0.08, '#081c15');
  cliffGrad.addColorStop(1, '#020907');
  ctx.fillStyle = cliffGrad;
  ctx.beginPath();
  ctx.moveTo(0, cliffY);
  ctx.lineTo(w, cliffY);
  ctx.lineTo(w, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#40916c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, cliffY);
  ctx.lineTo(w, cliffY);
  ctx.stroke();
};


/**
 * Vẽ bản đồ, nhân vật theo độ sâu và các lớp gỡ lỗi mà không điều khiển vòng lặp.
 * @param {CanvasRenderingContext2D} ctx Ngữ cảnh canvas đích.
 * @param {Object} options Ảnh, đội hình và tùy chọn hiển thị hiện tại.
 * @returns {void} Ghi các lệnh vẽ lên canvas.
 */
export function drawTestbedCanvas(ctx, {characters, roster, activeCharIdx, w, h, groundY, mapImage, showFloorGrid, showGroundLine, showCollision, showOrigin, showGuidelines, pixelZoom}) {
  ctx.imageSmoothingEnabled = false;

  if (mapImage) {
    ctx.drawImage(mapImage, 0, 0, w, h);
  } else {
    drawDefaultNightCliffMap(ctx, w, h, groundY);
  }

  if (showFloorGrid) {
    const tileSize = 32;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }

  if (showGroundLine) {
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.7)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#d8b4fe';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`MẶT ĐẤT Y = ${groundY} px (Chân tiếp xúc 1:1 • Kéo thả chuột để dời vị trí)`, 14, groundY - 8);
  }

  const sortedIndices = characters.map((_, idx) => idx).sort((a, b) => {
    const yA = roster[a]?.y || 0;
    const yB = roster[b]?.y || 0;
    return yA - yB;
  });

  sortedIndices.forEach((idx) => {
    const charObj = characters[idx];
    const state = roster[idx];
    if (!charObj || !state || !charObj.sheetImage) return;

    const px = Math.round(state.x);
    const py = Math.round(state.y);
    const isCurrentActive = idx === activeCharIdx;

    const effectiveZoom = pixelZoom * (charObj.scale || 1.0);
    const drawW = Math.round(charObj.cellWidth * effectiveZoom);
    const drawH = Math.round(charObj.cellHeight * effectiveZoom);

    if (isCurrentActive) {
      ctx.save();
      ctx.fillStyle = 'rgba(192, 132, 252, 0.22)';
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(px, py, drawW * 0.35, drawW * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.moveTo(px, py - drawH - 16);
      ctx.lineTo(px - 6, py - drawH - 24);
      ctx.lineTo(px + 6, py - drawH - 24);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(px, py, drawW * 0.28, drawW * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    let rowIdx = 0;
    if (state.direction === 'side' && charObj.rows > 1) rowIdx = 1;
    if (state.direction === 'up' && charObj.rows > 2) rowIdx = 2;

    const colIdx = Math.min(state.animFrameIdx, charObj.columns - 1);
    const srcX = (charObj.marginX || 0) + colIdx * charObj.cellWidth;
    const srcY = (charObj.marginY || 0) + rowIdx * charObj.cellHeight;

    const drawX = Math.round(px - drawW / 2);
    const drawY = Math.round(py - drawH);

    ctx.save();
    if (state.facingLeft) {
      ctx.translate(px, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(
        charObj.sheetImage,
        srcX, srcY, charObj.cellWidth, charObj.cellHeight,
        Math.round(-drawW / 2), drawY, drawW, drawH
      );
    } else {
      ctx.drawImage(
        charObj.sheetImage,
        srcX, srcY, charObj.cellWidth, charObj.cellHeight,
        drawX, drawY, drawW, drawH
      );
    }
    ctx.restore();

    if (showCollision) {
      const colW = Math.round(drawW * 0.45);
      const colH = Math.round(drawH * 0.65);
      const colX = Math.round(px - colW / 2);
      const colY = Math.round(py - colH);

      ctx.fillStyle = isCurrentActive ? 'rgba(239, 68, 68, 0.22)' : 'rgba(168, 85, 247, 0.14)';
      ctx.fillRect(colX, colY, colW, colH);
      ctx.strokeStyle = isCurrentActive ? '#ef4444' : 'rgba(168, 85, 247, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(colX, colY, colW, colH);
    }

    if (showOrigin) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px - 6, py);
      ctx.lineTo(px + 6, py);
      ctx.moveTo(px, py - 6);
      ctx.lineTo(px + 6, py);
      ctx.stroke();
    }

    ctx.fillStyle = isCurrentActive ? '#ffffff' : '#a39bc2';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`[${idx + 1}] ${charObj.name}`, px, py + 16);

    ctx.fillStyle = isCurrentActive ? '#d8b4fe' : '#716b89';
    ctx.font = '9px monospace';
    const scaleTxt = charObj.scale && charObj.scale !== 1.0 ? ` (x${charObj.scale})` : '';
    ctx.fillText(`${charObj.cellWidth}×${charObj.cellHeight} px${scaleTxt}`, px, py + 28);
  });

  if (showGuidelines && characters[activeCharIdx] && roster[activeCharIdx]) {
    const actChar = characters[activeCharIdx];
    const actState = roster[activeCharIdx];
    const effZoom = pixelZoom * (actChar.scale || 1.0);
    const actH = Math.round(actChar.cellHeight * effZoom);
    const headY = Math.round(actState.y - actH);

    ctx.strokeStyle = 'rgba(251, 191, 36, 0.75)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, headY);
    ctx.lineTo(w, headY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`ĐỈNH ĐẦU: Cao ${Math.round(actChar.cellHeight * (actChar.scale || 1.0))}px (Tỉ lệ thực)`, 14, headY - 4);
  }
}
