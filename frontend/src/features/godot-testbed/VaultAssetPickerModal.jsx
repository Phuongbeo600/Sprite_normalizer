// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT (Quản lý component & trạng thái)
// ========================================================
import React, { useState, useEffect } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Biểu tượng kho lưu trữ, tìm kiếm, kiểm tra và tải về
import {
  Archive,
  Search,
  X,
  Check,
  LoaderCircle,
  FolderOpen,
  Sparkles,
  Layers,
  Gamepad2,
} from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Components & Schemas)
// ========================================================
// Tải tài nguyên và đọc metadata mà không trộn với giao diện.
import { loadVaultSprites, loadVaultAsset, parseVaultMetadata } from './vaultPickerApi';
// (Không có phụ thuộc nội bộ)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & MÀU SẮC (Stylesheets)
// ========================================================
// Kế thừa phong cách Dark Fantasy Atelier từ godot-atelier.css

/**
 * Hộp thoại chọn Sprite Sheet hoặc Bộ Frame từ Kho tài nguyên MySQL vào phòng Thử nghiệm Godot.
 * Hỗ trợ 2 chế độ:
 * 1. Nhập tạo thành một nhân vật mới trên sân khấu.
 * 2. Thay thế khung ảnh / bộ hoạt họa cho nhân vật đang chọn.
 *
 * @param {Object} props Thuộc tính truyền vào.
 * @param {boolean} props.isOpen Trạng thái mở modal.
 * @param {Function} props.onClose Hàm đóng modal.
 * @param {number|string} props.projectId Mã dự án hiện tại.
 * @param {Object|null} [props.targetChar] Nhân vật đang được chọn để thay thế khung (hoặc null nếu tạo mới).
 * @param {Function} props.onSelectAsset Hàm callback khi người dùng chọn một tài nguyên.
 * @returns {React.ReactElement|null} Hộp thoại chọn tài nguyên.
 */
