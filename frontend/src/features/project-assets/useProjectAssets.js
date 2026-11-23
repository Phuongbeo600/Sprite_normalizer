// 1. THƯ VIỆN NỀN TẢNG (Quản lý phiên làm việc React)
import { useState, useEffect, useRef, useCallback } from "react";

// 2. THƯ VIỆN BÊN NGOÀI (Không sử dụng)

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Dữ liệu và yêu cầu của tính năng)
import { fetchAssetList, presetCollectionUrl, requestPresetDetail, requestSpriteFrames, fetchSpriteFile, requestDeleteSprite, requestDeletePreset, requestDeleteCharacter, requestDeleteMap, fetchAssetMap } from './assetRequests';
import { spriteImageUrl } from './assetRequests';
import { buildWorkspaceSheetPayload } from './assetMetadata';

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Không sử dụng)

/** Sở hữu trạng thái và thao tác của phiên; giữ nguyên thứ tự hiệu ứng hiện tại. */
export function useProjectAssets({ currentProject, isActive, onLoadPresetToStudio, onLoadSpriteToWorkspace, onDeployCharactersToGodot, onTransferToGodot, onSelectTab }) {
  // ========================================================
  // TRẠNG THÁI DỮ LIỆU TỪ MYSQL
  // ========================================================
  const [presets, setPresets] = useState([]);
  const [sprites, setSprites] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [mapData, setMapData] = useState(null);

  // Danh sách ID các nhân vật được tích chọn để đưa vào phòng thử nghiệm Godot
  const [selectedCharIds, setSelectedCharIds] = useState(new Set());

  // Tự động tích chọn tất cả nhân vật khi danh sách characters tải xong
  useEffect(() => {
    if (characters && characters.length > 0) {
      setSelectedCharIds(new Set(characters.map((c) => c.id)));
    } else {
      setSelectedCharIds(new Set());
    }
  }, [characters]);

  /**
   * Đưa danh sách các nhân vật đã tích chọn sang phòng thử nghiệm Godot.
   */
  const handleDeploySelectedToGodot = () => {
    if (selectedCharIds.size === 0) return;
    if (onDeployCharactersToGodot) {
      onDeployCharactersToGodot(Array.from(selectedCharIds));
    } else if (onSelectTab) {
      onSelectTab('godot_testbed');
    }
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ========================================================
  // TRẠNG THÁI MODAL CHI TIẾT
  // ========================================================
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [selectedSprite, setSelectedSprite] = useState(null);
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [selectedMap, setSelectedMap] = useState(null);

  const [copiedPos, setCopiedPos] = useState(false);
  const [copiedNeg, setCopiedNeg] = useState(false);

  // ========================================================
  // TẢI TOÀN BỘ TÀI NGUYÊN TỪ CƠ SỞ DỮ LIỆU MYSQL
  // ========================================================
  const fetchAllAssets = useCallback(async () => {
    if (!currentProject?.id) return;
    setLoading(true);
    setError('');

    const projectId = currentProject.id;

    try {
      // 1. Lấy danh sách Preset & Prompt AI
      const pPromise = fetchAssetList(presetCollectionUrl(projectId), 'data');

      // 2. Lấy danh sách Ảnh Sprite & Sheet
      const sPromise = fetchAssetList(`/api/sprites?project_id=${projectId}`, 'sprites');

      // 3. Lấy danh sách Nhân vật Godot
      const cPromise = fetchAssetList(`/api/testbed/characters?project_id=${projectId}`, 'characters');

      // 4. Lấy thông tin Bản đồ nền
      const mPromise = fetchAssetMap(projectId);

      const [pRes, sRes, cRes, mRes] = await Promise.all([pPromise, sPromise, cPromise, mPromise]);

      setPresets(pRes);
      setSprites(sRes);
      setCharacters(cRes);
      setMapData(mRes);
    } catch (err) {
      setError(err.message || 'Lỗi khi đồng bộ tài nguyên từ MySQL.');
    } finally {
      setLoading(false);
    }
  }, [currentProject?.id]);

  // Tự động tải lại dữ liệu mới nhất từ MySQL khi màn hình tải lần đầu hoặc khi người dùng chuyển sang tab này
  const previousProjectId = useRef();
  useEffect(() => {
    const projectId = currentProject?.id;
    if (isActive || previousProjectId.current !== projectId) {
      fetchAllAssets();
    }
    previousProjectId.current = projectId;
  }, [isActive, fetchAllAssets]);

  // ========================================================
  // CÁC THAO TÁC XỬ LÝ (ACTION HANDLERS)
  // ========================================================

  /**
   * Tải ảnh sprite từ backend và chuyển vào Workspace để tiếp tục xử lý.
   * @param {Object} sprite Bản ghi sprite
   */
  const handleOpenInWorkspace = async (sprite) => {
    if (!onLoadSpriteToWorkspace) return;
    try {
      const file = await fetchSpriteFile(currentProject.id, sprite, 'sprite.png');

      // Nếu sprite này có các frame con cắt rời trong CSDL MySQL, tải kèm trọn bộ frame
      let sheetPayload = null;
      if (sprite.frame_count > 0 || sprite.is_sheet) {
        try {
          const framesRes = await requestSpriteFrames(sprite.id);
          if (framesRes.ok) {
            const framesData = await framesRes.json();
            if (framesData?.frames && framesData.frames.length > 0) {
              sheetPayload = buildWorkspaceSheetPayload(sprite, framesData.frames);
            }
          }
        } catch (fetchFramesErr) {
          console.warn('Không thể kéo danh sách frame con từ CSDL:', fetchFramesErr);
        }
      }

      onLoadSpriteToWorkspace(file, null, sheetPayload);
    } catch (err) {
      alert('Lỗi nạp ảnh vào Workspace: ' + err.message);
    }
  };

  /**
   * Tải ảnh sprite từ backend và chuyển thẳng vào phòng Thử nghiệm Godot.
   * @param {Object} sprite Bản ghi sprite
   */
  const handleOpenInGodot = async (sprite) => {
    if (!onTransferToGodot) {
      if (onSelectTab) onSelectTab('godot_testbed');
      return;
    }
    try {
      const file = await fetchSpriteFile(currentProject.id, sprite, 'character_sheet.png');
      onTransferToGodot(file);
    } catch (err) {
      alert('Lỗi nạp ảnh vào Godot Testbed: ' + err.message);
    }
  };

  /**
   * Tải tệp ảnh PNG về máy tính người dùng.
   * @param {Object} sprite Bản ghi sprite
   * @param {boolean} isProcessed Cờ tải ảnh đã qua xử lý
   */
  const handleDownloadSprite = (sprite, isProcessed = false) => {
    const url = spriteImageUrl(currentProject.id, sprite.id, isProcessed && sprite.has_processed);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sprite.name || 'sprite'}${isProcessed ? '_processed' : '_raw'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  /**
   * Xóa một bức ảnh sprite khỏi MySQL.
   * @param {number} spriteId Mã ảnh
   * @param {string} spriteName Tên ảnh
   */
  const handleDeleteSprite = async (spriteId, spriteName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa ảnh "${spriteName}" khỏi cơ sở dữ liệu không?`)) {
      return;
    }
    try {
      const res = await requestDeleteSprite(currentProject.id, spriteId);
      if (!res.ok) throw new Error('Lỗi khi xóa ảnh');
      setSprites((prev) => prev.filter((s) => s.id !== spriteId));
      if (selectedSprite?.id === spriteId) setSelectedSprite(null);
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa ảnh khỏi MySQL.');
    }
  };

  /**
   * Xóa một bản ghi preset khỏi MySQL.
   * @param {number} presetId Mã preset
   * @param {string} presetName Tên preset
   */
  const handleDeletePreset = async (presetId, presetName) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bản ghi "${presetName}" không?`)) {
      return;
    }
    try {
      const res = await requestDeletePreset(currentProject.id, presetId);
      if (!res.ok) throw new Error('Không thể xóa bản ghi khỏi cơ sở dữ liệu.');
      setPresets((prev) => prev.filter((p) => p.id !== presetId));
      if (selectedPreset?.id === presetId) setSelectedPreset(null);
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa bản ghi.');
    }
  };

  /**
   * Xóa nhân vật Godot khỏi MySQL.
   * @param {number} charId Mã nhân vật
   * @param {string} charName Tên nhân vật
   */
  const handleDeleteCharacter = async (charId, charName) => {
    if (!window.confirm(`Bạn có chắc muốn xóa nhân vật "${charName}" khỏi phòng thử nghiệm không?`)) {
      return;
    }
    try {
      const res = await requestDeleteCharacter(currentProject.id, charId);
      if (!res.ok) throw new Error('Lỗi khi xóa nhân vật');
      setCharacters((prev) => prev.filter((c) => c.id !== charId));
      if (selectedCharacter?.id === charId) setSelectedCharacter(null);
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa nhân vật.');
    }
  };

  /**
   * Xóa bản đồ nền khỏi MySQL.
   */
  const handleDeleteMap = async () => {
    if (!window.confirm('Bạn có chắc muốn xóa bản đồ nền này khỏi cơ sở dữ liệu không?')) {
      return;
    }
    try {
      const res = await requestDeleteMap(currentProject.id);
      if (!res.ok) throw new Error('Lỗi khi xóa bản đồ');
      setMapData(null);
      if (selectedMap) setSelectedMap(null);
    } catch (err) {
      alert(err.message || 'Lỗi khi xóa bản đồ.');
    }
  };

  /**
   * Mở xem chi tiết preset đầy đủ.
   * @param {number} presetId Mã preset
   */
  const handleOpenPresetDetail = async (presetId) => {
    try {
      const res = await requestPresetDetail(currentProject.id, presetId);
      if (!res.ok) throw new Error('Không thể tải thông tin chi tiết hồ sơ.');
      const resJson = await res.json();
      setSelectedPreset(resJson.data);
    } catch (err) {
      alert(err.message || 'Lỗi đọc chi tiết.');
    }
  };

  /**
   * Sao chép văn bản vào bộ nhớ tạm.
   * @param {string} text Nội dung cần copy
   * @param {'positive' | 'negative'} type Loại prompt
   */
  const handleCopyText = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (type === 'positive') {
      setCopiedPos(true);
      setTimeout(() => setCopiedPos(false), 2000);
    } else {
      setCopiedNeg(true);
      setTimeout(() => setCopiedNeg(false), 2000);
    }
  };

  /** Nạp đầy đủ hồ sơ trước khi chuyển sang Studio. */
  const handleLoadPresetToStudio = async (presetId) => {
    const res = await requestPresetDetail(currentProject.id, presetId);
    if (res.ok) {
      const json = await res.json();
      onLoadPresetToStudio(json.data);
    }
  };

  return { handleLoadPresetToStudio, presets, sprites, characters, mapData, selectedCharIds, setSelectedCharIds, handleDeploySelectedToGodot, loading, error, selectedPreset, setSelectedPreset, selectedSprite, setSelectedSprite, selectedCharacter, setSelectedCharacter, selectedMap, setSelectedMap, copiedPos, copiedNeg, fetchAllAssets, handleOpenInWorkspace, handleOpenInGodot, handleDownloadSprite, handleDeleteSprite, handleDeletePreset, handleDeleteCharacter, handleDeleteMap, handleOpenPresetDetail, handleCopyText };
}
