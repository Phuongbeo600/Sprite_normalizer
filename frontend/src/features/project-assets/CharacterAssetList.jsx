// 1. THƯ VIỆN NỀN TẢNG (Dựng danh sách tài nguyên)
import React from 'react';

// 2. THƯ VIỆN BÊN NGOÀI (Biểu tượng thao tác)
import { Gamepad2, Eye, Trash2, RefreshCw, ArrowRight } from "lucide-react";

// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN (Định dạng và tài nguyên dùng chung)
import { PixelSword } from "../../shared/ui/PixelArtIcons";

// 4. ĐỊNH DẠNG GIAO DIỆN / CẤU HÌNH (Kế thừa từ trang kho tài nguyên)

/** Hiển thị một danh mục; trạng thái và thao tác do phiên kho tài nguyên sở hữu. */
export default function CharacterAssetList({ characters, handleDeleteCharacter, handleDeploySelectedToGodot, loading, onDeployCharactersToGodot, onSelectTab, selectedCharIds, setSelectedCharIds, setSelectedCharacter }) {
  return (
<div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 16px', color: '#a39bc2' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 8px', display: 'block' }} />
              <span>Đang tải danh sách nhân vật Godot từ MySQL…</span>
            </div>
          ) : characters.length === 0 ? (
            <div className="atelier-assets-empty">
              <div className="pixel-empty-icon-wrap">
                <div className="pixel-empty-circle-aura" />
                <PixelSword size={56} className="pixel-art-glow-amber pixel-art-float" />
              </div>
              <h3>Chưa có nhân vật nào được lưu trong Godot Testbed</h3>
              <p>
                Hãy mở mục <strong>"Thử nghiệm Godot"</strong>, cấu hình nhân vật từ 15 ô frame hoạt họa hoặc Sprite Sheet để kiểm thử và lưu vào đội hình.
              </p>
              {onSelectTab && (
                <button
                  type="button"
                  className="atelier-assets-btn-sub primary-link"
                  onClick={() => onSelectTab('godot_testbed')}
                  style={{ marginTop: '8px', padding: '8px 16px' }}
                >
                  <Gamepad2 size={14} />
                  <span>Mở Thử nghiệm Godot</span>
                </button>
              )}
            </div>
          ) : (
            <div>
              {/* Thanh điều phối đội hình */}
              <div className="atelier-assets-squad-bar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.825rem', color: '#fff', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={characters.length > 0 && selectedCharIds.size === characters.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCharIds(new Set(characters.map((c) => c.id)));
                        } else {
                          setSelectedCharIds(new Set());
                        }
                      }}
                      style={{ accentColor: '#10b981', cursor: 'pointer', width: '16px', height: '16px' }}
                    />
                    <span>Chọn tất cả ({selectedCharIds.size}/{characters.length} nhân vật đã chọn)</span>
                  </label>
                </div>

                <button
                  type="button"
                  className="atelier-assets-btn-deploy"
                  disabled={selectedCharIds.size === 0}
                  onClick={handleDeploySelectedToGodot}
                  title="Đưa các nhân vật đã tích chọn vào phòng thử nghiệm Godot"
                >
                  <Gamepad2 size={15} />
                  <span>Đưa {selectedCharIds.size} nhân vật vào Godot Testbed</span>
                  <ArrowRight size={13} />
                </button>
              </div>

              {/* Lưới các thẻ nhân vật */}
              <div className="atelier-assets-grid">
                {characters.map((char) => {
                  const slotCount = Object.keys(char.slots_data || {}).length;
                  const idleDown = char.slots_data?.down_0;
                  const isChecked = selectedCharIds.has(char.id);

                  return (
                    <div
                      key={char.id}
                      className={`atelier-assets-card ${isChecked ? 'selected' : ''}`}
                      style={{ position: 'relative' }}
                    >
                      {/* Checkbox tích chọn ở góc trên phải */}
                      <label
                        style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          background: isChecked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(14, 10, 26, 0.85)',
                          border: isChecked ? '1px solid rgba(16, 185, 129, 0.45)' : '1px solid rgba(168, 85, 247, 0.2)',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.725rem',
                          color: isChecked ? '#34d399' : 'var(--atl-text-secondary)',
                          transition: 'all 0.15s ease'
                        }}
                        title="Tích chọn nhân vật này để đưa vào Godot Testbed"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedCharIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(char.id)) next.delete(char.id);
                              else next.add(char.id);
                              return next;
                            });
                          }}
                          style={{ accentColor: '#10b981', cursor: 'pointer', width: '14px', height: '14px' }}
                        />
                        <span>{isChecked ? 'Đã chọn' : 'Bỏ chọn'}</span>
                      </label>

                      <div>
                        {/* Tiêu đề & Icon */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                          <div
                            style={{
                              width: '48px',
                              height: '48px',
                              background: '#07050e',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                              border: '1px solid rgba(168, 85, 247, 0.2)'
                            }}
                          >
                            {idleDown ? (
                              <img src={idleDown} alt={char.name} style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain', imageRendering: 'pixelated' }} />
                            ) : (
                              <span style={{ fontSize: '1.4rem' }}>🦸‍♂️</span>
                            )}
                          </div>

                          <div>
                            <h3 style={{ fontSize: '0.96rem', color: '#fff', margin: '0 0 2px', fontWeight: 600, paddingRight: '80px' }}>
                              {char.name}
                            </h3>
                            <div style={{ fontSize: '0.725rem', color: '#34d399', fontWeight: 600 }}>
                              🎮 {slotCount}/15 ô frame hoạt họa
                            </div>
                          </div>
                        </div>

                        {/* Các thông số kỹ thuật */}
                        <div className="atelier-assets-metrics-row">
                          <span className="atelier-assets-metric-pill neutral">
                            Tỉ lệ: {char.scale || 1.0}x
                          </span>
                          <span className="atelier-assets-metric-pill neutral">
                            Tốc độ: {char.fps || 8} FPS
                          </span>
                          <span className="atelier-assets-metric-pill neutral">
                            Vị trí X: {char.pos_x || 260}px
                          </span>
                        </div>
                      </div>

                      {/* Nút hành động */}
                      <div className="atelier-assets-card-actions">
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="atelier-assets-btn-sub"
                            onClick={() => setSelectedCharacter(char)}
                            title="Xem toàn bộ 15 ô frame của nhân vật"
                          >
                            <Eye size={12} />
                            <span>Xem 15 ô</span>
                          </button>

                          <button
                            type="button"
                            className="atelier-assets-btn-sub primary-link"
                            onClick={() => {
                              if (onDeployCharactersToGodot) {
                                onDeployCharactersToGodot([char.id]);
                              } else if (onSelectTab) {
                                onSelectTab('godot_testbed');
                              }
                            }}
                            title="Chỉ đưa riêng nhân vật này vào Godot Testbed"
                          >
                            <Gamepad2 size={12} />
                            <span>Vào Testbed</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          className="atelier-assets-btn-delete"
                          onClick={() => handleDeleteCharacter(char.id, char.name)}
                          title="Xóa nhân vật khỏi MySQL"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
  );
}
