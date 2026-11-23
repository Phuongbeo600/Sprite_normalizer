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
  Move,
  Image as ImageIcon,
  Plus,
  Trash2,
  Ruler,
  Users,
  Layers,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  Pencil,
  RefreshCw,
  Archive
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// Mẫu ô dùng để sắp xếp khung ảnh theo hướng.
import { SLOT_DEFINITIONS_3_ROWS } from './slotDefinitions';
// Các hàm tạo, ghép và cắt sprite sheet trên canvas.
import { createDemoSpriteSheet, stitchSlotsToSheet, extractSlotsFromSheet } from './spriteSheets';
// Hàm dựng cửa sổ ghép ảnh và canvas xem trước.
import { renderSlotTemplateDialog } from './renderSlotTemplateDialog';
// Mô phỏng, vẽ canvas và phiên chỉnh sửa ô có trách nhiệm độc lập.
import { advanceTestbedSimulation, createRosterState } from './testbedSimulation';
import { drawTestbedCanvas } from './testbedCanvas';
import { useSlotTemplateEditor } from './useSlotTemplateEditor';
// Hộp thoại chọn Sprite Sheet hoặc Bộ Frame từ Kho tài nguyên MySQL.
import VaultAssetPickerModal from './VaultAssetPickerModal';

// Giao tiếp API tách khỏi trạng thái và giao diện.
import { exportGodotArchive, createTestbedCharacter, deleteTestbedCharacter, deleteTestbedMap, loadTestbedCharacters, loadTestbedMap, saveTestbedGroundY, saveTestbedMap, updateTestbedCharacter } from './testbedApi';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark Fantasy Atelier từ godot-atelier.css
import './godot-atelier.css';


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

  // Trạng thái Modal chọn Sprite Sheet / Frame từ Kho tài nguyên MySQL
  const [showVaultPickerModal, setShowVaultPickerModal] = useState(false);
  const [vaultPickerTargetCharIdx, setVaultPickerTargetCharIdx] = useState(null);

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

  const {
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
  } = useSlotTemplateEditor({characters, setCharacters, setActiveCharIdx, currentProject, groundY, rosterStateRef, setAddMenuOpen, setErrorMsg});

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

      rosterStateRef.current.push(createRosterState(cfg.x, 540));
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
    loadTestbedMap(projectId)
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
    loadTestbedCharacters(projectId)
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

            rosterStateRef.current.push(createRosterState(charDb.pos_x || (160 + idx * 100), groundY));
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
      saveTestbedGroundY({
          project_id: currentProject.id,
          ground_y: groundY
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
      rosterStateRef.current.push(createRosterState(Math.min(1150, newX), groundY));

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
          saveTestbedMap({
              project_id: currentProject.id,
              name: file.name,
              map_image_base64: dataUrl,
              ground_y: groundY,
              show_ground_line: showGroundLine
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
      deleteTestbedMap(currentProject.id).catch((err) => console.error('Lỗi khi xóa bản đồ khỏi MySQL:', err));
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
      rosterStateRef.current.push(createRosterState(Math.min(1150, newX), groundY));

      // Tự động trích xuất các ô frame từ Sheet và lưu vĩnh viễn vào MySQL
      if (currentProject?.id) {
        // 1. Lưu bản ghi nhân vật đa khung hình vào testbed_characters
        const extracted = extractSlotsFromSheet(newChar);
        const slotsPayload = {};
        Object.entries(extracted).forEach(([k, v]) => {
          if (v && v.url) slotsPayload[k] = v.url;
        });

        createTestbedCharacter({
            project_id: currentProject.id,
            name: newChar.name,
            scale: 1.0,
            pos_x: Math.min(1150, newX),
            fps: 8,
            move_speed: 130,
            slots_data: slotsPayload
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

  // Xử lý nạp Sprite Sheet / Bộ frame từ Kho tài nguyên MySQL
  const handleSelectVaultAsset = (assetData) => {
    if (!assetData || !assetData.sheetUrl) return;

    const img = new Image();
    img.onload = () => {
      const defRows = assetData.rows || 3;
      const defCols = assetData.columns || 5;
      const cWidth = assetData.targetWidth || Math.floor(img.naturalWidth / defCols);
      const cHeight = assetData.targetHeight || Math.floor(img.naturalHeight / defRows);
      const charName = (assetData.sprite?.folder_name || assetData.sprite?.name || 'Hero')
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ');

      // Chuẩn bị slotsData nếu tài nguyên có danh sách frame con
      const slotsObj = {};
      if (assetData.frames && assetData.frames.length > 0) {
        SLOT_DEFINITIONS_3_ROWS.forEach((slotDef, i) => {
          const f = assetData.frames[i];
          if (f) {
            const fImg = new Image();
            fImg.src = f.image_url;
            slotsObj[slotDef.id] = {
              img: fImg,
              url: f.image_url,
              name: f.frame_name || `${slotDef.id}.png`,
            };
          }
        });
      }

      if (vaultPickerTargetCharIdx !== null && characters[vaultPickerTargetCharIdx]) {
        // TRƯỜNG HỢP 1: THAY THẾ KHUNG CHO NHÂN VẬT ĐANG CHỌN
        setCharacters((prev) =>
          prev.map((c, idx) => {
            if (idx !== vaultPickerTargetCharIdx) return c;
            const updated = {
              ...c,
              sheetImage: img,
              sheetUrl: assetData.sheetUrl,
              sheetFileName: assetData.sprite?.name || `${charName}_sheet.png`,
              rows: defRows,
              columns: defCols,
              cellWidth: cWidth > 0 ? cWidth : 32,
              cellHeight: cHeight > 0 ? cHeight : 48,
              slotsData: Object.keys(slotsObj).length > 0 ? slotsObj : c.slotsData,
            };

            // Đồng bộ cập nhật lên MySQL nếu nhân vật đã có dbId
            if (currentProject?.id && updated.dbId) {
              updateTestbedCharacter(updated.dbId, currentProject.id, {
                  name: updated.name,
                  scale: updated.scale || 1.0,
                  fps: updated.fps || 8,
                  move_speed: updated.moveSpeed || 140,
                }).catch(() => {});
            }
            return updated;
          })
        );
      } else {
        // TRƯỜNG HỢP 2: TẠO NHÂN VẬT MỚI TỪ KHO
        const newId = `char_vault_${Date.now()}`;
        const newChar = {
          id: newId,
          name: charName.charAt(0).toUpperCase() + charName.slice(1),
          icon: '✨',
          sheetImage: img,
          sheetUrl: assetData.sheetUrl,
          sheetFileName: assetData.sprite?.name || `${charName}_sheet.png`,
          rows: defRows,
          columns: defCols,
          fps: assetData.metadata?.fps || 8,
          moveSpeed: 130,
          cellWidth: cWidth > 0 ? cWidth : 32,
          cellHeight: cHeight > 0 ? cHeight : 48,
          scale: 1.0,
          isCustom: true,
          slotsData: slotsObj,
          slotMode: '3_rows',
        };

        const newX = 160 + characters.length * 90;
        rosterStateRef.current.push(createRosterState(Math.min(1150, newX), groundY));

        setCharacters((prev) => [...prev, newChar]);
        setActiveCharIdx(characters.length);

        // Tự động lưu nhân vật mới vào MySQL (testbed_characters)
        if (currentProject?.id) {
          createTestbedCharacter({
              project_id: currentProject.id,
              name: newChar.name,
              scale: newChar.scale,
              fps: newChar.fps,
              move_speed: newChar.moveSpeed,
              pos_x: Math.min(1150, newX),
              pos_y: groundY,
            })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data && data.character_id) {
                setCharacters((prev) =>
                  prev.map((c) => (c.id === newId ? { ...c, dbId: data.character_id } : c))
                );
              }
            })
            .catch(() => {});
        }
      }
      setErrorMsg('');
    };
    img.src = assetData.sheetUrl;
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
        updateTestbedCharacter(updated.dbId, currentProject.id, {
            name: updated.name,
            scale: updated.scale || 1.0,
            pos_x: rosterStateRef.current[activeCharIdx]?.x || 260,
            fps: updated.fps || 8
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
      deleteTestbedCharacter(charToRemove.dbId, currentProject.id).catch((err) => console.error('Lỗi khi xóa nhân vật khỏi MySQL:', err));
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

  // Game loop 60 FPS
  const gameLoop = useCallback((currentTime) => {
    const delta = Math.min((currentTime - lastTime.current) / 1000.0, 0.1);
    lastTime.current = currentTime;

    const canvas = canvasRef.current;
    if (canvas && characters.length > 0) {
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;

      advanceTestbedSimulation({characters, roster: rosterStateRef.current, activeCharIdx, keys: keysPressed.current, isDragging: isDraggingRef.current, delta, w, h, groundY});
      drawTestbedCanvas(ctx, {characters, roster: rosterStateRef.current, activeCharIdx, w, h, groundY, mapImage, showFloorGrid, showGroundLine, showCollision, showOrigin, showGuidelines, pixelZoom});
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
      const zipBlob = await exportGodotArchive(activeChar);
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

                <div
                  className="atelier-godot-dropdown-item"
                  onClick={() => {
                    setAddMenuOpen(false);
                    setVaultPickerTargetCharIdx(null);
                    setShowVaultPickerModal(true);
                  }}
                >
                  <Archive size={18} color="#c084fc" />
                  <div>
                    <div className="atelier-godot-dropdown-item-title">3. Nhập từ Kho tài nguyên</div>
                    <div className="atelier-godot-dropdown-item-desc">Chọn Sprite Sheet hoặc Bộ Frame trong CSDL</div>
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

                  <button
                    type="button"
                    className="atelier-godot-btn-sub"
                    onClick={() => {
                      setVaultPickerTargetCharIdx(activeCharIdx);
                      setShowVaultPickerModal(true);
                    }}
                    style={{ background: 'rgba(147, 51, 234, 0.18)', borderColor: 'rgba(168, 85, 247, 0.35)', color: '#c084fc' }}
                    title="Nạp khung ảnh từ Kho tài nguyên / Thư mục CSDL vào nhân vật này"
                  >
                    <Archive size={13} color="#c084fc" /> Nạp từ Kho…
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
      {isSlotModalOpen && renderSlotTemplateDialog({
        editingCharIdx,
        stagedCharName,
        setStagedCharName,
        slotMode,
        setSlotMode,
        stagedFps,
        setStagedFps,
        slotsData,
        dragOverSlot,
        setDragOverSlot,
        handleBatchAutoAssignSlots,
        handleShiftRow,
        handleSwapRows,
        handleClearRow,
        handleSwapSlots,
        handleSetSlotImage,
        handleClearSlot,
        previewDownCanvasRef,
        previewSideCanvasRef,
        previewUpCanvasRef,
        handleConfirmSlotTemplate,
        onClose: () => {
          setIsSlotModalOpen(false);
          setEditingCharIdx(null);
        },
        onClearAllSlots: () => setSlotsData({})
      })}

      {/* ========================================================
          5. MODAL CHỌN SPRITE SHEET HOẶC BỘ FRAME TỪ KHO MYSQL
         ======================================================== */}
      <VaultAssetPickerModal
        isOpen={showVaultPickerModal}
        onClose={() => setShowVaultPickerModal(false)}
        projectId={currentProject?.id}
        targetChar={vaultPickerTargetCharIdx !== null ? characters[vaultPickerTargetCharIdx] : null}
        onSelectAsset={handleSelectVaultAsset}
      />
    </div>
  );
}
