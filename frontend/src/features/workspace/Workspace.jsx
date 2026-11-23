// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
// React quản lý vòng đời, trạng thái bàn vẽ, kích thước vùng xem và tài nguyên ảnh.
import { useEffect, useRef, useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Bộ icon vector cho mở ảnh, thu phóng, hoạt họa, cắt khung và tải về
import {
  FolderOpen,
  Grid2X2,
  Image as ImageIcon,
  LoaderCircle,
  Minus,
  Plus,
  Sliders,
  AlertCircle,
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// Dải khung hình và các điều khiển phát thử sprite sheet.
import WorkspaceTimeline from './WorkspaceTimeline';
// Bảng màu, vòng đời ảnh và các lệnh xử lý sheet được quản lý theo trách nhiệm.
import useWorkspacePalette from './useWorkspacePalette';
import useWorkspaceImageLifecycle, { createSourceDecoder } from './useWorkspaceImageLifecycle';
import { createSheetOperations } from './sheetOperations';
// Lớp phủ đường cắt chỉnh được bằng chuột hoặc bàn phím.
import ManualSheetGrid from './components/ManualSheetGrid';
// Khởi tạo và mã hóa tọa độ đường cắt theo ảnh nguồn.
import { createGridCuts, savedGridCuts } from './sheetGrid';
// Cột bảng màu Sprite Studio (Swatches Grid & Global Swap).
import PaletteDock from './components/PaletteDock';
// Thanh công cụ vẽ pixel art (Pencil, Bucket, Pipette, Eraser).
import DrawingToolbar from './components/DrawingToolbar';
// Bàn vẽ tương tác Pixel Canvas (Interactive Drawing Canvas).
import PixelCanvas from './components/PixelCanvas';
// Các bảng công cụ và hộp thoại chỉ nhận dữ liệu cùng callback từ bàn làm việc.
import SingleImageInspector from './components/SingleImageInspector';
import SheetInspector from './components/SheetInspector';
import SaveSheetPackDialog from './components/SaveSheetPackDialog';
// Các yêu cầu xử lý và phân tích ảnh của bàn làm việc.
import { processImage } from './workspaceApi';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark Fantasy Atelier chuyên biệt cho bàn làm việc Workspace
import './workspace-atelier.css';

const MAX_FRAMES = 256;

/**
 * Bàn làm việc Xử lý & Chuẩn hóa Sprite (Dark Fantasy Atelier Workspace).
 * Cung cấp đầy đủ công cụ studio chuyên nghiệp:
 * - Chuẩn hóa ảnh đơn (Resize, Anchor, Bounding Box).
 * - Phân tách Sprite Sheet (Cắt lưới ma trận, Căn tâm & neo chân).
 * - Dò lưới pixel tự động và phục hồi độ phân giải gốc.
 * - Trình phát thử hoạt họa (Animation Timeline Player) điều chỉnh FPS.
 * - Xuất tệp PNG đơn lẻ hoặc gói nén ZIP chuẩn Godot Engine 4.3.
 * - Tự động lưu trữ lịch sử ảnh vào cơ sở dữ liệu MySQL.
 *
 * @param {Object} props Thuộc tính truyền vào component.
 * @param {Object} [props.currentProject] Dự án hiện tại đang mở.
 * @param {File|null} [props.incomingFile] Tệp ảnh được chuyển tiếp từ màn hình Tạo ảnh AI hoặc Studio.
 * @param {string[]|null} [props.incomingPalette] Bảng màu trích xuất chuyển tiếp từ màn hình Phân tích.
 * @param {Object|null} [props.incomingSheetData] Dữ liệu trọn bộ frame cắt rời và thông số lưới nạp từ CSDL MySQL.
 * @returns {React.ReactElement} Giao diện bàn làm việc chuẩn hóa sprite.
 */
export default function Workspace({
  currentProject,
  incomingFile = null,
  incomingPalette = null,
  incomingSheetData = null
}) {
  // Chế độ làm việc: 'single' (Ảnh đơn) | 'sheet' (Sprite Sheet hoạt họa)
  const [mode, setMode] = useState('single');
  // Dữ liệu ảnh nguồn ban đầu
  const [source, setSource] = useState(null);
  // Dữ liệu ảnh sau khi xử lý
  const [result, setResult] = useState(null);
  // Hiển thị kết quả hay ảnh gốc (ở chế độ so sánh)
  const [showResult, setShowResult] = useState(true);
  // Trạng thái hiển thị bảng thông số thiết lập bên phải (Inspector)
  const [showInspector, setShowInspector] = useState(true);
  // Kích thước mục tiêu cho thao tác Thu nhỏ ảnh (Resize)
  const [resizeTarget, setResizeTarget] = useState({ width: 64, height: 64 });
  // Kích thước mục tiêu cho thao tác Chuẩn hóa & Điểm neo (Normalize)
  const [normalizeTarget, setNormalizeTarget] = useState({ width: 64, height: 64 });
  // Khóa tỉ lệ khung hình (Keep aspect ratio)
  const [keepRatio, setKeepRatio] = useState(true);
  // Điểm neo cố định: 'bottom_center' | 'center' | 'top_left'
  const [anchor, setAnchor] = useState('bottom_center');
  // Trạng thái gập/mở của các khung Accordion trong Inspector
  const [openSections, setOpenSections] = useState({
    resize: true,
    anchor: true,
    result: true,
    sheetSlice: true,
    sheetBatchResize: true,
    sheetExport: true,
  });
  // Kích thước mục tiêu cho thao tác Ép độ phân giải frame hàng loạt (Batch Resize)
  const [batchResizeTarget, setBatchResizeTarget] = useState({ width: 64, height: 64 });
  const [batchKeepRatio, setBatchKeepRatio] = useState(true);
  const [batchResizing, setBatchResizing] = useState(false);
  const [batchResizeMsg, setBatchResizeMsg] = useState('');
  // Kích thước thực tế của frame sau khi đã ép thành công (dùng để lưu vào CSDL và xuất ZIP)
  const [batchResizedSize, setBatchResizedSize] = useState(null);
  // Số hàng và số cột khi cắt Sprite Sheet
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(5);
  // Giá trị rỗng dùng lưới tự động; lưới thủ công lưu các biên theo pixel ảnh gốc.
  const [manualCuts, setManualCuts] = useState(null);
  // Tự động căn tâm & neo chân (Bottom-Center)
  const [autoAnchor, setAutoAnchor] = useState(false);
  // Dữ liệu Sprite Sheet sau khi bóc tách frame
  const [sheet, setSheet] = useState(null);
  // Vị trí frame đang được chọn xem
  const [frameIndex, setFrameIndex] = useState(null);
  // Tốc độ khung hình hoạt họa (Frames per second)
  const [fps, setFps] = useState(6);
  // Trạng thái phát hoạt họa tự động
  const [playing, setPlaying] = useState(false);
  // Hệ số thu phóng vùng xem (Zoom scale)
  const [zoom, setZoom] = useState(null);
  // Kích thước thực tế của vùng xem viewport
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  // Thông báo trạng thái xử lý đang chạy
  const [busy, setBusy] = useState('');
  // Thông báo lỗi nếu xảy ra sự cố
  const [error, setError] = useState('');
  // Lưới pixel tự nhiên được nhận diện
  const [nativeGrid, setNativeGrid] = useState(null);
  // Trạng thái đang dò lưới pixel tự động
  const [detectingGrid, setDetectingGrid] = useState(false);
  // Lỗi khi dò lưới pixel
  const [gridError, setGridError] = useState('');
  // Mã định danh bản ghi sprite trong CSDL MySQL
  const [spriteDbId, setSpriteDbId] = useState(null);
  // Tham chiếu đồng bộ mã bản ghi sprite để tránh race condition khi xử lý nhanh
  const spriteDbIdRef = useRef(null);
  // Bộ đệm lưu tạm ảnh đã chuẩn hóa nếu người dùng bấm áp dụng trước khi lưu raw xong
  const pendingProcessedBlobRef = useRef(null);

  // Quản lý Modal lưu bộ Frame cắt rời vào Thư mục Kho tài nguyên
  const [showSavePackModal, setShowSavePackModal] = useState(false);
  const [packFolderName, setPackFolderName] = useState('');
  const [savingPack, setSavingPack] = useState(false);
  const [savePackStatus, setSavePackStatus] = useState({ success: false, message: '' });

  // Tham chiếu DOM đến vùng xem và tọa độ kéo chuột
  const viewport = useRef(null);
  const drag = useRef(null);
  const uploadVersion = useRef(0);
  // Tọa độ dịch chuyển tự do của bàn vẽ khi rê chuột (Pan Offset)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  const {
    paletteColors, setPaletteColors, activeColor, setActiveColor,
    isPaletteLoading, fetchPalette, handleAddPaletteColor, handleDeletePaletteColor,
  } = useWorkspacePalette();
  // Công cụ vẽ đang kích hoạt ('pencil' | 'bucket' | 'eyedropper' | 'eraser' | 'pan')
  const [activeTool, setActiveTool] = useState('pencil');
  // Kích thước đầu bút vẽ (1, 2, 3 px)
  const [brushSize, setBrushSize] = useState(1);
  // Trạng thái bật/tắt hiển thị lưới ô pixel khi zoom lớn
  const [showPixelGrid, setShowPixelGrid] = useState(true);
  // Trạng thái khả dụng của hoàn tác (Undo) và làm lại (Redo)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  // Tham chiếu đến component PixelCanvas để điều khiển hoàn tác và làm lại
  const pixelCanvasRef = useRef(null);

  // Tính toán các giá trị phái sinh
  const dimensions = source?.dimensions;
  const sourceFile = source?.file;
  const resizeSource = nativeGrid || dimensions;
  const restoringGrid =
    nativeGrid?.scale > 1 &&
    Number(resizeTarget.width) === nativeGrid.width &&
    Number(resizeTarget.height) === nativeGrid.height;
  const sheetMode = mode === 'sheet';
  const frame = !sheetMode || frameIndex === null ? null : sheet?.frames[frameIndex];
  const preview = sheetMode ? frame || dimensions : (showResult && result) || dimensions;
  const gridCount = Number(rows) * Number(columns);
  const numRows = Math.max(1, Number(rows) || 1);
  const numCols = Math.max(1, Number(columns) || 1);
  const cellWidth = manualCuts
    ? Math.max(...manualCuts.x.slice(1).map((value, index) => value - manualCuts.x[index]))
    : dimensions ? Math.floor(dimensions.width / numCols) : 0;
  const cellHeight = manualCuts
    ? Math.max(...manualCuts.y.slice(1).map((value, index) => value - manualCuts.y[index]))
    : dimensions ? Math.floor(dimensions.height / numRows) : 0;
  const remainderX = dimensions ? dimensions.width % numCols : 0;
  const remainderY = dimensions ? dimensions.height % numRows : 0;
  const marginX = Math.floor(remainderX / 2);
  const marginY = Math.floor(remainderY / 2);
  const gridValid =
    dimensions &&
    Number.isInteger(Number(rows)) &&
    Number.isInteger(Number(columns)) &&
    Number(rows) > 0 &&
    Number(columns) > 0 &&
    gridCount <= MAX_FRAMES &&
    cellWidth >= 1 &&
    cellHeight >= 1;
  const previewWidth = preview?.width || cellWidth || dimensions?.width || 64;
  const previewHeight = preview?.height || cellHeight || dimensions?.height || 64;
  const fitZoom = (preview && previewWidth > 0 && previewHeight > 0 && viewportSize.width > 32 && viewportSize.height > 32)
    ? Math.max(
        0.01,
        Math.min((viewportSize.width - 32) / previewWidth, (viewportSize.height - 32) / previewHeight, 16)
      )
    : 1;
  const safeFitZoom = Number.isFinite(fitZoom) ? fitZoom : 1;
  const activeZoom = Number.isFinite(zoom) ? zoom : safeFitZoom;
  const nameStem = source?.file.name.replace(/\.[^.]+$/, '') || 'sprite';
  const sheetLocked = Boolean(busy) || batchResizing || savingPack;

  const { executeBatchResize, executeSliceSheet, exportSheet, handleConfirmSavePack } = createSheetOperations({
    source, sheet, batchResizing, setBatchResizing, setBatchResizeMsg,
    setError, batchResizeTarget, autoAnchor, setSheet, setBatchResizedSize,
    dimensions, busy, gridValid, setBusy, setPlaying,
    rows, columns, manualCuts, setFrameIndex, setZoom,
    batchResizedSize, nameStem, currentProject, setSavePackStatus, setSavingPack,
    packFolderName, fps, setShowSavePackModal,
  });

  // Lắng nghe thay đổi kích thước khung nhìn để tính toán zoom vừa vặn
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);

  useWorkspaceImageLifecycle({
    source, result, dimensions, sourceFile,
    setDetectingGrid, setNativeGrid, setGridError,
  });

  // Cập nhật kích thước mục tiêu cho thao tác thu nhỏ khi phát hiện ảnh hoặc lưới
  useEffect(() => {
    if (resizeSource) {
      setResizeTarget({ width: resizeSource.width, height: resizeSource.height });
    }
  }, [resizeSource]);

  // Vòng lặp phát thử hoạt họa cho Sprite Sheet theo FPS
  useEffect(() => {
    if (!playing || !sheet || !sheetMode) return;
    const timer = setInterval(() => {
      setFrameIndex((index) => ((index ?? -1) + 1) % sheet.frames.length);
    }, 1000 / fps);
    return () => clearInterval(timer);
  }, [playing, sheet, sheetMode, fps]);

  /**
   * Chuyển đổi giữa chế độ Xử lý ảnh đơn và Cắt Sprite Sheet
   */
  function selectMode(next) {
    setMode(next);
    setPlaying(false);
    setZoom(null);
    setError('');
  }

  /**
   * Đồng bộ dữ liệu khi người dùng vẽ hoặc chỉnh sửa trực tiếp trên canvas
   *
   * @param {Blob} blob Dữ liệu nhị phân ảnh mới.
   * @param {string} url Đường dẫn blob xem trước.
   * @returns {void}
   */
  function handleCanvasModified(blob, url) {
    if (!source?.file) return;
    const newFile = new File([blob], source.file.name, { type: 'image/png' });
    setResult({
      file: newFile,
      blob,
      url,
      width: preview?.width || source.dimensions?.width || 64,
      height: preview?.height || source.dimensions?.height || 64,
    });
    setShowResult(true);
  }

  // Lắng nghe phím tắt Ctrl+Z (Hoàn tác) và Ctrl+Y (Làm lại)
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        pixelCanvasRef.current?.undo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))
      ) {
        e.preventDefault();
        pixelCanvasRef.current?.redo();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  /**
   * Đặt lại bàn làm việc và đọc kích thước của ảnh nguồn mới.
   *
   * @param {File} file Tệp ảnh cần mở.
   * @param {Object} options Thông tin phụ thuộc vào nơi nhận tệp.
   * @param {string} options.fallbackName Tên dùng khi lưu tệp không có tên.
   * @param {string} options.decodeError Thông báo nếu trình duyệt không đọc được ảnh.
   * @param {string[]|null} [initialPalette=null] Bảng màu sẵn có nếu được chuyển tiếp.
   * @returns {void}
   */
  function loadSourceImage(file, { fallbackName, decodeError }, initialPalette = null) {
    setManualCuts(null);
    const version = ++uploadVersion.current;
    const url = URL.createObjectURL(file);
    const image = createSourceDecoder({
      file, url, version, uploadVersion, decodeError,
      setDetectingGrid, setSource, setError,
    });
    setNativeGrid(null);
    setGridError('');
    setDetectingGrid(false);
    setSource({ file, url, dimensions: null });
    setResult(null);
    setSheet(null);
    setFrameIndex(null);
    setPlaying(false);
    setZoom(null);
    setPanOffset({ x: 0, y: 0 });
    setError('');
    setShowResult(true);

    // Nếu đã có bảng màu chuyển từ bước phân tích, tái sử dụng trực tiếp 100%
    if (initialPalette && initialPalette.length > 0) {
      setPaletteColors(initialPalette);
      setActiveColor(initialPalette[0]);
    } else {
      setPaletteColors([]);
      // Tự động phân tích và nạp toàn bộ bảng màu của ảnh
      fetchPalette(file);
    }

    // Đặt lại mã định danh CSDL và bộ đệm hàng đợi (Không tự động lưu vào CSDL khi chưa có yêu cầu từ người dùng)
    spriteDbIdRef.current = null;
    pendingProcessedBlobRef.current = null;
    setSpriteDbId(null);

    image.src = url;
  }

  /**
   * Mở ảnh được chọn từ ổ cứng và đặt lại giá trị của ô chọn tệp.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} event Sự kiện chọn tệp ảnh.
   * @returns {void}
   */
  function openImage(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    loadSourceImage(file, {
      fallbackName: 'sprite_raw',
      decodeError: 'Không đọc được ảnh. Hãy chọn tệp PNG, JPEG hoặc WebP hợp lệ.',
    });
  }

  // Nạp lại ảnh, bảng màu và bộ frame khi có tệp chuyển đến từ Studio, Tạo ảnh AI hoặc Kho tài nguyên CSDL.
  useEffect(() => {
    if (!incomingFile) return;
    loadSourceImage(
      incomingFile,
      {
        fallbackName: 'sprite_transferred',
        decodeError: 'Không đọc được ảnh chuyển từ Studio hoặc Tạo ảnh AI.',
      },
      incomingPalette
    );

    // Nếu có dữ liệu trọn bộ frame cắt rời từ CSDL MySQL (lấy dữ liệu thực từ cột frame_image_data)
    if (incomingSheetData && incomingSheetData.frames && incomingSheetData.frames.length > 0) {
      const restoredCuts = savedGridCuts(incomingSheetData);
      setMode('sheet');
      setRows(incomingSheetData.rows || 3);
      setColumns(incomingSheetData.columns || 5);
      setManualCuts(restoredCuts);
      setAutoAnchor(Boolean(incomingSheetData.autoAnchor));
      setFps(incomingSheetData.fps || 6);
      setSheet({
        rows: incomingSheetData.rows || 3,
        columns: incomingSheetData.columns || 5,
        cuts: restoredCuts,
        frames: incomingSheetData.frames,
      });
      setFrameIndex(null); // Mặc định hiển thị toàn bộ Sheet gốc và thanh Timeline 15 frame ở đáy
      setOpenSections((prev) => ({ ...prev, sheetSlice: true, sheetExport: true }));
    }
  }, [incomingFile, incomingPalette, incomingSheetData]);

  /**
   * Bật/tắt trạng thái đóng mở của một khung Accordion
   *
   * @param {string} key Mã định danh của khung accordion.
   * @returns {void}
   */
  function toggleSection(key) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  /**
   * Thay đổi kích thước mục tiêu cho thao tác Thu nhỏ ảnh (Resize)
   *
   * @param {'width'|'height'} axis Trục kích thước cần thay đổi.
   * @param {string|number} value Giá trị pixel nhập vào.
   * @returns {void}
   */
  function changeResizeTarget(axis, value) {
    const num = Math.max(1, Number(value) || 1);
    const next = { ...resizeTarget, [axis]: num };
    if (keepRatio && resizeSource && Number(value) > 0) {
      const other = axis === 'width' ? 'height' : 'width';
      next[other] = Math.max(1, Math.round((Number(value) * resizeSource[other]) / resizeSource[axis]));
    }
    setResizeTarget(next);
  }

  /**
   * Thay đổi kích thước mục tiêu cho thao tác Chuẩn hóa & Điểm neo (Normalize)
   *
   * @param {'width'|'height'} axis Trục kích thước cần thay đổi.
   * @param {string|number} value Giá trị pixel nhập vào.
   * @returns {void}
   */
  function changeNormalizeTarget(axis, value) {
    const num = Math.max(1, Number(value) || 1);
    setNormalizeTarget((prev) => ({ ...prev, [axis]: num }));
  }

  /**
   * Thay đổi kích thước mục tiêu cho thao tác Ép độ phân giải frame hàng loạt (Batch Resize).
   *
   * @param {'width'|'height'} axis Trục kích thước thay đổi.
   * @param {string|number} value Giá trị pixel nhập vào.
   * @returns {void}
   */
  function changeBatchResizeTarget(axis, value) {
    const num = Math.max(1, Number(value) || 1);
    const next = { ...batchResizeTarget, [axis]: num };
    const curW = cellWidth || 64;
    const curH = cellHeight || 64;
    if (batchKeepRatio && curW > 0 && curH > 0 && Number(value) > 0) {
      const other = axis === 'width' ? 'height' : 'width';
      const ratio = axis === 'width' ? (curH / curW) : (curW / curH);
      next[other] = Math.max(1, Math.round(Number(value) * ratio));
    }
    setBatchResizeTarget(next);
  }

  /**
   * Thực thi lệnh xử lý ảnh đơn (Thu nhỏ ảnh hoặc Chuẩn hóa điểm neo)
   *
   * @param {'resize'|'normalize'} cmd Lệnh cần thực thi.
   * @param {Object} fields Tham số dữ liệu gửi lên backend.
   * @returns {Promise<void>}
   */
  async function executeSingleCommand(cmd, fields) {
    if (!source?.file || busy) return;
    const isResize = cmd === 'resize';
    setBusy(
      isResize
        ? (restoringGrid ? 'Đang khôi phục độ phân giải…' : 'Đang thu nhỏ ảnh…')
        : 'Đang chuẩn hóa ảnh…'
    );
    setError('');
    setPlaying(false);
    try {
      const file = isResize ? nativeGrid?.file || source.file : source.file;
      const response = await processImage(file, cmd, fields);
      const blob = await response.blob();
      const w = Number(fields.target_width);
      const h = Number(fields.target_height);
      const newFile = new File([blob], `${nameStem}-${cmd}.png`, { type: 'image/png' });
      setResult({
        file: newFile,
        blob,
        url: URL.createObjectURL(blob),
        width: w,
        height: h,
      });
      setShowResult(true);

      // Kết quả được lưu tạm trên RAM/Canvas để xem trước và tải về, không tự ý ghi vào CSDL MySQL
      setZoom(null);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy('');
    }
  }

  /**
   * Chọn xem một frame cụ thể trong danh sách
   */
  function selectFrame(index) {
    setPlaying(false);
    setFrameIndex(index);
    setZoom(null);
    setPanOffset({ x: 0, y: 0 });
  }

  /**
   * Phát thử hoặc tạm dừng hoạt họa của sprite sheet.
   *
   * @returns {void}
   */
  function togglePlayback() {
    if (!playing && frameIndex === null) setFrameIndex(0);
    setPlaying(!playing);
  }

  /**
   * Cập nhật thông số hàng/cột của lưới cắt
   */
  function changeGrid(setValue, value) {
    setManualCuts(null);
    setValue(value);
    setSheet(null);
    setBatchResizedSize(null);
    selectFrame(null);
    setError('');
  }

  /**
   * Đổi biên cắt và loại bỏ kết quả cũ để lần xuất kế tiếp dùng đúng lưới.
   * @param {{x: number[], y: number[]}|null} cuts Các biên theo pixel ảnh gốc.
   * @returns {void}
   */
  function changeManualCuts(cuts) {
    setManualCuts(cuts);
    setSheet(null);
    setBatchResizedSize(null);
    setBatchResizeMsg('');
    setFrameIndex(null);
    setPlaying(false);
    setError('');
  }

  /**
   * Đặt các biên đều trên toàn ảnh để bắt đầu căn chỉnh thủ công.
   * @returns {void}
   */
  function resetManualCuts() {
    if (!gridValid) return;
    changeManualCuts({
      x: createGridCuts(dimensions.width, numCols),
      y: createGridCuts(dimensions.height, numRows),
    });
  }

  /**
   * Bắt đầu kéo trượt (Pan) trên canvas hoặc khung nhìn
   *
   * @param {React.PointerEvent} event Sự kiện con trỏ chuột.
   * @returns {void}
   */
  function startPan(event) {
    if ((activeTool !== 'pan' && event.button !== 1) || !preview) return;
    if (event.button !== 0 && event.button !== 1) return;

    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: panOffset.x,
      originY: panOffset.y,
    };
    try {
      event.target.setPointerCapture(event.pointerId);
    } catch {
      // Bỏ qua nếu target không hỗ trợ capture
    }
    if (viewport.current) {
      viewport.current.classList.add('is-panning');
    }
  }

  /**
   * Di chuyển trượt (Pan) theo tọa độ kéo chuột
   *
   * @param {React.PointerEvent} event Sự kiện con trỏ chuột.
   * @returns {void}
   */
  function movePan(event) {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.startX;
    const dy = event.clientY - drag.current.startY;
    setPanOffset({
      x: Math.round(drag.current.originX + dx),
      y: Math.round(drag.current.originY + dy),
    });
  }

  /**
   * Kết thúc kéo trượt (Pan)
   *
   * @param {React.PointerEvent} [event] Sự kiện con trỏ chuột.
   * @returns {void}
   */
  function stopPan(event) {
    drag.current = null;
    if (viewport.current) {
      viewport.current.classList.remove('is-panning');
    }
    try {
      if (event?.target?.hasPointerCapture?.(event.pointerId)) {
        event.target.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Bỏ qua
    }
  }

  return (
    <div className="atelier-workspace-root" aria-label="Bàn làm việc chuẩn hóa sprite">
      {/* ================================================================ */}
      {/* 1. THANH CÔNG CỤ ĐỈNH WORKSPACE (STUDIO HEADER TOOLBAR)          */}
      {/* ================================================================ */}
      <header className="atelier-ws-header">
        <div className="atelier-ws-title-group">
          <h2 className="atelier-ws-title">
            <Sliders size={18} color="#c084fc" />
            <span>Xử lý &amp; Chuẩn hóa Sprite</span>
          </h2>
          {source && (
            <span className="atelier-ws-file-pill" title={source.file.name}>
              {source.file.name}
            </span>
          )}
        </div>

        <div className="atelier-ws-toolbar-actions">
          {/* Nút Mở Ảnh Nguồn */}
          <label className="atelier-ws-btn-upload">
            <FolderOpen size={15} />
            <span>Mở ảnh</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Mở ảnh"
              disabled={Boolean(busy)}
              onChange={openImage}
            />
          </label>

          {/* Nút bật/tắt bảng thông số thiết lập */}
          <button
            type="button"
            className={`atelier-ws-mode-btn ${showInspector ? 'active' : ''}`}
            onClick={() => setShowInspector((prev) => !prev)}
            title={showInspector ? 'Thu gọn bảng thiết lập bên phải' : 'Mở bảng thiết lập bên phải'}
          >
            <Sliders size={14} />
            <span>Thiết lập</span>
          </button>

          {/* Segmented Control Chọn Chế Độ Làm Việc */}
          <div className="atelier-ws-mode-switch" role="group" aria-label="Chế độ xử lý">
            <button
              type="button"
              className={`atelier-ws-mode-btn ${!sheetMode ? 'active' : ''}`}
              disabled={Boolean(busy)}
              onClick={() => selectMode('single')}
            >
              <ImageIcon size={14} />
              <span>Ảnh đơn</span>
            </button>
            <button
              type="button"
              className={`atelier-ws-mode-btn ${sheetMode ? 'active' : ''}`}
              disabled={Boolean(busy)}
              onClick={() => selectMode('sheet')}
            >
              <Grid2X2 size={14} />
              <span>Sprite Sheet</span>
            </button>
          </div>

          {/* Cụm Thu Phóng Canvas (Zoom Controls) */}
          <div className="atelier-ws-zoom-cluster" role="group" aria-label="Thu phóng vùng xem">
            <button
              type="button"
              className="atelier-ws-zoom-btn"
              disabled={!preview}
              onClick={() => {
                setZoom(null);
                setPanOffset({ x: 0, y: 0 });
              }}
              title="Khôi phục kích thước vừa khung nhìn"
            >
              Vừa khung
            </button>
            <button
              type="button"
              className="atelier-ws-zoom-btn"
              aria-label="Thu nhỏ vùng xem"
              disabled={!preview || activeZoom <= 0.05}
              onClick={() => setZoom(Math.max(0.05, activeZoom / 1.5))}
            >
              <Minus size={14} />
            </button>
            <span className="atelier-ws-zoom-readout">
              {preview && Number.isFinite(activeZoom) ? `${Math.round(activeZoom * 100)}%` : '100%'}
            </span>
            <button
              type="button"
              className="atelier-ws-zoom-btn"
              aria-label="Phóng to vùng xem"
              disabled={!preview || activeZoom >= 32}
              onClick={() => setZoom(Math.min(32, activeZoom * 1.5))}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* ================================================================ */}
      {/* 2. THÂN WORKSPACE: BẢNG MÀU (TRÁI), CANVAS (GIỮA) & THIẾT LẬP (PHẢI) */}
      {/* ================================================================ */}
      <div className="atelier-ws-body">
        {/* CỘT TRÁI: BẢNG MÀU SPRITE DOCK */}
        <PaletteDock
          paletteColors={paletteColors}
          activeColor={activeColor}
          onSelectActiveColor={setActiveColor}
          onAddColor={handleAddPaletteColor}
          onDeleteColor={handleDeletePaletteColor}
          isLoading={isPaletteLoading || Boolean(busy)}
          onRescanPalette={() =>
            (result?.file || source?.file) && fetchPalette(result?.file || source?.file)
          }
        />

        {/* KHU VỰC TRUNG TÂM: BÀN VẼ CANVAS TOÀN KHUNG */}
        <div className="atelier-ws-stage">
          <div
            className="atelier-ws-viewport"
            ref={viewport}
            aria-label="Bàn vẽ canvas sprite"
            onPointerDown={startPan}
            onPointerMove={movePan}
            onPointerUp={stopPan}
            onLostPointerCapture={stopPan}
          >
            {preview ? (
              sheetMode && frameIndex === null ? (
                <div
                  className="atelier-ws-canvas"
                  style={{
                    width: preview.width * activeZoom,
                    height: preview.height * activeZoom,
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                  }}
                >
                  <img
                    src={preview.url}
                    alt={frame?.name || source.file.name}
                    draggable={false}
                  />
                  {gridValid && manualCuts && (
                    <ManualSheetGrid
                      cuts={manualCuts}
                      dimensions={dimensions}
                      disabled={sheetLocked}
                      onChange={changeManualCuts}
                    />
                  )}
                  {gridValid && !manualCuts && (
                    <div
                      className="atelier-ws-grid"
                      aria-hidden="true"
                      style={{
                        left: marginX * activeZoom,
                        top: marginY * activeZoom,
                        width: cellWidth * numCols * activeZoom,
                        height: cellHeight * numRows * activeZoom,
                        gridTemplateColumns: `repeat(${columns}, 1fr)`,
                        gridTemplateRows: `repeat(${rows}, 1fr)`,
                      }}
                    >
                      {Array.from({ length: gridCount }, (_, index) => (
                        <span key={index} />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className="atelier-ws-canvas-container"
                  style={{
                    margin: 'auto',
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PixelCanvas
                    ref={pixelCanvasRef}
                    imageUrl={preview.url}
                    zoom={activeZoom}
                    activeTool={activeTool}
                    activeColor={activeColor}
                    brushSize={brushSize}
                    showPixelGrid={showPixelGrid}
                    onColorPicked={setActiveColor}
                    onImageModified={handleCanvasModified}
                    onHistoryChange={setHistoryState}
                    onPanStart={startPan}
                    onPanMove={movePan}
                    onPanEnd={stopPan}
                  />
                </div>
              )
            ) : (
              <div className="atelier-ws-empty">
                <div className="atelier-ws-empty-icon">
                  <ImageIcon size={30} />
                </div>
                <h4>Chưa có ảnh sprite nào được mở</h4>
                <p>Bấm nút "Mở ảnh" ở trên hoặc kéo thả tệp PNG, JPEG, WebP vào bàn vẽ để bắt đầu chuẩn hóa.</p>
              </div>
            )}
          </div>

          {/* Thanh trạng thái dưới Canvas */}
          <div className="atelier-ws-status-bar">
            <div className="atelier-ws-status-left">
              <span className="atelier-ws-status-pill">
                {preview ? `${preview.width} × ${preview.height} px` : 'Chưa có ảnh'}
              </span>
              {frame && (
                <span style={{ color: '#c084fc' }}>
                  Frame {frameIndex + 1} / {sheet.frames.length}
                </span>
              )}
            </div>

            <div role="status">
              {(busy || detectingGrid) && (
                <span className="atelier-ws-status-spinner">
                  <LoaderCircle size={14} className="atelier-ws-spinner-icon" />
                  <span>{busy || 'Đang dò lưới pixel tự nhiên…'}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* CỘT CẠNH CANVAS: THANH CÔNG CỤ VẼ DỌC (VERTICAL DRAWING TOOLBAR) */}
        <DrawingToolbar
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          brushSize={brushSize}
          onChangeBrushSize={setBrushSize}
          showPixelGrid={showPixelGrid}
          onTogglePixelGrid={() => setShowPixelGrid((v) => !v)}
          canUndo={historyState.canUndo}
          canRedo={historyState.canRedo}
          onUndo={() => pixelCanvasRef.current?.undo()}
          onRedo={() => pixelCanvasRef.current?.redo()}
          disabled={!preview}
        />

        {/* CỘT PHẢI: BẢNG THÔNG SỐ & THIẾT LẬP (INSPECTOR PANEL - ACCORDION CARDS) */}
        {showInspector && (
          <aside className="atelier-ws-inspector" aria-label="Bảng thông số thiết lập">
            {dimensions && (
              <div className="atelier-inspector-info-card">
                <p>Kích thước gốc: {dimensions.width} × {dimensions.height} px</p>
                {nativeGrid && (
                  <span>
                    {nativeGrid.scale > 1
                      ? `Lưới pixel nhận diện: ${nativeGrid.width} × ${nativeGrid.height} px (~${nativeGrid.scale}×)`
                      : 'Chưa phát hiện lưới phóng to. Dùng kích thước tệp.'}
                  </span>
                )}
              </div>
            )}

            {gridError && (
              <p className="atelier-ws-error">
                Không dò được lưới pixel. Dùng kích thước tệp.
              </p>
            )}

            {sheetMode ? (
              /* THIẾT LẬP CHẾ ĐỘ SPRITE SHEET */
              <SheetInspector
                MAX_FRAMES={MAX_FRAMES}
                openSections={openSections}
                toggleSection={toggleSection}
                rows={rows}
                columns={columns}
                sheetLocked={sheetLocked}
                changeGrid={changeGrid}
                setRows={setRows}
                setColumns={setColumns}
                manualCuts={manualCuts}
                gridValid={gridValid}
                resetManualCuts={resetManualCuts}
                changeManualCuts={changeManualCuts}
                frameIndex={frameIndex}
                selectFrame={selectFrame}
                autoAnchor={autoAnchor}
                setAutoAnchor={setAutoAnchor}
                gridCount={gridCount}
                cellWidth={cellWidth}
                cellHeight={cellHeight}
                remainderX={remainderX}
                remainderY={remainderY}
                dimensions={dimensions}
                busy={busy}
                executeSliceSheet={executeSliceSheet}
                sheet={sheet}
                batchResizeTarget={batchResizeTarget}
                changeBatchResizeTarget={changeBatchResizeTarget}
                batchResizing={batchResizing}
                batchKeepRatio={batchKeepRatio}
                setBatchKeepRatio={setBatchKeepRatio}
                setBatchResizeTarget={setBatchResizeTarget}
                source={source}
                executeBatchResize={executeBatchResize}
                batchResizeMsg={batchResizeMsg}
                batchResizedSize={batchResizedSize}
                setPackFolderName={setPackFolderName}
                setSavePackStatus={setSavePackStatus}
                setShowSavePackModal={setShowSavePackModal}
                frame={frame}
                exportSheet={exportSheet}
              />
            ) : (
              /* THIẾT LẬP CHẾ ĐỘ ẢNH ĐƠN (ACCORDION CARDS) */
              <SingleImageInspector
                openSections={openSections}
                toggleSection={toggleSection}
                resizeSource={resizeSource}
                resizeTarget={resizeTarget}
                changeResizeTarget={changeResizeTarget}
                busy={busy}
                detectingGrid={detectingGrid}
                keepRatio={keepRatio}
                setKeepRatio={setKeepRatio}
                setResizeTarget={setResizeTarget}
                dimensions={dimensions}
                executeSingleCommand={executeSingleCommand}
                restoringGrid={restoringGrid}
                anchor={anchor}
                setAnchor={setAnchor}
                normalizeTarget={normalizeTarget}
                changeNormalizeTarget={changeNormalizeTarget}
                result={result}
                showResult={showResult}
                setShowResult={setShowResult}
                setZoom={setZoom}
                setPanOffset={setPanOffset}
                nameStem={nameStem}
              />
            )}

            {error && <p className="atelier-ws-error" role="alert">{error}</p>}
          </aside>
        )}
      </div>

      {/* ================================================================ */}
      {/* 3. DẢI TIMELINE PHÁT HOẠT HỌA (ANIMATION TIMELINE REEL)          */}
      {/* ================================================================ */}
      {sheetMode && sheet && (
        <WorkspaceTimeline
          sheet={sheet}
          frameIndex={frameIndex}
          playing={playing}
          fps={fps}
          busy={busy}
          onTogglePlayback={togglePlayback}
          onFpsChange={setFps}
          onSelectFrame={selectFrame}
        />
      )}

      {/* ================================================================ */}
      {/* 4. MODAL LƯU BỘ FRAME & SHEET VÀO THƯ MỤC KHO TÀI NGUYÊN        */}
      {/* ================================================================ */}
      {showSavePackModal && (
        <SaveSheetPackDialog
                setShowSavePackModal={setShowSavePackModal}
                packFolderName={packFolderName}
                setPackFolderName={setPackFolderName}
                source={source}
                sheet={sheet}
                fps={fps}
                batchResizedSize={batchResizedSize}
                cellWidth={cellWidth}
                cellHeight={cellHeight}
                savePackStatus={savePackStatus}
                savingPack={savingPack}
                handleConfirmSavePack={handleConfirmSavePack}
              />
      )}
    </div>
  );
}