export default function VaultAssetPickerModal({
  isOpen,
  onClose,
  projectId,
  targetChar = null,
  onSelectAsset,
}) {
  const [sprites, setSprites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('ALL');
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState('');

  // Tải danh sách sprite từ CSDL MySQL khi mở modal
  useEffect(() => {
    if (!isOpen || !projectId) return;
    setLoading(true);
    setError('');
    loadVaultSprites(projectId)
      .then((data) => {
        setSprites(data.sprites || []);
      })
      .catch((err) => {
        setError(err.message || 'Lỗi khi tải kho tài nguyên.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  // Lọc danh sách thư mục duy nhất
  const folders = ['ALL', ...new Set(sprites.map((s) => s.folder_name || 'Mặc định'))];

  // Lọc tài nguyên theo thư mục và từ khóa tìm kiếm
  const filteredSprites = sprites.filter((s) => {
    const matchFolder = selectedFolder === 'ALL' || (s.folder_name || 'Mặc định') === selectedFolder;
    const nameStr = `${s.name || ''} ${s.folder_name || ''}`.toLowerCase();
    const matchSearch = !searchTerm.trim() || nameStr.includes(searchTerm.trim().toLowerCase());
    return matchFolder && matchSearch;
  });

  /**
   * Xử lý khi người dùng click chọn nạp một tài nguyên
   */
  const handlePick = async (sprite) => {
    if (loadingId) return;
    setLoadingId(sprite.id);
    setError('');
    try {
      onSelectAsset(await loadVaultAsset(sprite, projectId));

      onClose();
    } catch (err) {
      setError(err.message || 'Lỗi khi nạp tài nguyên.');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '85vh',
          backgroundColor: '#120d24',
          border: '1px solid rgba(192, 132, 252, 0.35)',
          borderRadius: '16px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#f8fafc',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header Modal */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, rgba(147, 51, 234, 0.15), transparent)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(147, 51, 234, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#c084fc',
              }}
            >
              <Archive size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
                {targetChar
                  ? `Nạp Khung / Sheet vào: ${targetChar.name}`
                  : 'Nhập Nhân Vật từ Kho tài nguyên'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#a39bc2' }}>
                {targetChar
                  ? 'Thay thế ảnh Sprite Sheet và bộ hoạt họa của nhân vật đang chọn'
                  : 'Chọn bộ Sprite Sheet hoặc Thư mục hoạt họa trong CSDL MySQL để đưa lên sàn diễn'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 2. Thanh lọc & Tìm kiếm */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center',
            backgroundColor: 'rgba(15, 10, 30, 0.6)',
          }}
        >
          {/* Ô tìm kiếm */}
          <div
            style={{
              flex: '1 1 200px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(12, 8, 24, 0.8)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              borderRadius: '8px',
              padding: '6px 10px',
            }}
          >
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder="Tìm theo tên bộ hoạt họa, thư mục…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '0.8rem',
                outline: 'none',
                width: '100%',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Chọn thư mục */}
          {folders.length > 2 && (
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', maxWidth: '320px' }}>
              {folders.map((fName) => (
                <button
                  key={fName}
                  type="button"
                  onClick={() => setSelectedFolder(fName)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    border: '1px solid',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    backgroundColor: selectedFolder === fName ? 'rgba(147, 51, 234, 0.3)' : 'rgba(255, 255, 255, 0.04)',
                    borderColor: selectedFolder === fName ? '#c084fc' : 'rgba(255, 255, 255, 0.08)',
                    color: selectedFolder === fName ? '#f5f3ff' : '#94a3b8',
                  }}
                >
                  {fName === 'ALL' ? 'Tất cả' : fName}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3. Danh sách tài nguyên */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#a39bc2' }}>
              <LoaderCircle size={28} className="atelier-ws-spinner-icon" style={{ margin: '0 auto 10px auto' }} />
              <div style={{ fontSize: '0.85rem' }}>Đang nạp danh sách tài nguyên từ MySQL…</div>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fca5a5',
                fontSize: '0.8rem',
              }}
            >
              {error}
            </div>
          )}

          {!loading && !error && filteredSprites.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
              <FolderOpen size={36} color="#475569" style={{ margin: '0 auto 10px auto' }} />
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#94a3b8' }}>
                Chưa có Sprite Sheet hoặc bộ Frame nào trong Kho tài nguyên
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                Hãy cắt frame và bấm "Lưu bộ Frame vào Thư mục" trong bàn làm việc Workspace trước.
              </div>
            </div>
          )}

          {!loading &&
            filteredSprites.map((s) => {
              const meta = parseVaultMetadata(s.processing_metadata);

              const isResized = Boolean(meta.is_batch_resized);
              const frameW = meta.frame_width || (meta.original_width ? Math.floor(meta.original_width / 5) : 32);
              const frameH = meta.frame_height || (meta.original_height ? Math.floor(meta.original_height / 3) : 48);
              const frameCount = s.frame_count || meta.frame_count || 15;
              const isPicking = loadingId === s.id;

              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '14px',
                    padding: '10px 14px',
                    backgroundColor: 'rgba(24, 18, 44, 0.75)',
                    border: '1px solid rgba(168, 85, 247, 0.18)',
                    borderRadius: '10px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#c084fc';
                    e.currentTarget.style.backgroundColor = 'rgba(32, 22, 58, 0.9)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.18)';
                    e.currentTarget.style.backgroundColor = 'rgba(24, 18, 44, 0.75)';
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '8px',
                      backgroundColor: '#0c0818',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={`/api/sprites/${s.id}/raw?project_id=${projectId}`}
                      alt={s.name}
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        imageRendering: 'pixelated',
                      }}
                      loading="lazy"
                    />
                  </div>

                  {/* Thông tin */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: '#ffffff',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {s.folder_name || s.name}
                      </span>
                      {isResized && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            border: '1px solid rgba(16, 185, 129, 0.35)',
                            color: '#34d399',
                            fontWeight: 600,
                          }}
                        >
                          Đã ép {frameW}×{frameH}px
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
                      <span>📁 {s.folder_name || 'Mặc định'}</span>
                      <span>•</span>
                      <span>🎞 {frameCount} frame (lưới 3×5)</span>
                      <span>•</span>
                      <span>📐 {frameW} × {frameH} px mỗi ô</span>
                    </div>
                  </div>

                  {/* Nút Chọn Nạp */}
                  <button
                    type="button"
                    disabled={Boolean(loadingId)}
                    onClick={() => handlePick(s)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '7px 14px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(147, 51, 234, 0.25)',
                      border: '1px solid rgba(192, 132, 252, 0.4)',
                      color: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      if (!loadingId) {
                        e.currentTarget.style.backgroundColor = '#9333ea';
                        e.currentTarget.style.borderColor = '#c084fc';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loadingId) {
                        e.currentTarget.style.backgroundColor = 'rgba(147, 51, 234, 0.25)';
                        e.currentTarget.style.borderColor = 'rgba(192, 132, 252, 0.4)';
                      }
                    }}
                  >
                    {isPicking ? (
                      <>
                        <LoaderCircle size={14} className="atelier-ws-spinner-icon" />
                        <span>Đang nạp…</span>
                      </>
                    ) : (
                      <>
                        <Gamepad2 size={14} color="#c084fc" />
                        <span>{targetChar ? 'Gán vào nhân vật' : 'Nạp lên sàn diễn'}</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
        </div>

        {/* 4. Footer Modal */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.75rem',
            color: '#64748b',
            backgroundColor: 'rgba(12, 8, 24, 0.8)',
          }}
        >
          <span>Tìm thấy {filteredSprites.length} bộ hoạt họa trong CSDL dự án</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#cbd5e1',
              fontSize: '0.75rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
