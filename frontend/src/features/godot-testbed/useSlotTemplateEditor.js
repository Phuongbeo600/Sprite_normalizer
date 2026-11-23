// 1. THƯ VIỆN NỀN TẢNG JAVASCRIPT
// React quản lý trạng thái, tham chiếu canvas và vòng lặp xem trước.
import { useState, useRef, useEffect } from 'react';

// 2. THƯ VIỆN BÊN NGOÀI
// Không dùng thư viện bên ngoài.

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// Ghép và trích xuất ảnh từ bảng khung ô.
import { stitchSlotsToSheet, extractSlotsFromSheet } from './spriteSheets';
// Mỗi nhân vật có một trạng thái vận động độc lập.
import { createRosterState } from './testbedSimulation';

// Giao tiếp API tách khỏi trạng thái và giao diện.
import { createTestbedCharacter, updateTestbedCharacter, updateTestbedSlot } from './testbedApi';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Các tham số được truyền từ phòng thử nghiệm.

/**
 * Quản lý phiên chỉnh sửa khung ô, ghép ảnh và xem trước hoạt họa.
 * @param {Object} options Dữ liệu đội hình và các hàm cập nhật thuộc phòng thử nghiệm.
 * @returns {Object} Trạng thái và thao tác dùng bởi hộp thoại khung ô.
 */
