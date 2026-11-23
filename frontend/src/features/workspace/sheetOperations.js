// 1. THƯ VIỆN NỀN TẢNG (React / JavaScript)
// Không cần thư viện nền tảng.

// 2. THƯ VIỆN BÊN NGOÀI
// Không có phụ thuộc bên ngoài.

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// API xử lý và lưu sheet cùng mã hóa lưới thủ công.
import { processImage, batchResizeSheetFrames, saveSlicedPackToVault } from './workspaceApi';
import { gridRequestFields } from './sheetGrid';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH
// Kế thừa giao diện Workspace hiện có.

/**
 * Tạo các lệnh xử lý sheet từ trạng thái của lần render hiện tại.
 * @param {Object} state Dữ liệu, thông số và callback cập nhật bàn làm việc.
 * @returns {Object} Các lệnh cắt, ép kích thước, xuất ZIP và lưu kho.
 */
export function createSheetOperations({
  source,
  sheet,
  batchResizing,
  setBatchResizing,
  setBatchResizeMsg,
  setError,
  batchResizeTarget,
  autoAnchor,
  setSheet,
  setBatchResizedSize,
  dimensions,
  busy,
  gridValid,
  setBusy,
  setPlaying,
  rows,
  columns,
  manualCuts,
  setFrameIndex,
  setZoom,
  batchResizedSize,
  nameStem,
  currentProject,
  setSavePackStatus,
  setSavingPack,
  packFolderName,
  fps,
  setShowSavePackModal
}) {
  /**
   * Thực thi ép toàn bộ các khung hình trong Sprite Sheet về độ phân giải yêu cầu.
   */
  async function executeBatchResize() {
    if (!source?.file || !sheet || batchResizing) return;
    setBatchResizing(true);
    setBatchResizeMsg('');
    setError('');
    try {
      const res = await batchResizeSheetFrames({
        file: source.file,
        rows: sheet.rows,
        columns: sheet.columns,
        targetWidth: batchResizeTarget.width,
        targetHeight: batchResizeTarget.height,
        autoAnchor: autoAnchor,
        cuts: sheet.cuts || null,
      });

      if (res?.frames && res.frames.length > 0) {
        setSheet({
          ...sheet,
          rows: sheet.rows,
          columns: sheet.columns,
          frames: res.frames.map((f, idx) => ({
            ...f,
            index: idx + 1,
            url: `data:image/png;base64,${f.png}`,
            width: res.target_width,
            height: res.target_height,
          })),
        });
        setBatchResizedSize({ width: res.target_width, height: res.target_height });
        setBatchResizeMsg(`Đã ép thành công ${res.frame_count} frame về kích thước ${res.target_width}×${res.target_height} px!`);
        setTimeout(() => setBatchResizeMsg(''), 4000);
      }
    } catch (err) {
      setError(err.message || 'Lỗi khi ép độ phân giải toàn bộ frame.');
    } finally {
      setBatchResizing(false);
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
        ...gridRequestFields(manualCuts),
      });
      const { frames } = await response.json();
      setSheet({
        rows,
        columns,
        cuts: manualCuts,
        frames: frames.map(({ png, ...details }) => ({
          ...details,
          url: `data:image/png;base64,${png}`,
        })),
      });
      setBatchResizedSize(null);
      setFrameIndex(0);
      setZoom(null);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy('');
    }
  }


  /**
   * Xuất toàn bộ các frame đã cắt thành file ZIP.
   * Tự động áp dụng kích thước đã ép (Nearest Neighbor) nếu người dùng đã thực hiện ép hàng loạt.
   */
  async function exportSheet() {
    if (!sheet || busy) return;
    setBusy('Đang tạo ZIP…');
    setError('');
    try {
      const extraFields = {
        rows: sheet.rows,
        columns: sheet.columns,
        output: 'zip',
        auto_anchor: autoAnchor,
        ...gridRequestFields(sheet.cuts),
      };
      if (batchResizedSize?.width && batchResizedSize?.height) {
        extraFields.target_width = batchResizedSize.width;
        extraFields.target_height = batchResizedSize.height;
      }
      const response = await processImage(source.file, 'slice-sheet', extraFields);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      const sizeTag = batchResizedSize ? `_${batchResizedSize.width}x${batchResizedSize.height}` : '';
      link.download = `${nameStem}-frames${sizeTag}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy('');
    }
  }


  /**
   * Lưu trọn gói Sprite Sheet và toàn bộ các frame cắt rời vào một Thư mục trong Kho tài nguyên MySQL.
   * Hỗ trợ lưu bộ frame đã ép kích thước (Nearest Neighbor) nếu người dùng đã thực hiện ép hàng loạt.
   */
  async function handleConfirmSavePack() {
    if (!currentProject?.id) {
      setSavePackStatus({ success: false, message: 'Vui lòng chọn hoặc mở một dự án trước khi lưu.' });
      return;
    }
    if (!source?.file || !sheet) return;

    setSavingPack(true);
    setSavePackStatus({ success: false, message: '' });

    try {
      const res = await saveSlicedPackToVault({
        file: source.file,
        projectId: currentProject.id,
        folderName: packFolderName.trim() || 'Mặc định',
        rows: sheet.rows,
        columns: sheet.columns,
        autoAnchor: autoAnchor,
        fps: fps || 6,
        targetWidth: batchResizedSize?.width || null,
        targetHeight: batchResizedSize?.height || null,
        cuts: sheet.cuts || null,
      });

      setSavePackStatus({
        success: true,
        message: `Đã lưu thành công ${res.frame_count} frame (${batchResizedSize ? 'đã ép ' + batchResizedSize.width + '×' + batchResizedSize.height + ' px' : 'kích thước gốc'}) vào thư mục "${res.folder_name}"!`
      });
      setTimeout(() => {
        setShowSavePackModal(false);
      }, 1600);
    } catch (err) {
      setSavePackStatus({ success: false, message: err.message || 'Lỗi khi lưu bộ frame.' });
    } finally {
      setSavingPack(false);
    }
  }

  return { executeBatchResize, executeSliceSheet, exportSheet, handleConfirmSavePack };
}
