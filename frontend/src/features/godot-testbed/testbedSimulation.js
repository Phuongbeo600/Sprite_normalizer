// 1. THƯ VIỆN NỀN TẢNG JAVASCRIPT
// Không cần thư viện nền tảng bổ sung.

// 2. THƯ VIỆN BÊN NGOÀI
// Không dùng thư viện bên ngoài.

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Không có phụ thuộc nội bộ.

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Các tham số được truyền từ phòng thử nghiệm.

/**
 * Tiến một nhịp chuyển động và hoạt họa, giữ chỉ mục đội hình trùng với danh sách nhân vật.
 * @param {Object} options Đội hình, phím bấm, thời gian và giới hạn sân.
 * @returns {void} Cập nhật trực tiếp các trạng thái đội hình được truyền vào.
 */
export function advanceTestbedSimulation({characters, roster, activeCharIdx, keys: pressedKeys, isDragging, delta, w, h, groundY}) {
  const activeState = roster[activeCharIdx];
  const activeChar = characters[activeCharIdx];

  if (activeState && activeChar && !isDragging) {
    let dx = 0;
    let dy = 0;
    const keys = pressedKeys;
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;

    const isMoving = dx !== 0 || dy !== 0;
    activeState.isMoving = isMoving;

    if (isMoving) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;

      if (Math.abs(dx) > Math.abs(dy)) {
        activeState.direction = 'side';
        activeState.facingLeft = dx < 0;
      } else if (dy > 0) {
        activeState.direction = 'down';
        activeState.facingLeft = false;
      } else {
        activeState.direction = 'up';
        activeState.facingLeft = false;
      }

      activeState.x += dx * activeChar.moveSpeed * delta;
      activeState.y += dy * (activeChar.moveSpeed * 0.7) * delta;

      activeState.x = Math.max(50, Math.min(w - 50, activeState.x));
      activeState.y = Math.max(groundY - 60, Math.min(h - 30, activeState.y));

      activeState.animTime += delta;
      const frameDuration = 1.0 / Math.max(1, activeChar.fps);
      if (activeState.animTime >= frameDuration) {
        activeState.animTime = 0;
        const walkFrameCount = Math.max(1, activeChar.columns - 1);
        activeState.animFrameIdx = (activeState.animFrameIdx % walkFrameCount) + 1;
      }
    } else {
      activeState.animFrameIdx = 0;
      activeState.animTime = 0;
    }
  }

  roster.forEach((st, idx) => {
    if (idx !== activeCharIdx && characters[idx]) {
      st.isMoving = false;
      st.animTime += delta;
      const charObj = characters[idx];
      const frameDuration = 1.0 / Math.max(1, charObj.fps);
      if (st.animTime >= frameDuration) {
        st.animTime = 0;
        st.animFrameIdx = 0;
      }
    }
  });
}

/**
 * Khởi tạo tư thế đứng yên dùng bởi mọi luồng thêm nhân vật.
 * @param {number} x Tọa độ ngang đã tính theo từng nguồn nhân vật.
 * @param {number} y Tọa độ mặt đất hiện tại.
 * @returns {Object} Trạng thái chuyển động riêng cho một nhân vật.
 */
export function createRosterState(x, y) {
  return {x, y, direction: 'down', facingLeft: false, animTime: 0, animFrameIdx: 0, isMoving: false};
}
