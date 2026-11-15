/**
 * Tạo tự động một ảnh Sprite Sheet Pixel Art mẫu trong bộ nhớ (Canvas DataURL).
 * Dùng làm nhân vật mẫu ban đầu (Hiệp sĩ, Pháp sư, Hồ ly) để người dùng
 * có thể thử nghiệm ngay lập tức tính năng đổi nhân vật TAB / 1..9 mà không cần nạp trước.
 *
 * @param {string} type Loại nhân vật ('knight' | 'mage' | 'fox')
 * @returns {string} Chuỗi data URL định dạng PNG của sprite sheet 3x5.
 */
export function createDemoSpriteSheet(type = 'knight') {
  const cellW = 32;
  const cellH = 48;
  const cols = 5;
  const rows = 3;
  const canvas = document.createElement('canvas');
  canvas.width = cellW * cols;
  canvas.height = cellH * rows;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const palettes = {
    knight: {
      armor: '#475569',
      armorDark: '#1e293b',
      helm: '#64748b',
      visor: '#38bdf8',
      cape: '#581c87',
      skin: '#fcd34d'
    },
    mage: {
      armor: '#6b21a8',
      armorDark: '#3b0764',
      helm: '#581c87',
      visor: '#fbbf24',
      cape: '#7e22ce',
      skin: '#fed7aa'
    },
    fox: {
      armor: '#9a3412',
      armorDark: '#451a03',
      helm: '#c2410c',
      visor: '#10b981',
      cape: '#7c2d12',
      skin: '#ffedd5'
    }
  };

  const p = palettes[type] || palettes.knight;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = c * cellW;
      const oy = r * cellH;

      const isWalking = c > 0;
      const bob = isWalking ? (c % 2 === 0 ? -1 : 1) : 0;
      const legSwing = isWalking ? (c === 1 || c === 3 ? 2 : -2) : 0;

      // 1. Áo choàng
      ctx.fillStyle = p.cape;
      ctx.fillRect(ox + 9, oy + 20 + bob, 14, 18);

      // 2. Chân
      ctx.fillStyle = p.armorDark;
      if (r === 1) {
        ctx.fillRect(ox + 12 + legSwing, oy + 38, 4, 8);
        ctx.fillRect(ox + 16 - legSwing, oy + 38, 4, 8);
      } else {
        ctx.fillRect(ox + 10, oy + 38 + (legSwing > 0 ? -1 : 0), 5, 8);
        ctx.fillRect(ox + 17, oy + 38 + (legSwing < 0 ? -1 : 0), 5, 8);
      }

      // 3. Thân
      ctx.fillStyle = p.armor;
      ctx.fillRect(ox + 10, oy + 20 + bob, 12, 18);
      ctx.fillStyle = p.armorDark;
      ctx.fillRect(ox + 12, oy + 26 + bob, 8, 3);

      // 4. Đầu
      ctx.fillStyle = p.helm;
      ctx.fillRect(ox + 9, oy + 7 + bob, 14, 13);

      if (r === 0) {
        ctx.fillStyle = p.visor;
        ctx.fillRect(ox + 12, oy + 12 + bob, 8, 3);
      } else if (r === 1) {
        ctx.fillStyle = p.visor;
        ctx.fillRect(ox + 18, oy + 12 + bob, 4, 3);
      } else {
        ctx.fillStyle = p.armorDark;
        ctx.fillRect(ox + 11, oy + 10 + bob, 10, 4);
      }

      // 5. Tay
      ctx.fillStyle = p.armor;
      if (r === 1) {
        ctx.fillRect(ox + 14, oy + 22 + bob, 4, 10);
      } else {
        ctx.fillRect(ox + 7, oy + 22 + bob, 3, 10);
        ctx.fillRect(ox + 22, oy + 22 + bob, 3, 10);
      }
    }
  }

  return canvas.toDataURL('image/png');
}


/**
 * Ghép nối các ảnh trong bảng Slot Template thành một tấm Sprite Sheet trong bộ nhớ.
 * Áp dụng thuật toán cân bằng gót chân (Bottom-Center Anchor) và đệm khung tự động
 * để triệt tiêu hiện tượng rung lắc hay lệch tâm.
 *
 * @param {Object} slotsData Dữ liệu các ô (slotId -> { img, url, name }).
 * @param {boolean} is3Rows Có phải chế độ 3 hàng đầy đủ hay không.
 * @param {boolean} autoAnchor Có căn gót chân chạm đáy và giữa ngang hay không.
 * @returns {{ dataUrl: string, cellW: number, cellH: number, rows: number, columns: number }|null}
 */
