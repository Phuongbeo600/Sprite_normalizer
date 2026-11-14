// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & Canvas Game Loop)
// ========================================================
import React, { useState, useEffect, useRef, useCallback } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Biểu tượng tay cầm game, mở map, thước đo, thêm bớt và chỉnh sửa nhân vật
import {
  Gamepad2,
  FolderOpen,
  Download,
  RotateCcw,
  Shield,
  Sliders,
  Check,
  ZoomIn,
  Move,
  Image as ImageIcon,
  Plus,
  Trash2,
  Ruler,
  Users,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Shuffle,
  X,
  Play,
  Pencil,
  RefreshCw,
  Upload,
  Zap
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// (Không phụ thuộc component nội bộ khác)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark Fantasy Atelier từ godot-atelier.css
import '../styles/godot-atelier.css';


/**
 * Danh sách định nghĩa các ô mẫu (Slot Template) cho bộ hoạt họa 3 hướng.
 * Mỗi ô có nhãn hướng dẫn cụ thể về tên file và vai trò frame để người dùng
 * biết chính xác ảnh nào cần đưa vào ô nào.
 */
const SLOT_DEFINITIONS_3_ROWS = [
  // Hàng 1: Hướng Nhìn Xuống (Down / Mặt trước)
  { id: 'down_0', row: 0, col: 0, direction: 'down', role: 'idle', label: 'idle_down', desc: 'Đứng yên' },
  { id: 'down_1', row: 0, col: 1, direction: 'down', role: 'walk', label: 'walk_down_0', desc: 'Bước 1' },
  { id: 'down_2', row: 0, col: 2, direction: 'down', role: 'walk', label: 'walk_down_1', desc: 'Bước 2' },
  { id: 'down_3', row: 0, col: 3, direction: 'down', role: 'walk', label: 'walk_down_2', desc: 'Bước 3' },
  { id: 'down_4', row: 0, col: 4, direction: 'down', role: 'walk', label: 'walk_down_3', desc: 'Bước 4' },

  // Hàng 2: Hướng Nhìn Ngang (Side / Đi nghiêng)
  { id: 'side_0', row: 1, col: 0, direction: 'side', role: 'idle', label: 'idle_side', desc: 'Đứng yên' },
  { id: 'side_1', row: 1, col: 1, direction: 'side', role: 'walk', label: 'walk_side_0', desc: 'Bước 1' },
  { id: 'side_2', row: 1, col: 2, direction: 'side', role: 'walk', label: 'walk_side_1', desc: 'Bước 2' },
  { id: 'side_3', row: 1, col: 3, direction: 'side', role: 'walk', label: 'walk_side_2', desc: 'Bước 3' },
  { id: 'side_4', row: 1, col: 4, direction: 'side', role: 'walk', label: 'walk_side_3', desc: 'Bước 4' },

  // Hàng 3: Hướng Nhìn Lên (Up / Sau lưng)
  { id: 'up_0', row: 2, col: 0, direction: 'up', role: 'idle', label: 'idle_up', desc: 'Đứng yên' },
  { id: 'up_1', row: 2, col: 1, direction: 'up', role: 'walk', label: 'walk_up_0', desc: 'Bước 1' },
  { id: 'up_2', row: 2, col: 2, direction: 'up', role: 'walk', label: 'walk_up_1', desc: 'Bước 2' },
  { id: 'up_3', row: 2, col: 3, direction: 'up', role: 'walk', label: 'walk_up_2', desc: 'Bước 3' },
  { id: 'up_4', row: 2, col: 4, direction: 'up', role: 'walk', label: 'walk_up_3', desc: 'Bước 4' },
];


/**
 * Tạo tự động một ảnh Sprite Sheet Pixel Art mẫu trong bộ nhớ (Canvas DataURL).
 * Dùng làm nhân vật mẫu ban đầu (Hiệp sĩ, Pháp sư, Hồ ly) để người dùng
 * có thể thử nghiệm ngay lập tức tính năng đổi nhân vật TAB / 1..9 mà không cần nạp trước.
 * 
 * @param {string} type Loại nhân vật ('knight' | 'mage' | 'fox')
 * @returns {string} Chuỗi data URL định dạng PNG của sprite sheet 3x5.
 */
function createDemoSpriteSheet(type = 'knight') {
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
function stitchSlotsToSheet(slotsData, is3Rows = true, autoAnchor = true) {
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
function extractSlotsFromSheet(charObj) {
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


/**
 * Màn hình Phòng Thử Nghiệm Godot Engine 4 (Godot Testbed 1:1).
 * Hỗ trợ nạp và chỉnh sửa lại khung ô có nhãn gợi ý rõ ràng (Slot Template).
 * 
 * @param {Object} props Thuộc tính của component.
 * @param {Object|null} props.currentProject Dự án hiện tại đang mở.
 * @param {File|null} [props.incomingFile] Tệp ảnh được chuyển tiếp từ mục Tạo ảnh AI.
 * @returns {React.ReactElement} Màn hình phòng thử nghiệm.
 */
export default function GodotTestbed({
  currentProject,
  incomingFile = null,
  deployedCharacterIds = null,
  onResetDeployedFilter = null
}) {
  // ========================================================
  // TRẠNG THÁI BẢN ĐỒ NỀN (BACKGROUND MAP)
  // ========================================================
  const [mapImage, setMapImage] = useState(null);
  const [mapUrl, setMapUrl] = useState('');
  const [mapFileName, setMapFileName] = useState('');
  const [groundY, setGroundY] = useState(540);
  const [showGroundLine, setShowGroundLine] = useState(true);

  // ========================================================
  // TRẠNG THÁI ĐỘI HÌNH NHÂN VẬT (CHARACTER ROSTER)
  // ========================================================
  const [characters, setCharacters] = useState([]);
  const [activeCharIdx, setActiveCharIdx] = useState(0);

  // Menu thả xuống của nút "Thêm Nhân Vật"
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  // ========================================================
  // TRẠNG THÁI MODAL KHUNG Ô CHỌN / CHỈNH SỬA ẢNH (SLOT TEMPLATE)
  // ========================================================
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

  // Các cờ hiển thị chế độ Debug Godot
  const [showCollision, setShowCollision] = useState(true);
  const [showOrigin, setShowOrigin] = useState(true);
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [showFloorGrid, setShowFloorGrid] = useState(false);
  const [pixelZoom, setPixelZoom] = useState(2);

  // Trạng thái xuất file
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Tham chiếu Canvas và Game Loop
  const canvasRef = useRef(null);
  const keysPressed = useRef({});
  const lastTime = useRef(performance.now());
  const animationFrameId = useRef(null);
  const rosterStateRef = useRef([]);

  // Tham chiếu Kéo thả trực tiếp nhân vật trên Canvas
  const isDraggingRef = useRef(false);
  const dragCharIdxRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Đóng dropdown khi nhấp chuột ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Khởi tạo 3 nhân vật mẫu ban đầu
  useEffect(() => {
    const demoConfigs = [
      { id: 'char_knight', name: 'Hiệp sĩ (Knight)', icon: '⚔️', type: 'knight', x: 260, rows: 3, cols: 5, fps: 8, speed: 140 },
      { id: 'char_mage', name: 'Pháp sư (Mage)', icon: '🧙‍♀️', type: 'mage', x: 380, rows: 3, cols: 5, fps: 8, speed: 130 },
      { id: 'char_fox', name: 'Linh hồ (Kitsune)', icon: '🐺', type: 'fox', x: 500, rows: 3, cols: 5, fps: 9, speed: 150 }
    ];

    const loadedChars = [];
    rosterStateRef.current = [];

    demoConfigs.forEach((cfg) => {
      const dataUrl = createDemoSpriteSheet(cfg.type);
      const img = new Image();
      img.src = dataUrl;

      const charObj = {
        id: cfg.id,
        name: cfg.name,
        icon: cfg.icon,
        sheetImage: img,
        sheetUrl: dataUrl,
        sheetFileName: `${cfg.type}_sheet.png`,
        rows: cfg.rows,
        columns: cfg.cols,
        fps: cfg.fps,
        moveSpeed: cfg.speed,
        cellWidth: 32,
        cellHeight: 48,
        scale: 1.0,
        isCustom: false
      };

      loadedChars.push(charObj);

      rosterStateRef.current.push({
        x: cfg.x,
        y: 540,
        direction: 'down',
        facingLeft: false,
        animTime: 0,
        animFrameIdx: 0,
        isMoving: false
      });
    });

    setCharacters(loadedChars);
    setActiveCharIdx(0);
  }, []);

  // ========================================================
  // ĐỒNG BỘ CƠ SỞ DỮ LIỆU MYSQL CHO BẢN ĐỒ & ĐỘI HÌNH NHÂN VẬT
  // ========================================================
  useEffect(() => {
    if (!currentProject?.id) return;
    const projectId = currentProject.id;

    // 1. Tự động tải bản đồ nền từ MySQL (testbed_maps)
    fetch(`/api/testbed/map?project_id=${projectId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.status === 'success' && data.map_image_base64) {
          const img = new Image();
          img.onload = () => {
            setMapImage(img);
            setMapUrl(data.map_image_base64);
            setMapFileName(data.name || 'map_background.png');
            if (data.ground_y) setGroundY(data.ground_y);
            if (data.show_ground_line !== undefined) setShowGroundLine(data.show_ground_line);
          };
          img.src = data.map_image_base64;
        }
      })
      .catch((err) => console.error('Lỗi khi tải bản đồ từ MySQL:', err));

    // 2. Tự động tải danh sách nhân vật & 15 ô frame từ MySQL (testbed_characters, testbed_character_frames)
    fetch(`/api/testbed/characters?project_id=${projectId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.characters && data.characters.length > 0) {
          // Lọc danh sách theo nhân vật được chọn từ Kho tài nguyên (nếu có yêu cầu chọn lọc)
          let targetChars = data.characters;
          if (Array.isArray(deployedCharacterIds) && deployedCharacterIds.length > 0) {
            const filtered = data.characters.filter((c) => deployedCharacterIds.includes(c.id));
            if (filtered.length > 0) {
              targetChars = filtered;
            }
          }

          const loaded = [];
          rosterStateRef.current = [];

          targetChars.forEach((charDb, idx) => {
            const slotsObj = {};
            const slotKeys = Object.keys(charDb.slots_data || {});

            // Khôi phục các ô ảnh frame từ dữ liệu Base64
            slotKeys.forEach((key) => {
              const dataUrl = charDb.slots_data[key];
              if (dataUrl) {
                const fImg = new Image();
                fImg.src = dataUrl;
                slotsObj[key] = {
                  img: fImg,
                  url: dataUrl,
                  name: `${key}.png`
                };
              }
            });

            // Tự động ghép nối các ô slot thành tấm Sprite Sheet chuẩn
            const stitched = stitchSlotsToSheet(slotsObj, true, true);
            let sheetImg = new Image();
            if (stitched) {
              sheetImg.src = stitched.dataUrl;
            }

            loaded.push({
              id: `char_db_${charDb.id}`,
              dbId: charDb.id,
              name: charDb.name,
              icon: '🦸‍♂️',
              sheetImage: sheetImg,
              sheetUrl: stitched ? stitched.dataUrl : '',
              sheetFileName: `${charDb.name.toLowerCase()}_sheet.png`,
              rows: stitched ? stitched.rows : 3,
              columns: stitched ? stitched.columns : 5,
              fps: charDb.fps || 8,
              moveSpeed: charDb.move_speed || 140,
              cellWidth: stitched ? stitched.cellW : 32,
              cellHeight: stitched ? stitched.cellH : 48,
              scale: charDb.scale || 1.0,
              isCustom: true,
              slotsData: slotsObj,
              slotMode: '3_rows'
            });

            rosterStateRef.current.push({
              x: charDb.pos_x || (160 + idx * 100),
              y: groundY,
              direction: 'down',
              facingLeft: false,
              animTime: 0,
              animFrameIdx: 0,
              isMoving: false
            });
          });

          if (loaded.length > 0) {
            setCharacters(loaded);
            setActiveCharIdx(0);
          }
        }
      })
      .catch((err) => console.error('Lỗi khi tải nhân vật từ MySQL:', err));
  }, [currentProject?.id, deployedCharacterIds]);

  // Cập nhật toạ độ Y của nhân vật trên sàn khi độ cao sàn groundY thay đổi
  useEffect(() => {
    if (rosterStateRef.current) {
      rosterStateRef.current.forEach((charState) => {
        charState.y = groundY;
      });
    }
  }, [groundY]);

  // Tự động lưu độ cao sàn mặt đất groundY vào MySQL (có debounce 400ms để tối ưu hiệu năng)
  useEffect(() => {
    if (!currentProject?.id) return;
    const timer = setTimeout(() => {
      fetch('/api/testbed/map/ground-y', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: currentProject.id,
          ground_y: groundY
        })
      }).catch((err) => console.error('Lỗi khi cập nhật ground_y vào MySQL:', err));
    }, 400);

    return () => clearTimeout(timer);
  }, [groundY, currentProject?.id]);

  // Tự động nạp nhân vật mới khi có tệp được chuyển từ Tạo ảnh AI
  useEffect(() => {
    if (!incomingFile) return;
    const url = URL.createObjectURL(incomingFile);
    const img = new Image();
    img.onload = () => {
      const defaultRows = 3;
      const defaultCols = 5;
      const cWidth = Math.floor(img.naturalWidth / defaultCols);
      const cHeight = Math.floor(img.naturalHeight / defaultRows);

      const newId = `char_${Date.now()}`;
      const cleanName = incomingFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const newChar = {
        id: newId,
        name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
        icon: '✨',
        sheetImage: img,
        sheetUrl: url,
        sheetFileName: incomingFile.name,
        rows: defaultRows,
        columns: defaultCols,
        fps: 8,
        moveSpeed: 130,
        cellWidth: cWidth > 0 ? cWidth : 64,
        cellHeight: cHeight > 0 ? cHeight : 64,
        scale: 1.0,
        isCustom: true
      };

      const newX = 160 + characters.length * 90;
      rosterStateRef.current.push({
        x: Math.min(1150, newX),
        y: groundY,
        direction: 'down',
        facingLeft: false,
        animTime: 0,
        animFrameIdx: 0,
        isMoving: false
      });

      setCharacters((prev) => [...prev, newChar]);
      setActiveCharIdx(characters.length);
      setErrorMsg('');
    };
    img.src = url;
  }, [incomingFile]);

  // Xử lý nạp bản đồ nền và lưu trực tiếp vào MySQL (testbed_maps)
  const handleUploadMap = (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;

    if (mapUrl && !mapUrl.startsWith('data:')) {
      URL.revokeObjectURL(mapUrl);
    }

    const reader = new FileReader();
    reader.onload = (re) => {
      const dataUrl = re.target.result;
      const img = new Image();
      img.onload = () => {
        setMapImage(img);
        setMapUrl(dataUrl);
        setMapFileName(file.name);
        setErrorMsg('');

        // Tự động lưu bản đồ nền thật dạng MEDIUMBLOB vào MySQL
        if (currentProject?.id) {
          fetch('/api/testbed/map', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              project_id: currentProject.id,
              name: file.name,
              map_image_base64: dataUrl,
              ground_y: groundY,
              show_ground_line: showGroundLine
            })
          }).catch((err) => console.error('Lỗi khi lưu bản đồ vào MySQL:', err));
        }
      };
      img.onerror = () => {
        setErrorMsg('Không đọc được tệp ảnh Map nền. Vui lòng chọn tệp PNG hoặc JPEG hợp lệ.');
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Xóa bản đồ nền và đồng bộ xóa khỏi MySQL
  const handleResetMap = () => {
    if (mapUrl && !mapUrl.startsWith('data:')) {
      URL.revokeObjectURL(mapUrl);
    }
    setMapImage(null);
    setMapUrl('');
    setMapFileName('');

    // Xóa bản đồ nền khỏi MySQL nếu đang mở dự án
    if (currentProject?.id) {
      fetch(`/api/testbed/map?project_id=${currentProject.id}`, {
        method: 'DELETE'
      }).catch((err) => console.error('Lỗi khi xóa bản đồ khỏi MySQL:', err));
    }
  };

  // CHỨC NĂNG 1: THÊM NHÂN VẬT TỪ SPRITE SHEET GỘP
  const handleAddCharacterSheet = (event) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const defaultRows = 3;
      const defaultCols = 5;
      const cWidth = Math.floor(img.naturalWidth / defaultCols);
      const cHeight = Math.floor(img.naturalHeight / defaultRows);

      const newId = `char_${Date.now()}`;
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      const newChar = {
        id: newId,
        name: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
        icon: '📜',
        sheetImage: img,
        sheetUrl: url,
        sheetFileName: file.name,
        rows: defaultRows,
        columns: defaultCols,
        fps: 8,
        moveSpeed: 130,
        cellWidth: cWidth > 0 ? cWidth : 64,
        cellHeight: cHeight > 0 ? cHeight : 64,
        scale: 1.0,
        isCustom: true
      };

      const newX = 160 + characters.length * 90;
      rosterStateRef.current.push({
        x: Math.min(1150, newX),
        y: groundY,
        direction: 'down',
        facingLeft: false,
        animTime: 0,
        animFrameIdx: 0,
        isMoving: false
      });

      // Tự động trích xuất các ô frame từ Sheet và lưu vĩnh viễn vào MySQL
      if (currentProject?.id) {
        const extracted = extractSlotsFromSheet(newChar);
        const slotsPayload = {};
        Object.entries(extracted).forEach(([k, v]) => {
          if (v && v.url) slotsPayload[k] = v.url;
        });

        fetch('/api/testbed/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_id: currentProject.id,
            name: newChar.name,
            scale: 1.0,
            pos_x: Math.min(1150, newX),
            fps: 8,
            move_speed: 130,
            slots_data: slotsPayload
          })
        })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && data.id) {
              newChar.dbId = data.id;
            }
          })
          .catch((err) => console.error('Lỗi khi lưu nhân vật từ Sheet vào MySQL:', err));
      }

      const updated = [...characters, newChar];
      setCharacters(updated);
      setActiveCharIdx(updated.length - 1);
      setErrorMsg('');
    };
    img.onerror = () => {
      setErrorMsg('Không thể đọc Sprite Sheet. Vui lòng kiểm tra lại định dạng tệp ảnh.');
    };
    img.src = url;
  };

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
            fetch(`/api/testbed/characters/${existingChar.dbId}?project_id=${currentProject.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: charName,
                scale: existingChar.scale || 1.0,
                pos_x: rosterStateRef.current[editingCharIdx]?.x || 260,
                fps: stagedFps
              })
            }).catch((err) => console.error('Lỗi khi cập nhật thông tin nhân vật vào MySQL:', err));

            // Cập nhật từng ô ảnh rời vào bảng testbed_character_frames
            Object.entries(slotsPayload).forEach(([slotKey, imgBase64]) => {
              fetch(`/api/testbed/characters/${existingChar.dbId}/slots`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slot_key: slotKey, image_base64: imgBase64 })
              }).catch((err) => console.error(`Lỗi cập nhật ô ${slotKey} vào MySQL:`, err));
            });
          } else {
            // Trường hợp 2: Nhân vật mẫu ban đầu (chưa có trong MySQL) được người dùng đè asset lên
            // Tự động lưu thành nhân vật thật trong MySQL và gán mã dbId
            fetch('/api/testbed/characters', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                project_id: currentProject.id,
                name: charName,
                scale: existingChar.scale || 1.0,
                pos_x: rosterStateRef.current[editingCharIdx]?.x || 260,
                fps: stagedFps,
                move_speed: existingChar.moveSpeed || 135,
                slots_data: slotsPayload
              })
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

        rosterStateRef.current.push({
          x: newX,
          y: groundY,
          direction: 'down',
          facingLeft: false,
          animTime: 0,
          animFrameIdx: 0,
          isMoving: false
        });

        // Lưu mới vào MySQL và nhận ID tự tăng
        if (currentProject?.id) {
          fetch('/api/testbed/characters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              project_id: currentProject.id,
              name: charName,
              scale: 1.0,
              pos_x: newX,
              fps: stagedFps,
              move_speed: 135,
              slots_data: slotsPayload
            })
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

  // Thay đổi ảnh Sprite nhanh bằng file Sprite Sheet
  const handleReplaceCharacterImage = (event, charIdx) => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setCharacters((prev) => prev.map((charObj, idx) => {
        if (idx !== charIdx) return charObj;
        const cWidth = Math.floor(img.naturalWidth / charObj.columns);
        const cHeight = Math.floor(img.naturalHeight / charObj.rows);
        return {
          ...charObj,
          sheetImage: img,
          sheetUrl: url,
          sheetFileName: file.name,
          cellWidth: cWidth > 0 ? cWidth : 64,
          cellHeight: cHeight > 0 ? cHeight : 64,
          slotsData: {} // Xóa slotsData cũ nếu nạp đè bằng file Sheet hoàn toàn mới
        };
      }));
      setErrorMsg('');
    };
    img.onerror = () => {
      setErrorMsg('Không đọc được tệp ảnh thay thế.');
    };
    img.src = url;
  };

  const handleSwapCharacterOrder = (idx, direction) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= characters.length) return;

    const newChars = [...characters];
    const tempChar = newChars[idx];
    newChars[idx] = newChars[targetIdx];
    newChars[targetIdx] = tempChar;

    const tempState = rosterStateRef.current[idx];
    rosterStateRef.current[idx] = rosterStateRef.current[targetIdx];
    rosterStateRef.current[targetIdx] = tempState;

    setCharacters(newChars);
    setActiveCharIdx(targetIdx);
  };

  // Cập nhật thông số nhân vật đang chọn (tên, tỉ lệ phóng to scale, FPS) và lưu vào MySQL
  const handleUpdateActiveChar = (updates) => {
    setCharacters((prev) => prev.map((c, i) => {
      if (i !== activeCharIdx) return c;
      const updated = { ...c, ...updates };

      // Tự động đồng bộ lên MySQL nếu nhân vật đã có dbId
      if (currentProject?.id && updated.dbId) {
        fetch(`/api/testbed/characters/${updated.dbId}?project_id=${currentProject.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: updated.name,
            scale: updated.scale || 1.0,
            pos_x: rosterStateRef.current[activeCharIdx]?.x || 260,
            fps: updated.fps || 8
          })
        }).catch((err) => console.error('Lỗi khi cập nhật thông số nhân vật vào MySQL:', err));
      }
      return updated;
    }));
  };

  // Xóa nhân vật khỏi phòng thử nghiệm và tự động xóa khỏi MySQL
  const handleRemoveCharacter = (idxToRemove) => {
    if (characters.length <= 1) {
      setErrorMsg('Cần giữ lại ít nhất một nhân vật trong phòng thử nghiệm.');
      return;
    }

    const charToRemove = characters[idxToRemove];
    if (charToRemove?.dbId && currentProject?.id) {
      fetch(`/api/testbed/characters/${charToRemove.dbId}?project_id=${currentProject.id}`, {
        method: 'DELETE'
      }).catch((err) => console.error('Lỗi khi xóa nhân vật khỏi MySQL:', err));
    }

    const updated = characters.filter((_, idx) => idx !== idxToRemove);
    rosterStateRef.current = rosterStateRef.current.filter((_, idx) => idx !== idxToRemove);

    setCharacters(updated);
    setActiveCharIdx((prev) => (prev >= updated.length ? updated.length - 1 : prev));
  };

  // Bắt phím WASD / TAB
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isSlotModalOpen) return;

      if (['input', 'textarea'].includes(document.activeElement?.tagName?.toLowerCase())) {
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        setCharacters((currentChars) => {
          if (currentChars.length > 0) {
            setActiveCharIdx((prev) => (prev + 1) % currentChars.length);
          }
          return currentChars;
        });
        return;
      }

      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= 9) {
        const targetIdx = num - 1;
        setCharacters((currentChars) => {
          if (targetIdx < currentChars.length) {
            setActiveCharIdx(targetIdx);
          }
          return currentChars;
        });
        return;
      }

      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        keysPressed.current[k] = true;
      }
    };

    const handleKeyUp = (e) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        keysPressed.current[k] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSlotModalOpen]);

  // Kéo thả chuột trực tiếp trên Canvas
  const getCanvasMousePos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleCanvasMouseDown = (e) => {
    const { x: mouseX, y: mouseY } = getCanvasMousePos(e);

    for (let i = characters.length - 1; i >= 0; i--) {
      const charObj = characters[i];
      const st = rosterStateRef.current[i];
      if (!charObj || !st) continue;

      const effZoom = pixelZoom * (charObj.scale || 1.0);
      const dw = Math.round(charObj.cellWidth * effZoom);
      const dh = Math.round(charObj.cellHeight * effZoom);

      const left = st.x - dw / 2;
      const right = st.x + dw / 2;
      const top = st.y - dh;
      const bottom = st.y;

      if (mouseX >= left - 8 && mouseX <= right + 8 && mouseY >= top - 8 && mouseY <= bottom + 8) {
        isDraggingRef.current = true;
        dragCharIdxRef.current = i;
        dragOffsetRef.current = { x: mouseX - st.x, y: mouseY - st.y };
        setActiveCharIdx(i);
        if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
        return;
      }
    }
  };

  const handleCanvasMouseMove = (e) => {
    const { x: mouseX, y: mouseY } = getCanvasMousePos(e);

    if (isDraggingRef.current && dragCharIdxRef.current !== null) {
      const idx = dragCharIdxRef.current;
      const st = rosterStateRef.current[idx];
      if (st) {
        const newX = mouseX - dragOffsetRef.current.x;
        const newY = mouseY - dragOffsetRef.current.y;
        st.x = Math.max(40, Math.min(1240, newX));
        st.y = Math.max(groundY - 140, Math.min(700, newY));
      }
      return;
    }

    let hovered = false;
    for (let i = characters.length - 1; i >= 0; i--) {
      const charObj = characters[i];
      const st = rosterStateRef.current[i];
      if (!charObj || !st) continue;

      const effZoom = pixelZoom * (charObj.scale || 1.0);
      const dw = Math.round(charObj.cellWidth * effZoom);
      const dh = Math.round(charObj.cellHeight * effZoom);

      if (mouseX >= st.x - dw / 2 && mouseX <= st.x + dw / 2 && mouseY >= st.y - dh && mouseY <= st.y) {
        hovered = true;
        break;
      }
    }
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hovered ? 'grab' : 'default';
    }
  };

  const handleCanvasMouseUp = () => {
    isDraggingRef.current = false;
    dragCharIdxRef.current = null;
    if (canvasRef.current) canvasRef.current.style.cursor = 'default';
  };

  // Vẽ phông nền mặc định
  const drawDefaultNightCliffMap = (ctx, w, h) => {
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

  // Game loop 60 FPS
  const gameLoop = useCallback((currentTime) => {
    const delta = Math.min((currentTime - lastTime.current) / 1000.0, 0.1);
    lastTime.current = currentTime;

    const canvas = canvasRef.current;
    if (canvas && characters.length > 0) {
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      const activeState = rosterStateRef.current[activeCharIdx];
      const activeChar = characters[activeCharIdx];

      if (activeState && activeChar && !isDraggingRef.current) {
        let dx = 0;
        let dy = 0;
        const keys = keysPressed.current;
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

      rosterStateRef.current.forEach((st, idx) => {
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

      ctx.imageSmoothingEnabled = false;

      if (mapImage) {
        ctx.drawImage(mapImage, 0, 0, w, h);
      } else {
        drawDefaultNightCliffMap(ctx, w, h);
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
        const yA = rosterStateRef.current[a]?.y || 0;
        const yB = rosterStateRef.current[b]?.y || 0;
        return yA - yB;
      });

      sortedIndices.forEach((idx) => {
        const charObj = characters[idx];
        const state = rosterStateRef.current[idx];
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

      if (showGuidelines && characters[activeCharIdx] && rosterStateRef.current[activeCharIdx]) {
        const actChar = characters[activeCharIdx];
        const actState = rosterStateRef.current[activeCharIdx];
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

    animationFrameId.current = requestAnimationFrame(gameLoop);
  }, [characters, activeCharIdx, groundY, mapImage, showFloorGrid, showGroundLine, showCollision, showOrigin, showGuidelines, pixelZoom]);

  useEffect(() => {
    animationFrameId.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [gameLoop]);

  const handleResetPartyPositions = () => {
    rosterStateRef.current.forEach((st, idx) => {
      st.x = 200 + idx * 100;
      st.y = groundY;
      st.direction = 'down';
      st.facingLeft = false;
    });
  };

  const handleExportActiveGodotZip = async () => {
    const activeChar = characters[activeCharIdx];
    if (!activeChar) return;

    setExporting(true);
    setExportSuccess(false);
    setErrorMsg('');

    try {
      const responseBlob = await fetch(activeChar.sheetUrl).then((r) => r.blob());
      const formData = new FormData();
      formData.append('file', responseBlob, activeChar.sheetFileName || 'character_sheet.png');
      formData.append('rows', String(activeChar.rows));
      formData.append('columns', String(activeChar.columns));
      formData.append('fps', String(activeChar.fps));
      formData.append('move_speed', String(activeChar.moveSpeed));
      formData.append('character_name', activeChar.name.replace(/\s+/g, '_'));
      formData.append('auto_anchor', 'true');

      const response = await fetch('/api/export-godot', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || 'Không thể đóng gói tài nguyên Godot từ máy chủ.');
      }

      const zipBlob = await response.blob();
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${activeChar.name.replace(/\s+/g, '_')}_Godot4.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi tạo gói Godot.');
    } finally {
      setExporting(false);
    }
  };

  const activeChar = characters[activeCharIdx];
  const activeState = rosterStateRef.current[activeCharIdx];

  const currentSlotDefinitions = slotMode === '3_rows'
    ? SLOT_DEFINITIONS_3_ROWS
    : SLOT_DEFINITIONS_3_ROWS.filter((s) => s.direction === 'down');

  return (
    <div className="atelier-godot-root">
      {/* 1. Thanh tiêu đề phòng thử nghiệm */}
      <div className="atelier-godot-header">
        <div className="atelier-godot-header-title">
          <h2 className="atelier-godot-title-heading">
            <Gamepad2 size={24} color="#c084fc" />
            Thử nghiệm Asset Godot Engine 4 (Đa Nhân Vật 1:1)
          </h2>
          <p className="atelier-godot-title-subtext">
            Đặt nhân vật mới đứng cạnh nhân vật cũ trên cùng sàn đất để so sánh tỉ lệ pixel, chiều cao và nhịp chạy trước khi đưa vào game.
          </p>

          {/* Huy hiệu hiển thị khi đang nạp đội hình được chọn lọc từ Kho tài nguyên */}
          {Array.isArray(deployedCharacterIds) && deployedCharacterIds.length > 0 && (
            <div className="atelier-godot-filter-badge">
              <span>🎮 Đang nạp {characters.length} nhân vật từ Kho tài nguyên</span>
              {onResetDeployedFilter && (
                <button
                  type="button"
                  onClick={onResetDeployedFilter}
                  className="atelier-godot-filter-btn-reset"
                  title="Hiển thị tất cả nhân vật có trong MySQL"
                >
                  (Hiện tất cả)
                </button>
              )}
            </div>
          )}
        </div>

        <div className="atelier-godot-header-actions">
          {/* Nút tải Map nền */}
          <label className="atelier-godot-btn-sub" style={{ cursor: 'pointer' }}>
            <ImageIcon size={15} color="#c084fc" /> Tải Map nền
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={handleUploadMap}
            />
          </label>

          {mapImage && (
            <button
              type="button"
              className="atelier-godot-btn-sub"
              onClick={handleResetMap}
              title="Quay lại cảnh đêm trăng mặc định"
              style={{ fontSize: '0.75rem' }}
            >
              Cảnh mẫu
            </button>
          )}

          {/* MENU 2 CHỨC NĂNG: THÊM NHÂN VẬT (SPRITE SHEET HOẶC KHUNG Ô ẢNH RỜI) */}
          <div className="atelier-godot-dropdown-container" ref={dropdownRef}>
            <button
              type="button"
              className="atelier-godot-btn-sub"
              onClick={() => setAddMenuOpen(!addMenuOpen)}
              style={{
                background: addMenuOpen ? 'rgba(147, 51, 234, 0.28)' : undefined,
                borderColor: addMenuOpen ? '#c084fc' : undefined
              }}
            >
              <Plus size={15} color="#c084fc" />
              <span>Thêm Nhân Vật</span>
              <ChevronDown size={14} style={{ transform: addMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>

            {addMenuOpen && (
              <div className="atelier-godot-dropdown-menu">
                <label className="atelier-godot-dropdown-item">
                  <Layers size={18} color="#c084fc" />
                  <div>
                    <div className="atelier-godot-dropdown-item-title">1. Nhập từ Sprite Sheet</div>
                    <div className="atelier-godot-dropdown-item-desc">1 tệp ảnh lưới chia hàng × cột</div>
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      setAddMenuOpen(false);
                      handleAddCharacterSheet(e);
                    }}
                  />
                </label>

                <div
                  className="atelier-godot-dropdown-item"
                  onClick={handleOpenSlotTemplateModal}
                >
                  <FolderOpen size={18} color="#c084fc" />
                  <div>
                    <div className="atelier-godot-dropdown-item-title">2. Nhập từ Ảnh rời (Khung Ô có nhãn)</div>
                    <div className="atelier-godot-dropdown-item-desc">Chọn từng ô: idle, walk_0..3 theo nhãn</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Nút xuất Godot 4 */}
          <button
            type="button"
            className="atelier-godot-btn-export-zip"
            disabled={!activeChar || exporting}
            onClick={handleExportActiveGodotZip}
          >
            {exportSuccess ? <Check size={16} color="#fbbf24" /> : <Download size={16} />}
            {exporting ? 'Đang xuất ZIP…' : exportSuccess ? 'Đã tải Godot 4!' : `Xuất [${activeChar?.name || 'Nhân vật'}] (.ZIP)`}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '6px', color: '#fca5a5', fontSize: '0.8rem' }}>
          {errorMsg}
        </div>
      )}

      {/* 2. Cửa sổ Viewport Canvas mô phỏng Godot Debug */}
      <div className="atelier-godot-canvas-card">
        <div className="atelier-godot-debug-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Gamepad2 size={16} color="#c084fc" />
            <span style={{ color: '#f5f3ff', fontSize: '0.825rem', fontWeight: 600 }}>
              Thử nghiệm asset (DEBUG) - Godot Engine 4
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--atl-text-muted, #716b89)', marginLeft: '4px' }}>1280×720</span>
          </div>

          <div className="atelier-godot-active-pill">
            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <span>🎮 Đang chọn:</span>
              <span style={{ color: '#c084fc' }}>{activeChar?.icon || '⚔️'} {activeChar?.name || 'Player'}</span>
              <span style={{ color: '#fbbf24', fontSize: '0.75rem', fontWeight: 600 }}>[{activeCharIdx + 1} / {characters.length}]</span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--atl-text-muted, #716b89)', marginTop: '2px' }}>
              ■ Nhấn <strong>[TAB]</strong> để đổi nhân vật • Phím <strong>[1, 2...]</strong> chọn nhanh • <strong>[WASD]</strong> Di chuyển • <strong>Kéo chuột</strong> để dời vị trí
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="atelier-godot-btn-sub"
              onClick={handleResetPartyPositions}
              title="Đặt lại đội hình đứng dàn hàng ngang"
              style={{ fontSize: '0.74rem', padding: '4px 10px' }}
            >
              <RotateCcw size={13} /> Dàn hàng ngang
            </button>

            <select
              value={pixelZoom}
              onChange={(e) => setPixelZoom(Number(e.target.value))}
              className="atelier-godot-input"
              style={{ width: 'auto', padding: '4px 10px', fontSize: '0.74rem', cursor: 'pointer' }}
            >
              <option value={1}>Thu phóng 1x (Gốc)</option>
              <option value={2}>Thu phóng 2x (Chuẩn)</option>
              <option value={3}>Thu phóng 3x</option>
              <option value={4}>Thu phóng 4x</option>
            </select>
          </div>
        </div>

        {/* KHÔNG GIAN CANVAS GAME CHÍNH (1280 x 720 NATIVE) */}
        <div style={{ position: 'relative', width: '100%', background: '#040714', overflow: 'hidden' }}>
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onTouchStart={(e) => {
              const touch = e.touches[0];
              if (touch) handleCanvasMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
            }}
            onTouchMove={(e) => {
              const touch = e.touches[0];
              if (touch) handleCanvasMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
            }}
            onTouchEnd={handleCanvasMouseUp}
            style={{
              width: '100%',
              height: 'auto',
              aspectRatio: '16 / 9',
              display: 'block',
              imageRendering: 'pixelated',
              userSelect: 'none'
            }}
          />
        </div>
      </div>

      {/* 3. Bảng điều khiển phía dưới: Danh sách nhân vật (Slot 1..9) & Chỉnh sửa vị trí / thay ảnh */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) 340px', gap: '14px', alignItems: 'start' }}>
        {/* CỘT TRÁI: DANH SÁCH NHÂN VẬT & BẢNG CHỈNH SỬA / THAY ẢNH */}
        <div className="atelier-godot-roster-box">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <h4 style={{ margin: 0, color: '#f5f3ff', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 700 }}>
              <Users size={16} color="#c084fc" />
              Đội hình so sánh ({characters.length} nhân vật)
            </h4>
            <span style={{ fontSize: '0.725rem', color: 'var(--atl-text-muted, #716b89)' }}>
              Nhấp vào thẻ hoặc <strong>kéo thả chuột trực tiếp trên ảnh</strong> để dời vị trí
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '10px' }}>
            {characters.map((charItem, idx) => {
              const isSelected = idx === activeCharIdx;
              return (
                <div
                  key={charItem.id}
                  onClick={() => setActiveCharIdx(idx)}
                  className={`atelier-godot-char-card ${isSelected ? 'active' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`atelier-godot-char-card-num ${isSelected ? 'active' : ''}`}>
                        {idx + 1}
                      </span>
                      <div className="atelier-godot-card-name">
                        {charItem.name}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveCharIdx(idx);
                          handleEditCharacterSlots(idx);
                        }}
                        title="Sửa / Đổi khung ảnh nhân vật này"
                        style={{ background: 'transparent', border: 'none', color: isSelected ? '#c084fc' : '#a39bc2', cursor: 'pointer', padding: '3px' }}
                      >
                        <Pencil size={13} />
                      </button>
                      {characters.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveCharacter(idx);
                          }}
                          title="Gỡ khỏi phòng thử nghiệm"
                          style={{ background: 'transparent', border: 'none', color: '#716b89', cursor: 'pointer', padding: '3px' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--atl-text-secondary, #a39bc2)' }}>
                    <span>{charItem.cellWidth}×{charItem.cellHeight} px</span>
                    <span style={{ color: charItem.scale && charItem.scale !== 1.0 ? '#c084fc' : undefined, fontWeight: 600 }}>
                      Tỉ lệ: {(charItem.scale || 1.0).toFixed(2)}x
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(168, 85, 247, 0.15)', paddingTop: '6px', marginTop: '2px' }}>
                    <span style={{ fontSize: '0.675rem', color: 'var(--atl-text-muted, #716b89)' }}>Đổi thứ tự:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSwapCharacterOrder(idx, -1);
                        }}
                        title="Dịch thẻ sang trái"
                        style={{
                          background: 'rgba(22, 16, 40, 0.8)',
                          border: '1px solid rgba(168, 85, 247, 0.2)',
                          color: idx === 0 ? '#475569' : '#d8b4fe',
                          cursor: idx === 0 ? 'default' : 'pointer',
                          borderRadius: '4px',
                          padding: '2px 6px'
                        }}
                      >
                        <ArrowLeft size={11} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === characters.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSwapCharacterOrder(idx, 1);
                        }}
                        title="Dịch thẻ sang phải"
                        style={{
                          background: 'rgba(22, 16, 40, 0.8)',
                          border: '1px solid rgba(168, 85, 247, 0.2)',
                          color: idx === characters.length - 1 ? '#475569' : '#d8b4fe',
                          cursor: idx === characters.length - 1 ? 'default' : 'pointer',
                          borderRadius: '4px',
                          padding: '2px 6px'
                        }}
                      >
                        <ArrowRight size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* BẢNG CHỈNH SỬA CHI TIẾT & THAY ĐỔI KHUNG ẢNH */}
          {activeChar && (
            <div className="atelier-godot-edit-panel">
              <div className="atelier-godot-edit-header">
                <span className="atelier-godot-edit-title">
                  <Pencil size={15} />
                  Chỉnh sửa nhân vật [{activeCharIdx + 1}]: {activeChar.name}
                </span>

                {/* CỤM NÚT SỬA KHUNG Ô VÀ NẠP ĐÈ SHEET */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="atelier-godot-btn-sub"
                    onClick={() => handleEditCharacterSlots(activeCharIdx)}
                  >
                    <RefreshCw size={13} color="#c084fc" /> Sửa / Thay đổi khung ảnh Sprite…
                  </button>

                  <label
                    className="atelier-godot-btn-sub"
                    title="Nạp đè bằng một file ảnh Sprite Sheet khác nếu bạn có sẵn file gộp"
                    style={{ background: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.12)', color: 'var(--atl-text-secondary, #a39bc2)' }}
                  >
                    <Layers size={13} color="#a855f7" /> Nạp đè Sheet
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      style={{ display: 'none' }}
                      onChange={(e) => handleReplaceCharacterImage(e, activeCharIdx)}
                    />
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <label style={{ fontSize: '0.775rem', color: 'var(--atl-text-secondary, #a39bc2)' }}>
                  Đổi tên nhân vật:
                  <input
                    type="text"
                    value={activeChar.name}
                    onChange={(e) => handleUpdateActiveChar({ name: e.target.value })}
                    className="atelier-godot-input"
                    style={{ marginTop: '4px' }}
                  />
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.775rem', color: 'var(--atl-text-secondary, #a39bc2)' }}>
                    <span>Tỉ lệ thu nhỏ riêng:</span>
                    <strong style={{ color: '#fbbf24' }}>{(activeChar.scale || 1.0).toFixed(2)}x</strong>
                  </div>
                  <input
                    type="range"
                    min={0.15}
                    max={2.0}
                    step={0.05}
                    value={activeChar.scale || 1.0}
                    onChange={(e) => handleUpdateActiveChar({ scale: Number(e.target.value) })}
                    style={{ width: '100%', marginTop: '4px', accentColor: '#c084fc' }}
                  />
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                    <button type="button" onClick={() => handleUpdateActiveChar({ scale: 0.35 })} className="atelier-godot-scale-btn">0.35x (Chibi)</button>
                    <button type="button" onClick={() => handleUpdateActiveChar({ scale: 0.5 })} className="atelier-godot-scale-btn">0.5x</button>
                    <button type="button" onClick={() => handleUpdateActiveChar({ scale: 1.0 })} className="atelier-godot-scale-btn">1.0x (Gốc)</button>
                    <button type="button" onClick={() => handleUpdateActiveChar({ scale: 1.5 })} className="atelier-godot-scale-btn">1.5x</button>
                  </div>
                </div>
              </div>

              {activeState && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(168, 85, 247, 0.15)', paddingTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--atl-text-secondary, #a39bc2)' }}>
                    <span>Vị trí đứng ngang (Toạ độ X trên sàn):</span>
                    <strong style={{ color: '#c084fc' }}>{Math.round(activeState.x)} px</strong>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={1230}
                    step={2}
                    value={Math.round(activeState.x)}
                    onChange={(e) => {
                      const newX = Number(e.target.value);
                      if (rosterStateRef.current[activeCharIdx]) {
                        rosterStateRef.current[activeCharIdx].x = newX;
                      }
                    }}
                    style={{ width: '100%', accentColor: '#c084fc' }}
                  />
                  <span style={{ fontSize: '0.675rem', color: 'var(--atl-text-muted, #716b89)' }}>
                    Mẹo: Bạn có thể <strong>nhấp giữ chuột và kéo thả trực tiếp</strong> nhân vật trên ảnh để dời vị trí tức thì!
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CỘT PHẢI: ĐIỀU CHỈNH MẶT ĐẤT VÀ TÙY CHỌN SO SÁNH 1:1 */}
        <div className="atelier-godot-ground-panel">
          <h4 style={{ margin: 0, color: '#f5f3ff', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', fontWeight: 700 }}>
            <Sliders size={16} color="#c084fc" />
            Đồng bộ Mặt đất &amp; Tỷ lệ 1:1
          </h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.775rem', color: 'var(--atl-text-secondary, #a39bc2)' }}>
              <span>Độ cao Mặt đất (Y):</span>
              <strong style={{ color: '#c084fc' }}>{groundY} px</strong>
            </div>
            <input
              type="range"
              min={200}
              max={680}
              step={2}
              value={groundY}
              onChange={(e) => setGroundY(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#c084fc' }}
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--atl-text-muted, #716b89)' }}>
              Kéo thanh trượt để chỉnh mép vách đá/mặt cỏ khớp với Map bạn tự vẽ.
            </span>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(168, 85, 247, 0.15)', margin: '2px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showGuidelines}
                onChange={(e) => setShowGuidelines(e.target.checked)}
                style={{ accentColor: '#c084fc' }}
              />
              <span style={{ color: '#facc15', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Ruler size={13} /> Thước gióng chiều cao (So sánh tỉ lệ)
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showCollision}
                onChange={(e) => setShowCollision(e.target.checked)}
                style={{ accentColor: '#c084fc' }}
              />
              <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Shield size={13} /> Khung va chạm đỏ (CollisionShape2D)
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showOrigin}
                onChange={(e) => setShowOrigin(e.target.checked)}
                style={{ accentColor: '#c084fc' }}
              />
              <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Move size={13} /> Điểm neo chân chạm đất (Origin 0, 0)
              </span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showFloorGrid}
                onChange={(e) => setShowFloorGrid(e.target.checked)}
                style={{ accentColor: '#c084fc' }}
              />
              <span style={{ color: 'var(--atl-text-secondary, #a39bc2)' }}>Lưới Tilemap 32px</span>
            </label>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(168, 85, 247, 0.15)', margin: '2px 0' }} />

          {activeChar && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.775rem' }}>
              <span style={{ fontWeight: 600, color: '#f5f3ff' }}>
                Cấu hình: {activeChar.name}
              </span>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label style={{ color: 'var(--atl-text-secondary, #a39bc2)' }}>
                  FPS ({activeChar.fps}):
                  <input
                    type="range"
                    min={2}
                    max={20}
                    value={activeChar.fps}
                    onChange={(e) => {
                      const newFps = Number(e.target.value);
                      setCharacters((prev) => prev.map((c, i) => i === activeCharIdx ? { ...c, fps: newFps } : c));
                    }}
                    style={{ width: '100%', marginTop: '2px', accentColor: '#c084fc' }}
                  />
                </label>

                <label style={{ color: 'var(--atl-text-secondary, #a39bc2)' }}>
                  Tốc độ ({activeChar.moveSpeed} px/s):
                  <input
                    type="range"
                    min={60}
                    max={260}
                    step={10}
                    value={activeChar.moveSpeed}
                    onChange={(e) => {
                      const newSpeed = Number(e.target.value);
                      setCharacters((prev) => prev.map((c, i) => i === activeCharIdx ? { ...c, moveSpeed: newSpeed } : c));
                    }}
                    style={{ width: '100%', marginTop: '2px', accentColor: '#c084fc' }}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================
          4. MODAL KHUNG Ô CHỌN / SỬA ẢNH (SLOT TEMPLATE MODAL)
         ======================================================== */}
      {isSlotModalOpen && (
        <div className="atelier-godot-modal-overlay">
          <div className="atelier-godot-modal-box">
            {/* Header Modal */}
            <div className="atelier-godot-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FolderOpen size={24} color="#c084fc" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f5f3ff', fontWeight: 700 }}>
                    {editingCharIdx !== null
                      ? `Chỉnh Sửa Khung Ảnh: ${stagedCharName}`
                      : 'Ghép & Nạp Nhân Vật từ Khung Ô Ảnh Rời'}
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--atl-text-secondary, #a39bc2)' }}>
                    {editingCharIdx !== null
                      ? 'Nhấp vào ô bạn đã đặt nhầm để thay đổi, kéo thả file mới vào ô đó hoặc xóa đi chọn lại.'
                      : 'Nhấp vào từng ô hoặc kéo thả file ảnh từ máy tính vào đúng ô có nhãn tên tương ứng.'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsSlotModalOpen(false);
                  setEditingCharIdx(null);
                }}
                className="atelier-dialog-close"
                style={{ background: 'transparent', border: 'none', color: '#a39bc2', cursor: 'pointer', padding: '6px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Thanh công cụ tiện ích ở đầu modal */}
            <div className="atelier-godot-modal-toolbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {/* Chọn chế độ 3 hàng hoặc 1 hàng */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#f5f3ff' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="slotMode"
                      checked={slotMode === '3_rows'}
                      onChange={() => setSlotMode('3_rows')}
                      style={{ accentColor: '#c084fc' }}
                    />
                    <strong style={{ color: slotMode === '3_rows' ? '#c084fc' : undefined }}>Bộ đầy đủ 3 hướng (15 ô)</strong>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', marginLeft: '8px' }}>
                    <input
                      type="radio"
                      name="slotMode"
                      checked={slotMode === '1_row'}
                      onChange={() => setSlotMode('1_row')}
                      style={{ accentColor: '#c084fc' }}
                    />
                    <strong style={{ color: slotMode === '1_row' ? '#c084fc' : undefined }}>Bộ 1 hướng đơn giản (5 ô)</strong>
                  </label>
                </div>

                <div style={{ width: '1px', height: '20px', background: 'rgba(168, 85, 247, 0.2)' }} />

                {/* Tên nhân vật & FPS */}
                <input
                  type="text"
                  value={stagedCharName}
                  onChange={(e) => setStagedCharName(e.target.value)}
                  placeholder="Tên nhân vật (VD: Hero, Mage)"
                  className="atelier-godot-input"
                  style={{ width: '160px', padding: '5px 10px', fontSize: '0.78rem' }}
                />

                <span style={{ fontSize: '0.75rem', color: 'var(--atl-text-secondary, #a39bc2)' }}>
                  FPS: <strong style={{ color: '#c084fc' }}>{stagedFps}</strong>
                </span>
                <input
                  type="range"
                  min={3}
                  max={20}
                  value={stagedFps}
                  onChange={(e) => setStagedFps(Number(e.target.value))}
                  style={{ width: '80px', accentColor: '#c084fc' }}
                />
              </div>

              {/* Nút nạp nhanh tự động & nút xóa */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label className="atelier-godot-btn-sub" style={{ cursor: 'pointer' }}>
                  <Zap size={14} color="#facc15" /> ⚡ Nạp nhanh cả thư mục
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleBatchAutoAssignSlots}
                  />
                </label>

                {Object.keys(slotsData).length > 0 && (
                  <button
                    type="button"
                    className="atelier-godot-row-action-btn"
                    onClick={() => setSlotsData({})}
                    style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.35)', padding: '5px 10px' }}
                  >
                    <Trash2 size={13} style={{ verticalAlign: 'middle' }} /> Xóa hết ô
                  </button>
                )}
              </div>
            </div>

            {/* BẢNG CÁC KHUNG Ô THEO HÀNG VỚI NHÃN RÕ RÀNG */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* NHÓM 1: HƯỚNG NHÌN XUỐNG (MẶT TRƯỚC - DOWN) */}
              <div className="atelier-godot-slot-row-card">
                <div className="atelier-godot-slot-row-header">
                  <div>
                    <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      ⬇️ HÀNG 1: HƯỚNG NHÌN XUỐNG (MẶT TRƯỚC - DOWN)
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--atl-text-muted, #716b89)' }}>
                      Dùng khi bấm phím <strong>[S]</strong> hoặc Mũi tên xuống. <em>(Có thể kéo thả ảnh giữa các ô để đổi chỗ)</em>
                    </span>
                  </div>

                  {/* Cụm công cụ sửa nhanh hàng 1 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      title="Dịch vòng các ô sang trái 1 bước (nếu đặt nhầm lệch thứ tự)"
                      onClick={() => handleShiftRow('down', -1)}
                      className="atelier-godot-row-action-btn"
                    >
                      ← Dịch
                    </button>
                    <button
                      type="button"
                      title="Dịch vòng các ô sang phải 1 bước"
                      onClick={() => handleShiftRow('down', 1)}
                      className="atelier-godot-row-action-btn"
                    >
                      Dịch →
                    </button>

                    {slotMode === '3_rows' && (
                      <>
                        <button
                          type="button"
                          title="Hoán đổi toàn bộ 5 ô Hàng 1 với Hàng 2 (Đi ngang)"
                          onClick={() => handleSwapRows('down', 'side')}
                          className="atelier-godot-row-action-btn"
                          style={{ borderColor: 'rgba(16, 185, 129, 0.35)', color: '#10b981' }}
                        >
                          ⇄ Đổi với Hàng Ngang
                        </button>
                        <button
                          type="button"
                          title="Hoán đổi toàn bộ 5 ô Hàng 1 với Hàng 3 (Sau lưng)"
                          onClick={() => handleSwapRows('down', 'up')}
                          className="atelier-godot-row-action-btn"
                          style={{ borderColor: 'rgba(245, 158, 11, 0.35)', color: '#f59e0b' }}
                        >
                          ⇄ Đổi với Hàng Sau Lưng
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      title="Xóa hết ảnh hàng này"
                      onClick={() => handleClearRow('down')}
                      className="atelier-godot-row-action-btn"
                      style={{ borderColor: 'rgba(239, 68, 68, 0.35)', color: '#f87171' }}
                    >
                      <Trash2 size={11} style={{ verticalAlign: 'middle' }} /> Xóa hàng
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                  {SLOT_DEFINITIONS_3_ROWS.filter((s) => s.direction === 'down').map((slotDef) => {
                    const slotData = slotsData[slotDef.id];
                    const isOver = dragOverSlot === slotDef.id;

                    return (
                      <label
                        key={slotDef.id}
                        draggable={!!slotData}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', slotDef.id);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverSlot(slotDef.id);
                        }}
                        onDragLeave={() => setDragOverSlot(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverSlot(null);
                          const draggedSlotId = e.dataTransfer.getData('text/plain');
                          if (draggedSlotId && draggedSlotId !== slotDef.id) {
                            handleSwapSlots(draggedSlotId, slotDef.id);
                            return;
                          }
                          const file = e.dataTransfer.files[0];
                          if (file) handleSetSlotImage(slotDef.id, file);
                        }}
                        className={`atelier-godot-slot-cell ${slotData ? 'filled' : ''} ${isOver ? 'drag-over' : ''}`}
                      >
                        <div style={{ width: '100%' }}>
                          <span style={{ fontSize: '0.725rem', fontWeight: 700, color: slotData ? '#38bdf8' : '#e2e8f0', display: 'block' }}>
                            {slotDef.label}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: slotDef.role === 'idle' ? '#facc15' : 'var(--atl-text-muted, #716b89)' }}>
                            {slotDef.desc}
                          </span>
                        </div>

                        {slotData ? (
                          <div style={{ position: 'relative', margin: '4px 0' }} title="Kéo ô này thả sang ô khác để hoán đổi">
                            <img
                              src={slotData.url}
                              alt={slotData.name}
                              style={{
                                width: '46px',
                                height: '46px',
                                objectFit: 'contain',
                                imageRendering: 'pixelated',
                                display: 'block',
                                margin: '0 auto'
                              }}
                            />
                            <button
                              type="button"
                              onClick={(e) => handleClearSlot(slotDef.id, e)}
                              title="Xóa ảnh khỏi ô này"
                              style={{
                                position: 'absolute',
                                top: -6,
                                right: -12,
                                background: '#ef4444',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: 'var(--atl-text-muted, #716b89)', margin: '6px 0' }}>
                            <Plus size={20} color="#a855f7" />
                            <span style={{ fontSize: '0.65rem' }}>Thả ảnh vào</span>
                          </div>
                        )}

                        <span style={{ fontSize: '0.625rem', color: slotData ? 'var(--atl-text-secondary, #a39bc2)' : '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90px' }}>
                          {slotData ? slotData.name : 'Chưa có'}
                        </span>

                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files[0];
                            e.target.value = '';
                            handleSetSlotImage(slotDef.id, file);
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* NHÓM 2: HƯỚNG NHÌN NGANG (ĐI NGHIÊNG - SIDE) */}
              {slotMode === '3_rows' && (
                <div className="atelier-godot-slot-row-card">
                  <div className="atelier-godot-slot-row-header">
                    <div>
                      <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ➡️ HÀNG 2: HƯỚNG NHÌN NGANG (ĐI NGHIÊNG - SIDE)
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--atl-text-muted, #716b89)' }}>
                        Đi sang phải [D]. <em>(Khi đi sang trái [A], app sẽ tự lật ngược hình lại)</em>
                      </span>
                    </div>

                    {/* Cụm công cụ sửa nhanh hàng 2 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        title="Dịch vòng các ô sang trái 1 bước (nếu đặt nhầm lệch thứ tự)"
                        onClick={() => handleShiftRow('side', -1)}
                        className="atelier-godot-row-action-btn"
                      >
                        ← Dịch
                      </button>
                      <button
                        type="button"
                        title="Dịch vòng các ô sang phải 1 bước"
                        onClick={() => handleShiftRow('side', 1)}
                        className="atelier-godot-row-action-btn"
                      >
                        Dịch →
                      </button>

                      <button
                        type="button"
                        title="Hoán đổi toàn bộ 5 ô Hàng 2 với Hàng 1 (Nhìn xuống)"
                        onClick={() => handleSwapRows('side', 'down')}
                        className="atelier-godot-row-action-btn"
                        style={{ borderColor: 'rgba(56, 189, 248, 0.35)', color: '#38bdf8' }}
                      >
                        ⇄ Đổi với Hàng Xuống
                      </button>
                      <button
                        type="button"
                        title="Hoán đổi toàn bộ 5 ô Hàng 2 với Hàng 3 (Sau lưng)"
                        onClick={() => handleSwapRows('side', 'up')}
                        className="atelier-godot-row-action-btn"
                        style={{ borderColor: 'rgba(245, 158, 11, 0.35)', color: '#f59e0b' }}
                      >
                        ⇄ Đổi với Hàng Sau Lưng
                      </button>

                      <button
                        type="button"
                        title="Xóa hết ảnh hàng này"
                        onClick={() => handleClearRow('side')}
                        className="atelier-godot-row-action-btn"
                        style={{ borderColor: 'rgba(239, 68, 68, 0.35)', color: '#f87171' }}
                      >
                        <Trash2 size={11} style={{ verticalAlign: 'middle' }} /> Xóa hàng
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                    {SLOT_DEFINITIONS_3_ROWS.filter((s) => s.direction === 'side').map((slotDef) => {
                      const slotData = slotsData[slotDef.id];
                      const isOver = dragOverSlot === slotDef.id;

                      return (
                        <label
                          key={slotDef.id}
                          draggable={!!slotData}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', slotDef.id);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverSlot(slotDef.id);
                          }}
                          onDragLeave={() => setDragOverSlot(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverSlot(null);
                            const draggedSlotId = e.dataTransfer.getData('text/plain');
                            if (draggedSlotId && draggedSlotId !== slotDef.id) {
                              handleSwapSlots(draggedSlotId, slotDef.id);
                              return;
                            }
                            const file = e.dataTransfer.files[0];
                            if (file) handleSetSlotImage(slotDef.id, file);
                          }}
                          className={`atelier-godot-slot-cell ${slotData ? 'filled' : ''} ${isOver ? 'drag-over' : ''}`}
                        >
                          <div style={{ width: '100%' }}>
                            <span style={{ fontSize: '0.725rem', fontWeight: 700, color: slotData ? '#10b981' : '#e2e8f0', display: 'block' }}>
                              {slotDef.label}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: slotDef.role === 'idle' ? '#facc15' : 'var(--atl-text-muted, #716b89)' }}>
                              {slotDef.desc}
                            </span>
                          </div>

                          {slotData ? (
                            <div style={{ position: 'relative', margin: '4px 0' }} title="Kéo ô này thả sang ô khác để hoán đổi">
                              <img
                                src={slotData.url}
                                alt={slotData.name}
                                style={{
                                  width: '46px',
                                  height: '46px',
                                  objectFit: 'contain',
                                  imageRendering: 'pixelated',
                                  display: 'block',
                                  margin: '0 auto'
                                }}
                              />
                              <button
                                type="button"
                                onClick={(e) => handleClearSlot(slotDef.id, e)}
                                title="Xóa ảnh khỏi ô này"
                                style={{
                                  position: 'absolute',
                                  top: -6,
                                  right: -12,
                                  background: '#ef4444',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '50%',
                                  width: '18px',
                                  height: '18px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer'
                                }}
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: 'var(--atl-text-muted, #716b89)', margin: '6px 0' }}>
                              <Plus size={20} color="#10b981" />
                              <span style={{ fontSize: '0.65rem' }}>Thả ảnh vào</span>
                            </div>
                          )}

                          <span style={{ fontSize: '0.625rem', color: slotData ? 'var(--atl-text-secondary, #a39bc2)' : '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90px' }}>
                            {slotData ? slotData.name : 'Chưa có'}
                          </span>

                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files[0];
                              e.target.value = '';
                              handleSetSlotImage(slotDef.id, file);
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* NHÓM 3: HƯỚNG NHÌN LÊN (SAU LƯNG - UP) */}
              {slotMode === '3_rows' && (
                <div className="atelier-godot-slot-row-card">
                  <div className="atelier-godot-slot-row-header">
                    <div>
                      <span style={{ fontSize: '0.825rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        ⬆️ HÀNG 3: HƯỚNG NHÌN LÊN (SAU LƯNG - UP)
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--atl-text-muted, #716b89)' }}>
                        Dùng khi bấm phím <strong>[W]</strong> hoặc Mũi tên lên
                      </span>
                    </div>

                    {/* Cụm công cụ sửa nhanh hàng 3 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        type="button"
                        title="Dịch vòng các ô sang trái 1 bước (nếu đặt nhầm lệch thứ tự)"
                        onClick={() => handleShiftRow('up', -1)}
                        className="atelier-godot-row-action-btn"
                      >
                        ← Dịch
                      </button>
                      <button
                        type="button"
                        title="Dịch vòng các ô sang phải 1 bước"
                        onClick={() => handleShiftRow('up', 1)}
                        className="atelier-godot-row-action-btn"
                      >
                        Dịch →
                      </button>

                      <button
                        type="button"
                        title="Hoán đổi toàn bộ 5 ô Hàng 3 với Hàng 1 (Nhìn xuống)"
                        onClick={() => handleSwapRows('up', 'down')}
                        className="atelier-godot-row-action-btn"
                        style={{ borderColor: 'rgba(56, 189, 248, 0.35)', color: '#38bdf8' }}
                      >
                        ⇄ Đổi với Hàng Xuống
                      </button>
                      <button
                        type="button"
                        title="Hoán đổi toàn bộ 5 ô Hàng 3 với Hàng 2 (Đi ngang)"
                        onClick={() => handleSwapRows('up', 'side')}
                        className="atelier-godot-row-action-btn"
                        style={{ borderColor: 'rgba(16, 185, 129, 0.35)', color: '#10b981' }}
                      >
                        ⇄ Đổi với Hàng Ngang
                      </button>

                      <button
                        type="button"
                        title="Xóa hết ảnh hàng này"
                        onClick={() => handleClearRow('up')}
                        className="atelier-godot-row-action-btn"
                        style={{ borderColor: 'rgba(239, 68, 68, 0.35)', color: '#f87171' }}
                      >
                        <Trash2 size={11} style={{ verticalAlign: 'middle' }} /> Xóa hàng
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                    {SLOT_DEFINITIONS_3_ROWS.filter((s) => s.direction === 'up').map((slotDef) => {
                      const slotData = slotsData[slotDef.id];
                      const isOver = dragOverSlot === slotDef.id;

                      return (
                        <label
                          key={slotDef.id}
                          draggable={!!slotData}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', slotDef.id);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverSlot(slotDef.id);
                          }}
                          onDragLeave={() => setDragOverSlot(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverSlot(null);
                            const draggedSlotId = e.dataTransfer.getData('text/plain');
                            if (draggedSlotId && draggedSlotId !== slotDef.id) {
                              handleSwapSlots(draggedSlotId, slotDef.id);
                              return;
                            }
                            const file = e.dataTransfer.files[0];
                            if (file) handleSetSlotImage(slotDef.id, file);
                          }}
                          className={`atelier-godot-slot-cell ${slotData ? 'filled' : ''} ${isOver ? 'drag-over' : ''}`}
                        >
                          <div style={{ width: '100%' }}>
                            <span style={{ fontSize: '0.725rem', fontWeight: 700, color: slotData ? '#f59e0b' : '#e2e8f0', display: 'block' }}>
                              {slotDef.label}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: slotDef.role === 'idle' ? '#facc15' : 'var(--atl-text-muted, #716b89)' }}>
                              {slotDef.desc}
                            </span>
                          </div>

                          {slotData ? (
                            <div style={{ position: 'relative', margin: '4px 0' }} title="Kéo ô này thả sang ô khác để hoán đổi">
                              <img
                                src={slotData.url}
                                alt={slotData.name}
                                style={{
                                  width: '46px',
                                  height: '46px',
                                  objectFit: 'contain',
                                  imageRendering: 'pixelated',
                                  display: 'block',
                                  margin: '0 auto'
                                }}
                              />
                              <button
                                type="button"
                                onClick={(e) => handleClearSlot(slotDef.id, e)}
                                title="Xóa ảnh khỏi ô này"
                                style={{
                                  position: 'absolute',
                                  top: -6,
                                  right: -12,
                                  background: '#ef4444',
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: '50%',
                                  width: '18px',
                                  height: '18px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer'
                                }}
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: 'var(--atl-text-muted, #716b89)', margin: '6px 0' }}>
                              <Plus size={20} color="#f59e0b" />
                              <span style={{ fontSize: '0.65rem' }}>Thả ảnh vào</span>
                            </div>
                          )}

                          <span style={{ fontSize: '0.625rem', color: slotData ? 'var(--atl-text-secondary, #a39bc2)' : '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90px' }}>
                            {slotData ? slotData.name : 'Chưa có'}
                          </span>

                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files[0];
                              e.target.value = '';
                              handleSetSlotImage(slotDef.id, file);
                            }}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* KHUNG XEM TRƯỚC HOẠT HỌA 3 HƯỚNG TRỰC TIẾP & NÚT HOÀN TẤT */}
            <div className="atelier-godot-modal-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f5f3ff' }}>
                  Xem trước 3 hướng:
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <canvas ref={previewDownCanvasRef} width={50} height={50} style={{ background: '#0e0a1a', borderRadius: '6px', display: 'block', border: '1px solid rgba(168, 85, 247, 0.3)' }} />
                    <span style={{ fontSize: '0.625rem', color: '#38bdf8', marginTop: '2px', display: 'block' }}>⬇️ Xuống</span>
                  </div>
                  {slotMode === '3_rows' && (
                    <>
                      <div style={{ textAlign: 'center' }}>
                        <canvas ref={previewSideCanvasRef} width={50} height={50} style={{ background: '#0e0a1a', borderRadius: '6px', display: 'block', border: '1px solid rgba(16, 185, 129, 0.3)' }} />
                        <span style={{ fontSize: '0.625rem', color: '#10b981', marginTop: '2px', display: 'block' }}>➡️ Ngang</span>
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <canvas ref={previewUpCanvasRef} width={50} height={50} style={{ background: '#0e0a1a', borderRadius: '6px', display: 'block', border: '1px solid rgba(245, 158, 11, 0.3)' }} />
                        <span style={{ fontSize: '0.625rem', color: '#f59e0b', marginTop: '2px', display: 'block' }}>⬆️ Lưng</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="atelier-dialog-btn-cancel"
                  onClick={() => {
                    setIsSlotModalOpen(false);
                    setEditingCharIdx(null);
                  }}
                  style={{ fontSize: '0.8rem', padding: '7px 16px' }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  className="atelier-dialog-btn-confirm primary"
                  onClick={handleConfirmSlotTemplate}
                  style={{ fontSize: '0.8rem', padding: '7px 18px', gap: '6px' }}
                >
                  <Check size={16} />
                  {editingCharIdx !== null ? 'Hoàn tất & Cập nhật nhân vật' : 'Hoàn tất & Đưa vào Game'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