export function useSlotTemplateEditor({characters, setCharacters, setActiveCharIdx, currentProject, groundY, rosterStateRef, setAddMenuOpen, setErrorMsg}) {
  const [isSlotModalOpen, setIsSlotModalOpen] = useState(false);
  // Chỉ mục nhân vật đang chỉnh sửa (nếu null là đang tạo nhân vật mới)
  const [editingCharIdx, setEditingCharIdx] = useState(null);
  const [slotMode, setSlotMode] = useState('3_rows');
  const [slotsData, setSlotsData] = useState({});
  const [stagedCharName, setStagedCharName] = useState('Hero');
  const [stagedFps, setStagedFps] = useState(8);
  const [stagedAutoAnchor, setStagedAutoAnchor] = useState(true);
  const [dragOverSlot, setDragOverSlot] = useState(null);

  // Canvas preview trong Modal (cho 3 hướng: down, side, up)
  const previewDownCanvasRef = useRef(null);
  const previewSideCanvasRef = useRef(null);
  const previewUpCanvasRef = useRef(null);

  // ========================================================
  // CHỨC NĂNG 2: THÊM NHÂN VẬT MỚI TỪ BẢNG KHUNG Ô (SLOT TEMPLATE)
  // ========================================================
  const handleOpenSlotTemplateModal = () => {
    setAddMenuOpen(false);
    setEditingCharIdx(null); // Đang tạo nhân vật mới
    setSlotsData({});
    setStagedCharName('Hero');
    setStagedFps(8);
    setStagedAutoAnchor(true);
    setSlotMode('3_rows');
    setIsSlotModalOpen(true);
  };

  // ========================================================
  // CHỨC NĂNG 3: MỞ LẠI BẢNG KHUNG Ô ĐỂ CHỈNH SỬA / ĐỔI FRAME ĐẶT NHẦM
  // ========================================================
  const handleEditCharacterSlots = (charIdx) => {
    const charToEdit = characters[charIdx];
    if (!charToEdit) return;

    setEditingCharIdx(charIdx);
    setStagedCharName(charToEdit.name);
    setStagedFps(charToEdit.fps || 8);
    setStagedAutoAnchor(true);
    setSlotMode(charToEdit.rows > 1 ? '3_rows' : '1_row');

    // Nạp lại các ô đã lưu hoặc trích xuất từng ô từ Sprite Sheet hiện tại
    if (charToEdit.slotsData && Object.keys(charToEdit.slotsData).length > 0) {
      setSlotsData({ ...charToEdit.slotsData });
    } else {
      const extracted = extractSlotsFromSheet(charToEdit);
      setSlotsData(extracted);
    }

    setIsSlotModalOpen(true);
  };

  /**
   * Nạp tệp ảnh vào đúng một ô cụ thể theo slotId (kèm tạo canvas đệm đồng bộ)
   */
  const handleSetSlotImage = (slotId, file) => {
    if (!file) return;
    if (file.name.endsWith('.import')) return;

    const reader = new FileReader();
    reader.onload = (re) => {
      const dataUrl = re.target.result;
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0);

        setSlotsData((prev) => ({
          ...prev,
          [slotId]: {
            img,
            canvas: c,
            url: dataUrl,
            name: file.name,
            file
          }
        }));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  /**
   * Gỡ bỏ ảnh khỏi một ô cụ thể
   */
  const handleClearSlot = (slotId, e) => {
    if (e) e.stopPropagation();
    setSlotsData((prev) => {
      const updated = { ...prev };
      delete updated[slotId];
      return updated;
    });
  };

  /**
   * Hoán đổi vị trí ảnh giữa 2 ô slot bất kỳ
   */
  const handleSwapSlots = (slotA, slotB) => {
    if (!slotA || !slotB || slotA === slotB) return;
    setSlotsData((prev) => {
      const updated = { ...prev };
      const tempA = updated[slotA];
      const tempB = updated[slotB];
      if (tempB) updated[slotA] = tempB;
      else delete updated[slotA];
      if (tempA) updated[slotB] = tempA;
      else delete updated[slotB];
      return updated;
    });
  };

  /**
   * Hoán đổi toàn bộ 5 ô giữa 2 hàng (ví dụ: Down ↔ Side, hoặc Side ↔ Up)
   */
  const handleSwapRows = (rowA, rowB) => {
    if (!rowA || !rowB || rowA === rowB) return;
    setSlotsData((prev) => {
      const updated = { ...prev };
      for (let c = 0; c < 5; c++) {
        const idA = `${rowA}_${c}`;
        const idB = `${rowB}_${c}`;
        const tempA = updated[idA];
        const tempB = updated[idB];
        if (tempB) updated[idA] = tempB;
        else delete updated[idA];
        if (tempA) updated[idB] = tempA;
        else delete updated[idB];
      }
      return updated;
    });
  };

  /**
   * Xóa toàn bộ ảnh trong một hàng cụ thể
   */
  const handleClearRow = (rowName) => {
    setSlotsData((prev) => {
      const updated = { ...prev };
      for (let c = 0; c < 5; c++) {
        delete updated[`${rowName}_${c}`];
      }
      return updated;
    });
  };

  /**
   * Dịch chuyển vòng các ô trong hàng sang trái (-1) hoặc sang phải (+1)
   */
  const handleShiftRow = (rowName, direction) => {
    setSlotsData((prev) => {
      const updated = { ...prev };
      const rowSlots = [];
      for (let c = 0; c < 5; c++) {
        rowSlots.push(updated[`${rowName}_${c}`]);
      }
      if (direction > 0) {
        // Dịch phải (ô cuối quay về đầu)
        const last = rowSlots.pop();
        rowSlots.unshift(last);
      } else {
        // Dịch trái (ô đầu ra sau)
        const first = rowSlots.shift();
        rowSlots.push(first);
      }
      for (let c = 0; c < 5; c++) {
        if (rowSlots[c]) updated[`${rowName}_${c}`] = rowSlots[c];
        else delete updated[`${rowName}_${c}`];
      }
      return updated;
    });
  };

  /**
   * Nạp nhanh tự động nếu người dùng có sẵn cả cụm nhiều file ảnh
   */
  const handleBatchAutoAssignSlots = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files || files.length === 0) return;

    const imageFiles = files.filter((f) => !f.name.endsWith('.import') && /\.(png|jpe?g|webp)$/i.test(f.name));

    imageFiles.forEach((file) => {
      const name = file.name.toLowerCase();
      let matchedSlot = null;

      let dir = 'down';
      if (name.includes('side') || name.includes('left') || name.includes('right')) dir = 'side';
      else if (name.includes('up') || name.includes('back')) dir = 'up';

      if (name.includes('idle') || name.includes('stand')) {
        matchedSlot = `${dir}_0`;
      } else {
        const numMatch = name.match(/(\d+)/);
        if (numMatch) {
          const stepNum = parseInt(numMatch[1], 10);
          if (stepNum >= 0 && stepNum <= 3) {
            matchedSlot = `${dir}_${stepNum + 1}`;
          } else if (stepNum >= 1 && stepNum <= 4) {
            matchedSlot = `${dir}_${stepNum}`;
          }
        }
      }

      if (matchedSlot) {
        handleSetSlotImage(matchedSlot, file);
      }
    });
  };

  /**
   * Xác nhận ghép toàn bộ các ô Slot thành Sprite Sheet:
   * - Nếu editingCharIdx !== null: Cập nhật nhân vật đang có (giữ nguyên toạ độ trên sàn và đồng bộ MySQL).
   * - Nếu editingCharIdx === null: Tạo nhân vật mới vào đội hình và lưu vào MySQL.
   */
  const handleConfirmSlotTemplate = () => {
    const hasAnyImage = Object.keys(slotsData).length > 0;
    if (!hasAnyImage) {
      setErrorMsg('Vui lòng chọn ít nhất 1 ảnh vào ô đứng yên (idle_down) để tạo nhân vật.');
      return;
    }

    const is3R = slotMode === '3_rows';
    const stitched = stitchSlotsToSheet(slotsData, is3R, stagedAutoAnchor);
    if (!stitched) {
      setErrorMsg('Lỗi khi ghép các ô thành Sprite Sheet.');
      return;
    }

    const charName = stagedCharName.trim() || 'Hero';
    const stitchedImg = new Image();
    stitchedImg.onload = () => {
      // Chuẩn bị dữ liệu 15 ô frame dạng Base64 gửi lên MySQL (ưu tiên toDataURL từ canvas để đảm bảo chuẩn Base64)
      const slotsPayload = {};
      Object.entries(slotsData).forEach(([k, v]) => {
        if (v) {
          if (v.canvas && typeof v.canvas.toDataURL === 'function') {
            slotsPayload[k] = v.canvas.toDataURL('image/png');
          } else if (v.url && v.url.startsWith('data:image')) {
            slotsPayload[k] = v.url;
          }
        }
      });

      if (editingCharIdx !== null && characters[editingCharIdx]) {
        // CẬP NHẬT NHÂN VẬT ĐANG CÓ (Giữ nguyên toạ độ X, Y, Scale và ID)
        const existingChar = characters[editingCharIdx];
        const updatedChar = {
          ...existingChar,
          name: charName,
          sheetImage: stitchedImg,
          sheetUrl: stitched.dataUrl,
          sheetFileName: `${charName.toLowerCase()}_sheet.png`,
          rows: stitched.rows,
          columns: stitched.columns,
          fps: stagedFps,
          cellWidth: stitched.cellW,
          cellHeight: stitched.cellH,
          slotsData: { ...slotsData },
          slotMode: slotMode
        };

        setCharacters((prev) => prev.map((c, i) => i === editingCharIdx ? updatedChar : c));
        setEditingCharIdx(null);

        // Đồng bộ cập nhật nhân vật và 15 ô frame vào MySQL
        if (currentProject?.id) {
          if (existingChar.dbId) {
            // Trường hợp 1: Nhân vật đã có trong MySQL -> Gửi PUT cập nhật thông số và các ô ảnh
            updateTestbedCharacter(existingChar.dbId, currentProject.id, {
                name: charName,
                scale: existingChar.scale || 1.0,
                pos_x: rosterStateRef.current[editingCharIdx]?.x || 260,
                fps: stagedFps
              }).catch((err) => console.error('Lỗi khi cập nhật thông tin nhân vật vào MySQL:', err));

            // Cập nhật từng ô ảnh rời vào bảng testbed_character_frames
            Object.entries(slotsPayload).forEach(([slotKey, imgBase64]) => {
              updateTestbedSlot(existingChar.dbId, { slot_key: slotKey, image_base64: imgBase64 }).catch((err) => console.error(`Lỗi cập nhật ô ${slotKey} vào MySQL:`, err));
            });
          } else {
            // Trường hợp 2: Nhân vật mẫu ban đầu (chưa có trong MySQL) được người dùng đè asset lên
            // Tự động lưu thành nhân vật thật trong MySQL và gán mã dbId
            createTestbedCharacter({
                project_id: currentProject.id,
                name: charName,
                scale: existingChar.scale || 1.0,
                pos_x: rosterStateRef.current[editingCharIdx]?.x || 260,
                fps: stagedFps,
                move_speed: existingChar.moveSpeed || 135,
                slots_data: slotsPayload
              })
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (data && data.id) {
                  existingChar.dbId = data.id;
                  updatedChar.dbId = data.id;
                  setCharacters((prev) => prev.map((c, i) => i === editingCharIdx ? { ...c, dbId: data.id } : c));
                }
              })
              .catch((err) => console.error('Lỗi khi lưu nhân vật mẫu đã sửa vào MySQL:', err));
          }
        }
      } else {
        // TẠO MỚI NHÂN VẬT
        const newId = `char_${Date.now()}`;
        const newX = Math.min(1150, 160 + characters.length * 90);
        const newChar = {
          id: newId,
          dbId: null, // Sẽ được gán sau khi MySQL trả về ID
          name: charName,
          icon: '🖼️',
          sheetImage: stitchedImg,
          sheetUrl: stitched.dataUrl,
          sheetFileName: `${charName.toLowerCase()}_sheet.png`,
          rows: stitched.rows,
          columns: stitched.columns,
          fps: stagedFps,
          moveSpeed: 135,
          cellWidth: stitched.cellW,
          cellHeight: stitched.cellH,
          scale: 1.0,
          isCustom: true,
          slotsData: { ...slotsData },
          slotMode: slotMode
        };

        rosterStateRef.current.push(createRosterState(newX, groundY));

        // Lưu mới vào MySQL và nhận ID tự tăng
        if (currentProject?.id) {
          createTestbedCharacter({
              project_id: currentProject.id,
              name: charName,
              scale: 1.0,
              pos_x: newX,
              fps: stagedFps,
              move_speed: 135,
              slots_data: slotsPayload
            })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data && data.id) {
                newChar.dbId = data.id;
              }
            })
            .catch((err) => console.error('Lỗi khi lưu nhân vật mới vào MySQL:', err));
        }

        const updated = [...characters, newChar];
        setCharacters(updated);
        setActiveCharIdx(updated.length - 1);
      }

      setIsSlotModalOpen(false);
      setSlotsData({});
      setErrorMsg('');
    };
    stitchedImg.src = stitched.dataUrl;
  };

  // Vòng lặp xem trước 3 hướng hoạt họa trong Modal
  useEffect(() => {
    if (!isSlotModalOpen) return;
    let step = 0;
    let lastT = performance.now();
    let animId;

    const dirs = [
      { name: 'down', canvasRef: previewDownCanvasRef },
      { name: 'side', canvasRef: previewSideCanvasRef },
      { name: 'up', canvasRef: previewUpCanvasRef }
    ];

    const loop = (now) => {
      const dt = (now - lastT) / 1000;
      if (dt >= 1.0 / Math.max(1, stagedFps)) {
        step = (step + 1) % 4;
        lastT = now;
      }

      dirs.forEach(({ name: dir, canvasRef: cRef }) => {
        const canvas = cRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const activeItem = slotsData[`${dir}_${step + 1}`] || slotsData[`${dir}_0`] || slotsData['down_0'];
        const curImg = activeItem ? (activeItem.canvas || activeItem.img) : null;
        if (curImg) {
          const cw = canvas.width;
          const ch = canvas.height;
          const fw = curImg.naturalWidth || curImg.width;
          const fh = curImg.naturalHeight || curImg.height;

          const scale = Math.min(2.0, (ch - 18) / fh);
          const dw = Math.round(fw * scale);
          const dh = Math.round(fh * scale);
          const dx = Math.round((cw - dw) / 2);
          const dy = Math.round(ch - 10 - dh);

          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.beginPath();
          ctx.ellipse(cw / 2, ch - 8, dw * 0.35, 5, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.drawImage(curImg, dx, dy, dw, dh);
        }
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isSlotModalOpen, slotsData, stagedFps]);

  return {
    isSlotModalOpen,
    setIsSlotModalOpen,
    editingCharIdx,
    setEditingCharIdx,
    slotMode,
    setSlotMode,
    slotsData,
    setSlotsData,
    stagedCharName,
    setStagedCharName,
    stagedFps,
    setStagedFps,
    dragOverSlot,
    setDragOverSlot,
    previewDownCanvasRef,
    previewSideCanvasRef,
    previewUpCanvasRef,
    handleOpenSlotTemplateModal,
    handleEditCharacterSlots,
    handleSetSlotImage,
    handleClearSlot,
    handleSwapSlots,
    handleSwapRows,
    handleClearRow,
    handleShiftRow,
    handleBatchAutoAssignSlots,
    handleConfirmSlotTemplate
  };
}
