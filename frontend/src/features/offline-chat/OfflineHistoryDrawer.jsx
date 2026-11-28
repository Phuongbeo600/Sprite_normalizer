// ========================================================
// 1. THƯ VIỆN NỀN TẢNG REACT
// ========================================================
import React, { useState } from 'react';

// ========================================================
// 2. THƯ VIỆN BÊN NGOÀI (Third-party packages)
// ========================================================
// lucide-react: Biểu tượng tạo đoạn mới, đổi tên, xác nhận và xóa hội thoại
import { Check, Edit2, MessageSquare, Plus, Trash2, X } from 'lucide-react';

// ========================================================
// 3. THÀNH PHẦN NỘI BỘ DỰ ÁN
// ========================================================
// (Dữ liệu phiên và callback do OfflineChatWidget truyền xuống)

// ========================================================
// 4. ĐỊNH DẠNG GIAO DIỆN & CẤU HÌNH
// ========================================================
function formatUpdatedAt(isoStr) {
  if (!isoStr) return '';
  try {
    const parsed = new Date(isoStr.includes('T') ? isoStr : isoStr.replace(' ', 'T') + 'Z');
    if (Number.isNaN(parsed.getTime())) return isoStr;
    return parsed.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  } catch {
    return isoStr;
  }
}

/**
 * Bảng lịch sử hội thoại ChatGPT-style cho Trợ Lý AI RAG Offline.
 * Hỗ trợ mở lại hội thoại cũ, tạo cuộc trò chuyện mới, đổi tên và xóa hội thoại.
 *
 * @param {Object} props Thuộc tính điều khiển danh sách phiên hội thoại.
 * @returns {React.ReactElement} Ngăn kéo danh sách lịch sử hội thoại.
 */
export default function OfflineHistoryDrawer({
  sessions,
  sessionsLoading,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onRenameSession,
  onDeleteSession,
  onClose,
}) {
  const [editingId, setEditingId] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const startRename = (session, event) => {
    event.stopPropagation();
    setConfirmDeleteId(null);
    setEditingId(session.id);
    setDraftTitle(session.title || '');
  };

  const submitRename = async (sessionId, event) => {
    event?.stopPropagation();
    const ok = await onRenameSession(sessionId, draftTitle);
    if (ok) {
      setEditingId(null);
      setDraftTitle('');
    }
  };

  const handleRenameKeyDown = (sessionId, event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitRename(sessionId);
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      setEditingId(null);
    }
  };

  return (
    <section className="atelier-offline-history-drawer" aria-label="Lịch sử cuộc trò chuyện">
      <div className="atelier-offline-history-bar">
        <span className="atelier-offline-history-heading">Lịch sử hội thoại</span>
        <div className="atelier-offline-history-bar-actions">
          <button type="button" className="atelier-offline-btn is-primary" onClick={onNewChat}>
            <Plus size={13} /> Trò chuyện mới
          </button>
          <button
            type="button"
            className="atelier-offline-icon-btn"
            onClick={onClose}
            title="Đóng bảng lịch sử"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {sessionsLoading && sessions.length === 0 ? (
        <div className="atelier-offline-history-empty">Đang tải danh sách hội thoại...</div>
      ) : sessions.length === 0 ? (
        <div className="atelier-offline-history-empty">
          Chưa có cuộc trò chuyện nào được lưu. Hãy đặt câu hỏi để bắt đầu.
        </div>
      ) : (
        <div className="atelier-offline-history-list">
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isEditing = editingId === session.id;
            const isConfirmingDelete = confirmDeleteId === session.id;
            return (
              <div
                key={session.id}
                className={`atelier-offline-history-item ${isActive ? 'is-active' : ''}`}
                onClick={() => {
                  if (!isEditing) onSelectSession(session.id);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && !isEditing && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onSelectSession(session.id);
                  }
                }}
              >
                <MessageSquare size={14} className="atelier-offline-history-icon" />

                <div className="atelier-offline-history-body">
                  {isEditing ? (
                    <input
                      type="text"
                      className="atelier-offline-history-input"
                      value={draftTitle}
                      maxLength={120}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onKeyDown={(e) => handleRenameKeyDown(session.id, e)}
                    />
                  ) : (
                    <>
                      <div className="atelier-offline-history-title" title={session.title}>
                        {session.title}
                      </div>
                      <div className="atelier-offline-history-time">{formatUpdatedAt(session.updated_at)}</div>
                    </>
                  )}
                </div>

                <div className="atelier-offline-history-actions" onClick={(e) => e.stopPropagation()}>
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        className="atelier-offline-icon-btn is-primary"
                        onClick={(e) => submitRename(session.id, e)}
                        title="Lưu tiêu đề"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        type="button"
                        className="atelier-offline-icon-btn"
                        onClick={() => setEditingId(null)}
                        title="Hủy"
                      >
                        <X size={12} />
                      </button>
                    </>
                  ) : isConfirmingDelete ? (
                    <>
                      <button
                        type="button"
                        className="atelier-offline-btn is-danger"
                        onClick={() => {
                          setConfirmDeleteId(null);
                          onDeleteSession(session.id);
                        }}
                      >
                        Xóa
                      </button>
                      <button
                        type="button"
                        className="atelier-offline-btn"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Hủy
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="atelier-offline-icon-btn"
                        onClick={(e) => startRename(session, e)}
                        title="Đổi tên cuộc trò chuyện"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        type="button"
                        className="atelier-offline-icon-btn is-danger"
                        onClick={() => setConfirmDeleteId(session.id)}
                        title="Xóa cuộc trò chuyện"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
