// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT
// ========================================================
// React tạo các phần tử trong cây giao diện.
import React from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI
// ========================================================
// lucide-react cung cấp biểu tượng cho các nút thao tác.
import { ArrowRight, Check, Copy, Download, Gamepad2, Trash2, Wrench, X } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// ========================================================
// Định dạng ngày lưu và dung lượng ảnh.
import { formatBytes, formatDate } from './formatAssets';
// Tạo đường dẫn ảnh gốc và ảnh đã xử lý.
import { spriteImageUrl } from './assetRequests';

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC
// ========================================================

/**
 * Hiển thị hồ sơ nhân vật và hai prompt đã lưu.
 * @param {Object} options Dữ liệu chi tiết và hàm xử lý do kho tài nguyên quản lý.
 * @returns {React.ReactElement} Nội dung cửa sổ chi tiết.
 */
export function renderPresetDetail({
  selectedPreset,
  copiedPos,
  copiedNeg,
  handleCopyText,
  onLoadPresetToStudio,
  onClose
}) {
  return (
    <div
      className="atelier-assets-modal-overlay"
      onClick={onClose}
    >
      <div
        className="atelier-assets-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.15rem', color: '#fff', margin: 0, fontWeight: 700 }}>
            {selectedPreset.name}
          </h2>
          <button
            type="button"
            className="atelier-assets-btn-delete"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ fontSize: '0.85rem', color: '#c084fc', fontWeight: 600 }}>
          🪄 Concept: {selectedPreset.new_character_concept}
        </div>

        {/* Prompt mô tả ảnh cần tạo */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <strong style={{ fontSize: '0.8rem', color: '#34d399' }}>Positive Prompt (Mô tả chi tiết tạo ảnh)</strong>
            <button
              type="button"
              className="atelier-assets-btn-sub"
              onClick={() => handleCopyText(selectedPreset.positive_prompt, 'positive')}
            >
              {copiedPos ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              <span>{copiedPos ? 'Đã chép' : 'Sao chép'}</span>
            </button>
          </div>
          <textarea
            readOnly
            value={selectedPreset.positive_prompt}
            rows={4}
            style={{
              width: '100%',
              background: 'rgba(10, 7, 20, 0.85)',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              borderRadius: '8px',
              color: '#ffffff',
              padding: '10px 12px',
              fontSize: '0.8rem',
              lineHeight: '1.45',
              resize: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Prompt loại bỏ chi tiết không mong muốn */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <strong style={{ fontSize: '0.8rem', color: '#f43f5e' }}>Negative Prompt (Bộ lọc loại bỏ lỗi)</strong>
            <button
              type="button"
              className="atelier-assets-btn-sub"
              onClick={() => handleCopyText(selectedPreset.negative_prompt, 'negative')}
            >
              {copiedNeg ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              <span>{copiedNeg ? 'Đã chép' : 'Sao chép'}</span>
            </button>
          </div>
          <textarea
            readOnly
            value={selectedPreset.negative_prompt}
            rows={3}
            style={{
              width: '100%',
              background: 'rgba(10, 7, 20, 0.85)',
              border: '1px solid rgba(244, 63, 94, 0.25)',
              borderRadius: '8px',
              color: '#fda4af',
              padding: '10px 12px',
              fontSize: '0.8rem',
              lineHeight: '1.45',
              resize: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Cụm nút dưới cửa sổ */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {onLoadPresetToStudio && (
            <button
              type="button"
              className="atelier-assets-btn-deploy"
              onClick={() => {
                onLoadPresetToStudio(selectedPreset);
                onClose();
              }}
            >
              <ArrowRight size={14} />
              <span>Mở lại trong Studio</span>
            </button>
          )}
          <button
            type="button"
            className="atelier-assets-btn-sub"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hiển thị ảnh sprite gốc và ảnh đã xử lý nếu có.
 * @param {Object} options Dữ liệu chi tiết và hàm xử lý do kho tài nguyên quản lý.
 * @returns {React.ReactElement} Nội dung cửa sổ chi tiết.
 */
export function renderSpriteDetail({
  selectedSprite,
  projectId,
  handleDeleteSprite,
  handleDownloadSprite,
  onLoadSpriteToWorkspace,
  handleOpenInWorkspace,
  onClose
}) {
  return (
    <div
      className="atelier-assets-modal-overlay"
      onClick={onClose}
    >
      <div
        className="atelier-assets-modal-box"
        style={{ maxWidth: '800px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', color: '#fff', margin: '0 0 4px', fontWeight: 700 }}>
              {selectedSprite.name}
            </h2>
            <span style={{ fontSize: '0.725rem', color: 'var(--atl-text-secondary)' }}>
              Lưu ngày: {formatDate(selectedSprite.created_at)}
            </span>
          </div>
          <button
            type="button"
            className="atelier-assets-btn-delete"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Vùng xem ảnh lớn */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: selectedSprite.has_processed ? '1fr 1fr' : '1fr',
          gap: '16px'
        }}>
          {/* Cột ảnh gốc */}
          <div>
            <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 600, marginBottom: '6px' }}>
              Ảnh gốc ban đầu (Raw)
            </div>
            <div style={{
              height: '240px',
              backgroundColor: '#07050e',
              borderRadius: '8px',
              border: '1px solid rgba(168, 85, 247, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              <img
                src={spriteImageUrl(projectId, selectedSprite.id)}
                alt="Raw Sprite"
                style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain', imageRendering: 'pixelated' }}
              />
            </div>
            <div style={{ fontSize: '0.7rem', color: '#6e658a', marginTop: '4px' }}>
              Dung lượng: {formatBytes(selectedSprite.raw_bytes)}
            </div>
          </div>

          {/* Cột ảnh đã xử lý */}
          {selectedSprite.has_processed && (
            <div>
              <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600, marginBottom: '6px' }}>
                Ảnh sau khi chuẩn hóa (Processed)
              </div>
              <div style={{
                height: '240px',
                backgroundColor: '#07050e',
                borderRadius: '8px',
                border: '1px solid rgba(168, 85, 247, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                <img
                  src={spriteImageUrl(projectId, selectedSprite.id, true)}
                  alt="Processed Sprite"
                  style={{ maxWidth: '95%', maxHeight: '95%', objectFit: 'contain', imageRendering: 'pixelated' }}
                />
              </div>
              <div style={{ fontSize: '0.7rem', color: '#6e658a', marginTop: '4px' }}>
                Dung lượng: {formatBytes(selectedSprite.processed_bytes)}
              </div>
            </div>
          )}
        </div>

        {/* Cụm nút tác vụ dưới chân Modal */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            type="button"
            className="atelier-assets-btn-delete"
            onClick={() => handleDeleteSprite(selectedSprite.id, selectedSprite.name)}
            style={{ color: '#f87171' }}
          >
            <Trash2 size={14} />
            <span>Xóa ảnh khỏi MySQL</span>
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="atelier-assets-btn-sub"
              onClick={() => handleDownloadSprite(selectedSprite, selectedSprite.has_processed)}
            >
              <Download size={14} />
              <span>Tải PNG về</span>
            </button>

            {onLoadSpriteToWorkspace && (
              <button
                type="button"
                className="atelier-assets-btn-sub primary-link"
                onClick={() => {
                  handleOpenInWorkspace(selectedSprite);
                  onClose();
                }}
              >
                <Wrench size={14} />
                <span>Mở vào Workspace</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hiển thị các khung ảnh của nhân vật trong phòng thử nghiệm.
 * @param {Object} options Dữ liệu chi tiết và hàm xử lý do kho tài nguyên quản lý.
 * @returns {React.ReactElement} Nội dung cửa sổ chi tiết.
 */
export function renderCharacterDetail({
  selectedCharacter,
  onSelectTab,
  onClose
}) {
  return (
    <div
      className="atelier-assets-modal-overlay"
      onClick={onClose}
    >
      <div
        className="atelier-assets-modal-box"
        style={{ maxWidth: '720px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', color: '#fff', margin: '0 0 2px', fontWeight: 700 }}>
              Bộ Khung Hoạt Họa 15 Ô: {selectedCharacter.name}
            </h2>
            <span style={{ fontSize: '0.725rem', color: '#10b981' }}>
              Gồm 3 hàng: Hướng xuống (Down), Hướng ngang (Side), Hướng lên (Up)
            </span>
          </div>
          <button
            type="button"
            className="atelier-assets-btn-delete"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        {/* Bảng hiển thị 15 ô */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {['down', 'side', 'up'].map((dir) => (
            <div key={dir} style={{ background: 'rgba(10, 7, 20, 0.75)', borderRadius: '10px', padding: '12px', border: '1px solid rgba(168, 85, 247, 0.18)' }}>
              <div style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: 600, marginBottom: '8px' }}>
                {dir === 'down' ? '⬇ Hướng Nhìn Xuống (Down)' : dir === 'side' ? '➡ Hướng Nhìn Ngang (Side)' : '⬆ Hướng Nhìn Lên (Up)'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                {[0, 1, 2, 3, 4].map((c) => {
                  const slotKey = `${dir}_${c}`;
                  const slotImg = selectedCharacter.slots_data?.[slotKey];
                  return (
                    <div
                      key={slotKey}
                      style={{
                        height: '74px',
                        backgroundColor: '#07050e',
                        borderRadius: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(168, 85, 247, 0.16)',
                        position: 'relative'
                      }}
                    >
                      {slotImg ? (
                        <img src={slotImg} alt={slotKey} style={{ maxWidth: '90%', maxHeight: '80%', objectFit: 'contain', imageRendering: 'pixelated' }} />
                      ) : (
                        <span style={{ fontSize: '0.65rem', color: '#6e658a' }}>Rỗng</span>
                      )}
                      <span style={{ position: 'absolute', bottom: '2px', fontSize: '0.6rem', color: '#94a3b8' }}>
                        {c === 0 ? 'idle' : `walk_${c}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {onSelectTab && (
            <button
              type="button"
              className="atelier-assets-btn-deploy"
              onClick={() => {
                onSelectTab('godot_testbed');
                onClose();
              }}
            >
              <Gamepad2 size={14} />
              <span>Mở trong Godot Testbed</span>
            </button>
          )}
          <button
            type="button"
            className="atelier-assets-btn-sub"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Hiển thị ảnh bản đồ nền ở kích thước lớn.
 * @param {Object} options Dữ liệu chi tiết và hàm xử lý do kho tài nguyên quản lý.
 * @returns {React.ReactElement} Nội dung cửa sổ chi tiết.
 */
export function renderMapDetail({
  selectedMap,
  onClose
}) {
  return (
    <div
      className="atelier-assets-modal-overlay"
      onClick={onClose}
    >
      <div
        className="atelier-assets-modal-box"
        style={{ maxWidth: '850px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '1.15rem', color: '#fff', margin: 0, fontWeight: 700 }}>
            {selectedMap.name}
          </h2>
          <button
            type="button"
            className="atelier-assets-btn-delete"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{
          maxHeight: '520px',
          overflow: 'auto',
          background: '#07050e',
          borderRadius: '10px',
          border: '1px solid rgba(168, 85, 247, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px'
        }}>
          <img
            src={selectedMap.map_image_base64}
            alt={selectedMap.name}
            style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            className="atelier-assets-btn-sub"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