export function stitchSlotsToSheet(slotsData, is3Rows = true, autoAnchor = true) {
  const numRows = is3Rows ? 3 : 1;
  const numCols = 5;

  let maxW = 32;
  let maxH = 48;
  Object.values(slotsData).forEach((item) => {
    if (item) {
      const srcObj = item.canvas || item.img;
      if (srcObj) {
        const w = srcObj.naturalWidth || srcObj.width || 32;
        const h = srcObj.naturalHeight || srcObj.height || 48;
        if (w > maxW) maxW = w;
        if (h > maxH) maxH = h;
      }
    }
  });

  const canvas = document.createElement('canvas');
  canvas.width = maxW * numCols;
  canvas.height = maxH * numRows;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const rowNames = is3Rows ? ['down', 'side', 'up'] : ['down'];
  for (let r = 0; r < numRows; r++) {
    const dir = rowNames[r];
    for (let c = 0; c < numCols; c++) {
      const slotId = `${dir}_${c}`;
      let item = slotsData[slotId];

      // Fallback nếu ô này chưa có ảnh: lấy ô idle của hàng đó hoặc ô down_0
      if (!item || (!item.canvas && !item.img)) {
        item = slotsData[`${dir}_0`] || slotsData['down_0'];
      }

      const srcObj = item ? (item.canvas || item.img) : null;
      if (srcObj) {
        const fw = srcObj.naturalWidth || srcObj.width;
        const fh = srcObj.naturalHeight || srcObj.height;
        const ox = autoAnchor ? Math.floor((maxW - fw) / 2) : 0;
        const oy = autoAnchor ? (maxH - fh) : 0;
        ctx.drawImage(srcObj, c * maxW + ox, r * maxH + oy, fw, fh);
      }
    }
  }

  return {
    dataUrl: canvas.toDataURL('image/png'),
    cellW: maxW,
    cellH: maxH,
    rows: numRows,
    columns: numCols
  };
}


/**
 * Trích xuất các ô frame từ ảnh Sprite Sheet của nhân vật đưa vào bảng Slot Template.
 * Giúp người dùng có thể mở lại bảng khung ô để xem và thay đổi bất kỳ ô frame nào bị nhầm.
 *
 * @param {Object} charObj Đối tượng nhân vật hiện tại.
 * @returns {Object} Dữ liệu slotsData mapping các slotId -> { img, canvas, url, name }.
 */
export function extractSlotsFromSheet(charObj) {
  if (!charObj || !charObj.sheetImage) return {};
  const slots = {};
  const img = charObj.sheetImage;
  const numRows = charObj.rows || 1;
  const numCols = charObj.columns || 5;
  const cw = charObj.cellWidth || Math.floor(img.naturalWidth / numCols);
  const ch = charObj.cellHeight || Math.floor(img.naturalHeight / numRows);
  const mx = charObj.marginX || 0;
  const my = charObj.marginY || 0;

  const rowNames = numRows > 1 ? ['down', 'side', 'up'] : ['down'];

  for (let r = 0; r < Math.min(numRows, 3); r++) {
    const dir = rowNames[r];
    for (let c = 0; c < Math.min(numCols, 5); c++) {
      const slotId = `${dir}_${c}`;
      const sx = mx + c * cw;
      const sy = my + r * ch;

      const fCanvas = document.createElement('canvas');
      fCanvas.width = cw;
      fCanvas.height = ch;
      const fCtx = fCanvas.getContext('2d');
      fCtx.imageSmoothingEnabled = false;
      fCtx.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch);

      const fUrl = fCanvas.toDataURL('image/png');
      const fImg = new Image();
      fImg.src = fUrl;
      fImg.width = cw;
      fImg.height = ch;

      const role = c === 0 ? 'idle' : `walk_${c - 1}`;
      slots[slotId] = {
        img: fImg,
        canvas: fCanvas,
        url: fUrl,
        name: `${role}_${dir}.png`
      };
    }
  }

  return slots;
}
