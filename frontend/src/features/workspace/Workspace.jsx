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
  Download,
  FolderOpen,
  Grid2X2,
  Image as ImageIcon,
  LoaderCircle,
  Minus,
  Plus,
  Sliders,
  Sparkles,
  Layers,
  ZoomIn,
  CheckCircle2,
  AlertCircle,
  Scaling,
  Anchor,
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Dữ liệu)
// ========================================================
// Dải khung hình và các điều khiển phát thử sprite sheet.
import WorkspaceTimeline from './WorkspaceTimeline';
// Cột bảng màu Sprite Studio (Swatches Grid & Global Swap).
import PaletteDock from './components/PaletteDock';
// Thanh công cụ vẽ pixel art (Pencil, Bucket, Pipette, Eraser).
import DrawingToolbar from './components/DrawingToolbar';
// Bàn vẽ tương tác Pixel Canvas (Interactive Drawing Canvas).
import PixelCanvas from './components/PixelCanvas';
// Khung thẻ gập mở Accordion cho các công cụ thiết lập.
import CollapsibleCard from './components/CollapsibleCard';
// Các yêu cầu xử lý và lưu ảnh của bàn làm việc.
import {
  processImage,
  saveProcessedSprite,
  saveRawSprite,
  analyzeSpriteColors,
} from './workspaceApi';

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
 * @returns {React.ReactElement} Giao diện bàn làm việc chuẩn hóa sprite.
 */
export default function Workspace({ currentProject, incomingFile = null, incomingPalette = null }) {
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
    sheetExport: true,
  });
  // Số hàng và số cột khi cắt Sprite Sheet
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(5);
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

  // Tham chiếu DOM đến vùng xem và tọa độ kéo chuột
  const viewport = useRef(null);
  const drag = useRef(null);
  const uploadVersion = useRef(0);

  // Danh sách các mã màu HEX của bảng màu sprite
  const [paletteColors, setPaletteColors] = useState([]);
  // Mã màu Foreground đang được chọn để vẽ
  const [activeColor, setActiveColor] = useState('#ffffff');
  // Công cụ vẽ đang kích hoạt ('pencil' | 'bucket' | 'eyedropper' | 'eraser' | 'pan')
  const [activeTool, setActiveTool] = useState('pencil');
  // Kích thước đầu bút vẽ (1, 2, 3 px)
  const [brushSize, setBrushSize] = useState(1);
  // Trạng thái bật/tắt hiển thị lưới ô pixel khi zoom lớn
  const [showPixelGrid, setShowPixelGrid] = useState(true);
  // Trạng thái khả dụng của hoàn tác (Undo) và làm lại (Redo)
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });
  // Trạng thái đang quét trích xuất bảng màu
  const [isPaletteLoading, setIsPaletteLoading] = useState(false);
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
  const cellWidth = dimensions ? Math.floor(dimensions.width / numCols) : 0;
  const cellHeight = dimensions ? Math.floor(dimensions.height / numRows) : 0;
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
  const fitZoom = preview
    ? Math.max(
        0.01,
        Math.min((viewportSize.width - 32) / preview.width, (viewportSize.height - 32) / preview.height, 16)
      )
    : 1;
  const activeZoom = zoom ?? fitZoom;
  const nameStem = source?.file.name.replace(/\.[^.]+$/, '') || 'sprite';

  // Lắng nghe thay đổi kích thước khung nhìn để tính toán zoom vừa vặn
  useEffect(() => {
    if (!viewport.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewportSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);

  // Thu hồi bộ nhớ URL Blob khi ảnh bị thay đổi hoặc hủy
  const sourceUrl = source?.url;
  const resultUrl = result?.url;
  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => () => { if (resultUrl) URL.revokeObjectURL(resultUrl); }, [resultUrl]);

  // Tự động dò độ phân giải lưới pixel khi nạp ảnh nguồn
  useEffect(() => {
    if (!dimensions || !sourceFile) return;
    const controller = new AbortController();
    setDetectingGrid(true);
    async function detectGrid() {
      try {
        const response = await processImage(sourceFile, 'detect-resolution', {}, controller.signal);
        const { png, width, height, scale } = await response.json();
        if (controller.signal.aborted) return;
        const file = png
          ? new File([Uint8Array.from(atob(png), (char) => char.charCodeAt(0))], 'native.png', { type: 'image/png' })
          : sourceFile;
        setNativeGrid({ width, height, scale, file });
      } catch (failure) {
        if (!controller.signal.aborted) setGridError(failure.message);
      } finally {
        setDetectingGrid(false);
      }
    }
    detectGrid();
    return () => controller.abort();
  }, [dimensions, sourceFile]);

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
   * Trích xuất bảng màu đầy đủ từ ảnh sprite qua backend
   *
   * @param {File|Blob} file Tệp ảnh sprite cần phân tích.
   * @returns {Promise<void>}
   */
  async function fetchPalette(file) {
    if (!file) return;
    try {
      setIsPaletteLoading(true);
      const data = await analyzeSpriteColors(file);
      const pal =
        data?.palette_metrics?.libresprite_palette ||
        data?.pixel_art_report?.palette?.libresprite_palette ||
        data?.pixel_art_report?.palette?.colors?.map((c) => c.hex) ||
        [];
      if (pal.length > 0) {
        setPaletteColors(pal);
        setActiveColor(pal[0]);
      }
    } catch (err) {
      console.warn('Không trích xuất được bảng màu tự động:', err);
    } finally {
      setIsPaletteLoading(false);
    }
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
    const version = ++uploadVersion.current;
    const url = URL.createObjectURL(file);
    const image = new Image();
    setNativeGrid(null);
    setGridError('');
    setDetectingGrid(false);
    setSource({ file, url, dimensions: null });
    setResult(null);
    setSheet(null);
    setFrameIndex(null);
    setPlaying(false);
    setZoom(null);
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

    // Đặt lại mã định danh CSDL và bộ đệm hàng đợi
    spriteDbIdRef.current = null;
    pendingProcessedBlobRef.current = null;
    setSpriteDbId(null);

    // Tự động lưu ảnh nguồn vào CSDL MySQL.
    if (currentProject?.id) {
      saveRawSprite(file, currentProject.id, fallbackName, (savedId) => {
        setSpriteDbId(savedId);
        spriteDbIdRef.current = savedId;
        // Nếu ảnh đã được xử lý xong trong khi đang chờ lưu raw, lưu ảnh xử lý ngay lập tức
        if (pendingProcessedBlobRef.current) {
          saveProcessedSprite(pendingProcessedBlobRef.current, currentProject.id, savedId);
          pendingProcessedBlobRef.current = null;
        }
      });
    }

    image.onload = () => {
      if (version !== uploadVersion.current) return;
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      setDetectingGrid(true);
      setSource({ file, url, dimensions: { width, height, url } });
    };
    image.onerror = () => {
      if (version === uploadVersion.current) {
        setError(decodeError);
      }
    };
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

  // Nạp lại ảnh và bảng màu khi có tệp chuyển đến từ Studio hoặc Tạo ảnh AI.
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
  }, [incomingFile, incomingPalette]);

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

      // Lưu ảnh đã chuẩn hóa vào MySQL
      if (currentProject?.id) {
        const activeDbId = spriteDbIdRef.current || spriteDbId;
        if (activeDbId) {
          saveProcessedSprite(blob, currentProject.id, activeDbId);
        } else {
          pendingProcessedBlobRef.current = blob;
        }
      }
      setZoom(null);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy('');
    }
  }

  /**
   * Thực thi bóc tách lưới Sprite Sheet thành danh sách các frame hoạt họa
   *
   * @param {React.FormEvent} [event] Sự kiện gửi form.
   * @returns {Promise<void>}
   */
  async function executeSliceSheet(event) {
    event?.preventDefault();
    if (!dimensions || busy || !gridValid) return;
    setBusy('Đang cắt frame…');
    setError('');
    setPlaying(false);
    try {
      const response = await processImage(source.file, 'slice-sheet', {
        rows,
        columns,
        auto_anchor: autoAnchor,
      });
      const { frames } = await response.json();
      setSheet({
        rows,
        columns,
        frames: frames.map(({ png, ...details }) => ({
          ...details,
          url: `data:image/png;base64,${png}`,
        })),
      });
      setFrameIndex(0);
      setZoom(null);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy('');
    }
  }

  /**
   * Xuất toàn bộ các frame đã cắt thành file ZIP
   */
  async function exportSheet() {
    if (!sheet || busy) return;
    setBusy('Đang tạo ZIP…');
    setError('');
    try {
      const response = await processImage(source.file, 'slice-sheet', {
        rows: sheet.rows,
        columns: sheet.columns,
        output: 'zip',
        auto_anchor: autoAnchor,
      });
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `${nameStem}-frames.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    setValue(value);
    setSheet(null);
    selectFrame(null);
    setError('');
  }

  /**
   * Bắt đầu kéo trượt (Pan) trên canvas
   */
  function startPan(event) {
    if (event.button !== 0 || !preview) return;
    const node = event.currentTarget;
    drag.current = { x: event.clientX + node.scrollLeft, y: event.clientY + node.scrollTop };
    node.setPointerCapture(event.pointerId);
    node.classList.add('is-panning');
  }

  /**
   * Di chuyển trượt (Pan)
   */
  function movePan(event) {
    if (!drag.current) return;
    event.currentTarget.scrollLeft = drag.current.x - event.clientX;
    event.currentTarget.scrollTop = drag.current.y - event.clientY;
  }

  /**
   * Kết thúc kéo trượt
   */
  function stopPan(event) {
    drag.current = null;
    event.currentTarget.classList.remove('is-panning');
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
              onClick={() => setZoom(null)}
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
              {preview ? `${Math.round(activeZoom * 100)}%` : '—'}
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
            onPointerDown={activeTool === 'pan' ? startPan : undefined}
            onPointerMove={activeTool === 'pan' ? movePan : undefined}
            onPointerUp={activeTool === 'pan' ? stopPan : undefined}
            onLostPointerCapture={activeTool === 'pan' ? stopPan : undefined}
          >
            {preview ? (
              sheetMode && frameIndex === null ? (
                <div
                  className="atelier-ws-canvas"
                  style={{
                    width: preview.width * activeZoom,
                    height: preview.height * activeZoom,
                  }}
                >
                  <img
                    src={preview.url}
                    alt={frame?.name || source.file.name}
                    draggable={false}
                  />
                  {gridValid && (
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
              <>
                <h3 className="atelier-inspector-section-title">
                  <Grid2X2 size={16} />
                  <span>Sprite Sheet Studio</span>
                </h3>

                {/* Khung 1: Cắt lưới Sprite Sheet */}
                <CollapsibleCard
                  title="Cắt lưới Sprite Sheet"
                  icon={Grid2X2}
                  isOpen={openSections.sheetSlice}
                  onToggle={() => toggleSection('sheetSlice')}
                >
                  <div className="atelier-inspector-grid-inputs">
                    <div className="atelier-inspector-field">
                      <label className="atelier-inspector-label">Số hàng</label>
                      <input
                        type="number"
                        min="1"
                        max={MAX_FRAMES}
                        required
                        value={rows}
                        disabled={Boolean(busy)}
                        className="atelier-inspector-input"
                        onChange={(event) => changeGrid(setRows, event.target.value)}
                      />
                    </div>
                    <div className="atelier-inspector-field">
                      <label className="atelier-inspector-label">Số cột</label>
                      <input
                        type="number"
                        min="1"
                        max={MAX_FRAMES}
                        required
                        value={columns}
                        disabled={Boolean(busy)}
                        className="atelier-inspector-input"
                        onChange={(event) => changeGrid(setColumns, event.target.value)}
                      />
                    </div>
                  </div>

                  <label className="atelier-inspector-checkbox">
                    <input
                      type="checkbox"
                      checked={autoAnchor}
                      onChange={(e) => setAutoAnchor(e.target.checked)}
                      disabled={Boolean(busy)}
                    />
                    <span>Căn tâm &amp; neo chân (Bottom-Center)</span>
                  </label>

                  {gridValid && (
                    <div className="atelier-inspector-info-card" style={{ margin: '2px 0' }}>
                      <p>{gridCount} frame · {cellWidth} × {cellHeight} px mỗi ô</p>
                      {(remainderX > 0 || remainderY > 0) && (
                        <span>
                          ✓ Tự động căn giữa lưới (bỏ {remainderX}px viền ngang, {remainderY}px viền dọc).
                        </span>
                      )}
                    </div>
                  )}

                  {dimensions && !gridValid && (
                    <p className="atelier-ws-error">
                      Dùng lưới tối đa {MAX_FRAMES} ô. Kích thước ảnh phải đủ lớn cho số hàng và số cột.
                    </p>
                  )}

                  <button
                    className="atelier-btn-primary-action"
                    type="button"
                    disabled={!gridValid || Boolean(busy)}
                    onClick={executeSliceSheet}
                  >
                    {busy === 'Đang cắt frame…' ? (
                      <>
                        <LoaderCircle size={15} className="atelier-ws-spinner-icon" />
                        <span>Đang cắt frame…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={15} />
                        <span>Cắt frame hoạt họa</span>
                      </>
                    )}
                  </button>
                </CollapsibleCard>

                {/* Khung 2: Xuất tài nguyên (Export & Download) */}
                {sheet && (
                  <CollapsibleCard
                    title="Xuất tài nguyên (Export)"
                    icon={Download}
                    isOpen={openSections.sheetExport}
                    onToggle={() => toggleSection('sheetExport')}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button
                        className="atelier-btn-secondary-action"
                        type="button"
                        onClick={() => selectFrame(null)}
                      >
                        Xem sheet gốc
                      </button>

                      {frame && (
                        <a
                          className="atelier-btn-secondary-action"
                          href={frame.url}
                          download={frame.name}
                        >
                          <Download size={14} />
                          <span>Tải frame PNG</span>
                        </a>
                      )}

                      <button
                        className="atelier-btn-secondary-action"
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={exportSheet}
                      >
                        <Download size={14} />
                        <span>{busy === 'Đang tạo ZIP…' ? busy : 'Tải tất cả (ZIP)'}</span>
                      </button>
                    </div>
                  </CollapsibleCard>
                )}
              </>
            ) : (
              /* THIẾT LẬP CHẾ ĐỘ ẢNH ĐƠN (ACCORDION CARDS) */
              <>
                <h3 className="atelier-inspector-section-title">
                  <Sliders size={16} />
                  <span>Thao tác ảnh đơn</span>
                </h3>

                {/* Khung 1: Thu nhỏ ảnh (Resize) */}
                <CollapsibleCard
                  title="Thu nhỏ ảnh (Resize)"
                  icon={Scaling}
                  isOpen={openSections.resize}
                  onToggle={() => toggleSection('resize')}
                >
                  <div className="atelier-inspector-grid-inputs">
                    <div className="atelier-inspector-field">
                      <label className="atelier-inspector-label">Rộng (px)</label>
                      <input
                        type="number"
                        min="1"
                        max={resizeSource?.width || 512}
                        required
                        value={resizeTarget.width}
                        onChange={(event) => changeResizeTarget('width', event.target.value)}
                        disabled={Boolean(busy) || detectingGrid}
                        className="atelier-inspector-input"
                      />
                    </div>
                    <div className="atelier-inspector-field">
                      <label className="atelier-inspector-label">Cao (px)</label>
                      <input
                        type="number"
                        min="1"
                        max={resizeSource?.height || 512}
                        required
                        value={resizeTarget.height}
                        onChange={(event) => changeResizeTarget('height', event.target.value)}
                        disabled={Boolean(busy) || detectingGrid}
                        className="atelier-inspector-input"
                      />
                    </div>
                  </div>

                  <label className="atelier-inspector-checkbox">
                    <input
                      type="checkbox"
                      checked={keepRatio}
                      onChange={(event) => {
                        setKeepRatio(event.target.checked);
                        if (event.target.checked && resizeSource && Number(resizeTarget.width) > 0) {
                          setResizeTarget({
                            ...resizeTarget,
                            height: Math.max(1, Math.round((resizeTarget.width * resizeSource.height) / resizeSource.width)),
                          });
                        }
                      }}
                      disabled={Boolean(busy) || detectingGrid}
                    />
                    <span>Khóa tỷ lệ khung hình</span>
                  </label>

                  <button
                    className="atelier-btn-primary-action"
                    type="button"
                    disabled={!dimensions || Boolean(busy) || detectingGrid}
                    onClick={() =>
                      executeSingleCommand('resize', {
                        target_width: resizeTarget.width,
                        target_height: resizeTarget.height,
                      })
                    }
                  >
                    {busy === 'Đang thu nhỏ ảnh…' || busy === 'Đang khôi phục độ phân giải…' ? (
                      <>
                        <LoaderCircle size={15} className="atelier-ws-spinner-icon" />
                        <span>{busy}</span>
                      </>
                    ) : (
                      <>
                        <Scaling size={15} />
                        <span>{restoringGrid ? 'Khôi phục độ phân giải thật' : 'Thu nhỏ ảnh'}</span>
                      </>
                    )}
                  </button>
                </CollapsibleCard>

                {/* Khung 2: Chuẩn hóa & Điểm neo (Anchor / Normalize) */}
                <CollapsibleCard
                  title="Chuẩn hóa & Điểm neo"
                  icon={Anchor}
                  isOpen={openSections.anchor}
                  onToggle={() => toggleSection('anchor')}
                >
                  <div className="atelier-inspector-field">
                    <label className="atelier-inspector-label">Điểm neo (Anchor)</label>
                    <select
                      value={anchor}
                      onChange={(event) => setAnchor(event.target.value)}
                      disabled={Boolean(busy)}
                      className="atelier-inspector-select"
                    >
                      <option value="bottom_center">Dưới và giữa (Bottom-Center: Chuẩn game)</option>
                      <option value="center">Chính giữa (Center)</option>
                      <option value="top_left">Góc trên bên trái (Top-Left)</option>
                    </select>
                  </div>

                  <div className="atelier-inspector-grid-inputs">
                    <div className="atelier-inspector-field">
                      <label className="atelier-inspector-label">Rộng (px)</label>
                      <input
                        type="number"
                        min="1"
                        max={512}
                        required
                        value={normalizeTarget.width}
                        onChange={(event) => changeNormalizeTarget('width', event.target.value)}
                        disabled={Boolean(busy)}
                        className="atelier-inspector-input"
                      />
                    </div>
                    <div className="atelier-inspector-field">
                      <label className="atelier-inspector-label">Cao (px)</label>
                      <input
                        type="number"
                        min="1"
                        max={512}
                        required
                        value={normalizeTarget.height}
                        onChange={(event) => changeNormalizeTarget('height', event.target.value)}
                        disabled={Boolean(busy)}
                        className="atelier-inspector-input"
                      />
                    </div>
                  </div>

                  <button
                    className="atelier-btn-primary-action"
                    type="button"
                    disabled={!dimensions || Boolean(busy)}
                    onClick={() =>
                      executeSingleCommand('normalize', {
                        target_width: normalizeTarget.width,
                        target_height: normalizeTarget.height,
                        anchor,
                      })
                    }
                  >
                    {busy === 'Đang chuẩn hóa ảnh…' ? (
                      <>
                        <LoaderCircle size={15} className="atelier-ws-spinner-icon" />
                        <span>Đang chuẩn hóa…</span>
                      </>
                    ) : (
                      <>
                        <Anchor size={15} />
                        <span>Chuẩn hóa khung &amp; điểm neo</span>
                      </>
                    )}
                  </button>
                </CollapsibleCard>

                {/* Khung 3: Kết quả xử lý & Tải về (chỉ hiện khi có kết quả) */}
                {result && (
                  <CollapsibleCard
                    title="Kết quả xử lý"
                    icon={Sparkles}
                    isOpen={openSections.result}
                    onToggle={() => toggleSection('result')}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div
                        className="atelier-ws-mode-switch"
                        role="group"
                        aria-label="So sánh ảnh"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                      >
                        <button
                          type="button"
                          style={{ flex: 1 }}
                          className={`atelier-ws-mode-btn ${!showResult ? 'active' : ''}`}
                          onClick={() => {
                            setShowResult(false);
                            setZoom(null);
                          }}
                        >
                          Ảnh gốc
                        </button>
                        <button
                          type="button"
                          style={{ flex: 1 }}
                          className={`atelier-ws-mode-btn ${showResult ? 'active' : ''}`}
                          onClick={() => {
                            setShowResult(true);
                            setZoom(null);
                          }}
                        >
                          Kết quả
                        </button>
                      </div>

                      <a
                        className="atelier-btn-secondary-action"
                        href={result.url}
                        download={`${nameStem}-processed.png`}
                      >
                        <Download size={14} />
                        <span>Tải ảnh PNG</span>
                      </a>
                    </div>
                  </CollapsibleCard>
                )}
              </>
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
    </div>
  );
}
